// PostgrestQueryBuilder - Fluent query builder for Supabase-compatible API
import type { OpenBauthPanelClient } from "./OpenBauthPanelClient";
import type { ApiResponse, PaginatedResponse } from "../types/auth";
import type { FetchOptions } from "../commons/httpservice";

/**
 * PostgrestQueryBuilder - Fluent interface for building PostgREST queries
 * Provides a Supabase-compatible query builder for the openBauth-panel API
 */
export class PostgrestQueryBuilder {
  private tableName: string;
  private client: OpenBauthPanelClient;
  private queryParams: URLSearchParams;
  private selectedColumns: string[];
  private body: any | null;
  private operation: "select" | "insert" | "update" | "delete" | null;

  constructor(tableName: string, client: OpenBauthPanelClient) {
    this.tableName = tableName;
    this.client = client;
    this.queryParams = new URLSearchParams();
    this.selectedColumns = ["*"];
    this.body = null;
    this.operation = null;
  }

  /**
   * Specify columns to select
   * @param columns - Columns to select (default: "*")
   * @returns PostgrestQueryBuilder instance for chaining
   */
  select(columns: string = "*"): PostgrestQueryBuilder {
    this.operation = "select";
    this.selectedColumns = columns.split(",").map(col => col.trim());
    return this;
  }

  // Filter methods

  /**
   * Equal filter
   * @param column - Column name
   * @param value - Value to match
   * @returns PostgrestQueryBuilder instance for chaining
   */
  eq(column: string, value: any): PostgrestQueryBuilder {
    this.queryParams.set(column, `eq.${value}`);
    return this;
  }

  /**
   * Not equal filter
   * @param column - Column name
   * @param value - Value to exclude
   * @returns PostgrestQueryBuilder instance for chaining
   */
  neq(column: string, value: any): PostgrestQueryBuilder {
    this.queryParams.set(column, `neq.${value}`);
    return this;
  }

  /**
   * Greater than filter
   * @param column - Column name
   * @param value - Value to compare
   * @returns PostgrestQueryBuilder instance for chaining
   */
  gt(column: string, value: number): PostgrestQueryBuilder {
    this.queryParams.set(column, `gt.${value}`);
    return this;
  }

  /**
   * Greater than or equal filter
   * @param column - Column name
   * @param value - Value to compare
   * @returns PostgrestQueryBuilder instance for chaining
   */
  gte(column: string, value: number): PostgrestQueryBuilder {
    this.queryParams.set(column, `gte.${value}`);
    return this;
  }

  /**
   * Less than filter
   * @param column - Column name
   * @param value - Value to compare
   * @returns PostgrestQueryBuilder instance for chaining
   */
  lt(column: string, value: number): PostgrestQueryBuilder {
    this.queryParams.set(column, `lt.${value}`);
    return this;
  }

  /**
   * Less than or equal filter
   * @param column - Column name
   * @param value - Value to compare
   * @returns PostgrestQueryBuilder instance for chaining
   */
  lte(column: string, value: number): PostgrestQueryBuilder {
    this.queryParams.set(column, `lte.${value}`);
    return this;
  }

  /**
   * Like filter (case-sensitive pattern matching)
   * @param column - Column name
   * @param pattern - Pattern to match (use % as wildcard)
   * @returns PostgrestQueryBuilder instance for chaining
   */
  like(column: string, pattern: string): PostgrestQueryBuilder {
    this.queryParams.set(column, `like.${pattern}`);
    return this;
  }

  /**
   * ILIKE filter (case-insensitive pattern matching)
   * @param column - Column name
   * @param pattern - Pattern to match (use % as wildcard)
   * @returns PostgrestQueryBuilder instance for chaining
   */
  ilike(column: string, pattern: string): PostgrestQueryBuilder {
    this.queryParams.set(column, `ilike.${pattern}`);
    return this;
  }

  /**
   * IN filter (match any value in array)
   * @param column - Column name
   * @param values - Array of values
   * @returns PostgrestQueryBuilder instance for chaining
   */
  in(column: string, values: any[]): PostgrestQueryBuilder {
    const valuesStr = values.join(",");
    this.queryParams.set(column, `in.(${valuesStr})`);
    return this;
  }

  /**
   * IS filter (check for NULL or NOT NULL)
   * @param column - Column name
   * @param value - "null" or "not.null"
   * @returns PostgrestQueryBuilder instance for chaining
   */
  is(column: string, value: "null" | "not.null"): PostgrestQueryBuilder {
    this.queryParams.set(column, `is.${value}`);
    return this;
  }

  /**
   * Order results
   * @param column - Column name to order by
   * @param ascending - Whether to order ascending (default: true)
   * @returns PostgrestQueryBuilder instance for chaining
   */
  order(column: string, ascending: boolean = true): PostgrestQueryBuilder {
    const direction = ascending ? "asc" : "desc";
    this.queryParams.set("order", `${column}.${direction}`);
    return this;
  }

