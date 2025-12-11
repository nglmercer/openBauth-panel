import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { serveStatic } from "hono/bun";
import { getServiceFactory } from "./services/service-factory";
import { defaultLogger } from "./utils/logger";
import { errorHandler } from "./utils/error-handler";
import { auth } from "./routes/auth";
import { user } from "./routes/user";
import { oauth } from "./routes/oauth";
import { genericData } from "./routes/generic";
import { adminRoutes } from "./routes/admin";
import { uploadRoutes } from "./routes/upload";
import { dbInitializer } from "./db";

// Initialize the main application
const app = new Hono().basePath("/api/v1");

// Global middleware
app.use("*", logger());
app.use("*", prettyJSON());
//process.env['FRONTEND_URL'] || "http://localhost:3000"
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true
}));

// Error handling middleware
app.onError(errorHandler);

// Initialize database and services
let services: ReturnType<ReturnType<typeof getServiceFactory>["getServices"]>;

async function initializeApp() {
  try {
    // Initialize database schema
    await dbInitializer.initialize();
    await dbInitializer.seedDefaults();

    // Ensure custom fields exist in users table
    const db = dbInitializer.db;
    const customFields = ['bio', 'timezone', 'language', 'avatar_url', 'phone_number'];
    for (const field of customFields) {
      try {
        db.run(`ALTER TABLE users ADD COLUMN ${field} TEXT`);
      } catch (e) {
        // Column likely already exists
      }
    }

    // Initialize services
    const factory = getServiceFactory();
    services = factory.getServices();

    // Log successful initialization
    defaultLogger.info("Application initialized successfully", {
      database: process.env['DATABASE_URL'] || "auth.db",
      jwtSecret: services?.jwtService ? "configured" : "missing"
    });

  } catch (error) {
    defaultLogger.error("Failed to initialize application", error as Error);
    throw error;
  }
}

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] || "1.0.0",
    services: {
      database: "connected",
      email: services?.notificationService ? "configured" : "not configured"
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

// Mount route groups
app.route("/auth", auth);
app.route("/user", user);
app.route("/oauth", oauth);
app.route("/data", genericData);
app.route("/admin", adminRoutes);
app.route("/upload", uploadRoutes);

// Static file serving (for uploaded files)
if (process.env['UPLOAD_DIR']) {
  app.use("/uploads/*", serveStatic({
    root: process.env['UPLOAD_DIR'],
    rewriteRequestPath: (path) => path.replace(/^\/uploads/, "")
  }));
}

// Catch-all route for 404s
app.all("*", (c) => {
  return c.json({
    error: "Not found",
    message: `Route ${c.req.path} not found`,
    timestamp: new Date().toISOString()
  }, 404);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  defaultLogger.info("Shutting down application...");

  if (dbInitializer) {
    // DatabaseInitializer doesn't have a close method, but we can close the underlying database
    if (dbInitializer) {
      dbInitializer.db.close();
    }
  }

  process.exit(0);
});

process.on("SIGTERM", async () => {
  defaultLogger.info("Shutting down application...");

  if (dbInitializer) {
    // DatabaseInitializer doesn't have a close method, but we can close the underlying database
    if (dbInitializer) {
      dbInitializer.db.close();
    }
  }

  process.exit(0);
});

// Export for testing and server startup
export { app, initializeApp, services };

// Start server if this file is run directly
// Start server if this file is run directly
if (import.meta.main) {
  const port = parseInt(process.env['PORT'] || "3000");

  initializeApp()
    .then(() => {
      // defaultLogger.info(`Starting server on port ${port}`);

      Bun.serve({
        port,
        fetch: app.fetch
      });
      defaultLogger.info(`server running on http://localhost:${port}/api/v1`);
    })
    .catch((error) => {
      defaultLogger.error("Failed to start server", error);
      process.exit(1);
    });
}


