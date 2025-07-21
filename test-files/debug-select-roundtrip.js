const { EnhancedTranslator } = require('./out/enhanced-translator');

const translator = new EnhancedTranslator();

const query = `const { data: existing, error: fetchError } = await supabase
    .from("kyc_info")
    .select("comments")
    .eq("member_id", member_id)
    .maybeSingle();`;

async function testRoundTrip() {
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
}

testRoundTrip().catch(console.error); 