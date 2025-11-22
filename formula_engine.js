/**
 * Formula Engine - Simple and Reliable
 * Evaluates spreadsheet-style formulas with field references and functions
 */

class FormulaEngine {
  constructor() {
    this.fields = {};
    this.functions = this.initFunctions();
  }

  /**
   * Set field values for evaluation
   */
  setField(name, value) {
    this.fields[name] = value;
  }

  setFields(fieldsObject) {
    this.fields = { ...this.fields, ...fieldsObject };
  }

  getField(name) {
    return this.fields[name];
  }

  /**
   * Main evaluation method
   */
  evaluate(formula) {
    if (!formula || typeof formula !== 'string') {
      throw new Error('Formula must be a non-empty string');
    }

    try {
      // Clean the formula
      let cleaned = formula.trim();
      if (cleaned.startsWith('=')) {
        cleaned = cleaned.substring(1).trim();
      }

      // Replace field references with values
      let processed = this.replaceFieldReferences(cleaned);

      // Evaluate the expression
      return this.evaluateExpression(processed);
    } catch (error) {
      throw new Error(`Formula error: ${error.message}`);
    }
  }

  /**
   * Replace {Field Name} with actual values
   */
  replaceFieldReferences(formula) {
    let result = formula;

    // Find all {FieldName} patterns
    const fieldRefs = formula.match(/\{([^}]+)\}/g) || [];

    for (const ref of fieldRefs) {
      const fieldName = ref.slice(1, -1).trim();

      if (!(fieldName in this.fields)) {
        throw new Error(`Unknown field: ${fieldName}`);
      }

      const value = this.fields[fieldName];
      const serialized = this.serializeValue(value);
      result = result.replace(ref, serialized);
    }

    return result;
  }

  /**
   * Serialize a value for safe insertion into formula
   */
  serializeValue(value) {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return JSON.stringify(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date) {
      return `new Date("${value.toISOString()}")`;
    }
    if (Array.isArray(value)) {
      return `[${value.map(v => this.serializeValue(v)).join(',')}]`;
    }
    return JSON.stringify(value);
  }

  /**
   * Evaluate the processed expression
   */
  evaluateExpression(expr) {
    // Create function with access to formula functions
    const funcNames = Object.keys(this.functions);
    const funcValues = Object.values(this.functions);

    // Shadow dangerous globals
    const shadowedGlobals = [
      'window', 'global', 'globalThis', 'document',
      'process', 'require', 'module', 'exports'
    ].map(name => `const ${name} = undefined;`).join(' ');

    const fn = new Function(
      ...funcNames,
      `"use strict"; ${shadowedGlobals} return (${expr});`
    );

    return fn(...funcValues);
  }

  /**
   * Get list of field references in a formula
   */
  getFieldReferences(formula) {
    const refs = new Set();
    const matches = formula.match(/\{([^}]+)\}/g) || [];

    for (const match of matches) {
      const fieldName = match.slice(1, -1).trim();
      refs.add(fieldName);
    }

    return Array.from(refs);
  }

  /**
   * Initialize formula functions
   */
  initFunctions() {
    return {
      // Math Functions
      SUM: (...args) => args.reduce((sum, val) => sum + Number(val || 0), 0),

      AVERAGE: (...args) => {
        const nums = args.filter(v => v !== null && v !== undefined);
        return nums.length ? nums.reduce((s, v) => s + Number(v), 0) / nums.length : 0;
      },

      MIN: (...args) => Math.min(...args.map(Number)),

      MAX: (...args) => Math.max(...args.map(Number)),

      ROUND: (value, decimals = 0) => {
        const multiplier = Math.pow(10, decimals);
        return Math.round(Number(value) * multiplier) / multiplier;
      },

      ABS: (value) => Math.abs(Number(value)),

      POWER: (base, exponent) => Math.pow(Number(base), Number(exponent)),

      SQRT: (value) => Math.sqrt(Number(value)),

      // Text Functions
      CONCATENATE: (...args) => args.map(v => String(v ?? '')).join(''),

      UPPER: (str) => String(str).toUpperCase(),

      LOWER: (str) => String(str).toLowerCase(),

      TRIM: (str) => String(str).trim(),

      LEFT: (str, count) => String(str).substring(0, count),

      RIGHT: (str, count) => {
        const s = String(str);
        return s.substring(s.length - count);
      },

      MID: (str, start, count) => String(str).substring(start - 1, start - 1 + count),

      LEN: (str) => String(str).length,

      FIND: (search, text, start = 0) => {
        const index = String(text).indexOf(String(search), start);
        return index === -1 ? 0 : index;
      },

      SUBSTITUTE: (text, oldText, newText) => {
        return String(text).split(String(oldText)).join(String(newText));
      },

      // Logical Functions
      IF: (condition, trueValue, falseValue) => condition ? trueValue : falseValue,

      AND: (...args) => args.every(Boolean),

      OR: (...args) => args.some(Boolean),

      NOT: (value) => !value,

      // Date Functions
      NOW: () => new Date(),

      TODAY: () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      },

      YEAR: (date) => new Date(date).getFullYear(),

      MONTH: (date) => new Date(date).getMonth() + 1,

      DAY: (date) => new Date(date).getDate(),

      HOUR: (date) => new Date(date).getHours(),

      MINUTE: (date) => new Date(date).getMinutes(),

      SECOND: (date) => new Date(date).getSeconds(),

      DATEADD: (date, count, unit) => {
        const d = new Date(date);
        const c = Number(count);

        switch(String(unit).toLowerCase()) {
          case 'years': d.setFullYear(d.getFullYear() + c); break;
          case 'months': d.setMonth(d.getMonth() + c); break;
          case 'days': d.setDate(d.getDate() + c); break;
          case 'hours': d.setHours(d.getHours() + c); break;
          case 'minutes': d.setMinutes(d.getMinutes() + c); break;
          default: d.setDate(d.getDate() + c);
        }

        return d;
      },

      // Array Functions
      ARRAYJOIN: (array, separator) => {
        if (!Array.isArray(array)) return '';
        return array.map(v => String(v ?? '')).join(separator);
      },

      // Counting Functions
      COUNT: (...args) => args.filter(v => typeof v === 'number' || !isNaN(Number(v))).length,

      COUNTA: (...args) => args.filter(v => v !== null && v !== undefined && v !== '').length,

      // Other Functions
      BLANK: () => null,

      VALUE: (text) => {
        const cleaned = String(text).replace(/[$,]/g, '');
        return parseFloat(cleaned) || 0;
      }
    };
  }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormulaEngine;
}

if (typeof window !== 'undefined') {
  window.FormulaEngine = FormulaEngine;
}
