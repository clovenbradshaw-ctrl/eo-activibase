/**
 * Formula Field Service
 * Handles formula evaluation for records with field name mapping
 */

const FormulaEngine = typeof require !== 'undefined'
  ? require('./formula_engine')
  : (typeof window !== 'undefined' ? window.FormulaEngine : null);

class FormulaFieldService {
  constructor() {
    this.engine = new FormulaEngine();
  }

  /**
   * Evaluate a formula for a specific record
   *
   * @param {string} formula - The formula to evaluate (e.g., "={Price} * {Quantity}")
   * @param {Object} record - Record with field values
   * @param {Array} schema - Array of field definitions with id, name, displayName, etc.
   * @returns {Object} Result with success, value, or error
   */
  evaluateForRecord(formula, record = {}, schema = []) {
    if (!formula || typeof formula !== 'string') {
      return {
        success: false,
        error: 'Formula is required and must be a string'
      };
    }

    try {
      // Build a map of all possible field name variations to their canonical IDs
      const fieldMap = this.buildFieldMap(schema, record);

      // Prepare field values for the engine
      // The engine expects field names as keys, so we map record values to those names
      const fieldValues = this.prepareFieldValues(record, fieldMap);

      // Set the field values in the engine
      this.engine.setFields(fieldValues);

      // Get field references from the formula
      const refs = this.engine.getFieldReferences(formula);

      // Validate all referenced fields exist
      const missingFields = refs.filter(ref => !(ref in fieldValues));
      if (missingFields.length > 0) {
        return {
          success: false,
          error: `Missing fields: ${missingFields.join(', ')}`,
          missingFields
        };
      }

      // Evaluate the formula
      const result = this.engine.evaluate(formula);

      return {
        success: true,
        value: result,
        formula: formula
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build a map of field names to their values
   * Handles different field name formats (id, name, displayName, etc.)
   */
  buildFieldMap(schema = [], record = {}) {
    const map = new Map();

    // Map schema field names to record keys
    for (const field of schema) {
      if (!field) continue;

      const fieldId = field.id;
      const recordValue = record[fieldId];

      // Add all possible field name variations pointing to the same value
      if (field.name) {
        map.set(field.name, { id: fieldId, value: recordValue });
      }
      if (field.displayName && field.displayName !== field.name) {
        map.set(field.displayName, { id: fieldId, value: recordValue });
      }
      if (field.display_name && field.display_name !== field.name) {
        map.set(field.display_name, { id: fieldId, value: recordValue });
      }
      if (field.label && field.label !== field.name) {
        map.set(field.label, { id: fieldId, value: recordValue });
      }
      // Also map by ID
      if (fieldId) {
        map.set(fieldId, { id: fieldId, value: recordValue });
      }
    }

    // Also add any record keys that weren't in the schema
    for (const [key, value] of Object.entries(record)) {
      if (!map.has(key)) {
        map.set(key, { id: key, value: value });
      }
    }

    return map;
  }

  /**
   * Prepare field values for the formula engine
   */
  prepareFieldValues(record, fieldMap) {
    const values = {};

    // Add all field names from the map
    for (const [fieldName, fieldInfo] of fieldMap.entries()) {
      values[fieldName] = fieldInfo.value;
    }

    return values;
  }

  /**
   * Validate a formula without evaluating it
   */
  validateFormula(formula, schema = []) {
    if (!formula || typeof formula !== 'string') {
      return {
        valid: false,
        errors: ['Formula is required and must be a string']
      };
    }

    const errors = [];

    try {
      // Get field references
      const refs = this.engine.getFieldReferences(formula);

      // Check if all fields exist in schema
      const schemaFieldNames = new Set();
      for (const field of schema) {
        if (field.name) schemaFieldNames.add(field.name);
        if (field.displayName) schemaFieldNames.add(field.displayName);
        if (field.id) schemaFieldNames.add(field.id);
      }

      const unknownFields = refs.filter(ref => !schemaFieldNames.has(ref));
      if (unknownFields.length > 0) {
        errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
      }

      // Try to parse the formula (but don't evaluate)
      // We'll do a simple syntax check
      const cleaned = formula.trim().replace(/^=/, '');
      if (!cleaned) {
        errors.push('Formula is empty');
      }

    } catch (error) {
      errors.push(error.message);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get list of available functions
   */
  getAvailableFunctions() {
    return Object.keys(this.engine.functions).sort();
  }

  /**
   * Get help for a specific function
   */
  getFunctionHelp(functionName) {
    const funcMap = {
      SUM: { description: 'Sum all arguments', syntax: 'SUM(number1, number2, ...)' },
      AVERAGE: { description: 'Average of all arguments', syntax: 'AVERAGE(number1, number2, ...)' },
      MIN: { description: 'Minimum value', syntax: 'MIN(number1, number2, ...)' },
      MAX: { description: 'Maximum value', syntax: 'MAX(number1, number2, ...)' },
      ROUND: { description: 'Round to decimal places', syntax: 'ROUND(number, decimals)' },
      ABS: { description: 'Absolute value', syntax: 'ABS(number)' },
      POWER: { description: 'Raise to power', syntax: 'POWER(base, exponent)' },
      SQRT: { description: 'Square root', syntax: 'SQRT(number)' },
      CONCATENATE: { description: 'Join text strings', syntax: 'CONCATENATE(text1, text2, ...)' },
      UPPER: { description: 'Convert to uppercase', syntax: 'UPPER(text)' },
      LOWER: { description: 'Convert to lowercase', syntax: 'LOWER(text)' },
      TRIM: { description: 'Remove whitespace', syntax: 'TRIM(text)' },
      LEFT: { description: 'Left substring', syntax: 'LEFT(text, count)' },
      RIGHT: { description: 'Right substring', syntax: 'RIGHT(text, count)' },
      MID: { description: 'Middle substring', syntax: 'MID(text, start, count)' },
      LEN: { description: 'Length of text', syntax: 'LEN(text)' },
      IF: { description: 'Conditional value', syntax: 'IF(condition, trueValue, falseValue)' },
      AND: { description: 'All conditions true', syntax: 'AND(condition1, condition2, ...)' },
      OR: { description: 'Any condition true', syntax: 'OR(condition1, condition2, ...)' },
      NOT: { description: 'Logical negation', syntax: 'NOT(value)' },
      NOW: { description: 'Current date and time', syntax: 'NOW()' },
      TODAY: { description: 'Current date', syntax: 'TODAY()' },
      YEAR: { description: 'Year from date', syntax: 'YEAR(date)' },
      MONTH: { description: 'Month from date', syntax: 'MONTH(date)' },
      DAY: { description: 'Day from date', syntax: 'DAY(date)' },
      COUNT: { description: 'Count numeric values', syntax: 'COUNT(value1, value2, ...)' },
      COUNTA: { description: 'Count non-empty values', syntax: 'COUNTA(value1, value2, ...)' }
    };

    return funcMap[functionName.toUpperCase()] || { description: 'Unknown function', syntax: '' };
  }

  /**
   * Get suggestions for field names (for autocomplete)
   */
  getFieldSuggestions(schema = [], filter = '') {
    const suggestions = [];
    const filterLower = filter.toLowerCase();

    for (const field of schema) {
      if (!field) continue;

      // Don't suggest formula fields themselves
      if (field.type === 'FORMULA') continue;

      const name = field.displayName || field.name || field.id;
      if (!name) continue;

      if (!filter || name.toLowerCase().includes(filterLower)) {
        suggestions.push({
          name: name,
          type: field.type || 'TEXT',
          id: field.id
        });
      }
    }

    return suggestions;
  }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormulaFieldService;
}

if (typeof window !== 'undefined') {
  window.FormulaFieldService = FormulaFieldService;
}
