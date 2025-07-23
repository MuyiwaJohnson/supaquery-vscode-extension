import { expect } from 'chai';
import { SupabaseQueryParser } from '../../parser';

describe('SupabaseQueryParser Unit Tests', () => {
  let parser: SupabaseQueryParser;

  beforeEach(() => {
    parser = new SupabaseQueryParser();
  });

  describe('Basic CRUD Operations', () => {
    it('should parse SELECT query', () => {
      const query = "supabase.from('test_table').select('id, name, email')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('SELECT id, name, email');
      expect(result.sql).to.include('FROM test_table');
    });

    it('should parse INSERT query', () => {
      const query = "supabase.from('test_table').insert({name: 'Test User', email: 'test@example.com'})";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('INSERT INTO test_table');
      expect(result.sql).to.include('name, email');
    });

    it('should parse UPDATE query', () => {
      const query = "supabase.from('test_table').update({name: 'Updated User'}).eq('id', 1)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('UPDATE test_table');
      expect(result.sql).to.include('SET name =');
    });

    it('should parse DELETE query', () => {
      const query = "supabase.from('test_table').delete().eq('id', 1)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('DELETE FROM test_table');
      expect(result.sql).to.include('WHERE id = 1');
    });

    it('should parse UPSERT query', () => {
      const query = "supabase.from('test_table').upsert({id: 1, name: 'Test User'})";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('INSERT INTO test_table');
      expect(result.sql).to.include('ON CONFLICT');
    });
  });

  describe('Advanced Filtering', () => {
    it('should parse OR clause', () => {
      const query = "supabase.from('test_table').or('id.eq.1,name.eq.Test User')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('OR');
      expect(result.sql).to.include('id = 1');
      expect(result.sql).to.include("name = 'Test User'");
    });

    it('should parse NOT clause', () => {
      const query = "supabase.from('test_table').not('id.eq.1')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('NOT');
      expect(result.sql).to.include('id');
      expect(result.sql).to.include('1');
    });

    it('should parse IN clause', () => {
      const query = "supabase.from('test_table').in('id', [1, 2, 3])";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('IN');
      expect(result.sql).to.include('1');
      expect(result.sql).to.include('2');
      expect(result.sql).to.include('3');
    });

    it('should parse CONTAINS clause', () => {
      const query = "supabase.from('test_table').contains('tags', ['tag1', 'tag2'])";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('@>');
      expect(result.sql).to.include('tag1');
      expect(result.sql).to.include('tag2');
    });
  });

  describe('Complex Queries', () => {
    it('should parse relationship query', () => {
      const query = "supabase.from('test_table').select('*, related_table(title)')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('JOIN');
      expect(result.sql).to.include('related_table');
    });

    it('should parse auth query', () => {
      const query = "supabase.from('test_table').select('*').eq('auth.uid()', 'user-id')";
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('auth.uid()');
    });

    it('should parse multi-line query', () => {
      const query = `supabase.from('test_table')
        .select('id, name')
        .eq('status', 'active')
        .limit(10)`;
      const result = parser.parseComplexQuery(query);
      
      expect(result.sql).to.include('SELECT id, name');
      expect(result.sql).to.include('FROM test_table');
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
      const query = "supabase.from('test_table').select('*').limit(5000)";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
      expect(result.warnings).to.be.an('array');
      expect(result.warnings!.length).to.be.greaterThan(0);
    });
  });

  describe('Auth Context', () => {
    it('should set auth context', () => {
      parser.setAuthContext('user123', false);
      
      const query = "supabase.from('test_table').eq('user_id', auth.uid())";
      const result = parser.parseComplexQuery(query);
      
      expect(result.error).to.be.undefined;
    });
  });

  describe('Performance', () => {
    it('should parse queries quickly', () => {
      const startTime = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const query = `supabase.from('test_table').eq('id', ${i})`;
        parser.parseComplexQuery(query);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should parse 100 queries in less than 1 second
      expect(duration).to.be.lessThan(1000);
    });
  });
}); 