export interface HtmlTemplateProps {
    styleResetUri: string;
    styleVSCodeUri: string;
    styleMainUri: string;
    currentResultJson: string;
}

export class HtmlTemplate {
    static create(props: HtmlTemplateProps): string {
        const { styleResetUri, styleVSCodeUri, styleMainUri, currentResultJson } = props;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Supabase Translator</title>
    <link href="${styleResetUri}" rel="stylesheet">
    <link href="${styleVSCodeUri}" rel="stylesheet">
    <link href="${styleMainUri}" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
</head>
<body>
    <div class="container">
        <div id="resultContainer" class="result-container">
        </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();
        
        // Store code blocks for copying
        let codeBlocks = {};
        
        // Restore state if available
        const currentResult = ${currentResultJson};
        if (currentResult) {
            // Wait for DOM to be ready
            document.addEventListener('DOMContentLoaded', () => {
                showResult(currentResult);
            });
        }
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'showResult':
                    showResult(message.result);
                    break;
                case 'clearResult':
                    clearResult();
                    break;
            }
        });

        function showResult(result) {
            const container = document.getElementById('resultContainer');
            
            // Clear previous code blocks
            codeBlocks = {};
            
            if (!result.success) {
                container.innerHTML = \`
                    <div class="result-card error">
                        <div class="result-header">
                            <h2>❌ Translation Failed</h2>
                            <span class="timestamp">\${new Date().toLocaleTimeString()}</span>
                        </div>
                        <div class="result-content">
                            <div class="code-block">
                                <div class="code-header">
                                    <div class="code-title">
                                        <span class="language-badge">JS</span>
                                        <span class="title-text">Original Query</span>
                                    </div>
                                </div>
                                <div class="code-content">
                                    <pre><code class="language-javascript">\${escapeHtml(result.originalQuery)}</code></pre>
                                </div>
                            </div>
                            <div class="error-section">
                                <h4>Error</h4>
                                <pre class="error-message">\${escapeHtml(result.error)}</pre>
                            </div>
                        </div>
                    </div>
                \`;
                return;
            }

            let htmlContent = \`
                <div class="result-card">
                    <div class="result-header">
                        <h2>✅ Translation Complete</h2>
                        <span class="timestamp">\${new Date().toLocaleTimeString()}</span>
                    </div>
                    <div class="result-content">
            \`;

            // Store code blocks and generate HTML
            if (result.sql) {
                const blockId = 'sql_block';
                codeBlocks[blockId] = result.sql;
                htmlContent += createCodeBlock('sql', result.sql, 'Generated SQL', blockId);
            }

            if (result.http) {
                const blockId = 'http_block';
                const formattedHttp = formatHttpRequest(result.http);
                codeBlocks[blockId] = formattedHttp;
                htmlContent += createCodeBlock('http', formattedHttp, 'HTTP Request', blockId);
            }

            if (result.curl) {
                const blockId = 'curl_block';
                codeBlocks[blockId] = result.curl;
                htmlContent += createCodeBlock('bash', result.curl, 'cURL Command', blockId);
            }

            if (result.warnings && result.warnings.length > 0) {
                htmlContent += createWarningsSection(result.warnings);
            }

            htmlContent += \`
                    </div>
                </div>
            \`;

            container.innerHTML = htmlContent;

            // Apply syntax highlighting
            Prism.highlightAll();
        }

        function createCodeBlock(language, code, title, blockId) {
            const languageLabel = {
                'javascript': 'JS',
                'sql': 'SQL',
                'http': 'HTTP',
                'bash': 'cURL'
            }[language] || language.toUpperCase();

            // Keep SQL as original - no formatting
            let formattedCode = code;

            return \`
                <div class="code-block">
                    <div class="code-header">
                        <div class="code-title">
                            <span class="language-badge">\${languageLabel}</span>
                            <span class="title-text">\${title}</span>
                        </div>
                        <button class="copy-button" onclick="copyToClipboard('\${blockId}', '\${title}')" title="Copy to clipboard">
                            Copy
                        </button>
                    </div>
                    <div class="code-content">
                        <pre><code class="language-\${language}">\${escapeHtml(formattedCode)}</code></pre>
                    </div>
                </div>
            \`;
        }

        function formatHttpRequest(http) {
            let result = \`\${http.method} \${http.fullPath}\`;
            
            if (http.headers && http.headers.size > 0) {
                result += '\\n\\nHeaders:\\n';
                http.headers.forEach((value, key) => {
                    result += \`\${key}: \${value}\\n\`;
                });
            }
            
            if (http.body) {
                result += '\\nBody:\\n';
                result += JSON.stringify(http.body, null, 2);
            }
            
            return result;
        }

        function createWarningsSection(warnings) {
            return \`
                <div class="warnings-section">
                    <h4>⚠️ Warnings</h4>
                    <ul class="warnings-list">
                        \${warnings.map(warning => \`<li>\${escapeHtml(warning)}</li>\`).join('')}
                    </ul>
                </div>
            \`;
        }

        function escapeHtml(text) {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function clearResult() {
            const container = document.getElementById('resultContainer');
            codeBlocks = {};
            container.innerHTML = \`
                <div class="empty-state">
                    <div class="empty-icon">📄</div>
                    <h3>No translation yet</h3>
                    <p>Select some Supabase JavaScript code and run the translate command to see results here.</p>
                </div>
            \`;
        }

        async function copyToClipboard(blockId, title) {
            try {
                const text = codeBlocks[blockId];
                if (!text) {
                    throw new Error('Code block not found');
                }
                
                // Use VS Code's clipboard API instead of navigator.clipboard
                vscode.postMessage({ 
                    command: 'copy', 
                    text: text,
                    title: title 
                });
                
                // Show visual feedback
                const button = event.target;
                const originalText = button.innerHTML;
                button.innerHTML = 'Copied';
                button.style.color = '#4CAF50';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.color = '';
                }, 1000);
                
            } catch (err) {
                console.error('Failed to copy text: ', err);
                // Show error feedback
                const button = event.target;
                const originalText = button.innerHTML;
                button.innerHTML = '❌';
                button.style.color = '#f44336';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.color = '';
                }, 1000);
            }
        }
    </script>
</body>
</html>`;
    }
}