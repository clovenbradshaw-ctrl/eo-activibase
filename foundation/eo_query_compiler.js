/**
 * EO Query Compiler
 * Compiles EOQL queries to SQL and other target languages
 *
 * @eo_operator SYN
 * @eo_layer foundation
 *
 * The compiler transforms EOQL AST into target query languages:
 * - SQL (PostgreSQL, MySQL, SQLite, SQL Server, Oracle)
 * - Future: MongoDB aggregation pipeline, Pandas, etc.
 */

(function(global) {
    'use strict';

    // ============================================================================
    // SQL DIALECT CONFIGURATIONS
    // ============================================================================

    const SQL_DIALECTS = {
        postgresql: {
            name: 'PostgreSQL',
            stringConcat: '||',
            limitOffset: 'LIMIT {limit} OFFSET {offset}',
            booleanTrue: 'TRUE',
            booleanFalse: 'FALSE',
            ilike: 'ILIKE',
            stringAgg: 'STRING_AGG({field}, {separator})',
            arrayAgg: 'ARRAY_AGG({field})',
            dateFormat: "TO_CHAR({field}, '{format}')",
            nullsFirst: 'NULLS FIRST',
            nullsLast: 'NULLS LAST',
            returning: 'RETURNING *',
            upsert: 'ON CONFLICT ({keys}) DO UPDATE SET',
            jsonExtract: "{field}->'{path}'",
            jsonExtractText: "{field}->>'{path}'"
        },

        mysql: {
            name: 'MySQL',
            stringConcat: 'CONCAT({args})',
            limitOffset: 'LIMIT {offset}, {limit}',
            booleanTrue: '1',
            booleanFalse: '0',
            ilike: 'LIKE',  // MySQL LIKE is case-insensitive by default
            stringAgg: 'GROUP_CONCAT({field} SEPARATOR {separator})',
            arrayAgg: 'JSON_ARRAYAGG({field})',
            dateFormat: "DATE_FORMAT({field}, '{format}')",
            nullsFirst: null,  // Not supported directly
            nullsLast: null,
            returning: null,  // Not supported in older versions
            upsert: 'ON DUPLICATE KEY UPDATE',
            jsonExtract: "JSON_EXTRACT({field}, '$.{path}')",
            jsonExtractText: "JSON_UNQUOTE(JSON_EXTRACT({field}, '$.{path}'))"
        },

        sqlite: {
            name: 'SQLite',
            stringConcat: '||',
            limitOffset: 'LIMIT {limit} OFFSET {offset}',
            booleanTrue: '1',
            booleanFalse: '0',
            ilike: 'LIKE',  // Case-insensitive with NOCASE
            stringAgg: 'GROUP_CONCAT({field}, {separator})',
            arrayAgg: 'JSON_GROUP_ARRAY({field})',
            dateFormat: "STRFTIME('{format}', {field})",
            nullsFirst: 'NULLS FIRST',
            nullsLast: 'NULLS LAST',
            returning: 'RETURNING *',
            upsert: 'ON CONFLICT ({keys}) DO UPDATE SET',
            jsonExtract: "JSON_EXTRACT({field}, '$.{path}')",
            jsonExtractText: "JSON_EXTRACT({field}, '$.{path}')"
        },

        sqlserver: {
            name: 'SQL Server',
            stringConcat: '+',
            limitOffset: 'OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY',
            booleanTrue: '1',
            booleanFalse: '0',
            ilike: 'LIKE',  // Case sensitivity depends on collation
            stringAgg: 'STRING_AGG({field}, {separator})',
            arrayAgg: null,  // Not directly supported
            dateFormat: "FORMAT({field}, '{format}')",
            nullsFirst: null,
            nullsLast: null,
            returning: 'OUTPUT INSERTED.*',
            upsert: 'MERGE',
            jsonExtract: "JSON_VALUE({field}, '$.{path}')",
            jsonExtractText: "JSON_VALUE({field}, '$.{path}')"
        },

        oracle: {
            name: 'Oracle',
            stringConcat: '||',
            limitOffset: 'OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY',
            booleanTrue: '1',
            booleanFalse: '0',
            ilike: 'LIKE',  // Use UPPER() for case-insensitive
            stringAgg: 'LISTAGG({field}, {separator}) WITHIN GROUP (ORDER BY {field})',
            arrayAgg: null,
            dateFormat: "TO_CHAR({field}, '{format}')",
            nullsFirst: 'NULLS FIRST',
            nullsLast: 'NULLS LAST',
            returning: 'RETURNING * INTO',
            upsert: 'MERGE',
            jsonExtract: "JSON_VALUE({field}, '$.{path}')",
            jsonExtractText: "JSON_VALUE({field}, '$.{path}')"
        }
    };

    // ============================================================================
    // SQL COMPILER
    // ============================================================================

    /**
     * EOQueryCompiler - Compiles EOQL to SQL
     */
    class EOQueryCompiler {
        constructor(dialect = 'postgresql') {
            this.dialect = dialect;
            this.dialectConfig = SQL_DIALECTS[dialect] || SQL_DIALECTS.postgresql;
        }

        /**
         * Compile EOQL query to SQL
         * @param {EOQuery|Object} query - Query or AST
         * @returns {string}
         */
        compile(query) {
            const ast = query.toAST ? query.toAST() : query;
            const ctx = this._createContext();

            // Process pipeline
            for (const node of ast.pipeline) {
                this._processNode(node, ctx);
            }

            return this._buildSQL(ctx, ast.ctes);
        }

        /**
         * Create compilation context
         */
        _createContext() {
            return {
                select: [],
                from: null,
                joins: [],
                where: [],
                groupBy: [],
                having: [],
                orderBy: [],
                limit: null,
                offset: null,
                distinct: false,
                aggregations: {},
                windows: [],
                setOps: [],
                ctes: {}
            };
        }

        /**
         * Process a pipeline node
         */
        _processNode(node, ctx) {
            const { operator, params } = node;

            switch (operator) {
                case 'INS':
                    this._processINS(params, ctx);
                    break;
                case 'DES':
                    this._processDES(params, ctx);
                    break;
                case 'SEG':
                    this._processSEG(params, ctx);
                    break;
                case 'CON':
                    this._processCON(params, ctx);
                    break;
                case 'ALT':
                    this._processALT(params, ctx);
                    break;
                case 'SYN':
                    this._processSYN(params, ctx);
                    break;
                case 'SUP':
                    this._processSUP(params, ctx);
                    break;
                case 'NUL':
                    this._processNUL(params, ctx);
                    break;
                case 'REC':
                    this._processREC(params, ctx);
                    break;
            }
        }

        /**
         * Process INS (source)
         */
        _processINS(params, ctx) {
            if (params.source) {
                // Handle table with alias (object form)
                if (typeof params.source === 'object' && params.source.table) {
                    ctx.from = params.source.alias
                        ? `${params.source.table} ${params.source.alias}`
                        : params.source.table;
                } else {
                    ctx.from = params.source;
                }
            }
        }

        /**
         * Process DES (select/alias)
         */
        _processDES(params, ctx) {
            if (params.columns) {
                ctx.select = params.columns.map(c => {
                    if (typeof c === 'string') return c;
                    if (typeof c === 'object') {
                        // Check if it's an expression with a type field
                        if (c.type) {
                            return this._formatExpr(c);
                        }
                        // Check if it's an alias mapping { alias: expr }
                        const entries = Object.entries(c);
                        if (entries.length === 1) {
                            const [alias, expr] = entries[0];
                            return `${this._formatExpr(expr)} AS ${this._quoteIdentifier(alias)}`;
                        }
                    }
                    return String(c);
                });
            }
        }

        /**
         * Process SEG (filter/group/limit)
         */
        _processSEG(params, ctx) {
            if (params.distinct) {
                ctx.distinct = params.distinct;
            }

            if (params.where) {
                ctx.where.push(this._formatCondition(params.where));
            }

            if (params.groupBy) {
                ctx.groupBy = params.groupBy;
            }

            if (params.having) {
                ctx.having.push(this._formatCondition(params.having));
            }

            if (params.limit !== undefined) {
                ctx.limit = params.limit;
            }

            if (params.offset !== undefined) {
                ctx.offset = params.offset;
            }
        }

        /**
         * Process CON (join/set operations)
         */
        _processCON(params, ctx) {
            const { target, on, type = 'inner', using } = params;

            // Set operations
            if (['union', 'union_all', 'intersect', 'except'].includes(type)) {
                ctx.setOps.push({
                    type: type.toUpperCase().replace('_', ' '),
                    query: target
                });
                return;
            }

            // Joins
            const joinType = {
                'inner': 'INNER JOIN',
                'left': 'LEFT JOIN',
                'right': 'RIGHT JOIN',
                'full': 'FULL OUTER JOIN',
                'cross': 'CROSS JOIN'
            }[type] || 'INNER JOIN';

            // Handle table with alias (object form)
            let targetStr;
            if (typeof target === 'object' && target.table) {
                targetStr = target.alias
                    ? `${target.table} ${target.alias}`
                    : target.table;
            } else {
                targetStr = target;
            }

            let joinSQL = `${joinType} ${targetStr}`;

            if (on) {
                joinSQL += ` ON ${this._formatCondition(on)}`;
            } else if (using) {
                joinSQL += ` USING (${using.join(', ')})`;
            }

            ctx.joins.push(joinSQL);
        }

        /**
         * Process ALT (order/case)
         */
        _processALT(params, ctx) {
            if (params.orderBy) {
                ctx.orderBy = params.orderBy.map(spec => {
                    const field = spec.field || spec;
                    const dir = spec.direction === 'desc' ? 'DESC' : 'ASC';

                    let orderSpec = `${field} ${dir}`;

                    // Nulls handling
                    if (spec.nullsFirst && this.dialectConfig.nullsFirst) {
                        orderSpec += ` ${this.dialectConfig.nullsFirst}`;
                    } else if (spec.nullsLast && this.dialectConfig.nullsLast) {
                        orderSpec += ` ${this.dialectConfig.nullsLast}`;
                    }

                    return orderSpec;
                });
            }
        }

        /**
         * Process SYN (aggregation)
         */
        _processSYN(params, ctx) {
            if (params.aggregations) {
                Object.assign(ctx.aggregations, params.aggregations);
            }
        }

        /**
         * Process SUP (window/CTE)
         */
        _processSUP(params, ctx) {
            if (params.cte) {
                Object.assign(ctx.ctes, params.cte);
            }

            if (params.window) {
                ctx.windows.push(params.window);
            }
        }

        /**
         * Process NUL (null handling)
         */
        _processNUL(params, ctx) {
            // Null handling is typically done inline in expressions
            // Store for reference
            ctx.nullHandling = params;
        }

        /**
         * Process REC (recursion)
         */
        _processREC(params, ctx) {
            ctx.recursive = params;
        }

        /**
         * Build final SQL from context
         */
        _buildSQL(ctx, ctes = {}) {
            const parts = [];

            // CTEs
            const allCtes = { ...ctes, ...ctx.ctes };
            if (Object.keys(allCtes).length > 0 || ctx.recursive) {
                const cteKeyword = ctx.recursive ? 'WITH RECURSIVE' : 'WITH';
                const cteDefs = Object.entries(allCtes).map(([name, query]) => {
                    const sql = query.toAST ? this.compile(query) : query;
                    return `${name} AS (${sql})`;
                });

                if (ctx.recursive) {
                    const { anchor, recursive } = ctx.recursive;
                    const anchorSQL = anchor.toAST ? this.compile(anchor) : anchor;
                    const recursiveSQL = recursive.toAST ? this.compile(recursive) : recursive;
                    cteDefs.push(`recursive_cte AS (${anchorSQL} UNION ALL ${recursiveSQL})`);
                }

                if (cteDefs.length > 0) {
                    parts.push(`${cteKeyword} ${cteDefs.join(', ')}`);
                }
            }

            // SELECT
            let selectClause = 'SELECT';
            if (ctx.distinct === true) {
                selectClause += ' DISTINCT';
            } else if (Array.isArray(ctx.distinct)) {
                selectClause += ` DISTINCT ON (${ctx.distinct.join(', ')})`;
            }

            // Columns
            let columns = ctx.select.length > 0 ? ctx.select : ['*'];

            // Add aggregations to columns
            for (const [alias, agg] of Object.entries(ctx.aggregations)) {
                const field = agg.field === '*' ? '*' : agg.field;
                columns.push(`${agg.fn}(${field}) AS ${this._quoteIdentifier(alias)}`);
            }

            // Add window functions to columns
            for (const win of ctx.windows) {
                const overClause = this._buildOverClause(win);
                columns.push(`${win.fn}(${win.field || ''}) OVER (${overClause}) AS ${win.alias || win.fn.toLowerCase()}`);
            }

            parts.push(`${selectClause} ${columns.join(', ')}`);

            // FROM
            if (ctx.from) {
                parts.push(`FROM ${ctx.from}`);
            } else if (ctx.recursive) {
                parts.push('FROM recursive_cte');
            }

            // JOINs
            for (const join of ctx.joins) {
                parts.push(join);
            }

            // WHERE
            if (ctx.where.length > 0) {
                parts.push(`WHERE ${ctx.where.join(' AND ')}`);
            }

            // GROUP BY
            if (ctx.groupBy.length > 0) {
                parts.push(`GROUP BY ${ctx.groupBy.join(', ')}`);
            }

            // HAVING
            if (ctx.having.length > 0) {
                parts.push(`HAVING ${ctx.having.join(' AND ')}`);
            }

            // Set operations
            for (const setOp of ctx.setOps) {
                const subSQL = setOp.query.toAST ? this.compile(setOp.query) : setOp.query;
                parts.push(`${setOp.type} ${subSQL}`);
            }

            // ORDER BY
            if (ctx.orderBy.length > 0) {
                parts.push(`ORDER BY ${ctx.orderBy.join(', ')}`);
            }

            // LIMIT/OFFSET
            if (ctx.limit !== null || ctx.offset !== null) {
                parts.push(this._buildLimitOffset(ctx.limit, ctx.offset));
            }

            return parts.join('\n');
        }

        /**
         * Build OVER clause for window functions
         */
        _buildOverClause(win) {
            const parts = [];

            if (win.partitionBy) {
                parts.push(`PARTITION BY ${win.partitionBy.join(', ')}`);
            }

            if (win.orderBy) {
                const orderSpecs = win.orderBy.map(o =>
                    typeof o === 'string' ? o : `${o.field} ${o.direction || 'ASC'}`
                );
                parts.push(`ORDER BY ${orderSpecs.join(', ')}`);
            }

            if (win.frame) {
                parts.push(win.frame);
            }

            return parts.join(' ');
        }

        /**
         * Build LIMIT/OFFSET clause (dialect-specific)
         */
        _buildLimitOffset(limit, offset) {
            const template = this.dialectConfig.limitOffset;
            const limitVal = limit !== null ? limit : 'ALL';
            const offsetVal = offset !== null ? offset : 0;

            return template
                .replace('{limit}', limitVal)
                .replace('{offset}', offsetVal);
        }

        /**
         * Format a condition to SQL
         */
        _formatCondition(condition) {
            if (!condition) return '1=1';

            // Typed expression
            if (condition.type) {
                return this._formatExpr(condition);
            }

            // Object condition: { field: value } or { field: { $gt: value } }
            const parts = [];
            for (const [field, value] of Object.entries(condition)) {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    // Complex condition
                    parts.push(this._formatComplexCondition(field, value));
                } else {
                    // Simple equality
                    parts.push(`${field} = ${this._formatValue(value)}`);
                }
            }

            return parts.join(' AND ');
        }

        /**
         * Format complex condition operators
         */
        _formatComplexCondition(field, condition) {
            const parts = [];

            if (condition.$eq !== undefined) parts.push(`${field} = ${this._formatValue(condition.$eq)}`);
            if (condition.$ne !== undefined) parts.push(`${field} != ${this._formatValue(condition.$ne)}`);
            if (condition.$gt !== undefined) parts.push(`${field} > ${this._formatValue(condition.$gt)}`);
            if (condition.$gte !== undefined) parts.push(`${field} >= ${this._formatValue(condition.$gte)}`);
            if (condition.$lt !== undefined) parts.push(`${field} < ${this._formatValue(condition.$lt)}`);
            if (condition.$lte !== undefined) parts.push(`${field} <= ${this._formatValue(condition.$lte)}`);
            if (condition.$in !== undefined) parts.push(`${field} IN (${condition.$in.map(v => this._formatValue(v)).join(', ')})`);
            if (condition.$nin !== undefined) parts.push(`${field} NOT IN (${condition.$nin.map(v => this._formatValue(v)).join(', ')})`);
            if (condition.$like !== undefined) parts.push(`${field} LIKE ${this._formatValue(condition.$like)}`);
            if (condition.$ilike !== undefined) parts.push(`${field} ${this.dialectConfig.ilike} ${this._formatValue(condition.$ilike)}`);
            if (condition.$between !== undefined) parts.push(`${field} BETWEEN ${this._formatValue(condition.$between[0])} AND ${this._formatValue(condition.$between[1])}`);
            if (condition.$isNull === true) parts.push(`${field} IS NULL`);
            if (condition.$isNull === false) parts.push(`${field} IS NOT NULL`);

            return parts.length > 0 ? parts.join(' AND ') : '1=1';
        }

        /**
         * Format typed expression
         */
        _formatExpr(expr) {
            if (!expr || typeof expr !== 'object') {
                return this._formatValue(expr);
            }

            switch (expr.type) {
                case 'literal':
                    return this._formatValue(expr.value);

                case 'field':
                    return expr.name;

                case 'eq':
                    return `${this._formatExpr(expr.left)} = ${this._formatExpr(expr.right)}`;
                case 'ne':
                    return `${this._formatExpr(expr.left)} != ${this._formatExpr(expr.right)}`;
                case 'gt':
                    return `${this._formatExpr(expr.left)} > ${this._formatExpr(expr.right)}`;
                case 'gte':
                    return `${this._formatExpr(expr.left)} >= ${this._formatExpr(expr.right)}`;
                case 'lt':
                    return `${this._formatExpr(expr.left)} < ${this._formatExpr(expr.right)}`;
                case 'lte':
                    return `${this._formatExpr(expr.left)} <= ${this._formatExpr(expr.right)}`;

                case 'like':
                    return `${this._formatExpr(expr.field)} LIKE ${this._formatValue(expr.pattern)}`;
                case 'ilike':
                    return `${this._formatExpr(expr.field)} ${this.dialectConfig.ilike} ${this._formatValue(expr.pattern)}`;

                case 'in':
                    return `${this._formatExpr(expr.field)} IN (${expr.values.map(v => this._formatValue(v)).join(', ')})`;
                case 'not_in':
                    return `${this._formatExpr(expr.field)} NOT IN (${expr.values.map(v => this._formatValue(v)).join(', ')})`;
                case 'in_subquery':
                    return `${this._formatExpr(expr.field)} IN (${this.compile(expr.subquery)})`;
                case 'not_in_subquery':
                    return `${this._formatExpr(expr.field)} NOT IN (${this.compile(expr.subquery)})`;

                case 'between':
                    return `${this._formatExpr(expr.field)} BETWEEN ${this._formatValue(expr.low)} AND ${this._formatValue(expr.high)}`;

                case 'is_null':
                    return `${this._formatExpr(expr.field)} IS NULL`;
                case 'is_not_null':
                    return `${this._formatExpr(expr.field)} IS NOT NULL`;

                case 'and':
                    return `(${expr.conditions.map(c => this._formatExpr(c)).join(' AND ')})`;
                case 'or':
                    return `(${expr.conditions.map(c => this._formatExpr(c)).join(' OR ')})`;
                case 'not':
                    return `NOT (${this._formatExpr(expr.condition)})`;

                case 'add':
                    return `(${this._formatExpr(expr.left)} + ${this._formatExpr(expr.right)})`;
                case 'sub':
                    return `(${this._formatExpr(expr.left)} - ${this._formatExpr(expr.right)})`;
                case 'mul':
                    return `(${this._formatExpr(expr.left)} * ${this._formatExpr(expr.right)})`;
                case 'div':
                    return `(${this._formatExpr(expr.left)} / ${this._formatExpr(expr.right)})`;
                case 'mod':
                    return `(${this._formatExpr(expr.left)} % ${this._formatExpr(expr.right)})`;

                case 'fn':
                    return `${expr.name}(${expr.args.map(a => this._formatExpr(a)).join(', ')})`;

                case 'agg':
                    const field = expr.field === '*' ? '*' : this._formatExpr(expr.field);
                    return `${expr.fn}(${field})`;

                default:
                    return String(expr);
            }
        }

        /**
         * Format a value for SQL
         */
        _formatValue(value) {
            if (value === null || value === undefined) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (typeof value === 'boolean') return value ? this.dialectConfig.booleanTrue : this.dialectConfig.booleanFalse;
            if (value instanceof Date) return `'${value.toISOString()}'`;
            if (Array.isArray(value)) return `(${value.map(v => this._formatValue(v)).join(', ')})`;
            return String(value);
        }

        /**
         * Quote an identifier (table/column name)
         */
        _quoteIdentifier(name) {
            // Simple implementation - could be dialect-specific
            if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
                return name;
            }
            return `"${name.replace(/"/g, '""')}"`;
        }

        /**
         * Change dialect
         */
        setDialect(dialect) {
            this.dialect = dialect;
            this.dialectConfig = SQL_DIALECTS[dialect] || SQL_DIALECTS.postgresql;
            return this;
        }

        /**
         * Get available dialects
         */
        static getDialects() {
            return Object.keys(SQL_DIALECTS);
        }
    }

    // ============================================================================
    // CONVENIENCE FUNCTIONS
    // ============================================================================

    /**
     * Compile EOQL to SQL (convenience function)
     */
    function toSQL(query, dialect = 'postgresql') {
        const compiler = new EOQueryCompiler(dialect);
        return compiler.compile(query);
    }

    /**
     * Compile EOQL to PostgreSQL
     */
    function toPostgres(query) {
        return toSQL(query, 'postgresql');
    }

    /**
     * Compile EOQL to MySQL
     */
    function toMySQL(query) {
        return toSQL(query, 'mysql');
    }

    /**
     * Compile EOQL to SQLite
     */
    function toSQLite(query) {
        return toSQL(query, 'sqlite');
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const exports = {
        EOQueryCompiler,
        SQL_DIALECTS,
        toSQL,
        toPostgres,
        toMySQL,
        toSQLite
    };

    // Export to global scope
    global.EOQueryCompiler = EOQueryCompiler;
    global.toSQL = toSQL;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }

})(typeof window !== 'undefined' ? window : global);
