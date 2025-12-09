import { Hono } from "hono";
import { z } from "zod";
import { getServiceFactory } from "../services/service-factory";
import { createAuthMiddlewareForHono } from "../middleware";
import { defaultLogger } from "../utils/logger";

const oauth = new Hono();
const factory = getServiceFactory();
const services = factory.getServices();

// Validation schemas
const authorizationSchema = z.object({
  response_type: z.enum(["code", "token"]),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["S256", "plain"]).optional(),
  nonce: z.string().optional()
});

const tokenSchema = z.object({
  grant_type: z.enum(["authorization_code", "refresh_token", "client_credentials", "password"]),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  client_id: z.string(),
  client_secret: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  code_verifier: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  scope: z.string().optional()
});

const introspectionSchema = z.object({
  token: z.string(),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional()
});

const revocationSchema = z.object({
  token: z.string(),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional()
});

// GET /api/v1/oauth/authorize - OAuth authorization endpoint
oauth.get("/authorize", async (c) => {
  try {
    const query = c.req.query();
    const validated = authorizationSchema.parse(query);
    
    // Verify client
    const client = await services.oauthService.findClientByClientId(validated.client_id);
    if (!client || !client.is_active) {
      return c.json({ 
        error: "invalid_client", 
        error_description: "Client not found or inactive" 
      }, 400);
    }
    
    // Verify redirect URI
    if (!services.oauthService.validateRedirectUri(validated.client_id, validated.redirect_uri)) {
      return c.json({ 
        error: "invalid_request", 
        error_description: "Invalid redirect URI" 
      }, 400);
    }
    
    // For authorization code flow, we need user authentication
    // This would typically redirect to a login/consent page
    // For now, we'll simulate the authorization process
    
    if (validated.response_type === "code") {
      // Generate authorization code
      const authCode = await services.oauthService.createAuthCode({
        code: await services.securityService.generateSecureToken(32),
        client_id: validated.client_id,
        user_id: "simulated-user-id", // In real implementation, this would come from authenticated user
        redirect_uri: validated.redirect_uri,
        scope: validated.scope || "",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        code_challenge: validated.code_challenge || "",
        code_challenge_method: (validated.code_challenge_method || "S256") as any,
        state: validated.state || "",
        nonce: validated.nonce || ""
      });
      
      // Build redirect URL
      const redirectUrl = new URL(validated.redirect_uri);
      redirectUrl.searchParams.set("code", authCode.code);
      if (validated.state) {
        redirectUrl.searchParams.set("state", validated.state);
      }
      
      return c.redirect(redirectUrl.toString());
    }
    
    // Implicit flow (not recommended, but supported for legacy)
    if (validated.response_type === "token") {
      // Generate access token directly
      const accessToken = await services.jwtService.generateToken({
        id: "simulated-user-id",
        email: "user@example.com",
        username: "simulated-user",
        first_name: "Simulated",
        last_name: "User",
        is_active: true,
        roles: []
      });
      
      // Build redirect URL with fragment
      const redirectUrl = new URL(validated.redirect_uri);
      redirectUrl.hash = `access_token=${accessToken}&token_type=Bearer&expires_in=3600`;
      if (validated.state) {
        redirectUrl.hash += `&state=${validated.state}`;
      }
      
      return c.redirect(redirectUrl.toString());
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: "invalid_request", 
        error_description: "Invalid request parameters",
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Authorization error", error as Error);
    return c.json({ 
      error: "server_error", 
      error_description: "Internal server error" 
    }, 500);
  }
});

// POST /api/v1/oauth/token - OAuth token endpoint
oauth.post("/token", async (c) => {
  try {
    const body = await c.req.parseBody();
    const validated = tokenSchema.parse(body);
    
    // Client authentication
    let client = null;
    if (validated.client_secret) {
      client = await services.oauthService.authenticateClient(validated.client_id, validated.client_secret);
    } else {
      client = await services.oauthService.findClientByClientId(validated.client_id);
    }
    
    if (!client || !client.is_active) {
      return c.json({ 
        error: "invalid_client", 
        error_description: "Client authentication failed" 
      }, 401);
    }
    
    let result: any;
    
    switch (validated.grant_type) {
      case "authorization_code":
        result = await handleAuthorizationCodeGrant(validated, client);
        break;
        
      case "refresh_token":
        result = await handleRefreshTokenGrant(validated, client);
        break;
        
      case "client_credentials":
        result = await handleClientCredentialsGrant(validated, client);
        break;
        
      case "password":
        result = await handlePasswordGrant(validated, client);
        break;
        
      default:
        return c.json({ 
          error: "unsupported_grant_type", 
          error_description: "Grant type not supported" 
        }, 400);
    }
    
    // Check if result contains an error
    if (result.error) {
      return c.json(result, 400);
    }
    
    return c.json(result);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: "invalid_request", 
        error_description: "Invalid request parameters",
        details: error.errors 
      }, 400);
    }
    
    defaultLogger.error("Token error", error as Error);
    return c.json({ 
      error: "server_error", 
      error_description: "Internal server error" 
    }, 500);
  }
});

