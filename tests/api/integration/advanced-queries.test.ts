// tests/api/integration/advanced-queries.test.ts
// Advanced queries integration tests
import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp, createTestUser, generateUniqueId } from "../../test-helpers";

describe("Advanced Queries Integration Tests", () => {
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

  describe("Error handling for advanced queries", () => {
    it("should handle invalid operator gracefully", async () => {
      const response = await app.request(
        "/rest/v1/users?age=invalid.25&select=id,email",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      // Should either succeed (treating as literal) or fail gracefully
      expect([200, 400]).toContain(response.status);
    });

    it("should handle malformed order parameter", async () => {
      const response = await app.request(
        "/rest/v1/users?order=invalid&select=id,email",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect([200, 400]).toContain(response.status);
    });

    it("should handle SQL injection attempts", async () => {
      const response = await app.request(
        "/rest/v1/users?email=eq.test'; DROP TABLE users; --&select=id,email",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should not find any users with that email
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      // Verify users table still exists
      const verifyResponse = await app.request("/rest/v1/users?limit=1", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      expect(verifyResponse.status).toBe(200);
    });
  });

  describe("Performance with complex queries", () => {
    it("should handle queries with many filters efficiently", async () => {
      const startTime = Date.now();

      const response = await app.request(
        "/rest/v1/users?" +
        "age=gte.20&age=lte.50&" +
        "role=in.(admin,user,moderator)&" +
        "is_active=eq.true&" +
        "email=like.%40example.com&" +
        "select=id,email,age,role&" +
        "order=age.desc&" +
        "limit=10&offset=0",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});