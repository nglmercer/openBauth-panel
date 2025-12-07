import { describe, it, expect, beforeEach } from "bun:test";
import app from "../src/index";

describe("Debug Test Isolated", () => {
  
  beforeEach(() => {
    // Generate unique email for each test to avoid conflicts
    const timestamp = Date.now();
    (global as any).testEmail = `test-${timestamp}@example.com`;
  });
  
  it("GET /auth/v1/user - should return current user with valid token", async () => {
    const email = (global as any).testEmail;
    
    // Registrar usuario
    const signupResponse = await app.request("/auth/v1/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: "password123",
        username: "testuser",
        first_name: "Test",
        last_name: "User",
      }),
    });

    console.log("Signup status:", signupResponse.status);
    if (signupResponse.status !== 201) {
      const signupError = await signupResponse.json();
      console.log("Signup error:", JSON.stringify(signupError, null, 2));
    }

    // Login para obtener token
    const loginResponse = await app.request("/auth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "password",
        email: email,
        password: "password123",
      }),
    });
    const loginData = await loginResponse.json();

    console.log("Login data:", JSON.stringify(loginData, null, 2));
    console.log("Access token:", loginData.access_token);

    // Obtener usuario actual
    const response = await app.request("/auth/v1/user", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${loginData.access_token}`,
      },
    });

    console.log("User endpoint status:", response.status);
    const data = await response.json();
    console.log("User data:", JSON.stringify(data, null, 2));

    expect(response.status).toBe(200);
    expect(data.email).toBe(email);
    expect(data.username).toBe("testuser");
  });
});