// Handle authorization code grant
async function handleAuthorizationCodeGrant(validated: any, client: any) {
  if (!validated.code || !validated.redirect_uri) {
    return { 
      error: "invalid_request", 
      error_description: "Missing required parameters" 
    };
  }
  
  // Verify authorization code
  const authCode = await services.oauthService.findAuthCodeById(validated.code);
  if (!authCode || authCode.is_used || new Date() > new Date(authCode.expires_at)) {
    return { 
      error: "invalid_grant", 
      error_description: "Invalid or expired authorization code" 
    };
  }
  
  // Verify PKCE if used
  if (authCode.code_challenge && validated.code_verifier) {
    const isValid = services.securityService.verifyPKCEChallenge(
      validated.code_verifier,
      authCode.code_challenge,
      authCode.code_challenge_method || "S256" as any
    );
    
    if (!isValid) {
      return { 
        error: "invalid_grant", 
        error_description: "PKCE verification failed" 
      };
    }
  }
  
  // Get user
  const user = await services.authService.findUserById(authCode.user_id);
  if (!user || !user.is_active) {
    return { 
      error: "invalid_grant", 
      error_description: "User not found or inactive" 
    };
  }
  
  // Generate tokens
  const accessToken = await services.jwtService.generateToken(user);
  
  const refreshToken = await services.jwtService.generateRefreshToken(user.id);
  
  // Mark authorization code as used
  await services.oauthService.markAuthCodeAsUsed(authCode.id);
  
  // Create refresh token record
  await services.oauthService.createRefreshToken({
    token: refreshToken,
    user_id: user.id,
    client_id: client.client_id,
    scope: authCode.scope,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  });
  
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: authCode.scope
  };
}

// Handle refresh token grant
async function handleRefreshTokenGrant(validated: any, client: any) {
  if (!validated.refresh_token) {
    return { 
      error: "invalid_request", 
      error_description: "Missing refresh token" 
    };
  }
  
  // Verify refresh token
  const refreshToken = await services.oauthService.findRefreshTokenById(validated.refresh_token);
  if (!refreshToken || refreshToken.is_revoked || new Date() > new Date(refreshToken.expires_at)) {
    return { 
      error: "invalid_grant", 
      error_description: "Invalid or expired refresh token" 
    };
  }
  
  // Get user
  const user = await services.authService.findUserById(refreshToken.user_id);
  if (!user || !user.is_active) {
    return { 
      error: "invalid_grant", 
      error_description: "User not found or inactive" 
    };
  }
  
  // Generate new access token
  const accessToken = await services.jwtService.generateToken(user);
  
  // Rotate refresh token if configured
  if (process.env['ENABLE_REFRESH_TOKEN_ROTATION'] === "true") {
    const newRefreshToken = await services.jwtService.generateRefreshToken(user.id);
    
    // Revoke old refresh token
    await services.oauthService.revokeRefreshToken(refreshToken.id);
    
    // Create new refresh token
    await services.oauthService.createRefreshToken({
      token: newRefreshToken,
      user_id: user.id,
      client_id: client.client_id,
      scope: refreshToken.scope,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: refreshToken.scope
    };
  }
  
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: refreshToken.scope
  };
}

// Handle client credentials grant
async function handleClientCredentialsGrant(validated: any, client: any) {
  if (client.is_public) {
    return { 
      error: "unauthorized_client", 
      error_description: "Public clients cannot use client credentials grant" 
    };
  }
  
  // Generate access token for client
  const accessToken = await services.jwtService.generateToken({
    id: client.client_id,
    email: `${client.client_id}@client.local`,
    username: client.client_name,
    first_name: "Client",
    last_name: "Application",
    is_active: true,
    roles: []
  });
  
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: validated.scope || client.scope
  };
}

// Handle password grant (resource owner password credentials)
async function handlePasswordGrant(validated: any, client: any) {
  if (!validated.username || !validated.password) {
    return { 
      error: "invalid_request", 
      error_description: "Missing username or password" 
    };
  }
  
  // Authenticate user
  const loginResult = await services.authService.login({
    email: validated.username,
    password: validated.password
  });
  
  if (!loginResult.success) {
    return { 
      error: "invalid_grant", 
      error_description: "Invalid credentials" 
    };
  }
  
  // Generate tokens
  const accessToken = await services.jwtService.generateToken(loginResult.user!);
  
  const refreshToken = await services.jwtService.generateRefreshToken(loginResult.user!.id);
  
  // Create refresh token record
  await services.oauthService.createRefreshToken({
    token: refreshToken,
    user_id: loginResult.user!.id,
    client_id: client.client_id,
    scope: validated.scope || "",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });
  
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: validated.scope || ""
  };
}