  /**
   * Limit number of results
   * @param count - Maximum number of results
   * @returns PostgrestQueryBuilder instance for chaining
   */
  limit(count: number): PostgrestQueryBuilder {
    this.queryParams.set("limit", count.toString());
    return this;
  }

  /**
   * Offset for pagination
   * @param count - Number of results to skip
   * @returns PostgrestQueryBuilder instance for chaining
   */
  offset(count: number): PostgrestQueryBuilder {
    this.queryParams.set("offset", count.toString());
    return this;
  }

  /**
   * Range filter (equivalent to limit + offset)
   * @param from - Start index (inclusive)
   * @param to - End index (inclusive)
   * @returns PostgrestQueryBuilder instance for chaining
   */
  range(from: number, to: number): PostgrestQueryBuilder {
    this.queryParams.set("offset", from.toString());
    this.queryParams.set("limit", (to - from + 1).toString());
    return this;
  }

  // Data modification methods

  /**
   * Insert data
   * @param data - Data to insert (single object or array)
   * @returns PostgrestQueryBuilder instance for chaining
   */
  insert(data: any | any[]): PostgrestQueryBuilder {
    this.operation = "insert";
    this.body = data;
    return this;
  }

  /**
   * Update data
   * @param data - Data to update
   * @returns PostgrestQueryBuilder instance for chaining
   */
  update(data: any): PostgrestQueryBuilder {
    this.operation = "update";
    this.body = data;
    return this;
  }

  /**
   * Delete data
   * @returns PostgrestQueryBuilder instance for chaining
   */
  delete(): PostgrestQueryBuilder {
    this.operation = "delete";
    return this;
  }

  // Execution methods

  /**
   * Execute query and return single result
   * @param options - Additional fetch options
   * @returns Promise resolving to single record
   */
  async single(options?: FetchOptions): Promise<ApiResponse> {
    try {
      this.validateOperation();
      const url = this.buildUrl();
      
      let result: ApiResponse;
      switch (this.operation) {
        case "select":
          result = await this.client.get<ApiResponse>(url, options);
          break;
        case "insert":
          result = await this.client.post<ApiResponse>(url, this.body, options);
          break;
        case "update":
          result = await this.client.put<ApiResponse>(url, this.body, options);
          break;
        case "delete":
          result = await this.client.delete<ApiResponse>(url, options);
          break;
        default:
          throw new Error("Invalid operation");
      }

      // Handle foreign key constraint violations
      if (result && typeof result === 'object' && 'error' in result) {
        result.error = this.handleForeignKeyError(result.error);
      }

      return result;
    } catch (error) {
      // Handle network or other errors
      const enhancedError = this.handleForeignKeyError(error);
      throw enhancedError;
    } finally {
      this.reset();
    }
  }

  /**
   * Execute query and return multiple results
   * @param options - Additional fetch options
   * @returns Promise resolving to array of records
   */
  async multiple(options?: FetchOptions): Promise<PaginatedResponse<any>> {
    try {
      this.validateOperation();
      const url = this.buildUrl();
      
      let result: PaginatedResponse<any>;
      switch (this.operation) {
        case "select":
          result = await this.client.get<PaginatedResponse<any>>(url, options);
          break;
        case "insert":
          result = await this.client.post<PaginatedResponse<any>>(url, this.body, options);
          break;
        case "update":
          result = await this.client.put<PaginatedResponse<any>>(url, this.body, options);
          break;
        case "delete":
          result = await this.client.delete<PaginatedResponse<any>>(url, options);
          break;
        default:
          throw new Error("Invalid operation");
      }

      // Handle foreign key constraint violations
      if (result && typeof result === 'object' && 'error' in result) {
        result.error = this.handleForeignKeyError(result.error);
      }

      return result;
    } catch (error) {
      // Handle network or other errors
      const enhancedError = this.handleForeignKeyError(error);
      throw enhancedError;
    } finally {
      this.reset();
    }
  }

