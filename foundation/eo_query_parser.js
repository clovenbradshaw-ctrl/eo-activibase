/**
 * EO Query Parser
 * Parses SQL and other query languages into EOQL AST
 *
 * @eo_operator SEG
 * @eo_layer foundation
 *
 * The parser transforms SQL text into EOQL AST, enabling:
 * - Import existing SQL queries into EOQL
 * - Edit SQL visually then re-export
 * - Cross-compile SQL between dialects
 */

(function(global) {
    'use strict';

    // ============================================================================
    // TOKENIZER
    // ============================================================================

    const TokenTypes = {
        KEYWORD: 'KEYWORD',
        IDENTIFIER: 'IDENTIFIER',
        STRING: 'STRING',
        NUMBER: 'NUMBER',
        OPERATOR: 'OPERATOR',
        PUNCTUATION: 'PUNCTUATION',
        WHITESPACE: 'WHITESPACE',
        COMMENT: 'COMMENT',
        EOF: 'EOF'
    };

    const SQL_KEYWORDS = new Set([
        'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'ILIKE',
        'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'ON', 'USING',
        'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'NATURAL',
        'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
        'LIMIT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY',
        'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'DISTINCT',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
        'WITH', 'RECURSIVE', 'AS',
        'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
        'CREATE', 'TABLE', 'VIEW', 'INDEX', 'DROP', 'ALTER',
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF',
        'OVER', 'PARTITION', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD',
        'CAST', 'CONVERT'
    ]);

    const OPERATORS = new Set([
        '=', '!=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '||', '::'
    ]);

    const PUNCTUATION = new Set([
        '(', ')', ',', ';', '.', '[', ']'
    ]);

    /**
     * SQL Tokenizer
     */
    class SQLTokenizer {
        constructor(sql) {
            this.sql = sql;
            this.pos = 0;
            this.tokens = [];
        }

        tokenize() {
            while (this.pos < this.sql.length) {
                const token = this._nextToken();
                if (token && token.type !== TokenTypes.WHITESPACE && token.type !== TokenTypes.COMMENT) {
                    this.tokens.push(token);
                }
            }
            this.tokens.push({ type: TokenTypes.EOF, value: '' });
            return this.tokens;
        }

        _nextToken() {
            const char = this.sql[this.pos];

            // Whitespace
            if (/\s/.test(char)) {
                return this._readWhitespace();
            }

            // Single-line comment
            if (char === '-' && this.sql[this.pos + 1] === '-') {
                return this._readLineComment();
            }

            // Multi-line comment
            if (char === '/' && this.sql[this.pos + 1] === '*') {
                return this._readBlockComment();
            }

            // String (single quotes)
            if (char === "'") {
                return this._readString("'");
            }

            // String (double quotes - identifier in some dialects)
            if (char === '"') {
                return this._readQuotedIdentifier('"');
            }

            // Backtick identifier (MySQL)
            if (char === '`') {
                return this._readQuotedIdentifier('`');
            }

            // Number
            if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(this.sql[this.pos + 1]))) {
                return this._readNumber();
            }

            // Multi-char operators
            const twoChar = this.sql.substr(this.pos, 2);
            if (OPERATORS.has(twoChar)) {
                this.pos += 2;
                return { type: TokenTypes.OPERATOR, value: twoChar };
            }

            // Single-char operator
            if (OPERATORS.has(char)) {
                this.pos++;
                return { type: TokenTypes.OPERATOR, value: char };
            }

            // Punctuation
            if (PUNCTUATION.has(char)) {
                this.pos++;
                return { type: TokenTypes.PUNCTUATION, value: char };
            }

            // Identifier or keyword
            if (/[a-zA-Z_]/.test(char)) {
                return this._readIdentifier();
            }

            // Unknown - skip
            this.pos++;
            return null;
        }

        _readWhitespace() {
            const start = this.pos;
            while (this.pos < this.sql.length && /\s/.test(this.sql[this.pos])) {
                this.pos++;
            }
            return { type: TokenTypes.WHITESPACE, value: this.sql.substring(start, this.pos) };
        }

        _readLineComment() {
            const start = this.pos;
            while (this.pos < this.sql.length && this.sql[this.pos] !== '\n') {
                this.pos++;
            }
            return { type: TokenTypes.COMMENT, value: this.sql.substring(start, this.pos) };
        }

        _readBlockComment() {
            const start = this.pos;
            this.pos += 2; // Skip /*
            while (this.pos < this.sql.length - 1) {
                if (this.sql[this.pos] === '*' && this.sql[this.pos + 1] === '/') {
                    this.pos += 2;
                    break;
                }
                this.pos++;
            }
            return { type: TokenTypes.COMMENT, value: this.sql.substring(start, this.pos) };
        }

        _readString(quote) {
            const start = this.pos;
            this.pos++; // Skip opening quote
            let value = '';

            while (this.pos < this.sql.length) {
                const char = this.sql[this.pos];
                if (char === quote) {
                    // Check for escaped quote
                    if (this.sql[this.pos + 1] === quote) {
                        value += quote;
                        this.pos += 2;
                    } else {
                        this.pos++; // Skip closing quote
                        break;
                    }
                } else {
                    value += char;
                    this.pos++;
                }
            }

            return { type: TokenTypes.STRING, value };
        }

        _readQuotedIdentifier(quote) {
            this.pos++; // Skip opening quote
            let value = '';

            while (this.pos < this.sql.length && this.sql[this.pos] !== quote) {
                value += this.sql[this.pos];
                this.pos++;
            }
            this.pos++; // Skip closing quote

            return { type: TokenTypes.IDENTIFIER, value };
        }

        _readNumber() {
            const start = this.pos;
            let hasDecimal = false;

            while (this.pos < this.sql.length) {
                const char = this.sql[this.pos];
                if (/[0-9]/.test(char)) {
                    this.pos++;
                } else if (char === '.' && !hasDecimal) {
                    hasDecimal = true;
                    this.pos++;
                } else if (/[eE]/.test(char) && /[0-9+-]/.test(this.sql[this.pos + 1])) {
                    this.pos++;
                    if (/[+-]/.test(this.sql[this.pos])) this.pos++;
                } else {
                    break;
                }
            }

            return { type: TokenTypes.NUMBER, value: this.sql.substring(start, this.pos) };
        }

        _readIdentifier() {
            const start = this.pos;
            while (this.pos < this.sql.length && /[a-zA-Z0-9_]/.test(this.sql[this.pos])) {
                this.pos++;
            }
            const value = this.sql.substring(start, this.pos);
            const upper = value.toUpperCase();

            if (SQL_KEYWORDS.has(upper)) {
                return { type: TokenTypes.KEYWORD, value: upper };
            }

            return { type: TokenTypes.IDENTIFIER, value };
        }
    }

    // ============================================================================
    // PARSER
    // ============================================================================

    /**
     * SQL Parser - Parses SQL into EOQL AST
     */
    class SQLParser {
        constructor(sql) {
            this.sql = sql;
            this.tokens = [];
            this.pos = 0;
        }

        /**
         * Parse SQL to EOQL query
         */
        parse() {
            const tokenizer = new SQLTokenizer(this.sql);
            this.tokens = tokenizer.tokenize();
            this.pos = 0;

            return this._parseStatement();
        }

        /**
         * Parse a SQL statement
         */
        _parseStatement() {
            const token = this._peek();

            if (token.type === TokenTypes.KEYWORD) {
                switch (token.value) {
                    case 'SELECT':
                        return this._parseSelect();
                    case 'WITH':
                        return this._parseWith();
                    case 'INSERT':
                        return this._parseInsert();
                    case 'UPDATE':
                        return this._parseUpdate();
                    case 'DELETE':
                        return this._parseDelete();
                }
            }

            throw new Error(`Unexpected token: ${token.value}`);
        }

        /**
         * Parse SELECT statement
         */
        _parseSelect() {
            const query = new (global.EOQuery || this._createQueryClass())();

            this._expect('SELECT');

            // DISTINCT
            if (this._match('DISTINCT')) {
                query._addOp('SEG', { distinct: true });
            }

            // Columns
            const columns = this._parseSelectList();
            query._addOp('DES', { columns });

            // FROM
            if (this._match('FROM')) {
                const source = this._parseTableRef();
                query._addOp('INS', { source });

                // JOINs
                while (this._isJoinKeyword()) {
                    const join = this._parseJoin();
                    query._addOp('CON', join);
                }
            }

            // WHERE
            if (this._match('WHERE')) {
                const condition = this._parseExpression();
                query._addOp('SEG', { where: condition });
            }

            // GROUP BY
            if (this._match('GROUP')) {
                this._expect('BY');
                const groupBy = this._parseIdentifierList();
                query._addOp('SEG', { groupBy });
            }

            // HAVING
            if (this._match('HAVING')) {
                const having = this._parseExpression();
                query._addOp('SEG', { having });
            }

            // Set operations
            while (this._isSetOperation()) {
                const setOp = this._parseSetOperation();
                query._addOp('CON', setOp);
            }

            // ORDER BY
            if (this._match('ORDER')) {
                this._expect('BY');
                const orderBy = this._parseOrderByList();
                query._addOp('ALT', { orderBy });
            }

            // LIMIT
            if (this._match('LIMIT')) {
                const limit = this._parseNumber();
                query._addOp('SEG', { limit });

                // OFFSET
                if (this._match('OFFSET')) {
                    const offset = this._parseNumber();
                    query._addOp('SEG', { offset });
                }
            }

            // OFFSET ... FETCH (SQL Server style)
            if (this._match('OFFSET')) {
                const offset = this._parseNumber();
                this._match('ROWS');
                query._addOp('SEG', { offset });

                if (this._match('FETCH')) {
                    this._match('NEXT');
                    const limit = this._parseNumber();
                    this._match('ROWS');
                    this._match('ONLY');
                    query._addOp('SEG', { limit });
                }
            }

            return query;
        }

        /**
         * Parse WITH (CTE)
         */
        _parseWith() {
            this._expect('WITH');
            const isRecursive = this._match('RECURSIVE');

            const ctes = {};

            do {
                const name = this._parseIdentifier();
                this._expect('AS');
                this._expect('(');
                const cteQuery = this._parseSelect();
                this._expect(')');
                ctes[name] = cteQuery;
            } while (this._match(','));

            const mainQuery = this._parseSelect();

            if (isRecursive) {
                mainQuery._addOp('REC', { ctes, isRecursive: true });
            } else {
                mainQuery._addOp('SUP', { cte: ctes });
            }

            return mainQuery;
        }

        /**
         * Parse INSERT statement
         */
        _parseInsert() {
            this._expect('INSERT');
            this._expect('INTO');

            const table = this._parseIdentifier();
            const query = new (global.EOQuery || this._createQueryClass())();

            // Column list (optional)
            let columns = null;
            if (this._match('(')) {
                columns = this._parseIdentifierList();
                this._expect(')');
            }

            // VALUES or SELECT
            if (this._match('VALUES')) {
                const values = [];
                do {
                    this._expect('(');
                    values.push(this._parseExpressionList());
                    this._expect(')');
                } while (this._match(','));

                query._addOp('INS', { source: table, columns, values, operation: 'insert' });
            } else if (this._peek().value === 'SELECT') {
                const selectQuery = this._parseSelect();
                query._addOp('INS', { source: table, columns, select: selectQuery, operation: 'insert' });
            }

            return query;
        }

        /**
         * Parse UPDATE statement
         */
        _parseUpdate() {
            this._expect('UPDATE');
            const table = this._parseIdentifier();

            this._expect('SET');
            const assignments = {};

            do {
                const col = this._parseIdentifier();
                this._expect('=');
                const val = this._parseExpression();
                assignments[col] = val;
            } while (this._match(','));

            const query = new (global.EOQuery || this._createQueryClass())();
            query._addOp('INS', { source: table, operation: 'update', set: assignments });

            if (this._match('WHERE')) {
                const condition = this._parseExpression();
                query._addOp('SEG', { where: condition });
            }

            return query;
        }

        /**
         * Parse DELETE statement
         */
        _parseDelete() {
            this._expect('DELETE');
            this._expect('FROM');
            const table = this._parseIdentifier();

            const query = new (global.EOQuery || this._createQueryClass())();
            query._addOp('INS', { source: table, operation: 'delete' });

            if (this._match('WHERE')) {
                const condition = this._parseExpression();
                query._addOp('SEG', { where: condition });
            }

            return query;
        }

        /**
         * Parse SELECT column list
         */
        _parseSelectList() {
            const columns = [];

            do {
                if (this._match('*')) {
                    columns.push('*');
                } else {
                    const expr = this._parseExpression();
                    let alias = null;

                    if (this._match('AS')) {
                        alias = this._parseIdentifier();
                    } else if (this._peek().type === TokenTypes.IDENTIFIER && !this._isKeyword()) {
                        alias = this._parseIdentifier();
                    }

                    if (alias) {
                        columns.push({ [alias]: expr });
                    } else if (expr.type === 'field') {
                        columns.push(expr.name);
                    } else {
                        columns.push(expr);
                    }
                }
            } while (this._match(','));

            return columns;
        }

        /**
         * Parse table reference
         */
        _parseTableRef() {
            let table = this._parseIdentifier();

            // Alias
            if (this._match('AS')) {
                const alias = this._parseIdentifier();
                return { table, alias };
            } else if (this._peek().type === TokenTypes.IDENTIFIER && !this._isKeyword()) {
                const alias = this._parseIdentifier();
                return { table, alias };
            }

            return table;
        }

        /**
         * Check if current token is a JOIN keyword
         */
        _isJoinKeyword() {
            const token = this._peek();
            return token.type === TokenTypes.KEYWORD &&
                ['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL'].includes(token.value);
        }

        /**
         * Parse JOIN clause
         */
        _parseJoin() {
            let type = 'inner';

            if (this._match('NATURAL')) {
                type = 'natural';
            }
            if (this._match('LEFT')) {
                type = 'left';
                this._match('OUTER');
            } else if (this._match('RIGHT')) {
                type = 'right';
                this._match('OUTER');
            } else if (this._match('FULL')) {
                type = 'full';
                this._match('OUTER');
            } else if (this._match('CROSS')) {
                type = 'cross';
            } else if (this._match('INNER')) {
                type = 'inner';
            }

            this._expect('JOIN');
            const target = this._parseTableRef();

            let on = null;
            let using = null;

            if (this._match('ON')) {
                on = this._parseExpression();
            } else if (this._match('USING')) {
                this._expect('(');
                using = this._parseIdentifierList();
                this._expect(')');
            }

            return { target, on, using, type };
        }

        /**
         * Check if current token is a set operation
         */
        _isSetOperation() {
            const token = this._peek();
            return token.type === TokenTypes.KEYWORD &&
                ['UNION', 'INTERSECT', 'EXCEPT'].includes(token.value);
        }

        /**
         * Parse set operation
         */
        _parseSetOperation() {
            let type;

            if (this._match('UNION')) {
                type = this._match('ALL') ? 'union_all' : 'union';
            } else if (this._match('INTERSECT')) {
                type = 'intersect';
            } else if (this._match('EXCEPT')) {
                type = 'except';
            }

            const target = this._parseSelect();

            return { target, type };
        }

        /**
         * Parse ORDER BY list
         */
        _parseOrderByList() {
            const specs = [];

            do {
                const field = this._parseExpression();
                let direction = 'asc';
                let nullsFirst = null;

                if (this._match('DESC')) {
                    direction = 'desc';
                } else {
                    this._match('ASC');
                }

                if (this._match('NULLS')) {
                    if (this._match('FIRST')) {
                        nullsFirst = true;
                    } else if (this._match('LAST')) {
                        nullsFirst = false;
                    }
                }

                specs.push({
                    field: field.type === 'field' ? field.name : field,
                    direction,
                    ...(nullsFirst !== null && { nullsFirst })
                });
            } while (this._match(','));

            return specs;
        }

        /**
         * Parse expression
         */
        _parseExpression() {
            return this._parseOr();
        }

        _parseOr() {
            let left = this._parseAnd();

            while (this._match('OR')) {
                const right = this._parseAnd();
                left = { type: 'or', conditions: [left, right] };
            }

            return left;
        }

        _parseAnd() {
            let left = this._parseNot();

            while (this._match('AND')) {
                const right = this._parseNot();
                left = { type: 'and', conditions: [left, right] };
            }

            return left;
        }

        _parseNot() {
            if (this._match('NOT')) {
                const expr = this._parseNot();
                return { type: 'not', condition: expr };
            }
            return this._parseComparison();
        }

        _parseComparison() {
            let left = this._parseAddSub();

            const token = this._peek();

            // IS NULL / IS NOT NULL
            if (this._match('IS')) {
                const not = this._match('NOT');
                this._expect('NULL');
                return { type: not ? 'is_not_null' : 'is_null', field: left };
            }

            // IN
            if (this._match('IN')) {
                this._expect('(');
                const values = this._parseExpressionList();
                this._expect(')');
                return { type: 'in', field: left, values };
            }

            // NOT IN
            if (this._match('NOT')) {
                if (this._match('IN')) {
                    this._expect('(');
                    const values = this._parseExpressionList();
                    this._expect(')');
                    return { type: 'not_in', field: left, values };
                }
            }

            // BETWEEN
            if (this._match('BETWEEN')) {
                const low = this._parseAddSub();
                this._expect('AND');
                const high = this._parseAddSub();
                return { type: 'between', field: left, low, high };
            }

            // LIKE / ILIKE
            if (this._match('LIKE')) {
                const pattern = this._parseAddSub();
                return { type: 'like', field: left, pattern: pattern.value || pattern };
            }
            if (this._match('ILIKE')) {
                const pattern = this._parseAddSub();
                return { type: 'ilike', field: left, pattern: pattern.value || pattern };
            }

            // Comparison operators
            if (token.type === TokenTypes.OPERATOR) {
                const op = token.value;
                if (['=', '!=', '<>', '<', '>', '<=', '>='].includes(op)) {
                    this._advance();
                    const right = this._parseAddSub();

                    const typeMap = {
                        '=': 'eq',
                        '!=': 'ne',
                        '<>': 'ne',
                        '<': 'lt',
                        '>': 'gt',
                        '<=': 'lte',
                        '>=': 'gte'
                    };

                    return { type: typeMap[op], left, right };
                }
            }

            return left;
        }

        _parseAddSub() {
            let left = this._parseMulDiv();

            while (true) {
                if (this._matchOperator('+')) {
                    const right = this._parseMulDiv();
                    left = { type: 'add', left, right };
                } else if (this._matchOperator('-')) {
                    const right = this._parseMulDiv();
                    left = { type: 'sub', left, right };
                } else if (this._matchOperator('||')) {
                    const right = this._parseMulDiv();
                    left = { type: 'fn', name: 'CONCAT', args: [left, right] };
                } else {
                    break;
                }
            }

            return left;
        }

        _parseMulDiv() {
            let left = this._parseUnary();

            while (true) {
                if (this._matchOperator('*')) {
                    const right = this._parseUnary();
                    left = { type: 'mul', left, right };
                } else if (this._matchOperator('/')) {
                    const right = this._parseUnary();
                    left = { type: 'div', left, right };
                } else if (this._matchOperator('%')) {
                    const right = this._parseUnary();
                    left = { type: 'mod', left, right };
                } else {
                    break;
                }
            }

            return left;
        }

        _parseUnary() {
            if (this._matchOperator('-')) {
                const expr = this._parseUnary();
                return { type: 'mul', left: { type: 'literal', value: -1 }, right: expr };
            }
            if (this._matchOperator('+')) {
                return this._parseUnary();
            }
            return this._parsePrimary();
        }

        _parsePrimary() {
            const token = this._peek();

            // Parenthesized expression or subquery
            if (token.value === '(') {
                this._advance();
                if (this._peek().value === 'SELECT') {
                    const subquery = this._parseSelect();
                    this._expect(')');
                    return { type: 'subquery', query: subquery };
                }
                const expr = this._parseExpression();
                this._expect(')');
                return expr;
            }

            // CASE expression
            if (this._match('CASE')) {
                return this._parseCaseExpression();
            }

            // Aggregate functions
            if (token.type === TokenTypes.KEYWORD &&
                ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF'].includes(token.value)) {
                return this._parseFunctionCall();
            }

            // Window functions
            if (token.type === TokenTypes.KEYWORD &&
                ['ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE'].includes(token.value)) {
                return this._parseWindowFunction();
            }

            // Number
            if (token.type === TokenTypes.NUMBER) {
                this._advance();
                return { type: 'literal', value: parseFloat(token.value) };
            }

            // String
            if (token.type === TokenTypes.STRING) {
                this._advance();
                return { type: 'literal', value: token.value };
            }

            // Boolean
            if (this._match('TRUE')) {
                return { type: 'literal', value: true };
            }
            if (this._match('FALSE')) {
                return { type: 'literal', value: false };
            }

            // NULL
            if (this._match('NULL')) {
                return { type: 'literal', value: null };
            }

            // CAST
            if (this._match('CAST')) {
                this._expect('(');
                const expr = this._parseExpression();
                this._expect('AS');
                const dataType = this._parseIdentifier();
                this._expect(')');
                return { type: 'fn', name: 'CAST', args: [expr, { type: 'literal', value: dataType }] };
            }

            // Function call or identifier
            if (token.type === TokenTypes.IDENTIFIER || token.type === TokenTypes.KEYWORD) {
                const name = this._advance().value;

                // Function call
                if (this._peek().value === '(') {
                    this._advance();
                    const args = this._peek().value === ')' ? [] : this._parseExpressionList();
                    this._expect(')');

                    // Check for OVER (window function)
                    if (this._match('OVER')) {
                        return this._parseOverClause(name, args);
                    }

                    // Aggregate check
                    if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(name.toUpperCase())) {
                        return {
                            type: 'agg',
                            fn: name.toUpperCase(),
                            field: args[0] || '*'
                        };
                    }

                    return { type: 'fn', name, args };
                }

                // Qualified identifier (table.column)
                if (this._peek().value === '.') {
                    this._advance();
                    const column = this._parseIdentifier();
                    return { type: 'field', name: `${name}.${column}` };
                }

                return { type: 'field', name };
            }

            // Star
            if (this._match('*')) {
                return { type: 'field', name: '*' };
            }

            throw new Error(`Unexpected token: ${token.value}`);
        }

        /**
         * Parse CASE expression
         */
        _parseCaseExpression() {
            const when = [];
            let elseValue = null;

            while (this._match('WHEN')) {
                const condition = this._parseExpression();
                this._expect('THEN');
                const then = this._parseExpression();
                when.push({ condition, then });
            }

            if (this._match('ELSE')) {
                elseValue = this._parseExpression();
            }

            this._expect('END');

            return { type: 'case', when, else: elseValue };
        }

        /**
         * Parse function call
         */
        _parseFunctionCall() {
            const name = this._advance().value;
            this._expect('(');

            // Handle COUNT(*)
            if (name === 'COUNT' && this._match('*')) {
                this._expect(')');
                return { type: 'agg', fn: 'COUNT', field: '*' };
            }

            // DISTINCT in aggregate
            const distinct = this._match('DISTINCT');

            const args = this._parseExpressionList();
            this._expect(')');

            // Check for OVER clause
            if (this._match('OVER')) {
                return this._parseOverClause(name, args);
            }

            if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(name)) {
                return { type: 'agg', fn: name, field: args[0], distinct };
            }

            return { type: 'fn', name, args };
        }

        /**
         * Parse window function
         */
        _parseWindowFunction() {
            const name = this._advance().value;
            this._expect('(');

            const args = this._peek().value === ')' ? [] : this._parseExpressionList();
            this._expect(')');

            this._expect('OVER');
            return this._parseOverClause(name, args);
        }

        /**
         * Parse OVER clause
         */
        _parseOverClause(fn, args) {
            this._expect('(');

            const windowSpec = { fn, args };

            if (this._match('PARTITION')) {
                this._expect('BY');
                windowSpec.partitionBy = this._parseIdentifierList();
            }

            if (this._match('ORDER')) {
                this._expect('BY');
                windowSpec.orderBy = this._parseOrderByList();
            }

            // Frame clause (ROWS/RANGE BETWEEN)
            if (this._match('ROWS') || this._match('RANGE')) {
                // Simplified - just capture as string
                let frame = '';
                while (this._peek().value !== ')') {
                    frame += ' ' + this._advance().value;
                }
                windowSpec.frame = frame.trim();
            }

            this._expect(')');

            return { type: 'window', ...windowSpec };
        }

        /**
         * Parse identifier list
         */
        _parseIdentifierList() {
            const identifiers = [];

            do {
                identifiers.push(this._parseIdentifier());
            } while (this._match(','));

            return identifiers;
        }

        /**
         * Parse expression list
         */
        _parseExpressionList() {
            const expressions = [];

            do {
                expressions.push(this._parseExpression());
            } while (this._match(','));

            return expressions;
        }

        /**
         * Parse identifier
         */
        _parseIdentifier() {
            const token = this._peek();
            if (token.type === TokenTypes.IDENTIFIER || token.type === TokenTypes.KEYWORD) {
                this._advance();
                return token.value;
            }
            throw new Error(`Expected identifier, got: ${token.value}`);
        }

        /**
         * Parse number
         */
        _parseNumber() {
            const token = this._peek();
            if (token.type === TokenTypes.NUMBER) {
                this._advance();
                return parseFloat(token.value);
            }
            throw new Error(`Expected number, got: ${token.value}`);
        }

        // ============================================================================
        // TOKEN HELPERS
        // ============================================================================

        _peek() {
            return this.tokens[this.pos] || { type: TokenTypes.EOF, value: '' };
        }

        _advance() {
            return this.tokens[this.pos++];
        }

        _match(value) {
            const token = this._peek();
            if ((token.type === TokenTypes.KEYWORD || token.type === TokenTypes.PUNCTUATION) &&
                token.value === value) {
                this._advance();
                return true;
            }
            return false;
        }

        _matchOperator(value) {
            const token = this._peek();
            if (token.type === TokenTypes.OPERATOR && token.value === value) {
                this._advance();
                return true;
            }
            return false;
        }

        _expect(value) {
            if (!this._match(value)) {
                const token = this._peek();
                throw new Error(`Expected '${value}', got '${token.value}'`);
            }
        }

        _isKeyword() {
            const token = this._peek();
            return token.type === TokenTypes.KEYWORD;
        }

        /**
         * Create a minimal query class if EOQL isn't loaded
         */
        _createQueryClass() {
            return class MinimalQuery {
                constructor() {
                    this._pipeline = [];
                }
                _addOp(operator, params) {
                    this._pipeline.push({ operator, params });
                    return this;
                }
                toAST() {
                    return { type: 'query', pipeline: this._pipeline };
                }
            };
        }
    }

    // ============================================================================
    // CONVENIENCE FUNCTIONS
    // ============================================================================

    /**
     * Parse SQL to EOQL
     */
    function parseSQL(sql) {
        const parser = new SQLParser(sql);
        return parser.parse();
    }

    /**
     * Convert SQL to EOQL and back to SQL (for validation/normalization)
     */
    function normalizeSQL(sql, dialect = 'postgresql') {
        const query = parseSQL(sql);
        if (global.toSQL) {
            return global.toSQL(query, dialect);
        }
        return query;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const exports = {
        SQLTokenizer,
        SQLParser,
        TokenTypes,
        parseSQL,
        normalizeSQL
    };

    // Export to global scope
    global.SQLParser = SQLParser;
    global.parseSQL = parseSQL;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }

})(typeof window !== 'undefined' ? window : global);
