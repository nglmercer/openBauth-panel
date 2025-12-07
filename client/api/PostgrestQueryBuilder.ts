// PostgrestQueryBuilder - Provides Supabase-like query building capabilities
import BaseApi from "../commons/BaseApi";
import type { FetchOptions } from "../commons/httpservice";
import type { ApiResponse } from "../types/auth";

/**
 * Query builder for Postgrest-compatible API operations
 * Provides a fluent interface for building queries similar to Supabase
 */
export class PostgrestQueryBuilder {
  private tableName: string;
  private client: BaseApi;
  private queryParams: Map<string, string>;
  private selectColumns: string[];
  private body: any;

  constructor(tableName: string, client: BaseApi) {
    this.tableName = tableName;
    this.client = client;
    this.queryParams = new Map();
    this.selectColumns = [];
    this.body = null;
  }

  /**
   * Specify which columns to select
   * @param columns - Column names to select (default: '*')
   * @returns This query builder for chaining
   */
  select(columns: string = '*'): PostgrestQueryBuilder {
    this.selectColumns = columns === '*' ? ['*'] : columns.split(',').map(col => col.trim());
    return this;
  }

  /**
   * Add an equality filter
   * @param column - Column name
   * @param value - Value to match
   * @returns This query builder for chaining
   */
  eq(column: string, value: any): PostgrestQueryBuilder {
    this.queryParams.set(column, `eq.${value}`);
    return this;
  }

  /**
   * Add a not-equal filter
   * @param column - Column name
   * @param value - Value to not match
   * @returns This query builder for chaining
   */
  neq(column: string, value: any): PostgrestQueryBuilder {
    this.queryParams.set(column, `neq.${value}`);
    return this;
  }

  /**
   * Add a greater-than filter
   * @param column - Column name
   * @param value - Value to be greater than
   * @returns This query builder for chaining
   */
  gt(column: string, value: any): PostgrestQueryBuilder {
    this.queryParams.set(column, `gt.${value}`);
    return this;
  }

  /**
   * Add a greater-than-or-equal filter
   * @param column - Column name
   * @param value - Value to be greater than or equal to
   * @returns This query builder for chaining
   */
  gte(column: string, value: any): PostgrestQueryBuilder {
    this.queryParams.set(column, `gte.${value}`);
    return this;
  }

  /**
   * Add a less-than filter
   * @param column - Column name
   * @param value - Value to be less than
   * @returns This query builder for chaining
   */
  lt(column: string, value: any): PostgrestQueryBuilder {
    this.queryParams.set(column, `lt.${value}`);
    return this;
  }

  /**
   * Add a less-than-or-equal filter
   * @param column - Column name
   * @param value - Value to be less than or equal to
   * @returns This query builder for chaining
   */
  lte(column: string, value: any): PostgrestQueryBuilder {
    this.queryParams.set(column, `lte.${value}`);
    return this;
  }

  /**
   * Add a like filter (pattern matching)
   * @param column - Column name
   * @param pattern - Pattern to match (use % as wildcard)
   * @returns This query builder for chaining
   */
  like(column: string, pattern: string): PostgrestQueryBuilder {
    this.queryParams.set(column, `like.${pattern}`);
    return this;
  }

  /**
   * Add an ILIKE filter (case-insensitive pattern matching)
   * @param column - Column name
   * @param pattern - Pattern to match (use % as wildcard)
   * @returns This query builder for chaining
   */
  ilike(column: string, pattern: string): PostgrestQueryBuilder {
    this.queryParams.set(column, `ilike.${pattern}`);
    return this;
  }

  /**
   * Add an IN filter
   * @param column - Column name
   * @param values - Array of values
   * @returns This query builder for chaining
   */
  in(column: string, values: any[]): PostgrestQueryBuilder {
    this.queryParams.set(column, `in.(${values.join(',')})`);
    return this;
  }

  /**
   * Add an IS NULL filter
   * @param column - Column name
   * @returns This query builder for chaining
   */
  is(column: string, value: 'null' | 'not.null'): PostgrestQueryBuilder {
    this.queryParams.set(column, `is.${value}`);
    return this;
  }

