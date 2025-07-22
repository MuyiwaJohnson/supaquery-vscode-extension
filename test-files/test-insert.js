// Test INSERT query
supabase.from('users').insert({name: 'Jane Smith', email: 'jane@example.com', status: 'active'}) 