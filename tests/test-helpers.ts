// tests/test-helpers.ts
// Helper functions for testing

import { Database } from "bun:sqlite";
import { DatabaseInitializer } from "open-bauth";
import { testSchemas } from "./test-schemas";
import { JWTService } from "open-bauth";
import { AuthService } from "open-bauth";
import { PermissionService } from "open-bauth";
import { Hono } from "hono";
import { createTestAuthRouter, createTestRestApiRouter } from "./test-routers";

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
export async function createFreshApp() {
  // Create a new in-memory database
  const testDb = new Database(":memory:");
  
  // Initialize the database
  const dbInitializer = new DatabaseInitializer({ database: testDb });
  dbInitializer.registerSchemas(testSchemas);
  
  // IMPORTANT: Initialize the database to create tables
  await dbInitializer.initialize();
  
  // Create fresh services with consistent secret
  const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing";
  const jwtService = new JWTService(JWT_SECRET, "15m");
  const authService = new AuthService(dbInitializer, jwtService);
  const permissionService = new PermissionService(dbInitializer);
  
  // Create fresh app instance
  const app = new Hono();
  
  // Create test routers that use our test database
  const testAuthRouter = createTestAuthRouter(testDb, dbInitializer, jwtService, authService, permissionService);
  const testRestApiRouter = createTestRestApiRouter(testDb, dbInitializer, authService, jwtService);
  
  // Mount the test routers
  app.route("/auth/v1", testAuthRouter);
  app.route("/rest/v1", testRestApiRouter);
  
  // Store references for potential use in tests
  (app as any).testDb = testDb;
  (app as any).testDbInitializer = dbInitializer;
  (app as any).testJwtService = jwtService;
  (app as any).testAuthService = authService;
  (app as any).testPermissionService = permissionService;
  
  return app;
}

/**
 * Helper to create a test user and return tokens
 */
export async function createTestUser(app: any, email?: string, password: string = "password123") {
  const userEmail = email || `test-${generateUniqueId()}@example.com`;
  const username = `user-${generateUniqueId()}`;
  
  try {
    // Sign up - Use app.fetch() instead of app.request()
    const signupRequest = new Request("http://localhost/auth/v1/signup", {
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
    const signupResponse = await app.fetch(signupRequest);
    
    if (signupResponse.status !== 201) {
      const errorData = await signupResponse.json();
      console.error('Signup failed:', errorData);
      
      // If it's a duplicate record error, try to login with existing user
      if (errorData.error?.message?.includes('already exists') || errorData.error?.type === 'DATABASE_ERROR') {
        console.log('User already exists, attempting to login instead...');
        
        // Try to login with existing user
        const loginRequest = new Request("http://localhost/auth/v1/token", {
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
        const loginResponse = await app.fetch(loginRequest);
        
        if (loginResponse.status === 200) {
          const loginData = await loginResponse.json();
          return {
            email: userEmail,
            username: username,
            password: password,
            accessToken: loginData.access_token || "test-token",
            refreshToken: loginData.refresh_token || "test-refresh-token",
            user: loginData.user,
            id: loginData.user?.id,
          };
        }
      }
      
      throw new Error(`Signup failed with status ${signupResponse.status}: ${JSON.stringify(errorData)}`);
    }
    
    const signupData = await signupResponse.json();
    
    // Login to get tokens - Use app.fetch() instead of app.request()
    const loginRequest = new Request("http://localhost/auth/v1/token", {
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
    const loginResponse = await app.fetch(loginRequest);
    
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    
    return {
      email: userEmail,
      username: username,
      password: password,
      accessToken: loginData.access_token || "test-token",
      refreshToken: loginData.refresh_token || "test-refresh-token",
      user: loginData.user,
      id: signupData.user?.id || loginData.user?.id,
    };
  } catch (error) {
    console.error('Error in createTestUser:', error);
    throw error;
  }
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
  
  // Use app.fetch() instead of app.request()
  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  return await app.fetch(request);
}

/**
 * Setup test database and return base URL
 */
export async function setupTestDatabase() {
  // Create a new in-memory database
  const db = new Database(":memory:");
  
  // Initialize the database
  const dbInitializer = new DatabaseInitializer({ database: db });
  dbInitializer.registerSchemas(testSchemas);
  
  // Create fresh services
  const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing";
  const jwtService = new JWTService(JWT_SECRET, "15m");
  const authService = new AuthService(dbInitializer, jwtService);
  const permissionService = new PermissionService(dbInitializer);
  
  // Create fresh app instance
  const app = new Hono();
  
  // Create test routers that use our test database
  const testAuthRouter = createTestAuthRouter(db, dbInitializer, jwtService, authService, permissionService);
  const testRestApiRouter = createTestRestApiRouter(db, dbInitializer, authService, jwtService);
  
  // Mount the test routers
  app.route("/auth/v1", testAuthRouter);
  app.route("/rest/v1", testRestApiRouter);
  
  // Create some test data
  const testUserData = [
    { email: "test@example.com", password: "password123", username: "testuser", first_name: "Test", last_name: "User", age: 30, role: "user" },
    { email: "admin@example.com", password: "password123", username: "adminuser", first_name: "Admin", last_name: "User", age: 35, role: "admin" },
    { email: "user1@example.com", password: "password123", username: "user1", first_name: "User", last_name: "One", age: 25, role: "user" },
    { email: "user2@example.com", password: "password123", username: "user2", first_name: "User", last_name: "Two", age: 28, role: "user" },
    { email: "user3@example.com", password: "password123", username: "user3", first_name: "User", last_name: "Three", age: 40, role: "user" },
  ];
  
  for (const userData of testUserData) {
    const request = new Request("http://localhost/auth/v1/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });
    const response = await app.fetch(request);
    
    if (response.status !== 201) {
      const errorData = await response.json();
      console.error("Failed to create test user:", errorData);
    }
  }
  
  return {
    baseUrl: "http://localhost",
    app,
    db,
    dbInitializer,
    jwtService,
    authService,
    permissionService,
  };
}

/**
 * Cleanup test database
 */
export async function cleanupTestDatabase() {
  // In-memory databases are automatically cleaned up when the process ends
  // This function is here for consistency and future expansion
  return Promise.resolve();
}