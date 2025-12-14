import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { getServiceFactory } from "../../../src/services/service-factory";
import { createDb, testUtils } from "../../setup";
import { createAuthMiddlewareForHono } from "../../../src/middleware";
import type { Context } from "hono";

describe("Auth Middleware - Roles Integration", () => {
    let dbInit: any;
    let factory: any;
    let services: any;
    let adminToken: string;
    let normalUserToken: string;
    let adminUserId: string;
    let normalUserId: string;

    beforeEach(async () => {
        // Create fresh database with defaults to get proper schema
        const dbResult = await createDb({ defaults: true });
        dbInit = dbResult.dbInit;
        
        // Create service factory with test database
        factory = getServiceFactory(dbInit);
        services = factory.getServices();

        // Create admin role
        const roleController = dbInit.createController("roles");
        let adminRole = await roleController.findFirst({ name: "admin" });
        if (!adminRole?.data) {
            adminRole = await roleController.create({
                id: crypto.randomUUID(),
                name: "admin",
                description: "Administrator role",
                is_active: true
            });
        }

        // Create both users
        const adminUserData = testUtils.generateTestUser();
        const normalUserData = testUtils.generateTestUser();

        const userController = dbInit.createController("users");
        
        // Create admin user
        const adminUserResult = await userController.create({
            id: crypto.randomUUID(),
            ...adminUserData,
            password_hash: "hashed_password"
        });
        expect(adminUserResult.success).toBe(true);
        adminUserId = adminUserResult.data.id;

        // Create normal user
        const normalUserResult = await userController.create({
            id: crypto.randomUUID(),
            ...normalUserData,
            password_hash: "hashed_password"
        });
        expect(normalUserResult.success).toBe(true);
        normalUserId = normalUserResult.data.id;

        // Assign admin role to admin user
        const userRolesController = dbInit.createController("user_roles");
        await userRolesController.create({
            id: crypto.randomUUID(),
            user_id: adminUserId,
            role_id: (adminRole.data as any)?.id
        });

        // Generate tokens - need to pass complete user objects
        const adminUserFullResult = await userController.findById(adminUserId);
        const normalUserFullResult = await userController.findById(normalUserId);
        
        expect(adminUserFullResult.success).toBe(true);
        expect(normalUserFullResult.success).toBe(true);
        
        adminToken = await services.jwtService.generateToken(adminUserFullResult.data);
        normalUserToken = await services.jwtService.generateToken(normalUserFullResult.data);

        console.log("Setup complete - Admin user ID:", adminUserId, "Normal user ID:", normalUserId);
    });

    afterEach(async () => {
        // Cleanup
        if (dbInit) {
            await testUtils.cleanupTestData(dbInit);
        }
    });

    test("should fetch roles correctly via getUserRoles", async () => {
        console.log("Testing getUserRoles for admin user:", adminUserId);
        const adminRoles = await services.authService.getUserRoles(adminUserId);
        console.log("Admin roles via getUserRoles:", adminRoles);
        
        expect(Array.isArray(adminRoles)).toBe(true);
        expect(adminRoles.length).toBeGreaterThan(0);
        
        console.log("Testing getUserRoles for normal user:", normalUserId);
        const normalRoles = await services.authService.getUserRoles(normalUserId);
        console.log("Normal user roles via getUserRoles:", normalRoles);
        
        expect(Array.isArray(normalRoles)).toBe(true);
        expect(normalRoles.length).toBe(0);
    });

    test("should fetch roles correctly via manual fetch (like middleware does)", async () => {
        // This mimics the logic in the middleware lines 100-129
        const userRolesController = services.dbInitializer.createController("user_roles");
        const rolesDetailsController = services.dbInitializer.createController("roles");

        // Get user_role associations for admin user
        const userRolesResult = await userRolesController.findAll({
            where: { user_id: adminUserId }
        });

        console.log("Admin user_roles associations:", userRolesResult);

        const userRolesList = userRolesResult.data || [];
        const roles: any[] = [];

        // Fetch role details
        for (const userRole of userRolesList) {
            const roleId = (userRole as any).role_id;
            const roleResult = await rolesDetailsController.findById(roleId);
            console.log("Role details for roleId", roleId, ":", roleResult);
            if (roleResult.success && roleResult.data) {
                roles.push((roleResult.data as any).name);
            }
        }

        console.log("Admin roles via manual fetch:", roles);
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBeGreaterThan(0);
        expect(roles).toContain("admin");
    });

    test("should have consistent role formats between both methods", async () => {
        // Get roles via getUserRoles
        const rolesViaGetUserRoles = await services.authService.getUserRoles(adminUserId);
        console.log("Roles via getUserRoles:", rolesViaGetUserRoles);

        // Get roles via manual fetch
        const userRolesController = services.dbInitializer.createController("user_roles");
        const rolesDetailsController = services.dbInitializer.createController("roles");
        const userRolesResult = await userRolesController.findAll({
            where: { user_id: adminUserId }
        });
        const userRolesList = userRolesResult.data || [];
        const rolesViaManual: any[] = [];
        for (const userRole of userRolesList) {
            const roleId = (userRole as any).role_id;
            const roleResult = await rolesDetailsController.findById(roleId);
            if (roleResult.success && roleResult.data) {
                rolesViaManual.push(roleResult.data);
            }
        }
        console.log("Roles via manual fetch:", rolesViaManual);

        // Compare formats
        expect(rolesViaGetUserRoles.length).toBe(rolesViaManual.length);
        
        // getUserRoles should return full role objects
        if (rolesViaGetUserRoles.length > 0) {
            const firstRole = rolesViaGetUserRoles[0];
            expect(firstRole).toHaveProperty('id');
            expect(firstRole).toHaveProperty('name');
            expect(firstRole).toHaveProperty('description');
        }
    });

    test("auth middleware should work with role checking", async () => {
        // Create a mock context with admin token
        const mockContext = {
            req: {
                header: (name: string) => {
                    if (name === 'authorization') return `Bearer ${adminToken}`;
                    return null;
                }
            },
            set: (key: string, value: any) => {
                (mockContext as any)[key] = value;
            },
            get: (key: string) => {
                return (mockContext as any)[key];
            },
            json: (data: any, status: number) => {
                return { json: data, status };
            }
        } as any;

        const mockNext = async () => {
            return;
        };

        // Create auth middleware that requires admin role
        const authMiddleware = createAuthMiddlewareForHono({
            required: true,
            roles: ['admin']
        });

        console.log("Testing auth middleware with admin token...");
        const result = await authMiddleware(mockContext, mockNext);
        console.log("Auth middleware result:", result);

        // Should not return error since admin user has admin role
        expect(result).toBeUndefined(); // Undefined means middleware passed and called next()
        
        // Check that auth context was set correctly
        const authContext = mockContext.get('auth');
        console.log("Auth context set by middleware:", authContext);
        
        expect(authContext).toBeDefined();
        expect(authContext.isAuthenticated).toBe(true);
        expect(authContext.user).toBeDefined();
        expect(Array.isArray(authContext.roles)).toBe(true);
        
        // The roles should include 'admin'
        expect(authContext.roles).toContain('admin');
    });
});