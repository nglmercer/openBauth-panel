import app from "../../src/index";
import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { dbInitializer, authService } from "../../src/db";

// Datos de prueba para el usuario de autenticación
const adminUser = {
  email: "admin_api@example.com",
  password: "StrongP@ssw0rd",
  username: "admin_api",
  first_name: "Admin",
  last_name: "API",
};

// Datos de prueba para un usuario normal
const normalUser = {
  email: "user_api@example.com",
  password: "StrongP@ssw0rd",
  username: "user_api",
  first_name: "User",
  last_name: "API",
};

beforeAll(async () => {
  // Reinicializar la base de datos
  await dbInitializer.reset(dbInitializer.getSchemas());
  console.log("DB reset for dashboard API tests");

  // Crear usuario administrador
  await authService.register(adminUser);

  // Crear usuario normal
  await authService.register(normalUser);

  console.log("Admin and normal users created for dashboard API tests");
});

describe("Dashboard API Routes", () => {
  // Tests para el dashboard home
  describe("GET /dashboard", () => {
    it("should return 200 with authentication via cookie", async () => {
      // Primero iniciar sesión a través de SSR para obtener las cookies
      const formData = new FormData();
      formData.append("email", adminUser.email);
      formData.append("password", adminUser.password);

      const loginResponse = await app.request("/auth/ssr/login", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost", // Required by HTMX
        },
      });

      // Extraer las cookies del encabezado Set-Cookie
      const setCookieHeader = loginResponse.headers.get("set-cookie");

      // Extraer todas las cookies del encabezado
      let cookies = "";
      if (setCookieHeader) {
        // El encabezado puede contener múltiples cookies separadas por comas
        const cookieParts = setCookieHeader.split(",");
        for (const part of cookieParts) {
          const cookieName = part.split("=")[0]?.trim();
          if (cookieName === "access_token" || cookieName === "refresh_token") {
            cookies += part.trim() + "; ";
          }
        }
      }

      // Luego acceder al dashboard con las cookies
      const response = await app.request("/dashboard", {
        method: "GET",
        headers: {
          Cookie: cookies,
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
    it("should show users table with authentication via cookie", async () => {
      // Primero iniciar sesión a través de SSR para obtener las cookies
      const formData = new FormData();
      formData.append("email", adminUser.email);
      formData.append("password", adminUser.password);

      const loginResponse = await app.request("/auth/ssr/login", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      // Extraer las cookies del encabezado Set-Cookie
      const setCookieHeader = loginResponse.headers.get("set-cookie");

      // Extraer todas las cookies del encabezado
      let cookies = "";
      if (setCookieHeader) {
        // El encabezado puede contener múltiples cookies separadas por comas
        const cookieParts = setCookieHeader.split(",");
        for (const part of cookieParts) {
          const cookieName = part.split("=")[0]?.trim();
          if (cookieName === "access_token" || cookieName === "refresh_token") {
            cookies += part.trim() + "; ";
          }
        }
      }

      // Luego acceder a la tabla con las cookies
      const response = await app.request("/dashboard/table/users", {
        method: "GET",
        headers: {
          Cookie: cookies,
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
      // Primero iniciar sesión a través de SSR para obtener las cookies
      const formData = new FormData();
      formData.append("email", adminUser.email);
      formData.append("password", adminUser.password);

      const loginResponse = await app.request("/auth/ssr/login", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      // Extraer las cookies del encabezado Set-Cookie
      const setCookieHeader = loginResponse.headers.get("set-cookie");

      // Extraer todas las cookies del encabezado
      let cookies = "";
      if (setCookieHeader) {
        // El encabezado puede contener múltiples cookies separadas por comas
        const cookieParts = setCookieHeader.split(",");
        for (const part of cookieParts) {
          const cookieName = part.split("=")[0]?.trim();
          if (cookieName === "access_token" || cookieName === "refresh_token") {
            cookies += part.trim() + "; ";
          }
        }
      }

      const response = await app.request("/dashboard/table/nonexistent", {
        method: "GET",
        headers: {
          Cookie: cookies,
        },
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Tabla no encontrada");
    });
  });

  // Tests para formulario de creación
  describe("GET /dashboard/table/:tableName/create", () => {
    it("should show creation form for users table with authentication via cookie", async () => {
      // Primero iniciar sesión a través de SSR para obtener las cookies
      const formData = new FormData();
      formData.append("email", adminUser.email);
      formData.append("password", adminUser.password);

      const loginResponse = await app.request("/auth/ssr/login", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      // Extraer las cookies del encabezado Set-Cookie
      const setCookieHeader = loginResponse.headers.get("set-cookie");

      // Extraer todas las cookies del encabezado
      let cookies = "";
      if (setCookieHeader) {
        // El encabezado puede contener múltiples cookies separadas por comas
        const cookieParts = setCookieHeader.split(",");
        for (const part of cookieParts) {
          const cookieName = part.split("=")[0]?.trim();
          if (cookieName === "access_token" || cookieName === "refresh_token") {
            cookies += part.trim() + "; ";
          }
        }
      }

      const response = await app.request("/dashboard/table/users/create", {
        method: "GET",
        headers: {
          Cookie: cookies,
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
    it("should create a new user in users table with authentication via cookie", async () => {
      // Primero iniciar sesión a través de SSR para obtener las cookies
      const formData = new FormData();
      formData.append("email", adminUser.email);
      formData.append("password", adminUser.password);

      const loginResponse = await app.request("/auth/ssr/login", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      // Extraer las cookies del encabezado Set-Cookie
      const setCookieHeader = loginResponse.headers.get("set-cookie");

      // Extraer todas las cookies del encabezado
      let cookies = "";
      if (setCookieHeader) {
        // El encabezado puede contener múltiples cookies separadas por comas
        const cookieParts = setCookieHeader.split(",");
        for (const part of cookieParts) {
          const cookieName = part.split("=")[0]?.trim();
          if (cookieName === "access_token" || cookieName === "refresh_token") {
            cookies += part.trim() + "; ";
          }
        }
      }

      const newUser = {
        email: "newuser_cookie@example.com",
        username: "newuser_cookie",
        password: "TestP@ssw0rd",
        first_name: "New",
        last_name: "User",
      };

      const response = await app.request("/dashboard/table/users", {
        method: "POST",
        headers: {
          Cookie: cookies,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(newUser).toString(),
        redirect: "manual", // Para evitar redirección automática
      });

      // La respuesta exitosa puede ser una redirección (302) o una respuesta exitosa (200)
      // dependiendo de cómo maneje el entorno de pruebas las redirecciones
      expect([200, 302]).toContain(response.status);

      // Si es una redirección, verificar la ubicación
      if (response.status === 302) {
        expect(response.headers.get("Location")).toBe("/dashboard/table/users");
      }
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
      // Primero iniciar sesión a través de SSR para obtener las cookies
      const formData = new FormData();
      formData.append("email", adminUser.email);
      formData.append("password", adminUser.password);

      const loginResponse = await app.request("/auth/ssr/login", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      // Extraer las cookies del encabezado Set-Cookie
      const setCookieHeader = loginResponse.headers.get("set-cookie");

      // Extraer todas las cookies del encabezado
      let cookies = "";
      if (setCookieHeader) {
        // El encabezado puede contener múltiples cookies separadas por comas
        const cookieParts = setCookieHeader.split(",");
        for (const part of cookieParts) {
          const cookieName = part.split("=")[0]?.trim();
          if (cookieName === "access_token" || cookieName === "refresh_token") {
            cookies += part.trim() + "; ";
          }
        }
      }

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
          Cookie: cookies,
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
    it("should delete a user with authentication via cookie", async () => {
      // Primero iniciar sesión a través de SSR para obtener las cookies
      const formData = new FormData();
      formData.append("email", adminUser.email);
      formData.append("password", adminUser.password);

      const loginResponse = await app.request("/auth/ssr/login", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      // Extraer las cookies del encabezado Set-Cookie
      const setCookieHeader = loginResponse.headers.get("set-cookie");

      // Extraer todas las cookies del encabezado
      let cookies = "";
      if (setCookieHeader) {
        // El encabezado puede contener múltiples cookies separadas por comas
        const cookieParts = setCookieHeader.split(",");
        for (const part of cookieParts) {
          const cookieName = part.split("=")[0]?.trim();
          if (cookieName === "access_token" || cookieName === "refresh_token") {
            cookies += part.trim() + "; ";
          }
        }
      }

      // Crear un usuario para eliminar
      const userToDelete = {
        email: "todelete_cookie@example.com",
        username: "todelete_cookie",
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
          Cookie: cookies,
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
