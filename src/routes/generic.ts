import { Hono } from "hono";
import { z } from "zod";
import { getServiceFactory } from "../services/service-factory";
import { defaultLogger } from "../utils/logger";
// import { isSystemTable } from "../utils/system-tables";
import { BaseController } from "open-bauth";
import { db } from "@/db";
import type { AppVariables } from "../types/app-context";
import  {type TableSchema } from "open-bauth";
import { getZodSchema,getSchemas,extractor,getDefaultSchemas } from '../database/base-controller';
export const genericData = new Hono<{ Variables: AppVariables }>();
const factory = getServiceFactory();
const services = factory.getServices();

// Validation schemas
const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  fields: z.string().optional()
});

// Schema for dynamic data (create/update/bulk operations)
// Using z.record to allow any key-value pairs while still providing structure
const dynamicDataSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.date(),
    z.unknown(),
    z.array(z.unknown())
  ])
);

// Schema for search parameters - use z.record for dynamic keys
type SearchParams = {
  search?: string;
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | unknown[];
};

// Schema for query options (pagination, sorting, etc.)
type QueryOptions = {
  limit?: number;
  offset?: number;
  page?: number;
  orderBy?: string;
  order?: "asc" | "desc";
  where?: Record<string, unknown>;
  fields?: string;
};

const createSchema = z.object({
  data: dynamicDataSchema
});

const updateSchema = z.object({
  data: dynamicDataSchema
});

const bulkSchema = z.object({
  records: z.array(dynamicDataSchema)
});

// Store controllers in a Map for reuse
const controllers = new Map<string, BaseController>();

// Helper function to get or create controller
function getController(tableName: string): BaseController {
  if (!controllers.has(tableName)) {
    const controller = services.dbInitializer.createController(tableName);
    controllers.set(tableName, controller);
  }
  return controllers.get(tableName)!;
}

// GET /api/v1/data/tables - List all tables
genericData.get("/tables", async (c) => {
  try {
    const { getSchemas } = await import("../database/base-controller");
    const schemas = await getSchemas();
    return c.json({
      success: true,
      data: schemas
    });
  } catch (error) {
    defaultLogger.error("List tables error", error as Error);
    return c.json({ success: false, error: "Failed to list tables" }, 500);
  }
});

// Middleware to validate table name and create controller
genericData.use("/:tableName/*", async (c, next) => {
  const tableName = c.req.param("tableName");

  // Check if it's a system table
  // if (isSystemTable(tableName)) {
  //   return c.json({
  //     success: false,
  //     error: "Access to system tables is forbidden"
  //   }, 403);
  // }

  try {
    // Store table name in context
    c.set('tableName', tableName);

    // Log access for audit
    const auth = c.get('auth');
    const userId = auth?.user?.id || 'anonymous';
    await services.auditService.logApiEvent('generic.access', userId, {
      ip: c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || '',
      statusCode: 200
    });

    await next();
    return; // Explicit return to satisfy TypeScript
  } catch (error) {
    defaultLogger.error(`Failed to create controller for table ${tableName}`, error as Error);
    return c.json({
      success: false,
      error: "Table not found or access denied"
    }, 404);
  }
});

