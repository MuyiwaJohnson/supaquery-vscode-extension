import { JoinClause, ParserContext } from './types';

/**
 * Parser for handling JOIN clauses and relationship queries in Supabase.
 * 
 * This class is responsible for parsing complex relationship syntax like:
 * - `posts(title, content)` - simple relationships
 * - `posts:user_posts(title, content)` - relationships with aliases
 * - `posts(title, comments(content, author))` - nested relationships
 * 
 * @example
 * ```typescript
 * const context: ParserContext = { currentTable: 'users', aliases: new Map() };
 * const joinParser = new JoinParser(context);
 * 
 * const result = joinParser.parseSelectWithJoins('id, name, posts(title, content)');
 * // Returns: { columns: ['id', 'name', 'posts.title', 'posts.content'], joins: [...] }
 * ```
 */
export class JoinParser {
  /** Parser context containing current table and aliases */
  private context: ParserContext;

  /**
   * Creates a new JoinParser instance.
   * 
   * @param context - Parser context with current table and alias information
   */
  constructor(context: ParserContext) {
    this.context = context;
  }

  /**
   * Parses a SELECT argument string and extracts columns and JOIN clauses.
   * 
   * This method handles various SELECT patterns:
   * - Simple columns: `"id, name, email"`
   * - Wildcard: `"*"`
   * - Simple relationships: `"posts(title, content)"`
   * - Complex nested relationships: `"posts(title, comments(content, author))"`
   * - Aliased relationships: `"posts:user_posts(title, content)"`
   * 
   * @param selectArg - The SELECT argument string to parse
   * @returns Object containing extracted columns and JOIN clauses
   * 
   * @example
   * ```typescript
   * const result = joinParser.parseSelectWithJoins('id, name, posts(title, content)');
   * // Returns: {
   * //   columns: ['id', 'name', 'posts.title', 'posts.content'],
   * //   joins: [{ table: 'posts', on: 'posts.user_id = users.id', type: 'INNER' }]
   * // }
   * ```
   */
  parseSelectWithJoins(selectArg: string): { columns: string[], joins: JoinClause[] } {
    // Check if this is a complex nested relationship query
    if (selectArg.includes('(') && (selectArg.includes(':') || this.hasNestedRelationships(selectArg))) {
      return this.parseComplexJoins(selectArg);
    }
    
    const columns: string[] = [];
    const joins: JoinClause[] = [];
    
    // Handle select arguments like "*, posts(title, content)"
    const parts = selectArg.split(',');
    
    for (const part of parts) {
      const trimmedPart = part.trim();
      
      if (trimmedPart === '*') {
        columns.push('*');
      } else if (trimmedPart.includes('(')) {
        // Handle relationship queries like "posts(title, content)"
        const [tableName, columnList] = this.parseRelationshipQuery(trimmedPart);
        const joinClause = this.createJoinClause(tableName);
        
        joins.push(joinClause);
        columns.push(...this.formatRelationshipColumns(tableName, columnList));
      } else {
        columns.push(trimmedPart);
      }
    }
    
    return { columns, joins };
  }

  private parseRelationshipQuery(part: string): [string, string[]] {
    const openParenIndex = part.indexOf('(');
    const closeParenIndex = part.lastIndexOf(')');
    
    if (openParenIndex === -1 || closeParenIndex === -1) {
      // Handle cases where parentheses might be incomplete
      const tableName = part.trim();
      return [tableName, ['*']];
    }
    
    const tablePart = part.substring(0, openParenIndex).trim();
    const columnListStr = part.substring(openParenIndex + 1, closeParenIndex);
    
    // Handle Supabase alias syntax: "table:alias" or just "table"
    let tableName: string;
    let alias: string | undefined;
    
    if (tablePart.includes(':')) {
      const [table, aliasPart] = tablePart.split(':').map(s => s.trim());
      tableName = table;
      alias = aliasPart;
      // TODO: Use alias in join conditions for better SQL generation
    } else {
      tableName = tablePart;
    }
    
    const columnList = columnListStr
      .split(',')
      .map(col => col.trim())
      .filter(col => col.length > 0);
    
    return [tableName, columnList];
  }

  private createJoinClause(tableName: string): JoinClause {
    // Assume foreign key relationship: {tableName}.{tableName}_id = {currentTable}.id
    const foreignKey = `${tableName}_id`;
    
    return {
      table: tableName,
      on: `${tableName}.${foreignKey} = ${this.context.currentTable}.id`,
      type: 'INNER'
    };
  }

  private formatRelationshipColumns(tableName: string, columns: string[]): string[] {
    return columns.map(column => `${tableName}.${column}`);
  }

  private hasNestedRelationships(selectArg: string): boolean {
    // Check if there are nested parentheses indicating nested relationships
    let openCount = 0;
    for (const char of selectArg) {
      if (char === '(') {
        openCount++;
        if (openCount > 1) {
          return true; // Found nested parentheses
        }
      } else if (char === ')') {
        openCount--;
      }
    }
    return false;
  }

  parseJoinFilters(methodChain: any[]): JoinClause[] {
    const joins: JoinClause[] = [];
    
    for (const call of methodChain) {
      const methodName = call.getName();
      const args = call.getArguments();
      
      if (methodName === 'eq' && args[0].includes('.')) {
        // Handle filters like "posts.published" which might indicate a join
        const [tableName, column] = args[0].split('.');
        
        // Check if we already have a join for this table
        const existingJoin = joins.find(join => join.table === tableName);
        if (!existingJoin) {
          joins.push(this.createJoinClause(tableName));
        }
      }
    }
    
    return joins;
  }

