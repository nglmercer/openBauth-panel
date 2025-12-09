import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { initializeApp, app } from "../../src/index";
import { testUtils, TEST_TIMEOUTS } from "../setup";

describe("Upload API", () => {
    let baseUrl: string;
    let server: any;

    beforeEach(async () => {
        process.env['UPLOAD_DIR'] = "./tests/uploads";
        await Bun.write("./tests/uploads/.keep", ""); // Ensure dir exists

        await initializeApp();
        server = Bun.serve({
            port: 0,
            fetch: app.fetch
        });
        baseUrl = `http://localhost:${server.port}/api/v1`;
    });

    afterEach(() => {
        if (server) server.stop();
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

});
