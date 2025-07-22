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
        if (!range) return null;
        
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
  const translateCommand = vscode.commands.registerCommand('supabase-query-translator.translateQuery', async () => {
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
      // Show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Translating Supabase query...",
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0 });
        
        // Use the enhanced translator for full translation
        const result = await enhancedTranslator.fullTranslation(selectedText);
        
        progress.report({ increment: 100 });
        
        // Show result in webview (will open in split view)
        await webviewProvider.translateAndShow(selectedText);
        
        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          vscode.window.showWarningMessage(
            `Query translated with warnings:\n${result.warnings.join('\n')}`
          );
        }
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to parse query: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });
  
  // Register command for showing SQL in status bar
  const showHoverCommand = vscode.commands.registerCommand('supabase-query-translator.showHover', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const position = editor.selection.active;
    const line = editor.document.lineAt(position.line);
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
          // Show SQL in status bar
          vscode.window.setStatusBarMessage(`SQL: ${result.sql}`, 5000);
        }
      } catch (error) {
        // Silently ignore parsing errors
      }
    }
  });

  // Register enhanced translation commands
  const translateToHttpCommand = vscode.commands.registerCommand('supabase-query-translator.translateToHttp', async () => {
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
      const result = await enhancedTranslator.translateToHttp(selectedText);
      
      if (result.error) {
        vscode.window.showErrorMessage(`Translation failed: ${result.error}`);
        return;
      }
      
      if (result.http) {
        const httpContent = `HTTP Request:
Method: ${result.http.method}
Path: ${result.http.path}
Full URL: ${result.http.fullPath}
        Parameters: ${Array.from(result.http.params.entries()).map((entry: [string, string]) => `${entry[0]}=${entry[1]}`).join('&')}`;
        
        const httpDocument = vscode.workspace.openTextDocument({
          content: httpContent,
          language: 'http'
        });
        
        httpDocument.then(doc => {
          vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        });
      }
      
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to translate to HTTP: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  const translateToCurlCommand = vscode.commands.registerCommand('supabase-query-translator.translateToCurl', async () => {
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
      const result = await enhancedTranslator.translateToCurl(selectedText);
      
      if (result.error) {
        vscode.window.showErrorMessage(`Translation failed: ${result.error}`);
        return;
      }
      
      if (result.curl) {
        const curlDocument = vscode.workspace.openTextDocument({
          content: result.curl,
          language: 'shellscript'
        });
        
        curlDocument.then(doc => {
          vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        });
      }
      
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to translate to cURL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  const roundTripCommand = vscode.commands.registerCommand('supabase-query-translator.roundTrip', async () => {
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
      const result = await enhancedTranslator.roundTripTranslation(selectedText);
      
      if (result.error) {
        vscode.window.showErrorMessage(`Translation failed: ${result.error}`);
        return;
      }
      
      if (result.supabaseJs) {
        const comparisonContent = `Original Supabase JS:
${selectedText}

Generated SQL:
${result.sql}

Round-trip Supabase JS:
${result.supabaseJs}`;
        
        const comparisonDocument = vscode.workspace.openTextDocument({
          content: comparisonContent,
          language: 'javascript'
        });
        
        comparisonDocument.then(doc => {
          vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        });
      }
      
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to perform round-trip translation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  const fullTranslationCommand = vscode.commands.registerCommand('supabase-query-translator.fullTranslation', async () => {
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
      const result = await enhancedTranslator.fullTranslation(selectedText);
      
      if (result.error) {
        vscode.window.showErrorMessage(`Translation failed: ${result.error}`);
        return;
      }
      
      const fullContent = `Original Supabase JS:
${selectedText}

Generated SQL:
${result.sql}

HTTP Request:
${result.http ? `Method: ${result.http.method}
Path: ${result.http.path}
Full URL: ${result.http.fullPath}
Parameters: ${Array.from(result.http.params.entries()).map((entry: [string, string]) => `${entry[0]}=${entry[1]}`).join('&')}` : 'N/A'}

cURL Command:
${result.curl || 'N/A'}

Round-trip Supabase JS:
${result.supabaseJs || 'N/A'}`;
        
      const fullDocument = vscode.workspace.openTextDocument({
        content: fullContent,
        language: 'markdown'
      });
      
      fullDocument.then(doc => {
        vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to perform full translation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });
  
  // Register code actions for quick fixes
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    ['javascript', 'typescript'],
    {
      provideCodeActions(document, range, context) {
        const actions: vscode.CodeAction[] = [];
        
        const diagnostics = context.diagnostics.filter(d => 
          d.message.includes('supabase') || 
          d.message.includes('SQL') ||
          d.message.includes('query')
        );
        
        if (diagnostics.length > 0) {
          const action = new vscode.CodeAction(
            'Translate to SQL',
            vscode.CodeActionKind.QuickFix
          );
          action.command = {
            command: 'supasense.translateQuery',
            title: 'Translate Supabase Query to SQL'
          };
          actions.push(action);
        }
        
        return actions;
      }
    },
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }
  );
  
  // Register configuration change listener
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('supasense')) {
      // Reload configuration
      const config = vscode.workspace.getConfiguration('supasense');
      const authUserId = config.get<string>('authUserId');
      const isAdmin = config.get<boolean>('isAdmin', false);
      
      if (authUserId) {
        parser.setAuthContext(authUserId, isAdmin);
      }
    }
  });
  
  // Register document change listener for real-time translation
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== event.document) return;
    
    const config = vscode.workspace.getConfiguration('supasense');
    const enableRealtime = config.get<boolean>('enableRealtimeTranslation', false);
    
    if (!enableRealtime) return;
    
    // Check if the change is in a Supabase query
    const changes = event.contentChanges;
    for (const change of changes) {
      const line = event.document.lineAt(change.range.start.line);
      const lineText = line.text;
      
      if (lineText.includes('supabase.from(') || 
          lineText.includes('supabase.rpc(') ||
          lineText.includes('.select(') ||
          lineText.includes('.insert(') ||
          lineText.includes('.update(') ||
          lineText.includes('.delete(') ||
          lineText.includes('.upsert(')) {
        
        // Debounce the translation
        setTimeout(() => {
          try {
            const queryText = extractQueryFromLine(lineText);
            const result = parser.parseComplexQuery(queryText);
            
            if (result.sql && !result.error) {
              // Show SQL in status bar briefly
              vscode.window.setStatusBarMessage(`SQL: ${result.sql}`, 2000);
            }
          } catch (error) {
            // Silently ignore parsing errors in real-time
          }
        }, 500);
        
        break;
      }
    }
  });
  
  // Register all disposables
  // Register command for translating in split view
  const translateInSplitCommand = vscode.commands.registerCommand('supabase-query-translator.translateInSplit', async () => {
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
      // Show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Translating Supabase query...",
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0 });
        
        // Use the enhanced translator for full translation
        const result = await enhancedTranslator.fullTranslation(selectedText);
        
        progress.report({ increment: 100 });
        
        // Show result in webview (will open in split view)
        await webviewProvider.translateAndShow(selectedText);
        
        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          vscode.window.showWarningMessage(
            `Query translated with warnings:\n${result.warnings.join('\n')}`
          );
        }
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  context.subscriptions.push(
    hoverProvider,
    translateCommand,
    translateInSplitCommand,
    showHoverCommand,
    translateToHttpCommand,
    translateToCurlCommand,
    roundTripCommand,
    fullTranslationCommand,
    codeActionProvider,
    configChangeListener,
    documentChangeListener
  );
  
  // Show welcome message
  vscode.window.showInformationMessage(
    'Supasense: Supabase Query Translator is now active! ' +
    'Hover over Supabase queries or use Ctrl+Shift+T to translate.'
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