# SupaQuery

A VS Code extension that translates Supabase JavaScript queries to SQL, HTTP requests, and cURL commands in real-time.

## 🚀 Features

- **Context Menu**: Right-click on selected Supabase query to translate
- **Keyboard Shortcut**: Use `Ctrl+Shift+Q` to translate selected queries
- **Real-time Updates**: See translations as you type when the webview panel is open
- **Copy to Clipboard**: Copy translation results

## Image of the extension in action

![SupaQuery Demo](demo.jpg)

_SupaQuery in action: translating Supabase JavaScript queries to SQL, HTTP, and cURL in real-time_

### Supported Features

- **Basic Filtering**: `.eq()`, `.gt()`, `.lt()`, `.like()`, `.in()`
- **Simple CRUD**: SELECT, INSERT, UPDATE, DELETE, UPSERT
- **Real-time Translation**: See results as you type

## Quick Examples

### Basic Queries

```javascript
// SELECT
supabase.from("users").select("id, name").eq("status", "active");
// → SELECT id, name FROM users WHERE status = 'active'

// INSERT
supabase.from("users").insert({ name: "John", email: "john@example.com" });
// → INSERT INTO users (name, email) VALUES ('John', 'john@example.com')

// UPDATE
supabase.from("users").eq("id", 1).update({ name: "Jane" });
// → UPDATE users SET name = 'Jane' WHERE id = 1
```

## Usage

1. **Context Menu**: Select a Supabase query and right-click
2. **Keyboard Shortcut**: Select a query and press `Ctrl+Shift+Q`
3. **Real-time**: Keep the webview panel open for automatic updates

## ⚠️ Current Limitations

### Complex Features (Coming Soon)

- **Advanced Joins**: Complex relationship queries with multiple tables
- **Nested JSONB**: Deep JSONB operations and queries
- **Dynamic Queries**: Queries built at runtime with variables
- **Ternary Operators**: Complex conditional selections

## Roadmap

- [ ] Better error messages and validation
- [ ] Support for more complex queries
- [ ] Enhanced UI and user experience

## License

MIT License

---

**Built with ❤️ for the Supabase community**
