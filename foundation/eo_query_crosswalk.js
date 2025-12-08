/**
 * EO Query Crosswalk
 * Bidirectional mapping dictionary between EOQL and SQL (and other languages)
 *
 * @eo_operator CON
 * @eo_layer foundation
 *
 * The crosswalk defines how to translate between:
 * - EOQL (9 EO operators + expressions)
 * - SQL (PostgreSQL, MySQL, SQLite, etc.)
 * - Future: MongoDB, Pandas, GraphQL, etc.
 *
 * Users can extend the crosswalk with custom mappings as long as
 * they don't violate EOQL grammar.
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CODD'S RELATIONAL ALGEBRA → EO OPERATOR MAPPINGS
    // ============================================================================

    /**
     * Canonical decomposition of relational algebra operations into EO operators
     * Based on the analysis: every operation maps to a combination of primitives
     */
    const RELATIONAL_ALGEBRA_MAPPINGS = {
        // Selection (σ) - filter rows
        SELECTION: {
            eo: ['INS', 'SEG', 'DES'],
            required: ['SEG'],
            latent: ['NUL', 'ALT', 'CON'],  // May appear in complex predicates
            description: 'Filter rows based on predicate',
            sql: 'WHERE'
        },

        // Projection (π) - select columns
        PROJECTION: {
            eo: ['INS', 'SEG', 'DES'],
            required: ['SEG', 'DES'],
            latent: [],
            description: 'Extract column subset',
            sql: 'SELECT columns'
        },

        // Rename (ρ) - alias
        RENAME: {
            eo: ['INS', 'DES'],
            required: ['DES'],
            latent: [],
            description: 'Assign new identity/alias',
            sql: 'AS'
        },

        // Cartesian Product (×)
        CARTESIAN_PRODUCT: {
            eo: ['INS', 'CON', 'SYN', 'SUP'],
            required: ['CON', 'SYN'],
            latent: ['SUP'],
            description: 'Combine all row pairs',
            sql: 'CROSS JOIN'
        },

        // Union (∪)
        UNION: {
            eo: ['INS', 'SYN', 'SEG', 'DES', 'NUL'],
            required: ['SYN'],
            latent: ['SEG', 'NUL'],  // For DISTINCT and NULL handling
            description: 'Combine row sets',
            sql: 'UNION'
        },

        // Intersection (∩)
        INTERSECTION: {
            eo: ['INS', 'CON', 'SEG', 'DES', 'SYN', 'NUL'],
            required: ['CON', 'SEG'],
            latent: ['NUL'],
            description: 'Rows in both sets',
            sql: 'INTERSECT'
        },

        // Difference (−)
        DIFFERENCE: {
            eo: ['INS', 'CON', 'SEG', 'DES', 'NUL'],
            required: ['CON', 'NUL', 'SEG'],
            latent: [],
            description: 'Rows in A not in B',
            sql: 'EXCEPT'
        },

        // Join (⨝)
        JOIN: {
            eo: ['INS', 'CON', 'SEG', 'DES', 'SYN', 'SUP'],
            required: ['CON', 'SYN'],
            latent: ['SUP'],  // Two table contexts
            description: 'Combine related rows',
            sql: 'JOIN'
        },

        // Outer Join
        OUTER_JOIN: {
            eo: ['INS', 'CON', 'SEG', 'DES', 'SYN', 'SUP', 'NUL', 'ALT'],
            required: ['CON', 'SYN', 'NUL', 'ALT'],
            latent: ['SUP'],
            description: 'Join preserving unmatched rows',
            sql: 'LEFT/RIGHT/FULL JOIN'
        },

        // Division (÷)
        DIVISION: {
            eo: ['INS', 'REC', 'CON', 'SEG', 'DES', 'SYN', 'NUL'],
            required: ['REC', 'CON', 'SEG'],
            latent: ['NUL'],
            description: 'Universal quantification',
            sql: 'NOT EXISTS (EXCEPT)'
        },

        // Grouping (γ)
        GROUPING: {
            eo: ['INS', 'SEG', 'DES', 'SUP', 'SYN', 'NUL'],
            required: ['SEG', 'SUP'],
            latent: ['NUL'],  // NULL group key handling
            description: 'Partition by group keys',
            sql: 'GROUP BY'
        },

        // Aggregation
        AGGREGATION: {
            eo: ['INS', 'SEG', 'SYN', 'NUL', 'DES'],
            required: ['SYN'],
            latent: ['SEG', 'NUL'],
            description: 'Reduce to single value',
            sql: 'SUM, COUNT, AVG, etc.'
        }
    };

    // ============================================================================
    // SQL → EOQL CROSSWALK
    // ============================================================================

    /**
     * SQL keywords/clauses mapped to EO operators
     */
    const SQL_TO_EOQL = {
        // Data source
        'FROM': {
            operator: 'INS',
            params: (tokens) => ({ source: tokens.table }),
            description: 'Source table or subquery'
        },
        'INSERT INTO': {
            operator: 'INS',
            params: (tokens) => ({ source: tokens.table, values: tokens.values }),
            description: 'Insert new rows'
        },
        'VALUES': {
            operator: 'INS',
            params: (tokens) => ({ values: tokens.values }),
            description: 'Literal values'
        },

        // Column selection
        'SELECT': {
            operator: 'DES',
            params: (tokens) => ({ columns: tokens.columns }),
            description: 'Select/project columns'
        },
        'AS': {
            operator: 'DES',
            params: (tokens) => ({ alias: { [tokens.original]: tokens.alias } }),
            description: 'Alias/rename'
        },
        'CAST': {
            operator: 'DES',
            params: (tokens) => ({ cast: { [tokens.field]: tokens.type } }),
            description: 'Type conversion'
        },
        'DISTINCT': {
            operator: 'SEG',
            params: (tokens) => ({ distinct: tokens.columns || true }),
            description: 'Unique values'
        },

        // Filtering
        'WHERE': {
            operator: 'SEG',
            params: (tokens) => ({ where: tokens.condition }),
            description: 'Filter rows'
        },
        'HAVING': {
            operator: 'SEG',
            params: (tokens) => ({ having: tokens.condition }),
            description: 'Filter groups'
        },
        'LIMIT': {
            operator: 'SEG',
            params: (tokens) => ({ limit: tokens.count }),
            description: 'Limit rows'
        },
        'OFFSET': {
            operator: 'SEG',
            params: (tokens) => ({ offset: tokens.count }),
            description: 'Skip rows'
        },

        // Grouping
        'GROUP BY': {
            operator: 'SEG',
            params: (tokens) => ({ groupBy: tokens.columns }),
            description: 'Group rows'
        },

        // Joins
        'JOIN': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.table, on: tokens.condition, type: 'inner' }),
            description: 'Inner join'
        },
        'INNER JOIN': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.table, on: tokens.condition, type: 'inner' }),
            description: 'Inner join'
        },
        'LEFT JOIN': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.table, on: tokens.condition, type: 'left' }),
            description: 'Left outer join'
        },
        'LEFT OUTER JOIN': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.table, on: tokens.condition, type: 'left' }),
            description: 'Left outer join'
        },
        'RIGHT JOIN': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.table, on: tokens.condition, type: 'right' }),
            description: 'Right outer join'
        },
        'RIGHT OUTER JOIN': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.table, on: tokens.condition, type: 'right' }),
            description: 'Right outer join'
        },
        'FULL JOIN': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.table, on: tokens.condition, type: 'full' }),
            description: 'Full outer join'
        },
        'FULL OUTER JOIN': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.table, on: tokens.condition, type: 'full' }),
            description: 'Full outer join'
        },
        'CROSS JOIN': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.table, type: 'cross' }),
            description: 'Cross join'
        },

        // Set operations
        'UNION': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.query, type: 'union' }),
            description: 'Union (distinct)'
        },
        'UNION ALL': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.query, type: 'union_all' }),
            description: 'Union (all)'
        },
        'INTERSECT': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.query, type: 'intersect' }),
            description: 'Intersection'
        },
        'EXCEPT': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.query, type: 'except' }),
            description: 'Difference'
        },
        'MINUS': {
            operator: 'CON',
            params: (tokens) => ({ target: tokens.query, type: 'except' }),
            description: 'Difference (Oracle)'
        },

        // Ordering
        'ORDER BY': {
            operator: 'ALT',
            params: (tokens) => ({ orderBy: tokens.specs }),
            description: 'Sort results'
        },

        // Null handling
        'IS NULL': {
            operator: 'NUL',
            params: (tokens) => ({ field: tokens.field, check: 'null' }),
            description: 'Check for null'
        },
        'IS NOT NULL': {
            operator: 'NUL',
            params: (tokens) => ({ field: tokens.field, check: 'not_null' }),
            description: 'Check for not null'
        },
        'COALESCE': {
            operator: 'NUL',
            params: (tokens) => ({ coalesce: tokens.fields }),
            description: 'First non-null'
        },
        'IFNULL': {
            operator: 'NUL',
            params: (tokens) => ({ field: tokens.field, default: tokens.default }),
            description: 'Default if null (MySQL)'
        },
        'ISNULL': {
            operator: 'NUL',
            params: (tokens) => ({ field: tokens.field, default: tokens.default }),
            description: 'Default if null (SQL Server)'
        },
        'NVL': {
            operator: 'NUL',
            params: (tokens) => ({ field: tokens.field, default: tokens.default }),
            description: 'Default if null (Oracle)'
        },
        'NULLIF': {
            operator: 'NUL',
            params: (tokens) => ({ field: tokens.field, nullIf: tokens.value }),
            description: 'Null if equals'
        },

        // Conditionals
        'CASE': {
            operator: 'ALT',
            params: (tokens) => ({ case: tokens.caseSpec }),
            description: 'Conditional expression'
        },
        'CASE WHEN': {
            operator: 'ALT',
            params: (tokens) => ({ case: tokens.caseSpec }),
            description: 'Conditional expression'
        },

        // Aggregations
        'SUM': {
            operator: 'SYN',
            params: (tokens) => ({ aggregations: { [tokens.alias || 'sum']: { fn: 'SUM', field: tokens.field } } }),
            description: 'Sum aggregation'
        },
        'AVG': {
            operator: 'SYN',
            params: (tokens) => ({ aggregations: { [tokens.alias || 'avg']: { fn: 'AVG', field: tokens.field } } }),
            description: 'Average aggregation'
        },
        'COUNT': {
            operator: 'SYN',
            params: (tokens) => ({ aggregations: { [tokens.alias || 'count']: { fn: 'COUNT', field: tokens.field || '*' } } }),
            description: 'Count aggregation'
        },
        'MIN': {
            operator: 'SYN',
            params: (tokens) => ({ aggregations: { [tokens.alias || 'min']: { fn: 'MIN', field: tokens.field } } }),
            description: 'Minimum aggregation'
        },
        'MAX': {
            operator: 'SYN',
            params: (tokens) => ({ aggregations: { [tokens.alias || 'max']: { fn: 'MAX', field: tokens.field } } }),
            description: 'Maximum aggregation'
        },
        'STRING_AGG': {
            operator: 'SYN',
            params: (tokens) => ({ aggregations: { [tokens.alias || 'concat']: { fn: 'STRING_AGG', field: tokens.field, separator: tokens.separator } } }),
            description: 'String concatenation'
        },
        'GROUP_CONCAT': {
            operator: 'SYN',
            params: (tokens) => ({ aggregations: { [tokens.alias || 'concat']: { fn: 'GROUP_CONCAT', field: tokens.field, separator: tokens.separator } } }),
            description: 'String concatenation (MySQL)'
        },
        'ARRAY_AGG': {
            operator: 'SYN',
            params: (tokens) => ({ aggregations: { [tokens.alias || 'array']: { fn: 'ARRAY_AGG', field: tokens.field } } }),
            description: 'Array aggregation'
        },

        // Window functions
        'OVER': {
            operator: 'SUP',
            params: (tokens) => ({ window: tokens.windowSpec }),
            description: 'Window function frame'
        },
        'PARTITION BY': {
            operator: 'SUP',
            params: (tokens) => ({ partitionBy: tokens.columns }),
            description: 'Window partition'
        },
        'ROW_NUMBER': {
            operator: 'SUP',
            params: (tokens) => ({ window: { fn: 'ROW_NUMBER', ...tokens.windowSpec } }),
            description: 'Row number'
        },
        'RANK': {
            operator: 'SUP',
            params: (tokens) => ({ window: { fn: 'RANK', ...tokens.windowSpec } }),
            description: 'Rank'
        },
        'DENSE_RANK': {
            operator: 'SUP',
            params: (tokens) => ({ window: { fn: 'DENSE_RANK', ...tokens.windowSpec } }),
            description: 'Dense rank'
        },
        'LAG': {
            operator: 'SUP',
            params: (tokens) => ({ window: { fn: 'LAG', field: tokens.field, offset: tokens.offset || 1, ...tokens.windowSpec } }),
            description: 'Previous row value'
        },
        'LEAD': {
            operator: 'SUP',
            params: (tokens) => ({ window: { fn: 'LEAD', field: tokens.field, offset: tokens.offset || 1, ...tokens.windowSpec } }),
            description: 'Next row value'
        },
        'FIRST_VALUE': {
            operator: 'SUP',
            params: (tokens) => ({ window: { fn: 'FIRST_VALUE', field: tokens.field, ...tokens.windowSpec } }),
            description: 'First value in window'
        },
        'LAST_VALUE': {
            operator: 'SUP',
            params: (tokens) => ({ window: { fn: 'LAST_VALUE', field: tokens.field, ...tokens.windowSpec } }),
            description: 'Last value in window'
        },
        'NTILE': {
            operator: 'SUP',
            params: (tokens) => ({ window: { fn: 'NTILE', buckets: tokens.buckets, ...tokens.windowSpec } }),
            description: 'N-tile distribution'
        },

        // CTEs
        'WITH': {
            operator: 'SUP',
            params: (tokens) => ({ cte: tokens.ctes }),
            description: 'Common Table Expression'
        },
        'WITH RECURSIVE': {
            operator: 'REC',
            params: (tokens) => ({ anchor: tokens.anchor, recursive: tokens.recursive }),
            description: 'Recursive CTE'
        },

        // Hierarchical (Oracle)
        'CONNECT BY': {
            operator: 'REC',
            params: (tokens) => ({ recursive: tokens.condition }),
            description: 'Hierarchical query (Oracle)'
        },
        'START WITH': {
            operator: 'REC',
            params: (tokens) => ({ anchor: tokens.condition }),
            description: 'Hierarchy start (Oracle)'
        }
    };

    // ============================================================================
    // EOQL → SQL CROSSWALK
    // ============================================================================

    /**
     * EO operators mapped to SQL generation rules
     */
    const EOQL_TO_SQL = {
        INS: {
            toSQL: (params, ctx) => {
                if (params.source) {
                    return { clause: 'FROM', sql: params.source };
                }
                if (params.values) {
                    return { clause: 'VALUES', sql: `(${params.values.map(v => formatValue(v)).join(', ')})` };
                }
                return null;
            }
        },

        DES: {
            toSQL: (params, ctx) => {
                if (params.columns) {
                    const cols = params.columns.map(c => {
                        if (typeof c === 'string') return c;
                        if (typeof c === 'object') {
                            const [alias, expr] = Object.entries(c)[0];
                            return `${formatExpr(expr)} AS ${alias}`;
                        }
                        return '*';
                    });
                    return { clause: 'SELECT', sql: cols.join(', ') };
                }
                if (params.alias) {
                    // Handled inline in SELECT
                    return null;
                }
                return null;
            }
        },

        SEG: {
            toSQL: (params, ctx) => {
                const parts = [];

                if (params.distinct) {
                    ctx.distinct = params.distinct === true ? true : params.distinct;
                }

                if (params.where) {
                    parts.push({ clause: 'WHERE', sql: formatCondition(params.where) });
                }

                if (params.groupBy) {
                    parts.push({ clause: 'GROUP BY', sql: params.groupBy.join(', ') });
                }

                if (params.having) {
                    parts.push({ clause: 'HAVING', sql: formatCondition(params.having) });
                }

                if (params.limit !== undefined) {
                    parts.push({ clause: 'LIMIT', sql: String(params.limit) });
                }

                if (params.offset !== undefined) {
                    parts.push({ clause: 'OFFSET', sql: String(params.offset) });
                }

                return parts;
            }
        },

        CON: {
            toSQL: (params, ctx) => {
                const { target, on, type = 'inner', using } = params;

                // Set operations
                if (['union', 'union_all', 'intersect', 'except'].includes(type)) {
                    const op = type.toUpperCase().replace('_', ' ');
                    const subquery = target instanceof Object ? `(${compileQuery(target)})` : target;
                    return { clause: 'SET_OP', sql: `${op} ${subquery}` };
                }

                // Joins
                const joinType = {
                    'inner': 'JOIN',
                    'left': 'LEFT JOIN',
                    'right': 'RIGHT JOIN',
                    'full': 'FULL JOIN',
                    'cross': 'CROSS JOIN'
                }[type] || 'JOIN';

                let joinSQL = `${joinType} ${target}`;

                if (on) {
                    joinSQL += ` ON ${formatCondition(on)}`;
                }

                if (using) {
                    joinSQL += ` USING (${using.join(', ')})`;
                }

                return { clause: 'JOIN', sql: joinSQL };
            }
        },

        ALT: {
            toSQL: (params, ctx) => {
                const parts = [];

                if (params.orderBy) {
                    const specs = params.orderBy.map(s => {
                        const dir = s.direction === 'desc' ? ' DESC' : '';
                        const nulls = s.nullsFirst ? ' NULLS FIRST' : (s.nullsLast ? ' NULLS LAST' : '');
                        return `${s.field}${dir}${nulls}`;
                    });
                    parts.push({ clause: 'ORDER BY', sql: specs.join(', ') });
                }

                if (params.case) {
                    // CASE expression - returns SQL fragment for inline use
                    const caseSQL = formatCaseExpression(params.case);
                    return { clause: 'EXPRESSION', sql: caseSQL };
                }

                return parts;
            }
        },

        SYN: {
            toSQL: (params, ctx) => {
                if (params.aggregations) {
                    ctx.aggregations = ctx.aggregations || {};
                    Object.assign(ctx.aggregations, params.aggregations);
                }
                return null;  // Aggregations are included in SELECT
            }
        },

        SUP: {
            toSQL: (params, ctx) => {
                if (params.cte) {
                    const ctes = Object.entries(params.cte).map(([name, query]) => {
                        const sql = query instanceof Object ? compileQuery(query) : query;
                        return `${name} AS (${sql})`;
                    });
                    return { clause: 'WITH', sql: ctes.join(', ') };
                }

                if (params.window) {
                    // Window function - returns SQL fragment
                    const { fn, partitionBy, orderBy, frame } = params.window;
                    let overClause = '';

                    if (partitionBy) {
                        overClause += `PARTITION BY ${partitionBy.join(', ')}`;
                    }

                    if (orderBy) {
                        if (overClause) overClause += ' ';
                        overClause += `ORDER BY ${orderBy.map(o =>
                            typeof o === 'string' ? o : `${o.field} ${o.direction || 'ASC'}`
                        ).join(', ')}`;
                    }

                    if (frame) {
                        if (overClause) overClause += ' ';
                        overClause += frame;
                    }

                    return { clause: 'WINDOW', sql: `${fn}() OVER (${overClause})` };
                }

                return null;
            }
        },

        NUL: {
            toSQL: (params, ctx) => {
                if (params.coalesce) {
                    return { clause: 'EXPRESSION', sql: `COALESCE(${params.coalesce.join(', ')})` };
                }

                if (params.default !== undefined) {
                    return { clause: 'EXPRESSION', sql: `COALESCE(${params.field}, ${formatValue(params.default)})` };
                }

                if (params.nullIf !== undefined) {
                    return { clause: 'EXPRESSION', sql: `NULLIF(${params.field}, ${formatValue(params.nullIf)})` };
                }

                if (params.check === 'null') {
                    return { clause: 'CONDITION', sql: `${params.field} IS NULL` };
                }

                if (params.check === 'not_null') {
                    return { clause: 'CONDITION', sql: `${params.field} IS NOT NULL` };
                }

                return null;
            }
        },

        REC: {
            toSQL: (params, ctx) => {
                const { anchor, recursive, maxDepth } = params;

                const anchorSQL = anchor instanceof Object ? compileQuery(anchor) : anchor;
                const recursiveSQL = recursive instanceof Object ? compileQuery(recursive) : recursive;

                return {
                    clause: 'WITH RECURSIVE',
                    sql: `${anchorSQL} UNION ALL ${recursiveSQL}`
                };
            }
        }
    };

    // ============================================================================
    // EXPRESSION → SQL FORMATTERS
    // ============================================================================

    /**
     * Format a condition expression to SQL
     */
    function formatCondition(condition) {
        if (!condition) return '1=1';

        // Simple object conditions: { field: value }
        if (!condition.type) {
            return Object.entries(condition).map(([field, value]) => {
                if (value && typeof value === 'object' && value.$eq !== undefined) {
                    return `${field} = ${formatValue(value.$eq)}`;
                }
                if (value && typeof value === 'object') {
                    return formatComplexCondition(field, value);
                }
                return `${field} = ${formatValue(value)}`;
            }).join(' AND ');
        }

        // Typed expressions from Expr
        return formatExpr(condition);
    }

    /**
     * Format complex condition operators
     */
    function formatComplexCondition(field, condition) {
        const parts = [];

        if (condition.$eq !== undefined) parts.push(`${field} = ${formatValue(condition.$eq)}`);
        if (condition.$ne !== undefined) parts.push(`${field} != ${formatValue(condition.$ne)}`);
        if (condition.$gt !== undefined) parts.push(`${field} > ${formatValue(condition.$gt)}`);
        if (condition.$gte !== undefined) parts.push(`${field} >= ${formatValue(condition.$gte)}`);
        if (condition.$lt !== undefined) parts.push(`${field} < ${formatValue(condition.$lt)}`);
        if (condition.$lte !== undefined) parts.push(`${field} <= ${formatValue(condition.$lte)}`);
        if (condition.$in !== undefined) parts.push(`${field} IN (${condition.$in.map(formatValue).join(', ')})`);
        if (condition.$nin !== undefined) parts.push(`${field} NOT IN (${condition.$nin.map(formatValue).join(', ')})`);
        if (condition.$like !== undefined) parts.push(`${field} LIKE ${formatValue(condition.$like)}`);
        if (condition.$ilike !== undefined) parts.push(`${field} ILIKE ${formatValue(condition.$ilike)}`);

        return parts.join(' AND ');
    }

    /**
     * Format typed expression to SQL
     */
    function formatExpr(expr) {
        if (!expr) return 'NULL';

        switch (expr.type) {
            case 'literal':
                return formatValue(expr.value);

            case 'field':
                return expr.name;

            case 'eq':
                return `${formatExpr(expr.left)} = ${formatExpr(expr.right)}`;
            case 'ne':
                return `${formatExpr(expr.left)} != ${formatExpr(expr.right)}`;
            case 'gt':
                return `${formatExpr(expr.left)} > ${formatExpr(expr.right)}`;
            case 'gte':
                return `${formatExpr(expr.left)} >= ${formatExpr(expr.right)}`;
            case 'lt':
                return `${formatExpr(expr.left)} < ${formatExpr(expr.right)}`;
            case 'lte':
                return `${formatExpr(expr.left)} <= ${formatExpr(expr.right)}`;

            case 'like':
                return `${formatExpr(expr.field)} LIKE ${formatValue(expr.pattern)}`;
            case 'ilike':
                return `${formatExpr(expr.field)} ILIKE ${formatValue(expr.pattern)}`;

            case 'in':
                return `${formatExpr(expr.field)} IN (${expr.values.map(formatValue).join(', ')})`;
            case 'not_in':
                return `${formatExpr(expr.field)} NOT IN (${expr.values.map(formatValue).join(', ')})`;

            case 'between':
                return `${formatExpr(expr.field)} BETWEEN ${formatValue(expr.low)} AND ${formatValue(expr.high)}`;

            case 'is_null':
                return `${formatExpr(expr.field)} IS NULL`;
            case 'is_not_null':
                return `${formatExpr(expr.field)} IS NOT NULL`;

            case 'and':
                return `(${expr.conditions.map(formatExpr).join(' AND ')})`;
            case 'or':
                return `(${expr.conditions.map(formatExpr).join(' OR ')})`;
            case 'not':
                return `NOT (${formatExpr(expr.condition)})`;

            case 'add':
                return `(${formatExpr(expr.left)} + ${formatExpr(expr.right)})`;
            case 'sub':
                return `(${formatExpr(expr.left)} - ${formatExpr(expr.right)})`;
            case 'mul':
                return `(${formatExpr(expr.left)} * ${formatExpr(expr.right)})`;
            case 'div':
                return `(${formatExpr(expr.left)} / ${formatExpr(expr.right)})`;
            case 'mod':
                return `(${formatExpr(expr.left)} % ${formatExpr(expr.right)})`;

            case 'fn':
                return `${expr.name}(${expr.args.map(formatExpr).join(', ')})`;

            case 'agg':
                const field = expr.field === '*' ? '*' : formatExpr(expr.field);
                return `${expr.fn}(${field})`;

            default:
                return String(expr);
        }
    }

    /**
     * Format CASE expression
     */
    function formatCaseExpression(caseSpec) {
        const { when, else: elseValue } = caseSpec;
        let sql = 'CASE';

        for (const { condition, then } of when) {
            sql += ` WHEN ${formatCondition(condition)} THEN ${formatValue(then)}`;
        }

        if (elseValue !== undefined) {
            sql += ` ELSE ${formatValue(elseValue)}`;
        }

        sql += ' END';
        return sql;
    }

    /**
     * Format a value for SQL
     */
    function formatValue(value) {
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        if (value instanceof Date) return `'${value.toISOString()}'`;
        if (Array.isArray(value)) return `(${value.map(formatValue).join(', ')})`;
        return String(value);
    }

    /**
     * Compile a query object to SQL (placeholder for full compiler)
     */
    function compileQuery(query) {
        if (typeof query === 'string') return query;
        // Delegate to full compiler
        if (global.EOQueryCompiler) {
            return global.EOQueryCompiler.toSQL(query);
        }
        return '[SUBQUERY]';
    }

    // ============================================================================
    // CROSSWALK REGISTRY (User-extensible)
    // ============================================================================

    /**
     * CrosswalkRegistry - Allows users to add custom mappings
     */
    class CrosswalkRegistry {
        constructor() {
            this._sqlToEoql = { ...SQL_TO_EOQL };
            this._eoqlToSql = { ...EOQL_TO_SQL };
            this._userMappings = {};
            this._dialects = {
                postgresql: {},
                mysql: {},
                sqlite: {},
                sqlserver: {},
                oracle: {}
            };
        }

        /**
         * Add a SQL → EOQL mapping
         */
        addSqlMapping(keyword, mapping) {
            // Validate mapping
            if (!mapping.operator || !['NUL', 'DES', 'INS', 'SEG', 'CON', 'ALT', 'SYN', 'SUP', 'REC'].includes(mapping.operator)) {
                throw new Error(`Invalid mapping: operator must be a valid EO operator`);
            }

            this._sqlToEoql[keyword.toUpperCase()] = mapping;
            this._userMappings[keyword] = { type: 'sql_to_eoql', mapping, addedAt: Date.now() };

            return this;
        }

        /**
         * Add a dialect-specific mapping
         */
        addDialectMapping(dialect, keyword, sql) {
            if (!this._dialects[dialect]) {
                this._dialects[dialect] = {};
            }
            this._dialects[dialect][keyword] = sql;
            return this;
        }

        /**
         * Get mapping for SQL keyword
         */
        getSqlMapping(keyword) {
            return this._sqlToEoql[keyword.toUpperCase()];
        }

        /**
         * Get all SQL → EOQL mappings
         */
        getAllSqlMappings() {
            return { ...this._sqlToEoql };
        }

        /**
         * Get EOQL → SQL converter for an operator
         */
        getEoqlConverter(operator) {
            return this._eoqlToSql[operator];
        }

        /**
         * Get dialect-specific SQL
         */
        getDialectSQL(dialect, keyword, defaultSQL) {
            return this._dialects[dialect]?.[keyword] || defaultSQL;
        }

        /**
         * Export user mappings
         */
        export() {
            return {
                userMappings: this._userMappings,
                dialects: this._dialects
            };
        }

        /**
         * Import user mappings
         */
        import(data) {
            if (data.userMappings) {
                for (const [keyword, config] of Object.entries(data.userMappings)) {
                    if (config.type === 'sql_to_eoql') {
                        this.addSqlMapping(keyword, config.mapping);
                    }
                }
            }
            if (data.dialects) {
                for (const [dialect, mappings] of Object.entries(data.dialects)) {
                    for (const [keyword, sql] of Object.entries(mappings)) {
                        this.addDialectMapping(dialect, keyword, sql);
                    }
                }
            }
            return this;
        }

        /**
         * Get crosswalk statistics
         */
        getStats() {
            return {
                sqlKeywords: Object.keys(this._sqlToEoql).length,
                eoqlOperators: Object.keys(this._eoqlToSql).length,
                userMappings: Object.keys(this._userMappings).length,
                dialects: Object.keys(this._dialects).filter(d => Object.keys(this._dialects[d]).length > 0)
            };
        }
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOQueryCrosswalk = {
        // Mappings
        RELATIONAL_ALGEBRA: RELATIONAL_ALGEBRA_MAPPINGS,
        SQL_TO_EOQL,
        EOQL_TO_SQL,

        // Formatters
        formatCondition,
        formatExpr,
        formatValue,
        formatCaseExpression,

        // Registry (singleton)
        registry: new CrosswalkRegistry(),

        // Classes
        CrosswalkRegistry
    };

    // Export to global scope
    global.EOQueryCrosswalk = EOQueryCrosswalk;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOQueryCrosswalk;
    }

})(typeof window !== 'undefined' ? window : global);
