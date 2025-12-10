/**
 * EO Formula Engine
 * Implements Airtable-like formula fields with context awareness
 *
 * Supports:
 * - Arithmetic: +, -, *, /, ^
 * - Comparison: =, !=, <, >, <=, >=
 * - Logical: AND, OR, NOT
 * - Functions: SUM, AVG, MIN, MAX, COUNT, IF, CONCAT, ROUND, ABS
 * - Text: UPPER, LOWER, TRIM, LEN, LEFT, RIGHT, MID
 * - Date: TODAY, NOW, YEAR, MONTH, DAY, DATEDIFF
 * - Field references: {FieldName}
 *
 * === E.F. Codd NULL Semantics ===
 *
 * This engine implements Codd's formal NULL handling:
 *
 * 1. NULL Propagation in Arithmetic:
 *    - NULL + 5 = NULL (strict mode)
 *    - Operations with NULL yield NULL
 *
 * 2. Three-Valued Logic in Comparisons:
 *    - NULL = NULL → UNKNOWN (via EOAbsence)
 *    - NULL in boolean expressions yields UNKNOWN
 *
 * 3. Codd-Compliant Functions:
 *    - ISNULL, ISNOTNULL - proper NULL testing
 *    - IS_DISTINCT_FROM - NULL-safe equality
 *    - NULLIF - conditional NULL
 *    - Aggregates track NULL counts
 *
 * Configuration:
 *   Set `coddMode: true` for strict NULL propagation
 *   Default mode maintains backward compatibility
 */

// LRU Cache for formula parsing (1000 entries max)
class FormulaLRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Remove existing entry to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (first in Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }
}

class EOFormulaEngine {
  /**
   * @param {Object} options - Configuration options
   * @param {boolean} options.coddMode - Enable strict Codd NULL semantics (default: false)
   */
  constructor(options = {}) {
    this.coddMode = options.coddMode || false;
    this.functions = this.initializeFunctions();
    // LRU cache for parsed formulas (max 1000 entries)
    this._parseCache = new FormulaLRUCache(1000);
  }

  /**
   * Check if a value is absent (null, undefined, empty string)
   * Uses EOAbsence if available, otherwise fallback
   * @param {*} value - Value to check
   * @returns {boolean}
   */
  isAbsent(value) {
    if (typeof EOAbsence !== 'undefined') {
      return EOAbsence.isAbsent(value);
    }
    return value === null || value === undefined || value === '';
  }

  /**
   * Get the UNKNOWN constant for three-valued logic
   * @returns {*}
   */
  getUnknown() {
    if (typeof EOAbsence !== 'undefined') {
      return EOAbsence.UNKNOWN;
    }
    return null;  // Fallback
  }

