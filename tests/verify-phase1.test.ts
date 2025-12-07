// tests/verify-phase1.test.ts
// Tests de verificación para Fase 1: Reestructuración de Rutas
import { describe, it, expect, beforeAll } from "bun:test";
import app from "../src/index";

// Helper function to generate unique IDs
function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

describe("Fase 1 - Verificación de Rutas Supabase", () => {
  
  describe("Auth Endpoints - /auth/v1/*", () => {
    
    it("POST /auth/v1/signup - should register a new user", async () => {
      const timestamp = Date.now();
      const response = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `test-${timestamp}@example.com`,
          password: "password123",
          username: `testuser-${timestamp}`,
          first_name: "Test",
          last_name: "User",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(`test-${timestamp}@example.com`);
    });

    it("POST /auth/v1/token - should login with password grant", async () => {
      const timestamp = Date.now();
      // Primero registrar un usuario
      await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `login-${timestamp}@example.com`,
          password: "password123",
          username: `loginuser-${timestamp}`,
          first_name: "Login",
          last_name: "Test",
        }),
      });

      // Luego hacer login
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "password",
          email: `login-${timestamp}@example.com`,
          password: "password123",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.token_type).toBe("bearer");
      expect(data.user).toBeDefined();
    });

    it("POST /auth/v1/token - should refresh token with refresh_token grant", async () => {
      const timestamp = Date.now();
      // Registrar y login para obtener refresh token
      await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `refresh-${timestamp}@example.com`,
          password: "password123",
          username: `refreshuser-${timestamp}`,
          first_name: "Refresh",
          last_name: "Test",
        }),
      });

      const loginResponse = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "password",
          email: `refresh-${timestamp}@example.com`,
          password: "password123",
        }),
      });
      const loginData = await loginResponse.json();

      // Usar refresh token para obtener nuevo access token
      const response = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: loginData.refresh_token,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.token_type).toBe("bearer");
    });

    it("GET /auth/v1/user - should return current user with valid token", async () => {
      const timestamp = Date.now();
      // Registrar usuario
      await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `me-${timestamp}@example.com`,
          password: "password123",
          username: `meuser-${timestamp}`,
          first_name: "Me",
          last_name: "Test",
        }),
      });

      // Login para obtener token
      const loginResponse = await app.request("/auth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "password",
          email: `me-${timestamp}@example.com`,
          password: "password123",
        }),
      });
      const loginData = await loginResponse.json();

      // Obtener usuario actual
      const response = await app.request("/auth/v1/user", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${loginData.access_token}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe(`me-${timestamp}@example.com`);
      expect(data.username).toBe(`meuser-${timestamp}`);
    });

    it("POST /auth/v1/logout - should logout successfully", async () => {
      const response = await app.request("/auth/v1/logout", {
        method: "POST",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("API CRUD Endpoints - /rest/v1/*", () => {
    
    it("GET /rest/v1/users - should return list of users", async () => {
      const response = await app.request("/rest/v1/users");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("POST /rest/v1/users - should create a new user", async () => {
      const uniqueId = generateUniqueId();
      const response = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `api-${uniqueId}@example.com`,
          password_hash: "hashedpassword",
          username: `apiuser-${uniqueId}`,
          first_name: "API",
          last_name: "Test",
          is_active: true,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.email).toBe(`api-${uniqueId}@example.com`);
    });

    it("GET /rest/v1/users/:id - should return specific user", async () => {
      const uniqueId = generateUniqueId();
      // Primero crear un usuario
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `specific-${uniqueId}@example.com`,
          password_hash: "hashedpassword",
          username: `specificuser-${uniqueId}`,
          first_name: "Specific",
          last_name: "Test",
          is_active: true,
        }),
      });
      const createdUser = await createResponse.json();

      // Luego obtener ese usuario específico
      const response = await app.request(`/rest/v1/users/${createdUser.data.id}`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(`specific-${uniqueId}@example.com`);
    });

    it("PUT /rest/v1/users/:id - should update user", async () => {
      const uniqueId = generateUniqueId();
      // Crear usuario
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

      // Actualizar usuario
      const response = await app.request(`/rest/v1/users/${createdUser.data.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: "UpdatedName",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.first_name).toBe("UpdatedName");
    });

    it("DELETE /rest/v1/users/:id - should delete user", async () => {
      const uniqueId = generateUniqueId();
      // Crear usuario
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

      // Eliminar usuario
      const response = await app.request(`/rest/v1/users/${createdUser.data.id}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Record deleted successfully");
    });

    it("GET /rest/v1/tables - should return list of tables", async () => {
      const response = await app.request("/rest/v1/tables");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.tables)).toBe(true);
      expect(data.tables.length).toBeGreaterThan(0);
    });

    it("GET /rest/v1/schemas - should return all schemas", async () => {
      const response = await app.request("/rest/v1/schemas");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.schemas)).toBe(true);
      expect(data.relations).toBeDefined();
    });
  });

  describe("Legacy endpoints - should return 404", () => {
    
    it("POST /auth/register - should return 404 (legacy)", async () => {
      const response = await app.request("/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "legacy@test.com",
          password: "password123",
          username: "legacyuser",
          first_name: "Legacy",
          last_name: "Test",
        }),
      });

      expect(response.status).toBe(404);
    });

    it("POST /auth/login - should return 404 (legacy)", async () => {
      const response = await app.request("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "legacy@test.com",
          password: "password123",
        }),
      });

      expect(response.status).toBe(404);
    });

    it("GET /api/users - should return 404 (legacy)", async () => {
      const response = await app.request("/api/users");
      expect(response.status).toBe(404);
    });

    it("GET /dashboard - should return 404 (legacy)", async () => {
      const response = await app.request("/dashboard");
      expect(response.status).toBe(404);
    });
  });
});