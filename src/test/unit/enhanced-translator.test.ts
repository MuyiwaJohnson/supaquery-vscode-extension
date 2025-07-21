import { expect } from 'chai';
import { EnhancedTranslator } from '../../enhanced-translator';

describe('Enhanced Translator Integration Tests', () => {
  let translator: EnhancedTranslator;

  beforeEach(() => {
    translator = new EnhancedTranslator();
  });

  describe('Supabase JS to HTTP Translation', () => {
    it('should translate simple select query to HTTP', async () => {
      const query = "supabase.from('users').select('id, name, email')";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/users');
      expect(result.http!.params.get('select')).to.equal('id,name,email');
    });

    it('should translate query with filters to HTTP', async () => {
      const query = "supabase.from('users').select('*').eq('status', 'active').limit(10)";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/users');
      expect(result.http!.params.get('status')).to.equal('eq.active');
      expect(result.http!.params.get('limit')).to.equal('10');
    });
  });

  describe('Supabase JS to cURL Translation', () => {
    it('should translate query to cURL command', async () => {
      const query = "supabase.from('users').select('id, name')";
      const result = await translator.translateToCurl(query);
      
      expect(result.error).to.be.undefined;
      expect(result.curl).to.exist;
      expect(result.curl!).to.include('curl -G');
      expect(result.curl!).to.include('/users');
      // The cURL will include the full URL with query parameters
      expect(result.curl!).to.include('rest/v1/users');
    });
  });

  describe('Round-trip Translation', () => {
    it('should perform round-trip translation', async () => {
      const query = "supabase.from('users').select('id, name').eq('status', 'active')";
      const result = await translator.roundTripTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.exist;
      expect(result.supabaseJs).to.exist;
      expect(result.supabaseJs!).to.include('supabase');
      expect(result.supabaseJs!).to.include('from');
    });
  });

  describe('Full Translation Pipeline', () => {
    it('should perform complete translation pipeline', async () => {
      const query = "supabase.from('books').select('title, author').order('title')";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.exist;
      expect(result.http).to.exist;
      expect(result.curl).to.exist;
      expect(result.supabaseJs).to.exist;
      
      // Verify SQL contains expected elements
      expect(result.sql!).to.include('SELECT');
      expect(result.sql!).to.include('FROM books');
      
      // Verify HTTP contains expected elements
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/books');
      
      // Verify cURL contains expected elements
      expect(result.curl!).to.include('curl -G');
      expect(result.curl!).to.include('/books');
      
      // Verify round-trip Supabase JS
      expect(result.supabaseJs!).to.include('supabase');
      expect(result.supabaseJs!).to.include('from');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      const query = "invalid.query()";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.exist;
      expect(result.http).to.be.undefined;
    });

    it('should handle unsupported SQL operations', async () => {
      // Our custom translator now supports all operations
      const query = "supabase.from('users').insert({name: 'test'})";
      const result = await translator.translateToHttp(query);
      
      // Should generate both SQL and HTTP successfully
      expect(result.sql).to.exist;
      expect(result.http).to.exist;
      expect(result.error).to.be.undefined;
    });
  });
}); 