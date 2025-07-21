import { QueryNode, ParsedQuery, ParserContext } from './types';
import { CrudParser } from './crud';
import { FilterParser } from './filters';
import { JoinParser } from './joins';

export class QueryVisitor {
  private context: ParserContext;
  private crudParser: CrudParser;
  private filterParser: FilterParser;
  private joinParser: JoinParser;

  constructor() {
    this.context = {
      currentTable: '',
      aliases: new Map(),
      authContext: {
        userId: undefined,
        isAdmin: false
      }
    };
    
    this.crudParser = new CrudParser(this.context);
    this.filterParser = new FilterParser(this.context);
    this.joinParser = new JoinParser(this.context);
  }

  visitCallExpression(call: any): QueryNode {
    const methodName = call.getName();
    const args = call.getArguments();

    switch (methodName) {
      case 'from':
        return this.visitFromCall(args);
      case 'select':
        return this.visitSelectCall(args);
      case 'insert':
        return this.visitInsertCall(args);
      case 'update':
        return this.visitUpdateCall(args);
      case 'delete':
        return this.visitDeleteCall(args);
      case 'upsert':
        return this.visitUpsertCall(args);
      case 'eq':
      case 'neq':
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
      case 'like':
      case 'ilike':
      case 'in':
      case 'contains':
      case 'or':
      case 'not':
        return this.visitFilterCall(methodName, args);
      case 'order':
        return this.visitOrderCall(args);
      case 'limit':
        return this.visitLimitCall(args);
      case 'offset':
        return this.visitOffsetCall(args);
      case 'single':
      case 'maybeSingle':
        return this.visitSingleCall(methodName, args);
      case 'group':
        return this.visitGroupCall(args);
      case 'having':
        return this.visitHavingCall(args);
      case 'textSearch':
        return this.visitTextSearchCall(args);
      case 'fullTextSearch':
        return this.visitFullTextSearchCall(args);
      case 'rangeGt':
      case 'rangeGte':
      case 'rangeLt':
      case 'rangeLte':
        return this.visitRangeCall(methodName, args);
      default:
        throw new Error(`Unsupported method: ${methodName}`);
    }
  }

  private visitFromCall(args: any[]): QueryNode {
    const tableName = this.extractStringValue(args[0]);
    this.context.currentTable = tableName;
    
    return {
      type: 'select',
      table: tableName,
      columns: ['*']
    };
  }

  private visitSelectCall(args: any[]): QueryNode {
    // Handle select() without arguments - default to selecting all columns
    const selectArg = args.length > 0 ? this.extractStringValue(args[0]) : '*';
    
    // Handle special aggregation cases
    if (selectArg === 'count') {
      return {
        type: 'select',
        table: this.context.currentTable,
        columns: ['COUNT(*)']
      };
    }
    
    const { columns, joins } = this.joinParser.parseSelectWithJoins(selectArg);
    
    return {
      type: 'select',
      table: this.context.currentTable,
      columns: columns,
      joins: joins
    };
  }

  private visitInsertCall(args: any[]): QueryNode {
    const result = this.crudParser.parseInsert([{ getName: () => 'insert', getArguments: () => args }]);
    result.table = this.context.currentTable;
    return result;
  }

  private visitUpdateCall(args: any[]): QueryNode {
    const result = this.crudParser.parseUpdate([{ getName: () => 'update', getArguments: () => args }]);
    result.table = this.context.currentTable;
    return result;
  }

  private visitDeleteCall(args: any[]): QueryNode {
    const result = this.crudParser.parseDelete([{ getName: () => 'delete', getArguments: () => args }]);
    result.table = this.context.currentTable;
    return result;
  }

  private visitUpsertCall(args: any[]): QueryNode {
    const result = this.crudParser.parseUpsert([{ getName: () => 'upsert', getArguments: () => args }]);
    result.table = this.context.currentTable;
    return result;
  }

