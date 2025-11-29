# Permission Schemas

Esta sección describe los esquemas de validación Zod utilizados para los endpoints de gestión de permisos. Los esquemas se definen en `src/schemas/index.ts` y se utilizan con `zValidator` de Hono para validar las solicitudes de entrada.

## Permission Schemas

### Create Permission Schema

Valida los datos para crear un nuevo permiso:

```typescript
create: z.object({
  name: z.string().min(2, "El nombre del permiso debe tener al menos 2 caracteres"),
  description: z.string().min(5, "La descripción debe tener al menos 5 caracteres"),
})
```

**Campos requeridos:**
- `name` (string, min 2): Nombre único del permiso, generalmente en formato `recurso:acción`
- `description` (string, min 5): Descripción detallada del permiso

**Uso:** Endpoint para crear permisos (a través de la API genérica `/api/permissions`)

**Ejemplo:**
```json
{
  "name": "users:create",
  "description": "Permite crear nuevos usuarios en el sistema"
}
```

### Update Permission Schema

Valida los datos para actualizar un permiso existente:

```typescript
update: z.object({
  name: z.string().min(2, "El nombre del permiso debe tener al menos 2 caracteres").optional(),
  description: z.string().min(5, "La descripción debe tener al menos 5 caracteres").optional(),
})
```

**Campos opcionales:**
- `name` (string, min 2): Nuevo nombre del permiso
- `description` (string, min 5): Nueva descripción del permiso

**Nota:** Todos los campos son opcionales, solo se actualizan los campos proporcionados.

**Uso:** Endpoint para actualizar permisos (a través de la API genérica `/api/permissions/:id`)

**Ejemplo:**
```json
{
  "description": "Permisos para crear y gestionar nuevos usuarios"
}
```

## Convenciones de Nombres

Los permisos siguen una convención de nomenclatura estandarizada:

### Formato
`recurso:acción` (ej: `users:create`)

### Recursos Comunes
- `users` - Gestión de usuarios
- `roles` - Gestión de roles
- `permissions` - Gestión de permisos
- `dashboard` - Acceso al panel
- `settings` - Configuración del sistema

### Acciones Comunes
- `list` - Listar elementos
- `view` - Ver detalles de un elemento
- `create` - Crear nuevos elementos
- `update` - Actualizar elementos existentes
- `delete` - Eliminar elementos
- `manage` - Gestión completa (todas las acciones anteriores)

## Mensajes de Error

Los esquemas incluyen mensajes de error descriptivos en español:

- Nombre corto: "El nombre del permiso debe tener al menos 2 caracteres"
- Descripción corta: "La descripción debe tener al menos 5 caracteres"

## Uso con zValidator

Los esquemas se utilizan con el middleware `zValidator` de Hono:

```typescript
import { zValidator } from "@hono/zod-validator";
import { permissionSchemas } from "../schemas";

// Ejemplo de uso en un endpoint
app.post("/permissions", 
  zValidator("json", permissionSchemas.create), 
  async (c) => {
    const data = c.req.valid("json"); // Datos validados
    // Lógica del endpoint
  }
);
```

## Permisos Base del Sistema

El sistema incluye un conjunto de permisos base que se crean automáticamente:

### Permisos de Usuarios
- `users:list` - Listar todos los usuarios
- `users:view` - Ver detalles de un usuario
- `users:create` - Crear nuevos usuarios
- `users:update` - Actualizar información de usuarios
- `users:delete` - Eliminar usuarios

### Permisos de Roles
- `roles:list` - Listar todos los roles
- `roles:view` - Ver detalles de un rol
- `roles:create` - Crear nuevos roles
- `roles:update` - Actualizar roles
- `roles:delete` - Eliminar roles
- `roles:assign` - Asignar roles a usuarios

### Permisos de Permisos
- `permissions:list` - Listar todos los permisos
- `permissions:view` - Ver detalles de un permiso
- `permissions:create` - Crear nuevos permisos
- `permissions:update` - Actualizar permisos
- `permissions:delete` - Eliminar permisos

### Permisos del Sistema
- `system:access` - Acceso al sistema
- `system:settings` - Configuración del sistema
- `system:logs` - Acceso a logs del sistema
- `system:backup` - Realizar backups del sistema

## Validación de Permisos

Los permisos se validan en el middleware de autorización:

```typescript
export function createPermissionMiddlewareForHono(
  requiredPermissions: string[],
  options: PermissionOptions = { requireAll: false },
) {
  return async (c: Context, next: Next) => {
    const authContext: AuthContext | undefined = c.get("auth");

    if (!authContext?.isAuthenticated) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const userPermissions = authContext.permissions || [];
    let hasPermission: boolean;

    if (options.requireAll) {
      hasPermission = requiredPermissions.every((p) =>
        userPermissions.includes(p),
      );
    } else {
      hasPermission = requiredPermissions.some((p) =>
        userPermissions.includes(p),
      );
    }

    if (!hasPermission) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    await next();
  };
}
```

## Extensiones Futuras

Los esquemas pueden extenderse para incluir:

1. **Validación de formato**: Asegurar que el nombre siga el formato `recurso:acción`
2. **Validación de unicidad**: Verificar que no exista un permiso con el mismo nombre
3. **Jerarquía de permisos**: Implementar permisos que impliquen otros (ej: `manage` incluye `create`, `update`, `delete`)
4. **Categorización**: Agrupar permisos por categoría o módulo
5. **Condiciones**: Permitir permisos condicionales basados en el contexto

## Consideraciones de Seguridad

1. **Validación exhaustiva**: Todos los datos de entrada se validan antes de procesarlos
2. **Control de acceso**: Los endpoints de gestión de permisos requieren permisos especiales
3. **Auditoría**: Las operaciones sobre permisos deberían registrarse en logs
4. **Principio de mínimo privilegio**: Los usuarios solo deben tener los permisos necesarios
5. **Validación de formato**: El formato `recurso:acción` previene nombres malformados
