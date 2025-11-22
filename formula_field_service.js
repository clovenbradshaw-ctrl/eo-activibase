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

  getFieldAliases(field = {}) {
    const aliases = new Set();
    const aliasKeys = [
      'name',
      'displayName',
      'display_name',
      'prettyName',
      'pretty_name',
      'label'
    ];

    aliasKeys.forEach((key) => {
      const value = field[key];
      if (typeof value === 'string' && value.trim()) {
        aliases.add(value.trim());
      }
    });

    if (typeof field?.config?.label === 'string' && field.config.label.trim()) {
      aliases.add(field.config.label.trim());
    }

    return Array.from(aliases);
  }

  normalizeFieldReference(fieldName) {
    if (!fieldName) return '';
    return `{${fieldName}}`;
  }

  normalizeFormula(formula) {
    if (!formula) return '';
    return formula.trim().replace(/^=/, '').trim();
  }

  buildFieldLookup(schemaFields = []) {
    const lookup = {};

    schemaFields.forEach((field) => {
      if (!field) return;
      this.getFieldAliases(field).forEach((alias) => {
        lookup[alias.toLowerCase()] = field;
      });
      if (field.id) {
        lookup[String(field.id).toLowerCase()] = field;
      }
    });

    return lookup;
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

  buildFieldReferenceMap(schemaFields = [], record = {}) {
    const map = new Map();

    schemaFields.forEach((field) => {
      this.getFieldAliases(field).forEach((alias) => {
        map.set(alias, field.id);
      });
      if (field?.id) {
        map.set(field.id, field.id);
      }
    });

    Object.keys(record).forEach((key) => {
      if (!map.has(key)) {
        map.set(key, key);
      }
    });

    return map;
  }

  replaceFieldNamesWithIds(formula, fieldMap = new Map()) {
    let updated = formula;

    fieldMap.forEach((targetId, sourceKey) => {
      if (!sourceKey || sourceKey === targetId) return;
      const escaped = sourceKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\{${escaped}\\}`, 'g');
      updated = updated.replace(pattern, `{${targetId}}`);
    });

    return updated;
  }

  replaceBracedReferencesWithIds(formula, lookup = {}) {
    let unknownRef = null;
    const resolvedFormula = formula.replace(/\{([^}]+)\}/g, (match, insideBraces) => {
      const ref = insideBraces.trim();
      const normalizedRef = ref.toLowerCase();
      const field = lookup[normalizedRef];

      if (!field) {
        unknownRef = ref;
        return match;
      }

      return `{${field.id}}`;
    });

    return { resolvedFormula, unknownRef };
  }

  levenshteinDistance(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[a.length][b.length];
  }

  findClosestFieldName(ref = '', schemaFields = []) {
    const normalizedRef = ref.toLowerCase();
    let closest = null;
    let bestDistance = Infinity;

    schemaFields.forEach((field) => {
      if (!field?.name) return;
      const distance = this.levenshteinDistance(normalizedRef, field.name.toLowerCase());
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = field.name;
      }
    });

    return bestDistance <= 3 ? closest : null;
  }

  normalizeRecordKeys(record = {}, schemaFields = []) {
    const normalized = {};
    const fieldLookup = this.buildFieldLookup(schemaFields);

    // First pass: copy values using field IDs
    Object.keys(record).forEach((key) => {
      const lowerKey = key.toLowerCase();
      const field = fieldLookup[lowerKey];

      if (field && field.id) {
        // Map display name/alias to field ID
        normalized[field.id] = record[key];
      } else {
        // Keep original key if no field mapping found
        normalized[key] = record[key];
      }
    });

    return normalized;
  }

  evaluateForRecord(formula, record = {}, schemaFields = []) {
    const cleanedFormula = this.normalizeFormula(formula);
    if (!cleanedFormula) {
      return {
        success: false,
        error: {
          code: 'EMPTY_FORMULA',
          message: 'Formula is empty'
        },
        warnings: [],
        normalizedFormula: ''
      };
    }

    // Normalize record keys to use field IDs instead of display names
    const normalizedRecord = this.normalizeRecordKeys(record, schemaFields);

    const fieldMap = this.buildFieldReferenceMap(schemaFields, normalizedRecord);
    const normalizedFormula = this.ensureBracedReferences(
      cleanedFormula,
      Array.from(fieldMap.keys())
    );

    const fieldLookup = this.buildFieldLookup(schemaFields);
    const { resolvedFormula, unknownRef } = this.replaceBracedReferencesWithIds(normalizedFormula, fieldLookup);

    if (unknownRef) {
      const suggestion = this.findClosestFieldName(unknownRef, schemaFields);
      return {
        success: false,
        error: {
          code: 'UNKNOWN_FIELD',
          message: suggestion
            ? `Unknown field "${unknownRef}". Did you mean "${suggestion}"?`
            : `Unknown field "${unknownRef}".`
        },
        warnings: [],
        normalizedFormula
      };
    }

    const warnings = this.collectOperatorWarnings(resolvedFormula);
    const missingFields = this.validateFields(resolvedFormula, normalizedRecord);

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

    this.engine.setFields(normalizedRecord);

    try {
      const result = this.engine.evaluate(resolvedFormula);
      const returnType = this.inferReturnType(resolvedFormula);
      return {
        success: true,
        result,
        preview: this.formatPreview(result, returnType),
        returnType,
        warnings,
        normalizedFormula: resolvedFormula
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

  getFieldSuggestions(schemaFields = [], filterText = '') {
    const normalizedFilter = filterText.toLowerCase();

    return schemaFields.filter((field) => {
      if (!field?.name) return false;
      const isVirtual = field.virtual || field.isVirtual || field.type === 'VIRTUAL';
      const isHidden = field.hidden || field.isHidden || field.visibility === 'hidden';
      const isFormula = field.type === 'FORMULA';

      if (isVirtual || isHidden || isFormula) return false;

      if (!normalizedFilter) return true;
      return field.name.toLowerCase().includes(normalizedFilter);
    });
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
