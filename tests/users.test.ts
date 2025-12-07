// tests/users.test.ts
// Users API tests using new Supabase-compatible endpoints
import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp, createTestUser, generateUniqueId } from "./test-helpers";

describe("Users API Tests - Supabase Compatible", () => {
  let app: any;
  let accessToken: string;
  let testUser: any;

  beforeAll(async () => {
    app = await createFreshApp();
    testUser = await createTestUser(app);
    
    // Use the access token from createTestUser (which is now "test-token")
    accessToken = testUser.accessToken;
  });

  describe("GET /rest/v1/users", () => {
    it("should return list of users", async () => {
      const response = await app.request("/rest/v1/users", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should support pagination", async () => {
      const response = await app.request("/rest/v1/users?limit=5&offset=0", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(5);
    });

    it("should support column selection", async () => {
      const response = await app.request("/rest/v1/users?select=id,email&limit=1", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      
      if (data.data.length > 0) {
        const user = data.data[0];
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
      }
    });
  });

  describe("POST /rest/v1/users", () => {
    it("should create a new user", async () => {
      const uniqueId = generateUniqueId();
      const response = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `newuser-${uniqueId}@example.com`,
          password: "password123", // Use a real password, not "hashedpassword"
          username: `newuser-${uniqueId}`,
          first_name: "New",
          last_name: "User",
          is_active: true,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(`newuser-${uniqueId}@example.com`);
    });

    it("should work without authentication in test environment", async () => {
      const uniqueId = generateUniqueId();
      const response = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `unauth-${uniqueId}@example.com`,
          password: "password123", // Use a real password, not "hashedpassword"
          username: `unauth-${uniqueId}`,
          first_name: "Unauth",
          last_name: "User",
          is_active: true,
        }),
      });

      // In test environment, authentication is disabled for easier testing
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(`unauth-${uniqueId}@example.com`);
    });
  });

  describe("GET /rest/v1/users/:id", () => {
    it("should return specific user by ID", async () => {
      const response = await app.request(`/rest/v1/users/${testUser.id}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testUser.id);
      expect(data.data.email).toBe(testUser.email);
    });

    it("should return 404 for non-existent user", async () => {
      const response = await app.request("/rest/v1/users/non-existent-id", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      
      expect(response.status).toBe(404);
    });
  });

  describe("PUT /rest/v1/users/:id", () => {
    it("should update user by ID", async () => {
      const response = await app.request(`/rest/v1/users/${testUser.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: "Updated",
          is_active: false,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.first_name).toBe("Updated");
      expect(data.data.is_active).toBe(false);
    });

    it("should work without authentication in test environment", async () => {
      const response = await app.request(`/rest/v1/users/${testUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: "ShouldUpdateInTest",
        }),
      });

      // In test environment, authentication is disabled for easier testing
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.first_name).toBe("ShouldUpdateInTest");
    });
  });

  describe("DELETE /rest/v1/users/:id", () => {
    it("should delete user by ID", async () => {
      // Create a user to delete
      const uniqueId = generateUniqueId();
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `delete-${uniqueId}@example.com`,
          password: "password123", // Use a real password, not "hashedpassword"
          username: `delete-${uniqueId}`,
          first_name: "Delete",
          last_name: "User",
          is_active: true,
        }),
      });
      
      const createdUser = await createResponse.json();

      // Delete the user
      const deleteResponse = await app.request(`/rest/v1/users/${createdUser.data.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      expect(deleteResponse.status).toBe(200);
      const deleteData = await deleteResponse.json();
      expect(deleteData.message).toBe("Record deleted successfully");

      // Verify user is deleted
      const verifyResponse = await app.request(`/rest/v1/users/${createdUser.data.id}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      expect(verifyResponse.status).toBe(404);
    });

    it("should work without authentication in test environment", async () => {
      // Create a user to delete
      const uniqueId = generateUniqueId();
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `delete-test-${uniqueId}@example.com`,
          password: "password123",
          username: `delete-test-${uniqueId}`,
          first_name: "Delete",
          last_name: "Test",
          is_active: true,
        }),
      });
      
      const createdUser = await createResponse.json();

      // Delete the user without authentication
      const deleteResponse = await app.request(`/rest/v1/users/${createdUser.data.id}`, {
        method: "DELETE",
      });

      // In test environment, authentication is disabled for easier testing
      expect(deleteResponse.status).toBe(200);
      const deleteData = await deleteResponse.json();
      expect(deleteData.message).toBe("Record deleted successfully");

      // Verify user is deleted
      const verifyResponse = await app.request(`/rest/v1/users/${createdUser.data.id}`);
      expect(verifyResponse.status).toBe(404);
    });
  });

  describe("Query parameters on /rest/v1/users", () => {
    it("should filter users by email", async () => {
      const response = await app.request(
        `/rest/v1/users?email=eq.${testUser.email}`,
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
      
      if (data.data.length > 0) {
        expect(data.data[0].email).toBe(testUser.email);
      }
    });

    it("should filter users by multiple criteria", async () => {
      const response = await app.request(
        `/rest/v1/users?email=eq.${testUser.email}&is_active=eq.true&select=id,email,is_active`,
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
        expect(user.email).toBe(testUser.email);
        expect(user.is_active).toBe(true);
      }
    });
  });

  describe("Legacy users endpoints should return 404", () => {
    it("GET /api/users should return 404", async () => {
      const response = await app.request("/api/users", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      expect(response.status).toBe(404);
    });

    it("GET /dashboard/users should return 404", async () => {
      const response = await app.request("/dashboard/users", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      expect(response.status).toBe(404);
    });
  });
});