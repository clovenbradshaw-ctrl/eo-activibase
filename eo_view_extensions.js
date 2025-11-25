/**
 * EO View Extensions
 *
 * Chainable methods for views to enable simple context-based filtering.
 * These extensions add a fluent API for building context-aware views.
 *
 * Usage:
 *   const filteredView = extendView(baseView)
 *     .fromSource('salesforce')
 *     .method('measured')
 *     .during('Q4_2025')
 *     .stability('stable');
 *
 * Or use the ViewBuilder for creating new views:
 *   const view = ViewBuilder.create(state, setId)
 *     .name('Q4 Salesforce Data')
 *     .fromSource('salesforce')
 *     .during('Q4_2025')
 *     .build();
 */

// Dependency imports
let EOContextQuery, EOContextOperations, EOTemporalOps;
if (typeof require !== 'undefined') {
  EOContextQuery = require('./eo_context_query');
  EOContextOperations = require('./eo_context_operations');
  EOTemporalOps = require('./eo_temporal_ops');
}

// ============================================================================
// VIEW EXTENSION FUNCTIONS
// ============================================================================

/**
 * Extend a view with chainable context filter methods
 *
 * @param {object} view - View entity to extend
 * @returns {object} Extended view with chainable methods
 */
function extendView(view) {
  // Clone the view to avoid mutation
  const extended = {
    ...view,
    contextFilters: [...(view.contextFilters || [])],
    temporalMode: view.temporalMode ? { ...view.temporalMode } : null
  };

  // Add chainable methods
  return Object.assign(extended, {
    // ========================================================================
    // PROVENANCE FILTERS
    // ========================================================================

    /**
     * Filter by source system
     * @param {string|string[]} sourceSystem - Source system(s) to match
     */
    fromSource(sourceSystem) {
      this.contextFilters.push({
        source: Array.isArray(sourceSystem) ? sourceSystem : sourceSystem
      });
      return this;
    },

    /**
     * Filter by contributing agent
     * @param {string|object} agent - Agent ID or specification
     */
    editedBy(agent) {
      this.contextFilters.push({ agent });
      return this;
    },

    /**
     * Filter by epistemological method
     * @param {string|string[]} methods - Method(s) to match
     */
    method(methods) {
      this.contextFilters.push({ method: methods });
      return this;
    },

    /**
     * Filter by definition
     * @param {string|string[]} definitions - Definition(s) to match (supports wildcards)
     */
    definition(definitions) {
      this.contextFilters.push({ definition: definitions });
      return this;
    },

    /**
     * Filter by scale
     * @param {string|string[]} scales - Scale(s) to match
     */
    scale(scales) {
      this.contextFilters.push({ scale: scales });
      return this;
    },

    // ========================================================================
    // TEMPORAL FILTERS
    // ========================================================================

    /**
     * Filter to values from a specific timeframe
     * @param {string|object} timeframe - Timeframe specification
     */
    during(timeframe) {
      this.contextFilters.push({ timeframe });
      return this;
    },

    /**
     * Filter to values updated after a date
     * @param {string|Date} date - Date threshold
     */
    updatedSince(date) {
      this.contextFilters.push({ updatedAfter: date });
      return this;
    },

    /**
     * Filter to values updated before a date
     * @param {string|Date} date - Date threshold
     */
    updatedBefore(date) {
      this.contextFilters.push({ updatedBefore: date });
      return this;
    },

    /**
     * Set temporal mode to point-in-time snapshot
     * @param {string|Date} date - Point in time
     */
    asOf(date) {
      this.temporalMode = { type: 'asOf', date };
      return this;
    },

    // ========================================================================
    // STABILITY FILTERS
    // ========================================================================

    /**
     * Filter by stability classification
     * @param {string} classification - 'emerging' | 'forming' | 'stable'
     */
    stability(classification) {
      this.contextFilters.push({ stability: classification });
      return this;
    },

    // ========================================================================
    // PROVENANCE CHAIN FILTERS
    // ========================================================================

    /**
     * Filter to views derived from a specific view
     * @param {string} viewId - Parent view ID
     */
    derivedFrom(viewId) {
      if (!this.provenanceFilters) this.provenanceFilters = {};
      if (!this.provenanceFilters.derivedFromViewIds) {
        this.provenanceFilters.derivedFromViewIds = [];
      }
      this.provenanceFilters.derivedFromViewIds.push(viewId);
      return this;
    },

    /**
     * Filter to records/views created by a specific operation
     * @param {string} operationId - Operation ID
     */
    createdByOperation(operationId) {
      if (!this.provenanceFilters) this.provenanceFilters = {};
      if (!this.provenanceFilters.derivedFromOperationIds) {
        this.provenanceFilters.derivedFromOperationIds = [];
      }
      this.provenanceFilters.derivedFromOperationIds.push(operationId);
      return this;
    },

    // ========================================================================
    // NEGATION
    // ========================================================================

    /**
     * Exclude records matching a filter
     * @param {object} filter - Filter to negate
     */
    exclude(filter) {
      this.contextFilters.push({ not: filter });
      return this;
    },

    // ========================================================================
    // EXECUTION
    // ========================================================================

    /**
     * Apply all context filters to a set of records
     * @param {array} records - Records to filter
     * @returns {array} Filtered records
     */
    applyFilters(records) {
      const query = new (EOContextQuery || window.EOContextQuery)();
      const ops = new (EOContextOperations || window.EOContextOperations)(null);
      const temporal = new (EOTemporalOps || window.EOTemporalOps)();

      let result = records;

      // Apply temporal mode first
      if (this.temporalMode) {
        if (this.temporalMode.type === 'asOf') {
          result = temporal.asOf(result, this.temporalMode.date);
        } else if (this.temporalMode.type === 'during') {
          result = temporal.during(result, this.temporalMode.timeframe);
        }
      }

      // Apply each context filter
      for (const filter of this.contextFilters) {
        result = ops.slice(result, filter);
      }

      return result;
    },

    /**
     * Get the combined filter specification
     * @returns {object} Combined filter object
     */
    getFilterSpec() {
      return {
        contextFilters: this.contextFilters,
        temporalMode: this.temporalMode,
        provenanceFilters: this.provenanceFilters || null
      };
    },

    /**
     * Convert back to a plain view object (removes methods)
     * @returns {object} Plain view object
     */
    toView() {
      const { fromSource, editedBy, method, definition, scale, during,
              updatedSince, updatedBefore, asOf, stability, derivedFrom,
              createdByOperation, exclude, applyFilters, getFilterSpec,
              toView, ...plainView } = this;
      return plainView;
    }
  });
}

