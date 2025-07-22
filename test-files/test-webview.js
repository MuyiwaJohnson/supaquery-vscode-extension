// Test Supabase queries for the webview

// Simple select query
const simpleQuery = `
const { data } = await supabase
  .from('users')
  .select('id, name, email')
  .eq('status', 'active')
  .limit(10);
`;

// Complex query with joins
const complexQuery = `
const { data } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    content,
    author:users(name, email),
    comments:post_comments(content, user:users(name))
  `)
  .eq('published', true)
  .order('created_at', { ascending: false });
`;

// Insert query
const insertQuery = `
const { data, error } = await supabase
  .from('users')
  .insert([
    {
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active'
    }
  ])
  .select();
`;

// Update query
const updateQuery = `
const { data, error } = await supabase
  .from('users')
  .update({ status: 'inactive' })
  .eq('id', 123)
  .select();
`;

// Delete query
const deleteQuery = `
const { data, error } = await supabase
  .from('users')
  .delete()
  .eq('id', 123);
`;

console.log('Test queries ready for webview testing:');
console.log('1. Simple select:', simpleQuery);
console.log('2. Complex join:', complexQuery);
console.log('3. Insert:', insertQuery);
console.log('4. Update:', updateQuery);
console.log('5. Delete:', deleteQuery); 