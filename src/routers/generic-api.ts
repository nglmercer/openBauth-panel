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
import { getDefaultSchemas, getSchemas } from "../database/base-controller";
import { ZodSchemaGenerator } from "../validator/schema-generator";
import {
  createAuthMiddlewareForHono,
  createPermissionMiddlewareForHono,
} from "../middleware";
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
  createAuthMiddlewareForHono({
    jwtService: jwtService,
    authService: authService,
    permissionService: permissionService,
  }),
);
*/

// Get all available tables
genericApiRouter.get("/tables", async (c) => {
  // For now, we'll bypass permission checking for tables list
  // In a production environment, you would want to enable this
  // createPermissionMiddlewareForHono(["tables:list"]),
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
  // createPermissionMiddlewareForHono(["schemas:view"]),
  try {
    const schemas = await getSchemas();
    return c.json({ schemas });
  } catch (error) {
    console.error("Error fetching schemas:", error);
    return c.json({ error: "Failed to fetch schemas" }, 500);
  }
});

// Get schema for a specific table
genericApiRouter.get("/schema/:tableName", async (c) => {
  // For now, we'll bypass permission checking for schema view
  // In a production environment, you would want to enable this
  // createPermissionMiddlewareForHono(["schemas:view"]),
  try {
    const tableName = c.req.param("tableName");
    const schemas = getDefaultSchemas();
    const schema = schemas.find((s) => s.tableName === tableName);

    if (!schema) {
      return c.json({ error: "Table not found" }, 404);
    }

    return c.json({ schema });
  } catch (error) {
    console.error("Error fetching table schema:", error);
    return c.json({ error: "Failed to fetch table schema" }, 500);
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
    createAuthMiddlewareForHono({
      jwtService: jwtService,
      authService: authService,
      permissionService: permissionService,
    }),
  );
  */

  // Get all records
  tableRouter.get("/", async (c) => {
    // For now, we'll bypass permission checking for list operations
    // In a production environment, you would want to enable this
    // createPermissionMiddlewareForHono([`${tableName}:list`]),
    try {
      const limit = parseInt(c.req.query("limit") || "50");
      const offset = parseInt(c.req.query("offset") || "0");
      const orderBy = c.req.query("orderBy") || "id";
      const orderDirection =
        (c.req.query("orderDirection") as "ASC" | "DESC") || undefined;
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
    // createPermissionMiddlewareForHono([`${tableName}:view`]),
    try {
      const id = c.req.param("id");
      const controller = new BaseController(tableName, {
        database: db,
        isSQLite: true,
      });

      const result = await controller.findById(id);

      if (!result.success || !result.data) {
        return c.json({ error: "Record not found" }, 404);
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
    // createPermissionMiddlewareForHono([`${tableName}:create`]),
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
    // createPermissionMiddlewareForHono([`${tableName}:update`]),
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
    // createPermissionMiddlewareForHono([`${tableName}:delete`]),
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
