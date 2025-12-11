
# Estructura del Proyecto

Descripción detallada de la arquitectura y organización del código de OpenBauth Panel.

## 📁 Árbol de Directorios

```
openBauth-panel/
├── src/                          # Código fuente principal
│   ├── database/                 # Capa de datos
│   │   ├── base-controller.ts    # Controlador base para operaciones CRUD
│   │   ├── schema/               # Esquemas de base de datos
│   │   │   ├── verification-token.ts
│   │   │   └── [otros-esquemas].ts
│   │   └── [database-initializer.ts]
│   ├── middleware/               # Middleware de Express/Hono
│   │   ├── index.ts              # Exportador de middleware
│   │   ├── validation.ts         # Validación de datos
│   │   └── [auth.ts]             # Autenticación (si existe)
│   ├── routes/                   # Rutas de la API
│   │   ├── index.ts              # Agregador de rutas
│   │   ├── auth.ts               # Rutas de autenticación
│   │   ├── user.ts               # Rutas de usuario
│   │   ├── admin.ts              # Rutas de administración
│   │   ├── oauth.ts              # Rutas OAuth 2.0/OIDC
│   │   ├── generic.ts            # Rutas genéricas CRUD
│   │   └── upload.ts             # Rutas de carga de archivos
│   ├── services/                 # Lógica de negocio
│   │   ├── service-factory.ts    # Factory para crear servicios
│   │   ├── audit.ts              # Servicio de auditoría
│   │   ├── notification.ts       # Servicio de notificaciones
│   │   ├── rate-limit.ts         # Rate limiting
│   │   ├── storage.ts            # Gestión de almacenamiento
│   │   └── verification.ts       # Verificación de tokens
│   ├── schemas/                  # Validación con Zod
│   │   ├── index.ts              # Exportador de esquemas
│   │   ├── validation-schemas.ts # Esquemas de validación
│   │   ├── extract-and-validate.ts # Utilidades de validación
│   │   └── schema-utils.ts       # Utilidades de esquemas
│   ├── types/                    # Definiciones de TypeScript
│   │   ├── errors.ts             # Tipos de errores
│   │   └── [otros-tipos].ts
│   ├── utils/                    # Utilidades
│   │   ├── error-handler.ts      # Manejo de errores
│   │   ├── errors.ts             # Definiciones de errores
│   │   ├── logger.ts             # Logging
│   │   └── system-tables.ts      # Tablas del sistema
│   ├── db.ts                     # Configuración de base de datos
│   └── index.ts                  # Punto de entrada principal
├── tests/                        # Tests
│   ├── setup.ts                  # Configuración de tests
│   ├── schema-validation.test.ts # Tests de validación
│   └── api/                      # Tests de API
│       ├── auth.test.ts          # Tests de autenticación
│       ├── user.test.ts          # Tests de usuario
│       ├── admin.test.ts         # Tests de administración
│       ├── oauth.test.ts         # Tests de OAuth
│       ├── generic.test.ts       # Tests de API genérica
│       └── unit/                 # Tests unitarios
├── scripts/                      # Scripts de utilidad
│   ├── setup-test-data.ts        # Datos de prueba
│   ├── [seed.ts]                 # Semilla de datos
│   └── [migrate.ts]              # Migraciones
├── docs/                         # Documentación
│   ├── README.md                 # Índice de documentación
│   └── articles/                 # Artículos de documentación
├── uploads/                      # Archivos subidos
├── .env.example                  # Ejemplo de variables de entorno
├── package.json                  # Dependencias y scripts
├── tsconfig.json                 # Configuración de TypeScript
└── README.md                     # README principal
```

## 🏗️ Arquitectura por Capas

### 1. Capa de Presentación (Routes)
- **Responsabilidad**: Manejar peticiones HTTP y respuestas
- **Archivos**: `src/routes/*.ts`
- **Ejemplo**: [`src/routes/auth.ts`](src/routes/auth.ts)

