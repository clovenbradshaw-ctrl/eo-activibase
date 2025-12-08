/**
 * EO EOQL Testing Tab
 * Interactive testing environment for EOQL queries and formulas
 *
 * Features:
 * - EOQL query builder and tester
 * - SQL parser (SQL -> EOQL)
 * - SQL compiler (EOQL -> SQL dialects)
 * - Formula engine tester
 * - Sample data playground
 */

(function(global) {
    'use strict';

    // ============================================================================
    // SAMPLE DATA FOR TESTING
    // ============================================================================

    const SAMPLE_DATA = {
        users: [
            { id: 1, name: 'Alice', email: 'alice@example.com', age: 28, department: 'Engineering', salary: 85000 },
            { id: 2, name: 'Bob', email: 'bob@example.com', age: 35, department: 'Sales', salary: 72000 },
            { id: 3, name: 'Carol', email: 'carol@example.com', age: 42, department: 'Engineering', salary: 95000 },
            { id: 4, name: 'Dave', email: 'dave@example.com', age: 31, department: 'Marketing', salary: 68000 },
            { id: 5, name: 'Eve', email: 'eve@example.com', age: 26, department: 'Engineering', salary: 78000 }
        ],
        orders: [
            { id: 101, user_id: 1, product: 'Widget A', amount: 150.00, status: 'completed', order_date: '2024-01-15' },
            { id: 102, user_id: 2, product: 'Widget B', amount: 89.99, status: 'pending', order_date: '2024-01-16' },
            { id: 103, user_id: 1, product: 'Gadget X', amount: 299.00, status: 'completed', order_date: '2024-01-17' },
            { id: 104, user_id: 3, product: 'Widget A', amount: 150.00, status: 'completed', order_date: '2024-01-18' },
            { id: 105, user_id: 4, product: 'Gadget Y', amount: 450.00, status: 'cancelled', order_date: '2024-01-19' }
        ],
        products: [
            { id: 1, name: 'Widget A', category: 'Widgets', price: 150.00, stock: 100 },
            { id: 2, name: 'Widget B', category: 'Widgets', price: 89.99, stock: 250 },
            { id: 3, name: 'Gadget X', category: 'Gadgets', price: 299.00, stock: 50 },
            { id: 4, name: 'Gadget Y', category: 'Gadgets', price: 450.00, stock: 30 }
        ]
    };

    // ============================================================================
    // EOQL TESTING TAB COMPONENT
    // ============================================================================

    class EOQLTestingTab {
        constructor() {
            this.activeSection = 'eoql-query';
            this.queryResult = null;
            this.formulaResult = null;
            this.selectedDialect = 'postgresql';
        }

        /**
         * Render the full testing tab content
         */
        render() {
            return `
                <div class="eoql-testing-tab">
                    <div class="eoql-testing-header">
                        <div class="eoql-testing-title">
                            <i class="ph ph-code"></i>
                            <h2>EOQL Testing Lab</h2>
                        </div>
                        <div class="eoql-testing-subtitle">
                            Test EO Query Language expressions, SQL parsing, and formula evaluation
                        </div>
                    </div>

                    <div class="eoql-testing-nav">
                        <button class="eoql-nav-btn active" data-section="eoql-query">
                            <i class="ph ph-database"></i>
                            Query Builder
                        </button>
                        <button class="eoql-nav-btn" data-section="sql-parser">
                            <i class="ph ph-file-sql"></i>
                            SQL Parser
                        </button>
                        <button class="eoql-nav-btn" data-section="formula-tester">
                            <i class="ph ph-function"></i>
                            Formula Engine
                        </button>
                        <button class="eoql-nav-btn" data-section="reference">
                            <i class="ph ph-book-open"></i>
                            Reference
                        </button>
                    </div>

                    <div class="eoql-testing-content">
                        ${this.renderEOQLQuerySection()}
                        ${this.renderSQLParserSection()}
                        ${this.renderFormulaTesterSection()}
                        ${this.renderReferenceSection()}
                    </div>
                </div>
            `;
        }

        /**
         * Render EOQL Query Builder section
         */
        renderEOQLQuerySection() {
            return `
                <div class="eoql-section active" id="eoql-query-section">
                    <div class="eoql-section-grid">
                        <div class="eoql-input-panel">
                            <div class="panel-header">
                                <h3><i class="ph ph-pencil-simple"></i> EOQL Query</h3>
                                <div class="panel-actions">
                                    <button class="btn-icon" id="eoql-clear-btn" title="Clear">
                                        <i class="ph ph-trash"></i>
                                    </button>
                                    <button class="btn-icon" id="eoql-example-btn" title="Load Example">
                                        <i class="ph ph-lightning"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="code-input-wrapper">
                                <textarea id="eoql-query-input" class="code-input" placeholder="// Write EOQL query
EOQL.from('users')
    .where(EOQL.expr.gt('age', 25))
    .select('name', 'email', 'department')
    .orderBy('name')
    .limit(10)"></textarea>
                            </div>
                            <div class="dialect-selector">
                                <label>Target Dialect:</label>
                                <select id="eoql-dialect-select">
                                    <option value="postgresql" selected>PostgreSQL</option>
                                    <option value="mysql">MySQL</option>
                                    <option value="sqlite">SQLite</option>
                                    <option value="sqlserver">SQL Server</option>
                                    <option value="oracle">Oracle</option>
                                </select>
                            </div>
                            <div class="action-buttons">
                                <button class="btn-primary" id="eoql-compile-btn">
                                    <i class="ph ph-play"></i> Compile to SQL
                                </button>
                                <button class="btn-secondary" id="eoql-ast-btn">
                                    <i class="ph ph-tree-structure"></i> Show AST
                                </button>
                            </div>
                        </div>

                        <div class="eoql-output-panel">
                            <div class="panel-header">
                                <h3><i class="ph ph-code"></i> Generated SQL</h3>
                                <button class="btn-icon" id="eoql-copy-sql" title="Copy SQL">
                                    <i class="ph ph-copy"></i>
                                </button>
                            </div>
                            <div class="code-output-wrapper">
                                <pre id="eoql-sql-output" class="code-output">-- Generated SQL will appear here</pre>
                            </div>
                            <div class="panel-header" style="margin-top: 16px;">
                                <h3><i class="ph ph-tree-structure"></i> Query AST</h3>
                            </div>
                            <div class="code-output-wrapper">
                                <pre id="eoql-ast-output" class="code-output ast-output">// AST will appear here</pre>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render SQL Parser section
         */
        renderSQLParserSection() {
            return `
                <div class="eoql-section" id="sql-parser-section">
                    <div class="eoql-section-grid">
                        <div class="eoql-input-panel">
                            <div class="panel-header">
                                <h3><i class="ph ph-file-sql"></i> SQL Input</h3>
                                <div class="panel-actions">
                                    <button class="btn-icon" id="sql-clear-btn" title="Clear">
                                        <i class="ph ph-trash"></i>
                                    </button>
                                    <button class="btn-icon" id="sql-example-btn" title="Load Example">
                                        <i class="ph ph-lightning"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="code-input-wrapper">
                                <textarea id="sql-input" class="code-input" placeholder="-- Enter SQL query to parse
SELECT u.name, u.email, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.age > 25
GROUP BY u.name, u.email
ORDER BY order_count DESC
LIMIT 10"></textarea>
                            </div>
                            <div class="action-buttons">
                                <button class="btn-primary" id="sql-parse-btn">
                                    <i class="ph ph-arrow-right"></i> Parse to EOQL
                                </button>
                                <button class="btn-secondary" id="sql-roundtrip-btn">
                                    <i class="ph ph-arrows-clockwise"></i> Round-trip Test
                                </button>
                            </div>
                        </div>

                        <div class="eoql-output-panel">
                            <div class="panel-header">
                                <h3><i class="ph ph-database"></i> EOQL Representation</h3>
                            </div>
                            <div class="code-output-wrapper">
                                <pre id="sql-eoql-output" class="code-output">// EOQL representation will appear here</pre>
                            </div>
                            <div class="panel-header" style="margin-top: 16px;">
                                <h3><i class="ph ph-flow-arrow"></i> Operator Pipeline</h3>
                            </div>
                            <div class="code-output-wrapper">
                                <pre id="sql-pipeline-output" class="code-output pipeline-output">// Pipeline will appear here</pre>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render Formula Tester section
         */
        renderFormulaTesterSection() {
            return `
                <div class="eoql-section" id="formula-tester-section">
                    <div class="eoql-section-grid three-col">
                        <div class="eoql-input-panel">
                            <div class="panel-header">
                                <h3><i class="ph ph-function"></i> Formula</h3>
                                <div class="panel-actions">
                                    <button class="btn-icon" id="formula-clear-btn" title="Clear">
                                        <i class="ph ph-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="code-input-wrapper">
                                <textarea id="formula-input" class="code-input" placeholder="// Enter formula to evaluate
IF({salary} > 80000, &quot;Senior&quot;, &quot;Junior&quot;)"></textarea>
                            </div>
                            <div class="formula-examples">
                                <label>Quick Examples:</label>
                                <div class="example-chips">
                                    <button class="chip" data-formula="SUM({salary}, 10000)">SUM</button>
                                    <button class="chip" data-formula="IF({age} > 30, 'Senior', 'Junior')">IF</button>
                                    <button class="chip" data-formula="CONCAT({name}, ' - ', {department})">CONCAT</button>
                                    <button class="chip" data-formula="ROUND({salary} / 12, 2)">ROUND</button>
                                    <button class="chip" data-formula="UPPER({name})">UPPER</button>
                                    <button class="chip" data-formula="LEN({email})">LEN</button>
                                </div>
                            </div>
                            <div class="action-buttons">
                                <button class="btn-primary" id="formula-eval-btn">
                                    <i class="ph ph-play"></i> Evaluate
                                </button>
                                <button class="btn-secondary" id="formula-parse-btn">
                                    <i class="ph ph-tree-structure"></i> Parse AST
                                </button>
                            </div>
                        </div>

                        <div class="eoql-data-panel">
                            <div class="panel-header">
                                <h3><i class="ph ph-table"></i> Sample Record</h3>
                                <select id="sample-record-select">
                                    ${SAMPLE_DATA.users.map((u, i) =>
                                        `<option value="${i}">${u.name} (${u.department})</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="sample-record-display">
                                <div id="sample-record-json" class="record-json"></div>
                            </div>
                        </div>

                        <div class="eoql-output-panel">
                            <div class="panel-header">
                                <h3><i class="ph ph-check-circle"></i> Result</h3>
                            </div>
                            <div class="formula-result-display">
                                <div id="formula-result" class="result-value">--</div>
                                <div id="formula-result-type" class="result-type"></div>
                            </div>
                            <div class="panel-header" style="margin-top: 16px;">
                                <h3><i class="ph ph-link"></i> Dependencies</h3>
                            </div>
                            <div id="formula-dependencies" class="dependencies-list"></div>
                            <div class="panel-header" style="margin-top: 16px;">
                                <h3><i class="ph ph-tree-structure"></i> Parsed AST</h3>
                            </div>
                            <div class="code-output-wrapper small">
                                <pre id="formula-ast-output" class="code-output">// Formula AST</pre>
                            </div>
                        </div>
                    </div>

                    <div class="formula-batch-test">
                        <div class="panel-header">
                            <h3><i class="ph ph-list-checks"></i> Batch Evaluation</h3>
                            <button class="btn-secondary" id="formula-batch-btn">
                                <i class="ph ph-play"></i> Run on All Records
                            </button>
                        </div>
                        <div class="batch-results-table">
                            <table id="formula-batch-results">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Input Values</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Results will be populated here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render Reference section
         */
        renderReferenceSection() {
            return `
                <div class="eoql-section" id="reference-section">
                    <div class="reference-grid">
                        <div class="reference-card">
                            <h3><i class="ph ph-shapes"></i> EO Operators (9 Primitives)</h3>
                            <div class="reference-list">
                                ${this.renderOperatorReference()}
                            </div>
                        </div>

                        <div class="reference-card">
                            <h3><i class="ph ph-puzzle-piece"></i> Holons (Built-in)</h3>
                            <div class="reference-list scrollable">
                                ${this.renderHolonReference()}
                            </div>
                        </div>

                        <div class="reference-card">
                            <h3><i class="ph ph-brackets-curly"></i> Expression Operators</h3>
                            <div class="reference-list">
                                ${this.renderExpressionReference()}
                            </div>
                        </div>

                        <div class="reference-card">
                            <h3><i class="ph ph-function"></i> Formula Functions</h3>
                            <div class="reference-list scrollable">
                                ${this.renderFormulaFunctionReference()}
                            </div>
                        </div>
                    </div>

                    <div class="sample-data-section">
                        <h3><i class="ph ph-database"></i> Sample Data Tables</h3>
                        <div class="sample-data-tabs">
                            <button class="sample-tab active" data-table="users">Users</button>
                            <button class="sample-tab" data-table="orders">Orders</button>
                            <button class="sample-tab" data-table="products">Products</button>
                        </div>
                        <div class="sample-data-table">
                            ${this.renderSampleDataTable('users')}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render operator reference
         */
        renderOperatorReference() {
            const operators = [
                { name: 'NUL', desc: 'Handle absence/null values', sql: 'IS NULL, COALESCE, NULLIF' },
                { name: 'DES', desc: 'Designate/name/classify', sql: 'SELECT, AS, CAST' },
                { name: 'INS', desc: 'Instantiate source', sql: 'FROM, INSERT INTO, VALUES' },
                { name: 'SEG', desc: 'Segment/filter', sql: 'WHERE, GROUP BY, LIMIT' },
                { name: 'CON', desc: 'Connect/relate', sql: 'JOIN, UNION, INTERSECT' },
                { name: 'ALT', desc: 'Alternate/order', sql: 'ORDER BY, CASE WHEN' },
                { name: 'SYN', desc: 'Synthesize/aggregate', sql: 'SUM, AVG, COUNT' },
                { name: 'SUP', desc: 'Superpose contexts', sql: 'OVER, WITH, PARTITION' },
                { name: 'REC', desc: 'Recurse/iterate', sql: 'WITH RECURSIVE' }
            ];

            return operators.map(op => `
                <div class="ref-item operator">
                    <div class="ref-name">${op.name}</div>
                    <div class="ref-desc">${op.desc}</div>
                    <div class="ref-sql"><code>${op.sql}</code></div>
                </div>
            `).join('');
        }

        /**
         * Render holon reference
         */
        renderHolonReference() {
            const holons = [
                { name: 'FROM(source)', desc: 'Set data source' },
                { name: 'SELECT(...cols)', desc: 'Select columns' },
                { name: 'WHERE(cond)', desc: 'Filter rows' },
                { name: 'GROUP_BY(...fields)', desc: 'Group by fields' },
                { name: 'HAVING(cond)', desc: 'Filter groups' },
                { name: 'ORDER_BY(...specs)', desc: 'Sort results' },
                { name: 'LIMIT(n)', desc: 'Limit rows' },
                { name: 'OFFSET(n)', desc: 'Skip rows' },
                { name: 'DISTINCT(...fields)', desc: 'Unique values' },
                { name: 'JOIN(target, on)', desc: 'Inner join' },
                { name: 'LEFT_JOIN(target, on)', desc: 'Left outer join' },
                { name: 'RIGHT_JOIN(target, on)', desc: 'Right outer join' },
                { name: 'FULL_JOIN(target, on)', desc: 'Full outer join' },
                { name: 'CROSS_JOIN(target)', desc: 'Cross join' },
                { name: 'UNION(query)', desc: 'Union queries' },
                { name: 'INTERSECT(query)', desc: 'Intersect queries' },
                { name: 'EXCEPT(query)', desc: 'Except/minus' },
                { name: 'SUM(field, alias)', desc: 'Sum aggregation' },
                { name: 'AVG(field, alias)', desc: 'Average aggregation' },
                { name: 'COUNT(field, alias)', desc: 'Count aggregation' },
                { name: 'MIN(field, alias)', desc: 'Minimum value' },
                { name: 'MAX(field, alias)', desc: 'Maximum value' },
                { name: 'ROW_NUMBER(opts)', desc: 'Row number window' },
                { name: 'RANK(opts)', desc: 'Rank window' },
                { name: 'LAG(field, offset)', desc: 'Previous row value' },
                { name: 'LEAD(field, offset)', desc: 'Next row value' },
                { name: 'WITH(name, query)', desc: 'CTE definition' },
                { name: 'COALESCE(...fields)', desc: 'First non-null' },
                { name: 'NULLIF(field, value)', desc: 'Null if equals' }
            ];

            return holons.map(h => `
                <div class="ref-item holon">
                    <div class="ref-name"><code>${h.name}</code></div>
                    <div class="ref-desc">${h.desc}</div>
                </div>
            `).join('');
        }

        /**
         * Render expression reference
         */
        renderExpressionReference() {
            const exprs = [
                { cat: 'Comparison', ops: 'eq, ne, gt, gte, lt, lte, like, ilike, in, notIn, between, isNull, isNotNull' },
                { cat: 'Logical', ops: 'and, or, not' },
                { cat: 'Arithmetic', ops: 'add, sub, mul, div, mod' },
                { cat: 'Aggregate', ops: 'sum, avg, count, min, max' },
                { cat: 'Functions', ops: 'fn(name, ...args)' }
            ];

            return exprs.map(e => `
                <div class="ref-item expr">
                    <div class="ref-cat">${e.cat}</div>
                    <div class="ref-ops"><code>${e.ops}</code></div>
                </div>
            `).join('');
        }

        /**
         * Render formula function reference
         */
        renderFormulaFunctionReference() {
            const functions = {
                'Math': ['SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'ABS', 'SQRT', 'POWER', 'MOD'],
                'Text': ['CONCAT', 'UPPER', 'LOWER', 'TRIM', 'LEN', 'LEFT', 'RIGHT', 'MID', 'FIND', 'REPLACE'],
                'Logic': ['IF', 'AND', 'OR', 'NOT'],
                'Date': ['TODAY', 'NOW', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'DATEDIFF', 'DATEADD'],
                'Utility': ['COUNT', 'COUNTA', 'COUNTBLANK', 'ISBLANK', 'ISNUMBER', 'ISTEXT', 'VALUE', 'TEXT', 'BLANK']
            };

            return Object.entries(functions).map(([cat, fns]) => `
                <div class="ref-item function-group">
                    <div class="ref-cat">${cat}</div>
                    <div class="ref-fns">${fns.map(f => `<code>${f}</code>`).join(', ')}</div>
                </div>
            `).join('');
        }

        /**
         * Render sample data table
         */
        renderSampleDataTable(tableName) {
            const data = SAMPLE_DATA[tableName];
            if (!data || data.length === 0) return '<p>No data</p>';

            const headers = Object.keys(data[0]);

            return `
                <table class="data-table">
                    <thead>
                        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr>${headers.map(h => `<td>${row[h]}</td>`).join('')}</tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        /**
         * Attach event listeners
         */
        attachListeners() {
            // Navigation
            document.querySelectorAll('.eoql-nav-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.switchSection(e.target.closest('.eoql-nav-btn').dataset.section);
                });
            });

            // EOQL Query section
            const compileBtn = document.getElementById('eoql-compile-btn');
            if (compileBtn) {
                compileBtn.addEventListener('click', () => this.compileEOQL());
            }

            const astBtn = document.getElementById('eoql-ast-btn');
            if (astBtn) {
                astBtn.addEventListener('click', () => this.showEOQLAst());
            }

            const exampleBtn = document.getElementById('eoql-example-btn');
            if (exampleBtn) {
                exampleBtn.addEventListener('click', () => this.loadEOQLExample());
            }

            const clearBtn = document.getElementById('eoql-clear-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    document.getElementById('eoql-query-input').value = '';
                });
            }

            const copySqlBtn = document.getElementById('eoql-copy-sql');
            if (copySqlBtn) {
                copySqlBtn.addEventListener('click', () => this.copyToClipboard('eoql-sql-output'));
            }

            // SQL Parser section
            const parseBtn = document.getElementById('sql-parse-btn');
            if (parseBtn) {
                parseBtn.addEventListener('click', () => this.parseSQL());
            }

            const roundtripBtn = document.getElementById('sql-roundtrip-btn');
            if (roundtripBtn) {
                roundtripBtn.addEventListener('click', () => this.roundtripTest());
            }

            const sqlExampleBtn = document.getElementById('sql-example-btn');
            if (sqlExampleBtn) {
                sqlExampleBtn.addEventListener('click', () => this.loadSQLExample());
            }

            const sqlClearBtn = document.getElementById('sql-clear-btn');
            if (sqlClearBtn) {
                sqlClearBtn.addEventListener('click', () => {
                    document.getElementById('sql-input').value = '';
                });
            }

            // Formula section
            const evalBtn = document.getElementById('formula-eval-btn');
            if (evalBtn) {
                evalBtn.addEventListener('click', () => this.evaluateFormula());
            }

            const parseFormulaBtn = document.getElementById('formula-parse-btn');
            if (parseFormulaBtn) {
                parseFormulaBtn.addEventListener('click', () => this.parseFormula());
            }

            const batchBtn = document.getElementById('formula-batch-btn');
            if (batchBtn) {
                batchBtn.addEventListener('click', () => this.batchEvaluateFormula());
            }

            const formulaClearBtn = document.getElementById('formula-clear-btn');
            if (formulaClearBtn) {
                formulaClearBtn.addEventListener('click', () => {
                    document.getElementById('formula-input').value = '';
                });
            }

            // Formula example chips
            document.querySelectorAll('.chip[data-formula]').forEach(chip => {
                chip.addEventListener('click', (e) => {
                    document.getElementById('formula-input').value = e.target.dataset.formula;
                    this.evaluateFormula();
                });
            });

            // Sample record selector
            const recordSelect = document.getElementById('sample-record-select');
            if (recordSelect) {
                recordSelect.addEventListener('change', () => this.updateSampleRecord());
                // Initialize
                this.updateSampleRecord();
            }

            // Sample data tabs
            document.querySelectorAll('.sample-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    document.querySelectorAll('.sample-tab').forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    document.querySelector('.sample-data-table').innerHTML =
                        this.renderSampleDataTable(e.target.dataset.table);
                });
            });
        }

        /**
         * Switch between sections
         */
        switchSection(sectionId) {
            document.querySelectorAll('.eoql-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.section === sectionId);
            });

            document.querySelectorAll('.eoql-section').forEach(section => {
                section.classList.toggle('active', section.id === `${sectionId}-section`);
            });

            this.activeSection = sectionId;
        }

        /**
         * Compile EOQL to SQL
         */
        compileEOQL() {
            const input = document.getElementById('eoql-query-input').value;
            const dialect = document.getElementById('eoql-dialect-select').value;
            const sqlOutput = document.getElementById('eoql-sql-output');
            const astOutput = document.getElementById('eoql-ast-output');

            try {
                // Evaluate the EOQL expression
                const query = eval(input);

                if (!query || !query.toAST) {
                    throw new Error('Invalid EOQL query. Make sure to use EOQL.from() or EOQL.query()');
                }

                const ast = query.toAST();
                astOutput.textContent = JSON.stringify(ast, null, 2);

                // Compile to SQL if compiler is available
                if (global.EOQueryCompiler) {
                    const compiler = new global.EOQueryCompiler(dialect);
                    const sql = compiler.compile(query);
                    sqlOutput.textContent = sql;
                } else if (global.EOQL && global.EOQL.toSQL) {
                    const sql = global.EOQL.toSQL(query, dialect);
                    sqlOutput.textContent = sql;
                } else {
                    sqlOutput.textContent = '-- EOQueryCompiler not loaded.\n-- AST generated successfully (see below)';
                }

                sqlOutput.classList.remove('error');
                astOutput.classList.remove('error');
            } catch (error) {
                sqlOutput.textContent = `-- Error: ${error.message}`;
                sqlOutput.classList.add('error');
                astOutput.textContent = `// Error parsing query\n// ${error.message}`;
                astOutput.classList.add('error');
            }
        }

        /**
         * Show EOQL AST
         */
        showEOQLAst() {
            const input = document.getElementById('eoql-query-input').value;
            const astOutput = document.getElementById('eoql-ast-output');

            try {
                const query = eval(input);
                if (!query || !query.toAST) {
                    throw new Error('Invalid EOQL query');
                }
                astOutput.textContent = JSON.stringify(query.toAST(), null, 2);
                astOutput.classList.remove('error');
            } catch (error) {
                astOutput.textContent = `// Error: ${error.message}`;
                astOutput.classList.add('error');
            }
        }

        /**
         * Load EOQL example
         */
        loadEOQLExample() {
            const examples = [
                `EOQL.from('users')
    .where(EOQL.expr.gt('age', 25))
    .select('name', 'email', 'department')
    .orderBy('name')
    .limit(10)`,
                `EOQL.from('orders')
    .leftJoin('users', EOQL.expr.eq('orders.user_id', EOQL.expr.field('users.id')))
    .where(EOQL.expr.eq('status', 'completed'))
    .groupBy('users.department')
    .sum('amount', 'total_sales')
    .orderByDesc('total_sales')`,
                `EOQL.from('products')
    .where(EOQL.expr.and(
        EOQL.expr.gt('price', 100),
        EOQL.expr.gt('stock', 0)
    ))
    .select('name', 'category', 'price', 'stock')
    .orderBy({ field: 'price', direction: 'desc' })`
            ];

            const currentIndex = parseInt(document.getElementById('eoql-query-input').dataset.exampleIndex || '0');
            const nextIndex = (currentIndex + 1) % examples.length;

            document.getElementById('eoql-query-input').value = examples[nextIndex];
            document.getElementById('eoql-query-input').dataset.exampleIndex = nextIndex.toString();
        }

        /**
         * Parse SQL to EOQL
         */
        parseSQL() {
            const input = document.getElementById('sql-input').value;
            const eoqlOutput = document.getElementById('sql-eoql-output');
            const pipelineOutput = document.getElementById('sql-pipeline-output');

            try {
                if (!global.parseSQL) {
                    throw new Error('SQL Parser not loaded. Include eo_query_parser.js');
                }

                const query = global.parseSQL(input);
                const ast = query.toAST();

                // Show EOQL representation
                eoqlOutput.textContent = JSON.stringify(ast, null, 2);

                // Show pipeline
                const pipeline = ast.pipeline.map(step => {
                    return `[${step.operator}] ${JSON.stringify(step.params)}`;
                }).join('\n  -> ');

                pipelineOutput.textContent = `Query Pipeline:\n  ${pipeline}`;

                eoqlOutput.classList.remove('error');
                pipelineOutput.classList.remove('error');
            } catch (error) {
                eoqlOutput.textContent = `// Error: ${error.message}`;
                eoqlOutput.classList.add('error');
                pipelineOutput.textContent = '';
            }
        }

        /**
         * Round-trip test (SQL -> EOQL -> SQL)
         */
        roundtripTest() {
            const input = document.getElementById('sql-input').value;
            const eoqlOutput = document.getElementById('sql-eoql-output');
            const pipelineOutput = document.getElementById('sql-pipeline-output');

            try {
                if (!global.parseSQL || !global.EOQueryCompiler) {
                    throw new Error('Parser or Compiler not loaded');
                }

                // Parse SQL to EOQL
                const query = global.parseSQL(input);

                // Compile back to SQL
                const compiler = new global.EOQueryCompiler('postgresql');
                const outputSql = compiler.compile(query);

                eoqlOutput.textContent = `-- Original SQL:\n${input}\n\n-- Round-trip SQL:\n${outputSql}`;
                pipelineOutput.textContent = `// Round-trip successful!\n// Parsed and recompiled query`;

                eoqlOutput.classList.remove('error');
                pipelineOutput.classList.remove('error');
            } catch (error) {
                eoqlOutput.textContent = `// Round-trip Error: ${error.message}`;
                eoqlOutput.classList.add('error');
            }
        }

        /**
         * Load SQL example
         */
        loadSQLExample() {
            const examples = [
                `SELECT u.name, u.email, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.age > 25
GROUP BY u.name, u.email
ORDER BY order_count DESC
LIMIT 10`,
                `SELECT department, AVG(salary) as avg_salary, COUNT(*) as emp_count
FROM users
WHERE age BETWEEN 25 AND 45
GROUP BY department
HAVING COUNT(*) > 1
ORDER BY avg_salary DESC`,
                `SELECT p.name, p.category, SUM(o.amount) as total_sales
FROM products p
INNER JOIN orders o ON p.name = o.product
WHERE o.status = 'completed'
GROUP BY p.name, p.category
ORDER BY total_sales DESC`
            ];

            const currentIndex = parseInt(document.getElementById('sql-input').dataset.exampleIndex || '0');
            const nextIndex = (currentIndex + 1) % examples.length;

            document.getElementById('sql-input').value = examples[nextIndex];
            document.getElementById('sql-input').dataset.exampleIndex = nextIndex.toString();
        }

        /**
         * Update sample record display
         */
        updateSampleRecord() {
            const select = document.getElementById('sample-record-select');
            const display = document.getElementById('sample-record-json');
            const record = SAMPLE_DATA.users[parseInt(select.value)];

            display.innerHTML = Object.entries(record).map(([key, value]) => `
                <div class="record-field">
                    <span class="field-name">{${key}}</span>
                    <span class="field-value">${JSON.stringify(value)}</span>
                </div>
            `).join('');
        }

        /**
         * Evaluate formula
         */
        evaluateFormula() {
            const formula = document.getElementById('formula-input').value;
            const resultEl = document.getElementById('formula-result');
            const typeEl = document.getElementById('formula-result-type');
            const depsEl = document.getElementById('formula-dependencies');
            const astEl = document.getElementById('formula-ast-output');

            const recordIndex = parseInt(document.getElementById('sample-record-select').value);
            const record = SAMPLE_DATA.users[recordIndex];

            try {
                if (!global.EOFormulaEngine) {
                    throw new Error('Formula Engine not loaded. Include eo_formula_engine.js');
                }

                const engine = new global.EOFormulaEngine();
                const result = engine.evaluate(formula, record);

                if (!result.success) {
                    throw new Error(result.error);
                }

                resultEl.textContent = JSON.stringify(result.value);
                resultEl.classList.remove('error');
                typeEl.textContent = `Type: ${typeof result.value}`;

                // Show dependencies
                depsEl.innerHTML = result.dependencies.length > 0
                    ? result.dependencies.map(d => `<span class="dep-chip">{${d}}</span>`).join('')
                    : '<span class="no-deps">No field dependencies</span>';

                // Parse and show AST
                const parseResult = engine.parse(formula);
                astEl.textContent = JSON.stringify(parseResult.ast, null, 2);
                astEl.classList.remove('error');

            } catch (error) {
                resultEl.textContent = `Error: ${error.message}`;
                resultEl.classList.add('error');
                typeEl.textContent = '';
                depsEl.innerHTML = '';
                astEl.textContent = `// ${error.message}`;
                astEl.classList.add('error');
            }
        }

        /**
         * Parse formula AST
         */
        parseFormula() {
            const formula = document.getElementById('formula-input').value;
            const astEl = document.getElementById('formula-ast-output');

            try {
                if (!global.EOFormulaEngine) {
                    throw new Error('Formula Engine not loaded');
                }

                const engine = new global.EOFormulaEngine();
                const parseResult = engine.parse(formula);

                astEl.textContent = JSON.stringify(parseResult, null, 2);
                astEl.classList.toggle('error', !parseResult.valid);
            } catch (error) {
                astEl.textContent = `// Error: ${error.message}`;
                astEl.classList.add('error');
            }
        }

        /**
         * Batch evaluate formula on all records
         */
        batchEvaluateFormula() {
            const formula = document.getElementById('formula-input').value;
            const tbody = document.querySelector('#formula-batch-results tbody');

            if (!formula.trim()) {
                tbody.innerHTML = '<tr><td colspan="3">Enter a formula first</td></tr>';
                return;
            }

            try {
                if (!global.EOFormulaEngine) {
                    throw new Error('Formula Engine not loaded');
                }

                const engine = new global.EOFormulaEngine();
                const parseResult = engine.parse(formula);
                const deps = parseResult.dependencies;

                tbody.innerHTML = SAMPLE_DATA.users.map(record => {
                    try {
                        const result = engine.evaluate(formula, record);
                        const inputValues = deps.map(d => `${d}: ${JSON.stringify(record[d])}`).join(', ');

                        return `
                            <tr>
                                <td>${record.name}</td>
                                <td><code>${inputValues || '(no inputs)'}</code></td>
                                <td class="${result.success ? 'success' : 'error'}">${
                                    result.success ? JSON.stringify(result.value) : result.error
                                }</td>
                            </tr>
                        `;
                    } catch (err) {
                        return `
                            <tr>
                                <td>${record.name}</td>
                                <td>-</td>
                                <td class="error">${err.message}</td>
                            </tr>
                        `;
                    }
                }).join('');
            } catch (error) {
                tbody.innerHTML = `<tr><td colspan="3" class="error">${error.message}</td></tr>`;
            }
        }

        /**
         * Copy content to clipboard
         */
        copyToClipboard(elementId) {
            const el = document.getElementById(elementId);
            if (!el) return;

            const text = el.textContent;
            navigator.clipboard.writeText(text).then(() => {
                // Show feedback
                const btn = document.getElementById('eoql-copy-sql');
                if (btn) {
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = '<i class="ph ph-check"></i>';
                    setTimeout(() => {
                        btn.innerHTML = originalHtml;
                    }, 1500);
                }
            });
        }
    }

    // ============================================================================
    // RENDER FUNCTION FOR INTEGRATION
    // ============================================================================

    /**
     * Render the EOQL Testing tab
     * @param {HTMLElement} container - Container element
     */
    function renderEOQLTestingTab(container) {
        const tab = new EOQLTestingTab();
        container.innerHTML = tab.render();
        tab.attachListeners();
        return tab;
    }

    /**
     * Get sample data for external use
     */
    function getSampleData() {
        return SAMPLE_DATA;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    global.EOQLTestingTab = EOQLTestingTab;
    global.renderEOQLTestingTab = renderEOQLTestingTab;
    global.getEOQLSampleData = getSampleData;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { EOQLTestingTab, renderEOQLTestingTab, getSampleData };
    }

})(typeof window !== 'undefined' ? window : global);
