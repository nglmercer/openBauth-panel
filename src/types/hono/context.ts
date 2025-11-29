import type { Context } from "hono";
import { z } from "zod";
import type { AuthContext } from "open-bauth";

// Tipos para el contexto de Hono con autenticación
export interface AuthenticatedContext extends Context {
  get: (key: "auth") => AuthContext;
}

// Tipos para el contexto de Hono sin autenticación
export interface UnauthenticatedContext extends Context {
  get: (key: "auth") => {
    user?: undefined;
    isAuthenticated: false;
    permissions: string[];
  };
}

// Tipo unificado para el contexto
export type AppContext = AuthenticatedContext | UnauthenticatedContext;

// Tipo para el handler de Hono con tipos mejorados
export type AuthenticatedHandler<T = any> = (
  c: AuthenticatedContext,
) => T | Promise<T>;
export type UnauthenticatedHandler<T = any> = (
  c: UnauthenticatedContext,
) => T | Promise<T>;
export type AppHandler<T = any> = (c: AppContext) => T | Promise<T>;

// Tipo para el validador con Zod
export type ValidatedHandler<T extends z.ZodType, R = any> = (
  c: AppContext,
  data: z.infer<T>,
) => R | Promise<R>;

// Tipo para los parámetros de ruta
export interface RouteParams {
  id?: string;
  tableName?: string;
  [key: string]: string | undefined;
}

// Tipo para las respuestas de API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?:
    | string
    | {
        message: string;
        code?: string;
        details?: Record<string, any>;
      };
  meta?: {
    timestamp?: string;
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Tipo para errores de API
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, any>;
}

// Tipo para los datos de usuario sin contraseña
export interface UserWithoutPassword {
  id: string;
  email: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
  is_active: boolean;
}

// Tipo para los resultados de operaciones CRUD
export interface CrudResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Tipo para opciones de consulta
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  search?: string;
  filters?: Record<string, any>;
}

// Tipo para los datos de tabla genéricos
export interface TableData {
  [key: string]: any;
  id?: string | number;
}

// Tipo para las columnas de tabla
export interface TableColumn {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue?: any;
  primaryKey: boolean;
  autoIncrement?: boolean;
}
