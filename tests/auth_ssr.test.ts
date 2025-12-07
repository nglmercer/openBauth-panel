// tests/auth_ssr.test.ts
// Tests for SSR authentication endpoints using new Supabase-compatible API
import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp, createTestUser, generateUniqueId } from "./test-helpers";

describe("Auth SSR Tests - Supabase Compatible", () => {
  let app: any;
  let accessToken: string;
  let testUser: any;

  beforeAll(async () => {
    app = await createFreshApp();
    testUser = await createTestUser(app);
    
    // Login to get access token
    const loginResponse = await app.request("/auth/v1/token", {
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
    
    const loginData = await loginResponse.json();
    accessToken = loginData.access_token;
  });

  describe("SSR Auth Flow", () => {
    it("should handle SSR authentication with valid token", async () => {
      const response = await app.request("/auth/v1/user", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "X-Requested-With": "XMLHttpRequest", // Simulate SSR request
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe(testUser.email);
      expect(data.username).toBe(testUser.username);
    });

    it("should handle SSR token refresh", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest", // Simulate SSR request
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: testUser.refreshToken,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
    });

    it("should handle SSR logout", async () => {
      const response = await app.request("/auth/v1/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "X-Requested-With": "XMLHttpRequest", // Simulate SSR request
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("SSR Error Handling", () => {
    it("should return 401 for SSR request without valid token", async () => {
      const response = await app.request("/auth/v1/user", {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      expect(response.status).toBe(401);
    });

    it("should return 401 for SSR request with expired/invalid token", async () => {
      const response = await app.request("/auth/v1/user", {
        method: "GET",
        headers: {
          "Authorization": "Bearer expired-token",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Legacy SSR endpoints should return 404", () => {
    it("GET /auth/me should return 404 for SSR", async () => {
      const response = await app.request("/auth/me", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      expect(response.status).toBe(404);
    });

    it("POST /auth/refresh should return 404 for SSR", async () => {
      const response = await app.request("/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          refreshToken: testUser.refreshToken,
        }),
      });

      expect(response.status).toBe(404);
    });
  });
});