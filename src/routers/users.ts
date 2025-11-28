import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authService, permissionService } from "../db";
import { authMiddleware } from "../middleware/auth";

const usersRouter = new Hono();

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

// Middleware de autenticación para todas las rutas
usersRouter.use("*", authMiddleware);

// Obtener todos los usuarios (solo admin)
usersRouter.get("/", async (c) => {
  try {
    // Verificar si el usuario actual tiene permisos de admin
    const userId = c.get("userId");
    const hasPermission = await permissionService.checkPermission(userId, "users:list");

    if (!hasPermission) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    const users = await authService.getAllUsers();
    return c.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

// Obtener un usuario por ID
usersRouter.get("/:id", async (c) => {
  try {
    const userId = c.get("userId");
    const targetId = c.req.param("id");

    // Los usuarios pueden ver su propio perfil o necesitan permiso de admin
    if (userId !== targetId) {
      const hasPermission = await permissionService.checkPermission(userId, "users:view");
      if (!hasPermission) {
        return c.json({ error: "Insufficient permissions" }, 403);
      }
    }

    const user = await authService.getUserById(targetId);
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
});

// Crear un nuevo usuario (solo admin)
usersRouter.post("/", zValidator("json", createUserSchema), async (c) => {
  try {
    const userId = c.get("userId");
    const hasPermission = await permissionService.checkPermission(userId, "users:create");

    if (!hasPermission) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    const userData = c.req.valid("json");
    const newUser = await authService.register(userData);

    return c.json({ user: newUser }, 201);
  } catch (error: any) {
    console.error("Error creating user:", error);
    return c.json({ error: error.message || "Failed to create user" }, 500);
  }
});

// Actualizar un usuario
usersRouter.put("/:id", zValidator("json", updateUserSchema), async (c) => {
  try {
    const userId = c.get("userId");
    const targetId = c.req.param("id");

    // Los usuarios pueden actualizar su propio perfil o necesitan permiso de admin
    if (userId !== targetId) {
      const hasPermission = await permissionService.checkPermission(userId, "users:update");
      if (!hasPermission) {
        return c.json({ error: "Insufficient permissions" }, 403);
      }
    }

    const updateData = c.req.valid("json");
    const updatedUser = await authService.updateUser(targetId, updateData);

    if (!updatedUser) {
      return c.json({ error: "User not found" }, 404);
    }

    // No incluir contraseña en la respuesta
    const { password, ...userWithoutPassword } = updatedUser as any;
    return c.json({ user: userWithoutPassword });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return c.json({ error: error.message || "Failed to update user" }, 500);
  }
});

// Eliminar un usuario (solo admin)
usersRouter.delete("/:id", async (c) => {
  try {
    const userId = c.get("userId");
    const targetId = c.req.param("id");

    const hasPermission = await permissionService.checkPermission(userId, "users:delete");

    if (!hasPermission) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    // Evitar que un usuario se elimine a sí mismo
    if (userId === targetId) {
      return c.json({ error: "Cannot delete your own account" }, 400);
    }

    const success = await authService.deleteUser(targetId);
    if (!success) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

export { usersRouter };
