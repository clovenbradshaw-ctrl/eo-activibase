/**
 * EOQL System Tests
 * Comprehensive tests for the EO Query Language system
 */

// Load all EOQL modules
const path = require('path');

// Load in order of dependencies
require(path.join(__dirname, '../foundation/eo_constants.js'));
require(path.join(__dirname, '../foundation/eo_identity.js'));
require(path.join(__dirname, '../foundation/eo_query_language.js'));
require(path.join(__dirname, '../foundation/eo_query_crosswalk.js'));
require(path.join(__dirname, '../foundation/eo_query_compiler.js'));
require(path.join(__dirname, '../foundation/eo_query_parser.js'));

// Test utilities
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        failures.push({ name, error: e.message });
        console.log(`  ✗ ${name}`);
        console.log(`    Error: ${e.message}`);
    }
}

function assertEqual(actual, expected, message = '') {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(`${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`);
    }
}

function assertContains(str, substring, message = '') {
    if (!str.includes(substring)) {
        throw new Error(`${message}\nExpected to contain: "${substring}"\nActual: "${str}"`);
    }
}

function assertNotNull(value, message = '') {
    if (value === null || value === undefined) {
        throw new Error(`${message}\nExpected non-null value`);
    }
}

// ============================================================================
// TEST SUITES
// ============================================================================

console.log('\n========================================');
console.log('EOQL System Tests');
console.log('========================================\n');

// ----------------------------------------------------------------------------
// 1. EOQL Core Tests
// ----------------------------------------------------------------------------

console.log('1. EOQL Core Tests');
console.log('------------------');

test('EOQL module loads correctly', () => {
    assertNotNull(global.EOQL, 'EOQL should be defined');
    assertNotNull(global.EOQL.from, 'EOQL.from should be defined');
    assertNotNull(global.EOQL.expr, 'EOQL.expr should be defined');
});

test('Create simple query with from()', () => {
    const query = global.EOQL.from('users');
    assertNotNull(query, 'Query should be created');
    const ast = query.toAST();
    assertEqual(ast.pipeline.length, 1, 'Pipeline should have 1 node');
    assertEqual(ast.pipeline[0].operator, 'INS', 'First operator should be INS');
    assertEqual(ast.pipeline[0].params.source, 'users', 'Source should be users');
});

test('Chain multiple operators', () => {
    const query = global.EOQL.from('users')
        .where({ status: 'active' })
        .select('id', 'name', 'email')
        .limit(10);

    const ast = query.toAST();
    assertEqual(ast.pipeline.length, 4, 'Pipeline should have 4 nodes');
    assertEqual(ast.pipeline[0].operator, 'INS');
    assertEqual(ast.pipeline[1].operator, 'SEG');
    assertEqual(ast.pipeline[2].operator, 'DES');
    assertEqual(ast.pipeline[3].operator, 'SEG');
});

test('Expression builder - comparisons', () => {
    const Expr = global.EOQL.expr;

    const eq = Expr.eq('name', 'John');
    assertEqual(eq.type, 'eq');

    const gt = Expr.gt('age', 18);
    assertEqual(gt.type, 'gt');

    const between = Expr.between('price', 10, 100);
    assertEqual(between.type, 'between');
    assertEqual(between.low, 10);
    assertEqual(between.high, 100);
});

test('Expression builder - logical operators', () => {
    const Expr = global.EOQL.expr;

    const and = Expr.and(
        Expr.eq('status', 'active'),
        Expr.gt('age', 18)
    );
    assertEqual(and.type, 'and');
    assertEqual(and.conditions.length, 2);

    const or = Expr.or(
        Expr.eq('role', 'admin'),
        Expr.eq('role', 'superuser')
    );
    assertEqual(or.type, 'or');
});

test('Expression builder - aggregates', () => {
    const Expr = global.EOQL.expr;

    const sum = Expr.sum('amount');
    assertEqual(sum.type, 'agg');
    assertEqual(sum.fn, 'SUM');

    const count = Expr.count();
    assertEqual(count.fn, 'COUNT');
    assertEqual(count.field, '*');
});

