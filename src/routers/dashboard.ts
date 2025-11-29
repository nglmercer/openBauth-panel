// src/routers/dashboard.ts
import { Hono } from "hono";
import { BaseController } from "open-bauth";
import { getDefaultSchemas } from "../database/base-controller";
import { db } from "../db";
import { ZodSchemaGenerator } from "../validator/schema-generator";

const dashboard = new Hono();

// Helper para respuestas estandarizadas
const response = (
  success: boolean,
  data: any = null,
  error: string | object | null = null,
) => {
  return { success, data, error };
};

// 1. Listar tablas disponibles (Metadatos)
dashboard.get("/", (c) => {
  const schemas = getDefaultSchemas();
  return c.json(
    response(
      true,
      schemas.map((s) => ({
        tableName: s.tableName,
        columns: s.columns,
      })),
    ),
  );
});

// 2. Obtener registros de una tabla (Con Paginación)
dashboard.get("/table/:tableName", async (c) => {
  const tableName = c.req.param("tableName");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = (page - 1) * limit;

  const schemas = getDefaultSchemas();
  const schema = schemas.find((s) => s.tableName === tableName);

  if (!schema) {
    return c.json(response(false, null, "Table not found"), 404);
  }

  try {
    const controller = new BaseController(tableName, {
      database: db,
      isSQLite: true,
    });

    const result = await controller.findAll({ limit, offset });

    return c.json({
      success: true,
      data: result.data,
      meta: {
        page,
        limit,
        total: result.total || 0,
      },
    });
  } catch (error) {
    return c.json(response(false, null, (error as Error).message), 500);
  }
});

// 3. Crear registro (POST - Implementación Segura con safeParse)
dashboard.post("/table/:tableName", async (c) => {
  const tableName = c.req.param("tableName");
  const contentType = c.req.header("Content-Type") || "";

  // 1. Parsear el Body
  let body;
  try {
    if (contentType.includes("application/json")) {
      body = await c.req.json();
    } else {
      body = await c.req.parseBody();
    }
  } catch (e) {
    return c.json(response(false, null, "Invalid JSON or Body format"), 400);
  }

  const schemas = getDefaultSchemas();
  const schemaDef = schemas.find((s) => s.tableName === tableName);

  if (!schemaDef) {
    return c.json(response(false, null, "Schema not found"), 404);
  }

  // 2. Generar Validadores
  const validators = ZodSchemaGenerator.generate(schemaDef);

  // 3. Validación usando safeParse (Evita try/catch para validación)
  const validationResult = validators.create.safeParse(body);

  if (!validationResult.success) {
    return c.json(
      response(false, null, {
        message: "Validation Error",
        details: validationResult.error.message,
      }),
      400,
    );
  }

  // 4. Intentar crear en base de datos
  try {
    const cleanData = validationResult.data; // Datos tipados y limpios

    const controller = new BaseController(tableName, {
      database: db,
      isSQLite: true,
    });

    const result = await controller.create(cleanData);

    if (!result.success) {
      // Error lógico de base de datos (ej: unique constraint)
      return c.json(result, 400);
    }

    return c.json(response(true, result.data || result), 201);
  } catch (e: unknown) {
    // Errores inesperados de BD o del sistema
    console.error("Database Create Error:", e);
    return c.json(
      response(
        false,
        null,
        e instanceof Error ? e.message : "Internal Server Error",
      ),
      500,
    );
  }
});

// 4. Eliminar registro
dashboard.delete("/table/:tableName/:id", async (c) => {
  const tableName = c.req.param("tableName");
  const id = c.req.param("id");

  try {
    const controller = new BaseController(tableName, {
      database: db,
      isSQLite: true,
    });

    const result = await controller.delete(id);

    // Handle both boolean and object responses from delete method
    if (
      result &&
      (typeof result === "boolean" ? result : (result as any).success)
    ) {
      return c.json(response(true, { message: "Record deleted successfully" }));
    } else {
      return c.json(response(false, null, "Could not delete record"), 400);
    }
  } catch (error) {
    return c.json(response(false, null, (error as Error).message), 500);
  }
});

export { dashboard };
