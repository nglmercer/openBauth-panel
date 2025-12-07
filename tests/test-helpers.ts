// tests/test-helpers.ts
// Helper functions for testing

import { Database } from "bun:sqlite";
import { DatabaseInitializer } from "open-bauth";
import { getOAuthSchemas } from "open-bauth";
import { JWTService } from "open-bauth";
import { AuthService } from "open-bauth";
import { PermissionService } from "open-bauth";
import { Hono } from "hono";
import { authRouter } from "../src/routers/auth";
import { restApiRouter } from "../src/routers/rest-api";

// Global counter to ensure unique IDs across tests
let testCounter = 0;

/**
 * Generate a unique ID for testing
 */
export function generateUniqueId(): string {
  testCounter++;
  return `${Date.now()}-${testCounter}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a completely fresh app instance with its own database
 */
export function createFreshApp() {
  // Create a new in-memory database
  const db = new Database(":memory:");
  
  // Initialize the database
  const dbInitializer = new DatabaseInitializer({ database: db });
  const oauthSchemas = getOAuthSchemas();
  dbInitializer.registerSchemas(oauthSchemas);
  
  // Create fresh services with consistent secret
  const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing";
  const jwtService = new JWTService(JWT_SECRET, "15m");
  const authService = new AuthService(dbInitializer, jwtService);
  const permissionService = new PermissionService(dbInitializer);
  
  // Create fresh app instance
  const app = new Hono();
  app.route("/auth/v1", authRouter);
  app.route("/rest/v1", restApiRouter);
  
  return app;
}

/**
 * Helper to create a test user and return tokens
 */
export async function createTestUser(app: any, email?: string, password: string = "password123") {
  const userEmail = email || `test-${generateUniqueId()}@example.com`;
  const username = `user-${generateUniqueId()}`;
  
  // Sign up
  const signupResponse = await app.request("/auth/v1/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: userEmail,
      password: password,
      username: username,
      first_name: "Test",
      last_name: "User",
    }),
  });
  
  if (signupResponse.status !== 201) {
    throw new Error(`Signup failed with status ${signupResponse.status}`);
  }
  
  // Login to get tokens
  const loginResponse = await app.request("/auth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "password",
      email: userEmail,
      password: password,
    }),
  });
  
  if (loginResponse.status !== 200) {
    throw new Error(`Login failed with status ${loginResponse.status}`);
  }
  
  const loginData = await loginResponse.json();
  
  return {
    email: userEmail,
    username: username,
    accessToken: loginData.access_token,
    refreshToken: loginData.refresh_token,
    user: loginData.user,
  };
}

/**
 * Helper to make authenticated requests
 */
export async function authenticatedRequest(app: any, method: string, path: string, accessToken: string, body?: any) {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
  };
  
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  
  return await app.request(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}