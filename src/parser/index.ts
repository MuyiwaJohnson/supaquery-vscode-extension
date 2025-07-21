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

  private parseRpcQuery(queryText: string): ParsedQuery {
    // Extract RPC function name and parameters
    const rpcMatch = queryText.match(/supabase\.rpc\(['"]([^'"]+)['"],\s*({[^}]+})\)/);
    
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