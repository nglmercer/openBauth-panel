import app from "../src/index";
import { describe, expect, it, beforeAll } from "bun:test";
import { dbInitializer, authService } from "../src/db";

// Datos de prueba para el usuario de autenticación
const adminUser = {
  email: "admin@example.com",
  password: "StrongP@ssw0rd",
  username: "admin",
  first_name: "Admin",
  last_name: "User",
};

// Datos de prueba para un usuario normal
const normalUser = {
  email: "user@example.com",
  password: "StrongP@ssw0rd",
  username: "johndoe",
  first_name: "John",
  last_name: "Doe",
};

// Variables para almacenar tokens de autenticación
let adminToken: string | undefined;
let normalToken: string | undefined;

beforeAll(async () => {
  // Reinicializar la base de datos
  await dbInitializer.reset(dbInitializer.getSchemas());
  console.log("DB reset for dashboard tests");

  // Crear usuario administrador
  const adminResult = await authService.register(adminUser);
  adminToken = adminResult.token;

  // Crear usuario normal
  const userResult = await authService.register(normalUser);
  normalToken = userResult.token;

  console.log("Admin and normal users created for dashboard tests");
});

describe("Dashboard Routes (API JSON)", () => {
  // 1. Tests para el dashboard home (Listado de tablas)
  describe("GET /dashboard", () => {
    it("should return table list JSON with authentication", async () => {
      const response = await app.request("/dashboard", {
        method: "GET",
        headers: {
          Cookie: `access_token=${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const json = (await response.json()) as { success: boolean; data: any[] };

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      // Verificar que la tabla users está en la lista
      const hasUsersTable = json.data.some((t: any) => t.tableName === "users");
      expect(hasUsersTable).toBe(true);
    });

    it("should redirect or error without authentication", async () => {
      const response = await app.request("/dashboard", {
        method: "GET",
        redirect: "manual",
      });
      // Puede ser 302 (Redirección a login) o 401 (Unauthorized) dependiendo de tu middleware
      expect([302, 401]).toContain(response.status);
    });
  });

  // 2. Tests para vistas de tabla (Listado de registros)
  describe("GET /dashboard/table/:tableName", () => {
    it("should return users data JSON with authentication", async () => {
      const response = await app.request(`/dashboard/table/users`, {
        method: "GET",
        headers: {
          Cookie: `access_token=${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const json = (await response.json()) as { success: boolean; data: any[] };

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);

      const dataString = JSON.stringify(json.data);
      expect(dataString).toContain("email");
      expect(dataString).toContain(adminUser.email);
      expect(dataString).toContain(normalUser.email);
    });

    it("should handle non-existent table gracefully (404)", async () => {
      const response = await app.request("/dashboard/table/nonexistent", {
        method: "GET",
        headers: {
          Cookie: `access_token=${adminToken}`,
        },
      });

      expect(response.status).toBe(404);
      const json = (await response.json()) as { success: boolean; error: any };

      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });
  });

  // 3. Tests para creación de registros (POST JSON)
  describe("POST /dashboard/table/:tableName", () => {
    it("should create a new user via JSON", async () => {
      const newUser = {
        email: `newuser_${Date.now()}@example.com`,
        username: "newuser_json",
        password_hash: "TestP@ssw0rd", // El schema espera password_hash
        first_name: "New",
        last_name: "User",
        is_active: true,
      };

      const response = await app.request("/dashboard/table/users", {
        method: "POST",
        headers: {
          Cookie: `access_token=${adminToken}`,
          "Content-Type": "application/json", // IMPORTANTE: JSON
        },
        body: JSON.stringify(newUser),
      });

      expect(response.status).toBe(201); // 201 Created
      const json = (await response.json()) as { success: boolean; data: any };
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });

    it("should handle validation errors (400)", async () => {
      // Datos inválidos (falta email que es unique/required o formato incorrecto)
      const invalidUser = {
        username: "test_invalid",
        // Falta email y password_hash
      };

      const response = await app.request("/dashboard/table/users", {
        method: "POST",
        headers: {
          Cookie: `access_token=${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invalidUser),
      });

      expect(response.status).toBe(400); // Bad Request
      const json = (await response.json()) as {
        success: boolean;
        data: any;
        error: any;
      };

      expect(json.success).toBe(false);
      // Verificamos que contenga detalles del error
      const errorDetail = JSON.stringify(json);
      expect(errorDetail).toContain("Validation Error");
    });
  });

  // 4. Tests para eliminación de registros
  describe("DELETE /dashboard/table/:tableName/:id", () => {
    it("should delete a user and return JSON success", async () => {
      // 1. Crear usuario para borrar
      const userToDelete = {
        email: `delete_${Date.now()}@example.com`,
        username: "todelete",
        password: "TestP@ssw0rd",
        first_name: "To",
        last_name: "Delete",
      };

      // Usamos el servicio auth directamente para crear rápido
      const createResult = await authService.register(userToDelete);
      const userId = createResult.user?.id;
      expect(userId).toBeDefined();

      // 2. Eliminar vía API Dashboard
      const response = await app.request(`/dashboard/table/users/${userId}`, {
        method: "DELETE",
        headers: {
          Cookie: `access_token=${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const json = (await response.json()) as { success: boolean };

      expect(json.success).toBe(true);
    });
  });
});
