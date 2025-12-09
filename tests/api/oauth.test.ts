import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { 
  DatabaseInitializer, 
  JWTService,
  BaseController
} from "open-bauth";
import { getServiceFactory } from "../../src/services/service-factory";
import { testUtils } from "../setup";

describe("OAuth 2.0 API Tests", () => {
  let db: Database;
  let dbInitializer: DatabaseInitializer;
  let jwtService: JWTService;
  let serviceData: any;
  let testUser: any;
  let testClient: any;

  beforeEach(async () => {
    // Setup fresh database
    db = new Database(":memory:");
    dbInitializer = new DatabaseInitializer({ database: db });
    await dbInitializer.initialize();
    await dbInitializer.seedDefaults();

    // Get services from factory
    const factory = getServiceFactory();
    serviceData = factory.getServices();
    jwtService = serviceData.jwtService;

    // Create test user
    const userResult = await serviceData.authService.register({
      email: "test@example.com",
      password: "password123",
      username: "testuser",
      first_name: "Test",
      last_name: "User"
    });

    if (!userResult.success) throw new Error("Failed to create test user");
    testUser = userResult.user;

    // Create test OAuth client using the controller
    const clientController = dbInitializer.createController("oauth_clients");
    const clientResult = await clientController.create({
      client_id: "test-client",
      client_secret: "test-secret",
      client_name: "Test Client",
      redirect_uris: JSON.stringify(["https://example.com/callback"]),
      grant_types: JSON.stringify(["authorization_code", "refresh_token"]),
      response_types: JSON.stringify(["code"]),
      scope: "read write profile",
      is_public: false,
      is_active: true
    });

    if (!clientResult.success) throw new Error("Failed to create test client");
    testClient = clientResult.data;
  });

  afterEach(async () => {
    db.close();
  });

  describe("OAuth Client Management", () => {
    test("should create OAuth client successfully", async () => {
      const clientController = dbInitializer.createController("oauth_clients");
      const clientResult = await clientController.create({
        client_id: "new-client",
        client_secret: "new-secret",
        client_name: "New Client",
        redirect_uris: JSON.stringify(["https://newapp.com/callback"]),
        grant_types: JSON.stringify(["authorization_code"]),
        response_types: JSON.stringify(["code"]),
        scope: "read",
        is_public: false,
        is_active: true
      });

      expect(clientResult.success).toBe(true);
      expect(clientResult.data).toBeDefined();
      expect(clientResult.data?.['client_id']).toBe("new-client");
      expect(clientResult.data?.['client_name']).toBe("New Client");
    });

    test("should find OAuth client by ID", async () => {
      const clientController = dbInitializer.createController("oauth_clients");
      const foundClient = await clientController.findById(testClient.id);
      
      expect(foundClient.success).toBe(true);
      expect(foundClient.data).toBeDefined();
      expect(foundClient.data?.['client_id']).toBe("test-client");
    });

    test("should update OAuth client", async () => {
      const clientController = dbInitializer.createController("oauth_clients");
      const updateResult = await clientController.update(testClient.id, {
        client_name: "Updated Client",
        scope: "read write admin"
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data?.['client_name']).toBe("Updated Client");
      expect(updateResult.data?.['scope']).toBe("read write admin");
    });

    test("should delete OAuth client", async () => {
      const clientController = dbInitializer.createController("oauth_clients");
      const deleteResult = await clientController.delete(testClient.id);
      
      expect(deleteResult.success).toBe(true);

      const foundClient = await clientController.findById(testClient.id);
      expect(foundClient.success).toBe(false);
    });
  });

  describe("JWT Token Operations", () => {
    test("should generate and verify JWT token", async () => {
      const token = await jwtService.generateToken(testUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const payload = await jwtService.verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload.userId).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
    });

    test("should reject invalid JWT token", async () => {
      const payload = await jwtService.verifyToken("invalid-token");
      expect(payload).toBeNull();
    });

    test("should extract token from Authorization header", async () => {
      const token = await jwtService.generateToken(testUser);
      const extracted = jwtService.extractTokenFromHeader(`Bearer ${token}`);
      
      expect(extracted).toBe(token);
    });

    test("should return null for malformed Authorization header", async () => {
      const extracted = jwtService.extractTokenFromHeader("Malformed Header");
      expect(extracted).toBeNull();
    });

    test("should return null for missing Bearer prefix", async () => {
      const token = await jwtService.generateToken(testUser);
      const extracted = jwtService.extractTokenFromHeader(token);
      expect(extracted).toBeNull();
    });
  });

  describe("Refresh Token Operations", () => {
    test("should generate refresh token", async () => {
      const refreshToken = await jwtService.generateRefreshToken(testUser.id);
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe("string");

      const userId = await jwtService.verifyRefreshToken(refreshToken);
      expect(userId).toBe(testUser.id);
    });

    test("should reject invalid refresh token", async () => {
      const userId = await jwtService.verifyRefreshToken("invalid-refresh-token");
      expect(userId).toBeNull();
    });

    test("should get token remaining time", async () => {
      const token = await jwtService.generateToken(testUser);
      const remainingTime = jwtService.getTokenRemainingTime(token);
      
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(3600); // 1 hour default
    });

    test("should detect expired token", async () => {
      // Create a token that expires in 1ms
      const shortLivedJWT = new JWTService("test-secret", "1ms");
      const token = await shortLivedJWT.generateToken(testUser);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const isExpired = jwtService.isTokenExpired(token);
      expect(isExpired).toBe(true);
    });
  });

  describe("User Authentication Flow", () => {
    test("should authenticate user with valid credentials", async () => {
      const loginResult = await serviceData.authService.login({
        email: "test@example.com",
        password: "password123"
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.token).toBeDefined();
      expect(loginResult.user).toBeDefined();
      expect(loginResult.user.email).toBe("test@example.com");
    });

    test("should reject authentication with invalid password", async () => {
      const loginResult = await serviceData.authService.login({
        email: "test@example.com",
        password: "wrongpassword"
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toBeDefined();
      expect(loginResult.token).toBeUndefined();
    });

    test("should reject authentication with non-existent user", async () => {
      const loginResult = await serviceData.authService.login({
        email: "nonexistent@example.com",
        password: "password123"
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toBeDefined();
    });
  });

  describe("Permission and Role Management", () => {
    test("should create and assign role to user", async () => {
      // Create a role
      const roleResult = await serviceData.permissionService.createRole({
        name: "test-role",
        description: "Test Role"
      });

      expect(roleResult.success).toBe(true);
      expect(roleResult.role).toBeDefined();

      // Assign role to user
      const assignResult = await serviceData.permissionService.assignRoleToUser(
        testUser.id,
        roleResult.role!.id
      );

      expect(assignResult.success).toBe(true);

      // Verify user has role
      const userRoles = await serviceData.permissionService.getUserRoles(testUser.id);
      expect(userRoles.length).toBeGreaterThan(0);
      expect(userRoles.some((role: any) => role.name === "test-role")).toBe(true);
    });

    test("should create and assign permission to role", async () => {
      // Create a permission
      const permissionResult = await serviceData.permissionService.createPermission({
        name: "users:read",
        resource: "users",
        action: "read",
        description: "Read users"
      });

      expect(permissionResult.success).toBe(true);
      expect(permissionResult.permission).toBeDefined();

      // Create a role
      const roleResult = await serviceData.permissionService.createRole({
        name: "admin-role",
        description: "Admin Role"
      });

      expect(roleResult.success).toBe(true);

      // Assign permission to role
      const assignResult = await serviceData.permissionService.assignPermissionToRole(
        roleResult.role!.id,
        permissionResult.permission!.id
      );

      expect(assignResult.success).toBe(true);

      // Verify role has permission
      const rolePermissions = await serviceData.permissionService.getRolePermissions(roleResult.role!.id);
      expect(rolePermissions.length).toBeGreaterThan(0);
      expect(rolePermissions.some((perm: any) => perm.name === "users:read")).toBe(true);
    });

    test("should check user permissions", async () => {
      // Create permission and role
      const permissionResult = await serviceData.permissionService.createPermission({
        name: "test:permission",
        resource: "test",
        action: "read"
      });

      const roleResult = await serviceData.permissionService.createRole({
        name: "test-role-with-permission"
      });

      await serviceData.permissionService.assignPermissionToRole(
        roleResult.role!.id,
        permissionResult.permission!.id
      );

      await serviceData.permissionService.assignRoleToUser(
        testUser.id,
        roleResult.role!.id
      );

      // Check permission
      const hasPermission = await serviceData.permissionService.userHasPermission(
        testUser.id,
        "test:permission"
      );

      expect(hasPermission).toBe(true);
    });
  });

  describe("Security Features", () => {
    test("should generate secure random tokens", async () => {
      const token1 = await serviceData.securityService.generateSecureToken();
      const token2 = await serviceData.securityService.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(20);
    });

    test("should hash and verify passwords", async () => {
      const password = "testPassword123!";
      const { hash, salt } = await serviceData.securityService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
      expect(salt.length).toBeGreaterThan(0);

      const isValid = await serviceData.securityService.verifyPassword(password, hash, salt);
      expect(isValid).toBe(true);

      const isInvalid = await serviceData.securityService.verifyPassword("wrongPassword", hash, salt);
      expect(isInvalid).toBe(false);
    });

    test("should generate and verify state parameter", async () => {
      const state = serviceData.securityService.generateState();
      
      expect(state).toBeDefined();
      expect(state.length).toBeGreaterThan(20);
      
      // State should be different each time
      const state2 = serviceData.securityService.generateState();
      expect(state).not.toBe(state2);
    });

    test("should generate and verify nonce parameter", async () => {
      const nonce = serviceData.securityService.generateNonce();
      
      expect(nonce).toBeDefined();
      expect(nonce.length).toBeGreaterThan(20);
      
      // Nonce should be different each time
      const nonce2 = serviceData.securityService.generateNonce();
      expect(nonce).not.toBe(nonce2);
    });
  });

  describe("Audit Logging", () => {
    test("should log authentication events", async () => {
      const auditService = serviceData.auditService;
      
      const logResult = await auditService.log("user.login", {
        userId: testUser.id,
        ip: "192.168.1.1",
        level: "info",
        meta: { method: "password" }
      });

      expect(logResult.success).toBe(true);

      // Verify log was created
      const logs = await auditService.getLogs({ userId: testUser.id });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((log: any) => log.event === "user.login")).toBe(true);
    });

    test("should log security events", async () => {
      const auditService = serviceData.auditService;
      
      const logResult = await auditService.log("security.failed_login", {
        userId: testUser.id,
        ip: "192.168.1.1",
        level: "warn",
        meta: { reason: "invalid_password" }
      });

      expect(logResult.success).toBe(true);

      // Verify security log was created
      const logs = await auditService.getSecurityLogs({ userId: testUser.id });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((log: any) => log.event === "security.failed_login")).toBe(true);
    });
  });

  describe("Rate Limiting", () => {
    test("should allow requests within rate limit", async () => {
      const rateLimitService = serviceData.rateLimitService;
      
      // Multiple requests within limit
      for (let i = 0; i < 5; i++) {
        const allowed = await rateLimitService.consume("test-key", 1, 10, 60);
        expect(allowed).toBe(true);
      }
    });

    test("should block requests exceeding rate limit", async () => {
      const rateLimitService = serviceData.rateLimitService;
      
      // Consume all available requests
      for (let i = 0; i < 10; i++) {
        await rateLimitService.consume("test-key-2", 1, 10, 60);
      }
      
      // This should be blocked
      const allowed = await rateLimitService.consume("test-key-2", 1, 10, 60);
      expect(allowed).toBe(false);
    });

    test("should reset rate limit after window", async () => {
      const rateLimitService = serviceData.rateLimitService;
      const key = "test-key-3";
      
      // Consume all requests
      for (let i = 0; i < 10; i++) {
        await rateLimitService.consume(key, 1, 10, 1); // 1 second window
      }
      
      // Should be blocked
      let allowed = await rateLimitService.consume(key, 1, 10, 1);
      expect(allowed).toBe(false);
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be allowed again
      allowed = await rateLimitService.consume(key, 1, 10, 1);
      expect(allowed).toBe(true);
    });
  });

  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      const result = await serviceData.authService.findUserById("invalid-id");
      expect(result).toBeNull();
    });

    test("should handle invalid input validation", async () => {
      const result = await serviceData.authService.register({
        email: "invalid-email",
        password: "123" // Too short
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("should handle concurrent operations", async () => {
      // Create multiple users concurrently
      const promises = Array.from({ length: 5 }, (_, i) => 
        serviceData.authService.register({
          email: `concurrent${i}@example.com`,
          password: "password123",
          username: `concurrent${i}`
        })
      );

      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
      });
    });
  });
});