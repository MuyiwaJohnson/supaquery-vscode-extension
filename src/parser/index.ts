import { ParsedQuery } from './types';
import { QueryVisitor } from './query-visitor';
import { SqlGenerator } from '../sql-generator';
import { AstParser } from './ast-parser';

/**
 * Main parser class for translating Supabase JavaScript queries to SQL.
 * 
 * This class orchestrates the parsing process by:
 * 1. Using AST parsing to extract method chains from Supabase queries
 * 2. Converting method chains into structured query nodes
 * 3. Generating SQL from query nodes
 * 4. Providing warnings for potential performance issues
 * 
 * @example
 * ```typescript
 * const parser = new SupabaseQueryParser();
 * const result = parser.parseComplexQuery(`
 *   supabase.from('users').select('id, name').eq('active', true)
 * `);
 * console.log(result.sql); // SELECT id, name FROM users WHERE active = true
 * ```
 */
export class SupabaseQueryParser {
  /** Threshold for warning about large LIMIT values that may impact performance */
  private static readonly LARGE_LIMIT_THRESHOLD = 1000;
  
  /** Visitor pattern implementation for parsing method chains */
  private visitor: QueryVisitor;
  
  /** SQL generator for converting query nodes to SQL strings */
  private sqlGenerator: SqlGenerator;
  
  /** AST parser for extracting method chains from JavaScript code */
  private astParser: AstParser;

  /**
   * Creates a new SupabaseQueryParser instance with initialized components.
   */
  constructor() {
    this.visitor = new QueryVisitor();
    this.sqlGenerator = new SqlGenerator();
    this.astParser = new AstParser();
  }

  /**
   * Parses a Supabase JavaScript query and converts it to SQL.
   * 
   * This method handles basic query parsing using AST analysis and method chain processing.
   * For more complex queries with edge cases, use {@link parseComplexQuery}.
   * 
   * @param queryText - The Supabase JavaScript query string to parse
   * @returns A {@link ParsedQuery} object containing the SQL result and any warnings
   * 
   * @example
   * ```typescript
   * const result = parser.parseQuery("supabase.from('users').select('*')");
   * console.log(result.sql); // SELECT * FROM users
   * ```
   * 
   * @throws {Error} When the query cannot be parsed due to syntax errors
   */
  parseQuery(queryText: string): ParsedQuery {
    try {
      // Use ts-morph AST parser to extract the method chain
      const methodChain = this.astParser.parseQueryText(queryText);
      
      // Parse the method chain into a query node
      const queryNode = this.visitor.parseMethodChain(methodChain);
      
      // Generate SQL from the query node
      const sql = this.sqlGenerator.generateSql(queryNode);
      const formattedSql = this.sqlGenerator.formatSql(sql);
      
      return {
        original: queryText,
        sql: formattedSql,
        warnings: this.generateWarnings(queryNode)
      };
    } catch (error) {
      return {
        original: queryText,
        sql: '',
        error: error instanceof Error ? error.message : 'Unknown parsing error',
        warnings: []
      };
    }
  }



  /**
   * Generates performance and safety warnings for a parsed query node.
   * 
   * @param queryNode - The parsed query node to analyze
   * @returns Array of warning messages for potential issues
   * 
   * @example
   * ```typescript
   * const warnings = this.generateWarnings(queryNode);
   * // Returns warnings like:
   * // - "Consider selecting specific columns instead of * for better performance"
   * // - "DELETE query without WHERE clause will delete all rows"
   * // - "Large LIMIT value may impact performance"
   * ```
   */
  private generateWarnings(queryNode: any): string[] {
    const warnings: string[] = [];
    
    // Check for potential issues
    if (queryNode.type === 'select' && queryNode.columns?.includes('*')) {
      warnings.push('Consider selecting specific columns instead of * for better performance');
    }
    
    if (queryNode.where && queryNode.where.length === 0 && queryNode.type === 'delete') {
      warnings.push('DELETE query without WHERE clause will delete all rows');
    }
    
    if (queryNode.limit && queryNode.limit > SupabaseQueryParser.LARGE_LIMIT_THRESHOLD) {
      warnings.push('Large LIMIT value may impact performance');
    }
    
    return warnings;
  }

  /**
   * Parses a SELECT query specifically.
   * @param queryText - The SELECT query string
   * @returns Parsed query result
   */
  parseSelectQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  /**
   * Parses an INSERT query specifically.
   * @param queryText - The INSERT query string
   * @returns Parsed query result
   */
  parseInsertQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  /**
   * Parses an UPDATE query specifically.
   * @param queryText - The UPDATE query string
   * @returns Parsed query result
   */
  parseUpdateQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  /**
   * Parses a DELETE query specifically.
   * @param queryText - The DELETE query string
   * @returns Parsed query result
   */
  parseDeleteQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  /**
   * Parses an UPSERT query specifically.
   * @param queryText - The UPSERT query string
   * @returns Parsed query result
   */
  parseUpsertQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  /**
   * Sets the authentication context for Row Level Security (RLS) support.
   * 
   * This method configures the parser to handle auth-related queries like `auth.uid()`
   * and `auth.admin` checks in WHERE clauses.
   * 
   * @param userId - The current user ID for RLS context
   * @param isAdmin - Whether the current user has admin privileges
   * 
   * @example
   * ```typescript
   * parser.setAuthContext('user123', false);
   * const result = parser.parseQuery(`
   *   supabase.from('posts').select('*').eq('user_id', 'auth.uid()')
   * `);
   * ```
   */
  setAuthContext(userId?: string, isAdmin: boolean = false): void {
    this.visitor.setAuthContext(userId, isAdmin);
  }

