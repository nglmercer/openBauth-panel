// Users API client
import BaseApi from "../commons/BaseApi";
import apiConfig from "../config/apiConfig";
import type {
  User,
  ApiResponse,
  PaginatedResponse,
  ChangePasswordRequest,
} from "../types/auth";
import type { FetchOptions } from "../commons/httpservice";

/**
 * Users API client
 * Handles all user-related operations
 */
export class UsersApi extends BaseApi {
  constructor(config?: Partial<typeof apiConfig>) {
    // If custom config provided, update default config
    if (config) {
      const updatedConfig = { ...apiConfig };
      Object.assign(updatedConfig, config);
      super(updatedConfig);
    } else {
      super(apiConfig);
    }
  }

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
   * @param id - User ID
   * @param passwordData - Password change data
   * @param options - Additional fetch options
   * @returns Promise resolving to change password response
   */
  async changeUserPassword(
    id: string,
    passwordData: ChangePasswordRequest,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.post<ApiResponse>(
      `/api/users/${id}/change-password`,
      passwordData,
      options,
    );
  }

  /**
   * Get user roles
   * @param id - User ID
   * @param options - Additional fetch options
   * @returns Promise resolving to user roles
   */
  async getUserRoles(
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse<any[]>> {
    return this.get<ApiResponse<any[]>>(`/api/users/${id}/roles`, options);
  }

  /**
   * Assign role to user
   * @param userId - User ID
   * @param roleId - Role ID
   * @param options - Additional fetch options
   * @returns Promise resolving to role assignment response
   */
  async assignRole(
    userId: string,
    roleId: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.post<ApiResponse>(
      `/api/users/${userId}/roles`,
      { roleId },
      options,
    );
  }

  /**
   * Remove role from user
   * @param userId - User ID
   * @param roleId - Role ID
   * @param options - Additional fetch options
   * @returns Promise resolving to role removal response
   */
  async removeRole(
    userId: string,
    roleId: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.delete<ApiResponse>(
      `/api/users/${userId}/roles/${roleId}`,
      options,
    );
  }

  /**
   * Activate user
   * @param id - User ID
   * @param options - Additional fetch options
   * @returns Promise resolving to activation response
   */
  async activateUser(id: string, options?: FetchOptions): Promise<ApiResponse> {
    return this.post<ApiResponse>(`/api/users/${id}/activate`, {}, options);
  }

  /**
   * Deactivate user
   * @param id - User ID
   * @param options - Additional fetch options
   * @returns Promise resolving to deactivation response
   */
  async deactivateUser(
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.post<ApiResponse>(`/api/users/${id}/deactivate`, {}, options);
  }

  /**
   * Get user permissions
   * @param id - User ID
   * @param options - Additional fetch options
   * @returns Promise resolving to user permissions
   */
  async getUserPermissions(
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse<string[]>> {
    return this.get<ApiResponse<string[]>>(
      `/api/users/${id}/permissions`,
      options,
    );
  }
}

// Factory function for creating a client instance
export function createUsersApi(config?: Partial<typeof apiConfig>): UsersApi {
  return new UsersApi(config);
}

// Export default
export default UsersApi;
