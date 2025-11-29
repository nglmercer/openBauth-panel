# Índice de APIs

Este documento proporciona un índice completo de todas las APIs disponibles en openBauth-panel, organizadas por categorías y con enlaces a su documentación detallada.

## APIs de Autenticación

### Auth API
**Base URL:** `/auth`

| Método | Endpoint | Descripción | Documentación |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Registrar nuevo usuario | [Auth API](./apis/auth.md#1-post-authregister) |
| POST | `/auth/login` | Iniciar sesión | [Auth API](./apis/auth.md#2-post-authlogin) |
| POST | `/auth/refresh` | Refrescar token de acceso | [Auth API](./apis/auth.md#3-post-authrefresh) |
| GET | `/auth/me` | Obtener usuario actual | [Auth API](./apis/auth.md#4-get-authme) |
| GET | `/auth/me/:id` | Obtener usuario por ID (deprecated) | [Auth API](./apis/auth.md#5-get-authmeid) |
| DELETE | `/auth/unregister/:id` | Eliminar usuario por ID | [Auth API](./apis/auth.md#6-delete-authunregisterid) |
| POST | `/auth/logout` | Cerrar sesión | [Auth API](./apis/auth.md#7-post-authlogout) |
| PUT | `/auth/profile` | Actualizar perfil | [Auth API](./apis/auth.md#8-put-authprofile) |
| POST | `/auth/change-password` | Cambiar contraseña | [Auth API](./apis/auth.md#9-post-authchange-password) |
| GET | `/auth/permissions` | Listar todos los permisos | [Auth API](./apis/auth.md#10-get-authpermissions) |
| GET | `/auth/permissions/:name` | Obtener permiso por nombre | [Auth API](./apis/auth.md#11-get-authpermissionsname) |

### Auth SSR API
**Base URL:** `/auth/ssr`

| Método | Endpoint | Descripción | Documentación |
|--------|----------|-------------|---------------|
| GET | `/auth/ssr/login` | Renderizar página de login | [Auth SSR API](./apis/auth-ssr.md#1-get-authssrlogin) |
| POST | `/auth/ssr/login` | Procesar formulario de login | [Auth SSR API](./apis/auth-ssr.md#2-post-authssrlogin) |
| GET | `/auth/ssr/register` | Renderizar página de registro | [Auth SSR API](./apis/auth-ssr.md#3-get-authssrregister) |
| POST | `/auth/ssr/register` | Procesar formulario de registro | [Auth SSR API](./apis/auth-ssr.md#4-post-authssrregister) |
| POST | `/auth/ssr/logout` | Cerrar sesión | [Auth SSR API](./apis/auth-ssr.md#5-post-authssrlogout) |

## APIs de Gestión

### Users API
**Base URL:** `/api/users`

| Método | Endpoint | Permisos Requeridos | Descripción | Documentación |
|--------|----------|-------------------|-------------|---------------|
| GET | `/api/users` | `users:list` | Listar usuarios | [Users API](./apis/users.md#1-get-apiusers) |
| GET | `/api/users/:id` | `users:view` o propio usuario | Obtener usuario por ID | [Users API](./apis/users.md#2-get-apiusersid) |
| POST | `/api/users` | `users:create` | Crear nuevo usuario | [Users API](./apis/users.md#3-post-apiusers) |
| PUT | `/api/users/:id` | `users:update` o propio usuario | Actualizar usuario | [Users API](./apis/users.md#4-put-apiusersid) |
| DELETE | `/api/users/:id` | `users:delete` | Eliminar usuario | [Users API](./apis/users.md#5-delete-apiusersid) |

## APIs Genéricas

### Generic CRUD API
**Base URL:** `/api`

#### Endpoints de Metadatos
| Método | Endpoint | Descripción | Documentación |
|--------|----------|-------------|---------------|
| GET | `/api/tables` | Listar tablas disponibles | [Generic CRUD API](./apis/generic-crud.md#1-get-apitables) |
| GET | `/api/schemas` | Obtener esquemas de todas las tablas | [Generic CRUD API](./apis/generic-crud.md#2-get-apischemas) |
| GET | `/api/schema/:tableName` | Obtener esquema de tabla específica | [Generic CRUD API](./apis/generic-crud.md#3-get-apischematablename) |

#### Operaciones CRUD Dinámicas
| Método | Endpoint | Permisos Requeridos* | Descripción | Documentación |
|--------|----------|--------------------|-------------|---------------|
| GET | `/api/:tableName` | `{tableName}:list` | Listar registros de tabla | [Generic CRUD API](./apis/generic-crud.md#4-get-aitablename) |
| GET | `/api/:tableName/:id` | `{tableName}:view` | Obtener registro por ID | [Generic CRUD API](./apis/generic-crud.md#5-get-aitablenameid) |
| POST | `/api/:tableName` | `{tableName}:create` | Crear nuevo registro | [Generic CRUD API](./apis/generic-crud.md#6-post-aitablename) |
| PUT | `/api/:tableName/:id` | `{tableName}:update` | Actualizar registro existente | [Generic CRUD API](./apis/generic-crud.md#7-put-aitablenameid) |
| DELETE | `/api/:tableName/:id` | `{tableName}:delete` | Eliminar registro | [Generic CRUD API](./apis/generic-crud.md#8-delete-aitablenameid) |

*Nota: Los permisos actualmente están deshabilitados para propósitos de prueba. En producción, se requerirán estos permisos.

## Convenciones de API

### Formatos de Respuesta
- **Éxito:** `{ success: true, data: ... }`
- **Error:** `{ success: false, error: { message: ..., type: ... } }`

### Códigos de Estado
| Código | Significado | Descripción |
|--------|-------------|-------------|
| 200 | OK | Solicitud exitosa |
| 201 | Created | Recurso creado exitosamente |
| 400 | Bad Request | Datos de entrada inválidos |
| 401 | Unauthorized | No autenticado o token inválido |
| 403 | Forbidden | Sin permisos suficientes |
| 404 | Not Found | Recurso no encontrado |
| 409 | Conflict | Conflicto de recursos (ej. duplicado) |
| 429 | Too Many Requests | Límite de velocidad excedido |
| 500 | Internal Server Error | Error del servidor |

### Autenticación
- **Header:** `Authorization: Bearer <token>`
- **Cookies:** `access_token` y `refresh_token` (HTTP-only, Secure, SameSite: Strict)
- **Duración:** Access token (15 min), Refresh token (7 días)

### Paginación
- **Parámetros:** `limit`, `offset`
- **Response:** `{ success: true, data: [...], total: 100, limit: 50, offset: 0 }`

### Ordenación
- **Parámetros:** `orderBy`, `orderDirection` (ASC/DESC)

## Esquemas y Validación

### Esquemas Disponibles
- [Auth Schemas](./schemas/auth.md): Validación para autenticación
- [User Schemas](./schemas/users.md): Validación para usuarios
- [Permission Schemas](./schemas/permissions.md): Validación para permisos
- [Role Schemas](./schemas/roles.md): Validación para roles

### Validación
- **Framework:** Zod
- **Integración:** `zValidator` middleware de Hono
- **Formato:** Validación automática de request body y query params

## Tipos de Datos

### Tipos Principales
- [Core Types](./types/core.md): Tipos principales de la aplicación
- [Error Types](./types/errors.md): Tipos de error
- [Database Types](./types/database/index.md): Tipos relacionados con la base de datos

## Arquitectura

### Componentes
- [Overview](./architecture/overview.md): Arquitectura general del sistema
- [Middleware](./architecture/middleware.md): Middleware de autenticación y permisos
- [Database](./architecture/database.md): Diseño y estructura de la base de datos

## Estado de Tests

### Cobertura Actual
- [Testing Status](./testing-status.md): Estado completo de los tests y áreas de mejora

## Permisos del Sistema

### Nomenclatura
Los permisos siguen el formato `recurso:acción`:
- **recurso**: users, roles, permissions, etc.
- **acción**: list, view, create, update, delete, manage

### Permisos Base
- `users:list`, `users:view`, `users:create`, `users:update`, `users:delete`
- `roles:list`, `roles:view`, `roles:create`, `roles:update`, `roles:delete`
- `permissions:list`, `permissions:view`, `permissions:create`, `permissions:update`, `permissions:delete`
- `system:access`, `system:settings`, `system:logs`, `system:backup`

## Configuración

### Variables de Entorno
- `JWT_SECRET`: Secreto para firmar tokens JWT
- `DATABASE_PATH`: Ruta a la base de datos SQLite
- `NODE_ENV`: Entorno (development/production)

### Configuración de CORS
- **Orígenes permitidos:** `http://localhost:5173`, `http://localhost:3000`
- **Métodos:** GET, POST, PUT, DELETE, OPTIONS
- **Headers:** Content-Type, Authorization
- **Credenciales:** Habilitado

## Notas Importantes

1. **Seguridad:** Las contraseñas se almacenan hasheadas con bcrypt
2. **Autenticación:** La API genérica actualmente tiene autenticación deshabilitada para pruebas
3. **Validación:** Todos los inputs se validan con Zod antes de procesarlos
4. **Error Handling:** Los errores se manejan de forma consistente con mensajes descriptivos
5. **Logging:** Las operaciones se registran para auditoría y debugging

## Roadmap Futuro

### Próximas Versiones
- Activación de autenticación en API genérica
- Implementación de límite de velocidad (rate limiting)
- Sistema de auditoría completo
- Soporte para múltiples bases de datos
- API para gestión de archivos
- Sistema de notificaciones