/**
 * OpenBAuth Schema Library
 * Comprehensive Zod schemas for validation, autocomplete, and type safety
 *
 * @example
 * ```typescript
 * import { schemas, validateData, createValidationMiddleware } from '@/schemas';
 * import { loginSchema } from '@/schemas/auth';
 *
 * // Validate data directly
 * const result = validateData(loginSchema, { email: 'user@example.com', password: 'password123' });
 *
 * // Use in middleware
 * app.post('/login', createValidationMiddleware(loginSchema), (c) => {
 *   const data = getValidatedData(c);
 *   // data is now typed as LoginInput
 * });
 * ```

import { z } from "zod";
 */

// ==================== CORE VALIDATION SCHEMAS ====================
export * from './validation-schemas';

// ==================== SCHEMA UTILITIES ====================
export * from './schema-utils';

// ==================== VALIDATION MIDDLEWARE ====================
export * from '../middleware/validation';

// ==================== AUTH SCHEMAS ====================
export const authSchemas = {
  login: (await import('./validation-schemas')).schemas.auth.login,
  register: (await import('./validation-schemas')).schemas.auth.register,
  refresh: (await import('./validation-schemas')).schemas.auth.refresh,
  forgotPassword: (await import('./validation-schemas')).schemas.auth.forgotPassword,
  resetPassword: (await import('./validation-schemas')).schemas.auth.resetPassword,
  verifyEmail: (await import('./validation-schemas')).schemas.auth.verifyEmail,
  anonymous: (await import('./validation-schemas')).schemas.auth.anonymous
};

// ==================== USER SCHEMAS ====================
export const userSchemas = {
  updateProfile: (await import('./validation-schemas')).schemas.user.updateProfile,
  updatePassword: (await import('./validation-schemas')).schemas.user.updatePassword,
  create: (await import('./validation-schemas')).schemas.user.create
};

// ==================== MFA SCHEMAS ====================
export const mfaSchemas = {
  setup: (await import('./validation-schemas')).schemas.mfa.setup,
  verify: (await import('./validation-schemas')).schemas.mfa.verify
};

// ==================== DEVICE SCHEMAS ====================
export const deviceSchemas = {
  register: (await import('./validation-schemas')).schemas.device.register,
  biometric: (await import('./validation-schemas')).schemas.device.biometric
};

// ==================== PERMISSION & ROLE SCHEMAS ====================
export const permissionSchemas = {
  create: (await import('./validation-schemas')).schemas.permission.create,
  update: (await import('./validation-schemas')).schemas.permission.update
};

export const roleSchemas = {
  create: (await import('./validation-schemas')).schemas.role.create,
  update: (await import('./validation-schemas')).schemas.role.update
};

// ==================== OAUTH SCHEMAS ====================
export const oauthSchemas = {
  createClient: (await import('./validation-schemas')).schemas.oauth.createClient,
  authorization: (await import('./validation-schemas')).schemas.oauth.authorization
};

// ==================== UTILITY SCHEMAS ====================
export const utilitySchemas = {
  pagination: (await import('./validation-schemas')).schemas.utility.pagination,
  search: (await import('./validation-schemas')).schemas.utility.search,
  idParam: (await import('./validation-schemas')).schemas.utility.idParam
};

// ==================== REUSABLE VALIDATORS ====================
export const validators = {
  // Basic validators
  email: (await import('./validation-schemas')).emailValidator,
  password: (await import('./validation-schemas')).passwordValidator,
  username: (await import('./validation-schemas')).usernameValidator,
  name: (await import('./validation-schemas')).nameValidator,
  phone: (await import('./validation-schemas')).phoneValidator,
  url: (await import('./validation-schemas')).urlValidator,
  timezone: (await import('./validation-schemas')).timezoneValidator,
  language: (await import('./validation-schemas')).languageValidator,
  
  // Advanced validators
  slug: (await import('./schema-utils')).slugValidator,
  hexColor: (await import('./schema-utils')).hexColorValidator,
  ipAddress: (await import('./schema-utils')).ipAddressValidator,
  metadata: (await import('./schema-utils')).metadataValidator,
  userFriendlyId: (await import('./schema-utils')).userFriendlyIdValidator,
  secureToken: (await import('./schema-utils')).secureTokenValidator,
  filePath: (await import('./schema-utils')).filePathValidator,
  
  // Transform utilities
  trim: (await import('./schema-utils')).trimTransform,
  lowercase: (await import('./schema-utils')).lowercaseTransform,
  uppercase: (await import('./schema-utils')).uppercaseTransform,
  dateString: (await import('./schema-utils')).dateStringTransform
};

