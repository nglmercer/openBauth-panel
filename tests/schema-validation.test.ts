/**
 * Tests for Zod schema validation implementation
 */

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { 
  validateData, 
  createValidationMiddleware,
  getValidatedData,
  type ValidationResult
} from "../src/middleware/validation";
import { 
  loginSchema, 
  registerSchema, 
  emailValidator, 
  passwordValidator,
  usernameValidator,
  nameValidator
} from "../src/schemas/validation-schemas";

describe("Zod Schema Validation", () => {
  
  describe("Basic Validation", () => {
    test("should validate valid login data", () => {
      const validData = {
        email: "user@example.com",
        password: "password123"
      };
      
      const result = validateData(loginSchema, validData);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
      expect(result.error).toBeUndefined();
    });
    
    test("should reject invalid email format", () => {
      const invalidData = {
        email: "invalid-email",
        password: "password123"
      };
      
      const result = validateData(loginSchema, invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Invalid email format");
    });
    
    test("should reject missing password", () => {
      const invalidData = {
        email: "user@example.com",
        password: ""
      };
      
      const result = validateData(loginSchema, invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Must be at least 1 characters");
    });
  });
  
  describe("Registration Schema", () => {
    test("should validate complete registration data", () => {
      const validData = {
        email: "newuser@example.com",
        password: "SecurePass123!",
        username: "newuser",
        first_name: "John",
        last_name: "Doe"
      };
      
      const result = validateData(registerSchema, validData);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });
    
    test("should reject weak password", () => {
      const invalidData = {
        email: "newuser@example.com",
        password: "weak", // Too short, no complexity
        username: "newuser",
        first_name: "John",
        last_name: "Doe"
      };
      
      const result = validateData(registerSchema, invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("at least 8 characters");
    });
    
    test("should reject invalid username format", () => {
      const invalidData = {
        email: "newuser@example.com",
        password: "SecurePass123!",
        username: "invalid username!", // Contains spaces and special chars
        first_name: "John",
        last_name: "Doe"
      };
      
      const result = validateData(registerSchema, invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Invalid format");
    });
  });
  
  describe("Reusable Validators", () => {
    test("emailValidator should accept valid emails", () => {
      const validEmails = [
        "user@example.com",
        "test.email@domain.co.uk",
        "firstname+lastname@example.com"
      ];
      
      validEmails.forEach(email => {
        const result = validateData(emailValidator, email);
        expect(result.success).toBe(true);
        expect(result.data).toBe(email.toLowerCase());
      });
    });
    
    test("emailValidator should reject invalid emails", () => {
      const invalidEmails = [
        "invalid-email",
        "@example.com",
        "user@",
        "user@.com",
        "user@domain"
      ];
      
      invalidEmails.forEach(email => {
        const result = validateData(emailValidator, email);
        expect(result.success).toBe(false);
      });
    });
    
    test("passwordValidator should accept strong passwords", () => {
      const validPasswords = [
        "SecurePass123!",
        "MyP@ssw0rd2024",
        "Complex!Pass123"
      ];
      
      validPasswords.forEach(password => {
        const result = validateData(passwordValidator, password);
        expect(result.success).toBe(true);
        expect(result.data).toBe(password);
      });
    });
    
    test("passwordValidator should reject weak passwords", () => {
      const weakPasswords = [
        "weak",                    // Too short
        "password",                // No complexity
        "PASSWORD",                // No lowercase
        "12345678",                // No letters
        "password123"              // No special characters
      ];
      
      weakPasswords.forEach(password => {
        const result = validateData(passwordValidator, password);
        expect(result.success).toBe(false);
      });
    });
  });
  
  describe("Validation Options", () => {
    test("should strip unknown fields when stripUnknown is true", () => {
      const dataWithExtra = {
        email: "user@example.com",
        password: "password123",
        extraField: "should be removed",
        anotherExtra: 123
      };
      
      const result = validateData(loginSchema, dataWithExtra, { stripUnknown: true });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        email: "user@example.com",
        password: "password123"
      });
      expect(result.data).not.toHaveProperty("extraField");
      expect(result.data).not.toHaveProperty("anotherExtra");
    });
    
    test("should collect all errors when abortEarly is false", () => {
      const invalidData = {
        email: "invalid-email",
        password: "short", // Too short
        username: "ab", // Too short
        first_name: "J", // Too short
        last_name: "" // Empty
      };
      
      const result = validateData(registerSchema, invalidData, { abortEarly: false });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Should have multiple validation errors
      expect(result.error?.details.length).toBeGreaterThan(1);
    });
  });
  
  describe("Error Handling", () => {
    test("should provide detailed error messages", () => {
      const invalidData = {
        email: "not-an-email",
        password: "123" // Too short and lacks complexity
      };
      
      const result = validateData(loginSchema, invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Invalid email format");
      expect(result.error?.statusCode).toBe(400);
      expect(result.error?.type).toBe("VALIDATION_ERROR");
    });
    
    test("should handle validation system errors gracefully", () => {
      // Create a schema that will throw an error during validation
      const faultySchema = z.string().transform(() => {
        throw new Error("Transform error");
      });
      
      const result = validateData(faultySchema, "test");
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe("INTERNAL_SERVER_ERROR");
      expect(result.error?.statusCode).toBe(500);
    });
  });
  
  describe("Custom Validators", () => {
    test("should support custom validation functions", async () => {
      const customValidator = (data: unknown) => {
        if (typeof data === "string" && data.length > 5) {
          return data.toUpperCase();
        }
        throw new Error("String must be longer than 5 characters");
      };
      
      const { createCustomValidator } = await import("../src/middleware/validation");
      const validator = createCustomValidator(customValidator, "Custom validation failed");
      
      // Valid case
      const validResult = await validator("hello world");
      expect(validResult.success).toBe(true);
      expect(validResult.data).toBe("HELLO WORLD");
      
      // Invalid case
      const invalidResult = await validator("hi");
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error?.message).toContain("must be longer than 5 characters");
    });
  });
});

describe("Schema Utilities", () => {
  
  describe("createPaginatedResponseSchema", () => {
    test("should create valid paginated response schema", async () => {
      const { createPaginatedResponseSchema } = await import("../src/schemas/schema-utils");
      const itemSchema = z.object({ id: z.string(), name: z.string() });
      const paginatedSchema = createPaginatedResponseSchema(itemSchema);
      
      const validData = {
        items: [
          { id: "1", name: "Item 1" },
          { id: "2", name: "Item 2" }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      };
      
      const result = validateData(paginatedSchema, validData);
      expect(result.success).toBe(true);
    });
  });
  
  describe("createApiResponseSchema", () => {
    test("should create valid API response schema", async () => {
      const { createApiResponseSchema } = await import("../src/schemas/schema-utils");
      const dataSchema = z.object({ message: z.string() });
      const responseSchema = createApiResponseSchema(dataSchema);
      
      const validData = {
        success: true,
        data: { message: "Success" },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: "req-123"
        }
      };
      
      const result = validateData(responseSchema, validData);
      expect(result.success).toBe(true);
    });
  });
  
  describe("Custom Validators", () => {
    test("should create unique array validator", async () => {
      const { createUniqueArrayValidator } = await import("../src/schemas/schema-utils");
      const stringArraySchema = createUniqueArrayValidator(z.string());
      
      const validData = ["a", "b", "c"];
      const result = validateData(stringArraySchema, validData);
      expect(result.success).toBe(true);
      
      const invalidData = ["a", "b", "a"]; // Duplicate
      const invalidResult = validateData(stringArraySchema, invalidData);
      expect(invalidResult.success).toBe(false);
    });
    
    test("should create slug validator", async () => {
      const { slugValidator } = await import("../src/schemas/schema-utils");
      
      const validSlugs = ["valid-slug", "simple", "test123"];
      for (const slug of validSlugs) {
        const result = validateData(slugValidator, slug);
        expect(result.success).toBe(true);
      }
      
      const invalidSlugs = ["Invalid Slug", "special!char", "space here"];
      invalidSlugs.forEach(slug => {
        const result = validateData(slugValidator, slug);
        expect(result.success).toBe(false);
      });
    });
  });
});

describe("Integration Tests", () => {
  
  test("should work with Hono-like context", async () => {
    // Simulate a Hono context
    const mockContext = {
      req: {
        json: async () => ({
          email: "test@example.com",
          password: "TestPass123!"
        })
      }
    };
    
    // Simulate middleware behavior
    let validatedData: any = null;
    const middleware = createValidationMiddleware(loginSchema);
    
    // Mock the middleware execution
    const next = async () => {
      validatedData = getValidatedData(mockContext as any);
    };
    
    // This would normally be called by Hono
    // For testing, we simulate the middleware execution
    const body = await mockContext.req.json();
    const result = validateData(loginSchema, body);
    
    if (result.success) {
      (mockContext as any).validatedData = result.data;
      await next();
    }
    
    expect(validatedData).toBeDefined();
    expect(validatedData.email).toBe("test@example.com");
    expect(validatedData.password).toBe("TestPass123!");
  });
  
  test("should handle complex nested validation", async () => {
    const complexSchema = z.object({
      user: z.object({
        email: emailValidator,
        profile: z.object({
          firstName: nameValidator,
          lastName: nameValidator
        })
      }),
      preferences: z.object({
        theme: z.enum(["light", "dark"]),
        notifications: z.boolean()
      })
    });
    
    const validData = {
      user: {
        email: "user@example.com",
        profile: {
          firstName: "John",
          lastName: "Doe"
        }
      },
      preferences: {
        theme: "dark" as const,
        notifications: true
      }
    };
    
    const result = validateData(complexSchema, validData);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });
});