// ============================================================================
// VIEW BUILDER
// ============================================================================

/**
 * Builder pattern for creating new views with context filters
 */
class ViewBuilder {
  constructor(state, setId) {
    this.state = state;
    this.config = {
      setId,
      name: 'Untitled view',
      type: 'grid',
      contextFilters: [],
      temporalMode: null,
      filters: [],
      sorts: [],
      groups: [],
      visibleFieldIds: [],
      notes: ''
    };
  }

  /**
   * Create a new ViewBuilder
   * @param {object} state - Application state
   * @param {string} setId - Set ID for the view
   * @returns {ViewBuilder}
   */
  static create(state, setId) {
    return new ViewBuilder(state, setId);
  }

  /**
   * Set the view name
   */
  name(name) {
    this.config.name = name;
    return this;
  }

  /**
   * Set the view type
   */
  type(type) {
    this.config.type = type;
    return this;
  }

  /**
   * Set visible fields
   */
  fields(fieldIds) {
    this.config.visibleFieldIds = fieldIds;
    return this;
  }

  /**
   * Add a standard filter
   */
  filter(fieldId, operator, value) {
    this.config.filters.push({ fieldId, operator, value });
    return this;
  }

  /**
   * Add a sort
   */
  sort(fieldId, direction = 'asc') {
    this.config.sorts.push({ fieldId, direction });
    return this;
  }

