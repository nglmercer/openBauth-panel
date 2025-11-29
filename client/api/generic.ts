// Generic API client for dynamic tables
import BaseApi from "../commons/BaseApi";
import apiConfig from "../config/apiConfig";
import type { ApiResponse, PaginatedResponse } from "../types/auth";
import type { FetchOptions } from "../commons/httpservice";

/**
 * Generic API client for dynamic table operations
 * Provides CRUD operations for any table in the database
 */
export class GenericApi extends BaseApi {
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

  // Table operations

  /**
   * Get list of available tables
   * @param options - Additional fetch options
   * @returns Promise resolving to tables list
   */
  async getTables(options?: FetchOptions): Promise<ApiResponse> {
    return this.get<ApiResponse>("/api/tables", options);
  }

  /**
   * Get schema information for all tables
   * @param options - Additional fetch options
   * @returns Promise resolving to schemas
   */
  async getSchemas(options?: FetchOptions): Promise<ApiResponse> {
    return this.get<ApiResponse>("/api/schemas", options);
  }

  /**
   * Get schema for a specific table
   * @param tableName - Name of the table
   * @param options - Additional fetch options
   * @returns Promise resolving to table schema
   */
  async getTableSchema(
    tableName: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.get<ApiResponse>(`/api/schema/${tableName}`, options);
  }

  /**
   * Get related data for a specific record
   * @param tableName - Name of the table
   * @param id - Record ID
   * @param relation - Relation name
   * @param options - Additional fetch options
   * @returns Promise resolving to related data
   */
  async getRelatedData(
    tableName: string,
    id: string,
    relation: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.get<ApiResponse>(
      `/api/${tableName}/${id}/related/${relation}`,
      options,
    );
  }

  // CRUD operations for any table

  /**
   * Get all records from a table
   * @param tableName - Name of the table
   * @param options - Additional fetch options
   * @returns Promise resolving to records
   */
  async getRecords(
    tableName: string,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.get<ApiResponse>(`/api/${tableName}`, options);
  }

  /**
   * Create a new record in a table
   * @param tableName - Name of table
   * @param data - Record data
   * @param options - Additional fetch options
   * @returns Promise resolving to created record
   */
  async updateRecord(
    tableName: string,
    id: string,
    data: any,
    options?: FetchOptions,
  ): Promise<ApiResponse<any>> {
    return this.put<ApiResponse<any>>(`/api/${tableName}/${id}`, data, options);
  }

  /**
   * Update a record in a table
   * @param tableName - Name of table
   * @param id - Record ID
   * @param data - Updated record data
   * @param options - Additional fetch options
   * @returns Promise resolving to updated record
   */
  async getRecord(
    tableName: string,
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse<any>> {
    return this.get<ApiResponse<any>>(`/api/${tableName}/${id}`, options);
  }

  /**
   * Update a record in a table
   * @param tableName - Name of table
   * @param id - Record ID
   * @param data - Updated record data
   * @param options - Additional fetch options
   * @returns Promise resolving to updated record
   */

  /**
   * Delete a record from a table
   * @param tableName - Name of the table
   * @param id - Record ID
   * @param options - Additional fetch options
   * @returns Promise resolving to delete response
   */
  async deleteRecord(
    tableName: string,
    id: string,
    options?: FetchOptions,
  ): Promise<ApiResponse<any>> {
    return this.delete<ApiResponse<any>>(`/api/${tableName}/${id}`, options);
  }

  /**
   * Get records with pagination
   * @param tableName - Name of the table
   * @param params - Pagination parameters
   * @param options - Additional fetch options
   * @returns Promise resolving to paginated records
   */
  async getPaginatedRecords(
    tableName: string,
    params: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: "ASC" | "DESC";
    } = {},
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();

    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.offset) queryParams.append("offset", params.offset.toString());
    if (params.orderBy) queryParams.append("orderBy", params.orderBy);
    if (params.orderDirection)
      queryParams.append("orderDirection", params.orderDirection);

    const queryString = queryParams.toString();
    const url = queryString
      ? `/api/${tableName}?${queryString}`
      : `/api/${tableName}`;

    return this.get<ApiResponse>(url, options);
  }

  /**
   * Search records in a table
   * @param tableName - Name of the table
   * @param searchTerm - Search term
   * @param searchFields - Fields to search in (optional)
   * @param options - Additional fetch options
   * @returns Promise resolving to search results
   */
  async searchRecords(
    tableName: string,
    searchTerm: string,
    searchFields?: string[],
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append("search", searchTerm);

    if (searchFields && searchFields.length > 0) {
      queryParams.append("fields", searchFields.join(","));
    }

    return this.get<ApiResponse>(
      `/api/${tableName}?${queryParams.toString()}`,
      options,
    );
  }

  /**
   * Bulk create records in a table
   * @param tableName - Name of the table
   * @param records - Array of records to create
   * @param options - Additional fetch options
   * @returns Promise resolving to created records
   */
  async bulkCreate(
    tableName: string,
    records: any[],
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.post<ApiResponse>(
      `/api/${tableName}/bulk`,
      { records },
      options,
    );
  }

  /**
   * Bulk update records from a table
   * @param tableName - Name of the table
   * @param updates - Array of update objects with id and data
   * @param options - Additional fetch options
   * @returns Promise resolving to updated records
   */
  async bulkUpdate(
    tableName: string,
    updates: Array<{ id: string; data: any }>,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.put<ApiResponse>(
      `/api/${tableName}/bulk`,
      { updates },
      options,
    );
  }

  /**
   * Bulk delete records from a table
   * @param tableName - Name of the table
   * @param ids - Array of record IDs to delete
   * @param options - Additional fetch options
   * @returns Promise resolving to delete response
   */
  async bulkDelete(
    tableName: string,
    ids: string[],
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    return this.delete<ApiResponse>(`/api/${tableName}/bulk`, {
      body: JSON.stringify({ ids }),
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Get records with filters
   * @param tableName - Name of the table
   * @param filters - Key-value pairs to filter records by
   * @param options - Additional fetch options
   * @returns Promise resolving to filtered records
   */
  async getFilteredRecords(
    tableName: string,
    filters: Record<string, any>,
    options?: FetchOptions,
  ): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const queryString = queryParams.toString();
    const url = queryString
      ? `/api/${tableName}?${queryString}`
      : `/api/${tableName}`;

    return this.get<ApiResponse>(url, options);
  }
}

// Factory function for creating a client instance
export function createGenericApi(
  config?: Partial<typeof apiConfig>,
): GenericApi {
  return new GenericApi(config);
}

// Export default
export default GenericApi;
