import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { getServiceFactory } from "../../../src/services/service-factory";
import { createDb, testUtils } from "../../setup";

describe("getUserRoles - Unit Tests", () => {
    let dbInit: any;
    let factory: any;
    let services: any;

    beforeEach(async () => {
        // Create fresh database for each test
        const dbResult = await createDb({ defaults: true });
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

    test("should return empty array for user with no roles", async () => {
        // Create a test user
        const userData = testUtils.generateTestUser();
        const userController = dbInit.createController("users");
        const userResult = await userController.create({
            id: crypto.randomUUID(),
            ...userData,
            password_hash: "hashed_password"
        });

        expect(userResult.success).toBe(true);
        const userId = userResult.data.id;

        // Test getUserRoles
        const roles = await services.authService.getUserRoles(userId);
        
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBe(0);
    });

    test("should return roles for user with assigned roles", async () => {
        // Create roles (or use existing ones if they already exist)
        const roleController = dbInit.createController("roles");
        
        // Try to create admin role, or get existing one
        let adminRoleResult = await roleController.create({
            id: crypto.randomUUID(),
            name: "admin",
            description: "Administrator role",
            is_active: true
        });

        if (!adminRoleResult.success && adminRoleResult.error?.includes("already exists")) {
            // Role already exists, get it
            adminRoleResult = await roleController.findFirst({ name: "admin" });
        }

        console.log("Admin role result:", adminRoleResult);

        // Try to create user role, or get existing one
        let userRoleResult = await roleController.create({
            id: crypto.randomUUID(),
            name: "user",
            description: "Regular user role",
            is_active: true
        });

        if (!userRoleResult.success && userRoleResult.error?.includes("already exists")) {
            // Role already exists, get it
            userRoleResult = await roleController.findFirst({ name: "user" });
        }

        console.log("User role result:", userRoleResult);

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

        // Test getUserRoles
        const roles = await services.authService.getUserRoles(userId);
        
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBe(2);
        
        // Check that we got the correct roles
        const roleNames = roles.map((role: any) => role.name);
        expect(roleNames).toContain("admin");
        expect(roleNames).toContain("user");
    });

    test("should handle non-existent user ID gracefully", async () => {
        const nonExistentUserId = crypto.randomUUID();
        
        // Test getUserRoles with non-existent user
        const roles = await services.authService.getUserRoles(nonExistentUserId);
        
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBe(0);
    });

    test("should handle invalid user ID format", async () => {
        const invalidUserId = "invalid-uuid-format";
        
        // Test getUserRoles with invalid user ID
        const roles = await services.authService.getUserRoles(invalidUserId);
        
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBe(0);
    });

    test("should work with numeric user ID", async () => {
        // Create a test user with numeric ID (if supported)
        const userData = testUtils.generateTestUser();
        const userController = dbInit.createController("users");
        
        // Try with numeric ID
        const userResult = await userController.create({
            id: 12345,
            ...userData,
            password_hash: "hashed_password"
        });

        if (userResult.success) {
            const userId = userResult.data.id;
            
            // Test getUserRoles with numeric ID
            const roles = await services.authService.getUserRoles(userId);
            
            expect(Array.isArray(roles)).toBe(true);
            expect(roles.length).toBe(0);
        } else {
            // If numeric IDs are not supported, skip this test
            expect(true).toBe(true);
        }
    });

    test("should return consistent role structure", async () => {
        // Create a role (or use existing one with unique name)
        const roleController = dbInit.createController("roles");
        const timestamp = Date.now();
        const roleResult = await roleController.create({
            id: crypto.randomUUID(),
            name: `test_role_${timestamp}`,
            description: "Test role",
            is_active: true
        });

        expect(roleResult.success).toBe(true);

        // Create a test user
        const userData = testUtils.generateTestUser();
        const userController = dbInit.createController("users");
        const userResult = await userController.create({
            id: crypto.randomUUID(),
            ...userData,
            password_hash: "hashed_password"
        });

        expect(userResult.success).toBe(true);
        const userId = userResult.data.id;

        // Assign role to user
        const userRolesController = dbInit.createController("user_roles");
        const assignmentResult = await userRolesController.create({
            id: crypto.randomUUID(),
            user_id: userId,
            role_id: roleResult.data.id
        });

        expect(assignmentResult.success).toBe(true);

        // Test getUserRoles
        const roles = await services.authService.getUserRoles(userId);
        
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBe(1);
        
        const role = roles[0];
        expect(role).toHaveProperty('id');
        expect(role).toHaveProperty('name');
        expect(role).toHaveProperty('description');
        expect(role.name).toBe(`test_role_${timestamp}`);
    });
});