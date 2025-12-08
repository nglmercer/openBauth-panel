// Main client interface for openBauth-panel API
import BaseApi from "../commons/BaseApi";
import apiConfig from "../config/apiConfig";
import { AuthClient } from "./AuthClient";
import { PostgrestQueryBuilder } from "./PostgrestQueryBuilder";
import { RealtimeClient } from "./RealtimeClient";
import type {
  User,
  AuthContext,
} from "../types/auth";
import type { ApiConfig } from "../config/apiConfig";

/**
 * OpenBauthPanelClient - Main API client for openBauth-panel
 * Provides a Supabase-compatible interface for authentication and API operations
 */
export class OpenBauthPanelClient extends BaseApi {
  override user: User | {};
  auth: AuthClient;
  realtime: RealtimeClient;
  private clientConfig: ApiConfig;

  constructor(config?: Partial<ApiConfig>) {
    // If custom config provided, update the default config
    if (config) {
      const updatedConfig = { ...apiConfig };
      Object.assign(updatedConfig, config);
      super(updatedConfig);
      this.clientConfig = updatedConfig;
    } else {
      super(apiConfig);
      this.clientConfig = apiConfig;
    }

    // Initialize user after super call
    this.user = {};
    
    // Initialize auth client
    this.auth = new AuthClient(config);
    
    // Initialize realtime client with same config
    this.realtime = new RealtimeClient(this.clientConfig);
  }

  /**
   * Create a query builder for a specific table
   * @param tableName - Name of the table to query
   * @returns PostgrestQueryBuilder instance
   */
  from(tableName: string): PostgrestQueryBuilder {
    return new PostgrestQueryBuilder(tableName, this);
  }

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

  /**
   * Connect to realtime WebSocket server
   * @returns Promise that resolves when connected
   */
  connectRealtime(): Promise<void> {
    return this.realtime.connect();
  }

  /**
   * Disconnect from realtime WebSocket server
   */
  disconnectRealtime(): void {
    this.realtime.disconnect();
  }

  /**
   * Create a realtime channel for subscriptions
   * @param topic - Channel topic
   * @returns RealtimeChannelBuilder instance
   */
  channel(topic: string) {
    return this.realtime.channel(topic);
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