  /**
   * Add ordering
   * @param column - Column name to order by
   * @param ascending - Whether to order ascending (default: true)
   * @param nullsFirst - Whether to put nulls first (default: false)
   * @returns This query builder for chaining
   */
  order(column: string, ascending: boolean = true, nullsFirst: boolean = false): PostgrestQueryBuilder {
    const direction = ascending ? 'asc' : 'desc';
    const nulls = nullsFirst ? 'nullsfirst' : 'nullslast';
    this.queryParams.set('order', `${column}.${direction}.${nulls}`);
    return this;
  }

  /**
   * Limit the number of results
   * @param count - Maximum number of results
   * @returns This query builder for chaining
   */
  limit(count: number): PostgrestQueryBuilder {
    this.queryParams.set('limit', count.toString());
    return this;
  }

  /**
   * Set the offset for pagination
   * @param count - Number of results to skip
   * @returns This query builder for chaining
   */
  range(from: number, to: number): PostgrestQueryBuilder {
    this.queryParams.set('offset', from.toString());
    this.queryParams.set('limit', (to - from + 1).toString());
    return this;
  }

  /**
   * Set data for insert/update operations
   * @param data - Data to insert or update
   * @returns This query builder for chaining
   */
  setData(data: any): PostgrestQueryBuilder {
    this.body = data;
    return this;
  }

  /**
   * Execute the query and return a single result
   * @param options - Additional fetch options
   * @returns Promise resolving to the result
   */
  async single(options?: FetchOptions): Promise<ApiResponse> {
    const url = this.buildUrl();
    const fetchOptions = { ...options };
    
    // Add select parameter if specified
    if (this.selectColumns.length > 0) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Prefer': this.selectColumns.join(',')
      };
    }

    return this.client.get<ApiResponse>(url, fetchOptions);
  }

  /**
   * Execute the query and return multiple results
   * @param options - Additional fetch options
   * @returns Promise resolving to the results
   */
  async multiple(options?: FetchOptions): Promise<ApiResponse> {
    return this.single(options);
  }

  /**
   * Execute an insert operation
   * @param data - Data to insert (optional if already set with setData)
   * @param options - Additional fetch options
   * @returns Promise resolving to the inserted record
   */
  async insert(data?: any, options?: FetchOptions): Promise<ApiResponse> {
    const insertData = data || this.body;
    if (!insertData) {
      throw new Error('No data provided for insert operation');
    }

    const url = `/rest/v1/${this.tableName}`;
    return this.client.post<ApiResponse>(url, insertData, options);
  }

  /**
   * Execute an update operation
   * @param data - Data to update (optional if already set with setData)
   * @param options - Additional fetch options
   * @returns Promise resolving to the updated records
   */
  async update(data?: any, options?: FetchOptions): Promise<ApiResponse> {
    const updateData = data || this.body;
    if (!updateData) {
      throw new Error('No data provided for update operation');
    }

    const url = this.buildUrl();
    return this.client.patch<ApiResponse>(url, updateData, options);
  }

  /**
   * Execute a delete operation
   * @param options - Additional fetch options
   * @returns Promise resolving to the delete response
   */
  async delete(options?: FetchOptions): Promise<ApiResponse> {
    const url = this.buildUrl();
    return this.client.delete<ApiResponse>(url, options);
  }

  /**
   * Build the URL with query parameters
   * @returns The constructed URL
   */
  private buildUrl(): string {
    let url = `/rest/v1/${this.tableName}`;
    
    const params: string[] = [];
    this.queryParams.forEach((value, key) => {
      params.push(`${key}=${encodeURIComponent(value)}`);
    });

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return url;
  }
}

// Factory function for creating a query builder
export function createQueryBuilder(
  tableName: string,
  client: BaseApi
): PostgrestQueryBuilder {
  return new PostgrestQueryBuilder(tableName, client);
}

// Export default
export default PostgrestQueryBuilder;