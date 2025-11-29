# Middleware Examples

This file provides practical examples of how to use the unified middleware in various scenarios.

## Basic Authentication

### Required Authentication
```typescript
import { Hono } from "hono";
import { authMiddleware } from "../src/middleware/auth";

const app = new Hono();

// Require authentication for all routes
app.use("/*", authMiddleware());

// Or explicitly set required
app.use("/api/*", authMiddleware({ required: true }));
```

### Optional Authentication
```typescript
// Allow both authenticated and anonymous requests
app.use("/public/*", authMiddleware({ required: false }));

// In your handler, check if user is authenticated
app.get("/public/profile", async (c) => {
  const auth = c.get("auth");
  
  if (auth.isAuthenticated) {
    return c.json({ 
      user: auth.user,
      message: "You are authenticated" 
    });
  } else {
    return c.json({ 
      message: "You are viewing as a guest" 
    });
  }
});
```

### Custom Cookie Name
```typescript
// Use a custom cookie name instead of default "access_token"
app.use("/custom/*", authMiddleware({ cookieName: "my_auth_token" }));
```

## Permission-based Authorization

### Single Permission
```typescript
import { requirePermissions } from "../src/middleware/auth";

// Require users:view permission
app.get("/users", requirePermissions(["users:view"]), async (c) => {
  // Only users with users:view permission can access this route
  const auth = c.get("auth");
  return c.json({ message: "You can view users" });
});
```

### Multiple Permissions (OR logic)
```typescript
// Require any of these permissions
app.delete("/content", requirePermissions(["content:delete", "admin:all"]), async (c) => {
  // Users with either content:delete OR admin:all can access
  return c.json({ message: "Content deleted" });
});
```

### Multiple Permissions (AND logic)
```typescript
// Require ALL of these permissions
app.post("/super-admin", requirePermissions(
  ["admin:all", "super:access"], 
  { requireAll: true }
), async (c) => {
  // Users must have both admin:all AND super:access
  return c.json({ message: "Super admin operation completed" });
});
```

## Role-based Authorization

### Single Role
```typescript
import { requireRoles } from "../src/middleware/auth";

// Only admin role can access
app.use("/admin/*", requireRoles(["admin"]));
```

### Multiple Roles
```typescript
// Any of these roles can access
app.use("/staff/*", requireRoles(["admin", "moderator", "editor"]));
```

## Self-or-Admin Access

### Standard Usage
```typescript
import { requireSelfOrAdmin } from "../src/middleware/auth";

// Users can access their own profile or admins can access any profile
app.get("/users/:id", requireSelfOrAdmin("id"), async (c) => {
  const userId = c.req.param("id");
  // Handler code here
  return c.json({ message: `Accessing user ${userId}` });
});
```

### Custom Parameter
```typescript
// Use a different parameter name
app.get("/profiles/:userId", requireSelfOrAdmin("userId"), async (c) => {
  // Checks if userId parameter matches current user or if user is admin
  const userId = c.req.param("userId");
  return c.json({ message: `Accessing profile ${userId}` });
});
```

## Combining Middleware

### Auth + Permissions
```typescript
// Chain multiple middleware
app.use(
  "/api/users",
  authMiddleware(),
  requirePermissions(["users:manage"])
);
```

### Auth + Roles
```typescript
// Use with role-based access
app.use(
  "/api/admin",
  authMiddleware(),
  requireRoles(["admin"])
);
```

### Auth + Self-or-Admin + Permissions
```typescript
// Complex authorization scenario
app.put(
  "/api/users/:id",
  authMiddleware(),
  requireSelfOrAdmin("id"),
  requirePermissions(["users:edit"])
);
```

## Advanced Patterns

### API Key + JWT Authentication
```typescript
// Custom middleware that accepts API keys or JWT
const customAuth = async (c: Context, next: Next) => {
  const apiKey = c.req.header("x-api-key");
  
  if (apiKey && validateApiKey(apiKey)) {
    // API key is valid, set custom auth context
    c.set("auth", {
      user: { id: "api-service", name: "API Service" },
      permissions: ["api:access"],
      isAuthenticated: true
    });
    return next();
  }
  
  // Fall back to JWT authentication
  return authMiddleware()(c, next);
};

app.use("/api/service/*", customAuth);
```

### Conditional Authorization
```typescript
// Different permissions based on HTTP method
app.use(
  "/api/users",
  authMiddleware(),
  async (c, next) => {
    const method = c.req.method;
    
    if (method === "GET") {
      return requirePermissions(["users:view"])(c, next);
    } else if (method === "POST") {
      return requirePermissions(["users:create"])(c, next);
    } else {
      // PUT, DELETE, etc.
      return requirePermissions(["users:manage"])(c, next);
    }
  }
);
```

### Resource-based Permissions
```typescript
// Dynamic permission checking based on resource
const requireResourcePermission = (resourceType: string) => {
  return async (c: Context, next: Next) => {
    const auth = c.get("auth");
    const resourceId = c.req.param("id");
    const method = c.req.method;
    
    // Convert to permission name: e.g., "users:123:edit" becomes "users:edit"
    const permission = `${resourceType}:${getPermissionForMethod(method)}`;
    
    // Check if user has permission on this resource
    const hasPermission = await checkResourcePermission(
      auth.user.id, 
      resourceId, 
      permission
    );
    
    if (!hasPermission) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    
    return next();
  };
};

function getPermissionForMethod(method: string): string {
  switch (method) {
    case "GET": return "view";
    case "POST": return "create";
    case "PUT": return "edit";
    case "DELETE": return "delete";
    default: return "access";
  }
}

app.get("/api/resources/:id", requireResourcePermission("resources"));
app.put("/api/resources/:id", requireResourcePermission("resources"));
```

## Error Handling

### Custom Error Handling
```typescript
// Custom error handler for authentication failures
const customErrorHandler = (c: Context, message: string, status: number) => {
  if (status === 401) {
    return c.json({
      error: "Authentication failed",
      code: "AUTH_FAILED",
      message,
      timestamp: new Date().toISOString()
    }, 401);
  }
  
  // For other status codes, use default handling
  return handleAuthError(c, message, status);
};

// You would need to modify middleware to use custom error handler
// or wrap it in your own middleware
```

## Testing Examples

### Testing with Different Headers
```typescript
// Test file example
import { describe, it, expect } from "bun:test";
import app from "../src/index";

describe("API with Authentication", () => {
  it("should accept Bearer token", async () => {
    const response = await app.request("/api/protected", {
      method: "GET",
      headers: {
        "Authorization": "Bearer valid_token_here"
      }
    });
    
    expect(response.status).toBe(200);
  });
  
  it("should accept cookie", async () => {
    const response = await app.request("/api/protected", {
      method: "GET",
      headers: {
        "Cookie": "access_token=valid_token_here"
      }
    });
    
    expect(response.status).toBe(200);
  });
  
  it("should reject missing authentication", async () => {
    const response = await app.request("/api/protected", {
      method: "GET",
      headers: {
        "Accept": "application/json" // Important to identify as API request
      }
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Authorization header is missing");
  });
});
```

## Best Practices

1. **Always specify exact permissions** rather than generic ones
2. **Use role-based authorization** for broad access patterns
3. **Use self-or-admin** for user-specific resources
4. **Set proper headers** in API clients to ensure correct error responses
5. **Combine middleware** appropriately for complex authorization rules
6. **Test both success and failure** cases for all protected routes