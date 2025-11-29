// Authentication API client
import BaseApi from "../commons/BaseApi";
import apiConfig from "../config/apiConfig";
import type {
  User,
  Role,
  Permission,
  AuthContext,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,
  ApiResponse,
} from "../types/auth";
import type { FetchOptions } from "../commons/httpservice";

/**
 * Authentication API client
 * Handles all authentication-related operations
 */
export class AuthApi extends BaseApi {
  override user: User | {};

  constructor(config?: Partial<typeof apiConfig>) {
    // If custom config provided, update default config
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
  async register(
    userData: RegisterRequest,
    options?: FetchOptions,
  ): Promise<AuthResponse> {
    return this.post<AuthResponse>("/auth/register", userData, options);
  }

  /**
   * Login with email and password
   * @param credentials - Login credentials
   * @param options - Additional fetch options
   * @returns Promise resolving to auth response
   */
  async login(
    credentials: LoginRequest,
    options?: FetchOptions,
  ): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>(
      "/auth/login",
      credentials,
      options,
    );

    // Store token and user info if login successful
    if (response.success && response.token) {
      this.token = response.token;
      this.user = response.user || {};

      // Store in localStorage for persistence
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(response.user || {}));
      }
    }

    return response;
  }

  /**
   * Logout current user
   * @param options - Additional fetch options
   * @returns Promise resolving to logout response
   */
  async logout(options?: FetchOptions): Promise<ApiResponse> {
    const response = await this.post<ApiResponse>("/auth/logout", {}, options);

    // Clear stored token and user info
    this.token = undefined;
    this.user = {};

    // Clear localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }

    return response;
  }

  /**
   * Get current user information
   * @param options - Additional fetch options
   * @returns Promise resolving to user data
   */
  async me(options?: FetchOptions): Promise<ApiResponse<User>> {
    return this.get<ApiResponse<User>>("/auth/me", options);
  }

  /**
   * Get list of all permissions
   * @param options - Additional fetch options
   * @returns Promise resolving to permissions list
   */
  async getPermissions(
    options?: FetchOptions,
  ): Promise<ApiResponse<Permission[]>> {
    return this.get<ApiResponse<Permission[]>>("/auth/permissions", options);
  }

  /**
   * Refresh access token using refresh token
   * @param refreshTokenData - Refresh token data
   * @param options - Additional fetch options
   * @returns Promise resolving to auth response with new tokens
   */
  async refreshToken(
    refreshTokenData: RefreshTokenRequest,
    options?: FetchOptions,
  ): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>(
      "/auth/refresh",
      refreshTokenData,
      options,
    );

    // Update stored token if refresh successful
    if (response.success && response.token) {
      this.token = response.token;
      this.user = response.user || this.user;

      // Update localStorage
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("token", response.token);
        if (response.user) {
          localStorage.setItem("user", JSON.stringify(response.user));
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
  async changePassword(
    passwordData: ChangePasswordRequest,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.post<ApiResponse>(
      "/auth/change-password",
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
  getCurrentUser(): User | undefined {
    return this.user && "id" in this.user ? (this.user as User) : undefined;
  }

  /**
   * Get current auth token
   * @returns Current auth token or undefined
   */
  getToken(): string | undefined {
    return this.token;
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

  /**
   * Set authentication token manually
   * @param token - Authentication token
   * @param user - Optional user object
   */
  setToken(token: string, user?: User): void {
    this.token = token;
    if (user) {
      this.user = user;
    }

    // Update localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("token", token);
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }
    }
  }

  /**
   * Clear authentication state
   */
  clearAuth(): void {
    this.token = undefined;
    this.user = {};

    // Clear localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }
}

// Factory function for creating a client instance
export function createAuthApi(config?: Partial<typeof apiConfig>): AuthApi {
  return new AuthApi(config);
}

// Export default
export default AuthApi;
