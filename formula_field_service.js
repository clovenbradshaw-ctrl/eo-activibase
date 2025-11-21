const FormulaEngine = typeof require !== 'undefined'
  ? require('./formula_engine')
  : (typeof window !== 'undefined' ? window.FormulaEngine : null);

const formulaSpec = typeof require !== 'undefined'
  ? require('./formula_language.json')
  : (typeof window !== 'undefined' ? window.FormulaLanguageSpec : null);

class FormulaFieldService {
  constructor({ engine = new FormulaEngine(), spec = formulaSpec } = {}) {
    if (!engine) {
      throw new Error('FormulaEngine is required for FormulaFieldService');
    }

    this.engine = engine;
    this.spec = spec || { functions: {}, operators: [], field_reference_syntax: '' };
    this.functionSpecMap = this.buildFunctionSpecMap();
  }

  buildFunctionSpecMap() {
    const map = new Map();
    Object.values(this.spec.functions).forEach((group) => {
      group.forEach((fn) => {
        map.set(fn.name.toUpperCase(), fn);
      });
    });
    return map;
  }

  normalizeFieldReference(fieldName) {
    if (!fieldName) return '';
    return `{${fieldName}}`;
  }

  ensureBracedReferences(formula, knownFields = []) {
    let normalized = formula;
    knownFields.forEach((field) => {
      const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\b`, 'g');
      normalized = normalized.replace(pattern, (match, offset, source) => {
        const before = source[offset - 1];
        const after = source[offset + match.length];
        if (before === '{' && after === '}') {
          return match;
        }
        return `{${field}}`;
      });
    });
    return normalized;
  }

  collectOperatorWarnings(formula) {
    const warnings = [];
    if (/([^&])&([^&])/.test(formula)) {
      warnings.push('Using & concatenation will coerce values to strings. Confirm this is intended.');
    }
    if (/([^=!<>])=([^=])/.test(formula)) {
      warnings.push('Single = compares with type coercion. Consider explicit equality for clarity.');
    }
    return warnings;
  }

  inferReturnType(formula) {
    const match = formula.match(/^\s*([A-Z_]+)\s*\(/i);
    if (!match) return null;
    const fnSpec = this.functionSpecMap.get(match[1].toUpperCase());
    return fnSpec ? fnSpec.return_type : null;
  }

  formatPreview(result, typeHint) {
    if (result === null || result === undefined) return '';
    if (typeHint === 'number') {
      const numeric = Number(result);
      return Number.isNaN(numeric) ? String(result) : new Intl.NumberFormat().format(numeric);
    }
    if (typeHint === 'date' || result instanceof Date) {
      const dateValue = result instanceof Date ? result : new Date(result);
      return Number.isNaN(dateValue.getTime()) ? String(result) : dateValue.toLocaleString();
    }
    if (typeHint === 'boolean') {
      return Boolean(result).toString();
    }
    return String(result);
  }

  validateFields(formula, recordFields) {
    const references = this.engine.getFieldReferences(formula);
    const missing = [];
    [...references.braced, ...references.bare].forEach((name) => {
      if (!Object.prototype.hasOwnProperty.call(recordFields, name)) {
        missing.push(name);
      }
    });
    return missing;
  }

  evaluateForRecord(formula, record = {}) {
    const normalizedFormula = this.ensureBracedReferences(formula, Object.keys(record));
    const warnings = this.collectOperatorWarnings(normalizedFormula);
    const missingFields = this.validateFields(normalizedFormula, record);

    if (missingFields.length) {
      return {
        success: false,
        error: {
          code: 'MISSING_FIELD',
          message: `Missing field values: ${missingFields.join(', ')}`,
          fields: missingFields
        },
        warnings,
        normalizedFormula
      };
    }

    this.engine.setFields(record);

    try {
      const result = this.engine.evaluate(normalizedFormula);
      const returnType = this.inferReturnType(normalizedFormula);
      return {
        success: true,
        result,
        preview: this.formatPreview(result, returnType),
        returnType,
        warnings,
        normalizedFormula
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EVALUATION_ERROR',
          message: error.message
        },
        warnings,
        normalizedFormula
      };
    }
  }

  getAutocompleteEntries() {
    return {
      referenceSyntax: this.spec.field_reference_syntax,
      operators: this.spec.operators,
      functions: this.spec.functions
    };
  }

  registerHelper(name, implementation, specEntry) {
    this.engine.functions[name] = implementation;
    if (specEntry) {
      const category = specEntry.category || 'custom';
      if (!this.spec.functions[category]) {
        this.spec.functions[category] = [];
      }
      this.spec.functions[category].push({ ...specEntry, name });
      this.functionSpecMap.set(name.toUpperCase(), { ...specEntry, name });
    }
  }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = FormulaFieldService;
}

if (typeof window !== 'undefined') {
  window.FormulaFieldService = FormulaFieldService;
}
