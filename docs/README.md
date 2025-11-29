# Documentación de openBauth-panel

Esta documentación describe las APIs, esquemas de datos y tipos utilizados en el proyecto openBauth-panel.

## Estructura de la documentación

- [APIs](./apis/): Documentación detallada de todos los endpoints de la API
  - [Auth API](./apis/auth.md): Endpoints de autenticación
  - [Users API](./apis/users.md): Gestión de usuarios
  - [Generic CRUD API](./apis/generic-crud.md): Operaciones CRUD dinámicas
  - [Auth SSR API](./apis/auth-ssr.md): Endpoints SSR para autenticación

- [Esquemas](./schemas/): Esquemas de datos y validación
  - [Auth Schemas](./schemas/auth.md): Esquemas de autenticación
  - [User Schemas](./schemas/users.md): Esquemas de usuarios
  - [Permission Schemas](./schemas/permissions.md): Esquemas de permisos
  - [Role Schemas](./schemas/roles.md): Esquemas de roles

- [Types](./types/): Definiciones de tipos TypeScript
  - [Core Types](./types/core.md): Tipos principales de la aplicación
  - [Error Types](./types/errors.md): Tipos de errores
  - [Database Types](./types/database.md): Tipos relacionados con la base de datos

- [Arquitectura](./architecture/): Descripción de la arquitectura del sistema
  - [Overview](./architecture/overview.md): Vista general de la arquitectura
  - [Middleware](./architecture/middleware.md): Middleware de autenticación y permisos
  - [Database](./architecture/database.md): Configuración y esquemas de la base de datos

## Información general

El proyecto openBauth-panel es un panel de administración para el sistema de autenticación open-bauth. Utiliza Hono como framework web y SQLite como base de datos. El sistema ofrece las siguientes funcionalidades principales:

1. **Autenticación y autorización**: Sistema completo de registro, login, refresh tokens y gestión de contraseñas.
2. **Gestión de usuarios**: CRUD de usuarios con control de permisos basado en roles.
3. **API genérica**: Sistema dinámico para realizar operaciones CRUD sobre cualquier tabla de la base de datos.
4. **Renderizado del lado del servidor**: Endpoints SSR para facilitar la integración con frameworks frontend.

## Estructura del proyecto

```
openBauth-panel/
├── docs/                     # Documentación (este directorio)
├── src/
│   ├── db.ts                 # Configuración de la base de datos
│   ├── index.ts              # Punto de entrada de la aplicación
│   ├── middleware/           # Middleware de autenticación y permisos
│   ├── routers/              # Definición de rutas de la API
│   ├── schemas/              # Esquemas de validación Zod
│   ├── types/                # Definiciones de tipos TypeScript
│   ├── utils/                # Utilidades varias
│   └── validator/            # Validadores de esquemas
├── tests/                    # Suite de tests
└── package.json              # Dependencias del proyecto
```

## Tecnologías utilizadas

- **Hono**: Framework web minimalista y rápido para Bun
- **SQLite**: Base de datos ligera
- **Zod**: Validación de esquemas y tipos
- **open-bauth**: Biblioteca de autenticación subyacente
- **TypeScript**: Tipado estático

## Convenciones de la API

- Todas las respuestas siguen un formato consistente:
  - Éxito: `{ success: true, data: ... }`
  - Error: `{ success: false, error: { message: ..., type: ... } }`
- Los tokens JWT se manejan principalmente a través de cookies HTTP-only
- Los permisos siguen el formato `recurso:acción` (ej. `users:create`)
- El paginado utiliza los parámetros `limit` y `offset`

## Seguridad

- Contraseñas hasheadas con bcrypt
- Tokens JWT con tiempo de expiración
- Protección CSRF a través de cookies SameSite: Strict
- Validación exhaustiva de inputs con Zod
- Middleware de permisos para acceso controlado a recursos