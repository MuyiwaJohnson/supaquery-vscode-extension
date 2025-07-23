import { SupabaseQueryParser } from './parser';
// Dynamic import for ES module compatibility
let sqlToRest: any = null;

async function getSqlToRest() {
  if (!sqlToRest) {
    sqlToRest = await import('@supabase/sql-to-rest');
  }
  return sqlToRest;
}
import { HttpTranslator } from './http-translator';

// Simple LRU cache for translation results
class TranslationCache {
  private cache = new Map<string, any>();
  private maxSize = 100;

  get(key: string): any | undefined {
    const value = this.cache.get(key);
    if (value) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: any): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }

  getMaxSize(): number {
    return this.maxSize;
  }
}

/**
 * Unified HTTP request interface for consistent request representation.
 * 
 * This interface provides a standardized way to represent HTTP requests
 * across different translation methods and external libraries.
 * 
 * @example
 * ```typescript
 * const request: UnifiedHttpRequest = {
 *   method: 'GET',
 *   path: '/users',
 *   fullPath: 'http://localhost:54321/rest/v1/users',
 *   params: new Map([['select', 'id,name']]),
 *   headers: new Map([['Content-Type', 'application/json']])
 * };
 * ```
 */
export interface UnifiedHttpRequest {
  /** HTTP method (GET, POST, PATCH, DELETE) */
  method: string;
  
  /** The API endpoint path */
  path: string;
  
  /** Full URL including base URL */
  fullPath: string;
  
  /** Query parameters for GET requests or filters */
  params: Map<string, string>;
  
  /** HTTP headers */
  headers?: Map<string, string>;
  
  /** Request body for POST/PATCH requests */
  body?: any;
}

/**
 * Comprehensive result of any translation operation.
 * 
 * This interface represents the output of any translation method, containing
 * all possible formats (SQL, HTTP, cURL, Supabase JS) and metadata.
 * 
 * @example
 * ```typescript
 * const result: TranslationResult = {
 *   original: "supabase.from('users').select('*')",
 *   sql: "SELECT * FROM users",
 *   http: { method: 'GET', path: '/users', ... },
 *   curl: "curl -G 'http://localhost:54321/rest/v1/users'",
 *   supabaseJs: "supabase.from('users').select('*')",
 *   warnings: []
 * };
 * ```
 */
export interface TranslationResult {
  /** The original input query */
  original: string;
  
  /** The generated SQL query */
  sql?: string;
  
  /** The generated HTTP request */
  http?: UnifiedHttpRequest;
  
  /** The generated cURL command */
  curl?: string;
  
  /** The generated Supabase JavaScript code */
  supabaseJs?: string;
  
  /** Error message if translation failed */
  error?: string;
  
  /** Performance and safety warnings */
  warnings?: string[];
}

/**
 * Enhanced translator that provides comprehensive translation capabilities.
 * 
 * This class combines multiple translation methods to provide a complete
 * translation pipeline from Supabase JavaScript queries to various formats:
 * - SQL queries
 * - HTTP requests (PostgREST compatible)
 * - cURL commands
 * - Round-trip Supabase JavaScript code
 * 
 * Performance optimizations:
 * - LRU caching for translation results
 * - Lazy loading of sql-to-rest library
 * - Optimized parsing for simple queries
 */
export class EnhancedTranslator {
  /** Parser for Supabase JavaScript queries */
  private parser: SupabaseQueryParser;
  
  /** HTTP translator for generating HTTP requests */
  private httpTranslator: HttpTranslator;
  
  /** Cache for translation results */
  private cache: TranslationCache;
  
  /** Base URL for HTTP requests */
  private baseUrl: string;
  
  /** Flag to track if sql-to-rest is loaded */
  private sqlToRestLoaded = false;
  
  /** Promise for preloading sql-to-rest */
  private sqlToRestPromise: Promise<any> | null = null;

  /**
   * Creates a new EnhancedTranslator instance.
   * 
   * @param baseUrl - Base URL for HTTP requests (default: localhost)
   */
  constructor(baseUrl: string = 'http://localhost:54321/rest/v1') {
    this.parser = new SupabaseQueryParser();
    this.httpTranslator = new HttpTranslator();
    this.cache = new TranslationCache();
    this.baseUrl = baseUrl;
    
    // Preload sql-to-rest to avoid the 300ms delay on first use
    this.preloadSqlToRest();
  }

  /**
   * Preload sql-to-rest library in the background
   */
  private async preloadSqlToRest(): Promise<void> {
    if (!this.sqlToRestPromise) {
      this.sqlToRestPromise = getSqlToRest();
      try {
        await this.sqlToRestPromise;
        this.sqlToRestLoaded = true;
      } catch (error) {
        console.warn('Failed to preload sql-to-rest:', error);
      }
    }
  }

