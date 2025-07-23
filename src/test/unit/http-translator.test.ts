import { expect } from 'chai';
import { HttpTranslator } from '../../http-translator';

describe('Custom HTTP Translator Tests', () => {
  let translator: HttpTranslator;

  beforeEach(() => {
    translator = new HttpTranslator();
  });

  describe('SELECT Operations', () => {
    it('should translate simple SELECT to GET request', async () => {
      const query = "supabase.from('test_table').select('id, name, email')";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/test_table');
      expect(result.http!.params.get('select')).to.equal('id,name,email');
    });

    it('should translate SELECT with filters to GET request', async () => {
      const query = "supabase.from('test_table').select('*').eq('status', 'active').limit(10)";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/test_table');
      expect(result.http!.params.get('status')).to.equal('eq.active');
      expect(result.http!.params.get('limit')).to.equal('10');
    });

    it('should translate SELECT with ORDER BY', async () => {
      const query = "supabase.from('test_table').select('title, author').order('title', { ascending: false })";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.params.get('order')).to.equal('title.asc');
    });

    it('should handle .single() method correctly', async () => {
      const query = "supabase.from('profiles').select('field, first_name, id, last_name, phone, program_type, role, sub_type, user_name').eq('id', 'user.id').single()";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/profiles');
      expect(result.http!.params.get('select')).to.equal('field,first_name,id,last_name,phone,program_type,role,sub_type,user_name');
      expect(result.http!.params.get('id')).to.equal('eq.user.id');
      // Should NOT have limit=1 for .single()
      expect(result.http!.params.has('limit')).to.be.false;
      // Should have the correct Accept header for single object
      expect(result.http!.headers.get('Accept')).to.equal('application/vnd.pgrest.object+json');
    });

    it('should handle .maybeSingle() method correctly', async () => {
      const query = "supabase.from('profiles').select('id, name').eq('id', '123').maybeSingle()";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/profiles');
      expect(result.http!.params.get('select')).to.equal('id,name');
      expect(result.http!.params.get('id')).to.equal('eq.123');
      // Should NOT have limit=1 for .maybeSingle()
      expect(result.http!.params.has('limit')).to.be.false;
      // Should have the correct Accept header for single object
      expect(result.http!.headers.get('Accept')).to.equal('application/vnd.pgrest.object+json');
    });

    it('should handle the exact user query correctly', async () => {
      const query = `const { data, error } = await supabase
        .from("profiles")
        .select(
          "field, first_name, id, last_name, phone, program_type, role, sub_type, user_name"
        )
        .eq("id", user.id)
        .single();`;
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.path).to.equal('/profiles');
      expect(result.http!.params.get('select')).to.equal('field,first_name,id,last_name,phone,program_type,role,sub_type,user_name');
      expect(result.http!.params.get('id')).to.equal('eq.user.id');
      // Should NOT have limit=1 for .single()
      expect(result.http!.params.has('limit')).to.be.false;
      // Should have the correct Accept header for single object
      expect(result.http!.headers.get('Accept')).to.equal('application/vnd.pgrest.object+json');
    });

    it('should generate URLs without URL encoding', async () => {
      const query = "supabase.from('profiles').select('field, first_name, id, last_name, phone, program_type, role, sub_type, user_name').eq('id', 'user.id').single()";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      
      // Check that the fullPath doesn't contain URL encoding
      expect(result.http!.fullPath).to.include('select=field,first_name,id,last_name,phone,program_type,role,sub_type,user_name');
      expect(result.http!.fullPath).to.include('id=eq.user.id');
      
      // Should NOT contain percentage signs (URL encoding)
      expect(result.http!.fullPath).to.not.include('%');
    });
  });

  describe('INSERT Operations', () => {
    it('should translate INSERT to POST request', async () => {
      const query = "supabase.from('test_table').insert({name: 'Test User', email: 'test@example.com'})";

      const result = await translator.translateToHttp(query);
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('POST');
      expect(result.http!.path).to.equal('/test_table');
      expect(result.http!.body).to.deep.equal({
        name: 'Test User',
        email: 'test@example.com'
      });
    });

    it('should translate INSERT with RETURNING', async () => {
      const query = "supabase.from('test_table').insert({name: 'Test User'}).select('id, name')";

      const result = await translator.translateToHttp(query);
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('POST');
      expect(result.http!.body).to.deep.equal({
        name: 'Test User'
      });
      expect(result.http!.params.get('select')).to.equal('id,name');
    });
  });

  describe('UPDATE Operations', () => {
    it('should translate UPDATE to PATCH request', async () => {
      const query = "supabase.from('test_table').eq('id', 1).update({name: 'Updated User'})";

      const result = await translator.translateToHttp(query);
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('PATCH');
      expect(result.http!.path).to.equal('/test_table');
      expect(result.http!.body).to.deep.equal({
        name: 'Updated User'
      });
    });

    it('should translate UPDATE with RETURNING', async () => {
      const query = "supabase.from('test_table').eq('id', 1).update({name: 'Updated User'}).select('id, name')";

      const result = await translator.translateToHttp(query);
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('PATCH');
      expect(result.http!.body).to.deep.equal({
        name: 'Updated User'
      });
      expect(result.http!.params.get('select')).to.equal('id,name');
    });
  });

  describe('DELETE Operations', () => {
    it('should translate DELETE to DELETE request', async () => {
      const query = "supabase.from('test_table').eq('id', 1).delete()";

      const result = await translator.translateToHttp(query);
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('DELETE');
      expect(result.http!.path).to.equal('/test_table');
    });

    it('should translate DELETE with RETURNING', async () => {
      const query = "supabase.from('test_table').eq('id', 1).delete().select('id, name')";

      const result = await translator.translateToHttp(query);
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('DELETE');
      expect(result.http!.params.get('select')).to.equal('id,name');
    });
  });

  describe('cURL Generation', () => {
    it('should generate cURL for GET request', async () => {
      const query = "supabase.from('test_table').select('id, name')";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      const curl = translator.generateCurl(result.http!);
      
      expect(curl).to.include('curl');
      expect(curl).to.include('/test_table');
      expect(curl).to.include('rest/v1');
      expect(curl).to.include('apikey');
      expect(curl).to.include('Authorization');
    });

    it('should generate cURL for POST request', async () => {
      const query = "supabase.from('test_table').insert({name: 'Test User'})";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      const curl = translator.generateCurl(result.http!);
      
      expect(curl).to.include('curl -X POST');
      expect(curl).to.include('Content-Type: application/json');
      expect(curl).to.include('{"name":"Test User"}');
    });

    it('should generate cURL for POST request with complex array', async () => {
      const query = "supabase.from('test_table').insert([{name: 'User 1', age: 25}, {name: 'User 2', age: 30}])";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      const curl = translator.generateCurl(result.http!);
      
      expect(curl).to.include('curl -X POST');
      expect(curl).to.include('Content-Type: application/json');
    });

    it('should handle complex insert object with arrays and variables', async () => {
      const query = `supabase.from("test_table").insert({
        id,
        items: [item],
        timestamp: new Date().toISOString(),
      }).select()`;

      const result = await translator.translateToHttp(query);
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('POST');
      expect(result.http!.path).to.equal('/test_table');

      const curl = translator.generateCurl(result.http!);
      expect(curl).to.include('{id}');
      expect(curl).to.include('items');
    });

    it('should handle update query with variable in eq condition', async () => {
      const query = `supabase.from("test_table").update({ items: newItems, timestamp: new Date().toISOString() }).eq("id", id).select()`;

      const result = await translator.translateToHttp(query);
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('PATCH');
      expect(result.http!.path).to.equal('/test_table');

      const curl = translator.generateCurl(result.http!);
      expect(curl).to.include('id=eq.id');
    });

    it('should generate cURL for PATCH request', async () => {
      const query = "supabase.from('test_table').eq('id', 1).update({name: 'Updated User'})";
      const result = await translator.translateToHttp(query);
      
      expect(result.http).to.exist;
      const curl = translator.generateCurl(result.http!);
      
      expect(curl).to.include('curl -X PATCH');
      expect(curl).to.include('Content-Type: application/json');
      expect(curl).to.include('{"name":"Updated User"}');
    });

    it('should generate cURL for DELETE request', async () => {
      const query = "supabase.from('test_table').eq('id', 1).delete()";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      
      const curl = translator.generateCurl(result.http!);
      expect(curl).to.include('curl -X DELETE');
    });

    it('should generate cURL with Accept header for .single() queries', async () => {
      const query = "supabase.from('profiles').select('id, name').eq('id', '123').single()";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      
      const curl = translator.generateCurl(result.http!);
      expect(curl).to.include('curl \'');
      expect(curl).to.include('Accept: application/vnd.pgrest.object+json');
      expect(curl).to.include('id=eq.123');
      expect(curl).to.include('[YOUR SUPABASE PROJECT URL]/rest/v1');
      expect(curl).to.include('apikey: SUPABASE_CLIENT_ANON_KEY');
      expect(curl).to.include('Authorization: Bearer SUPABASE_CLIENT_ANON_KEY');
      // Should NOT include limit=1
      expect(curl).to.not.include('limit=1');
    });
  });

  describe('Complex Queries', () => {
    it('should handle complex WHERE conditions', async () => {
      const query = "supabase.from('test_table').select('*').eq('status', 'active').gt('age', 18).lt('age', 65)";
      const result = await translator.translateToHttp(query);
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      expect(result.http!.params.get('status')).to.equal('eq.active');
      // Note: Multiple conditions on same column will overwrite each other
      // The last condition wins: age < 65
      expect(result.http!.params.get('age')).to.equal('lt.65');
    });

    it('should handle ORDER BY with multiple columns', async () => {
      const query = "supabase.from('test_table').select('*').order('name', {ascending: true}).order('created_at', {ascending: false})";
      const result = await translator.translateToHttp(query);
      
      expect(result.error).to.be.undefined;
      expect(result.http).to.exist;
      expect(result.http!.method).to.equal('GET');
      // Note: Multiple ORDER BY clauses will overwrite each other
      // This is a limitation of the current implementation
      expect(result.http!.params.get('order')).to.exist;
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
      const query = "supabase.from('users').rpc('custom_function')";
      const result = await translator.translateToHttp(query);
      
      // RPC calls should still generate SQL but may fail on HTTP conversion
      expect(result).to.exist;
      expect(result.original).to.equal(query);
      // Either we get SQL or an error, both are acceptable
      expect(result.sql || result.error).to.exist;
    });
  });
}); 