import { Hono } from "hono";
import { z, email } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  db,
  dbInitializer,
  jwtService,
  authService,
  permissionService,
} from "../db";
import { errorString, notResult } from "../utils/errors";
import { setCookie, getCookie } from "hono/cookie";
import { AuthService } from "open-bauth";
import { authMiddleware } from "../middleware";

const authRouter = new Hono();

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

// Schema refresh
const refreshSchema = z.object({
  refreshToken: z.string(),
});
/*
export interface AuthResult {
    success: boolean;
    user?: User;
    token?: string;
    refreshToken?: string;
    error?: {
        type: AuthErrorType;
        message: string;
    };
}
*/
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

// Me (GET current authenticated user) - Supabase compatible endpoint
authRouter.get("/user", authMiddleware({ required: true }), async (c: any) => {
  // Obtenemos el contexto de autenticación del middleware
  const auth = c.get("auth") as any;

  if (!auth || !auth.isAuthenticated) {
    return c.json({ error: "No token provided" }, 401);
  }

  try {
    const user = await authService.findUserById(auth.user?.id);
    if (!user) return c.json({ error: "User not found" }, 404);

    // Don't return password hash
    const { password, ...userWithoutPassword } = user as any;
    return c.json(userWithoutPassword);
  } catch (error) {
    return c.json(notResult(error), 401);
  }
});

// Also support /me for backward compatibility
authRouter.get("/me", authMiddleware({ required: true }), async (c: any) => {
  // Obtenemos el contexto de autenticación del middleware
  const auth = c.get("auth") as any;

  if (!auth || !auth.isAuthenticated) {
    return c.json({ error: "No token provided" }, 401);
  }

  try {
    const user = await authService.findUserById(auth.user?.id);
    if (!user) return c.json({ error: "User not found" }, 404);

    // Don't return password hash
    const { password, ...userWithoutPassword } = user as any;
    return c.json(userWithoutPassword);
  } catch (error) {
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

// Update profile
authRouter.put("/profile", authMiddleware({ required: true }), async (c: any) => {
  try {
    // Obtenemos el contexto de autenticación del middleware
    const auth = c.get("auth") as any;

    if (!auth || !auth.isAuthenticated) {
      return c.json({ error: "No token provided" }, 401);
    }

    const user = await authService.findUserById(auth.user?.id);
    if (!user) return c.json({ error: "User not found" }, 404);

    const data = await c.req.json();

    const updatedUser = await authService.updateUser(auth.userId, data);
    if (!updatedUser) return c.json({ error: "User not found" }, 404);

    // Don't return password hash
    const { password, ...userWithoutPassword } = updatedUser as any;
    return c.json(userWithoutPassword);
  } catch (error) {
    return c.json(notResult(error), 500);
  }
});

// Change password
authRouter.post("/change-password", async (c: any) => {
  try {
    // Obtenemos el contexto de autenticación del middleware global
    const auth = c.get("auth") as any;

    if (!auth || !auth.isAuthenticated) {
      return c.json({ error: "No token provided" }, 401);
    }
    const { currentPassword, newPassword, confirmPassword } =
      await c.req.json();

    if (newPassword !== confirmPassword) {
      return c.json({ error: errorString("New passwords do not match") }, 400);
    }

    const result = await authService.changePassword(
      auth.user?.id,
      currentPassword,
      newPassword,
    );
    return c.json(result);
  } catch (error) {
    return c.json(notResult(error), 500);
  }
});

// Permissions
authRouter.get("/permissions", async (c) => {
  const permissions = await permissionService.getAllPermissions();
  return c.json(permissions);
});

authRouter.get("/permissions/:name", async (c) => {
  try {
    const name = c.req.param("name");
    const permission = await permissionService.findPermissionByName(name);
    return c.json(permission);
  } catch (error) {
    return c.json(notResult(error), 404);
  }
});

export { authRouter };
