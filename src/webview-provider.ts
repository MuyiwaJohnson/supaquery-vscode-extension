import * as vscode from 'vscode';
import { EnhancedTranslator } from './enhanced-translator';
import { HtmlTemplate } from './webview/components';

export class TranslationWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'supaquery.results';

    private _view?: vscode.WebviewView;
    private _translator: EnhancedTranslator;
    private _currentPanel?: vscode.WebviewPanel;
    private _currentResult: any = null;
    private _documentChangeListener?: vscode.Disposable;
    private _debounceTimer?: NodeJS.Timeout;

    constructor(private readonly _extensionUri: vscode.Uri) {
        this._translator = new EnhancedTranslator();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'translate':
                        this._handleTranslate(message.text);
                        return;
                    case 'copy':
                        this._handleCopy(message.text, message.title);
                        return;
                }
            }
        );
    }

    public async translateAndShow(query: string) {
        // Check if we already have a panel and it's still valid
        if (this._currentPanel) {
            try {
                // Try to reveal the existing panel
                this._currentPanel.reveal(vscode.ViewColumn.Beside);
                
                // Send the new translation result to the existing panel
                const result = await this._translateQuery(query);
                this._currentResult = result;
                this._currentPanel.webview.postMessage({ 
                    command: 'showResult', 
                    result: result 
                });
                return;
            } catch (error) {
                // Panel was disposed, create a new one
                this._currentPanel = undefined;
            }
        }

        // Create a new webview panel
        const panel = vscode.window.createWebviewPanel(
            'supabaseTranslation',
            'Supabase Translation',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [this._extensionUri],
                retainContextWhenHidden: true
            }
        );

        // Store the panel reference
        this._currentPanel = panel;

        // Handle panel disposal
        panel.onDidDispose(() => {
            this._currentPanel = undefined;
            this._currentResult = null;
            this._stopRealtimeTranslation();
        });

        // Start real-time translation when panel is created
        this._startRealtimeTranslation();

        // Handle messages from the panel
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'translate':
                        this._handleTranslate(message.text);
                        return;
                    case 'copy':
                        this._handleCopy(message.text, message.title);
                        return;
                }
            }
        );

        panel.webview.html = this._getHtmlForWebview(panel.webview);
        
        // Send the translation result to the webview
        const result = await this._translateQuery(query);
        this._currentResult = result;
        panel.webview.postMessage({ 
            command: 'showResult', 
            result: result 
        });

        // Focus the webview panel
        panel.reveal(vscode.ViewColumn.Beside);
    }

    public clearResult() {
        this._currentResult = null;
        if (this._currentPanel) {
            this._currentPanel.webview.postMessage({ 
                command: 'clearResult'
            });
        }
    }

    private _startRealtimeTranslation() {
        // Stop any existing listener
        this._stopRealtimeTranslation();

        // Listen for document changes
        this._documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document !== event.document) return;

            // Check if the change is in a Supabase query
            const changes = event.contentChanges;
            for (const change of changes) {
                const line = event.document.lineAt(change.range.start.line);
                const lineText = line.text;
                
                if (this._isSupabaseQuery(lineText)) {
                    // Debounce the translation
                    if (this._debounceTimer) {
                        clearTimeout(this._debounceTimer);
                    }
                    
                    this._debounceTimer = setTimeout(() => {
                        this._handleRealtimeTranslation(lineText);
                    }, 500);
                    
                    break;
                }
            }
        });
    }

    private _stopRealtimeTranslation() {
        if (this._documentChangeListener) {
            this._documentChangeListener.dispose();
            this._documentChangeListener = undefined;
        }
        
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = undefined;
        }
    }

    private _isSupabaseQuery(lineText: string): boolean {
        return lineText.includes('supabase.from(') || 
               lineText.includes('supabase.rpc(') ||
               lineText.includes('.select(') ||
               lineText.includes('.insert(') ||
               lineText.includes('.update(') ||
               lineText.includes('.delete(') ||
               lineText.includes('.upsert(');
    }

    private async _handleRealtimeTranslation(lineText: string) {
        if (!this._currentPanel) return;

        try {
            const queryText = this._extractQueryFromLine(lineText);
            if (!queryText.trim()) return;

            const result = await this._translateQuery(queryText);
            this._currentResult = result;
            
            this._currentPanel.webview.postMessage({ 
                command: 'showResult', 
                result: result 
            });
        } catch (error) {
            // Silently ignore parsing errors in real-time
        }
    }

    private _extractQueryFromLine(lineText: string): string {
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

    private async _translateQuery(query: string) {
        try {
            const result = await this._translator.fullTranslation(query);
            return {
                success: true,
                originalQuery: query,
                sql: result.sql,
                http: result.http,
                curl: result.curl,
                error: result.error,
                warnings: result.warnings
            };
        } catch (error) {
            return {
                success: false,
                originalQuery: query,
                error: error instanceof Error ? error.message : 'Translation failed'
            };
        }
    }

    private async _handleTranslate(query: string) {
        const result = await this._translateQuery(query);
        this._view?.webview.postMessage({ 
            command: 'showResult', 
            result: result 
        });
    }

    private async _handleCopy(text: string, title?: string) {
        try {
            await vscode.env.clipboard.writeText(text);
            const message = title ? `Copied ${title} to clipboard!` : 'Copied to clipboard!';
            vscode.window.showInformationMessage(message);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to copy to clipboard');
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.css'));

        // Serialize current result for state restoration
        const currentResultJson = this._currentResult ? JSON.stringify(this._currentResult) : 'null';

        return HtmlTemplate.create({
            styleResetUri: styleResetUri.toString(),
            styleVSCodeUri: styleVSCodeUri.toString(),
            styleMainUri: styleMainUri.toString(),
            currentResultJson
        });
    }
}