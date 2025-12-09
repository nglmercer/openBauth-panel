import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";
import { OAuthGrantType, OAuthResponseType } from "node_modules/open-bauth/dist/src/types/oauth";

describe("OAuth API - Comprehensive Tests", () => {
    let baseUrl: string;
    let server: any;
    let testClient: any;

    beforeEach(async () => {
        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;

        // Create a test OAuth client
        const { getServiceFactory } = await import("../../src/services/service-factory");
        const factory = getServiceFactory();
        const services = factory.getServices();

        const clientSecret = "test-secret-key";
        const hashedSecret = await Bun.password.hash(clientSecret, {
            algorithm: "bcrypt",
            cost: 10
        });

        testClient = await services.oauthService.createClient({
            client_id: `test-client-${Date.now()}`,
            client_secret: hashedSecret,
            client_name: "Test OAuth Client",
            redirect_uris: ["https://example.com/callback", "https://test.com/oauth/callback"],
            grant_types: [OAuthGrantType.AUTHORIZATION_CODE, OAuthGrantType.REFRESH_TOKEN, OAuthGrantType.CLIENT_CREDENTIALS, OAuthGrantType.RESOURCE_OWNER_PASSWORD_CREDENTIALS],
            response_types: [OAuthResponseType.CODE, OAuthResponseType.TOKEN],
            scope: "read write profile email",
            is_public: false,
            is_active: true
        });

        testClient.plainSecret = clientSecret;
    });

    afterEach(() => {
        if (server) server.stop();
    });

    async function createTestUser() {
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

    describe("GET /oauth/authorize", () => {
        test("should initiate authorization code flow", async () => {
            const params = new URLSearchParams({
                response_type: "code",
                client_id: testClient.client_id,
                redirect_uri: "https://example.com/callback",
                scope: "read",
                state: "random-state-value"
            });

            const response = await fetch(`${baseUrl}/oauth/authorize?${params}`, {
                redirect: "manual"
            });

            // Should redirect with code
            expect(response.status).toBe(302);
            const location = response.headers.get("Location");
            expect(location).toContain("https://example.com/callback");
            expect(location).toContain("code=");
            expect(location).toContain("state=random-state-value");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should support PKCE in authorization", async () => {
            const { getServiceFactory } = await import("../../src/services/service-factory");
            const factory = getServiceFactory();
            const services = factory.getServices();
            const pkceChallenge = services.securityService.generatePKCEChallenge("S256" as any);

            const params = new URLSearchParams({
                response_type: "code",
                client_id: testClient.client_id,
                redirect_uri: "https://example.com/callback",
                scope: "read",
                state: "random-state",
                code_challenge: pkceChallenge.code_challenge,
                code_challenge_method: "S256"
            });

            const response = await fetch(`${baseUrl}/oauth/authorize?${params}`, {
                redirect: "manual"
            });

            expect(response.status).toBe(302);
            const location = response.headers.get("Location");
            expect(location).toContain("code=");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject invalid client_id", async () => {
            const params = new URLSearchParams({
                response_type: "code",
                client_id: "invalid-client-id",
                redirect_uri: "https://example.com/callback",
                scope: "read"
            });

            const response = await fetch(`${baseUrl}/oauth/authorize?${params}`);

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.error).toBe("invalid_client");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject invalid redirect_uri", async () => {
            const params = new URLSearchParams({
                response_type: "code",
                client_id: testClient.client_id,
                redirect_uri: "https://malicious.com/callback",
                scope: "read"
            });

            const response = await fetch(`${baseUrl}/oauth/authorize?${params}`);

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.error).toBe("invalid_request");
            expect(result.error_description).toContain("redirect URI");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should handle implicit flow (token response_type)", async () => {
            const params = new URLSearchParams({
                response_type: "token",
                client_id: testClient.client_id,
                redirect_uri: "https://example.com/callback",
                scope: "read",
                state: "random-state"
            });

            const response = await fetch(`${baseUrl}/oauth/authorize?${params}`, {
                redirect: "manual"
            });

            expect(response.status).toBe(302);
            const location = response.headers.get("Location");
            expect(location).toContain("https://example.com/callback#");
            expect(location).toContain("access_token=");
            expect(location).toContain("token_type=Bearer");
            expect(location).toContain("state=random-state");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject missing required parameters", async () => {
            const response = await fetch(`${baseUrl}/oauth/authorize?response_type=code`);

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.error).toBe("invalid_request");
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /oauth/token", () => {
        describe("Authorization Code Grant", () => {
            test("should exchange authorization code for tokens", async () => {
                // 1. Get authorization code
                const params = new URLSearchParams({
                    response_type: "code",
                    client_id: testClient.client_id,
                    redirect_uri: "https://example.com/callback",
                    scope: "read write"
                });

                const authResponse = await fetch(`${baseUrl}/oauth/authorize?${params}`, {
                    redirect: "manual"
                });

                const location = authResponse.headers.get("Location");
                const url = new URL(location!);
                const code = url.searchParams.get("code");

                // 2. Exchange code for token
                const tokenParams = new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code!,
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret,
                    redirect_uri: "https://example.com/callback"
                });

                const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                // Debug: Log the response if it's not 200
                if (tokenResponse.status !== 200) {
                    const errorText = await tokenResponse.text();
                    console.log("Token response error:", {
                        status: tokenResponse.status,
                        statusText: tokenResponse.statusText,
                        body: errorText
                    });
                }

                expect(tokenResponse.status).toBe(200);
                const result = await tokenResponse.json() as any;
                expect(result.access_token).toBeDefined();
                expect(result.token_type).toBe("Bearer");
                expect(result.expires_in).toBe(3600);
                expect(result.refresh_token).toBeDefined();
            }, TEST_TIMEOUTS.MEDIUM);

            test("should verify PKCE challenge correctly", async () => {
                const { getServiceFactory } = await import("../../src/services/service-factory");
                const factory = getServiceFactory();
                const services = factory.getServices();
                const pkceChallenge = services.securityService.generatePKCEChallenge("S256" as any);

                // 1. Get authorization code with PKCE
                const authParams = new URLSearchParams({
                    response_type: "code",
                    client_id: testClient.client_id,
                    redirect_uri: "https://example.com/callback",
                    code_challenge: pkceChallenge.code_challenge,
                    code_challenge_method: "S256"
                });

                const authResponse = await fetch(`${baseUrl}/oauth/authorize?${authParams}`, {
                    redirect: "manual"
                });

                const location = authResponse.headers.get("Location");
                const url = new URL(location!);
                const code = url.searchParams.get("code");

                // 2. Exchange code with verifier
                const tokenParams = new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code!,
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret,
                    redirect_uri: "https://example.com/callback",
                    code_verifier: pkceChallenge.code_verifier
                });

                const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                expect(tokenResponse.status).toBe(200);
                const result = await tokenResponse.json() as any;
                expect(result.access_token).toBeDefined();
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject reused authorization code", async () => {
                // 1. Get authorization code
                const authParams = new URLSearchParams({
                    response_type: "code",
                    client_id: testClient.client_id,
                    redirect_uri: "https://example.com/callback"
                });

                const authResponse = await fetch(`${baseUrl}/oauth/authorize?${authParams}`, {
                    redirect: "manual"
                });

                const location = authResponse.headers.get("Location");
                const url = new URL(location!);
                const code = url.searchParams.get("code");

                // 2. Exchange code first time
                const tokenParams = new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code!,
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret,
                    redirect_uri: "https://example.com/callback"
                });

                await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                // 3. Try to reuse code
                const secondTokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                expect(secondTokenResponse.status).toBe(400);
                const result = await secondTokenResponse.json() as any;
                expect(result.error).toBe("invalid_grant");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject invalid code", async () => {
                const tokenParams = new URLSearchParams({
                    grant_type: "authorization_code",
                    code: "invalid-code",
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret,
                    redirect_uri: "https://example.com/callback"
                });

                const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                expect(tokenResponse.status).toBe(400);
                const result = await tokenResponse.json() as any;
                expect(result.error).toBe("invalid_grant");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject wrong PKCE verifier", async () => {
                const { getServiceFactory } = await import("../../src/services/service-factory");
                const factory = getServiceFactory();
                const services = factory.getServices();
                const pkceChallenge = services.securityService.generatePKCEChallenge("S256" as any);

                // 1. Get authorization code with PKCE
                const authParams = new URLSearchParams({
                    response_type: "code",
                    client_id: testClient.client_id,
                    redirect_uri: "https://example.com/callback",
                    code_challenge: pkceChallenge.code_challenge,
                    code_challenge_method: "S256"
                });

                const authResponse = await fetch(`${baseUrl}/oauth/authorize?${authParams}`, {
                    redirect: "manual"
                });

                const location = authResponse.headers.get("Location");
                const url = new URL(location!);
                const code = url.searchParams.get("code");

                // 2. Exchange code with wrong verifier
                const tokenParams = new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code!,
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret,
                    redirect_uri: "https://example.com/callback",
                    code_verifier: "wrong-verifier"
                });

                const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                expect(tokenResponse.status).toBe(400);
                const result = await tokenResponse.json() as any;
                expect(result.error).toBe("invalid_grant");
                expect(result.error_description).toContain("PKCE");
            }, TEST_TIMEOUTS.MEDIUM);
        });

        describe("Refresh Token Grant", () => {
            test("should exchange refresh token for new access token", async () => {
                // 1. Get initial tokens via authorization code
                const authParams = new URLSearchParams({
                    response_type: "code",
                    client_id: testClient.client_id,
                    redirect_uri: "https://example.com/callback"
                });

                const authResponse = await fetch(`${baseUrl}/oauth/authorize?${authParams}`, {
                    redirect: "manual"
                });

                const location = authResponse.headers.get("Location");
                const url = new URL(location!);
                const code = url.searchParams.get("code");

                const tokenParams = new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code!,
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret,
                    redirect_uri: "https://example.com/callback"
                });

                const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                const tokenResult = await tokenResponse.json() as any;
                const refreshToken = tokenResult.refresh_token;

                // 2. Use refresh token to get new access token
                const refreshParams = new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: refreshToken,
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret
                });

                const refreshResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: refreshParams
                });

                expect(refreshResponse.status).toBe(200);
                const refreshResult = await refreshResponse.json() as any;
                expect(refreshResult.access_token).toBeDefined();
                expect(refreshResult.token_type).toBe("Bearer");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject invalid refresh token", async () => {
                const refreshParams = new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: "invalid-refresh-token",
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret
                });

                const refreshResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: refreshParams
                });

                expect(refreshResponse.status).toBe(400);
                const result = await refreshResponse.json() as any;
                expect(result.error).toBe("invalid_grant");
            }, TEST_TIMEOUTS.MEDIUM);
        });

        describe("Client Credentials Grant", () => {
            test("should issue token for client credentials", async () => {
                const tokenParams = new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret,
                    scope: "read"
                });

                const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                expect(tokenResponse.status).toBe(200);
                const result = await tokenResponse.json() as any;
                expect(result.access_token).toBeDefined();
                expect(result.token_type).toBe("Bearer");
                expect(result.expires_in).toBe(3600);
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject client credentials for public clients", async () => {
                // Create public client
                const { getServiceFactory } = await import("../../src/services/service-factory");
                const factory = getServiceFactory();
                const services = factory.getServices();

                const publicClient = await services.oauthService.createClient({
                    client_id: `public-client-${Date.now()}`,
                    client_name: "Public Client",
                    redirect_uris: ["https://example.com/callback"],
                    grant_types: [OAuthGrantType.AUTHORIZATION_CODE],
                    response_types: [OAuthResponseType.CODE],
                    is_public: true,
                    is_active: true
                });

                const tokenParams = new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: publicClient.client_id,
                    scope: "read"
                });

                const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                expect(tokenResponse.status).toBe(400);
                const result = await tokenResponse.json() as any;
                expect(result.error).toBe("unauthorized_client");
            }, TEST_TIMEOUTS.MEDIUM);
        });

        describe("Password Grant", () => {
            test("should issue token for password grant", async () => {
                const { userData } = await createTestUser();

                const tokenParams = new URLSearchParams({
                    grant_type: "password",
                    username: userData.email,
                    password: userData.password,
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret
                });

                const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                expect(tokenResponse.status).toBe(200);
                const result = await tokenResponse.json() as any;
                expect(result.access_token).toBeDefined();
                expect(result.refresh_token).toBeDefined();
                expect(result.token_type).toBe("Bearer");
            }, TEST_TIMEOUTS.MEDIUM);

            test("should reject invalid credentials in password grant", async () => {
                const tokenParams = new URLSearchParams({
                    grant_type: "password",
                    username: "nonexistent@example.com",
                    password: "wrongpassword",
                    client_id: testClient.client_id,
                    client_secret: testClient.plainSecret
                });

                const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenParams
                });

                expect(tokenResponse.status).toBe(400);
                const result = await tokenResponse.json() as any;
                expect(result.error).toBe("invalid_grant");
            }, TEST_TIMEOUTS.MEDIUM);
        });

        test("should reject invalid grant_type", async () => {
            const tokenParams = new URLSearchParams({
                grant_type: "invalid_grant",
                client_id: testClient.client_id,
                client_secret: testClient.plainSecret
            });

            const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenParams
            });

            expect(tokenResponse.status).toBe(400);
            const result = await tokenResponse.json() as any;
            expect(result.error).toBe("invalid_request");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject invalid client credentials", async () => {
            const tokenParams = new URLSearchParams({
                grant_type: "client_credentials",
                client_id: "invalid-client",
                client_secret: "invalid-secret"
            });

            const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenParams
            });

            expect(tokenResponse.status).toBe(401);
            const result = await tokenResponse.json() as any;
            expect(result.error).toBe("invalid_client");
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /oauth/revoke", () => {
        test("should revoke access token", async () => {
            const { userData } = await createTestUser();

            // Get token first
            const tokenParams = new URLSearchParams({
                grant_type: "password",
                username: userData.email,
                password: userData.password,
                client_id: testClient.client_id,
                client_secret: testClient.plainSecret
            });

            const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenParams
            });

            const tokenResult = await tokenResponse.json() as any;

            // Revoke token
            const revokeParams = new URLSearchParams({
                token: tokenResult.access_token,
                token_type_hint: "access_token"
            });

            const revokeResponse = await fetch(`${baseUrl}/oauth/revoke`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: revokeParams
            });

            expect(revokeResponse.status).toBe(200);
            const result = await revokeResponse.json() as any;
            expect(result.success).toBe(true);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return success even for invalid token (per OAuth spec)", async () => {
            const revokeParams = new URLSearchParams({
                token: "invalid-token",
                token_type_hint: "access_token"
            });

            const revokeResponse = await fetch(`${baseUrl}/oauth/revoke`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: revokeParams
            });

            expect(revokeResponse.status).toBe(200);
            const result = await revokeResponse.json() as any;
            expect(result.success).toBe(true);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /oauth/introspect", () => {
        test("should introspect valid access token", async () => {
            const { userData } = await createTestUser();

            // Get token first
            const tokenParams = new URLSearchParams({
                grant_type: "password",
                username: userData.email,
                password: userData.password,
                client_id: testClient.client_id,
                client_secret: testClient.plainSecret
            });

            const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenParams
            });

            const tokenResult = await tokenResponse.json() as any;

            // Introspect token
            const introspectParams = new URLSearchParams({
                token: tokenResult.access_token,
                token_type_hint: "access_token"
            });

            const introspectResponse = await fetch(`${baseUrl}/oauth/introspect`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: introspectParams
            });

            expect(introspectResponse.status).toBe(200);
            const result = await introspectResponse.json() as any;
            expect(result.active).toBe(true);
            expect(result.token_type).toBe("Bearer");
            expect(result.sub).toBeDefined();
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return inactive for invalid token", async () => {
            const introspectParams = new URLSearchParams({
                token: "invalid-token",
                token_type_hint: "access_token"
            });

            const introspectResponse = await fetch(`${baseUrl}/oauth/introspect`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: introspectParams
            });

            expect(introspectResponse.status).toBe(200);
            const result = await introspectResponse.json() as any;
            expect(result.active).toBe(false);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("GET /oauth/jwks", () => {
        test("should return JWKS", async () => {
            const response = await fetch(`${baseUrl}/oauth/jwks`);

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.keys).toBeDefined();
            expect(Array.isArray(result.keys)).toBe(true);
            expect(result.keys.length).toBeGreaterThan(0);
            expect(result.keys[0].kty).toBe("RSA");
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("GET /oauth/userinfo", () => {
        test("should return user info with valid token", async () => {
            const { token } = await createTestUser();

            const response = await fetch(`${baseUrl}/oauth/userinfo`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.sub).toBeDefined();
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject request without authentication", async () => {
            const response = await fetch(`${baseUrl}/oauth/userinfo`);

            expect(response.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject request with invalid token", async () => {
            const response = await fetch(`${baseUrl}/oauth/userinfo`, {
                headers: { "Authorization": `Bearer invalid-token` }
            });

            expect(response.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);
    });
});
