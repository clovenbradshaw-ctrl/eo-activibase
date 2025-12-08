/**
 * EO Query Language (EOQL)
 * Native query language based on the 9 EO operators
 *
 * @eo_operator SYN
 * @eo_layer foundation
 *
 * EOQL is a universal query representation that can be:
 * - Written directly in EOQL syntax
 * - Parsed from SQL or other query languages
 * - Compiled to SQL, MongoDB, Pandas, etc.
 *
 * Architecture:
 * - Primitives: The 9 EO operators (NUL, DES, INS, SEG, CON, ALT, SYN, SUP, REC)
 * - Holons: Named compositions of primitives (WHERE, JOIN, SUM, etc.)
 * - Expressions: Predicates and value computations
 */

(function(global) {
    'use strict';

    // ============================================================================
    // PRIMITIVE OPERATOR DEFINITIONS
    // ============================================================================

    /**
     * The 9 EO Operators with their formal signatures
     */
    const EO_OPERATORS = {
        /**
         * NUL - Handle absence/null
         * Deals with missing values, defaults, null propagation
         */
        NUL: {
            name: 'NUL',
            description: 'Handle absence and null values',
            params: {
                field: 'string?',           // Field to check
                default: 'any?',            // Default value if null
                nullIf: 'any?',             // Set to null if equals this
                propagate: 'boolean?'       // Propagate nulls through operations
            },
            sql: ['IS NULL', 'IS NOT NULL', 'COALESCE', 'NULLIF', 'IFNULL']
        },

        /**
         * DES - Designate/name/classify
         * Assigns identity, type, aliases, classifications
         */
        DES: {
            name: 'DES',
            description: 'Designate identity, name, or classify',
            params: {
                columns: 'Array<string|Object>?',  // Columns to select/alias
                alias: 'Object?',                   // Rename mappings
                cast: 'Object?',                    // Type casts
                classify: 'Function?'               // Classification function
            },
            sql: ['SELECT', 'AS', 'CAST', 'CONVERT', 'CASE WHEN']
        },

        /**
         * INS - Instantiate/create
         * Creates new entities, sources data
         */
        INS: {
            name: 'INS',
            description: 'Instantiate source or create new entities',
            params: {
                source: 'string|Query',     // Table name or subquery
                values: 'Array?',           // Values for INSERT
                schema: 'Object?'           // Schema definition
            },
            sql: ['FROM', 'INSERT INTO', 'VALUES', 'CREATE']
        },

        /**
         * SEG - Segment/filter/partition
         * Filters rows, groups data, bounds results
         */
        SEG: {
            name: 'SEG',
            description: 'Segment, filter, or partition data',
            params: {
                where: 'Condition?',        // Row filter
                groupBy: 'Array<string>?',  // Group by fields
                having: 'Condition?',       // Group filter
                limit: 'number?',           // Max rows
                offset: 'number?',          // Skip rows
                distinct: 'boolean|Array?'  // Unique values
            },
            sql: ['WHERE', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT']
        },

        /**
         * CON - Connect/relate
         * Joins tables, establishes relationships
         */
        CON: {
            name: 'CON',
            description: 'Connect and relate data sets',
            params: {
                target: 'string|Query',     // Table/query to join
                on: 'Condition',            // Join condition
                type: 'string?',            // inner|left|right|full|cross
                using: 'Array<string>?'     // USING columns
            },
            sql: ['JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'UNION', 'INTERSECT', 'EXCEPT']
        },

        /**
         * ALT - Alternate/branch/sequence
         * Conditional logic, ordering, state transitions
         */
        ALT: {
            name: 'ALT',
            description: 'Alternate branches, sequence, or order',
            params: {
                orderBy: 'Array<OrderSpec>?',   // Sort specification
                case: 'CaseSpec?',              // CASE expression
                coalesce: 'Array?',             // First non-null
                nullsFirst: 'boolean?'          // NULL ordering
            },
            sql: ['ORDER BY', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'COALESCE', 'NULLS FIRST', 'NULLS LAST']
        },

        /**
         * SYN - Synthesize/aggregate
         * Combines, aggregates, reduces multiple values
         */
        SYN: {
            name: 'SYN',
            description: 'Synthesize and aggregate values',
            params: {
                aggregations: 'Object?',    // { alias: { fn, field } }
                combine: 'Function?',       // Custom combine function
                mode: 'string?'             // sum|avg|count|min|max|concat|etc
            },
            sql: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'STRING_AGG', 'ARRAY_AGG', 'GROUP_CONCAT']
        },

        /**
         * SUP - Superpose/layer contexts
         * Window functions, CTEs, nested contexts
         */
        SUP: {
            name: 'SUP',
            description: 'Superpose multiple contexts or layers',
            params: {
                window: 'WindowSpec?',      // Window function spec
                partitionBy: 'Array?',      // Partition columns
                cte: 'Object?',             // Common Table Expression
                subquery: 'Query?'          // Nested query
            },
            sql: ['OVER', 'PARTITION BY', 'WITH', 'ROWS BETWEEN', 'RANGE BETWEEN', 'LAG', 'LEAD', 'ROW_NUMBER', 'RANK']
        },

        /**
         * REC - Recurse/iterate
         * Recursive queries, fixed-point iteration
         */
        REC: {
            name: 'REC',
            description: 'Recurse or iterate until condition',
            params: {
                anchor: 'Query',            // Base case query
                recursive: 'Query',         // Recursive step
                maxDepth: 'number?',        // Iteration limit
                until: 'Condition?'         // Stop condition
            },
            sql: ['WITH RECURSIVE', 'CONNECT BY', 'START WITH']
        }
    };

    // ============================================================================
    // EXPRESSION LANGUAGE
    // ============================================================================

    /**
     * Expression types for predicates and values
     */
    const ExpressionTypes = {
        // Literals
        LITERAL: 'literal',
        FIELD: 'field',

        // Comparisons
        EQ: 'eq',
        NE: 'ne',
        GT: 'gt',
        GTE: 'gte',
        LT: 'lt',
        LTE: 'lte',
        LIKE: 'like',
        ILIKE: 'ilike',
        IN: 'in',
        NOT_IN: 'not_in',
        BETWEEN: 'between',
        IS_NULL: 'is_null',
        IS_NOT_NULL: 'is_not_null',

        // Logical
        AND: 'and',
        OR: 'or',
        NOT: 'not',

        // Arithmetic
        ADD: 'add',
        SUB: 'sub',
        MUL: 'mul',
        DIV: 'div',
        MOD: 'mod',

        // Functions
        FN: 'fn',

        // Aggregate
        AGG: 'agg'
    };

    /**
     * Expression builder
     */
    const Expr = {
        // Field reference
        field: (name) => ({ type: ExpressionTypes.FIELD, name }),

        // Literal value
        literal: (value) => ({ type: ExpressionTypes.LITERAL, value }),

        // Comparisons
        eq: (left, right) => ({ type: ExpressionTypes.EQ, left: normalize(left), right: normalize(right) }),
        ne: (left, right) => ({ type: ExpressionTypes.NE, left: normalize(left), right: normalize(right) }),
        gt: (left, right) => ({ type: ExpressionTypes.GT, left: normalize(left), right: normalize(right) }),
        gte: (left, right) => ({ type: ExpressionTypes.GTE, left: normalize(left), right: normalize(right) }),
        lt: (left, right) => ({ type: ExpressionTypes.LT, left: normalize(left), right: normalize(right) }),
        lte: (left, right) => ({ type: ExpressionTypes.LTE, left: normalize(left), right: normalize(right) }),
        like: (field, pattern) => ({ type: ExpressionTypes.LIKE, field: normalize(field), pattern }),
        ilike: (field, pattern) => ({ type: ExpressionTypes.ILIKE, field: normalize(field), pattern }),
        in: (field, values) => ({ type: ExpressionTypes.IN, field: normalize(field), values }),
        notIn: (field, values) => ({ type: ExpressionTypes.NOT_IN, field: normalize(field), values }),
        between: (field, low, high) => ({ type: ExpressionTypes.BETWEEN, field: normalize(field), low, high }),
        isNull: (field) => ({ type: ExpressionTypes.IS_NULL, field: normalize(field) }),
        isNotNull: (field) => ({ type: ExpressionTypes.IS_NOT_NULL, field: normalize(field) }),

        // Logical
        and: (...conditions) => ({ type: ExpressionTypes.AND, conditions }),
        or: (...conditions) => ({ type: ExpressionTypes.OR, conditions }),
        not: (condition) => ({ type: ExpressionTypes.NOT, condition }),

        // Arithmetic
        add: (left, right) => ({ type: ExpressionTypes.ADD, left: normalize(left), right: normalize(right) }),
        sub: (left, right) => ({ type: ExpressionTypes.SUB, left: normalize(left), right: normalize(right) }),
        mul: (left, right) => ({ type: ExpressionTypes.MUL, left: normalize(left), right: normalize(right) }),
        div: (left, right) => ({ type: ExpressionTypes.DIV, left: normalize(left), right: normalize(right) }),
        mod: (left, right) => ({ type: ExpressionTypes.MOD, left: normalize(left), right: normalize(right) }),

        // Function call
        fn: (name, ...args) => ({ type: ExpressionTypes.FN, name, args: args.map(normalize) }),

        // Aggregates
        sum: (field) => ({ type: ExpressionTypes.AGG, fn: 'SUM', field: normalize(field) }),
        avg: (field) => ({ type: ExpressionTypes.AGG, fn: 'AVG', field: normalize(field) }),
        count: (field = '*') => ({ type: ExpressionTypes.AGG, fn: 'COUNT', field: field === '*' ? '*' : normalize(field) }),
        min: (field) => ({ type: ExpressionTypes.AGG, fn: 'MIN', field: normalize(field) }),
        max: (field) => ({ type: ExpressionTypes.AGG, fn: 'MAX', field: normalize(field) })
    };

    /**
     * Normalize expression input (string -> field reference, else keep as is)
     */
    function normalize(expr) {
        if (typeof expr === 'string') return Expr.field(expr);
        if (typeof expr === 'number' || typeof expr === 'boolean') return Expr.literal(expr);
        return expr;
    }

    // ============================================================================
    // HOLONS - Named operator compositions
    // ============================================================================

    /**
     * Built-in holons (SQL-like shortcuts)
     */
    const Holons = {
        // Source
        FROM: (source) => ['INS', { source }],

        // Selection
        SELECT: (...columns) => ['DES', { columns }],
        SELECT_AS: (mappings) => ['DES', { alias: mappings }],

        // Filtering
        WHERE: (condition) => ['SEG', { where: condition }],
        HAVING: (condition) => ['SEG', { having: condition }],

        // Grouping
        GROUP_BY: (...fields) => ['SEG', { groupBy: fields }],

        // Limiting
        LIMIT: (n) => ['SEG', { limit: n }],
        OFFSET: (n) => ['SEG', { offset: n }],
        DISTINCT: (...fields) => ['SEG', { distinct: fields.length ? fields : true }],

        // Joins
        JOIN: (target, on) => ['CON', { target, on, type: 'inner' }],
        INNER_JOIN: (target, on) => ['CON', { target, on, type: 'inner' }],
        LEFT_JOIN: (target, on) => ['CON', { target, on, type: 'left' }],
        RIGHT_JOIN: (target, on) => ['CON', { target, on, type: 'right' }],
        FULL_JOIN: (target, on) => ['CON', { target, on, type: 'full' }],
        CROSS_JOIN: (target) => ['CON', { target, type: 'cross' }],

        // Set operations
        UNION: (query) => ['CON', { target: query, type: 'union' }],
        UNION_ALL: (query) => ['CON', { target: query, type: 'union_all' }],
        INTERSECT: (query) => ['CON', { target: query, type: 'intersect' }],
        EXCEPT: (query) => ['CON', { target: query, type: 'except' }],

        // Ordering
        ORDER_BY: (...specs) => ['ALT', { orderBy: specs.map(s =>
            typeof s === 'string' ? { field: s, direction: 'asc' } : s
        )}],
        ORDER_BY_DESC: (...fields) => ['ALT', { orderBy: fields.map(f => ({ field: f, direction: 'desc' })) }],

        // Null handling
        COALESCE: (...fields) => ['NUL', { coalesce: fields }],
        NULLIF: (field, value) => ['NUL', { field, nullIf: value }],
        DEFAULT: (field, defaultValue) => ['NUL', { field, default: defaultValue }],

        // Aggregations
        SUM: (field, alias) => ['SYN', { aggregations: { [alias || 'sum']: { fn: 'SUM', field } } }],
        AVG: (field, alias) => ['SYN', { aggregations: { [alias || 'avg']: { fn: 'AVG', field } } }],
        COUNT: (field = '*', alias) => ['SYN', { aggregations: { [alias || 'count']: { fn: 'COUNT', field } } }],
        MIN: (field, alias) => ['SYN', { aggregations: { [alias || 'min']: { fn: 'MIN', field } } }],
        MAX: (field, alias) => ['SYN', { aggregations: { [alias || 'max']: { fn: 'MAX', field } } }],

        // Window functions
        WINDOW: (fn, opts) => ['SUP', { window: { fn, ...opts } }],
        ROW_NUMBER: (opts) => ['SUP', { window: { fn: 'ROW_NUMBER', ...opts } }],
        RANK: (opts) => ['SUP', { window: { fn: 'RANK', ...opts } }],
        LAG: (field, offset = 1, opts = {}) => ['SUP', { window: { fn: 'LAG', field, offset, ...opts } }],
        LEAD: (field, offset = 1, opts = {}) => ['SUP', { window: { fn: 'LEAD', field, offset, ...opts } }],

        // CTEs
        WITH: (name, query) => ['SUP', { cte: { [name]: query } }],

        // Recursion
        RECURSIVE: (anchor, recursive, opts = {}) => ['REC', { anchor, recursive, ...opts }]
    };

    // ============================================================================
    // QUERY AST
    // ============================================================================

    /**
     * Query AST node types
     */
    const NodeTypes = {
        QUERY: 'query',
        OPERATOR: 'operator',
        EXPRESSION: 'expression',
        HOLON: 'holon'
    };

    /**
     * EOQuery - Query builder and AST container
     */
    class EOQuery {
        constructor() {
            this._pipeline = [];
            this._ctes = {};
            this._metadata = {
                createdAt: Date.now(),
                id: global.EOIdentity?.generate('query') || `query_${Date.now()}`
            };
        }

        /**
         * Add a primitive operator to the pipeline
         */
        _addOp(operator, params) {
            this._pipeline.push({
                type: NodeTypes.OPERATOR,
                operator,
                params,
                position: this._pipeline.length
            });
            return this;
        }

        /**
         * Add a holon (expands to primitives)
         */
        _addHolon(name, args) {
            const holon = Holons[name];
            if (!holon) {
                throw new Error(`Unknown holon: ${name}`);
            }
            const expanded = typeof holon === 'function' ? holon(...args) : holon;
            const [operator, params] = expanded;
            return this._addOp(operator, params);
        }

        // Source
        from(source) { return this._addHolon('FROM', [source]); }

        // Selection
        select(...columns) { return this._addHolon('SELECT', columns); }
        selectAs(mappings) { return this._addHolon('SELECT_AS', [mappings]); }

        // Filtering
        where(condition) { return this._addHolon('WHERE', [condition]); }
        having(condition) { return this._addHolon('HAVING', [condition]); }

        // Grouping
        groupBy(...fields) { return this._addHolon('GROUP_BY', fields); }

        // Limiting
        limit(n) { return this._addHolon('LIMIT', [n]); }
        offset(n) { return this._addHolon('OFFSET', [n]); }
        distinct(...fields) { return this._addHolon('DISTINCT', fields); }

        // Joins
        join(target, on) { return this._addHolon('JOIN', [target, on]); }
        innerJoin(target, on) { return this._addHolon('INNER_JOIN', [target, on]); }
        leftJoin(target, on) { return this._addHolon('LEFT_JOIN', [target, on]); }
        rightJoin(target, on) { return this._addHolon('RIGHT_JOIN', [target, on]); }
        fullJoin(target, on) { return this._addHolon('FULL_JOIN', [target, on]); }
        crossJoin(target) { return this._addHolon('CROSS_JOIN', [target]); }

        // Set operations
        union(query) { return this._addHolon('UNION', [query]); }
        unionAll(query) { return this._addHolon('UNION_ALL', [query]); }
        intersect(query) { return this._addHolon('INTERSECT', [query]); }
        except(query) { return this._addHolon('EXCEPT', [query]); }

        // Ordering
        orderBy(...specs) { return this._addHolon('ORDER_BY', specs); }
        orderByDesc(...fields) { return this._addHolon('ORDER_BY_DESC', fields); }

        // Null handling
        coalesce(...fields) { return this._addHolon('COALESCE', fields); }
        nullif(field, value) { return this._addHolon('NULLIF', [field, value]); }
        default(field, defaultValue) { return this._addHolon('DEFAULT', [field, defaultValue]); }

        // Aggregations (for use with groupBy)
        sum(field, alias) { return this._addHolon('SUM', [field, alias]); }
        avg(field, alias) { return this._addHolon('AVG', [field, alias]); }
        count(field, alias) { return this._addHolon('COUNT', [field, alias]); }
        min(field, alias) { return this._addHolon('MIN', [field, alias]); }
        max(field, alias) { return this._addHolon('MAX', [field, alias]); }

        // Window functions
        rowNumber(opts) { return this._addHolon('ROW_NUMBER', [opts]); }
        rank(opts) { return this._addHolon('RANK', [opts]); }
        lag(field, offset, opts) { return this._addHolon('LAG', [field, offset, opts]); }
        lead(field, offset, opts) { return this._addHolon('LEAD', [field, offset, opts]); }

        // CTEs
        with(name, query) {
            this._ctes[name] = query;
            return this._addHolon('WITH', [name, query]);
        }

        // Recursion
        recursive(anchor, recursive, opts) { return this._addHolon('RECURSIVE', [anchor, recursive, opts]); }

        // Raw primitive access
        nul(params) { return this._addOp('NUL', params); }
        des(params) { return this._addOp('DES', params); }
        ins(params) { return this._addOp('INS', params); }
        seg(params) { return this._addOp('SEG', params); }
        con(params) { return this._addOp('CON', params); }
        alt(params) { return this._addOp('ALT', params); }
        syn(params) { return this._addOp('SYN', params); }
        sup(params) { return this._addOp('SUP', params); }
        rec(params) { return this._addOp('REC', params); }

        /**
         * Get the AST
         */
        toAST() {
            return {
                type: NodeTypes.QUERY,
                id: this._metadata.id,
                pipeline: this._pipeline,
                ctes: this._ctes,
                metadata: this._metadata
            };
        }

        /**
         * Get the pipeline
         */
        getPipeline() {
            return [...this._pipeline];
        }

        /**
         * Clone the query
         */
        clone() {
            const cloned = new EOQuery();
            cloned._pipeline = JSON.parse(JSON.stringify(this._pipeline));
            cloned._ctes = JSON.parse(JSON.stringify(this._ctes));
            return cloned;
        }

        /**
         * Validate the query
         */
        validate() {
            const errors = [];

            // Must have at least INS (source)
            const hasSource = this._pipeline.some(n => n.operator === 'INS');
            if (!hasSource) {
                errors.push({ code: 'NO_SOURCE', message: 'Query must have a source (FROM clause)' });
            }

            // SEG(having) must follow SEG(groupBy)
            let hasGroupBy = false;
            for (const node of this._pipeline) {
                if (node.operator === 'SEG' && node.params.groupBy) {
                    hasGroupBy = true;
                }
                if (node.operator === 'SEG' && node.params.having && !hasGroupBy) {
                    errors.push({ code: 'HAVING_WITHOUT_GROUP', message: 'HAVING requires GROUP BY' });
                }
            }

            return {
                valid: errors.length === 0,
                errors
            };
        }
    }

    // ============================================================================
    // HOLON REGISTRY (User-extensible)
    // ============================================================================

    /**
     * HolonRegistry - Allows users to define custom holons
     */
    class HolonRegistry {
        constructor() {
            this._holons = { ...Holons };
            this._userHolons = {};
        }

        /**
         * Register a custom holon
         * @param {string} name - Holon name
         * @param {Function|Array} definition - Holon definition
         * @param {Object} metadata - Optional metadata
         */
        register(name, definition, metadata = {}) {
            // Validate that holon produces valid operators
            const testResult = typeof definition === 'function' ? definition() : definition;
            const [operator] = testResult;

            if (!EO_OPERATORS[operator]) {
                throw new Error(`Invalid holon: produces unknown operator '${operator}'`);
            }

            this._userHolons[name] = {
                definition,
                metadata: {
                    createdAt: Date.now(),
                    description: metadata.description || '',
                    author: metadata.author || 'user',
                    ...metadata
                }
            };

            // Also add to active holons
            this._holons[name] = definition;

            return this;
        }

        /**
         * Get a holon by name
         */
        get(name) {
            return this._holons[name];
        }

        /**
         * Get all holons
         */
        getAll() {
            return { ...this._holons };
        }

        /**
         * Get user-defined holons
         */
        getUserHolons() {
            return { ...this._userHolons };
        }

        /**
         * Remove a user-defined holon
         */
        unregister(name) {
            if (Holons[name]) {
                throw new Error(`Cannot unregister built-in holon: ${name}`);
            }
            delete this._holons[name];
            delete this._userHolons[name];
            return this;
        }

        /**
         * Export holons to JSON
         */
        export() {
            const exportable = {};
            for (const [name, holon] of Object.entries(this._userHolons)) {
                exportable[name] = {
                    // For functions, we store as string representation
                    definition: typeof holon.definition === 'function'
                        ? holon.definition.toString()
                        : holon.definition,
                    metadata: holon.metadata
                };
            }
            return exportable;
        }

        /**
         * Import holons from JSON
         */
        import(data) {
            for (const [name, holon] of Object.entries(data)) {
                let definition = holon.definition;
                // If stored as string, evaluate (with caution in production!)
                if (typeof definition === 'string' && definition.startsWith('(')) {
                    // Only allow safe function patterns
                    if (this._isSafeHolonDefinition(definition)) {
                        definition = eval(definition);
                    } else {
                        console.warn(`Skipping unsafe holon definition: ${name}`);
                        continue;
                    }
                }
                this.register(name, definition, holon.metadata);
            }
            return this;
        }

        /**
         * Check if holon definition is safe
         */
        _isSafeHolonDefinition(str) {
            // Only allow array returns with known operators
            const dangerousPatterns = [
                /eval\s*\(/,
                /Function\s*\(/,
                /require\s*\(/,
                /import\s*\(/,
                /process\./,
                /global\./,
                /__proto__/,
                /constructor\s*\[/
            ];
            return !dangerousPatterns.some(p => p.test(str));
        }
    }

    // ============================================================================
    // FACTORY AND EXPORTS
    // ============================================================================

    /**
     * Create a new query
     */
    function createQuery() {
        return new EOQuery();
    }

    /**
     * Shorthand: EOQL.from('table').where(...).select(...)
     */
    const EOQL = {
        // Query factory
        from: (source) => createQuery().from(source),
        query: createQuery,

        // Expression builder
        expr: Expr,
        Expr,

        // Operators reference
        operators: EO_OPERATORS,

        // Holons
        holons: Holons,

        // Registry (singleton)
        registry: new HolonRegistry(),

        // Node types
        NodeTypes,

        // Expression types
        ExpressionTypes,

        // Classes for extension
        EOQuery,
        HolonRegistry
    };

    // Export to global scope
    global.EOQL = EOQL;
    global.EOQuery = EOQuery;
    global.EOExpr = Expr;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { EOQL, EOQuery, Expr, EO_OPERATORS, Holons, HolonRegistry };
    }

})(typeof window !== 'undefined' ? window : global);
