import { SupabaseQueryParser } from './parser';
import { processSql, renderSupabaseJs, renderHttp, formatCurl } from '@supabase/sql-to-rest';
import { HttpTranslator } from './http-translator';

// Unified HTTP request interface
export interface UnifiedHttpRequest {
  method: string;
  path: string;
  fullPath: string;
  params: Map<string, string>;
  headers?: Map<string, string>;
  body?: any;
}

export interface TranslationResult {
  original: string;
  sql?: string;
  http?: UnifiedHttpRequest;
  curl?: string;
  supabaseJs?: string;
  error?: string;
  warnings?: string[];
}

export class EnhancedTranslator {
  private parser: SupabaseQueryParser;
  private httpTranslator: HttpTranslator;

  constructor(baseUrl: string = 'http://localhost:54321/rest/v1') {
    this.parser = new SupabaseQueryParser();
    this.httpTranslator = new HttpTranslator(baseUrl);
  }

  /**
   * Translate Supabase JS query to SQL
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
   * Translate SQL to HTTP request
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

      // Step 2: SQL → HTTP/cURL/Supabase JS
      const [httpResult, curlResult, supabaseJsResult] = await Promise.allSettled([
        this.sqlToHttp(sqlResult.sql),
        this.sqlToCurl(sqlResult.sql, baseUrl),
        this.sqlToSupabaseJs(sqlResult.sql)
      ]);

      return {
        original: supabaseQuery,
        sql: sqlResult.sql,
        http: httpResult.status === 'fulfilled' ? httpResult.value.http : undefined,
        curl: curlResult.status === 'fulfilled' ? curlResult.value.curl : undefined,
        supabaseJs: supabaseJsResult.status === 'fulfilled' ? supabaseJsResult.value.supabaseJs : undefined,
        warnings: sqlResult.warnings,
        error: httpResult.status === 'rejected' || curlResult.status === 'rejected' || supabaseJsResult.status === 'rejected' 
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

    // Get HTTP translation directly from the original Supabase query
    const httpResult = await this.translateToHttp(supabaseQuery);
    
    // Try to get Supabase JS translation, but handle errors gracefully
    let supabaseJsResult;
    try {
      supabaseJsResult = await this.sqlToSupabaseJs(sqlResult.sql);
    } catch (error) {
      // sql-to-rest only supports SELECT queries, so non-SELECT queries will fail
      supabaseJsResult = {
        supabaseJs: undefined,
        error: 'Round-trip to Supabase JS not supported for non-SELECT queries'
      };
    }

    return {
      original: supabaseQuery,
      sql: sqlResult.sql,
      http: httpResult.http,
      supabaseJs: supabaseJsResult.supabaseJs,
      warnings: sqlResult.warnings,
      error: httpResult.error || supabaseJsResult.error
    };
  }

  /**
   * Set auth context for RLS support
   */
  setAuthContext(userId?: string, isAdmin: boolean = false): void {
    this.parser.setAuthContext(userId, isAdmin);
  }
} 