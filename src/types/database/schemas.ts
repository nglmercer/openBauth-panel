import type { ColumnDefinition, TableSchema } from "open-bauth";

// Tipos para las tablas específicas del sistema
export interface UserTableRecord {
  id: string;
  email: string;
  password_hash: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
  is_active: boolean;
}

export interface RoleTableRecord {
  id: string;
  name: string;
  description?: string | null;
  is_default?: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PermissionTableRecord {
  id: string;
  name: string;
  resource?: string | null;
  action?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserRoleTableRecord {
  id: string;
  user_id: string;
  role_id: string;
  created_at?: string;
}

export interface RolePermissionTableRecord {
  id: string;
  role_id: string;
  permission_id: string;
  created_at?: string;
}

export interface SessionTableRecord {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  expires_at: string;
  last_activity?: string;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface OAuthClientTableRecord {
  id: string;
  name: string;
  client_id: string;
  client_secret_hash: string;
  redirect_uris: string;
  grant_types: string;
  scope: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthorizationCodeTableRecord {
  id: string;
  client_id: string;
  user_id: string;
  code: string;
  redirect_uri: string;
  scope: string;
  expires_at: string;
  created_at?: string;
}

export interface RefreshTokenTableRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  is_active: boolean;
  created_at?: string;
}

export interface DeviceSecretTableRecord {
  id: string;
  user_id: string;
  device_id: string;
  secret_hash: string;
  name?: string | null;
  is_active: boolean;
  created_at?: string;
  last_used_at?: string | null;
}

export interface BiometricCredentialTableRecord {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  type: string;
  name?: string | null;
  is_active: boolean;
  created_at?: string;
  last_used_at?: string | null;
}

// Tipos para la creación y actualización de registros
export type CreateUserRecord = Omit<
  UserTableRecord,
  "id" | "created_at" | "updated_at"
>;
export type UpdateUserRecord = Partial<CreateUserRecord>;

export type CreateRoleRecord = Omit<
  RoleTableRecord,
  "id" | "created_at" | "updated_at"
>;
export type UpdateRoleRecord = Partial<CreateRoleRecord>;

export type CreatePermissionRecord = Omit<
  PermissionTableRecord,
  "id" | "created_at" | "updated_at"
>;
export type UpdatePermissionRecord = Partial<CreatePermissionRecord>;

export type CreateUserRoleRecord = Omit<
  UserRoleTableRecord,
  "id" | "created_at"
>;
export type UpdateUserRoleRecord = Partial<CreateUserRoleRecord>;

export type CreateRolePermissionRecord = Omit<
  RolePermissionTableRecord,
  "id" | "created_at"
>;
export type UpdateRolePermissionRecord = Partial<CreateRolePermissionRecord>;

export type CreateSessionRecord = Omit<SessionTableRecord, "id">;
export type UpdateSessionRecord = Partial<CreateSessionRecord>;

export type CreateOAuthClientRecord = Omit<
  OAuthClientTableRecord,
  "id" | "created_at" | "updated_at"
>;
export type UpdateOAuthClientRecord = Partial<CreateOAuthClientRecord>;

export type CreateAuthorizationCodeRecord = Omit<
  AuthorizationCodeTableRecord,
  "id" | "created_at"
>;
export type UpdateAuthorizationCodeRecord =
  Partial<CreateAuthorizationCodeRecord>;

export type CreateRefreshTokenRecord = Omit<
  RefreshTokenTableRecord,
  "id" | "created_at"
>;
export type UpdateRefreshTokenRecord = Partial<CreateRefreshTokenRecord>;

export type CreateDeviceSecretRecord = Omit<
  DeviceSecretTableRecord,
  "id" | "created_at" | "last_used_at"
>;
export type UpdateDeviceSecretRecord = Partial<CreateDeviceSecretRecord>;

export type CreateBiometricCredentialRecord = Omit<
  BiometricCredentialTableRecord,
  "id" | "created_at" | "last_used_at"
>;
export type UpdateBiometricCredentialRecord =
  Partial<CreateBiometricCredentialRecord>;

// Tipos para las respuestas de la API
export interface TableApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: Record<string, any>;
  };
  meta?: {
    timestamp: string;
    total?: number;
    page?: number;
    limit?: number;
  };
}

export type UserTableApiResponse = TableApiResponse<
  UserTableRecord | UserTableRecord[]
>;
export type RoleTableApiResponse = TableApiResponse<
  RoleTableRecord | RoleTableRecord[]
>;
export type PermissionTableApiResponse = TableApiResponse<
  PermissionTableRecord | PermissionTableRecord[]
>;
export type UserRoleTableApiResponse = TableApiResponse<
  UserRoleTableRecord | UserRoleTableRecord[]
>;
export type RolePermissionTableApiResponse = TableApiResponse<
  RolePermissionTableRecord | RolePermissionTableRecord[]
>;
export type SessionTableApiResponse = TableApiResponse<
  SessionTableRecord | SessionTableRecord[]
>;
export type OAuthClientTableApiResponse = TableApiResponse<
  OAuthClientTableRecord | OAuthClientTableRecord[]
>;
export type AuthorizationCodeTableApiResponse = TableApiResponse<
  AuthorizationCodeTableRecord | AuthorizationCodeTableRecord[]
>;
export type RefreshTokenTableApiResponse = TableApiResponse<
  RefreshTokenTableRecord | RefreshTokenTableRecord[]
>;
export type DeviceSecretTableApiResponse = TableApiResponse<
  DeviceSecretTableRecord | DeviceSecretTableRecord[]
>;
export type BiometricCredentialTableApiResponse = TableApiResponse<
  BiometricCredentialTableRecord | BiometricCredentialTableRecord[]
>;

// Tipos para los esquemas de tablas
export interface TableSchemas {
  users: TableSchema;
  roles: TableSchema;
  permissions: TableSchema;
  user_roles: TableSchema;
  role_permissions: TableSchema;
  sessions: TableSchema;
  oauth_clients: TableSchema;
  authorization_codes: TableSchema;
  refresh_tokens: TableSchema;
  device_secrets: TableSchema;
  biometric_credentials: TableSchema;
}

// Tipos para los filtros de consulta
export interface UserFilters {
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  created_after?: string;
  created_before?: string;
  last_login_after?: string;
  last_login_before?: string;
}

export interface RoleFilters {
  name?: string;
  is_default?: boolean;
  is_active?: boolean;
  created_after?: string;
  created_before?: string;
}

export interface PermissionFilters {
  name?: string;
  resource?: string;
  action?: string;
  created_after?: string;
  created_before?: string;
}

export interface SessionFilters {
  user_id?: string;
  is_active?: boolean;
  created_after?: string;
  created_before?: string;
  expires_after?: string;
  expires_before?: string;
  ip_address?: string;
}

// Tipos para las relaciones entre tablas
export interface UserWithRoles extends UserTableRecord {
  roles?: RoleTableRecord[];
  permissions?: PermissionTableRecord[];
}

export interface RoleWithPermissions extends RoleTableRecord {
  permissions?: PermissionTableRecord[];
  users?: UserTableRecord[];
}

export interface PermissionWithRoles extends PermissionTableRecord {
  roles?: RoleTableRecord[];
  users?: UserTableRecord[];
}
