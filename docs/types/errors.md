# Error Types

Esta sección describe los tipos de error TypeScript utilizados en la aplicación. Los tipos se definen en `src/types/errors.ts` y se utilizan para manejar errores de forma consistente en toda la aplicación.

## AppError Interface

Define la estructura estándar de un error en la aplicación:

```typescript
interface AppError {
  message: string;
  type: AppErrorType;
  statusCode: number;
  details?: Record<string, any>;
  timestamp: Date;
  stack?: string;
}
```

**Campos:**
- `message` (string): Mensaje descriptivo del error
- `type` (AppErrorType): Tipo categorizado del error
- `statusCode` (number): Código de estado HTTP correspondiente
- `details` (optional Record<string, any>): Detalles adicionales del error
- `timestamp` (Date): Marca de tiempo cuando ocurrió el error
- `stack` (optional string): Stack trace del error (solo en desarrollo)

## AppErrorType Enum

Enumeración de tipos de error específicos de la aplicación:

```typescript
enum AppErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR = "NOT_FOUND_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  BAD_REQUEST_ERROR = "BAD_REQUEST_ERROR",
  CONFLICT_ERROR = "CONFLICT_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  SERVICE_UNAVAILABLE_ERROR = "SERVICE_UNAVAILABLE_ERROR"
}
```

## Mapeos de Error

### ERROR_STATUS_CODES

Mapeo de tipos de error a códigos de estado HTTP:

```typescript
const ERROR_STATUS_CODES: Record<AppErrorType, number> = {
  [AppErrorType.VALIDATION_ERROR]: 400,
  [AppErrorType.AUTHENTICATION_ERROR]: 401,
  [AppErrorType.AUTHORIZATION_ERROR]: 403,
  [AppErrorType.NOT_FOUND_ERROR]: 404,
  [AppErrorType.DATABASE_ERROR]: 500,
  [AppErrorType.INTERNAL_SERVER_ERROR]: 500,
  [AppErrorType.BAD_REQUEST_ERROR]: 400,
  [AppErrorType.CONFLICT_ERROR]: 409,
  [AppErrorType.RATE_LIMIT_ERROR]: 429,
  [AppErrorType.SERVICE_UNAVAILABLE_ERROR]: 503
};
```

### AUTH_ERROR_MAPPING

Mapeo de tipos de error de open-bauth a tipos de error de la aplicación:

```typescript
const AUTH_ERROR_MAPPING: Record<AuthErrorType, AppErrorType> = {
  [AuthErrorType.INVALID_CREDENTIALS]: AppErrorType.AUTHENTICATION_ERROR,
  [AuthErrorType.USER_NOT_FOUND]: AppErrorType.NOT_FOUND_ERROR,
  [AuthErrorType.USER_ALREADY_EXISTS]: AppErrorType.CONFLICT_ERROR,
  [AuthErrorType.INVALID_TOKEN]: AppErrorType.AUTHENTICATION_ERROR,
  [AuthErrorType.TOKEN_EXPIRED]: AppErrorType.AUTHENTICATION_ERROR,
  [AuthErrorType.INSUFFICIENT_PERMISSIONS]: AppErrorType.AUTHORIZATION_ERROR,
  [AuthErrorType.ACCOUNT_LOCKED]: AppErrorType.AUTHORIZATION_ERROR,
  [AuthErrorType.ACCOUNT_INACTIVE]: AppErrorType.AUTHENTICATION_ERROR,
  [AuthErrorType.WEAK_PASSWORD]: AppErrorType.VALIDATION_ERROR,
  [AuthErrorType.DATABASE_ERROR]: AppErrorType.DATABASE_ERROR,
  [AuthErrorType.VALIDATION_ERROR]: AppErrorType.VALIDATION_ERROR,
  [AuthErrorType.AUTHENTICATION_ERROR]: AppErrorType.AUTHENTICATION_ERROR,
  [AuthErrorType.AUTHORIZATION_ERROR]: AppErrorType.AUTHORIZATION_ERROR,
  [AuthErrorType.NOT_FOUND_ERROR]: AppErrorType.NOT_FOUND_ERROR,
  [AuthErrorType.RATE_LIMIT_ERROR]: AppErrorType.RATE_LIMIT_ERROR,
  [AuthErrorType.TOKEN_ERROR]: AppErrorType.AUTHENTICATION_ERROR,
  [AuthErrorType.ACCOUNT_ERROR]: AppErrorType.AUTHENTICATION_ERROR,
  [AuthErrorType.SERVER_ERROR]: AppErrorType.INTERNAL_SERVER_ERROR,
  [AuthErrorType.PERMISSION_ERROR]: AppErrorType.AUTHORIZATION_ERROR,
  [AuthErrorType.ROLE_ERROR]: AppErrorType.NOT_FOUND_ERROR
};
```

