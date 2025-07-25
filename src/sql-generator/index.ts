import { QueryNode } from '../parser/types';
import { FilterParser } from '../parser/filters';
import { JoinParser } from '../parser/joins';

/**
 * SQL generator for converting parsed query nodes to SQL strings.
 * 
 * This class takes structured {@link QueryNode} objects and generates
 * corresponding SQL queries. It handles all CRUD operations (SELECT, INSERT,
 * UPDATE, DELETE, UPSERT) and includes support for JOINs, WHERE clauses,
 * ORDER BY, GROUP BY, HAVING, LIMIT, and OFFSET.
 * 
 * @example
 * ```typescript
 * const generator = new SqlGenerator();
 * 
 * const queryNode: QueryNode = {
 *   type: 'select',
 *   table: 'users',
 *   columns: ['id', 'name', 'email'],
 *   where: [{ column: 'active', operator: 'eq', value: true }],
 *   limit: 10
 * };
 * 
 * const sql = generator.generateSql(queryNode);
 * // Returns: "SELECT id, name, email FROM users WHERE active = true LIMIT 10"
 * ```
 */
export class SqlGenerator {
  /** Parser for handling WHERE clause conditions */
  private filterParser: FilterParser;
  
  /** Parser for handling JOIN clauses */
  private joinParser: JoinParser;

  /**
   * Creates a new SqlGenerator instance with initialized parsers.
   */
  constructor() {
    this.filterParser = new FilterParser({ currentTable: '', aliases: new Map() });
    this.joinParser = new JoinParser({ currentTable: '', aliases: new Map() });
  }

  /**
   * Generates SQL from a parsed query node.
   * 
   * This method routes to the appropriate SQL generation method based on
   * the query type (SELECT, INSERT, UPDATE, DELETE, UPSERT).
   * 
   * @param queryNode - The parsed query node to convert to SQL
   * @returns Generated SQL string
   * 
   * @example
   * ```typescript
   * const sql = generator.generateSql(queryNode);
   * console.log(sql); // "SELECT id, name FROM users WHERE active = true"
   * ```
   * 
   * @throws {Error} When the query type is not supported
   */
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
    
    // Add GROUP BY
    if (queryNode.groupBy && queryNode.groupBy.length > 0) {
      const groupByClause = queryNode.groupBy.join(', ');
      sql += ` GROUP BY ${groupByClause}`;
    }
    
    // Add HAVING clause
    if (queryNode.having && queryNode.having.length > 0) {
      const havingClause = queryNode.having
        .map(having => `${having.column} ${having.operator} ${this.formatValue(having.value)}`)
        .join(' AND ');
      sql += ` HAVING ${havingClause}`;
    }
    
    // Add ORDER BY
    if (queryNode.orderBy && queryNode.orderBy.length > 0) {
      const orderByClause = queryNode.orderBy
        .map(order => `${order.column} ${order.direction}`)
        .join(', ');
      sql += ` ORDER BY ${orderByClause}`;
    }
    
    // Add LIMIT (but not for single/maybeSingle as they're handled differently in HTTP)
    if (queryNode.limit && !queryNode.single && !queryNode.maybeSingle) {
      sql += ` LIMIT ${queryNode.limit}`;
    }
    
    // Add OFFSET
    if (queryNode.offset) {
      sql += ` OFFSET ${queryNode.offset}`;
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
    
    let sql = `INSERT INTO ${queryNode.table} (${columnList}) VALUES ${valuePlaceholders}`;
    
    // Add RETURNING clause if select is specified
    if (queryNode.columns && queryNode.columns.length > 0) {
      const returningColumns = queryNode.columns.join(', ');
      sql += ` RETURNING ${returningColumns}`;
    }
    
    return sql;
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
    
    // Add RETURNING clause if select is specified
    if (queryNode.columns && queryNode.columns.length > 0) {
      const returningColumns = queryNode.columns.join(', ');
      sql += ` RETURNING ${returningColumns}`;
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
    
    // Add RETURNING clause if select is specified
    if (queryNode.columns && queryNode.columns.length > 0) {
      const returningColumns = queryNode.columns.join(', ');
      sql += ` RETURNING ${returningColumns}`;
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

  private formatValue(value: any): string {
    if (value === null) return 'NULL';
    if (value === 'auth.uid()') return 'auth.uid()';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'object') return `'${JSON.stringify(value)}'`;
    return String(value);
  }
} 