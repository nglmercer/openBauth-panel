// Main client interface for openBauth-panel API
import BaseApi from "./commons/BaseApi";
import apiConfig from "./config/apiConfig";
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
} from "./types/auth";
import type { FetchOptions } from "./commons/httpservice";

/**
 * OpenBauthPanelClient - Main API client for openBauth-panel
 * Provides a comprehensive interface for authentication and API operations
 */
export class OpenBauthPanelClient extends BaseApi {
  override user: User | {};

  constructor(config?: Partial<typeof apiConfig>) {
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
  }

  // Authentication methods

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
   * Logout the current user
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

  // User management methods

  /**
   * Get list of users with pagination
   * @param options - Additional fetch options
   * @returns Promise resolving to paginated users list
   */
  async getUsers(options?: FetchOptions): Promise<PaginatedResponse<User>> {
    return this.get<PaginatedResponse<User>>("/api/users", options);
  }

  /**
   * Get user by ID
   * @param id - User ID
   * @param options - Additional fetch options
   * @returns Promise resolving to user data
   */
  async getUserById(
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse<User>> {
    return this.get<ApiResponse<User>>(`/api/users/${id}`, options);
  }

  /**
   * Create a new user
   * @param userData - User data
   * @param options - Additional fetch options
   * @returns Promise resolving to created user
   */
  async createUser(
    userData: Partial<User>,
    options?: FetchOptions,
  ): Promise<ApiResponse<User>> {
    return this.post<ApiResponse<User>>("/api/users", userData, options);
  }

  /**
   * Update user by ID
   * @param id - User ID
   * @param userData - Updated user data
   * @param options - Additional fetch options
   * @returns Promise resolving to updated user
   */
  async updateUser(
    id: string,
    userData: Partial<User>,
    options?: FetchOptions,
  ): Promise<ApiResponse<User>> {
    return this.put<ApiResponse<User>>(`/api/users/${id}`, userData, options);
  }

  /**
   * Delete user by ID
   * @param id - User ID
   * @param options - Additional fetch options
   * @returns Promise resolving to delete response
   */
  async deleteUser(id: string, options?: FetchOptions): Promise<ApiResponse> {
    return this.delete<ApiResponse>(`/api/users/${id}`, options);
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
      "/api/auth/change-password",
      passwordData,
      options,
    );
  }

  // Role management methods

  /**
   * Get list of roles with pagination
   * @param options - Additional fetch options
   * @returns Promise resolving to paginated roles list
   */
  async getRoles(options?: FetchOptions): Promise<PaginatedResponse<Role>> {
    return this.get<PaginatedResponse<Role>>("/api/roles", options);
  }

