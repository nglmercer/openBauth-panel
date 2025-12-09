// Tipos de errores del sistema
export enum DatabaseErrorType {
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  CONNECTION_ERROR = 'CONNECTION_ERROR'
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
  type: string;
  message: string;
  code?: string;
  details?: any;
}

export interface Result<T = any> {
  success: boolean;
  data?: T;
  error?: AppError;
  errorType?: string;
}
