// tests/api/unit/database-extractor.test.ts
import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { DatabaseInitializer } from "open-bauth";
import { SQLiteSchemaExtractor } from "open-bauth";
import {
  getSchemas,
  getDefaultSchemas,
} from "../../../src/database/base-controller";
import { db, dbInitializer } from "../../../src/db";

describe("Database Schema Extractor", () => {
  let testDb: Database;
  let testDbInitializer: DatabaseInitializer;

  beforeAll(async () => {
    // Create a test database in memory
    testDb = new Database(":memory:");
    testDbInitializer = new DatabaseInitializer({ database: testDb });

    // Define a custom schema for testing
    const customSchemas = [
      {
        tableName: "products",
        columns: [
          {
            name: "id",
            type: "INTEGER",
            primaryKey: true,
            autoIncrement: true,
            notNull: true,
          },
          { name: "name", type: "TEXT", notNull: true },
          { name: "price", type: "REAL", notNull: true },
          {
            name: "in_stock",
            type: "BOOLEAN",
            notNull: true,
            defaultValue: false,
          },
          {
            name: "created_at",
            type: "DATETIME",
            notNull: false,
            defaultValue: "CURRENT_TIMESTAMP",
          },
          { name: "description", type: "TEXT", notNull: false },
        ],
      },
      {
        tableName: "categories",
        columns: [
          {
            name: "id",
            type: "INTEGER",
            primaryKey: true,
            autoIncrement: true,
            notNull: true,
          },
          { name: "name", type: "TEXT", notNull: true, unique: true },
          {
            name: "parent_id",
            type: "INTEGER",
            notNull: false,
            references: { table: "categories", column: "id" },
          },
        ],
      },
    ];

    // Register the custom schemas
    testDbInitializer.registerSchemas(customSchemas);
    await testDbInitializer.initialize();
  });

  afterAll(() => {
    // Clean up test database
    testDb.close();
  });

  describe("SQLiteSchemaExtractor", () => {
    it("should extract all table information", async () => {
      const extractor = new SQLiteSchemaExtractor(testDb);
      const allTablesInfo = await extractor.getAllTablesInfo();

      expect(allTablesInfo).toBeInstanceOf(Array);
      expect(allTablesInfo.length).toBeGreaterThan(0);

      // Check if our custom tables are in the list
      const productsTable = allTablesInfo.find(
        (table) => table.tableName === "products",
      );
      const categoriesTable = allTablesInfo.find(
        (table) => table.tableName === "categories",
      );

      expect(productsTable).toBeDefined();
      expect(categoriesTable).toBeDefined();
    });

    it("should extract column information for each table", async () => {
      const extractor = new SQLiteSchemaExtractor(testDb);
      const allTablesInfo = await extractor.getAllTablesInfo();

      // Check products table columns
      const productsTable = allTablesInfo.find(
        (table) => table.tableName === "products",
      );
      expect(productsTable).toBeDefined();

      const productColumns = productsTable?.columns || [];
      expect(productColumns.length).toBeGreaterThan(0);

      // Check for specific columns
      const idColumn = productColumns.find((col) => col.name === "id");
      const nameColumn = productColumns.find((col) => col.name === "name");
      const priceColumn = productColumns.find((col) => col.name === "price");
      const inStockColumn = productColumns.find(
        (col) => col.name === "in_stock",
      );
      const createdAtColumn = productColumns.find(
        (col) => col.name === "created_at",
      );

      expect(idColumn).toBeDefined();
      expect(idColumn?.primaryKey).toBe(true);
      expect(idColumn?.autoIncrement).toBe(true);
      expect(idColumn?.notNull).toBe(true);

      expect(nameColumn).toBeDefined();
      expect(nameColumn?.notNull).toBe(true);

      expect(priceColumn).toBeDefined();
      expect(priceColumn?.type).toBe("REAL");

      expect(inStockColumn).toBeDefined();
      expect(inStockColumn?.defaultValue).toBe(false);

      expect(createdAtColumn).toBeDefined();
      expect(createdAtColumn?.defaultValue).toBe("CURRENT_TIMESTAMP");
    });

    it("should handle foreign key relationships", async () => {
      const extractor = new SQLiteSchemaExtractor(testDb);
      const allTablesInfo = await extractor.getAllTablesInfo();

      // Check categories table for foreign key
      const categoriesTable = allTablesInfo.find(
        (table) => table.tableName === "categories",
      );
      expect(categoriesTable).toBeDefined();

      const parentColumn = categoriesTable?.columns.find(
        (col) => col.name === "parent_id",
      );
      expect(parentColumn).toBeDefined();
      expect(parentColumn?.references?.table).toBe("categories");
      expect(parentColumn?.references?.column).toBe("id");
    });
  });

  describe("getSchemas function", () => {
    it("should return schema information from the main database", async () => {
      const schemas = await getSchemas();
      expect(schemas).toBeInstanceOf(Array);
      expect(schemas.length).toBeGreaterThan(0);

      // Check if schemas have the expected structure
      schemas.forEach((schema) => {
        expect(schema.tableName).toBeDefined();
        expect(schema.columns).toBeInstanceOf(Array);
        expect(schema.columns.length).toBeGreaterThan(0);

        schema.columns.forEach((column) => {
          expect(column.name).toBeDefined();
          expect(column.type).toBeDefined();
        });
      });
    });
  });

  describe("getDefaultSchemas function", () => {
    it("should return default schema information", () => {
      const schemas = getDefaultSchemas();
      expect(schemas).toBeInstanceOf(Array);
      expect(schemas.length).toBeGreaterThan(0);

      // Check if schemas have the expected structure
      schemas.forEach((schema) => {
        expect(schema.tableName).toBeDefined();
        expect(schema.columns).toBeInstanceOf(Array);
        expect(schema.columns.length).toBeGreaterThan(0);

        schema.columns.forEach((column) => {
          expect(column.name).toBeDefined();
          expect(column.type).toBeDefined();
        });
      });
    });
  });

  describe("Database integration", () => {
    it("should work with the actual application database", async () => {
      // Test with the actual database used in the application
      const schemas = getDefaultSchemas();
      expect(schemas.length).toBeGreaterThan(0);

      // Extract schema information using the actual database
      const extractor = new SQLiteSchemaExtractor(db);
      const allTablesInfo = await extractor.getAllTablesInfo();

      // Verify that the default schemas match the extracted schemas
      expect(allTablesInfo.length).toBeGreaterThanOrEqual(schemas.length);

      // Check if each default schema exists in the extracted schemas
      for (const defaultSchema of schemas) {
        const extractedTable = allTablesInfo.find(
          (table) => table.tableName === defaultSchema.tableName,
        );
        expect(extractedTable).toBeDefined();
        expect(extractedTable?.tableName).toBe(defaultSchema.tableName);
      }
    });
  });
});