  /**
   * Parses complex Supabase queries with advanced pattern recognition.
   * 
   * This method handles edge cases and complex scenarios that the basic parser might miss:
   * - Empty or null queries
   * - Malformed queries with syntax errors
   * - RPC (Remote Procedure Call) queries
   * - Auth-related queries with RLS
   * - JSONB queries with operators
   * 
   * @param queryText - The Supabase JavaScript query string to parse
   * @returns A {@link ParsedQuery} object with SQL result, warnings, and error handling
   * 
   * @example
   * ```typescript
   * const result = parser.parseComplexQuery(`
   *   supabase.from('users')
   *     .select('id, name, profile->>email')
   *     .eq('active', true)
   *     .eq('user_id', 'auth.uid()')
   * `);
   * ```
   * 
   * @throws {Error} When the query contains unsupported patterns or syntax errors
   */
  parseComplexQuery(queryText: string): ParsedQuery {
    try {
      // Handle edge cases first
      if (!queryText || queryText.trim() === '') {
        return {
          original: queryText,
          sql: undefined,
          error: 'Empty query provided',
          warnings: []
        };
      }

      if (queryText === null || queryText === undefined) {
        return {
          original: queryText,
          sql: '',
          error: 'Query cannot be null or undefined',
          warnings: []
        };
      }

      // Check for malformed queries
      if (this.isMalformedQuery(queryText)) {
        return {
          original: queryText,
          sql: '',
          error: 'Malformed query detected',
          warnings: ['Query contains syntax errors or incomplete method chains']
        };
      }

      // Check for malformed JSON - disabled for now due to false positives
      // if (this.hasMalformedJson(queryText)) {
      //   return {
      //     original: queryText,
      //     sql: '',
      //     error: 'Malformed JSON detected in query',
      //     warnings: ['Query contains invalid JSON syntax']
      //   };
      // }

      // Handle RPC calls
      if (queryText.includes('supabase.rpc(')) {
        return this.parseRpcQuery(queryText);
      }
      
      // Handle auth queries
      if (queryText.includes('auth.uid()') || queryText.includes('auth.admin')) {
        return this.parseAuthQuery(queryText);
      }
      
      // Handle JSONB queries
      if (queryText.includes('->>') || queryText.includes('@>')) {
        return this.parseJsonbQuery(queryText);
      }
      
      // Default parsing
      return this.parseQuery(queryText);
    } catch (error) {
      return {
        original: queryText,
        sql: '',
        error: error instanceof Error ? error.message : 'Complex query parsing failed',
        warnings: []
      };
    }
  }

  /**
   * Checks if a query string contains malformed syntax that would prevent parsing.
   * 
   * @param queryText - The query string to validate
   * @returns True if the query is malformed, false otherwise
   * 
   * @example
   * ```typescript
   * this.isMalformedQuery("supabase.from('users').select("); // true - unmatched parentheses
   * this.isMalformedQuery("supabase.from('').select('*')"); // true - empty table name
   * this.isMalformedQuery("supabase.from('users').select('*')"); // false - valid query
   * ```
   */
  private isMalformedQuery(queryText: string): boolean {
    // Check for unmatched parentheses
    const openParens = (queryText.match(/\(/g) || []).length;
    const closeParens = (queryText.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return true;
    }

    // Check for incomplete method chains
    if (queryText.includes('.select(') && !queryText.includes(')')) {
      return true;
    }

    // Check for empty table names
    const tableMatch = queryText.match(/supabase\.from\(['"`]([^'"`]*)['"`]\)/);
    if (tableMatch && !tableMatch[1].trim()) {
      return true;
    }

    return false;
  }

  private parseRpcQuery(queryText: string): ParsedQuery {
    // Extract RPC function name and parameters with better regex
    const rpcMatch = queryText.match(/supabase\.rpc\(['"`]([^'"`]+)['"`],\s*({[^}]+})\)/);
    
    if (rpcMatch) {
      const functionName = rpcMatch[1];
      const params = rpcMatch[2];
      
      const sql = `SELECT * FROM ${functionName}(${params})`;
      
      return {
        original: queryText,
        sql: sql,
        warnings: ['RPC calls may have different parameter handling in SQL']
      };
    }

    // Handle RPC calls with complex nested parameters
    const complexRpcMatch = queryText.match(/supabase\.rpc\(['"`]([^'"`]+)['"`],\s*({.*})\)/s);
    
    if (complexRpcMatch) {
      const functionName = complexRpcMatch[1];
      const params = complexRpcMatch[2];
      
      const sql = `SELECT * FROM ${functionName}(${params})`;
      
      return {
        original: queryText,
        sql: sql,
        warnings: ['RPC calls with complex parameters may require manual SQL adjustment']
      };
    }
    
    return {
      original: queryText,
      sql: '',
      error: 'Invalid RPC query format',
      warnings: []
    };
  }

  private parseAuthQuery(queryText: string): ParsedQuery {
    // Handle auth-specific queries
    const sql = queryText
      .replace(/auth\.uid\(\)/g, 'auth.uid()')
      .replace(/auth\.admin\.from\(/g, 'FROM ')
      .replace(/supabase\.from\(/g, 'FROM ');
    
    return {
      original: queryText,
      sql: `SELECT * ${sql}`,
      warnings: ['Auth queries may require RLS policies to be properly configured']
    };
  }

  private parseJsonbQuery(queryText: string): ParsedQuery {
    // Handle JSONB-specific operations
    const sql = queryText
      .replace(/->>/g, '->>')
      .replace(/@>/g, '@>')
      .replace(/supabase\.from\(/g, 'FROM ');
    
    return {
      original: queryText,
      sql: `SELECT * ${sql}`,
      warnings: ['JSONB operations may require specific PostgreSQL functions']
    };
  }
} 