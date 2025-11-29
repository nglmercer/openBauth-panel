import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authService, permissionService, jwtService } from "../db";
import {
  createAuthMiddlewareForHono,
  createPermissionMiddlewareForHono,
} from "../middleware/index";

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
  async (c: any) => {
    try {
      // El middleware ya verificó los permisos

      // getUsers instead of getAllUsers
      const result = await authService.getUsers();
      const users = result.users;
      return c.json({ users });
    } catch (error) {
      console.error("Error fetching users:", error);
      return c.json({ error: "Failed to fetch users" }, 500);
    }
  },
);

// Obtener un usuario por ID
usersRouter.get(
  "/:id",
  createAuthMiddlewareForHono({
    jwtService,
    authService,
    permissionService,
  }),
  async (c: any) => {
    try {
      const userId = c.get("auth")?.user?.id as string | null;
      const targetId = c.req.param("id");

      // Los usuarios pueden ver su propio perfil sin permisos especiales
      if (userId !== targetId) {
        // Verificar permisos con el middleware
        const authContext = c.get("auth");
        const hasPermission =
          authContext?.permissions?.includes("users:view") || false;
        if (!hasPermission) {
          return c.json({ error: "Insufficient permissions" }, 403);
        }
      }

      // findUserById instead of getUserById
      const user = await authService.findUserById(targetId);
      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      // No incluir contraseña en la respuesta
      const { password, ...userWithoutPassword } = user as any;
      return c.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Error fetching user:", error);
      return c.json({ error: "Failed to fetch user" }, 500);
    }
  },
);

// Crear un nuevo usuario (solo admin)
usersRouter.post(
  "/",
  createPermissionMiddlewareForHono(["users:create"]),
  zValidator("json", createUserSchema),
  async (c: any) => {
    try {
      // El middleware ya verificó los permisos

      const userData = c.req.valid("json") as z.infer<typeof createUserSchema>;
      const newUser = await authService.register(userData);

      return c.json({ user: newUser }, 201);
    } catch (error: any) {
      console.error("Error creating user:", error);
      return c.json({ error: error.message || "Failed to create user" }, 500);
    }
  },
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
  async (c: any) => {
    try {
      const userId = c.get("auth")?.user?.id as string | null;
      const targetId = c.req.param("id");

      // Los usuarios pueden actualizar su propio perfil sin permisos especiales
      if (userId !== targetId) {
        // Verificar permisos con el middleware
        const authContext = c.get("auth");
        const hasPermission =
          authContext?.permissions?.includes("users:update") || false;
        if (!hasPermission) {
          return c.json({ error: "Insufficient permissions" }, 403);
        }
      }

      const updateData = c.req.valid("json") as z.infer<
        typeof updateUserSchema
      >;
      const result = await authService.updateUser(targetId, updateData);
      const updatedUser = result.user;

      if (!updatedUser) {
        return c.json({ error: "User not found" }, 404);
      }

      // No incluir contraseña en la respuesta
      const { password, ...userWithoutPassword } = updatedUser as any;
      return c.json({ user: userWithoutPassword });
    } catch (error: any) {
      console.error("Error updating user:", error);
      return c.json({ error: "Failed to update user" }, 500);
    }
  },
);

// Eliminar un usuario (solo admin)
usersRouter.delete(
  "/:id",
  createPermissionMiddlewareForHono(["users:delete"]),
  async (c: any) => {
    try {
      const userId = c.get("auth")?.user?.id as string | null;
      const targetId = c.req.param("id");

      // Evitar que un usuario se elimine a sí mismo
      if (userId === targetId) {
        return c.json({ error: "Cannot delete your own account" }, 400);
      }

      const result = await authService.deleteUser(targetId);
      const success = result.success;
      if (!success) {
        return c.json({ error: "User not found" }, 404);
      }

      return c.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      return c.json({ error: "Failed to delete user" }, 500);
    }
  },
);

export { usersRouter };
