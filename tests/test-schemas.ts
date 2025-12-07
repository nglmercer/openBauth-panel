import { z, email } from "zod";
import type { TableSchema, ColumnDefinition } from "open-bauth";

// Base User Schema with age for testing
const baseUserSchema = {
  email: email("Debe ser un email válido"),
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  first_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  last_name: z.string().min(3, "El apellido debe tener al menos 3 caracteres"),
  age: z.number().int().min(0).max(150).optional(),
  role: z.string().optional(),
};

// Schema for users table with age column
export const usersTableSchema: TableSchema = {
  tableName: "users",
  columns: [
    {
      name: "id",
      type: "TEXT",
      primaryKey: true,
      defaultValue: "lower(hex(randomblob(16)))",
    },
    {
      name: "email",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "username",
      type: "TEXT",
    },
    {
      name: "password_hash",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "first_name",
      type: "TEXT",
    },
    {
      name: "last_name",
      type: "TEXT",
    },
    {
      name: "age",
      type: "INTEGER",
    },
    {
      name: "role",
      type: "TEXT",
    },
    {
      name: "created_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
    {
      name: "updated_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
    {
      name: "last_login_at",
      type: "DATETIME",
    },
    {
      name: "is_active",
      type: "BOOLEAN",
      defaultValue: "1",
    },
  ],
};

// Schema for roles table
export const rolesTableSchema: TableSchema = {
  tableName: "roles",
  columns: [
    {
      name: "id",
      type: "TEXT",
      primaryKey: true,
      defaultValue: "lower(hex(randomblob(16)))",
    },
    {
      name: "name",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "description",
      type: "TEXT",
    },
    {
      name: "created_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
    {
      name: "updated_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
  ],
};

// Schema for permissions table
export const permissionsTableSchema: TableSchema = {
  tableName: "permissions",
  columns: [
    {
      name: "id",
      type: "TEXT",
      primaryKey: true,
      defaultValue: "lower(hex(randomblob(16)))",
    },
    {
      name: "name",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "description",
      type: "TEXT",
    },
    {
      name: "created_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
    {
      name: "updated_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
  ],
};

// Schema for role_permissions table
export const rolePermissionsTableSchema: TableSchema = {
  tableName: "role_permissions",
  columns: [
    {
      name: "id",
      type: "TEXT",
      primaryKey: true,
      defaultValue: "lower(hex(randomblob(16)))",
    },
    {
      name: "role_id",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "permission_id",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "created_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
  ],
};

// Schema for user_roles table
export const userRolesTableSchema: TableSchema = {
  tableName: "user_roles",
  columns: [
    {
      name: "id",
      type: "TEXT",
      primaryKey: true,
      defaultValue: "lower(hex(randomblob(16)))",
    },
    {
      name: "user_id",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "role_id",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "created_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
  ],
};

// Schema for refresh_tokens table
export const refreshTokensTableSchema: TableSchema = {
  tableName: "refresh_tokens",
  columns: [
    {
      name: "id",
      type: "TEXT",
      primaryKey: true,
      defaultValue: "lower(hex(randomblob(16)))",
    },
    {
      name: "user_id",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "token_hash",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "expires_at",
      type: "DATETIME",
      notNull: true,
    },
    {
      name: "created_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
  ],
};

// Schema for oauth_providers table
export const oauthProvidersTableSchema: TableSchema = {
  tableName: "oauth_providers",
  columns: [
    {
      name: "id",
      type: "TEXT",
      primaryKey: true,
      defaultValue: "lower(hex(randomblob(16)))",
    },
    {
      name: "name",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "client_id",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "client_secret",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "created_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
    {
      name: "updated_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
  ],
};

// Schema for oauth_accounts table
export const oauthAccountsTableSchema: TableSchema = {
  tableName: "oauth_accounts",
  columns: [
    {
      name: "id",
      type: "TEXT",
      primaryKey: true,
      defaultValue: "lower(hex(randomblob(16)))",
    },
    {
      name: "user_id",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "provider_id",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "provider_user_id",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "email",
      type: "TEXT",
    },
    {
      name: "created_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
    {
      name: "updated_at",
      type: "DATETIME",
      defaultValue: "CURRENT_TIMESTAMP",
    },
  ],
};

// All test schemas
export const testSchemas = [
  usersTableSchema,
  rolesTableSchema,
  permissionsTableSchema,
  rolePermissionsTableSchema,
  userRolesTableSchema,
  refreshTokensTableSchema,
  oauthProvidersTableSchema,
  oauthAccountsTableSchema,
];