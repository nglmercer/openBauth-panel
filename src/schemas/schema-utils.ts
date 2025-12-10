/**
 * Schema utilities and helpers for OpenBAuth
 * Provides reusable functions and utilities for schema validation
 */

import { z } from "zod";

// ==================== SCHEMA BUILDERS ====================

/**
 * Creates a paginated response schema
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int().min(1),
      limit: z.number().int().min(1).max(100),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
      hasNext: z.boolean(),
      hasPrev: z.boolean()
    })
  });
}

/**
 * Creates a standard API response schema
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    details: z.array(z.object({
      field: z.string(),
      message: z.string(),
      code: z.string()
    })).optional(),
    meta: z.object({
      timestamp: z.string().datetime(),
      requestId: z.string().optional(),
      version: z.string().optional()
    }).optional()
  });
}

/**
 * Creates a timestamped entity schema
 */
export function createTimestampedSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object({
    ...shape,
    id: z.string().uuid(),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional()
  });
}

/**
 * Creates a soft-delete entity schema
 */
export function createSoftDeleteSchema<T extends z.ZodRawShape>(shape: T) {
  return createTimestampedSchema({
    ...shape,
    deleted_at: z.string().datetime().optional(),
    is_deleted: z.boolean().optional().default(false)
  });
}

// ==================== CUSTOM VALIDATORS ====================

/**
 * Creates a conditional validator
 */
export function createConditionalValidator<T>(
  condition: (value: T) => boolean,
  message: string
) {
  return (value: T) => {
    if (!condition(value)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message,
          path: []
        }
      ]);
    }
    return value;
  };
}

/**
 * Creates a unique validator (checks against existing values)
 */
export function createUniqueValidator<T>(
  existingValues: T[],
  message: string = "Value must be unique"
) {
  return (value: T) => {
    if (existingValues.includes(value)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message,
          path: []
        }
      ]);
    }
    return value;
  };
}

/**
 * Creates a range validator
 */
export function createRangeValidator(
  min: number,
  max: number,
  message?: string
) {
  return z.number().refine(
    (value) => value >= min && value <= max,
    {
      message: message || `Value must be between ${min} and ${max}`
    }
  );
}

/**
 * Creates a date range validator
 */
export function createDateRangeValidator(
  minDate?: Date,
  maxDate?: Date,
  message?: string
) {
  return z.string().datetime().refine(
    (dateStr) => {
      const date = new Date(dateStr);
      if (minDate && date < minDate) return false;
      if (maxDate && date > maxDate) return false;
      return true;
    },
    {
      message: message || `Date must be within valid range`
    }
  );
}

// ==================== STRING VALIDATORS ====================

/**
 * Creates a slug validator
 */
export const slugValidator = z
  .string()
  .regex(/^[a-z0-9-]+$/, {
    message: "Slug can only contain lowercase letters, numbers, and hyphens"
  })
  .min(1, "Slug is required")
  .max(100, "Slug must be 100 characters or less");

/**
 * Creates a hex color validator
 */
export const hexColorValidator = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, {
    message: "Color must be in hex format (#RRGGBB)"
  });

/**
 * Creates an IP address validator
 */
export const ipAddressValidator = z
  .string()
  .refine(
    (ip) => {
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6Regex = /^([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}$/;
      return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    },
    {
      message: "Invalid IP address format"
    }
  );

// ==================== ARRAY VALIDATORS ====================

/**
 * Creates a unique array validator
 */
export function createUniqueArrayValidator<T>(itemSchema: z.ZodType<T>) {
  return z.array(itemSchema).refine(
    (items) => {
      const uniqueItems = new Set(items);
      return uniqueItems.size === items.length;
    },
    {
      message: "Array must contain unique items"
    }
  );
}

/**
 * Creates a sorted array validator
 */
export function createSortedArrayValidator<T>(
  compareFn: (a: T, b: T) => number,
  message: string = "Array must be sorted"
) {
  return z.array(z.unknown()).refine(
    (items) => {
      for (let i = 1; i < items.length; i++) {
        if (compareFn(items[i - 1] as T, items[i] as T) > 0) {
          return false;
        }
      }
      return true;
    },
    { message }
  );
}

// ==================== OBJECT VALIDATORS ====================

/**
 * Creates a nested object validator with depth limit
 */
export function createNestedObjectValidator(maxDepth: number = 5) {
  const createValidator = (depth: number): z.ZodType<any> => {
    if (depth >= maxDepth) {
      return z.unknown();
    }
    
    return z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(createValidator(depth + 1)),
      z.record(createValidator(depth + 1))
    ]);
  };
  
  return z.record(createValidator(0));
}

