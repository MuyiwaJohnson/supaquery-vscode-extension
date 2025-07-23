import { SupabaseQueryParser } from './parser';

/**
 * HTTP Request interface for Supabase REST API calls
 * 
 * @example
 * ```typescript
 * const request: HttpRequest = {
 *   method: 'GET',
 *   path: '/test_table',
 *   fullPath: 'http://localhost:54321/rest/v1/test_table',
 *   params: new Map([['select', 'id,name']]),
 *   headers: new Map([['apikey', 'your-key']])
 * };
 * ```
 */
export interface HttpRequest {
  /** HTTP method (GET, POST, PATCH, DELETE) */
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  
  /** The API endpoint path */
  path: string;
  
  /** Full URL including base URL */
  fullPath: string;
  
  /** Query parameters for GET requests or filters */
  params: Map<string, string>;
  
  /** HTTP headers */
  headers: Map<string, string>;
  
  /** Request body for POST/PATCH requests */
  body?: any;
}

/**
 * Result of translating a Supabase query to HTTP
 * 
 * @example
 * ```typescript
 * const result: HttpTranslationResult = {
 *   original: "supabase.from('test_table').select('id, name')",
 *   sql: "SELECT id, name FROM test_table",
 *   http: { method: 'GET', path: '/test_table', ... },
 *   error: undefined
 * };
 * ```
 */
export interface HttpTranslationResult {
  /** The original Supabase JavaScript query */
  original: string;
  
  /** The intermediate SQL representation */
  sql?: string;
  
  /** The generated HTTP request */
  http?: HttpRequest;
  
  /** Error message if translation failed */
  error?: string;
  
  /** Performance and safety warnings */
  warnings?: string[];
}

/**
 * Translates Supabase JavaScript queries to HTTP requests compatible with PostgREST.
 * 
 * This class converts Supabase client queries into HTTP requests that can be made
 * directly to a PostgREST API endpoint, following the PostgREST specification.
 * 
 * @example
 * ```typescript
 * const translator = new HttpTranslator('http://localhost:54321/rest/v1');
 * const result = await translator.translateToHttp(`
 *   supabase.from('test_table').select('id, name').eq('active', true)
 * `);
 * console.log(result.http); // GET /test_table?select=id,name&active=eq.true
 * ```
 */
export class HttpTranslator {
  /** Parser for converting Supabase queries to SQL */
  private parser: SupabaseQueryParser;
  
  /** Base URL for the PostgREST API */
  private baseUrl: string;

  /**
   * Creates a new HttpTranslator instance.
   * 
   * @param baseUrl - The base URL for the PostgREST API (defaults to localhost:54321)
   */
  constructor(baseUrl: string = 'http://localhost:54321/rest/v1') {
    this.parser = new SupabaseQueryParser();
    this.baseUrl = baseUrl;
  }

