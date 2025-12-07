// tests/api/integration/table-management.test.ts
// Table management integration tests using new Supabase-compatible endpoints
import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp, generateUniqueId } from "../../test-helpers";

describe("Table Management Integration Tests - Supabase Compatible", () => {
  let app: any;

  beforeAll(async () => {
    app = await createFreshApp();
  });

  describe("GET /rest/v1/tables", () => {
    it("should return list of all tables", async () => {
      const response = await app.request("/rest/v1/tables");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.tables)).toBe(true);
      expect(data.tables.length).toBeGreaterThan(0);
      
      // Check for expected tables
      const tableNames = data.tables.map((t: any) => t.name);
      expect(tableNames).toContain("users");
    });

    it("should return table schema information", async () => {
      const response = await app.request("/rest/v1/tables");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      if (data.tables.length > 0) {
        const firstTable = data.tables[0];
        expect(firstTable.name).toBeDefined();
        expect(firstTable.columns).toBeDefined();
        expect(Array.isArray(firstTable.columns)).toBe(true);
      }
    });
  });

  describe("GET /rest/v1/schemas", () => {
    it("should return all table schemas", async () => {
      const response = await app.request("/rest/v1/schemas");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.schemas)).toBe(true);
      expect(data.relations).toBeDefined();
    });

    it("should return valid schema structure", async () => {
      const response = await app.request("/rest/v1/schemas");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      data.schemas.forEach((schema: any) => {
        expect(schema.tableName).toBeDefined();
        expect(Array.isArray(schema.columns)).toBe(true);
        
        schema.columns.forEach((column: any) => {
          expect(column.name).toBeDefined();
          expect(column.type).toBeDefined();
        });
      });
    });
  });

  describe("Dynamic table operations", () => {
    it("should perform CRUD on users table via /rest/v1/users", async () => {
      const uniqueId = generateUniqueId();
      
      // Create
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `table-${uniqueId}@example.com`,
          password_hash: "hashedpassword",
          username: `tableuser-${uniqueId}`,
          first_name: "Table",
          last_name: "Test",
          is_active: true,
        }),
      });
      
      expect(createResponse.status).toBe(201);
      const createdUser = await createResponse.json();
      
      // Read
      const readResponse = await app.request(`/rest/v1/users/${createdUser.data.id}`);
      expect(readResponse.status).toBe(200);
      
      // Update
      const updateResponse = await app.request(`/rest/v1/users/${createdUser.data.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: "UpdatedTable",
        }),
      });
      expect(updateResponse.status).toBe(200);
      
      // Delete
      const deleteResponse = await app.request(`/rest/v1/users/${createdUser.data.id}`, {
        method: "DELETE",
      });
      expect(deleteResponse.status).toBe(200);
    });

    it("should handle queries on users table", async () => {
      const uniqueId = generateUniqueId();
      
      // Create test user
      await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `query-${uniqueId}@example.com`,
          password_hash: "hashedpassword",
          username: `queryuser-${uniqueId}`,
          first_name: "Query",
          last_name: "Test",
          is_active: true,
        }),
      });
      
      // Query with filters
      const queryResponse = await app.request(
        `/rest/v1/users?email=eq.query-${uniqueId}@example.com&select=id,email`
      );
      
      expect(queryResponse.status).toBe(200);
      const data = await queryResponse.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      if (data.data.length > 0) {
        expect(data.data[0].email).toBe(`query-${uniqueId}@example.com`);
        expect(data.data[0].id).toBeDefined();
      }
    });
  });

  describe("Legacy table endpoints should return 404", () => {
    it("GET /api/tables should return 404", async () => {
      const response = await app.request("/api/tables");
      expect(response.status).toBe(404);
    });

    it("GET /dashboard/tables should return 404", async () => {
      const response = await app.request("/dashboard/tables");
      expect(response.status).toBe(404);
    });

    it("GET /api/schemas should return 404", async () => {
      const response = await app.request("/api/schemas");
      expect(response.status).toBe(404);
    });
  });
});