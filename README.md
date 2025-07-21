# Supabase Query Translator

A powerful VS Code extension that translates Supabase JavaScript queries to SQL, HTTP requests, cURL commands, and back to Supabase JS code in real-time, helping developers understand and optimize their database operations.

## 🚀 Features

### Real-time Translation
- **Hover Support**: Hover over any Supabase query to see the equivalent SQL
- **Command Palette**: Use `Ctrl+Shift+T` to translate selected queries
- **Real-time Updates**: See SQL translations as you type (configurable)

### 🌐 Enhanced Translation Pipeline
- **HTTP Translation**: Convert queries to PostgREST HTTP requests (`Ctrl+Shift+H`)
- **cURL Commands**: Generate executable cURL commands (`Ctrl+Shift+C`)
- **Round-trip Translation**: Supabase JS → SQL → Supabase JS (`Ctrl+Shift+R`)
- **Full Translation**: All formats in one command (`Ctrl+Shift+F`)

### 📊 Comprehensive Query Coverage

#### CRUD Operations (ALL Supported!)
| JavaScript | SQL Equivalent | HTTP Method | cURL Command |
|------------|----------------|-------------|--------------|
| `.insert()` | `INSERT INTO ...` | `POST` | `curl -X POST` |
| `.update()` | `UPDATE ... SET ...` | `PATCH` | `curl -X PATCH` |
| `.delete()` | `DELETE FROM ...` | `DELETE` | `curl -X DELETE` |
| `.upsert()` | `INSERT ... ON CONFLICT` | `POST` | `curl -X POST` |

#### Advanced Filtering
| JavaScript | SQL Equivalent |
|------------|----------------|
| `.or()` | `WHERE (a OR b)` |
| `.not()` | `WHERE NOT ...` |
| `.in()` | `WHERE id IN (1,2,3)` |
| `.contains()` | `WHERE data @> '{"k":"v"}'` |
| `.textSearch()` | `WHERE to_tsvector(...)` |
| `.fullTextSearch()` | `WHERE to_tsvector(...)` |
| `.rangeGt()`, `.rangeLt()` | `WHERE column >/</>=/<= value` |

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

### 🔄 Translation Examples

#### Supabase JS → HTTP (ALL Operations!)
```javascript
// SELECT Query
supabase.from('users').select('id, name').eq('status', 'active')
// Output: GET /rest/v1/users?select=id,name&status=eq.active

// INSERT Query
supabase.from('users').insert({name: 'John', email: 'john@example.com'})
// Output: POST /rest/v1/users with JSON body

// UPDATE Query
supabase.from('users').eq('id', 1).update({name: 'Jane'}).select('id, name')
// Output: PATCH /rest/v1/users?id=eq.1&select=id,name with JSON body

// DELETE Query
supabase.from('users').eq('id', 1).delete().select('id')
// Output: DELETE /rest/v1/users?id=eq.1&select=id
```

#### Supabase JS → cURL (ALL Operations!)
```javascript
// SELECT Query
supabase.from('books').select('title, author').order('title')
// Output: curl -G http://localhost:54321/rest/v1/books -d "select=title,author" -d "order=title.asc"

// INSERT Query
supabase.from('users').insert({name: 'John', email: 'john@example.com'})
// Output: curl -X POST "http://localhost:54321/rest/v1/users" -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'

// UPDATE Query
supabase.from('users').eq('id', 1).update({name: 'Jane'})
// Output: curl -X PATCH "http://localhost:54321/rest/v1/users?id=eq.1" -H "Content-Type: application/json" -d '{"name":"Jane"}'

// DELETE Query
supabase.from('users').eq('id', 1).delete()
// Output: curl -X DELETE "http://localhost:54321/rest/v1/users?id=eq.1"
```

#### Round-trip Translation
```javascript
// Original
supabase.from('users').select('id, name').eq('status', 'active')

// Generated SQL
SELECT id, name FROM users WHERE status = 'active'

// Round-trip Supabase JS
const { data, error } = await supabase
  .from('users')
  .select('id, name')
  .eq('status', 'active')
```

### 🛠️ Advanced Features

