
### Estructura del Proyecto

```
openBauth-panel/
├── src/
│   ├── database/
│   │   ├── schema/
│   │   └── base-controller.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   └── index.ts
│   ├── routes/
│   │   ├── admin.ts
│   │   ├── auth.ts
│   │   ├── generic.ts
│   │   ├── index.ts
│   │   ├── oauth.ts
│   │   ├── upload.ts
│   │   └── user.ts
│   ├── schemas/
│   ├── services/
│   │   ├── audit.ts
│   │   ├── notification.ts
│   │   ├── rate-limit.ts
│   │   ├── service-factory.ts
│   │   ├── storage.ts
│   │   └── verification.ts
│   ├── types/
│   ├── utils/
│   ├── db.ts
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

### 1. Sistema (`/`)

Endpoints de utilidad y estado del sistema.

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| **GET** | `/api/v1/health` | Verificar estado del servicio. |
| **GET** | `/api/v1/docs` | Documentación API y lista de endpoints activos. |

-----

### 2. Autenticación (`/auth`)

Estas rutas manejan el acceso inicial y gestión de sesiones.

| Método | Endpoint | Body (JSON) | Descripción |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/signup` | `{ "email": "...", "password": "...", "first_name": "..." }` | Registrar nuevo usuario. |
| **POST** | `/api/v1/auth/login` | `{ "email": "...", "password": "..." }` | Iniciar sesión (Devuelve Token). |
| **POST** | `/api/v1/auth/anonymous` | *N/A* | Crear una sesión anónima (Guest). |
| **POST** | `/api/v1/auth/refresh` | `{ "refreshToken": "..." }` | Renovación de token de acceso. |
| **POST** | `/api/v1/auth/logout` | *N/A* | Revocar la sesión actual. |
| **POST** | `/api/v1/auth/forgot-password` | `{ "email": "..." }` | Solicitar reseteo de contraseña. |
| **POST** | `/api/v1/auth/reset-password` | `{ "token": "...", "newPassword": "..." }` | Establecer nueva contraseña. |
| **POST** | `/api/v1/auth/verify-email` | `{ "token": "..." }` | Verificar correo electrónico. |

-----

### 3. Usuario (`/user`)

Rutas protegidas (requieren Header `Authorization: Bearer <token>`).

| Método | Endpoint | Body (JSON) | Descripción |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/user/me` | *N/A* | Obtener perfil del usuario, roles y configuración. |
| **PATCH** | `/api/v1/user/me` | `{ "first_name": "...", ... }` | Actualizar datos del perfil. |
| **POST** | `/api/v1/user/password` | `{ "currentPassword": "...", "newPassword": "..." }` | Cambiar contraseña. |
| **POST** | `/api/v1/user/mfa/setup` | `{ "mfaType": "totp|sms|email", ... }` | Iniciar configuración de MFA (2FA). |
| **POST** | `/api/v1/user/mfa/verify` | `{ "mfaType": "...", "code": "..." }` | Verificar código MFA para activar/usar. |
| **GET** | `/api/v1/user/devices` | *N/A* | Listar dispositivos registrados. |
| **POST** | `/api/v1/user/devices` | `{ "deviceName": "..." }` | Registrar dispositivo actual. |
| **POST** | `/api/v1/user/biometric` | `{ "publicKey": "...", "challenge": "..." }` | Registrar Passkey/Biometría. |

-----

### 4. Protocolo OAuth 2.0 / OIDC (`/oauth`)

Estándares RFC para integración con otros sistemas.

| Método | Endpoint | Params / Body | Descripción |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/oauth/authorize` | `?client_id=...&response_type=...` | Flujo de autorización (Login social/SSO). |
| **POST** | `/api/v1/oauth/token` | `grant_type`, `code`... | Obtención de tokens (Code, Client Credentials, Refresh, Password). |
| **POST** | `/api/v1/oauth/revoke` | `{ "token": "..." }` | Revocar Access/Refresh Token. |
| **POST** | `/api/v1/oauth/introspect`| `{ "token": "..." }` | Validar metadatos de un token. |
| **GET** | `/api/v1/oauth/jwks` | *N/A* | Obtener claves públicas (JSON Web Key Set). |
| **GET** | `/api/v1/oauth/userinfo` | *N/A* | Obtener claims del usuario (OIDC). |

-----

### 5. Administración (`/admin`)

Rutas protegidas con **RBAC** (Solo rol `admin`).

| Método | Endpoint | Body (JSON) | Descripción |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/admin/users` | *N/A* | Listar todos los usuarios. |
| **GET** | `/api/v1/admin/roles` | *N/A* | Listar roles del sistema. |
| **POST** | `/api/v1/admin/roles` | `{ "name": "...", "permissions": [...] }` | Crear un nuevo rol. |
| **POST** | `/api/v1/admin/users/:id/roles` | `{ "role": "..." }` | Asignar rol a un usuario. |
| **GET** | `/api/v1/admin/permissions` | *N/A* | Listar permisos disponibles. |

-----

### 6. API Genérica (`/data/:tableName`)

Headless CMS para gestión dinámica de tablas.

| Método | Endpoint | Query Params / Body | Descripción |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/data/:tableName` | `?page=1&limit=20&sort=col&q={filter}` | Listar registros con filtros y paginación. |
| **GET** | `/api/v1/data/:tableName/:id` | *N/A* | Obtener un registro por ID. |
| **POST** | `/api/v1/data/:tableName` | `{ ...data }` | Crear nuevo registro (Valida schema si existe). |
| **PUT** | `/api/v1/data/:tableName/:id` | `{ ...data }` | Actualizar registro. |
| **DELETE**| `/api/v1/data/:tableName/:id` | *N/A* | Eliminar registro. |
| **GET** | `/api/v1/data/:tableName/schema` | *N/A* | Obtener estructura de la tabla. |
| **GET** | `/api/v1/data/:tableName/count` | `?q={filter}` | Contar registros. |
| **GET** | `/api/v1/data/:tableName/search` | `?q=text` | Búsqueda avanzada. |
| **POST** | `/api/v1/data/:tableName/bulk` | `{ "records": [...] }` | Carga masiva de datos. |

-----

### 7. Almacenamiento (`/upload`)

Gestión de archivos.

| Método | Endpoint | Body (Multipart) | Descripción |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/upload` | `file` (FormData) | Subir archivo (Retorna URL y Key). |
