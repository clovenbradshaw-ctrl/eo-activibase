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
                        <button class="eoql-nav-btn" data-section="visual-builder">
                            <i class="ph ph-flow-arrow"></i>
                            Visual Builder
                        </button>
                        <button class="eoql-nav-btn" data-section="sql-parser">
                            <i class="ph ph-file-sql"></i>
                            SQL Parser
                        </button>
                        <button class="eoql-nav-btn" data-section="formula-tester">
                            <i class="ph ph-function"></i>
                            Formula Engine
                        </button>
                        <button class="eoql-nav-btn" data-section="crosswalk">
                            <i class="ph ph-arrows-left-right"></i>
                            Crosswalk
                        </button>
                        <button class="eoql-nav-btn" data-section="reference">
                            <i class="ph ph-book-open"></i>
                            Reference
                        </button>
                    </div>

                    <div class="eoql-testing-content">
                        ${this.renderEOQLQuerySection()}
                        ${this.renderVisualBuilderSection()}
                        ${this.renderSQLParserSection()}
                        ${this.renderFormulaTesterSection()}
                        ${this.renderCrosswalkSection()}
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
         * Render Visual Builder section
         */
        renderVisualBuilderSection() {
            return `
                <div class="eoql-section" id="visual-builder-section">
                    <div class="eoql-section-grid">
                        <div class="eoql-input-panel" style="min-height: 400px;">
                            <div class="panel-header">
                                <h3><i class="ph ph-flow-arrow"></i> Visual Query Builder</h3>
                                <div class="panel-actions">
                                    <button class="btn-icon" id="vb-new-btn" title="New Query">
                                        <i class="ph ph-plus"></i>
                                    </button>
                                    <button class="btn-icon" id="vb-clear-btn" title="Clear">
                                        <i class="ph ph-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="visual-builder-canvas" id="visual-builder-canvas">
                                <div class="vb-empty-state">
                                    <i class="ph ph-flow-arrow" style="font-size: 48px; color: #94a3b8; margin-bottom: 16px;"></i>
                                    <p style="color: #64748b; margin: 0 0 16px 0;">Build queries visually by adding operators</p>
                                    <button class="btn-primary" id="vb-start-btn">
                                        <i class="ph ph-plus"></i> Start Building
                                    </button>
                                </div>
                                <div class="vb-pipeline" id="vb-pipeline" style="display: none;">
                                    <div class="vb-pipeline-header">
                                        <span class="vb-source-label" id="vb-source-label">SELECT * FROM ...</span>
                                    </div>
                                    <div class="vb-operators" id="vb-operators">
                                        <!-- Operators will be added here -->
                                    </div>
                                    <button class="vb-add-operator-btn" id="vb-add-operator">
                                        <i class="ph ph-plus"></i> Add Operator
                                    </button>
                                </div>
                            </div>
                            <div class="vb-operator-palette">
                                <div class="palette-header">Operators</div>
                                <div class="palette-grid">
                                    <button class="palette-btn" data-op="source" title="FROM - Set data source">
                                        <i class="ph ph-database"></i> FROM
                                    </button>
                                    <button class="palette-btn" data-op="select" title="SELECT - Choose columns">
                                        <i class="ph ph-columns"></i> SELECT
                                    </button>
                                    <button class="palette-btn" data-op="where" title="WHERE - Filter rows">
                                        <i class="ph ph-funnel"></i> WHERE
                                    </button>
                                    <button class="palette-btn" data-op="join" title="JOIN - Connect tables">
                                        <i class="ph ph-link"></i> JOIN
                                    </button>
                                    <button class="palette-btn" data-op="groupBy" title="GROUP BY - Aggregate">
                                        <i class="ph ph-squares-four"></i> GROUP
                                    </button>
                                    <button class="palette-btn" data-op="orderBy" title="ORDER BY - Sort">
                                        <i class="ph ph-sort-ascending"></i> ORDER
                                    </button>
                                    <button class="palette-btn" data-op="limit" title="LIMIT - Limit rows">
                                        <i class="ph ph-hash"></i> LIMIT
                                    </button>
                                    <button class="palette-btn" data-op="aggregate" title="Aggregations">
                                        <i class="ph ph-chart-bar"></i> AGG
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="eoql-output-panel">
                            <div class="panel-header">
                                <h3><i class="ph ph-code"></i> Generated EOQL</h3>
                                <button class="btn-icon" id="vb-copy-eoql" title="Copy EOQL">
                                    <i class="ph ph-copy"></i>
                                </button>
                            </div>
                            <div class="code-output-wrapper">
                                <pre id="vb-eoql-output" class="code-output">// Build a query to see EOQL code</pre>
                            </div>
                            <div class="panel-header" style="margin-top: 16px;">
                                <h3><i class="ph ph-file-sql"></i> Generated SQL</h3>
                                <select id="vb-dialect-select" style="margin-left: auto; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
                                    <option value="postgresql">PostgreSQL</option>
                                    <option value="mysql">MySQL</option>
                                    <option value="sqlite">SQLite</option>
                                    <option value="sqlserver">SQL Server</option>
                                    <option value="oracle">Oracle</option>
                                </select>
                            </div>
                            <div class="code-output-wrapper">
                                <pre id="vb-sql-output" class="code-output">-- Generated SQL will appear here</pre>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render Crosswalk Explorer section
         */
        renderCrosswalkSection() {
            return `
                <div class="eoql-section" id="crosswalk-section">
                    <div class="crosswalk-explorer">
                        <div class="crosswalk-header">
                            <h3><i class="ph ph-arrows-left-right"></i> SQL ↔ EOQL Crosswalk</h3>
                            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">
                                Explore how SQL constructs map to EOQL operators
                            </p>
                        </div>

                        <div class="crosswalk-tabs">
                            <button class="crosswalk-tab active" data-cw-tab="sql-to-eoql">SQL → EOQL</button>
                            <button class="crosswalk-tab" data-cw-tab="eoql-to-sql">EOQL → SQL</button>
                            <button class="crosswalk-tab" data-cw-tab="relational">Relational Algebra</button>
                        </div>

                        <div class="crosswalk-content">
                            <div class="crosswalk-panel active" id="sql-to-eoql-panel">
                                ${this.renderSQLToEOQLMappings()}
                            </div>
                            <div class="crosswalk-panel" id="eoql-to-sql-panel">
                                ${this.renderEOQLToSQLMappings()}
                            </div>
                            <div class="crosswalk-panel" id="relational-panel">
                                ${this.renderRelationalAlgebraMappings()}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render SQL to EOQL mappings
         */
        renderSQLToEOQLMappings() {
            const mappings = [
                { sql: 'SELECT', eoql: 'DES (Designate)', desc: 'Selects and names columns', example: '.select("name", "email")' },
                { sql: 'FROM', eoql: 'INS (Instantiate)', desc: 'Sets the data source', example: 'EOQL.from("users")' },
                { sql: 'WHERE', eoql: 'SEG (Segment)', desc: 'Filters rows based on conditions', example: '.where(EOQL.expr.gt("age", 18))' },
                { sql: 'JOIN', eoql: 'CON (Connect)', desc: 'Relates tables together', example: '.leftJoin("orders", condition)' },
                { sql: 'GROUP BY', eoql: 'SEG (Segment)', desc: 'Groups rows for aggregation', example: '.groupBy("department")' },
                { sql: 'HAVING', eoql: 'SEG (Segment)', desc: 'Filters grouped data', example: '.having(EOQL.expr.gt("count", 5))' },
                { sql: 'ORDER BY', eoql: 'ALT (Alternate)', desc: 'Orders result rows', example: '.orderBy("name")' },
                { sql: 'LIMIT/OFFSET', eoql: 'SEG (Segment)', desc: 'Bounds result set size', example: '.limit(10).offset(20)' },
                { sql: 'DISTINCT', eoql: 'SEG (Segment)', desc: 'Removes duplicate rows', example: '.distinct()' },
                { sql: 'UNION/INTERSECT', eoql: 'CON (Connect)', desc: 'Set operations', example: '.union(otherQuery)' },
                { sql: 'COALESCE/NULLIF', eoql: 'NUL (Null)', desc: 'Handles NULL values', example: '.coalesce("field1", "field2")' },
                { sql: 'SUM/AVG/COUNT', eoql: 'SYN (Synthesize)', desc: 'Aggregates values', example: '.sum("amount", "total")' },
                { sql: 'OVER/PARTITION', eoql: 'SUP (Superpose)', desc: 'Window functions', example: '.rowNumber({ partitionBy: ["dept"] })' },
                { sql: 'WITH RECURSIVE', eoql: 'REC (Recurse)', desc: 'Recursive queries', example: '.recursive(anchor, step)' },
                { sql: 'CASE WHEN', eoql: 'ALT (Alternate)', desc: 'Conditional logic', example: 'EOQL.expr.fn("CASE", ...)' }
            ];

            return `
                <div class="mapping-grid">
                    ${mappings.map(m => `
                        <div class="mapping-card">
                            <div class="mapping-header">
                                <span class="sql-badge">${m.sql}</span>
                                <i class="ph ph-arrow-right" style="color: #94a3b8;"></i>
                                <span class="eoql-badge">${m.eoql}</span>
                            </div>
                            <div class="mapping-desc">${m.desc}</div>
                            <code class="mapping-example">${m.example}</code>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        /**
         * Render EOQL to SQL mappings
         */
        renderEOQLToSQLMappings() {
            const operators = [
                { op: 'NUL', name: 'Handle Absence', sql: ['IS NULL', 'IS NOT NULL', 'COALESCE', 'NULLIF', 'IFNULL'], color: '#ef4444' },
                { op: 'DES', name: 'Designate', sql: ['SELECT', 'AS', 'CAST', 'CONVERT'], color: '#f97316' },
                { op: 'INS', name: 'Instantiate', sql: ['FROM', 'INSERT INTO', 'VALUES', 'CREATE'], color: '#eab308' },
                { op: 'SEG', name: 'Segment', sql: ['WHERE', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT'], color: '#22c55e' },
                { op: 'CON', name: 'Connect', sql: ['JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'UNION', 'INTERSECT', 'EXCEPT'], color: '#06b6d4' },
                { op: 'ALT', name: 'Alternate', sql: ['ORDER BY', 'CASE', 'WHEN', 'THEN', 'ELSE'], color: '#3b82f6' },
                { op: 'SYN', name: 'Synthesize', sql: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'STRING_AGG'], color: '#8b5cf6' },
                { op: 'SUP', name: 'Superpose', sql: ['OVER', 'PARTITION BY', 'WITH', 'ROW_NUMBER', 'RANK', 'LAG', 'LEAD'], color: '#ec4899' },
                { op: 'REC', name: 'Recurse', sql: ['WITH RECURSIVE', 'CONNECT BY'], color: '#6b7280' }
            ];

            return `
                <div class="operator-mapping-grid">
                    ${operators.map(o => `
                        <div class="operator-card" style="border-left: 4px solid ${o.color};">
                            <div class="operator-header">
                                <span class="op-name" style="color: ${o.color};">${o.op}</span>
                                <span class="op-label">${o.name}</span>
                            </div>
                            <div class="op-sql-list">
                                ${o.sql.map(s => `<span class="sql-tag">${s}</span>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        /**
         * Render Relational Algebra mappings
         */
        renderRelationalAlgebraMappings() {
            const algebra = [
                { symbol: 'σ', name: 'Selection', desc: 'Filter rows (WHERE)', eoql: 'SEG', sql: 'WHERE condition' },
                { symbol: 'π', name: 'Projection', desc: 'Choose columns (SELECT)', eoql: 'DES', sql: 'SELECT columns' },
                { symbol: '⋈', name: 'Natural Join', desc: 'Join on common columns', eoql: 'CON', sql: 'NATURAL JOIN' },
                { symbol: '⟕', name: 'Left Outer Join', desc: 'Keep all left rows', eoql: 'CON', sql: 'LEFT JOIN' },
                { symbol: '⟖', name: 'Right Outer Join', desc: 'Keep all right rows', eoql: 'CON', sql: 'RIGHT JOIN' },
                { symbol: '⟗', name: 'Full Outer Join', desc: 'Keep all rows', eoql: 'CON', sql: 'FULL JOIN' },
                { symbol: '×', name: 'Cartesian Product', desc: 'All combinations', eoql: 'CON', sql: 'CROSS JOIN' },
                { symbol: '∪', name: 'Union', desc: 'Combine result sets', eoql: 'CON', sql: 'UNION' },
                { symbol: '∩', name: 'Intersection', desc: 'Common rows only', eoql: 'CON', sql: 'INTERSECT' },
                { symbol: '−', name: 'Difference', desc: 'Rows in first but not second', eoql: 'CON', sql: 'EXCEPT' },
                { symbol: 'γ', name: 'Aggregation', desc: 'Group and aggregate', eoql: 'SYN + SEG', sql: 'GROUP BY + aggregates' },
                { symbol: 'ρ', name: 'Rename', desc: 'Alias tables/columns', eoql: 'DES', sql: 'AS alias' },
                { symbol: 'δ', name: 'Duplicate Elimination', desc: 'Remove duplicates', eoql: 'SEG', sql: 'DISTINCT' },
                { symbol: 'τ', name: 'Sort', desc: 'Order results', eoql: 'ALT', sql: 'ORDER BY' }
            ];

            return `
                <div class="algebra-grid">
                    ${algebra.map(a => `
                        <div class="algebra-card">
                            <div class="algebra-symbol">${a.symbol}</div>
                            <div class="algebra-info">
                                <div class="algebra-name">${a.name}</div>
                                <div class="algebra-desc">${a.desc}</div>
                                <div class="algebra-mapping">
                                    <span class="eoql-mini">${a.eoql}</span>
                                    <span class="sql-mini">${a.sql}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
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

            // Visual Builder section
            this.initVisualBuilder();

            // Crosswalk section
            this.initCrosswalkTabs();
        }

        /**
         * Initialize the Visual Query Builder
         */
        initVisualBuilder() {
            this.vbQuery = null;
            this.vbOperators = [];

            const startBtn = document.getElementById('vb-start-btn');
            if (startBtn) {
                startBtn.addEventListener('click', () => this.vbStartQuery());
            }

            const newBtn = document.getElementById('vb-new-btn');
            if (newBtn) {
                newBtn.addEventListener('click', () => this.vbStartQuery());
            }

            const clearBtn = document.getElementById('vb-clear-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.vbClearQuery());
            }

            const addOpBtn = document.getElementById('vb-add-operator');
            if (addOpBtn) {
                addOpBtn.addEventListener('click', () => this.vbShowOperatorMenu());
            }

            // Palette buttons
            document.querySelectorAll('.palette-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const op = e.target.closest('.palette-btn').dataset.op;
                    this.vbAddOperator(op);
                });
            });

            // Dialect selector
            const dialectSelect = document.getElementById('vb-dialect-select');
            if (dialectSelect) {
                dialectSelect.addEventListener('change', () => this.vbUpdateOutput());
            }

            // Copy EOQL button
            const copyEoqlBtn = document.getElementById('vb-copy-eoql');
            if (copyEoqlBtn) {
                copyEoqlBtn.addEventListener('click', () => this.copyToClipboard('vb-eoql-output'));
            }
        }

        /**
         * Start a new visual query
         */
        vbStartQuery() {
            const tableName = prompt('Enter table name:', 'users');
            if (!tableName) return;

            this.vbQuery = EOQL.from(tableName);
            this.vbOperators = [{ type: 'source', table: tableName }];

            // Show the pipeline UI
            document.querySelector('.vb-empty-state').style.display = 'none';
            document.getElementById('vb-pipeline').style.display = 'block';
            document.getElementById('vb-source-label').textContent = `FROM ${tableName}`;
            document.getElementById('vb-operators').innerHTML = '';

            this.vbUpdateOutput();
        }

        /**
         * Clear the visual query
         */
        vbClearQuery() {
            this.vbQuery = null;
            this.vbOperators = [];

            document.querySelector('.vb-empty-state').style.display = 'flex';
            document.getElementById('vb-pipeline').style.display = 'none';
            document.getElementById('vb-operators').innerHTML = '';
            document.getElementById('vb-eoql-output').textContent = '// Build a query to see EOQL code';
            document.getElementById('vb-sql-output').textContent = '-- Generated SQL will appear here';
        }

        /**
         * Show operator selection menu
         */
        vbShowOperatorMenu() {
            // For now, just highlight the palette
            const palette = document.querySelector('.vb-operator-palette');
            if (palette) {
                palette.style.animation = 'pulse 0.5s ease';
                setTimeout(() => palette.style.animation = '', 500);
            }
        }

        /**
         * Add an operator to the visual query
         */
        vbAddOperator(opType) {
            if (!this.vbQuery) {
                this.vbStartQuery();
                if (!this.vbQuery) return;
            }

            let config, displayText;

            switch (opType) {
                case 'source':
                    const tableName = prompt('Table name:', 'users');
                    if (!tableName) return;
                    this.vbQuery = EOQL.from(tableName);
                    this.vbOperators = [{ type: 'source', table: tableName }];
                    document.getElementById('vb-source-label').textContent = `FROM ${tableName}`;
                    document.getElementById('vb-operators').innerHTML = '';
                    break;

                case 'select':
                    const columns = prompt('Columns (comma-separated):', 'id, name, email');
                    if (!columns) return;
                    const colArray = columns.split(',').map(c => c.trim());
                    this.vbQuery = this.vbQuery.select(...colArray);
                    config = { type: 'select', columns: colArray };
                    displayText = `SELECT ${colArray.join(', ')}`;
                    break;

                case 'where':
                    const field = prompt('Field name:', 'age');
                    const operator = prompt('Operator (=, >, <, >=, <=, !=, like):', '>');
                    const value = prompt('Value:', '25');
                    if (!field || !operator) return;

                    let expr;
                    const numValue = isNaN(value) ? value : Number(value);
                    switch (operator) {
                        case '=': expr = EOQL.expr.eq(field, numValue); break;
                        case '>': expr = EOQL.expr.gt(field, numValue); break;
                        case '<': expr = EOQL.expr.lt(field, numValue); break;
                        case '>=': expr = EOQL.expr.gte(field, numValue); break;
                        case '<=': expr = EOQL.expr.lte(field, numValue); break;
                        case '!=': expr = EOQL.expr.ne(field, numValue); break;
                        case 'like': expr = EOQL.expr.like(field, value); break;
                        default: expr = EOQL.expr.eq(field, numValue);
                    }
                    this.vbQuery = this.vbQuery.where(expr);
                    config = { type: 'where', field, operator, value };
                    displayText = `WHERE ${field} ${operator} ${typeof numValue === 'string' ? `'${numValue}'` : numValue}`;
                    break;

                case 'join':
                    const joinTable = prompt('Join table:', 'orders');
                    const leftCol = prompt('Left column:', 'id');
                    const rightCol = prompt('Right column:', `${joinTable}.user_id`);
                    const joinType = prompt('Join type (inner, left, right, full):', 'left');
                    if (!joinTable || !leftCol || !rightCol) return;

                    const joinExpr = EOQL.expr.eq(leftCol, EOQL.expr.field(rightCol));
                    switch (joinType) {
                        case 'left': this.vbQuery = this.vbQuery.leftJoin(joinTable, joinExpr); break;
                        case 'right': this.vbQuery = this.vbQuery.rightJoin(joinTable, joinExpr); break;
                        case 'full': this.vbQuery = this.vbQuery.fullJoin(joinTable, joinExpr); break;
                        default: this.vbQuery = this.vbQuery.join(joinTable, joinExpr);
                    }
                    config = { type: 'join', joinTable, leftCol, rightCol, joinType };
                    displayText = `${joinType.toUpperCase()} JOIN ${joinTable} ON ${leftCol} = ${rightCol}`;
                    break;

                case 'groupBy':
                    const groupFields = prompt('Group by fields (comma-separated):', 'department');
                    if (!groupFields) return;
                    const groupArray = groupFields.split(',').map(c => c.trim());
                    this.vbQuery = this.vbQuery.groupBy(...groupArray);
                    config = { type: 'groupBy', fields: groupArray };
                    displayText = `GROUP BY ${groupArray.join(', ')}`;
                    break;

                case 'orderBy':
                    const orderField = prompt('Order by field:', 'name');
                    const orderDir = prompt('Direction (asc, desc):', 'asc');
                    if (!orderField) return;
                    if (orderDir === 'desc') {
                        this.vbQuery = this.vbQuery.orderByDesc(orderField);
                    } else {
                        this.vbQuery = this.vbQuery.orderBy(orderField);
                    }
                    config = { type: 'orderBy', field: orderField, direction: orderDir };
                    displayText = `ORDER BY ${orderField} ${orderDir.toUpperCase()}`;
                    break;

                case 'limit':
                    const limitVal = prompt('Limit:', '10');
                    const offsetVal = prompt('Offset (optional):', '');
                    if (!limitVal) return;
                    this.vbQuery = this.vbQuery.limit(parseInt(limitVal));
                    if (offsetVal) {
                        this.vbQuery = this.vbQuery.offset(parseInt(offsetVal));
                    }
                    config = { type: 'limit', limit: parseInt(limitVal), offset: offsetVal ? parseInt(offsetVal) : null };
                    displayText = `LIMIT ${limitVal}${offsetVal ? ` OFFSET ${offsetVal}` : ''}`;
                    break;

                case 'aggregate':
                    const aggFunc = prompt('Aggregate function (sum, avg, count, min, max):', 'count');
                    const aggField = prompt('Field (* for count):', '*');
                    const aggAlias = prompt('Alias:', `${aggFunc}_result`);
                    if (!aggFunc) return;
                    switch (aggFunc.toLowerCase()) {
                        case 'sum': this.vbQuery = this.vbQuery.sum(aggField, aggAlias); break;
                        case 'avg': this.vbQuery = this.vbQuery.avg(aggField, aggAlias); break;
                        case 'count': this.vbQuery = this.vbQuery.count(aggField, aggAlias); break;
                        case 'min': this.vbQuery = this.vbQuery.min(aggField, aggAlias); break;
                        case 'max': this.vbQuery = this.vbQuery.max(aggField, aggAlias); break;
                    }
                    config = { type: 'aggregate', func: aggFunc, field: aggField, alias: aggAlias };
                    displayText = `${aggFunc.toUpperCase()}(${aggField}) AS ${aggAlias}`;
                    break;
            }

            if (config && displayText) {
                this.vbOperators.push(config);
                this.vbAddOperatorUI(displayText, this.vbOperators.length - 1);
            }

            this.vbUpdateOutput();
        }

        /**
         * Add operator to the UI
         */
        vbAddOperatorUI(displayText, index) {
            const container = document.getElementById('vb-operators');
            const opEl = document.createElement('div');
            opEl.className = 'vb-operator-item';
            opEl.innerHTML = `
                <span class="vb-op-text">${displayText}</span>
                <button class="vb-op-remove" data-index="${index}" title="Remove">
                    <i class="ph ph-x"></i>
                </button>
            `;

            opEl.querySelector('.vb-op-remove').addEventListener('click', (e) => {
                this.vbRemoveOperator(parseInt(e.currentTarget.dataset.index));
            });

            container.appendChild(opEl);
        }

        /**
         * Remove an operator
         */
        vbRemoveOperator(index) {
            // Rebuild query from scratch
            if (index <= 0 || !this.vbOperators[0]) return;

            const sourceOp = this.vbOperators[0];
            this.vbQuery = EOQL.from(sourceOp.table);

            // Remove the operator
            this.vbOperators.splice(index, 1);

            // Rebuild UI
            document.getElementById('vb-operators').innerHTML = '';

            // Replay remaining operators
            for (let i = 1; i < this.vbOperators.length; i++) {
                const op = this.vbOperators[i];
                // Re-apply each operator (simplified)
                this.vbReapplyOperator(op, i);
            }

            this.vbUpdateOutput();
        }

        /**
         * Re-apply an operator during rebuild
         */
        vbReapplyOperator(op, index) {
            let displayText;
            switch (op.type) {
                case 'select':
                    this.vbQuery = this.vbQuery.select(...op.columns);
                    displayText = `SELECT ${op.columns.join(', ')}`;
                    break;
                case 'where':
                    let expr;
                    const val = isNaN(op.value) ? op.value : Number(op.value);
                    switch (op.operator) {
                        case '=': expr = EOQL.expr.eq(op.field, val); break;
                        case '>': expr = EOQL.expr.gt(op.field, val); break;
                        default: expr = EOQL.expr.eq(op.field, val);
                    }
                    this.vbQuery = this.vbQuery.where(expr);
                    displayText = `WHERE ${op.field} ${op.operator} ${op.value}`;
                    break;
                case 'groupBy':
                    this.vbQuery = this.vbQuery.groupBy(...op.fields);
                    displayText = `GROUP BY ${op.fields.join(', ')}`;
                    break;
                case 'orderBy':
                    if (op.direction === 'desc') {
                        this.vbQuery = this.vbQuery.orderByDesc(op.field);
                    } else {
                        this.vbQuery = this.vbQuery.orderBy(op.field);
                    }
                    displayText = `ORDER BY ${op.field} ${op.direction.toUpperCase()}`;
                    break;
                case 'limit':
                    this.vbQuery = this.vbQuery.limit(op.limit);
                    if (op.offset) this.vbQuery = this.vbQuery.offset(op.offset);
                    displayText = `LIMIT ${op.limit}${op.offset ? ` OFFSET ${op.offset}` : ''}`;
                    break;
                // Add more cases as needed
            }
            if (displayText) {
                this.vbAddOperatorUI(displayText, index);
            }
        }

        /**
         * Update visual builder output
         */
        vbUpdateOutput() {
            const eoqlOutput = document.getElementById('vb-eoql-output');
            const sqlOutput = document.getElementById('vb-sql-output');
            const dialect = document.getElementById('vb-dialect-select')?.value || 'postgresql';

            if (!this.vbQuery) {
                eoqlOutput.textContent = '// Build a query to see EOQL code';
                sqlOutput.textContent = '-- Generated SQL will appear here';
                return;
            }

            try {
                // Generate EOQL representation
                const ast = this.vbQuery.toAST();
                const eoqlCode = this.generateEOQLCode();
                eoqlOutput.textContent = eoqlCode;
                eoqlOutput.classList.remove('error');

                // Generate SQL
                if (global.EOQueryCompiler) {
                    const compiler = new global.EOQueryCompiler(dialect);
                    const sql = compiler.compile(this.vbQuery);
                    sqlOutput.textContent = sql;
                    sqlOutput.classList.remove('error');
                } else {
                    sqlOutput.textContent = '-- Compiler not available';
                }
            } catch (error) {
                eoqlOutput.textContent = `// Error: ${error.message}`;
                eoqlOutput.classList.add('error');
                sqlOutput.textContent = `-- Error: ${error.message}`;
                sqlOutput.classList.add('error');
            }
        }

        /**
         * Generate EOQL code representation
         */
        generateEOQLCode() {
            if (!this.vbOperators.length) return '// No query';

            const source = this.vbOperators[0];
            let code = `EOQL.from('${source.table}')`;

            for (let i = 1; i < this.vbOperators.length; i++) {
                const op = this.vbOperators[i];
                switch (op.type) {
                    case 'select':
                        code += `\n    .select(${op.columns.map(c => `'${c}'`).join(', ')})`;
                        break;
                    case 'where':
                        code += `\n    .where(EOQL.expr.${this.opToExprName(op.operator)}('${op.field}', ${typeof op.value === 'string' && isNaN(op.value) ? `'${op.value}'` : op.value}))`;
                        break;
                    case 'join':
                        code += `\n    .${op.joinType}Join('${op.joinTable}', EOQL.expr.eq('${op.leftCol}', EOQL.expr.field('${op.rightCol}')))`;
                        break;
                    case 'groupBy':
                        code += `\n    .groupBy(${op.fields.map(f => `'${f}'`).join(', ')})`;
                        break;
                    case 'orderBy':
                        code += op.direction === 'desc'
                            ? `\n    .orderByDesc('${op.field}')`
                            : `\n    .orderBy('${op.field}')`;
                        break;
                    case 'limit':
                        code += `\n    .limit(${op.limit})`;
                        if (op.offset) code += `\n    .offset(${op.offset})`;
                        break;
                    case 'aggregate':
                        code += `\n    .${op.func}('${op.field}', '${op.alias}')`;
                        break;
                }
            }

            return code;
        }

        /**
         * Convert operator symbol to expression method name
         */
        opToExprName(op) {
            switch (op) {
                case '=': return 'eq';
                case '!=': return 'ne';
                case '>': return 'gt';
                case '>=': return 'gte';
                case '<': return 'lt';
                case '<=': return 'lte';
                case 'like': return 'like';
                default: return 'eq';
            }
        }

        /**
         * Initialize crosswalk tabs
         */
        initCrosswalkTabs() {
            document.querySelectorAll('.crosswalk-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const tabId = e.target.dataset.cwTab;

                    // Update tab buttons
                    document.querySelectorAll('.crosswalk-tab').forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');

                    // Update panels
                    document.querySelectorAll('.crosswalk-panel').forEach(p => p.classList.remove('active'));
                    document.getElementById(`${tabId}-panel`)?.classList.add('active');
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
