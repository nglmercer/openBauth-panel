import { BaseController } from "open-bauth";
import {
  SQLiteSchemaExtractor,
  type TableInfo,
  type TableSchema,
  type ColumnDefinition,
} from "open-bauth";
import { dbInitializer, db } from "../db";

// Define missing types
interface ForeignKeyInfo {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export async function getSchemas(): Promise<TableInfo[]> {
  const extractor = new SQLiteSchemaExtractor(db);
  const allSchemas = await extractor.getAllTablesInfo();
  return allSchemas;
}

export function getDefaultSchemas(): TableSchema[] {
  return dbInitializer.getSchemas();
}

// Nueva función para obtener relaciones entre tablas
export async function getTableRelations(): Promise<
  Record<string, ForeignKeyInfo[]>
> {
  const extractor = new SQLiteSchemaExtractor(db);
  const allTablesInfo = await extractor.getAllTablesInfo();

  // Organizar relaciones por tabla
  const relationsByTable: Record<string, ForeignKeyInfo[]> = {};

  for (const tableInfo of allTablesInfo) {
    // Check if tableInfo and tableName exist
    if (!tableInfo || !tableInfo.tableName) {
      continue;
    }

    const tableName = tableInfo.tableName;

    if (tableInfo.foreignKeys && tableInfo.foreignKeys.length > 0) {
      for (const fk of tableInfo.foreignKeys) {
        const relation: ForeignKeyInfo = {
          fromTable: tableName,
          fromColumn: fk.from,
          toTable: fk.table,
          toColumn: fk.to,
        };

        if (!relationsByTable[tableName]) {
          relationsByTable[tableName] = [];
        }
        relationsByTable[tableName].push(relation);
      }
    }
  }

  return relationsByTable;
}

// Función para obtener datos relacionados
export async function getRelatedData(
  tableName: string,
  foreignKey: string,
  foreignValue: any,
) {
  try {
    const extractor = new SQLiteSchemaExtractor(db);
    const tableInfo = await extractor.getTableInfo(tableName);

    if (!tableInfo) {
      return { success: false, error: "Table not found" };
    }

    // Find the foreign key relation from the table info
    const fkRelation = (tableInfo.foreignKeys || []).find(
      (fk) => fk.from === foreignKey,
    );

    if (!fkRelation) {
      return { success: false, error: "No relation found" };
    }

    const controller = new BaseController(fkRelation.table, {
      database: db,
      isSQLite: true,
    });

    const result = await controller.findAll({
      where: { [fkRelation.to]: foreignValue },
      limit: 100,
    });

    return result;
  } catch (error) {
    console.error(`Error fetching related data for ${tableName}:`, error);
    return { success: false, error: "Failed to fetch related data" };
  }
}

// Nueva función para obtener metadatos extendidos de la tabla
export async function getExtendedTableSchema(tableName: string) {
  try {
    const schemas = getDefaultSchemas();
    const schema = schemas.find((s) => s.tableName === tableName);

    if (!schema) {
      return { success: false, error: "Table not found" };
    }

    const relations = await getTableRelations();
    const tableRelations = relations[tableName] || [];

    // Enriquecer el esquema con información de relaciones
    const enrichedSchema = {
      ...schema,
      columns: schema.columns.map((column: ColumnDefinition) => {
        const relation = tableRelations.find(
          (r: ForeignKeyInfo) => r.fromColumn === column.name,
        );
        return {
          ...column,
          isForeignKey: !!relation,
          foreignKey: relation
            ? {
                table: relation.toTable,
                column: relation.toColumn,
              }
            : null,
        };
      }),
      relations: tableRelations,
    };

    return { success: true, data: enrichedSchema };
  } catch (error) {
    console.error(`Error fetching extended schema for ${tableName}:`, error);
    return { success: false, error: "Failed to fetch extended schema" };
  }
}

// Función para obtener opciones para campos de relación
export async function getRelationOptions(
  relation: ForeignKeyInfo,
  search?: string,
  limit = 50,
) {
  try {
    const controller = new BaseController(relation.toTable, {
      database: db,
      isSQLite: true,
    });

    const options: any = {
      limit,
      orderBy: "name",
    };

    if (search) {
      options.where = {
        name: { contains: search },
      };
    }

    const result = await controller.findAll(options);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Ensure result.data exists before using it
    if (!result.data) {
      return { success: true, data: [] };
    }

    // Transformar a formato { value, label }
    const formattedOptions = result.data.map((item) => ({
      value: item[relation.toColumn],
      label:
        item.name || item[relation.toColumn] || String(item[relation.toColumn]),
    }));

    return { success: true, data: formattedOptions };
  } catch (error) {
    console.error(
      `Error fetching relation options for ${relation.toTable}:`,
      error,
    );
    return { success: false, error: "Failed to fetch relation options" };
  }
}
