import { expect } from 'chai';
import { SupabaseQueryParser } from '../../parser';

describe('SupabaseQueryParser Edge Cases', () => {
  let parser: SupabaseQueryParser;

  beforeEach(() => {
    parser = new SupabaseQueryParser();
  });

  describe('Malformed Queries', () => {
    it('should handle empty string', () => {
      const result = parser.parseComplexQuery('');
      expect(result.error).to.exist;
    });

    it('should handle null/undefined input', () => {
      const result = parser.parseComplexQuery(null as any);
      expect(result.error).to.exist;
    });

    it('should handle incomplete method chains', () => {
      const query = "supabase.from('test_table').select(";
      const result = parser.parseComplexQuery(query);
      expect(result.error).to.exist;
    });

    it('should handle unmatched parentheses', () => {
      const query = "supabase.from('test_table').select('id').eq('name', 'test'";
      const result = parser.parseComplexQuery(query);
      expect(result.error).to.exist;
    });

    it('should handle malformed table names', () => {
      const query = "supabase.from('').select('*')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.exist;
    });

    it('should handle table names with special characters', () => {
      const query = "supabase.from('user-profiles').select('*')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('user-profiles');
    });
  });

  describe('Complex String Handling', () => {
    it('should handle strings with quotes inside', () => {
      const query = "supabase.from('test_table').eq('name', \"O'Connor\")";
      const result = parser.parseComplexQuery(query);
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include("O'Connor");
    });

    it('should handle strings with escaped quotes', () => {
      const query = "supabase.from('test_table').eq('name', 'John\\'s data')";
      const result = parser.parseComplexQuery(query);
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include("John's data");
    });

    it('should handle template literals', () => {
      const query = "supabase.from('test_table').eq('name', `John's data`)";
      const result = parser.parseComplexQuery(query);
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include("John's data");
    });

    it('should handle multi-line strings', () => {
      const query = `supabase.from('test_table').eq('description', 'This is a
multi-line description')`;
      const result = parser.parseComplexQuery(query);
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('multi-line description');
    });
  });

  describe('Complex Object Handling', () => {
    it('should handle nested objects in insert', () => {
      const query = "supabase.from('test_table').insert({profile: {name: 'Test User', age: 30}})";
      const result = parser.parseComplexQuery(query);
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('INSERT INTO');
    });

    it('should handle arrays in insert', () => {
      const query = "supabase.from('test_table').insert([{name: 'User 1'}, {name: 'User 2'}])";
      const result = parser.parseComplexQuery(query);
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('INSERT INTO');
    });

    it('should handle complex JSON objects', () => {
      const query = `supabase.from('products').insert({
        name: 'Product',
        metadata: {
          tags: ['tag1', 'tag2'],
          dimensions: {width: 10, height: 20}
        }
      })`;
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });

  describe('Advanced Filtering Edge Cases', () => {
    it('should handle multiple OR conditions', () => {
      const query = "supabase.from('test_table').or('id.eq.1,name.eq.Test User,email.eq.test@test.com')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('OR');
    });

    it('should handle nested AND/OR combinations', () => {
      const query = "supabase.from('test_table').eq('status', 'active').or('role.eq.admin,role.eq.moderator')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('AND');
      expect(result.sql).to.include('OR');
    });

    it('should handle empty arrays in IN clause', () => {
      const query = "supabase.from('test_table').in('id', [])";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('IN');
    });

    it('should handle null values in filters', () => {
      const query = "supabase.from('test_table').eq('deleted_at', null)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('IS NULL');
    });

    it('should handle boolean values', () => {
      const query = "supabase.from('test_table').eq('is_active', true)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('true');
    });
  });

  describe('Aggregation and Grouping', () => {
    it('should handle COUNT aggregation', () => {
      const query = "supabase.from('users').select('count')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('COUNT');
    });

    it('should handle GROUP BY', () => {
      const query = "supabase.from('orders').select('status, count').group('status')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('GROUP BY');
    });

    it('should handle HAVING clause', () => {
      const query = "supabase.from('orders').select('status, count').group('status').having('count', 'gt', 5)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('HAVING');
    });
  });

  describe('Joins and Relationships', () => {
    it('should handle multiple joins', () => {
      const query = "supabase.from('orders').select('*, users(name), products(title)')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('JOIN');
    });

    it('should handle foreign key relationships', () => {
      const query = "supabase.from('posts').select('*, author:users(name)')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('JOIN');
    });

    it('should handle self-referencing relationships', () => {
      const query = "supabase.from('comments').select('*, parent:comments(content)')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });

  describe('Pagination and Ordering', () => {
    it('should handle negative limits', () => {
      const query = "supabase.from('users').limit(-10)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.warnings).to.be.an('array');
    });

    it('should handle very large limits', () => {
      const query = "supabase.from('users').limit(1000000)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.warnings).to.be.an('array');
    });

    it('should handle multiple order clauses', () => {
      const query = "supabase.from('users').order('name', {ascending: true}).order('created_at', {ascending: false})";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('ORDER BY');
    });

    it('should handle nulls first/last in ordering', () => {
      const query = "supabase.from('users').order('deleted_at', {ascending: true, nullsFirst: true})";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });

  describe('Text Search and Full Text Search', () => {
    it('should handle textSearch', () => {
      const query = "supabase.from('posts').textSearch('content', 'search term')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('to_tsvector');
    });

    it('should handle fullTextSearch', () => {
      const query = "supabase.from('posts').fullTextSearch('content', 'search term')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });

    it('should handle range searches', () => {
      const query = "supabase.from('products').rangeGt('price', 10).rangeLt('price', 100)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });

  describe('RPC and Functions', () => {
    it('should handle RPC calls', () => {
      const query = "supabase.rpc('get_user_stats', {user_id: 123})";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('SELECT');
    });

    it('should handle RPC with complex parameters', () => {
      const query = "supabase.rpc('search_products', {query: 'test', filters: {category: 'electronics'}})";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });

    it('should handle built-in functions', () => {
      const query = "supabase.from('users').select('*, count(*) as total')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });

  describe('Schema and Database Edge Cases', () => {
    it('should handle schema-qualified table names', () => {
      const query = "supabase.from('public.users').select('*')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('public.users');
    });

    it('should handle custom schemas', () => {
      const query = "supabase.from('analytics.events').select('*')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('analytics.events');
    });

    it('should handle quoted identifiers', () => {
      const query = "supabase.from('\"User Table\"').select('*')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle very long queries', () => {
      const longQuery = "supabase.from('users')" + 
        ".select('id,name,email,created_at,updated_at,profile,settings,preferences')" +
        ".eq('status', 'active')".repeat(50) + 
        ".limit(1000)";
      
      const result = parser.parseComplexQuery(longQuery);
      
      expect(result.error).to.be.undefined;
    });

    it('should handle deeply nested objects', () => {
      const nestedObject = JSON.stringify({
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep'
                }
              }
            }
          }
        }
      });
      
      const query = `supabase.from('data').insert({nested: ${nestedObject}})`;
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });

    it('should handle circular references gracefully', () => {
      const query = "supabase.from('users').select('*, posts(*, users(*, posts(*)))')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });

  describe('Error Recovery', () => {
    it('should recover from parsing errors in complex queries', () => {
      const query = "supabase.from('users').select('*').eq('name', 'test').invalidMethod()";
      const result = parser.parseComplexQuery(query);
      
      // Should still produce partial SQL even with errors
      expect(result.sql).to.exist;
    });

    it('should handle malformed JSON gracefully', () => {
      const query = "supabase.from('users').insert({name: 'test', data: {invalid: json}})";
      const result = parser.parseComplexQuery(query);
      
      // JSON detection is disabled to avoid false positives
      // The parser should handle this gracefully without throwing
      expect(result.error).to.be.undefined;
    });

    it('should provide meaningful error messages', () => {
      const query = "supabase.from('users').select('*').invalidMethod()";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.exist;
      expect(result.error).to.be.a('string');
      expect(result.error!.length).to.be.greaterThan(0);
    });
  });

  describe('Real-world Edge Cases', () => {
    it('should handle queries with comments', () => {
      const query = `supabase.from('users')
        .select('*') // Get all users
        .eq('status', 'active') // Only active users
        .limit(10) // Limit to 10 results`;
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });

    it('should handle queries with line breaks in strings', () => {
      const query = `supabase.from('posts').eq('content', 'This is a post
with multiple lines')`;
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });

    it('should handle queries with special characters in table names', () => {
      const query = "supabase.from('user_123_test').select('*')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });

    it('should handle queries with emojis', () => {
      const query = "supabase.from('users').eq('name', 'John 😀')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });
}); 