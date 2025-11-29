# Arquitectura de Base de Datos

Este documento describe la arquitectura de la base de datos utilizada en openBauth-panel, incluyendo el diseño, esquema, migraciones y patrones de acceso a datos.

## Overview

El sistema utiliza SQLite como motor de base de datos por su ligereza y simplicidad, ideal para aplicaciones de tamaño pequeño a mediano. La arquitectura de la base de datos está diseñada para ser extensible y mantener la integridad de los datos.

## Esquema de Base de Datos

### Tablas Principales

#### Users
Almacena la información de los usuarios del sistema:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Roles
Define los roles del sistema:

```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Permissions
Define los permisos disponibles en el sistema:

```sql
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### User_Roles
Relación many-to-many entre usuarios y roles:

```sql
CREATE TABLE user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
```

#### Role_Permissions
Relación many-to-many entre roles y permisos:

```sql
CREATE TABLE role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
```

#### Refresh_Tokens
Almacena los tokens de refresco para la gestión de sesiones:

```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  is_revoked BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Tablas de Sistema

#### Migrations
Control de versiones del esquema:

```sql
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL UNIQUE,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Sistema de Migraciones

El sistema incluye un mecanismo de migraciones para gestionar cambios en el esquema:

```typescript
// Database Initializer
class DatabaseInitializer {
  constructor(private database: Database) {}
  
  async initialize(): Promise<void> {
    // Verificar si la tabla de migraciones existe
    await this.ensureMigrationsTable();
    
    // Obtener migraciones pendientes
    const pendingMigrations = await this.getPendingMigrations();
    
    // Aplicar migraciones pendientes
    for (const migration of pendingMigrations) {
      await this.applyMigration(migration);
    }
  }
  
  async reset(schemas: TableSchema[]): Promise<void> {
    // Eliminar todas las tablas excepto migraciones
    // Recrear tablas según los esquemas proporcionados
  }
}
```

## Patrón de Acceso a Datos

### Base Controller

El sistema utiliza un controlador base genérico para operaciones CRUD:

```typescript
class BaseController {
  constructor(
    private tableName: string,
    private options: DatabaseOptions
  ) {}
  
  async findAll(options?: QueryOptions): Promise<QueryResult> {
    // Construir consulta SELECT con opciones
    // Ejecutar consulta y devolver resultados
  }
  
  async findById(id: string): Promise<QueryResult> {
    // Construir consulta SELECT por ID
    // Ejecutar consulta y devolver resultado
  }
  
  async create(data: any): Promise<CrudResult> {
    // Validar datos contra esquema
    // Construir consulta INSERT
    // Ejecutar consulta y devolver resultado
  }
  
  async update(id: string, data: any): Promise<CrudResult> {
    // Validar datos contra esquema
    // Construir consulta UPDATE
    // Ejecutar consulta y devolver resultado
  }
  
  async delete(id: string): Promise<CrudResult> {
    // Construir consulta DELETE
    // Ejecutar consulta y devolver resultado
  }
}
```

### Servicios de Dominio

Los servicios encapsulan la lógica de negocio y utilizan el controlador base:

```typescript
class AuthService {
  constructor(
    private dbInitializer: DatabaseInitializer,
    private jwtService: JWTService
  ) {}
  
  async register(data: RegisterData): Promise<AuthResult> {
    // Verificar que el usuario no exista
    // Hashear contraseña
    // Crear usuario con Base Controller
    // Generar tokens JWT
  }
  
  async login(data: LoginData): Promise<AuthResult> {
    // Buscar usuario por email
    // Verificar contraseña
    // Generar tokens JWT
  }
}
```

## Schema Extractor

El sistema incluye un extractor de esquemas para introspección dinámica:

```typescript
class SchemaExtractor {
  constructor(private database: Database) {}
  
  async getAllTablesInfo(): Promise<TableInfo[]> {
    // Consultar información de todas las tablas
    // Construir objetos TableInfo
  }
  
  async getTableInfo(tableName: string): Promise<TableInfo> {
    // Consultar información de una tabla específica
    // Construir objeto TableInfo
  }
  
  async getTableSchema(tableName: string): Promise<TableSchema> {
    // Consultar esquema completo de una tabla
    // Incluir columnas, índices y claves foráneas
  }
}
```

## Validación Dinámica

El sistema genera validadores Zod dinámicamente basados en el esquema:

```typescript
class ZodSchemaGenerator {
  static generate(tableSchema: TableSchema): Record<string, ZodSchema> {
    const validators: Record<string, ZodSchema> = {};
    
    for (const column of tableSchema.columns) {
      // Generar validador Zod para cada columna
      validators[column.name] = this.generateValidatorForColumn(column);
    }
    
    return validators;
  }
  
  private static generateValidatorForColumn(column: TableColumn): ZodSchema {
    // Lógica para generar validador según tipo de columna
    // Considerar restricciones (not null, unique, etc.)
  }
}
```

## Gestión de Transacciones

El sistema incluye soporte para transacciones:

```typescript
class TransactionManager {
  constructor(private database: Database) {}
  
  async withTransaction<T>(
    callback: (tx: Transaction) => Promise<T>
  ): Promise<T> {
    // Iniciar transacción
    // Ejecutar callback
    // Hacer commit o rollback según resultado
  }
}
```

## Consideraciones de Rendimiento

1. **Índices**: Se definen índices en columnas consultadas frecuentemente
2. **Conexión única**: Se utiliza una única conexión reutilizada para optimizar recursos
3. **Consultas parametrizadas**: Todas las consultas utilizan parámetros para prevenir inyección SQL
4. **Caché de esquemas**: Los esquemas se cachean en memoria para evitar consultas repetitivas

## Seguridad

1. **Hashing de contraseñas**: Utiliza bcrypt para almacenar contraseñas de forma segura
2. **Validación de inputs**: Todos los datos se validan antes de almacenarlos
3. **Consultas parametrizadas**: Previenen inyección SQL
4. **Control de acceso**: El acceso a los datos se controla a nivel de aplicación

## Copias de Seguridad y Recuperación

1. **Backups automáticos**: Implementación de backups periódicos de la base de datos
2. **Migraciones versionadas**: Sistema de migraciones para actualizaciones controladas
3. **Validación de integridad**: Verificación periódica de la integridad de los datos

## Escalabilidad

1. **Modularidad**: El esquema está diseñado para ser extendido
2. **Separación de responsabilidades**: Cada tabla tiene un propósito claro
3. **Normalización**: Se siguen principios de normalización para minimizar redundancia
4. **Extensión**: El sistema permite añadir nuevas tablas sin modificar el código existente

## Evolución Futura

La arquitectura de base de datos puede evolucionar para incluir:

1. **Soporte para otros motores**: PostgreSQL, MySQL para mayor escalabilidad
2. **Replicación**: Configuración de réplicas para alta disponibilidad
3. **Particionamiento**: Tablas particionadas para mejorar el rendimiento
4. **Caché distribuido**: Integración con sistemas como Redis
5. **Auditoría avanzada**: Sistema de auditoría más detallado