  /**
   * Get role by ID
   * @param id - Role ID
   * @param options - Additional fetch options
   * @returns Promise resolving to role data
   */
  async getRoleById(
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse<Role>> {
    return this.get<ApiResponse<Role>>(`/api/roles/${id}`, options);
  }

  /**
   * Create a new role
   * @param roleData - Role data
   * @param options - Additional fetch options
   * @returns Promise resolving to created role
   */
  async createRole(
    roleData: Partial<Role>,
    options?: FetchOptions,
  ): Promise<ApiResponse<Role>> {
    return this.post<ApiResponse<Role>>("/api/roles", roleData, options);
  }

  /**
   * Update role by ID
   * @param id - Role ID
   * @param roleData - Updated role data
   * @param options - Additional fetch options
   * @returns Promise resolving to updated role
   */
  async updateRole(
    id: string,
    roleData: Partial<Role>,
    options?: FetchOptions,
  ): Promise<ApiResponse<Role>> {
    return this.put<ApiResponse<Role>>(`/api/roles/${id}`, roleData, options);
  }

  /**
   * Delete role by ID
   * @param id - Role ID
   * @param options - Additional fetch options
   * @returns Promise resolving to delete response
   */
  async deleteRole(id: string, options?: FetchOptions): Promise<ApiResponse> {
    return this.delete<ApiResponse>(`/api/roles/${id}`, options);
  }

  // Permission management methods

  /**
   * Get list of permissions with pagination
   * @param options - Additional fetch options
   * @returns Promise resolving to paginated permissions list
   */
  async getPermissionsList(
    options?: FetchOptions,
  ): Promise<PaginatedResponse<Permission>> {
    return this.get<PaginatedResponse<Permission>>("/api/permissions", options);
  }

  /**
   * Get permission by ID
   * @param id - Permission ID
   * @param options - Additional fetch options
   * @returns Promise resolving to permission data
   */
  async getPermissionById(
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse<Permission>> {
    return this.get<ApiResponse<Permission>>(`/api/permissions/${id}`, options);
  }

  /**
   * Create a new permission
   * @param permissionData - Permission data
   * @param options - Additional fetch options
   * @returns Promise resolving to created permission
   */
  async createPermission(
    permissionData: Partial<Permission>,
    options?: FetchOptions,
  ): Promise<ApiResponse<Permission>> {
    return this.post<ApiResponse<Permission>>(
      "/api/permissions",
      permissionData,
      options,
    );
  }

  /**
   * Update permission by ID
   * @param id - Permission ID
   * @param permissionData - Updated permission data
   * @param options - Additional fetch options
   * @returns Promise resolving to updated permission
   */
  async updatePermission(
    id: string,
    permissionData: Partial<Permission>,
    options?: FetchOptions,
  ): Promise<ApiResponse<Permission>> {
    return this.put<ApiResponse<Permission>>(
      `/api/permissions/${id}`,
      permissionData,
      options,
    );
  }

  /**
   * Delete permission by ID
   * @param id - Permission ID
   * @param options - Additional fetch options
   * @returns Promise resolving to delete response
   */
  async deletePermission(
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.delete<ApiResponse>(`/api/permissions/${id}`, options);
  }

  // Dashboard methods

  /**
   * Get dashboard information
   * @param options - Additional fetch options
   * @returns Promise resolving to dashboard data
   */
  async getDashboard(options?: FetchOptions): Promise<ApiResponse> {
    return this.get<ApiResponse>("/dashboard", options);
  }

  /**
   * Get table data from dashboard
   * @param tableName - Name of the table
   * @param options - Additional fetch options
   * @returns Promise resolving to table data
   */
  async getTableData(
    tableName: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.get<ApiResponse>(`/dashboard/table/${tableName}`, options);
  }

  // Generic CRUD methods for dynamic tables

  /**
   * Get all records from a table
   * @param tableName - Name of the table
   * @param options - Additional fetch options
   * @returns Promise resolving to table records
   */
  async getTableRecords(
    tableName: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.get<ApiResponse>(`/api/${tableName}`, options);
  }

  /**
   * Get a specific record from a table
   * @param tableName - Name of the table
   * @param id - Record ID
   * @param options - Additional fetch options
   * @returns Promise resolving to record data
   */
  async getTableRecord(
    tableName: string,
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.get<ApiResponse>(`/api/${tableName}/${id}`, options);
  }

  /**
   * Create a new record in a table
   * @param tableName - Name of the table
   * @param data - Record data
   * @param options - Additional fetch options
   * @returns Promise resolving to created record
   */
  async createTableRecord(
    tableName: string,
    data: any,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.post<ApiResponse>(`/api/${tableName}`, data, options);
  }

  /**
   * Update a record in a table
   * @param tableName - Name of the table
   * @param id - Record ID
   * @param data - Updated record data
   * @param options - Additional fetch options
   * @returns Promise resolving to updated record
   */
  async updateTableRecord(
    tableName: string,
    id: string,
    data: any,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.put<ApiResponse>(`/api/${tableName}/${id}`, data, options);
  }

  /**
   * Delete a record from a table
   * @param tableName - Name of the table
   * @param id - Record ID
   * @param options - Additional fetch options
   * @returns Promise resolving to delete response
   */
  async deleteTableRecord(
    tableName: string,
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.delete<ApiResponse>(`/api/${tableName}/${id}`, options);
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
export function createOpenBauthPanelClient(
  config?: Partial<typeof apiConfig>,
): OpenBauthPanelClient {
  return new OpenBauthPanelClient(config);
}

// Export default
export default OpenBauthPanelClient;