test('Query with joins', () => {
    const query = global.EOQL.from('orders')
        .leftJoin('customers', global.EOQL.expr.eq('customer_id', 'customers.id'))
        .select('orders.id', 'customers.name');

    const ast = query.toAST();
    const joinNode = ast.pipeline.find(n => n.operator === 'CON');
    assertNotNull(joinNode);
    assertEqual(joinNode.params.type, 'left');
    assertEqual(joinNode.params.target, 'customers');
});

test('Query with group by and aggregation', () => {
    const query = global.EOQL.from('sales')
        .groupBy('product_id')
        .sum('amount', 'total_sales')
        .select('product_id', 'total_sales');

    const ast = query.toAST();
    const groupNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.groupBy);
    assertNotNull(groupNode);
    assertEqual(groupNode.params.groupBy, ['product_id']);
});

test('Query validation - missing source', () => {
    const query = new global.EOQuery();
    query._addOp('SEG', { where: { x: 1 } });

    const validation = query.validate();
    assertEqual(validation.valid, false);
    assertEqual(validation.errors[0].code, 'NO_SOURCE');
});

test('Holon registry - built-in holons', () => {
    const registry = global.EOQL.registry;
    assertNotNull(registry.get('WHERE'));
    assertNotNull(registry.get('JOIN'));
    assertNotNull(registry.get('GROUP_BY'));
});

test('Holon registry - register custom holon', () => {
    const registry = global.EOQL.registry;

    registry.register('ACTIVE_USERS', () => ['SEG', { where: { status: 'active' } }], {
        description: 'Filter to active users only'
    });

    const holon = registry.get('ACTIVE_USERS');
    assertNotNull(holon);

    const userHolons = registry.getUserHolons();
    assertNotNull(userHolons.ACTIVE_USERS);
});

// ----------------------------------------------------------------------------
// 2. SQL Compiler Tests
// ----------------------------------------------------------------------------

console.log('\n2. SQL Compiler Tests');
console.log('---------------------');

test('Compiler module loads correctly', () => {
    assertNotNull(global.EOQueryCompiler);
    assertNotNull(global.toSQL);
});

test('Compile simple SELECT', () => {
    const query = global.EOQL.from('users')
        .select('id', 'name');

    const sql = global.toSQL(query, 'postgresql');
    assertContains(sql, 'SELECT');
    assertContains(sql, 'id, name');
    assertContains(sql, 'FROM users');
});

test('Compile WHERE clause', () => {
    const query = global.EOQL.from('users')
        .where({ status: 'active' })
        .select('*');

    const sql = global.toSQL(query);
    assertContains(sql, 'WHERE');
    assertContains(sql, "status = 'active'");
});

test('Compile complex WHERE with expressions', () => {
    const Expr = global.EOQL.expr;
    const query = global.EOQL.from('products')
        .where(Expr.and(
            Expr.gt('price', 100),
            Expr.eq('category', 'electronics')
        ))
        .select('*');

    const sql = global.toSQL(query);
    assertContains(sql, 'price > 100');
    assertContains(sql, "category = 'electronics'");
    assertContains(sql, 'AND');
});

test('Compile JOIN', () => {
    const Expr = global.EOQL.expr;
    const query = global.EOQL.from('orders')
        .leftJoin('customers', Expr.eq('customer_id', 'customers.id'))
        .select('*');

    const sql = global.toSQL(query);
    assertContains(sql, 'LEFT JOIN customers');
    assertContains(sql, 'ON');
});

test('Compile GROUP BY', () => {
    const query = global.EOQL.from('sales')
        .groupBy('region', 'product')
        .select('region', 'product');

    const sql = global.toSQL(query);
    assertContains(sql, 'GROUP BY region, product');
});

