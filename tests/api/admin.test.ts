import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";
import { getServiceFactory } from "../../src/services/service-factory";

describe("Admin API", () => {
    let baseUrl: string;
    let server: any;
    let adminToken: string;
    let normalUserToken: string;

    beforeEach(async () => {
        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;

        const factory = getServiceFactory();
        const services = factory.getServices();
        const roleController = services.dbInitializer.createController("roles");
        const userRolesController = services.dbInitializer.createController("user_roles");

        // Create admin role if it doesn't exist
        let adminRole = await roleController.findFirst({ name: "admin" });
        if (!adminRole?.data) {
            adminRole = await roleController.create({
                id: crypto.randomUUID(),
                name: "admin",
                description: "Administrator role",
                is_active: true
            });
        }

        // Create both users in parallel
        const adminUserData = testUtils.generateTestUser();
        const normalUserData = testUtils.generateTestUser();

        const [adminSignupResponse, normalSignupResponse] = await Promise.all([
            fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(adminUserData)
            }),
            fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(normalUserData)
            })
        ]);

        const adminSignupResult = await adminSignupResponse.json() as any;
        const normalSignupResult = await normalSignupResponse.json() as any;

        adminToken = adminSignupResult.token;
        normalUserToken = normalSignupResult.token;

        // Assign admin role to admin user (use data property if available)
        await userRolesController.create({
            id: crypto.randomUUID(),
            user_id: adminSignupResult.user.id,
            role_id: adminRole.data?.id || adminRole.id
        });
    }, TEST_TIMEOUTS.LONG);

    afterEach(async () => {
        server.stop();
    });

    describe("GET /admin/users", () => {
        test("should list all users when authenticated as admin", async () => {
            const response = await fetch(`${baseUrl}/admin/users`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${adminToken}`,
                    "Content-Type": "application/json"
                }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data.length).toBeGreaterThan(0);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 401 when not authenticated", async () => {
            const response = await fetch(`${baseUrl}/admin/users`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });

            expect(response.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 403 when authenticated as normal user", async () => {
            const response = await fetch(`${baseUrl}/admin/users`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${normalUserToken}`,
                    "Content-Type": "application/json"
                }
            });

            expect(response.status).toBe(403);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("GET /admin/roles", () => {
        test("should list all roles when authenticated as admin", async () => {
            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${adminToken}`,
                    "Content-Type": "application/json"
                }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 401 when not authenticated", async () => {
            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });

            expect(response.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /admin/roles", () => {
        test("should create a new role when authenticated as admin", async () => {
            const newRole = {
                name: `test_role_${Date.now()}`,
                description: "Test role description",
                permissions: ["read", "write"]
            };

            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${adminToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(newRole)
            });

            expect(response.status).toBe(201);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.role).toBeDefined();
            expect(result.role.name).toBe(newRole.name);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 400 when role data is invalid", async () => {
            const invalidRole = {
                name: "a", // Too short
                description: "Invalid"
            };

            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${adminToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(invalidRole)
            });

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
            expect(result.error).toBe("Validation error");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 403 when authenticated as normal user", async () => {
            const newRole = {
                name: "test_role",
                description: "Test role"
            };

            const response = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${normalUserToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(newRole)
            });

            expect(response.status).toBe(403);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /admin/users/:id/roles", () => {
        test("should assign role to user when authenticated as admin", async () => {
            // Create a test role first
            const roleData = {
                name: `test_assign_role_${Date.now()}`,
                description: "Role for assignment test"
            };

            const createRoleResponse = await fetch(`${baseUrl}/admin/roles`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${adminToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(roleData)
            });
            const createRoleResult = await createRoleResponse.json() as any;

            // Create a test user
            const userData = testUtils.generateTestUser();
            const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            const signupResult = await signupResponse.json() as any;
            const userId = signupResult.user.id;

            // Assign role
            const assignResponse = await fetch(`${baseUrl}/admin/users/${userId}/roles`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${adminToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ role: roleData.name })
            });

            expect(assignResponse.status).toBe(200);
            const assignResult = await assignResponse.json() as any;
            expect(assignResult.success).toBe(true);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 401 when not authenticated", async () => {
            const response = await fetch(`${baseUrl}/admin/users/some-user-id/roles`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: "test_role" })
            });

            expect(response.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 403 when authenticated as normal user", async () => {
            const response = await fetch(`${baseUrl}/admin/users/some-user-id/roles`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${normalUserToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ role: "test_role" })
            });

            expect(response.status).toBe(403);
        }, TEST_TIMEOUTS.MEDIUM);
    });
});
