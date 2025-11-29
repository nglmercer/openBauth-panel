# Generic CRUD API

La API CRUD genérica proporciona endpoints dinámicos para realizar operaciones CRUD sobre cualquier tabla de la base de datos. Esta API genera automáticamente rutas basadas en el esquema de la base de datos.

## Base URL

```
http://localhost:3000/api
```

## Autenticación

**Nota importante:** Actualmente, la autenticación está temporalmente deshabilitada para propósitos de prueba. En un entorno de producción, los endpoints requerirían autenticación JWT y permisos específicos para cada tabla.

Para habilitar la autenticación, descomente las líneas correspondientes en `src/routers/generic-api.ts`.

## Endpoints

### 1. GET /api/tables

Obtiene una lista de todas las tablas disponibles en la base de datos.

**Response (200 OK):**
```json
{
  "tables": [
    {
      "name": "users",
      "columns": 10
    },
    {
      "name": "permissions",
      "columns": 4
    }
  ]
}
```

### 2. GET /api/schemas

Obtiene los esquemas de todas las tablas de la base de datos.

**Response (200 OK):**
```json
{
  "schemas": [
    {
      "tableName": "users",
      "columns": [
        {
          "name": "id",
          "type": "INTEGER",
          "primaryKey": true,
          "notNull": true,
          "autoIncrement": true
        },
        {
          "name": "email",
          "type": "TEXT",
          "primaryKey": false,
          "notNull": true,
          "autoIncrement": false
        }
      ]
    }
  ]
}
```

### 3. GET /api/schema/:tableName

Obtiene el esquema de una tabla específica.

**Response (200 OK):**
```json
{
  "schema": {
    "tableName": "users",
    "columns": [
      {
        "name": "id",
        "type": "INTEGER",
        "primaryKey": true,
        "notNull": true,
        "autoIncrement": true
      },
      {
        "name": "email",
        "type": "TEXT",
        "primaryKey": false,
        "notNull": true,
        "autoIncrement": false
      }
    ]
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Table not found"
}
```

### 4. GET /api/:tableName

Obtiene todos los registros de una tabla específica.

**Query Parameters:**
- `limit` (opcional): Número máximo de registros a devolver (default: 50)
- `offset` (opcional): Número de registros a omitir (default: 0)
- `orderBy` (opcional): Campo por el cual ordenar (default: "id")
- `orderDirection` (opcional): Dirección de ordenación, "ASC" o "DESC" (default: "ASC")

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "username": "johndoe",
      "first_name": "John",
      "last_name": "Doe",
      "is_active": true,
      "created_at": "2023-07-15T12:34:56.789Z",
      "updated_at": "2023-07-15T12:34:56.789Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "error": "Failed to fetch users"
}
```

### 5. GET /api/:tableName/:id

Obtiene un registro específico por su ID.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true,
    "created_at": "2023-07-15T12:34:56.789Z",
    "updated_at": "2023-07-15T12:34:56.789Z"
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Record not found"
}
```

### 6. POST /api/:tableName

Crea un nuevo registro en una tabla específica.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "first_name": "New",
  "last_name": "User",
  "is_active": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email": "newuser@example.com",
    "username": "newuser",
    "first_name": "New",
    "last_name": "User",
    "is_active": true,
    "created_at": "2023-07-15T12:34:56.789Z",
    "updated_at": "2023-07-15T12:34:56.789Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Failed to create record"
}
```

### 7. PUT /api/:tableName/:id

Actualiza un registro existente en una tabla específica.

**Request Body:**
```json
{
  "username": "updateduser",
  "first_name": "Updated",
  "last_name": "User",
  "is_active": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "username": "updateduser",
    "first_name": "Updated",
    "last_name": "User",
    "is_active": false,
    "created_at": "2023-07-15T12:34:56.789Z",
    "updated_at": "2023-07-16T09:12:34.567Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Failed to update record"
}
```

### 8. DELETE /api/:tableName/:id

Elimina un registro de una tabla específica.

**Response (200 OK):**
```json
{
  "message": "Record deleted successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Failed to delete record"
}
```

## Permisos (cuando se active la autenticación)

Cuando se active la autenticación, se requerirán permisos específicos para cada operación:

- `{tableName}:list` - Listar registros de una tabla
- `{tableName}:view` - Ver un registro específico
- `{tableName}:create` - Crear nuevos registros
- `{tableName}:update` - Actualizar registros existentes
- `{tableName}:delete` - Eliminar registros

Por ejemplo, para acceder a `GET /api/users`, se necesitaría el permiso `users:list`.

## Seguridad

**Nota importante:** La autenticación está temporalmente deshabilitada para propósitos de prueba. En producción:

- Todas las operaciones requerirían autenticación JWT
- Se validarían permisos específicos para cada tabla y operación
- Se realizaría validación exhaustiva de datos de entrada
- Se implementaría logging de operaciones sensibles

## Consideraciones

1. **Validación de datos**: La API genera validadores Zod automáticamente basados en el esquema de la base de datos.
2. **Tipos de datos**: Los tipos de datos se convierten automáticamente entre SQLite y JSON.
3. **Relaciones**: Las relaciones entre tablas no se resuelven automáticamente; deben manejarse a nivel de aplicación.
4. **Transacciones**: Las operaciones no se ejecutan en transacciones; para operaciones complejas, considere implementar endpoints específicos.