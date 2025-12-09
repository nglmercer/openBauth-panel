import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { getCookie } from "hono/cookie";
import { serveStatic } from "hono/bun";

// Import services and middleware
import { getServiceFactory } from "../services/service-factory";
import { createRateLimitMiddleware } from "../services/rate-limit";
import { defaultLogger } from "../utils/logger";

// Import route modules
import { authRoutes } from "./auth";
import { userRoutes } from "./user";
import { oauthRoutes } from "./oauth";
import { adminRoutes } from "./admin";
import { genericRoutes } from "./generic";
import { uploadRoutes } from "./upload";

// Initialize services
const factory = getServiceFactory();
const services = factory.getServices();

// Create main app
const app = new Hono().basePath("/api/v1");

// Global middlewares
app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", cors({
  origin: [
    process.env['FRONTEND_URL'] || "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
}));

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware(services.rateLimitService, {
  keyGenerator: (c) => {
    // Use IP address and user ID if authenticated
    const auth = c.get('auth');
    const userId = auth?.user?.id || 'anonymous';
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    return `${userId}:${ip}`;
  }
});

// Apply rate limiting to all routes
app.use("*", rateLimitMiddleware);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env["npm_package_version"] || "1.0.0",
    services: {
      database: "connected",
      email: services.notificationService ? "configured" : "not configured"
    }
  });
});

// API documentation endpoint
app.get("/docs", (c) => {
  return c.json({
    name: "OpenBauth API",
    version: "1.0.0",
    description: "Complete authentication and authorization API",
    endpoints: {
      auth: {
        signup: "POST /api/v1/auth/signup",
        login: "POST /api/v1/auth/login",
        anonymous: "POST /api/v1/auth/anonymous",
        refresh: "POST /api/v1/auth/refresh",
        logout: "POST /api/v1/auth/logout",
        forgotPassword: "POST /api/v1/auth/forgot-password",
        resetPassword: "POST /api/v1/auth/reset-password",
        verifyEmail: "POST /api/v1/auth/verify-email"
      },
      user: {
        me: "GET /api/v1/user/me",
        update: "PATCH /api/v1/user/me",
        mfaSetup: "POST /api/v1/user/mfa/setup",
        mfaVerify: "POST /api/v1/user/mfa/verify",
        devices: "GET /api/v1/user/devices",
        registerDevice: "POST /api/v1/user/devices",
        biometric: "POST /api/v1/user/biometric"
      },
      oauth: {
        authorize: "GET /api/v1/oauth/authorize",
        token: "POST /api/v1/oauth/token",
        revoke: "POST /api/v1/oauth/revoke",
        introspect: "POST /api/v1/oauth/introspect",
        jwks: "GET /api/v1/oauth/jwks",
        userinfo: "GET /api/v1/oauth/userinfo"
      },
      admin: {
        users: "GET /api/v1/admin/users",
        roles: "GET /api/v1/admin/roles",
        permissions: "GET /api/v1/admin/permissions"
      },
      generic: {
        crud: "GET/POST/PUT/DELETE /api/v1/data/:tableName",
        schema: "GET /api/v1/data/:tableName/schema"
      },
      upload: {
        upload: "POST /api/v1/upload"
      }
    }
  });
});

// Mount route modules
app.route("/auth", authRoutes);
app.route("/user", userRoutes);
app.route("/oauth", oauthRoutes);
app.route("/admin", adminRoutes);
app.route("/data", genericRoutes);
app.route("/upload", uploadRoutes);

// Error handling middleware
app.onError((err, c) => {
  defaultLogger.error("Unhandled error", err);

  return c.json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
    timestamp: new Date().toISOString()
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: "Not found",
    message: `Route ${c.req.path} not found`,
    timestamp: new Date().toISOString()
  }, 404);
});

// Serve static files
app.use("/uploads/*", serveStatic({ root: "./" }));
app.use("/frontend/*", serveStatic({ root: "./" }));

// Dashboard protection
app.use("/dashboard/*", async (c, next) => {
  const token = getCookie(c, "access_token");

  if (!token) {
    // For API calls, return 401
    if (c.req.header("authorization")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    // For browser requests, redirect to login
    return c.redirect("/auth/ssr/login");
  }

  // Verify token
  try {
    const payload = await services.jwtService.verifyToken(token);
    if (!payload) {
      return c.json({ error: "Invalid token" }, 401);
    }

    (c as any).set('user', payload);
    await next();
    return;
  } catch (error) {
    return c.json({ error: "Token verification failed" }, 401);
  }
});

export default app;