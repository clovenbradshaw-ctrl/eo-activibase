/**
 * EO Data Structures
 * Core data models for Epistemic Observability framework
 *
 * Defines schemas for:
 * - Context schemas
 * - SUP-enabled cells
 * - Value observations
 * - Stability metadata
 * - Field schemas with Codd-compliant nullability
 *
 * === E.F. Codd NULL Semantics ===
 *
 * Field schemas support explicit nullability declaration per Codd's Rule 3:
 * - nullable: whether NULL is a valid value
 * - nullType: 'a_mark' (applicable unknown) or 'i_mark' (inapplicable)
 * - nullReason: default reason when NULL is set
 */

class EODataStructures {
  /**
   * Create a new context schema
   */
  static createContextSchema({
    method = 'declared',
    definition = null,
    scale = 'individual',
    timeframe = null,
    source = null,
    agent = null,
    subject = null
  } = {}) {
    return {
      method, // measured | declared | aggregated | inferred | derived
      definition, // what this value means
      scale, // individual | team | department | organization
      timeframe: timeframe || this.createTimeframe(),
      source: source || { system: 'user_edit' },
      agent: agent || { type: 'system' },
      subject
    };
  }

  /**
   * Create a timeframe object
   */
  static createTimeframe({
    granularity = 'instant',
    start = null,
    end = null
  } = {}) {
    const now = new Date().toISOString();
    return {
      granularity, // instant | day | week | month | quarter | year
      start: start || now,
      end: end || now
    };
  }

  /**
   * Create a value observation (single value with context)
   */
  static createValueObservation({
    value,
    timestamp = null,
    source = null,
    context_schema = null
  }) {
    return {
      value,
      timestamp: timestamp || new Date().toISOString(),
      source: source || 'user_edit',
      context_schema: context_schema || this.createContextSchema()
    };
  }

