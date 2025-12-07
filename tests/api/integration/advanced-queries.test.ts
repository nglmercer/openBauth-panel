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

  describe("Complex filtering on /rest/v1/users", () => {
    beforeAll(async () => {
      // Create test users with different attributes
      const timestamp = Date.now();
      const testUsers = [
        {
          email: `adv-user1-${timestamp}@example.com`,
          password_hash: "hashed",
          username: `advuser1-${timestamp}`,
          first_name: "Advanced",
          last_name: "User1",
          age: 20,
          role: "user",
          is_active: true,
        },
        {
          email: `adv-user2-${timestamp}@example.com`,
          password_hash: "hashed",
          username: `advuser2-${timestamp}`,
          first_name: "Advanced",
          last_name: "User2",
          age: 25,
          role: "admin",
          is_active: true,
        },
        {
          email: `adv-user3-${timestamp}@example.com`,
          password_hash: "hashed",
          username: `advuser3-${timestamp}`,
          first_name: "Advanced",
          last_name: "User3",
          age: 30,
          role: "moderator",
          is_active: false,
        },
        {
          email: `adv-user4-${timestamp}@example.com`,
          password_hash: "hashed",
          username: `advuser4-${timestamp}`,
          first_name: "Advanced",
          last_name: "User4",
          age: 35,
          role: "user",
          is_active: true,
        },
        {
          email: `adv-user5-${timestamp}@example.com`,
          password_hash: "hashed",
          username: `advuser5-${timestamp}`,
          first_name: "Advanced",
          last_name: "User5",
          age: 40,
          role: "admin",
          is_active: false,
        },
      ];

      for (const user of testUsers) {
        await app.request("/rest/v1/users", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(user),
        });
      }
    });

    it("should filter with multiple equality conditions", async () => {
      const response = await app.request(
        "/rest/v1/users?role=eq.admin&is_active=eq.true&select=id,email,role,is_active",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.role).toBe("admin");
        expect(user.is_active).toBe(true);
      });
    });

    it("should filter with range conditions", async () => {
      const response = await app.request(
        "/rest/v1/users?age=gte.25&age=lte.35&select=id,email,age&order=age.asc",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.age).toBeGreaterThanOrEqual(25);
        expect(user.age).toBeLessThanOrEqual(35);
      });

      // Verify ordering
      if (data.data.length > 1) {
        for (let i = 0; i < data.data.length - 1; i++) {
          expect(data.data[i].age).toBeLessThanOrEqual(data.data[i + 1].age);
        }
      }
    });

    it("should filter with like pattern matching", async () => {
      const response = await app.request(
        "/rest/v1/users?email=like.adv-user%&select=id,email&limit=10",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.email).toMatch(/^adv-user/);
      });
    });

    it("should filter with ilike case-insensitive matching", async () => {
      const response = await app.request(
        "/rest/v1/users?username=ilike.ADVUSER%&select=id,username&limit=10",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.username.toLowerCase()).toMatch(/^advuser/);
      });
    });

    it("should filter with in operator for multiple values", async () => {
      const response = await app.request(
        "/rest/v1/users?role=in.(admin,moderator)&select=id,email,role&limit=10",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(["admin", "moderator"]).toContain(user.role);
      });
    });

    it("should filter with is null operator", async () => {
      const response = await app.request(
        "/rest/v1/users?deleted_at=is.null&select=id,email,deleted_at&limit=10",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.deleted_at).toBeNull();
      });
    });

    it("should combine multiple complex filters", async () => {
      const response = await app.request(
        "/rest/v1/users?age=gte.25&age=lte.40&role=in.(admin,user)&is_active=eq.true&select=id,email,age,role,is_active&order=age.desc&limit=5",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(5);
      
      data.data.forEach((user: any) => {
        expect(user.age).toBeGreaterThanOrEqual(25);
        expect(user.age).toBeLessThanOrEqual(40);
        expect(["admin", "user"]).toContain(user.role);
        expect(user.is_active).toBe(true);
      });

      // Verify descending order
      if (data.data.length > 1) {
        for (let i = 0; i < data.data.length - 1; i++) {
          expect(data.data[i].age).toBeGreaterThanOrEqual(data.data[i + 1].age);
        }
      }
    });
  });

  describe("Complex column selection", () => {
    it("should select specific columns only", async () => {
      const response = await app.request(
        "/rest/v1/users?select=id,email,username&limit=1",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      
      if (data.data.length > 0) {
        const user = data.data[0];
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.username).toBeDefined();
        expect(user.first_name).toBeUndefined();
        expect(user.last_name).toBeUndefined();
        expect(user.password_hash).toBeUndefined();
      }
    });

    it("should handle pagination with complex queries", async () => {
      // Get first page
      const page1Response = await app.request(
        "/rest/v1/users?age=gte.20&age=lte.40&order=age.asc&limit=2&offset=0&select=id,email,age",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(page1Response.status).toBe(200);
      const page1Data = await page1Response.json();
      expect(page1Data.success).toBe(true);
      expect(page1Data.data.length).toBeLessThanOrEqual(2);

      // Get second page
      const page2Response = await app.request(
        "/rest/v1/users?age=gte.20&age=lte.40&order=age.asc&limit=2&offset=2&select=id,email,age",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      expect(page2Response.status).toBe(200);
      const page2Data = await page2Response.json();
      expect(page2Data.success).toBe(true);
      expect(page2Data.data.length).toBeLessThanOrEqual(2);

      // Verify no overlap between pages
      const page1Ids = page1Data.data.map((u: any) => u.id);
      const page2Ids = page2Data.data.map((u: any) => u.id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    });
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