// Test file for Supasense extension
// This file contains various Supabase queries for testing

// Basic CRUD operations
const selectQuery = supabase.from('users').select('id, name, email');
const insertQuery = supabase.from('users').insert({name: 'Alice', email: 'alice@example.com'});
const updateQuery = supabase.from('users').update({name: 'Bob'}).eq('id', 1);
const deleteQuery = supabase.from('users').delete().eq('id', 1);
const upsertQuery = supabase.from('users').upsert({id: 1, name: 'Bob', email: 'bob@example.com'});

// Advanced filtering.
const orQuery = supabase.from('users').or('id.eq.1,name.eq.Bob');
const notQuery = supabase.from('users').not('id.eq.1');
const inQuery = supabase.from('users').in('id', [1, 2, 3]);
const containsQuery = supabase.from('products').contains('metadata', {size: 'XL'});

// Complex queries.
const relationshipQuery = supabase.from('users').select('*, posts(title)').eq('posts.published', true);
const authQuery = supabase.from('posts').eq('user_id', auth.uid());

// Multi-line query
const complexQuery = supabase.from('users')
  .select('id, name, email')
  .eq('status', 'active')
  .gt('age', 18)
  .order('created_at.desc')
  .limit(10);

// JSONB operations
const jsonbQuery = supabase.from('products')
  .select('metadata->>color')
  .contains('metadata', {size: 'XL', color: 'red'});

// RPC calls
const rpcQuery = supabase.rpc('get_user', {id: 1});
const rpcWithAuthQuery = supabase.rpc('get_user', {id: supabase.auth.currentUser.id});

// Nested conditions
const nestedQuery = supabase.from('orders')
  .or('and(status.eq.pending,amount.gt.100),and(status.eq.completed,amount.lt.50)');

// Performance test query
const performanceQuery = supabase.from('users').select('*').limit(5000); 