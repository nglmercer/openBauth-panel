# Auth Schemas

Esta sección describe los esquemas de validación Zod utilizados para los endpoints de autenticación. Los esquemas se definen en `src/schemas/index.ts` y se utilizan con `zValidator` de Hono para validar las solicitudes de entrada.

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

## Auth Schemas

### Login Schema

Valida los datos de inicio de sesión:

```typescript
login: z.object({
  email: email("Debe ser un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
})
```

**Campos:**
- `email` (string, email): Dirección de correo electrónico del usuario
- `password` (string, min 8): Contraseña del usuario

**Uso:** Endpoint `POST /auth/login`

### Register Schema

Valida los datos de registro de nuevos usuarios:

```typescript
register: z.object({
  ...baseUserSchema,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
})
```

**Campos:**
- `email` (string, email): Dirección de correo electrónico del usuario
- `username` (string, min 3): Nombre de usuario único
- `first_name` (string, min 3): Nombre del usuario
- `last_name` (string, min 3): Apellido del usuario
- `password` (string, min 8): Contraseña del usuario

**Uso:** Endpoint `POST /auth/register`

### Refresh Token Schema

Valida la solicitud de actualización de token:

```typescript
refresh: z.object({
  refreshToken: z.string(),
})
```

**Campos:**
- `refreshToken` (string): Token de actualización válido

**Uso:** Endpoint `POST /auth/refresh`

## Validación de Contraseñas

Para operaciones de cambio de contraseña, se utiliza un esquema especial que asegura que ambas contraseñas coincidan:

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
import { authSchemas } from "../schemas";

// Ejemplo de uso en un endpoint
app.post("/login", 
  zValidator("json", authSchemas.login), 
  async (c) => {
    const data = c.req.valid("json"); // Datos validados
    // Lógica del endpoint
  }
);
```

## Validación de SSR

Para los endpoints SSR, los mismos esquemas se aplican pero con `zValidator("form", ...)` para validar datos de formulario:

```typescript
app.post("/login", 
  zValidator("form", authSchemas.login), 
  async (c) => {
    const data = c.req.valid("form"); // Datos validados del formulario
    // Lógica del endpoint
  }
);
```

## Extensiones Futuras

Los esquemas pueden extenderse para incluir:

1. **Validación de fortaleza de contraseña**: Requerir mayúsculas, números, caracteres especiales
2. **Validación de username**: Restricciones de caracteres, palabras prohibidas
3. **Validación de nombre/apellido**: Permitir caracteres internacionales
4. **Validación de email**: Verificación de dominios permitidos

## Consideraciones de Seguridad

1. **Longitud mínima de contraseña**: 8 caracteres para garantizar seguridad básica
2. **Validación de email**: Previene ataques de inyección SQL en el campo email
3. **Refine personalizado**: Evita errores comunes como no confirmar correctamente la contraseña
4. **Validación de tipo**: Asegura que los datos sean del tipo esperado antes de procesarlos