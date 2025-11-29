# User Schemas

Esta sección describe los esquemas de validación Zod utilizados para los endpoints de gestión de usuarios. Los esquemas se definen en `src/schemas/index.ts` y se utilizan con `zValidator` de Hono para validar las solicitudes de entrada.

## Base User Schema

El esquema base de usuario se define una vez y se reutiliza en otros esquemas:

```typescript
const baseUserSchema = {
  email: email("Debe ser un email válido"),
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  first_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  last_name: z.string().min(3, "El apellido debe tener al menos 3 caracteres"),
};
```

## User Schemas

### Create User Schema

Valida los datos para crear un nuevo usuario:

```typescript
create: z.object({
  ...baseUserSchema,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.string().optional(),
  active: z.boolean().optional(),
})
```

**Campos requeridos:**
- `email` (string, email): Dirección de correo electrónico del usuario
- `username` (string, min 3): Nombre de usuario único
- `first_name` (string, min 3): Nombre del usuario
- `last_name` (string, min 3): Apellido del usuario
- `password` (string, min 8): Contraseña del usuario

**Campos opcionales:**
- `role` (string): Rol asignado al usuario (default: "user")
- `active` (boolean): Estado del usuario (default: true)

**Uso:** Endpoint `POST /api/users`

### Update User Schema

Valida los datos para actualizar un usuario existente:

```typescript
update: z.object({
  email: email("Debe ser un email válido").optional(),
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres").optional(),
  first_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres").optional(),
  last_name: z.string().min(3, "El apellido debe tener al menos 3 caracteres").optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").optional(),
  role: z.string().optional(),
  active: z.boolean().optional(),
})
```

**Campos opcionales:**
- `email` (string, email): Nueva dirección de correo electrónico
- `username` (string, min 3): Nuevo nombre de usuario
- `first_name` (string, min 3): Nuevo nombre del usuario
- `last_name` (string, min 3): Nuevo apellido del usuario
- `password` (string, min 8): Nueva contraseña del usuario
- `role` (string): Nuevo rol del usuario
- `active` (boolean): Nuevo estado del usuario

**Nota:** Todos los campos son opcionales, solo se actualizan los campos proporcionados.

**Uso:** Endpoint `PUT /api/users/:id`

## Validación de Contraseñas

### Update Password Schema

Valida los datos para cambiar la contraseña de un usuario:

```typescript
updatePassword: z.object({
  currentPassword: z.string().min(8, "La contraseña actual debe tener al menos 8 caracteres"),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
  confirmPassword: z.string().min(8, "Confirmar contraseña debe tener al menos 8 caracteres"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})
```

**Campos:**
- `currentPassword` (string, min 8): Contraseña actual del usuario
- `newPassword` (string, min 8): Nueva contraseña del usuario
- `confirmPassword` (string, min 8): Confirmación de la nueva contraseña

**Validación especial:**
- `refine`: Verifica que `newPassword` y `confirmPassword` sean idénticos

**Uso:** Endpoint `POST /auth/change-password`

## Mensajes de Error

Los esquemas incluyen mensajes de error descriptivos en español para facilitar la retroalimentación al usuario:

- Email inválido: "Debe ser un email válido"
- Contraseña corta: "La contraseña debe tener al menos 8 caracteres"
- Usuario corto: "El nombre de usuario debe tener al menos 3 caracteres"
- Nombre corto: "El nombre debe tener al menos 3 caracteres"
- Apellido corto: "El apellido debe tener al menos 3 caracteres"
- Contraseñas no coinciden: "Las contraseñas no coinciden"

## Uso con zValidator

Los esquemas se utilizan con el middleware `zValidator` de Hono:

```typescript
import { zValidator } from "@hono/zod-validator";
import { userSchemas } from "../schemas";

// Ejemplo de uso en un endpoint
app.post("/users", 
  zValidator("json", userSchemas.create), 
  async (c) => {
    const data = c.req.valid("json"); // Datos validados
    // Lógica del endpoint
  }
);
```

## Validación de Permisos

Además de la validación de esquemas, los endpoints de usuarios requieren validación de permisos:

- `users:create` - Para crear nuevos usuarios
- `users:update` - Para actualizar usuarios (excepto el propio usuario)
- `users:delete` - Para eliminar usuarios

## Validación de Autenticación

Para operaciones específicas, un usuario puede modificar su propia información sin permisos especiales:

```typescript
// Un usuario puede actualizar su propio perfil sin el permiso users:update
if (userId !== targetId) {
  // Verificar permisos con el middleware
  const hasPermission = authContext?.permissions?.includes("users:update") || false;
  if (!hasPermission) {
    return c.json(ErrorResponse.authorization("Insufficient permissions"), 403);
  }
}
```

## Extensiones Futuras

Los esquemas pueden extenderse para incluir:

1. **Validación de fortaleza de contraseña**: Requerir mayúsculas, números, caracteres especiales
2. **Validación de username**: Restricciones de caracteres, palabras prohibidas
3. **Validación de nombre/apellido**: Permitir caracteres internacionales
4. **Validación de email**: Verificación de dominios permitidos
5. **Validación de roles**: Asegurar que el rol exista antes de asignarlo
6. **Validación de active**: Lógica adicional para desactivar usuarios

## Consideraciones de Seguridad

1. **Longitud mínima de contraseña**: 8 caracteres para garantizar seguridad básica
2. **Validación de email**: Previene ataques de inyección SQL en el campo email
3. **Refine personalizado**: Evita errores comunes como no confirmar correctamente la contraseña
4. **Validación de tipo**: Asegura que los datos sean del tipo esperado antes de procesarlos
5. **Contraseña no incluida**: La contraseña nunca se devuelve en las respuestas de la API
6. **Validación de permisos**: Las operaciones sensibles requieren verificación de permisos