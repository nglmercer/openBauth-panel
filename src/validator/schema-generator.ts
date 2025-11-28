// src/validator/schema-generator.ts
import { z } from "zod";
import type { TableSchema, ColumnDefinition } from "open-bauth"; // Ajusta la ruta a tu BaseController

export class ZodSchemaGenerator {
  static generate(tableSchema: TableSchema) {
    return {
      create: ZodSchemaGenerator.createValidator(tableSchema, "create"),
      update: ZodSchemaGenerator.createValidator(tableSchema, "update"),
      read: ZodSchemaGenerator.createValidator(tableSchema, "read"),
    };
  }

  private static createValidator(
    tableSchema: TableSchema,
    type: "create" | "update" | "read",
  ) {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const col of tableSchema.columns) {
      // 1. Ignorar campos autogenerados en Create/Update
      if (type !== "read") {
        if (col.autoIncrement || col.defaultValue === "CURRENT_TIMESTAMP") {
          if (type === "create" && !col.notNull) continue; // Si es opcional o default, saltar en create
          // Nota: Si es PK autoincrement, siempre lo saltamos en create/update
          if (col.primaryKey && col.autoIncrement) continue;
        }
      }

      let validator = ZodSchemaGenerator.mapColumnTypeToZod(col);

      // 2. Reglas de Opcionalidad
      if (type === "update") {
        // En update todo es opcional
        validator = validator.optional();
      } else if (type === "create") {
        // En create, si tiene default o permite null, es opcional
        if (!col.notNull || col.defaultValue !== undefined) {
          validator = validator.optional().nullable();
        }
      } else {
        // En read (output), permitimos null si la col lo permite
        if (!col.notNull) validator = validator.nullable();
      }

      shape[col.name] = validator;
    }

    return z.object(shape);
  }

  private static mapColumnTypeToZod(col: ColumnDefinition): z.ZodTypeAny {
    const isEmail = col.name.toLowerCase().includes("email");
    const isPassword = col.name.toLowerCase().includes("password");

    // SOLUCIÓN: Usamos una función que crea el esquema específico (Entero o Real)
    // antes de envolverlo en el preprocess.
    const createCoercedNumber = (isInteger: boolean) => {
      // 1. Definimos si validamos int o solo number
      const baseSchema = isInteger ? z.number().int() : z.number();

      // 2. Devolvemos el preprocess envolviendo ese esquema específico
      return z.preprocess((val) => {
        // Manejo de strings vacíos de formularios HTML
        if (typeof val === "string" && val.trim() === "") return undefined;

        const parsed = Number(val);
        // Si es NaN devolvemos val para que Zod falle con el error correcto
        return isNaN(parsed) ? val : parsed;
      }, baseSchema);
    };

    const coerceBoolean = z.preprocess((val) => {
      if (val === "true" || val === "1" || val === 1 || val === true)
        return true;
      if (val === "false" || val === "0" || val === 0 || val === false)
        return false;
      return val;
    }, z.boolean());

    switch (col.type.toUpperCase()) {
      case "INTEGER":
      case "SERIAL":
        return createCoercedNumber(true); // <--- Pasamos true para activar .int()

      case "REAL":
        return createCoercedNumber(false); // <--- Pasamos false para permitir decimales

      case "BOOLEAN":
      case "BIT":
        return coerceBoolean;

      case "DATETIME":
      case "DATE":
        return z.string().datetime({ offset: true }).or(z.string());

      case "TEXT":
      case "VARCHAR":
        if (isEmail) return z.string().email();
        if (isPassword) return z.string().min(8);
        return z.string();

      case "BLOB":
        return z.any();

      default:
        return z.string();
    }
  }
}
