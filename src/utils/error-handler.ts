import type { Context } from "hono";
import {
  AppErrorType,
  CustomError,
  handleError as handleAppError,
} from "../types/errors";
import type { ApiError } from "../types";
/**
 * Maneja errores de manera consistente y devuelve una respuesta JSON estandarizada
 * @param error - Error capturado
 * @param c - Contexto de Hono
 * @returns Respuesta JSON con el error formateado
 */
export function handleApiError(error: any, c: Context) {
  // Si ya es un CustomError, usarlo directamente
  if (error instanceof CustomError) {
    return c.json(
      {
        success: false,
        error: {
          message: error.message,
          type: error.type,
          details: error.details,
        },
      },
      error.statusCode,
    );
  }

  // Para otros tipos de errores, usar el manejador de errores de la aplicación
  const appError = handleAppError(error);
  return c.json(
    {
      success: false,
      error: {
        message: appError.message,
        type: appError.type,
        ...(appError.details && { details: appError.details }),
      },
    },
    appError.statusCode,
  );
}

/**
 * Middleware de manejo de errores para Hono
 * @param error - Error capturado
 * @param c - Contexto de Hono
 */
export function errorHandler(error: Error, c: Context) {
  // Log del error para depuración
  console.error(`[ERROR] ${new Date().toISOString()}:`, error);

  // Usar el manejador de errores de API
  return handleApiError(error, c);
}

/**
 * Función asíncrona que envuelve una función y maneja errores de manera consistente
 * @param fn - Función asíncrona a envolver
 * @returns Función con manejo de errores integrado
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): (...args: Parameters<T>) => Promise<ReturnType<T> | void> {
  return (...args: Parameters<T>) => {
    return Promise.resolve(fn(...args)).catch((error: any) => {
      // Si el primer argumento es un contexto de Hono, manejar el error
      if (args.length > 0 && args[0] instanceof Context) {
        return handleApiError(error, args[0] as Context);
      }
      // Si no, propagar el error
      throw error;
    });
  };
}

/**
 * Clase para crear respuestas de error estandarizadas
 */
export class ErrorResponse {
  /**
   * Crea una respuesta de error de validación
   * @param message - Mensaje de error
   * @param details - Detalles adicionales del error
   * @returns Objeto de error estandarizado
   */
  static validation(message: string, details?: Record<string, any>): ApiError {
    return {
      message,
      code: AppErrorType.VALIDATION_ERROR,
      statusCode: 400,
      details,
    };
  }

  /**
   * Crea una respuesta de error de autenticación
   * @param message - Mensaje de error
   * @returns Objeto de error estandarizado
   */
  static authentication(message: string = "Authentication required"): ApiError {
    return {
      message,
      code: AppErrorType.AUTHENTICATION_ERROR,
      statusCode: 401,
    };
  }

  /**
   * Crea una respuesta de error de autorización
   * @param message - Mensaje de error
   * @returns Objeto de error estandarizado
   */
  static authorization(message: string = "Insufficient permissions"): ApiError {
    return {
      message,
      code: AppErrorType.AUTHORIZATION_ERROR,
      statusCode: 403,
    };
  }

  /**
   * Crea una respuesta de error de recurso no encontrado
   * @param message - Mensaje de error
   * @returns Objeto de error estandarizado
   */
  static notFound(message: string = "Resource not found"): ApiError {
    return {
      message,
      code: AppErrorType.NOT_FOUND_ERROR,
      statusCode: 404,
    };
  }

  /**
   * Crea una respuesta de error de conflicto
   * @param message - Mensaje de error
   * @returns Objeto de error estandarizado
   */
  static conflict(message: string = "Resource already exists"): ApiError {
    return {
      message,
      code: AppErrorType.CONFLICT_ERROR,
      statusCode: 409,
    };
  }

  /**
   * Crea una respuesta de error de base de datos
   * @param message - Mensaje de error
   * @returns Objeto de error estandarizado
   */
  static database(message: string = "Database error occurred"): ApiError {
    return {
      message,
      code: AppErrorType.DATABASE_ERROR,
      statusCode: 500,
    };
  }

  /**
   * Crea una respuesta de error interno del servidor
   * @param message - Mensaje de error
   * @returns Objeto de error estandarizado
   */
  static internal(message: string = "Internal server error"): ApiError {
    return {
      message,
      code: AppErrorType.INTERNAL_SERVER_ERROR,
      statusCode: 500,
    };
  }

  /**
   * Crea una respuesta de error de límite de tasa
   * @param message - Mensaje de error
   * @returns Objeto de error estandarizado
   */
  static rateLimit(message: string = "Too many requests"): ApiError {
    return {
      message,
      code: AppErrorType.RATE_LIMIT_ERROR,
      statusCode: 429,
    };
  }

  /**
   * Crea una respuesta de error de servicio no disponible
   * @param message - Mensaje de error
   * @returns Objeto de error estandarizado
   */
  static serviceUnavailable(
    message: string = "Service temporarily unavailable",
  ): ApiError {
    return {
      message,
      code: AppErrorType.SERVICE_UNAVAILABLE_ERROR,
      statusCode: 503,
    };
  }

  /**
   * Crea una respuesta de error de mala solicitud
   * @param message - Mensaje de error
   * @returns Objeto de error estandarizado
   */
  static badRequest(message: string = "Bad request"): ApiError {
    return {
      message,
      code: AppErrorType.BAD_REQUEST_ERROR,
      statusCode: 400,
    };
  }
}

/**
 * Función para validar y extraer información de errores de Zod
 * @param error - Error de Zod
 * @returns Objeto con detalles del error de validación
 */
export function handleZodError(error: any): {
  message: string;
  details: Record<string, any>;
} {
  if (error.errors && Array.isArray(error.errors)) {
    const details: Record<string, any> = {};
    let message = "Validation failed";

    // Procesar errores de validación de Zod
    error.errors.forEach((err: any) => {
      const path = err.path?.join(".") || "unknown";
      details[path] = err.message;
    });

    if (error.errors.length === 1) {
      message = error.errors[0].message;
    }

    return { message, details };
  }

  // Para otros tipos de errores, devolver un mensaje genérico
  return {
    message: error.message || "Validation failed",
    details: {},
  };
}
