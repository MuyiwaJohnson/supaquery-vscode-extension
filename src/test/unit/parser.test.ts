import { expect } from 'chai';
import { SupabaseQueryParser } from '../../parser';

describe('SupabaseQueryParser Unit Tests', () => {
  let parser: SupabaseQueryParser;

  beforeEach(() => {
    parser = new SupabaseQueryParser();
  });

  describe('Basic CRUD Operations', () => {
    it('should parse SELECT query', () => {
      const query = "supabase.from('users').select('id, name, email')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('SELECT');
      expect(result.sql).to.include('FROM users');
    });

    it('should parse INSERT query', () => {
      const query = "supabase.from('users').insert({name: 'Alice', email: 'alice@example.com'})";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('INSERT INTO');
      expect(result.sql).to.include('users');
    });

    it('should parse UPDATE query', () => {
      const query = "supabase.from('users').update({name: 'Bob'}).eq('id', 1)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('UPDATE');
      expect(result.sql).to.include('SET');
    });

    it('should parse DELETE query', () => {
      const query = "supabase.from('users').delete().eq('id', 1)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('DELETE FROM');
    });

    it('should parse UPSERT query', () => {
      const query = "supabase.from('users').upsert({id: 1, name: 'Bob'})";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('INSERT INTO');
      expect(result.sql).to.include('ON CONFLICT');
    });
  });

  describe('Advanced Filtering', () => {
    it('should parse OR clause', () => {
      const query = "supabase.from('users').or('id.eq.1,name.eq.Bob')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('OR');
    });

    it('should parse NOT clause', () => {
      const query = "supabase.from('users').not('id.eq.1')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('NOT');
    });

    it('should parse IN clause', () => {
      const query = "supabase.from('users').in('id', [1, 2, 3])";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('IN');
    });

    it('should parse CONTAINS clause', () => {
      const query = "supabase.from('products').contains('metadata', {size: 'XL'})";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('@>');
    });
  });

  describe('Complex Queries', () => {
    it('should parse relationship query', () => {
      const query = "supabase.from('users').select('*, posts(title)').eq('posts.published', true)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('JOIN');
    });

    it('should parse auth query', () => {
      const query = "supabase.from('posts').eq('user_id', auth.uid())";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('auth.uid()');
    });

    it('should parse multi-line query', () => {
      const query = `supabase.from('users')
        .select('id, name, email')
        .eq('status', 'active')
        .gt('age', 18)
        .limit(10)`;
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('SELECT');
      expect(result.sql).to.include('WHERE');
      expect(result.sql).to.include('LIMIT');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid query gracefully', () => {
      const query = "invalid.query()";
      const result = parser.parseComplexQuery(query);
      
      expect(result).to.exist;
      // Should not throw, but may have an error
    });

    it('should provide warnings for performance issues', () => {
      const query = "supabase.from('users').select('*').limit(5000)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.warnings).to.be.an('array');
      expect(result.warnings!.length).to.be.greaterThan(0);
    });
  });

  describe('Auth Context', () => {
    it('should set auth context', () => {
      parser.setAuthContext('user123', false);
      
      const query = "supabase.from('posts').eq('user_id', auth.uid())";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });

  describe('Performance', () => {
    it('should parse queries quickly', () => {
      const startTime = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const query = `supabase.from('users').eq('id', ${i})`;
        parser.parseComplexQuery(query);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should parse 100 queries in less than 1 second
      expect(duration).to.be.lessThan(1000);
    });
  });
}); 