// POST /api/v1/oauth/revoke - Revoke token
oauth.post("/revoke", async (c) => {
  try {
    const body = await c.req.parseBody();
    const validated = revocationSchema.parse(body);
    
    // Find and revoke the token
    // In a real implementation, you would maintain a token blacklist
    
    // Try to find as access token
    const accessToken = await services.jwtService.verifyToken(validated.token);
    if (accessToken) {
      // In a real implementation, you would maintain a token blacklist
      // Token revoked successfully
    }
    
    // Try to find as refresh token
    const refreshToken = await services.jwtService.verifyRefreshToken(validated.token);
    if (refreshToken) {
      // Revoke refresh token
      await services.oauthService.revokeRefreshToken(validated.token);
      // Token revoked successfully
    }
    
    // OAuth spec requires 200 OK even if token was not found
    return c.json({ 
      success: true 
    });
    
  } catch (error) {
    defaultLogger.error("Token revocation error", error as Error);
    // Return success as per OAuth spec
    return c.json({ 
      success: true 
    });
  }
});

// POST /api/v1/oauth/introspect - Introspect token
oauth.post("/introspect", async (c) => {
  try {
    const body = await c.req.parseBody();
    const validated = introspectionSchema.parse(body);
    
    let tokenInfo = null;
    
    // Try to introspect as access token
    const accessToken = await services.jwtService.verifyToken(validated.token);
    if (accessToken) {
      tokenInfo = {
        active: true,
        scope: "",
        exp: accessToken.exp,
        iat: accessToken.iat,
        sub: accessToken.userId,
        token_type: "Bearer"
      };
    }
    
    // Try to introspect as refresh token
    if (!tokenInfo) {
      const refreshToken = await services.jwtService.verifyRefreshToken(validated.token);
      if (refreshToken) {
        const user = await services.authService.findUserById(refreshToken);
        if (user) {
          tokenInfo = {
            active: true,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days from now
            iat: Math.floor(Date.now() / 1000),
            sub: user.id,
            token_type: "refresh_token"
          };
        }
      }
    }
    
    // Return token info or { active: false }
    if (tokenInfo) {
      return c.json(tokenInfo);
    } else {
      return c.json({ 
        active: false 
      });
    }
    
  } catch (error) {
    defaultLogger.error("Token introspection error", error as Error);
    return c.json({ 
      active: false 
    });
  }
});

// GET /api/v1/oauth/jwks - JSON Web Key Set
oauth.get("/jwks", async (c) => {
  try {
    // For now, return a simple JWKS response
    // In a real implementation, you would generate proper RSA keys
    return c.json({ 
      keys: [
        {
          kty: "RSA",
          kid: "default",
          use: "sig",
          alg: "RS256",
          n: "placeholder",
          e: "AQAB"
        }
      ]
    });
    
  } catch (error) {
    defaultLogger.error("JWKS error", error as Error);
    return c.json({ 
      error: "server_error", 
      error_description: "Failed to retrieve keys" 
    }, 500);
  }
});

// GET /api/v1/oauth/userinfo - OIDC UserInfo endpoint
oauth.get("/userinfo", createAuthMiddlewareForHono(services), async (c) => {
  try {
    const auth = (c as any).auth;
    const user = auth.user;
    
    // Get user info based on scopes
    const scopes = auth.permissions || [];
    const userInfo: any = {
      sub: user.id
    };
    
    if (scopes.includes("profile")) {
      userInfo.name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
      userInfo.given_name = user.first_name;
      userInfo.family_name = user.last_name;
      userInfo.preferred_username = user.username;
      userInfo.picture = user.avatar_url;
      userInfo.zoneinfo = user.timezone;
      userInfo.locale = user.language;
    }
    
    if (scopes.includes("email")) {
      userInfo.email = user.email;
      userInfo.email_verified = user.is_active; // Simplified verification status
    }
    
    if (scopes.includes("phone")) {
      userInfo.phone_number = user.phone_number;
      userInfo.phone_number_verified = false; // Would need actual verification
    }
    
    return c.json(userInfo);
    
  } catch (error) {
    defaultLogger.error("UserInfo error", error as Error);
    return c.json({ 
      error: "server_error", 
      error_description: "Failed to retrieve user info" 
    }, 500);
  }
});

export { oauth as oauthRoutes };