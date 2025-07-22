# Contributing to SupaQuery

Thank you for your interest in contributing to SupaQuery! This guide will help you get started with development and contributing to the project.

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **VS Code** (for development)
- **Git** (for version control)
- **TypeScript** knowledge (the project is written in TypeScript)

### Setup Development Environment

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/supabase-sql-translator.git
   cd supabase-sql-translator
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Compile the Extension**
   ```bash
   npm run compile
   ```

4. **Run in Development Mode**
   - Open the project in VS Code
   - Press `F5` to launch the extension in a new VS Code window
   - Or use the "Run SupaQuery Extension" debug configuration

## 🏗️ Project Structure

```
supabase-sql-translator/
├── src/
│   ├── parser/              # AST Processing
│   │   ├── types.ts         # TypeScript interfaces
│   │   ├── ast-parser.ts    # ts-morph AST parser
│   │   ├── crud.ts          # INSERT/UPDATE/DELETE parsing
│   │   ├── filters.ts       # WHERE clause parsing
│   │   ├── joins.ts         # JOIN logic
│   │   └── index.ts         # Main parser entry point
│   ├── sql-generator/       # SQL string assembly
│   ├── enhanced-translator.ts # Main translation pipeline
│   ├── http-translator.ts   # HTTP/cURL generation
│   ├── webview-provider.ts  # VS Code webview management
│   ├── webview/             # Webview UI components
│   │   └── components/      # HTML/CSS/JS for webview
│   └── extension.ts         # VS Code extension entry point
├── test-files/              # Test query files
├── src/test/                # Test suite
│   └── unit/                # Unit tests
├── media/                   # Extension assets
└── package.json             # Extension manifest
```

## 🧪 Testing

### Run All Tests
```bash
npm run test:unit
```

### Run Specific Test Files
```bash
npx mocha --require ts-node/register 'src/test/unit/parser.test.ts'
```

### Test Coverage
The project has **97 test cases** covering:
- ✅ CRUD operations (SELECT, INSERT, UPDATE, DELETE, UPSERT)
- ✅ Advanced filtering (OR, NOT, IN, CONTAINS, text search)
- ✅ Joins & relationships
- ✅ Auth/RLS support
- ✅ JSONB operations
- ✅ HTTP/cURL translation
- ✅ Edge cases and error handling

### Adding New Tests
**Required for all contributions:**
1. **New Features**: Must include tests for new functionality
2. **Bug Fixes**: Must include tests that reproduce and fix the bug
3. **Edge Cases**: Test boundary conditions and error scenarios
4. **Integration**: Test how changes affect existing functionality

**Test Guidelines:**
- Create test files in `src/test/unit/`
- Follow the existing test patterns
- Test both success and error cases
- Include edge cases and complex scenarios
- Ensure tests are descriptive and maintainable
- Test the specific changes you made

Example test structure:
```typescript
describe('Feature Name', () => {
  it('should handle basic case', () => {
    const query = "supabase.from('users').select('*')";
    const result = parser.parseComplexQuery(query);
    expect(result.sql).to.equal('SELECT * FROM users');
  });

  it('should handle error case', () => {
    const query = "invalid query";
    const result = parser.parseComplexQuery(query);
    expect(result.error).to.be.truthy;
  });
});
```

## 🔧 Development Workflow

### 1. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes
- Follow the existing code style
- **Add tests for new functionality (required)**
- **Add tests for bug fixes (required)**
- Update documentation if needed
- Ensure all existing tests still pass

### 3. Test Your Changes
```bash
npm run compile
npm run test:unit
```

### 4. Commit Your Changes
```bash
git add .
git commit -m "feat: add new feature description"
```

### 5. Push and Create PR
```bash
git push origin feature/your-feature-name
```

## 📝 Code Style Guidelines

### TypeScript
- Use **TypeScript** for all new code
- Follow **strict mode** settings
- Use **interfaces** for type definitions
- Prefer **const assertions** where appropriate

### Naming Conventions
- **Files**: kebab-case (`ast-parser.ts`)
- **Classes**: PascalCase (`AstParser`)
- **Functions**: camelCase (`parseQuery`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)

### Code Organization
- Keep functions small and focused
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Group related functionality together

### Error Handling
- Use descriptive error messages
- Include context in error objects
- Handle edge cases gracefully
- Provide helpful suggestions when possible

## 🎯 Areas for Contribution

### High Priority
- **Edge Case Handling**: Improve parsing of complex queries
- **Performance Optimization**: Reduce parsing time for large queries
- **Error Messages**: Make error messages more helpful
- **Test Coverage**: Add tests for edge cases

### Medium Priority
- **Schema Validation**: Add database schema introspection
- **Authentication**: Support auth headers in HTTP/cURL
- **SQL Formatting**: Add SQL formatting options
- **Export Features**: Support different output formats

### Low Priority
- **UI Improvements**: Enhance webview interface
- **Documentation**: Improve inline documentation
- **Performance Analysis**: Add query optimization suggestions

## 🐛 Bug Reports

### Before Reporting
1. Check if the issue is already reported
2. Try to reproduce the issue
3. Test with the latest version

### Bug Report Template
```markdown
**Description**
Brief description of the issue

**Steps to Reproduce**
1. Create a query like: `supabase.from('users').select('*')`
2. Try to translate it
3. See error: [describe the error]

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [Windows/Mac/Linux]
- VS Code Version: [version]
- SupaQuery Version: [version]

**Additional Context**
Any other relevant information
```

## 💡 Feature Requests

### Before Requesting
1. Check if the feature is already planned
2. Consider if it fits the project scope
3. Think about implementation complexity

### Feature Request Template
```markdown
**Feature Description**
Brief description of the feature

**Use Case**
Why this feature would be useful

**Proposed Implementation**
How you think it could be implemented

**Alternatives Considered**
Other approaches you considered

**Additional Context**
Any other relevant information
```

## 🔄 Pull Request Process

### Before Submitting
1. **Tests Pass**: All tests must pass
2. **Code Style**: Follow project conventions
3. **Documentation**: Update docs if needed
4. **Self Review**: Review your own changes

### PR Template
```markdown
**Description**
Brief description of changes

**Type of Change**
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

**Testing**
- [ ] Added tests for new functionality
- [ ] All existing tests pass
- [ ] Tested manually

**Checklist**
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

**Screenshots** (if applicable)
Add screenshots for UI changes
```

## 🏷️ Commit Message Convention

Use conventional commit messages:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes

Examples:
```bash
git commit -m "feat: add support for window functions"
git commit -m "fix: handle circular references in objects"
git commit -m "docs: update contributing guidelines"
```

## 🤝 Getting Help

### Questions & Discussion
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Reviews**: Ask questions in PR reviews

### Development Resources
- **VS Code Extension API**: [Documentation](https://code.visualstudio.com/api)
- **TypeScript**: [Handbook](https://www.typescriptlang.org/docs/)
- **ts-morph**: [Documentation](https://ts-morph.com/)
- **Supabase**: [Documentation](https://supabase.com/docs)

## 📄 License

By contributing to SupaQuery, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in:
- GitHub contributors list
- README.md contributors section
- Release notes

---

**Thank you for contributing to SupaQuery! 🚀** 