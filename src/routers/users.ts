import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authService, permissionService, jwtService } from "../db";
import {
  createAuthMiddlewareForHono,
  createPermissionMiddlewareForHono,
} from "../middleware/index";
import type {
  AuthenticatedContext,
  AppHandler,
  UserWithoutPassword,
  ApiResponse,
  CrudResult,
  AppError,
  CustomError,
} from "../types";
import { asyncHandler, ErrorResponse } from "../utils/error-handler";

const usersRouter = new Hono();

// Middleware de autenticación para todas las rutas
usersRouter.use(
  "*",
  createAuthMiddlewareForHono({
    jwtService,
    authService,
    permissionService,
  }),
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
  createPermissionMiddlewareForHono(["users:list"]),
  asyncHandler(async (c: AuthenticatedContext): Promise<Response> => {
    // El middleware ya verificó los permisos

    // getUsers instead of getAllUsers
    const result = await authService.getUsers();
    const users = result.users;
    return c.json({ success: true, data: { users } } as ApiResponse<{
      users: UserWithoutPassword[];
    }>);
  }),
);

// Obtener un usuario por ID
usersRouter.get(
  "/:id",
  createAuthMiddlewareForHono({
    jwtService,
    authService,
    permissionService,
  }),
  asyncHandler(async (c: AuthenticatedContext): Promise<Response> => {
    const userId = c.get("auth")?.user?.id as string | null;
    const targetId = c.req.param("id");

    // Los usuarios pueden ver su propio perfil sin permisos especiales
    if (userId !== targetId) {
      // Verificar permisos con el middleware
      const authContext = c.get("auth");
      const hasPermission =
        authContext?.permissions?.includes("users:view") || false;
      if (!hasPermission) {
        return c.json(
          ErrorResponse.authorization("Insufficient permissions"),
          403,
        );
      }
    }

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
    } as ApiResponse<{
      user: UserWithoutPassword;
    }>);
  }),
);

// Crear un nuevo usuario (solo admin)
usersRouter.post(
  "/",
  createPermissionMiddlewareForHono(["users:create"]),
  zValidator("json", createUserSchema),
  asyncHandler(async (c: AuthenticatedContext): Promise<Response> => {
    // El middleware ya verificó los permisos

    const userData = c.req.valid() as z.infer<typeof createUserSchema>;
    const newUser = await authService.register(userData);

    return c.json(
      { success: true, data: { user: newUser } },
      201,
    ) as ApiResponse<{
      user: UserWithoutPassword;
    }>;
  }),
);

// Actualizar un usuario
usersRouter.put(
  "/:id",
  createAuthMiddlewareForHono({
    jwtService,
    authService,
    permissionService,
  }),
  zValidator("json", updateUserSchema),
  asyncHandler(async (c: AuthenticatedContext): Promise<Response> => {
    const userId = c.get("auth")?.user?.id as string | null;
    const targetId = c.req.param("id");

    // Los usuarios pueden actualizar su propio perfil sin permisos especiales
    if (userId !== targetId) {
      // Verificar permisos con el middleware
      const authContext = c.get("auth");
      const hasPermission =
        authContext?.permissions?.includes("users:update") || false;
      if (!hasPermission) {
        return c.json(
          ErrorResponse.authorization("Insufficient permissions"),
          403,
        );
      }
    }

    const updateData = c.req.valid() as z.infer<typeof updateUserSchema>;
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
    } as ApiResponse<{
      user: UserWithoutPassword;
    }>);
  }),
);

// Eliminar un usuario (solo admin)
usersRouter.delete(
  "/:id",
  createPermissionMiddlewareForHono(["users:delete"]),
  asyncHandler(async (c: AuthenticatedContext): Promise<Response> => {
    const userId = c.get("auth")?.user?.id as string | null;
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
    } as ApiResponse<{
      message: string;
    }>);
  }),
);

export { usersRouter };
