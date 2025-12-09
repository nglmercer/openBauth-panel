import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";
import { db } from "../../src/db";

describe("Generic Data API", () => {
    let baseUrl: string;

    beforeEach(async () => {
        // Create table BEFORE app init to ensure it's picked up if cached, though dynamic fetch should work regardless
        db.run(`CREATE TABLE IF NOT EXISTS test_items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            value INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await initializeApp();
        baseUrl = "http://localhost:3000/api/v1";
    });

    afterEach(() => {
        db.run("DROP TABLE IF EXISTS test_items");
    });

    test("should list tables including test_items", async () => {
        const userData = testUtils.generateTestUser();
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const token = signupResult.token;

        const response = await fetch(`${baseUrl}/data/tables`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.status !== 200) {
            console.log("List tables error:", await response.text());
        }
        expect(response.status).toBe(200);
        const result = await response.json() as any;
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);

        const tables = result.data.map((t: any) => t.tableName);
        console.log("Found tables:", tables);
        expect(tables).toContain("test_items");
    }, TEST_TIMEOUTS.MEDIUM);

    test("should CRUD on test_items", async () => {
        const userData = testUtils.generateTestUser();
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const token = signupResult.token;
        const headers = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };

        // Create
        const itemId = crypto.randomUUID();
        const createResponse = await fetch(`${baseUrl}/data/test_items`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                data: {
                    id: itemId,
                    name: "Test Item 1",
                    value: 100
                }
            })
        });

        if (createResponse.status !== 201) {
            console.log("Create failed:", await createResponse.text());
        }
        expect(createResponse.status).toBe(201);
        const createResult = await createResponse.json() as any;
        expect(createResult.success).toBe(true);

        // Read
        const getResponse = await fetch(`${baseUrl}/data/test_items/${itemId}`, {
            headers
        });
        expect(getResponse.status).toBe(200);
        const getResult = await getResponse.json() as any;
        expect(getResult.success).toBe(true);
        expect(getResult.data.name).toBe("Test Item 1");

        // Update
        const updateResponse = await fetch(`${baseUrl}/data/test_items/${itemId}`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
                data: {
                    name: "Updated Item",
                    value: 200
                }
            })
        });
        expect(updateResponse.status).toBe(200);
        const updateResult = await updateResponse.json() as any;
        expect(updateResult.success).toBe(true);
        expect(updateResult.data.name).toBe("Updated Item");

        // Delete
        const deleteResponse = await fetch(`${baseUrl}/data/test_items/${itemId}`, {
            method: "DELETE",
            headers
        });
        expect(deleteResponse.status).toBe(200);

        // Verify deletion
        const verifyResponse = await fetch(`${baseUrl}/data/test_items/${itemId}`, {
            headers
        });
        expect(verifyResponse.status).toBe(404);

    }, TEST_TIMEOUTS.MEDIUM);

});
