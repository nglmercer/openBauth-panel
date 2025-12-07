import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp, generateUniqueId } from "../../test-helpers";

describe("Simple Queries Integration Tests", () => {
  let app: any;

  beforeAll(async () => {
    app = await createFreshApp();
  });

  describe("GET /rest/v1/users basic functionality", () => {
    it("should return empty list when no users exist", async () => {
      const request = new Request("http://localhost/rest/v1/users");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(0);
    });

    it("should handle basic query parameters", async () => {
      const request = new Request("http://localhost/rest/v1/users?limit=10");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should handle select parameter", async () => {
      const request = new Request("http://localhost/rest/v1/users?select=id,email&limit=1");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      if (data.data.length > 0) {
        const user = data.data[0];
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.name).toBeNull();
        expect(user.age).toBeNull();
      }
    });
  });

  describe("POST /rest/v1/users basic functionality", () => {
    it("should create a new user", async () => {
      const timestamp = Date.now();
      const newUser = {
        email: `test_${timestamp}@example.com`,
        password: "password123",
        username: `testuser_${timestamp}`,
        first_name: "Test",
        last_name: "User",
        age: 30,
        role: "user"
      };

      const request = new Request("http://localhost/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });
      const response = await app.fetch(request);

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(`test_${timestamp}@example.com`);
    });

    it("should retrieve created user with queries", async () => {
      // Create a completely fresh app instance to ensure no conflicts
      const freshApp = await createFreshApp();
      
      // Create a truly unique identifier using multiple sources and process info
      const timestamp = Date.now();
      const processPart = process.hrtime.bigint().toString();
      const randomPart1 = Math.random().toString(36).substring(2, 15);
      const randomPart2 = Math.random().toString(36).substring(2, 15);
      const randomPart3 = Math.random().toString(36).substring(2, 15);
      const uniqueId = `qt_${timestamp}_${processPart}_${randomPart1}_${randomPart2}_${randomPart3}`;
      
      // Truncate if too long for username (keep under 50 chars)
      const truncatedUniqueId = uniqueId.substring(0, 50);
      
      // First create a user
      const newUser = {
        email: `${truncatedUniqueId}@example.com`,
        password: "password123",
        username: truncatedUniqueId,
        first_name: "Query",
        last_name: "Test",
        age: 25,
        role: "user"
      };

      const createRequest = new Request("http://localhost/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });
      const createResponse = await freshApp.fetch(createRequest);

      expect(createResponse.status).toBe(201);
      const createdData = await createResponse.json();
      const userId = createdData.data.id;

      // Test equality filter
      const eqRequest = new Request(`http://localhost/rest/v1/users?email=eq.${truncatedUniqueId}@example.com`);
      const eqResponse = await freshApp.fetch(eqRequest);
      const eqData = await eqResponse.json();
      
      expect(eqResponse.status).toBe(200);
      expect(eqData.success).toBe(true);
      expect(eqData.data.length).toBeGreaterThan(0);
      expect(eqData.data[0].email).toBe(`${truncatedUniqueId}@example.com`);

      // Test select parameter
      const selectRequest = new Request(`http://localhost/rest/v1/users?select=id,email&email=eq.${truncatedUniqueId}@example.com`);
      const selectResponse = await freshApp.fetch(selectRequest);
      const selectData = await selectResponse.json();
      
      expect(selectResponse.status).toBe(200);
      expect(selectData.success).toBe(true);
      if (selectData.data.length > 0) {
        expect(selectData.data[0].id).toBeDefined();
        expect(selectData.data[0].email).toBeDefined();
        expect(selectData.data[0].first_name).toBeNull(); // Should not be included (set to null)
      }

      // Test get by ID with select
      const idRequest = new Request(`http://localhost/rest/v1/users/${userId}?select=id,email,age`);
      const idResponse = await freshApp.fetch(idRequest);
      const idData = await idResponse.json();
      
      expect(idResponse.status).toBe(200);
      expect(idData.success).toBe(true);
      expect(idData.data.id).toBe(userId);
      expect(idData.data.email).toBeDefined();
      expect(idData.data.age).toBeDefined();
      expect(idData.data.first_name).toBeNull(); // Should not be included (set to null)
    });
  });

  describe("Advanced query operators", () => {
    beforeAll(async () => {
      // Create test users with different ages - use unique emails to avoid conflicts
      const timestamp = Date.now();
      const testUsers = [
        { email: `user20_${timestamp}@example.com`, password: "password123", username: `user20_${timestamp}`, first_name: "User", last_name: "20", age: 20, role: "user" },
        { email: `user25_${timestamp}@example.com`, password: "password123", username: `user25_${timestamp}`, first_name: "User", last_name: "25", age: 25, role: "user" },
        { email: `user30_${timestamp}@example.com`, password: "password123", username: `user30_${timestamp}`, first_name: "User", last_name: "30", age: 30, role: "user" },
        { email: `user35_${timestamp}@example.com`, password: "password123", username: `user35_${timestamp}`, first_name: "User", last_name: "35", age: 35, role: "user" },
        { email: `user40_${timestamp}@example.com`, password: "password123", username: `user40_${timestamp}`, first_name: "User", last_name: "40", age: 40, role: "user" },
      ];

      for (const user of testUsers) {
        const request = new Request("http://localhost/rest/v1/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(user),
        });
        await app.fetch(request);
      }
    });

    it("should filter with gt operator", async () => {
      const request = new Request("http://localhost/rest/v1/users?age=gt.30");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.age).toBeGreaterThan(30);
      });
    });

    it("should filter with gte operator", async () => {
      const request = new Request("http://localhost/rest/v1/users?age=gte.30");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.age).toBeGreaterThanOrEqual(30);
      });
    });

    it("should filter with lt operator", async () => {
      const request = new Request("http://localhost/rest/v1/users?age=lt.30");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.age).toBeLessThan(30);
      });
    });

    it("should filter with lte operator", async () => {
      const request = new Request("http://localhost/rest/v1/users?age=lte.30");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.age).toBeLessThanOrEqual(30);
      });
    });

    it("should filter with neq operator", async () => {
      const request = new Request("http://localhost/rest/v1/users?age=neq.30");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.age).not.toBe(30);
      });
    });

    it("should filter with like operator", async () => {
      const timestamp = Date.now();
      const request = new Request(`http://localhost/rest/v1/users?email=like.user${timestamp}%25`);
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect(user.email).toMatch(new RegExp(`^user.*${timestamp}`));
      });
    });

    it("should filter with in operator", async () => {
      const request = new Request("http://localhost/rest/v1/users?age=in.(25,30,35)");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      data.data.forEach((user: any) => {
        expect([25, 30, 35]).toContain(user.age);
      });
    });

    it("should order results ascending", async () => {
      const request = new Request("http://localhost/rest/v1/users?order=age.asc&limit=10");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      if (data.data.length > 1) {
        for (let i = 0; i < data.data.length - 1; i++) {
          expect(data.data[i].age).toBeLessThanOrEqual(data.data[i + 1].age);
        }
      }
    });

    it("should order results descending", async () => {
      const request = new Request("http://localhost/rest/v1/users?order=age.desc&limit=10");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      if (data.data.length > 1) {
        for (let i = 0; i < data.data.length - 1; i++) {
          expect(data.data[i].age).toBeGreaterThanOrEqual(data.data[i + 1].age);
        }
      }
    });

    it("should paginate results", async () => {
      // Get first page
      const page1Request = new Request("http://localhost/rest/v1/users?limit=2&offset=0&order=age.asc");
      const page1Response = await app.fetch(page1Request);
      const page1Data = await page1Response.json();
      
      expect(page1Response.status).toBe(200);
      expect(page1Data.success).toBe(true);
      expect(page1Data.data.length).toBeLessThanOrEqual(2);
      
      // Get second page
      const page2Request = new Request("http://localhost/rest/v1/users?limit=2&offset=2&order=age.asc");
      const page2Response = await app.fetch(page2Request);
      const page2Data = await page2Response.json();
      
      expect(page2Response.status).toBe(200);
      expect(page2Data.success).toBe(true);
      expect(page2Data.data.length).toBeLessThanOrEqual(2);
    });

    it("should combine multiple filters and operators", async () => {
      const request = new Request(
        "http://localhost/rest/v1/users?age=gte.25&age=lte.35&order=age.asc&limit=10"
      );
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
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
  });
});