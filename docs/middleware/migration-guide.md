# Middleware Migration Guide

This guide helps you migrate from the old middleware structure to the new unified middleware implementation.

## Overview of Changes

The middleware has been unified to simplify the codebase and improve maintainability. The key changes are:

1. **Combined Implementation**: All middleware functionality is now in a single `src/middleware/index.ts` file
2. **Simplified API**: Cleaner, more consistent function signatures
3. **Enhanced Error Handling**: Better distinction between API and browser requests
4. **Removed Duplicate Code**: Eliminated the `enhanced` directory

## Migration Steps

### 1. Update Imports

Change your imports from:

```typescript
// Old way
import { createAuthMiddlewareForHono } from "../middleware";
import { authMiddleware } from "../middleware/enhanced";
```

To:

```typescript
// New way
import { authMiddleware } from "../middleware/auth";
// or
import { authMiddleware, requireAuth } from "../middleware";
```

### 2. Update Function Calls

#### Authentication Middleware

**Old:**
```typescript
app.use(
  "*",
  createAuthMiddlewareForHono({
    jwtService: jwtService,
    authService: authService,
    permissionService: permissionService,
  }, true) // required parameter
);
```

**New:**
```typescript
app.use("*", authMiddleware({ required: true }));
// or simpler
app.use("*", authMiddleware()); // required is true by default
```

#### Permission Middleware

**Old:**
```typescript
app.use(
  "/protected",
  createPermissionMiddlewareForHono(["admin:access"], { requireAll: false })
);
```

**New:**
```typescript
app.use("/protected", requirePermissions(["admin:access"], { requireAll: false }));
```

#### Role Middleware

**Old:**
```typescript
app.use(
  "/admin",
  createRoleMiddlewareForHono(["admin", "moderator"])
);
```

**New:**
```typescript
app.use("/admin", requireRoles(["admin", "moderator"]));
```

#### Require Auth Middleware

**Old:**
```typescript
// If you were using the enhanced middleware
app.use("/profile", requireAuth);
```

**New:**
```typescript
app.use("/profile", requireAuth()); // Note the added parentheses
```

### 3. Update Error Handling

The new middleware automatically detects if a request is from an API or a browser:

- **API requests**: Returns a 401 JSON response
- **Browser requests**: Redirects to the login page

If your code was checking for specific error messages, you may need to update them:

- "Authentication required" → "Authorization header is missing"

## Benefits of the New Middleware

1. **Simpler API**: No need to pass service objects, they're imported internally
2. **Consistent Usage**: All middleware functions follow the same pattern
3. **Better Error Handling**: Automatic detection of API vs browser requests
4. **More Features**: Supports both cookie and Bearer token authentication
5. **Easier Testing**: Cleaner interfaces make testing simpler

## Common Issues and Solutions

### Tests Failing with 302 Instead of 401

If your tests are expecting a 401 but getting a 302 (redirect), it's because the request is being treated as a browser request instead of an API request. Solutions:

1. Add appropriate headers to your test request:
   ```typescript
   const response = await app.request("/api/protected", {
     headers: {
       "accept": "application/json"
     }
   });
   ```

2. Or use the API path (starting with `/api/`), which is automatically detected

### Tests Expecting 403 But Getting 404

This is likely correct behavior. If a resource doesn't exist, the API should return 404 (Not Found) rather than 403 (Forbidden). Update your tests to expect 404.

### Tests Failing with Different Error Messages

Update your tests to match the new error messages:
- "Authentication required" → "Authorization header is missing"

## Code Examples

### Protecting a Route

```typescript
import { authMiddleware } from "../middleware/auth";

// Protect a route with required authentication
app.use("/protected/*", authMiddleware());

// Protect a route with optional authentication
app.use("/optional/*", authMiddleware({ required: false }));
```

### Checking Permissions

```typescript
import { requirePermissions } from "../middleware/auth";

// Require a specific permission
app.use("/admin/*", requirePermissions(["admin:access"]));

// Require multiple permissions (any one)
app.use("/moderate/*", requirePermissions(["content:moderate", "admin:all"]));

// Require all permissions (AND logic)
app.use("/super-admin/*", requirePermissions(["admin:all", "super:access"], { requireAll: true }));
```

### Checking Roles

```typescript
import { requireRoles } from "../middleware/auth";

// Require a specific role
app.use("/admin/*", requireRoles(["admin"]));

// Require any of multiple roles
app.use("/staff/*", requireRoles(["admin", "moderator", "editor"]));
```

### Self-or-Admin Access

```typescript
import { requireSelfOrAdmin } from "../middleware/auth";

// User can access their own resource or admins can access any
app.get("/users/:id", requireSelfOrAdmin("id"), async (c) => {
  // Handler code here
});
```

## Testing with the New Middleware

When writing tests for routes protected by the new middleware, make sure to:

1. Use proper headers to identify API requests
2. Expect the correct error messages
3. Understand the difference between 401 (unauthorized) and 404 (not found)

Example test:

```typescript
test("should return 401 without authentication", async () => {
  const response = await app.request("/api/protected", {
    headers: {
      "accept": "application/json"
    }
  });
  expect(response.status).toBe(401);
  const jsonData = await response.json();
  expect(jsonData.error).toBe("Authorization header is missing");
});
```

## Need Help?

If you encounter any issues during migration:

1. Check this guide first
2. Look at the existing tests for examples
3. Review the middleware documentation at `src/middleware/README.md`
4. Check if there are similar patterns in the codebase