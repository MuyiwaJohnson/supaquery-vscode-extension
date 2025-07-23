import { QueryNode, WhereClause, ParserContext } from './types';

export class CrudParser {
  private context: ParserContext;

  constructor(context: ParserContext) {
    this.context = context;
  }

  parseInsert(methodChain: any[]): QueryNode {
    const insertCall = methodChain.find(call => call.getName() === 'insert');
    if (!insertCall) {
      throw new Error('No insert method found in query chain');
    }

    const args = insertCall.getArguments();
    const values = this.parseInsertValues(args[0]);

    return {
      type: 'insert',
      table: this.context.currentTable,
      values: values
    };
  }

  parseUpdate(methodChain: any[]): QueryNode {
    const updateCall = methodChain.find(call => call.getName() === 'update');
    if (!updateCall) {
      throw new Error('No update method found in query chain');
    }

    const args = updateCall.getArguments();
    const values = this.parseUpdateValues(args[0]);
    const whereClauses = this.parseWhereClauses(methodChain);

    return {
      type: 'update',
      table: this.context.currentTable,
      values: values,
      where: whereClauses
    };
  }

  parseDelete(methodChain: any[]): QueryNode {
    const deleteCall = methodChain.find(call => call.getName() === 'delete');
    if (!deleteCall) {
      throw new Error('No delete method found in query chain');
    }

    const whereClauses = this.parseWhereClauses(methodChain);

    return {
      type: 'delete',
      table: this.context.currentTable,
      where: whereClauses
    };
  }

  parseUpsert(methodChain: any[]): QueryNode {
    const upsertCall = methodChain.find(call => call.getName() === 'upsert');
    if (!upsertCall) {
      throw new Error('No upsert method found in query chain');
    }

    const args = upsertCall.getArguments();
    const values = this.parseInsertValues(args[0]);

    return {
      type: 'upsert',
      table: this.context.currentTable,
      values: values
    };
  }

  private parseInsertValues(arg: any): any[] {
    if (Array.isArray(arg)) {
      return arg;
    } else if (typeof arg === 'object') {
      return [arg];
    } else if (typeof arg === 'string') {
      // Handle variables like customerData - create a placeholder object
      return [{
        [arg]: '?' // Use the variable name as a placeholder
      }];
    }
    throw new Error('Invalid insert values format');
  }

  private parseUpdateValues(arg: any): any[] {
    if (typeof arg === 'object' && !Array.isArray(arg)) {
      return [arg];
    } else if (Array.isArray(arg)) {
      // Handle arrays like [{ field: value }] for update operations
      return arg;
    } else if (typeof arg === 'string') {
      // Handle variables like customerData - create a placeholder object
      return [{
        [arg]: '?' // Use the variable name as a placeholder
      }];
    }
    throw new Error('Invalid update values format');
  }

  private parseWhereClauses(methodChain: any[]): WhereClause[] {
    const whereClauses: WhereClause[] = [];
    
    for (const call of methodChain) {
      const methodName = call.getName();
      const args = call.getArguments();

      switch (methodName) {
        case 'eq':
          whereClauses.push({
            column: args[0],
            operator: 'eq',
            value: args[1]
          });
          break;
        case 'neq':
          whereClauses.push({
            column: args[0],
            operator: 'neq',
            value: args[1]
          });
          break;
        case 'gt':
          whereClauses.push({
            column: args[0],
            operator: 'gt',
            value: args[1]
          });
          break;
        case 'gte':
          whereClauses.push({
            column: args[0],
            operator: 'gte',
            value: args[1]
          });
          break;
        case 'lt':
          whereClauses.push({
            column: args[0],
            operator: 'lt',
            value: args[1]
          });
          break;
        case 'lte':
          whereClauses.push({
            column: args[0],
            operator: 'lte',
            value: args[1]
          });
          break;
        case 'like':
          whereClauses.push({
            column: args[0],
            operator: 'like',
            value: args[1]
          });
          break;
        case 'ilike':
          whereClauses.push({
            column: args[0],
            operator: 'ilike',
            value: args[1]
          });
          break;
        case 'in':
          whereClauses.push({
            column: args[0],
            operator: 'in',
            value: args[1]
          });
          break;
        case 'contains':
          whereClauses.push({
            column: args[0],
            operator: 'contains',
            value: args[1]
          });
          break;
        case 'rangeGt':
          whereClauses.push({
            column: args[0],
            operator: 'rangeGt',
            value: args[1]
          });
          break;
        case 'rangeGte':
          whereClauses.push({
            column: args[0],
            operator: 'rangeGte',
            value: args[1]
          });
          break;
        case 'rangeLt':
          whereClauses.push({
            column: args[0],
            operator: 'rangeLt',
            value: args[1]
          });
          break;
        case 'rangeLte':
          whereClauses.push({
            column: args[0],
            operator: 'rangeLte',
            value: args[1]
          });
          break;
        case 'range':
          whereClauses.push({
            column: args[0],
            operator: 'range',
            value: args[1]
          });
          break;
      }
    }

    return whereClauses;
  }
} 