import { QueryNode, WhereClause, JoinClause, OrderByClause } from '../parser/types';
import { FilterParser } from '../parser/filters';
import { JoinParser } from '../parser/joins';

export class SqlGenerator {
  private filterParser: FilterParser;
  private joinParser: JoinParser;

  constructor() {
    this.filterParser = new FilterParser({ currentTable: '', aliases: new Map() });
    this.joinParser = new JoinParser({ currentTable: '', aliases: new Map() });
  }

  generateSql(queryNode: QueryNode): string {
    switch (queryNode.type) {
      case 'select':
        return this.generateSelectSql(queryNode);
      case 'insert':
        return this.generateInsertSql(queryNode);
      case 'update':
        return this.generateUpdateSql(queryNode);
      case 'delete':
        return this.generateDeleteSql(queryNode);
      case 'upsert':
        return this.generateUpsertSql(queryNode);
      default:
        throw new Error(`Unsupported query type: ${queryNode.type}`);
    }
  }

  private generateSelectSql(queryNode: QueryNode): string {
    const columns = queryNode.columns?.join(', ') || '*';
    const fromClause = `FROM ${queryNode.table}`;
    
    let sql = `SELECT ${columns} ${fromClause}`;
    
    // Add JOINs
    if (queryNode.joins && queryNode.joins.length > 0) {
      const joinClause = this.joinParser.buildJoinClause(queryNode.joins);
      sql += ` ${joinClause}`;
    }
    
    // Add WHERE clause
    if (queryNode.where && queryNode.where.length > 0) {
      const whereClause = this.filterParser.buildWhereClause(queryNode.where);
      sql += ` WHERE ${whereClause}`;
    }
    
    // Add ORDER BY
    if (queryNode.orderBy && queryNode.orderBy.length > 0) {
      const orderByClause = queryNode.orderBy
        .map(order => `${order.column} ${order.direction}`)
        .join(', ');
      sql += ` ORDER BY ${orderByClause}`;
    }
    
    // Add LIMIT
    if (queryNode.limit) {
      sql += ` LIMIT ${queryNode.limit}`;
    }
    
    // Add OFFSET
    if (queryNode.offset) {
      sql += ` OFFSET ${queryNode.offset}`;
    }
    
    // Add comments for single/maybeSingle methods
    if (queryNode.single) {
      sql += ' -- Returns single result (throws if multiple rows)';
    } else if (queryNode.maybeSingle) {
      sql += ' -- Returns single result or null (no error if multiple rows)';
    }
    
    return sql;
  }

  private generateInsertSql(queryNode: QueryNode): string {
    if (!queryNode.values || queryNode.values.length === 0) {
      throw new Error('No values provided for INSERT query');
    }
    
    const firstValue = queryNode.values[0];
    const columns = Object.keys(firstValue);
    const columnList = columns.join(', ');
    
    const valuePlaceholders = queryNode.values.map(() => 
      `(${columns.map(() => '?').join(', ')})`
    ).join(', ');
    
    return `INSERT INTO ${queryNode.table} (${columnList}) VALUES ${valuePlaceholders}`;
  }

  private generateUpdateSql(queryNode: QueryNode): string {
    if (!queryNode.values || queryNode.values.length === 0) {
      throw new Error('No values provided for UPDATE query');
    }
    
    const firstValue = queryNode.values[0];
    const setClause = Object.keys(firstValue)
      .map(key => `${key} = ?`)
      .join(', ');
    
    let sql = `UPDATE ${queryNode.table} SET ${setClause}`;
    
    // Add WHERE clause
    if (queryNode.where && queryNode.where.length > 0) {
      const whereClause = this.filterParser.buildWhereClause(queryNode.where);
      sql += ` WHERE ${whereClause}`;
    }
    
    return sql;
  }

  private generateDeleteSql(queryNode: QueryNode): string {
    let sql = `DELETE FROM ${queryNode.table}`;
    
    // Add WHERE clause
    if (queryNode.where && queryNode.where.length > 0) {
      const whereClause = this.filterParser.buildWhereClause(queryNode.where);
      sql += ` WHERE ${whereClause}`;
    }
    
    return sql;
  }

  private generateUpsertSql(queryNode: QueryNode): string {
    if (!queryNode.values || queryNode.values.length === 0) {
      throw new Error('No values provided for UPSERT query');
    }
    
    const firstValue = queryNode.values[0];
    const columns = Object.keys(firstValue);
    const columnList = columns.join(', ');
    
    const valuePlaceholders = queryNode.values.map(() => 
      `(${columns.map(() => '?').join(', ')})`
    ).join(', ');
    
    const conflictColumns = this.detectConflictColumns(firstValue);
    const conflictClause = conflictColumns.length > 0 
      ? ` ON CONFLICT (${conflictColumns.join(', ')})` 
      : '';
    
    const updateClause = columns
      .filter(col => !conflictColumns.includes(col))
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(', ');
    
    const doUpdateClause = updateClause.length > 0 
      ? ` DO UPDATE SET ${updateClause}` 
      : ' DO NOTHING';
    
    return `INSERT INTO ${queryNode.table} (${columnList}) VALUES ${valuePlaceholders}${conflictClause}${doUpdateClause}`;
  }

  private detectConflictColumns(value: any): string[] {
    // Common primary key and unique constraint column names
    const commonKeys = ['id', 'uuid', 'email', 'username', 'code'];
    return Object.keys(value).filter(key => commonKeys.includes(key));
  }

  // Generate parameterized SQL with placeholders
  generateParameterizedSql(queryNode: QueryNode): { sql: string, params: any[] } {
    const sql = this.generateSql(queryNode);
    const params: any[] = [];
    
    // Extract parameters from the query node
    if (queryNode.values) {
      for (const value of queryNode.values) {
        if (typeof value === 'object') {
          params.push(...Object.values(value));
        } else {
          params.push(value);
        }
      }
    }
    
    return { sql, params };
  }

  // Format SQL for display
  formatSql(sql: string): string {
    // Basic SQL formatting
    return sql
      .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET|INSERT|UPDATE|DELETE|INTO|SET|VALUES|ON CONFLICT|DO UPDATE|DO NOTHING)\b/gi, '\n$1')
      .replace(/\s+/g, ' ')
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }
} 