/**
 * EO Simplified Data Operations
 *
 * Unified module that brings together all context-aware data operations
 * into a single, easy-to-use API.
 *
 * This module provides:
 * - Context-based slicing (filter by method, source, timeframe, etc.)
 * - Smart merging with automatic SUP detection
 * - Temporal operations (as-of, during, changes)
 * - Provenance-based filtering
 * - Context-aware deduplication
 * - Context-aware joins
 * - View extensions for chainable queries
 *
 * Example Usage:
 *
 *   // Create an instance
 *   const dataOps = new EOSimplifiedDataOps(state);
 *
 *   // Slice by context
 *   const q4Data = dataOps.slice(records, { timeframe: 'Q4_2025', method: 'measured' });
 *
 *   // Smart merge
 *   const merged = dataOps.smartMerge(recordA, recordB);
 *
 *   // Temporal query
 *   const asOfQ3End = dataOps.asOf(records, '2025-09-30');
 *
 *   // Provenance filter
 *   const salesforceData = dataOps.fromSource(records, 'salesforce');
 *
 *   // Smart dedupe
 *   const deduped = dataOps.smartDedupe(records, { identity: ['name', 'email'] });
 *
 *   // View builder
 *   const view = dataOps.createView(setId)
 *     .name('Q4 Salesforce')
 *     .fromSource('salesforce')
 *     .during('Q4_2025')
 *     .build();
 */

// Dependency imports
let EOContextQuery, EOContextOperations, EOTemporalOps;
let extendView, ViewBuilder, applyViewContextFilters;

if (typeof require !== 'undefined') {
  EOContextQuery = require('./eo_context_query');
  EOContextOperations = require('./eo_context_operations');
  EOTemporalOps = require('./eo_temporal_ops');
  const viewExt = require('./eo_view_extensions');
  extendView = viewExt.extendView;
  ViewBuilder = viewExt.ViewBuilder;
  applyViewContextFilters = viewExt.applyViewContextFilters;
}

class EOSimplifiedDataOps {
  constructor(state) {
    this.state = state;
    this.query = new EOContextQuery();
    this.ops = new EOContextOperations(state);
    this.temporal = new EOTemporalOps();
  }

  // ============================================================================
  // SLICING - Filter by Context
  // ============================================================================

  /**
   * Slice records by context filter
   * @param {array} records - Records to filter
   * @param {object} filter - Context filter (timeframe, method, source, etc.)
   * @returns {array} Matching records
   *
   * @example
   * slice(records, { timeframe: 'Q4_2025' })
   * slice(records, { method: 'measured', source: 'salesforce' })
   */
  slice(records, filter) {
    return this.ops.slice(records, filter);
  }

  /**
   * Slice and return only matching values (not just records)
   */
  sliceValues(records, filter) {
    return this.ops.sliceValues(records, filter);
  }

  // ============================================================================
  // PROVENANCE-BASED FILTERING
  // ============================================================================

  /**
   * Filter by source system
   * @example fromSource(records, 'salesforce')
   */
  fromSource(records, source) {
    return this.ops.fromSource(records, source);
  }

  /**
   * Filter by contributing agent
   * @example byAgent(records, 'user_123')
   * @example byAgent(records, { type: 'person' })
   */
  byAgent(records, agent) {
    return this.ops.byAgent(records, agent);
  }

  /**
   * Filter by epistemological method
   * @example byMethod(records, 'measured')
   * @example byMethod(records, ['measured', 'declared'])
   */
  byMethod(records, methods) {
    return this.ops.byMethod(records, methods);
  }

  /**
   * Filter by stability classification
   * @example byStability(records, 'stable')
   */
  byStability(records, classification) {
    return this.ops.byStability(records, classification);
  }

  // ============================================================================
  // SMART MERGE
  // ============================================================================

