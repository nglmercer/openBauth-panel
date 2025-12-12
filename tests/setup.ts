import { DatabaseInitializer } from "open-bauth";
import { JWTServiceBun } from "open-bauth";
import { Database } from "bun:sqlite";
import type { TableSchema } from "open-bauth";
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

export async function createDb(options?: {externalSchemas?: TableSchema[], defaults?: boolean}) {
  const dbInit = new DatabaseInitializer({
    database: new Database(":memory:"),
    enableWAL: true,
    enableForeignKeys: true,
    externalSchemas: options?.externalSchemas || []
  });
  
  if (options?.defaults) {
    await dbInit.initialize();
    await dbInit.seedDefaults();
  }
  
  return { dbInit };
}

// Singleton para compartir la misma instancia de base de datos entre tests
let sharedDbInstance: { dbInit: DatabaseInitializer } | null = null;

export async function getSharedDb(options?: { externalSchemas?: TableSchema[], defaults?: boolean }) {
  if (!sharedDbInstance) {
    sharedDbInstance = await createDb(options);
  }
  return sharedDbInstance;
}

export function resetSharedDb() {
  sharedDbInstance = null;
}
/*
  async seedDefaults() {
    const roleController = this.createController<Role>("roles");
    const permissionController =
      this.createController<Permission>("permissions");
    const rolePermissionController =
      this.createController<RolePermission>("role_permissions");

    // Seed default roles
    const roles = [
      { name: "admin", description: "Administrator role" },
      { name: "moderator", description: "Moderator role" },
      { name: "user", description: "Standard user role" },
    ];

    for (const role of roles) {
      const existing = await roleController.findFirst({ name: role.name });
      if (!existing.data) {
        await roleController.create(role);
      }
    }

    // Seed default permissions
    const permissions = [
      {
        name: "manage:users",
        resource: "users",
        action: "manage",
        description: "Manage users",
      },
      {
        name: "edit:content",
        resource: "content",
        action: "edit",
        description: "Edit content",
      },
    ];

    for (const perm of permissions) {
      const existing = await permissionController.findFirst({
        name: perm.name,
      });
      if (!existing.data) {
        await permissionController.create(perm);
      }
    }

    // Assign permissions to roles
    const adminRole = await roleController.findFirst({ name: "admin" });
    const moderatorRole = await roleController.findFirst({ name: "moderator" });

    if (adminRole.data) {
      const manageUsers = await permissionController.findFirst({
        name: "manage:users",
      });
      if (manageUsers.data) {
        await rolePermissionController.create({
          role_id: adminRole.data.id,
          permission_id: manageUsers.data.id,
        });
      }
    }

    if (moderatorRole.data) {
      const editContent = await permissionController.findFirst({
        name: "edit:content",
      });
      if (editContent.data) {
        await rolePermissionController.create({
          role_id: moderatorRole.data.id,
          permission_id: editContent.data.id,
        });
      }
    }
  }
*/
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
      bio: "Test bio",
      timezone: "UTC",
      language: "en",
      avatar_url: "https://example.com/avatar.jpg",
      phone_number: "+1234567890",
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
  MEDIUM: 5000,     // 5 seconds - increased for complex operations
  LONG: 10000,      // 10 seconds
  VERY_LONG: 15000, // 15 seconds
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