  /**
   * Create a SUP-enabled cell
   * Can hold single value or multiple superposed values
   */
  static createCell({
    cell_id,
    record_id,
    field_name,
    values = []
  }) {
    return {
      cell_id,
      record_id,
      field_name,
      values, // Array of value observations
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Create a simple cell with single value (legacy compatibility)
   */
  static createSimpleCell({
    cell_id,
    record_id,
    field_name,
    value,
    context_schema = null
  }) {
    const observation = this.createValueObservation({
      value,
      context_schema
    });

    return this.createCell({
      cell_id,
      record_id,
      field_name,
      values: [observation]
    });
  }

  /**
   * Add a value to an existing cell (creates SUP if contexts differ)
   */
  static addValueToCell(cell, newValue, context_schema = null) {
    const observation = this.createValueObservation({
      value: newValue,
      context_schema
    });

    // Check if we should replace or add (SUP)
    const shouldReplace = this.shouldReplaceValue(cell, observation);

    if (shouldReplace) {
      // Replace the value
      cell.values = [observation];
    } else {
      // Add as superposition
      cell.values.push(observation);
    }

    cell.updated_at = new Date().toISOString();
    return cell;
  }

  /**
   * Determine if a new value should replace existing or create SUP
   */
  static shouldReplaceValue(cell, newObservation) {
    if (!cell.values || cell.values.length === 0) return true;

    const latestValue = cell.values[cell.values.length - 1];
    const oldCtx = latestValue.context_schema;
    const newCtx = newObservation.context_schema;

    // Replace if contexts are essentially the same
    return (
      oldCtx.method === newCtx.method &&
      oldCtx.definition === newCtx.definition &&
      oldCtx.scale === newCtx.scale
    );
  }

  /**
   * Get the dominant (display) value from a cell
   * Based on view context and recency
   */
  static getDominantValue(cell, viewContext = {}) {
    if (!cell.values || cell.values.length === 0) return null;
    if (cell.values.length === 1) return cell.values[0];

    // Score each value based on view context
    const scored = cell.values.map(obs => ({
      observation: obs,
      score: this.scoreValueForContext(obs, viewContext)
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    return scored[0].observation;
  }

  /**
   * Score a value observation for relevance to current view context
   */
  static scoreValueForContext(observation, viewContext) {
    let score = 0;
    const ctx = observation.context_schema;

    // Prefer matching scale
    if (viewContext.scale && ctx.scale === viewContext.scale) {
      score += 10;
    }

    // Prefer matching definition
    if (viewContext.definition && ctx.definition === viewContext.definition) {
      score += 10;
    }

    // Prefer matching method
    if (viewContext.method && ctx.method === viewContext.method) {
      score += 5;
    }

    // Prefer more recent values (max 10 points for recency)
    const age = Date.now() - new Date(observation.timestamp).getTime();
    const daysSinceUpdate = age / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 10 - daysSinceUpdate);
    score += recencyScore;

    // Method priority: measured > declared > derived > inferred > aggregated
    const methodPriority = {
      'measured': 5,
      'declared': 4,
      'derived': 3,
      'inferred': 2,
      'aggregated': 1
    };
    score += methodPriority[ctx.method] || 0;

    return score;
  }

  /**
   * Create edit history entry
   */
  static createHistoryEntry({
    timestamp = null,
    operator = 'INS',
    description = '',
    agent = null,
    old_value = null,
    new_value = null,
    field_name = null
  }) {
    return {
      timestamp: timestamp || new Date().toISOString(),
      operator, // INS, DES, SEG, CON, SYN, REC, ALT, SUP
      description,
      agent: agent || { type: 'system' },
      old_value,
      new_value,
      field_name
    };
  }

  /**
   * Create a record with stability metadata
   */
  static createRecord({
    record_id,
    fields = {},
    cells = [],
    created_at = null,
    stability = null
  }) {
    return {
      record_id,
      fields, // Legacy field values for compatibility
      cells, // SUP-enabled cells
      created_at: created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      edit_history: [],
      value_history: [],
      stability: stability || {
        classification: 'emerging',
        calculated_at: new Date().toISOString()
      }
    };
  }

  /**
   * Convert legacy field-value pairs to SUP-enabled cells
   */
  static migrateLegacyRecord(record) {
    const cells = [];

    Object.entries(record.fields || {}).forEach(([fieldName, value]) => {
      const cell_id = `${record.record_id}_field_${fieldName}`;

      cells.push(this.createSimpleCell({
        cell_id,
        record_id: record.record_id,
        field_name: fieldName,
        value,
        context_schema: this.inferContextFromLegacy(fieldName, value, record)
      }));
    });

    return {
      ...record,
      cells
    };
  }

  /**
   * Infer context from legacy data
   */
  static inferContextFromLegacy(fieldName, value, record) {
    // Infer method based on field name patterns
    let method = 'declared';
    if (fieldName.match(/formula|calculated|computed/i)) {
      method = 'derived';
    } else if (fieldName.match(/imported|source/i)) {
      method = 'measured';
    }

    // Infer scale
    let scale = 'individual';
    if (fieldName.match(/team|group/i)) {
      scale = 'team';
    } else if (fieldName.match(/department|division/i)) {
      scale = 'department';
    } else if (fieldName.match(/org|company|total/i)) {
      scale = 'organization';
    }

    // Infer definition
    let definition = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    return this.createContextSchema({
      method,
      scale,
      definition,
      source: { system: 'legacy_migration' },
      agent: { type: 'system' }
    });
  }

  /**
   * Validate a context schema
   */
  static validateContextSchema(schema) {
    const validMethods = ['measured', 'declared', 'aggregated', 'inferred', 'derived'];
    const validScales = ['individual', 'team', 'department', 'organization'];
    const validGranularities = ['instant', 'day', 'week', 'month', 'quarter', 'year'];

    const errors = [];

    if (!validMethods.includes(schema.method)) {
      errors.push(`Invalid method: ${schema.method}`);
    }

    if (!validScales.includes(schema.scale)) {
      errors.push(`Invalid scale: ${schema.scale}`);
    }

    if (schema.timeframe && !validGranularities.includes(schema.timeframe.granularity)) {
      errors.push(`Invalid timeframe granularity: ${schema.timeframe.granularity}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if two timeframes overlap
   */
  static timeframesOverlap(tf1, tf2) {
    const start1 = new Date(tf1.start).getTime();
    const end1 = new Date(tf1.end).getTime();
    const start2 = new Date(tf2.start).getTime();
    const end2 = new Date(tf2.end).getTime();

    return start1 <= end2 && start2 <= end1;
  }

  /**
   * Generate unique cell ID
   */
  static generateCellId(record_id, field_name) {
    return `${record_id}_field_${field_name}`;
  }

  /**
   * Generate unique record ID
   */
  static generateRecordId() {
    return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ========================================================================
  // CODD-COMPLIANT FIELD SCHEMAS
  // ========================================================================

  /**
   * Create a field schema with explicit nullability (Codd Rule 3)
   * @param {Object} options - Field schema options
   * @param {string} options.name - Field name
   * @param {string} options.type - Field type (TEXT, NUMBER, DATE, etc.)
   * @param {boolean} options.nullable - Whether NULL is valid (default: true)
   * @param {string} options.nullType - Codd mark type: 'a_mark' or 'i_mark'
   * @param {string} options.nullReason - Default reason when NULL is set
   * @param {*} options.defaultValue - Default value when creating new records
   * @param {boolean} options.required - Whether field must have a value (not NULL)
   * @returns {Object} Field schema
   */
  static createFieldSchema({
    name,
    type = 'TEXT',
    nullable = true,
    nullType = 'a_mark',
    nullReason = null,
    defaultValue = null,
    required = false,
    description = null,
    validation = null
  }) {
    // Validate nullType
    if (!['a_mark', 'i_mark'].includes(nullType)) {
      console.warn(`Invalid nullType "${nullType}", defaulting to "a_mark"`);
      nullType = 'a_mark';
    }

    // Required fields are not nullable
    if (required) {
      nullable = false;
    }

    return {
      name,
      type,
      nullable,
      nullType,       // Codd: A-mark (unknown) vs I-mark (inapplicable)
      nullReason,     // Why NULL is valid for this field
      defaultValue,
      required,
      description,
      validation,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create field schema for a spouse name field (example of I-mark usage)
   * This demonstrates when I-mark (inapplicable) is appropriate:
   * If person is unmarried, spouse name doesn't apply (not "unknown")
   */
  static createSpouseFieldSchema() {
    return this.createFieldSchema({
      name: 'spouse_name',
      type: 'TEXT',
      nullable: true,
      nullType: 'i_mark',  // Inapplicable for unmarried people
      nullReason: 'Person is not married',
      description: 'Name of spouse, if married'
    });
  }

  /**
   * Create field schema for a birthdate field (example of A-mark usage)
   * This demonstrates when A-mark (applicable unknown) is appropriate:
   * The person has a birthdate, we just don't know what it is
   */
  static createBirthdateFieldSchema() {
    return this.createFieldSchema({
      name: 'birthdate',
      type: 'DATE',
      nullable: true,
      nullType: 'a_mark',  // Value exists but is unknown
      nullReason: 'Birthdate not recorded',
      description: 'Date of birth'
    });
  }

  /**
   * Validate a value against a field schema
   * Returns validation result with Codd mark if NULL
   * @param {*} value - Value to validate
   * @param {Object} schema - Field schema
   * @returns {Object} Validation result
   */
  static validateFieldValue(value, schema) {
    const isNull = value === null || value === undefined || value === '';
    const result = {
      valid: true,
      value: value,
      coddMark: null,
      errors: []
    };

    // Check nullability
    if (isNull) {
      if (!schema.nullable) {
        result.valid = false;
        result.errors.push(`Field "${schema.name}" cannot be null`);
      } else {
        // Apply Codd mark
        result.coddMark = schema.nullType;
        result.coddReason = schema.nullReason;

        // Convert to proper Codd mark object if EOAbsence is available
        if (typeof EOAbsence !== 'undefined') {
          if (schema.nullType === 'a_mark') {
            result.value = EOAbsence.createAMark(schema.nullReason);
          } else if (schema.nullType === 'i_mark') {
            result.value = EOAbsence.createIMark(schema.nullReason);
          }
        }
      }
      return result;
    }

    // Type validation
    if (schema.type === 'NUMBER' && typeof value !== 'number') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        result.valid = false;
        result.errors.push(`Field "${schema.name}" must be a number`);
      } else {
        result.value = num;
      }
    }

    if (schema.type === 'DATE' && !(value instanceof Date)) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        result.valid = false;
        result.errors.push(`Field "${schema.name}" must be a valid date`);
      } else {
        result.value = date;
      }
    }

    // Custom validation function
    if (schema.validation && typeof schema.validation === 'function') {
      const customResult = schema.validation(value);
      if (customResult !== true) {
        result.valid = false;
        result.errors.push(customResult || `Field "${schema.name}" failed validation`);
      }
    }

    return result;
  }

  /**
   * Create a table schema (collection of field schemas)
   * @param {string} name - Table name
   * @param {Array} fields - Array of field schema configs
   * @returns {Object} Table schema
   */
  static createTableSchema(name, fields = []) {
    const fieldSchemas = fields.map(f => {
      if (f.name && f.type) {
        return this.createFieldSchema(f);
      }
      return f;  // Already a field schema
    });

    return {
      name,
      fields: fieldSchemas,
      fieldsByName: Object.fromEntries(fieldSchemas.map(f => [f.name, f])),
      createdAt: new Date().toISOString(),

      /**
       * Get a field schema by name
       */
      getField(fieldName) {
        return this.fieldsByName[fieldName] || null;
      },

      /**
       * Check if a field is nullable
       */
      isNullable(fieldName) {
        const field = this.getField(fieldName);
        return field ? field.nullable : true;
      },

      /**
       * Get the Codd null type for a field
       */
      getNullType(fieldName) {
        const field = this.getField(fieldName);
        return field ? field.nullType : 'a_mark';
      },

      /**
       * Validate a record against this schema
       */
      validateRecord(record) {
        const results = {};
        const errors = [];

        for (const field of this.fields) {
          const value = record[field.name];
          const validation = EODataStructures.validateFieldValue(value, field);
          results[field.name] = validation;
          if (!validation.valid) {
            errors.push(...validation.errors);
          }
        }

        return {
          valid: errors.length === 0,
          fieldResults: results,
          errors
        };
      }
    };
  }

  /**
   * Analyze NULL patterns in a dataset (Codd-style NULL statistics)
   * @param {Array} records - Array of records
   * @param {Object} tableSchema - Table schema (optional)
   * @returns {Object} NULL analysis
   */
  static analyzeNullPatterns(records, tableSchema = null) {
    if (!Array.isArray(records) || records.length === 0) {
      return { totalRecords: 0, fields: {} };
    }

    const fieldNames = tableSchema
      ? tableSchema.fields.map(f => f.name)
      : Object.keys(records[0]);

    const analysis = {
      totalRecords: records.length,
      fields: {},
      coddMarkDistribution: {
        a_marks: 0,
        i_marks: 0,
        plain_nulls: 0
      }
    };

    for (const fieldName of fieldNames) {
      const fieldSchema = tableSchema?.getField?.(fieldName);
      const values = records.map(r => r[fieldName]);

      let nullCount = 0;
      let aMarkCount = 0;
      let iMarkCount = 0;
      let presentCount = 0;

      for (const value of values) {
        if (typeof EOAbsence !== 'undefined') {
          if (EOAbsence.isAMark(value)) {
            aMarkCount++;
            analysis.coddMarkDistribution.a_marks++;
          } else if (EOAbsence.isIMark(value)) {
            iMarkCount++;
            analysis.coddMarkDistribution.i_marks++;
          } else if (EOAbsence.isAbsent(value)) {
            nullCount++;
            analysis.coddMarkDistribution.plain_nulls++;
          } else {
            presentCount++;
          }
        } else {
          if (value === null || value === undefined || value === '') {
            nullCount++;
            analysis.coddMarkDistribution.plain_nulls++;
          } else {
            presentCount++;
          }
        }
      }

      const total = values.length;
      analysis.fields[fieldName] = {
        nullCount,
        aMarkCount,
        iMarkCount,
        presentCount,
        total,
        nullPercentage: ((nullCount + aMarkCount + iMarkCount) / total * 100).toFixed(2) + '%',
        completeness: (presentCount / total * 100).toFixed(2) + '%',
        expectedNullType: fieldSchema?.nullType || 'a_mark',
        nullable: fieldSchema?.nullable ?? true
      };
    }

    return analysis;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EODataStructures;
}

if (typeof window !== 'undefined') {
  window.EODataStructures = EODataStructures;
}
