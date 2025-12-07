// tests/auth_fixed.test.ts
// Fixed authentication tests for edge cases and error handling
import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp, createTestUser, generateUniqueId } from "./test-helpers";

describe("Auth Fixed Tests - Edge Cases and Error Handling", () => {
  let app: any;
  let testUser: any;

  beforeAll(async () => {
    app = await createFreshApp();
  });

  describe("Edge Cases for /auth/v1/signup", () => {
    it("should handle duplicate email registration", async () => {
      const uniqueId = generateUniqueId();
      const email = `duplicate-${uniqueId}@example.com`;
      
      // First registration
      const response1 = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: "password123",
          username: `user1-${uniqueId}`,
          first_name: "Test",
          last_name: "User1",
        }),
      });
      
      expect(response1.status).toBe(201);
      
      // Second registration with same email
      const response2 = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: "password123",
          username: `user2-${uniqueId}`,
          first_name: "Test",
          last_name: "User2",
        }),
      });
      
      expect(response2.status).toBe(409); // Conflict
    });

    it("should handle duplicate username registration", async () => {
      const uniqueId = generateUniqueId();
      const username = `duplicateuser-${uniqueId}`;
      
      // First registration
      const response1 = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `email1-${uniqueId}@example.com`,
          password: "password123",
          username: username,
          first_name: "Test",
          last_name: "User1",
        }),
      });
      
      expect(response1.status).toBe(201);
      
      // Second registration with same username
      const response2 = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `email2-${uniqueId}@example.com`,
          password: "password123",
          username: username,
          first_name: "Test",
          last_name: "User2",
        }),
      });
      
      expect(response2.status).toBe(409); // Conflict
    });

    it("should handle very long input values", async () => {
      const longString = "a".repeat(1000);
      const response = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `test-${longString}@example.com`,
          password: "password123",
          username: longString,
          first_name: longString,
          last_name: longString,
        }),
      });
      
      // Should either succeed or fail gracefully
      expect([201, 400, 413]).toContain(response.status); // Created, Bad Request, or Payload Too Large
    });

    it("should handle special characters in input", async () => {
      const specialChars = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`";
      const response = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `test${specialChars}@example.com`,
          password: "password123",
          username: `user${specialChars}`,
          first_name: `First${specialChars}`,
          last_name: `Last${specialChars}`,
        }),
      });
      
      // Should either succeed or fail gracefully
      expect([201, 400]).toContain(response.status);
    });
  });

  describe("Edge Cases for /auth/v1/token", () => {
    beforeAll(async () => {
      testUser = await createTestUser(app);
    });

    it("should handle login with email containing special characters", async () => {
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
    });

    it("should handle login with extra whitespace in credentials", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "password",
          email: ` ${testUser.email} `,
          password: testUser.password,
        }),
      });

      // Should either succeed (if trimmed) or fail gracefully
      expect([200, 401]).toContain(response.status);
    });

    it("should handle refresh token with extra whitespace", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: ` ${testUser.refreshToken} `,
        }),
      });

      // Should either succeed (if trimmed) or fail gracefully
      expect([200, 401]).toContain(response.status);
    });

    it("should handle malformed JSON in request body", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "not-valid-json",
      });

      expect(response.status).toBe(400);
    });

    it("should handle empty request body", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it("should handle very long password attempt", async () => {
      const longPassword = "a".repeat(1000);
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "password",
          email: testUser.email,
          password: longPassword,
        }),
      });

      expect(response.status).toBe(401); // Should fail authentication
    });
  });

  describe("Edge Cases for /auth/v1/user", () => {
    it("should handle user request with malformed authorization header", async () => {
      const response = await app.request("/auth/v1/user", {
        method: "GET",
        headers: {
          "Authorization": "not-bearer-format",
        },
      });

      expect(response.status).toBe(401);
    });

    it("should handle user request with token containing special characters", async () => {
      const response = await app.request("/auth/v1/user", {
        method: "GET",
        headers: {
          "Authorization": "Bearer token-with-!@#$%^&*()",
        },
      });

      expect(response.status).toBe(401);
    });

    it("should handle user request with expired token format", async () => {
      const response = await app.request("/auth/v1/user", {
        method: "GET",
        headers: {
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token",
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Security Tests", () => {
    it("should prevent SQL injection in signup", async () => {
      const response = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `test'; DROP TABLE users; --@example.com`,
          password: "password123",
          username: "testuser",
          first_name: "Test",
          last_name: "User",
        }),
      });

      // Should either succeed (if sanitized) or fail gracefully
      expect([201, 400]).toContain(response.status);
      
      // Verify users table still exists by trying to query it
      const usersResponse = await app.request("/rest/v1/users");
      expect(usersResponse.status).toBe(200);
    });

    it("should prevent SQL injection in login", async () => {
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "password",
          email: `test'; DROP TABLE users; --`,
          password: "password123",
        }),
      });

      expect(response.status).toBe(401); // Should fail authentication
      
      // Verify users table still exists
      const usersResponse = await app.request("/rest/v1/users");
      expect(usersResponse.status).toBe(200);
    });

    it("should handle rapid successive login attempts", async () => {
      const attempts = [];
      for (let i = 0; i < 10; i++) {
        attempts.push(
          app.request("/auth/v1/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              grant_type: "password",
              email: testUser.email,
              password: "wrongpassword",
            }),
          })
        );
      }

      const results = await Promise.all(attempts);
      results.forEach(response => {
        expect(response.status).toBe(401);
      });
    });
  });

  describe("Legacy endpoints security", () => {
    it("should not expose sensitive data on legacy endpoints", async () => {
      const endpoints = [
        "/auth/register",
        "/auth/login",
        "/auth/me",
        "/auth/refresh",
      ];

      for (const endpoint of endpoints) {
        const response = await app.request(endpoint, {
          method: "GET",
        });
        expect(response.status).toBe(404);
        
        const data = await response.json();
        expect(data.error).toBeDefined();
        // Should not contain stack traces or sensitive info
        expect(data.stack).toBeUndefined();
      }
    });
  });
});