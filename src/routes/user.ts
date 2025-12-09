import { Hono } from "hono";
import { z } from "zod";
import { getServiceFactory } from "../services/service-factory";
import { createAuthMiddlewareForHono } from "../middleware";
import { defaultLogger } from "../utils/logger";

export const user = new Hono();
const factory = getServiceFactory();
const services = factory.getServices();

// Apply authentication middleware to all user routes
user.use("*", createAuthMiddlewareForHono());

// Validation schemas
const updateProfileSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters").optional(),
  last_name: z.string().min(2, "Last name must be at least 2 characters").optional(),
  username: z.string().min(3, "Username must be at least 3 characters").optional(),
  email: z.string().email("Invalid email format").optional(),
  phone_number: z.string().optional(),
  bio: z.string().optional(),
  avatar_url: z.string().url("Invalid avatar URL").optional(),
  timezone: z.string().optional(),
  language: z.string().optional()
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8, "Current password must be at least 8 characters"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const mfaSetupSchema = z.object({
  mfaType: z.enum(["totp", "sms", "email"]),
  phoneNumber: z.string().optional(),
  email: z.string().email().optional()
});

const mfaVerifySchema = z.object({
  code: z.string().min(6, "Code must be at least 6 characters"),
  mfaType: z.enum(["totp", "sms", "email"])
});

const deviceSchema = z.object({
  deviceId: z.string(),
  deviceName: z.string(),
  deviceType: z.enum(["mobile", "desktop", "tablet", "other"]),
  platform: z.string().optional(),
  userAgent: z.string().optional()
});

const biometricSchema = z.object({
  biometricType: z.enum(["fingerprint", "face", "voice", "iris"]),
  encryptedData: z.string(),
  deviceId: z.string()
});

