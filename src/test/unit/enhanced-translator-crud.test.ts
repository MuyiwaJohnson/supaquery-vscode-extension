import { expect } from 'chai';
import { EnhancedTranslator } from '../../enhanced-translator';

describe('EnhancedTranslator CRUD Operations', () => {
  let translator: EnhancedTranslator;

  beforeEach(() => {
    translator = new EnhancedTranslator();
  });

  describe('Non-SELECT Operations', () => {
    it('should handle UPDATE queries', async () => {
      const query = "supabase.from('test_table').eq('id', 1).update({name: 'Updated User'})";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('PATCH');
      expect(result.http!.path).to.equal('/test_table');
      expect(result.http!.body).to.deep.equal({
        name: 'Updated User'
      });
    });

    it('should handle INSERT queries', async () => {
      const query = "supabase.from('test_table').insert({name: 'New User', email: 'new@example.com'})";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('POST');
      expect(result.http!.path).to.equal('/test_table');
      expect(result.http!.body).to.deep.equal({
        name: 'New User',
        email: 'new@example.com'
      });
    });

    it('should handle DELETE queries', async () => {
      const query = "supabase.from('test_table').eq('id', 1).delete()";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('DELETE');
      expect(result.http!.path).to.equal('/test_table');
    });

    it('should handle UPSERT queries', async () => {
      const query = "supabase.from('test_table').upsert({id: 1, name: 'Test User'})";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('POST');
      expect(result.http!.path).to.equal('/test_table');
      expect(result.http!.body).to.deep.equal({
        id: 1,
        name: 'Test User'
      });
    });
  });

  describe('SELECT Operations', () => {
    it('should handle SELECT queries with sql-to-rest', async () => {
      const query = "supabase.from('test_table').select('id, name').eq('status', 'active')";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/test_table');
      expect(result.http!.params.get('select')).to.equal('id,name');
      expect(result.http!.params.get('status')).to.equal('eq.active');
    });
  });
}); 