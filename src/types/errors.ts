import { AuthErrorType } from "open-bauth";

// Tipos para errores específicos de la aplicación
export interface AppError {
  message: string;
  type: AppErrorType;
  statusCode: number;
  details?: Record<string, any>;
  timestamp: Date;
  stack?: string;
}

// Tipos de error personalizados
export enum AppErrorType {
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

// Mapeo de tipos de error a códigos de estado HTTP
export const ERROR_STATUS_CODES: Record<AppErrorType, number> = {
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

// Mapeo de tipos de error de auth a tipos de error de la aplicación
export const AUTH_ERROR_MAPPING: Record<AuthErrorType, AppErrorType> = {
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

// Clase para crear errores personalizados
export class CustomError extends Error {
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

  // Crear errores comunes
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

// Función para manejar errores de forma consistente
export function handleError(error: any): AppError {
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