- **JSONB Support**: Full support for PostgreSQL JSONB operations
- **RPC Calls**: Translate Supabase RPC function calls
- **Complex Queries**: Handle nested AND/OR conditions
- **Performance Warnings**: Get alerts for potential performance issues
- **Error Boundaries**: Graceful error handling with helpful messages
- **AST Parsing**: Uses ts-morph for accurate TypeScript/JavaScript parsing
- **Edge Case Handling**: Robust handling of malformed queries, special characters, and complex scenarios

## 🎯 VS Code Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `Translate Supabase Query to SQL` | `Ctrl+Shift+T` | Convert selected query to SQL |
| `Translate to HTTP Request` | `Ctrl+Shift+H` | Convert to PostgREST HTTP request |
| `Translate to cURL Command` | `Ctrl+Shift+C` | Generate executable cURL command |
| `Round-trip Translation` | `Ctrl+Shift+R` | Supabase JS → SQL → Supabase JS |
| `Full Translation (All Formats)` | `Ctrl+Shift+F` | Generate all translation formats |

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

#### INSERT with RETURNING
```javascript
supabase.from('users')
  .insert({name: 'John', email: 'john@example.com'})
  .select('id, name, email')
```
Translates to:
```sql
INSERT INTO users (name, email) VALUES ('John', 'john@example.com') RETURNING id, name, email
```

## Configuration

Add to your VS Code settings:

```json
{
  "supabase-query-translator.enableRealtimeTranslation": true,
  "supabase-query-translator.authUserId": "your-user-id",
  "supabase-query-translator.isAdmin": false
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
├── enhanced-translator.ts # Enhanced translation pipeline
├── http-translator.ts   # Custom HTTP/cURL translator
├── test/                # Test suite
│   ├── unit/            # Unit tests
│   ├── suite/           # Integration tests
│   └── runTest.ts       # Test runner
└── extension.ts         # VS Code extension
```

## Key Implementation Details

### Enhanced Translation Pipeline
The extension now provides a complete translation pipeline:

```typescript
class EnhancedTranslator {
  async supabaseToSql(supabaseQuery: string): Promise<TranslationResult>
  async translateToHttp(supabaseQuery: string): Promise<TranslationResult>
  async translateToCurl(supabaseQuery: string): Promise<TranslationResult>
  async roundTripTranslation(supabaseQuery: string): Promise<TranslationResult>
  async fullTranslation(supabaseQuery: string): Promise<TranslationResult>
}
```

### Custom HTTP Translator
Overcomes the limitation of `sql-to-rest` library (SELECT-only) by providing full CRUD support:

```typescript
class HttpTranslator {
  private sqlToHttpRequest(sql: string): HttpRequest {
    // Supports SELECT, INSERT, UPDATE, DELETE operations
    // Generates proper HTTP methods, headers, and bodies
  }
}
```

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

## Test Coverage

Run the comprehensive test suite:

```bash
npm run test:unit
```

The test suite covers **87 test cases** including:
- ✅ **CRUD operations** (SELECT, INSERT, UPDATE, DELETE, UPSERT)
- ✅ **Advanced filtering** (OR, NOT, IN, CONTAINS, text search, range)
- ✅ **Joins & relationships** (foreign keys, self-referencing)
- ✅ **Auth/RLS support** (auth.uid(), admin bypass)
- ✅ **JSONB operations** (->>, @>, nested objects)
- ✅ **RPC calls** (function calls, complex parameters)
- ✅ **Edge cases** (malformed queries, special characters, performance)
- ✅ **HTTP/cURL translation** (all CRUD operations)
- ✅ **Round-trip translation** (Supabase JS → SQL → Supabase JS)
- ✅ **Error handling** (graceful degradation, meaningful messages)

## Dependencies

- **ts-morph**: TypeScript AST manipulation and parsing
- **@supabase/sql-to-rest**: SQL to PostgREST HTTP translation (SELECT operations)
- **@types/vscode**: VS Code extension types
- **mocha**: Testing framework
- **chai**: Assertion library

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Roadmap

- [x] Enhanced AST parsing with ts-morph
- [x] Full CRUD support for HTTP/cURL translation
- [x] Round-trip translation (Supabase JS → SQL → Supabase JS)
- [x] Comprehensive edge case handling
- [x] Performance optimization
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