  /**
   * Translates a Supabase JavaScript query to an HTTP request.
   * 
   * This method converts Supabase client queries into HTTP requests that can be
   * made directly to a PostgREST API. It handles SELECT, INSERT, UPDATE, and DELETE
   * operations, converting them to appropriate HTTP methods and parameters.
   * 
   * @param supabaseQuery - The Supabase JavaScript query string to translate
   * @returns A promise that resolves to an {@link HttpTranslationResult}
   * 
   * @example
   * ```typescript
   * const result = await translator.translateToHttp(`
   *   supabase.from('test_table')
   *     .select('id, name')
   *     .eq('active', true)
   *     .order('name', { ascending: true })
   * `);
   * 
   * // Result: GET /test_table?select=id,name&active=eq.true&order=name.asc
   * ```
   * 
   * @throws {Error} When the query contains unsupported operations like RPC calls
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
    
    // Extract WHERE conditions from both SQL and original query for better accuracy
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+HAVING|\s+LIMIT|\s+OFFSET|$)/i);
    if (whereMatch) {
      this.parseWhereConditions(whereMatch[1], params);
    }
    
    // Also extract conditions from original query to handle range operators and other patterns
    const originalParams = this.extractWhereConditionsFromOriginalQuery(originalQuery);
    for (const [key, value] of originalParams) {
      params.set(key, value);
    }
    
    // Extract ORDER BY
    const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|\s+OFFSET|$)/i);
    if (orderMatch) {
      const orderClause = orderMatch[1].trim();
      params.set('order', this.formatOrderBy(orderClause));
    }
    
    // Handle single/maybeSingle methods from original query
    const isSingle = originalQuery.includes('.single()');
    const isMaybeSingle = originalQuery.includes('.maybeSingle()');
    
    if (isSingle || isMaybeSingle) {
      // For single/maybeSingle, use PostgREST object format instead of limit=1
      headers.set('Accept', 'application/vnd.pgrest.object+json');
    } else {
      // Extract LIMIT only for non-single queries
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        params.set('limit', limitMatch[1]);
      }
    }
    
    // Extract OFFSET
    const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
    if (offsetMatch) {
      params.set('offset', offsetMatch[1]);
    }
    
    // Build query string
    const queryString = Array.from(params.entries())
      .map(([key, value]) => `${key}=${value}`)
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
    // Use the comprehensive approach for better handling of complex objects
    return this.extractComplexInsertBody(originalQuery);
  }

  /**
   * Extract complex insert body using a more comprehensive approach
   */
  private extractComplexInsertBody(originalQuery: string): any {
    // Find the start of the insert method
    const insertStart = originalQuery.indexOf('.insert(');
    if (insertStart === -1) {
      return {};
    }

    // Find the matching closing parenthesis by counting parentheses
    let parenCount = 1; // Start with 1 for the opening parenthesis of insert(
    let contentStart = insertStart + 8; // Length of '.insert('
    let contentEnd = contentStart;
    let inString = false;
    let stringChar = '';

    for (let i = contentStart; i < originalQuery.length; i++) {
      const char = originalQuery[i];
      
      // Handle string literals
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar && inString) {
        inString = false;
      }
      
      // Count parentheses only when not in a string
      if (!inString) {
        if (char === '(') {
          parenCount++;
        } else if (char === ')') {
          parenCount--;
          if (parenCount === 0) {
            contentEnd = i;
            break;
          }
        }
      }
    }

