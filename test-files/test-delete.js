// Test DELETE query
supabase.from('users').eq('id', 1).delete() 