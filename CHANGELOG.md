# Changelog

All notable changes to SupaQuery will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New features that have been added

### Changed
- Changes in existing functionality

### Deprecated
- Features that will be removed in upcoming releases

### Removed
- Features that have been removed

### Fixed
- Bug fixes

### Security
- Security vulnerability fixes

## [0.1.0] - 2024-01-XX

### Added
- Initial release of SupaQuery
- Full CRUD support (SELECT, INSERT, UPDATE, DELETE, UPSERT)
- Real-time translation updates
- Beautiful webview interface with copy functionality
- HTTP and cURL generation for all operations
- Advanced filtering and joins support
- Auth/RLS support with `auth.uid()` patterns
- JSONB operations support
- Comprehensive test suite (97 test cases)
- VS Code extension with context menu and keyboard shortcuts
- AST-based parsing using ts-morph
- Custom HTTP translator for non-SELECT operations
- Error handling and graceful degradation
- Edge case handling for complex queries

### Technical Features
- TypeScript-based architecture
- ts-morph AST parsing for accurate JavaScript/TypeScript parsing
- Custom HTTP translator overcoming sql-to-rest limitations
- Modular parser architecture (CRUD, filters, joins)
- VS Code webview integration with real-time updates
- Comprehensive error handling and user feedback

### Documentation
- Comprehensive README with examples and limitations
- Contributing guide for developers
- Code of Conduct for community standards
- Security policy for vulnerability reporting
- Issue and PR templates for better collaboration 