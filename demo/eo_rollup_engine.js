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
 */

const EOCRollupEngine = {

  // ===========================================
  // CORE EVALUATION
  // ===========================================

  /**
   * Evaluate a derived field (unified lookup/rollup)
   *
   * @param {Object} config - Derived field configuration
   * @param {string} config.sourceFieldId - The LINK_RECORD field ID
   * @param {string} config.targetSetId - The linked set ID
   * @param {string} config.targetFieldId - The field to pull from linked records
   * @param {string} config.outputMode - 'single' | 'array' | 'aggregated'
   * @param {string} config.aggregation - Aggregation function ID (if outputMode='aggregated')
   * @param {Object} record - The source record
   * @param {Object} state - Global application state
   * @returns {Object} { value, context, linkedCount }
   */
  evaluate(config, record, state) {
    const {
      sourceFieldId,
      targetSetId,
      targetFieldId,
      outputMode = 'array',
      aggregation = null
    } = config;

    // Get linked record IDs
    const linkedRecordIds = this.getLinkedRecordIds(record, sourceFieldId);

    // If no linked records, return empty based on output mode
    if (!linkedRecordIds || linkedRecordIds.length === 0) {
      return {
        value: this.getEmptyValue(outputMode, aggregation),
        context: this.createContext(config, 0),
        linkedCount: 0
      };
    }

    // Get target set
    const targetSet = state.sets.get(targetSetId);
    if (!targetSet) {
      return {
        value: this.getEmptyValue(outputMode, aggregation),
        context: this.createContext(config, 0),
        linkedCount: 0,
        error: `Target set not found: ${targetSetId}`
      };
    }

    // Extract values from linked records
    const values = this.extractLinkedValues(linkedRecordIds, targetSet, targetFieldId);

    // Apply output mode
    let result;
    if (outputMode === 'single') {
      // For single cardinality, return first value
      result = values.length > 0 ? values[0] : null;
    } else if (outputMode === 'array') {
      // Return raw array
      result = values;
    } else if (outputMode === 'aggregated' && aggregation) {
      // Apply aggregation
      result = this.applyAggregation(values, aggregation);
    } else {
      // Default to array
      result = values;
    }

    return {
      value: result,
      context: this.createContext(config, linkedRecordIds.length, values),
      linkedCount: linkedRecordIds.length
    };
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
   * Apply aggregation function using atomic operators
   */
  applyAggregation(values, aggregation) {
    // If EOAtomicOperators is available, use it
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
    return this.builtInAggregate(values, aggregation);
  },

  /**
   * Built-in aggregation functions (fallback)
   */
  builtInAggregate(values, aggregation) {
    if (!values || values.length === 0) {
      return this.getEmptyValue('aggregated', aggregation);
    }

    switch (aggregation.toLowerCase()) {
      case 'count':
        return values.length;

      case 'sum':
        return values.reduce((sum, v) => sum + this.toNumber(v), 0);

      case 'avg':
      case 'average':
        const nums = values.map(v => this.toNumber(v)).filter(n => !isNaN(n));
        if (nums.length === 0) return 0;
        return nums.reduce((sum, n) => sum + n, 0) / nums.length;

      case 'min':
        const minNums = values.map(v => this.toNumber(v)).filter(n => !isNaN(n));
        if (minNums.length === 0) return null;
        return Math.min(...minNums);

      case 'max':
        const maxNums = values.map(v => this.toNumber(v)).filter(n => !isNaN(n));
        if (maxNums.length === 0) return null;
        return Math.max(...maxNums);

      case 'arrayjoin':
      case 'array_join':
      case 'concat':
        return values.map(v => String(v)).filter(s => s.length > 0).join(', ');

      case 'unique':
        return [...new Set(values.map(v => String(v)))].join(', ');

      case 'first':
      case 'any':
        return values[0];

      case 'last':
        return values[values.length - 1];

      default:
        console.warn(`Unknown aggregation: ${aggregation}`);
        return values;
    }
  },

  /**
   * Get empty value based on output mode and aggregation
   */
  getEmptyValue(outputMode, aggregation) {
    if (outputMode === 'single') return null;
    if (outputMode === 'array') return [];

    // For aggregated
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
  formatValue(value, config, targetField) {
    const { outputMode, aggregation } = config;

    if (value === null || value === undefined) return '';

    // Array output
    if (outputMode === 'array' && Array.isArray(value)) {
      if (value.length === 0) return '';
      if (value.length <= 3) return value.join(', ');
      return `${value.slice(0, 3).join(', ')} +${value.length - 3} more`;
    }

    // Single value or aggregated
    if (typeof value === 'number') {
      // Format based on aggregation type
      if (['count'].includes(aggregation?.toLowerCase())) {
        return String(Math.round(value));
      }
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }

    // Date handling
    if (targetField?.type === 'DATE' && value) {
      return new Date(value).toLocaleDateString();
    }

    // Checkbox
    if (targetField?.type === 'CHECKBOX') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  },

  // ===========================================
  // CONFIGURATION HELPERS
  // ===========================================

  /**
   * Detect optimal output mode based on link cardinality
   */
  detectOutputMode(linkField, sourceSet, state) {
    // Check configured cardinality first
    if (linkField.config?.cardinality === 'one') {
      return 'single';
    }

    if (linkField.config?.cardinality === 'many') {
      return 'array';
    }

    // Check for limit
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
      if (result.linkedCount > 0) {
        recordsWithLinks++;
        totalLinked += result.linkedCount;
      }

      if (result.value !== null && result.value !== undefined) {
        if (Array.isArray(result.value)) {
          values.push(...result.value);
        } else {
          values.push(result.value);
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
  // UTILITIES
  // ===========================================

  /**
   * Convert value to number
   */
  toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  },

  // ===========================================
  // MIGRATION HELPERS
  // ===========================================

  /**
   * Migrate old lookup/rollup config to unified format
   */
  migrateConfig(oldConfig) {
    // Old lookup format
    if (oldConfig.type === 'lookup') {
      return {
        ...oldConfig,
        type: 'DERIVED',
        outputMode: 'single',
        aggregation: null
      };
    }

    // Old rollup format
    if (oldConfig.type === 'rollup') {
      return {
        ...oldConfig,
        type: 'DERIVED',
        outputMode: 'aggregated'
        // aggregation is already present
      };
    }

    return oldConfig;
  },

  /**
   * Migrate view's relationships and rollups arrays to unified derivedFields
   */
  migrateView(view) {
    const derivedFields = [];

    // Migrate lookups
    if (view.relationships) {
      for (const rel of view.relationships) {
        derivedFields.push(this.migrateConfig(rel));
      }
    }

    // Migrate rollups
    if (view.rollups) {
      for (const rollup of view.rollups) {
        derivedFields.push(this.migrateConfig(rollup));
      }
    }

    return {
      ...view,
      derivedFields,
      // Keep old arrays for backward compatibility but mark as migrated
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
