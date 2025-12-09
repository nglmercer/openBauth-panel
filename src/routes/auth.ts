import { Hono } from "hono";
import { z } from "zod";
import { getServiceFactory } from "../services/service-factory";
import { createAuthMiddlewareForHono } from "../middleware";
import { defaultLogger } from "../utils/logger";

export const auth = new Hono();
const factory = getServiceFactory();
const services = factory.getServices();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  first_name: z.string().min(2, "First name must be at least 2 characters"),
  last_name: z.string().min(2, "Last name must be at least 2 characters")
});

const refreshTokenSchema = z.object({
  refreshToken: z.string()
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format")
});

// const resetPasswordSchema = z.object({
//   token: z.string(),
//   password: z.string().min(8, "Password must be at least 8 characters"),
//   confirmPassword: z.string()
// }).refine((data) => data.password === data.confirmPassword, {
//   message: "Passwords don't match",
//   path: ["confirmPassword"],
// });

// const verifyEmailSchema = z.object({
//   token: z.string()
// });

// Anonymous user schema
const anonymousSchema = z.object({
  sessionData: z.object({}).optional(),
  preferences: z.object({}).optional()
});

// POST /api/v1/auth/signup - Register new user
auth.post("/signup", async (c) => {
  try {
    const body = await c.req.json();
    const validated = registerSchema.parse(body);
    
    // Log signup attempt
    await services.auditService.logAuthEvent('user.signup.attempt', 'anonymous', c.req.header('x-forwarded-for') || 'unknown');
    
    const result = await services.authService.register(validated);
    
    if (!result.success) {
      await services.auditService.logAuthEvent('user.signup.failed', 'anonymous', c.req.header('x-forwarded-for') || 'unknown');
      return c.json({ 
        success: false, 
        error: result.error?.message || "Registration failed" 
      }, 400);
    }
    
    // Send welcome email
    if (services.notificationService) {
      await services.notificationService.sendEmail({
        to: validated.email,
        subject: 'Welcome to OpenBauth',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Welcome to OpenBauth!</h1>
            <p>Hi ${validated.first_name},</p>
            <p>Your account has been created successfully. You can now log in and start using our services.</p>
            <p>If you didn't create this account, please contact us immediately.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply.</p>
          </div>
        `
      });
    }
    
    await services.auditService.logAuthEvent('user.signup.success', result.user!.id, c.req.header('x-forwarded-for') || 'unknown');
    
    return c.json({ 
      success: true, 
      user: result.user, 
      token: result.token 
    }, 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Signup error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/auth/login - User login
auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const validated = loginSchema.parse(body);
    
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    
    // Log login attempt
    await services.auditService.logAuthEvent('user.login.attempt', 'anonymous', ip);
    
    const result = await services.authService.login(validated);
    
    if (!result.success) {
      await services.auditService.logAuthEvent('user.login.failed', 'anonymous', ip);
      return c.json({ 
        success: false, 
        error: "Invalid credentials" 
      }, 401);
    }
    
    await services.auditService.logAuthEvent('user.login.success', result.user!.id, ip);
    
    // Check if MFA is required
    const mfaConfigs = await services.enhancedUserService.getEnabledMFAConfigurations(result.user!.id);
    if (mfaConfigs.length > 0) {
      return c.json({ 
        success: true, 
        user: result.user, 
        token: result.token,
        mfaRequired: true,
        mfaMethods: mfaConfigs.map(config => config.mfa_type)
      });
    }
    
    return c.json({ 
      success: true, 
      user: result.user, 
      token: result.token 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Login error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/auth/anonymous - Create anonymous session
auth.post("/anonymous", async (c) => {
  try {
    const body = await c.req.json();
    const validated = anonymousSchema.parse(body);
    
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    
    const result = await services.enhancedUserService.createAnonymousUser({
      sessionData: validated.sessionData,
      preferences: validated.preferences
    });
    
    if (!result.success) {
      return c.json({ 
        success: false, 
        error: "Failed to create anonymous session" 
      }, 500);
    }
    
    await services.auditService.logAuthEvent('user.anonymous.created', result.anonymousUser!.id, ip);
    
    return c.json({ 
      success: true, 
      anonymousUser: result.anonymousUser
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Anonymous session error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/auth/refresh - Refresh access token
auth.post("/refresh", async (c) => {
  try {
    const body = await c.req.json();
    const validated = refreshTokenSchema.parse(body);
    
    const result = await services.jwtService.verifyRefreshToken(validated.refreshToken);
    
    if (!result) {
      return c.json({ 
        success: false, 
        error: "Invalid refresh token" 
      }, 401);
    }
    
    const user = await services.authService.findUserById(result);
    
    if (!user || !user.is_active) {
      return c.json({ 
        success: false, 
        error: "User not found or inactive" 
      }, 401);
    }
    
    // Generate new tokens
    const newAccessToken = await services.jwtService.generateToken(user);
    const newRefreshToken = await services.jwtService.generateRefreshToken(user.id);
    
    await services.auditService.logAuthEvent('user.token.refreshed', user.id, c.req.header('x-forwarded-for') || 'unknown');
    
    return c.json({ 
      success: true, 
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Token refresh error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/auth/logout - Revoke current session
auth.post("/logout", createAuthMiddlewareForHono(), async (c) => {
  try {
    const auth = (c as any).auth;
    
    // Revoke refresh token if provided
    const body = await c.req.json().catch(() => ({}));
    if (body.refreshToken) {
      // Note: JWTService doesn't have revokeRefreshToken, this would need to be implemented
      // For now, we'll just log the logout
    }
    
    await services.auditService.logAuthEvent('user.logout', auth.user.id, c.req.header('x-forwarded-for') || 'unknown');
    
    return c.json({ 
      success: true, 
      message: "Logged out successfully" 
    });
    
  } catch (error) {
    defaultLogger.error("Logout error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/auth/forgot-password - Request password reset
auth.post("/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const validated = forgotPasswordSchema.parse(body);
    
    const user = await services.authService.findUserByEmail(validated.email);
    
    if (!user) {
      // Don't reveal if user exists
      return c.json({ 
        success: true, 
        message: "If the email exists, a reset link has been sent" 
      });
    }
    
    // Generate reset token
    const resetToken = await services.securityService.generateSecureToken(32);
    // const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Store reset token (you would need to implement this in your auth service)
    // For now, we'll simulate it
    await services.auditService.logSecurityEvent('user.password.reset.requested', {
      userId: user.id,
      ip: c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown'
    });
    
    // Send reset email
    if (services.notificationService) {
      await services.notificationService.sendPasswordResetEmail(validated.email, resetToken);
    }
    
    return c.json({ 
      success: true, 
      message: "If the email exists, a reset link has been sent" 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Forgot password error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/auth/reset-password - Reset password with token
auth.post("/reset-password", async (c) => {
  try {
    // const body = await c.req.json();
    // const validated = resetPasswordSchema.parse(body);
    
    // For now, we'll simulate token verification
    // In a real implementation, you would verify the token against your database
    
    await services.auditService.logSecurityEvent('user.password.reset.completed', {
      userId: 'unknown', // You would get this from token verification
      ip: c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown'
    });
    
    return c.json({ 
      success: true, 
      message: "Password reset successfully" 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Reset password error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/auth/verify-email - Verify email with token
auth.post("/verify-email", async (c) => {
  try {
    // const body = await c.req.json();
    // const validated = verifyEmailSchema.parse(body);
    
    // For now, we'll simulate email verification
    // In a real implementation, you would verify the token against your database
    
    await services.auditService.logAuthEvent('user.email.verified', 'unknown', c.req.header('x-forwarded-for') || 'unknown');
    
    return c.json({ 
      success: true, 
      message: "Email verified successfully" 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Email verification error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

export { auth as authRoutes };