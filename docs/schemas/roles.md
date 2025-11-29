# Role Schemas

Esta sección describe los esquemas de validación Zod utilizados para los endpoints de gestión de roles. Los esquemas se definen en `src/schemas/index.ts` y se utilizan con `zValidator` de Hono para validar las solicitudes de entrada.

## Role Schemas

### Create Role Schema

Valida los datos para crear un nuevo rol:

```typescript
create: z.object({
  name: z.string().min(2, "El nombre del rol debe tener al menos 2 caracteres"),
  description: z.string().min(5, "La descripción debe tener al menos 5 caracteres"),
  permissions: z.array(z.string()).default([]),
})
```

**Campos requeridos:**
- `name` (string, min 2): Nombre único del rol
- `description` (string, min 5): Descripción detallada del rol

**Campos opcionales:**
- `permissions` (array<string>): Lista de IDs de permisos asignados al rol (default: [])

**Uso:** Endpoint para crear roles (a través de la API genérica `/api/roles`)

**Ejemplo:**
```json
{
  "name": "editor",
  "description": "Rol para editores de contenido",
  "permissions": ["content:create", "content:update", "content:view"]
}
```

### Update Role Schema

Valida los datos para actualizar un rol existente:

```typescript
update: z.object({
  name: z.string().min(2, "El nombre del rol debe tener al menos 2 caracteres").optional(),
  description: z.string().min(5, "La descripción debe tener al menos 5 caracteres").optional(),
  permissions: z.array(z.string()).optional(),
})
```

**Campos opcionales:**
- `name` (string, min 2): Nuevo nombre del rol
- `description` (string, min 5): Nueva descripción del rol
- `permissions` (array<string>): Nueva lista de IDs de permisos asignados al rol

**Nota:** Todos los campos son opcionales, solo se actualizan los campos proporcionados.

**Uso:** Endpoint para actualizar roles (a través de la API genérica `/api/roles/:id`)

**Ejemplo:**
```json
{
  "description": "Rol actualizado para editores de contenido con privilegios extendidos",
  "permissions": ["content:create", "content:update", "content:view", "content:publish"]
}
```

## Mensajes de Error

Los esquemas incluyen mensajes de error descriptivos en español:

- Nombre corto: "El nombre del rol debe tener al menos 2 caracteres"
- Descripción corta: "La descripción debe tener al menos 5 caracteres"

## Uso con zValidator

Los esquemas se utilizan con el middleware `zValidator` de Hono:

```typescript
import { zValidator } from "@hono/zod-validator";
import { roleSchemas } from "../schemas";

// Ejemplo de uso en un endpoint
app.post("/roles", 
  zValidator("json", roleSchemas.create), 
  async (c) => {
    const data = c.req.valid("json"); // Datos validados
    // Lógica del endpoint
  }
);
```

## Roles Base del Sistema

El sistema incluye un conjunto de roles base que se crean automáticamente:

### Super Admin
- ID: `super_admin`
- Descripción: "Acceso completo a todas las funcionalidades del sistema"
- Permisos: Todos los permisos disponibles

### Admin
- ID: `admin`
- Descripción: "Acceso a funciones administrativas básicas"
- Permisos: 
  - `users:list`, `users:view`, `users:create`, `users:update`
  - `roles:list`, `roles:view`
  - `permissions:list`, `permissions:view`

### User
- ID: `user`
- Descripción: "Usuario básico del sistema"
- Permisos: 
  - `profile:view`, `profile:update`

## Gestión de Permisos en Roles

### Asignación de Permisos

Los permisos se asignan a roles a través de la API genérica:

```typescript
// Asignar un permiso a un rol
await permissionService.assignPermissionToRole(roleId, permissionId);
```

### Revocación de Permisos

```typescript
// Revocar un permiso de un rol
await permissionService.revokePermissionFromRole(roleId, permissionId);
```

### Obtención de Permisos

```typescript
// Obtener todos los permisos de un rol
const rolePermissions = await permissionService.getRolePermissions(roleId);
```

## Validación de Roles

Los roles se validan en el middleware de autorización:

```typescript
export function createRoleMiddlewareForHono(requiredRoles: string[]) {
  return async (c: Context, next: Next) => {
    const authContext: AuthContext | undefined = c.get("auth");

    if (!authContext?.isAuthenticated || !authContext.user?.roles) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const userRoleNames = authContext.user.roles.map((r) => r.name);
    const hasRole = requiredRoles.some((requiredRole) =>
      userRoleNames.includes(requiredRole),
    );

    if (!hasRole) {
      return c.json({ error: "Access denied. Required role not found." }, 403);
    }

    await next();
  };
}
```

## Extensiones Futuras

Los esquemas pueden extenderse para incluir:

1. **Validación de unicidad**: Verificar que no exista un rol con el mismo nombre
2. **Jerarquía de roles**: Implementar una jerarquía donde un rol puede heredar permisos de otro
3. **Validación de permisos**: Asegurar que todos los permisos asignados existan
4. **Categorización**: Agrupar roles por categoría o módulo
5. **Condiciones**: Permitir roles con permisos condicionales basados en el contexto
6. **Estado del rol**: Activar/desactivar roles sin eliminarlos

## Consideraciones de Seguridad

1. **Validación exhaustiva**: Todos los datos de entrada se validan antes de procesarlos
2. **Control de acceso**: Los endpoints de gestión de roles requieren permisos especiales
3. **Principio de mínimo privilegio**: Los roles solo deben tener los permisos necesarios
4. **Auditoría**: Las operaciones sobre roles deberían registrarse en logs
5. **Prevención de escalada de privilegios**: Un rol no puede asignarse a sí mismo permisos que no tiene
6. **Validación de permisos existentes**: Asegurar que todos los permisos asignados a un rol existan

## Modelo de Datos

El modelo de datos de un rol en la base de datos:

```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);