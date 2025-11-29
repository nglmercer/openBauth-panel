import app from "../src/index";
import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "bun:test";
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

describe("Dashboard Routes", () => {
  // Tests para el dashboard home
  describe("GET /dashboard", () => {
    it("should return 200 with authentication", async () => {
      const response = await app.request("/dashboard", {
        method: "GET",
        headers: {
          Cookie: `access_token=${adminToken}`,
        },
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("<!DOCTYPE html>");
      expect(text).toContain("Bienvenido");
      expect(text).toContain("Admin Panel");
    });

    it("should redirect to login without authentication", async () => {
      const response = await app.request("/dashboard", {
        method: "GET",
        redirect: "manual", // Evitar redirección automática
      });
      expect(response.status).toBe(302); // Código de redirección
      expect(response.headers.get("Location")).toBe("/auth/ssr/login");
    });
  });

  // Tests para vistas de tabla
  describe("GET /dashboard/table/:tableName", () => {
    it("should show users table with authentication", async () => {
      const response = await app.request("/dashboard/table/users", {
        method: "GET",
        headers: {
          Cookie: `access_token=${adminToken}`,
        },
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("<!DOCTYPE html>");
      expect(text).toContain("users");
      // Debe mostrar los usuarios que creamos
      expect(text).toContain(adminUser.email);
      expect(text).toContain(normalUser.email);
    });

    it("should redirect to login without authentication", async () => {
      const response = await app.request("/dashboard/table/users", {
        method: "GET",
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/ssr/login");
    });

    it("should handle non-existent table gracefully", async () => {
      const response = await app.request("/dashboard/table/nonexistent", {
        method: "GET",
        headers: {
          Cookie: `access_token=${adminToken}`,
        },
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Tabla no encontrada");
    });
  });

  // Tests para formulario de creación
  describe("GET /dashboard/table/:tableName/create", () => {
    it("should show creation form for users table with authentication", async () => {
      const response = await app.request("/dashboard/table/users/create", {
        method: "GET",
        headers: {
          Cookie: `access_token=${adminToken}`,
        },
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("<!DOCTYPE html>");
      expect(text).toContain("Crear en users");
      expect(text).toContain("<form");
      // Campos del formulario
      expect(text).toContain("email");
      expect(text).toContain("username");
    });

    it("should redirect to login without authentication", async () => {
      const response = await app.request("/dashboard/table/users/create", {
        method: "GET",
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/ssr/login");
    });
  });

  // Tests para creación de registros
  describe("POST /dashboard/table/:tableName", () => {
    it("should create a new user in users table with authentication", async () => {
      const newUser = {
        email: "newuser@example.com",
        username: "newuser",
        password_hash: "TestP@ssw0rd", // Usar password_hash como espera el endpoint
        first_name: "New",
        last_name: "User",
      };

      const response = await app.request("/dashboard/table/users", {
        method: "POST",
        headers: {
          Cookie: `access_token=${adminToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(newUser).toString(),
        redirect: "manual", // Para evitar redirección automática
      });

      // Para depuración, ver qué devuelve realmente
      // Comentamos los logs de depuración
      // console.log("Response status:", response.status);
      // console.log("Response headers:", response.headers);
      // console.log("Response text:", await response.text());

      // La respuesta exitosa es una redirección a la tabla
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard/table/users");
    });

    it("should redirect to login without authentication", async () => {
      const newUser = {
        email: "unauth@example.com",
        username: "unauth",
        password: "TestP@ssw0rd",
        first_name: "Unauth",
        last_name: "User",
      };

      const response = await app.request("/dashboard/table/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(newUser).toString(),
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/ssr/login");
    });

    it("should handle validation errors", async () => {
      // Datos inválidos (email incorrecto)
      const invalidUser = {
        email: "not-an-email",
        username: "test",
        password: "TestP@ssw0rd",
        first_name: "Test",
        last_name: "User",
      };

      const response = await app.request("/dashboard/table/users", {
        method: "POST",
        headers: {
          Cookie: `access_token=${adminToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(invalidUser).toString(),
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Error de Validación");
    });
  });

  // Tests para eliminación de registros
  describe("DELETE /dashboard/table/:tableName/:id", () => {
    it("should delete a user with authentication", async () => {
      // Primero, crear un usuario para eliminar
      const userToDelete = {
        email: "todelete@example.com",
        username: "todelete",
        password: "TestP@ssw0rd",
        first_name: "To",
        last_name: "Delete",
      };

      // Crear el usuario a través del API
      const createResult = await authService.register(userToDelete);
      const userId = createResult.user?.id;

      expect(userId).toBeDefined();

      // Eliminar el usuario a través del dashboard
      const response = await app.request(`/dashboard/table/users/${userId}`, {
        method: "DELETE",
        headers: {
          Cookie: `access_token=${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      // HTMX espera una respuesta vacía para eliminaciones exitosas
      expect(await response.text()).toBe("");
    });

    it("should redirect to login without authentication", async () => {
      const response = await app.request("/dashboard/table/users/123", {
        method: "DELETE",
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/ssr/login");
    });
  });
});