  /**
   * Initialize all supported formula functions
   */
  initializeFunctions() {
    return {
      // Mathematical functions
      SUM: (...args) => args.reduce((sum, val) => sum + this.toNumber(val), 0),
      AVG: (...args) => {
        const nums = args.map(v => this.toNumber(v));
        return nums.reduce((sum, val) => sum + val, 0) / nums.length;
      },
      MIN: (...args) => Math.min(...args.map(v => this.toNumber(v))),
      MAX: (...args) => Math.max(...args.map(v => this.toNumber(v))),
      ROUND: (num, decimals = 0) => {
        const multiplier = Math.pow(10, decimals);
        return Math.round(this.toNumber(num) * multiplier) / multiplier;
      },
      ABS: (num) => Math.abs(this.toNumber(num)),
      SQRT: (num) => Math.sqrt(this.toNumber(num)),
      POWER: (base, exp) => Math.pow(this.toNumber(base), this.toNumber(exp)),
      MOD: (num, divisor) => this.toNumber(num) % this.toNumber(divisor),

      // Logical functions
      IF: (condition, trueVal, falseVal) => condition ? trueVal : falseVal,
      AND: (...args) => args.every(v => !!v),
      OR: (...args) => args.some(v => !!v),
      NOT: (val) => !val,

      // Text functions
      CONCAT: (...args) => args.map(v => String(v ?? '')).join(''),
      UPPER: (text) => String(text ?? '').toUpperCase(),
      LOWER: (text) => String(text ?? '').toLowerCase(),
      TRIM: (text) => String(text ?? '').trim(),
      LEN: (text) => String(text ?? '').length,
      LEFT: (text, count) => String(text ?? '').substring(0, count),
      RIGHT: (text, count) => {
        const str = String(text ?? '');
        return str.substring(str.length - count);
      },
      MID: (text, start, count) => String(text ?? '').substring(start, start + count),
      FIND: (search, text) => {
        const index = String(text ?? '').indexOf(String(search ?? ''));
        return index === -1 ? null : index;
      },
      REPLACE: (text, old, replacement) =>
        String(text ?? '').replace(new RegExp(old, 'g'), String(replacement ?? '')),

      // Date functions
      TODAY: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      },
      NOW: () => new Date(),
      YEAR: (date) => this.toDate(date).getFullYear(),
      MONTH: (date) => this.toDate(date).getMonth() + 1,
      DAY: (date) => this.toDate(date).getDate(),
      HOUR: (date) => this.toDate(date).getHours(),
      MINUTE: (date) => this.toDate(date).getMinutes(),
      DATEDIFF: (date1, date2, unit = 'days') => {
        const d1 = this.toDate(date1);
        const d2 = this.toDate(date2);
        const diff = d2 - d1;

        switch (unit.toLowerCase()) {
          case 'seconds': return Math.floor(diff / 1000);
          case 'minutes': return Math.floor(diff / (1000 * 60));
          case 'hours': return Math.floor(diff / (1000 * 60 * 60));
          case 'days': return Math.floor(diff / (1000 * 60 * 60 * 24));
          case 'weeks': return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
          case 'months': return (d2.getFullYear() - d1.getFullYear()) * 12 +
                                (d2.getMonth() - d1.getMonth());
          case 'years': return d2.getFullYear() - d1.getFullYear();
          default: return Math.floor(diff / (1000 * 60 * 60 * 24));
        }
      },
      DATEADD: (date, count, unit = 'days') => {
        const d = new Date(this.toDate(date));

        switch (unit.toLowerCase()) {
          case 'seconds': d.setSeconds(d.getSeconds() + count); break;
          case 'minutes': d.setMinutes(d.getMinutes() + count); break;
          case 'hours': d.setHours(d.getHours() + count); break;
          case 'days': d.setDate(d.getDate() + count); break;
          case 'weeks': d.setDate(d.getDate() + (count * 7)); break;
          case 'months': d.setMonth(d.getMonth() + count); break;
          case 'years': d.setFullYear(d.getFullYear() + count); break;
        }

        return d;
      },

      // Counting and aggregation
      COUNT: (...args) => args.filter(v => v != null).length,
      COUNTA: (...args) => args.filter(v => v !== null && v !== undefined && v !== '').length,
      COUNTBLANK: (...args) => args.filter(v => v == null || v === '').length,

      // Value checks
      ISBLANK: (val) => val == null || val === '',
      ISNUMBER: (val) => typeof val === 'number' && !isNaN(val),
      ISTEXT: (val) => typeof val === 'string',
      ISERROR: (val) => val instanceof Error,

      // Utility functions
      VALUE: (text) => this.toNumber(text),
      TEXT: (val) => String(val ?? ''),
      BLANK: () => null,

      // ========================================================================
      // CODD-COMPLIANT NULL FUNCTIONS
      // ========================================================================

      /**
       * ISNULL - Check if value is NULL (Codd semantics)
       * Unlike ISBLANK, this specifically tests for NULL/undefined
       * @param {*} val - Value to test
       * @returns {boolean}
       */
      ISNULL: (val) => val === null || val === undefined,

      /**
       * ISNOTNULL - Check if value is not NULL
       * @param {*} val - Value to test
       * @returns {boolean}
       */
      ISNOTNULL: (val) => val !== null && val !== undefined,

      /**
       * IS_A_MARK - Check if value is a Codd A-mark (applicable but unknown)
       * @param {*} val - Value to test
       * @returns {boolean}
       */
      IS_A_MARK: (val) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.isAMark(val);
        }
        return false;
      },

      /**
       * IS_I_MARK - Check if value is a Codd I-mark (inapplicable)
       * @param {*} val - Value to test
       * @returns {boolean}
       */
      IS_I_MARK: (val) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.isIMark(val);
        }
        return false;
      },

      /**
       * IS_DISTINCT_FROM - NULL-safe inequality comparison (SQL:1999)
       * NULL IS DISTINCT FROM NULL → FALSE
       * NULL IS DISTINCT FROM 5 → TRUE
       * 5 IS DISTINCT FROM 5 → FALSE
       * @param {*} a - First value
       * @param {*} b - Second value
       * @returns {boolean} Always returns boolean, never UNKNOWN
       */
      IS_DISTINCT_FROM: (a, b) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.isDistinctFrom(a, b);
        }
        const aNull = a === null || a === undefined;
        const bNull = b === null || b === undefined;
        if (aNull && bNull) return false;
        if (aNull || bNull) return true;
        return a !== b;
      },

      /**
       * IS_NOT_DISTINCT_FROM - NULL-safe equality comparison
       * NULL IS NOT DISTINCT FROM NULL → TRUE
       * @param {*} a - First value
       * @param {*} b - Second value
       * @returns {boolean}
       */
      IS_NOT_DISTINCT_FROM: (a, b) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.isNotDistinctFrom(a, b);
        }
        const aNull = a === null || a === undefined;
        const bNull = b === null || b === undefined;
        if (aNull && bNull) return true;
        if (aNull || bNull) return false;
        return a === b;
      },

      /**
       * NULLIF - Returns NULL if both arguments are equal
       * @param {*} a - First value
       * @param {*} b - Second value
       * @returns {*} NULL if a equals b, otherwise a
       */
      NULLIF: (a, b) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.nullIf(a, b);
        }
        if (a === null || a === undefined || b === null || b === undefined) return a;
        return a === b ? null : a;
      },

      /**
       * A_MARK - Create a Codd A-mark (applicable but unknown)
       * @param {string} reason - Optional reason
       * @returns {Object} A-mark object
       */
      A_MARK: (reason) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.createAMark(reason);
        }
        return null;
      },

      /**
       * I_MARK - Create a Codd I-mark (inapplicable)
       * @param {string} reason - Optional reason
       * @returns {Object} I-mark object
       */
      I_MARK: (reason) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.createIMark(reason);
        }
        return null;
      },

      // ========================================================================
      // THREE-VALUED LOGIC FUNCTIONS (Codd's 3VL)
      // ========================================================================

      /**
       * AND3 - Three-valued AND (Codd semantics)
       * Returns UNKNOWN if any operand is NULL and no operand is FALSE
       * @param {...*} args - Operands
       * @returns {boolean|UNKNOWN}
       */
      AND3: (...args) => {
        if (typeof EOAbsence !== 'undefined') {
          let result = true;
          for (const arg of args) {
            result = EOAbsence.threeValuedAnd(result, arg);
            if (result === false) return false;  // Short-circuit
          }
          return result;
        }
        return args.every(v => !!v);
      },

      /**
       * OR3 - Three-valued OR (Codd semantics)
       * Returns UNKNOWN if any operand is NULL and no operand is TRUE
       * @param {...*} args - Operands
       * @returns {boolean|UNKNOWN}
       */
      OR3: (...args) => {
        if (typeof EOAbsence !== 'undefined') {
          let result = false;
          for (const arg of args) {
            result = EOAbsence.threeValuedOr(result, arg);
            if (result === true) return true;  // Short-circuit
          }
          return result;
        }
        return args.some(v => !!v);
      },

      /**
       * NOT3 - Three-valued NOT (Codd semantics)
       * NOT NULL → UNKNOWN
       * @param {*} val - Operand
       * @returns {boolean|UNKNOWN}
       */
      NOT3: (val) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.threeValuedNot(val);
        }
        return !val;
      },

      /**
       * EQ3 - Three-valued equality (Codd semantics)
       * NULL = NULL → UNKNOWN
       * @param {*} a - First operand
       * @param {*} b - Second operand
       * @returns {boolean|UNKNOWN}
       */
      EQ3: (a, b) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.threeValuedEquals(a, b);
        }
        if (a === null || a === undefined || b === null || b === undefined) {
          return null;  // Fallback for UNKNOWN
        }
        return a === b;
      },

      // ========================================================================
      // CODD-COMPLIANT AGGREGATES WITH NULL TRACKING
      // ========================================================================

      /**
       * SUM_CODD - Sum with NULL tracking (Codd semantics)
       * Returns object with value and NULL statistics
       * @param {...*} args - Values to sum
       * @returns {Object} { value, nullCount, presentCount, certainty }
       */
      SUM_CODD: (...args) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.sumWithNullTracking(args);
        }
        const present = args.filter(v => v !== null && v !== undefined && typeof v === 'number');
        return {
          value: present.reduce((a, b) => a + b, 0),
          nullCount: args.length - present.length,
          presentCount: present.length,
          certainty: present.length / args.length
        };
      },

      /**
       * AVG_CODD - Average with NULL tracking (Codd semantics)
       * NULLs excluded from both numerator and denominator
       * @param {...*} args - Values to average
       * @returns {Object} { value, nullCount, presentCount, certainty }
       */
      AVG_CODD: (...args) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.avgWithNullTracking(args);
        }
        const present = args.filter(v => v !== null && v !== undefined && typeof v === 'number');
        return {
          value: present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : null,
          nullCount: args.length - present.length,
          presentCount: present.length,
          certainty: present.length / args.length
        };
      },

      /**
       * COUNT_ALL - COUNT(*) - counts all rows including NULLs
       * @param {...*} args - Values to count
       * @returns {number}
       */
      COUNT_ALL: (...args) => args.length,

      /**
       * COUNT_CODD - Count with full NULL tracking
       * @param {...*} args - Values to count
       * @returns {Object} { value, total, nullCount, presentCount }
       */
      COUNT_CODD: (...args) => {
        if (typeof EOAbsence !== 'undefined') {
          return EOAbsence.countWithNullTracking(args, 'present');
        }
        const nullCount = args.filter(v => v === null || v === undefined).length;
        return {
          value: args.length - nullCount,
          total: args.length,
          nullCount,
          presentCount: args.length - nullCount
        };
      },
    };
  }

  /**
   * Parse a formula string into an Abstract Syntax Tree (AST)
   * Uses LRU cache for frequently parsed formulas
   */
  parse(formula) {
    // Check cache first
    const cached = this._parseCache.get(formula);
    if (cached) {
      return { ...cached, dependencies: [...cached.dependencies] };
    }

    this.formula = formula;
    this.pos = 0;
    this.dependencies = new Set();

    try {
      const ast = this.parseExpression();
      const result = {
        ast,
        dependencies: Array.from(this.dependencies),
        valid: true,
        error: null
      };
      // Cache the result
      this._parseCache.set(formula, { ...result, dependencies: [...result.dependencies] });
      return result;
    } catch (error) {
      const result = {
        ast: null,
        dependencies: Array.from(this.dependencies),
        valid: false,
        error: error.message
      };
      // Don't cache errors - they might be transient
      return result;
    }
  }

  /**
   * Evaluate a formula with given field values
   */
  evaluate(formula, record = {}) {
    const parseResult = this.parse(formula);

    if (!parseResult.valid) {
      throw new Error(`Formula parse error: ${parseResult.error}`);
    }

    try {
      const result = this.evaluateNode(parseResult.ast, record);
      return {
        value: result,
        dependencies: parseResult.dependencies,
        context: this.createFormulaContext(formula, parseResult.dependencies),
        success: true,
        error: null
      };
    } catch (error) {
      return {
        value: null,
        dependencies: parseResult.dependencies,
        context: null,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create EO context schema for formula results
   */
  createFormulaContext(formula, dependencies) {
    return {
      method: 'derived',
      scale: 'individual',
      definition: this.sanitizeFormulaDefinition(formula),
      source: {
        system: 'formula',
        formula: formula,
        dependencies: dependencies
      },
      agent: {
        type: 'system',
        id: 'formula_engine',
        name: 'EO Formula Engine'
      }
    };
  }

  sanitizeFormulaDefinition(formula) {
    return formula
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .substring(0, 50);
  }

  /**
   * Evaluate an AST node
   */
  evaluateNode(node, record) {
    if (!node) return null;

    switch (node.type) {
      case 'literal':
        return node.value;

      case 'field':
        return this.getFieldValue(node.name, record);

      case 'function':
        return this.evaluateFunction(node.name, node.args, record);

      case 'unary':
        return this.evaluateUnary(node.operator, node.operand, record);

      case 'binary':
        return this.evaluateBinary(node.operator, node.left, node.right, record);

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  evaluateFunction(name, args, record) {
    const upperName = name.toUpperCase();
    const func = this.functions[upperName];
    if (!func) {
      throw new Error(`Unknown function: ${name}`);
    }

    // Short-circuit evaluation for IF/AND/OR (avoid evaluating unnecessary branches)
    switch (upperName) {
      case 'IF': {
        // IF(condition, trueVal, falseVal) - only evaluate the branch we need
        if (args.length < 2) throw new Error('IF requires at least 2 arguments');
        const condition = this.evaluateNode(args[0], record);
        if (condition) {
          return this.evaluateNode(args[1], record);
        } else {
          return args.length > 2 ? this.evaluateNode(args[2], record) : null;
        }
      }
      case 'AND': {
        // Short-circuit: return false as soon as we find a falsy value
        for (const arg of args) {
          if (!this.evaluateNode(arg, record)) {
            return false;
          }
        }
        return true;
      }
      case 'OR': {
        // Short-circuit: return true as soon as we find a truthy value
        for (const arg of args) {
          if (this.evaluateNode(arg, record)) {
            return true;
          }
        }
        return false;
      }
      default: {
        // Standard evaluation: evaluate all arguments first
        const evaluatedArgs = args.map(arg => this.evaluateNode(arg, record));
        return func(...evaluatedArgs);
      }
    }
  }

  evaluateUnary(operator, operand, record) {
    const value = this.evaluateNode(operand, record);

    switch (operator) {
      case '-': return -this.toNumber(value);
      case '+': return this.toNumber(value);
      case '!': return !value;
      default: throw new Error(`Unknown unary operator: ${operator}`);
    }
  }

  evaluateBinary(operator, left, right, record) {
    const leftVal = this.evaluateNode(left, record);
    const rightVal = this.evaluateNode(right, record);

    // In Codd mode, arithmetic with NULL propagates NULL
    if (this.coddMode) {
      const leftAbsent = this.isAbsent(leftVal);
      const rightAbsent = this.isAbsent(rightVal);

      // Arithmetic operators: NULL propagation
      if (['+', '-', '*', '/', '^', '%'].includes(operator)) {
        if (leftAbsent || rightAbsent) {
          return null;  // Codd: NULL + 5 = NULL
        }
      }

      // Comparison operators: three-valued logic
      if (['=', '!=', '<', '>', '<=', '>='].includes(operator)) {
        if (leftAbsent || rightAbsent) {
          return this.getUnknown();  // Codd: NULL = NULL → UNKNOWN
        }
      }
    }

    switch (operator) {
      case '+': return this.toNumber(leftVal) + this.toNumber(rightVal);
      case '-': return this.toNumber(leftVal) - this.toNumber(rightVal);
      case '*': return this.toNumber(leftVal) * this.toNumber(rightVal);
      case '/':
        const divisor = this.toNumber(rightVal);
        if (divisor === 0) {
          return this.coddMode ? null : (() => { throw new Error('Division by zero'); })();
        }
        return this.toNumber(leftVal) / divisor;
      case '^': return Math.pow(this.toNumber(leftVal), this.toNumber(rightVal));
      case '%': return this.toNumber(leftVal) % this.toNumber(rightVal);
      case '=': return leftVal === rightVal;
      case '!=': return leftVal !== rightVal;
      case '<': return this.toNumber(leftVal) < this.toNumber(rightVal);
      case '>': return this.toNumber(leftVal) > this.toNumber(rightVal);
      case '<=': return this.toNumber(leftVal) <= this.toNumber(rightVal);
      case '>=': return this.toNumber(leftVal) >= this.toNumber(rightVal);
      case '&': return String(leftVal ?? '') + String(rightVal ?? '');
      default: throw new Error(`Unknown binary operator: ${operator}`);
    }
  }

  getFieldValue(fieldName, record) {
    // Handle both direct field access and SUP-enabled cell access
    if (record[fieldName] !== undefined) {
      const value = record[fieldName];

      // If it's a SUP-enabled cell with multiple values, get dominant value
      if (value && typeof value === 'object' && value.values) {
        return this.getDominantValue(value);
      }

      return value;
    }

    return null;
  }

  getDominantValue(cell) {
    if (!cell.values || cell.values.length === 0) return null;
    if (cell.values.length === 1) return cell.values[0].value;

    // O(n) reduce to find most recent value instead of O(n log n) sort
    const mostRecent = cell.values.reduce((latest, current) => {
      const currentTime = new Date(current.timestamp).getTime();
      const latestTime = new Date(latest.timestamp).getTime();
      return currentTime > latestTime ? current : latest;
    });

    return mostRecent.value;
  }

  // Parsing methods

  parseExpression() {
    return this.parseComparison();
  }

  parseComparison() {
    let left = this.parseAddSub();

    while (this.matchAny(['=', '!=', '<', '>', '<=', '>='])) {
      const operator = this.previous();
      const right = this.parseAddSub();
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  parseAddSub() {
    let left = this.parseMulDiv();

    while (this.matchAny(['+', '-', '&'])) {
      const operator = this.previous();
      const right = this.parseMulDiv();
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  parseMulDiv() {
    let left = this.parsePower();

    while (this.matchAny(['*', '/', '%'])) {
      const operator = this.previous();
      const right = this.parsePower();
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  parsePower() {
    let left = this.parseUnary();

    if (this.matchAny(['^'])) {
      const operator = this.previous();
      const right = this.parsePower(); // Right associative
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  parseUnary() {
    if (this.matchAny(['-', '+', '!'])) {
      const operator = this.previous();
      const operand = this.parseUnary();
      return { type: 'unary', operator, operand };
    }

    return this.parsePrimary();
  }

  parsePrimary() {
    this.skipWhitespace();

    // Number literal
    if (this.isDigit(this.peek())) {
      return this.parseNumber();
    }

    // String literal
    if (this.peek() === '"' || this.peek() === "'") {
      return this.parseString();
    }

    // Field reference {FieldName}
    if (this.peek() === '{') {
      return this.parseField();
    }

    // Function call or identifier
    if (this.isAlpha(this.peek())) {
      return this.parseFunctionOrIdentifier();
    }

    // Parentheses
    if (this.match('(')) {
      const expr = this.parseExpression();
      if (!this.match(')')) {
        throw new Error('Expected closing parenthesis');
      }
      return expr;
    }

    throw new Error(`Unexpected character: ${this.peek()}`);
  }

  parseNumber() {
    let numStr = '';

    while (this.isDigit(this.peek()) || this.peek() === '.') {
      numStr += this.advance();
    }

    return { type: 'literal', value: parseFloat(numStr) };
  }

  parseString() {
    const quote = this.advance(); // ' or "
    let str = '';

    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        if (!this.isAtEnd()) {
          str += this.advance();
        }
      } else {
        str += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new Error('Unterminated string');
    }

    this.advance(); // Closing quote
    return { type: 'literal', value: str };
  }

  parseField() {
    this.advance(); // {
    let fieldName = '';

    while (!this.isAtEnd() && this.peek() !== '}') {
      fieldName += this.advance();
    }

    if (this.isAtEnd()) {
      throw new Error('Unterminated field reference');
    }

    this.advance(); // }

    fieldName = fieldName.trim();
    this.dependencies.add(fieldName);

    return { type: 'field', name: fieldName };
  }

  parseFunctionOrIdentifier() {
    let name = '';

    while (this.isAlphaNumeric(this.peek())) {
      name += this.advance();
    }

    this.skipWhitespace();

    // Check for function call
    if (this.peek() === '(') {
      this.advance(); // (
      const args = [];

      this.skipWhitespace();

      if (this.peek() !== ')') {
        do {
          this.skipWhitespace();
          args.push(this.parseExpression());
          this.skipWhitespace();
        } while (this.match(','));
      }

      if (!this.match(')')) {
        throw new Error('Expected closing parenthesis in function call');
      }

      return { type: 'function', name, args };
    }

    // Boolean literals
    if (name.toUpperCase() === 'TRUE') {
      return { type: 'literal', value: true };
    }
    if (name.toUpperCase() === 'FALSE') {
      return { type: 'literal', value: false };
    }

    throw new Error(`Unexpected identifier: ${name}`);
  }

  // Helper methods

  match(char) {
    this.skipWhitespace();
    if (this.peek() === char) {
      this.advance();
      return true;
    }
    return false;
  }

  matchAny(chars) {
    this.skipWhitespace();

    for (const char of chars) {
      if (this.formula.substring(this.pos, this.pos + char.length) === char) {
        this.pos += char.length;
        return true;
      }
    }

    return false;
  }

  previous() {
    // Get the last matched operator
    const operators = ['<=', '>=', '!=', '=', '<', '>', '+', '-', '*', '/', '^', '%', '&'];
    for (const op of operators) {
      if (this.formula.substring(this.pos - op.length, this.pos) === op) {
        return op;
      }
    }
    return null;
  }

  peek() {
    if (this.isAtEnd()) return '\0';
    return this.formula[this.pos];
  }

  advance() {
    if (this.isAtEnd()) return '\0';
    return this.formula[this.pos++];
  }

  skipWhitespace() {
    while (!this.isAtEnd() && /\s/.test(this.peek())) {
      this.advance();
    }
  }

  isAtEnd() {
    return this.pos >= this.formula.length;
  }

  isDigit(char) {
    return /[0-9]/.test(char);
  }

  isAlpha(char) {
    return /[a-zA-Z_]/.test(char);
  }

  isAlphaNumeric(char) {
    return /[a-zA-Z0-9_]/.test(char);
  }

  /**
   * Convert value to number
   * In Codd mode: NULL → NULL (propagation)
   * In legacy mode: NULL → 0 (backward compatible)
   * @param {*} value - Value to convert
   * @returns {number|null}
   */
  toNumber(value) {
    // Codd mode: propagate NULL
    if (this.coddMode && this.isAbsent(value)) {
      return null;
    }

    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.getTime();

    const num = parseFloat(value);
    // Legacy mode returns 0 for NaN, Codd mode returns null
    if (isNaN(num)) {
      return this.coddMode ? null : 0;
    }
    return num;
  }

  /**
   * Strict Codd-compliant number conversion
   * Always propagates NULL regardless of mode
   * @param {*} value - Value to convert
   * @returns {number|null}
   */
  toNumberStrict(value) {
    if (this.isAbsent(value)) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.getTime();
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') return new Date(value);
    return new Date();
  }
}

// Export for use in browser and other modules
if (typeof window !== 'undefined') {
  window.EOFormulaEngine = EOFormulaEngine;
}
if (typeof global !== 'undefined') {
  global.EOFormulaEngine = EOFormulaEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOFormulaEngine;
}
