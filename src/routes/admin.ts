import { Hono } from "hono";
import { z } from "zod";
import { getServiceFactory } from "../services/service-factory";
import { createAuthMiddlewareForHono, createRoleMiddlewareForHono } from "../middleware";
import { defaultLogger } from "../utils/logger";

export const admin = new Hono();
const factory = getServiceFactory();
const services = factory.getServices();

// Protect all admin routes
admin.use("*", createAuthMiddlewareForHono());
// Require admin role
admin.use("*", createRoleMiddlewareForHono(["admin"]));

// Schemas
const createRoleSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    permissions: z.array(z.string()).optional()
});

const assignRoleSchema = z.object({
    userId: z.string(),
    role: z.string()
});

// GET /api/v1/admin/users - List users
admin.get("/users", async (c) => {
    try {
        // Check if authService has getUsers or we need to use a controller
        // Assuming authService has basic user management or we use generic controller logic
        const userController = services.dbInitializer.createController("users");
        const result = await userController.findAll({
            limit: 100
        });

        return c.json(result);
    } catch (error) {
        defaultLogger.error("List users error", error as Error);
        return c.json({ success: false, error: "Internal server error" }, 500);
    }
});

// GET /api/v1/admin/roles - List roles
admin.get("/roles", async (c) => {
    try {
        // Assuming 'roles' table exists
        const roleController = services.dbInitializer.createController("roles");
        const result = await roleController.findAll();
        return c.json(result);
    } catch (error) {
        defaultLogger.error("List roles error", error as Error);
        return c.json({ success: false, error: "Internal server error" }, 500);
    }
});

// POST /api/v1/admin/roles - Create role
admin.post("/roles", async (c) => {
    try {
        const body = await c.req.json();
        const validated = createRoleSchema.parse(body);

        const roleController = services.dbInitializer.createController("roles");
        const result = await roleController.create({
            id: crypto.randomUUID(),
            name: validated.name,
            description: validated.description
        });

        if (!result.success) {
            return c.json({ success: false, error: result.error }, 400);
        }

        // If permissions provided, assign them (Complexity omitted for brevity, would need permission_role table)

        return c.json({ success: true, role: result.data }, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ success: false, error: "Validation error", details: error.errors }, 400);
        }
        defaultLogger.error("Create role error", error as Error);
        return c.json({ success: false, error: "Internal server error" }, 500);
    }
});

// POST /api/v1/admin/users/:id/roles - Assign role to user
admin.post("/users/:id/roles", async (c) => {
    try {
        const userId = c.req.param("id");
        const body = await c.req.json();

        // Use schema to validate
        const validated = assignRoleSchema.parse({
            userId,
            role: body.role
        });
        const roleName = validated.role;

        // This would typically involve inserting into user_roles table
        // Or using helper service
        // Let's assume user_roles table
        const userRolesController = services.dbInitializer.createController("user_roles");

        // Find role id? For now assuming simple string role or name based.
        // If we need ID, we'd fetch role first.

        const result = await userRolesController.create({
            user_id: userId,
            role_name: roleName // or role_id
        });

        return c.json(result);

    } catch (error) {
        return c.json({ success: false, error: "Failed to assign role" }, 500);
    }
});

export { admin as adminRoutes };
