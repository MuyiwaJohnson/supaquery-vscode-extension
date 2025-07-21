import * as assert from 'assert';
import { AstParser } from '../../parser/ast-parser';
import { CrudParser } from '../../parser/crud';
import { FilterParser } from '../../parser/filters';
import { JoinParser } from '../../parser/joins';
import { SqlGenerator } from '../../sql-generator';

suite('Parser Component Tests', () => {
  let astParser: AstParser;
  let crudParser: CrudParser;
  let filterParser: FilterParser;
  let joinParser: JoinParser;
  let sqlGenerator: SqlGenerator;

  suiteSetup(() => {
    astParser = new AstParser();
    crudParser = new CrudParser({ currentTable: 'users', aliases: new Map() });
    filterParser = new FilterParser({ currentTable: 'users', aliases: new Map() });
    joinParser = new JoinParser({ currentTable: 'users', aliases: new Map() });
    sqlGenerator = new SqlGenerator();
  });

  suite('AST Parser Tests', () => {
    test('Should parse method chain correctly', () => {
      const query = "supabase.from('users').select('id, name').eq('status', 'active')";
      const methodChain = astParser.parseQueryText(query);
      
      assert.ok(methodChain.length > 0);
      assert.strictEqual(methodChain[0].getName(), 'from');
    });

    test('Should extract table name', () => {
      const query = "supabase.from('users')";
      const methodChain = astParser.parseQueryText(query);
      const tableName = astParser.extractTableName(methodChain[0]);
      
      assert.strictEqual(tableName, 'users');
    });

    test('Should extract columns from select', () => {
      const query = "supabase.from('users').select('id, name, email')";
      const methodChain = astParser.parseQueryText(query);
      const selectCall = methodChain.find(call => call.getName() === 'select');
      
      if (selectCall) {
        const columns = astParser.extractColumns(selectCall);
        assert.deepStrictEqual(columns, ['id', 'name', 'email']);
      }
    });

    test('Should extract values from insert', () => {
      const query = "supabase.from('users').insert({name: 'Alice', email: 'alice@example.com'})";
      const methodChain = astParser.parseQueryText(query);
      const insertCall = methodChain.find(call => call.getName() === 'insert');
      
      if (insertCall) {
        const values = astParser.extractValues(insertCall);
        assert.ok(values.length > 0);
        assert.ok(values[0].name === 'Alice');
      }
    });

    test('Should extract filter conditions', () => {
      const query = "supabase.from('users').eq('id', 1)";
      const methodChain = astParser.parseQueryText(query);
      const eqCall = methodChain.find(call => call.getName() === 'eq');
      
      if (eqCall) {
        const filter = astParser.extractFilter(eqCall);
        assert.ok(filter);
        assert.strictEqual(filter?.column, 'id');
        assert.strictEqual(filter?.value, 1);
      }
    });
  });

  suite('CRUD Parser Tests', () => {
    test('Should parse insert method chain', () => {
      const methodChain = [
        { getName: () => 'insert', getArguments: () => [{ name: 'Alice', email: 'alice@example.com' }] }
      ];
      
      const result = crudParser.parseInsert(methodChain);
      assert.strictEqual(result.type, 'insert');
      assert.strictEqual(result.table, 'users');
      assert.ok(result.values && result.values.length > 0);
    });

    test('Should parse update method chain', () => {
      const methodChain = [
        { getName: () => 'update', getArguments: () => [{ name: 'Bob' }] },
        { getName: () => 'eq', getArguments: () => ['id', 1] }
      ];
      
      const result = crudParser.parseUpdate(methodChain);
      assert.strictEqual(result.type, 'update');
      assert.strictEqual(result.table, 'users');
      assert.ok(result.values && result.values.length > 0);
      assert.ok(result.where && result.where.length > 0);
    });

    test('Should parse delete method chain', () => {
      const methodChain = [
        { getName: () => 'delete', getArguments: () => [] },
        { getName: () => 'eq', getArguments: () => ['id', 1] }
      ];
      
      const result = crudParser.parseDelete(methodChain);
      assert.strictEqual(result.type, 'delete');
      assert.strictEqual(result.table, 'users');
      assert.ok(result.where && result.where.length > 0);
    });

    test('Should parse upsert method chain', () => {
      const methodChain = [
        { getName: () => 'upsert', getArguments: () => [{ id: 1, name: 'Bob' }] }
      ];
      
      const result = crudParser.parseUpsert(methodChain);
      assert.strictEqual(result.type, 'upsert');
      assert.strictEqual(result.table, 'users');
      assert.ok(result.values && result.values.length > 0);
    });
  });

  suite('Filter Parser Tests', () => {
    test('Should parse OR clause', () => {
      const orClause = "id.eq.1,name.eq.Bob";
      const result = filterParser.parseOrClause(orClause);
      
      assert.ok(result.length > 0);
      assert.strictEqual(result[0].column, 'id');
      assert.strictEqual(result[0].operator, 'eq');
      assert.strictEqual(result[0].value, 1);
    });

    test('Should parse NOT clause', () => {
      const notClause = "id.eq.1";
      const result = filterParser.parseNotClause(notClause);
      
      assert.strictEqual(result.column, 'id');
      assert.strictEqual(result.operator, 'not');
    });

    test('Should parse IN clause', () => {
      const column = 'id';
      const values = [1, 2, 3];
      const result = filterParser.parseInClause(column, values);
      
      assert.strictEqual(result.column, 'id');
      assert.strictEqual(result.operator, 'in');
      assert.deepStrictEqual(result.value, [1, 2, 3]);
    });

    test('Should parse CONTAINS clause', () => {
      const column = 'metadata';
      const value = { size: 'XL' };
      const result = filterParser.parseContainsClause(column, value);
      
      assert.strictEqual(result.column, 'metadata');
      assert.strictEqual(result.operator, 'contains');
      assert.deepStrictEqual(result.value, { size: 'XL' });
    });

    test('Should parse nested AND/OR', () => {
      const expression = "and(age.gt.18,name.ilike.%a%),and(age.lt.30)";
      const result = filterParser.parseNestedAndOr(expression);
      
      assert.ok(result.length > 0);
    });

    test('Should parse auth clause', () => {
      const column = 'user_id';
      const value = 'auth.uid()';
      const result = filterParser.parseAuthClause(column, value);
      
      assert.strictEqual(result.column, 'user_id');
      assert.strictEqual(result.operator, 'eq');
      assert.strictEqual(result.value, 'auth.uid()');
    });

    test('Should build WHERE clause', () => {
      const clauses = [
        { column: 'id', operator: 'eq' as const, value: 1 },
        { column: 'status', operator: 'eq' as const, value: 'active', logicalOperator: 'AND' as const }
      ];
      
      const result = filterParser.buildWhereClause(clauses);
      assert.ok(result.includes('id = 1'));
      assert.ok(result.includes('AND'));
      assert.ok(result.includes('status = active'));
    });
  });

  suite('Join Parser Tests', () => {
    test('Should parse select with joins', () => {
      const selectArg = "*, posts(title, content)";
      const result = joinParser.parseSelectWithJoins(selectArg);
      
      assert.ok(result.columns.includes('*'));
      assert.ok(result.joins.length > 0);
      assert.strictEqual(result.joins[0].table, 'posts');
    });

    test('Should parse relationship query', () => {
      const part = "posts(title, content)";
      const [tableName, columnList] = joinParser['parseRelationshipQuery'](part);
      
      assert.strictEqual(tableName, 'posts');
      assert.deepStrictEqual(columnList, ['title', 'content']);
    });

    test('Should create join clause', () => {
      const tableName = 'posts';
      const joinClause = joinParser['createJoinClause'](tableName);
      
      assert.strictEqual(joinClause.table, 'posts');
      assert.ok(joinClause.on.includes('posts.user_id = users.id'));
      assert.strictEqual(joinClause.type, 'INNER');
    });

    test('Should format relationship columns', () => {
      const tableName = 'posts';
      const columns = ['title', 'content'];
      const result = joinParser['formatRelationshipColumns'](tableName, columns);
      
      assert.deepStrictEqual(result, ['posts.title', 'posts.content']);
    });

    test('Should build join clause', () => {
      const joins = [
        { table: 'posts', on: 'posts.user_id = users.id', type: 'INNER' as const }
      ];
      
      const result = joinParser.buildJoinClause(joins);
      assert.ok(result.includes('INNER JOIN posts'));
      assert.ok(result.includes('ON posts.user_id = users.id'));
    });
  });

  suite('SQL Generator Tests', () => {
    test('Should generate SELECT SQL', () => {
      const queryNode = {
        type: 'select' as const,
        table: 'users',
        columns: ['id', 'name', 'email'],
        where: [{ column: 'status', operator: 'eq' as const, value: 'active' }]
      };
      
      const result = sqlGenerator.generateSql(queryNode);
      assert.ok(result.includes('SELECT id, name, email'));
      assert.ok(result.includes('FROM users'));
      assert.ok(result.includes('WHERE status = active'));
    });

    test('Should generate INSERT SQL', () => {
      const queryNode = {
        type: 'insert' as const,
        table: 'users',
        values: [{ name: 'Alice', email: 'alice@example.com' }]
      };
      
      const result = sqlGenerator.generateSql(queryNode);
      assert.ok(result.includes('INSERT INTO users'));
      assert.ok(result.includes('VALUES'));
    });

    test('Should generate UPDATE SQL', () => {
      const queryNode = {
        type: 'update' as const,
        table: 'users',
        values: [{ name: 'Bob' }],
        where: [{ column: 'id', operator: 'eq' as const, value: 1 }]
      };
      
      const result = sqlGenerator.generateSql(queryNode);
      assert.ok(result.includes('UPDATE users'));
      assert.ok(result.includes('SET'));
      assert.ok(result.includes('WHERE id = 1'));
    });

    test('Should generate DELETE SQL', () => {
      const queryNode = {
        type: 'delete' as const,
        table: 'users',
        where: [{ column: 'id', operator: 'eq' as const, value: 1 }]
      };
      
      const result = sqlGenerator.generateSql(queryNode);
      assert.ok(result.includes('DELETE FROM users'));
      assert.ok(result.includes('WHERE id = 1'));
    });

    test('Should generate UPSERT SQL', () => {
      const queryNode = {
        type: 'upsert' as const,
        table: 'users',
        values: [{ id: 1, name: 'Bob' }]
      };
      
      const result = sqlGenerator.generateSql(queryNode);
      assert.ok(result.includes('INSERT INTO users'));
      assert.ok(result.includes('ON CONFLICT'));
    });

    test('Should format SQL', () => {
      const sql = "SELECT * FROM users WHERE id = 1 ORDER BY name LIMIT 10";
      const result = sqlGenerator.formatSql(sql);
      
      assert.ok(result.includes('\n'));
      assert.ok(result.includes('SELECT'));
      assert.ok(result.includes('FROM'));
      assert.ok(result.includes('WHERE'));
    });
  });
}); 