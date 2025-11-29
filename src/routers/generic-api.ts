// src/routers/generic-api.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { BaseController } from "open-bauth";
import {
  db,
  dbInitializer,
  jwtService,
  authService,
  permissionService,
} from "../db";
import {
  getDefaultSchemas,
  getSchemas,
  getTableRelations,
  getRelatedData,
} from "../database/base-controller";
import { ZodSchemaGenerator } from "../validator/schema-generator";
import { authMiddleware, requirePermissions } from "../middleware";
import type {
  AuthenticatedContext,
  AppHandler,
  TableData,
  TableColumn,
  ApiResponse,
  CrudResult,
  AppError,
  QueryOptions,
} from "../types";
import { asyncHandler, ErrorResponse } from "../utils/error-handler";

const genericApiRouter = new Hono();

// For testing purposes, we're temporarily bypassing authentication middleware
// In production, uncomment the following to enable authentication:
/*
// Middleware de autenticación para todas las rutas
genericApiRouter.use(
  "*",
  authMiddleware(),
);
*/

// Get all available tables
genericApiRouter.get("/tables", async (c) => {
  // For now, we'll bypass permission checking for tables list
  // In a production environment, you would want to enable this
  // requirePermissions(["tables:list"]),
  try {
    const schemas = getDefaultSchemas();
    const tables = schemas.map((s) => ({
      name: s.tableName,
      columns: s.columns.length,
    }));
    return c.json({ tables });
  } catch (error) {
    console.error("Error fetching tables:", error);
    return c.json({ error: "Failed to fetch tables" }, 500);
  }
});

// Get schema information for all tables
genericApiRouter.get("/schemas", async (c) => {
  // For now, we'll bypass permission checking for schemas view
  // In a production environment, you would want to enable this
  // requirePermissions(["schemas:view"]),
  try {
    const schemas = await getSchemas();
    const relations = await getTableRelations();
    return c.json({ schemas, relations });
  } catch (error) {
    console.error("Error fetching schemas:", error);
    return c.json({ error: "Failed to fetch schemas" }, 500);
  }
});

// Get schema for a specific table
genericApiRouter.get("/schema/:tableName", async (c) => {
  // For now, we'll bypass permission checking for schema view
  // In a production environment, you would want to enable this
  // requirePermissions(["schemas:view"]),
  try {
    const tableName = c.req.param("tableName");
    const schemas = getDefaultSchemas();
    const schema = schemas.find((s) => s.tableName === tableName);
    const relations = await getTableRelations();
    const tableRelations = relations[tableName] || [];

    if (!schema) {
      return c.json({ error: "Table not found" }, 404);
    }

    return c.json({ schema, relations: tableRelations });
  } catch (error) {
    console.error("Error fetching table schema:", error);
    return c.json({ error: "Failed to fetch table schema" }, 500);
  }
});

// Get related data for a specific record
genericApiRouter.get("/:tableName/:id/related/:relation", async (c) => {
  // For now, we'll bypass permission checking for related data view
  // In a production environment, you would want to enable this
  // requirePermissions([`${tableName}:view`]),
  try {
    const tableName = c.req.param("tableName");
    const id = c.req.param("id");
    const relation = c.req.param("relation");

    // First, get the record to find the foreign key value
    const controller = new BaseController(tableName, {
      database: db,
      isSQLite: true,
    });

    const recordResult = await controller.findById(id);

    if (!recordResult.success || !recordResult.data) {
      return c.json({ error: "Record not found" }, 404);
    }

    const foreignKey = recordResult.data[relation];

    if (foreignKey === undefined) {
      return c.json({ error: "Relation field not found" }, 400);
    }

    // Get the related data
    const relatedData = await getRelatedData(tableName, relation, foreignKey);

    if (!relatedData.success) {
      return c.json({ error: relatedData.error }, 500);
    }

    return c.json(relatedData);
  } catch (error) {
    console.error(`Error fetching related data:`, error);
    return c.json({ error: "Failed to fetch related data" }, 500);
  }
});