  private visitFilterCall(methodName: string, args: any[]): QueryNode {
    let whereClauses: any[] = [];

    switch (methodName) {
      case 'or':
        const orArg = this.extractStringValue(args[0]);
        whereClauses = this.filterParser.parseOrClause(orArg);
        break;
      case 'not':
        const notArg = this.extractStringValue(args[0]);
        whereClauses = [this.filterParser.parseNotClause(notArg)];
        break;
      case 'in':
        const column = this.extractStringValue(args[0]);
        const values = this.extractArrayValue(args[1]);
        whereClauses = [this.filterParser.parseInClause(column, values)];
        break;
      case 'contains':
        const containsColumn = this.extractStringValue(args[0]);
        const containsValue = this.extractValue(args[1]);
        whereClauses = [this.filterParser.parseContainsClause(containsColumn, containsValue)];
        break;
      default:
        // Handle standard comparison operators
        const filterColumn = this.extractStringValue(args[0]);
        const filterValue = this.extractValue(args[1]);
        
        // Check for auth context
        if (typeof filterValue === 'string' && filterValue.includes('auth.uid()')) {
          whereClauses = [this.filterParser.parseAuthClause(filterColumn, filterValue)];
        } else {
          whereClauses = [{
            column: filterColumn,
            operator: methodName as any,
            value: filterValue
          }];
        }
        break;
    }

    return {
      type: 'select',
      table: this.context.currentTable,
      where: whereClauses
    };
  }

  private visitOrderCall(args: any[]): QueryNode {
    const orderArg = this.extractStringValue(args[0]);
    const [column, direction] = orderArg.split('.');
    
    return {
      type: 'select',
      table: this.context.currentTable,
      orderBy: [{
        column: column,
        direction: direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
      }]
    };
  }

  private visitLimitCall(args: any[]): QueryNode {
    const limit = this.extractNumberValue(args[0]);
    
    return {
      type: 'select',
      table: this.context.currentTable,
      limit: limit
    };
  }

  private visitOffsetCall(args: any[]): QueryNode {
    const offset = this.extractNumberValue(args[0]);
    
    return {
      type: 'select',
      table: this.context.currentTable,
      offset: offset
    };
  }

  private visitSingleCall(methodName: string, args: any[]): QueryNode {
    // single() and maybeSingle() are modifiers that affect the result handling
    // They don't change the SQL but add a LIMIT 1 and affect error handling
    return {
      type: 'select',
      table: this.context.currentTable,
      limit: 1,
      single: methodName === 'single',
      maybeSingle: methodName === 'maybeSingle'
    };
  }

