import app from "../src/index";
import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { dbInitializer } from "../src/db";

const userAuth = {
  email: "ssr_user@example.com",
  password: "StrongP@ssw0rd",
  username: "ssr_user",
  first_name: "SSR",
  last_name: "User",
};

let userId: string | undefined;
let token: string | undefined;

beforeAll(async () => {
  await dbInitializer.reset(dbInitializer.getSchemas());
  console.log("DB reset for SSR tests");
});

describe("auth_ssr", () => {
  describe("GET /auth/ssr/login", () => {
    it("returns HTML login page", async () => {
      const response = await app.request("/auth/ssr/login");
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("<!DOCTYPE html>");
      expect(text).toContain("Iniciar Sesión");
      expect(text).toContain("<form");
    });
  });

  describe("GET /auth/ssr/register", () => {
    it("returns HTML register page", async () => {
      const response = await app.request("/auth/ssr/register");
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("<!DOCTYPE html>");
      expect(text).toContain("Registrarse");
      expect(text).toContain("<form");
    });
  });

  describe("POST /auth/ssr/register", () => {
    it("sets cookies and redirects on successful registration", async () => {
      const formData = new FormData();
      formData.append("email", userAuth.email);
      formData.append("password", userAuth.password);
      formData.append("username", userAuth.username);
      formData.append("first_name", userAuth.first_name);
      formData.append("last_name", userAuth.last_name);

      const response = await app.request("/auth/ssr/register", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost", // Required by CSRF middleware
        },
      });

      expect(response.status).toBe(200); // Hono returns 200 for body(null)
      expect(response.headers.get("HX-Redirect")).toBe("/dashboard");

      // Check Cookies
      const setCookie = response.headers.get("Set-Cookie");
      expect(setCookie).toContain("access_token");
      expect(setCookie).toContain("refresh_token");
      expect(setCookie).toContain("HttpOnly");
    });

    it("returns form with errors on validation failure", async () => {
      const formData = new FormData();
      formData.append("email", "invalid-email"); // Invalid email
      formData.append("password", "123"); // Too short
      formData.append("username", "ab"); // Too short
      formData.append("first_name", "");
      formData.append("last_name", "");

      const response = await app.request("/auth/ssr/register", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      expect(response.status).toBe(400); // Validation errors return 400
      const data = (await response.json()) as { error: Error };
      if (!data) return;
      expect(data.error).toBeDefined();
      // Check that error contains validation information
      expect(data.error.message).toContain("Invalid email address");
      expect(data.error.message).toContain("Too small");
    });

    it("handles duplicate emails", async () => {
      // First registration
      const formData = new FormData();
      formData.append("email", "duplicate@example.com");
      formData.append("password", userAuth.password);
      formData.append("username", "duplicate");
      formData.append("first_name", "Duplicate");
      formData.append("last_name", "User");

      const firstResponse = await app.request("/auth/ssr/register", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      expect(firstResponse.status).toBe(200);

      // Second registration with same email
      const secondResponse = await app.request("/auth/ssr/register", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      expect(secondResponse.status).toBe(200); // Register endpoint returns 200 for HTML response
      const text = await secondResponse.text();
      // Check for the error message that appears in the form
      expect(text).toContain("A user with this email already exists");
      // Should contain the form again
      expect(text).toContain("<form");
    });
  });

  describe("POST /auth/ssr/login", () => {
    it("sets cookies and redirects on successful login", async () => {
      // First register a user to login
      const formData = new FormData();
      formData.append("email", userAuth.email);
      formData.append("password", userAuth.password);
      formData.append("username", userAuth.username);
      formData.append("first_name", userAuth.first_name);
      formData.append("last_name", userAuth.last_name);

      await app.request("/auth/ssr/register", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      // Now try to login
      const loginFormData = new FormData();
      loginFormData.append("email", userAuth.email);
      loginFormData.append("password", userAuth.password);

      const response = await app.request("/auth/ssr/login", {
        method: "POST",
        body: loginFormData,
        headers: {
          Origin: "http://localhost",
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("HX-Redirect")).toBe("/dashboard");

      const setCookie = response.headers.get("Set-Cookie");
      expect(setCookie).toContain("access_token");
    });

    it("returns form with errors on invalid credentials", async () => {
      const formData = new FormData();
      formData.append("email", userAuth.email);
      formData.append("password", "WrongPassword");

      const response = await app.request("/auth/ssr/login", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      expect(response.status).toBe(200); // Returns HTML with error
      expect(response.headers.get("HX-Redirect")).toBeNull();

      const text = await response.text();
      // Should contain the error message
      expect(text).toContain("Invalid credentials");
      // Should contain the form again
      expect(text).toContain("<form");
    });

    it("handles non-existent users", async () => {
      const formData = new FormData();
      formData.append("email", "nonexistent@example.com");
      formData.append("password", "SomePassword");

      const response = await app.request("/auth/ssr/login", {
        method: "POST",
        body: formData,
        headers: {
          Origin: "http://localhost",
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("HX-Redirect")).toBeNull();

      const text = await response.text();
      expect(text).toContain("Invalid credentials");
    });
  });

  describe("POST /auth/ssr/logout", () => {
    it("clears cookies and redirects to login", async () => {
      // First login to set cookies
      const loginFormData = new FormData();
      loginFormData.append("email", userAuth.email);
      loginFormData.append("password", userAuth.password);

      await app.request("/auth/ssr/login", {
        method: "POST",
        body: loginFormData,
        headers: {
          Origin: "http://localhost",
        },
      });

      // Now logout
      const response = await app.request("/auth/ssr/logout", {
        method: "POST",
        headers: {
          Origin: "http://localhost",
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("HX-Redirect")).toBe("/auth/ssr/login");

      // Check that cookies are cleared
      const setCookie = response.headers.get("Set-Cookie");
      if (setCookie) {
        // Check for cookies with Max-Age=0 (immediate expiration)
        expect(setCookie).toContain("access_token=;"); // Empty value
        expect(setCookie).toContain("refresh_token=;"); // Empty value
        expect(setCookie).toContain("Max-Age=0"); // Immediate expiration
      }
    });
  });
});
