/**
 * Represents a parsed Supabase query as a structured node.
 * 
 * This interface defines the internal representation of a Supabase query after parsing,
 * containing all the components needed to generate SQL.
 * 
 * @example
 * ```typescript
 * const queryNode: QueryNode = {
 *   type: 'select',
 *   table: 'users',
 *   columns: ['id', 'name', 'email'],
 *   where: [{ column: 'active', operator: 'eq', value: true }],
 *   limit: 10
 * };
 * ```
 */
export interface QueryNode {
  /** The type of database operation (select, insert, update, delete, upsert) */
  type: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  
  /** The target table name */
  table: string;
  
  /** Columns to select (for SELECT queries) */
  columns?: string[];
  
  /** Values to insert/update */
  values?: any[];
  
  /** WHERE clause conditions */
  where?: WhereClause[];
  
  /** JOIN clauses for related tables */
  joins?: JoinClause[];
  
  /** ORDER BY clauses */
  orderBy?: OrderByClause[];
  
  /** GROUP BY columns */
  groupBy?: string[];
  
  /** HAVING clause conditions */
  having?: HavingClause[];
  
  /** LIMIT clause value */
  limit?: number;
  
  /** OFFSET clause value */
  offset?: number;
  
  /** Whether to return a single result (throws if multiple) */
  single?: boolean;
  
  /** Whether to return a single result or null (no error if multiple) */
  maybeSingle?: boolean;
}

/**
 * Represents a WHERE clause condition in a Supabase query.
 * 
 * @example
 * ```typescript
 * const whereClause: WhereClause = {
 *   column: 'age',
 *   operator: 'gte',
 *   value: 18,
 *   logicalOperator: 'AND'
 * };
 * ```
 */
export interface WhereClause {
  /** The column name to filter on */
  column: string;
  
  /** The comparison operator */
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'not' | 'contains' | 'or' | 'textSearch' | 'fullTextSearch' | 'rangeGt' | 'rangeGte' | 'rangeLt' | 'rangeLte' | 'range';
  
  /** The value to compare against */
  value: any;
  
  /** Logical operator to combine with other conditions */
  logicalOperator?: 'AND' | 'OR';
}

/**
 * Represents a JOIN clause in a Supabase query.
 * 
 * @example
 * ```typescript
 * const joinClause: JoinClause = {
 *   table: 'posts',
 *   on: 'posts.user_id = users.id',
 *   type: 'INNER'
 * };
 * ```
 */
export interface JoinClause {
  /** The table to join with */
  table: string;
  
  /** The JOIN condition (ON clause) */
  on: string;
  
  /** The type of JOIN (INNER, LEFT, RIGHT, FULL) */
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

/**
 * Represents an ORDER BY clause in a Supabase query.
 * 
 * @example
 * ```typescript
 * const orderByClause: OrderByClause = {
 *   column: 'created_at',
 *   direction: 'DESC'
 * };
 * ```
 */
export interface OrderByClause {
  /** The column to order by */
  column: string;
  
  /** The sort direction (ASC or DESC) */
  direction: 'ASC' | 'DESC';
}

/**
 * Represents a HAVING clause condition in a Supabase query.
 * 
 * @example
 * ```typescript
 * const havingClause: HavingClause = {
 *   column: 'count',
 *   operator: 'gt',
 *   value: 5
 * };
 * ```
 */
export interface HavingClause {
  /** The column or aggregate to filter on */
  column: string;
  
  /** The comparison operator */
  operator: string;
  
  /** The value to compare against */
  value: any;
}

/**
 * The result of parsing a Supabase JavaScript query.
 * 
 * This interface represents the output of the parser, containing the generated SQL,
 * any errors that occurred, and performance warnings.
 * 
 * @example
 * ```typescript
 * const result: ParsedQuery = {
 *   original: "supabase.from('users').select('*')",
 *   sql: "SELECT * FROM users",
 *   warnings: ["Consider selecting specific columns instead of * for better performance"]
 * };
 * ```
 */
export interface ParsedQuery {
  /** The original Supabase JavaScript query string */
  original: string;
  
  /** The generated SQL query (undefined if parsing failed) */
  sql?: string;
  
  /** Error message if parsing failed (undefined if successful) */
  error?: string;
  
  /** Array of performance and safety warnings */
  warnings?: string[];
}

/**
 * Context information used during query parsing.
 * 
 * This interface maintains state information that's needed across different
 * parsing stages, such as the current table, table aliases, and authentication context.
 * 
 * @example
 * ```typescript
 * const context: ParserContext = {
 *   currentTable: 'users',
 *   aliases: new Map([['u', 'users']]),
 *   authContext: { userId: 'user123', isAdmin: false }
 * };
 * ```
 */
export interface ParserContext {
  /** The current table being queried */
  currentTable: string;
  
  /** Map of table aliases to actual table names */
  aliases: Map<string, string>;
  
  /** Authentication context for Row Level Security (RLS) */
  authContext?: {
    /** Current user ID */
    userId?: string;
    
    /** Whether the current user has admin privileges */
    isAdmin?: boolean;
  };
} 