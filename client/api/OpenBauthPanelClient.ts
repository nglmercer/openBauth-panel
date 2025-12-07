// Main client interface for openBauth-panel API
import BaseApi from "../commons/BaseApi";
import apiConfig from "../config/apiConfig";
import { AuthClient } from "./AuthClient";
import { PostgrestQueryBuilder } from "./PostgrestQueryBuilder";
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
  PaginatedResponse,
} from "../types/auth";
import type { FetchOptions } from "../commons/httpservice";
import type { ApiConfig } from "../config/apiConfig";

/**
 * OpenBauthPanelClient - Main API client for openBauth-panel
 * Provides a comprehensive interface for authentication and API operations
 */
export class OpenBauthPanelClient extends BaseApi {
  override user: User | {};
  auth: AuthClient;

  constructor(config?: Partial<ApiConfig>) {
    // Initialize user property before calling super
    // Initialize user after super call

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
    
    // Initialize auth client
    this.auth = new AuthClient(config);
  }

  /**
   * Create a query builder for a specific table
   * @param tableName - Name of the table to query
   * @returns PostgrestQueryBuilder instance
   */
  from(tableName: string): PostgrestQueryBuilder {
    return new PostgrestQueryBuilder(tableName, this);
  }

  // User management methods - Now handled through auth client and query builder

  // Utility methods - Delegated to auth client

  /**
   * Check if user is authenticated
   * @returns Boolean indicating if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  /**
   * Get current user information
   * @returns Current user object or undefined
   */
  getCurrentUser(): User | undefined {
    return this.auth.getUserInfo();
  }

  /**
   * Get current auth token
   * @returns Current auth token or undefined
   */
  getToken(): string | undefined {
    return this.auth.getSession();
  }

  /**
   * Get current auth context
   * @returns Current auth context
   */
  getAuthContext(): AuthContext {
    return this.auth.getAuthContext();
  }

  /**
   * Set authentication token manually
   * @param token - Authentication token
   * @param user - Optional user object
   */
  setToken(token: string, user?: User): void {
    this.auth.setSession(token, user);
  }

  /**
   * Clear authentication state
   */
  clearAuth(): void {
    this.auth.clearSession();
  }
}

// Factory function for creating a client instance
export function createOpenBauthPanelClient(
  config?: Partial<ApiConfig>,
): OpenBauthPanelClient {
  return new OpenBauthPanelClient(config);
}

// Export default
export default OpenBauthPanelClient;
