import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { DatabaseInitializer, JWTServiceBun, getOAuthSchemas } from "open-bauth";
import { testUtils, TEST_TIMEOUTS } from "../../setup";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { adminRoutes } from "../../../src/routes/admin";
import { auth } from "../../../src/routes/auth";
import { ExtendedAuthService } from "../../../src/services/extended-auth";
import { getServiceFactory, ServiceFactory } from "../../../src/services/service-factory";
import { verificationTokenSchema } from "../../../src/database/schema/verification-token";
import {
    extendedUserSchema,
    extendedRolesSchema,
    extendedUserRolesSchema,
} from "../../../src/schemas/newSchemas";

describe("Admin API - Comprehensive Tests", () => {
    let baseUrl: string;
    let server: any;
    let services: any;
    let app: Hono;
    let dbInit: DatabaseInitializer;

    beforeEach(async () => {
        // Create isolated database instance for each test
        const db = new Database(":memory:");
        dbInit = new DatabaseInitializer({
            database: db,
            enableWAL: true,
            enableForeignKeys: true
        });
        
        // Register schemas
        const oauthSchemas = getOAuthSchemas();
        dbInit.registerSchemas([
            ...oauthSchemas,
            verificationTokenSchema,
            extendedUserSchema,
            extendedRolesSchema,
            extendedUserRolesSchema
        ]);
        
        // Initialize database
        await dbInit.initialize();
        await dbInit.seedDefaults();

        // Create isolated service factory
        const factory = getServiceFactory(dbInit);
        services = factory.getServices();

        // Create isolated Hono app
        app = new Hono().basePath("/api/v1");
        
        // Add middleware
        app.use("*", logger());
        app.use("*", prettyJSON());
        app.use("*", cors({
            origin: "*",
            allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
            credentials: true
        }));

        // Mount routes
        app.route("/auth", auth);
        app.route("/admin", adminRoutes);

        // Start server
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;
    });

    afterEach(async () => {
        if (server) {
            server.stop();
        }
        if (dbInit) {
            // Clean up database
            dbInit.db.close();
        }
        // Reset service factory instance
        (ServiceFactory as any).instance = null;
    });

    async function createAdminUser() {
        const userData = testUtils.generateTestUser();
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const userId = signupResult.user.id;
        const token = signupResult.token;

        // Use existing services (already isolated)
        // services is already defined in the outer scope

        // Create admin role if it doesn't exist
        const roleController = services.dbInitializer.createController("roles");
        let adminRole: any = await roleController.search({ name: "admin" });
        if (!adminRole || !adminRole.data || adminRole.data.length === 0) {
            adminRole = await roleController.create({
                id: crypto.randomUUID(),
                name: "admin",
                description: "Administrator role",
                is_active: true
            });
        } else {
            adminRole = { data: adminRole.data[0] };
        }

        // Assign role to user
        const userRolesController = services.dbInitializer.createController("user_roles");
        await userRolesController.create({
            id: crypto.randomUUID(),
            user_id: userId,
            role_id: adminRole.data.id
        });

        return {
            user: signupResult.user,
            token,
            userData
        };
    }

    async function createRegularUser() {
        const userData = testUtils.generateTestUser();
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        return {
            user: signupResult.user,
            token: signupResult.token,
            userData
        };
    }

    describe("GET /admin/users", () => {
        test("should list all users for admin", async () => {
            const { token } = await createAdminUser();

            const response = await fetch(`${baseUrl}/admin/users`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data.length).toBeGreaterThan(0);
        }, TEST_TIMEOUTS.LONG);

        test("should reject request without authentication", async () => {
            const response = await fetch(`${baseUrl}/admin/users`);

            expect(response.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject request from non-admin user", async () => {
            const { token } = await createRegularUser();

            const response = await fetch(`${baseUrl}/admin/users`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            expect(response.status).toBe(403);
        }, TEST_TIMEOUTS.LONG);
    });

    describe("GET /admin/roles", () => {
        test("should list all roles for admin", async () => {
            const { token } = await createAdminUser();

            const response = await fetch(`${baseUrl}/admin/roles`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);
            // At least the admin role should exist
            expect(result.data.length).toBeGreaterThan(0);
            const adminRole = result.data.find((r: any) => r.name === "admin");
            expect(adminRole).toBeDefined();
        }, TEST_TIMEOUTS.LONG);

        test("should reject request without authentication", async () => {
            const response = await fetch(`${baseUrl}/admin/roles`);

            expect(response.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject request from non-admin user", async () => {
            const { token } = await createRegularUser();

            const response = await fetch(`${baseUrl}/admin/roles`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            expect(response.status).toBe(403);
        }, TEST_TIMEOUTS.LONG);
    });

    describe("POST /admin/roles", () => {
        test("should create new role for admin", async () => {
            const { token } = await createAdminUser();

            const roleData = {
                name: `test_role_${Date.now()}`,
                description: "Test role description"
            };

            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(201);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.role).toBeDefined();
            expect(result.role.name).toBe(roleData.name);
            expect(result.role.description).toBe(roleData.description);
        }, TEST_TIMEOUTS.LONG);

        test("should reject role creation with invalid data", async () => {
            const { token } = await createAdminUser();

            const roleData = {
                name: "A", // Too short
                description: "Test role description"
            };

            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
            expect(result.error).toBe("Validation error");
        }, TEST_TIMEOUTS.LONG);

        test("should reject role creation without authentication", async () => {
            const roleData = {
                name: "test_role",
                description: "Test role description"
            };

            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject role creation from non-admin user", async () => {
            const { token } = await createRegularUser();

            const roleData = {
                name: "test_role",
                description: "Test role description"
            };

            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(403);
        }, TEST_TIMEOUTS.LONG);

        test("should reject duplicate role names", async () => {
            const { token } = await createAdminUser();

            const roleData = {
                name: `unique_role_${Date.now()}`,
                description: "Test role description"
            };

            // Create first role
            await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(roleData)
            });

            // Try to create duplicate
            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
        }, TEST_TIMEOUTS.LONG);

        test("should create role with permissions", async () => {
            const { token } = await createAdminUser();

            const roleData = {
                name: `role_with_perms_${Date.now()}`,
                description: "Role with permissions",
                permissions: ["read", "write"]
            };

            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(201);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.role).toBeDefined();
        }, TEST_TIMEOUTS.LONG);
    });

    describe("POST /admin/users/:id/roles", () => {
        test("should assign role to user", async () => {
            const { token: adminToken } = await createAdminUser();
            const { user: regularUser } = await createRegularUser();

            const roleData = {
                role: "admin"
            };

            const response = await fetch(`${baseUrl}/admin/users/${regularUser.id}/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
        }, TEST_TIMEOUTS.LONG);

        test("should reject role assignment without authentication", async () => {
            const { user: regularUser } = await createRegularUser();

            const roleData = {
                role: "admin"
            };

            const response = await fetch(`${baseUrl}/admin/users/${regularUser.id}/roles`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject role assignment from non-admin user", async () => {
            const { token: regularToken } = await createRegularUser();
            const { user: anotherUser } = await createRegularUser();

            const roleData = {
                role: "admin"
            };

            const response = await fetch(`${baseUrl}/admin/users/${anotherUser.id}/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${regularToken}`
                },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(403);
        }, TEST_TIMEOUTS.LONG);

        test("should reject role assignment with invalid userId", async () => {
            const { token: adminToken } = await createAdminUser();

            const roleData = {
                role: "admin"
            };

            const response = await fetch(`${baseUrl}/admin/users/non-existent-id/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify(roleData)
            });

            expect(response.status).toBe(404);
        }, TEST_TIMEOUTS.LONG);

        test("should reject role assignment with missing role", async () => {
            const { token: adminToken } = await createAdminUser();
            const { user: regularUser } = await createRegularUser();

            const response = await fetch(`${baseUrl}/admin/users/${regularUser.id}/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify({})
            });

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
        }, TEST_TIMEOUTS.VERY_LONG);
    });

    describe("Admin Authorization", () => {
        test("should allow all admin routes with admin role", async () => {
            const { token } = await createAdminUser();

            // Test multiple admin endpoints
            const endpoints = [
                { method: "GET", url: `${baseUrl}/admin/users` },
                { method: "GET", url: `${baseUrl}/admin/roles` }
            ];

            for (const endpoint of endpoints) {
                const response = await fetch(endpoint.url, {
                    method: endpoint.method,
                    headers: { "Authorization": `Bearer ${token}` }
                });

                expect(response.status).toBeLessThan(400);
            }
        }, TEST_TIMEOUTS.LONG);

        test("should reject all admin routes for regular users", async () => {
            const { token } = await createRegularUser();

            // Test multiple admin endpoints
            const endpoints = [
                { method: "GET", url: `${baseUrl}/admin/users` },
                { method: "GET", url: `${baseUrl}/admin/roles` }
            ];

            for (const endpoint of endpoints) {
                const response = await fetch(endpoint.url, {
                    method: endpoint.method,
                    headers: { "Authorization": `Bearer ${token}` }
                });

                expect(response.status).toBe(403);
            }
        }, TEST_TIMEOUTS.LONG);

        test("should reject all admin routes without authentication", async () => {
            const endpoints = [
                { method: "GET", url: `${baseUrl}/admin/users` },
                { method: "GET", url: `${baseUrl}/admin/roles` }
            ];

            for (const endpoint of endpoints) {
                const response = await fetch(endpoint.url, {
                    method: endpoint.method
                });

                expect(response.status).toBe(401);
            }
        }, TEST_TIMEOUTS.LONG);
    });
});
