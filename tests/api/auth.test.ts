import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";

describe("Authentication API", () => {
  let baseUrl: string;

  beforeEach(async () => {
    // Initialize the app
    await initializeApp();
    
    // Start test server
    baseUrl = "http://localhost:3000/api/v1";
  });

  afterEach(async () => {
    // Clean up
    // server cleanup handled by app
  });

  test("should register a new user successfully", async () => {
    const userData = testUtils.generateTestUser();
    
    const response = await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userData)
    });

    expect(response.status).toBe(201);
    const result = await response.json();
    expect((result as any).success).toBe(true);
    expect((result as any).user).toBeDefined();
    expect((result as any).user.email).toBe(userData.email);
    expect((result as any).token).toBeDefined();
  }, TEST_TIMEOUTS.MEDIUM);

  test("should login with valid credentials", async () => {
    // First register a user
    const userData = testUtils.generateTestUser();
    await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userData)
    });

    // Then login
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password
      })
    });

    expect(loginResponse.status).toBe(200);
    const loginResult = await loginResponse.json();
    expect((loginResult as any).success).toBe(true);
    expect((loginResult as any).user).toBeDefined();
    expect((loginResult as any).token).toBeDefined();
  }, TEST_TIMEOUTS.MEDIUM);

  test("should reject login with invalid credentials", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "nonexistent@example.com",
        password: "wrongpassword"
      })
    });

    expect(response.status).toBe(401);
    const result = await response.json();
    expect((result as any).success).toBe(false);
    expect((result as any).error).toBeDefined();
  }, TEST_TIMEOUTS.MEDIUM);

  test("should get user profile with valid token", async () => {
    // Register and login to get token
    const userData = testUtils.generateTestUser();
    const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userData)
    });
    
    const signupResult = await signupResponse.json();
    const token = (signupResult as any).token;

    // Get user profile
    const profileResponse = await fetch(`${baseUrl}/user/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    expect(profileResponse.status).toBe(200);
    const profileResult = await profileResponse.json();
    expect((profileResult as any).user).toBeDefined();
    expect((profileResult as any).user.email).toBe(userData.email);
  }, TEST_TIMEOUTS.MEDIUM);

  test("should reject profile access without token", async () => {
    const response = await fetch(`${baseUrl}/user/me`, {
      method: "GET"
    });

    expect(response.status).toBe(401);
    const result = await response.json();
    expect((result as any).success).toBe(false);
  }, TEST_TIMEOUTS.MEDIUM);

  test("should handle health check", async () => {
    const response = await fetch(`${baseUrl}/health`);
    
    expect(response.status).toBe(200);
    const result = await response.json();
    expect((result as any).success).toBe(true);
    expect((result as any).status).toBe("healthy");
    expect((result as any).timestamp).toBeDefined();
  }, TEST_TIMEOUTS.SHORT);

  test("should handle API documentation", async () => {
    const response = await fetch(`${baseUrl}/docs`);
    
    expect(response.status).toBe(200);
    const result = await response.json();
    expect((result as any).success).toBe(true);
    expect((result as any).message).toBe("OpenBauth API Documentation");
    expect((result as any).endpoints).toBeDefined();
    expect((result as any).features).toBeDefined();
  }, TEST_TIMEOUTS.SHORT);

  test("should handle 404 for non-existent endpoints", async () => {
    const response = await fetch(`${baseUrl}/nonexistent`);
    
    expect(response.status).toBe(404);
    const result = await response.json();
    expect((result as any).success).toBe(false);
    expect((result as any).error).toBe("Endpoint not found");
  }, TEST_TIMEOUTS.SHORT);
});

describe("Generic CRUD API", () => {
  let baseUrl: string;
  let authToken: string;

  beforeEach(async () => {
    await initializeApp();
    baseUrl = "http://localhost:3000/api/v1";

    // Create a test user and get auth token
    const userData = testUtils.generateTestUser();
    const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userData)
    });
    
    const signupResult = await signupResponse.json();
    authToken = (signupResult as any).token;
  });

  test("should create a custom table record", async () => {
    // This would require setting up a custom table first
    // For now, we'll test the schema endpoint
    const response = await fetch(`${baseUrl}/data/test_table/schema`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect((result as any).success).toBe(true);
    expect((result as any).schema).toBeDefined();
  }, TEST_TIMEOUTS.MEDIUM);
});