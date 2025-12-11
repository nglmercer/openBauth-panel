import type { Context, Next, MiddlewareHandler } from "hono";
import { getServiceFactory } from "../services/service-factory";
import { defaultLogger } from "../utils/logger";
import type { AuthContext } from "../types/app-context";
import { createValidationMiddleware } from "./validation"; // Import robust validation middleware
import type { Role } from "open-bauth";


// Create auth middleware for Hono that wraps the open-bauth middleware
export function createAuthMiddlewareForHono(options: {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
  requireAll?: boolean;
} = {}): MiddlewareHandler {
  const factory = getServiceFactory();
  const services = factory.getServices();

  return async (c: Context, next: Next) => {
    try {
      // Get authorization header
      const authHeader = c.req.header("authorization");
      if (!authHeader) {
        if (options.required !== false) {
          return c.json({
            success: false,
            error: "Authorization header required"
          }, 401);
        }
        (c as any).auth = { isAuthenticated: false };
        await next();
        return;
      }

      // Extract token
      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        if (options.required !== false) {
          return c.json({
            success: false,
            error: "Invalid authorization header format"
          }, 401);
        }
        (c as any).auth = { isAuthenticated: false };
        await next();
        return;
      }

      // Verify token
      const payload = await services.jwtService.verifyToken(token);
      if (!payload) {
        if (options.required !== false) {
          return c.json({
            success: false,
            error: "Invalid or expired token"
          }, 401);
        }
        (c as any).auth = { isAuthenticated: false };
        await next();
        return;
      }

      // Get user
      const user = await services.authService.findUserById(payload.userId);
      if (user) {
        defaultLogger.info("AuthMiddleware: User found", { id: user.id, roles: user.roles });
      }
      if (!user) {
        defaultLogger.warn("AuthMiddleware: User not found for id", payload.userId);
        if (options.required !== false) {
          return c.json({
            success: false,
            error: "User not found"
          }, 401);
        }
        (c as any).auth = { isAuthenticated: false };
        await next();
        return;
      }

      // Fetch roles if not present on user object
      if (!user.roles || user.roles.length === 0) {
        try {
          // Correctly fetch roles for the specific user
          const userRolesController = services.dbInitializer.createController("user_roles");
          const rolesDetailsController = services.dbInitializer.createController("roles");

          // Get user_role associations
          const userRolesResult = await userRolesController.findAll({
            where: { user_id: user.id }
          });

          const userRolesList = userRolesResult.data || [];
          const Roles: Role[] = [];

          // Fetch role details
          for (const userRole of userRolesList) {
            const roleId = (userRole as any).role_id;
            const roleResult = await rolesDetailsController.findById(roleId);
            if (roleResult.success && roleResult.data) {
              Roles.push((roleResult.data as any).name);
            }
          }

          user.roles = Roles;

        } catch (e) {
          defaultLogger.error("Failed to fetch user roles", e as Error);
          user.roles = [];
        }
      }

      // Check roles if specified
      if (options.roles && options.roles.length > 0) {
        // Get user roles from the user object or fetch them
        const userRoles = user.roles || [];
        const hasRole = options.roles.some(role =>
          userRoles.some(userRole =>
            typeof userRole === 'string' ? userRole === role : userRole.name === role
          )
        );

        if (!hasRole) {
          return c.json({
            success: false,
            error: "Insufficient permissions"
          }, 403);
        }
      }

      // Check permissions if specified
      if (options.permissions && options.permissions.length > 0) {
        const hasPermission = options.requireAll
          ? await Promise.all(options.permissions.map(permission =>
            services.permissionService.userHasPermission(user.id, permission)
          )).then(results => results.every(Boolean))
          : await Promise.any(options.permissions.map(permission =>
            services.permissionService.userHasPermission(user.id, permission)
          ));

        if (!hasPermission) {
          return c.json({
            success: false,
            error: "Insufficient permissions"
          }, 403);
        }
      }

      // Set auth context
      (c as any).auth = {
        isAuthenticated: true,
        user,
        roles: payload.roles || [],
        permissions: (payload as any).permissions || [],
        token
      };

      await next();
      return;

    } catch (error) {
      defaultLogger.error("Auth middleware error", error as Error);

      if (options.required !== false) {
        return c.json({
          success: false,
          error: "Authentication failed"
        }, 401);
      }

      (c as any).auth = { isAuthenticated: false };
      await next();
      return;
    }
  };
}

