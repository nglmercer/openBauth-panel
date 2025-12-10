import { DatabaseInitializer } from "open-bauth";
import { JWTServiceBun } from "open-bauth";

// Set test environment
process.env['NODE_ENV'] = "test";
process.env['JWT_SECRET'] = "test-jwt-secret-key-for-testing-only";
process.env['DATABASE_URL'] = ":memory:";
process.env['BCRYPT_ROUNDS'] = "4"; // Reduced for faster tests
process.env['RATE_LIMIT_WINDOW'] = "1";
process.env['RATE_LIMIT_MAX_REQUESTS'] = "1000";
// Disable email service for tests (speeds up user creation)
process.env['SMTP_HOST'] = "";
process.env['SMTP_USER'] = "";
process.env['SMTP_PASS'] = "";

// Test utilities
const testUtils = {
  // Generate test user data
  generateTestUser(overrides: any = {}) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000);
    return {
      email: `test${timestamp}_${random}@example.com`,
      password: "TestPassword123!",
      username: `testuser${timestamp}_${random}`,
      first_name: "Test",
      last_name: "User",
      ...overrides
    };
  },

  // Generate test role data
  generateTestRole(overrides: any = {}) {
    const timestamp = Date.now();
    return {
      name: `test_role_${timestamp}`,
      description: "Test role for testing",
      ...overrides
    };
  },

  // Generate test permission data
  generateTestPermission(overrides: any = {}) {
    const timestamp = Date.now();
    return {
      name: `test:permission:${timestamp}`,
      resource: "test",
      action: "read",
      description: "Test permission for testing",
      ...overrides
    };
  },

  // Generate test JWT
  async generateTestJWT(payload: any, options: any = {}) {
    const jwtService = new JWTServiceBun(
      process.env['JWT_SECRET']!,
      options.expiresIn || "1h"
    );
    return await jwtService.generateToken(payload);
  },

  // Create authorization headers
  async createAuthHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`
    };
  },

  // Wait for async operations
  async wait(ms: number = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Clean up test data
  async cleanupTestData(dbInitializer: DatabaseInitializer) {
    const controllers = [
      "users",
      "roles",
      "permissions",
      "user_roles",
      "role_permissions",
      "sessions"
    ];

    for (const tableName of controllers) {
      try {
        const controller = dbInitializer.createController(tableName);
        const records = await controller.findAll({ limit: 1000 });
        for (const record of records.data || []) {
          await controller.delete((record as any).id);
        }
      } catch (error) {
        // Table might not exist, skip
        continue;
      }
    }
  }
};

// Test timeouts
const TEST_TIMEOUTS = {
  SHORT: 100,
  MEDIUM: 3000,     // 3 seconds
  LONG: 5000,      // 5 seconds
  VERY_LONG: 10000, // 10 seconds
};

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// Export test configuration
export {
  testUtils,
  TEST_TIMEOUTS
};

// Re-export commonly used types and utilities
export type {
  User,
  Role,
  Permission,
  AuthResult,
  JWTPayload
} from "open-bauth";

export {
  DatabaseInitializer,
  JWTService
} from "open-bauth";