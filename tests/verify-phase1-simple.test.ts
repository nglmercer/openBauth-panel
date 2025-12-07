// tests/verify-phase1-simple.test.ts
// Tests simples de verificación para Fase 1: Reestructuración de Rutas
import { describe, it, expect } from "bun:test";
import app from "../src/index";

describe("Fase 1 - Verificación de Rutas Supabase", () => {
  
  describe("Auth Endpoints - /auth/v1/*", () => {
    
    it("POST /auth/v1/signup - should register a new user", async () => {
      const response = await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          username: "testuser",
          first_name: "Test",
          last_name: "User",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe("test@example.com");
    });

    it("POST /auth/v1/token - should login with password grant", async () => {
      // Primero registrar un usuario
      await app.request("/auth/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "login@test.com",
          password: "password123",
          username: "loginuser",
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
          email: "login@test.com",
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

    it("GET /rest/v1/users - should return list of users", async () => {
      const response = await app.request("/rest/v1/users");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("POST /rest/v1/users - should create a new user", async () => {
      const response = await app.request("/rest/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "api@test.com",
          password_hash: "hashedpassword",
          username: "apiuser",
          first_name: "API",
          last_name: "Test",
          is_active: true,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.email).toBe("api@test.com");
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