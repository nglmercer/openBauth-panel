# Zod Schema Implementation Guide

This guide documents the comprehensive Zod schema implementation for OpenBAuth, providing validation, autocomplete, and type safety across the entire application.

## 📋 Table of Contents

- [Overview](#overview)
- [Schema Architecture](#schema-architecture)
- [Core Schemas](#core-schemas)
- [Validation Middleware](#validation-middleware)
- [Type Safety & Autocomplete](#type-safety--autocomplete)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Migration Guide](#migration-guide)

## 🌟 Overview

The OpenBAuth schema system provides:

- **Type-safe validation** with comprehensive error messages
- **Autocomplete support** for all schema fields and types
- **Reusable validators** for common patterns
- **Framework-agnostic** validation middleware
- **Comprehensive error handling** with detailed feedback
- **Performance optimized** with caching and lazy loading

### Key Benefits

1. **Enhanced Type Safety**: Full TypeScript integration with inferred types
2. **Better Developer Experience**: Autocomplete and inline documentation
3. **Consistent Validation**: Standardized validation patterns across the app
4. **Detailed Error Messages**: User-friendly validation feedback
5. **Performance**: Optimized validation with minimal overhead
6. **Extensibility**: Easy to add new schemas and validators

## 🏗️ Schema Architecture

### Directory Structure

```
src/schemas/
├── index.ts                    # Main export file with all schemas
├── validation-schemas.ts       # Core validation schemas
├── schema-utils.ts            # Reusable utilities and helpers
└── types.ts                   # TypeScript type definitions
```

### Core Components

1. **Validation Schemas** (`validation-schemas.ts`):
   - Authentication schemas (login, register, etc.)
   - User management schemas
   - MFA schemas
   - OAuth schemas
   - Utility schemas (pagination, search, etc.)

2. **Schema Utilities** (`schema-utils.ts`):
   - Reusable validators
   - Schema builders
   - Custom validation functions
   - Transform utilities

3. **Validation Middleware** (`middleware/validation.ts`):
   - Hono middleware integration
   - Request validation
   - Error handling
   - Type-safe data extraction

## 🔑 Core Schemas

### Authentication Schemas

```typescript
// Login schema with email and password validation
const loginSchema = z.object({
  email: emailValidator,                    // Comprehensive email validation
  password: z.string().min(1, "Password is required")  // Basic password check
});

// Registration schema with enhanced validation
const registerSchema = z.object({
  email: emailValidator,                    // Email with format validation
  password: passwordValidator,              // Strong password requirements
  username: usernameValidator,              // Alphanumeric with length limits
  first_name: nameValidator,                // Name format validation
  last_name: nameValidator                  // Name format validation
});
```

### User Management Schemas

```typescript
// Profile update schema with optional fields
const updateProfileSchema = z.object({
  first_name: nameValidator.optional(),
  last_name: nameValidator.optional(),
  username: usernameValidator.optional(),
  email: emailValidator.optional(),
  phone_number: phoneValidator,             // E.164 format validation
  bio: z.string().max(500).optional(),
  avatar_url: urlValidator,                 // URL format validation
  timezone: timezoneValidator,              // Valid timezone format
  language: languageValidator                // ISO 639-1 format
});
```

### MFA Schemas

```typescript
// MFA setup with conditional validation
const mfaSetupSchema = z.object({
  mfaType: z.enum(["totp", "sms", "email"]),
  phoneNumber: phoneValidator,
  email: emailValidator.optional()
}).refine((data) => {
  if (data.mfaType === "sms" && !data.phoneNumber) {
    return false;
  }
  return true;
}, {
  message: "Phone number is required for SMS MFA",
  path: ["phoneNumber"],
});
```

## 🛡️ Validation Middleware

### Basic Usage

```typescript
import { createValidationMiddleware, getValidatedData } from '../schemas';
import { loginSchema } from '../schemas';

// Apply validation middleware to route
app.post('/login', createValidationMiddleware(loginSchema), (c) => {
  const data = getValidatedData<LoginInput>(c);
  // data is now fully typed and validated
  return c.json({ success: true, user: data.email });
});
```

### Advanced Validation

```typescript
import { createCombinedValidationMiddleware } from '../schemas';

// Validate multiple data sources
app.post('/users/:id', createCombinedValidationMiddleware({
  body: updateUserSchema,
  params: idParamSchema,
  query: paginationSchema
}), (c) => {
  const { body, params, query } = c.validatedData;
  // All data is validated and typed
});
```

### Custom Validation Options

```typescript
const validationOptions = {
  stripUnknown: true,     // Remove unknown fields
  abortEarly: false,      // Collect all errors
  errorPrefix: "Request validation failed",
  logErrors: true         // Log validation errors
};

app.post('/register', createValidationMiddleware(registerSchema, validationOptions), handler);
```

## 🎯 Type Safety & Autocomplete

### Type Inference

```typescript
import type { LoginInput, RegisterInput, UpdateProfileInput } from '../schemas';

// Types are automatically inferred from schemas
async function handleLogin(data: LoginInput) {
  // Full autocomplete and type checking
  console.log(data.email); // ✅ Valid property
  console.log(data.username); // ❌ TypeScript error
}
```

### Schema Categories

```typescript
import { schemaCategories } from '../schemas';

// Access schemas by category
const authSchemas = schemaCategories.auth;
const userSchemas = schemaCategories.user;

// Use with full type safety
const loginData = authSchemas.login.parse(inputData);
```

### Utility Functions

```typescript
import { 
  validateSchema, 
  combineSchemas, 
  createPartialSchema 
} from '../schemas';

// Validate data programmatically
const result = await validateSchema(loginSchema, inputData);

// Combine multiple schemas
const combinedSchema = combineSchemas({
  user: userSchema,
  profile: profileSchema
});

// Create partial schemas for updates
const updateSchema = createPartialSchema(userSchema.shape);
```

## 🚀 Best Practices

### 1. Schema Organization

```typescript
// ✅ Good: Organized by feature
src/schemas/
├── auth/
│   ├── login.ts
│   ├── register.ts
│   └── refresh.ts
├── user/
│   ├── profile.ts
│   ├── password.ts
│   └── settings.ts

// ❌ Avoid: All schemas in one file
src/schemas/all-schemas.ts
```

### 2. Reusable Validators

```typescript
// ✅ Good: Reusable validators
export const emailValidator = z
  .string()
  .email("Invalid email format")
  .transform(email => email.toLowerCase().trim());

// ❌ Avoid: Inline validation
const schema = z.object({
  email: z.string().email("Invalid email format") // Repeated logic
});
```

### 3. Error Messages

```typescript
// ✅ Good: Descriptive error messages
const passwordValidator = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine(p => /[A-Z]/.test(p), {
    message: "Password must contain at least one uppercase letter"
  });

// ❌ Avoid: Generic error messages
const passwordValidator = z
  .string()
  .min(8, "Too short") // Not helpful
  .refine(p => /[A-Z]/.test(p), "Invalid"); // Vague
```

### 4. Conditional Validation

```typescript
// ✅ Good: Clear conditional logic
const schema = z.object({
  type: z.enum(["individual", "company"]),
  companyName: z.string().optional()
}).refine(data => {
  if (data.type === "company" && !data.companyName) {
    return false;
  }
  return true;
}, {
  message: "Company name is required for company accounts",
  path: ["companyName"]
});

// ❌ Avoid: Complex nested conditions
```

### 5. Performance Optimization

```typescript
// ✅ Good: Lazy loading for large schemas
export const complexSchema = z.lazy(() => 
  z.object({
    // Large nested structure
  })
);

// ✅ Good: Caching validation results
const validationCache = new Map();
function validateWithCache(schema, data) {
  const key = `${schema._def.typeName}:${JSON.stringify(data)}`;
  if (validationCache.has(key)) {
    return validationCache.get(key);
  }
  const result = schema.safeParse(data);
  validationCache.set(key, result);
  return result;
}
```

## 📖 Examples

### Complete Authentication Flow

```typescript
import { Hono } from "hono";
import { 
  loginSchema, 
  registerSchema, 
  createValidationMiddleware, 
  getValidatedData 
} from "../schemas";

const app = new Hono();

// Login endpoint with validation
app.post("/api/auth/login", 
  createValidationMiddleware(loginSchema),
  async (c) => {
    const { email, password } = getValidatedData<LoginInput>(c);
    
    // Authentication logic here
    const user = await authenticateUser(email, password);
    
    return c.json({
      success: true,
      token: generateToken(user),
      user: sanitizeUser(user)
    });
  }
);

// Registration endpoint with validation
app.post("/api/auth/register",
  createValidationMiddleware(registerSchema),
  async (c) => {
    const userData = getValidatedData<RegisterInput>(c);
    
    // Registration logic here
    const user = await createUser(userData);
    
    return c.json({
      success: true,
      message: "Registration successful",
      user: sanitizeUser(user)
    }, 201);
  }
);
```

### User Profile Management

```typescript
import { 
  updateProfileSchema, 
  updatePasswordSchema,
  createValidationMiddleware,
  getValidatedData 
} from "../schemas";

// Update profile with validation
app.patch("/api/user/profile",
  createAuthMiddleware(),
  createValidationMiddleware(updateProfileSchema),
  async (c) => {
    const auth = (c as any).auth;
    const updates = getValidatedData<UpdateProfileInput>(c);
    
    const updatedUser = await updateUserProfile(auth.user.id, updates);
    
    return c.json({
      success: true,
      user: updatedUser
    });
  }
);

// Update password with validation
app.post("/api/user/password",
  createAuthMiddleware(),
  createValidationMiddleware(updatePasswordSchema),
  async (c) => {
    const auth = (c as any).auth;
    const { currentPassword, newPassword } = getValidatedData<UpdatePasswordInput>(c);
    
    await updateUserPassword(auth.user.id, currentPassword, newPassword);
    
    return c.json({
      success: true,
      message: "Password updated successfully"
    });
  }
);
```

### Advanced Validation with Custom Logic

```typescript
import { z } from "zod";
import { createValidationMiddleware, getValidatedData } from "../schemas";

// Custom schema with business logic
const businessRegistrationSchema = z.object({
  businessType: z.enum(["llc", "corporation", "partnership"]),
  businessName: z.string().min(2).max(100),
  taxId: z.string().regex(/^\d{2}-\d{7}$/, "Invalid Tax ID format"),
  hasEmployees: z.boolean(),
  employeeCount: z.number().optional()
}).refine(data => {
  // Custom business logic
  if (data.hasEmployees && (!data.employeeCount || data.employeeCount < 1)) {
    return false;
  }
  if (!data.hasEmployees && data.employeeCount) {
    return false;
  }
  return true;
}, {
  message: "Employee count must be provided and positive when hasEmployees is true",
  path: ["employeeCount"]
});

app.post("/api/business/register",
  createValidationMiddleware(businessRegistrationSchema),
  async (c) => {
    const businessData = getValidatedData(c);
    
    // Process business registration
    const business = await registerBusiness(businessData);
    
    return c.json({
      success: true,
      business
    });
  }
);
```

## 🔄 Migration Guide

### From Old Zod Implementation

```typescript
// ❌ Old implementation
import { z } from "zod";

const oldSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

// Manual validation
app.post("/login", async (c) => {
  const body = await c.req.json();
  try {
    const data = oldSchema.parse(body);
    // Handle login
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors }, 400);
    }
  }
});
```

```typescript
// ✅ New implementation
import { 
  loginSchema, 
  createValidationMiddleware, 
  getValidatedData 
} from "../schemas";

// Automatic validation with middleware
app.post("/login", 
  createValidationMiddleware(loginSchema),
  async (c) => {
    const data = getValidatedData<LoginInput>(c);
    // Handle login - data is already validated and typed
  }
);
```

### Adding New Schemas

1. **Create the schema file**:
```typescript
// src/schemas/feature/new-feature.ts
import { z } from "zod";
import { createTimestampedSchema } from "../schema-utils";

export const newFeatureSchema = createTimestampedSchema({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
});
```

2. **Export from index**:
```typescript
// src/schemas/index.ts
export const featureSchemas = {
  newFeature: (await import('./feature/new-feature')).newFeatureSchema
};
```

3. **Use in routes**:
```typescript
import { featureSchemas, createValidationMiddleware } from "../schemas";

app.post("/api/features",
  createValidationMiddleware(featureSchemas.newFeature),
  async (c) => {
    const data = getValidatedData(c);
    // Handle feature creation
  }
);
```

## 🔧 Troubleshooting

### Common Issues

1. **TypeScript errors with Zod types**:
```typescript
// Solution: Use proper type imports
import type { z } from "zod";
// Instead of: import { z } from "zod";
```

2. **Validation middleware not working**:
```typescript
// Ensure middleware is applied before route handler
app.post("/endpoint", 
  createValidationMiddleware(schema), // ✅ First
  async (c) => { /* handler */ }     // ✅ Second
);
```

3. **Custom validation not triggering**:
```typescript
// Use refine with proper path specification
schema.refine(data => condition, {
  message: "Error message",
  path: ["fieldName"] // ✅ Specify field
});
```

### Performance Tips

1. **Cache validation results** for repeated data
2. **Use lazy loading** for complex schemas
3. **Strip unknown fields** to reduce payload size
4. **Abort early** when only first error matters

## 📚 Additional Resources

- [Zod Documentation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [OpenBAuth API Documentation](./api.md)
- [Validation Examples](./validation-examples.md)

## 🤝 Contributing

When adding new schemas:

1. Follow the established naming conventions
2. Include comprehensive error messages
3. Add TypeScript types for all schemas
4. Document complex validation logic
5. Test with edge cases
6. Update this guide with new patterns