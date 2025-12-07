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
  private dbInitializer: any;
  
  constructor(tableName: string, options: any = {}) {
    super(tableName, options);
    this.db = options.database;
    this.dbInitializer = options.dbInitializer;
  }

  /**
   * Get valid column names for the current table
   */
  private getTableColumns(): string[] {
    try {
      // Use schemas from dbInitializer if available, otherwise fall back to getDefaultSchemas
      const schemas = this.dbInitializer ? this.dbInitializer.getSchemas() : getDefaultSchemas();
      const schema = schemas.find((s: any) => s.tableName === this.tableName);
      
      if (!schema) {
        console.warn(`Schema not found for table: ${this.tableName}`);
        return [];
      }
      
      return schema.columns.map((col: any) => col.name);
    } catch (error) {
      console.error(`Error getting table columns for ${this.tableName}:`, error);
      return [];
    }
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
      let filters, select, order, range;
      
      try {
        const parsed = parser.parseAll();
        filters = parsed.filters;
        select = parsed.select;
        order = parsed.order;
        range = parsed.range;
      } catch (error) {
        console.error(`Error parsing query parameters:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Invalid query parameters'
        };
      }

      // Get valid column names for validation (declare before use)
      const validColumns = this.getTableColumns();

      // If no filters, use the original method for better compatibility
      if (Object.keys(filters).length === 0) {
        const options: any = { ...range };
        if (order) {
          options.orderBy = order.orderBy;
          options.orderDirection = order.orderDirection;
        }
        const result = await super.findAll(options);
        
        // Apply column selection if needed
        if (select && select[0] !== '*' && result.success && result.data) {
          console.log(`Applying column selection. Select: ${select.join(', ')}, Valid columns: ${validColumns.join(', ')}`);
          result.data = result.data.map((row: any) => {
            const filtered: any = {};
            // Add all columns but set non-selected ones to null
            validColumns.forEach((col: string) => {
              if (select.includes(col)) {
                filtered[col] = row[col] !== undefined ? this.convertBooleanValue(row[col], col) : null;
                console.log(`Including column ${col}: ${row[col]}`);
              } else {
                filtered[col] = null; // Set non-selected columns to null
                console.log(`Setting column ${col} to null`);
              }
            });
            console.log(`Filtered row:`, filtered);
            return filtered;
          });
        }
        
        return result;
      }

      // Build SQL query manually to handle complex filters
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];
      const whereClauses: string[] = [];


      // Process filters and validate column names
      for (const [column, filter] of Object.entries(filters)) {
        // Validate column name to prevent SQL injection and invalid columns
        if (!validColumns.includes(column)) {
          console.warn(`Invalid column name in filter: ${column}. Valid columns: ${validColumns.join(', ')}`);
          continue; // Skip invalid columns instead of throwing error
        }

        // Handle array of filters (multiple filters on same field)
        if (Array.isArray(filter)) {
          filter.forEach(singleFilter => {
            this.processSingleFilter(column, singleFilter, whereClauses, params);
          });
        } else {
          // Single filter for this field
          this.processSingleFilter(column, filter, whereClauses, params);
        }
      }

      // Add WHERE clause if there are filters
      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      // Add ORDER BY clause
      if (order) {
        // Validate order column
        if (!validColumns.includes(order.orderBy)) {
          console.warn(`Invalid order column: ${order.orderBy}. Valid columns: ${validColumns.join(', ')}`);
          throw new Error(`Invalid order column: ${order.orderBy}`);
        } else {
          sql += ` ORDER BY ${order.orderBy} ${order.orderDirection || 'ASC'}`;
        }
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
        console.log(`Applying column selection. Select: ${select.join(', ')}, Valid columns: ${validColumns.join(', ')}`);
        resultData = data.map((row: any) => {
          const filtered: any = {};
          // Only include selected columns, set others to null
          validColumns.forEach((col: string) => {
            if (select.includes(col)) {
              filtered[col] = row[col] !== undefined ? this.convertBooleanValue(row[col], col) : null;
              console.log(`Including column ${col}: ${row[col]}`);
            } else {
              filtered[col] = null; // Set non-selected columns to null
              console.log(`Setting column ${col} to null`);
            }
          });
          console.log(`Filtered row:`, filtered);
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
          // Get valid columns for this table
          const validColumns = this.getTableColumns();
          
          // Apply column selection consistently with findAllWithQuery
          // Include all columns but set non-selected ones to null
          const filteredData: any = {};
          const data = result.data as any; // Type assertion to avoid undefined checks
          validColumns.forEach((col: string) => {
            if (select.includes(col)) {
              filteredData[col] = data[col] !== undefined ? this.convertBooleanValue(data[col], col) : null;
            } else {
              filteredData[col] = null; // Set non-selected columns to null
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

  /**
   * Override update method to handle boolean conversion
   */
  override async update(id: string, data: any): Promise<any> {
    try {
      // First, perform the update using the parent method
      const result = await super.update(id, data);
      
      // If update was successful, convert boolean values in the response
      if (result.success && result.data) {
        const validColumns = this.getTableColumns();
        const convertedData: any = {};
        
        validColumns.forEach((col: string) => {
          if (result.data && result.data.hasOwnProperty(col)) {
            convertedData[col] = this.convertBooleanValue(result.data[col], col);
          } else if (result.data) {
            convertedData[col] = result.data[col];
          }
        });
        
        result.data = convertedData;
      }
      
      return result;
    } catch (error) {
      console.error(`Error in update for ${this.tableName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update record'
      };
    }
  }

  /**
   * Process a single filter and add it to where clauses and parameters
   */
  private processSingleFilter(column: string, filter: any, whereClauses: string[], params: any[]): void {
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

  /**
   * Convert boolean-like values to proper boolean type
   */
  private convertBooleanValue(value: any, columnName: string): any {
    // Check if this is likely a boolean column based on name
    const isBooleanColumn = columnName.includes('is_') ||
                           columnName.includes('active') ||
                           columnName.includes('enabled') ||
                           columnName === 'active';
    
    if (isBooleanColumn) {
      if (value === 1 || value === '1' || value === true || value === 'true') {
        return true;
      } else if (value === 0 || value === '0' || value === false || value === 'false' || value === null || value === undefined) {
        return false;
      }
    }
    
    return value;
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
