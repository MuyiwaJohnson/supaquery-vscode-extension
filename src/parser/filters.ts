import { WhereClause, ParserContext } from './types';

export class FilterParser {
  private context: ParserContext;

  constructor(context: ParserContext) {
    this.context = context;
  }

  parseOrClause(arg: string): WhereClause[] {
    const conditions = arg.split(',');
    const whereClauses: WhereClause[] = [];

    for (const condition of conditions) {
      if (condition.includes('.')) {
        // Handle dot notation like "id.eq.1"
        const parts = condition.split('.');
        if (parts.length >= 3) {
          whereClauses.push({
            column: parts[0],
            operator: parts[1] as any,
            value: this.parseValue(parts.slice(2).join('.')),
            logicalOperator: 'OR'
          });
        }
      } else {
        // Handle simple conditions
        whereClauses.push({
          column: condition,
          operator: 'eq',
          value: true,
          logicalOperator: 'OR'
        });
      }
    }

    return whereClauses;
  }

  parseNotClause(arg: string): WhereClause {
    if (arg.includes('.')) {
      const parts = arg.split('.');
      return {
        column: parts[0],
        operator: 'not',
        value: this.parseValue(parts.slice(2).join('.'))
      };
    }
    
    return {
      column: arg,
      operator: 'not',
      value: true
    };
  }

  parseInClause(column: string, values: any[]): WhereClause {
    return {
      column,
      operator: 'in',
      value: values
    };
  }

  parseContainsClause(column: string, value: any): WhereClause {
    return {
      column,
      operator: 'contains',
      value: value
    };
  }

  parseNestedAndOr(expression: string): WhereClause[] {
    const whereClauses: WhereClause[] = [];
    
    // Handle complex expressions like "and(age.gt.18,name.ilike.%a%),and(age.lt.30)"
    const groups = this.parseGroups(expression);
    
    for (const group of groups) {
      if (group.startsWith('and(') && group.endsWith(')')) {
        const innerExpr = group.slice(4, -1);
        const conditions = innerExpr.split(',');
        
        for (let i = 0; i < conditions.length; i++) {
          const condition = conditions[i];
          if (condition.includes('.')) {
            const parts = condition.split('.');
            whereClauses.push({
              column: parts[0],
              operator: parts[1] as any,
              value: this.parseValue(parts.slice(2).join('.')),
              logicalOperator: i === 0 ? undefined : 'AND'
            });
          }
        }
      } else if (group.startsWith('or(') && group.endsWith(')')) {
        const innerExpr = group.slice(3, -1);
        const orClauses = this.parseOrClause(innerExpr);
        whereClauses.push(...orClauses);
      }
    }

    return whereClauses;
  }

  parseAuthClause(column: string, value: any): WhereClause {
    // Handle auth.uid() and similar auth patterns
    if (typeof value === 'string' && value.includes('auth.uid()')) {
      return {
        column,
        operator: 'eq',
        value: 'auth.uid()'
      };
    }
    
    return {
      column,
      operator: 'eq',
      value: value
    };
  }

  private parseValue(valueStr: string): any {
    // Try to parse as number
    if (!isNaN(Number(valueStr))) {
      return Number(valueStr);
    }
    
    // Try to parse as boolean
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;
    
    // Handle quoted strings
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      return valueStr.slice(1, -1);
    }
    
    // Handle JSONB values
    if (valueStr.startsWith('{') && valueStr.endsWith('}')) {
      try {
        return JSON.parse(valueStr);
      } catch {
        return valueStr;
      }
    }
    
    return valueStr;
  }

  private parseGroups(expression: string): string[] {
    const groups: string[] = [];
    let currentGroup = '';
    let parenCount = 0;
    
    for (const char of expression) {
      if (char === '(') {
        parenCount++;
      } else if (char === ')') {
        parenCount--;
      }
      
      currentGroup += char;
      
      if (parenCount === 0 && currentGroup.trim()) {
        groups.push(currentGroup.trim());
        currentGroup = '';
      }
    }
    
    return groups;
  }

  buildWhereClause(clauses: WhereClause[]): string {
    if (clauses.length === 0) return '';
    
    const conditions = clauses.map(clause => {
      const column = clause.column;
      const operator = this.mapOperator(clause.operator);
      const value = this.formatValue(clause.value);
      
      return `${column} ${operator} ${value}`;
    });
    
    let whereClause = conditions[0];
    
    for (let i = 1; i < conditions.length; i++) {
      const logicalOp = clauses[i].logicalOperator || 'AND';
      whereClause += ` ${logicalOp} ${conditions[i]}`;
    }
    
    return whereClause;
  }

  private mapOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      'eq': '=',
      'neq': '!=',
      'gt': '>',
      'gte': '>=',
      'lt': '<',
      'lte': '<=',
      'like': 'LIKE',
      'ilike': 'ILIKE',
      'in': 'IN',
      'not': 'NOT',
      'contains': '@>'
    };
    
    return operatorMap[operator] || operator;
  }

  private formatValue(value: any): string {
    if (value === null) return 'NULL';
    if (value === 'auth.uid()') return 'auth.uid()';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'object') return `'${JSON.stringify(value)}'`;
    return String(value);
  }
} 