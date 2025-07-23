import { SupabaseQueryParser } from '../../parser';
import { EnhancedTranslator } from '../../enhanced-translator';

// Simple queries for performance testing
const testQueries = [
  "supabase.from('test_table').select('*')",
  "supabase.from('test_table').select('id, name').eq('status', 'active')",
  "supabase.from('test_table').insert({name: 'Test User', email: 'test@example.com'})",
  "supabase.from('test_table').eq('id', 1).update({name: 'Updated User'})",
  "supabase.from('test_table').eq('id', 1).delete()",
  "supabase.from('test_table').select('*').eq('status', 'active').gt('age', 18)",
  "supabase.from('test_table').select('*').in('status', ['active', 'pending'])",
  "supabase.from('test_table').select('*').like('name', '%test%')",
  "supabase.from('test_table').select('*').or('status.eq.active,age.gt.18')",
  "supabase.from('test_table').select('*').not('status', 'inactive')"
];

const complexQueries = [
  "supabase.from('test_table').select('*, related_table(title, content)').eq('related_table.published', true)",
  "supabase.from('test_table').select('*').eq('auth.uid()', 'user-id').or('role.eq.admin,is_public.eq.true')"
];

class PerformanceBenchmark {
  private parser: SupabaseQueryParser;
  private translator: EnhancedTranslator;

  constructor() {
    this.parser = new SupabaseQueryParser();
    this.translator = new EnhancedTranslator();
  }

  private measureTime<T>(fn: () => T): { result: T; time: number } {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    return { result, time: end - start };
  }

  private async measureAsyncTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, time: end - start };
  }

  async benchmarkParser() {
    console.log('\n🔍 Parser Performance Benchmark');
    console.log('================================');

    // Test simple queries
    console.log('\n📊 Simple Queries (10 queries):');
    const simpleTimes: number[] = [];
    
    for (const query of testQueries) {
      const { time } = this.measureTime(() => {
        this.parser.parseQuery(query);
      });
      simpleTimes.push(time);
      console.log(`  ${query.substring(0, 50)}... ${time.toFixed(2)}ms`);
    }

    const avgSimpleTime = simpleTimes.reduce((a, b) => a + b, 0) / simpleTimes.length;
    const maxSimpleTime = Math.max(...simpleTimes);
    const minSimpleTime = Math.min(...simpleTimes);

    console.log(`\n  Average: ${avgSimpleTime.toFixed(2)}ms`);
    console.log(`  Min: ${minSimpleTime.toFixed(2)}ms`);
    console.log(`  Max: ${maxSimpleTime.toFixed(2)}ms`);

    // Test complex queries
    console.log('\n📊 Complex Queries (4 queries):');
    const complexTimes: number[] = [];
    
    for (const query of complexQueries) {
      const { time } = this.measureTime(() => {
        this.parser.parseQuery(query);
      });
      complexTimes.push(time);
      console.log(`  ${query.substring(0, 50)}... ${time.toFixed(2)}ms`);
    }

    const avgComplexTime = complexTimes.reduce((a, b) => a + b, 0) / complexTimes.length;
    const maxComplexTime = Math.max(...complexTimes);
    const minComplexTime = Math.min(...complexTimes);

    console.log(`\n  Average: ${avgComplexTime.toFixed(2)}ms`);
    console.log(`  Min: ${minComplexTime.toFixed(2)}ms`);
    console.log(`  Max: ${maxComplexTime.toFixed(2)}ms`);

    return {
      simple: { avg: avgSimpleTime, min: minSimpleTime, max: maxSimpleTime },
      complex: { avg: avgComplexTime, min: minComplexTime, max: maxComplexTime }
    };
  }

  async benchmarkTranslator() {
    console.log('\n🔄 Translator Performance Benchmark');
    console.log('===================================');

    // Test full translation pipeline
    console.log('\n📊 Full Translation Pipeline (10 simple queries):');
    const translationTimes: number[] = [];
    
    for (const query of testQueries) {
      const { time } = await this.measureAsyncTime(async () => {
        await this.translator.fullTranslation(query);
      });
      translationTimes.push(time);
      console.log(`  ${query.substring(0, 50)}... ${time.toFixed(2)}ms`);
    }

    const avgTranslationTime = translationTimes.reduce((a, b) => a + b, 0) / translationTimes.length;
    const maxTranslationTime = Math.max(...translationTimes);
    const minTranslationTime = Math.min(...translationTimes);

    console.log(`\n  Average: ${avgTranslationTime.toFixed(2)}ms`);
    console.log(`  Min: ${minTranslationTime.toFixed(2)}ms`);
    console.log(`  Max: ${maxTranslationTime.toFixed(2)}ms`);

    return {
      avg: avgTranslationTime,
      min: minTranslationTime,
      max: maxTranslationTime
    };
  }

  async benchmarkRealTimeScenario() {
    console.log('\n⚡ Real-time Translation Scenario');
    console.log('=================================');

    // Simulate real-time translation with debouncing
    const query = "supabase.from('test_table').select('*').eq('status', 'active')";
    
    console.log('\n📊 Single Query Translation (5 iterations):');
    const times: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const { time } = await this.measureAsyncTime(async () => {
        await this.translator.fullTranslation(query);
      });
      times.push(time);
      console.log(`  Iteration ${i + 1}: ${time.toFixed(2)}ms`);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`\n  Average: ${avgTime.toFixed(2)}ms`);

    // Test if it's fast enough for real-time (should be under 100ms)
    const isRealTimeReady = avgTime < 100;
    console.log(`  Real-time ready: ${isRealTimeReady ? '✅ Yes' : '❌ No'} (target: <100ms)`);

    return { avg: avgTime, isRealTimeReady };
  }

  async runAllBenchmarks() {
    console.log('🚀 SupaQuery Performance Benchmark');
    console.log('==================================');

    const parserResults = await this.benchmarkParser();
    const translatorResults = await this.benchmarkTranslator();
    const realTimeResults = await this.benchmarkRealTimeScenario();

    console.log('\n📈 Performance Summary');
    console.log('=====================');
    console.log(`Parser - Simple queries: ${parserResults.simple.avg.toFixed(2)}ms avg`);
    console.log(`Parser - Complex queries: ${parserResults.complex.avg.toFixed(2)}ms avg`);
    console.log(`Translator - Full pipeline: ${translatorResults.avg.toFixed(2)}ms avg`);
    console.log(`Real-time ready: ${realTimeResults.isRealTimeReady ? '✅ Yes' : '❌ No'}`);

    // Performance recommendations
    console.log('\n💡 Performance Recommendations');
    console.log('=============================');
    
    if (parserResults.simple.avg > 10) {
      console.log('⚠️  Parser is slow for simple queries. Consider optimizing AST parsing.');
    }
    
    if (translatorResults.avg > 50) {
      console.log('⚠️  Full translation is slow. Consider caching or optimizing HTTP generation.');
    }
    
    if (!realTimeResults.isRealTimeReady) {
      console.log('⚠️  Not fast enough for real-time. Consider increasing debounce time or optimizing.');
    }

    if (parserResults.simple.avg <= 10 && translatorResults.avg <= 50 && realTimeResults.isRealTimeReady) {
      console.log('✅ Performance is excellent for simple queries!');
    }

    return {
      parser: parserResults,
      translator: translatorResults,
      realTime: realTimeResults
    };
  }
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runAllBenchmarks().catch(console.error);
}

export { PerformanceBenchmark }; 