import * as assert from 'assert';
import * as vscode from 'vscode';
import { SupabaseQueryParser } from '../../parser';

suite('Supasense Extension Test Suite', () => {
  let parser: SupabaseQueryParser;

  suiteSetup(() => {
    parser = new SupabaseQueryParser();
  });

  test('Should parse basic select query', () => {
    const query = "supabase.from('users').select('id, name, email')";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('SELECT'));
    assert.ok(result.sql.includes('FROM users'));
  });

  test('Should parse insert query', () => {
    const query = "supabase.from('users').insert({name: 'Alice', email: 'alice@example.com'})";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('INSERT INTO'));
    assert.ok(result.sql.includes('users'));
  });

  test('Should parse update query', () => {
    const query = "supabase.from('users').update({name: 'Bob'}).eq('id', 1)";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('UPDATE'));
    assert.ok(result.sql.includes('SET'));
  });

  test('Should parse delete query', () => {
    const query = "supabase.from('users').delete().eq('id', 1)";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('DELETE FROM'));
  });

  test('Should parse upsert query', () => {
    const query = "supabase.from('users').upsert({id: 1, name: 'Bob'})";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('INSERT INTO'));
    assert.ok(result.sql.includes('ON CONFLICT'));
  });

  test('Should parse OR clause', () => {
    const query = "supabase.from('users').or('id.eq.1,name.eq.Bob')";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('OR'));
  });

  test('Should parse NOT clause', () => {
    const query = "supabase.from('users').not('id.eq.1')";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('NOT'));
  });

  test('Should parse IN clause', () => {
    const query = "supabase.from('users').in('id', [1, 2, 3])";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('IN'));
  });

  test('Should parse CONTAINS clause', () => {
    const query = "supabase.from('products').contains('metadata', {size: 'XL'})";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('@>'));
  });

  test('Should parse relationship query', () => {
    const query = "supabase.from('users').select('*, posts(title)').eq('posts.published', true)";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('JOIN'));
  });

  test('Should parse auth query', () => {
    const query = "supabase.from('posts').eq('user_id', auth.uid())";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('auth.uid()'));
  });

  test('Should parse complex multi-line query', () => {
    const query = `supabase.from('users')
      .select('id, name, email')
      .eq('status', 'active')
      .gt('age', 18)
      .limit(10)`;
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.sql.includes('SELECT'));
    assert.ok(result.sql.includes('WHERE'));
    assert.ok(result.sql.includes('LIMIT'));
  });

  test('Should handle invalid query gracefully', () => {
    const query = "invalid.query()";
    const result = parser.parseComplexQuery(query);
    
    // Should not throw, but may have an error
    assert.ok(result);
  });

  test('Should provide warnings for performance issues', () => {
    const query = "supabase.from('users').select('*').limit(5000)";
    const result = parser.parseComplexQuery(query);
    
    assert.strictEqual(result.error, undefined);
    assert.ok(result.warnings && result.warnings.length > 0);
  });
}); 