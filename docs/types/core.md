# Core Types

Esta sección describe los tipos TypeScript principales utilizados en la aplicación. Los tipos se definen principalmente en `src/types/index.ts` y se exportan desde allí para su uso en toda la aplicación.

## Importaciones y Re-exportaciones

El archivo `src/types/index.ts` re-exporta tipos de varias fuentes:

```typescript
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
```

## Tipos de open-bauth

### User
Representa un usuario en el sistema:

```typescript
interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password?: string;  // Solo disponible en contexto de servidor
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### UserWithoutPassword
Variante del usuario sin contraseña para respuestas públicas:

```typescript
interface UserWithoutPassword {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### Role
Representa un rol en el sistema:

```typescript
interface Role {
  id: string;
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
}
```

### Permission
Representa un permiso en el sistema:

```typescript
interface Permission {
  id: string;
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
}
```

### AuthContext
Contexto de autenticación disponible en las peticiones:

```typescript
interface AuthContext {
  user?: User;
  token?: string;
  permissions?: string[];
  isAuthenticated: boolean;
}
```

### CreateUserData
Datos para crear un nuevo usuario:

```typescript
interface CreateUserData {
  email: string;
  password: string;
  username: string;
  first_name: string;
  last_name: string;
  role?: string;
  active?: boolean;
}
```

### UpdateUserData
Datos para actualizar un usuario existente:

```typescript
interface UpdateUserData {
  email?: string;
  password?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  active?: boolean;
}
```

### LoginData
Datos para iniciar sesión:

```typescript
interface LoginData {
  email: string;
  password: string;
}
```

### RegisterData
Datos para registrar un nuevo usuario:

```typescript
interface RegisterData {
  email: string;
  password: string;
  username: string;
  first_name: string;
  last_name: string;
}
```

### AuthResult
Resultado de operaciones de autenticación:

```typescript
interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  error?: {
    type: AuthErrorType;
    message: string;
  };
}
```

### JWTPayload
Payload del token JWT:

```typescript
interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}
```

## Tipos Personalizados de la Aplicación

### AuthenticatedContext
Contexto extendido para Hono con información de autenticación:

```typescript
interface AuthenticatedContext extends Context {
  get(key: "auth"): AuthContext;
}
```

### ApiResponse
Formato estándar de respuesta de la API:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    type: AppErrorType;
  };
}
```

### TableData
Datos de una tabla de la base de datos:

```typescript
interface TableData<T = any> {
  success: boolean;
  data: T[];
  total?: number;
  limit?: number;
  offset?: number;
}
```

### TableColumn
Información de una columna de tabla:

```typescript
interface TableColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
  notNull?: boolean;
  autoIncrement?: boolean;
  defaultValue?: any;
}
```

### QueryOptions
Opciones para consultas a la base de datos:

```typescript
interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}
```

### CrudResult
Resultado de operaciones CRUD:

```typescript
interface CrudResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## Uso de Tipos en Middleware

Los tipos se utilizan extensivamente en el middleware de autenticación y autorización:

```typescript
// En middleware/index.ts
import type {
  AuthRequest,
  AuthContext,
  PermissionOptions,
  JWTService,
  AuthService,
  PermissionService,
} from "open-bauth";

import type { Context, Next } from "hono";
import type { AppError } from "../types/errors";
```

## Uso en Routers

Los routers utilizan estos tipos para tipar correctamente los datos:

```typescript
// En routers/auth.ts
import type { AuthenticatedContext, UserWithoutPassword, ApiResponse } from "../types";

// En routers/users.ts
import type {
  AuthenticatedContext,
  UserWithoutPassword,
  ApiResponse,
  CrudResult,
} from "../types";
```

## Tipos Genéricos

La aplicación utiliza tipos genéricos para proporcionar flexibilidad:

```typescript
// Respuestas de API con datos tipados
const userResponse: ApiResponse<User> = {
  success: true,
  data: user
};

// Resultados de CRUD con datos tipados
const crudResult: CrudResult<User> = {
  success: true,
  data: updatedUser
};
```

## Extensiones Futuras

Los tipos pueden extenderse para incluir:

1. **Tipos de sesión**: Para manejo de sesiones más avanzado
2. **Tipos de auditoría**: Para registro de actividades del sistema
3. **Tipos de configuración**: Para configuración de la aplicación
4. **Tipos de eventos**: Para sistema de eventos y notificaciones
5. **Tipos de internacionalización**: Para soporte multiidioma

## Consideraciones

1. **Consistencia**: Todos los tipos siguen convenciones consistentes de nomenclatura
2. **Reutilización**: Los tipos se definen una vez y se reutilizan en toda la aplicación
3. **Documentación**: Cada tipo está documentado para facilitar su comprensión
4. **Versionado**: Los cambios en los tipos deben considerarse breaking changes si afectan la API pública