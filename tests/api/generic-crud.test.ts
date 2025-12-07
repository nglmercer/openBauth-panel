// tests/api/generic-crud.test.ts
// Generic CRUD API tests using new Supabase-compatible endpoints
import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp, generateUniqueId } from "../test-helpers";

describe("Generic CRUD API Tests - Supabase Compatible", () => {
  let app: any;

  beforeAll(async () => {
    app = await createFreshApp();
  });

  describe("CRUD Operations on /rest/v1/users", () => {
    it("should create a new user", async () => {
      const uniqueId = generateUniqueId();
      const response = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `crud-${uniqueId}@example.com`,
          password_hash: "hashedpassword",
          username: `cruduser-${uniqueId}`,
          first_name: "CRUD",
          last_name: "Test",
          is_active: true,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(`crud-${uniqueId}@example.com`);
    });

    it("should read all users", async () => {
      const response = await app.request("/rest/v1/users");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should read a specific user by ID", async () => {
      const uniqueId = generateUniqueId();
      
      // Create a user first
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `read-${uniqueId}@example.com`,
          password_hash: "hashedpassword",
          username: `readuser-${uniqueId}`,
          first_name: "Read",
          last_name: "Test",
          is_active: true,
        }),
      });
      
      const createdUser = await createResponse.json();

      // Read the user
      const response = await app.request(`/rest/v1/users/${createdUser.data.id}`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(`read-${uniqueId}@example.com`);
    });

    it("should update a user", async () => {
      const uniqueId = generateUniqueId();
      
      // Create a user first
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `update-${uniqueId}@example.com`,
          password_hash: "hashedpassword",
          username: `updateuser-${uniqueId}`,
          first_name: "Update",
          last_name: "Test",
          is_active: true,
        }),
      });
      
      const createdUser = await createResponse.json();

      // Update the user
      const response = await app.request(`/rest/v1/users/${createdUser.data.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: "UpdatedName",
          is_active: false,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.first_name).toBe("UpdatedName");
      expect(data.data.is_active).toBe(false);
    });

    it("should delete a user", async () => {
      const uniqueId = generateUniqueId();
      
      // Create a user first
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `delete-${uniqueId}@example.com`,
          password_hash: "hashedpassword",
          username: `deleteuser-${uniqueId}`,
          first_name: "Delete",
          last_name: "Test",
          is_active: true,
        }),
      });
      
      const createdUser = await createResponse.json();

      // Delete the user
      const response = await app.request(`/rest/v1/users/${createdUser.data.id}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Record deleted successfully");

      // Verify user is deleted
      const verifyResponse = await app.request(`/rest/v1/users/${createdUser.data.id}`);
      expect(verifyResponse.status).toBe(404);
    });
  });

  describe("CRUD Operations on /rest/v1/tables", () => {
    it("should list all tables", async () => {
      const response = await app.request("/rest/v1/tables");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.tables)).toBe(true);
      expect(data.tables.length).toBeGreaterThan(0);
    });
  });

  describe("CRUD Operations on /rest/v1/schemas", () => {
    it("should return all schemas", async () => {
      const response = await app.request("/rest/v1/schemas");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.schemas)).toBe(true);
      expect(data.relations).toBeDefined();
    });
  });

  describe("Legacy endpoints should return 404", () => {
    it("GET /api/users should return 404", async () => {
      const response = await app.request("/api/users");
      expect(response.status).toBe(404);
    });

    it("POST /api/users should return 404", async () => {
      const response = await app.request("/api/users", {
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

    it("GET /dashboard should return 404", async () => {
      const response = await app.request("/dashboard");
      expect(response.status).toBe(404);
    });

    it("GET /dashboard/tables should return 404", async () => {
      const response = await app.request("/dashboard/tables");
      expect(response.status).toBe(404);
    });
  });
});