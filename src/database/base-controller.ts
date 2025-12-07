import { BaseController } from "open-bauth";
import {
  SQLiteSchemaExtractor,
  type TableInfo,
  type TableSchema,
  type ColumnDefinition,
} from "open-bauth";
import { dbInitializer, db } from "../db";
import { PostgrestQueryParser } from "../utils/query-parser";

// Define missing types
interface ForeignKeyInfo {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

/**
 * ExtendedBaseController - Extensión de BaseController con soporte para queries PostgREST
 *
 * Esta clase extiende el BaseController original para soportar el formato de queries
 * de Supabase PostgREST, incluyendo:
 * - Filtros avanzados (eq, neq, gt, gte, lt, lte, like, ilike, in, is.null, is.not_null)
 * - Selección de columnas (select=id,name,email)
 * - Ordenamiento (order=id.desc)
 * - Paginación (limit=10&offset=20)
 */
export class ExtendedBaseController extends BaseController {
  private db: any;
  
  constructor(tableName: string, options: any = {}) {
    super(tableName, options);
    this.db = options.database;
  }

  /**
   * Override del método findAll para soportar queries PostgREST
   * @param queryString - Query string en formato PostgREST
   * @returns Resultado de la búsqueda con datos filtrados
   */
  async findAllWithQuery(queryString: string): Promise<any> {
    try {
      // Si no hay query string, usar el método original sin parser
      if (!queryString) {
        return await super.findAll({});
      }

      const parser = new PostgrestQueryParser(queryString);
      const { filters, select, order, range } = parser.parseAll();

      // If no filters, use the original method for better compatibility
      if (Object.keys(filters).length === 0) {
        const options: any = { ...range };
        if (order) {
          options.orderBy = order.orderBy;
          options.orderDirection = order.orderDirection;
        }
        if (select && select[0] !== '*') {
          options.select = select;
        }
        return await super.findAll(options);
      }

      // Build SQL query manually to handle complex filters
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];
      const whereClauses: string[] = [];

      // Process filters
      for (const [column, filter] of Object.entries(filters)) {
        if (filter && typeof filter === 'object') {
          // Handle comparison operators
          if (filter['>'] !== undefined) {
            whereClauses.push(`${column} > ?`);
            params.push(filter['>']);
          } else if (filter['>='] !== undefined) {
            whereClauses.push(`${column} >= ?`);
            params.push(filter['>=']);
          } else if (filter['<'] !== undefined) {
            whereClauses.push(`${column} < ?`);
            params.push(filter['<']);
          } else if (filter['<='] !== undefined) {
            whereClauses.push(`${column} <= ?`);
            params.push(filter['<=']);
          } else if (filter['!='] !== undefined) {
            if (filter['!='] === null) {
              whereClauses.push(`${column} IS NOT NULL`);
            } else {
              whereClauses.push(`${column} != ?`);
              params.push(filter['!=']);
            }
          } else if (filter['like'] !== undefined) {
            whereClauses.push(`${column} LIKE ?`);
            params.push(filter['like']);
          } else if (filter['ilike'] !== undefined) {
            // SQLite doesn't have ILIKE, use LIKE with lower() for case-insensitive
            whereClauses.push(`LOWER(${column}) LIKE LOWER(?)`);
            params.push(filter['ilike']);
          } else if (filter['in'] !== undefined && Array.isArray(filter['in'])) {
            const placeholders = filter['in'].map(() => '?').join(',');
            whereClauses.push(`${column} IN (${placeholders})`);
            params.push(...filter['in']);
          }
        } else if (filter === null) {
          whereClauses.push(`${column} IS NULL`);
        } else {
          // Simple equality
          whereClauses.push(`${column} = ?`);
          params.push(filter);
        }
      }

      // Add WHERE clause if there are filters
      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      // Add ORDER BY clause
      if (order) {
        sql += ` ORDER BY ${order.orderBy} ${order.orderDirection || 'ASC'}`;
      }

      // Add LIMIT and OFFSET
      if (range.limit) {
        sql += ` LIMIT ${range.limit}`;
      }
      if (range.offset) {
        sql += ` OFFSET ${range.offset}`;
      }

      // Execute query
      const stmt = this.db.prepare(sql);
      const data = stmt.all(...params);

      // Apply column selection if needed
      let resultData = data;
      if (select && select[0] !== '*') {
        resultData = data.map((row: any) => {
          const filtered: any = {};
          select.forEach((col: string) => {
            if (row.hasOwnProperty(col)) {
              filtered[col] = row[col];
            }
          });
          return filtered;
        });
      }

      return {
        success: true,
        data: resultData,
        total: resultData.length
      };
    } catch (error) {
      console.error(`Error in findAllWithQuery for ${this.tableName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch records'
      };
    }
  }

  /**
   * Override del método findById para soportar queries PostgREST
   * @param id - ID del registro
   * @param queryString - Query string en formato PostgREST (para select)
   * @returns Resultado de la búsqueda
   */
  async findByIdWithQuery(id: string, queryString?: string): Promise<any> {
    try {
      // Llamar al método findById del padre (solo recibe id como parámetro)
      const result = await super.findById(id);
      
      // Si hay query string con select, filtrar las columnas del resultado
      if (queryString && result.success && result.data) {
        const parser = new PostgrestQueryParser(queryString);
        const { select } = parser.parseAll();
        
        if (select && select[0] !== '*') {
          // Filtrar el objeto para solo incluir las columnas seleccionadas
          const filteredData: any = {};
          select.forEach((column: string) => {
            if (result.data && result.data.hasOwnProperty(column)) {
              filteredData[column] = result.data[column];
            }
          });
          result.data = filteredData;
        }
      }

      return result;
    } catch (error) {
      console.error(`Error in findByIdWithQuery for ${this.tableName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch record'
      };
    }
  }
}

export async function getSchemas(database?: any): Promise<TableInfo[]> {
  const dbToUse = database || db;
  const extractor = new SQLiteSchemaExtractor(dbToUse);
  const allSchemas = await extractor.getAllTablesInfo();
  return allSchemas;
}

export function getDefaultSchemas(): TableSchema[] {
  return dbInitializer.getSchemas();
}

// Nueva función para obtener relaciones entre tablas
export async function getTableRelations(database?: any): Promise<
  Record<string, ForeignKeyInfo[]>
> {
  const dbToUse = database || db;
  const extractor = new SQLiteSchemaExtractor(dbToUse);
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
  database?: any,
) {
  try {
    const dbToUse = database || db;
    const extractor = new SQLiteSchemaExtractor(dbToUse);
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
      database: dbToUse,
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
