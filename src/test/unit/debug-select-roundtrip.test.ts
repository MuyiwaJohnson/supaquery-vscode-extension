import { expect } from 'chai';
import { EnhancedTranslator } from '../../enhanced-translator';

describe('Debug SELECT Round-trip Translation', () => {
  let translator: EnhancedTranslator;

  beforeEach(() => {
    translator = new EnhancedTranslator();
  });

  it('should include HTTP in SELECT round-trip translation', async () => {
    const query = `const { data: existing, error: fetchError } = await supabase
    .from("kyc_info")
    .select("comments")
    .eq("member_id", member_id)
    .maybeSingle();`;
    
    const result = await translator.roundTripTranslation(query);
    
    console.log('Original Supabase JS:');
    console.log(query);
    console.log('\nGenerated SQL:');
    console.log(result.sql);
    console.log('\nHTTP:');
    console.log(result.http);
    console.log('\nRound-trip Supabase JS:');
    console.log(result.supabaseJs);
    console.log('\nError:', result.error);
    
    expect(result).to.exist;
    expect(result.original).to.equal(query);
    expect(result.sql).to.exist;
    expect(result.http).to.exist;
    expect(result.supabaseJs).to.exist;
  });
}); 