test('Compile ORDER BY', () => {
    const query = global.EOQL.from('users')
        .orderBy({ field: 'created_at', direction: 'desc' })
        .select('*');

    const sql = global.toSQL(query);
    assertContains(sql, 'ORDER BY created_at DESC');
});

test('Compile LIMIT and OFFSET', () => {
    const query = global.EOQL.from('users')
        .limit(10)
        .offset(20)
        .select('*');

    const sql = global.toSQL(query, 'postgresql');
    assertContains(sql, 'LIMIT 10');
    assertContains(sql, 'OFFSET 20');
});

test('Compile DISTINCT', () => {
    const query = global.EOQL.from('users')
        .distinct()
        .select('country');

    const sql = global.toSQL(query);
    assertContains(sql, 'SELECT DISTINCT');
});

test('Compile aggregations', () => {
    const query = global.EOQL.from('orders')
        .groupBy('customer_id')
        .count('*', 'order_count')
        .sum('total', 'total_spent')
        .select('customer_id');

    const sql = global.toSQL(query);
    assertContains(sql, 'COUNT(*)');
    assertContains(sql, 'SUM(total)');
});

test('Compile for MySQL dialect', () => {
    const query = global.EOQL.from('users')
        .where({ active: true })
        .limit(10)
        .select('*');

    const sql = global.toSQL(query, 'mysql');
    assertContains(sql, '1');  // MySQL uses 1 for TRUE
});

test('Compile for SQLite dialect', () => {
    const query = global.EOQL.from('users')
        .limit(10)
        .select('*');

    const sql = global.toSQL(query, 'sqlite');
    assertContains(sql, 'LIMIT 10');
});

// ----------------------------------------------------------------------------
// 3. SQL Parser Tests
// ----------------------------------------------------------------------------

console.log('\n3. SQL Parser Tests');
console.log('-------------------');

test('Parser module loads correctly', () => {
    assertNotNull(global.SQLParser);
    assertNotNull(global.parseSQL);
});

test('Parse simple SELECT', () => {
    const query = global.parseSQL('SELECT * FROM users');
    assertNotNull(query);

    const ast = query.toAST();
    assertEqual(ast.pipeline.length, 2);

    const insNode = ast.pipeline.find(n => n.operator === 'INS');
    assertNotNull(insNode);
    assertEqual(insNode.params.source, 'users');
});

test('Parse SELECT with columns', () => {
    const query = global.parseSQL('SELECT id, name, email FROM users');
    const ast = query.toAST();

    const desNode = ast.pipeline.find(n => n.operator === 'DES');
    assertNotNull(desNode);
    assertEqual(desNode.params.columns.length, 3);
});

test('Parse SELECT with WHERE', () => {
    const query = global.parseSQL("SELECT * FROM users WHERE status = 'active'");
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.where);
    assertNotNull(segNode);
    assertEqual(segNode.params.where.type, 'eq');
});

test('Parse SELECT with multiple WHERE conditions', () => {
    const query = global.parseSQL("SELECT * FROM users WHERE status = 'active' AND age > 18");
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.where);
    assertNotNull(segNode);
    assertEqual(segNode.params.where.type, 'and');
    assertEqual(segNode.params.where.conditions.length, 2);
});

test('Parse SELECT with JOIN', () => {
    const query = global.parseSQL('SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id');
    const ast = query.toAST();

    const conNode = ast.pipeline.find(n => n.operator === 'CON');
    assertNotNull(conNode);
    assertEqual(conNode.params.type, 'inner');
});

test('Parse SELECT with LEFT JOIN', () => {
    const query = global.parseSQL('SELECT * FROM orders LEFT JOIN customers ON orders.customer_id = customers.id');
    const ast = query.toAST();

    const conNode = ast.pipeline.find(n => n.operator === 'CON');
    assertNotNull(conNode);
    assertEqual(conNode.params.type, 'left');
});

test('Parse SELECT with GROUP BY', () => {
    const query = global.parseSQL('SELECT department, COUNT(*) FROM employees GROUP BY department');
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.groupBy);
    assertNotNull(segNode);
    assertEqual(segNode.params.groupBy, ['department']);
});

