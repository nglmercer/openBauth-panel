// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { csrf } from "hono/csrf";
import { getCookie } from "hono/cookie";
import { html } from "hono/html";

// Imports de tu lógica
import { authRouter } from "./routers/auth";
import { authSSR } from "./routers/auth_ssr";
import { dashboard as dashboardRouter } from "./routers/dashboard"; // <--- IMPORT NUEVO
import { dbInitializer } from "./db";

const app = new Hono();

// Middlewares Globales
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: "*",
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

  // 1. Rutas Públicas / Auth
  app.route("/auth", authRouter);
  app.route("/auth/ssr", authSSR);

  // 2. Middleware de Protección para el Dashboard
  app.use("/dashboard/*", async (c, next) => {
    const token = getCookie(c, "access_token");
    // Aquí deberías validar el token realmente (verify JWT), no solo ver si existe
    if (!token) {
      return c.redirect("/auth/ssr/login");
    }
    await next();
  });

  // 3. Montar el Dashboard Genérico
  app.route("/dashboard", dashboardRouter);

  // Redirección root
  app.get("/", (c) => c.redirect("/dashboard"));
} catch (error) {
  console.error("Error Fatal inicializando App:", error);
}

export default app;