```typescript
// Ejemplo de ruta
app.post('/api/v1/auth/login', async (c) => {
  const { email, password } = c.req.valid('json');
  const result = await authService.login(email, password);
  return c.json(result);
});
```

### 2. Capa de Negocio (Services)
- **Responsabilidad**: Lógica de negocio y reglas
- **Archivos**: `src/services/*.ts`
- **Ejemplo**: [`src/services/notification.ts`](src/services/notification.ts)

```typescript
// Ejemplo de servicio
export class NotificationService {
  async sendEmail(to: string, subject: string, body: string) {
    // Lógica de envío de email
  }
}
```

### 3. Capa de Datos (Database)
- **Responsabilidad**: Acceso y manipulación de datos
- **Archivos**: `src/database/*.ts`
- **Ejemplo**: [`src/database/base-controller.ts`](src/database/base-controller.ts)

```typescript
// Ejemplo de controlador base
export class BaseController {
  async findAll(tableName: string, options: QueryOptions) {
    // Lógica de consulta
  }
}
```

### 4. Capa de Validación (Schemas)
- **Responsabilidad**: Validar entrada de datos
- **Archivos**: `src/schemas/*.ts`
- **Ejemplo**: [`src/schemas/validation-schemas.ts`](src/schemas/validation-schemas.ts)

```typescript
// Ejemplo de esquema Zod
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
```

## 🔧 Principios de Diseño

### 1. Separación de Responsabilidades
- Cada capa tiene una responsabilidad única
- Las rutas no contienen lógica de negocio
- Los servicios no acceden directamente a la BD

### 2. Inversión de Dependencias
- Las capas superiores dependen de abstracciones
- Uso de interfaces y factories
- Facilita el testing y mocking

### 3. Configuración por Convención
- Nombres de archivos descriptivos
- Estructura predecible
- Mínima configuración manual

## 📊 Flujo de Petición

```
Cliente HTTP → Routes → Middleware → Services → Database → Response
     ↓              ↓         ↓          ↓          ↓
Validation → Auth Check → Business Logic → Data Access → JSON Response
```

## 🧪 Estructura de Testing

### Tests Unitarios
- Prueban funciones individuales
- Mocks de dependencias
- Ejemplo: `tests/api/unit/`

### Tests de Integración
- Prueban flujos completos
- Base de datos de prueba
- Ejemplo: `tests/api/auth.test.ts`

### Tests de API
- Prueban endpoints HTTP
- Validan respuestas
- Verifican códigos de estado

## 🚀 Extensibilidad

### Agregar Nuevas Rutas
1. Crear archivo en `src/routes/`
2. Exportar desde `src/routes/index.ts`
3. Agregar validaciones en `src/schemas/`

### Agregar Nuevos Servicios
1. Crear clase en `src/services/`
2. Registrar en `src/services/service-factory.ts`
3. Implementar interfaz base

### Agregar Nuevas Tablas
1. Crear esquema en `src/database/schema/`
2. Actualizar `src/utils/system-tables.ts`
3. Crear migración en `scripts/`

## 📚 Patrones Utilizados

### Factory Pattern
- [`src/services/service-factory.ts`](src/services/service-factory.ts)
- Creación centralizada de servicios

### Repository Pattern
- [`src/database/base-controller.ts`](src/database/base-controller.ts)
- Abstracción del acceso a datos

### Middleware Pattern
- [`src/middleware/validation.ts`](src/middleware/validation.ts)
- Procesamiento en cadena

### Strategy Pattern
- Diferentes estrategias de autenticación
- OAuth providers

## 🔍 Debugging y Monitoreo

### Logging
- [`src/utils/logger.ts`](src/utils/logger.ts)
- Niveles: ERROR, WARN, INFO, DEBUG
- Configurable por variable de entorno

### Error Handling
- [`src/utils/error-handler.ts`](src/utils/error-handler.ts)
- Respuestas consistentes
- Stack traces en desarrollo

### Health Checks
- Endpoint `/health`
- Verificación de dependencias
- Status de servicios

