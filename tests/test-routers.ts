// tests/test-routers.ts
// Test-specific router factories that accept database instances

import { Hono } from "hono";
import { z, email } from "zod";
import { zValidator } from "@hono/zod-validator";
import { setCookie } from "hono/cookie";
import { JWTService, AuthService, PermissionService } from "open-bauth";
import { DatabaseInitializer } from "open-bauth";
import { errorString, notResult } from "../src/utils/errors";
import {
  getDefaultSchemas,
  getTableRelations,
  getRelatedData,
  ExtendedBaseController
} from "../src/database/base-controller";
import { ZodSchemaGenerator } from "../src/validator/schema-generator";

// Helper function to set auth cookies
async function setAuthCookies(c: any, result: any) {
  if (result.token && result.refreshToken) {
    const isSecure =
      c.req.header("x-forwarded-proto") === "https" ||
      c.req.url.startsWith("https://");

    setCookie(c, "access_token", result.token, {
      maxAge: 15 * 60, // 15 minutes
      httpOnly: true,
      secure: isSecure,
      sameSite: "Strict",
      path: "/",
    });

    setCookie(c, "refresh_token", result.refreshToken, {
      maxAge: 7 * 24 * 60 * 60, // 7 days
      httpOnly: true,
      secure: isSecure,
      sameSite: "Strict",
      path: "/",
    });
  }
}

