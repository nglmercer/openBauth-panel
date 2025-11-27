import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, dbInitializer, jwtService, authService, permissionService } from '../db';
import { errorString, notResult } from '../utils/errors';

const authRouter = new Hono();

// Helper for email validation if not imported from zod directly
const email = (message: string) => z.string().email(message);

// Schema register (requiere todo)
const registerSchema = z.object({
    email: email("Debe ser un email válido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
    first_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    last_name: z.string().min(3, "El apellido debe tener al menos 3 caracteres")
});

// Schema login (solo email/password)
const loginSchema = z.object({
    email: email("Debe ser un email válido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres")
});

// Schema refresh
const refreshSchema = z.object({
    refreshToken: z.string()
});

// Register
authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const result = await authService.register(data);
        return c.json(result, 201);
    } catch (error) {
        return c.json(notResult(error), 400);
    }
});

// Login
authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const result = await authService.login(data);
        return c.json(result);
    } catch (error) {
        return c.json(notResult(error), 401);
    }
});

// Refresh (con body)
authRouter.post('/refresh', zValidator('json', refreshSchema), async (c) => {
    try {
        const { refreshToken } = c.req.valid('json');
        const result = await jwtService.verifyRefreshTokenWithSecurity(refreshToken);
        return c.json(result);
    } catch (error) {
        return c.json(notResult(error), 401);
    }
});

// Me (GET con ID)
authRouter.get('/me/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const user = await authService.findUserById(id);
        if (!user) return c.json({ error: errorString('User not found') }, 404);
        return c.json(user);
    } catch (error) {
        return c.json(notResult(error), 500);
    }
});

// Unregister (DELETE con ID)
authRouter.delete('/unregister/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const result = await authService.deleteUser(id);
        return c.json(result);
    } catch (error) {
        return c.json(notResult(error), 404);
    }
});

// Permissions
authRouter.get('/permissions', async (c) => {
    const permissions = await permissionService.getAllPermissions();
    return c.json(permissions);
});

authRouter.get('/permissions/:name', async (c) => {
    try {
        const name = c.req.param('name');
        const permission = await permissionService.findPermissionByName(name);
        return c.json(permission);
    } catch (error) {
        return c.json(notResult(error), 404);
    }
});

export { authRouter };