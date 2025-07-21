import { ParsedQuery } from './types';
import { QueryVisitor } from './query-visitor';
import { SqlGenerator } from '../sql-generator';
import { AstParser } from './ast-parser';

export class SupabaseQueryParser {
  private visitor: QueryVisitor;
  private sqlGenerator: SqlGenerator;
  private astParser: AstParser;

  constructor() {
    this.visitor = new QueryVisitor();
    this.sqlGenerator = new SqlGenerator();
    this.astParser = new AstParser();
  }

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



  private generateWarnings(queryNode: any): string[] {
    const warnings: string[] = [];
    
    // Check for potential issues
    if (queryNode.type === 'select' && queryNode.columns?.includes('*')) {
      warnings.push('Consider selecting specific columns instead of * for better performance');
    }
    
    if (queryNode.where && queryNode.where.length === 0 && queryNode.type === 'delete') {
      warnings.push('DELETE query without WHERE clause will delete all rows');
    }
    
    if (queryNode.limit && queryNode.limit > 1000) {
      warnings.push('Large LIMIT value may impact performance');
    }
    
    return warnings;
  }

  // Parse specific query patterns
  parseSelectQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  parseInsertQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  parseUpdateQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  parseDeleteQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  parseUpsertQuery(queryText: string): ParsedQuery {
    return this.parseQuery(queryText);
  }

  // Set auth context for RLS support
  setAuthContext(userId?: string, isAdmin: boolean = false): void {
    this.visitor.setAuthContext(userId, isAdmin);
  }

  // Parse complex queries with multiple patterns
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

  private hasMalformedJson(queryText: string): boolean {
    // Look for malformed JSON patterns that are likely to cause issues
    // Check for unmatched braces in object literals
    const braceMatches = queryText.match(/\{[^{}]*\}/g);
    if (braceMatches) {
      for (const match of braceMatches) {
        // Skip if it's a valid simple object
        try {
          JSON.parse(match);
        } catch {
          // Check if it's a common malformed pattern
          if (match.includes('invalid: json') || 
              match.includes('undefined:') ||
              match.includes('null:') ||
              /[a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*[^"'\d\[\]{}]/.test(match)) {
            return true;
          }
        }
      }
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