// Schema register (requiere todo)
const registerSchema = z.object({
  email: email("Debe ser un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  first_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  last_name: z.string().min(3, "El apellido debe tener al menos 3 caracteres"),
});

// Schema login (solo email/password)
const loginSchema = z.object({
  email: email("Debe ser un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export function createTestAuthRouter(
  testDb: any,
  dbInitializer: DatabaseInitializer,
  jwtService: JWTService,
  authService: AuthService,
  permissionService: PermissionService
) {
  const authRouter = new Hono();

  // Signup - Supabase compatible endpoint
  authRouter.post("/signup", zValidator("json", registerSchema), async (c) => {
    try {
      const data = c.req.valid("json");
      
      // First check if user already exists
      const existingUser = await authService.findUserByEmail(data.email);
      if (existingUser) {
        return c.json({ error: "User already exists" }, 400);
      }

      // Create user using authService
      const result = await authService.register(data);
      
      if (!result.success) {
        return c.json({ error: result.error || "Registration failed" }, 400);
      }

      // Get the created user
      const user = await authService.findUserByEmail(data.email);
      if (!user) {
        return c.json({ error: "User not found after registration" }, 404);
      }

      // Generate tokens manually using the user object
      // Ensure user has the correct structure for jwtService
      const userForToken = {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active
      };
      
      const accessToken = await jwtService.generateToken(userForToken as any);
      const refreshToken = await jwtService.generateRefreshToken(user.id);

      // Set HTTP-only cookies for tokens
      await setAuthCookies(c, { token: accessToken, refreshToken });

      return c.json({
        success: true,
        user: user,
        access_token: accessToken,
        refresh_token: refreshToken
      }, 201);
    } catch (error) {
      console.error("Signup error:", error);
      return c.json(notResult(error), 400);
    }
  });

  // Token - Supabase compatible endpoint (handles both password and refresh_token grants)
  authRouter.post("/token", async (c) => {
    try {
      const body = await c.req.json();
      const grantType = body.grant_type;

      if (grantType === "password") {
        // Password login
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
          return c.json({ error: "Invalid login data" }, 400);
        }
        
        const data = validation.data;
        
        // Verify credentials using authService
        const loginResult = await authService.login(data);
        if (!loginResult.success) {
          return c.json({ error: loginResult.error || "Invalid credentials" }, 401);
        }

        // Get the user
        const user = await authService.findUserByEmail(data.email);
        if (!user) {
          return c.json({ error: "User not found" }, 404);
        }

        // Generate tokens manually to ensure they're in the correct format
        const accessToken = await jwtService.generateToken(user as any);
        const refreshToken = await jwtService.generateRefreshToken(user.id);

        // Set HTTP-only cookies for tokens
        await setAuthCookies(c, { token: accessToken, refreshToken });

        return c.json({
          success: true,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: "bearer",
          expires_in: 900, // 15 minutes
          user: user
        });
      } else if (grantType === "refresh_token") {
        // Refresh token
        const { refresh_token } = body;
        
        // Verify the refresh token
        let payload;
        try {
          payload = await jwtService.verifyRefreshTokenWithSecurity(refresh_token);
        } catch (error) {
          console.error("Refresh token verification failed:", error);
          return c.json({ error: "Invalid refresh token" }, 401);
        }

        // Fetch user details
        const user = await authService.findUserById(payload.userId);
        if (!user) {
          return c.json({ error: "User not found" }, 404);
        }

        // Generate new tokens
        const accessToken = await jwtService.generateToken(user as any);
        const newRefreshToken = await jwtService.generateRefreshToken(user.id);

        // Set HTTP-only cookies for tokens
        await setAuthCookies(c, { token: accessToken, refreshToken: newRefreshToken });

        return c.json({
          success: true,
          access_token: accessToken,
          refresh_token: newRefreshToken,
          token_type: "bearer",
          expires_in: 900,
          user: user
        });
      } else {
        return c.json({ error: "Unsupported grant type" }, 400);
      }
    } catch (error) {
      console.error("Token endpoint error:", error);
      return c.json(notResult(error), 401);
    }
  });

  // Logout
  authRouter.post("/logout", async (c) => {
    try {
      // Here you would invalidate the refresh token
      // For now, just return success
      return c.json({ success: true });
    } catch (error) {
      return c.json(notResult(error), 500);
    }
  });

  return authRouter;
}

export function createTestRestApiRouter(testDb: any, dbInitializer: DatabaseInitializer, authService: AuthService) {
  const restApiRouter = new Hono();

  // Get all available tables
  restApiRouter.get("/tables", async (c) => {
    try {
      const schemas = getDefaultSchemas();
      const tables = schemas.map((s) => ({
        name: s.tableName,
        columns: s.columns.length,
      }));
      return c.json({ tables });
    } catch (error) {
      console.error("Error fetching tables:", error);
      return c.json({ error: "Failed to fetch tables" }, 500);
    }
  });

  // Get schema information for all tables
  restApiRouter.get("/schemas", async (c) => {
    try {
      const schemas = await getSchemas(testDb);
      const relations = await getTableRelations(testDb);
      return c.json({ schemas, relations });
    } catch (error) {
      console.error("Error fetching schemas:", error);
      return c.json({ error: "Failed to fetch schemas" }, 500);
    }
  });

  // Get schema for a specific table
  restApiRouter.get("/schema/:tableName", async (c) => {
    try {
      const tableName = c.req.param("tableName");
      const schemas = getDefaultSchemas();
      const schema = schemas.find((s) => s.tableName === tableName);
      const relations = await getTableRelations(testDb);
      const tableRelations = relations[tableName] || [];

      if (!schema) {
        return c.json({ error: "Table not found" }, 404);
      }

      return c.json({ schema, relations: tableRelations });
    } catch (error) {
      console.error("Error fetching table schema:", error);
      return c.json({ error: "Failed to fetch table schema" }, 500);
    }
  });

  // Get related data for a specific record
  restApiRouter.get("/:tableName/:id/related/:relation", async (c) => {
    try {
      const tableName = c.req.param("tableName");
      const id = c.req.param("id");
      const relation = c.req.param("relation");

      // First, get the record to find the foreign key value
      const controller = new ExtendedBaseController(tableName, {
        database: testDb,
        isSQLite: true,
      });

      const recordResult = await controller.findById(id);

      if (!recordResult.success || !recordResult.data) {
        return c.json({ error: "Record not found" }, 404);
      }

      const foreignKey = recordResult.data[relation];

      if (foreignKey === undefined) {
        return c.json({ error: "Relation field not found" }, 400);
      }

      // Get the related data
      const relatedData = await getRelatedData(tableName, relation, foreignKey, testDb);

      if (!relatedData.success) {
        return c.json({ error: relatedData.error }, 500);
      }

      return c.json(relatedData);
    } catch (error) {
      console.error(`Error fetching related data:`, error);
      return c.json({ error: "Failed to fetch related data" }, 500);
    }
  });

  // Dynamic routes for each table
  const schemas = getDefaultSchemas();
  for (const schema of schemas) {
    const tableName = schema.tableName;
    const validators = ZodSchemaGenerator.generate(schema);

    // Create a new sub-router for each table
    const tableRouter = new Hono();
    
    // Store services in context for access in handlers
    tableRouter.use("*", async (c, next) => {
      (c as any).authService = authService;
      (c as any).testDb = testDb;
      await next();
    });

    // Get all records
    tableRouter.get("/", async (c) => {
      try {
        const includeRelations = c.req.query("includeRelations") === "true";

        // Use ExtendedBaseController with query string completa
        const controller = new ExtendedBaseController(tableName, {
          database: testDb,
          isSQLite: true,
          dbInitializer: dbInitializer,
        });

        const queryString = c.req.url.split('?')[1] || '';
        const result = await controller.findAllWithQuery(queryString);

        // If relations are requested, fetch them for each record
        if (includeRelations && result.success && result.data) {
          const relations = await getTableRelations(testDb);
          const tableRelations = relations[tableName] || [];

          for (const record of result.data) {
            const relatedData: Record<string, any> = {};

            for (const relation of tableRelations) {
              const relatedResult = await getRelatedData(
                tableName,
                relation.fromColumn,
                record[relation.fromColumn],
                testDb
              );

              if (relatedResult.success) {
                relatedData[relation.toTable] = relatedResult.data;
              }
            }

            record._related = relatedData;
          }
        }

        // Check if result indicates failure and set appropriate status code
        if (result && typeof result === 'object' && 'success' in result && !result.success) {
          const errorMessage = result.error || 'Unknown error';
          // Check if it's a query parsing error
          if (errorMessage.includes('Invalid order direction') ||
              errorMessage.includes('Invalid order parameter') ||
              errorMessage.includes('Invalid column')) {
            return c.json(result, 400);
          }
          return c.json(result, 500);
        }
        
        return c.json(result);
      } catch (error) {
        console.error(`Error fetching ${tableName}:`, error);
        // Return error response with proper format
        if (error instanceof Error) {
          // Check if it's a query parsing error (invalid parameters)
          if (error.message.includes('Invalid order direction') ||
              error.message.includes('Invalid order parameter') ||
              error.message.includes('Invalid column')) {
            return c.json({ success: false, error: error.message }, 400);
          }
          return c.json({ success: false, error: error.message }, 500);
        }
        return c.json({ success: false, error: `Failed to fetch ${tableName}` }, 500);
      }
    });

    // Get a specific record by ID
    tableRouter.get("/:id", async (c) => {
      try {
        const id = c.req.param("id");
        const includeRelations = c.req.query("includeRelations") === "true";

        // Use ExtendedBaseController with query string for soporte de select
        const controller = new ExtendedBaseController(tableName, {
          database: testDb,
          isSQLite: true,
          dbInitializer: dbInitializer,
        });

        const result = await controller.findByIdWithQuery(id, c.req.url.split('?')[1]);

        if (!result.success || !result.data) {
          return c.json({ error: "Record not found" }, 404);
        }

        // If relations are requested, fetch them
        if (includeRelations) {
          const relations = await getTableRelations(testDb);
          const tableRelations = relations[tableName] || [];

          const relatedData: Record<string, any> = {};

          for (const relation of tableRelations) {
            const relatedResult = await getRelatedData(
              tableName,
              relation.fromColumn,
              result.data[relation.fromColumn],
              testDb
            );

            if (relatedResult.success) {
              relatedData[relation.toTable] = relatedResult.data;
            }
          }

          result.data._related = relatedData;
        }

        return c.json(result);
      } catch (error) {
        console.error(`Error fetching ${tableName} by ID:`, error);
        return c.json({ error: `Failed to fetch ${tableName} by ID` }, 500);
      }
    });

    // Create a new record
    tableRouter.post("/", async (c) => {
      try {
        const data = await c.req.json();
        
        // For users table, use authService to handle password properly
        if (tableName === 'users' && data.password) {
          const authService = (c as any).authService;
          if (authService) {
            // Create user data without age field for auth service
            const userData = {
              email: data.email,
              password: data.password,
              username: data.username,
              first_name: data.first_name,
              last_name: data.last_name,
              role: data.role
            };
            
            const result = await authService.register(userData);
            if (result.success) {
              // Fetch the created user
              const user = await authService.findUserByEmail(data.email);
              
              // If age was provided, update the user with age
              if (data.age !== undefined && user) {
                try {
                  const controller = new ExtendedBaseController(tableName, {
                    database: testDb,
                    isSQLite: true,
                    dbInitializer: dbInitializer,
                  });
                  const updateResult = await controller.update(user.id, { age: data.age });
                  if (updateResult.success) {
                    const updatedUser = await authService.findUserByEmail(data.email);
                    return c.json({ success: true, data: updatedUser }, 201);
                  } else {
                    console.error("Failed to update user with age:", updateResult.error);
                    // Still return success with the original user if age update fails
                    return c.json({ success: true, data: user }, 201);
                  }
                } catch (updateError) {
                  console.error("Error updating user with age:", updateError);
                  // Return the user without age if update fails
                  return c.json({ success: true, data: user }, 201);
                }
              }
              
              return c.json({ success: true, data: user }, 201);
            }
            console.error("Auth service registration failed:", result.error);
            return c.json({ error: result.error || "Failed to create user" }, 400);
          }
        }
        
        const controller = new ExtendedBaseController(tableName, {
          database: testDb,
          isSQLite: true,
          dbInitializer: dbInitializer,
        });

        const result = await controller.create(data);

        if (!result.success) {
          return c.json(
            { error: result.error || "Failed to create record" },
            400,
          );
        }

        return c.json(result, 201);
      } catch (error: unknown | Error) {
        console.error(`Error creating ${tableName}:`, error);
        return c.json(
          {
            error: error instanceof Error ? error.message : "Failed to create record",
          },
          500,
        );
      }
    });

    // Update a record
    tableRouter.put("/:id", async (c) => {
      try {
        const id = c.req.param("id");
        const data = await c.req.json();
        const controller = new ExtendedBaseController(tableName, {
          database: testDb,
          isSQLite: true,
          dbInitializer: dbInitializer,
        });

        const result = await controller.update(id, data);

        if (!result.success) {
          return c.json(
            { error: result.error || "Failed to update record" },
            400,
          );
        }

        return c.json(result);
      } catch (error: unknown | Error) {
        console.error(`Error updating ${tableName}:`, error);
        return c.json(
          {
            error: error instanceof Error ? error.message : "Failed to update record",
          },
          500,
        );
      }
    });

    // Delete a record
    tableRouter.delete("/:id", async (c) => {
      try {
        const id = c.req.param("id");
        const controller = new ExtendedBaseController(tableName, {
          database: testDb,
          isSQLite: true,
          dbInitializer: dbInitializer,
        });

        const result = await controller.delete(id);

        if (!result.success) {
          return c.json(
            { error: result.error || "Failed to delete record" },
            400,
          );
        }

        return c.json({ message: "Record deleted successfully" });
      } catch (error: unknown | Error) {
        console.error(`Error deleting ${tableName}:`, error);
        return c.json(
          {
            error: error instanceof Error ? error.message : "Failed to delete record",
          },
          500,
        );
      }
    });

    // Mount the table router
    restApiRouter.route(`/${tableName}`, tableRouter);
  }

  return restApiRouter;
}

// Helper function to get schemas (needs to be implemented or imported)
async function getSchemas(db: any): Promise<any[]> {
  const { SQLiteSchemaExtractor } = await import("open-bauth");
  const extractor = new SQLiteSchemaExtractor(db);
  const allSchemas = await extractor.getAllTablesInfo();
  return allSchemas;
}