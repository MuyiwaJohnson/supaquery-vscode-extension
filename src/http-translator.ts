import { SupabaseQueryParser } from './parser';

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  fullPath: string;
  params: Map<string, string>;
  headers: Map<string, string>;
  body?: any;
}

export interface HttpTranslationResult {
  original: string;
  sql?: string;
  http?: HttpRequest;
  error?: string;
  warnings?: string[];
}

export class HttpTranslator {
  private parser: SupabaseQueryParser;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:54321/rest/v1') {
    this.parser = new SupabaseQueryParser();
    this.baseUrl = baseUrl;
  }

  /**
   * Translate Supabase JS query directly to HTTP request
   */
  async translateToHttp(supabaseQuery: string): Promise<HttpTranslationResult> {
    try {
      // Check for RPC calls first - handle different RPC patterns
      if (supabaseQuery.includes('.rpc(') || 
          supabaseQuery.includes('rpc(') || 
          supabaseQuery.includes('supabase.rpc(')) {
        return {
          original: supabaseQuery,
          error: 'RPC calls are not supported for HTTP conversion'
        };
      }

      const result = this.parser.parseComplexQuery(supabaseQuery);
      
      if (result.error || !result.sql) {
        return {
          original: supabaseQuery,
          error: result.error,
          warnings: result.warnings
        };
      }

      // Check if the generated SQL contains RPC patterns
      if (result.sql.includes('RPC') || result.sql.includes('rpc')) {
        return {
          original: supabaseQuery,
          sql: result.sql,
          error: 'RPC calls are not supported for HTTP conversion'
        };
      }

      // Parse the SQL to determine the operation type
      const httpRequest = this.sqlToHttpRequest(result.sql, supabaseQuery);
      
      return {
        original: supabaseQuery,
        sql: result.sql,
        http: httpRequest,
        warnings: result.warnings
      };
    } catch (error) {
      return {
        original: supabaseQuery,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert SQL to HTTP request
   */
  private sqlToHttpRequest(sql: string, originalQuery: string): HttpRequest {
    const sqlUpper = sql.toUpperCase();
    
    if (sqlUpper.startsWith('SELECT')) {
      return this.parseSelectRequest(sql, originalQuery);
    } else if (sqlUpper.startsWith('INSERT')) {
      return this.parseInsertRequest(sql, originalQuery);
    } else if (sqlUpper.startsWith('UPDATE')) {
      return this.parseUpdateRequest(sql, originalQuery);
    } else if (sqlUpper.startsWith('DELETE')) {
      return this.parseDeleteRequest(sql, originalQuery);
    } else if (sqlUpper.startsWith('SELECT') && sqlUpper.includes('RPC')) {
      // RPC calls are not supported for HTTP conversion
      throw new Error('RPC calls are not supported for HTTP conversion');
    } else {
      throw new Error(`Unsupported SQL operation: ${sql.split(' ')[0]}`);
    }
  }

  /**
   * Parse SELECT SQL to GET request
   */
  private parseSelectRequest(sql: string, originalQuery: string): HttpRequest {
    const params = new Map<string, string>();
    const headers = new Map<string, string>();
    
    // Extract table name
    const fromMatch = sql.match(/FROM\s+([^\s]+)/i);
    const tableName = fromMatch ? fromMatch[1].replace(/['"]/g, '') : 'unknown';
    
    // Extract columns
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
      const columns = selectMatch[1].trim();
      if (columns !== '*') {
        // Remove spaces around commas for PostgREST format
        const formattedColumns = columns.replace(/\s*,\s*/g, ',');
        params.set('select', formattedColumns);
      }
    }
    
    // Extract WHERE conditions
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+HAVING|\s+LIMIT|\s+OFFSET|$)/i);
    if (whereMatch) {
      this.parseWhereConditions(whereMatch[1], params);
    }
    
    // Extract ORDER BY
    const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|\s+OFFSET|$)/i);
    if (orderMatch) {
      const orderClause = orderMatch[1].trim();
      params.set('order', this.formatOrderBy(orderClause));
    }
    
    // Extract LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      params.set('limit', limitMatch[1]);
    }
    
    // Extract OFFSET
    const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
    if (offsetMatch) {
      params.set('offset', offsetMatch[1]);
    }
    
    // Build query string
    const queryString = Array.from(params.entries())
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const fullPath = queryString ? `${this.baseUrl}/${tableName}?${queryString}` : `${this.baseUrl}/${tableName}`;
    
    return {
      method: 'GET',
      path: `/${tableName}`,
      fullPath,
      params,
      headers
    };
  }

  /**
   * Parse INSERT SQL to POST request
   */
  private parseInsertRequest(sql: string, originalQuery: string): HttpRequest {
    const params = new Map<string, string>();
    const headers = new Map<string, string>();
    
    // Extract table name
    const intoMatch = sql.match(/INSERT\s+INTO\s+([^\s]+)/i);
    const tableName = intoMatch ? intoMatch[1].replace(/['"]/g, '') : 'unknown';
    
    // Try to extract from the original Supabase query for better accuracy
    const body = this.extractInsertBodyFromOriginalQuery(originalQuery);
    
    // Extract RETURNING clause from original query for better accuracy
    const returningColumns = this.extractReturningFromOriginalQuery(originalQuery);
    if (returningColumns) {
      params.set('select', returningColumns);
    } else {
      // Fallback to SQL parsing
      const returningMatch = sql.match(/RETURNING\s+(.+?)$/i);
      if (returningMatch) {
        const returningColumns = returningMatch[1].trim();
        if (returningColumns !== '*') {
          // Remove spaces around commas for PostgREST format
          const formattedColumns = returningColumns.replace(/\s*,\s*/g, ',');
          params.set('select', formattedColumns);
        }
      }
    }
    
    return {
      method: 'POST',
      path: `/${tableName}`,
      fullPath: `${this.baseUrl}/${tableName}`,
      params,
      headers,
      body
    };
  }

  /**
   * Extract insert body from original Supabase query
   */
  private extractInsertBodyFromOriginalQuery(originalQuery: string): any {
    // Look for insert({...}) pattern
    const insertMatch = originalQuery.match(/\.insert\s*\(\s*({[^}]+})\s*\)/i);
    if (insertMatch) {
      try {
        // Try to parse as JSON
        const jsonStr = insertMatch[1].replace(/(\w+):/g, '"$1":'); // Convert keys to quoted
        return JSON.parse(jsonStr);
      } catch (error) {
        // Fallback: extract key-value pairs manually
        const body: any = {};
        const keyValueMatches = insertMatch[1].matchAll(/(\w+):\s*([^,}]+)/g);
        for (const match of keyValueMatches) {
          const key = match[1];
          let value = match[2].trim();
          
          // Remove quotes if present
          if ((value.startsWith("'") && value.endsWith("'")) || 
              (value.startsWith('"') && value.endsWith('"'))) {
            value = value.slice(1, -1);
          }
          
          body[key] = this.parseValue(value);
        }
        return body;
      }
    }
    
    return {};
  }

  /**
   * Parse UPDATE SQL to PATCH request
   */
  private parseUpdateRequest(sql: string, originalQuery: string): HttpRequest {
    const params = new Map<string, string>();
    const headers = new Map<string, string>();
    
    // Extract table name
    const updateMatch = sql.match(/UPDATE\s+([^\s]+)/i);
    const tableName = updateMatch ? updateMatch[1].replace(/['"]/g, '') : 'unknown';
    
    // Try to extract from the original Supabase query for better accuracy
    const body = this.extractUpdateBodyFromOriginalQuery(originalQuery);
    
    // Extract WHERE conditions from original query for better accuracy
    const originalWhereParams = this.extractWhereConditionsFromOriginalQuery(originalQuery);
    originalWhereParams.forEach((value, key) => {
      params.set(key, value);
    });
    
    // Also try to parse from SQL as fallback
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+RETURNING|$)/i);
    if (whereMatch && params.size === 0) {
      this.parseWhereConditions(whereMatch[1], params);
    }
    
    // Extract RETURNING clause from original query for better accuracy
    const returningColumns = this.extractReturningFromOriginalQuery(originalQuery);
    if (returningColumns) {
      params.set('select', returningColumns);
    } else {
      // Fallback to SQL parsing
      const returningMatch = sql.match(/RETURNING\s+(.+?)$/i);
      if (returningMatch) {
        const returningColumns = returningMatch[1].trim();
        if (returningColumns !== '*') {
          // Remove spaces around commas for PostgREST format
          const formattedColumns = returningColumns.replace(/\s*,\s*/g, ',');
          params.set('select', formattedColumns);
        }
      }
    }
    
    // Build query string for WHERE conditions
    const queryString = Array.from(params.entries())
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const fullPath = queryString ? `${this.baseUrl}/${tableName}?${queryString}` : `${this.baseUrl}/${tableName}`;
    
    return {
      method: 'PATCH',
      path: `/${tableName}`,
      fullPath,
      params,
      headers,
      body
    };
  }

  /**
   * Extract update body from original Supabase query
   */
  private extractUpdateBodyFromOriginalQuery(originalQuery: string): any {
    // Look for update({...}) pattern
    const updateMatch = originalQuery.match(/\.update\s*\(\s*({[^}]+})\s*\)/i);
    if (updateMatch) {
      try {
        // Try to parse as JSON
        const jsonStr = updateMatch[1].replace(/(\w+):/g, '"$1":'); // Convert keys to quoted
        return JSON.parse(jsonStr);
      } catch (error) {
        // Fallback: extract key-value pairs manually
        const body: any = {};
        const keyValueMatches = updateMatch[1].matchAll(/(\w+):\s*([^,}]+)/g);
        for (const match of keyValueMatches) {
          const key = match[1];
          let value = match[2].trim();
          
          // Remove quotes if present
          if ((value.startsWith("'") && value.endsWith("'")) || 
              (value.startsWith('"') && value.endsWith('"'))) {
            value = value.slice(1, -1);
          }
          
          body[key] = this.parseValue(value);
        }
        return body;
      }
    }
    
    return {};
  }

  /**
   * Parse DELETE SQL to DELETE request
   */
  private parseDeleteRequest(sql: string, originalQuery: string): HttpRequest {
    const params = new Map<string, string>();
    const headers = new Map<string, string>();
    
    // Extract table name
    const fromMatch = sql.match(/FROM\s+([^\s]+)/i);
    const tableName = fromMatch ? fromMatch[1].replace(/['"]/g, '') : 'unknown';
    
    // Extract WHERE conditions from original query for better accuracy
    const originalWhereParams = this.extractWhereConditionsFromOriginalQuery(originalQuery);
    originalWhereParams.forEach((value, key) => {
      params.set(key, value);
    });
    
    // Also try to parse from SQL as fallback
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+RETURNING|$)/i);
    if (whereMatch && params.size === 0) {
      this.parseWhereConditions(whereMatch[1], params);
    }
    
    // Extract RETURNING clause from original query for better accuracy
    const returningColumns = this.extractReturningFromOriginalQuery(originalQuery);
    if (returningColumns) {
      params.set('select', returningColumns);
    } else {
      // Fallback to SQL parsing
      const returningMatch = sql.match(/RETURNING\s+(.+?)$/i);
      if (returningMatch) {
        const returningColumns = returningMatch[1].trim();
        if (returningColumns !== '*') {
          // Remove spaces around commas for PostgREST format
          const formattedColumns = returningColumns.replace(/\s*,\s*/g, ',');
          params.set('select', formattedColumns);
        }
      }
    }
    
    // Build query string
    const queryString = Array.from(params.entries())
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const fullPath = queryString ? `${this.baseUrl}/${tableName}?${queryString}` : `${this.baseUrl}/${tableName}`;
    
    return {
      method: 'DELETE',
      path: `/${tableName}`,
      fullPath,
      params,
      headers
    };
  }

  /**
   * Parse WHERE conditions into PostgREST format
   */
  private parseWhereConditions(whereClause: string, params: Map<string, string>): void {
    // Split by AND/OR
    const conditions = whereClause.split(/\s+(?:AND|OR)\s+/i);
    
    conditions.forEach(condition => {
      condition = condition.trim();
      
      // Handle different operators
      if (condition.includes('=')) {
        const [column, value] = condition.split('=').map(part => part.trim());
        const cleanColumn = column.replace(/['"]/g, '');
        const cleanValue = value.replace(/['"]/g, '');
        params.set(cleanColumn, `eq.${cleanValue}`);
      } else if (condition.includes('!=')) {
        const [column, value] = condition.split('!=').map(part => part.trim());
        const cleanColumn = column.replace(/['"]/g, '');
        const cleanValue = value.replace(/['"]/g, '');
        params.set(cleanColumn, `neq.${cleanValue}`);
      } else if (condition.includes('>')) {
        const [column, value] = condition.split('>').map(part => part.trim());
        const cleanColumn = column.replace(/['"]/g, '');
        const cleanValue = value.replace(/['"]/g, '');
        params.set(cleanColumn, `gt.${cleanValue}`);
      } else if (condition.includes('<')) {
        const [column, value] = condition.split('<').map(part => part.trim());
        const cleanColumn = column.replace(/['"]/g, '');
        const cleanValue = value.replace(/['"]/g, '');
        params.set(cleanColumn, `lt.${cleanValue}`);
      } else if (condition.includes('>=')) {
        const [column, value] = condition.split('>=').map(part => part.trim());
        const cleanColumn = column.replace(/['"]/g, '');
        const cleanValue = value.replace(/['"]/g, '');
        params.set(cleanColumn, `gte.${cleanValue}`);
      } else if (condition.includes('<=')) {
        const [column, value] = condition.split('<=').map(part => part.trim());
        const cleanColumn = column.replace(/['"]/g, '');
        const cleanValue = value.replace(/['"]/g, '');
        params.set(cleanColumn, `lte.${cleanValue}`);
      } else if (condition.includes('LIKE')) {
        const [column, value] = condition.split(/\s+LIKE\s+/i).map(part => part.trim());
        const cleanColumn = column.replace(/['"]/g, '');
        const cleanValue = value.replace(/['"]/g, '');
        params.set(cleanColumn, `like.${cleanValue}`);
      } else if (condition.includes('ILIKE')) {
        const [column, value] = condition.split(/\s+ILIKE\s+/i).map(part => part.trim());
        const cleanColumn = column.replace(/['"]/g, '');
        const cleanValue = value.replace(/['"]/g, '');
        params.set(cleanColumn, `ilike.${cleanValue}`);
      } else if (condition.includes('IN')) {
        const inMatch = condition.match(/([^\s]+)\s+IN\s*\(([^)]+)\)/i);
        if (inMatch) {
          const column = inMatch[1].replace(/['"]/g, '');
          const values = inMatch[2].split(',').map(v => v.trim().replace(/['"]/g, '')).join(',');
          params.set(column, `in.(${values})`);
        }
      }
    });
  }

  /**
   * Extract WHERE conditions from original Supabase query for better accuracy
   */
  private extractWhereConditionsFromOriginalQuery(originalQuery: string): Map<string, string> {
    const params = new Map<string, string>();
    
    // Look for common filter patterns
    const eqMatch = originalQuery.match(/\.eq\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]?([^'"`,\s)]+)['"`]?\s*\)/i);
    if (eqMatch) {
      params.set(eqMatch[1], `eq.${eqMatch[2]}`);
    }
    
    const gtMatch = originalQuery.match(/\.gt\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]?([^'"`,\s)]+)['"`]?\s*\)/i);
    if (gtMatch) {
      params.set(gtMatch[1], `gt.${gtMatch[2]}`);
    }
    
    const ltMatch = originalQuery.match(/\.lt\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]?([^'"`,\s)]+)['"`]?\s*\)/i);
    if (ltMatch) {
      params.set(ltMatch[1], `lt.${ltMatch[2]}`);
    }
    
    return params;
  }

  /**
   * Extract RETURNING clause from original Supabase query
   */
  private extractReturningFromOriginalQuery(originalQuery: string): string | undefined {
    // Look for .select() pattern
    const selectMatch = originalQuery.match(/\.select\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/i);
    if (selectMatch) {
      return selectMatch[1].replace(/\s*,\s*/g, ',');
    }
    return undefined;
  }

  /**
   * Format ORDER BY clause for PostgREST
   */
  private formatOrderBy(orderClause: string): string {
    return orderClause
      .split(',')
      .map(part => {
        const trimmed = part.trim();
        if (trimmed.toUpperCase().includes('DESC')) {
          const column = trimmed.replace(/\s+DESC.*/i, '').replace(/['"]/g, '');
          return `${column}.desc`;
        } else if (trimmed.toUpperCase().includes('ASC')) {
          const column = trimmed.replace(/\s+ASC.*/i, '').replace(/['"]/g, '');
          return `${column}.asc`;
        } else {
          // Default to ascending if no direction specified
          const column = trimmed.replace(/['"]/g, '');
          return `${column}.asc`;
        }
      })
      .join(',');
  }

  /**
   * Parse SQL value to JavaScript value
   */
  private parseValue(value: string): any {
    if (value === 'NULL' || value === 'null') {
      return null;
    } else if (value === 'true' || value === 'false') {
      return value === 'true';
    } else if (!isNaN(Number(value))) {
      return Number(value);
    } else {
      return value;
    }
  }

  /**
   * Generate cURL command from HTTP request
   */
  generateCurl(httpRequest: HttpRequest): string {
    let curl: string;
    
    if (httpRequest.method === 'GET') {
      // Use -G for GET requests (this is the standard for query parameters)
      curl = `curl -G "${httpRequest.fullPath}"`;
    } else {
      curl = `curl -X ${httpRequest.method} "${httpRequest.fullPath}"`;
    }
    
    // Add headers
    httpRequest.headers.forEach((value, key) => {
      curl += ` \\\n  -H "${key}: ${value}"`;
    });
    
    // Add body for POST/PATCH
    if (httpRequest.body && (httpRequest.method === 'POST' || httpRequest.method === 'PATCH')) {
      curl += ` \\\n  -H "Content-Type: application/json"`;
      curl += ` \\\n  -d '${JSON.stringify(httpRequest.body)}'`;
    }
    
    return curl;
  }
} 