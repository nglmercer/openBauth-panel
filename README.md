# openbauth-panel

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Features

- Unified authentication and authorization middleware
- Support for both cookie and Bearer token authentication
- Role-based and permission-based access control
- Self-or-admin resource access patterns
- Smart error handling that distinguishes between API and browser requests

## Authentication Middleware

The project uses a unified middleware system for authentication and authorization:

```typescript
import { authMiddleware, requireAuth, requirePermissions, requireRoles } from "./middleware/auth";

// Global authentication
app.use("*", authMiddleware({ required: false }));

// Protected routes
app.use("/protected/*", authMiddleware());

// Permission-based protection
app.use("/admin/*", requirePermissions(["admin:access"]));

// Role-based protection
app.use("/moderator/*", requireRoles(["admin", "moderator"]));
```

## Documentation

- [Middleware Documentation](src/middleware/README.md) - Complete middleware API reference
- [Migration Guide](docs/middleware/migration-guide.md) - How to update code for new middleware
- [Examples](docs/middleware/examples.md) - Practical usage examples

## Client Library

A comprehensive JavaScript/TypeScript client library is available for interacting with the OpenBauth Panel API from external projects:

```typescript
// Install the client library
npm install openbauth-panel-client

// Import and use
import { createOpenBauthPanelClient } from 'openbauth-panel-client';

const client = createOpenBauthPanelClient({
  host: 'your-api-host.com',
  port: 3000
});

// Authentication
await client.login({ email, password });
const users = await client.getUsers();

// User management
const newUser = await client.createUser(userData);
const updatedUser = await client.updateUser(id, userData);

// Role management
const roles = await client.getRoles();
const newRole = await client.createRole(roleData);

// Dynamic table operations
const tableData = await client.getTableRecords('users');
const record = await client.createTableRecord('users', data);
```

For detailed documentation and examples, see the [client directory](./client/README.md).
