import { Hono } from "hono";
import { getServiceFactory } from "../services/service-factory";
import { defaultLogger } from "../utils/logger";

// Create auth middleware for Hono that wraps the open-bauth middleware
export function createAuthMiddlewareForHono(options: {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
  requireAll?: boolean;
} = {}) {
  const factory = getServiceFactory();
  const services = factory.getServices();
  
  return async (c: any, next: any) => {
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
        c.auth = { isAuthenticated: false };
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
        c.auth = { isAuthenticated: false };
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
        c.auth = { isAuthenticated: false };
        await next();
        return;
      }
      
      // Get user
      const user = await services.authService.findUserById(payload.userId);
      if (!user) {
        if (options.required !== false) {
          return c.json({ 
            success: false, 
            error: "User not found" 
          }, 401);
        }
        c.auth = { isAuthenticated: false };
        await next();
        return;
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
      c.auth = {
        isAuthenticated: true,
        user,
        roles: payload.roles || [],
        permissions: (payload as any).permissions || [],
        token
      };
      
      await next();
      
    } catch (error) {
      defaultLogger.error("Auth middleware error", error as Error);
      
      if (options.required !== false) {
        return c.json({ 
          success: false, 
          error: "Authentication failed" 
        }, 401);
      }
      
      c.auth = { isAuthenticated: false };
      await next();
    }
  };
}

// Create role-based middleware using open-bauth's implementation
export function createRoleMiddlewareForHono(roles: string[]) {
  const factory = getServiceFactory();
  const services = factory.getServices();
  // Create a simple role check middleware
  return async (c: any, next: any) => {
    const factory = getServiceFactory();
    const services = factory.getServices();
    
    // Check if user has required roles
    const auth = c.auth;
    if (!auth?.isAuthenticated) {
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
  };
}

// Create permission-based middleware using open-bauth's implementation
export function createPermissionMiddlewareForHono(permissions: string[], options: { requireAll?: boolean } = {}) {
  const factory = getServiceFactory();
  const services = factory.getServices();
  // Create a simple permission check middleware
  return async (c: any, next: any) => {
    const factory = getServiceFactory();
    const services = factory.getServices();
    
    // Check if user has required permissions
    const auth = c.auth;
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
    keyGenerator = (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;
  
  return async (c: any, next: any) => {
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
export function createAuditMiddlewareForHono(eventType: string) {
  const factory = getServiceFactory();
  const services = factory.getServices();
  
  return async (c: any, next: any) => {
    const startTime = Date.now();
    const userId = c.auth?.user?.id || 'anonymous';
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
  
  return async (c: any, next: any) => {
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
  };
}

// Security headers middleware for Hono
export function createSecurityHeadersMiddlewareForHono() {
  return async (c: any, next: any) => {
    // Security headers
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Content-Security-Policy', "default-src 'self'");
    
    await next();
  };
}

// Request validation middleware for Hono
export function createValidationMiddlewareForHono(schema: any) {
  return async (c: any, next: any) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      c.set('validatedBody', validated);
      await next();
    } catch (error) {
      return c.json({ 
        success: false, 
        error: "Validation failed", 
        details: error 
      }, 400);
    }
  };
}

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
