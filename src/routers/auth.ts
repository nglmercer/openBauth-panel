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
// Register
authRouter.post("/register", zValidator("json", registerSchema), async (c) => {
  try {
    const data = c.req.valid("json");
    const result = await authService.register(data);

    // Generar refreshToken si no está presente
    let enhancedResult = result;
    if (result.token && !result.refreshToken) {
      // Generamos un refresh token manualmente
      const refreshToken = await jwtService.generateRefreshToken(
        (result as any).user?.id || "",
      );
      enhancedResult = {
        ...result,
        refreshToken,
      };
    }

    // Set HTTP-only cookies for tokens
    await setAuthCookies(c, enhancedResult);

    return c.json(enhancedResult, 201);
  } catch (error) {
    return c.json(notResult(error), 400);
  }
});

// Login
authRouter.post("/login", zValidator("json", loginSchema), async (c) => {
  try {
    const data = c.req.valid("json");
    const result = await authService.login(data);

    // Generar refreshToken si no está presente
    let enhancedResult = result;
    if (result.token && !result.refreshToken) {
      // Generamos un refresh token manualmente
      const user = await authService.findUserByEmail(data.email);
      if (user) {
        const refreshToken = await jwtService.generateRefreshToken(user.id);
        enhancedResult = {
          ...result,
          refreshToken,
        };
      }
    }

    // Set HTTP-only cookies for tokens
    await setAuthCookies(c, enhancedResult);

    return c.json(enhancedResult);
  } catch (error) {
    return c.json(notResult(error), 401);
  }
});

// Refresh (con body)
authRouter.post("/refresh", zValidator("json", refreshSchema), async (c) => {
  try {
    const { refreshToken } = c.req.valid("json");
    const result =
      await jwtService.verifyRefreshTokenWithSecurity(refreshToken);

    // Set new access token cookie
    if (result.token) {
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
    }

    return c.json(result);
  } catch (error) {
    return c.json(notResult(error), 401);
  }
});

// Me (GET current authenticated user)
authRouter.get("/me", async (c: any) => {
  // Obtenemos el contexto de autenticación del middleware global
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

// Me (GET con ID) - deprecated
authRouter.get("/me/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const user = await authService.findUserById(id);
    if (!user) return c.json({ error: errorString("User not found") }, 404);
    return c.json(user);
  } catch (error) {
    return c.json(notResult(error), 500);
  }
});

// Unregister (DELETE con ID)
authRouter.delete("/unregister/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await authService.deleteUser(id);
    return c.json(result);
  } catch (error) {
    return c.json(notResult(error), 404);
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
authRouter.put("/profile", async (c: any) => {
  try {
    // Obtenemos el contexto de autenticación del middleware global
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
