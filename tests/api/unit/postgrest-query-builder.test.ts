// tests/api/unit/postgrest-query-builder.test.ts
// Unit tests for PostgrestQueryBuilder
import { describe, it, expect, beforeEach } from "bun:test";
import { PostgrestQueryBuilder } from "../../../client/api/PostgrestQueryBuilder";
import type { OpenBauthPanelClient } from "../../../client/api/OpenBauthPanelClient";

// Mock client for testing
class MockClient {
  async get<T>(url: string, options?: any): Promise<any> {
    return { success: true, data: [], _url: url }; // _url for testing purposes
  }
  
  async post<T>(url: string, data?: any, options?: any): Promise<any> {
    return { success: true, data: { id: "test-id", ...data }, _url: url };
  }
  
  async put<T>(url: string, data?: any, options?: any): Promise<any> {
    return { success: true, data: { id: "test-id", ...data }, _url: url };
  }
  
  async delete<T>(url: string, options?: any): Promise<any> {
    return { success: true, message: "Deleted successfully", _url: url };
  }
}

describe("PostgrestQueryBuilder Unit Tests", () => {
  let queryBuilder: PostgrestQueryBuilder;
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = new MockClient();
    queryBuilder = new PostgrestQueryBuilder("users", mockClient as any);
  });

  describe("Constructor and initialization", () => {
    it("should create query builder instance", () => {
      expect(queryBuilder).toBeDefined();
    });

    it("should initialize with default values", () => {
      expect(queryBuilder).toBeDefined();
      // Can't access private properties directly, but we can test behavior
      const query = queryBuilder.select("*");
      expect(query).toBeDefined();
    });
  });

  describe("Select operations", () => {
    it("should set select with default wildcard", () => {
      const result = queryBuilder.select();
      expect(result).toBe(queryBuilder); // Should return self for chaining
    });

    it("should set select with specific columns", () => {
      const result = queryBuilder.select("id, email, username");
      expect(result).toBe(queryBuilder);
    });

    it("should handle select with single column", () => {
      const result = queryBuilder.select("id");
      expect(result).toBe(queryBuilder);
    });
  });

  describe("Filter operations", () => {
    it("should add eq filter", () => {
      const result = queryBuilder.eq("email", "test@example.com");
      expect(result).toBe(queryBuilder);
    });

    it("should add neq filter", () => {
      const result = queryBuilder.neq("status", "inactive");
      expect(result).toBe(queryBuilder);
    });

    it("should add gt filter", () => {
      const result = queryBuilder.gt("age", 25);
      expect(result).toBe(queryBuilder);
    });

    it("should add gte filter", () => {
      const result = queryBuilder.gte("age", 18);
      expect(result).toBe(queryBuilder);
    });

    it("should add lt filter", () => {
      const result = queryBuilder.lt("age", 65);
      expect(result).toBe(queryBuilder);
    });

    it("should add lte filter", () => {
      const result = queryBuilder.lte("age", 100);
      expect(result).toBe(queryBuilder);
    });

    it("should add like filter", () => {
      const result = queryBuilder.like("name", "John%");
      expect(result).toBe(queryBuilder);
    });

    it("should add ilike filter", () => {
      const result = queryBuilder.ilike("email", "%@EXAMPLE.COM");
      expect(result).toBe(queryBuilder);
    });

    it("should add in filter", () => {
      const result = queryBuilder.in("role", ["admin", "user", "moderator"]);
      expect(result).toBe(queryBuilder);
    });

    it("should add is null filter", () => {
      const result = queryBuilder.is("deleted_at", "null");
      expect(result).toBe(queryBuilder);
    });

    it("should add is not null filter", () => {
      const result = queryBuilder.is("email", "not.null");
      expect(result).toBe(queryBuilder);
    });
  });

  describe("Ordering and pagination", () => {
    it("should add ascending order", () => {
      const result = queryBuilder.order("created_at", true);
      expect(result).toBe(queryBuilder);
    });

    it("should add descending order", () => {
      const result = queryBuilder.order("created_at", false);
      expect(result).toBe(queryBuilder);
    });

    it("should add limit", () => {
      const result = queryBuilder.limit(10);
      expect(result).toBe(queryBuilder);
    });

    it("should add offset", () => {
      const result = queryBuilder.offset(20);
      expect(result).toBe(queryBuilder);
    });

    it("should add range", () => {
      const result = queryBuilder.range(0, 9);
      expect(result).toBe(queryBuilder);
    });
  });

  describe("Data modification operations", () => {
    it("should set insert operation", () => {
      const data = { name: "John", email: "john@example.com" };
      const result = queryBuilder.insert(data);
      expect(result).toBe(queryBuilder);
    });

    it("should set update operation", () => {
      const data = { name: "Jane" };
      const result = queryBuilder.update(data);
      expect(result).toBe(queryBuilder);
    });

    it("should set delete operation", () => {
      const result = queryBuilder.delete();
      expect(result).toBe(queryBuilder);
    });
  });

  describe("Method chaining", () => {
    it("should support chaining multiple filters", () => {
      const result = queryBuilder
        .select("id, email")
        .eq("status", "active")
        .gte("age", 18)
        .like("email", "%@example.com")
        .order("created_at", false)
        .limit(10);
      
      expect(result).toBe(queryBuilder);
    });

    it("should support complex chaining", () => {
      const result = queryBuilder
        .select("id, name, email")
        .eq("role", "admin")
        .in("department", ["IT", "HR", "Finance"])
        .gte("salary", 50000)
        .order("name", true)
        .range(0, 19);
      
      expect(result).toBe(queryBuilder);
    });
  });

  describe("Query execution", () => {
    it("should execute select query with single result", async () => {
      const result = await queryBuilder
        .select("id, email")
        .eq("id", "123")
        .single();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect((result as any)._url).toContain("/rest/v1/users");
      expect((result as any)._url).toContain("id=eq.123");
    });

    it("should execute select query with multiple results", async () => {
      const result = await queryBuilder
        .select("id, email")
        .eq("status", "active")
        .multiple();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect((result as any)._url).toContain("/rest/v1/users");
      expect((result as any)._url).toContain("status=eq.active");
    });

    it("should execute insert query", async () => {
      const data = { name: "John", email: "john@example.com" };
      const result = await queryBuilder.insert(data).single();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: "test-id", ...data });
    });

    it("should execute update query", async () => {
      const data = { name: "Jane" };
      const result = await queryBuilder
        .eq("id", "123")
        .update(data)
        .single();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: "test-id", ...data });
    });

    it("should execute delete query", async () => {
      const result = await queryBuilder
        .eq("id", "123")
        .delete()
        .single();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBe("Deleted successfully");
    });
  });

  describe("Complex query scenarios", () => {
    it("should handle query with all filter types", async () => {
      const result = await queryBuilder
        .select("id, name, email, age, salary")
        .eq("status", "active")
        .neq("role", "guest")
        .gt("age", 25)
        .gte("salary", 50000)
        .lt("age", 65)
        .lte("years_experience", 20)
        .like("email", "%@company.com")
        .ilike("name", "john%")
        .in("department", ["IT", "HR"])
        .is("deleted_at", "null")
        .order("name", true)
        .limit(50)
        .offset(0)
        .single();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("should handle pagination with range", async () => {
      const result = await queryBuilder
        .select("*")
        .eq("status", "active")
        .order("created_at", false)
        .range(10, 19)
        .multiple();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid operations gracefully", async () => {
      // The query builder should handle invalid states gracefully
      const result = await queryBuilder.single();
      expect(result).toBeDefined();
    });

    it("should reset state after execution", async () => {
      await queryBuilder
        .select("id, name")
        .eq("status", "active")
        .single();
      
      // After execution, a new query should start fresh
      const result = await queryBuilder.single();
      expect(result).toBeDefined();
    });
  });

  describe("URL building", () => {
    it("should build correct URL for simple select", async () => {
      const result = await queryBuilder
        .select("id, email")
        .single();
      
      expect((result as any)._url).toContain("/rest/v1/users");
    });

    it("should build correct URL with query parameters", async () => {
      const result = await queryBuilder
        .select("id, email")
        .eq("status", "active")
        .gte("age", 18)
        .order("name", true)
        .limit(10)
        .single();
      
      expect((result as any)._url).toContain("/rest/v1/users");
      expect((result as any)._url).toContain("status=eq.active");
      expect((result as any)._url).toContain("age=gte.18");
      expect((result as any)._url).toContain("order=name.asc");
      expect((result as any)._url).toContain("limit=10");
    });
  });
});