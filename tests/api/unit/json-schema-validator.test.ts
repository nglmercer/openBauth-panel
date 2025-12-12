import { describe, test, expect } from "bun:test";
import { jsonSchemaToZod, validateJsonSchema } from "../../../src/utils/json-schema-to-zod";

describe("JSON Schema to Zod Converter", () => {
    test("should convert basic JSON Schema to Zod", () => {
        const jsonSchema = {
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "number" },
                email: { type: "string", format: "email" }
            },
            required: ["name", "email"]
        };

        const zodSchema = jsonSchemaToZod(jsonSchema);
        expect(zodSchema).toBeDefined();

        // Test validation
        const validData = {
            name: "John Doe",
            age: 30,
            email: "john@example.com"
        };

        const result = zodSchema.parse(validData);
        expect(result).toEqual(validData);
    });

    test("should handle anyOf correctly", () => {
        const jsonSchema = {
            anyOf: [
                { type: "string" },
                { type: "number" }
            ]
        };

        const zodSchema = jsonSchemaToZod(jsonSchema);
        expect(zodSchema).toBeDefined();

        // Should accept string
        expect(() => zodSchema.parse("test")).not.toThrow();
        // Should accept number
        expect(() => zodSchema.parse(123)).not.toThrow();
    });

    test("should validate JSON Schema correctly", () => {
        const validSchema = {
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "number" }
            },
            required: ["name"]
        };

        const result = validateJsonSchema(validSchema);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test("should detect invalid JSON Schema", () => {
        const invalidSchema = {
            type: "invalid-type"
        };

        const result = validateJsonSchema(invalidSchema);
        console.log("result",result)
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test("should handle null properties", () => {
        const schemaWithNullProps = {
            type: "object",
            properties: null
        };

        const zodSchema = jsonSchemaToZod(schemaWithNullProps);
        expect(zodSchema).toBeDefined();
    });

    test("should handle undefined properties", () => {
        const schemaWithUndefinedProps = {
            type: "object",
            properties: undefined
        };

        const zodSchema = jsonSchemaToZod(schemaWithUndefinedProps);
        expect(zodSchema).toBeDefined();
    });
});