// GET /api/v1/data/:tableName/schema - Get table schema
genericData.get("/:tableName/schema", async (c) => {
  try {
    const tableName = c.get('tableName')!;    
    let tableSchema: TableSchema;
    let zodSchema:  z.ZodObject<any, z.core.$strip>;

    // First try to get from registered schemas
    const allSchemas = getDefaultSchemas();
    const schemaResponse = allSchemas.find((s) => s.tableName === tableName);

    if (schemaResponse) {
      tableSchema = schemaResponse as TableSchema;
      // Generate Zod schema from registered TableSchema
      zodSchema = getZodSchema(tableSchema);
    } else {      
      const tableInfo = await extractor.getTableInfo(tableName);
      if (!tableInfo) {
        return c.json({ success: false, error: "Schema not found for table" }, 404);
      }
      
      // Convert TableInfo to TableSchema
      const dynamicTableSchema: TableSchema = {
        tableName: tableInfo.tableName,
        columns: tableInfo.columns.map(col => ({
          name: col.name,
          type: col.type as any, // Type assertion to handle ColumnType compatibility
          primaryKey: col.pk === 1,
          notNull: col.notnull === 1,
          defaultValue: col.dflt_value
        }))
      };
      
      // Generate Zod schema dynamically from table schema
      zodSchema = extractor.generateZodSchema(dynamicTableSchema);
    }

    // Convert Zod schema to JSON Schema
    // Handle unrepresentable types like Date by converting them to any
    const jsonSchema = z.toJSONSchema(zodSchema, {
      unrepresentable: "any",
      override: (ctx) => {
        // Custom handling for Date types - convert to string with date-time format
        const def = ctx.zodSchema._zod?.def;
        if (def && def.type === "date") {
          ctx.jsonSchema.type = "string";
          ctx.jsonSchema.format = "date-time";
        }
      }
    });

    return c.json({
      success: true,
      schema: jsonSchema
    });

  } catch (error) {
    defaultLogger.error("Schema retrieval error", error as Error);
    return c.json({
      success: false,
      error: "Failed to retrieve table schema"
    }, 500);
  }
});
// GET /api/v1/data/:tableName/schemaInfo - Get table schemaInfo
genericData.get("/:tableName/schemaInfo", async (c) => {
  try {
    const tableName = c.get('tableName')!;    
    // First try to get from registered schemas
    const allSchemas = await getSchemas();
    const schemaResponse = allSchemas.find((s) => s.tableName === tableName);
    return c.json({
      success: true,
      schema: schemaResponse
    });
  }catch(e){
    defaultLogger.error("SchemaInfo retrieval error", e as Error);
    return c.json({
      success: false,
      error: "Failed to retrieve table schemaInfo"
    }, 500);
  }

})



// GET /api/v1/data/:tableName/count - Get record count (MUST BE BEFORE /:tableName/:id)
genericData.get("/:tableName/count", async (c) => {
  try {
    const tableName = c.get('tableName')!;
    const controller = getController(tableName);
    const query = c.req.query();

    // Build filter from query parameters
    const filters: Record<string, unknown> = {};
    Object.entries(query).forEach(([key, value]) => {
      if (value) {
        try {
          filters[key] = JSON.parse(value);
        } catch {
          filters[key] = value;
        }
      }
    });

    const countResult = await controller.count(Object.keys(filters).length > 0 ? filters : undefined);
    const count = typeof countResult === 'object' && countResult !== null && 'data' in countResult
      ? countResult.data
      : countResult;

    return c.json({
      success: true,
      count: count
    });

  } catch (error) {
    defaultLogger.error("Count records error", error as Error);
    return c.json({
      success: false,
      error: "Failed to count records"
    }, 500);
  }
});

// GET /api/v1/data/:tableName/search - Advanced search (MUST BE BEFORE /:tableName/:id)
genericData.get("/:tableName/search", async (c) => {
  try {
    const tableName = c.get('tableName')!;
    const controller = getController(tableName);
    const query = c.req.query();

    // Parse search parameters using typed interfaces
    const searchParams: SearchParams = {};
    const options: QueryOptions = {};

    Object.entries(query).forEach(([key, value]) => {
      if (key === 'q' || key === 'query') {
        searchParams.search = value;
      } else if (key === 'limit') {
        options.limit = Math.min(parseInt(value) || 20, 100);
      } else if (key === 'offset') {
        options.offset = parseInt(value) || 0;
      } else if (key === 'sort') {
        options.orderBy = value;
      } else if (key === 'order') {
        options.order = value === 'asc' || value === 'desc' ? value : 'asc';
      } else if (value) {
        // Add to search filters
        try {
          searchParams[key] = JSON.parse(value);
        } catch {
          searchParams[key] = value;
        }
      }
    });

    const result = await controller.search(searchParams, options);

    // Ensure result has proper structure
    const responseData = Array.isArray(result) ? result : (result?.data || []);
    const total = typeof result === 'object' && 'total' in result ? result.total : responseData.length;

    return c.json({
      success: true,
      data: responseData,
      total: total
    });

  } catch (error) {
    defaultLogger.error("Search records error", error as Error);
    return c.json({
      success: false,
      error: "Failed to search records"
    }, 500);
  }
});

