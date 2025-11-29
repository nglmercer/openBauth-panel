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
import { authMiddleware, requireAuth } from "./middleware/auth";

const app = new Hono();

// Middlewares Globales
app.use("*", logger());
app.use("*", prettyJSON());

// Middleware global de autenticación - se aplica a todas las rutas
// Usamos el middleware mejorado con autenticación opcional por defecto
app.use("*", authMiddleware({ required: false }));

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

  // 3. Montar el Dashboard Genérico con protección de autenticación
  app.use("/dashboard/*", requireAuth());
  app.route("/dashboard", dashboardRouter);

  // API routes for SvelteKit frontend
  app.use("/api/me", requireAuth());
  app.route("/api", authRouter);
  app.use("/api/users/*", requireAuth());
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
