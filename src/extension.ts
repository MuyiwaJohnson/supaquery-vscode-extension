import * as vscode from 'vscode';
import { SupabaseQueryParser } from './parser';
import { EnhancedTranslator } from './enhanced-translator';
import { TranslationWebviewProvider } from './webview-provider';

export function activate(context: vscode.ExtensionContext) {
  const parser = new SupabaseQueryParser();
  const enhancedTranslator = new EnhancedTranslator();
  
  // Register webview provider
  const webviewProvider = new TranslationWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TranslationWebviewProvider.viewType,
      webviewProvider
    )
  );
  
  // Register hover provider for SQL translation......
  const hoverProvider = vscode.languages.registerHoverProvider(
    ['javascript', 'typescript'],
    {
      provideHover(document, position, token) {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
          return null;
        }
        
        const word = document.getText(range);
        
        // Check if we're hovering over a Supabase query
        const line = document.lineAt(position.line);
        const lineText = line.text;
        
        if (lineText.includes('supabase.from(') || 
            lineText.includes('supabase.rpc(') ||
            lineText.includes('.select(') ||
            lineText.includes('.insert(') ||
            lineText.includes('.update(') ||
            lineText.includes('.delete(') ||
            lineText.includes('.upsert(')) {
          
          try {
            const queryText = extractQueryFromLine(lineText);
            const result = parser.parseComplexQuery(queryText);
            
            if (result.sql && !result.error) {
              const sqlMarkdown = new vscode.MarkdownString();
              sqlMarkdown.appendCodeblock('sql', 'sql');
              sqlMarkdown.appendText(result.sql);
              
              if (result.warnings && result.warnings.length > 0) {
                sqlMarkdown.appendMarkdown('\n\n**Warnings:**\n');
                result.warnings.forEach(warning => {
                  sqlMarkdown.appendMarkdown(`- ${warning}\n`);
                });
              }
              
              return new vscode.Hover(sqlMarkdown);
            }
          } catch (error) {
            // Silently ignore parsing errors in hover
          }
        }
        
        return null;
      }
    }
  );
  
  // Register command for translating selected query
  const translateCommand = vscode.commands.registerCommand('supaquery.translateQuery', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }
    
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText.trim()) {
      vscode.window.showWarningMessage('Please select a Supabase query to translate');
      return;
    }
    
    try {
      // Use the enhanced translator for full translation
      const result = await enhancedTranslator.fullTranslation(selectedText);
      
      // Show result in webview (will open in split view)
      await webviewProvider.translateAndShow(selectedText);
      
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to parse query: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });
  



  

  
  // Register all disposables
  context.subscriptions.push(
    hoverProvider,
    translateCommand
  );
  
  // Show welcome message
  vscode.window.showInformationMessage(
    'SupaQuery is now active! ' +
    'Select a Supabase query and use Ctrl+Shift+T to translate.'
  );
}

function extractQueryFromLine(lineText: string): string {
  // Extract the complete query from a line using more sophisticated parsing
  
  // Find the start of the query
  let startIndex = lineText.indexOf('supabase.from(');
  if (startIndex === -1) {
    startIndex = lineText.indexOf('supabase.rpc(');
  }
  
  if (startIndex === -1) {
    // Look for method chains that might be part of a query
    const methodPatterns = ['.select(', '.insert(', '.update(', '.delete(', '.upsert('];
    for (const pattern of methodPatterns) {
      const index = lineText.indexOf(pattern);
      if (index !== -1) {
        startIndex = index;
        break;
      }
    }
  }
  
  if (startIndex === -1) {
    return lineText;
  }
  
  // Extract from the start to the end of the line or the next semicolon
  const endIndex = lineText.indexOf(';', startIndex);
  const queryEnd = endIndex !== -1 ? endIndex : lineText.length;
  
  // Also look for the end of the method chain
  let chainEnd = queryEnd;
  let parenCount = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = startIndex; i < lineText.length; i++) {
    const char = lineText[i];
    
    if (char === '"' || char === "'") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    } else if (!inString) {
      if (char === '(') {
        parenCount++;
      } else if (char === ')') {
        parenCount--;
        if (parenCount === 0) {
          chainEnd = i + 1;
          break;
        }
      }
    }
  }
  
  return lineText.substring(startIndex, Math.min(chainEnd, queryEnd)).trim();
}

export function deactivate() {
  // Cleanup code here
} 