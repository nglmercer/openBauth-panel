import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";
import { db } from "../../src/db";

describe("Generic Data API - Comprehensive Tests", () => {
    let baseUrl: string;
    let server: any;
    let authToken: string;

    beforeEach(async () => {
        // Create table BEFORE app init
        db.run(`CREATE TABLE IF NOT EXISTS test_products (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      category TEXT,
      stock INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;

        // Create authenticated user and get token
        const userData = testUtils.generateTestUser();
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        authToken = signupResult.token;
    });

    afterEach(() => {
        if (server) server?.stop();
        db.run("DROP TABLE IF EXISTS test_products");
    });

    describe("GET /data/tables", () => {
        test("should list all tables", async () => {
            const response = await fetch(`${baseUrl}/data/tables`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);

            // Should include our test table
            const tableNames = result.data.map((t: any) => t.tableName);
            expect(tableNames).toContain("test_products");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should include table metadata", async () => {
            const response = await fetch(`${baseUrl}/data/tables`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const result = await response.json() as any;
            const testTable = result.data.find((t: any) => t.tableName === "test_products");

            expect(testTable).toBeDefined();
            expect(testTable.columns).toBeDefined();
            expect(Array.isArray(testTable.columns)).toBe(true);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("GET /data/:tableName/schemaInfo", () => {
        test("should return table schema", async () => {
            const response = await fetch(`${baseUrl}/data/test_products/schemaInfo`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.schema).toBeDefined();
            expect(result.schema.tableName).toBe("test_products");
            expect(result.schema.columns).toBeDefined();
            expect(Array.isArray(result.schema.columns)).toBe(true);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 404 for non-existent table", async () => {
            const response = await fetch(`${baseUrl}/data/nonexistent_table/schema`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(response.status).toBe(404);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /data/:tableName", () => {
        test("should create a new record", async () => {
            const productData = {
                data: {
                    id: crypto.randomUUID(),
                    name: "Test Product",
                    price: 99.99,
                    category: "Electronics",
                    stock: 50
                }
            };

            const response = await fetch(`${baseUrl}/data/test_products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify(productData)
            });

            expect(response.status).toBe(201);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.name).toBe("Test Product");
            expect(result.data.price).toBe(99.99);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should validate required fields", async () => {
            const productData = {
                data: {
                    id: crypto.randomUUID(),
                    price: 99.99
                    // Missing required 'name' field
                }
            };

            const response = await fetch(`${baseUrl}/data/test_products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify(productData)
            });

            expect(response.status).toBe(400);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should validate CHECK constraints", async () => {
            const productData = {
                data: {
                    id: crypto.randomUUID(),
                    name: "Test Product",
                    price: -10 // Negative price violates CHECK constraint
                }
            };

            const response = await fetch(`${baseUrl}/data/test_products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify(productData)
            });

            expect(response.status).toBe(400);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should apply default values", async () => {
            const productData = {
                data: {
                    id: crypto.randomUUID(),
                    name: "Test Product",
                    price: 99.99
                    // stock and is_active should get default values
                }
            };

            const response = await fetch(`${baseUrl}/data/test_products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify(productData)
            });

            const result = await response.json() as any;
            expect(result.data.stock).toBe(0);
            expect(result.data.is_active).toBe(1);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("GET /data/:tableName", () => {
        beforeEach(async () => {
            // Create some test data
            for (let i = 1; i <= 25; i++) {
                await fetch(`${baseUrl}/data/test_products`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        data: {
                            id: `product-${i}`,
                            name: `Product ${i}`,
                            price: i * 10,
                            category: i % 2 === 0 ? "Electronics" : "Clothing",
                            stock: i * 5
                        }
                    })
                });
            }
        });

        test("should list records with default pagination", async () => {
            const response = await fetch(`${baseUrl}/data/test_products`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data.length).toBeLessThanOrEqual(20); // Default limit
            expect(result.pagination).toBeDefined();
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(20);
            expect(result.pagination.total).toBe(25);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should support custom pagination", async () => {
            const response = await fetch(`${baseUrl}/data/test_products?page=2&limit=10`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const result = await response.json() as any;
            expect(result.pagination.page).toBe(2);
            expect(result.pagination.limit).toBe(10);
            expect(result.data.length).toBe(10);
            expect(result.pagination.hasNext).toBe(true);
            expect(result.pagination.hasPrev).toBe(true);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should support sorting", async () => {
            const response = await fetch(`${baseUrl}/data/test_products?sort=price&order=desc&limit=5`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const result = await response.json() as any;
            const prices = result.data.map((p: any) => p.price);

            // Verify descending order
            for (let i = 0; i < prices.length - 1; i++) {
                expect(prices[i]).toBeGreaterThanOrEqual(prices[i + 1]);
            }
        }, TEST_TIMEOUTS.MEDIUM);

        test("should support field selection", async () => {
            const response = await fetch(`${baseUrl}/data/test_products?fields=id,name,price&limit=5`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const result = await response.json() as any;
            const firstItem = result.data[0];

            expect(firstItem.id).toBeDefined();
            expect(firstItem.name).toBeDefined();
            expect(firstItem.price).toBeDefined();
            // Should not include other fields
            expect(firstItem.stock).toBeUndefined();
        }, TEST_TIMEOUTS.MEDIUM);

        test("should support filtering", async () => {
            const response = await fetch(`${baseUrl}/data/test_products?category=Electronics`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const result = await response.json() as any;
            expect(result.success).toBe(true);

            // All results should be Electronics
            result.data.forEach((item: any) => {
                expect(item.category).toBe("Electronics");
            });
        }, TEST_TIMEOUTS.MEDIUM);

        test("should enforce max limit", async () => {
            const response = await fetch(`${baseUrl}/data/test_products?limit=200`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const result = await response.json() as any;
            expect(result.pagination.limit).toBeLessThanOrEqual(100);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("GET /data/:tableName/:id", () => {
        test("should retrieve a single record by ID", async () => {
            const productId = crypto.randomUUID();

            // Create product
            await fetch(`${baseUrl}/data/test_products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    data: {
                        id: productId,
                        name: "Specific Product",
                        price: 199.99
                    }
                })
            });

            // Retrieve product
            const response = await fetch(`${baseUrl}/data/test_products/${productId}`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.data.id).toBe(productId);
            expect(result.data.name).toBe("Specific Product");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 404 for non-existent ID", async () => {
            const response = await fetch(`${baseUrl}/data/test_products/non-existent-id`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(response.status).toBe(404);
            const result = await response.json() as any;
            expect(result.success).toBe(false);
            expect(result.error).toContain("not found");
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("PUT /data/:tableName/:id", () => {
        test("should update a record", async () => {
            const productId = crypto.randomUUID();

            // Create product
            await fetch(`${baseUrl}/data/test_products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    data: {
                        id: productId,
                        name: "Original Product",
                        price: 99.99,
                        category: "Electronics"
                    }
                })
            });

            // Update product
            const updateResponse = await fetch(`${baseUrl}/data/test_products/${productId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    data: {
                        name: "Updated Product",
                        price: 149.99,
                        category: "Gadgets"
                    }
                })
            });

            expect(updateResponse.status).toBe(200);
            const result = await updateResponse.json() as any;
            expect(result.success).toBeTruthy();
            expect(result.data.name).toBe("Updated Product");
            expect(result.data.price).toBe(149.99);
            expect(result.data.category).toBe("Gadgets");
        }, TEST_TIMEOUTS.MEDIUM);

        test("should perform partial updates", async () => {
            const productId = crypto.randomUUID();

            // Create product
            await fetch(`${baseUrl}/data/test_products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    data: {
                        id: productId,
                        name: "Product",
                        price: 99.99,
                        category: "Electronics",
                        stock: 100
                    }
                })
            });

            // Update only price
            const updateResponse = await fetch(`${baseUrl}/data/test_products/${productId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    data: {
                        price: 79.99
                    }
                })
            });

            expect(updateResponse.status).toBe(200);
            const result = await updateResponse.json() as any;
            expect(result.data.price).toBe(79.99);
            expect(result.data.name).toBe("Product");
            expect(result.data.stock).toBe(100);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return 400 for invalid update", async () => {
            const productId = crypto.randomUUID();

            // Create product
            await fetch(`${baseUrl}/data/test_products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    data: {
                        id: productId,
                        name: "Product",
                        price: 99.99
                    }
                })
            });

            // Try to update with invalid price
            const updateResponse = await fetch(`${baseUrl}/data/test_products/${productId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    data: {
                        price: -50 // Violates CHECK constraint
                    }
                })
            });

            expect(updateResponse.status).toBe(400);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("DELETE /data/:tableName/:id", () => {
        test("should delete a record", async () => {
            const productId = crypto.randomUUID();

            // Create product
            await fetch(`${baseUrl}/data/test_products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    data: {
                        id: productId,
                        name: "Product to Delete",
                        price: 99.99
                    }
                })
            });

            // Delete product
            const deleteResponse = await fetch(`${baseUrl}/data/test_products/${productId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(deleteResponse.status).toBe(200);
            const result = await deleteResponse.json() as any;
            expect(result.success).toBe(true);
            expect(result.message).toContain("deleted");

            // Verify deletion
            const getResponse = await fetch(`${baseUrl}/data/test_products/${productId}`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(getResponse.status).toBe(404);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should return error for non-existent ID", async () => {
            const deleteResponse = await fetch(`${baseUrl}/data/test_products/non-existent-id`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(deleteResponse.status).toBe(400);
            const result = await deleteResponse.json() as any;
            expect(result.success).toBe(false);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("POST /data/:tableName/bulk", () => {
        test("should create multiple records", async () => {
            const bulkData = {
                records: [
                    { id: "bulk-1", name: "Bulk Product 1", price: 29.99 },
                    { id: "bulk-2", name: "Bulk Product 2", price: 39.99 },
                    { id: "bulk-3", name: "Bulk Product 3", price: 49.99 }
                ]
            };

            const response = await fetch(`${baseUrl}/data/test_products/bulk`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify(bulkData)
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.results.total).toBe(3);
            expect(result.results.successful).toBe(3);
            expect(result.results.failed).toBe(0);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should report failures in bulk operation", async () => {
            const bulkData = {
                records: [
                    { id: "valid-1", name: "Valid Product", price: 29.99 },
                    { id: "invalid-1", price: 39.99 }, // Missing name
                    { id: "invalid-2", name: "Invalid Price", price: -10 } // Invalid price
                ]
            };

            const response = await fetch(`${baseUrl}/data/test_products/bulk`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify(bulkData)
            });

            const result = await response.json() as any;
            expect(result.results.total).toBe(3);
            expect(result.results.successful).toBeGreaterThan(0);
            expect(result.results.failed).toBeGreaterThan(0);
            expect(result.results.errors.length).toBeGreaterThan(0);
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("GET /data/:tableName/count", () => {
        beforeEach(async () => {
            // Create test data
            for (let i = 1; i <= 15; i++) {
                await fetch(`${baseUrl}/data/test_products`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        data: {
                            id: `count-${i}`,
                            name: `Product ${i}`,
                            price: i * 10,
                            category: i % 2 === 0 ? "Electronics" : "Clothing"
                        }
                    })
                });
            }
        });

        test("should count all records", async () => {
            const response = await fetch(`${baseUrl}/data/test_products/count`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(result.count).toBe(15);
        }, TEST_TIMEOUTS.MEDIUM);

        test("should count records with filter", async () => {
            const response = await fetch(`${baseUrl}/data/test_products/count?category=Electronics`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const result = await response.json() as any;
            expect(result.count).toBe(7); // 7 even numbers from 1-15
        }, TEST_TIMEOUTS.MEDIUM);
    });

    describe("GET /data/:tableName/search", () => {
        beforeEach(async () => {
            // Create test data for searching
            const products = [
                { id: "search-1", name: "Laptop Computer", price: 999.99, category: "Electronics" },
                { id: "search-2", name: "Desktop Computer", price: 1299.99, category: "Electronics" },
                { id: "search-3", name: "Computer Mouse", price: 29.99, category: "Accessories" },
                { id: "search-4", name: "Keyboard", price: 79.99, category: "Accessories" },
                { id: "search-5", name: "Monitor", price: 299.99, category: "Electronics" }
            ];

            for (const product of products) {
                await fetch(`${baseUrl}/data/test_products`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ data: product })
                });
            }
        });

        test("should search records by field", async () => {
            const response = await fetch(`${baseUrl}/data/test_products/search?category=Electronics`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            expect(response.status).toBe(200);
            const result = await response.json() as any;
            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);

            // All results should be Electronics
            result.data.forEach((item: any) => {
                expect(item.category).toBe("Electronics");
            });
        }, TEST_TIMEOUTS.MEDIUM);

        test("should support complex search with multiple filters", async () => {
            const response = await fetch(`${baseUrl}/data/test_products/search?category=Accessories&price=${encodeURIComponent(JSON.stringify({ $lt: 50 }))}`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const result = await response.json() as any;
            expect(result.success).toBe(true);

            result.data.forEach((item: any) => {
                expect(item.category).toBe("Accessories");
                expect(item.price).toBeLessThan(50);
            });
        }, TEST_TIMEOUTS.MEDIUM);

        test("should support pagination in search", async () => {
            const response = await fetch(`${baseUrl}/data/test_products/search?limit=2&offset=1`, {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const result = await response.json() as any;
            expect(result.data.length).toBeLessThanOrEqual(2);
        }, TEST_TIMEOUTS.MEDIUM);
    });
});
