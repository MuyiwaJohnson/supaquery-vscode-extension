import { Project, SourceFile, CallExpression, Node, SyntaxKind, StringLiteral, ObjectLiteralExpression, ArrayLiteralExpression, PropertyAssignment, Identifier } from 'ts-morph';
import { QueryNode, WhereClause } from './types';

/**
 * AST (Abstract Syntax Tree) parser for Supabase JavaScript queries.
 * 
 * This class uses the ts-morph library to parse JavaScript/TypeScript code
 * and extract method chains from Supabase queries. It provides a structured
 * way to analyze the syntax of Supabase client calls.
 * 
 * @example
 * ```typescript
 * const astParser = new AstParser();
 * const methodChain = astParser.parseQueryText(`
 *   supabase.from('users').select('id, name').eq('active', true)
 * `);
 * 
 * // Returns an array of method call objects with getName(), getArguments(), etc.
 * ```
 */
export class AstParser {
  /** ts-morph project instance for parsing TypeScript/JavaScript code */
  private project: Project;

  /**
   * Creates a new AstParser instance with TypeScript compiler configuration.
   */
  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // ES2020
        module: 1, // CommonJS
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true
      }
    });
  }

  /**
   * Parses a Supabase query string and extracts method calls.
   * 
   * This method creates a temporary TypeScript file and uses the AST to find
   * all call expressions that are related to Supabase operations.
   * 
   * @param queryText - The Supabase JavaScript query string to parse
   * @returns Array of method call objects with getName(), getArguments(), etc.
   * 
   * @example
   * ```typescript
   * const methodCalls = astParser.parseQuery(`
   *   supabase.from('users').select('id, name').eq('active', true)
   * `);
   * 
   * // Returns: [
   * //   { getName: () => 'from', getArguments: () => ['users'], ... },
   * //   { getName: () => 'select', getArguments: () => ['id, name'], ... },
   * //   { getName: () => 'eq', getArguments: () => ['active', true], ... }
   * // ]
   * ```
   */
  parseQuery(queryText: string): any[] {
    // Create a temporary source file with unique name
    const filename = `temp_${Date.now()}.ts`;
    const sourceFile = this.project.createSourceFile(filename, queryText, { overwrite: true });
    
    // Find all call expressions
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    // Filter for Supabase-related calls
    const supabaseCalls = callExpressions.filter(call => {
      const expression = call.getExpression();
      const text = expression.getText();
      return text.includes('supabase') || 
             text.includes('.from') || 
             text.includes('.select') || 
             text.includes('.insert') || 
             text.includes('.update') || 
             text.includes('.delete') || 
             text.includes('.upsert') ||
             text.includes('.eq') ||
             text.includes('.or') ||
             text.includes('.not') ||
             text.includes('.in') ||
             text.includes('.contains');
    });

    return supabaseCalls.map(call => this.createMethodCall(call));
  }

  private createMethodCall(callExpression: CallExpression): any {
    const expression = callExpression.getExpression();
    const methodName = this.extractMethodName(expression);
    const arguments_ = callExpression.getArguments().map(arg => this.parseArgument(arg));

    return {
      getName: () => methodName,
      getArguments: () => arguments_,
      getText: () => callExpression.getText(),
      getExpression: () => expression.getText()
    };
  }

  private extractMethodName(expression: Node): string {
    const text = expression.getText();
    
    // Handle different expression types
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propertyAccess = expression.asKind(SyntaxKind.PropertyAccessExpression);
      if (propertyAccess) {
        return propertyAccess.getNameNode().getText();
      }
    }
    
    // Fallback: extract method name from text
    const methodMatch = text.match(/\.(\w+)\s*$/);
    if (methodMatch) {
      return methodMatch[1];
    }
    
    // Handle cases where the expression might be just the method name
    if (text.includes('supabase.from')) {
      return 'from';
    }
    if (text.includes('supabase.rpc')) {
      return 'rpc';
    }
    
    return text;
  }

  private parseArgument(node: Node): any {
    switch (node.getKind()) {
      case SyntaxKind.StringLiteral:
        return this.parseStringLiteral(node.asKind(SyntaxKind.StringLiteral)!);
      
      case SyntaxKind.NoSubstitutionTemplateLiteral:
      case SyntaxKind.TemplateExpression:
        return this.parseTemplateLiteral(node);
      
      case SyntaxKind.ObjectLiteralExpression:
        return this.parseObjectLiteral(node.asKind(SyntaxKind.ObjectLiteralExpression)!);
      
      case SyntaxKind.ArrayLiteralExpression:
        return this.parseArrayLiteral(node.asKind(SyntaxKind.ArrayLiteralExpression)!);
      
      case SyntaxKind.ConditionalExpression:
        throw new Error('Dynamic select statements with ternary operators are not supported. Please build your select string outside of the query.');

      case SyntaxKind.NumericLiteral:
        return Number(node.getText());
      
      case SyntaxKind.TrueKeyword:
        return true;
      
      case SyntaxKind.FalseKeyword:
        return false;
      
      case SyntaxKind.NullKeyword:
        return null;
      
      case SyntaxKind.Identifier:
        return this.parseIdentifier(node.asKind(SyntaxKind.Identifier)!);
      
      default:
        return node.getText();
    }
  }

  private parseStringLiteral(node: StringLiteral): string {
    return node.getLiteralValue();
  }

  private parseTemplateLiteral(node: Node): string {
    // For template literals, extract the text content
    const text = node.getText();
    
    // Remove backticks and handle template expressions
    if (text.startsWith('`') && text.endsWith('`')) {
      // Simple template literal without expressions
      return text.slice(1, -1);
    }
    
    // For template expressions, we'll need to handle them more carefully
    // For now, just return the raw text and let the join parser handle it
    return text;
  }

  private parseObjectLiteral(node: ObjectLiteralExpression): any {
    const result: any = {};
    
    node.getProperties().forEach(property => {
      if (property.getKind() === SyntaxKind.PropertyAssignment) {
        const propAssignment = property.asKind(SyntaxKind.PropertyAssignment)!;
        const name = propAssignment.getNameNode().getText().replace(/['"]/g, '');
        const value = this.parseArgument(propAssignment.getInitializer()!);
        result[name] = value;
      } else if (property.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
        // Handle shorthand properties like { member_id } which is equivalent to { member_id: member_id }
        const shorthandProp = property.asKind(SyntaxKind.ShorthandPropertyAssignment)!;
        const name = shorthandProp.getNameNode().getText();
        result[name] = name; // Use the name as the value for shorthand properties
      }
    });
    
    return result;
  }

  private parseArrayLiteral(node: ArrayLiteralExpression): any[] {
    return node.getElements().map(element => this.parseArgument(element));
  }

  private parseIdentifier(node: Identifier): any {
    const text = node.getText();
    
    // Handle special cases like auth.uid()
    if (text.includes('auth.uid')) {
      return 'auth.uid()';
    }
    
    if (text.includes('supabase.auth.currentUser')) {
      return 'supabase.auth.currentUser';
    }
    
    return text;
  }

  // Parse a complete method chain from a source file
  parseMethodChain(sourceFile: SourceFile): any[] {
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    // Find the longest call expression (which should contain the full chain)
    let longestCall = null;
    let maxLength = 0;
    
    for (const call of callExpressions) {
      const text = call.getText();
      if (text.length > maxLength) {
        maxLength = text.length;
        longestCall = call;
      }
    }
    
    if (!longestCall) {
      return [];
    }
    
    // Extract method calls from the longest expression
    const methodChain: any[] = [];
    
    // Start with the longest call
    methodChain.push(this.createMethodCall(longestCall));
    
    // Look for nested calls that might be part of the chain
    for (const call of callExpressions) {
      if (call !== longestCall) {
        const callText = call.getText();
        const longestText = longestCall.getText();
        
        // If this call is contained within the longest call, it's part of the chain
        if (longestText.includes(callText) && callText !== longestText) {
          methodChain.push(this.createMethodCall(call));
        }
      }
    }
    
    // Sort by position in the original text to get correct order
    methodChain.sort((a, b) => {
      const aText = a.getText();
      const bText = b.getText();
      const longestText = longestCall.getText();
      return longestText.indexOf(aText) - longestText.indexOf(bText);
    });
    
    // Reverse to get the correct order (from should be first)
    return methodChain.reverse();
  }

  // Parse a query from text and return method chain
  parseQueryText(queryText: string): any[] {
    // Create a unique filename to avoid conflicts
    const filename = `query_${Date.now()}.ts`;
    const sourceFile = this.project.createSourceFile(filename, queryText, { overwrite: true });
    return this.parseMethodChain(sourceFile);
  }

  // Extract table name from from() call
  extractTableName(call: any): string {
    const args = call.getArguments();
    if (args.length > 0 && typeof args[0] === 'string') {
      return args[0].replace(/['"]/g, '');
    }
    return '';
  }

  // Extract columns from select() call
  extractColumns(call: any): string[] {
    const args = call.getArguments();
    if (args.length > 0) {
      if (typeof args[0] === 'string') {
        return args[0].split(',').map((col: string) => col.trim());
      } else if (Array.isArray(args[0])) {
        return args[0];
      }
    }
    return ['*'];
  }

  // Extract values from insert/update/upsert calls
  extractValues(call: any): any[] {
    const args = call.getArguments();
    if (args.length > 0) {
      if (Array.isArray(args[0])) {
        // For update operations, if the array contains objects, extract them
        // This handles cases like .update([{ field: value }])
        const methodName = call.getName();
        if (methodName === 'update' && args[0].length > 0 && typeof args[0][0] === 'object') {
          return args[0]; // Return the array of objects for update
        }
        return args[0];
      } else if (typeof args[0] === 'object') {
        return [args[0]];
      }
    }
    return [];
  }

  // Extract filter conditions
  extractFilter(call: any): WhereClause | null {
    const methodName = call.getName();
    const args = call.getArguments();
    
    if (args.length < 2) return null;
    
    const column = args[0];
    const value = args[1];
    
    return {
      column: typeof column === 'string' ? column : String(column),
      operator: methodName as any,
      value: value
    };
  }
}