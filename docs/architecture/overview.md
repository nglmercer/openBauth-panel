# Arquitectura de openBauth-panel

Este documento describe la arquitectura general del sistema openBauth-panel, incluyendo sus componentes principales, patrones de diseño y flujo de datos.

## Vista General

openBauth-panel es un panel de administración para el sistema de autenticación open-bauth, construido con Hono como framework web y SQLite como base de datos. El sistema sigue una arquitectura modular con una clara separación de responsabilidades.

## Componentes Principales

### 1. Capa de Presentación (Presentation Layer)

La capa de presentación consiste en dos partes:

- **API REST**: Endpoints JSON para comunicación con clientes frontend
- **SSR (Server-Side Rendering)**: Endpoints que renderizan HTML directamente en el servidor para facilitar la integración con frameworks frontend

### 2. Capa de Aplicación (Application Layer)

La capa de aplicación contiene la lógica de negocio y se organiza en:

- **Routers**: Definen los endpoints de la API y su enrutamiento
- **Middleware**: Procesan peticiones antes de llegar a los handlers
- **Validadores**: Validan y transforman los datos de entrada
- **Handlers**: Procesan las peticiones y coordinan las respuestas

### 3. Capa de Dominio (Domain Layer)

La capa de dominio contiene la lógica de negocio central y se organiza en:

- **Servicios**: Contienen la lógica de negocio (AuthService, PermissionService, etc.)
- **Tipos**: Definen las estructuras de datos del dominio
- **Esquemas**: Definen las reglas de validación de datos

### 4. Capa de Datos (Data Layer)

La capa de datos gestiona el almacenamiento y recuperación de datos:

- **Base de datos**: SQLite para persistencia de datos
- **Schema Extractor**: Extrae información del esquema de la base de datos
- **Base Controller**: Proporciona operaciones CRUD genéricas

## Flujo de Arquitectura

### Flujo de Autenticación

1. El cliente envía credenciales a `/auth/login` o `/auth/register`
2. El middleware de validación verifica el formato de los datos
3. El AuthService procesa las credenciales
4. Si son válidas, genera tokens JWT y los establece como cookies
5. El cliente recibe una respuesta con los datos del usuario (sin contraseña)

### Flujo de Autorización

1. El cliente envía una petición a un endpoint protegido
2. El middleware de autenticación verifica el token JWT
3. Si es válido, extrae el usuario y sus permisos
4. El middleware de autorización verifica los permisos necesarios
5. Si todo es correcto, la petición llega al handler correspondiente

### Flujo de CRUD Genérico

1. El cliente solicita una operación sobre una tabla específica
2. El Base Controller utiliza el schema para validar los datos
3. Ejecuta la operación CRUD correspondiente
4. Devuelve el resultado en un formato estandarizado

## Patrones de Diseño

### 1. Middleware Pattern

Los middlewares se utilizan para procesar peticiones en una cadena:

```typescript
app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", cors(...));

// Middleware específicos de ruta
app.use("/api/users/*", createAuthMiddlewareForHono(...));
app.use("/api/users/*", createPermissionMiddlewareForHono(...));
```

### 2. Service Layer Pattern

Los servicios encapsulan la lógica de negocio:

```typescript
export class AuthService {
  async register(data: RegisterData): Promise<AuthResult> {
    // Lógica de registro
  }
  
  async login(data: LoginData): Promise<AuthResult> {
    // Lógica de login
  }
}
```

### 3. Repository Pattern (implícito)

El Base Controller actúa como un repository genérico para operaciones CRUD:

```typescript
class BaseController {
  async findAll(options?: QueryOptions): Promise<QueryResult> {
    // Lógica de consulta genérica
  }
  
  async create(data: any): Promise<CrudResult> {
    // Lógica de inserción genérica
  }
}
```

### 4. Factory Pattern

El Schema Generator utiliza el patrón factory para crear validadores Zod:

```typescript
class ZodSchemaGenerator {
  static generate(schema: TableSchema): Record<string, ZodSchema> {
    // Lógica de generación de validadores
  }
}
```

## Gestión de Errores

El sistema utiliza un enfoque centralizado para la gestión de errores:

1. Los errores se capturan en los handlers
2. Se transforman a un formato estándar con `handleError`
3. Se registran para auditoría y debugging
4. Se devuelven al cliente con el código de estado HTTP apropiado

## Seguridad

La arquitectura incluye múltiples capas de seguridad:

1. **Autenticación**: Verificación de identidad mediante tokens JWT
2. **Autorización**: Control de acceso basado en permisos
3. **Validación**: Validación exhaustiva de entradas con Zod
4. **Sanitización**: Limpieza de datos para prevenir inyecciones
5. **Cookies seguras**: Configuración de cookies con flags de seguridad

## Escalabilidad

La arquitectura está diseñada para ser escalable:

1. **Modularidad**: Componentes desacoplados que pueden evolucionar independientemente
2. **Generic CRUD**: Permite añadir nuevas tablas sin modificar el código
3. **Middleware**: Permite añadir funcionalidad transversal fácilmente
4. **Tipado fuerte**: TypeScript facilita la refactorización y el mantenimiento

## Consideraciones de Rendimiento

1. **Conexión a BD**: Única conexión reutilizada para optimizar recursos
2. **Validación eficiente**: Esquemas Zod compilados para máxima velocidad
3. **Middleware ligero**: Middlewares optimizados para mínimo overhead
4. **Caché de permisos**: Permisos cacheados en el token JWT

## Arquitectura de Directorios

```
src/
├── index.ts              # Punto de entrada y configuración de rutas
├── db.ts                 # Configuración de la base de datos
├── middleware/           # Middlewares de autenticación y permisos
│   └── index.ts          # Funciones factory de middlewares
├── routers/              # Definición de rutas de la API
│   ├── auth.ts           # Endpoints de autenticación
│   ├── users.ts          # Endpoints de gestión de usuarios
│   ├── generic-api.ts    # Endpoints CRUD dinámicos
│   └── auth_ssr.tsx      # Endpoints SSR de autenticación
├── schemas/              # Esquemas de validación Zod
│   └── index.ts          # Definición de esquemas
├── types/                # Definiciones de tipos TypeScript
│   ├── index.ts          # Tipos principales y re-exportaciones
│   ├── errors.ts         # Tipos de error
│   ├── hono/             # Tipos específicos de Hono
│   └── database/         # Tipos relacionados con la BD
├── utils/                # Utilidades varias
│   └── error-handler.ts  # Gestión centralizada de errores
├── validator/            # Validadores de esquemas
│   └── schema-generator.ts # Generador de validadores Zod
├── database/             # Componentes de base de datos
│   └── base-controller.ts # Controlador CRUD genérico
└── views/                # Templates para SSR
    └── auth/             # Templates de autenticación
```

## Extensiones Futuras

La arquitectura permite extensiones futuras como:

1. **Microservicios**: Los servicios pueden extraerse a microservicios independientes
2. **Eventos**: Implementación de un sistema de eventos para desacoplamiento
3. **Caché**: Integración de sistemas de caché como Redis
4. **Colas**: Implementación de colas para tareas asíncronas
5. **API Gateway**: Despliegue detrás de un API Gateway para gestión centralizada

## Consideraciones de Despliegue

La arquitectura está diseñada para facilitar el despliegue:

1. **Contenerización**: Estructura adecuada para contenerización con Docker
2. **Variables de entorno**: Configuración externa para diferentes entornos
3. **Logs estructurados**: Logs en formato estructurado para ingestión en sistemas centralizados
4. **Health checks**: Endpoints para verificación de estado del servicio