  buildJoinClause(joins: JoinClause[]): string {
    if (joins.length === 0) return '';
    
    return joins.map(join => 
      `${join.type} JOIN ${join.table} ON ${join.on}`
    ).join(' ');
  }

  // Handle more complex join scenarios
  parseComplexJoins(selectArg: string): { columns: string[], joins: JoinClause[] } {
    const columns: string[] = [];
    const joins: JoinClause[] = [];
    
    // First, extract regular columns (those without parentheses)
    const regularColumns = selectArg.split(',')
      .map(part => part.trim())
      .filter(part => !part.includes('(') && part.length > 0)
      .map(col => col.replace(/\)+$/, '').trim()) // Remove trailing parentheses
      .filter(col => col.length > 0);
    
    columns.push(...regularColumns);
    
    // Then handle relationship columns with parentheses
    // Use a more sophisticated approach to handle nested parentheses
    const relationshipPattern = /([\w:]+)\s*\(\s*([^()]+(?:\([^()]*\)[^()]*)*)\s*\)/g;
    let match;
    
    while ((match = relationshipPattern.exec(selectArg)) !== null) {
      const [fullMatch, tablePart, content] = match;
      
      // Parse table name and alias
      let tableName: string;
      let alias: string | undefined;
      
      if (tablePart.includes(':')) {
        const [table, aliasPart] = tablePart.split(':').map(s => s.trim());
        tableName = table;
        alias = aliasPart;
        // TODO: Use alias in join conditions for better SQL generation
      } else {
        tableName = tablePart;
      }
      
      // Create join for the main table
      const mainJoin = this.createJoinClause(tableName);
      joins.push(mainJoin);
      
      // Parse the content (handle nested relationships recursively)
      const nestedColumns = this.parseNestedColumns(tableName, content);
      columns.push(...nestedColumns);
    }
    
    return { columns, joins };
  }

  private parseNestedColumns(parentTable: string, nestedContent: string): string[] {
    const columns: string[] = [];
    
    // Handle simple column lists
    if (!nestedContent.includes('(')) {
      const columnList = nestedContent.split(',').map(col => col.trim());
      return columnList.map(col => `${parentTable}.${col}`);
    }
    
    // Handle nested relationships with aliases
    const nestedPattern = /([\w:]+)\s*\(\s*([^)]+)\s*\)/g;
    let match;
    
    while ((match = nestedPattern.exec(nestedContent)) !== null) {
      const [fullMatch, nestedTablePart, columnList] = match;
      
      // Parse nested table name and alias
      let nestedTableName: string;
      let nestedAlias: string | undefined;
      
      if (nestedTablePart.includes(':')) {
        const [table, aliasPart] = nestedTablePart.split(':').map(s => s.trim());
        nestedTableName = table;
        nestedAlias = aliasPart;
        // TODO: Use nestedAlias in column generation for better SQL
      } else {
        nestedTableName = nestedTablePart;
      }
      
      const fullTableName = `${parentTable}.${nestedTableName}`;
      
      // Clean up the column list and remove any trailing parentheses
      const cleanColumnList = columnList.replace(/\)+$/, '').trim();
      const nestedColumns = cleanColumnList.split(',').map(col => col.trim());
      columns.push(...nestedColumns.map(col => `${fullTableName}.${col}`));
    }
    
    // Also handle any remaining simple columns in the content
    const remainingContent = nestedContent.replace(/[\w:]+\s*\([^)]+\)/g, '').trim();
    if (remainingContent && !remainingContent.includes('(')) {
      const remainingColumns = remainingContent.split(',').map(col => col.trim()).filter(col => col.length > 0);
      columns.push(...remainingColumns.map(col => `${parentTable}.${col}`));
    }
    
    return columns;
  }

  // Handle custom join conditions
  parseCustomJoins(joinExpressions: string[]): JoinClause[] {
    return joinExpressions.map(expr => {
      // Expected format: "table ON condition"
      const parts = expr.split(' ON ');
      if (parts.length !== 2) {
        throw new Error(`Invalid join expression: ${expr}`);
      }
      
      const tablePart = parts[0].trim();
      const condition = parts[1].trim();
      
      // Parse table part (e.g., "LEFT JOIN posts" or just "posts")
      let tableName = tablePart;
      let joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' = 'INNER';
      
      if (tablePart.toUpperCase().includes('LEFT JOIN')) {
        joinType = 'LEFT';
        tableName = tablePart.replace(/LEFT\s+JOIN\s+/i, '').trim();
      } else if (tablePart.toUpperCase().includes('RIGHT JOIN')) {
        joinType = 'RIGHT';
        tableName = tablePart.replace(/RIGHT\s+JOIN\s+/i, '').trim();
      } else if (tablePart.toUpperCase().includes('FULL JOIN')) {
        joinType = 'FULL';
        tableName = tablePart.replace(/FULL\s+JOIN\s+/i, '').trim();
      } else if (tablePart.toUpperCase().includes('JOIN')) {
        tableName = tablePart.replace(/JOIN\s+/i, '').trim();
      }
      
      return {
        table: tableName,
        on: condition,
        type: joinType
      };
    });
  }
} 