  /**
   * Build the final URL with query parameters
   * @returns Complete URL string
   */
  private buildUrl(): string {
    let baseUrl = `/rest/v1/${this.tableName}`;

    // Special handling for DELETE and UPDATE operations with ID filter
    // This converts PostgREST-style filters to REST-style URLs
    if (this.operation === "delete" || this.operation === "update") {
      const idFilter = this.queryParams.get("id");
      if (idFilter && idFilter.startsWith("eq.")) {
        const id = idFilter.substring(3);
        baseUrl = `${baseUrl}/${id}`;
        this.queryParams.delete("id");
      }
    }

    const queryString = this.queryParams.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * Enhanced error handling for foreign key constraint violations
   * @param error - The error object
   * @returns Enhanced error with helpful message
   */
  private handleForeignKeyError(error: any): any {
    if (error?.message?.includes('Foreign key constraint') ||
        error?.error?.includes('Foreign key constraint') ||
        error?.details?.includes('foreign key')) {
      
      const tableName = this.tableName;
      const suggestions = this.getCascadeSuggestions(tableName);
      
      return {
        ...error,
        message: `Cannot delete ${tableName} because it has related records in other tables.`,
        suggestion: `Try deleting related records first: ${suggestions.join(', ')}`,
        code: 'FOREIGN_KEY_VIOLATION',
        help: 'Use cascade delete or remove dependencies manually'
      };
    }
    return error;
  }

  /**
   * Get cascade deletion suggestions for a table
   * @param tableName - Name of the table
   * @returns Array of related table names
   */
  private getCascadeSuggestions(tableName: string): string[] {
    const commonRelations: Record<string, string[]> = {
      'users': ['user_roles', 'sessions', 'refresh_tokens', 'user_devices', 'mfa_configurations'],
      'roles': ['user_roles', 'role_permissions'],
      'permissions': ['role_permissions'],
      'posts': ['comments', 'post_tags'],
      'categories': ['posts']
    };
    
    return commonRelations[tableName] || ['related_records'];
  }

  /**
   * Validate operation parameters before execution
   * @throws Error if validation fails
   */
  private validateOperation(): void {
    if (!this.operation) {
      throw new Error('No operation specified. Use select(), insert(), update(), or delete()');
    }

    if ((this.operation === 'update' || this.operation === 'delete') && !this.hasIdFilter()) {
      console.warn(`${this.operation.toUpperCase()} operation without ID filter may affect multiple records`);
    }

    if (this.operation === 'insert' && !this.body) {
      throw new Error('Insert operation requires data');
    }

    if ((this.operation === 'update' || this.operation === 'insert') && !this.body) {
      throw new Error(`${this.operation} operation requires data`);
    }
  }

  /**
   * Check if there's an ID filter for safe operations
   * @returns true if ID filter exists
   */
  private hasIdFilter(): boolean {
    const idFilter = this.queryParams.get("id");
    return !!(idFilter && idFilter.startsWith("eq."));
  }

  /**
   * Perform cascade delete for users table
   * @param userId - User ID to cascade delete
   * @returns Promise with cascade results
   */
  async cascadeDelete(userId: string): Promise<{ success: boolean; results: any[]; error?: string }> {
    if (this.tableName !== 'users') {
      throw new Error('Cascade delete is only supported for users table');
    }

    const results: any[] = [];
    const relatedTables = ['user_roles', 'sessions', 'refresh_tokens', 'user_devices', 'mfa_configurations'];
    
    try {
      // Delete from related tables first
      for (const table of relatedTables) {
        try {
          const result = await this.client.delete<PaginatedResponse<any>>(`/rest/v1/${table}?user_id=eq.${userId}`);
          results.push({ table, success: true, deleted: result.data?.items?.length || 0 });
        } catch (error) {
          results.push({ table, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      // Finally delete the user
      const userResult = await this.client.delete<ApiResponse>(`/rest/v1/users/${userId}`);
      results.push({ table: 'users', success: true, data: userResult });

      return { success: true, results };
    } catch (error) {
      return {
        success: false,
        results,
        error: error instanceof Error ? error.message : 'Cascade delete failed'
      };
    }
  }

  /**
   * Safe delete with automatic cascade for users
   * @returns Promise with delete result
   */
  async safeDelete(): Promise<ApiResponse> {
    if (this.tableName !== 'users' || !this.hasIdFilter()) {
      return this.single();
    }

    const userId = this.queryParams.get("id")!.substring(3);
    
    try {
      // Try normal delete first
      const result = await this.single();
      
      if (result && typeof result === 'object' && 'error' in result &&
          result.error && typeof result.error === 'object' && 'message' in result.error &&
          (result.error as any).message?.includes('Foreign key constraint')) {
        
        // If foreign key error, try cascade delete
        console.log('Attempting cascade delete for user:', userId);
        const cascadeResult = await this.cascadeDelete(userId);
        
        if (cascadeResult.success) {
          return { success: true, message: 'User and related records deleted successfully' };
        } else {
          throw new Error(`Cascade delete failed: ${cascadeResult.error}`);
        }
      }
      
      return result;
    } catch (error) {
      throw this.handleForeignKeyError(error);
    }
  }

  /**
   * Reset the query builder state
   */
  private reset(): void {
    this.queryParams = new URLSearchParams();
    this.selectedColumns = ["*"];
    this.body = null;
    this.operation = null;
  }
}