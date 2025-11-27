import { db, dbInitializer, jwtService, authService, permissionService } from '../src/db';
import app from "../src/index";
import { notResult } from '../src/utils/errors';
import {
    test,
    expect,
    describe,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
    it
} from "bun:test";
import type { User, AuthResult } from "open-bauth";

const userAuth = {
    email: "user@example.com",
    password: "StrongP@ssw0rd",
    username: "johndoe",
    first_name: "John",
    last_name: "Doe"
};

let userId: string | undefined;
let refreshToken: string | undefined;
let token: string | undefined;

beforeAll(async () => {
    //await dbInitializer.initialize();
    await dbInitializer.reset(dbInitializer.getSchemas());
    console.log("DB reset");
});

function assingTokens(data: AuthResult) {
    //console.log("data", data)
    if (data.user?.id) {
        userId = data.user.id;
    }
    if (data.token) {
        token = data.token;
    }
    if (data.refreshToken) {
        refreshToken = data.refreshToken;
    }
}

describe("auth", async () => {

    it("register", async () => {
        const response = await app.request("/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userAuth)
        });
        expect(response.status).toBe(201);
        const data = await response.json() as AuthResult;

        // Extract userId from token since it's not in the user object
        assingTokens(data);

        expect(userId).toBeDefined();
    });

    it("login", async () => {
        const response = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userAuth.email, password: userAuth.password })
        });
        expect(response.status).toBe(200);
        const data = await response.json() as AuthResult;
        assingTokens(data);
        expect(token).toBeDefined();
    });

    it("refresh", async () => {
        if (!refreshToken && userId) {
            // @ts-ignore
            refreshToken = await jwtService.generateRefreshToken({ userId });
        }

        const response = await app.request("/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: refreshToken || token })
        });
        expect(response.status).toBe(200);
    });

    it("me", async () => {
        const response = await app.request(`/auth/me/${userId}`, { method: "GET" });
        expect(response.status).toBe(200);
        const data = await response.json() as Partial<User>;
        expect(data.email).toBe(userAuth.email);
    });

    it("unregister", async () => {
        const response = await app.request(`/auth/unregister/${userId}`, {
            method: "DELETE",
            headers: {
                "Origin": "http://localhost"
            }
        });
        expect(response.status).toBe(200);
    });
});
