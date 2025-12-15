import { Database } from "bun:sqlite";
import { DatabaseInitializer } from "open-bauth";
import {
  JWTServiceBun,
  //@ts-ignore
  AuthService,
  PermissionService,
  getOAuthSchemas,
} from "open-bauth";
import { ExtendedAuthService } from "./services/extended-auth";
import { verificationTokenSchema } from "./database/schema/verification-token";
import {
    extendedUserSchema,
    extendedRolesSchema,
    extendedUserRolesSchema,
    userRoles,
    newUserSchema,
    Roles
} from "./schemas/newSchemas";
import { z } from "zod";
const db = new Database(process.env['DATABASE_URL'] || ":memory:");
const dbInitializer = new DatabaseInitializer({ database: db });
const jwtService = new JWTServiceBun(process.env["JWT_SECRET"] || "dev-secret", "7d");
const authService = new ExtendedAuthService(dbInitializer, jwtService);
const permissionService = new PermissionService(dbInitializer);
const oauthSchemas = getOAuthSchemas();



dbInitializer.registerSchemas([...oauthSchemas, verificationTokenSchema, extendedUserSchema, extendedRolesSchema, extendedUserRolesSchema]);

// Export typed Zod schemas for type-safe operations
export const ZodSchemaUser = newUserSchema.toZodTyped();
export const ZodSchemaUserRoles = userRoles.toZodTyped();
export const ZodSchemaRoles = Roles.toZodTyped();

export type UserType = z.infer<typeof ZodSchemaUser.read>;
export type CreateUserType = z.infer<typeof ZodSchemaUser.create>;
export type UpdateUserType = z.infer<typeof ZodSchemaUser.update>;
export type userRolesType  = z.infer<typeof ZodSchemaUserRoles.read>;
export type CreateuserRolesType = z.infer<typeof ZodSchemaUserRoles.create>;
export type UpdateuserRolesType = z.infer<typeof ZodSchemaUserRoles.update>;
export type RolesType  = z.infer<typeof ZodSchemaRoles.read>;
export type CreateRolesType = z.infer<typeof ZodSchemaRoles.create>;
export type UpdateRolesType = z.infer<typeof ZodSchemaRoles.update>;
export { db, dbInitializer, jwtService, authService, permissionService, extendedUserSchema, newUserSchema };
