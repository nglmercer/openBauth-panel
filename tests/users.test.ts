import app from "../src/index";
import {
  describe,
  expect,
  it,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "bun:test";
import { dbInitializer, authService, permissionService } from "../src/db";

// Datos de prueba para usuarios
const adminUser = {
  email: "admin@example.com",
  password: "StrongP@ssw0rd",
  username: "admin",
  first_name: "Admin",
  last_name: "User",
};

const testUser = {
  email: "test@example.com",
  password: "StrongP@ssw0rd",
  username: "testuser",
  first_name: "Test",
  last_name: "User",
};

// Variables para almacenar tokens y IDs
let adminToken: string | undefined;
let adminUserId: string | undefined;
let adminRoleId: string | undefined;
let testUserId: string | undefined;

beforeAll(async () => {
  // Reinicializar la base de datos
  await dbInitializer.reset(dbInitializer.getSchemas());
  console.log("DB reset for users API tests");

  // Crear usuario administrador
  const adminResult = await authService.register(adminUser);
  adminToken = adminResult.token;
  adminUserId = adminResult.user?.id;

  // Crear rol de administrador
  const adminRoleResult = await permissionService.createRole({
    name: "admin",
    description: "Administrator role with all permissions",
  });
  adminRoleId = adminRoleResult.data?.id;

  // Crear permisos
  const listPermissionResult = await permissionService.createPermission({
    name: "users:list",
    description: "List all users",
  });

  const viewPermissionResult = await permissionService.createPermission({
    name: "users:view",
    description: "View user details",
  });

  const createPermissionResult = await permissionService.createPermission({
    name: "users:create",
    description: "Create new users",
  });

  const updatePermissionResult = await permissionService.createPermission({
    name: "users:update",
    description: "Update user information",
  });

  const deletePermissionResult = await permissionService.createPermission({
    name: "users:delete",
    description: "Delete users",
  });

  // Asignar permisos al rol
  if (adminRoleId) {
    if (listPermissionResult.data?.id) {
      await permissionService.assignPermissionToRole(
        adminRoleId,
        listPermissionResult.data.id,
      );
    }
    if (viewPermissionResult.data?.id) {
      await permissionService.assignPermissionToRole(
        adminRoleId,
        viewPermissionResult.data.id,
      );
    }
    if (createPermissionResult.data?.id) {
      await permissionService.assignPermissionToRole(
        adminRoleId,
        createPermissionResult.data.id,
      );
    }
    if (updatePermissionResult.data?.id) {
      await permissionService.assignPermissionToRole(
        adminRoleId,
        updatePermissionResult.data.id,
      );
    }
    if (deletePermissionResult.data?.id) {
      await permissionService.assignPermissionToRole(
        adminRoleId,
        deletePermissionResult.data.id,
      );
    }

    // Asignar rol al usuario
    await permissionService.assignRoleToUser(adminUserId!, adminRoleId);
  }

  // Crear usuario de prueba
  const userResult = await authService.register(testUser);
  testUserId = userResult.user?.id;

  console.log("Admin and test users created for users API tests");
});

describe("Users API Routes", () => {
  // Tests para GET /api/users
  describe("GET /api/users", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.request("/api/users", {
        method: "GET",
      });
      const jsonData = await response.json();
      expect(response.status).toBe(401);
      expect((jsonData as any).error).toContain(
        "Authorization header is missing",
      );
    });

    it("should return 401 with invalid token", async () => {
      const response = await app.request("/api/users", {
        method: "GET",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });
      expect(response.status).toBe(401);
    });
  });

  // Tests para GET /api/users/:id
  describe("GET /api/users/:id", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.request(`/api/users/${testUserId}`, {
        method: "GET",
      });
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent user with authentication", async () => {
      // Login para obtener un token válido
      const loginResult = await authService.login({
        email: adminUser.email,
        password: adminUser.password,
      });

      const response = await app.request("/api/users/non-existent-id", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${loginResult.token}`,
        },
      });
      expect(response.status).toBe(403);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.request(`/api/users/${testUserId}`, {
        method: "GET",
      });
      expect(response.status).toBe(401);
    });
  });

  // Tests para POST /api/users
  describe("POST /api/users", () => {
    it("should return 401 without authentication", async () => {
      const newUser = {
        email: "unauth@example.com",
        password: "StrongP@ssw0rd",
        username: "unauth",
        first_name: "Unauth",
        last_name: "User",
      };

      const response = await app.request("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });
      expect(response.status).toBe(401);
    });

    it("should validate required fields", async () => {
      // Login para obtener un token válido
      const loginResult = await authService.login({
        email: adminUser.email,
        password: adminUser.password,
      });

      const invalidUser = {
        email: "not-an-email",
        password: "123", // Too short
        username: "ab", // Too short
        first_name: "", // Empty
        last_name: "", // Empty
      };

      const response = await app.request("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loginResult.token}`,
        },
        body: JSON.stringify(invalidUser),
      });
      expect(response.status).toBe(403);
    });
  });

  // Tests para PUT /api/users/:id
  describe("PUT /api/users/:id", () => {
    it("should return 401 without authentication", async () => {
      const updateData = {
        first_name: "Hacked",
      };

      const response = await app.request(`/api/users/${testUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });
      expect(response.status).toBe(401);
    });
  });

  // Tests para DELETE /api/users/:id
  describe("DELETE /api/users/:id", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.request(`/api/users/${testUserId}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(401);
    });
  });
});
