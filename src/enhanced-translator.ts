import { SupabaseQueryParser } from './parser';
import { processSql, renderSupabaseJs, renderHttp, formatCurl } from '@supabase/sql-to-rest';
import { HttpTranslator } from './http-translator';

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
 * @example
 * ```typescript
 * const translator = new EnhancedTranslator('http://localhost:54321/rest/v1');
 * 
 * // Full translation with all formats
 * const result = await translator.fullTranslation(`
 *   supabase.from('users').select('id, name').eq('active', true)
 * `);
 * 
 * console.log(result.sql);    // SELECT id, name FROM users WHERE active = true
 * console.log(result.http);   // GET /users?select=id,name&active=eq.true
 * console.log(result.curl);   // curl -G 'http://localhost:54321/rest/v1/users'...
 * ```
 */
export class EnhancedTranslator {
  /** Parser for converting Supabase queries to SQL */
  private parser: SupabaseQueryParser;
  
  /** HTTP translator for converting SQL to HTTP requests */
  private httpTranslator: HttpTranslator;

  /**
   * Creates a new EnhancedTranslator instance.
   * 
   * @param baseUrl - The base URL for the PostgREST API (defaults to localhost:54321)
   */
  constructor(baseUrl: string = 'http://localhost:54321/rest/v1') {
    this.parser = new SupabaseQueryParser();
    this.httpTranslator = new HttpTranslator(baseUrl);
  }

  /**
   * Translates a Supabase JavaScript query to SQL.
   * 
   * @param supabaseQuery - The Supabase JavaScript query string to translate
   * @returns A promise that resolves to a {@link TranslationResult} with SQL output
   * 
   * @example
   * ```typescript
   * const result = await translator.supabaseToSql(`
   *   supabase.from('users').select('id, name').eq('active', true)
   * `);
   * console.log(result.sql); // SELECT id, name FROM users WHERE active = true
   * ```
   */
  async supabaseToSql(supabaseQuery: string): Promise<TranslationResult> {
    try {
      const result = this.parser.parseComplexQuery(supabaseQuery);
      
      return {
        original: supabaseQuery,
        sql: result.sql,
        error: result.error,
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
   * Translates SQL to an HTTP request compatible with PostgREST.
   * 
   * This method uses the @supabase/sql-to-rest library for SELECT queries
   * and falls back to the custom HTTP translator for other operations.
   * 
   * @param sql - The SQL query to translate
   * @returns A promise that resolves to a {@link TranslationResult} with HTTP output
   * 
   * @example
   * ```typescript
   * const result = await translator.sqlToHttp("SELECT id, name FROM users WHERE active = true");
   * console.log(result.http); // { method: 'GET', path: '/users', ... }
   * ```
   */
  async sqlToHttp(sql: string): Promise<TranslationResult> {
    try {
      // For SELECT queries, we can still use sql-to-rest for better compatibility
      if (sql.toUpperCase().startsWith('SELECT')) {
        const processed = await processSql(sql);
        const http = await renderHttp(processed);
        
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
          http: unifiedHttp
        };
      } else {
        // For non-SELECT queries, use our custom translator
        const result = await this.httpTranslator.translateToHttp(sql);
        return {
          original: sql,
          sql: sql,
          http: result.http
        };
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
   * Translate SQL to cURL command
   */
  async sqlToCurl(sql: string, baseUrl: string = 'http://localhost:54321/rest/v1'): Promise<TranslationResult> {
    try {
      // For SELECT queries, we can still use sql-to-rest for better compatibility
      if (sql.toUpperCase().startsWith('SELECT')) {
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
      const processed = await processSql(sql);
      const supabaseJs = await renderSupabaseJs(processed);
      
      return {
        original: sql,
        sql: sql,
        supabaseJs: supabaseJs.code
      };
    } catch (error) {
      return {
        original: sql,
        sql: sql,
        error: error instanceof Error ? error.message : 'Unknown error'
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

      // Step 2: Determine translation approach based on SQL type
      const isSelectQuery = sqlResult.sql.toUpperCase().startsWith('SELECT');
      
      let httpResult, curlResult, supabaseJsResult;
      
      if (isSelectQuery) {
        // For SELECT queries, use sql-to-rest library
        [httpResult, curlResult, supabaseJsResult] = await Promise.allSettled([
          this.sqlToHttp(sqlResult.sql),
          this.sqlToCurl(sqlResult.sql, baseUrl),
          this.sqlToSupabaseJs(sqlResult.sql)
        ]);
      } else {
        // For non-SELECT queries (INSERT, UPDATE, DELETE), use our custom translator
        const customHttpResult = await this.translateToHttp(supabaseQuery);
        const customCurlResult = await this.translateToCurl(supabaseQuery, baseUrl);
        
        httpResult = { status: 'fulfilled' as const, value: customHttpResult };
        curlResult = { status: 'fulfilled' as const, value: customCurlResult };
        supabaseJsResult = { 
          status: 'rejected' as const, 
          reason: 'Supabase JS generation not supported for non-SELECT queries (sql-to-rest limitation)' 
        };
      }

      return {
        original: supabaseQuery,
        sql: sqlResult.sql,
        http: httpResult.status === 'fulfilled' ? httpResult.value.http : undefined,
        curl: curlResult.status === 'fulfilled' ? curlResult.value.curl : undefined,
        supabaseJs: supabaseJsResult.status === 'fulfilled' ? supabaseJsResult.value.supabaseJs : undefined,
        warnings: [
          ...(sqlResult.warnings || []),
          ...(supabaseJsResult.status === 'rejected' ? [supabaseJsResult.reason] : [])
        ],
        error: httpResult.status === 'rejected' || curlResult.status === 'rejected'
          ? 'Some translations failed' 
          : undefined
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

    // Get HTTP translation - use different approaches for SELECT vs non-SELECT
    let httpResult;
    if (sqlResult.sql.toUpperCase().startsWith('SELECT')) {
      // For SELECT queries, use sqlToHttp which uses sql-to-rest
      httpResult = await this.sqlToHttp(sqlResult.sql);
    } else {
      // For non-SELECT queries, use translateToHttp with the original Supabase query
      httpResult = await this.translateToHttp(supabaseQuery);
    }
    
    // Try to get Supabase JS translation, but handle errors gracefully
    let supabaseJsResult;
    let supabaseJsError = undefined;
    
    if (sqlResult.sql.toUpperCase().startsWith('SELECT')) {
      try {
        supabaseJsResult = await this.sqlToSupabaseJs(sqlResult.sql);
      } catch (error) {
        supabaseJsError = 'Failed to generate Supabase JS for SELECT query';
      }
    } else {
      // For non-SELECT queries, sql-to-rest doesn't support them
      supabaseJsError = 'Round-trip to Supabase JS not supported for non-SELECT queries (sql-to-rest limitation)';
    }

    return {
      original: supabaseQuery,
      sql: sqlResult.sql,
      http: httpResult.http,
      supabaseJs: supabaseJsResult?.supabaseJs,
      warnings: [
        ...(sqlResult.warnings || []),
        ...(supabaseJsError ? [supabaseJsError] : [])
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
} 