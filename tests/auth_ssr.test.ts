import app from "../src/index";
import { describe, expect, it, beforeAll } from "bun:test";
import { dbInitializer } from '../src/db';

const userAuth = {
    email: "ssr_user@example.com",
    password: "StrongP@ssw0rd",
    username: "ssr_user",
    first_name: "SSR",
    last_name: "User"
};

beforeAll(async () => {
    await dbInitializer.reset(dbInitializer.getSchemas());
    console.log("DB reset for SSR tests");
});

describe("auth_ssr", () => {
    it("GET /auth/ssr/login returns HTML", async () => {
        const response = await app.request("/auth/ssr/login");
        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain("<!DOCTYPE html>");
        expect(text).toContain("Iniciar Sesión");
    });

    it("POST /auth/ssr/register sets cookies", async () => {
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
                "Origin": "http://localhost", // Required by CSRF middleware
            }
        });

        expect(response.status).toBe(200); // Hono returns 200 for body(null)
        expect(response.headers.get("HX-Redirect")).toBe("/dashboard");

        // Check Cookies
        const setCookie = response.headers.get("Set-Cookie");
        expect(setCookie).toContain("access_token");
        expect(setCookie).toContain("refresh_token");
        expect(setCookie).toContain("HttpOnly");
    });

    it("POST /auth/ssr/login sets cookies", async () => {
        const formData = new FormData();
        formData.append("email", userAuth.email);
        formData.append("password", userAuth.password);

        const response = await app.request("/auth/ssr/login", {
            method: "POST",
            body: formData,
            headers: {
                "Origin": "http://localhost",
            }
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("HX-Redirect")).toBe("/dashboard");

        const setCookie = response.headers.get("Set-Cookie");
        expect(setCookie).toContain("access_token");
    });

    it("POST /auth/ssr/login with invalid credentials returns error", async () => {
        const formData = new FormData();
        formData.append("email", userAuth.email);
        formData.append("password", "WrongPassword");

        const response = await app.request("/auth/ssr/login", {
            method: "POST",
            body: formData,
            headers: {
                "Origin": "http://localhost",
            }
        });

        expect(response.status).toBe(200); // Returns HTML with error
        expect(response.headers.get("HX-Redirect")).toBeNull();

        const text = await response.text();
        // Should contain the error message
        expect(text).toContain("Invalid credentials");
        // Should contain the form again
        expect(text).toContain("<form");
    });
});
