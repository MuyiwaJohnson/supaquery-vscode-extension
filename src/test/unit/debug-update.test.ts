import { expect } from 'chai';
import { SupabaseQueryParser } from '../../parser';

describe('Debug UPDATE Query', () => {
  let parser: SupabaseQueryParser;

  beforeEach(() => {
    parser = new SupabaseQueryParser();
  });

  it('should parse user query format', () => {
    const query = "supabase.from('customers').update({name: 'test'}).eq('id', 1).select()";
    const result = parser.parseComplexQuery(query);
    
    console.log('Query:', query);
    console.log('SQL:', result.sql);
    console.log('Error:', result.error);
    console.log('Warnings:', result.warnings);
    
    expect(result).to.exist;
    expect(result.original).to.equal(query);
  });

  it('should parse test format', () => {
    const query = "supabase.from('customers').eq('id', 1).update({name: 'test'})";
    const result = parser.parseComplexQuery(query);
    
    console.log('Query2:', query);
    console.log('SQL2:', result.sql);
    console.log('Error2:', result.error);
    console.log('Warnings2:', result.warnings);
    
    expect(result).to.exist;
    expect(result.original).to.equal(query);
  });
}); 