// ==================== TYPE EXPORTS ====================
export type {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UpdatePasswordInput,
  MFASetupInput,
  MFAVerifyInput,
  DeviceInput,
  BiometricInput,
  CreatePermissionInput,
  CreateRoleInput,
  PaginationInput,
  SearchInput
} from './validation-schemas';

export type {
  SlugValidator,
  HexColorValidator,
  IpAddressValidator,
  MetadataValidator,
  UserFriendlyIdValidator,
  SecureTokenValidator,
  FilePathValidator
} from './schema-utils';

// ==================== SCHEMA CATEGORIES ====================
export const schemaCategories = {
  auth: authSchemas,
  user: userSchemas,
  mfa: mfaSchemas,
  device: deviceSchemas,
  permission: permissionSchemas,
  role: roleSchemas,
  oauth: oauthSchemas,
  utility: utilitySchemas
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Gets a schema by category and name
 */
export function getSchema(category: keyof typeof schemaCategories, name: string): import('zod').ZodSchema | undefined {
  const categorySchemas = schemaCategories[category];
  return (categorySchemas as any)[name];
}

/**
 * Validates data against a schema and returns typed result
 */
export async function validateSchema<T>(
  schema: import('zod').ZodSchema<T>,
  data: unknown,
  options?: Parameters<typeof import('../middleware/validation').validateData>[2]
): Promise<import('../middleware/validation').ValidationResult<T>> {
  const { validateData } = await import('../middleware/validation');
  return validateData(schema, data, options);
}

/**
 * Creates a validation middleware for a specific schema
 */
export function createSchemaValidationMiddleware<T>(
  schema: import('zod').ZodSchema<T>,
  options?: Parameters<typeof import('../middleware/validation').createValidationMiddleware>[1]
) {
  const { createValidationMiddleware } = require('../middleware/validation');
  return createValidationMiddleware(schema, options);
}

/**
 * Combines multiple schemas into one
 */
export function combineSchemas<T extends Record<string, import('zod').ZodSchema>>(
  schemas: T
): import('zod').ZodObject<{ [K in keyof T]: T[K] }> {
  const { z } = require('zod');
  return z.object(schemas);
}

/**
 * Creates a partial schema from a base schema (all fields optional)
 */
export function createPartialSchema<T extends import('zod').ZodRawShape>(
  shape: T
): import('zod').ZodObject<{ [K in keyof T]: import('zod').ZodOptional<T[K]> }> {
  const { z } = require('zod');
  return z.object(shape).partial();
}

/**
 * Creates a required schema from a base schema (all fields required)
 */
export function createRequiredSchema<T extends import('zod').ZodRawShape>(
  shape: T
): import('zod').ZodObject<T> {
  const { z } = require('zod');
  const requiredShape: any = {};
  
  for (const [key, schema] of Object.entries(shape)) {
    requiredShape[key] = schema instanceof z.ZodOptional
      ? (schema as any).unwrap()
      : schema;
  }
  
  return z.object(requiredShape);
}

// ==================== SCHEMA DOCUMENTATION ====================

/**
 * Gets schema documentation
 */
export function getSchemaDocumentation(schema: import('zod').ZodSchema): string {
  const { z } = require('zod');
  if (schema instanceof z.ZodObject) {
    const shape = (schema as any).shape;
    const fields = Object.entries(shape).map(([key, fieldSchema]: [string, any]) => {
      const isOptional = fieldSchema instanceof z.ZodOptional;
      const fieldType = getSchemaType(fieldSchema);
      return `  ${key}${isOptional ? '?' : ''}: ${fieldType}`;
    });
    
    return `Object Schema:\n${fields.join('\n')}`;
  }
  
  return `Schema Type: ${getSchemaType(schema)}`;
}

/**
 * Gets the type name of a schema
 */
function getSchemaType(schema: import('zod').ZodSchema): string {
  const { z } = require('zod');
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodArray) return `array<${getSchemaType((schema as any).element)}>`;
  if (schema instanceof z.ZodObject) return "object";
  if (schema instanceof z.ZodOptional) return `optional<${getSchemaType((schema as any).unwrap())}>`;
  if (schema instanceof z.ZodUnion) return "union";
  if (schema instanceof z.ZodEnum) return "enum";
  return "unknown";
}

// ==================== DEFAULT EXPORT ====================
export default {
  schemas: schemaCategories,
  validators,
  utils: {
    getSchema,
    validateSchema,
    createSchemaValidationMiddleware,
    combineSchemas,
    createPartialSchema,
    createRequiredSchema,
    getSchemaDocumentation
  }
};
