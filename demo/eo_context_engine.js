/**
 * EO Context Inference Engine
 * Automatically captures epistemic context from user actions
 *
 * Features:
 * - Infers context from CSV imports
 * - Captures context from user edits
 * - Derives context from value shapes and column names
 * - Tracks provenance from UI flows
 * - Detects superposition (SUP) in cells [MERGED from eo_sup_detector.js]
 * - Analyzes context differences
 *
 * EO Operator: SYN (Synthesize) - Merged SUP detector into context engine
 *
 * Usage:
 *   const engine = new EOContextEngine();
 *   const context = engine.inferFromImport(filename, columnName, value);
 *   const hasSUP = engine.detectSuperposition(cell);
 */

class EOContextEngine {
  constructor() {
    this.currentUser = null;
    this.viewContext = {
      scale: 'individual',
      definition: null,
      method: null
    };

    // SUP detection thresholds (merged from EOSUPDetector)
    this.diffThreshold = {
      value: 0.05, // 5% difference threshold for numeric values
      temporal: 24 * 60 * 60 * 1000 // 24 hours for temporal difference
    };

    // Method priority for value selection
    this.methodPriority = {
      'measured': 5,
      'declared': 4,
      'derived': 3,
      'inferred': 2,
      'aggregated': 1
    };
  }

  /**
   * Normalize field/column names to a consistent token
   */
  normalizeFieldName(name = '') {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  /**
   * Set the current user for agent tracking
   */
  setCurrentUser(userId, userName) {
    this.currentUser = {
      type: 'person',
      id: userId,
      name: userName
    };
  }

  /**
   * Set the current view context (affects dominant value selection)
   */
  setViewContext(context) {
    this.viewContext = { ...this.viewContext, ...context };
  }

  /**
   * Infer context from CSV import
   */
  inferFromImport({
    filename = '',
    columnName = '',
    value = null,
    rowData = {}
  }) {
    const timeframe = this.extractTimeframeFromFilename(filename);
    const scale = this.inferScaleFromColumnName(columnName, rowData);
    const definition = this.inferDefinitionFromColumnName(columnName, rowData);
    const method = this.inferMethodFromValue(value, columnName);
    const subject = this.inferSubjectFromRow(rowData);

    return EODataStructures.createContextSchema({
      method: method || 'measured',
      definition,
      scale,
      timeframe,
      subject,
      source: {
        system: 'csv_import',
        file: filename
      },
      agent: { type: 'system' }
    });
  }

  /**
   * Extract timeframe information from filename
   */
  extractTimeframeFromFilename(filename) {
    const now = new Date();
    const defaultTimeframe = {
      granularity: 'instant',
      start: now.toISOString(),
      end: now.toISOString()
    };

    if (!filename) return defaultTimeframe;

    // Quarter pattern: Q1, Q2, Q3, Q4
    const quarterMatch = filename.match(/Q([1-4])[_\s-]*(\d{4})/i);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]);
      const year = parseInt(quarterMatch[2]);
      const startMonth = (quarter - 1) * 3;
      const endMonth = startMonth + 2;

