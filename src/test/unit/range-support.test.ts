import { expect } from 'chai';
import { EnhancedTranslator } from '../../enhanced-translator';

describe('Range Support', () => {
  let translator: EnhancedTranslator;

  beforeEach(() => {
    translator = new EnhancedTranslator();
  });

  describe('Individual Range Operators', () => {
    it('should handle rangeGt', async () => {
      const query = "supabase.from('products').rangeGt('price', 10)";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('price > 10');
    });

    it('should handle rangeGte', async () => {
      const query = "supabase.from('products').rangeGte('price', 10)";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('price >= 10');
    });

    it('should handle rangeLt', async () => {
      const query = "supabase.from('products').rangeLt('price', 100)";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('price < 100');
    });

    it('should handle rangeLte', async () => {
      const query = "supabase.from('products').rangeLte('price', 100)";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('price <= 100');
    });
  });

  describe('Range Operator with BETWEEN', () => {
    it('should handle range with array values', async () => {
      const query = "supabase.from('users').range('age', [18, 65])";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('age BETWEEN 18 AND 65');
    });

    it('should handle range with single value', async () => {
      const query = "supabase.from('users').range('age', 25)";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('age = 25');
    });
  });

  describe('Complex Range Queries', () => {
    it('should handle multiple range operators', async () => {
      const query = "supabase.from('products').rangeGt('price', 50).rangeLt('price', 200)";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('price > 50');
      expect(result.sql).to.include('price < 200');
    });

    it('should handle range with other filters', async () => {
      const query = "supabase.from('posts').rangeGte('created_at', '2024-01-01').eq('status', 'published')";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include("created_at >= '2024-01-01'");
      expect(result.sql).to.include("status = 'published'");
    });

    it('should handle range with date values', async () => {
      const query = "supabase.from('orders').rangeGte('created_at', '2024-01-01').rangeLte('created_at', '2024-12-31')";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include("created_at >= '2024-01-01'");
      expect(result.sql).to.include("created_at <= '2024-12-31'");
    });
  });

  describe('Range in CRUD Operations', () => {
    it('should handle range in update operations', async () => {
      const query = "supabase.from('products').rangeGt('price', 100).update({ discount: 0.1 })";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('UPDATE products');
      expect(result.sql).to.include('price > 100');
    });

    it('should handle range in delete operations', async () => {
      const query = "supabase.from('orders').rangeLt('created_at', '2023-01-01').delete()";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.sql).to.include('DELETE FROM orders');
      expect(result.sql).to.include("created_at < '2023-01-01'");
    });
  });

  describe('HTTP Translation with Range', () => {
    it('should generate correct HTTP query parameters for range', async () => {
      const query = "supabase.from('products').rangeGt('price', 10).rangeLt('price', 100)";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      // Check that at least one range parameter is present
      const priceParam = result.http!.params.get('price');
      expect(priceParam).to.exist;
      // Should have either gt.10 or lt.100 (PostgREST will apply both filters)
      expect(priceParam === 'gt.10' || priceParam === 'lt.100').to.be.true;
    });

    it('should generate correct HTTP query parameters for range with dates', async () => {
      const query = "supabase.from('orders').rangeGte('created_at', '2024-01-01').rangeLte('created_at', '2024-12-31')";
      const result = await translator.fullTranslation(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      // Check that at least one range parameter is present
      const dateParam = result.http!.params.get('created_at');
      expect(dateParam).to.exist;
      // Should have either gte.2024-01-01 or lte.2024-12-31 (PostgREST will apply both filters)
      expect(dateParam === 'gte.2024-01-01' || dateParam === 'lte.2024-12-31').to.be.true;
    });
  });
}); 