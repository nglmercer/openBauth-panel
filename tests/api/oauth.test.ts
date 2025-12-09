import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";
import { getServiceFactory } from "../../src/services/service-factory";
import { OAuthGrantType, OAuthResponseType } from "node_modules/open-bauth/dist/src/types/oauth";
describe("OAuth API", () => {

    // Get services
    let baseUrl: string;
    let server: any;

    beforeEach(async () => {
        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;

        /*         
        try {
            // Verify table exists
            const table = dbInitializer.getSchemas();
            const oauthClientsTable = table.find((t) => t.tableName === "oauth_clients");
            console.log("table", oauthClientsTable);

        } catch (e) {
            console.log("OAuth Setup Error:", e);
        } 
        */

        // Create test client in DB
        try {
            /*
            export declare enum OAuthGrantType {
    AUTHORIZATION_CODE = "authorization_code",
    IMPLICIT = "implicit",
    RESOURCE_OWNER_PASSWORD_CREDENTIALS = "password",
    CLIENT_CREDENTIALS = "client_credentials",
    REFRESH_TOKEN = "refresh_token",
    DEVICE_CODE = "urn:ietf:params:oauth:grant-type:device_code",
    JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer",
    SAML2_BEARER = "urn:ietf:params:oauth:grant-type:saml2-bearer"
}
export declare enum OAuthResponseType {
    CODE = "code",
    TOKEN = "token",
    ID_TOKEN = "id_token",
    NONE = "none"
}
            */
            const services = getServiceFactory().getServices();
            await services.oauthService.createClient({
                client_id: "test_client",
                client_secret: "test_secret",
                client_name: "Test Client",
                redirect_uris: ["http://localhost/callback"],
                grant_types: ["client_credentials", "password", "authorization_code", "refresh_token"] as OAuthGrantType[],
                response_types: ["code", "token"] as OAuthResponseType[],
                scope: "openid profile email"
            });
        } catch (e) {
            // Ignore if already exists (primary key violation usually)
            // console.log("Test client creation suppressed:", e);
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
        expect(signupResponse.status).toBe(201);

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
