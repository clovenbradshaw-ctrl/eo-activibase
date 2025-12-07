/**
 * EO Rollup Engine (v2)
 *
 * Unified Lookup/Rollup system integrated with EOAtomicOperators.
 *
 * KEY CONCEPT: A lookup becomes a rollup when drawn from a multipick linked record.
 * - Single link (cardinality: 'one') -> Lookup (returns single value)
 * - Multi link (cardinality: 'many') -> Rollup (returns array by default)
 *
 * ARCHITECTURE FOR AI CODERS:
 * ===========================
 *
 * 1. UNIFIED DATA MODEL
 *    Instead of separate "lookup" and "rollup" concepts, we have:
 *    - DerivedField: A field whose value comes from linked records
 *    - The behavior (single vs array vs aggregated) depends on:
 *      a) Link cardinality (one vs many)
 *      b) Output mode (array vs aggregated)
 *      c) Aggregation function (if aggregated)
 *
 * 2. OUTPUT MODES
 *    - 'single': Returns single value (only valid for cardinality: 'one')
 *    - 'array': Returns array of all linked values (default for cardinality: 'many')
 *    - 'aggregated': Applies aggregation function to produce single value
 *
 * 3. AGGREGATION FUNCTIONS
 *    All aggregations are atomic operators from EOAtomicOperators:
 *    - SUM, AVG, COUNT, MIN, MAX (numeric)
 *    - ARRAY_JOIN, UNIQUE, FIRST, LAST (any type)
 *
 * 4. EO CONTEXT PROPAGATION
 *    - Lookup/single: method='derived', scale from source
 *    - Array output: method='derived', scale='collective'
 *    - Aggregated: method='aggregated', scale='collective'
 *
 * BACKWARD COMPATIBILITY:
 * =======================
 * The original evaluate() signature is still supported for existing rollup configs.
 */

