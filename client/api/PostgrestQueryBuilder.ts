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
    if (!this.operation) {
      this.operation = "select";
    }

    const url = this.buildUrl();
    
    try {
      switch (this.operation) {
        case "select":
          return await this.client.get<ApiResponse>(url, options);
        case "insert":
          return await this.client.post<ApiResponse>(url, this.body, options);
        case "update":
          return await this.client.put<ApiResponse>(url, this.body, options);
        case "delete":
          return await this.client.delete<ApiResponse>(url, options);
        default:
          throw new Error("Invalid operation");
      }
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
    if (!this.operation) {
      this.operation = "select";
    }

    const url = this.buildUrl();
    
    try {
      switch (this.operation) {
        case "select":
          return await this.client.get<PaginatedResponse<any>>(url, options);
        case "insert":
          return await this.client.post<PaginatedResponse<any>>(url, this.body, options);
        case "update":
          return await this.client.put<PaginatedResponse<any>>(url, this.body, options);
        case "delete":
          return await this.client.delete<PaginatedResponse<any>>(url, options);
        default:
          throw new Error("Invalid operation");
      }
    } finally {
      this.reset();
    }
  }

  /**
   * Build the final URL with query parameters
   * @returns Complete URL string
   */
  private buildUrl(): string {
    const baseUrl = `/rest/v1/${this.tableName}`;
    const queryString = this.queryParams.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
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