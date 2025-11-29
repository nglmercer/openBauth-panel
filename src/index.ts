// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { getCookie } from "hono/cookie";
import { html } from "hono/html";
import { serveStatic } from "hono/bun";

// Imports de tu lógica
import { authRouter } from "./routers/auth";
import { authSSR } from "./routers/auth_ssr";
import { dashboard as dashboardRouter } from "./routers/dashboard"; // <--- IMPORT NUEVO
import { usersRouter } from "./routers/users"; // Import users router
import { genericApiRouter } from "./routers/generic-api"; // Import generic API router
import { dbInitializer, jwtService } from "./db";

const app = new Hono();

// Middlewares Globales
app.use("*", logger());
app.use("*", prettyJSON());

// Update CORS configuration for SvelteKit frontend
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"], // Allow both frontend and backend
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Protección CSRF (Nota: a veces interfiere con APIs JSON puras, úsalo con cuidado)
// app.use('*', csrf());

try {
  await dbInitializer.initialize();
  console.log("DB inicializada correctamente");

  // Serve static files from frontend build directory
  app.use("/frontend/*", serveStatic({ root: "./" }));

  // 1. Rutas Públicas / Auth
  app.route("/auth", authRouter);
  app.route("/auth/ssr", authSSR);

  // 2. Middleware de Protección para el Dashboard
  app.use("/dashboard/*", async (c, next) => {
    // Primero intentamos obtener el token de la cookie
    let token = getCookie(c, "access_token");

    // Si no hay cookie, intentamos obtener el token del header Authorization
    if (!token) {
      const authHeader = c.req.header("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7); // Eliminamos "Bearer " del inicio
      }
    }

    // Validar el token (verificar JWT)
    if (token) {
      try {
        await jwtService.verifyToken(token);
      } catch (error) {
        token = undefined; // Token inválido
      }
    }

    // Si no hay token válido
    if (!token) {
      // For API calls, return 401
      if (c.req.header("authorization")) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      // For browser requests, redirect to login
      return c.redirect("/auth/ssr/login");
    }
    await next();
  });

  // 3. Montar el Dashboard Genérico
  app.route("/dashboard", dashboardRouter);

  // API routes for SvelteKit frontend
  app.route("/api", authRouter);
  app.route("/api/users", usersRouter);
  app.route("/api", genericApiRouter);

  // Roles and permissions routers not yet implemented
  // To be added when needed

  // Redirección root
  app.get("/", (c) => {
    // If accessing the root with browser, serve the frontend app
    const userAgent = c.req.header("user-agent") || "";
    if (
      userAgent.includes("Mozilla") ||
      userAgent.includes("Chrome") ||
      userAgent.includes("Safari")
    ) {
      return c.redirect("/frontend");
    }
    // For API calls, redirect to dashboard API
    return c.redirect("/dashboard");
  });
} catch (error) {
  console.error("Error Fatal inicializando App:", error);
}

export default app;
