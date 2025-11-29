// Exportar todos los tipos personalizados
export * from "./hono/context";
export * from "./errors";

// Re-exportar tipos comúnmente usados de open-bauth
export type {
  User,
  Role,
  Permission,
  AuthContext,
  CreateUserData,
  UpdateUserData,
  LoginData,
  RegisterData,
  AuthResult,
  JWTPayload,
} from "open-bauth";