// GET /api/v1/user/me - Get current user profile
user.get("/me", async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;
    
    const user = await services.authService.findUserById(userId, {
      includeRoles: true,
      includePermissions: true
    });
    
    if (!user) {
      return c.json({ 
        success: false, 
        error: "User not found" 
      }, 404);
    }
    
    // Get user devices
    const devices = await services.enhancedUserService.getUserDevices(userId);
    
    // Get MFA configurations
    const mfaConfigs = await services.enhancedUserService.getEnabledMFAConfigurations(userId);
    
    return c.json({ 
      success: true, 
      user: {
        ...user,
        devices,
        mfaEnabled: mfaConfigs.length > 0,
        mfaMethods: mfaConfigs.map(config => config.mfa_type)
      }
    });
    
  } catch (error) {
    defaultLogger.error("Get user profile error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// PATCH /api/v1/user/me - Update current user profile
user.patch("/me", async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;
    
    const body = await c.req.json();
    const validated = updateProfileSchema.parse(body);
    
    // Check if email is being changed and if it's already taken
    if (validated.email && validated.email !== auth.user.email) {
      const existingUser = await services.authService.findUserByEmail(validated.email);
      if (existingUser && existingUser.id !== userId) {
        return c.json({ 
          success: false, 
          error: "Email already in use" 
        }, 400);
      }
    }
    
    const result = await services.authService.updateUser(userId, validated as any);
    
    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error?.message || "Failed to update profile" 
      }, 400);
    }
    
    await services.auditService.log('user.profile.updated', {
      userId: userId,
      ip: c.req.header('x-forwarded-for') || 'unknown',
      metadata: { updatedFields: Object.keys(validated) }
    });
    
    return c.json({ 
      success: true, 
      user: result.user 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Update user profile error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/user/mfa/setup - Setup MFA
user.post("/mfa/setup", async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;
    
    const body = await c.req.json();
    const validated = mfaSetupSchema.parse(body);
    
    // Check if MFA type is already enabled
    const existingConfigs = await services.enhancedUserService.getEnabledMFAConfigurations(userId);
    const existingType = existingConfigs.find(config => config.mfa_type === validated.mfaType);
    
    if (existingType) {
      return c.json({ 
        success: false, 
        error: `MFA type ${validated.mfaType} is already configured` 
      }, 400);
    }
    
    let setupResult;
    
    switch (validated.mfaType) {
      case "totp":
        setupResult = await services.enhancedUserService.setupMFA(userId, "totp" as any, {
          is_primary: existingConfigs.length === 0
        });
        break;
        
      case "sms":
        if (!validated.phoneNumber) {
          return c.json({ 
            success: false, 
            error: "Phone number is required for SMS MFA" 
          }, 400);
        }
        setupResult = await services.enhancedUserService.setupMFA(userId, "sms" as any, {
          phone_number: validated.phoneNumber,
          is_primary: existingConfigs.length === 0
        });
        break;
        
      case "email":
        setupResult = await services.enhancedUserService.setupMFA(userId, "email" as any, {
          email: validated.email || auth.user.email,
          is_primary: existingConfigs.length === 0
        });
        break;
    }
    
    if (!setupResult.success) {
      return c.json({ 
        success: false, 
        error: setupResult.error?.message || "Failed to setup MFA" 
      }, 500);
    }
    
    // Send verification code
    if (services.notificationService) {
      const verificationCode = await services.securityService.generateSecureToken(6);
      
      switch (validated.mfaType) {
        case "sms":
          if (validated.phoneNumber) {
            // In a real implementation, you would send SMS here
            await services.notificationService.sendMFAEmail(auth.user.email, verificationCode);
          }
          break;
        case "email":
          await services.notificationService.sendMFAEmail(validated.email || auth.user.email, verificationCode);
          break;
      }
    }
    
    await services.auditService.logSecurityEvent('user.mfa.setup.completed', {
      userId: userId,
      ip: c.req.header('x-forwarded-for') || 'unknown',
      details: { mfaType: validated.mfaType }
    });
    
    return c.json({ 
      success: true, 
      message: "MFA setup initiated",
      mfaType: validated.mfaType,
      backupCodes: (setupResult as any).backupCodes
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("MFA setup error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/user/mfa/verify - Verify MFA code
user.post("/mfa/verify", async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;
    
    const body = await c.req.json();
    const validated = mfaVerifySchema.parse(body);
    
    const result = await (services.enhancedUserService as any).verifyMFA(userId, validated.mfaType, validated.code);
    
    if (!result.success) {
      await services.auditService.logSecurityEvent('user.mfa.verification.failed', {
        userId: userId,
        ip: c.req.header('x-forwarded-for') || 'unknown',
        details: { mfaType: validated.mfaType, reason: result.error?.message }
      });
      
      return c.json({ 
        success: false, 
        error: result.error?.message || "Invalid verification code" 
      }, 400);
    }
    
    await services.auditService.logSecurityEvent('user.mfa.verification.success', {
      userId: userId,
      ip: c.req.header('x-forwarded-for') || 'unknown',
      details: { mfaType: validated.mfaType }
    });
    
    return c.json({ 
      success: true, 
      message: "MFA verification successful" 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("MFA verification error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// GET /api/v1/user/devices - Get user devices
user.get("/devices", async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;
    
    const devices = await services.enhancedUserService.getUserDevices(userId);
    
    return c.json({ 
      success: true, 
      devices 
    });
    
  } catch (error) {
    defaultLogger.error("Get user devices error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/user/devices - Register new device
user.post("/devices", async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;
    
    const body = await c.req.json();
    const validated = deviceSchema.parse(body);
    
    const result = await services.enhancedUserService.registerDevice(
      userId,
      validated.deviceId,
      validated.deviceName,
      validated.deviceType as any,
      validated.platform,
      validated.userAgent
    );
    
    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error?.message || "Failed to register device" 
      }, 500);
    }
    
    await services.auditService.logSecurityEvent('user.device.registered', {
      userId: userId,
      ip: c.req.header('x-forwarded-for') || 'unknown',
      details: { deviceId: validated.deviceId, deviceType: validated.deviceType }
    });
    
    return c.json({ 
      success: true, 
      device: result.device 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Register device error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/user/biometric - Register biometric credential
user.post("/biometric", async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;
    
    const body = await c.req.json();
    const validated = biometricSchema.parse(body);
    
    const result = await services.enhancedUserService.registerBiometricCredential(
      userId,
      validated.biometricType as any,
      validated.encryptedData,
      validated.deviceId
    );
    
    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error?.message || "Failed to register biometric credential" 
      }, 500);
    }
    
    await services.auditService.logSecurityEvent('user.biometric.registered', {
      userId: userId,
      ip: c.req.header('x-forwarded-for') || 'unknown',
      details: { biometricType: validated.biometricType, deviceId: validated.deviceId }
    });
    
    return c.json({ 
      success: true, 
      credential: result.credential 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Register biometric error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/user/password - Update password
user.post("/password", async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;
    
    const body = await c.req.json();
    const validated = updatePasswordSchema.parse(body);
    
    // Verify current password
    const loginResult = await services.authService.login({
      email: auth.user.email,
      password: validated.currentPassword
    });
    
    if (!loginResult.success) {
      await services.auditService.logSecurityEvent('user.password.update.failed', {
        userId: userId,
        ip: c.req.header('x-forwarded-for') || 'unknown',
        details: { reason: "Invalid current password" }
      });
      
      return c.json({ 
        success: false, 
        error: "Current password is incorrect" 
      }, 400);
    }
    
    // Update password
    const updateResult = await (services.authService as any).updateUser(userId, {
      password: validated.newPassword
    });
    
    if (!updateResult.success) {
      return c.json({ 
        success: false, 
        error: updateResult.error?.message || "Failed to update password" 
      }, 500);
    }
    
    await services.auditService.logSecurityEvent('user.password.update.success', {
      userId: userId,
      ip: c.req.header('x-forwarded-for') || 'unknown'
    });
    
    return c.json({ 
      success: true, 
      message: "Password updated successfully" 
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false, 
        error: "Validation error", 
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Update password error", error as Error);
    return c.json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});

export { user as userRoutes };