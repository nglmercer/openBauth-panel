import { getCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import type { AuthContext, User, PermissionOptions } from "open-bauth";
import { jwtService, authService, permissionService } from "../db";

// Extended type for the context with auth
export type ExtendedContext = Context & {
  get: (key: "auth") => AuthContext;
};

// Authentication options interface
interface AuthOptions {
  required?: boolean;
  cookieName?: string;
}

// Global options for the middleware
const DEFAULT_OPTIONS: Required<AuthOptions> = {
  required: true,
  cookieName: "access_token",
};

/**
 * Enhanced authentication middleware that supports both cookie and Bearer token authentication
 *
 * Usage:
 * // Optional authentication
 * app.use("/*", authMiddleware({ required: false }));
 *
 * // Required authentication
 * app.use("/protected/*", authMiddleware({ required: true }));
 *
 * // Custom cookie name
 * app.use("/*", authMiddleware({ cookieName: "my_token" }));
 */
export function authMiddleware(options: AuthOptions = {}) {
  // Merge with default options
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Return the actual middleware function
  return async (c: Context, next: Next) => {
    // Try to get token from cookie first
    let token = getCookie(c, opts.cookieName);

    // If no cookie, try Authorization header
    if (!token) {
      const authHeader = c.req.header("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    // If we need authentication but no token is provided
    if (opts.required && !token) {
      return handleAuthError(
        c,
        "Authentication required: No token provided",
        401,
      );
    }

    // If no token and authentication is optional, set anonymous context
    if (!token) {
      c.set("auth", createAnonymousContext());
      await next();
      return;
    }

    try {
      // Verify the token
      const payload = await jwtService.verifyToken(token);

      if (!payload.userId) {
        return handleAuthError(c, "Invalid token: Missing user ID", 401);
      }

      // Get user details
      const user = await authService.findUserById(payload.userId, {
        includeRoles: true,
      });

      if (!user || !user.is_active) {
        return handleAuthError(c, "User not found or is inactive", 401);
      }

      // Get user permissions
      const userPermissions = await getUserPermissions(user.id);

      // Set authenticated context
      c.set("auth", {
        user: user,
        token: token,
        permissions: userPermissions,
        isAuthenticated: true,
      } as AuthContext);

      await next();
    } catch (error) {
      // Log the error for debugging
      console.error("Authentication error:", error);

      if (opts.required) {
        return handleAuthError(c, "Invalid or expired token", 401);
      }

      // If auth is optional, set anonymous context
      c.set("auth", createAnonymousContext());
      await next();
    }
  };
}

/**
 * Middleware factory for routes that require authentication
 *
 * Usage:
 * app.get("/profile", requireAuth(), async (c) => { ... });
 */
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const auth = c.get("auth") as AuthContext;

    if (!auth?.isAuthenticated) {
      // Determine the response format based on the request
      const isApiRequest = determineApiRequest(c);

      if (isApiRequest) {
        return c.json({ error: "Authorization header is missing" }, 401);
      } else {
        return c.redirect("/auth/ssr/login");
      }
    }

    await next();
  };
}

/**
 * Middleware factory for routes that require specific roles
 *
 * Usage:
 * app.get("/admin", requireRoles(["admin"]), async (c) => { ... });
 *
 * Multiple roles (OR logic):
 * app.get("/admin-or-moderator", requireRoles(["admin", "moderator"]), async (c) => { ... });
 */
export function requireRoles(requiredRoles: string[]) {
  return async (c: Context, next: Next) => {
    const auth = c.get("auth") as AuthContext;

    if (!auth?.isAuthenticated) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const userRoles = auth.user?.roles || [];
    const hasRequiredRole = requiredRoles.some((role) =>
      userRoles.map((r) => r.name).includes(role),
    );

    if (!hasRequiredRole) {
      return c.json(
        { error: "Insufficient permissions: Required role not found" },
        403,
      );
    }

    await next();
  };
}

/**
 * Middleware factory for routes that require specific permissions
 *
 * Usage:
 * app.delete("/users/:id", requirePermissions(["users:delete"]), async (c) => { ... });
 *
 * Multiple permissions (OR logic by default):
 * app.get("/sensitive", requirePermissions(["read:all", "admin:all"]), async (c) => { ... });
 *
 * Multiple permissions (AND logic):
 * app.get("/sensitive", requirePermissions(["read:all", "admin:all"], { requireAll: true }), async (c) => { ... });
 */
export function requirePermissions(
  requiredPermissions: string[],
  options: PermissionOptions = { requireAll: false },
) {
  return async (c: Context, next: Next) => {
    const auth = c.get("auth") as AuthContext;

    if (!auth?.isAuthenticated) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const userPermissions = auth.permissions || [];
    let hasPermission: boolean;

    if (options.requireAll) {
      hasPermission = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );
    } else {
      hasPermission = requiredPermissions.some((permission) =>
        userPermissions.includes(permission),
      );
    }

    if (!hasPermission) {
      return c.json(
        { error: "Insufficient permissions: Required permission not found" },
        403,
      );
    }

    await next();
  };
}

/**
 * Middleware factory for checking if a user can access their own resource or has admin privileges
 *
 * Usage:
 * app.get("/users/:id", requireSelfOrAdmin("id"), async (c) => { ... });
 */
export function requireSelfOrAdmin(idParam: string = "id") {
  return async (c: Context, next: Next) => {
    const auth = c.get("auth") as AuthContext;

    if (!auth?.isAuthenticated) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const userId = auth.user?.id;
    const targetId = c.req.param(idParam);
    const userRoles = auth.user?.roles || [];
    const isAdmin = userRoles.some((role) => role.name === "admin");

    // Allow access if the user is an admin or accessing their own resource
    if (!isAdmin && userId !== targetId) {
      return c.json({ error: "Access denied" }, 403);
    }

    await next();
  };
}

// Helper functions

/**
 * Handle authentication errors with appropriate response format
 */
function handleAuthError(c: Context, message: string, status: number) {
  const isApiRequest = determineApiRequest(c);

  if (isApiRequest) {
    return c.json({ error: message }, status as any);
  } else {
    // For browser requests, redirect to login with error message
    const loginUrl = `/auth/ssr/login?error=${encodeURIComponent(message)}`;
    return c.redirect(loginUrl);
  }
}

/**
 * Determine if the request is an API request
 */
function determineApiRequest(c: Context): boolean {
  const authHeader = c.req.header("authorization");
  const contentType = c.req.header("content-type");
  const acceptHeader = c.req.header("accept");
  const path = c.req.path;

  // Check for common API indicators
  return !!(
    authHeader ||
    (contentType && contentType.includes("application/json")) ||
    (acceptHeader && acceptHeader.includes("application/json")) ||
    // Check if the path starts with /api/
    (path && path.startsWith("/api/"))
  );
}

/**
 * Create an anonymous authentication context
 */
function createAnonymousContext(): AuthContext {
  return {
    user: undefined,
    token: undefined,
    permissions: [],
    isAuthenticated: false,
  };
}

/**
 * Get all permissions for a user
 */
async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const userRoles = await authService.getUserRoles(userId);
    let userPermissions: string[] = [];

    for (const role of userRoles) {
      const rolePermissions = await permissionService.getRolePermissions(
        role.id,
      );
      userPermissions.push(...rolePermissions.map((p) => p.name));
    }

    // Remove duplicates
    return [...new Set(userPermissions)];
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return [];
  }
}
