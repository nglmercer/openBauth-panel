import { z, email } from "zod";

// Base User Schema (para reutilización)
const baseUserSchema = {
  email: email("Debe ser un email válido"),
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  first_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  last_name: z.string().min(3, "El apellido debe tener al menos 3 caracteres"),
};

// Schemas de autenticación
export const authSchemas = {
  // Login (solo email/password)
  login: z.object({
    email: email("Debe ser un email válido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
  }),

  // Register (requiere todos los campos)
  register: z.object({
    ...baseUserSchema,
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
  }),

  // Refresh token
  refresh: z.object({
    refreshToken: z.string(),
  }),
};

// Schemas de usuarios
export const userSchemas = {
  // Creación de usuario (similar a register pero puede tener campos adicionales)
  create: z.object({
    ...baseUserSchema,
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
    role: z.string().optional(),
    active: z.boolean().optional(),
  }),

  // Actualización de usuario (campos opcionales)
  update: z.object({
    email: email("Debe ser un email válido").optional(),
    username: z
      .string()
      .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
      .optional(),
    first_name: z
      .string()
      .min(3, "El nombre debe tener al menos 3 caracteres")
      .optional(),
    last_name: z
      .string()
      .min(3, "El apellido debe tener al menos 3 caracteres")
      .optional(),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .optional(),
    role: z.string().optional(),
    active: z.boolean().optional(),
  }),

  // Actualización de contraseña
  updatePassword: z
    .object({
      currentPassword: z
        .string()
        .min(8, "La contraseña actual debe tener al menos 8 caracteres"),
      newPassword: z
        .string()
        .min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
      confirmPassword: z
        .string()
        .min(8, "Confirmar contraseña debe tener al menos 8 caracteres"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Las contraseñas no coinciden",
      path: ["confirmPassword"],
    }),
};

// Schemas de permisos
export const permissionSchemas = {
  create: z.object({
    name: z
      .string()
      .min(2, "El nombre del permiso debe tener al menos 2 caracteres"),
    description: z
      .string()
      .min(5, "La descripción debe tener al menos 5 caracteres"),
  }),

  update: z.object({
    name: z
      .string()
      .min(2, "El nombre del permiso debe tener al menos 2 caracteres")
      .optional(),
    description: z
      .string()
      .min(5, "La descripción debe tener al menos 5 caracteres")
      .optional(),
  }),
};

// Schemas de roles (si los usas)
export const roleSchemas = {
  create: z.object({
    name: z
      .string()
      .min(2, "El nombre del rol debe tener al menos 2 caracteres"),
    description: z
      .string()
      .min(5, "La descripción debe tener al menos 5 caracteres"),
    permissions: z.array(z.string()).default([]),
  }),

  update: z.object({
    name: z
      .string()
      .min(2, "El nombre del rol debe tener al menos 2 caracteres")
      .optional(),
    description: z
      .string()
      .min(5, "La descripción debe tener al menos 5 caracteres")
      .optional(),
    permissions: z.array(z.string()).optional(),
  }),
};

// Exportar todos los schemas para facilitar imports
export const allSchemas = {
  auth: authSchemas,
  user: userSchemas,
  permission: permissionSchemas,
  role: roleSchemas,
};
