# SupaQuery

A VS Code extension that translates Supabase JavaScript queries to SQL, HTTP requests, and cURL commands in real-time.

## 🚀 Features

- **Context Menu**: Right-click on selected Supabase query to translate
- **Keyboard Shortcut**: Use `Ctrl+Shift+T` to translate selected queries
- **Real-time Updates**: See translations as you type when the webview panel is open
- **Copy to Clipboard**: One-click copying for all translation formats

### Supported Operations

| JavaScript | SQL | HTTP | cURL |
|------------|-----|------|------|
| `.select()` | `SELECT` | `GET` | `curl -X GET` |
| `.insert()` | `INSERT` | `POST` | `curl -X POST` |
| `.update()` | `UPDATE` | `PATCH` | `curl -X PATCH` |
| `.delete()` | `DELETE` | `DELETE` | `curl -X DELETE` |
| `.upsert()` | `INSERT ON CONFLICT` | `POST` | `curl -X POST` |

### Advanced Features
- **Filtering**: `.eq()`, `.gt()`, `.like()`, `.in()`, `.contains()`, `.or()`, `.not()`
- **Joins**: Relationship queries with foreign keys
- **Auth**: `auth.uid()` patterns and RLS support
- **JSONB**: Full PostgreSQL JSONB operations

## Quick Examples

### Basic Queries
```javascript
// SELECT
supabase.from('users').select('id, name').eq('status', 'active')
// → SELECT id, name FROM users WHERE status = 'active'

// INSERT
supabase.from('users').insert({name: 'John', email: 'john@example.com'})
// → INSERT INTO users (name, email) VALUES ('John', 'john@example.com')

// UPDATE
supabase.from('users').eq('id', 1).update({name: 'Jane'})
// → UPDATE users SET name = 'Jane' WHERE id = 1
```

### Complex Queries
```javascript
// Relationships
supabase.from('users')
  .select('*, posts(title, content)')
  .eq('posts.published', true)
// → SELECT *, posts.title, posts.content FROM users JOIN posts ON posts.user_id = users.id WHERE posts.published = true

// JSONB
supabase.from('products')
  .select('metadata->>color')
  .contains('metadata', {size: 'XL'})
// → SELECT metadata->>color FROM products WHERE metadata @> '{"size":"XL"}'
```

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Compile: `npm run compile`
4. Press `F5` in VS Code to run in development mode

## Usage

1. **Context Menu**: Select a Supabase query and right-click
2. **Keyboard Shortcut**: Select a query and press `Ctrl+Shift+T`
3. **Real-time**: Keep the webview panel open for automatic updates

## ⚠️ Limitations

### Core Limitations
- **Non-SELECT Round-trip**: INSERT/UPDATE/DELETE cannot be translated back to Supabase JS
- **Dynamic Queries**: Cannot parse queries built at runtime
- **Ternary Operators**: Not supported in `.select()` statements
- **Schema Validation**: Cannot verify against actual database schema

### HTTP/cURL Limitations
- **Authentication**: No auth headers included
- **RLS Policies**: Cannot account for Row Level Security
- **Base URL**: Uses localhost; manual adjustment may be needed

### Performance
- **Large Queries**: May cause parsing delays
- **Real-time Updates**: Continuous parsing may impact performance

## Architecture

```
src/
├── parser/              # AST Processing with ts-morph
├── sql-generator/       # SQL string assembly
├── enhanced-translator.ts # Translation pipeline
├── http-translator.ts   # HTTP/cURL generation
├── webview-provider.ts  # VS Code webview
└── extension.ts         # Main extension
```

## Testing

```bash
npm run test:unit
```

**97 test cases** covering CRUD operations, filtering, joins, auth, JSONB, and edge cases.

## Dependencies

- **ts-morph**: TypeScript AST parsing
- **@supabase/sql-to-rest**: HTTP translation (SELECT only)
- **@types/vscode**: VS Code extension types

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for detailed information on:

- Setting up your development environment
- Code style guidelines
- Testing requirements
- Pull request process
- Areas for contribution

Quick start:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Roadmap

### 🚀 Core Features
- [x] Full CRUD support (SELECT, INSERT, UPDATE, DELETE, UPSERT)
- [x] Real-time translation updates
- [x] Beautiful webview interface with copy functionality
- [x] HTTP and cURL generation for all operations
- [x] Advanced filtering and joins support

### 🔧 Edge Cases & Improvements
- [ ] **Dynamic Query Support**: Runtime query building with variables
- [ ] **Ternary Operators**: Conditional expressions in `.select()` statements
- [ ] **Template Literals**: Complex template expressions and interpolation
- [ ] **Nested Subqueries**: Support for complex subquery patterns
- [ ] **Window Functions**: PostgreSQL window functions (ROW_NUMBER, RANK, etc.)
- [ ] **CTEs (Common Table Expressions)**: WITH clause support
- [ ] **Stored Procedures**: Enhanced RPC call support
- [ ] **Circular References**: Handle objects with circular dependencies
- [ ] **Multi-line Strings**: Complex multi-line string literals
- [ ] **Special Characters**: Better handling of special characters in table/column names

### 🗄️ Schema & Validation
- [ ] **Schema Introspection**: Connect to actual database for validation
- [ ] **Column Validation**: Verify columns exist in target tables
- [ ] **Relationship Validation**: Check foreign key relationships
- [ ] **Type Safety**: Runtime type checking and validation
- [ ] **RLS Policy Awareness**: Account for Row Level Security in translations

### 🔐 Authentication & Security
- [ ] **Authentication Headers**: Include auth headers in HTTP/cURL generation
- [ ] **Custom Headers**: Support for custom Supabase headers
- [ ] **API Key Management**: Secure API key handling
- [ ] **Environment Variables**: Support for different environments (dev/staging/prod)

### 🎨 User Experience
- [ ] **SQL Formatting**: Prettier-like SQL formatting options
- [ ] **Export Options**: Export to different SQL dialects (MySQL, SQLite, etc.)
- [ ] **Query History**: Save and manage translation history
- [ ] **Favorites**: Bookmark frequently used queries
- [ ] **Dark/Light Theme**: Better theme integration
- [ ] **Customizable Shortcuts**: User-defined keyboard shortcuts

### 📊 Performance & Analysis
- [ ] **Query Performance Analysis**: Identify potential performance issues
- [ ] **Query Optimization Suggestions**: Provide optimization recommendations
- [ ] **Execution Plan**: Show estimated query execution plans
- [ ] **Memory Usage Optimization**: Reduce memory footprint for large queries
- [ ] **Caching**: Cache frequently translated queries

### 🔗 Integration & Extensions
- [ ] **Supabase CLI Integration**: Work with Supabase CLI projects
- [ ] **Database Connection**: Direct database connection for validation
- [ ] **Migration Support**: Generate migration files from queries
- [ ] **API Documentation**: Auto-generate API documentation
- [ ] **Testing Framework**: Generate test cases from queries

### 🌐 Advanced Translations
- [ ] **GraphQL**: Translate to GraphQL queries
- [ ] **Prisma**: Generate Prisma query syntax
- [ ] **TypeORM**: Generate TypeORM query syntax
- [ ] **Sequelize**: Generate Sequelize query syntax
- [ ] **Multiple Output Formats**: Export to JSON, YAML, etc.

## License

MIT License

---

**Built with ❤️ for the Supabase community** 