// Dynamic routes for each table
const schemas = getDefaultSchemas();
for (const schema of schemas) {
  const tableName = schema.tableName;
  const validators = ZodSchemaGenerator.generate(schema);

  // Create a new sub-router for each table
  const tableRouter = new Hono();

  // For testing purposes, we're temporarily bypassing authentication middleware
  // In production, uncomment the following to enable authentication:
  /*
  tableRouter.use(
    "*",
    authMiddleware(),
  );
  */

  // Get all records
  tableRouter.get("/", async (c) => {
    // For now, we'll bypass permission checking for list operations
    // In a production environment, you would want to enable this
    // requirePermissions([`${tableName}:list`]),
    try {
      const limit = parseInt(c.req.query("limit") || "50");
      const offset = parseInt(c.req.query("offset") || "0");
      const orderBy = c.req.query("orderBy") || "id";
      const orderDirection =
        (c.req.query("orderDirection") as "ASC" | "DESC") || undefined;
      const includeRelations = c.req.query("includeRelations") === "true";

      if (
        orderDirection &&
        orderDirection !== "ASC" &&
        orderDirection !== "DESC"
      ) {
        return c.json({ error: "Invalid orderDirection" }, 400);
      }

      const controller = new BaseController(tableName, {
        database: db,
        isSQLite: true,
      });

      const result = await controller.findAll({
        limit,
        offset,
        orderBy,
        orderDirection,
      });

      // If relations are requested, fetch them for each record
      if (includeRelations && result.success && result.data) {
        const relations = await getTableRelations();
        const tableRelations = relations[tableName] || [];

        for (const record of result.data) {
          const relatedData: Record<string, any> = {};

          for (const relation of tableRelations) {
            const relatedResult = await getRelatedData(
              tableName,
              relation.fromColumn,
              record[relation.fromColumn],
            );

            if (relatedResult.success) {
              relatedData[relation.toTable] = relatedResult.data;
            }
          }

          record._related = relatedData;
        }
      }

      return c.json(result);
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error);
      return c.json({ error: `Failed to fetch ${tableName}` }, 500);
    }
  });

  // Get a specific record by ID
  tableRouter.get("/:id", async (c) => {
    // For now, we'll bypass permission checking for view operations
    // In a production environment, you would want to enable this
    // requirePermissions([`${tableName}:view`]),
    try {
      const id = c.req.param("id");
      const includeRelations = c.req.query("includeRelations") === "true";

      const controller = new BaseController(tableName, {
        database: db,
        isSQLite: true,
      });

      const result = await controller.findById(id);

      if (!result.success || !result.data) {
        return c.json({ error: "Record not found" }, 404);
      }

      // If relations are requested, fetch them
      if (includeRelations) {
        const relations = await getTableRelations();
        const tableRelations = relations[tableName] || [];

        const relatedData: Record<string, any> = {};

        for (const relation of tableRelations) {
          const relatedResult = await getRelatedData(
            tableName,
            relation.fromColumn,
            result.data[relation.fromColumn],
          );

          if (relatedResult.success) {
            relatedData[relation.toTable] = relatedResult.data;
          }
        }

        result.data._related = relatedData;
      }

      return c.json(result);
    } catch (error) {
      console.error(`Error fetching ${tableName} by ID:`, error);
      return c.json({ error: `Failed to fetch ${tableName} by ID` }, 500);
    }
  });

  // Create a new record
  tableRouter.post("/", async (c) => {
    // For now, we'll bypass permission checking for create operations
    // In a production environment, you would want to enable this
    // requirePermissions([`${tableName}:create`]),
    try {
      const data = await c.req.json();
      const controller = new BaseController(tableName, {
        database: db,
        isSQLite: true,
      });

      const result = await controller.create(data);

      if (!result.success) {
        return c.json(
          { error: result.error || "Failed to create record" },
          400,
        );
      }

      return c.json(result, 201);
    } catch (error: unknown | Error) {
      console.error(`Error creating ${tableName}:`, error);
      return c.json(
        ErrorResponse.database(
          error instanceof Error ? error.message : "Failed to create record",
        ),
        500,
      );
    }
  });

  // Update a record
  tableRouter.put("/:id", async (c) => {
    // For now, we'll bypass permission checking for update operations
    // In a production environment, you would want to enable this
    // requirePermissions([`${tableName}:update`]),
    try {
      const id = c.req.param("id");
      const data = await c.req.json();
      const controller = new BaseController(tableName, {
        database: db,
        isSQLite: true,
      });

      const result = await controller.update(id, data);

      if (!result.success) {
        return c.json(
          { error: result.error || "Failed to update record" },
          400,
        );
      }

      return c.json(result);
    } catch (error: unknown | Error) {
      console.error(`Error updating ${tableName}:`, error);
      return c.json(
        ErrorResponse.database(
          error instanceof Error ? error.message : "Failed to update record",
        ),
        500,
      );
    }
  });

  // Delete a record
  tableRouter.delete("/:id", async (c) => {
    // For now, we'll bypass permission checking for delete operations
    // In a production environment, you would want to enable this
    // requirePermissions([`${tableName}:delete`]),
    try {
      const id = c.req.param("id");
      const controller = new BaseController(tableName, {
        database: db,
        isSQLite: true,
      });

      const result = await controller.delete(id);

      if (!result.success) {
        return c.json(
          { error: result.error || "Failed to delete record" },
          400,
        );
      }

      return c.json({ message: "Record deleted successfully" });
    } catch (error: unknown | Error) {
      console.error(`Error deleting ${tableName}:`, error);
      return c.json(
        ErrorResponse.database(
          error instanceof Error ? error.message : "Failed to delete record",
        ),
        500,
      );
    }
  });

  // Mount the table router
  genericApiRouter.route(`/${tableName}`, tableRouter);
}

export { genericApiRouter };
