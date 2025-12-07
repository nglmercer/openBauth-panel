// tests/verify-phase1-fixed.test.ts
// Tests de verificación para Fase 1: Reestructuración de Rutas
import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { DatabaseInitializer } from "open-bauth";
import { getOAuthSchemas } from "open-bauth";
import { JWTService } from "open-bauth";
import { AuthService } from "open-bauth";
import { PermissionService } from "open-bauth";

// Create fresh instances for each test
function createFreshApp() {
  // Create a new in-memory database for each test
  const db = new Database(":memory:");
  
  // Initialize the database
  const dbInitializer = new DatabaseInitializer({ database: db });
  const oauthSchemas = getOAuthSchemas();
  dbInitializer.registerSchemas(oauthSchemas);
  
  // Create fresh services
  const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";
  const jwtService = new JWTService(JWT_SECRET, "15m");
  const authService = new AuthService(dbInitializer, jwtService);
  const permissionService = new PermissionService(dbInitializer);
  
  // Import and create a fresh app instance
  const { Hono } = require("hono");
  const { authRouter } = require("../src/routers/auth");
  const { restApiRouter } = require("../src/routers/rest-api");
  
  const app = new Hono();
  app.route("/auth/v1", authRouter);
  app.route("/rest/v1", restApiRouter);
  
  return app;
}

describe("Fase 1 - Verificación de Rutas Supabase - Fixed", () => {
  
  describe("Auth Endpoints - /auth/v1/*", () => {
    
    it("POST /auth/v1/signup - should register a new user", async () => {
      const app = createFreshApp();
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
      const app = createFreshApp();
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
      const app = createFreshApp();
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
      const app = createFreshApp();
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
  });

  describe("API CRUD Endpoints - /rest/v1/*", () => {
    
    it("GET /rest/v1/users - should return list of users", async () => {
      const app = createFreshApp();
      const response = await app.request("/rest/v1/users");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("POST /rest/v1/users - should create a new user", async () => {
      const app = createFreshApp();
      const timestamp = Date.now();
      
      const response = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `api-${timestamp}@example.com`,
          password_hash: "hashedpassword",
          username: `apiuser-${timestamp}`,
          first_name: "API",
          last_name: "Test",
          is_active: true,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.email).toBe(`api-${timestamp}@example.com`);
    });

    it("GET /rest/v1/users/:id - should return specific user", async () => {
      const app = createFreshApp();
      const timestamp = Date.now();
      
      // Primero crear un usuario
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `specific-${timestamp}@example.com`,
          password_hash: "hashedpassword",
          username: `specificuser-${timestamp}`,
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
      expect(data.data.email).toBe(`specific-${timestamp}@example.com`);
    });

    it("PUT /rest/v1/users/:id - should update user", async () => {
      const app = createFreshApp();
      const timestamp = Date.now();
      
      // Crear usuario
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `update-${timestamp}@example.com`,
          password_hash: "hashedpassword",
          username: `updateuser-${timestamp}`,
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
      const app = createFreshApp();
      const timestamp = Date.now();
      
      // Crear usuario
      const createResponse = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `delete-${timestamp}@example.com`,
          password_hash: "hashedpassword",
          username: `deleteuser-${timestamp}`,
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
  });
});