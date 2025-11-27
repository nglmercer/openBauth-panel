import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie } from 'hono/cookie';
import { authService } from '../db';
import { LoginPage, RegisterPage, LoginForm, RegisterForm } from '../views/auth';

const authSSR = new Hono();

// Schemas
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    username: z.string().min(3),
    first_name: z.string().min(3),
    last_name: z.string().min(3)
});

// Render Login Page
authSSR.get('/login', (c) => {
    return c.html(<LoginPage />);
});

// Render Register Page
authSSR.get('/register', (c) => {
    return c.html(<RegisterPage />);
});

// Handle Login
authSSR.post('/login', zValidator('form', loginSchema), async (c) => {
    const data = c.req.valid('form');
    try {
        const result = await authService.login(data);

        // Check explicit success flag if available
        if (result.success === false) {
            return c.html(<LoginForm error={result.error?.message || "Credenciales inválidas"} email={data.email} />);
        }

        // Set HttpOnly Cookies
        setCookie(c, 'access_token', result.token!, {
            httpOnly: true,
            secure: true, // Enable in production
            sameSite: 'Strict',
            maxAge: 60 * 15, // 15 minutes
            path: '/',
        });

        setCookie(c, 'refresh_token', result.refreshToken!, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        // HTMX Redirect
        c.header('HX-Redirect', '/dashboard');
        return c.body(null);
    } catch (error: any) {
        return c.html(
            <LoginForm error={error.message || 'Credenciales inválidas'} email={data.email} />
        );
    }
});

// Handle Register
authSSR.post('/register', zValidator('form', registerSchema), async (c) => {
    const data = c.req.valid('form');
    try {
        const result = await authService.register(data);

        if (result.success === false) {
            return c.html(<RegisterForm error={result.error?.message || "Error en el registro"} values={data} />);
        }

        // Set HttpOnly Cookies (Auto-login after register)
        setCookie(c, 'access_token', result.token!, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 60 * 15, // 15 minutes
            path: '/',
        });

        setCookie(c, 'refresh_token', result.refreshToken!, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        c.header('HX-Redirect', '/dashboard');
        return c.body(null);
    } catch (error: any) {
        return c.html(
            <RegisterForm error={error.message || 'Error en el registro'} values={data} />
        );
    }
});

// Logout
authSSR.post('/logout', (c) => {
    deleteCookie(c, 'access_token');
    deleteCookie(c, 'refresh_token');
    c.header('HX-Redirect', '/auth/ssr/login');
    return c.body(null);
});

export { authSSR };