// GET /api/v1/data/:tableName - List records with pagination and filtering
genericData.get("/:tableName", async (c) => {
  try {
    const tableName = c.get('tableName')!;
    const controller = getController(tableName);
    const query = c.req.query();

    // Parse and validate query parameters
    const validated = querySchema.parse(query);

    // Build filter from query parameters (excluding pagination params)
    const filters: Record<string, unknown> = {};
    Object.entries(query).forEach(([key, value]) => {
      if (!['page', 'limit', 'sort', 'order', 'fields'].includes(key) && value) {
        // Try to parse as JSON for complex filters
        try {
          filters[key] = JSON.parse(value);
        } catch {
          filters[key] = value;
        }
      }
    });

    // Pagination
    const page = validated.page || 1;
    const limit = Math.min(validated.limit || 20, 100); // Max 100 items per page
    const offset = (page - 1) * limit;

    // Build options with direct SQL query if field selection is requested
    type QueryResult = {
      data: Record<string, unknown>[];
      total: number;
    };

    let result: QueryResult;

    if (validated.fields || validated.sort) {
      // Use raw SQL for field selection or sorting
      const selectedFields = validated.fields
        ? validated.fields.split(',').map(f => f.trim()).join(', ')
        : '*';
      let sql = `SELECT ${selectedFields} FROM ${tableName}`;
      const params: (string | number)[] = [];

      // Add WHERE clause if filters exist
      if (Object.keys(filters).length > 0) {
        const whereClauses = Object.entries(filters).map(([key, value]) => {
          params.push(value as string | number);
          return `${key} = ?`;
        });
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      // Add ORDER BY if sort is specified
      if (validated.sort) {
        sql += ` ORDER BY ${validated.sort} ${(validated.order || 'asc').toUpperCase()}`;
      }

      // Add pagination
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // Get total count for pagination
      let countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
      if (Object.keys(filters).length > 0) {
        const whereClauses = Object.entries(filters).map(([key]) => `${key} = ?`);
        countSql += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      const countResult = db.query(countSql).all(...Object.values(filters).map(v => v as string | number)) as { count: number }[];
      const total = countResult[0]?.count || 0;

      // Execute main query
      const data = db.query(sql).all(...params);
      result = { data: data as Record<string, unknown>[], total };
    } else {
      // Use controller's findAll method for standard queries
      const options: QueryOptions = {
        limit,
        offset
      };
      
      if (Object.keys(filters).length > 0) {
        options.where = filters;
      }

      // Sorting - combine orderBy and order into SQL clause
      if (validated.sort) {
        options.orderBy = `${validated.sort} ${(validated.order || 'asc').toUpperCase()}`;
      }

      // DEBUG: Log options
      defaultLogger.info(`[GENERIC] findAll options:`, options);

      // Execute query - cast options to proper type
      result = await controller.findAll(options as any) as QueryResult;

      // DEBUG: Log result
      defaultLogger.info(`[GENERIC] findAll result:`, { dataLength: result.data?.length, firstItem: result.data?.[0] });
    }

    // Add pagination metadata
    const response = {
      success: true,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total || 0,
        totalPages: Math.ceil((result.total || 0) / limit),
        hasNext: page * limit < (result.total || 0),
        hasPrev: page > 1
      }
    };

    return c.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: "Invalid query parameters",
        details: error.issues
      }, 400);
    }

    defaultLogger.error("List records error", error as Error);
    return c.json({
      success: false,
      error: "Failed to retrieve records"
    }, 500);
  }
});

