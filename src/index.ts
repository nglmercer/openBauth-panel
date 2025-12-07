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
import { restApiRouter } from "./routers/rest-api"; // Import REST API router (renamed from generic-api)
import { dbInitializer, jwtService } from "./db";
import { authMiddleware, requireAuth } from "./middleware/auth";

const app = new Hono();

// Middlewares Globales
app.use("*", logger());
app.use("*", prettyJSON());

// Remove global auth middleware - it was causing issues with auth endpoints
// Auth middleware will be applied selectively to specific routes that need it

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

  // 1. Rutas Públicas / Auth (Supabase compatible)
  app.route("/auth/v1", authRouter);
  app.route("/auth/ssr", authSSR);

  // 2. API CRUD (Supabase compatible)
  app.route("/rest/v1", restApiRouter);

  // 3. Eliminar rutas legacy
  // app.route("/auth", authRouter); // Legacy - eliminado
  // app.route("/api", authRouter); // Legacy - eliminado
  // app.route("/api/users", usersRouter); // Legacy - eliminado
  // app.route("/api", genericApiRouter); // Legacy - eliminado
  // app.route("/dashboard", dashboardRouter); // Legacy - eliminado

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
