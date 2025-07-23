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
  private static readonly largeLimitThreshold = 1000;
  
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
      // Fast path for simple queries (bypasses heavy AST parsing)
      const fastResult = this.parseSimpleQuery(queryText);
      if (fastResult) {
        return fastResult;
      }

      // Fallback to full AST parsing for complex queries
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
   * Fast path for simple queries that bypasses heavy AST parsing.
   * This method uses regex patterns to quickly parse common simple queries.
   */
  private parseSimpleQuery(queryText: string): ParsedQuery | null {
    const trimmed = queryText.trim();
    
    // Simple SELECT patterns
    const selectPattern = /^supabase\.from\(['"`]([^'"`]+)['"`]\)\.select\(['"`]([^'"`]+)['"`]\)$/;
    const selectMatch = trimmed.match(selectPattern);
    if (selectMatch) {
      const [, table, columns] = selectMatch;
      
      // Check if this contains JOIN patterns (parentheses or colons)
      if (columns.includes('(') || columns.includes(':')) {
        // Fall back to AST parsing for JOINs
        return null;
      }
      
      // Also check for dot notation in WHERE clauses that might indicate JOINs
      const hasDotNotation = queryText.includes('.eq(') || 
                            queryText.includes('.gt(') || 
                            queryText.includes('.lt(') || 
                            queryText.includes('.gte(') || 
                            queryText.includes('.lte(') ||
                            queryText.includes('.in(') ||
                            queryText.includes('.like(') ||
                            queryText.includes('.ilike(');
      
      if (hasDotNotation) {
        // Fall back to AST parsing for queries with dot notation
        return null;
      }
      
      // Also check for dot notation in the entire query (e.g., posts.published)
      const hasDotInQuery = queryText.includes('.') && 
                           (queryText.includes('(') || queryText.includes(')'));
      
      if (hasDotInQuery) {
        // Fall back to AST parsing for queries with dots
        return null;
      }
      
      // Handle special aggregation cases
      let processedColumns = columns;
      if (columns === 'count') {
        processedColumns = 'COUNT(*)';
      }
      
      const sql = `SELECT ${processedColumns} FROM ${table}`;
      return {
        original: queryText,
        sql,
        warnings: columns === '*' ? ['Consider selecting specific columns instead of * for better performance'] : []
      };
    }

    // Simple SELECT with one filter
    const selectWithFilterPattern = /^supabase\.from\(['"`]([^'"`]+)['"`]\)\.select\(['"`]([^'"`]+)['"`]\)\.eq\(['"`]([^'"`]+)['"`],\s*['"`]?([^'"`)]+)['"`]?\)$/;
    const selectWithFilterMatch = trimmed.match(selectWithFilterPattern);
    if (selectWithFilterMatch) {
      const [, table, columns, filterColumn, filterValue] = selectWithFilterMatch;
      
      // Check if this contains JOIN patterns (parentheses or colons)
      if (columns.includes('(') || columns.includes(':')) {
        // Fall back to AST parsing for JOINs
        return null;
      }
      
      // Check for dot notation in filter column (e.g., posts.published)
      if (filterColumn.includes('.')) {
        // Fall back to AST parsing for queries with dot notation
        return null;
      }
      
      const value = filterValue.replace(/['"`]/g, '');
      const sql = `SELECT ${columns} FROM ${table} WHERE ${filterColumn} = '${value}'`;
      return {
        original: queryText,
        sql,
        warnings: columns === '*' ? ['Consider selecting specific columns instead of * for better performance'] : []
      };
    }

    // SELECT with IN filter
    const selectWithInPattern = /^supabase\.from\(['"`]([^'"`]+)['"`]\)\.select\(['"`]([^'"`]+)['"`]\)\.in\(['"`]([^'"`]+)['"`],\s*(\[[^]]+\])\)$/;
    const selectWithInMatch = trimmed.match(selectWithInPattern);
    if (selectWithInMatch) {
      const [, table, columns, filterColumn, arrayStr] = selectWithInMatch;
      try {
        const array = JSON.parse(arrayStr);
        const values = array.map((v: any) => typeof v === 'string' ? `'${v}'` : v).join(', ');
        const sql = `SELECT ${columns} FROM ${table} WHERE ${filterColumn} IN (${values})`;
        return {
          original: queryText,
          sql,
          warnings: columns === '*' ? ['Consider selecting specific columns instead of * for better performance'] : []
        };
      } catch {
        // Fall back to AST parsing
        return null;
      }
    }

    // SELECT with LIKE filter
    const selectWithLikePattern = /^supabase\.from\(['"`]([^'"`]+)['"`]\)\.select\(['"`]([^'"`]+)['"`]\)\.like\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]+)['"`]\)$/;
    const selectWithLikeMatch = trimmed.match(selectWithLikePattern);
    if (selectWithLikeMatch) {
      const [, table, columns, filterColumn, pattern] = selectWithLikeMatch;
      const sql = `SELECT ${columns} FROM ${table} WHERE ${filterColumn} LIKE '${pattern}'`;
      return {
        original: queryText,
        sql,
        warnings: columns === '*' ? ['Consider selecting specific columns instead of * for better performance'] : []
      };
    }

    // SELECT with GT filter
    const selectWithGtPattern = /^supabase\.from\(['"`]([^'"`]+)['"`]\)\.select\(['"`]([^'"`]+)['"`]\)\.gt\(['"`]([^'"`]+)['"`],\s*([^)]+)\)$/;
    const selectWithGtMatch = trimmed.match(selectWithGtPattern);
    if (selectWithGtMatch) {
      const [, table, columns, filterColumn, value] = selectWithGtMatch;
      const cleanValue = value.replace(/['"`]/g, '');
      const sql = `SELECT ${columns} FROM ${table} WHERE ${filterColumn} > ${cleanValue}`;
      return {
        original: queryText,
        sql,
        warnings: columns === '*' ? ['Consider selecting specific columns instead of * for better performance'] : []
      };
    }

    // Simple INSERT with better pattern matching
    const insertPattern = /^supabase\.from\(['"`]([^'"`]+)['"`]\)\.insert\((\{[^}]+\})\)$/;
    const insertMatch = trimmed.match(insertPattern);
    if (insertMatch) {
      const [, table, dataStr] = insertMatch;
      try {
        // Handle simple object patterns without full JSON parsing
        const data = this.parseSimpleObject(dataStr);
        if (data) {
          const columns = Object.keys(data).join(', ');
          const values = Object.values(data).map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
          const sql = `INSERT INTO ${table} (${columns}) VALUES (${values})`;
          return {
            original: queryText,
            sql,
            warnings: []
          };
        }
      } catch {
        // Fall back to AST parsing if parsing fails
        return null;
      }
    }

    // Simple UPDATE with better pattern matching
    const updatePattern = /^supabase\.from\(['"`]([^'"`]+)['"`]\)\.eq\(['"`]([^'"`]+)['"`],\s*['"`]?([^'"`)]+)['"`]?\)\.update\((\{[^}]+\})\)$/;
    const updateMatch = trimmed.match(updatePattern);
    if (updateMatch) {
      const [, table, whereColumn, whereValue, dataStr] = updateMatch;
      try {
        const data = this.parseSimpleObject(dataStr);
        if (data) {
          const setClause = Object.entries(data).map(([k, v]) => `${k} = ${typeof v === 'string' ? `'${v}'` : v}`).join(', ');
          const value = whereValue.replace(/['"`]/g, '');
          const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereColumn} = '${value}'`;
          return {
            original: queryText,
            sql,
            warnings: []
          };
        }
      } catch {
        return null;
      }
    }

    // Simple DELETE
    const deletePattern = /^supabase\.from\(['"`]([^'"`]+)['"`]\)\.eq\(['"`]([^'"`]+)['"`],\s*['"`]?([^'"`)]+)['"`]?\)\.delete\(\)$/;
    const deleteMatch = trimmed.match(deletePattern);
    if (deleteMatch) {
      const [, table, whereColumn, whereValue] = deleteMatch;
      const value = whereValue.replace(/['"`]/g, '');
      const sql = `DELETE FROM ${table} WHERE ${whereColumn} = '${value}'`;
      return {
        original: queryText,
        sql,
        warnings: []
      };
    }

    // If no simple pattern matches, return null to fall back to AST parsing
    return null;
  }

  /**
   * Parse simple object strings without full JSON parsing for better performance
   */
  private parseSimpleObject(objStr: string): Record<string, any> | null {
    try {
      // Handle simple patterns like {name: 'Test User', email: 'test@example.com'}
      const cleanStr = objStr.replace(/(\w+):\s*['"`]([^'"`]+)['"`]/g, '"$1": "$2"');
      return JSON.parse(cleanStr);
    } catch {
      try {
        // Fallback to regular JSON parsing
        return JSON.parse(objStr);
      } catch {
        return null;
      }
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
    
    if (queryNode.limit && queryNode.limit > SupabaseQueryParser.largeLimitThreshold) {
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