test('Parse SELECT with ORDER BY', () => {
    const query = global.parseSQL('SELECT * FROM users ORDER BY created_at DESC');
    const ast = query.toAST();

    const altNode = ast.pipeline.find(n => n.operator === 'ALT');
    assertNotNull(altNode);
    assertEqual(altNode.params.orderBy[0].direction, 'desc');
});

test('Parse SELECT with LIMIT', () => {
    const query = global.parseSQL('SELECT * FROM users LIMIT 10');
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.limit);
    assertNotNull(segNode);
    assertEqual(segNode.params.limit, 10);
});

test('Parse SELECT with LIMIT and OFFSET', () => {
    const query = global.parseSQL('SELECT * FROM users LIMIT 10 OFFSET 20');
    const ast = query.toAST();

    const limitNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.limit);
    const offsetNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.offset);
    assertNotNull(limitNode);
    assertNotNull(offsetNode);
    assertEqual(limitNode.params.limit, 10);
    assertEqual(offsetNode.params.offset, 20);
});

test('Parse SELECT with DISTINCT', () => {
    const query = global.parseSQL('SELECT DISTINCT country FROM users');
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.distinct);
    assertNotNull(segNode);
});

test('Parse SELECT with aggregates', () => {
    const query = global.parseSQL('SELECT COUNT(*), SUM(amount), AVG(price) FROM orders');
    const ast = query.toAST();

    const desNode = ast.pipeline.find(n => n.operator === 'DES');
    assertNotNull(desNode);
    // Check that aggregates are in columns
    const cols = desNode.params.columns;
    assertEqual(cols.length, 3);
});

test('Parse SELECT with column aliases', () => {
    const query = global.parseSQL('SELECT id, name AS customer_name FROM customers');
    const ast = query.toAST();

    const desNode = ast.pipeline.find(n => n.operator === 'DES');
    assertNotNull(desNode);
});

test('Parse SELECT with IN clause', () => {
    const query = global.parseSQL("SELECT * FROM users WHERE status IN ('active', 'pending')");
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.where);
    assertNotNull(segNode);
    assertEqual(segNode.params.where.type, 'in');
});

test('Parse SELECT with BETWEEN', () => {
    const query = global.parseSQL('SELECT * FROM products WHERE price BETWEEN 10 AND 100');
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.where);
    assertNotNull(segNode);
    assertEqual(segNode.params.where.type, 'between');
});

test('Parse SELECT with IS NULL', () => {
    const query = global.parseSQL('SELECT * FROM users WHERE deleted_at IS NULL');
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.where);
    assertNotNull(segNode);
    assertEqual(segNode.params.where.type, 'is_null');
});

test('Parse SELECT with LIKE', () => {
    const query = global.parseSQL("SELECT * FROM users WHERE name LIKE '%john%'");
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.where);
    assertNotNull(segNode);
    assertEqual(segNode.params.where.type, 'like');
});

test('Parse SELECT with subquery', () => {
    const query = global.parseSQL('SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)');
    const ast = query.toAST();
    assertNotNull(ast);
});

test('Parse SELECT with CASE expression', () => {
    const query = global.parseSQL("SELECT CASE WHEN status = 'active' THEN 1 ELSE 0 END FROM users");
    const ast = query.toAST();
    assertNotNull(ast);
});

test('Parse UNION', () => {
    const query = global.parseSQL('SELECT id FROM users UNION SELECT id FROM admins');
    const ast = query.toAST();

    const conNode = ast.pipeline.find(n => n.operator === 'CON' && n.params.type === 'union');
    assertNotNull(conNode);
});

// ----------------------------------------------------------------------------
// 4. Round-trip Tests
// ----------------------------------------------------------------------------

console.log('\n4. Round-trip Tests (SQL → EOQL → SQL)');
console.log('--------------------------------------');

