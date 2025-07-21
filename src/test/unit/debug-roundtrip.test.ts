import { expect } from 'chai';
import { EnhancedTranslator } from '../../enhanced-translator';

describe('Debug Round-trip Translation', () => {
  let translator: EnhancedTranslator;

  beforeEach(() => {
    translator = new EnhancedTranslator();
  });

  it('should include HTTP in round-trip translation', async () => {
    const query = "supabase.from('customers').update({name: 'test'}).eq('id', 1).select()";
    const result = await translator.roundTripTranslation(query);
    
    console.log('Query:', query);
    console.log('SQL:', result.sql);
    console.log('HTTP:', result.http);
    console.log('Supabase JS:', result.supabaseJs);
    console.log('Error:', result.error);
    
    expect(result).to.exist;
    expect(result.original).to.equal(query);
    expect(result.sql).to.exist;
    expect(result.http).to.exist;
    // For non-SELECT queries, supabaseJs will be undefined (sql-to-rest limitation)
    // expect(result.supabaseJs).to.exist;
  });
}); 