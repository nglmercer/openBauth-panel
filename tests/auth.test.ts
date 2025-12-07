// tests/auth.test.ts
// Tests for authentication endpoints using new Supabase-compatible API
import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp, createTestUser, generateUniqueId } from "./test-helpers";

describe("Auth API Tests - Supabase Compatible", () => {
  let app: any;
  let accessToken: string;
  let refreshToken: string;
  let testUser: any;

  beforeAll(async () => {
    app = await createFreshApp();
  });

  describe("POST /auth/v1/signup", () => {
    it("should register a new user successfully", async () => {
      const uniqueId = generateUniqueId();
      const response = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `test-${uniqueId}@example.com`,
          password: "password123",
          username: `testuser-${uniqueId}`,
          first_name: "Test",
          last_name: "User",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(`test-${uniqueId}@example.com`);
    });

    it("should fail with invalid email format", async () => {
      const response = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "invalid-email",
          password: "password123",
          username: "testuser",
          first_name: "Test",
          last_name: "User",
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should fail with missing required fields", async () => {
      const response = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          // missing password and other required fields
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /auth/v1/token - Password Grant", () => {
    beforeAll(async () => {
      // Create a test user for login tests with a unique email
      const uniqueId = generateUniqueId();
      const testEmail = `auth-test-${uniqueId}@example.com`;
      testUser = await createTestUser(app, testEmail);
    });

    it("should login with valid credentials", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "password",
          email: testUser.email,
          password: testUser.password,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.token_type).toBe("bearer");
      expect(data.user).toBeDefined();

      accessToken = data.access_token;
      refreshToken = data.refresh_token;
    });

    it("should fail with invalid credentials", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "password",
          email: testUser.email,
          password: "wrongpassword",
        }),
      });

      expect(response.status).toBe(401);
    });

    it("should fail with missing grant_type", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /auth/v1/token - Refresh Token Grant", () => {
    it("should refresh access token with valid refresh token", async () => {
      // Use the refresh token from the test user created in the previous test
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.token_type).toBe("bearer");
    });

    it("should fail with invalid refresh token", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: "definitely-invalid-refresh-token-12345",
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /auth/v1/user", () => {
    it("should return current user with valid token", async () => {
      // Use the access token from the login test
      const response = await app.request("/auth/v1/user", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe(testUser.email);
      expect(data.username).toBe(testUser.username);
    });

    it("should fail without authorization header", async () => {
      const response = await app.request("/auth/v1/user", {
        method: "GET",
      });

      expect(response.status).toBe(401);
    });

    it("should fail with invalid token", async () => {
      const response = await app.request("/auth/v1/user", {
        method: "GET",
        headers: {
          "Authorization": "Bearer definitely-invalid-token-12345",
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /auth/v1/logout", () => {
    it("should logout successfully", async () => {
      const response = await app.request("/auth/v1/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should logout without token (no auth required)", async () => {
      const response = await app.request("/auth/v1/logout", {
        method: "POST",
      });

      expect(response.status).toBe(200);
    });
  });

  describe("Legacy endpoints should return 404", () => {
    it("POST /auth/register should return 404", async () => {
      const response = await app.request("/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      expect(response.status).toBe(404);
    });

    it("POST /auth/login should return 404", async () => {
      const response = await app.request("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      expect(response.status).toBe(404);
    });

    it("GET /auth/me should return 404", async () => {
      const response = await app.request("/auth/me", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      expect(response.status).toBe(404);
    });

    it("POST /auth/refresh should return 404", async () => {
      const response = await app.request("/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken: refreshToken,
        }),
      });

      expect(response.status).toBe(404);
    });
  });
});