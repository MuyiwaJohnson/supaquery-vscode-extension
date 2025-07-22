// Test UPDATE query
supabase.from('users').eq('id', 1).update({name: 'John Doe', email: 'john@example.com'}) 