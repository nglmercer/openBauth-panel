# 🚀 Roadmap de Migración - Sistema de Autenticación OpenBauth

## 📋 Tabla de Contenidos

### [FASE 0: Preparación y Configuración](#fase-0-preparación-y-configuración)
- [Requisitos Previos](#requisitos-previos)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Variables de Entorno](#variables-de-entorno)

### [FASE 1: Fundamentos - API REST con Hono](#fase-1-fundamentos-api-rest-con-hono)
- [1.1 Diseño de Rutas](#11-diseño-de-rutas)
- [1.2 Implementación Base](#12-implementación-base)
- [1.3 Middlewares Globales](#13-middlewares-globales)

### [FASE 2: API Genérica - Headless CMS](#fase-2-api-genérica-headless-cms)
- [2.1 Esquemas Dinámicos](#21-esquemas-dinámicos)
- [2.2 CRUD Automático](#22-crud-automático)
- [2.3 Validación con Zod](#23-validación-con-zod)

### [FASE 3: Infraestructura y Seguridad](#fase-3-infraestructura-y-seguridad)
- [3.1 Sistema de Notificaciones](#31-sistema-de-notificaciones)
- [3.2 Auditoría y Logs](#32-auditoría-y-logs)
- [3.3 Rate Limiting](#33-rate-limiting)
- [3.4 Gestión de Sesiones](#34-gestión-de-sesiones)

### [FASE 4: Almacenamiento y OIDC](#fase-4-almacenamiento-y-oidc)
- [4.1 Servicio de Almacenamiento](#41-servicio-de-almacenamiento)
- [4.2 Verificación de Email](#42-verificación-de-email)
- [4.3 Endpoint UserInfo OIDC](#43-endpoint-userinfo-oidc)

### [FASE 5: Consideraciones Finales](#fase-5-consideraciones-finales)
- [5.1 Testing](#51-testing)
- [5.2 Deployment](#52-deployment)
- [5.3 Troubleshooting](#53-troubleshooting)

---

## FASE 0: Preparación y Configuración

### Requisitos Previos

- **Node.js** >= 18.0.0 o **Bun** >= 1.0.0
- **TypeScript** >= 5.0.0
- **SQLite** (incluido con Bun)
- Conocimientos básicos de: TypeScript, REST APIs, JWT, OAuth 2.0

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

---

## FASE 1: Fundamentos - API REST con Hono

### 1.1 Diseño de Rutas

| Grupo | Método | Ruta | Descripción | Estándar Similar |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | POST | `/v1/auth/signup` | Registrar nuevo usuario | Supabase `/signup` |
| | POST | `/v1/auth/login` | Iniciar sesión (Password) | Supabase `/token` |
| | POST | `/v1/auth/anonymous` | Crear sesión anónima | Firebase Auth |
| | POST | `/v1/auth/refresh` | Rotar refresh token | Standard OAuth |
| | POST | `/v1/auth/logout` | Revocar sesión actual | Clerk `/logout` |
| **User** | GET | `/v1/user/me` | Obtener perfil del usuario | Auth0 `/userinfo` |
| | PATCH | `/v1/user/me` | Actualizar perfil | Clerk `/users/{id}` |
| | POST | `/v1/user/mfa/setup` | Iniciar configuración MFA | Auth0 MFA |
| | POST | `/v1/user/devices` | Registrar dispositivo confiable | Okta Devices |
| | POST | `/v1/user/biometric` | Registrar Passkey/Bio | WebAuthn |
| **OAuth** | GET | `/v1/oauth/authorize` | Pantalla de consentimiento | RFC 6749 |
| | POST | `/v1/oauth/token` | Intercambio de tokens | RFC 6749 |
| | POST | `/v1/oauth/revoke` | Revocar token | RFC 7009 |
| | POST | `/v1/oauth/introspect` | Validar token | RFC 7662 |
| | GET | `/v1/oauth/jwks` | Claves públicas para verificar JWT | OIDC Standard |
| **Admin** | GET | `/v1/admin/users` | Listar usuarios | Auth0 Management API |
| | POST | `/v1/admin/roles` | Crear rol | RBAC Standard |

### 1.2 Implementación Base

**Archivo:** [`src/routes.ts`](src/routes.ts)

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

// Importar Middlewares y Servicios
import { createAuthMiddleware, createRoleMiddleware } from "./middleware/auth";
import { createOAuthSecurityMiddleware } from "./middleware/oauth-security";
import { getServiceFactory } from "./services/service-factory";
import { AuthErrorType } from "./types/auth";

// Inicializar la aplicación
const app = new Hono().basePath("/api/v1");

// --- Middlewares Globales ---
app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", cors());

// --- Inyección de Servicios ---
const factory = getServiceFactory();
const { authService, jwtService, permissionService } = factory.getServices();

// Middleware de Autenticación
const protect = createAuthMiddleware({ jwtService, authService, permissionService });

// ------------------------------------------------------------------
// 1. AUTH ROUTES (Públicas)
// ------------------------------------------------------------------
const auth = new Hono();

auth.post("/signup", async (c) => {
  const body = await c.req.json();
  const result = await authService.register(body);
  
  if (!result.success) {
    return c.json(result, 400);
  }
  return c.json(result, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const result = await authService.login(body);
  
  if (!result.success) {
    return c.json(result, 401);
  }
  return c.json(result, 200);
});

// ------------------------------------------------------------------
// 2. USER ROUTES (Protegidas)
// ------------------------------------------------------------------
const user = new Hono();
user.use("*", protect);

user.get("/me", (c) => {
  const auth = (c as any).auth;
  return c.json({ user: auth.user, permissions: auth.permissions });
});

// ------------------------------------------------------------------
// 3. OAUTH ROUTES (Estándar RFC)
// ------------------------------------------------------------------
const oauth = new Hono();

oauth.post("/token", async (c) => {
  const body = await c.req.parseBody();
  // Implementar lógica OAuth
  return c.json({ token: "oauth-token" });
});

// ------------------------------------------------------------------
// 4. ADMIN ROUTES (RBAC Protegido)
// ------------------------------------------------------------------
const admin = new Hono();
admin.use("*", protect);
admin.use("*", createRoleMiddleware(["admin"]));

admin.get("/users", async (c) => {
  const result = await authService.getUsers();
  return c.json(result);
});

// --- Registro de Rutas ---
app.route("/auth", auth);
app.route("/user", user);
app.route("/oauth", oauth);
app.route("/admin", admin);

export default app;
```

### 1.3 Middlewares Globales

- **CORS**: Permite peticiones cross-origin
- **Logger**: Registro de peticiones HTTP
- **Pretty JSON**: Formatea respuestas JSON
- **Rate Limiting**: Protección contra abuso (implementar en Fase 3)

### ✅ Checklist Fase 1

- [ ] Configurar Hono con middlewares básicos
- [ ] Implementar rutas de autenticación (`/auth/*`)
- [ ] Crear middleware de autenticación JWT
- [ ] Implementar rutas de usuario protegidas (`/user/*`)
- [ ] Configurar rutas OAuth básicas (`/oauth/*`)
- [ ] Implementar rutas admin con RBAC (`/admin/*`)
- [ ] Probar endpoints con herramientas como Postman

---

## FASE 2: API Genérica - Headless CMS

### 2.1 Esquemas Dinámicos

**Archivo:** [`src/routes/generic.ts`](src/routes/generic.ts)

```typescript
import { Hono } from "hono";
import { createAuthMiddleware } from "../middleware/auth";
import { getServiceFactory } from "../services/service-factory";
import { isSystemTable } from "../constants/system-tables";

const factory = getServiceFactory();
const genericData = new Hono();

// Seguridad
const { jwtService, authService, permissionService } = factory.getServices();
genericData.use("*", createAuthMiddleware({ jwtService, authService, permissionService }));

// Middleware de contexto
genericData.use("/:tableName/*", async (c, next) => {
  const tableName = c.req.param("tableName");
  
  if (isSystemTable(tableName)) {
    return c.json({ error: "Access forbidden" }, 403);
  }
  
  const controller = factory.dbInitializer.createController(tableName);
  c.set('dataController', controller);
  await next();
});

// Obtener esquema de tabla
genericData.get("/:tableName/schema", async (c) => {
  const controller = c.get('dataController');
  const result = await controller.extractSchema();
  return c.json(result);
});
```

### 2.2 CRUD Automático

```typescript
// Listar registros
genericData.get("/:tableName", async (c) => {
  const controller = c.get('dataController');
  const query = c.req.query();
  
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const filters = Object.fromEntries(
    Object.entries(query).filter(([key]) => !['page', 'limit'].includes(key))
  );
  
  const result = await controller.findAll({ 
    limit, 
    offset: (page - 1) * limit,
    where: filters 
  });
  
  return c.json(result);
});

// Crear registro
genericData.post("/:tableName", async (c) => {
  const controller = c.get('dataController');
  const body = await c.req.json();
  const result = await controller.create(body);
  
  if (!result.success) return c.json(result, 400);
  return c.json(result, 201);
});

// Actualizar registro
genericData.patch("/:tableName/:id", async (c) => {
  const controller = c.get('dataController');
  const body = await c.req.json();
  const result = await controller.update(c.req.param("id"), body);
  
  if (!result.success) return c.json(result, 400);
  return c.json(result);
});
```

### 2.3 Validación con Zod

- Validación automática basada en esquema de base de datos
- Soporte para tipos personalizados
- Conversión automática de tipos SQL a Zod
- Generación de JSON Schema para frontend

### ✅ Checklist Fase 2

- [ ] Implementar middleware de contexto dinámico
- [ ] Crear endpoint `/schema` para cada tabla
- [ ] Implementar operaciones CRUD completas
- [ ] Añadir paginación y filtros
- [ ] Configurar validación automática con Zod
- [ ] Proteger tablas del sistema
- [ ] Documentar formato de respuesta

---

## FASE 3: Infraestructura y Seguridad

### 3.1 Sistema de Notificaciones

**Archivo:** [`src/services/notification.ts`](src/services/notification.ts)

```typescript
import nodemailer from "nodemailer";

export class NotificationService {
  private transporter: nodemailer.Transporter;
  
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    return this.sendEmail({
      to: email,
      subject: "Recuperación de Contraseña",
      html: `
        <h1>Recupera tu acceso</h1>
        <p>Haz clic en el siguiente enlace:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>Este enlace expira en 1 hora.</p>
      `
    });
  }
}
```

### 3.2 Auditoría y Logs

```typescript
export class AuditService {
  async log(event: string, data: { 
    userId?: string, 
    ip?: string, 
    level?: string, 
    meta?: any 
  }) {
    await this.controller.create({
      event,
      user_id: data.userId,
      ip_address: data.ip,
      level: data.level || "info",
      metadata: data.meta ? JSON.stringify(data.meta) : undefined
    });
  }
}
```

### 3.3 Rate Limiting

```typescript
export class RateLimitService {
  async consume(
    key: string, 
    pointsToConsume: number = 1, 
    limit: number = 10, 
    windowSeconds: number = 60
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    // ... lógica de control de límites
    return true; // o false si está bloqueado
  }
}
```

### 3.4 Gestión de Sesiones

- Sesiones stateful en base de datos
- Refresh tokens seguros
- Invalidación de sesiones
- Seguimiento de actividad

### ✅ Checklist Fase 3

- [ ] Configurar servicio de notificaciones con nodemailer
- [ ] Implementar sistema de auditoría
- [ ] Crear servicio de rate limiting
- [ ] Añadir gestión de sesiones stateful
- [ ] Implementar recuperación de contraseña
- [ ] Configurar verificación de email
- [ ] Añadir logs de seguridad

---

## FASE 4: Almacenamiento y OIDC

### 4.1 Servicio de Almacenamiento

**Archivo:** [`src/services/storage.ts`](src/services/storage.ts)

```typescript
export interface IStorageProvider {
  upload(file: File | Blob, folder?: string): Promise<{ url: string; key: string }>;
  delete(key: string): Promise<boolean>;
}

export class LocalStorageProvider implements IStorageProvider {
  async upload(file: File | Blob, folder: string = "default"): Promise<{ url: string; key: string }> {
    const buffer = await file.arrayBuffer();
    const filename = `${randomUUID()}${extname(file.name)}`;
    const filePath = join(this.uploadDir, folder, filename);
    
    await Bun.write(filePath, buffer);
    
    return {
      key: `${folder}/${filename}`,
      url: `${this.baseUrl}/${folder}/${filename}`
    };
  }
}
```

### 4.2 Verificación de Email

```typescript
// En AuthService
async verifyEmail(token: string): Promise<boolean> {
  const record = await this.verificationController.findFirst({ token });
  if (!record.data) return false;
  
  if (new Date() > new Date(record.data.expires_at)) return false;
  
  await this.userController.update(record.data.user_id, { 
    is_active: true 
  });
  
  await this.verificationController.delete(record.data.id);
  return true;
}
```

### 4.3 Endpoint UserInfo OIDC

```typescript
// En OAuthService
async getUserInfo(accessToken: string): Promise<Record<string, any> | null> {
  try {
    const payload = await this.jwtService.verifyToken(accessToken);
    const user = await this.userService.findUserById(payload.userId);
    if (!user) return null;
    
    const scopes = payload.scope?.split(" ") || [];
    const userInfo: Record<string, any> = {
      sub: user.id,
    };
    
    if (scopes.includes("profile")) {
      userInfo.name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
      userInfo.preferred_username = user.username;
    }
    
    if (scopes.includes("email")) {
      userInfo.email = user.email;
      userInfo.email_verified = true;
    }
    
    return userInfo;
  } catch (e) {
    return null;
  }
}
```

### ✅ Checklist Fase 4

- [ ] Implementar servicio de almacenamiento local
- [ ] Crear endpoint de upload de archivos
- [ ] Implementar verificación de email
- [ ] Añadir endpoint OIDC UserInfo
- [ ] Configurar serving de archivos estáticos
- [ ] Implementar borrado seguro de archivos
- [ ] Añadir validación de tipos de archivo

---

## FASE 5: Consideraciones Finales

### 5.1 Testing

```typescript
// Ejemplo de test
describe("AuthService", () => {
  it("should register a new user", async () => {
    const result = await authService.register({
      email: "test@example.com",
      password: "secure123",
      first_name: "Test"
    });
    
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
  });
});
```

### 5.2 Deployment

**Dockerfile:**
```dockerfile
FROM oven/bun:1.0
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bun build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=/data/auth.db
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./data:/data
```

### 5.3 Troubleshooting

#### Problemas Comunes:

1. **Error de conexión a BD**
   - Verificar que SQLite esté disponible
   - Comprobar permisos de escritura

2. **JWT no válido**
   - Verificar `JWT_SECRET`
   - Comprobar expiración de tokens

3. **Emails no se envían**
   - Verificar credenciales SMTP
   - Comprobar firewall/antivirus

4. **Rate limiting muy estricto**
   - Ajustar límites en configuración
   - Verificar IP del cliente

5. **Archivos no se suben**
   - Verificar límites de tamaño
   - Comprobar permisos de directorio

### 📊 Métricas de Éxito

- [ ] Todos los endpoints responden < 200ms
- [ ] Coverage de tests > 80%
- [ ] Zero security vulnerabilities
- [ ] Documentación completa de API
- [ ] Monitoring y alertas configurados
- [ ] Backup automático de BD
- [ ] SSL/TLS habilitado en producción

### 🎯 Próximos Pasos

1. **Escalabilidad**: Implementar Redis para caché
2. **Microservicios**: Separar servicios críticos
3. **Analytics**: Añadir métricas de uso
4. **Mobile**: Optimizar para apps móviles
5. **Enterprise**: SSO con SAML/LDAP

---

## 📚 Referencias

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [OpenID Connect](https://openid.net/connect/)
- [Hono Documentation](https://hono.dev/)
- [Bun Documentation](https://bun.sh/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

---

*Última actualización: Diciembre 2024*
*Versión: 1.0.0*