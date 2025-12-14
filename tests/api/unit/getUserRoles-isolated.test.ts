import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { getServiceFactory } from "../../../src/services/service-factory";
import { createDb, testUtils } from "../../setup";

describe("getUserRoles - Isolated Test", () => {
    let dbInit: any;
    let factory: any;
    let services: any;

    beforeEach(async () => {
        // Create fresh database for each test - WITHOUT defaults to avoid conflicts
        const dbResult = await createDb({ defaults: false });
        dbInit = dbResult.dbInit;
        
        // Create service factory with test database
        factory = getServiceFactory(dbInit);
        services = factory.getServices();
    });

    afterEach(async () => {
        // Cleanup
        if (dbInit) {
            await testUtils.cleanupTestData(dbInit);
        }
    });

    test("getUserRoles should work correctly with existing roles", async () => {
        // Create roles with unique names to avoid conflicts
        const timestamp = Date.now();
        const roleController = dbInit.createController("roles");
        
        const adminRoleResult = await roleController.create({
            id: crypto.randomUUID(),
            name: `admin_${timestamp}`,
            description: "Administrator role",
            is_active: true
        });

        const userRoleResult = await roleController.create({
            id: crypto.randomUUID(),
            name: `user_${timestamp}`,
            description: "Regular user role",
            is_active: true
        });

        console.log("Role creation results:", {
            admin: adminRoleResult,
            user: userRoleResult
        });

        expect(adminRoleResult.success).toBe(true);
        expect(userRoleResult.success).toBe(true);

        // Create a test user
        const userData = testUtils.generateTestUser();
        const userController = dbInit.createController("users");
        const userResult = await userController.create({
            id: crypto.randomUUID(),
            ...userData,
            password_hash: "hashed_password"
        });

        console.log("User creation result:", userResult);
        expect(userResult.success).toBe(true);
        const userId = userResult.data.id;

        // Assign roles to user
        const userRolesController = dbInit.createController("user_roles");
        const adminAssignmentResult = await userRolesController.create({
            id: crypto.randomUUID(),
            user_id: userId,
            role_id: adminRoleResult.data.id
        });

        const userAssignmentResult = await userRolesController.create({
            id: crypto.randomUUID(),
            user_id: userId,
            role_id: userRoleResult.data.id
        });

        expect(adminAssignmentResult.success).toBe(true);
        expect(userAssignmentResult.success).toBe(true);

        // Test getUserRoles - this is the critical test
        console.log("Testing getUserRoles with userId:", userId);
        const roles = await services.authService.getUserRoles(userId);
        
        console.log("getUserRoles result:", roles);
        
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBe(2);
        
        // Check that we got the correct roles
        const roleNames = roles.map((role: any) => role.name);
        expect(roleNames).toContain(`admin_${timestamp}`);
        expect(roleNames).toContain(`user_${timestamp}`);
    });

    test("getUserRoles should return empty array for user with no roles", async () => {
        // Create a test user
        const userData = testUtils.generateTestUser();
        const userController = dbInit.createController("users");
        const userResult = await userController.create({
            id: crypto.randomUUID(),
            ...userData,
            password_hash: "hashed_password"
        });

        console.log("User creation result (no roles test):", userResult);
        expect(userResult.success).toBe(true);
        const userId = userResult.data.id;

        // Test getUserRoles
        console.log("Testing getUserRoles for user with no roles, userId:", userId);
        const roles = await services.authService.getUserRoles(userId);
        
        console.log("getUserRoles result for user without roles:", roles);
        
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBe(0);
    });

    test("getUserRoles should handle non-existent user", async () => {
        const nonExistentUserId = crypto.randomUUID();
        
        console.log("Testing getUserRoles for non-existent user, userId:", nonExistentUserId);
        const roles = await services.authService.getUserRoles(nonExistentUserId);
        
        console.log("getUserRoles result for non-existent user:", roles);
        
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBe(0);
    });
});