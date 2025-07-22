# Webview Components

This directory contains the webview components for the VS Code extension.

## Components

### `HtmlTemplate.ts`
Generates the complete HTML structure for the webview with all functionality included.

**Features:**
- Complete HTML document structure
- CSS and JavaScript includes
- Prism.js syntax highlighting
- State restoration
- Message handling
- Copy functionality with visual feedback
- Error and success state handling
- HTTP request formatting
- Warnings display

**Usage:**
```typescript
import { HtmlTemplate } from './components';

const html = HtmlTemplate.create({
    styleResetUri: 'path/to/reset.css',
    styleVSCodeUri: 'path/to/vscode.css',
    styleMainUri: 'path/to/webview.css',
    currentResultJson: 'null'
});
```

## Architecture

The webview follows a simplified, monolithic approach:

1. **Single Responsibility**: HtmlTemplate handles all webview functionality
2. **Type Safety**: Full TypeScript support with interfaces
3. **Security**: HTML escaping to prevent XSS attacks
4. **Maintainability**: All logic in one place for easy modification
5. **Performance**: No component overhead, direct HTML generation

## File Structure

```
src/webview/components/
├── HtmlTemplate.ts       # Complete HTML template generator
├── index.ts             # Component exports
└── README.md            # This documentation
```

## Features

### **Syntax Highlighting**
- **Prism.js integration**: Professional code highlighting
- **Multiple languages**: SQL, HTTP, cURL, JavaScript
- **Line numbers**: Enhanced readability

### **Copy Functionality**
- **VS Code clipboard API**: Native integration
- **Visual feedback**: Success/error indicators
- **Title display**: Shows what was copied

### **State Management**
- **Result persistence**: Content survives panel switches
- **Auto-restore**: Results reappear when returning to panel
- **Clean state**: Proper cleanup when needed

### **Error Handling**
- **Graceful failures**: Clear error messages
- **Original query display**: Shows what failed
- **User-friendly**: Helpful error descriptions

## Benefits

- **Simple**: Single file for all webview logic
- **Efficient**: No component overhead
- **Maintainable**: All code in one place
- **Reliable**: Proven functionality
- **Type Safe**: Full TypeScript support 