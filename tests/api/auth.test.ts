import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";
import { db } from "../../src/db";

describe("Authentication API", () => {
  let baseUrl: string;

  beforeEach(async () => {
    await initializeApp();
    baseUrl = "http://localhost:3000/api/v1";
  });

  afterEach(async () => {
    // server cleanup handled by app
  });

  test("should register a new user successfully", async () => {
    const userData = testUtils.generateTestUser();

    const response = await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });

    expect(response.status).toBe(201);
    const result = await response.json() as any;
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
  }, TEST_TIMEOUTS.MEDIUM);

  test("should login with valid credentials", async () => {
    const userData = testUtils.generateTestUser();
    await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userData.email, password: userData.password })
    });

    expect(loginResponse.status).toBe(200);
    const loginResult = await loginResponse.json() as any;
    expect(loginResult.success).toBe(true);
    expect(loginResult.token).toBeDefined();
  }, TEST_TIMEOUTS.MEDIUM);

  test("should handle password reset flow", async () => {
    const userData = testUtils.generateTestUser();
    const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });
    const signupResult = await signupResponse.json() as any;
    const userId = signupResult.user.id;

    // 2. Request Password Reset
    const forgotResponse = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userData.email })
    });

    expect(forgotResponse.status).toBe(200);
    const forgotResult = await forgotResponse.json() as any;
    expect(forgotResult.success).toBe(true);

    // 3. Find token in DB
    // Use raw query or controller if accessible, raw query is easier here
    // Param binding in bun:sqlite is ?, ?, ...
    const tokenQuery = db.query("SELECT * FROM verification_tokens WHERE type = 'RESET_PASSWORD' AND user_id = $userId").get({ $userId: userId }) as any;
    expect(tokenQuery).toBeDefined();
    expect(tokenQuery.token).toBeDefined();

    // 4. Reset Password
    const newPassword = "newsecurepassword123";
    const resetResponse = await fetch(`${baseUrl}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: tokenQuery.token,
        password: newPassword,
        confirmPassword: newPassword
      })
    });

    const resetResult = await resetResponse.json() as any;
    if (resetResponse.status !== 200) {
      console.log("Reset Password Failed Response:", JSON.stringify(resetResult, null, 2));
    }
    expect(resetResponse.status).toBe(200);
    expect(resetResult.success).toBe(true);
    expect(resetResult.message).toContain("successfully");

    // 5. Login with new password
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userData.email, password: newPassword })
    });

    expect(loginResponse.status).toBe(200);
    const loginResult = await loginResponse.json() as any;
    expect(loginResult.success).toBe(true);
  }, TEST_TIMEOUTS.MEDIUM);
});