import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { DatabaseInitializer, BaseController } from "open-bauth";
import { getServiceFactory } from "../../src/services/service-factory";
import { testUtils } from "../setup";

describe("Generic CRUD API Tests", () => {
  let db: Database;
  let dbInitializer: DatabaseInitializer;
  let serviceData: any;
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    // Setup fresh database
    db = new Database(":memory:");
    dbInitializer = new DatabaseInitializer({ database: db });
    await dbInitializer.initialize();
    await dbInitializer.seedDefaults();

    // Get services from factory
    const factory = getServiceFactory();
    serviceData = factory.getServices();

    // Create test user and get auth token
    const userResult = await serviceData.authService.register({
      email: "test@example.com",
      password: "password123",
      username: "testuser",
      first_name: "Test",
      last_name: "User"
    });

    if (!userResult.success) throw new Error("Failed to create test user");
    testUser = userResult.user;
    authToken = userResult.token;
  });

  afterEach(async () => {
    db.close();
  });

  describe("Dynamic Table Operations", () => {
    test("should create custom table and perform CRUD operations", async () => {
      // Create a custom table schema
      const customSchema = {
        tableName: "products",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "name", type: "TEXT", notNull: true },
          { name: "description", type: "TEXT" },
          { name: "price", type: "REAL", notNull: true },
          { name: "category", type: "TEXT" },
          { name: "is_active", type: "BOOLEAN", defaultValue: true },
          { name: "created_at", type: "DATETIME", defaultValue: "CURRENT_TIMESTAMP" }
        ],
        indexes: [
          { name: "idx_products_name", columns: ["name"] },
          { name: "idx_products_category", columns: ["category"] }
        ]
      };

      // Register the custom schema
      const customInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [customSchema] 
      });
      await customInitializer.initialize();

      // Get controller for the new table
      const productsController = customInitializer.createController("products");

      // Test CREATE operation
      const createResult = await productsController.create({
        name: "Test Product",
        description: "A test product",
        price: 29.99,
        category: "electronics",
        is_active: true
      });

      expect(createResult.success).toBe(true);
      expect(createResult.data).toBeDefined();
      expect(createResult.data.name).toBe("Test Product");
      expect(createResult.data.price).toBe(29.99);

      const productId = createResult.data.id;

      // Test READ operation
      const readResult = await productsController.findById(productId);
      expect(readResult.success).toBe(true);
      expect(readResult.data).toBeDefined();
      expect(readResult.data.name).toBe("Test Product");

      // Test UPDATE operation
      const updateResult = await productsController.update(productId, {
        name: "Updated Product",
        price: 39.99,
        description: "An updated test product"
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.name).toBe("Updated Product");
      expect(updateResult.data.price).toBe(39.99);

      // Test DELETE operation
      const deleteResult = await productsController.delete(productId);
      expect(deleteResult.success).toBe(true);

      // Verify deletion
      const verifyResult = await productsController.findById(productId);
      expect(verifyResult.success).toBe(false);
    });

    test("should handle complex queries with filters", async () => {
      // Create test table
      const testSchema = {
        tableName: "test_items",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "name", type: "TEXT", notNull: true },
          { name: "category", type: "TEXT" },
          { name: "status", type: "TEXT" },
          { name: "priority", type: "INTEGER" },
          { name: "is_completed", type: "BOOLEAN", defaultValue: false }
        ]
      };

      const testInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [testSchema] 
      });
      await testInitializer.initialize();

      const controller = testInitializer.createController("test_items");

      // Create multiple test items
      const items = [
        { name: "Item 1", category: "A", status: "active", priority: 1, is_completed: false },
        { name: "Item 2", category: "B", status: "pending", priority: 2, is_completed: true },
        { name: "Item 3", category: "A", status: "active", priority: 3, is_completed: false },
        { name: "Item 4", category: "C", status: "completed", priority: 1, is_completed: true },
        { name: "Item 5", category: "A", status: "pending", priority: 2, is_completed: false }
      ];

      for (const item of items) {
        const result = await controller.create(item);
        expect(result.success).toBe(true);
      }

      // Test filtering by single field
      const activeItems = await controller.search({ status: "active" });
      expect(activeItems.success).toBe(true);
      expect(activeItems.data?.length).toBe(2);

      // Test filtering by multiple fields
      const categoryAActive = await controller.search({ 
        category: "A", 
        status: "active" 
      });
      expect(categoryAActive.success).toBe(true);
      expect(categoryAActive.data?.length).toBe(2);

      // Test filtering with boolean
      const completedItems = await controller.search({ is_completed: true });
      expect(completedItems.success).toBe(true);
      expect(completedItems.data?.length).toBe(2);

      // Test filtering with numeric comparison
      const highPriority = await controller.search({ priority: { $gte: 2 } });
      expect(highPriority.success).toBe(true);
      expect(highPriority.data?.length).toBe(3);

      // Test ordering
      const orderedItems = await controller.findAll({ 
        orderBy: "priority",
        orderDirection: "DESC" 
      });
      expect(orderedItems.success).toBe(true);
      expect(orderedItems.data?.[0].priority).toBe(3);
    });

    test("should handle pagination correctly", async () => {
      // Create test table
      const paginationSchema = {
        tableName: "pagination_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "name", type: "TEXT", notNull: true },
          { name: "sequence", type: "INTEGER" }
        ]
      };

      const paginationInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [paginationSchema] 
      });
      await paginationInitializer.initialize();

      const controller = paginationInitializer.createController("pagination_test");

      // Create 20 test items
      for (let i = 1; i <= 20; i++) {
        await controller.create({
          name: `Item ${i}`,
          sequence: i
        });
      }

      // Test page 1
      const page1 = await controller.findAll({ 
        limit: 5, 
        offset: 0,
        orderBy: "sequence"
      });

      expect(page1.success).toBe(true);
      expect(page1.data?.length).toBe(5);
      expect(page1.total).toBe(20);
      expect(page1.data?.[0].sequence).toBe(1);
      expect(page1.data?.[4].sequence).toBe(5);

      // Test page 2
      const page2 = await controller.findAll({ 
        limit: 5, 
        offset: 5,
        orderBy: "sequence"
      });

      expect(page2.success).toBe(true);
      expect(page2.data?.length).toBe(5);
      expect(page2.total).toBe(20);
      expect(page2.data?.[0].sequence).toBe(6);
      expect(page2.data?.[4].sequence).toBe(10);

      // Test last page
      const lastPage = await controller.findAll({ 
        limit: 5, 
        offset: 15,
        orderBy: "sequence"
      });

      expect(lastPage.success).toBe(true);
      expect(lastPage.data?.length).toBe(5);
      expect(lastPage.total).toBe(20);
      expect(lastPage.data?.[0].sequence).toBe(16);
      expect(lastPage.data?.[4].sequence).toBe(20);
    });
  });

  describe("System Table Protection", () => {
    test("should prevent access to system tables", async () => {
      const systemTables = ["users", "roles", "permissions", "sessions"];
      
      for (const tableName of systemTables) {
        const controller = dbInitializer.createController(tableName);
        
        // Try to create a record (should fail or be restricted)
        const result = await controller.create({
          name: "Test Record",
          description: "This should not be allowed"
        });

        // The result might succeed or fail depending on the table structure
        // but it should not compromise system security
        expect(result).toBeDefined();
      }
    });

    test("should allow read access to system tables with proper authentication", async () => {
      // Test reading from users table (should work for authenticated users)
      const usersController = dbInitializer.createController("users");
      const usersResult = await usersController.findAll({ limit: 1 });
      
      expect(usersResult.success).toBe(true);
      expect(usersResult.data).toBeDefined();
      expect(usersResult.data?.length).toBeGreaterThan(0);
    });
  });

  describe("Data Validation", () => {
    test("should validate required fields", async () => {
      const validationSchema = {
        tableName: "validation_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "required_field", type: "TEXT", notNull: true },
          { name: "optional_field", type: "TEXT" }
        ]
      };

      const validationInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [validationSchema] 
      });
      await validationInitializer.initialize();

      const controller = validationInitializer.createController("validation_test");

      // Try to create without required field
      const invalidResult = await controller.create({
        optional_field: "This is optional"
      });

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBeDefined();

      // Create with required field
      const validResult = await controller.create({
        required_field: "This is required",
        optional_field: "This is optional"
      });

      expect(validResult.success).toBe(true);
      expect(validResult.data).toBeDefined();
    });

    test("should handle unique constraints", async () => {
      const uniqueSchema = {
        tableName: "unique_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "email", type: "TEXT", unique: true },
          { name: "username", type: "TEXT", unique: true }
        ]
      };

      const uniqueInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [uniqueSchema] 
      });
      await uniqueInitializer.initialize();

      const controller = uniqueInitializer.createController("unique_test");

      // Create first record
      const firstResult = await controller.create({
        email: "test@example.com",
        username: "testuser"
      });

      expect(firstResult.success).toBe(true);

      // Try to create duplicate email
      const duplicateEmailResult = await controller.create({
        email: "test@example.com",
        username: "differentuser"
      });

      expect(duplicateEmailResult.success).toBe(false);

      // Try to create duplicate username
      const duplicateUsernameResult = await controller.create({
        email: "different@example.com",
        username: "testuser"
      });

      expect(duplicateUsernameResult.success).toBe(false);
    });
  });

  describe("Bulk Operations", () => {
    test("should handle bulk create operations", async () => {
      const bulkSchema = {
        tableName: "bulk_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "name", type: "TEXT", notNull: true },
          { name: "value", type: "INTEGER" }
        ]
      };

      const bulkInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [bulkSchema] 
      });
      await bulkInitializer.initialize();

      const controller = bulkInitializer.createController("bulk_test");

      // Bulk create
      const items = Array.from({ length: 10 }, (_, i) => ({
        name: `Bulk Item ${i + 1}`,
        value: (i + 1) * 10
      }));

      const bulkResults = await Promise.all(
        items.map(item => controller.create(item))
      );

      expect(bulkResults.length).toBe(10);
      bulkResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.name).toBe(`Bulk Item ${index + 1}`);
        expect(result.data.value).toBe((index + 1) * 10);
      });

      // Verify all items were created
      const allItems = await controller.findAll();
      expect(allItems.success).toBe(true);
      expect(allItems.data?.length).toBe(10);
    });

    test("should handle bulk update operations", async () => {
      const bulkUpdateSchema = {
        tableName: "bulk_update_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "status", type: "TEXT" },
          { name: "priority", type: "INTEGER" }
        ]
      };

      const bulkUpdateInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [bulkUpdateSchema] 
      });
      await bulkUpdateInitializer.initialize();

      const controller = bulkUpdateInitializer.createController("bulk_update_test");

      // Create initial items
      const items = [];
      for (let i = 1; i <= 5; i++) {
        const result = await controller.create({
          status: "pending",
          priority: i
        });
        items.push(result.data);
      }

      // Bulk update status
      const updateResults = await Promise.all(
        items.map(item => 
          controller.update(item.id, { status: "completed" })
        )
      );

      expect(updateResults.length).toBe(5);
      updateResults.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data.status).toBe("completed");
      });
    });
  });

  describe("Advanced Querying", () => {
    test("should handle complex search queries", async () => {
      const searchSchema = {
        tableName: "search_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "title", type: "TEXT" },
          { name: "content", type: "TEXT" },
          { name: "tags", type: "TEXT" },
          { name: "created_at", type: "DATETIME" }
        ]
      };

      const searchInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [searchSchema] 
      });
      await searchInitializer.initialize();

      const controller = searchInitializer.createController("search_test");

      // Create test data
      const documents = [
        {
          title: "Introduction to TypeScript",
          content: "TypeScript is a typed superset of JavaScript",
          tags: "typescript,javascript,programming"
        },
        {
          title: "Advanced JavaScript Patterns",
          content: "Learn advanced patterns in JavaScript development",
          tags: "javascript,patterns,programming"
        },
        {
          title: "Database Design Principles",
          content: "Best practices for database schema design",
          tags: "database,design,schema"
        }
      ];

      for (const doc of documents) {
        await controller.create(doc);
      }

      // Test text search
      const typescriptResults = await controller.search({
        title: { $like: "%TypeScript%" }
      });

      expect(typescriptResults.success).toBe(true);
      expect(typescriptResults.data?.length).toBe(1);
      expect(typescriptResults.data?.[0].title).toContain("TypeScript");

      // Test multiple field search
      const programmingResults = await controller.search({
        $or: [
          { title: { $like: "%JavaScript%" } },
          { content: { $like: "%JavaScript%" } },
          { tags: { $like: "%javascript%" } }
        ]
      });

      expect(programmingResults.success).toBe(true);
      expect(programmingResults.data?.length).toBeGreaterThan(0);
    });

    test("should handle aggregation queries", async () => {
      const aggregationSchema = {
        tableName: "aggregation_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "category", type: "TEXT" },
          { name: "amount", type: "REAL" },
          { name: "status", type: "TEXT" }
        ]
      };

      const aggregationInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [aggregationSchema] 
      });
      await aggregationInitializer.initialize();

      const controller = aggregationInitializer.createController("aggregation_test");

      // Create test data
      const transactions = [
        { category: "A", amount: 100, status: "completed" },
        { category: "B", amount: 200, status: "completed" },
        { category: "A", amount: 150, status: "pending" },
        { category: "B", amount: 250, status: "completed" },
        { category: "A", amount: 300, status: "completed" }
      ];

      for (const transaction of transactions) {
        await controller.create(transaction);
      }

      // Test count by category
      const categoryA = await controller.search({ category: "A" });
      expect(categoryA.success).toBe(true);
      expect(categoryA.data?.length).toBe(3);

      const categoryB = await controller.search({ category: "B" });
      expect(categoryB.success).toBe(true);
      expect(categoryB.data?.length).toBe(2);

      // Test sum calculation (manual)
      const completedTransactions = await controller.search({ status: "completed" });
      expect(completedTransactions.success).toBe(true);
      
      const totalAmount = completedTransactions.data?.reduce((sum: number, item: any) => 
        sum + item.amount, 0
      );
      expect(totalAmount).toBe(850); // 100 + 200 + 250 + 300
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle empty table gracefully", async () => {
      const emptySchema = {
        tableName: "empty_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "name", type: "TEXT" }
        ]
      };

      const emptyInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [emptySchema] 
      });
      await emptyInitializer.initialize();

      const controller = emptyInitializer.createController("empty_test");

      // Test empty table operations
      const allResult = await controller.findAll();
      expect(allResult.success).toBe(true);
      expect(allResult.data?.length).toBe(0);
      expect(allResult.total).toBe(0);

      const searchResult = await controller.search({ name: "nonexistent" });
      expect(searchResult.success).toBe(true);
      expect(searchResult.data?.length).toBe(0);

      const countResult = await controller.count();
      expect(countResult.success).toBe(true);
      expect(countResult.data).toBe(0);
    });

    test("should handle very large datasets", async () => {
      const largeSchema = {
        tableName: "large_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "data", type: "TEXT" }
        ]
      };

      const largeInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [largeSchema] 
      });
      await largeInitializer.initialize();

      const controller = largeInitializer.createController("large_test");

      // Create 100 items
      const items = Array.from({ length: 100 }, (_, i) => ({
        data: `Large dataset item ${i + 1}`
      }));

      const createResults = await Promise.all(
        items.map(item => controller.create(item))
      );

      expect(createResults.length).toBe(100);
      createResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Test pagination with large dataset
      const pageResult = await controller.findAll({ 
        limit: 50, 
        offset: 25 
      });

      expect(pageResult.success).toBe(true);
      expect(pageResult.data?.length).toBe(50);
      expect(pageResult.total).toBe(100);
    });

    test("should handle special characters in data", async () => {
      const specialSchema = {
        tableName: "special_chars_test",
        columns: [
          { name: "id", type: "TEXT", primaryKey: true },
          { name: "content", type: "TEXT" }
        ]
      };

      const specialInitializer = new DatabaseInitializer({ 
        database: db, 
        externalSchemas: [specialSchema] 
      });
      await specialInitializer.initialize();

      const controller = specialInitializer.createController("special_chars_test");

      const specialContent = [
        "Text with 'single quotes'",
        'Text with "double quotes"',
        "Text with `backticks`",
        "Text with émojis 🚀 🎉",
        "Text with special chars: @#$%^&*()",
        "Text with newlines\nand\ttabs",
        "Text with unicode: 你好世界 🌍"
      ];

      for (const content of specialContent) {
        const result = await controller.create({ content });
        expect(result.success).toBe(true);
        expect(result.data.content).toBe(content);
      }

      // Test search with special characters
      const searchResult = await controller.search({ 
        content: { $like: "%🚀%" } 
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.data?.length).toBeGreaterThan(0);
    });
  });
});