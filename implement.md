

### Estructura del Proyecto

```
openBauth-panel/
├── src/
│   ├── database/
│   │   ├── database-initializer.ts
│   │   ├── base-controller.ts
│   │   └── schema/
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── oauth-security.ts
│   ├── services/
│   │   ├── service-factory.ts
│   │   ├── auth.ts
│   │   ├── jwt.ts
│   │   └── permissions.ts
│   ├── types/
│   ├── routes.ts
│   └── index.ts
├── tests/
├── scripts/
└── package.json
```

### Variables de Entorno

```bash
# Base de Datos
DATABASE_URL=auth.db

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# SMTP (Para notificaciones)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourapp.com

# Frontend
FRONTEND_URL=http://localhost:3000

# Rate Limit
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=10
```
### 1\. Autenticación (`/auth`)

Estas rutas son públicas y manejan el acceso inicial.

| Método | Endpoint | Body (JSON) | Descripción |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/signup` | `{ "email": "...", "password": "...", "first_name": "..." }` | Registrar nuevo usuario. |
| **POST** | `/api/v1/auth/login` | `{ "email": "...", "password": "..." }` | Iniciar sesión (Devuelve JWT). |
| **POST** | `/api/v1/auth/anonymous` | *N/A* | Crear una sesión anónima (Guest). |
| **POST** | `/api/v1/auth/refresh` | `{ "refreshToken": "..." }` | Rotar token de acceso usando refresh token. |
| **POST** | `/api/v1/auth/logout` | *N/A* | Revocar la sesión actual. |

-----

### 2\. Usuario (`/user`)

Rutas protegidas (requieren Header `Authorization: Bearer <token>`).

| Método | Endpoint | Body (JSON) | Descripción |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/user/me` | *N/A* | Obtener perfil del usuario actual y permisos. |
| **PATCH** | `/api/v1/user/me` | `{ "first_name": "...", ... }` | Actualizar datos del perfil. |
| **POST** | `/api/v1/user/mfa/setup` | *N/A* | Iniciar configuración de MFA (2FA). |
| **POST** | `/api/v1/user/devices` | `{ "deviceName": "..." }` | Registrar dispositivo confiable. |
| **POST** | `/api/v1/user/biometric` | `{ "publicKey": "..." }` | Registrar Passkey/Biometría (WebAuthn). |

-----

### 3\. Protocolo OAuth 2.0 / OIDC (`/oauth`)

Estándares RFC para integración con otros sistemas.

| Método | Endpoint | Params / Body | Descripción |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/oauth/authorize` | `?client_id=...&redirect_uri=...` | Pantalla de consentimiento (Login social). |
| **POST** | `/api/v1/oauth/token` | `grant_type`, `code`, `client_id`... | Intercambio de código por token (form-urlencoded). |
| **POST** | `/api/v1/oauth/revoke` | `{ "token": "..." }` | Revocar un token específico. |
| **POST** | `/api/v1/oauth/introspect`| `{ "token": "..." }` | Validar si un token está activo. |
| **GET** | `/api/v1/oauth/jwks` | *N/A* | Obtener claves públicas (JSON Web Key Set). |
| **GET** | `/api/v1/oauth/userinfo` | *N/A* | (Implícito en Fase 4) Datos del usuario estándar OIDC. |

-----

### 4\. Administración (`/admin`)

Rutas protegidas con **RBAC** (Solo rol `admin`).

| Método | Endpoint | Body (JSON) | Descripción |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/admin/users` | *N/A* | Listar todos los usuarios del sistema. |
| **POST** | `/api/v1/admin/roles` | `{ "name": "editor", "permissions": [...] }` | Crear un nuevo rol en el sistema. |

-----

### 5\. API Genérica / Headless CMS (`/:tableName`)

Estas son rutas dinámicas. Reemplaza `:tableName` con el nombre de tu tabla (ej. `products`, `posts`).

| Método | Endpoint | Query Params / Body | Descripción |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/:tableName/schema` | *N/A* | Obtener la estructura/columnas de la tabla. |
| **GET** | `/api/v1/:tableName` | `?page=1&limit=20&<campo>=<valor>` | Listar registros con paginación y filtros. |
| **POST** | `/api/v1/:tableName` | `{ "campo": "valor", ... }` | Crear un nuevo registro en la tabla. |
| **PATCH**| `/api/v1/:tableName/:id` | `{ "campo": "nuevo_valor" }` | Actualizar un registro específico por ID. |

-----

### 6\. Almacenamiento (Implícito en Fase 4)

Aunque el código muestra el servicio, la ruta estándar REST sugerida sería:

| Método | Endpoint | Body (Multipart) | Descripción |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/storage/upload` | `FormData` (file, folder) | Subir archivo (Retorna URL y Key). |
| **DELETE**| `/api/v1/storage/:key` | *N/A* | Eliminar archivo. |

-----
