import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authService, permissionService } from "../db";
import {
  authMiddleware,
  requirePermissions,
  requireSelfOrAdmin,
} from "../middleware/auth";
import type {
  AuthenticatedContext,
  UserWithoutPassword,
  ApiResponse,
} from "../types";
import { AppErrorType } from "../types/errors";
import { asyncHandler, ErrorResponse } from "../utils/error-handler";

const usersRouter = new Hono();

// Middleware de autenticación para todas las rutas
usersRouter.use(
  "*",
  // Use the unified auth middleware
  authMiddleware({ required: true }),
);

// Schema para validación de usuarios
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  username: z.string().min(3).optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

// Obtener todos los usuarios (solo admin)
usersRouter.get(
  "/",
  requirePermissions(["users:list"]),
  asyncHandler(async (c: any): Promise<Response> => {
    // El middleware ya verificó los permisos

    // getUsers instead of getAllUsers
    const result = await authService.getUsers();
    const users = result.users;
    return c.json({ success: true, data: { users } });
  }),
);

// Obtener un usuario por ID
usersRouter.get(
  "/:id",
  // Use the unified auth middleware and requireSelfOrAdmin middleware
  authMiddleware({ required: true }),
  requireSelfOrAdmin("id"),
  asyncHandler(async (c: any): Promise<Response> => {
    const targetId = c.req.param("id");
    // findUserById instead of getUserById
    const user = await authService.findUserById(targetId);
    if (!user) {
      return c.json(ErrorResponse.notFound("User not found"), 404);
    }

    // No incluir contraseña en la respuesta
    if ("password" in user) {
      delete user.password;
    }
    const { ...userWithoutPassword } = user as UserWithoutPassword;
    return c.json({
      success: true,
      data: { user: userWithoutPassword },
    });
  }),
);

// Crear un nuevo usuario (solo admin)
usersRouter.post(
  "/",
  requirePermissions(["users:create"]),
  zValidator("json", createUserSchema),
  asyncHandler(async (c: any) => {
    // El middleware ya verificó los permisos
    try {
      const userData = c.req.valid("json") as z.infer<typeof createUserSchema>;
      const newUser = await authService.register(userData);

      return c.json({ success: true, data: { user: newUser } }, 201);
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to create user",
            type: AppErrorType.VALIDATION_ERROR,
          },
        },
        400,
      );
    }
  }),
);

// Actualizar un usuario
usersRouter.put(
  "/:id",
  // Use the unified auth middleware and requireSelfOrAdmin middleware
  authMiddleware({ required: true }),
  requireSelfOrAdmin("id"),
  zValidator("json", updateUserSchema),
  asyncHandler(async (c) => {
    try {
      const targetId = c.req.param("id");
      const updateData = c.req.valid("json") as z.infer<
        typeof updateUserSchema
      >;
      const result = await authService.updateUser(targetId, updateData);
      const updatedUser = result.user;

      if (!updatedUser) {
        return c.json(ErrorResponse.notFound("User not found"), 404);
      }

      // No incluir contraseña en la respuesta
      if ("password" in updatedUser) {
        delete updatedUser.password;
      }
      const { ...userWithoutPassword } = updatedUser as UserWithoutPassword;
      return c.json({
        success: true,
        data: { user: userWithoutPassword },
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to update user",
            type: AppErrorType.VALIDATION_ERROR,
          },
        },
        400,
      );
    }
  }),
);

// Eliminar un usuario (solo admin)
usersRouter.delete(
  "/:id",
  // Use requirePermissions middleware and add self-deletion protection
  requirePermissions(["users:delete"]),
  asyncHandler(async (c: any): Promise<Response> => {
    console.log("DEBUG: usersRouter.delete reached");
    const authContext = c.get("auth") as any;
    const userId = authContext?.user?.id as string | null;
    const targetId = c.req.param("id");

    // Evitar que un usuario se elimine a sí mismo
    if (userId === targetId) {
      return c.json(
        ErrorResponse.badRequest("Cannot delete your own account"),
        400,
      );
    }

    const result = await authService.deleteUser(targetId);
    const success = result.success;
    if (!success) {
      return c.json(ErrorResponse.notFound("User not found"), 404);
    }

    return c.json({
      success: true,
      data: { message: "User deleted successfully" },
    });
  }),
);

export { usersRouter };