// GET /api/v1/data/:tableName/:id - Get single record
genericData.get("/:tableName/:id", async (c) => {
  try {
    const tableName = c.get('tableName')!;
    const controller = getController(tableName);
    const id = c.req.param("id");

    const result = await controller.findById(id);

    if (!result.success || !result.data) {
      return c.json({
        success: false,
        error: "Record not found"
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    defaultLogger.error("Get record error", error as Error);
    return c.json({
      success: false,
      error: "Failed to retrieve record"
    }, 500);
  }
});

// POST /api/v1/data/:tableName - Create new record
genericData.post("/:tableName", async (c) => {
  try {
    const tableName = c.get('tableName')!;
    const controller = getController(tableName);
    const body = await c.req.json();
    const validated = createSchema.parse(body);

    const result = await controller.create(validated.data);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || "Failed to create record"
      }, 400);
    }

    // Log creation for audit
    const auth = c.get('auth');
    const userId = auth?.user?.id || 'anonymous';
    await services.auditService.logApiEvent('generic.create', userId, {
      ip: c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || '',
      statusCode: 201
    });

    return c.json({
      success: true,
      data: result.data
    }, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: "Invalid request data",
        details: error.issues
      }, 400);
    }

    defaultLogger.error("Create record error", error as Error);
    return c.json({
      success: false,
      error: "Failed to create record"
    }, 500);
  }
});

// PUT /api/v1/data/:tableName/:id - Update record
genericData.put("/:tableName/:id", async (c) => {
  try {
    const tableName = c.get('tableName')!;
    const controller = getController(tableName);
    const id = c.req.param("id");
    const body = await c.req.json();
    const validated = updateSchema.parse(body);

    const result = await controller.update(id, validated.data);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || "Failed to update record"
      }, 400);
    }

    // Log update for audit
    const auth = c.get('auth');
    const userId = auth?.user?.id || 'anonymous';
    await services.auditService.logApiEvent('generic.update', userId, {
      ip: c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || '',
      statusCode: 200
    });

    return c.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: "Invalid request data",
        details: error.issues
      }, 400);
    }

    defaultLogger.error("Update record error", error as Error);
    return c.json({
      success: false,
      error: "Failed to update record"
    }, 500);
  }
});

// DELETE /api/v1/data/:tableName/:id - Delete record
genericData.delete("/:tableName/:id", async (c) => {
  try {
    const tableName = c.get('tableName')!;
    const controller = getController(tableName);
    const id = c.req.param("id");

    const result = await controller.delete(id);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || "Failed to delete record"
      }, 400);
    }

    // Log deletion for audit
    const auth = c.get('auth');
    const userId = auth?.user?.id || 'anonymous';
    await services.auditService.logApiEvent('generic.delete', userId, {
      ip: c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || '',
      statusCode: 200
    });

    return c.json({
      success: true,
      message: "Record deleted successfully"
    });

  } catch (error) {
    defaultLogger.error("Delete record error", error as Error);
    return c.json({
      success: false,
      error: "Failed to delete record"
    }, 500);
  }
});

// POST /api/v1/data/:tableName/bulk - Bulk operations
genericData.post("/:tableName/bulk", async (c) => {
  try {
    const tableName = c.get('tableName')!;
    const controller = getController(tableName);
    const body = await c.req.json();
    const validated = bulkSchema.parse(body);

    // Validate each record
    for (const record of validated.records) {
      if (!record || typeof record !== 'object') {
        return c.json({
          success: false,
          error: "Invalid record format"
        }, 400);
      }
    }

    // Perform bulk insert
    const results = await Promise.all(
      validated.records.map(record => controller.create(record))
    );

    type ControllerResult = {
      success: boolean;
      error?: string;
      data?: Record<string, unknown>;
    };

    const successful = results.filter((r: ControllerResult) => r.success);
    const failed = results.filter((r: ControllerResult) => !r.success);

    // Log bulk operation for audit
    const auth = c.get('auth');
    const userId = auth?.user?.id || 'anonymous';
    await services.auditService.logApiEvent('generic.bulk.create', userId, {
      ip: c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || '',
      statusCode: 200
    });

    return c.json({
      success: true,
      results: {
        total: validated.records.length,
        successful: successful.length,
        failed: failed.length,
        errors: failed.map((r: ControllerResult, i: number) => ({ index: i, error: r.error }))
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: "Invalid request data",
        details: error.issues
      }, 400);
    }

    defaultLogger.error("Bulk operation error", error as Error);
    return c.json({
      success: false,
      error: "Failed to perform bulk operation"
    }, 500);
  }
});


export { genericData as genericRoutes };
