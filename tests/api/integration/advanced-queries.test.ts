import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp, createTestUser } from "../../test-helpers";

describe("Advanced Queries Integration Tests", () => {
  let app: any;
  let accessToken: string;

  beforeAll(async () => {
    app = await createFreshApp();
    
    // Create a test user and get access token
    const testUser = await createTestUser(app);
    accessToken = testUser.accessToken;
  });

  describe("GET /rest/v1/users with advanced queries", () => {
    it("should filter users by equality", async () => {
      const request = new Request("http://localhost/rest/v1/users?email=eq.test@example.com");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should filter users by comparison operators", async () => {
      const request = new Request("http://localhost/rest/v1/users?age=gte.25&age=lt.40");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should select specific columns", async () => {
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
        expect(user.first_name).toBeNull(); // Should not be included (set to null)
        expect(user.age).toBeNull(); // Should not be included (set to null)
      }
    });

    it("should order results", async () => {
      const request = new Request("http://localhost/rest/v1/users?order=age.desc&limit=5");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should paginate results", async () => {
      // Get first page
      const page1Request = new Request("http://localhost/rest/v1/users?limit=2&offset=0");
      const page1Response = await app.fetch(page1Request);
      const page1Data = await page1Response.json();
      
      expect(page1Response.status).toBe(200);
      expect(page1Data.success).toBe(true);
      expect(page1Data.data.length).toBeLessThanOrEqual(2);
      
      // Get second page
      const page2Request = new Request("http://localhost/rest/v1/users?limit=2&offset=2");
      const page2Response = await app.fetch(page2Request);
      const page2Data = await page2Response.json();
      
      expect(page2Response.status).toBe(200);
      expect(page2Data.success).toBe(true);
      expect(page2Data.data.length).toBeLessThanOrEqual(2);
    });

    it("should combine multiple filters", async () => {
      const request = new Request(
        "http://localhost/rest/v1/users?age=gte.25&age=lte.35&select=id,name,age&order=age.asc&limit=3"
      );
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should handle like and ilike operators", async () => {
      const request = new Request("http://localhost/rest/v1/users?email=like.%@example.com&limit=5");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should handle in operator", async () => {
      const request = new Request("http://localhost/rest/v1/users?role=in.(admin,user)&select=id,role&limit=10");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid query parameters gracefully", async () => {
      const request = new Request("http://localhost/rest/v1/users?invalidparam=value");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should handle invalid order direction", async () => {
      const request = new Request("http://localhost/rest/v1/users?order=age.invalid");
      const response = await app.fetch(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });
});