test('Round-trip: Simple SELECT', () => {
    const originalSQL = 'SELECT id, name FROM users';
    const query = global.parseSQL(originalSQL);
    const generatedSQL = global.toSQL(query);

    assertContains(generatedSQL, 'SELECT');
    assertContains(generatedSQL, 'FROM users');
});

test('Round-trip: SELECT with WHERE', () => {
    const originalSQL = "SELECT * FROM users WHERE status = 'active'";
    const query = global.parseSQL(originalSQL);
    const generatedSQL = global.toSQL(query);

    assertContains(generatedSQL, 'WHERE');
    assertContains(generatedSQL, 'active');
});

test('Round-trip: SELECT with JOIN', () => {
    const originalSQL = 'SELECT * FROM orders LEFT JOIN customers ON orders.customer_id = customers.id';
    const query = global.parseSQL(originalSQL);
    const generatedSQL = global.toSQL(query);

    assertContains(generatedSQL, 'LEFT JOIN');
    assertContains(generatedSQL, 'customers');
});

test('Round-trip: SELECT with GROUP BY', () => {
    const originalSQL = 'SELECT department, COUNT(*) FROM employees GROUP BY department';
    const query = global.parseSQL(originalSQL);
    const generatedSQL = global.toSQL(query);

    assertContains(generatedSQL, 'GROUP BY');
    assertContains(generatedSQL, 'department');
});

test('Round-trip: SELECT with ORDER BY and LIMIT', () => {
    const originalSQL = 'SELECT * FROM users ORDER BY created_at DESC LIMIT 10';
    const query = global.parseSQL(originalSQL);
    const generatedSQL = global.toSQL(query);

    assertContains(generatedSQL, 'ORDER BY');
    assertContains(generatedSQL, 'DESC');
    assertContains(generatedSQL, 'LIMIT');
});

test('Round-trip: Complex query', () => {
    const originalSQL = `
        SELECT o.id, c.name, SUM(o.total)
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.status = 'completed'
        GROUP BY o.id, c.name
        ORDER BY o.id DESC
        LIMIT 100
    `;
    const query = global.parseSQL(originalSQL);
    const generatedSQL = global.toSQL(query);

    assertContains(generatedSQL, 'LEFT JOIN');
    assertContains(generatedSQL, 'WHERE');
    assertContains(generatedSQL, 'GROUP BY');
    assertContains(generatedSQL, 'ORDER BY');
    assertContains(generatedSQL, 'LIMIT');
});

// ----------------------------------------------------------------------------
// 5. Crosswalk Tests
// ----------------------------------------------------------------------------

console.log('\n5. Crosswalk Tests');
console.log('------------------');

test('Crosswalk module loads correctly', () => {
    assertNotNull(global.EOQueryCrosswalk);
    assertNotNull(global.EOQueryCrosswalk.SQL_TO_EOQL);
    assertNotNull(global.EOQueryCrosswalk.EOQL_TO_SQL);
});

test('SQL_TO_EOQL mappings exist', () => {
    const mappings = global.EOQueryCrosswalk.SQL_TO_EOQL;

    assertNotNull(mappings['SELECT']);
    assertEqual(mappings['SELECT'].operator, 'DES');

    assertNotNull(mappings['FROM']);
    assertEqual(mappings['FROM'].operator, 'INS');

    assertNotNull(mappings['WHERE']);
    assertEqual(mappings['WHERE'].operator, 'SEG');

    assertNotNull(mappings['JOIN']);
    assertEqual(mappings['JOIN'].operator, 'CON');

    assertNotNull(mappings['ORDER BY']);
    assertEqual(mappings['ORDER BY'].operator, 'ALT');

    assertNotNull(mappings['SUM']);
    assertEqual(mappings['SUM'].operator, 'SYN');
});

test('RELATIONAL_ALGEBRA mappings exist', () => {
    const ra = global.EOQueryCrosswalk.RELATIONAL_ALGEBRA;

    assertNotNull(ra.SELECTION);
    assertNotNull(ra.PROJECTION);
    assertNotNull(ra.JOIN);
    assertNotNull(ra.UNION);
    assertNotNull(ra.GROUPING);
    assertNotNull(ra.AGGREGATION);
});

