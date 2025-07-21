export interface QueryNode {
  type: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  table: string;
  columns?: string[];
  values?: any[];
  where?: WhereClause[];
  joins?: JoinClause[];
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
  single?: boolean;
  maybeSingle?: boolean;
}

export interface WhereClause {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'not' | 'contains' | 'or';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface JoinClause {
  table: string;
  on: string;
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

export interface OrderByClause {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface ParsedQuery {
  original: string;
  sql: string;
  error?: string;
  warnings?: string[];
}

export interface ParserContext {
  currentTable: string;
  aliases: Map<string, string>;
  authContext?: {
    userId?: string;
    isAdmin?: boolean;
  };
} 