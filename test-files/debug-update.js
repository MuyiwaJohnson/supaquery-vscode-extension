const { SupabaseQueryParser } = require('./out/parser');

const parser = new SupabaseQueryParser();

// Test the user's specific query format
const query = "supabase.from('customers').update({name: 'test'}).eq('id', 1).select()";
const result = parser.parseComplexQuery(query);

console.log('Query:', query);
console.log('SQL:', result.sql);
console.log('Error:', result.error);
console.log('Warnings:', result.warnings);

// Test the working format from tests
const query2 = "supabase.from('customers').eq('id', 1).update({name: 'test'})";
const result2 = parser.parseComplexQuery(query2);

console.log('\nQuery2:', query2);
console.log('SQL2:', result2.sql);
console.log('Error2:', result2.error);
console.log('Warnings2:', result2.warnings); 