  /**
   * Smart merge two records with automatic SUP detection
   * @param {object} recordA - First record
   * @param {object} recordB - Second record
   * @param {object} options - { conflictStrategy: 'context-aware' | 'latest-wins' | 'keep-all' }
   *
   * @example
   * smartMerge(csvRecord, salesforceRecord)
   * smartMerge(recordA, recordB, { conflictStrategy: 'latest-wins' })
   */
  smartMerge(recordA, recordB, options = {}) {
    return this.ops.smartMerge(recordA, recordB, options);
  }

  /**
   * Bulk merge multiple records with source preference
   * @param {array} records - Records to merge
   * @param {object} options - { sourcePreference: ['salesforce', 'hubspot'] }
   *
   * @example
   * bulkMerge(duplicateRecords, { sourcePreference: ['salesforce'] })
   */
  bulkMerge(records, options = {}) {
    return this.ops.bulkMerge(records, options);
  }

  // ============================================================================
  // TEMPORAL OPERATIONS
  // ============================================================================

  /**
   * Get records as they existed at a point in time
   * @param {array} records - Records to query
   * @param {string|Date} date - Point in time
   *
   * @example
   * asOf(records, '2025-09-30')  // End of Q3 2025
   */
  asOf(records, date) {
    return this.temporal.asOf(records, date);
  }

  /**
   * Get values that apply to a specific timeframe
   * @param {array} records - Records to filter
   * @param {string} timeframe - Timeframe specification
   *
   * @example
   * during(records, 'Q4_2025')
   * during(records, 'last_30_days')
   * during(records, { start: '2025-10-01', end: '2025-12-31' })
   */
  during(records, timeframe) {
    return this.temporal.during(records, timeframe);
  }

  /**
   * Get a log of significant changes
   * @param {array} records - Records to analyze
   * @param {object} options - { minInterval: '7d', methods: ['measured'], since: '2025-01-01' }
   *
   * @example
   * changes(records, { minInterval: '7d', since: '2025-01-01' })
   */
  changes(records, options = {}) {
    return this.temporal.changes(records, options);
  }

  /**
   * Build a timeline of all changes
   * @param {object|array} records - Record(s) to analyze
   * @param {object} options - { groupBy: 'day' | 'week' | 'month' }
   *
   * @example
   * timeline(record)
   * timeline(records, { groupBy: 'month' })
   */
  timeline(records, options = {}) {
    return this.temporal.timeline(records, options);
  }

  /**
   * Compare records between two dates
   * @param {array} records - Records to compare
   * @param {string} fromDate - Start date
   * @param {string} toDate - End date
   *
   * @example
   * compare(records, '2025-01-01', '2025-12-31')
   */
  compare(records, fromDate, toDate) {
    return this.temporal.compare(records, fromDate, toDate);
  }

  /**
   * Analyze trends for a field
   * @param {array} records - Records to analyze
   * @param {string} fieldId - Field to analyze
   * @param {object} options - { period: 'month', aggregation: 'average' }
   *
   * @example
   * analyzeTrend(records, 'revenue', { period: 'quarter' })
   */
  analyzeTrend(records, fieldId, options = {}) {
    return this.temporal.analyzeTrend(records, fieldId, options);
  }

  // ============================================================================
  // SMART DEDUPLICATION
  // ============================================================================

  /**
   * Context-aware deduplication
   * @param {array} records - Records to dedupe
   * @param {object} options - Dedup configuration
   *
   * @example
   * smartDedupe(records, {
   *   identity: ['name', 'email'],
   *   contextStrategy: 'preserve',  // Different sources → SUP
   *   sourcePreference: ['salesforce', 'hubspot']
   * })
   */
  smartDedupe(records, options = {}) {
    return this.ops.smartDedupe(records, options);
  }

  // ============================================================================
  // CONTEXT-AWARE JOINS
  // ============================================================================

