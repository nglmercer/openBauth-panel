// Authentication client for Supabase-compatible API
import BaseApi from "../commons/BaseApi";
import apiConfig from "../config/apiConfig";
import type {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,
  ApiResponse,
  AuthContext,
} from "../types/auth";
import type { FetchOptions } from "../commons/httpservice";
import type { ApiConfig } from "../config/apiConfig";

/**
 * AuthClient - Handles authentication operations similar to Supabase auth
 */
export class AuthClient extends BaseApi {
  override user: User | {};

  constructor(config?: Partial<ApiConfig>) {
    // If custom config provided, update the default config
    if (config) {
      const updatedConfig = { ...apiConfig };
      Object.assign(updatedConfig, config);
      super(updatedConfig);
    } else {
      super(apiConfig);
    }

    // Initialize user after super call
    this.user = {};
  }

  /**
   * Register a new user
   * @param userData - User registration data
   * @param options - Additional fetch options
   * @returns Promise resolving to auth response
   */
  async signUp(
    userData: RegisterRequest,
    options?: FetchOptions,
  ): Promise<AuthResponse> {
    return this.post<AuthResponse>("/auth/v1/signup", userData, options);
  }

  /**
   * Login with email and password
   * @param credentials - Login credentials
   * @param options - Additional fetch options
   * @returns Promise resolving to auth response
   */
  async signInWithPassword(
    credentials: LoginRequest,
    options?: FetchOptions,
  ): Promise<AuthResponse> {
    const response = await this.post<any>(
      "/auth/v1/token",
      {
        grant_type: "password",
        ...credentials
      },
      options,
    );

    // Handle Supabase-compatible token response format
    if (response.access_token) {
      this.token = response.access_token;
      this.user = response.user || {};

      // Store in localStorage for persistence
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("token", response.access_token);
        window.localStorage.setItem(
          "user",
          JSON.stringify(response.user || {}),
        );
      }

      // Return AuthResponse format for compatibility
      return {
        success: true,
        token: response.access_token,
        refreshToken: response.refresh_token,
        user: response.user
      };
    }

    // Fallback to original format
    if (response.success && response.token) {
      this.token = response.token;
      this.user = response.user || {};

      // Store in localStorage for persistence
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("token", response.token);
        window.localStorage.setItem(
          "user",
          JSON.stringify(response.user || {}),
        );
      }
    }

    return response;
  }

  /**
   * Logout the current user
   * @param options - Additional fetch options
   * @returns Promise resolving to logout response
   */
  async signOut(options?: FetchOptions): Promise<ApiResponse> {
    const response = await this.post<ApiResponse>("/auth/v1/logout", {}, options);

    // Clear stored token and user info
    this.token = undefined;
    this.user = {};

    // Clear localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
    }

    return response;
  }

  /**
   * Get current user information
   * @param options - Additional fetch options
   * @returns Promise resolving to user data
   */
  async getUser(options?: FetchOptions): Promise<ApiResponse<User>> {
    return this.get<ApiResponse<User>>("/auth/v1/user", options);
  }

  /**
   * Refresh access token using refresh token
   * @param refreshTokenData - Refresh token data
   * @param options - Additional fetch options
   * @returns Promise resolving to auth response with new tokens
   */
  async refreshSession(
    refreshTokenData: RefreshTokenRequest,
    options?: FetchOptions,
  ): Promise<AuthResponse> {
    const response = await this.post<any>(
      "/auth/v1/token",
      {
        grant_type: "refresh_token",
        refresh_token: refreshTokenData.refreshToken
      },
      options,
    );

    // Handle Supabase-compatible token response format
    if (response.access_token) {
      this.token = response.access_token;
      this.user = response.user || this.user;

      // Update localStorage
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("token", response.access_token);
        if (response.user) {
          window.localStorage.setItem("user", JSON.stringify(response.user));
        }
      }

      // Return AuthResponse format for compatibility
      return {
        success: true,
        token: response.access_token,
        refreshToken: response.refresh_token,
        user: response.user
      };
    }

    // Fallback to original format
    if (response.success && response.token) {
      this.token = response.token;
      this.user = response.user || this.user;

      // Update localStorage
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("token", response.token);
        if (response.user) {
          window.localStorage.setItem("user", JSON.stringify(response.user));
        }
      }
    }

    return response;
  }

  /**
   * Change user password
   * @param passwordData - Password change data
   * @param options - Additional fetch options
   * @returns Promise resolving to change password response
   */
  async updateUser(
    passwordData: ChangePasswordRequest,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.post<ApiResponse>(
      "/auth/v1/user",
      passwordData,
      options,
    );
  }

  // Utility methods

  /**
   * Check if user is authenticated
   * @returns Boolean indicating if user is authenticated
   */
  isAuthenticated(): boolean {
    return (
      !!this.token &&
      !!(this.user && "id" in this.user ? (this.user as User).id : false)
    );
  }

  /**
   * Get current user information
   * @returns Current user object or undefined
   */
  getUserInfo(): User | undefined {
    return this.user && "id" in this.user ? (this.user as User) : undefined;
  }

  /**
   * Get current auth token
   * @returns Current auth token or undefined
   */
  getSession(): string | undefined {
    return this.token;
  }

  /**
   * Set authentication token manually
   * @param token - Authentication token
   * @param user - Optional user object
   */
  setSession(token: string, user?: User): void {
    this.token = token;
    if (user) {
      this.user = user;
    }

    // Update localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("token", token);
      if (user) {
        window.localStorage.setItem("user", JSON.stringify(user));
      }
    }
  }

  /**
   * Clear authentication state
   */
  clearSession(): void {
    this.token = undefined;
    this.user = {};

    // Clear localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
    }
  }

  /**
   * Get current auth context
   * @returns Current auth context
   */
  getAuthContext(): AuthContext {
    return {
      user: this.user && "id" in this.user ? (this.user as User) : undefined,
      token: this.token,
      permissions: [], // Would need to fetch permissions if needed
      isAuthenticated: this.isAuthenticated(),
    };
  }
}

// Factory function for creating an auth client instance
export function createAuthClient(
  config?: Partial<ApiConfig>,
): AuthClient {
  return new AuthClient(config);
}

// Export default
export default AuthClient;