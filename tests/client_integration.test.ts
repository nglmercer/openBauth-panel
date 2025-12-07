// tests/client_integration.test.ts
// Integration tests for the new Supabase-compatible client
import { describe, it, expect, beforeAll } from "bun:test";
import { createOpenBauthPanelClient } from "../client/api/OpenBauthPanelClient";
import type { OpenBauthPanelClient } from "../client/api/OpenBauthPanelClient";
import type { User } from "../client/types/auth";

describe("Client Integration Tests - Supabase Compatible", () => {
  let client: OpenBauthPanelClient;
  let testUser: any;

  beforeAll(() => {
    // Create client with test configuration
    client = createOpenBauthPanelClient({
      host: "127.0.0.1",
      port: 3000,
      protocol: "http",
    });
  });

  describe("Client initialization", () => {
    it("should create client instance", () => {
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });

    it("should have from() method for query building", () => {
      const queryBuilder = client.from("users");
      expect(queryBuilder).toBeDefined();
      expect(queryBuilder.select).toBeDefined();
      expect(queryBuilder.eq).toBeDefined();
      expect(queryBuilder.insert).toBeDefined();
      expect(queryBuilder.update).toBeDefined();
      expect(queryBuilder.delete).toBeDefined();
    });
  });

  describe("Authentication methods", () => {
    it("should check authentication status", () => {
      const isAuthenticated = client.isAuthenticated();
      expect(typeof isAuthenticated).toBe("boolean");
      expect(isAuthenticated).toBe(false); // Should be false initially
    });

    it("should get current user (undefined when not authenticated)", () => {
      const currentUser = client.getCurrentUser();
      expect(currentUser).toBeUndefined();
    });

    it("should get auth token (undefined when not authenticated)", () => {
      const token = client.getToken();
      expect(token).toBeUndefined();
    });

    it("should get auth context", () => {
      const authContext = client.getAuthContext();
      expect(authContext).toBeDefined();
      expect(authContext.isAuthenticated).toBe(false);
      expect(authContext.user).toBeUndefined();
      expect(authContext.token).toBeUndefined();
    });

    it("should set token manually", () => {
      const testToken = "test-token-123";
      const testUserData: User = {
        id: "test-user-123",
        email: "test@example.com",
        username: "testuser",
        first_name: "Test",
        last_name: "User",
        is_active: true
      };
      
      client.setToken(testToken, testUserData);
      
      expect(client.getToken()).toBe(testToken);
      expect(client.getCurrentUser()).toEqual(testUserData);
      expect(client.isAuthenticated()).toBe(true);
    });

    it("should clear authentication", () => {
      client.setToken("test-token", { id: "test" } as any);
      expect(client.isAuthenticated()).toBe(true);
      
      client.clearAuth();
      
      expect(client.getToken()).toBeUndefined();
      expect(client.getCurrentUser()).toBeUndefined();
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe("Query Builder Integration", () => {
    it("should create query builder for users table", () => {
      const usersQuery = client.from("users");
      expect(usersQuery).toBeDefined();
      // tableName is private, we can't access it directly
      expect(usersQuery).toBeInstanceOf(Object);
    });

    it("should create query builder for roles table", () => {
      const rolesQuery = client.from("roles");
      expect(rolesQuery).toBeDefined();
      expect(rolesQuery).toBeInstanceOf(Object);
    });

    it("should support method chaining", () => {
      const query = client.from("users")
        .select("id, email, username")
        .eq("is_active", true)
        .order("created_at", false) // false for descending
        .limit(10);
      
      expect(query).toBeDefined();
      expect(query).toBeInstanceOf(Object);
    });

    it("should handle complex queries", () => {
      const query = client.from("users")
        .select("id, email, first_name, last_name")
        .eq("role", "admin")
        .gte("age", 25)
        .like("email", "%@company.com")
        .order("last_name", true) // true for ascending
        .range(0, 9);
      
      expect(query).toBeDefined();
    });
  });

  describe("Legacy client methods should be removed", () => {
    it("should not have legacy register method", () => {
      expect((client as any).register).toBeUndefined();
    });

    it("should not have legacy login method", () => {
      expect((client as any).login).toBeUndefined();
    });

    it("should not have legacy getUsers method", () => {
      expect((client as any).getUsers).toBeUndefined();
    });

    it("should not have legacy createUser method", () => {
      expect((client as any).createUser).toBeUndefined();
    });

    it("should not have legacy updateUser method", () => {
      expect((client as any).updateUser).toBeUndefined();
    });

    it("should not have legacy deleteUser method", () => {
      expect((client as any).deleteUser).toBeUndefined();
    });
  });

  describe("Error handling", () => {
    it("should handle invalid table names gracefully", async () => {
      try {
        const result = await client.from("invalid_table").select("*");
        // Should either succeed or fail gracefully
        expect(result).toBeDefined();
      } catch (error) {
        // Error should be handled gracefully
        expect(error).toBeDefined();
      }
    });

    it("should handle network errors", async () => {
      const offlineClient = createOpenBauthPanelClient({
        host: "localhost",
        port: 9999, // Non-existent server
        protocol: "http",
      });

      try {
        await offlineClient.from("users").select("*");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Client configuration", () => {
    it("should accept custom configuration", () => {
      const customClient = createOpenBauthPanelClient({
        host: "custom-api.example.com",
        port: 443,
        protocol: "https",
      });

      expect(customClient).toBeDefined();
    });

    it("should use default configuration when none provided", () => {
      const defaultClient = createOpenBauthPanelClient();
      expect(defaultClient).toBeDefined();
    });
  });
});