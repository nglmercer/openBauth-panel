import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshApp } from "../../test-helpers";

describe("Debug Queries Tests", () => {
  let app: any;

  beforeAll(async () => {
    app = await createFreshApp();
  });

  it("should debug basic GET request", async () => {
    const request = new Request("http://localhost/rest/v1/users");
    const response = await app.fetch(request);
    const text = await response.text();
    console.log("Response status:", response.status);
    console.log("Response text:", text);
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log("Parsed data:", data);
    } catch (e) {
      console.log("Failed to parse JSON:", e);
    }
  });

  it("should debug POST request", async () => {
    const newUser = {
      email: "debug@example.com",
      password: "password123",
      username: "debuguser",
      first_name: "Debug",
      last_name: "User",
      age: 30,
      role: "user"
    };

    const request = new Request("http://localhost/rest/v1/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newUser),
    });
    const response = await app.fetch(request);

    const text = await response.text();
    console.log("POST Response status:", response.status);
    console.log("POST Response text:", text);
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log("POST Parsed data:", data);
    } catch (e) {
      console.log("POST Failed to parse JSON:", e);
    }
  });

  it("should debug with simple query", async () => {
    const request = new Request("http://localhost/rest/v1/users?limit=10");
    const response = await app.fetch(request);
    const text = await response.text();
    console.log("Query Response status:", response.status);
    console.log("Query Response text:", text);
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log("Query Parsed data:", data);
    } catch (e) {
      console.log("Query Failed to parse JSON:", e);
    }
  });
});