  // Helper methods to extract values from AST nodes
  private extractStringValue(node: any): string {
    if (!node) {
      return '*';
    }
    if (node.getText) {
      return node.getText().replace(/['"]/g, '');
    }
    return String(node);
  }

  private extractNumberValue(node: any): number {
    if (!node) {
      return 0;
    }
    if (node.getText) {
      return Number(node.getText());
    }
    return Number(node);
  }

  private extractArrayValue(node: any): any[] {
    if (!node) {
      return [];
    }
    if (node.getText) {
      const text = node.getText();
      try {
        return JSON.parse(text);
      } catch {
        // Handle simple array format like [1,2,3]
        return text.replace(/[\[\]]/g, '').split(',').map((item: string) => item.trim());
      }
    }
    return Array.isArray(node) ? node : [node];
  }

  private extractValue(node: any): any {
    if (!node) {
      return null;
    }
    if (node.getText) {
      const text = node.getText();
      
      // Try to parse as JSON
      try {
        return JSON.parse(text);
      } catch {
        // Handle different value types
        if (text === 'true') return true;
        if (text === 'false') return false;
        if (text === 'null') return null;
        if (!isNaN(Number(text))) return Number(text);
        return text.replace(/['"]/g, '');
      }
    }
    return node;
  }

  // Parse a complete method chain
  parseMethodChain(methodChain: any[]): QueryNode {
    let queryNode: QueryNode | null = null;
    
    for (const call of methodChain) {
      const methodName = call.getName();
      
      if (methodName === 'from') {
        queryNode = this.visitCallExpression(call);
      } else if (['insert', 'update', 'delete', 'upsert'].includes(methodName)) {
        // CRUD operations should replace the query type
        queryNode = this.visitCallExpression(call);
      } else if (queryNode) {
        // Merge subsequent method calls into the existing query node
        const newCall = this.visitCallExpression(call);
        queryNode = this.mergeQueryNodes(queryNode, newCall);
      }
    }
    
    if (!queryNode) {
      throw new Error('No valid query found in method chain');
    }
    
    return queryNode;
  }

  private mergeQueryNodes(base: QueryNode, addition: QueryNode): QueryNode {
    // Special handling for INSERT + SELECT combination
    if (base.type === 'insert' && addition.type === 'select') {
      return {
        ...base,
        columns: addition.columns || ['*'], // Use SELECT columns as RETURNING columns
        where: [...(base.where || []), ...(addition.where || [])],
        joins: [...(base.joins || []), ...(addition.joins || [])],
        orderBy: [...(base.orderBy || []), ...(addition.orderBy || [])],
        groupBy: [...(base.groupBy || []), ...(addition.groupBy || [])],
        having: [...(base.having || []), ...(addition.having || [])],
        limit: addition.limit || base.limit,
        offset: addition.offset || base.offset,
        single: addition.single || base.single,
        maybeSingle: addition.maybeSingle || base.maybeSingle
      };
    }

    // Merge WHERE clauses with proper logical operators
    const mergedWhere = [...(base.where || [])];
    if (addition.where && addition.where.length > 0) {
      // If base has WHERE clauses, the first addition should use AND
      if (mergedWhere.length > 0) {
        addition.where[0].logicalOperator = 'AND';
      }
      mergedWhere.push(...addition.where);
    }

    return {
      ...base,
      columns: addition.columns || base.columns,
      values: addition.values || base.values,
      where: mergedWhere,
      joins: [...(base.joins || []), ...(addition.joins || [])],
      orderBy: [...(base.orderBy || []), ...(addition.orderBy || [])],
      groupBy: [...(base.groupBy || []), ...(addition.groupBy || [])],
      having: [...(base.having || []), ...(addition.having || [])],
      limit: addition.limit || base.limit,
      offset: addition.offset || base.offset,
      single: addition.single || base.single,
      maybeSingle: addition.maybeSingle || base.maybeSingle
    };
  }

  private visitGroupCall(args: any[]): QueryNode {
    const groupBy = this.extractStringValue(args[0]);
    return {
      type: 'select',
      table: this.context.currentTable,
      groupBy: [groupBy]
    };
  }

  private visitHavingCall(args: any[]): QueryNode {
    const column = this.extractStringValue(args[0]);
    const operator = this.extractStringValue(args[1]);
    const value = this.extractValue(args[2]);
    
    return {
      type: 'select',
      table: this.context.currentTable,
      having: [{
        column,
        operator,
        value
      }]
    };
  }

  private visitTextSearchCall(args: any[]): QueryNode {
    const column = this.extractStringValue(args[0]);
    const searchTerm = this.extractStringValue(args[1]);
    
    return {
      type: 'select',
      table: this.context.currentTable,
      where: [{
        column,
        operator: 'textSearch',
        value: searchTerm
      }]
    };
  }

  private visitFullTextSearchCall(args: any[]): QueryNode {
    const column = this.extractStringValue(args[0]);
    const searchTerm = this.extractStringValue(args[1]);
    
    return {
      type: 'select',
      table: this.context.currentTable,
      where: [{
        column,
        operator: 'fullTextSearch',
        value: searchTerm
      }]
    };
  }

  private visitRangeCall(methodName: string, args: any[]): QueryNode {
    const column = this.extractStringValue(args[0]);
    const value = this.extractValue(args[1]);
    
    let operator: 'rangeGt' | 'rangeGte' | 'rangeLt' | 'rangeLte' | 'range';
    switch (methodName) {
      case 'rangeGt':
        operator = 'rangeGt';
        break;
      case 'rangeGte':
        operator = 'rangeGte';
        break;
      case 'rangeLt':
        operator = 'rangeLt';
        break;
      case 'rangeLte':
        operator = 'rangeLte';
        break;
      default:
        operator = 'range';
    }
    
    return {
      type: 'select',
      table: this.context.currentTable,
      where: [{
        column,
        operator,
        value
      }]
    };
  }

  // Set auth context for RLS support
  setAuthContext(userId?: string, isAdmin: boolean = false): void {
    this.context.authContext = { userId, isAdmin };
  }
} 