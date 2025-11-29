# Auth API

La API de autenticación proporciona endpoints para registrar usuarios, iniciar sesión, gestionar tokens y realizar operaciones relacionadas con la autenticación.

## Base URL

```
http://localhost:3000/auth
```

## Endpoints

### 1. POST /auth/register

Registra un nuevo usuario en el sistema.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123",
  "username": "johndoe",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
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
```

**Cookies establecidas:**
- `access_token`: Token JWT de acceso (15 min)
- `refresh_token`: Token de refresco (7 días)

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

### 2. POST /auth/login

Inicia sesión con las credenciales del usuario.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true
  }
}
```

**Cookies establecidas:**
- `access_token`: Token JWT de acceso (15 min)
- `refresh_token`: Token de refresco (7 días)

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "message": "Invalid credentials",
    "type": "AUTHENTICATION_ERROR"
  }
}
```

### 3. POST /auth/refresh

Refresca el token de acceso utilizando un refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookie establecida:**
- `access_token`: Nuevo token JWT de acceso (15 min)

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired refresh token",
    "type": "AUTHENTICATION_ERROR"
  }
}
```

### 4. GET /auth/me

Obtiene información del usuario autenticado actual.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
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
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "No token provided"
}
```

### 5. GET /auth/me/:id

Obtiene información de un usuario específico por su ID (deprecated).

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "first_name": "John",
  "last_name": "Doe",
  "is_active": true
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "User not found"
}
```

### 6. DELETE /auth/unregister/:id

Elimina un usuario del sistema por su ID.

**Response (200 OK):**
```json
{
  "success": true
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

### 7. POST /auth/logout

Cierra la sesión del usuario actual.

**Response (200 OK):**
```json
{
  "success": true
}
```

**Note:** En una implementación completa, este endpoint debería invalidar el refresh token en la base de datos.

### 8. PUT /auth/profile

Actualiza el perfil del usuario autenticado.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "username": "newusername",
  "first_name": "John",
  "last_name": "Smith"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "newusername",
  "first_name": "John",
  "last_name": "Smith",
  "is_active": true,
  "created_at": "2023-07-15T12:34:56.789Z",
  "updated_at": "2023-07-16T09:12:34.567Z"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "No token provided"
}
```

### 9. POST /auth/change-password

Cambia la contraseña del usuario autenticado.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456",
  "confirmPassword": "NewPassword456"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "message": "New passwords do not match",
    "type": "VALIDATION_ERROR"
  }
}
```

### 10. GET /auth/permissions

Obtiene la lista de todos los permisos disponibles en el sistema.

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "users:list",
    "description": "List all users"
  },
  {
    "id": "uuid",
    "name": "users:create",
    "description": "Create new users"
  }
]
```

### 11. GET /auth/permissions/:name

Obtiene un permiso específico por su nombre.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "users:list",
  "description": "List all users"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Permission not found"
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

- Todas las contraseñas se almacenan hasheadas con bcrypt
- Los tokens JWT tienen un tiempo de expiración configurable
- Las cookies se establecen con los flags `httpOnly`, `secure` y `sameSite: Strict`
- La validación de entradas se realiza con Zod para prevenir inyecciones