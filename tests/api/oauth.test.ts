import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";
import { db } from "../../src/db";

describe("OAuth API", () => {
    let baseUrl: string;
    let server: any;

    beforeEach(async () => {
        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;

        try {
            // Verify table exists
            const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='oauth_clients'").get();
            if (!tables) {
                console.log("Create oauth_clients manually as it is missing");
                db.run(`CREATE TABLE IF NOT EXISTS oauth_clients (
                    id TEXT PRIMARY KEY, 
                    client_id TEXT UNIQUE NOT NULL, 
                    client_secret TEXT, 
                    name TEXT, 
                    redirect_uris TEXT, 
                    scope TEXT, 
                    is_active INTEGER DEFAULT 1
                )`);
            }

            const existingClient = db.query("SELECT * FROM oauth_clients WHERE client_id = 'test_client'").get();
            if (!existingClient) {
                const hashedSecret = await Bun.password.hash("test_secret");
                db.run(`INSERT INTO oauth_clients (id, client_id, client_secret, name, redirect_uris, scope, is_active) 
                    VALUES ('client_123', 'test_client', ?, 'Test Client', 'http://localhost/callback', 'openid profile email', 1)`, [hashedSecret]);
            }
        } catch (e) {
            console.log("OAuth Setup Error:", e);
        }
    });

    afterEach(() => {
        if (server) server.stop();
    });

    test("should handle client credentials flow", async () => {
        const response = await fetch(`${baseUrl}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: "test_client",
                client_secret: "test_secret",
                scope: "openid"
            }).toString()
        });

        const result = await response.json() as any;
        if (response.status !== 200) {
            console.log("OAuth Token Error:", JSON.stringify(result, null, 2));
        }
        expect(response.status).toBe(200);
        expect(result.access_token).toBeDefined();
        expect(result.token_type).toBe("Bearer");
    }, TEST_TIMEOUTS.MEDIUM);

    test("should handle password grant flow", async () => {
        const userData = testUtils.generateTestUser();
        // Use full URL or setup path correctly, server is on random port
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        expect(signupResponse.status).toBe(200);

        const response = await fetch(`${baseUrl}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "password",
                client_id: "test_client",
                username: userData.email,
                password: userData.password,
                scope: "openid profile"
            }).toString()
        });

        const result = await response.json() as any;
        if (response.status !== 200) {
            console.log("OAuth Password Grant Error:", JSON.stringify(result, null, 2));
        }
        expect(response.status).toBe(200);
        expect(result.access_token).toBeDefined();
        expect(result.refresh_token).toBeDefined();
    }, TEST_TIMEOUTS.MEDIUM);

    test("should retrieve user info", async () => {
        const userData = testUtils.generateTestUser();
        // Signup
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const token = signupResult.token;

        // Call UserInfo
        const response = await fetch(`${baseUrl}/oauth/userinfo`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.status !== 200) {
            console.log("User Info Failed:", await response.text());
        }
        expect(response.status).toBe(200);
        const result = await response.json() as any;
        expect(result.sub).toBeDefined();
    }, TEST_TIMEOUTS.MEDIUM);

});