const EOCRollupEngine = {

  // ===========================================
  // CORE EVALUATION
  // ===========================================

  /**
   * Evaluate a derived field (unified lookup/rollup)
   *
   * Supports both old format (aggregation required) and new format (outputMode)
   *
   * @param {Object} config - Derived field configuration
   * @param {string} config.sourceFieldId - The LINK_RECORD field ID
   * @param {string} config.targetSetId - The linked set ID
   * @param {string} config.targetFieldId - The field to pull from linked records
   * @param {string} [config.outputMode] - 'single' | 'array' | 'aggregated' (new format)
   * @param {string} [config.aggregation] - Aggregation function ID
   * @param {Object} record - The source record
   * @param {Object} state - Global application state
   * @returns {any|Object} Value or { value, context, linkedCount } for new format
   */
  evaluate(config, record, state) {
    const {
      sourceFieldId,
      targetSetId,
      targetFieldId,
      outputMode,
      aggregation
    } = config;

    // Get linked record IDs
    const linkedRecordIds = this.getLinkedRecordIds(record, sourceFieldId);

    // Detect if using new format (has outputMode) or old format
    const isNewFormat = outputMode !== undefined;

    // Handle empty links
    if (!linkedRecordIds || linkedRecordIds.length === 0) {
      if (isNewFormat) {
        return {
          value: this.getEmptyValue(outputMode, aggregation),
          context: this.createContext(config, 0),
          linkedCount: 0
        };
      }
      return this.getEmptyValueLegacy(aggregation);
    }

    // Get target set
    const targetSet = state.sets.get(targetSetId);
    if (!targetSet) {
      if (isNewFormat) {
        return {
          value: this.getEmptyValue(outputMode, aggregation),
          context: this.createContext(config, 0),
          linkedCount: 0,
          error: `Target set not found: ${targetSetId}`
        };
      }
      return this.getEmptyValueLegacy(aggregation);
    }

    // Extract values from linked records
    const values = this.extractLinkedValues(linkedRecordIds, targetSet, targetFieldId);

    // New format: handle outputMode
    if (isNewFormat) {
      let result;
      if (outputMode === 'single') {
        result = values.length > 0 ? values[0] : null;
      } else if (outputMode === 'array') {
        result = values;
      } else if (outputMode === 'aggregated' && aggregation) {
        result = this.applyAggregation(values, aggregation);
      } else {
        result = values;
      }

      return {
        value: result,
        context: this.createContext(config, linkedRecordIds.length, values),
        linkedCount: linkedRecordIds.length
      };
    }

    // Legacy format: apply aggregation directly
    return this.aggregate(values, aggregation);
  },

  /**
   * Get linked record IDs from a link field
   */
  getLinkedRecordIds(record, fieldId) {
    const value = record[fieldId];

    if (!value) return [];

    // Handle SUP-enabled cells
    if (value && typeof value === 'object' && value.values) {
      const dominant = this.getDominantSUPValue(value);
      return this.normalizeToArray(dominant);
    }

    return this.normalizeToArray(value);
  },

  /**
   * Normalize value to array of IDs
   */
  normalizeToArray(value) {
    if (Array.isArray(value)) {
      return value.filter(id => typeof id === 'string' && id.length > 0);
    }

    if (typeof value === 'string' && value.length > 0) {
      return [value];
    }

    return [];
  },

  /**
   * Extract values from linked records
   */
  extractLinkedValues(recordIds, targetSet, targetFieldId) {
    const values = [];

    for (const recordId of recordIds) {
      const linkedRecord = targetSet.records.get(recordId);
      if (!linkedRecord) continue;

      let value = linkedRecord[targetFieldId];

      // Handle SUP-enabled cells
      if (value && typeof value === 'object' && value.values) {
        value = this.getDominantSUPValue(value);
      }

      // Include non-empty values
      if (value !== null && value !== undefined && value !== '') {
        values.push(value);
      }
    }

    return values;
  },

  /**
   * Get dominant value from SUP cell
   */
  getDominantSUPValue(cell) {
    if (!cell.values || cell.values.length === 0) return null;
    if (cell.values.length === 1) return cell.values[0].value;

    // Use most recent timestamp
    const sorted = [...cell.values].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    return sorted[0].value;
  },

  // ===========================================
  // AGGREGATION
  // ===========================================

  /**
   * Apply aggregation function (new format - uses atomic operators if available)
   */
  applyAggregation(values, aggregation) {
    // If EOAtomicOperators is available, try to use it
    if (typeof EOAtomicOperators !== 'undefined') {
      const op = EOAtomicOperators.get(aggregation.toUpperCase());
      if (op) {
        try {
          return op.evaluate(values);
        } catch (e) {
          console.warn(`Aggregation error for ${aggregation}:`, e);
        }
      }
    }

    // Fallback to built-in aggregations
    return this.aggregate(values, aggregation);
  },

  /**
   * Apply aggregation function to values (legacy format)
   */
  aggregate(values, aggregation) {
    if (!values || values.length === 0) {
      return this.getEmptyValueLegacy(aggregation);
    }

    switch (aggregation) {
      case 'count':
        return values.length;

      case 'sum':
        return this.sum(values);

      case 'avg':
      case 'average':
        return this.average(values);

      case 'min':
        return this.min(values);

      case 'max':
        return this.max(values);

      case 'arrayjoin':
      case 'array_join':
      case 'concat':
        return this.arrayJoin(values);

      case 'unique':
        return this.unique(values);

      case 'first':
      case 'any':
        return values[0];

      case 'last':
        return values[values.length - 1];

      default:
        console.warn(`Unknown aggregation: ${aggregation}`);
        return null;
    }
  },

  /**
   * Sum aggregation
   */
  sum(values) {
    const numbers = values
      .map(v => this.toNumber(v))
      .filter(n => !isNaN(n));

    if (numbers.length === 0) return 0;

    return numbers.reduce((sum, n) => sum + n, 0);
  },

  /**
   * Average aggregation
   */
  average(values) {
    const numbers = values
      .map(v => this.toNumber(v))
      .filter(n => !isNaN(n));

    if (numbers.length === 0) return 0;

    const sum = numbers.reduce((s, n) => s + n, 0);
    return sum / numbers.length;
  },

  /**
   * Min aggregation (handles both numbers and dates)
   */
  min(values) {
    // Check if values appear to be dates
    const dateValues = values
      .map(v => ({ original: v, timestamp: this.toTimestamp(v) }))
      .filter(item => item.timestamp !== null);

    if (dateValues.length > 0) {
      const minItem = dateValues.reduce((min, item) =>
        item.timestamp < min.timestamp ? item : min
      );
      return minItem.original;
    }

    // Fall back to numeric comparison
    const numbers = values
      .map(v => this.toNumber(v))
      .filter(n => !isNaN(n));

    if (numbers.length === 0) return null;

    return Math.min(...numbers);
  },

  /**
   * Max aggregation (handles both numbers and dates)
   */
  max(values) {
    // Check if values appear to be dates
    const dateValues = values
      .map(v => ({ original: v, timestamp: this.toTimestamp(v) }))
      .filter(item => item.timestamp !== null);

    if (dateValues.length > 0) {
      const maxItem = dateValues.reduce((max, item) =>
        item.timestamp > max.timestamp ? item : max
      );
      return maxItem.original;
    }

    // Fall back to numeric comparison
    const numbers = values
      .map(v => this.toNumber(v))
      .filter(n => !isNaN(n));

    if (numbers.length === 0) return null;

    return Math.max(...numbers);
  },

  /**
   * Array join aggregation
   */
  arrayJoin(values, separator = ', ') {
    return values
      .map(v => String(v))
      .filter(s => s.length > 0)
      .join(separator);
  },

  /**
   * Unique values aggregation
   */
  unique(values) {
    return [...new Set(values.map(v => String(v)))].join(', ');
  },

  // ===========================================
  // TYPE CONVERSION
  // ===========================================

  /**
   * Convert value to number
   */
  toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? NaN : parsed;
    }
    return NaN;
  },

  /**
   * Convert value to timestamp for date comparisons
   */
  toTimestamp(value) {
    if (!value) return null;

    if (value instanceof Date) {
      const ts = value.getTime();
      return isNaN(ts) ? null : ts;
    }

    if (typeof value === 'string') {
      // Skip if it looks like just a number
      if (/^\d+(\.\d+)?$/.test(value.trim())) {
        return null;
      }

      const date = new Date(value);
      const ts = date.getTime();

      if (isNaN(ts)) return null;

      // Check if year is reasonable (1900-2100)
      const year = date.getFullYear();
      if (year < 1900 || year > 2100) return null;

      return ts;
    }

    if (typeof value === 'number') {
      // Timestamps are typically > 1 billion (year ~2001)
      if (value > 100000000000) {
        return value;
      }
      return null;
    }

    return null;
  },

  // ===========================================
  // EMPTY VALUES
  // ===========================================

  /**
   * Get empty value (new format with outputMode)
   */
  getEmptyValue(outputMode, aggregation) {
    if (outputMode === 'single') return null;
    if (outputMode === 'array') return [];

    return this.getEmptyValueLegacy(aggregation);
  },

  /**
   * Get empty value (legacy format)
   */
  getEmptyValueLegacy(aggregation) {
    switch ((aggregation || '').toLowerCase()) {
      case 'count':
      case 'sum':
      case 'avg':
      case 'average':
        return 0;
      case 'min':
      case 'max':
      case 'first':
      case 'any':
      case 'last':
        return null;
      case 'arrayjoin':
      case 'array_join':
      case 'concat':
      case 'unique':
        return '';
      default:
        return null;
    }
  },

  // ===========================================
  // EO CONTEXT
  // ===========================================

  /**
   * Create EO context for the derived value
   */
  createContext(config, linkedCount, values = []) {
    const { outputMode, aggregation, sourceFieldId, targetFieldId } = config;

    const baseContext = {
      source: {
        system: outputMode === 'single' ? 'lookup' : 'rollup',
        linkedVia: sourceFieldId,
        targetField: targetFieldId,
        linkedCount
      },
      agent: {
        type: 'system',
        id: 'rollup_engine',
        name: 'EO Rollup Engine'
      }
    };

    if (outputMode === 'single') {
      return {
        ...baseContext,
        method: 'derived',
        scale: 'individual'
      };
    }

    if (outputMode === 'array') {
      return {
        ...baseContext,
        method: 'derived',
        scale: 'collective',
        source: {
          ...baseContext.source,
          output: 'array',
          arrayLength: values.length
        }
      };
    }

    // Aggregated
    return {
      ...baseContext,
      method: 'aggregated',
      scale: 'collective',
      source: {
        ...baseContext.source,
        aggregation,
        aggregatedFrom: values.length
      }
    };
  },

  // ===========================================
  // FORMATTING
  // ===========================================

  /**
   * Format rollup value for display
   */
  formatValue(value, configOrAggregation, targetField) {
    // Handle both new format (config object) and old format (aggregation string)
    const aggregation = typeof configOrAggregation === 'string'
      ? configOrAggregation
      : configOrAggregation?.aggregation;
    const outputMode = typeof configOrAggregation === 'object'
      ? configOrAggregation.outputMode
      : null;

    if (value === null || value === undefined) return '';

    // Array output
    if (outputMode === 'array' && Array.isArray(value)) {
      if (value.length === 0) return '';
      if (value.length <= 3) return value.join(', ');
      return `${value.slice(0, 3).join(', ')} +${value.length - 3} more`;
    }

    // Format based on aggregation type
    switch (aggregation) {
      case 'count':
        return String(value);

      case 'sum':
      case 'avg':
      case 'average':
        if (typeof value === 'number') {
          return Number.isInteger(value) ? String(value) : value.toFixed(2);
        }
        return String(value);

      case 'min':
      case 'max':
        if (targetField?.type === 'DATE' && value) {
          return new Date(value).toLocaleDateString();
        }
        if (typeof value === 'number') {
          return Number.isInteger(value) ? String(value) : value.toFixed(2);
        }
        return String(value);

      case 'arrayjoin':
      case 'array_join':
      case 'unique':
        return String(value);

      case 'first':
      case 'any':
      case 'last':
        if (targetField?.type === 'DATE' && value) {
          return new Date(value).toLocaleDateString();
        }
        if (targetField?.type === 'CHECKBOX') {
          return value ? 'Yes' : 'No';
        }
        return String(value);

      default:
        return String(value);
    }
  },

  // ===========================================
  // CONFIGURATION HELPERS
  // ===========================================

  /**
   * Detect optimal output mode based on link cardinality
   */
  detectOutputMode(linkField, sourceSet, state) {
    if (linkField.config?.cardinality === 'one') {
      return 'single';
    }

    if (linkField.config?.cardinality === 'many') {
      return 'array';
    }

    if (linkField.config?.cardinality === 'limit') {
      const limit = linkField.config?.limit || 1;
      return limit === 1 ? 'single' : 'array';
    }

    // Auto-detect from data
    const records = Array.from(sourceSet.records.values());

    for (const record of records) {
      const value = record[linkField.id];
      if (Array.isArray(value) && value.length > 1) {
        return 'array';
      }
    }

    return 'single';
  },

  /**
   * Get applicable aggregations for a field type
   */
  getApplicableAggregations(fieldType) {
    const numeric = ['NUMBER', 'FORMULA', 'CURRENCY', 'PERCENT'];
    const text = ['TEXT', 'SELECT', 'MULTISELECT', 'CONTACT', 'EMAIL', 'URL'];
    const date = ['DATE', 'DATETIME'];

    const aggregations = [
      { id: 'count', name: 'Count', types: ['*'] },
      { id: 'first', name: 'First', types: ['*'] },
      { id: 'last', name: 'Last', types: ['*'] },
      { id: 'unique', name: 'Unique', types: ['*'] }
    ];

    if (numeric.includes(fieldType)) {
      aggregations.push(
        { id: 'sum', name: 'Sum', types: numeric },
        { id: 'avg', name: 'Average', types: numeric },
        { id: 'min', name: 'Min', types: numeric },
        { id: 'max', name: 'Max', types: numeric }
      );
    }

    if (text.includes(fieldType) || fieldType === '*') {
      aggregations.push(
        { id: 'arrayjoin', name: 'Join', types: text }
      );
    }

    if (date.includes(fieldType)) {
      aggregations.push(
        { id: 'min', name: 'Earliest', types: date },
        { id: 'max', name: 'Latest', types: date }
      );
    }

    return aggregations;
  },

  /**
   * Create a derived field configuration
   */
  createDerivedFieldConfig(options) {
    const {
      id,
      name,
      sourceFieldId,
      targetSetId,
      targetFieldId,
      outputMode = 'array',
      aggregation = null,
      displayFormat = null
    } = options;

    return {
      id: id || `derived_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'DERIVED',
      name,
      sourceFieldId,
      targetSetId,
      targetFieldId,
      outputMode,
      aggregation,
      displayFormat,
      createdAt: Date.now()
    };
  },

  // ===========================================
  // BATCH EVALUATION
  // ===========================================

  /**
   * Evaluate derived field for all records in a set
   */
  evaluateAll(config, sourceSet, state) {
    const results = new Map();

    for (const [recordId, record] of sourceSet.records) {
      const result = this.evaluate(config, record, state);
      results.set(recordId, result);
    }

    return results;
  },

  /**
   * Get statistics about derived field values
   */
  getStatistics(config, sourceSet, state) {
    const results = this.evaluateAll(config, sourceSet, state);

    let totalLinked = 0;
    let recordsWithLinks = 0;
    const values = [];

    for (const [recordId, result] of results) {
      const linkedCount = result.linkedCount !== undefined ? result.linkedCount : (result ? 1 : 0);
      if (linkedCount > 0) {
        recordsWithLinks++;
        totalLinked += linkedCount;
      }

      const value = result.value !== undefined ? result.value : result;
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          values.push(...value);
        } else {
          values.push(value);
        }
      }
    }

    return {
      totalRecords: sourceSet.records.size,
      recordsWithLinks,
      totalLinked,
      avgLinksPerRecord: recordsWithLinks > 0 ? totalLinked / recordsWithLinks : 0,
      distinctValues: new Set(values.map(v => String(v))).size
    };
  },

  // ===========================================
  // MIGRATION HELPERS
  // ===========================================

  /**
   * Migrate old lookup/rollup config to unified format
   */
  migrateConfig(oldConfig) {
    if (oldConfig.type === 'lookup') {
      return {
        ...oldConfig,
        type: 'DERIVED',
        outputMode: 'single',
        aggregation: null
      };
    }

    if (oldConfig.type === 'rollup') {
      return {
        ...oldConfig,
        type: 'DERIVED',
        outputMode: 'aggregated'
      };
    }

    return oldConfig;
  },

  /**
   * Migrate view's relationships and rollups to unified derivedFields
   */
  migrateView(view) {
    const derivedFields = [];

    if (view.relationships) {
      for (const rel of view.relationships) {
        derivedFields.push(this.migrateConfig(rel));
      }
    }

    if (view.rollups) {
      for (const rollup of view.rollups) {
        derivedFields.push(this.migrateConfig(rollup));
      }
    }

    return {
      ...view,
      derivedFields,
      _migrated: true
    };
  }
};


// Export for use in other modules
if (typeof window !== 'undefined') {
  window.EOCRollupEngine = EOCRollupEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOCRollupEngine;
}
