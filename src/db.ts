import { Database } from 'bun:sqlite';
import { DatabaseInitializer } from 'open-bauth';
import { JWTService, AuthService, PermissionService, getOAuthSchemas } from 'open-bauth';

const db = new Database('./database/auth.db');
const dbInitializer = new DatabaseInitializer({ database: db });
const jwtService = new JWTService(process.env.JWT_SECRET || 'dev-secret', '7d');
const authService = new AuthService(dbInitializer, jwtService);
const permissionService = new PermissionService(dbInitializer);
const oauthSchemas = getOAuthSchemas();
dbInitializer.registerSchemas(oauthSchemas);
export { db, dbInitializer, jwtService, authService, permissionService };