      return {
        granularity: 'quarter',
        start: new Date(year, startMonth, 1).toISOString(),
        end: new Date(year, endMonth + 1, 0).toISOString()
      };
    }

    // Year pattern: 2024, 2025, etc.
    const yearMatch = filename.match(/(\d{4})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      return {
        granularity: 'year',
        start: new Date(year, 0, 1).toISOString(),
        end: new Date(year, 11, 31).toISOString()
      };
    }

    // Month pattern: Jan, January, 01, etc.
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthMatch = filename.toLowerCase().match(new RegExp(`(${monthNames.join('|')})`));
    if (monthMatch) {
      const monthIndex = monthNames.indexOf(monthMatch[1]);
      const year = now.getFullYear();

      return {
        granularity: 'month',
        start: new Date(year, monthIndex, 1).toISOString(),
        end: new Date(year, monthIndex + 1, 0).toISOString()
      };
    }

    // Date pattern: YYYY-MM-DD
    const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      return {
        granularity: 'day',
        start: new Date(date.setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(date.setHours(23, 59, 59, 999)).toISOString()
      };
    }

    return defaultTimeframe;
  }

  /**
   * Infer scale from column name and row data
   */
  inferScaleFromColumnName(columnName, rowData = {}) {
    const name = columnName.toLowerCase();

    // Organization/Company level
    if (name.match(/\b(company|org|organization|total|global|enterprise)\b/)) {
      return 'organization';
    }

    // Department level
    if (name.match(/\b(department|division|dept|unit)\b/)) {
      return 'department';
    }

    // Team level
    if (name.match(/\b(team|group|squad|crew)\b/)) {
      return 'team';
    }

    // Check row data for hierarchical clues
    const rowDataStr = JSON.stringify(rowData).toLowerCase();
    if (rowDataStr.match(/department/)) return 'department';
    if (rowDataStr.match(/team/)) return 'team';

    // Default to individual
    return 'individual';
  }

  /**
   * Infer definition from column name
   */
  inferDefinitionFromColumnName(columnName, rowData = {}) {
    const normalizedColumn = this.normalizeFieldName(columnName);
    const definitionFromRow = this.findDefinitionForColumn(normalizedColumn, rowData);

    if (definitionFromRow) return definitionFromRow;

    // If the column itself is a definition identifier, trust the value
    if (normalizedColumn.endsWith('_definition') || normalizedColumn.endsWith('_definition_id')) {
      return rowData[columnName] || normalizedColumn.replace(/_(definition|definition_id)$/i, '');
    }

    // Default: sanitized column name to keep identifiers stable in demo
    return normalizedColumn || 'unknown_definition';
  }

  /**
   * Find a subject for the given row data
   */
  inferSubjectFromRow(rowData = {}) {
    const subjectIdKey = Object.keys(rowData).find(key => this.normalizeFieldName(key) === 'subject_id');
    const subjectLabelKey = Object.keys(rowData).find(key => this.normalizeFieldName(key) === 'subject_label');
    const subjectTypeKey = Object.keys(rowData).find(key => this.normalizeFieldName(key) === 'subject_type');

    if (!subjectIdKey && !subjectLabelKey) return null;

    return {
      id: subjectIdKey ? rowData[subjectIdKey] : null,
      label: subjectLabelKey ? rowData[subjectLabelKey] : null,
      type: subjectTypeKey ? rowData[subjectTypeKey] : 'entity'
    };
  }

  /**
   * Find semantic definition identifiers embedded in the row data
   */
  findDefinitionForColumn(normalizedColumn, rowData = {}) {
    const normalizedEntries = Object.entries(rowData).map(([key, value]) => ({
      key,
      normalizedKey: this.normalizeFieldName(key),
      value
    }));

    const match = normalizedEntries.find(entry => (
      entry.normalizedKey === `${normalizedColumn}_definition` ||
      entry.normalizedKey === `${normalizedColumn}_definition_id`
    ));

    if (match) return match.value;

    // Look for a generic mapping object (e.g., definitions: { temperature: 'def:temp' })
    const semanticMapKey = normalizedEntries.find(entry => entry.normalizedKey === 'definitions');
    if (semanticMapKey && typeof semanticMapKey.value === 'object') {
      return semanticMapKey.value[normalizedColumn];
    }

    return null;
  }

  /**
   * Infer method from value type and column name
   */
  inferMethodFromValue(value, columnName) {
    const name = columnName.toLowerCase();

    // Formula/calculated fields
    if (name.match(/formula|calculated|computed|derived/)) {
      return 'derived';
    }

    // Aggregated fields
    if (name.match(/total|sum|average|avg|mean|count/)) {
      return 'aggregated';
    }

    // Boolean/toggle values are typically declared
    if (typeof value === 'boolean') {
      return 'declared';
    }

    // Numeric measurements
    if (typeof value === 'number' && !name.match(/score|rating/)) {
      return 'measured';
    }

    // Default for imports
    return 'measured';
  }

  /**
   * Capture context from user edit
   */
  inferFromEdit({
    columnName = '',
    oldValue = null,
    newValue = null,
    recordData = {}
  }) {
    const scale = this.inferScaleFromColumnName(columnName, recordData);
    const definition = this.inferDefinitionFromColumnName(columnName, recordData);
    const subject = this.inferSubjectFromRow(recordData);

    return EODataStructures.createContextSchema({
      method: 'declared',
      definition,
      scale,
      subject,
      timeframe: {
        granularity: 'instant',
        start: new Date().toISOString(),
        end: new Date().toISOString()
      },
      source: { system: 'user_edit' },
      agent: this.currentUser || { type: 'system' }
    });
  }

  /**
   * Infer context from formula/derived field
   */
  inferFromFormula({
    columnName = '',
    formula = '',
    dependencies = []
  }) {
    const scale = this.inferScaleFromColumnName(columnName);
    const definition = this.inferDefinitionFromColumnName(columnName);
    
    return EODataStructures.createContextSchema({
      method: 'derived',
      definition,
      scale,
      timeframe: {
        granularity: 'instant',
        start: new Date().toISOString(),
        end: new Date().toISOString()
      },
      source: {
        system: 'formula',
        formula,
        dependencies
      },
      agent: this.currentUser || { type: 'system' }
    });
  }

  /**
   * Infer context from sync/integration
   */
  inferFromSync({
    columnName = '',
    sourceSystem = 'unknown',
    recordData = {}
  }) {
    const scale = this.inferScaleFromColumnName(columnName, recordData);
    const definition = this.inferDefinitionFromColumnName(columnName, recordData);
    const subject = this.inferSubjectFromRow(recordData);

    return EODataStructures.createContextSchema({
      method: 'inferred',
      definition,
      scale,
      subject,
      timeframe: {
        granularity: 'instant',
        start: new Date().toISOString(),
        end: new Date().toISOString()
      },
      source: {
        system: 'sync',
        sourceSystem
      },
      agent: { type: 'system' }
    });
  }

  /**
   * Infer context from aggregation operation
   */
  inferFromAggregation({
    columnName = '',
    aggregationType = 'sum',
    sourceRecords = []
  }) {
    const scale = this.inferScaleFromColumnName(columnName);
    const definition = this.inferDefinitionFromColumnName(columnName);

    return EODataStructures.createContextSchema({
      method: 'aggregated',
      definition,
      scale,
      timeframe: {
        granularity: 'instant',
        start: new Date().toISOString(),
        end: new Date().toISOString()
      },
      source: {
        system: 'aggregation',
        aggregationType,
        sourceCount: sourceRecords.length
      },
      agent: this.currentUser || { type: 'system' }
    });
  }

  /**
   * Infer operator type from change pattern
   */
  inferOperator({
    oldValue = null,
    newValue = null,
    oldContext = null,
    newContext = null
  }) {
    // New value created
    if (oldValue === null || oldValue === undefined) {
      return 'INS'; // Insertion
    }

    // Value deleted
    if (newValue === null || newValue === undefined) {
      return 'DEL'; // Deletion (not in original spec, but useful)
    }

    // Context changed significantly
    if (oldContext && newContext) {
      // Definition changed
      if (oldContext.definition !== newContext.definition) {
        return 'DES'; // Description/Definition change
      }

      // Scale changed
      if (oldContext.scale !== newContext.scale) {
        return 'SEG'; // Segmentation
      }

      // Method changed
      if (oldContext.method !== newContext.method) {
        return 'REC'; // Reconfiguration
      }

      // Multiple values coexist
      return 'SUP'; // Superposition
    }

    // Simple value update
    return 'ALT'; // Alternation
  }

  /**
   * Create history entry with natural language description
   */
  createHistoryEntry({
    operator,
    oldValue,
    newValue,
    context,
    additionalInfo = {}
  }) {
    const descriptions = {
      'INS': () => `Created${context?.source?.file ? ` via import (${context.source.file})` : ''}`,
      'DES': () => `Redefined from ${oldValue} to ${newValue}`,
      'SEG': () => `Split into multiple values`,
      'CON': () => `Connected to ${additionalInfo.connectedTo || 'related entity'}`,
      'SYN': () => `Merged from multiple sources`,
      'REC': () => `Rule updated`,
      'ALT': () => `Updated by ${context?.agent?.name || 'system'}`,
      'SUP': () => `Multiple values added`,
      'DEL': () => `Deleted`
    };

    const getDescription = descriptions[operator] || (() => 'Updated');

    return EODataStructures.createHistoryEntry({
      operator,
      description: getDescription(),
      agent: context?.agent || { type: 'system' },
      old_value: oldValue,
      new_value: newValue
    });
  }

  /**
   * Batch infer context for multiple fields in a record
   */
  inferBatchFromImport({
    filename = '',
    recordData = {}
  }) {
    const contexts = {};

    Object.entries(recordData).forEach(([columnName, value]) => {
      contexts[columnName] = this.inferFromImport({
        filename,
        columnName,
        value,
        rowData: recordData
      });
    });

    return contexts;
  }

  /**
   * Get current view context (for determining dominant values)
   */
  getViewContext() {
    return this.viewContext;
  }

  // ============================================================================
  // SUP (Superposition) Detection - MERGED from eo_sup_detector.js
  // ============================================================================

  /**
   * Detect if a cell has superposition (multiple valid values)
   * @param {Object} cell - Cell with values array
   * @returns {boolean}
   */
  detectSuperposition(cell) {
    if (!cell || !cell.values || cell.values.length <= 1) {
      return false;
    }

    // Check if contexts meaningfully differ
    const [first, ...rest] = cell.values;

    return rest.some(value => {
      return this.contextsAreDifferent(
        first.context_schema,
        value.context_schema
      );
    });
  }

  /**
   * Check if two contexts are meaningfully different
   * @param {Object} ctx1 - First context
   * @param {Object} ctx2 - Second context
   * @returns {boolean}
   */
  contextsAreDifferent(ctx1, ctx2) {
    if (!ctx1 || !ctx2) return false;

    // Different definitions
    if (ctx1.definition !== ctx2.definition) {
      return true;
    }

    // Different scales
    if (ctx1.scale !== ctx2.scale) {
      return true;
    }

    // Different methods
    if (ctx1.method !== ctx2.method) {
      return true;
    }

    // Different timeframe granularities
    if (ctx1.timeframe?.granularity !== ctx2.timeframe?.granularity) {
      return true;
    }

    // Timeframes don't overlap
    if (!this.timeframesOverlap(ctx1.timeframe, ctx2.timeframe)) {
      return true;
    }

    return false;
  }

  /**
   * Check if two timeframes overlap
   * @param {Object} tf1 - First timeframe
   * @param {Object} tf2 - Second timeframe
   * @returns {boolean}
   */
  timeframesOverlap(tf1, tf2) {
    if (!tf1 || !tf2) return true; // Assume overlap if not specified

    const start1 = new Date(tf1.start).getTime();
    const end1 = new Date(tf1.end).getTime();
    const start2 = new Date(tf2.start).getTime();
    const end2 = new Date(tf2.end).getTime();

    return start1 <= end2 && start2 <= end1;
  }

  /**
   * Get superposed values from a cell
   * @param {Object} cell - Cell to analyze
   * @returns {Array}
   */
  getSuperposedValues(cell) {
    if (!this.detectSuperposition(cell)) {
      return [];
    }

    return cell.values.map(obs => ({
      value: obs.value,
      timestamp: obs.timestamp,
      context: obs.context_schema,
      source: obs.source
    }));
  }

  /**
   * Generate context diff between superposed values
   * @param {Object} cell - Cell to analyze
   * @returns {Object|null}
   */
  generateContextDiff(cell) {
    if (!this.detectSuperposition(cell)) {
      return null;
    }

    const values = cell.values;
    const differences = [];

    // Compare each pair of values
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const ctx1 = values[i].context_schema;
        const ctx2 = values[j].context_schema;
        const val1 = values[i].value;
        const val2 = values[j].value;

        const diff = {
          value1: val1,
          value2: val2,
          timestamp1: values[i].timestamp,
          timestamp2: values[j].timestamp,
          differences: []
        };

        // Check each context dimension
        if (ctx1.definition !== ctx2.definition) {
          diff.differences.push({
            dimension: 'definition',
            value1: ctx1.definition,
            value2: ctx2.definition,
            description: `Definition: ${this.humanize(ctx1.definition)} vs ${this.humanize(ctx2.definition)}`
          });
        }

        if (ctx1.method !== ctx2.method) {
          diff.differences.push({
            dimension: 'method',
            value1: ctx1.method,
            value2: ctx2.method,
            description: `Method: ${ctx1.method} vs ${ctx2.method}`
          });
        }

        if (ctx1.scale !== ctx2.scale) {
          diff.differences.push({
            dimension: 'scale',
            value1: ctx1.scale,
            value2: ctx2.scale,
            description: `Scale: ${ctx1.scale} vs ${ctx2.scale}`
          });
        }

        if (ctx1.timeframe?.granularity !== ctx2.timeframe?.granularity) {
          diff.differences.push({
            dimension: 'timeframe',
            value1: ctx1.timeframe?.granularity,
            value2: ctx2.timeframe?.granularity,
            description: `Timeframe: ${ctx1.timeframe?.granularity} vs ${ctx2.timeframe?.granularity}`
          });
        }

        if (ctx1.source?.system !== ctx2.source?.system) {
          diff.differences.push({
            dimension: 'source',
            value1: ctx1.source?.system,
            value2: ctx2.source?.system,
            description: `Source: ${this.humanize(ctx1.source?.system)} vs ${this.humanize(ctx2.source?.system)}`
          });
        }

        if (diff.differences.length > 0) {
          differences.push(diff);
        }
      }
    }

    return {
      hasSuperposition: true,
      valueCount: values.length,
      differences
    };
  }

  /**
   * Generate natural language explanation of why values differ
   * @param {Object} cell - Cell to analyze
   * @returns {string}
   */
  generateExplanation(cell) {
    const diff = this.generateContextDiff(cell);
    if (!diff) {
      return 'This cell has a single value.';
    }

    const parts = [];

    parts.push(`This cell has ${diff.valueCount} different values because:`);
    parts.push('');

    diff.differences.forEach((d, idx) => {
      if (idx > 0) parts.push('');
      parts.push(`Values ${this.formatValue(d.value1)} and ${this.formatValue(d.value2)}:`);

      d.differences.forEach(dim => {
        parts.push(`  - ${dim.description}`);
      });
    });

    return parts.join('\n');
  }

  /**
   * Get human-readable summary of superposition
   * @param {Object} cell - Cell to analyze
   * @returns {Object|null}
   */
  getSuperpositionSummary(cell) {
    if (!this.detectSuperposition(cell)) {
      return null;
    }

    const values = cell.values;
    return {
      count: values.length,
      perspectives: values.map(obs => ({
        value: obs.value,
        method: obs.context_schema.method,
        scale: obs.context_schema.scale,
        definition: this.humanize(obs.context_schema.definition),
        source: this.humanize(obs.context_schema.source?.system),
        timestamp: obs.timestamp,
        agent: obs.context_schema.agent?.name || obs.context_schema.agent?.type
      }))
    };
  }

  /**
   * Check if values are numerically significantly different
   * @param {*} val1 - First value
   * @param {*} val2 - Second value
   * @returns {boolean}
   */
  valuesAreDifferent(val1, val2) {
    // Same value
    if (val1 === val2) return false;

    // Both null/undefined
    if ((val1 == null) && (val2 == null)) return false;

    // One is null
    if ((val1 == null) || (val2 == null)) return true;

    // Numeric comparison with threshold
    if (typeof val1 === 'number' && typeof val2 === 'number') {
      const avg = (Math.abs(val1) + Math.abs(val2)) / 2;
      if (avg === 0) return val1 !== val2;

      const diff = Math.abs(val1 - val2);
      const percentDiff = diff / avg;

      return percentDiff > this.diffThreshold.value;
    }

    // String comparison
    return String(val1) !== String(val2);
  }

  /**
   * Get the "strongest" value (highest priority)
   * Priority: measured > declared > derived > inferred > aggregated
   * @param {Object} cell - Cell to analyze
   * @param {Object} viewContext - Optional view context
   * @returns {Object|null}
   */
  getStrongestValue(cell, viewContext = {}) {
    if (!cell || !cell.values || cell.values.length === 0) {
      return null;
    }

    if (cell.values.length === 1) {
      return cell.values[0];
    }

    // Use EODataStructures scoring if available
    if (typeof EODataStructures !== 'undefined' && EODataStructures.getDominantValue) {
      return EODataStructures.getDominantValue(cell, viewContext);
    }

    // Fallback: simple priority
    const scored = cell.values.map(obs => ({
      observation: obs,
      score: this.methodPriority[obs.context_schema?.method] || 0
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].observation;
  }

  /**
   * Format value for display
   * @param {*} value - Value to format
   * @returns {string}
   */
  formatValue(value) {
    if (value == null) return 'null';
    if (typeof value === 'number') {
      return new Intl.NumberFormat().format(value);
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value);
  }

  /**
   * Humanize technical terms
   * @param {string} str - String to humanize
   * @returns {string}
   */
  humanize(str) {
    if (!str) return 'unknown';

    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\bauto\b/i, '(auto-detected)');
  }

  /**
   * Get indicator text for grid display
   * @param {Object} cell - Cell to analyze
   * @returns {string|null}
   */
  getIndicatorText(cell) {
    if (!this.detectSuperposition(cell)) {
      return null;
    }

    return `●${cell.values.length}`;
  }

  /**
   * Get tooltip text for grid hover
   * @param {Object} cell - Cell to analyze
   * @returns {string|null}
   */
  getTooltipText(cell) {
    if (!this.detectSuperposition(cell)) {
      return null;
    }

    const count = cell.values.length;
    return `${count} valid values available\nClick to view perspectives`;
  }

  /**
   * Check if superposition should be collapsed
   * (when newer, higher-fidelity value supersedes older ones)
   * @param {Object} cell - Cell to analyze
   * @param {Object} options - Options
   * @returns {boolean}
   */
  shouldCollapse(cell, options = {}) {
    if (!this.detectSuperposition(cell)) {
      return false;
    }

    const {
      tolerancePercent = 0.05,
      minAge = 7 * 24 * 60 * 60 * 1000 // 7 days
    } = options;

    const values = cell.values;
    if (values.length !== 2) return false;

    const [older, newer] = values.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Check if they're similar enough
    const similar = !this.valuesAreDifferent(older.value, newer.value);
    if (!similar) return false;

    // Check if newer has higher priority method
    const olderPriority = this.methodPriority[older.context_schema?.method] || 0;
    const newerPriority = this.methodPriority[newer.context_schema?.method] || 0;

    if (newerPriority <= olderPriority) return false;

    // Check if enough time has passed
    const age = new Date(newer.timestamp) - new Date(older.timestamp);
    if (age < minAge) return false;

    return true;
  }

  /**
   * Collapse superposition (remove lower-priority values)
   * @param {Object} cell - Cell to collapse
   * @returns {Object}
   */
  collapse(cell) {
    if (!this.shouldCollapse(cell)) {
      return cell;
    }

    // Keep only the highest priority value
    const strongest = this.getStrongestValue(cell);
    cell.values = [strongest];

    return cell;
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY: EOSUPDetector class
// Delegates to EOContextEngine for all SUP detection
// ============================================================================

class EOSUPDetector {
  constructor() {
    this._engine = new EOContextEngine();
  }

  detectSuperposition(cell) {
    return this._engine.detectSuperposition(cell);
  }

  contextsAreDifferent(ctx1, ctx2) {
    return this._engine.contextsAreDifferent(ctx1, ctx2);
  }

  timeframesOverlap(tf1, tf2) {
    return this._engine.timeframesOverlap(tf1, tf2);
  }

  getSuperposedValues(cell) {
    return this._engine.getSuperposedValues(cell);
  }

  generateContextDiff(cell) {
    return this._engine.generateContextDiff(cell);
  }

  generateExplanation(cell) {
    return this._engine.generateExplanation(cell);
  }

  getSummary(cell) {
    return this._engine.getSuperpositionSummary(cell);
  }

  valuesAreDifferent(val1, val2) {
    return this._engine.valuesAreDifferent(val1, val2);
  }

  getStrongestValue(cell, viewContext) {
    return this._engine.getStrongestValue(cell, viewContext);
  }

  formatValue(value) {
    return this._engine.formatValue(value);
  }

  humanize(str) {
    return this._engine.humanize(str);
  }

  getIndicatorText(cell) {
    return this._engine.getIndicatorText(cell);
  }

  getTooltipText(cell) {
    return this._engine.getTooltipText(cell);
  }

  shouldCollapse(cell, options) {
    return this._engine.shouldCollapse(cell, options);
  }

  collapse(cell) {
    return this._engine.collapse(cell);
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = { EOContextEngine, EOSUPDetector };
}

if (typeof window !== 'undefined') {
  window.EOContextEngine = EOContextEngine;
  window.EOSUPDetector = EOSUPDetector; // Backward compatibility
}