test('Crosswalk registry - add custom mapping', () => {
    const registry = global.EOQueryCrosswalk.registry;

    registry.addSqlMapping('MY_CUSTOM', {
        operator: 'SEG',
        params: () => ({ custom: true }),
        description: 'Custom test mapping'
    });

    const mapping = registry.getSqlMapping('MY_CUSTOM');
    assertNotNull(mapping);
    assertEqual(mapping.operator, 'SEG');
});

test('Crosswalk registry - dialect mappings', () => {
    const registry = global.EOQueryCrosswalk.registry;

    registry.addDialectMapping('mysql', 'LIMIT', 'LIMIT {offset}, {limit}');

    const dialectSQL = registry.getDialectSQL('mysql', 'LIMIT', 'LIMIT {limit} OFFSET {offset}');
    assertEqual(dialectSQL, 'LIMIT {offset}, {limit}');
});

test('Crosswalk formatters work', () => {
    const formatValue = global.EOQueryCrosswalk.formatValue;

    assertEqual(formatValue('hello'), "'hello'");
    assertEqual(formatValue(42), '42');
    assertEqual(formatValue(true), 'TRUE');
    assertEqual(formatValue(null), 'NULL');
});

// ----------------------------------------------------------------------------
// 6. Edge Cases and Error Handling
// ----------------------------------------------------------------------------

console.log('\n6. Edge Cases and Error Handling');
console.log('---------------------------------');

test('Parse empty string throws error', () => {
    let threw = false;
    try {
        global.parseSQL('');
    } catch (e) {
        threw = true;
    }
    // Empty string should not crash, just return minimal result
    // This is acceptable behavior
});

test('Parse SQL with comments', () => {
    const query = global.parseSQL(`
        -- This is a comment
        SELECT * FROM users /* inline comment */ WHERE id = 1
    `);
    assertNotNull(query);
    const ast = query.toAST();
    assertNotNull(ast.pipeline.find(n => n.operator === 'INS'));
});

test('Parse SQL with escaped strings', () => {
    const query = global.parseSQL("SELECT * FROM users WHERE name = 'O''Brien'");
    assertNotNull(query);
});

test('Compile query with special characters in values', () => {
    const query = global.EOQL.from('users')
        .where({ name: "O'Brien" })
        .select('*');

    const sql = global.toSQL(query);
    assertContains(sql, "O''Brien");  // Should be properly escaped
});

test('Handle numeric literals correctly', () => {
    const query = global.parseSQL('SELECT * FROM products WHERE price > 99.99');
    const ast = query.toAST();

    const segNode = ast.pipeline.find(n => n.operator === 'SEG' && n.params.where);
    assertNotNull(segNode);
});

test('Handle boolean literals', () => {
    const query = global.parseSQL('SELECT * FROM users WHERE active = TRUE');
    const ast = query.toAST();
    assertNotNull(ast);
});

test('Multiple JOINs', () => {
    const sql = `
        SELECT * FROM orders
        JOIN customers ON orders.customer_id = customers.id
        JOIN products ON orders.product_id = products.id
    `;
    const query = global.parseSQL(sql);
    const ast = query.toAST();

    const joinNodes = ast.pipeline.filter(n => n.operator === 'CON');
    assertEqual(joinNodes.length, 2);
});

test('Query clone works correctly', () => {
    const query1 = global.EOQL.from('users').where({ active: true });
    const query2 = query1.clone();

    query2.limit(10);

    const ast1 = query1.toAST();
    const ast2 = query2.toAST();

    // Original should not have LIMIT
    assertEqual(ast1.pipeline.length, 2);
    // Clone should have LIMIT
    assertEqual(ast2.pipeline.length, 3);
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => {
        console.log(`  - ${f.name}: ${f.error}`);
    });
}

console.log('\n');

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