  /**
   * Join sets based on context matching
   * @param {array} setA - First set of records
   * @param {array} setB - Second set of records
   * @param {object} options - Join configuration
   *
   * @example
   * contextJoin(salesData, quotas, {
   *   matchContext: { timeframe: 'overlapping', scale: 'same' }
   * })
   */
  contextJoin(setA, setB, options = {}) {
    return this.ops.contextJoin(setA, setB, options);
  }

  // ============================================================================
  // TIMEFRAME UTILITIES
  // ============================================================================

  /**
   * Parse a timeframe string into { start, end, granularity }
   * @param {string} timeframe - e.g., 'Q4_2025', '2025-11', 'last_30_days'
   *
   * @example
   * parseTimeframe('Q4_2025')  // { start: '2025-10-01...', end: '2025-12-31...', granularity: 'quarter' }
   */
  parseTimeframe(timeframe) {
    return this.query.parseTimeframe(timeframe);
  }

  /**
   * Check if two timeframes overlap
   */
  timeframesOverlap(tf1, tf2) {
    return this.query.timeframesOverlap(tf1, tf2);
  }

  // ============================================================================
  // VIEW BUILDER
  // ============================================================================

  /**
   * Create a new view with chainable context filters
   * @param {string} setId - Set ID for the view
   *
   * @example
   * createView(setId)
   *   .name('Q4 Salesforce Data')
   *   .fromSource('salesforce')
   *   .during('Q4_2025')
   *   .method('measured')
   *   .build()
   */
  createView(setId) {
    return ViewBuilder.create(this.state, setId);
  }

  /**
   * Extend an existing view with chainable context filters
   * @param {object} view - View to extend
   *
   * @example
   * extendView(baseView)
   *   .fromSource('salesforce')
   *   .during('Q4_2025')
   *   .applyFilters(records)
   */
  extendView(view) {
    return extendView(view);
  }

  /**
   * Apply view's context filters to records
   * @param {object} view - View with contextFilters
   * @param {array} records - Records to filter
   */
  applyViewFilters(view, records) {
    return applyViewContextFilters(view, records);
  }

  // ============================================================================
  // CONTEXT UTILITIES
  // ============================================================================

  /**
   * Get the primary source system from a record
   */
  getPrimarySource(record) {
    return this.query.getPrimarySource(record);
  }

  /**
   * Get aggregate context for a record
   */
  getRecordContext(record) {
    return this.query.getRecordContext(record);
  }

  /**
   * Check if two contexts are equivalent
   */
  contextsEquivalent(ctx1, ctx2) {
    return this.query.contextsEquivalent(ctx1, ctx2);
  }

  /**
   * Get the best value from a cell for a view context
   */
  getBestValue(cell, viewContext = {}) {
    return this.query.getBestValue(cell, viewContext);
  }

  /**
   * Score a value for relevance to a view context
   */
  scoreValueForContext(observation, viewContext) {
    return this.query.scoreValueForContext(observation, viewContext);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS (Static)
// ============================================================================

/**
 * Quick slice without instantiating
 */
EOSimplifiedDataOps.slice = function(records, filter) {
  return EOContextOperations.slice(records, filter);
};

/**
 * Quick smart merge without instantiating
 */
EOSimplifiedDataOps.smartMerge = function(recordA, recordB, options) {
  return EOContextOperations.smartMerge(recordA, recordB, options);
};

/**
 * Quick smart dedupe without instantiating
 */
EOSimplifiedDataOps.smartDedupe = function(records, options) {
  return EOContextOperations.smartDedupe(records, options);
};

/**
 * Quick timeframe parsing
 */
EOSimplifiedDataOps.parseTimeframe = function(timeframe) {
  return new EOContextQuery().parseTimeframe(timeframe);
};

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EOSimplifiedDataOps,
    // Re-export components for direct access
    EOContextQuery,
    EOContextOperations,
    EOTemporalOps,
    extendView,
    ViewBuilder,
    applyViewContextFilters
  };
}

if (typeof window !== 'undefined') {
  window.EOSimplifiedDataOps = EOSimplifiedDataOps;
}
