# Database Types

Esta sección describe los tipos TypeScript relacionados con la base de datos utilizados en la aplicación. Estos tipos se definen principalmente en `src/types/database/` y se utilizan para tipar las operaciones y estructuras de la base de datos.

## TableInfo Interface

Representa la información de una tabla de la base de datos:

```typescript
interface TableInfo {
  tableName: string;
  columns: TableColumn[];
  indexes?: TableIndex[];
  foreignKeys?: TableForeignKey[];
}
```

### TableColumn

Representa una columna de una tabla:

```typescript
interface TableColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  autoIncrement?: boolean;
  defaultValue?: any;
  check?: string;
}
```

### TableIndex

Representa un índice de una tabla:

```typescript
interface TableIndex {
  name: string;
  columns: string[];
  unique: boolean;
}
```

### TableForeignKey

Representa una clave foránea de una tabla:

```typescript
interface TableForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
  onDelete?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
}
```

## TableSchema Interface

Representa el esquema completo de una tabla:

```typescript
interface TableSchema {
  tableName: string;
  columns: TableColumn[];
  primaryKey?: string[];
  indexes?: TableIndex[];
  foreignKeys?: TableForeignKey[];
}
```

## DatabaseQuery Interface

Representa una consulta a la base de datos:

```typescript
interface DatabaseQuery {
  table: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  columns?: string[];
  where?: Record<string, any>;
  orderBy?: Record<string, 'ASC' | 'DESC'>;
  limit?: number;
  offset?: number;
  values?: Record<string, any>;
}
```

## QueryBuilder Types

### WhereClause

Representa una cláusula WHERE:

```typescript
type WhereClause = {
  [key: string]: any;
} | {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';
  value: any;
} | {
  condition: 'AND' | 'OR';
  clauses: WhereClause[];
};
```

### JoinClause

Representa una cláusula JOIN:

```typescript
interface JoinClause {
  table: string;
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  on: {
    leftTable: string;
    leftColumn: string;
    rightTable: string;
    rightColumn: string;
  };
}
```

## Migration Types

### Migration

Representa una migración de base de datos:

```typescript
interface Migration {
  id: string;
  name: string;
  version: number;
  up: string; // SQL para ejecutar
  down?: string; // SQL para revertir
  applied_at?: Date;
}
```

### MigrationResult

Representa el resultado de ejecutar una migración:

```typescript
interface MigrationResult {
  success: boolean;
  migration: Migration;
  error?: string;
  duration?: number; // en milisegundos
}
```

## Connection Types

### DatabaseConnection

Representa una conexión a la base de datos:

```typescript
interface DatabaseConnection {
  id: string;
  type: 'sqlite' | 'mysql' | 'postgresql' | 'mongodb';
  config: DatabaseConfig;
  status: 'connected' | 'disconnected' | 'error';
  createdAt: Date;
  lastUsed?: Date;
}
```

### DatabaseConfig

Representa la configuración de una conexión a la base de datos:

```typescript
interface DatabaseConfig {
  // Configuración SQLite
  type: 'sqlite';
  database: string;
  
  // Configuración MySQL
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  
  // Configuración PostgreSQL
  schema?: string;
  ssl?: boolean;
  
  // Configuración común
  poolSize?: number;
  timeout?: number;
  retries?: number;
}
```

## Transaction Types

### Transaction

Representa una transacción de base de datos:

```typescript
interface Transaction {
  id: string;
  connection: DatabaseConnection;
  operations: TransactionOperation[];
  status: 'pending' | 'committed' | 'rolled_back';
  createdAt: Date;
}
```

### TransactionOperation

Representa una operación dentro de una transacción:

```typescript
interface TransactionOperation {
  id: string;
  query: DatabaseQuery;
  executedAt?: Date;
  result?: any;
}
```

## Database Result Types

### QueryResult

Representa el resultado de una consulta:

```typescript
interface QueryResult<T = any> {
  success: boolean;
  data?: T[];
  rowCount?: number;
  error?: string;
  duration?: number; // en milisegundos
}
```

### InsertResult

Representa el resultado de una inserción:

```typescript
interface InsertResult extends QueryResult {
  insertId?: string | number;
}
```

### UpdateResult

Representa el resultado de una actualización:

```typescript
interface UpdateResult extends QueryResult {
  affectedRows?: number;
}
```

### DeleteResult

Representa el resultado de una eliminación:

```typescript
interface DeleteResult extends QueryResult {
  affectedRows?: number;
}
```

## Uso en la Aplicación

### En Base Controller

```typescript
// En src/database/base-controller.ts
import type { TableSchema, TableColumn, QueryResult } from "../types/database";

class BaseController {
  constructor(
    private tableName: string,
    private options: DatabaseOptions
  ) {}
  
  async findAll(options?: QueryOptions): Promise<QueryResult> {
    // Implementación
  }
  
  async findById(id: string): Promise<QueryResult> {
    // Implementación
  }
}
```

### En Schema Extractor

```typescript
// En src/database/schema-extractor.ts
import type { TableInfo, TableSchema, TableColumn } from "../types/database";

class SchemaExtractor {
  async getTableInfo(tableName: string): Promise<TableInfo> {
    // Implementación
  }
  
  async getTableSchema(tableName: string): Promise<TableSchema> {
    // Implementación
  }
}
```

## Extensiones Futuras

Los tipos de base de datos pueden extenderse para incluir:

1. **Tipos de consultas complejas**: Para subconsultas, uniones y agregaciones
2. **Tipos de caché**: Para caché de consultas y resultados
3. **Tipos de réplica**: Para configuración de réplicas de base de datos
4. **Tipos de particionamiento**: Para tablas particionadas
5. **Tipos de optimización**: Para índices y optimización de consultas

## Consideraciones

1. **Abstracción**: Los tipos están diseñados para ser independientes del motor de base de datos
2. **Flexibilidad**: Permiten consultas complejas sin sacrificar seguridad de tipos
3. **Consistencia**: Los tipos de resultado siguen un formato consistente
4. **Extensibilidad**: Pueden extenderse para soportar características específicas de cada motor
