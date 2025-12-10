import { Hono } from "hono";
import { getServiceFactory } from "../services/service-factory";
import { createAuthMiddlewareForHono } from "../middleware";
import { defaultLogger } from "../utils/logger";
import { ChallengeType } from "open-bauth";
import {
  updateProfileSchema,
  updatePasswordSchema,
  mfaSetupSchema,
  mfaVerifySchema,
  deviceSchema,
  biometricSchema,
  createValidationMiddleware,
  getValidatedData
} from "../schemas";
export const user = new Hono();
const factory = getServiceFactory();
const services = factory.getServices();

// Apply authentication middleware to all user routes
user.use("*", createAuthMiddlewareForHono());


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
user.patch("/me", createValidationMiddleware(updateProfileSchema), async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;

    const validated = getValidatedData<import('../schemas/validation-schemas').UpdateProfileInput>(c);

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

    const userController = services.dbInitializer.createController("users");
    const result = await userController.update(userId, validated as any);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || "Failed to update profile"
      }, 400);
    }

    await services.auditService.log('user.profile.updated', {
      userId: userId,
      ip: c.req.header('x-forwarded-for') || 'unknown',
      metadata: { updatedFields: Object.keys(validated) }
    });

    return c.json({
      success: true,
      user: result.data
    });

  } catch (error) {
    defaultLogger.error("Update user profile error", error as Error);
    return c.json({
      success: false,
      error: "Internal server error"
    }, 500);
  }
});

// POST /api/v1/user/mfa/setup - Setup MFA
user.post("/mfa/setup", createValidationMiddleware(mfaSetupSchema), async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;

    const validated = getValidatedData<import('../schemas/validation-schemas').MFASetupInput>(c);

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
    // Send verification code
    if (services.notificationService) {
      const verificationCode = await services.securityService.generateSecureToken(6);

      // Store verification code for SMS/Email
      if (validated.mfaType === "sms" || validated.mfaType === "email") {
        const tokenController = services.dbInitializer.createController("verification_tokens");

        // Invalidate previous tokens of this type for this user
        // Using raw query for delete since controller might generic
        const db = (services.dbInitializer as any).database;
        const type = validated.mfaType === "sms" ? "sms_verification" : "email_verification";
        db.run("DELETE FROM verification_tokens WHERE user_id = ? AND type = ?", [userId, type]);

        await tokenController.create({
          id: crypto.randomUUID(),
          user_id: userId,
          token: verificationCode,
          type: type,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
          created_at: new Date().toISOString()
        });
      }

      switch (validated.mfaType) {
        case "sms":
          if (validated.phoneNumber) {
            // In a real implementation, you would send SMS here
            // logging it for now as notificationService might not have SMS implemented
            defaultLogger.info(`Sending MFA SMS to ${validated.phoneNumber}: ${verificationCode}`);
            // If notification service has method:
            await services.notificationService.sendMFAEmail(auth.user.email, verificationCode); // Fallback to email for demo or if SMS service integrated
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
    defaultLogger.error("MFA setup error", error as Error);
    return c.json({
      success: false,
      error: "Internal server error"
    }, 500);
  }
});

// POST /api/v1/user/mfa/verify - Verify MFA code
user.post("/mfa/verify", createValidationMiddleware(mfaVerifySchema), async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;

    const validated = getValidatedData<import('../schemas/validation-schemas').MFAVerifyInput>(c);

    // Manual implementation since verifyMFA is missing from EnhancedUserService in the installed version
    const mfaConfigs = await services.enhancedUserService.getEnabledMFAConfigurations(userId);
    const config = mfaConfigs.find(c => c.mfa_type === validated.mfaType);

    if (!config) {
      return c.json({
        success: false,
        error: "MFA not configured for this type"
      }, 400);
    }

    // Verify code
    // Verify code based on type
    let verification: { valid: boolean; error?: string } = { valid: false, error: "Unknown MFA type" };

    if (validated.mfaType === "totp") {
      // For TOTP, we need the secret from the config
      // Assuming config has the secret. If stored encrypted, logic would be needed to decrypt.
      // EnhancedUserService usually handles retrieval.

      if (!(config as any).secret) {
        return c.json({ success: false, error: "MFA configuration invalid" }, 500);
      }

      const challenge = services.securityService.createChallenge(ChallengeType.MFA, {
        secret: (config as any).secret
      });

      verification = await services.securityService.verifyChallenge(
        {
          ...challenge,
          id: "totp-verify",
          created_at: new Date().toISOString()
        },
        { token: validated.code }
      );

    } else if (validated.mfaType === "sms" || validated.mfaType === "email") {
      // Retrieve stored token
      const type = validated.mfaType === "sms" ? "sms_verification" : "email_verification";
      const db = (services.dbInitializer as any).database;

      // Get valid token
      const row = db.query(
        "SELECT * FROM verification_tokens WHERE user_id = ? AND type = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
      ).get(userId, type, new Date().toISOString());

      if (!row) {
        return c.json({ success: false, error: "Invalid or expired verification code" }, 400);
      }

      const challengeType = validated.mfaType === "sms" ? ChallengeType.SMS_VERIFICATION : ChallengeType.EMAIL_VERIFICATION;

      const challenge = services.securityService.createChallenge(challengeType, {
        expectedCode: row.token
      });

      verification = await services.securityService.verifyChallenge(
        {
          ...challenge,
          id: row.id,
          created_at: row.created_at
        },
        { code: validated.code }
      );

      // cleanup used token if valid
      if (verification.valid) {
        db.run("DELETE FROM verification_tokens WHERE id = ?", [row.id]);
      }
    }

    if (!verification.valid) {
      await services.auditService.logSecurityEvent('user.mfa.verification.failed', {
        userId: userId,
        ip: c.req.header('x-forwarded-for') || 'unknown',
        details: { mfaType: validated.mfaType, reason: verification.error }
      });

      return c.json({
        success: false,
        error: verification.error || "Invalid verification code"
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
user.post("/devices", createValidationMiddleware(deviceSchema), async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;

    const validated = getValidatedData<import('../schemas/validation-schemas').DeviceInput>(c);

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
    defaultLogger.error("Register device error", error as Error);
    return c.json({
      success: false,
      error: "Internal server error"
    }, 500);
  }
});

// POST /api/v1/user/biometric - Register biometric credential
user.post("/biometric", createValidationMiddleware(biometricSchema), async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;

    const validated = getValidatedData<import('../schemas/validation-schemas').BiometricInput>(c);

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
    defaultLogger.error("Register biometric error", error as Error);
    return c.json({
      success: false,
      error: "Internal server error"
    }, 500);
  }
});

// POST /api/v1/user/password - Update password
user.post("/password", createValidationMiddleware(updatePasswordSchema), async (c) => {
  try {
    const auth = (c as any).auth;
    const userId = auth.user.id;

    const validated = getValidatedData<import('../schemas/validation-schemas').UpdatePasswordInput>(c);

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

    // Hash new password
    const hashedPassword = await Bun.password.hash(validated.newPassword, {
      algorithm: "bcrypt",
      cost: 10
    });

    // Update password
    const userController = services.dbInitializer.createController("users");
    const updateResult = await userController.update(userId, {
      password_hash: hashedPassword
    });

    if (!updateResult.success) {
      return c.json({
        success: false,
        error: updateResult.error || "Failed to update password"
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
    defaultLogger.error("Update password error", error as Error);
    return c.json({
      success: false,
      error: "Internal server error"
    }, 500);
  }
});

export { user as userRoutes };