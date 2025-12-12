import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";

describe("Upload API", () => {
    let baseUrl: string;
    let server: any;

    beforeEach(async () => {
        process.env['UPLOAD_DIR'] = "./tests/uploads";

        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;
    });

    afterEach(() => {
        if (server) server?.stop();
    });

    test("should upload a file", async () => {
        const userData = testUtils.generateTestUser();
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const token = signupResult.token;

        const fileContent = "Hello World";

        // Let's try to upload a valid type "mocked"
        const validFile = new File([fileContent], "test.png", { type: "image/png" });
        const validFormData = new FormData();
        validFormData.append("file", validFile);

        const validResponse = await fetch(`${baseUrl}/upload`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: validFormData
        });

        if (validResponse.status !== 200) {
            console.log("Valid Upload Failed:", await validResponse.text());
        }
        expect(validResponse.status).toBe(200);
        const result = await validResponse.json() as any;
        expect(result.success).toBe(true);
        expect(result.data.url).toBeDefined();

    }, TEST_TIMEOUTS.MEDIUM);

    test("should reject unauthorized upload", async () => {
        const fileContent = "Hello World";
        const validFile = new File([fileContent], "test.png", { type: "image/png" });
        const validFormData = new FormData();
        validFormData.append("file", validFile);

        const response = await fetch(`${baseUrl}/upload`, {
            method: "POST",
            body: validFormData
        });

        expect(response.status).toBe(401);
    });

    test("should reject invalid file type", async () => {
        const userData = testUtils.generateTestUser();
        const signupResponse = await fetch(`${baseUrl}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const signupResult = await signupResponse.json() as any;
        const token = signupResult.token;

        const fileContent = "Hello World";
        // Create a file with an invalid type (e.g., text/html not in allowed list)
        const invalidFile = new File([fileContent], "test.html", { type: "text/html" });
        const formData = new FormData();
        formData.append("file", invalidFile);

        const response = await fetch(`${baseUrl}/upload`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        // Middleware returns 400 for invalid type
        expect(response.status).toBe(400);
        const result = await response.json() as any;
        expect(result.error).toContain("not allowed");
    });

});
