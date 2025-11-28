import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { csrf } from 'hono/csrf';
import { getCookie } from 'hono/cookie';
import { html } from 'hono/html';
import { authRouter } from './routers/auth';
import { authSSR } from './routers/auth_ssr';
import { dbInitializer, authService } from './db';
import { getSchemas,getDefaultSchemas } from "./database/base-controller";
const app = new Hono();

app.use("*", logger());
app.use("*", prettyJSON());
app.use(
    "*",
    cors({
        origin: "*", // Add your frontend URL
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }),
);
app.use('*', csrf()); // Protect against CSRF

try {
    await dbInitializer.initialize();
    const schemas = getDefaultSchemas();
    const userSchema = schemas.find((t)=>t.tableName === 'users');
    console.log("userSchema",userSchema)
//    const allusers = await authService.getUsers(); console.log("allusers", allusers);
    console.log('DB inicializada correctamente');

    // API Routes
    app.route('/auth', authRouter);

    // SSR Routes
    app.route('/auth/ssr', authSSR);

    // Protected Dashboard Example
    app.get('/dashboard', (c) => {
        const token = getCookie(c, 'access_token');
        if (!token) return c.redirect('/auth/ssr/login');

        return c.html(html`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Dashboard</title>
                <script src="https://unpkg.com/htmx.org@1.9.10"></script>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-gray-900 text-white p-10">
                <h1 class="text-3xl font-bold mb-4">Bienvenido al Dashboard</h1>
                <p class="mb-4">Has iniciado sesión correctamente.</p>
                <button 
                    hx-post="/auth/ssr/logout" 
                    class="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
                >
                    Cerrar Sesión
                </button>
            </body>
            </html>
        `);
    });

} catch (error) {
    console.error('Error inicializando DB:', error);
}

export default app;
