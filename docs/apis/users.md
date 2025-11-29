# Users API

La API de usuarios proporciona endpoints para gestionar usuarios del sistema, incluyendo operaciones CRUD con control de permisos basado en roles.

## Base URL

```
http://localhost:3000/api/users
```

## Autenticación

Todos los endpoints de esta API requieren autenticación a través de tokens JWT. El token debe incluirse en el header Authorization:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Además, las operaciones requieren permisos específicos según la acción:

- `users:list` - Listar usuarios
- `users:view` - Ver detalles de un usuario
- `users:create` - Crear nuevos usuarios
- `users:update` - Actualizar información de usuarios
- `users:delete` - Eliminar usuarios

## Endpoints

### 1. GET /api/users

Obtiene una lista de todos los usuarios del sistema.

**Permisos requeridos:** `users:list`

**Query Parameters:**
- `limit` (opcional): Número máximo de usuarios a devolver (default: 50)
- `offset` (opcional): Número de usuarios a omitir (default: 0)
- `orderBy` (opcional): Campo por el cual ordenar (default: "id")
- `orderDirection` (opcional): Dirección de ordenación, "ASC" o "DESC" (default: "ASC")

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "username": "johndoe",
        "first_name": "John",
        "last_name": "Doe",
        "is_active": true,
        "created_at": "2023-07-15T12:34:56.789Z",
        "updated_at": "2023-07-15T12:34:56.789Z"
      }
    ],
    "pagination": {
      "total": 10,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "Authorization header is missing"
}
```

**Error Response (403 Forbidden):**
```json
{
  "error": "Insufficient permissions"
}
```

### 2. GET /api/users/:id

Obtiene los detalles de un usuario específico por su ID.

**Permisos requeridos:** `users:view` o ser el mismo usuario

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "first_name": "John",
      "last_name": "Doe",
      "is_active": true,
      "created_at": "2023-07-15T12:34:56.789Z",
      "updated_at": "2023-07-15T12:34:56.789Z"
    }
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "type": "NOT_FOUND_ERROR"
  }
}
```

### 3. POST /api/users

Crea un nuevo usuario en el sistema.

**Permisos requeridos:** `users:create`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "StrongPassword123",
  "username": "newuser",
  "first_name": "New",
  "last_name": "User",
  "role": "user",
  "active": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "newuser@example.com",
      "username": "newuser",
      "first_name": "New",
      "last_name": "User",
      "is_active": true,
      "created_at": "2023-07-15T12:34:56.789Z",
      "updated_at": "2023-07-15T12:34:56.789Z"
    }
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "message": "Email already exists",
    "type": "VALIDATION_ERROR"
  }
}
```

### 4. PUT /api/users/:id

Actualiza la información de un usuario existente.

**Permisos requeridos:** `users:update` o ser el mismo usuario

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
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "updateduser",
      "first_name": "Updated",
      "last_name": "User",
      "is_active": false,
      "created_at": "2023-07-15T12:34:56.789Z",
      "updated_at": "2023-07-16T09:12:34.567Z"
    }
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "type": "NOT_FOUND_ERROR"
  }
}
```

### 5. DELETE /api/users/:id

Elimina un usuario del sistema.

**Permisos requeridos:** `users:delete`

**Nota:** Un usuario no puede eliminar su propia cuenta.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "User deleted successfully"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "message": "Cannot delete your own account",
    "type": "BAD_REQUEST_ERROR"
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "type": "NOT_FOUND_ERROR"
  }
}
```

## Manejo de errores

La API utiliza códigos de estado HTTP estándar junto con un formato de respuesta consistente:

- `200 OK`: Solicitud exitosa
- `201 Created`: Recurso creado exitosamente
- `400 Bad Request`: Datos de entrada inválidos
- `401 Unauthorized`: No autenticado o token inválido
- `403 Forbidden`: Sin permisos suficientes
- `404 Not Found`: Recurso no encontrado
- `500 Internal Server Error`: Error del servidor

## Seguridad

- Los usuarios solo pueden acceder a su propia información sin permisos especiales
- La contraseña no se incluye nunca en las respuestas
- Las operaciones de eliminación tienen restricciones para evitar autoeliminación
- Todos los cambios sensibles requieren permisos explícitos