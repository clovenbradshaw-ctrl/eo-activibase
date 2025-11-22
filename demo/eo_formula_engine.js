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
 */

class EOFormulaEngine {
  constructor() {
    this.functions = this.initializeFunctions();
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
    };
  }

  /**
   * Parse a formula string into an Abstract Syntax Tree (AST)
   */
  parse(formula) {
    this.formula = formula;
    this.pos = 0;
    this.dependencies = new Set();

    try {
      const ast = this.parseExpression();
      return {
        ast,
        dependencies: Array.from(this.dependencies),
        valid: true,
        error: null
      };
    } catch (error) {
      return {
        ast: null,
        dependencies: Array.from(this.dependencies),
        valid: false,
        error: error.message
      };
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
    const func = this.functions[name.toUpperCase()];
    if (!func) {
      throw new Error(`Unknown function: ${name}`);
    }

    const evaluatedArgs = args.map(arg => this.evaluateNode(arg, record));
    return func(...evaluatedArgs);
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

    switch (operator) {
      case '+': return this.toNumber(leftVal) + this.toNumber(rightVal);
      case '-': return this.toNumber(leftVal) - this.toNumber(rightVal);
      case '*': return this.toNumber(leftVal) * this.toNumber(rightVal);
      case '/':
        if (this.toNumber(rightVal) === 0) throw new Error('Division by zero');
        return this.toNumber(leftVal) / this.toNumber(rightVal);
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

    // Simple strategy: use most recent value
    const sorted = [...cell.values].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    return sorted[0].value;
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

  toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.getTime();

    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    return num;
  }

  toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') return new Date(value);
    return new Date();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOFormulaEngine;
}