// Create role-based middleware using open-bauth's implementation
export function createRoleMiddlewareForHono(roles: string[]): MiddlewareHandler {
  // Create a simple role check middleware
  return async (c: Context, next: Next) => {

    // Check if user has required roles
    const auth = (c as any).auth as AuthContext;
    if (!auth?.isAuthenticated || !auth.user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const userRoles = auth.user.roles || [];
    const hasRole = roles.some(role =>
      userRoles.some((userRole: any) =>
        typeof userRole === 'string' ? userRole === role : userRole.name === role
      )
    );

    if (!hasRole) {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }

    await next();
    return;
  };
}

// Create permission-based middleware using open-bauth's implementation
export function createPermissionMiddlewareForHono(permissions: string[], options: { requireAll?: boolean } = {}): MiddlewareHandler {
  // Create a simple permission check middleware
  return async (c: Context, next: Next) => {

    // Check if user has required permissions
    const auth = (c as any).auth as AuthContext;
    if (!auth?.isAuthenticated) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const userPermissions = auth.permissions || [];

    const hasPermission = options.requireAll
      ? permissions.every(permission => userPermissions.includes(permission))
      : permissions.some(permission => userPermissions.includes(permission));

    if (!hasPermission) {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }

    await next();
    return;
  };
}

// Rate limiting middleware for Hono
export function createRateLimitMiddlewareForHono(options: {
  windowMs?: number;
  max?: number;
  keyGenerator?: (c: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
} = {}) {
  const factory = getServiceFactory();
  const services = factory.getServices();

  const {
    windowMs = 60 * 1000, // 1 minute
    max = 100,
    keyGenerator = (c: Context) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  } = options;

  return async (c: Context, next: Next) => {
    try {
      const key = keyGenerator(c);
      const current = await services.rateLimitService.consume(key);

      if (!current) {
        return c.json({
          success: false,
          error: "Too many requests",
          retryAfter: Math.ceil(windowMs / 1000)
        }, 429);
      }

      // Set rate limit headers
      c.header('X-RateLimit-Limit', max.toString());
      c.header('X-RateLimit-Remaining', (max - current.remaining).toString());
      c.header('X-RateLimit-Reset', (Date.now() + windowMs).toString());

      await next();
      return;

    } catch (error) {
      defaultLogger.error("Rate limit middleware error", error as Error);
      return c.json({
        success: false,
        error: "Rate limiting service unavailable"
      }, 500);
    }
  };
}

// Audit logging middleware for Hono
export function createAuditMiddlewareForHono(eventType: string): MiddlewareHandler {
  const factory = getServiceFactory();
  const services = factory.getServices();

  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const userId = (c as any).auth?.user?.id || 'anonymous';
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';

    try {
      await next();

      const responseTime = Date.now() - startTime;
      const statusCode = c.res.status;

      // Log successful request
      await services.auditService.logApiEvent(eventType, userId, {
        ip,
        userAgent,
        statusCode,
        responseTime
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Log failed request
      await services.auditService.logApiEvent(eventType, userId, {
        ip,
        userAgent,
        statusCode: 500,
        responseTime,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
    return;
  };
}

// CORS middleware for Hono with specific configuration
export function createCorsMiddlewareForHono(options: {
  origin?: string | string[] | ((origin: string) => boolean);
  credentials?: boolean;
  methods?: string[];
  headers?: string[];
} = {}) {
  const {
    origin = '*',
    credentials = false,
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-Requested-With']
  } = options;

  return async (c: Context, next: Next) => {
    const requestOrigin = c.req.header('origin');

    // Set CORS headers
    if (typeof origin === 'string') {
      c.header('Access-Control-Allow-Origin', origin);
    } else if (Array.isArray(origin)) {
      if (requestOrigin && origin.includes(requestOrigin)) {
        c.header('Access-Control-Allow-Origin', requestOrigin);
      }
    } else if (typeof origin === 'function') {
      if (requestOrigin && origin(requestOrigin)) {
        c.header('Access-Control-Allow-Origin', requestOrigin);
      }
    }

    if (credentials) {
      c.header('Access-Control-Allow-Credentials', 'true');
    }

    c.header('Access-Control-Allow-Methods', methods.join(', '));
    c.header('Access-Control-Allow-Headers', headers.join(', '));

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      return c.text('', 204);
    }

    await next();
    return;
  };
}

// Security headers middleware for Hono
export function createSecurityHeadersMiddlewareForHono(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    // Security headers
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Content-Security-Policy', "default-src 'self'");

    await next();
    return;
  };
}

// Request validation middleware for Hono
// Re-exporting the robust validation logic from validation.ts
// This replaces the simplified version that was here
export const createValidationMiddlewareForHono = createValidationMiddleware;

// Export all middleware creators
export {
  createAuthMiddlewareForHono as createAuthMiddleware,
  createRoleMiddlewareForHono as createRoleMiddleware,
  createPermissionMiddlewareForHono as createPermissionMiddleware,
  createRateLimitMiddlewareForHono as createRateLimitMiddleware,
  createAuditMiddlewareForHono as createAuditMiddleware,
  createCorsMiddlewareForHono as createCorsMiddleware,
  createSecurityHeadersMiddlewareForHono as createSecurityHeadersMiddleware,
  createValidationMiddlewareForHono as createValidationMiddleware
};
