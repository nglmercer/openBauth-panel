import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";

describe("User API", () => {
    let baseUrl: string;
    let server: any;

    beforeEach(async () => {
        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;
    });

    afterEach(() => {
        if (server) server.stop();
    });

    test("should retrieve user profile", async () => {
        const userData = testUtils.generateTestUser();
        // Register
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const token = signupResult.token;

        // Get Profile
        const profileResponse = await fetch(`${baseUrl}/user/me`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        expect(profileResponse.status).toBe(200);
        const profileResult = await profileResponse.json() as any;
        expect(profileResult.success).toBe(true);
        expect(profileResult.user.email).toBe(userData.email);
    }, TEST_TIMEOUTS.MEDIUM);

    test("should update user profile", async () => {
        const userData = testUtils.generateTestUser();
        // Register
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const token = signupResult.token;

        // Update Profile
        const updateResponse = await fetch(`${baseUrl}/user/me`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                first_name: "Updated",
                last_name: "User"
            })
        });

        expect(updateResponse.status).toBe(200);
        const updateResult = await updateResponse.json() as any;
        expect(updateResult.success).toBe(true);
        expect(updateResult.user.first_name).toBe("Updated");
    }, TEST_TIMEOUTS.MEDIUM);
});
