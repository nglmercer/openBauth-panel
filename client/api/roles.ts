// Roles API client
import BaseApi from "../commons/BaseApi";
import apiConfig from "../config/apiConfig";
import type {
  Role,
  ApiResponse,
  PaginatedResponse,
  Permission,
} from "../types/auth";
import type { FetchOptions } from "../commons/httpservice";

/**
 * Roles API client
 * Handles all role-related operations
 */
export class RolesApi extends BaseApi {
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

  /**
   * Get role permissions
   * @param id - Role ID
   * @param options - Additional fetch options
   * @returns Promise resolving to role permissions
   */
  async getRolePermissions(
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse<Permission[]>> {
    return this.get<ApiResponse<Permission[]>>(
      `/api/roles/${id}/permissions`,
      options,
    );
  }

  /**
   * Assign permission to role
   * @param roleId - Role ID
   * @param permissionId - Permission ID
   * @param options - Additional fetch options
   * @returns Promise resolving to permission assignment response
   */
  async assignPermission(
    roleId: string,
    permissionId: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.post<ApiResponse>(
      `/api/roles/${roleId}/permissions`,
      { permissionId },
      options,
    );
  }

  /**
   * Remove permission from role
   * @param roleId - Role ID
   * @param permissionId - Permission ID
   * @param options - Additional fetch options
   * @returns Promise resolving to permission removal response
   */
  async removePermission(
    roleId: string,
    permissionId: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.delete<ApiResponse>(
      `/api/roles/${roleId}/permissions/${permissionId}`,
      options,
    );
  }

  /**
   * Get users with this role
   * @param id - Role ID
   * @param options - Additional fetch options
   * @returns Promise resolving to users with this role
   */
  async getRoleUsers(
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse<any[]>> {
    return this.get<ApiResponse<any[]>>(`/api/roles/${id}/users`, options);
  }

  /**
   * Assign multiple permissions to role
   * @param roleId - Role ID
   * @param permissionIds - Array of permission IDs
   * @param options - Additional fetch options
   * @returns Promise resolving to permissions assignment response
   */
  async assignMultiplePermissions(
    roleId: string,
    permissionIds: string[],
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.post<ApiResponse>(
      `/api/roles/${roleId}/permissions/bulk`,
      { permissionIds },
      options,
    );
  }

  /**
   * Remove multiple permissions from role
   * @param roleId - Role ID
   * @param permissionIds - Array of permission IDs
   * @param options - Additional fetch options
   * @returns Promise resolving to permissions removal response
   */
  async removeMultiplePermissions(
    roleId: string,
    permissionIds: string[],
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.delete<ApiResponse>(`/api/roles/${roleId}/permissions/bulk`, {
      body: JSON.stringify({ permissionIds }),
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Factory function for creating a client instance
export function createRolesApi(config?: Partial<typeof apiConfig>): RolesApi {
  return new RolesApi(config);
}

// Export default
export default RolesApi;
