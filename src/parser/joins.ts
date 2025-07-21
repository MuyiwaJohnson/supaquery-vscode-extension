import { JoinClause, QueryNode, ParserContext } from './types';

export class JoinParser {
  private context: ParserContext;

  constructor(context: ParserContext) {
    this.context = context;
  }

  parseSelectWithJoins(selectArg: string): { columns: string[], joins: JoinClause[] } {
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
    
    const tableName = part.substring(0, openParenIndex).trim();
    const columnListStr = part.substring(openParenIndex + 1, closeParenIndex);
    
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
    
    // Handle nested relationships like "posts(comments(content))"
    const nestedPattern = /(\w+)\(([^()]+(?:\([^()]*\)[^()]*)*)\)/g;
    let match;
    
    while ((match = nestedPattern.exec(selectArg)) !== null) {
      const [fullMatch, tableName, nestedContent] = match;
      
      // Create join for the main table
      const mainJoin = this.createJoinClause(tableName);
      joins.push(mainJoin);
      
      // Parse nested content
      const nestedColumns = this.parseNestedColumns(tableName, nestedContent);
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
    
    // Handle nested relationships
    const nestedPattern = /(\w+)\(([^()]+)\)/g;
    let match;
    
    while ((match = nestedPattern.exec(nestedContent)) !== null) {
      const [fullMatch, nestedTable, columnList] = match;
      const fullTableName = `${parentTable}.${nestedTable}`;
      
      const columns = columnList.split(',').map(col => col.trim());
      columns.push(...columns.map(col => `${fullTableName}.${col}`));
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