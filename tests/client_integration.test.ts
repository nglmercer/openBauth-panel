
import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import app from "../src/index";
import { OpenBauthPanelClient } from "../client/api/OpenBauthPanelClient";
import { dbInitializer, db } from "../src/db";
import type { User } from "../client/types/auth";
import type { Server } from "bun";
import { BaseController } from "open-bauth";

// Test user data
const adminUser = {
    email: "admin-test@example.com",
    password: "StrongP@ssw0rd",
    username: "admintest",
    first_name: "Admin",
    last_name: "Test",
};

const regularUser = {
    email: "regular-test@example.com",
    password: "StrongP@ssw0rd",
    username: "regulartest",
    first_name: "Regular",
    last_name: "Test",
};
//@ts-expect-error
let server: Server;
let client: OpenBauthPanelClient;
let adminUserId: string;
let regularUserId: string;

beforeAll(async () => {
    // Initialize DB
    await dbInitializer.reset(dbInitializer.getSchemas());

    // Start the server
    server = Bun.serve({
        fetch: app.fetch,
        port: 0, // Random port
    });

    console.log(`Test server running on ${server.url}`);

    // Initialize client
    client = new OpenBauthPanelClient({
        host: "localhost",
        port: server.port,
        protocol: "http",
    });

    // 1. Register Admin User
    const adminReg = await client.register(adminUser);
    if (!adminReg.success || !adminReg.user) {
        throw new Error("Failed to register admin user");
    }
    adminUserId = (adminReg.user as User).id;

    // 2. Register Regular User
    const regularReg = await client.register(regularUser);
    if (!regularReg.success || !regularReg.user) {
        throw new Error("Failed to register regular user");
    }
    regularUserId = (regularReg.user as User).id;

    // 3. Promote Admin User to 'admin' role directly in DB
    // First, ensure 'admin' role exists
    const rolesController = new BaseController("roles", { database: db, isSQLite: true });
    const roles = await rolesController.findAll({ limit: 100 });

    let adminRoleId: string;
    const existingAdminRole = roles.data!.find((r) => r.name === "admin");

    if (existingAdminRole) {
        adminRoleId = existingAdminRole.id as string;
    } else {
        const newRole = await rolesController.create({
            name: "admin",
            description: "Administrator",
        });
        adminRoleId = (newRole.data as any).id;
    }

    // Assign role to user
    const userRolesController = new BaseController("user_roles", { database: db, isSQLite: true });
    await userRolesController.create({
        user_id: adminUserId,
        role_id: adminRoleId,
    });

    // 4. Create and Assign Permissions
    const permissionsController = new BaseController("permissions", { database: db, isSQLite: true });
    const rolePermissionsController = new BaseController("role_permissions", { database: db, isSQLite: true });

    const permissionsNeeded = ["users:list", "users:create", "users:delete", "users:update"];

    for (const permName of permissionsNeeded) {
        // Check if permission exists
        const existingPerms = await permissionsController.findAll({ limit: 100 }); // Inefficient but fine for test
        let permId: string;
        const existingPerm = existingPerms.data!.find((p) => p.name === permName);

        if (existingPerm) {
            permId = existingPerm.id as string;
        } else {
            const [resource, action] = permName.split(":");
            const newPerm = await permissionsController.create({
                name: permName,
                description: `Permission for ${permName}`,
                resource: resource || "system",
                action: action || "manage"
            });
            permId = (newPerm.data as any).id as string;
        }

        // Assign to admin role
        await rolePermissionsController.create({
            role_id: adminRoleId,
            permission_id: permId
        });
    }

    console.log("Setup complete: Admin user created, promoted, and permissions assigned.");
});

afterAll(() => {
    if (server) {
        server.stop();
    }
});

