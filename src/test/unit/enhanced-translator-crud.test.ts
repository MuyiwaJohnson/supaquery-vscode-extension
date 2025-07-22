import { expect } from 'chai';
import { EnhancedTranslator } from '../../enhanced-translator';

describe('EnhancedTranslator CRUD Operations', () => {
  let translator: EnhancedTranslator;

  beforeEach(() => {
    translator = new EnhancedTranslator();
  });

  describe('Non-SELECT Operations', () => {
    it('should handle UPDATE queries', async () => {
      const query = "supabase.from('users').eq('id', 1).update({name: 'John Doe'})";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('UPDATE');
      expect(result.sql).to.include('SET');
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('PATCH');
      expect(result.curl).to.include('curl -X PATCH');
      expect(result.warnings).to.include('Supabase JS generation not supported for non-SELECT queries (sql-to-rest limitation)');
    });

    it('should handle INSERT queries', async () => {
      const query = "supabase.from('users').insert({name: 'Jane Smith', email: 'jane@example.com'})";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('INSERT INTO');
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('POST');
      expect(result.curl).to.include('curl -X POST');
    });

    it('should handle DELETE queries', async () => {
      const query = "supabase.from('users').eq('id', 1).delete()";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('DELETE FROM');
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('DELETE');
      expect(result.curl).to.include('curl -X DELETE');
    });

    it('should handle UPSERT queries', async () => {
      const query = "supabase.from('users').upsert({id: 1, name: 'John Doe'})";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('INSERT INTO');
      expect(result.sql).to.include('ON CONFLICT');
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('POST');
    });
  });

  describe('SELECT Operations', () => {
    it('should handle SELECT queries with sql-to-rest', async () => {
      const query = "supabase.from('users').select('id, name').eq('status', 'active')";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('SELECT');
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.curl).to.include('curl -G');
      // SELECT queries should have Supabase JS generation
      expect(result.supabaseJs).to.exist;
    });
  });
}); 