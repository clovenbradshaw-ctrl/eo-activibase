/**
 * EO Context Inference Engine
 * Automatically captures epistemic context from user actions
 *
 * Features:
 * - Infers context from CSV imports
 * - Captures context from user edits
 * - Derives context from value shapes and column names
 * - Tracks provenance from UI flows
 *
 * Usage:
 *   const engine = new EOContextEngine();
 *   const context = engine.inferFromImport(filename, columnName, value);
 */

class EOContextEngine {
  constructor() {
    this.currentUser = null;
    this.viewContext = {
      scale: 'individual',
      definition: null,
      method: null
    };
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
    const definition = this.inferDefinitionFromColumnName(columnName);
    const method = this.inferMethodFromValue(value, columnName);

    return EODataStructures.createContextSchema({
      method: method || 'measured',
      definition,
      scale,
      timeframe,
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
  inferDefinitionFromColumnName(columnName) {
    const name = columnName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Revenue patterns
    if (name.match(/revenue|sales|income/)) {
      if (name.match(/gaap/)) return 'revenue_gaap';
      if (name.match(/arr|recurring/)) return 'revenue_arr';
      return 'revenue_gaap_auto';
    }

    // Cost patterns
    if (name.match(/cost|expense|spend/)) {
      return 'cost_auto';
    }

    // Score/Rating patterns
    if (name.match(/score|rating|grade/)) {
      return 'score_auto';
    }

    // Count patterns
    if (name.match(/count|number|quantity/)) {
      return 'count_auto';
    }

    // Date patterns
    if (name.match(/date|time|when/)) {
      return 'date_auto';
    }

    // Default: sanitized column name
    return name || 'unknown';
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
    const definition = this.inferDefinitionFromColumnName(columnName);

    return EODataStructures.createContextSchema({
      method: 'declared',
      definition,
      scale,
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
    const definition = this.inferDefinitionFromColumnName(columnName);

    return EODataStructures.createContextSchema({
      method: 'inferred',
      definition,
      scale,
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
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOContextEngine;
}

if (typeof window !== 'undefined') {
  window.EOContextEngine = EOContextEngine;
}
