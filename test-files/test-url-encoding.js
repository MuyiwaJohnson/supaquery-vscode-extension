const { HttpTranslator } = require('../out/http-translator');

async function testUrlEncoding() {
  const translator = new HttpTranslator();
  
  const query = `const { data, error } = await supabase
    .from("profiles")
    .select(
      "field, first_name, id, last_name, phone, program_type, role, sub_type, user_name"
    )
    .eq("id", user.id)
    .single();`;
  
  const result = await translator.translateToHttp(query);
  
  console.log('Original Query:');
  console.log(query);
  console.log('\nGenerated HTTP Request:');
  console.log('Method:', result.http?.method);
  console.log('Path:', result.http?.path);
  console.log('Full URL:', result.http?.fullPath);
  console.log('Parameters:', result.http?.params);
  console.log('Headers:', result.http?.headers);
  
  // Check for URL encoding
  if (result.http?.fullPath.includes('%')) {
    console.log('\n❌ URL contains encoding (percentage signs)');
  } else {
    console.log('\n✅ URL is clean (no percentage signs)');
  }
}

testUrlEncoding().catch(console.error); 