    const content = originalQuery.substring(contentStart, contentEnd).trim();
    return this.parseInsertContent(content);
  }

  /**
   * Parse the insert content (helper method)
   */
  private parseInsertContent(content: string): any {
    try {
      // Handle arrays
      if (content.startsWith('[') && content.endsWith(']')) {
        // For arrays, we need to parse each object individually
        const arrayContent = content.slice(1, -1).trim();
        if (!arrayContent) return [];
        
        // Split by object boundaries (this is a simplified approach)
        const objects = [];
        let currentObj = '';
        let braceCount = 0;
        let inString = false;
        let stringChar = '';
        
        for (let i = 0; i < arrayContent.length; i++) {
          const char = arrayContent[i];
          
          // Handle string literals
          if ((char === '"' || char === "'") && !inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar && inString) {
            inString = false;
          }
          
          // Handle braces
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
            }
          }
          
          currentObj += char;
          
          // If we've completed an object
          if (braceCount === 0 && currentObj.trim()) {
            const objStr = currentObj.trim();
            if (objStr.startsWith('{') && objStr.endsWith('}')) {
              const jsonStr = this.convertToValidJson(objStr);
              objects.push(JSON.parse(jsonStr));
            }
            currentObj = '';
          }
        }
        
        return objects;
      }
      
      // Handle single object
      if (content.startsWith('{') && content.endsWith('}')) {
        const jsonStr = this.convertToValidJson(content);
        
        // Check if this contains placeholders (any content in braces)
        if (jsonStr.includes('{') && jsonStr.includes('}')) {
          // Try to parse as JSON, but if it fails due to placeholders, create a generic object
          try {
            return JSON.parse(jsonStr);
          } catch (error) {
            // If JSON parsing fails, it's likely due to placeholders
            // Create a generic object by parsing the original content manually
            return this.parseObjectWithPlaceholders(content);
          }
        }
        
        try {
          return JSON.parse(jsonStr);
        } catch (error) {
          return {};
        }
      }
      
      // Fallback: try to extract as a simple object
      const body: any = {};
      const keyValueMatches = content.matchAll(/(\w+):\s*([^,}]+)/g);
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
      
    } catch (error) {
      return {};
    }
  }

  /**
   * Convert Supabase object string to valid JSON
   */
  private convertToValidJson(objStr: string): string {
    // Convert property names to quoted format
    let jsonStr = objStr.replace(/(\w+):/g, '"$1":');
    
    // Handle string values with single quotes
    jsonStr = jsonStr.replace(/'([^']*)'/g, '"$1"');
    
    // Handle string values with double quotes (escape them)
    jsonStr = jsonStr.replace(/"([^"]*)"/g, (match, content) => {
      // If this is already a property name (ends with :), don't change it
      if (match.endsWith('":')) {
        return match;
      }
      // Otherwise, escape the content
      return `"${content.replace(/"/g, '\\"')}"`;
    });
    
    // Handle array literals
    jsonStr = jsonStr.replace(/\[([^\]]*)\]/g, (match, content) => {
      // Convert array content to proper JSON
      const arrayContent = content.split(',').map((item: string) => {
        const trimmed = item.trim();
        if (trimmed.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
          // It's a variable, use placeholder format
          return `{${trimmed}}`;
        }
        return trimmed;
      }).join(',');
      return `[${arrayContent}]`;
    });
    
    // Handle function calls like new Date().toISOString()
    jsonStr = jsonStr.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*\(\))/g, '{$1}');
    
    // Handle more complex function calls like new Date().toISOString()
    jsonStr = jsonStr.replace(/(new\s+[a-zA-Z_$][a-zA-Z0-9_$]*\(\)\.[a-zA-Z_$][a-zA-Z0-9_$]*\(\))/g, '{$1}');
    
    // Handle variables that are not already quoted or in placeholders
    jsonStr = jsonStr.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*,|\s*})/g, (match, content) => {
      // Skip if it's already a property name, quoted, or already in braces
      if (content.endsWith('":') || content.startsWith('"') || content.startsWith('{')) {
        return content;
      }
      return `{${content}}`;
    });
    
    // Remove trailing commas before } or ]
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    return jsonStr;
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
    let body = this.extractUpdateBodyFromOriginalQuery(originalQuery);
    
    // If body is empty, try to extract from SQL
    if (!body || Object.keys(body).length === 0) {
      body = this.extractUpdateBodyFromSql(sql);
    }
    
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
   * Extract update body from SQL
   */
  private extractUpdateBodyFromSql(sql: string): any {
    // Extract SET clause from UPDATE SQL
    const setMatch = sql.match(/SET\s+(.+?)(?:\s+WHERE|\s+RETURNING|$)/i);
    if (setMatch) {
      const setClause = setMatch[1];
      
      const body: any = {};
      // Parse SET clause like "column1 = ?, column2 = ?"
      const assignments = setClause.split(',').map(s => s.trim());
      
      for (const assignment of assignments) {
        const [column, value] = assignment.split('=').map(s => s.trim());
        if (column && value) {
          // Remove quotes if present
          const cleanColumn = column.replace(/['"]/g, '');
          const cleanValue = value.replace(/['"]/g, '');
          
          // For now, we'll use the column name as a placeholder
          // In a real implementation, you'd need to map the placeholders to actual values
          body[cleanColumn] = cleanValue === '?' ? true : cleanValue;
        }
      }
      
      return body;
    }
    
    return {};
  }

  /**
   * Extract update body from original Supabase query
   */
  private extractUpdateBodyFromOriginalQuery(originalQuery: string): any {
    // Look for update([{...}]) pattern (array of objects) - handle multi-line
    const updateArrayMatch = originalQuery.match(/\.update\s*\(\s*\[\s*({[\s\S]*?})\s*\]\s*\)/is);
    if (updateArrayMatch) {
      try {
        // Clean up the matched object string
        let objectStr = updateArrayMatch[1];
        // Remove newlines and extra spaces
        objectStr = objectStr.replace(/\s+/g, ' ').trim();
        
        // Try to parse as JSON
        const jsonStr = objectStr.replace(/(\w+):/g, '"$1":'); // Convert keys to quoted
        return JSON.parse(jsonStr);
      } catch (error) {
        // Fallback: extract key-value pairs manually
        const body: any = {};
        const keyValueMatches = updateArrayMatch[1].matchAll(/(\w+):\s*([^,}]+)/g);
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
    
    // Look for update({...}) pattern (single object)
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
      .map(([key, value]) => `${key}=${value}`)
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
    // Remove SQL comments from the where clause
    const cleanWhereClause = whereClause.replace(/--.*$/gm, '').trim();
    
    // Split by AND/OR
    const conditions = cleanWhereClause.split(/\s+(?:AND|OR)\s+/i);
    
    conditions.forEach(condition => {
      condition = condition.trim();
      
      // Skip empty conditions
      if (!condition) {
        return;
      }
      
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
    
    // Look for all filter patterns and collect them
    const allMatches: Array<{column: string, operator: string, value: string}> = [];
    
    // Match all eq patterns - handle both quoted and unquoted values
    const eqMatches = originalQuery.matchAll(/\.eq\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)\s*\)/gi);
    for (const match of eqMatches) {
      const value = match[2].replace(/['"`]/g, ''); // Remove any quotes
      allMatches.push({column: match[1], operator: 'eq', value: value});
    }
    
    // Match all gt patterns
    const gtMatches = originalQuery.matchAll(/\.gt\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)\s*\)/gi);
    for (const match of gtMatches) {
      const value = match[2].replace(/['"`]/g, '');
      allMatches.push({column: match[1], operator: 'gt', value: value});
    }
    
    // Match all gte patterns
    const gteMatches = originalQuery.matchAll(/\.gte\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)\s*\)/gi);
    for (const match of gteMatches) {
      const value = match[2].replace(/['"`]/g, '');
      allMatches.push({column: match[1], operator: 'gte', value: value});
    }
    
    // Match all lt patterns
    const ltMatches = originalQuery.matchAll(/\.lt\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)\s*\)/gi);
    for (const match of ltMatches) {
      const value = match[2].replace(/['"`]/g, '');
      allMatches.push({column: match[1], operator: 'lt', value: value});
    }
    
    // Match all lte patterns
    const lteMatches = originalQuery.matchAll(/\.lte\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)\s*\)/gi);
    for (const match of lteMatches) {
      const value = match[2].replace(/['"`]/g, '');
      allMatches.push({column: match[1], operator: 'lte', value: value});
    }
    
    // Match all rangeGt patterns
    const rangeGtMatches = originalQuery.matchAll(/\.rangeGt\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)\s*\)/gi);
    for (const match of rangeGtMatches) {
      const value = match[2].replace(/['"`]/g, '');
      allMatches.push({column: match[1], operator: 'gt', value: value});
    }
    
    // Match all rangeGte patterns
    const rangeGteMatches = originalQuery.matchAll(/\.rangeGte\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)\s*\)/gi);
    for (const match of rangeGteMatches) {
      const value = match[2].replace(/['"`]/g, '');
      allMatches.push({column: match[1], operator: 'gte', value: value});
    }
    
    // Match all rangeLt patterns
    const rangeLtMatches = originalQuery.matchAll(/\.rangeLt\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)\s*\)/gi);
    for (const match of rangeLtMatches) {
      const value = match[2].replace(/['"`]/g, '');
      allMatches.push({column: match[1], operator: 'lt', value: value});
    }
    
    // Match all rangeLte patterns
    const rangeLteMatches = originalQuery.matchAll(/\.rangeLte\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)\s*\)/gi);
    for (const match of rangeLteMatches) {
      const value = match[2].replace(/['"`]/g, '');
      allMatches.push({column: match[1], operator: 'lte', value: value});
    }
    
    // Group by column and handle multiple operators
    const columnGroups = new Map<string, Array<{operator: string, value: string}>>();
    for (const match of allMatches) {
      if (!columnGroups.has(match.column)) {
        columnGroups.set(match.column, []);
      }
      columnGroups.get(match.column)!.push({operator: match.operator, value: match.value});
    }
    
    // Add parameters to the map
    for (const [column, operators] of columnGroups) {
      if (operators.length === 1) {
        // Single operator
        params.set(column, `${operators[0].operator}.${operators[0].value}`);
      } else {
        // Multiple operators - use the last one (most recent in the query)
        const lastOperator = operators[operators.length - 1];
        params.set(column, `${lastOperator.operator}.${lastOperator.value}`);
        // Note: PostgREST actually supports multiple filters on the same column automatically
        // The second filter will be applied as an additional condition
      }
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
    
    // Replace localhost URL with placeholder for real Supabase URL
    const realSupabaseUrl = httpRequest.fullPath.replace(
      'http://localhost:54321/rest/v1',
      '[YOUR SUPABASE PROJECT URL]/rest/v1'
    );
    
    if (httpRequest.method === 'GET') {
      // Use -G for GET requests (this is the standard for query parameters)
      curl = `curl '${realSupabaseUrl}'`;
    } else {
      curl = `curl -X ${httpRequest.method} '${realSupabaseUrl}'`;
    }
    
    // Add Supabase authentication headers
    curl += ` \\\n  -H "apikey: SUPABASE_CLIENT_ANON_KEY"`;
    curl += ` \\\n  -H "Authorization: Bearer SUPABASE_CLIENT_ANON_KEY"`;
    
    // Add other headers
    httpRequest.headers.forEach((value, key) => {
      // Skip Content-Type if we're adding it for body
      if (key.toLowerCase() !== 'content-type') {
        curl += ` \\\n  -H "${key}: ${value}"`;
      }
    });
    
    // Add body for POST/PATCH with improved formatting
    if (httpRequest.body && (httpRequest.method === 'POST' || httpRequest.method === 'PATCH')) {
      curl += ` \\\n  -H "Content-Type: application/json"`;
      
      // Format JSON body for better readability
      const formattedBody = this.formatJsonBody(httpRequest.body);
      curl += ` \\\n  -d '${formattedBody}'`;
    }
    
    return curl;
  }

  /**
   * Format JSON body for cURL command with improved readability
   */
  private formatJsonBody(body: any): string {
    // For arrays, format them more compactly
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return '[]';
      }
      
      // For simple arrays, keep them on one line
      if (body.length <= 2 && body.every(item => 
        typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
      )) {
        return JSON.stringify(body);
      }
      
      // For complex arrays (objects), format them nicely
      return JSON.stringify(body, null, 2)
        .replace(/\n/g, '\\n')
        .replace(/\s{2}/g, ' ');
    }
    
    // For objects, format them compactly but readably
    if (typeof body === 'object' && body !== null) {
      const keys = Object.keys(body);
      if (keys.length <= 3 && keys.every(key => 
        typeof body[key] === 'string' || typeof body[key] === 'number' || typeof body[key] === 'boolean'
      )) {
        // Simple objects on one line
        return JSON.stringify(body);
      }
      
      // Complex objects with better formatting
      return JSON.stringify(body, null, 2)
        .replace(/\n/g, '\\n')
        .replace(/\s{2}/g, ' ');
    }
    
    // For primitive values, use standard JSON.stringify
    return JSON.stringify(body);
  }

  /**
   * Parse an object string that contains placeholders into a proper object
   */
  private parseObjectWithPlaceholders(jsonStr: string): any {
    const result: any = {};
    
    // First, handle the original input to catch properties without explicit values
    const originalContent = jsonStr.trim().slice(1, -1);
    
    // Look for patterns like "member_id," or "member_id}"
    const noValuePattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[,}]/g;
    let match;
    while ((match = noValuePattern.exec(originalContent)) !== null) {
      const propName = match[1];
      result[propName] = `{${propName}}`;
    }
    
    // Remove outer braces and split by commas
    const content = jsonStr.trim().slice(1, -1);
    const pairs = content.split(',').map(pair => pair.trim());
    
    for (const pair of pairs) {
      if (!pair) continue;
      
      // Split by first colon to get key and value
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) {
        // Skip if we already handled this in the no-value case
        continue;
      }
      
      const key = pair.substring(0, colonIndex).trim().replace(/"/g, '');
      const value = pair.substring(colonIndex + 1).trim();
      
      // Skip if key is empty or malformed, or if we already handled it
      if (!key || key.includes('{') || result.hasOwnProperty(key)) continue;
      
      // Handle different value types
      if (value.startsWith('[') && value.endsWith(']')) {
        // Array value
        const arrayContent = value.slice(1, -1).trim();
        if (arrayContent) {
          // Parse array items and handle placeholders
          const items = arrayContent.split(',').map(item => {
            const trimmed = item.trim();
            if (trimmed.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
              // It's a variable, convert to placeholder format
              return `{${trimmed}}`;
            }
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              // Remove double braces if present
              const inner = trimmed.slice(1, -1);
              if (inner.startsWith('{') && inner.endsWith('}')) {
                return inner;
              }
              return trimmed;
            }
            return trimmed;
          });
          result[key] = items;
        } else {
          result[key] = [];
        }
      } else if (value.startsWith('{') && value.endsWith('}')) {
        // Placeholder value - keep the braces
        result[key] = value;
      } else if (value.startsWith('"') && value.endsWith('"')) {
        // String value
        result[key] = value.slice(1, -1);
      } else {
        // Other value (number, boolean, etc.)
        result[key] = value;
      }
    }
    
    return result;
  }
} 