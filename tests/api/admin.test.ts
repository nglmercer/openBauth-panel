import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";
import { db } from "../../src/db";

describe("Admin API", () => {
    let baseUrl: string;
    let server: any;

    beforeEach(async () => {
        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;

        // Ensure admin role exists
        const adminRole = db.query("SELECT * FROM roles WHERE name = 'admin'").get();
        if (!adminRole) {
            db.run("INSERT INTO roles (id, name, description) VALUES ('role_admin', 'admin', 'Administrator')");
        }
    });

    afterEach(() => {
        if (server) server.stop();
    });

    test("should list users as admin", async () => {
        const userData = testUtils.generateTestUser();

        // 1. Register User
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const userId = signupResult.user.id;

        // 2. Assign 'admin' role directly in DB
        db.run("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, 'role_admin']);

        // 3. Login to update token with new role
        const loginResponse = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userData.email, password: userData.password })
        });
        const loginResult = await loginResponse.json() as any;
        const adminToken = loginResult.token;

        // 4. Access Admin Route
        const listResponse = await fetch(`${baseUrl}/admin/users`, {
            headers: { "Authorization": `Bearer ${adminToken}` }
        });

        if (listResponse.status !== 200) {
            console.log("Admin List Users Failed:", await listResponse.text());
        }
        expect(listResponse.status).toBe(200);
        const listResult = await listResponse.json() as any;
        expect(listResult.data).toBeDefined();
        expect(Array.isArray(listResult.data)).toBe(true);
    }, TEST_TIMEOUTS.MEDIUM);

    test("should deny access to non-admin users", async () => {
        const userData = testUtils.generateTestUser();
        // Register standard user
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const token = signupResult.token;

        // Try Access Admin Route
        const listResponse = await fetch(`${baseUrl}/admin/users`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        expect(listResponse.status).toBe(403);
    }, TEST_TIMEOUTS.MEDIUM);

});
