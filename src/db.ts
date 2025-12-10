import { Database } from "bun:sqlite";
import { DatabaseInitializer } from "open-bauth";
import {
  JWTServiceBun,
  AuthService,
  PermissionService,
  getOAuthSchemas,
} from "open-bauth";

const db = new Database(process.env['DATABASE_URL'] || ":memory:");
const dbInitializer = new DatabaseInitializer({ database: db });
const jwtService = new JWTServiceBun(process.env["JWT_SECRET"] || "dev-secret", "7d");
const authService = new AuthService(dbInitializer, jwtService);
const permissionService = new PermissionService(dbInitializer);
const oauthSchemas = getOAuthSchemas();

// Register OAuth schemas and verification tokens
import { verificationTokenSchema } from "./database/schema/verification-token";
import type { TableSchema } from "open-bauth";

const extendedUserSchema: TableSchema = {
  tableName: "users",
  columns: [
    { name: "id", type: "TEXT", primaryKey: true },
    { name: "email", type: "TEXT", unique: true },
    { name: "password_hash", type: "TEXT" },
    { name: "first_name", type: "TEXT", notNull: true },
    { name: "last_name", type: "TEXT", notNull: true },
    { name: "is_active", type: "BOOLEAN", defaultValue: true },
    { name: "is_superuser", type: "BOOLEAN", defaultValue: false },
    { name: "created_at", type: "DATETIME", defaultValue: "CURRENT_TIMESTAMP" },
    { name: "updated_at", type: "DATETIME", defaultValue: "CURRENT_TIMESTAMP" },
    { name: "bio", type: "TEXT", notNull: true },
    { name: "timezone", type: "TEXT", notNull: true },
    { name: "language", type: "TEXT", notNull: true },
    { name: "avatar_url", type: "TEXT", notNull: true },
    { name: "phone_number", type: "TEXT", notNull: true }
  ]
};

dbInitializer.registerSchemas([...oauthSchemas, verificationTokenSchema, extendedUserSchema]);

export { db, dbInitializer, jwtService, authService, permissionService };
