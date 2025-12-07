import { Database } from "bun:sqlite";
import { DatabaseInitializer } from "open-bauth";
import {
  JWTService,
  AuthService,
  PermissionService,
  getOAuthSchemas,
} from "open-bauth";
const dbpath = "./database/auth.db";
// Use memory database only when explicitly set, otherwise use file database
const useMemoryDB = process.env.NODE_ENV === "test" && process.env.USE_MEMORY_DB !== "false";
const db = new Database(useMemoryDB ? ":memory:" : dbpath);
const dbInitializer = new DatabaseInitializer({ database: db });

// Use a proper JWT secret and format that matches open-bauth expectations
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production";
const jwtService = new JWTService(JWT_SECRET, "15m"); // 15 minutes for access tokens
const authService = new AuthService(dbInitializer, jwtService);
const permissionService = new PermissionService(dbInitializer);
const oauthSchemas = getOAuthSchemas();
dbInitializer.registerSchemas(oauthSchemas);

export { db, dbInitializer, jwtService, authService, permissionService };