## CustomError Class

Clase para crear errores personalizados con funcionalidades adicionales:

```typescript
class CustomError extends Error {
  public readonly type: AppErrorType;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    type: AppErrorType = AppErrorType.INTERNAL_SERVER_ERROR,
    statusCode?: number,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.statusCode = statusCode || ERROR_STATUS_CODES[type];
    this.details = details;
    this.timestamp = new Date();

    // Capturar el stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Convertir a formato de respuesta JSON
  toJSON(): AppError {
    return {
      message: this.message,
      type: this.type,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }

  // Métodos estáticos para crear errores comunes
  static validation(message: string, details?: Record<string, any>): CustomError {
    return new CustomError(message, AppErrorType.VALIDATION_ERROR, 400, details);
  }

  static authentication(message: string = "Authentication required"): CustomError {
    return new CustomError(message, AppErrorType.AUTHENTICATION_ERROR, 401);
  }

  static authorization(message: string = "Insufficient permissions"): CustomError {
    return new CustomError(message, AppErrorType.AUTHORIZATION_ERROR, 403);
  }

  static notFound(message: string = "Resource not found"): CustomError {
    return new CustomError(message, AppErrorType.NOT_FOUND_ERROR, 404);
  }

  static conflict(message: string = "Resource already exists"): CustomError {
    return new CustomError(message, AppErrorType.CONFLICT_ERROR, 409);
  }

  static database(message: string = "Database error occurred"): CustomError {
    return new CustomError(message, AppErrorType.DATABASE_ERROR, 500);
  }

  static internal(message: string = "Internal server error"): CustomError {
    return new CustomError(message, AppErrorType.INTERNAL_SERVER_ERROR, 500);
  }
}
```

## Función handleError

Función para manejar errores de forma consistente:

```typescript
function handleError(error: any): AppError {
  // Si ya es un CustomError, devolverlo
  if (error instanceof CustomError) {
    return error.toJSON();
  }

  // Si es un AuthError de open-bauth, convertirlo
  if (error.type && AUTH_ERROR_MAPPING[error.type as AuthErrorType]) {
    const appErrorType = AUTH_ERROR_MAPPING[error.type as AuthErrorType];
    const statusCode = ERROR_STATUS_CODES[appErrorType];

    return {
      message: error.message || "Authentication error",
      type: appErrorType,
      statusCode,
      details: error.context,
      timestamp: new Date()
    };
  }

  // Para errores desconocidos, devolver un error interno del servidor
  return {
    message: error.message || "An unexpected error occurred",
    type: AppErrorType.INTERNAL_SERVER_ERROR,
    statusCode: 500,
    timestamp: new Date(),
    ...(process.env.NODE_ENV === "development" && { stack: error.stack })
  };
}
```

## Uso en la Aplicación

### En Routers

```typescript
// En routers/users.ts
import { CustomError } from "../types/errors";

try {
  const result = await authService.updateUser(id, data);
  if (!result) {
    throw CustomError.notFound("User not found");
  }
  return c.json({ success: true, data: result });
} catch (error) {
  const appError = handleError(error);
  return c.json(appError, appError.statusCode);
}
```

### En Middleware

```typescript
// En middleware/index.ts
import { CustomError } from "../types/errors";

if (!hasPermission) {
  throw CustomError.authorization("Insufficient permissions to access this resource");
}
```

### En ErrorHandler

```typescript
// En utils/error-handler.ts
import { handleError } from "../types/errors";

export const errorHandler = (error: any) => {
  const appError = handleError(error);
  // Loggear el error
  console.error(`[${appError.type}] ${appError.message}`, appError.details);
  
  // Devolver respuesta formateada
  return appError;
};
```

## Extensiones Futuras

Los tipos de error pueden extenderse para incluir:

1. **Errores de validación específicos**: Para tipos de validación específicos
2. **Errores de negocio**: Para errores específicos del dominio de negocio
3. **Códigos de error**: Para referencia interna y troubleshooting
4. **Contexto de error**: Información adicional sobre el contexto del error
5. **Errores de terceros**: Para errores de servicios externos

## Consideraciones

1. **Consistencia**: Todos los errores siguen el mismo formato
2. **Seguridad**: No se exponen detalles sensibles en producción
3. **Auditoría**: Los errores se registran con información suficiente para debugging
4. **Internacionalización**: Los mensajes de error pueden ser traducibles
5. **Tipado fuerte**: Los errores son tipados para facilitar su manejo