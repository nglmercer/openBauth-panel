import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";
import { db } from "../../src/db";

describe("Authentication API - Comprehensive Tests", () => {
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

    afterEach(async () => {
        server.stop();
    });

    describe("POST /auth/signup", () => {
        test("should register a new user successfully", async () => {
            const userData = testUtils.generateTestUser();

            const response = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            expect(response.status).toBe(201);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.user.email).toBe(userData.email);
            expect(result.user.username).toBe(userData.username);
            expect(result.token).toBeDefined();
            expect(result.user.password_hash).toBeUndefined(); // Should not expose password
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject duplicate email", async () => {
            const userData = testUtils.generateTestUser();

            // First registration
            await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            // Second registration with same email
            const response = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject invalid email format", async () => {
            const userData = testUtils.generateTestUser();
            userData.email = "invalid-email";

            const response = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
            expect(result.error).toBe("Validation error");
            expect(result.details).toBeDefined();
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject short password", async () => {
            const userData = testUtils.generateTestUser();
            userData.password = "short";

            const response = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
            expect(result.error).toBe("Validation error");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject missing required fields", async () => {
            const response = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "test@example.com" })
            });

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /auth/login", () => {
        test("should login with valid credentials", async () => {
            const userData = testUtils.generateTestUser();
            await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            const loginResponse = await fetch(`${baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: userData.email,
                    password: userData.password
                })
            });

            expect(loginResponse.status).toBe(200);
            const loginResult = await loginResponse.json() as any;
            expect(loginResult.success).toBe(true);
            expect(loginResult.token).toBeDefined();
            expect(loginResult.user).toBeDefined();
            expect(loginResult.user.email).toBe(userData.email);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject invalid password", async () => {
            const userData = testUtils.generateTestUser();
            await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            const loginResponse = await fetch(`${baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: userData.email,
                    password: "wrongpassword"
                })
            });

            expect(loginResponse.status).toBe(401);
            const loginResult = await loginResponse.json() as any;
            expect(loginResult.success).toBe(false);
            expect(loginResult.error).toBe("Invalid credentials");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject non-existent user", async () => {
            const loginResponse = await fetch(`${baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "nonexistent@example.com",
                    password: "password123"
                })
            });

            expect(loginResponse.status).toBe(401);
            const loginResult = await loginResponse.json() as any;
            expect(loginResult.success).toBe(false);
            expect(loginResult.error).toBe("Invalid credentials");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject invalid email format", async () => {
            const loginResponse = await fetch(`${baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "invalid-email",
                    password: "password123"
                })
            });

            expect(loginResponse.status).toBe(400);
            const loginResult = await loginResponse.json() as any;
            expect(loginResult.success).toBe(false);
            expect(loginResult.error).toBe("Validation error");
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /auth/anonymous", () => {
        test("should create anonymous session", async () => {
            const response = await fetch(`${baseUrl}/auth/anonymous`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionData: { locale: "en" },
                    preferences: { theme: "dark" }
                })
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.anonymousUser).toBeDefined();
            expect(result.anonymousUser.anonymous_id).toBeDefined();
        }, TEST_TIMEOUTS.MEDIUM);

        test("should create anonymous session with empty data", async () => {
            const response = await fetch(`${baseUrl}/auth/anonymous`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.anonymousUser).toBeDefined();
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /auth/refresh", () => {
        test("should refresh token with valid refresh token", async () => {
            const userData = testUtils.generateTestUser();
            const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            const signupResult = await signupResponse.json() as any;
            const userId = signupResult.user.id;

            // Generate refresh token manually
            const { getServiceFactory } = await import("../../src/services/service-factory");
            const factory = getServiceFactory();
            const services = factory.getServices();
            const refreshToken = await services.jwtService.generateRefreshToken(userId);

            const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken })
            });

            expect(refreshResponse.status).toBe(200);
            const refreshResult = await refreshResponse.json() as any;
            expect(refreshResult.success).toBe(true);
            expect(refreshResult.token).toBeDefined();
            expect(refreshResult.refreshToken).toBeDefined();
            expect(refreshResult.user).toBeDefined();
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject invalid refresh token", async () => {
            const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: "invalid-token" })
            });

            expect(refreshResponse.status).toBe(401);
            const refreshResult = await refreshResponse.json() as any;
            expect(refreshResult.success).toBe(false);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /auth/logout", () => {
        test("should logout successfully with valid token", async () => {
            const userData = testUtils.generateTestUser();
            const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            const signupResult = await signupResponse.json() as any;
            const token = signupResult.token;

            const logoutResponse = await fetch(`${baseUrl}/auth/logout`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({})
            });

            expect(logoutResponse.status).toBe(200);
            const logoutResult = await logoutResponse.json() as any;
            expect(logoutResult.success).toBe(true);
            expect(logoutResult.message).toContain("successfully");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject logout without token", async () => {
            const logoutResponse = await fetch(`${baseUrl}/auth/logout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });

            expect(logoutResponse.status).toBe(401);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /auth/forgot-password", () => {
        test("should handle password reset request", async () => {
            const userData = testUtils.generateTestUser();
            await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            const forgotResponse = await fetch(`${baseUrl}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: userData.email })
            });

            expect(forgotResponse.status).toBe(200);
            const forgotResult = await forgotResponse.json() as any;
            expect(forgotResult.success).toBe(true);
            expect(forgotResult.message).toContain("sent");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return success even for non-existent email", async () => {
            const forgotResponse = await fetch(`${baseUrl}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "nonexistent@example.com" })
            });

            expect(forgotResponse.status).toBe(200);
            const forgotResult = await forgotResponse.json() as any;
            expect(forgotResult.success).toBe(true);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject invalid email format", async () => {
            const forgotResponse = await fetch(`${baseUrl}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "invalid-email" })
            });

            expect(forgotResponse.status).toBe(400);
            const forgotResult = await forgotResponse.json() as any;
            expect(forgotResult.success).toBe(false);
            expect(forgotResult.error).toBe("Validation error");
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /auth/reset-password", () => {
        test("should reset password with valid token", async () => {
            const userData = testUtils.generateTestUser();
            const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            const signupResult = await signupResponse.json() as any;
            const userId = signupResult.user.id;

            // Request password reset
            await fetch(`${baseUrl}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: userData.email })
            });

            // Get token from database
            const tokenQuery = db.query(
                "SELECT * FROM verification_tokens WHERE type = 'RESET_PASSWORD' AND user_id = $userId"
            ).get({ $userId: userId }) as any;

            expect(tokenQuery).toBeDefined();
            const resetToken = tokenQuery.token;

            const newPassword = "newsecurepassword123";
            const resetResponse = await fetch(`${baseUrl}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: resetToken,
                    password: newPassword,
                    confirmPassword: newPassword
                })
            });

            expect(resetResponse.status).toBe(200);
            const resetResult = await resetResponse.json() as any;
            expect(resetResult.success).toBe(true);
            expect(resetResult.message).toContain("successfully");

            // Verify can login with new password
            const loginResponse = await fetch(`${baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: userData.email,
                    password: newPassword
                })
            });

            expect(loginResponse.status).toBe(200);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject password reset with invalid token", async () => {
            const newPassword = "newsecurepassword123";
            const resetResponse = await fetch(`${baseUrl}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: "invalid-token",
                    password: newPassword,
                    confirmPassword: newPassword
                })
            });

            expect(resetResponse.status).toBe(400);
            const resetResult = await resetResponse.json() as any;
            expect(resetResult.success).toBe(false);
            expect(resetResult.error).toContain("Invalid");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject password reset with mismatched passwords", async () => {
            const resetResponse = await fetch(`${baseUrl}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: "some-token",
                    password: "password123",
                    confirmPassword: "differentpassword123"
                })
            });

            expect(resetResponse.status).toBe(400);
            const resetResult = await resetResponse.json() as any;
            expect(resetResult.success).toBe(false);
            expect(resetResult.error).toBe("Validation error");
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /auth/verify-email", () => {
        test("should verify email with valid token", async () => {
            const userData = testUtils.generateTestUser();
            const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            const signupResult = await signupResponse.json() as any;
            const userId = signupResult.user.id;

            // Create verification token
            const { getServiceFactory } = await import("../../src/services/service-factory");
            const factory = getServiceFactory();
            const services = factory.getServices();
            const verificationToken = await services.verificationService.createToken(userId, 'VERIFY_EMAIL');

            const verifyResponse = await fetch(`${baseUrl}/auth/verify-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: verificationToken })
            });

            expect(verifyResponse.status).toBe(200);
            const verifyResult = await verifyResponse.json() as any;
            expect(verifyResult.success).toBe(true);
            expect(verifyResult.message).toContain("successfully");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should reject email verification with invalid token", async () => {
            const verifyResponse = await fetch(`${baseUrl}/auth/verify-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: "invalid-token" })
            });

            expect(verifyResponse.status).toBe(400);
            const verifyResult = await verifyResponse.json() as any;
            expect(verifyResult.success).toBe(false);
            expect(verifyResult.error).toContain("Invalid");
        }, TEST_TIMEOUTS.MEDIUM);
    });
});