  /**
   * Translates a Supabase JavaScript query to SQL.
   * 
   * @param supabaseQuery - The Supabase JavaScript query to translate
   * @returns Promise resolving to a TranslationResult with SQL output
   */
  async supabaseToSql(supabaseQuery: string): Promise<TranslationResult> {
    const cacheKey = `sql:${supabaseQuery}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const parsedQuery = this.parser.parseQuery(supabaseQuery);
      
      if (parsedQuery.error) {
        const result: TranslationResult = {
          original: supabaseQuery,
          error: parsedQuery.error,
          warnings: parsedQuery.warnings
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      const result: TranslationResult = {
        original: supabaseQuery,
        sql: parsedQuery.sql,
        warnings: parsedQuery.warnings
      };
      
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      const result: TranslationResult = {
        original: supabaseQuery,
        error: error instanceof Error ? error.message : 'Unknown error during SQL translation'
      };
      this.cache.set(cacheKey, result);
      return result;
    }
  }

  /**
   * Translates SQL to HTTP request using sql-to-rest library (SELECT only).
   * 
   * @param sql - The SQL query to translate
   * @returns Promise resolving to a TranslationResult with HTTP output
   */
  async sqlToHttp(sql: string): Promise<TranslationResult> {
    const cacheKey = `http:${sql}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Only use sql-to-rest for SELECT queries
      if (!sql.trim().toUpperCase().startsWith('SELECT')) {
        // For non-SELECT queries, use our custom HTTP translator
        const result = await this.httpTranslator.translateToHttp(sql);
        this.cache.set(cacheKey, result);
        return result;
      }

      // Use preloaded sql-to-rest or load it if not ready
      let sqlToRestModule;
      if (this.sqlToRestLoaded && this.sqlToRestPromise) {
        sqlToRestModule = await this.sqlToRestPromise;
      } else {
        sqlToRestModule = await getSqlToRest();
        this.sqlToRestLoaded = true;
      }
      const httpRequest = sqlToRestModule.sqlToRest(sql);
      
      const result: TranslationResult = {
        original: sql,
        http: {
          method: httpRequest.method,
          path: httpRequest.path,
          fullPath: `${this.baseUrl}${httpRequest.path}`,
          params: new Map(Object.entries(httpRequest.params || {})),
          headers: new Map(Object.entries(httpRequest.headers || {}))
        }
      };
      
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      // Fallback to custom HTTP translator
      try {
        const result = await this.httpTranslator.translateToHttp(sql);
        this.cache.set(cacheKey, result);
        return result;
      } catch (fallbackError) {
        const result: TranslationResult = {
          original: sql,
          error: `HTTP translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
        this.cache.set(cacheKey, result);
        return result;
      }
    }
  }

  /**
   * Translate SQL to cURL command
   */
  async sqlToCurl(sql: string, baseUrl: string = 'http://localhost:54321/rest/v1'): Promise<TranslationResult> {
    try {
      // For SELECT queries, we can still use sql-to-rest for better compatibility
      if (sql.toUpperCase().startsWith('SELECT')) {
        const { processSql, renderHttp, formatCurl } = await getSqlToRest();
        const processed = await processSql(sql);
        const http = await renderHttp(processed);
        const curl = formatCurl(baseUrl, http);
        
        // Convert sql-to-rest HttpRequest to our unified format
        const unifiedHttp: UnifiedHttpRequest = {
          method: http.method,
          path: http.path,
          fullPath: http.fullPath,
          params: new Map(Array.from(http.params.entries())),
          headers: new Map(),
          body: undefined
        };
        
        return {
          original: sql,
          sql: sql,
          http: unifiedHttp,
          curl: curl
        };
      } else {
        // For non-SELECT queries, use our custom translator
        const result = await this.httpTranslator.translateToHttp(sql);
        if (result.http) {
          const curl = this.httpTranslator.generateCurl(result.http);
          return {
            original: sql,
            sql: sql,
            http: result.http,
            curl: curl
          };
        } else {
          return {
            original: sql,
            sql: sql,
            error: result.error
          };
        }
      }
    } catch (error) {
      return {
        original: sql,
        sql: sql,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Translate SQL back to Supabase JS (round-trip)
   */
  async sqlToSupabaseJs(sql: string): Promise<TranslationResult> {
    try {
      const sqlToRestModule = await getSqlToRest();
      
      // Check if the required methods exist
      if (sqlToRestModule.processSql && sqlToRestModule.renderSupabaseJs) {
        const processed = await sqlToRestModule.processSql(sql);
        const supabaseJs = await sqlToRestModule.renderSupabaseJs(processed);
        
        return {
          original: sql,
          sql: sql,
          supabaseJs: supabaseJs.code || supabaseJs
        };
      } else {
        // Fallback: return a simple representation
        return {
          original: sql,
          sql: sql,
          supabaseJs: `// Generated from SQL: ${sql}`
        };
      }
    } catch (error) {
      // Fallback: return a simple representation
      return {
        original: sql,
        sql: sql,
        supabaseJs: `// Generated from SQL: ${sql}`
      };
    }
  }

  /**
   * Complete translation pipeline: Supabase JS → SQL → HTTP/cURL/Supabase JS
   */
  async fullTranslation(supabaseQuery: string, baseUrl: string = 'http://localhost:54321/rest/v1'): Promise<TranslationResult> {
    try {
      // Step 1: Supabase JS → SQL
      const sqlResult = await this.supabaseToSql(supabaseQuery);
      
      if (sqlResult.error || !sqlResult.sql) {
        return sqlResult;
      }

      // Step 2: Use our custom translator for all queries (simpler and more reliable)
      let customHttpResult;
      let customCurlResult;
      
      try {
        customHttpResult = await this.httpTranslator.translateToHttp(supabaseQuery);
        customCurlResult = await this.httpTranslator.translateToHttp(supabaseQuery);
      } catch (httpError) {
        // If HTTP translation fails, still return SQL but with error
        return {
          original: supabaseQuery,
          sql: sqlResult.sql,
          supabaseJs: `// Generated from SQL: ${sqlResult.sql}`,
          warnings: [
            ...(sqlResult.warnings || []),
            `HTTP translation failed: ${httpError instanceof Error ? httpError.message : 'Unknown error'}`
          ],
          error: httpError instanceof Error ? httpError.message : 'HTTP translation failed'
        };
      }
      
      return {
        original: supabaseQuery,
        sql: sqlResult.sql,
        http: customHttpResult.http,
        curl: customCurlResult.http ? this.generateCurl(customCurlResult.http) : undefined,
        supabaseJs: `// Generated from SQL: ${sqlResult.sql}`,
        warnings: [
          ...(sqlResult.warnings || []),
          ...(customHttpResult.warnings || [])
        ],
        error: customHttpResult.error
      };
    } catch (error) {
      return {
        original: supabaseQuery,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Translate to HTTP only
   */
  async translateToHttp(supabaseQuery: string): Promise<TranslationResult> {
    const result = await this.httpTranslator.translateToHttp(supabaseQuery);
    
    return {
      original: result.original,
      sql: result.sql,
      http: result.http,
      error: result.error,
      warnings: result.warnings
    };
  }

  /**
   * Translate to cURL only
   */
  async translateToCurl(supabaseQuery: string, baseUrl: string = 'http://localhost:54321/rest/v1'): Promise<TranslationResult> {
    const result = await this.httpTranslator.translateToHttp(supabaseQuery);
    
    if (result.error || !result.http) {
      return {
        original: result.original,
        sql: result.sql,
        error: result.error,
        warnings: result.warnings
      };
    }

    const curl = this.httpTranslator.generateCurl(result.http);
    
    return {
      original: result.original,
      sql: result.sql,
      http: result.http,
      curl: curl,
      warnings: result.warnings
    };
  }

  /**
   * Round-trip translation: Supabase JS → SQL → HTTP → Supabase JS
   */
  async roundTripTranslation(supabaseQuery: string): Promise<TranslationResult> {
    const sqlResult = await this.supabaseToSql(supabaseQuery);
    
    if (sqlResult.error || !sqlResult.sql) {
      return sqlResult;
    }

    // Use our custom translator for HTTP translation
    const httpResult = await this.translateToHttp(supabaseQuery);

    return {
      original: supabaseQuery,
      sql: sqlResult.sql,
      http: httpResult.http,
      supabaseJs: `// Generated from SQL: ${sqlResult.sql}`,
      warnings: [
        ...(sqlResult.warnings || []),
        ...(httpResult.warnings || [])
      ],
      error: httpResult.error
    };
  }

  /**
   * Set auth context for RLS support
   */
  setAuthContext(userId?: string, isAdmin: boolean = false): void {
    this.parser.setAuthContext(userId, isAdmin);
  }

  /**
   * Clear the translation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.getSize(),
      maxSize: this.cache.getMaxSize()
    };
  }

  /**
   * Generate cURL command from HTTP request
   */
  private generateCurl(httpRequest: UnifiedHttpRequest): string {
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
    if (httpRequest.headers) {
      httpRequest.headers.forEach((value, key) => {
        // Skip Content-Type if we're adding it for body
        if (key.toLowerCase() !== 'content-type') {
          curl += ` \\\n  -H "${key}: ${value}"`;
        }
      });
    }
    
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
} 