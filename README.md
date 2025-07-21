# Supasense: Supabase Query Translator

A powerful VS Code extension that translates Supabase JavaScript queries to SQL in real-time, helping developers understand and optimize their database operations.

## Features

### 🚀 Real-time Translation
- **Hover Support**: Hover over any Supabase query to see the equivalent SQL
- **Command Palette**: Use `Ctrl+Shift+T` to translate selected queries
- **Real-time Updates**: See SQL translations as you type (configurable)

### 📊 Comprehensive Query Coverage

#### CRUD Operations
| JavaScript | SQL Equivalent |
|------------|----------------|
| `.insert()` | `INSERT INTO ...` |
| `.update()` | `UPDATE ... SET ...` |
| `.delete()` | `DELETE FROM ...` |
| `.upsert()` | `INSERT ... ON CONFLICT` |

#### Advanced Filtering
| JavaScript | SQL Equivalent |
|------------|----------------|
| `.or()` | `WHERE (a OR b)` |
| `.not()` | `WHERE NOT ...` |
| `.in()` | `WHERE id IN (1,2,3)` |
| `.contains()` | `WHERE data @> '{"k":"v"}'` |

#### Joins & Relationships
```javascript
// Input
supabase.from('users')
  .select('*, posts(title)')
  .eq('posts.published', true);

// Output SQL
SELECT *, posts.title 
FROM users 
JOIN posts ON posts.user_id = users.id 
WHERE posts.published = true;
```

#### Auth/RLS Support
- Handles `auth.uid()` patterns
- Supports admin bypass queries
- RLS policy awareness

### 🛠️ Advanced Features

- **JSONB Support**: Full support for PostgreSQL JSONB operations
- **RPC Calls**: Translate Supabase RPC function calls
- **Complex Queries**: Handle nested AND/OR conditions
- **Performance Warnings**: Get alerts for potential performance issues
- **Error Boundaries**: Graceful error handling with helpful messages
- **AST Parsing**: Uses ts-morph for accurate TypeScript/JavaScript parsing

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Press `F5` in VS Code to run the extension in development mode

## Usage

### Basic Usage

1. **Hover Translation**: Simply hover over any Supabase query in your JavaScript/TypeScript files
2. **Command Translation**: Select a query and press `Ctrl+Shift+T`
3. **Context Menu**: Right-click on queries for translation options

### Example Queries

#### Simple Select
```javascript
supabase.from('users').select('id, name, email')
```
Translates to:
```sql
SELECT id, name, email FROM users
```

#### Complex Filtering
```javascript
supabase.from('users')
  .or('and(age.gt.18,name.ilike.%a%),and(age.lt.30)')
```
Translates to:
```sql
SELECT * FROM users 
WHERE (age > 18 AND name ILIKE %a%) OR (age < 30)
```

#### JSONB Operations
```javascript
supabase.from('products')
  .select('metadata->>color')
  .contains('metadata', {size: 'XL'})
```
Translates to:
```sql
SELECT metadata->>color 
FROM products 
WHERE metadata @> '{"size":"XL"}'
```

#### Relationships
```javascript
supabase.from('users')
  .select('*, posts(title, content)')
  .eq('posts.published', true)
```
Translates to:
```sql
SELECT *, posts.title, posts.content 
FROM users 
JOIN posts ON posts.user_id = users.id 
WHERE posts.published = true
```

## Configuration

Add to your VS Code settings:

```json
{
  "supasense.enableRealtimeTranslation": true,
  "supasense.authUserId": "your-user-id",
  "supasense.isAdmin": false
}
```

### Settings

- `enableRealtimeTranslation`: Show SQL translations as you type
- `authUserId`: Set user ID for auth context
- `isAdmin`: Enable admin bypass for RLS

## Architecture

```
src/
├── parser/              # AST Processing
│   ├── types.ts         # TypeScript interfaces
│   ├── ast-parser.ts    # ts-morph AST parser
│   ├── crud.ts          # INSERT/UPDATE/DELETE
│   ├── filters.ts       # WHERE clauses
│   ├── joins.ts         # JOIN logic
│   ├── query-visitor.ts # Visitor pattern
│   └── index.ts         # Main parser
├── sql-generator/       # SQL string assembly
├── test/                # Test suite
│   ├── unit/            # Unit tests
│   ├── suite/           # Integration tests
│   └── runTest.ts       # Test runner
└── extension.ts         # VS Code extension
```

## Key Implementation Details

### ts-morph AST Parsing
The extension uses ts-morph for accurate TypeScript/JavaScript parsing:
```typescript
import { Project, SourceFile, CallExpression } from 'ts-morph';

class AstParser {
  parseQueryText(queryText: string): any[] {
    const sourceFile = this.project.createSourceFile('query.ts', queryText);
    return this.parseMethodChain(sourceFile);
  }
}
```

### Visitor Pattern
The extension uses the Visitor pattern for AST traversal:
```typescript
class QueryVisitor {
  visitCallExpression(call) {
    switch (call.getName()) {
      case 'select': /* ... */ 
      case 'eq': /* ... */
    }
  }
}
```

### Error Boundaries
Robust error handling with helpful messages:
```typescript
try {
  return parse(query);
} catch (error) {
  vscode.window.showErrorMessage(
    `Failed to parse: ${error.message}\n` +
    `Near: ${query.substring(error.position)}`
  );
}
```

## Test Cases

Run the comprehensive test suite:

```bash
npm run test
```

The test suite covers:
- ✅ CRUD operations
- ✅ Advanced filtering
- ✅ Joins & relationships
- ✅ Auth/RLS support
- ✅ JSONB operations
- ✅ RPC calls
- ✅ Edge cases
- ✅ Performance benchmarks

## Dependencies

- **ts-morph**: TypeScript AST manipulation and parsing
- **knex**: SQL query builder
- **@types/vscode**: VS Code extension types

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Roadmap

- [x] Enhanced AST parsing with ts-morph
- [ ] Support for more complex query patterns
- [ ] Integration with Supabase schema introspection
- [ ] Query performance analysis
- [ ] SQL formatting options
- [ ] Export to different SQL dialects

## License

MIT License - see LICENSE file for details

## Support

- Report issues on GitHub
- Check the test cases for usage examples
- Review the architecture documentation

---

**Built with ❤️ for the Supabase community** 