describe("OpenBauthPanelClient Comprehensive Tests", () => {

    describe("Authentication", () => {
        it("should login as admin", async () => {
            const response = await client.login({
                email: adminUser.email,
                password: adminUser.password,
            });
            expect(response.success).toBe(true);
            expect(client.isAuthenticated()).toBe(true);
        });

        it("should get current user profile", async () => {
            const user = await client.me();
            expect((user as any).email).toBe(adminUser.email);
        });

        it("should refresh token", async () => {
            const loginRes = await client.login({
                email: adminUser.email,
                password: adminUser.password,
            });

            if (loginRes.refreshToken) {
                const refreshRes = await client.refreshToken({ refreshToken: loginRes.refreshToken });
                if (!refreshRes.success) {
                    console.error("Refresh failed:", refreshRes);
                }
                expect(refreshRes.success).toBe(true);
                expect(refreshRes.token).toBeDefined();
                expect(client.getToken()).toBe(refreshRes.token);
            } else {
                console.warn("No refresh token returned from login, skipping refresh test");
            }
        });
    });

    describe("Dashboard API", () => {
        beforeAll(async () => {
            await client.login({
                email: adminUser.email,
                password: adminUser.password,
            });
        });

        it("should get dashboard tables", async () => {
            const response = await client.getDashboard();
            expect(response.success).toBe(true);
            expect(Array.isArray(response.data)).toBe(true);
            const tables = response.data as any[];
            expect(tables.some(t => t.tableName === 'users')).toBe(true);
        });

        it("should get table data for users", async () => {
            const response = await client.getTableData("users");
            expect(response.success).toBe(true);
            const users = response.data as any[];
            expect(users.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe("User Management API (Admin)", () => {
        beforeAll(async () => {
            await client.login({
                email: adminUser.email,
                password: adminUser.password,
            });
        });

        it("should get all users", async () => {
            const response = await client.getUsers();
            expect(response.success).toBe(true);
            const data = response.data as any;
            const users = data.users || data.items;
            expect(users).toBeDefined();
            expect(users.length).toBeGreaterThanOrEqual(2);
        });

        it("should get user by id", async () => {
            const response = await client.getUserById(regularUserId);
            expect(response.success).toBe(true);
            expect((response.data as any).user.email).toBe(regularUser.email);
        });

        it("should update user", async () => {
            const newName = "Updated Name";
            const response = await client.updateUser(regularUserId, {
                first_name: newName
            });
            expect(response.success).toBe(true);
            expect((response.data as any).user.first_name).toBe(newName);
        });

        it("should create and delete a temporary user", async () => {
            const tempUser = {
                email: "temp@example.com",
                password: "Password123!",
                username: "tempuser",
                first_name: "Temp",
                last_name: "User"
            };

            const createRes = await client.createUser(tempUser);
            console.log("DEBUG: createRes:", JSON.stringify(createRes));
            expect(createRes.success).toBe(true);
            const createdId = (createRes.data as any).user.user.id;

            const deleteRes = await client.deleteUser(createdId);

            // Flexible expectation for delete success
            const isSuccess = deleteRes.success === true || ((deleteRes as any).message === "Record deleted successfully" || (deleteRes as any).message === "User deleted successfully");
            if (!isSuccess) {
                console.error("Delete failed:", deleteRes);
            }
            expect(isSuccess).toBe(true);

            const getRes = await client.getUserById(createdId);
            if (getRes && getRes.success) {
                expect(getRes.success).toBe(false);
            }
        });
    });

    describe("Generic API", () => {
        beforeAll(async () => {
            await client.login({
                email: adminUser.email,
                password: adminUser.password,
            });
        });

        it("should get table records (roles)", async () => {
            const response = await client.getTableRecords("roles");
            expect(response.success).toBe(true);
            expect(Array.isArray(response.data)).toBe(true);
        });

        it("should create and delete a record via generic api", async () => {
            const newRole = {
                name: "test_role",
                description: "Test Role"
            };

            const createRes = await client.createTableRecord("roles", newRole);
            expect(createRes.success).toBe(true);
            const createdId = (createRes.data as any).id;

            const deleteRes = await client.deleteTableRecord("roles", createdId);
            expect((deleteRes as any).message).toBe("Record deleted successfully");
        });
    });
});
