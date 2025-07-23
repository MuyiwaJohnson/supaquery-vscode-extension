import { expect } from 'chai';
import { EnhancedTranslator } from '../../enhanced-translator';

describe('Enhanced Translator Integration Tests', () => {
  let translator: EnhancedTranslator;

  beforeEach(() => {
    translator = new EnhancedTranslator();
  });

  describe('Supabase JS to HTTP Translation', () => {
    it('should translate simple select query to HTTP', async () => {
      const query = "supabase.from('test_table').select('id, name, email')";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/test_table');
    });

    it('should translate query with filters to HTTP', async () => {
      const query = "supabase.from('test_table').select('*').eq('status', 'active').limit(10)";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/test_table');
    });
  });

  describe('Supabase JS to cURL Translation', () => {
    it('should translate query to cURL command', async () => {
      const query = "supabase.from('test_table').select('id, name')";
      const result = await translator.translateToCurl(query);
      
      expect(result.curl).to.exist;
      expect(result.curl!).to.include('/test_table');
      expect(result.curl!).to.include('rest/v1/test_table');
    });

    it('should translate query with filters to cURL', async () => {
      const query = "supabase.from('test_table').select('id, name').eq('status', 'active')";
      const result = await translator.translateToCurl(query);
      
      expect(result.curl).to.exist;
      expect(result.curl!).to.include('status=eq.active');
    });
  });

  describe('Round-trip Translation', () => {
    it('should perform round-trip translation', async () => {
      const query = "supabase.from('test_table').select('id, name').eq('status', 'active')";
      const result = await translator.roundTripTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.exist;
      expect(result.supabaseJs).to.exist;
      expect(result.supabaseJs!).to.include('Generated from SQL');
    });
  });

  describe('Full Translation Pipeline', () => {
    it('should perform complete translation pipeline', async () => {
      const query = "supabase.from('test_table').select('title, author').order('title')";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.exist;
      expect(result.http).to.exist;
      expect(result.curl).to.exist;
      expect(result.supabaseJs).to.exist;
      
      // Verify SQL contains expected elements
      expect(result.sql!).to.include('SELECT');
      expect(result.sql!).to.include('FROM test_table');
      
      // Verify HTTP contains expected elements
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/test_table');
      
      // Verify cURL contains expected elements
      expect(result.curl!).to.include('curl');
      expect(result.curl!).to.include('/test_table');
      
      // Verify round-trip Supabase JS
      expect(result.supabaseJs!).to.include('Generated from SQL');
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