/**
 * Creates a metadata validator
 */
export const metadataValidator = z
  .record(z.unknown())
  .refine(
    (metadata) => JSON.stringify(metadata).length <= 10000,
    {
      message: "Metadata must be 10KB or less"
    }
  )
  .optional()
  .default({});

// ==================== ENUM VALIDATORS ====================

/**
 * Creates a case-insensitive enum validator
 */
export function createCaseInsensitiveEnumValidator<T extends string>(
  values: readonly T[],
  message?: string
) {
  return z
    .string()
    .transform((value) => value.toLowerCase() as T)
    .refine(
      (value) => values.map(v => v.toLowerCase()).includes(value),
      {
        message: message || `Value must be one of: ${values.join(", ")}`
      }
    );
}

/**
 * Creates a strict enum validator
 */
export function createStrictEnumValidator<T extends string>(
  values: readonly [T, ...T[]],
  message?: string
) {
  return z.enum(values, {
    errorMap: () => ({ message: message || `Value must be one of: ${values.join(", ")}` })
  });
}

// ==================== TRANSFORM UTILITIES ====================

/**
 * Creates a trim transform
 */
export const trimTransform = z.string().transform((value) => value.trim());

/**
 * Creates a lowercase transform
 */
export const lowercaseTransform = z.string().transform((value) => value.toLowerCase());

/**
 * Creates an uppercase transform
 */
export const uppercaseTransform = z.string().transform((value) => value.toUpperCase());

/**
 * Creates a date string transform
 */
export const dateStringTransform = z
  .string()
  .transform((value) => new Date(value).toISOString());

// ==================== COMPOSITE VALIDATORS ====================

/**
 * Creates a user-friendly ID validator
 */
export const userFriendlyIdValidator = z
  .string()
  .min(1, "ID is required")
  .max(50, "ID must be 50 characters or less")
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message: "ID can only contain letters, numbers, underscores, and hyphens"
  });

/**
 * Creates a secure token validator
 */
export const secureTokenValidator = z
  .string()
  .min(16, "Token must be at least 16 characters")
  .max(512, "Token must be 512 characters or less")
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Token can only contain letters, numbers, underscores, and hyphens"
  });

/**
 * Creates a file path validator
 */
export const filePathValidator = z
  .string()
  .regex(/^[a-zA-Z0-9_\-./]+$/, {
    message: "File path contains invalid characters"
  })
  .refine(
    (path) => !path.includes("..") && !path.startsWith("/"),
    {
      message: "File path must be relative and cannot contain directory traversal"
    }
  );

// ==================== VALIDATION HELPERS ====================

/**
 * Creates a validation pipeline
 */
export function createValidationPipeline<T>(
  ...validators: Array<(value: T) => T>
) {
  return (value: T): T => {
    return validators.reduce((acc, validator) => validator(acc), value);
  };
}

/**
 * Creates a conditional schema
 */
export function createConditionalSchema<T extends z.ZodRawShape>(
  condition: (data: unknown) => boolean,
  trueSchema: z.ZodObject<T>,
  falseSchema: z.ZodObject<T>
) {
  return z.union([trueSchema, falseSchema]).refine(
    (data) => {
      if (condition(data)) {
        return trueSchema.safeParse(data).success;
      } else {
        return falseSchema.safeParse(data).success;
      }
    },
    {
      message: "Data does not match conditional requirements"
    }
  );
}

/**
 * Creates a schema with dynamic validation
 */
export function createDynamicSchema<T>(
  schemaFn: (context: unknown) => z.ZodSchema<T>
) {
  return z.unknown().transform((data, ctx) => {
    const schema = schemaFn(data);
    const result = schema.safeParse(data);
    
    if (!result.success) {
      result.error.issues.forEach(issue => {
        ctx.addIssue(issue);
      });
      return z.NEVER;
    }
    
    return result.data;
  });
}

// ==================== EXPORT TYPES ====================

export type SlugValidator = z.infer<typeof slugValidator>;
export type HexColorValidator = z.infer<typeof hexColorValidator>;
export type IpAddressValidator = z.infer<typeof ipAddressValidator>;
export type MetadataValidator = z.infer<typeof metadataValidator>;
export type UserFriendlyIdValidator = z.infer<typeof userFriendlyIdValidator>;
export type SecureTokenValidator = z.infer<typeof secureTokenValidator>;
export type FilePathValidator = z.infer<typeof filePathValidator>;