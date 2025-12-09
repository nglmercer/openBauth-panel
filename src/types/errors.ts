// Tipos de errores del sistema
export enum DatabaseErrorType {
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  SERVICE_UNAVAILABLE_ERROR = 'SERVICE_UNAVAILABLE_ERROR',
  BAD_REQUEST_ERROR = 'BAD_REQUEST_ERROR'
}

export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_INACTIVE = 'USER_INACTIVE',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED'
}

export interface AppError {
  message: string;
  type?: string;
  code?: string;
  details?: any;
  statusCode?: number;
}
export interface ApiError extends AppError {
  statusCode: number;
}
export interface Result<T = any> {
  success: boolean;
  data?: T;
  error?: AppError;
  errorType?: string;
}

/**
 * Clase de error personalizada para la aplicación
 */
export class CustomError extends Error {
  type: string;
  code: string | undefined;
  details: any;
  statusCode: number;

  constructor(message: string, type: string, statusCode: number, code?: string, details?: any) {
    super(message);
    this.name = 'CustomError';
    this.type = type;
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

/**
 * Maneja errores y devuelve un objeto de error estandarizado
 * @param error - Error a manejar
 * @returns Objeto de error estandarizado
 */
export function handleError(error: any): ApiError {
  // Si ya es un CustomError, devolverlo como ApiError
  if (error instanceof CustomError) {
    return {
      message: error.message,
      type: error.type,
      code: error.code!,
      details: error.details,
      statusCode: error.statusCode,
    };
  }

  // Para errores de validación
  if (error.name === 'ValidationError' || error.errors) {
    return {
      message: error.message || 'Validation failed',
      type: 'validation_error',
      code: DatabaseErrorType.VALIDATION_ERROR,
      details: error.errors || error.details,
      statusCode: 400,
    };
  }

  // Para errores de autenticación
  if (error.message?.includes('authentication') || error.message?.includes('credentials')) {
    return {
      message: error.message || 'Authentication failed',
      type: 'authentication_error',
      code: DatabaseErrorType.AUTHENTICATION_ERROR,
      details: error.details,
      statusCode: 401,
    };
  }

  // Para errores de autorización
  if (error.message?.includes('permission') || error.message?.includes('authorized')) {
    return {
      message: error.message || 'Insufficient permissions',
      type: 'authorization_error',
      code: DatabaseErrorType.AUTHORIZATION_ERROR,
      details: error.details,
      statusCode: 403,
    };
  }

  // Para errores de recurso no encontrado
  if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
    return {
      message: error.message || 'Resource not found',
      type: 'not_found_error',
      code: DatabaseErrorType.NOT_FOUND_ERROR,
      details: error.details,
      statusCode: 404,
    };
  }

  // Para errores de conflicto (duplicados, etc.)
  if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
    return {
      message: error.message || 'Resource conflict',
      type: 'conflict_error',
      code: DatabaseErrorType.CONFLICT_ERROR,
      details: error.details,
      statusCode: 409,
    };
  }

  // Para errores de base de datos
  if (error.message?.includes('database') || error.code) {
    return {
      message: error.message || 'Database error occurred',
      type: 'database_error',
      code: DatabaseErrorType.DATABASE_ERROR,
      details: error.details,
      statusCode: 500,
    };
  }

  // Para errores de límite de tasa
  if (error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
    return {
      message: error.message || 'Too many requests',
      type: 'rate_limit_error',
      code: DatabaseErrorType.RATE_LIMIT_ERROR,
      details: error.details,
      statusCode: 429,
    };
  }

  // Para errores de servicio no disponible
  if (error.message?.includes('service unavailable') || error.message?.includes('temporarily')) {
    return {
      message: error.message || 'Service temporarily unavailable',
      type: 'service_unavailable_error',
      code: DatabaseErrorType.SERVICE_UNAVAILABLE_ERROR,
      details: error.details,
      statusCode: 503,
    };
  }

  // Para errores de solicitud incorrecta
  if (error.message?.includes('bad request') || error.name === 'SyntaxError') {
    return {
      message: error.message || 'Bad request',
      type: 'bad_request_error',
      code: DatabaseErrorType.BAD_REQUEST_ERROR,
      details: error.details,
      statusCode: 400,
    };
  }

  // Error genérico por defecto
  return {
    message: error.message || 'Internal server error',
    type: 'internal_server_error',
    code: DatabaseErrorType.INTERNAL_SERVER_ERROR,
    details: error.details,
    statusCode: 500,
  };
}
