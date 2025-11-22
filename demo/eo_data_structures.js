/**
 * EO Data Structures
 * Core data models for Epistemic Observability framework
 *
 * Defines schemas for:
 * - Context schemas
 * - SUP-enabled cells
 * - Value observations
 * - Stability metadata
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
    new_value = null
  }) {
    return {
      timestamp: timestamp || new Date().toISOString(),
      operator, // INS, DES, SEG, CON, SYN, REC, ALT, SUP
      description,
      agent: agent || { type: 'system' },
      old_value,
      new_value
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
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EODataStructures;
}

if (typeof window !== 'undefined') {
  window.EODataStructures = EODataStructures;
}