  /**
   * Add a grouping
   */
  group(fieldId) {
    this.config.groups.push({ fieldId });
    return this;
  }

  /**
   * Add notes
   */
  notes(notes) {
    this.config.notes = notes;
    return this;
  }

  // Context filter methods (same as extendView)

  fromSource(sourceSystem) {
    this.config.contextFilters.push({
      source: Array.isArray(sourceSystem) ? sourceSystem : sourceSystem
    });
    return this;
  }

  editedBy(agent) {
    this.config.contextFilters.push({ agent });
    return this;
  }

  method(methods) {
    this.config.contextFilters.push({ method: methods });
    return this;
  }

  definition(definitions) {
    this.config.contextFilters.push({ definition: definitions });
    return this;
  }

  scale(scales) {
    this.config.contextFilters.push({ scale: scales });
    return this;
  }

  during(timeframe) {
    this.config.contextFilters.push({ timeframe });
    return this;
  }

  updatedSince(date) {
    this.config.contextFilters.push({ updatedAfter: date });
    return this;
  }

  asOf(date) {
    this.config.temporalMode = { type: 'asOf', date };
    return this;
  }

  stability(classification) {
    this.config.contextFilters.push({ stability: classification });
    return this;
  }

  derivedFrom(viewId) {
    if (!this.config.derivedFromViewIds) {
      this.config.derivedFromViewIds = [];
    }
    this.config.derivedFromViewIds.push(viewId);
    return this;
  }

  /**
   * Build and register the view
   * @returns {object} Created view entity
   */
  build() {
    // If createView is available, use it
    if (this.state && typeof createView === 'function') {
      return createView(this.state, this.config);
    }

    // Otherwise return the config for manual creation
    return this.config;
  }

  /**
   * Build but don't register (returns config only)
   * @returns {object} View configuration
   */
  toConfig() {
    return { ...this.config };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Apply context filters from a view to records
 *
 * @param {object} view - View with contextFilters
 * @param {array} records - Records to filter
 * @returns {array} Filtered records
 */
function applyViewContextFilters(view, records) {
  if (!view.contextFilters || view.contextFilters.length === 0) {
    return records;
  }

  const extended = extendView(view);
  return extended.applyFilters(records);
}

/**
 * Create a quick context filter view (without full builder)
 *
 * @param {string} setId - Set ID
 * @param {object} contextFilter - Context filter specification
 * @param {string} name - Optional view name
 * @returns {object} View configuration
 */
function createContextFilterView(setId, contextFilter, name = null) {
  const query = new (EOContextQuery || window.EOContextQuery)();

  // Generate name from filter if not provided
  if (!name) {
    const parts = [];
    if (contextFilter.timeframe) parts.push(contextFilter.timeframe);
    if (contextFilter.source) parts.push(`from ${contextFilter.source}`);
    if (contextFilter.method) parts.push(contextFilter.method);
    if (contextFilter.stability) parts.push(contextFilter.stability);
    name = parts.length > 0 ? parts.join(' - ') : 'Filtered view';
  }

  return {
    setId,
    name,
    type: 'grid',
    contextFilters: [contextFilter],
    notes: `Context filter: ${JSON.stringify(contextFilter)}`
  };
}

/**
 * Merge context filters from multiple views
 *
 * @param {...object} views - Views with contextFilters
 * @returns {object[]} Combined context filters
 */
function mergeContextFilters(...views) {
  const combined = [];
  for (const view of views) {
    if (view.contextFilters) {
      combined.push(...view.contextFilters);
    }
  }
  return combined;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extendView,
    ViewBuilder,
    applyViewContextFilters,
    createContextFilterView,
    mergeContextFilters
  };
}

if (typeof window !== 'undefined') {
  window.extendView = extendView;
  window.ViewBuilder = ViewBuilder;
  window.applyViewContextFilters = applyViewContextFilters;
  window.createContextFilterView = createContextFilterView;
  window.mergeContextFilters = mergeContextFilters;
}
