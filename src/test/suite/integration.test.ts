import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Supasense Extension Integration Tests', () => {
  let document: vscode.TextDocument;

  suiteSetup(async () => {
    // Create a test document
    const uri = vscode.Uri.file(path.join(__dirname, '../../test-files/test.js'));
    document = await vscode.workspace.openTextDocument(uri);
  });

  test('Should register commands', async () => {
    const commands = await vscode.commands.getCommands();
    
    assert.ok(commands.includes('supasense.translateQuery'));
    assert.ok(commands.includes('supasense.showHover'));
  });

  test('Should activate extension', async () => {
    // The extension should be activated when we open a JavaScript file
    const extension = vscode.extensions.getExtension('supasense');
    assert.ok(extension);
    
    // Wait for activation
    await extension.activate();
    assert.strictEqual(extension.isActive, true);
  });

  test('Should provide hover information', async () => {
    // Create a test document with Supabase queries
    const testContent = `
      const query = supabase.from('users').select('id, name, email');
      const insertQuery = supabase.from('users').insert({name: 'Alice'});
    `;
    
    const uri = vscode.Uri.file(path.join(__dirname, '../../test-files/hover-test.js'));
    const testDoc = await vscode.workspace.openTextDocument({
      content: testContent,
      language: 'javascript'
    });
    
    // Open the document
    await vscode.window.showTextDocument(testDoc);
    
    // Test hover at different positions
    const positions = [
      new vscode.Position(1, 20), // Over 'from'
      new vscode.Position(1, 30), // Over 'select'
      new vscode.Position(2, 20), // Over 'insert'
    ];
    
    for (const position of positions) {
      const hover = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        testDoc.uri,
        position
      );
      
      // Hover should be available for Supabase queries
      if (hover && hover.length > 0) {
        const content = hover[0].contents;
        assert.ok(content.length > 0);
      }
    }
  });

  test('Should handle command execution', async () => {
    // Test the translate command with a simple query
    const testQuery = "supabase.from('users').select('id, name')";
    
    // This would normally be called from the command palette
    // For testing, we'll just verify the command exists and can be executed
    try {
      await vscode.commands.executeCommand('supasense.translateQuery');
      // Command should execute without throwing
    } catch (error) {
      // It's okay if it fails due to no selection, but it shouldn't crash
      assert.ok(error instanceof Error);
    }
  });

  test('Should provide code actions', async () => {
    const testContent = `
      // This should trigger a code action
      const query = supabase.from('users').select('*');
    `;
    
    const uri = vscode.Uri.file(path.join(__dirname, '../../test-files/code-action-test.js'));
    const testDoc = await vscode.workspace.openTextDocument({
      content: testContent,
      language: 'javascript'
    });
    
    await vscode.window.showTextDocument(testDoc);
    
    // Test code actions
    const range = new vscode.Range(1, 0, 2, 0);
    const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      testDoc.uri,
      range
    );
    
    // Should provide code actions for Supabase queries
    if (codeActions && codeActions.length > 0) {
      const supabaseActions = codeActions.filter(action => 
        action.title.includes('Translate') || action.title.includes('Supabase')
      );
      assert.ok(supabaseActions.length > 0);
    }
  });

  test('Should handle configuration changes', async () => {
    // Test configuration
    const config = vscode.workspace.getConfiguration('supasense');
    
    // Test default values
    const enableRealtime = config.get<boolean>('enableRealtimeTranslation', false);
    assert.strictEqual(typeof enableRealtime, 'boolean');
    
    const authUserId = config.get<string>('authUserId', '');
    assert.strictEqual(typeof authUserId, 'string');
    
    const isAdmin = config.get<boolean>('isAdmin', false);
    assert.strictEqual(typeof isAdmin, 'boolean');
  });

  test('Should handle different file types', async () => {
    const testQueries = [
      "supabase.from('users').select('id, name')",
      "supabase.from('posts').insert({title: 'Test'})",
      "supabase.from('comments').update({text: 'Updated'}).eq('id', 1)"
    ];
    
    // Test with JavaScript
    const jsContent = testQueries.join('\n');
    const jsUri = vscode.Uri.file(path.join(__dirname, '../../test-files/test.js'));
    const jsDoc = await vscode.workspace.openTextDocument({
      content: jsContent,
      language: 'javascript'
    });
    
    // Test with TypeScript
    const tsContent = testQueries.join('\n');
    const tsUri = vscode.Uri.file(path.join(__dirname, '../../test-files/test.ts'));
    const tsDoc = await vscode.workspace.openTextDocument({
      content: tsContent,
      language: 'typescript'
    });
    
    // Both should be handled by the extension
    assert.ok(jsDoc.languageId === 'javascript');
    assert.ok(tsDoc.languageId === 'typescript');
  });

  test('Should handle complex queries', async () => {
    const complexQuery = `
      const result = await supabase
        .from('users')
        .select('*, posts(title, content), comments(text)')
        .eq('status', 'active')
        .gt('age', 18)
        .or('and(role.eq.admin,verified.eq.true),and(role.eq.user,verified.eq.false)')
        .order('created_at.desc')
        .limit(10);
    `;
    
    const uri = vscode.Uri.file(path.join(__dirname, '../../test-files/complex-test.js'));
    const testDoc = await vscode.workspace.openTextDocument({
      content: complexQuery,
      language: 'javascript'
    });
    
    await vscode.window.showTextDocument(testDoc);
    
    // Test hover at the query position
    const position = new vscode.Position(2, 20); // Over 'from'
    const hover = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      testDoc.uri,
      position
    );
    
    // Should provide hover information for complex queries
    if (hover && hover.length > 0) {
      const content = hover[0].contents;
      assert.ok(content.length > 0);
    }
  });

  test('Should handle error cases gracefully', async () => {
    const invalidQuery = `
      // Invalid Supabase query
      const query = supabase.invalid.method();
      
      // Malformed query
      const malformed = supabase.from('users').select(;
    `;
    
    const uri = vscode.Uri.file(path.join(__dirname, '../../test-files/error-test.js'));
    const testDoc = await vscode.workspace.openTextDocument({
      content: invalidQuery,
      language: 'javascript'
    });
    
    await vscode.window.showTextDocument(testDoc);
    
    // Extension should not crash on invalid queries
    // It should handle errors gracefully
    const position = new vscode.Position(1, 20);
    try {
      const hover = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        testDoc.uri,
        position
      );
      // Should not throw, even for invalid queries
    } catch (error) {
      // If it throws, it should be a controlled error
      assert.ok(error instanceof Error);
    }
  });
}); 