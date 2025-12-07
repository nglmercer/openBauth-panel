// tests/api/unit/query-parser.test.ts
// Unit tests for query parser functionality
import { describe, it, expect } from "bun:test";
import { PostgrestQueryParser } from "../../../src/utils/query-parser";

describe("PostgrestQueryParser Unit Tests", () => {
  describe("Constructor and basic parsing", () => {
    it("should create parser with query string", () => {
      const parser = new PostgrestQueryParser("email=eq.test@example.com");
      expect(parser).toBeDefined();
    });

    it("should parse filters from query string", () => {
      const parser = new PostgrestQueryParser("email=eq.test@example.com&age=gte.25");
      const result = parser.parseFilters();
      expect(result.email).toBeDefined();
      expect(result.age).toBeDefined();
    });
  });

  describe("parseFilters", () => {
    it("should parse equality operator (eq)", () => {
      const parser = new PostgrestQueryParser("email=eq.test@example.com");
      const result = parser.parseFilters();
      expect(result.email).toBe("test@example.com");
    });

    it("should parse not-equal operator (neq)", () => {
      const parser = new PostgrestQueryParser("status=neq.inactive");
      const result = parser.parseFilters();
      expect(result.status).toEqual({ '!=': "inactive" });
    });

    it("should parse greater-than operator (gt)", () => {
      const parser = new PostgrestQueryParser("age=gt.25");
      const result = parser.parseFilters();
      expect(result.age).toEqual({ '>': 25 });
    });

    it("should parse greater-than-or-equal operator (gte)", () => {
      const parser = new PostgrestQueryParser("age=gte.25");
      const result = parser.parseFilters();
      expect(result.age).toEqual({ '>=': 25 });
    });

    it("should parse less-than operator (lt)", () => {
      const parser = new PostgrestQueryParser("age=lt.50");
      const result = parser.parseFilters();
      expect(result.age).toEqual({ '<': 50 });
    });

    it("should parse less-than-or-equal operator (lte)", () => {
      const parser = new PostgrestQueryParser("age=lte.50");
      const result = parser.parseFilters();
      expect(result.age).toEqual({ '<=': 50 });
    });

    it("should parse like operator", () => {
      const parser = new PostgrestQueryParser("name=like.John%");
      const result = parser.parseFilters();
      expect(result.name).toEqual({ like: "John%" });
    });

    it("should parse ilike operator", () => {
      const parser = new PostgrestQueryParser("name=ilike.john%");
      const result = parser.parseFilters();
      expect(result.name).toEqual({ ilike: "john%" });
    });

    it("should parse in operator", () => {
      const parser = new PostgrestQueryParser("role=in.(admin,user,moderator)");
      const result = parser.parseFilters();
      expect(result.role).toEqual({ in: ["admin", "user", "moderator"] });
    });

    it("should parse is null operator", () => {
      const parser = new PostgrestQueryParser("deleted_at=is.null");
      const result = parser.parseFilters();
      expect(result.deleted_at).toBeNull();
    });

    it("should parse is not null operator", () => {
      const parser = new PostgrestQueryParser("email=is.not_null");
      const result = parser.parseFilters();
      expect(result.email).toEqual({ '!=': null });
    });

    it("should handle multiple filters", () => {
      const parser = new PostgrestQueryParser("age=gte.25&status=eq.active&role=in.(admin,user)");
      const result = parser.parseFilters();
      expect(result.age).toEqual({ '>=': 25 });
      expect(result.status).toBe("active");
      expect(result.role).toBeDefined();
    });

    it("should handle empty query string", () => {
      const parser = new PostgrestQueryParser("");
      const result = parser.parseFilters();
      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe("parseSelect", () => {
    it("should parse single column selection", () => {
      const parser = new PostgrestQueryParser("select=id");
      const result = parser.parseSelect();
      expect(result).toEqual(["id"]);
    });

    it("should parse multiple column selection", () => {
      const parser = new PostgrestQueryParser("select=id,email,name");
      const result = parser.parseSelect();
      expect(result).toEqual(["id", "email", "name"]);
    });

    it("should parse wildcard selection", () => {
      const parser = new PostgrestQueryParser("select=*");
      const result = parser.parseSelect();
      expect(result).toEqual(["*"]);
    });

    it("should return null when no select parameter", () => {
      const parser = new PostgrestQueryParser("");
      const result = parser.parseSelect();
      expect(result).toBeNull();
    });
  });

  describe("parseOrder", () => {
    it("should parse ascending order", () => {
      const parser = new PostgrestQueryParser("order=name.asc");
      const result = parser.parseOrder();
      expect(result).toEqual({ orderBy: "name", orderDirection: "ASC" });
    });

    it("should parse descending order", () => {
      const parser = new PostgrestQueryParser("order=created_at.desc");
      const result = parser.parseOrder();
      expect(result).toEqual({ orderBy: "created_at", orderDirection: "DESC" });
    });

    it("should default to ASC when no direction specified", () => {
      const parser = new PostgrestQueryParser("order=name");
      const result = parser.parseOrder();
      expect(result).toEqual({ orderBy: "name", orderDirection: "ASC" });
    });

    it("should return null when no order parameter", () => {
      const parser = new PostgrestQueryParser("");
      const result = parser.parseOrder();
      expect(result).toBeNull();
    });
  });

  describe("parseRange", () => {
    it("should parse limit only", () => {
      const parser = new PostgrestQueryParser("limit=10");
      const result = parser.parseRange();
      expect(result.limit).toBe(10);
      expect(result.offset).toBeUndefined();
    });

    it("should parse offset only", () => {
      const parser = new PostgrestQueryParser("offset=20");
      const result = parser.parseRange();
      expect(result.offset).toBe(20);
      expect(result.limit).toBeUndefined();
    });

    it("should parse both limit and offset", () => {
      const parser = new PostgrestQueryParser("limit=10&offset=20");
      const result = parser.parseRange();
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
    });

    it("should return empty object when no pagination parameters", () => {
      const parser = new PostgrestQueryParser("");
      const result = parser.parseRange();
      expect(result).toEqual({});
    });

    it("should handle invalid limit", () => {
      const parser = new PostgrestQueryParser("limit=invalid");
      const result = parser.parseRange();
      expect(result.limit).toBeUndefined();
    });

    it("should handle invalid offset", () => {
      const parser = new PostgrestQueryParser("offset=invalid");
      const result = parser.parseRange();
      expect(result.offset).toBeUndefined();
    });
  });

  describe("parseAll", () => {
    it("should parse complete query with all components", () => {
      const parser = new PostgrestQueryParser(
        "select=id,email,name&order=created_at.desc&limit=10&offset=20&status=eq.active&age=gte.25"
      );
      const result = parser.parseAll();
      
      expect(result.select).toEqual(["id", "email", "name"]);
      expect(result.order).toEqual({ orderBy: "created_at", orderDirection: "DESC" });
      expect(result.range.limit).toBe(10);
      expect(result.range.offset).toBe(20);
      expect(result.filters.status).toBe("active");
      expect(result.filters.age).toEqual({ '>=': 25 });
    });

    it("should handle empty query string", () => {
      const parser = new PostgrestQueryParser("");
      const result = parser.parseAll();
      
      expect(result.select).toBeNull();
      expect(result.order).toBeNull();
      expect(result.range).toEqual({});
      expect(Object.keys(result.filters).length).toBe(0);
    });
  });

  describe("Error handling", () => {
    it("should handle malformed order syntax", () => {
      const parser = new PostgrestQueryParser("order=invalid.syntax.here");
      expect(() => parser.parseOrder()).toThrow();
    });

    it("should handle SQL injection attempts in filters", () => {
      const parser = new PostgrestQueryParser("email=eq.test'; DROP TABLE users; --");
      const result = parser.parseFilters();
      expect(result.email).toBe("test'; DROP TABLE users; --");
    });

    it("should ignore special parameters in filters", () => {
      const parser = new PostgrestQueryParser("select=id&order=name&limit=10&status=eq.active");
      const result = parser.parseFilters();
      expect(result.status).toBe("active");
      expect(result.select).toBeUndefined();
      expect(result.order).toBeUndefined();
      expect(result.limit).toBeUndefined();
    });
  });
});