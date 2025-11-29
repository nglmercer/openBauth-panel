# Middleware de Autenticación y Autorización

Este documento describe el middleware de autenticación y autorización utilizado en openBauth-panel. El sistema utiliza un enfoque basado en funciones factory para crear middlewares específicos para diferentes necesidades.

## Overview del Sistema de Middleware

El sistema de middleware de openBauth-panel se compone de tres componentes principales:

1. **Middleware de Autenticación**: Verifica la identidad del usuario a través de tokens JWT
2. **Middleware de Autorización**: Verifica los permisos del usuario para acceder a recursos
3. **Middleware de Roles**: Verifica los roles del usuario para operaciones específicas

## Middleware de Autenticación

### createAuthMiddlewareForHono

Función factory que crea un middleware de autenticación para Hono:

```typescript
function createAuthMiddlewareForHono(
  services: {
    jwtService: JWTService;
    authService: AuthService;
    permissionService: PermissionService;
  },
  required: boolean = true
): MiddlewareHandler
```

#### Parámetros

- `services`: Objeto con los servicios necesarios para la autenticación
- `required`: Booleano que indica si la autenticación es obligatoria (default: true)

#### Flujo de Autenticación

1. Extrae el token del header `Authorization`
2. Verifica la validez del token con `jwtService.verifyToken`
3. Busca el usuario en la base de datos con `authService.findUserById`
4. Obtiene los roles y permisos del usuario
5. Adjunta el contexto de autenticación al request de Hono

#### Uso

```typescript
// Middleware de autenticación obligatorio para todas las rutas
usersRouter.use("*", createAuthMiddlewareForHono({
  jwtService,
  authService,
  permissionService,
}));

// Middleware de autenticación opcional
app.use("/public/*", createAuthMiddlewareForHono({
  jwtService,
  authService,
  permissionService,
}, false));
```

## Middleware de Autorización

### createPermissionMiddlewareForHono

Función factory que crea un middleware de autorización basado en permisos:

```typescript
function createPermissionMiddlewareForHono(
  requiredPermissions: string[],
  options: PermissionOptions = { requireAll: false }
): MiddlewareHandler
```

#### Parámetros

- `requiredPermissions`: Array de permisos requeridos
- `options`: Opciones de configuración
  - `requireAll`: Si es true, requiere todos los permisos; si es false, requiere al menos uno

#### Lógica de Autorización

1. Verifica que el usuario esté autenticado
2. Obtiene los permisos del usuario desde el contexto de autenticación
3. Verifica si el usuario tiene los permisos requeridos
4. Permitir o denegar el acceso según el resultado

#### Uso

```typescript
// Requiere al menos uno de los permisos especificados
app.use("/api/users/*", createPermissionMiddlewareForHono([
  "users:list", "users:view"
]));

// Requiere todos los permisos especificados
app.use("/api/users/admin/*", createPermissionMiddlewareForHono([
  "users:delete", "users:create"
], { requireAll: true }));
```

## Middleware de Roles

### createRoleMiddlewareForHono

Función factory que crea un middleware de autorización basado en roles:

```typescript
function createRoleMiddlewareForHono(
  requiredRoles: string[]
): MiddlewareHandler
```

#### Parámetros

- `requiredRoles`: Array de nombres de roles requeridos

#### Lógica de Autorización por Roles

1. Verifica que el usuario esté autenticado
2. Obtiene los roles del usuario desde el contexto de autenticación
3. Verifica si el usuario tiene al menos uno de los roles requeridos
4. Permitir o denegar el acceso según el resultado

#### Uso

```typescript
// Requiere rol de admin o moderator
app.use("/api/admin/*", createRoleMiddlewareForHono([
  "admin", "moderator"
]));
```

## Contexto de Autenticación

Los middlewares adjuntan un contexto de autenticación al request de Hono:

```typescript
interface AuthContext {
  user?: User;
  token?: string;
  permissions?: string[];
  isAuthenticated: boolean;
}
```

El contexto puede ser accedido en los handlers:

```typescript
app.get("/profile", async (c) => {
  const authContext = c.get("auth");
  
  if (!authContext.isAuthenticated) {
    return c.json({ error: "Authentication required" }, 401);
  }
  
  return c.json({ user: authContext.user });
});
```

## Manejo de Errores

Los middlewares manejan errores específicos:

### Errores de Autenticación

- `401 Unauthorized`: Token inválido, expirado o ausente
- `401 Unauthorized`: Usuario no encontrado o inactivo

### Errores de Autorización

- `403 Forbidden`: Permisos insuficientes
- `403 Forbidden`: Roles insuficientes

## Combinación de Middlewares

Los middlewares pueden combinarse para crear reglas complejas:

```typescript
// Ruta que requiere autenticación y permisos específicos
app.get("/api/users",
  createAuthMiddlewareForHono({ jwtService, authService, permissionService }),
  createPermissionMiddlewareForHono(["users:list"])
);

// Ruta que requiere autenticación y rol específico
app.post("/api/admin/backup",
  createAuthMiddlewareForHono({ jwtService, authService, permissionService }),
  createRoleMiddlewareForHono(["admin"])
);
```

## Extensión del Sistema

El sistema de middleware está diseñado para ser extensible:

### Añadir Nuevos Tipos de Middleware

```typescript
function createCustomMiddleware(options: CustomOptions) {
  return async (c: Context, next: Next) => {
    // Lógica personalizada
    await next();
  };
}
```

### Modificar Middlewares Existentes

Los middlewares pueden extenderse o modificarse sin afectar al resto del sistema.

## Consideraciones de Rendimiento

1. **Caché de permisos**: Los permisos se incluyen en el token JWT para reducir consultas a la BD
2. **Validación eficiente**: Los middlewares están optimizados para procesamiento rápido
3. **Encapsulación**: Los servicios están encapsulados para facilitar testing y mocking

## Consideraciones de Seguridad

1. **Validación exhaustiva**: Todos los tokens se validan rigurosamente
2. **Principio de mínimo privilegio**: Los usuarios solo tienen acceso a lo necesario
3. **Seguridad por defecto**: El acceso es denegado por defecto

## Testing de Middlewares

Los middlewares están diseñados para facilitar el testing:

```typescript
// Test unitario de middleware de autenticación
test("should allow access with valid token", async () => {
  const middleware = createAuthMiddlewareForHono({
    jwtService: mockJWTService,
    authService: mockAuthService,
    permissionService: mockPermissionService
  });
  
  const c = new MockContext({
    header: () => "Bearer valid-token"
  });
  const next = jest.fn();
  
  await middleware(c, next);
  
  expect(c.get("auth").isAuthenticated).toBe(true);
  expect(next).toHaveBeenCalled();
});
```

## Evolución Futura

El sistema de middleware puede evolucionar para incluir:

1. **Middleware de caché**: Para respuestas cacheadas
2. **Middleware de limitación de velocidad**: Para prevenir abusos
3. **Middleware de auditoría**: Para registrar actividades
4. **Middleware de internacionalización**: Para soporte multiidioma
5. **Middleware de validación avanzada**: Para reglas de negocio complejas