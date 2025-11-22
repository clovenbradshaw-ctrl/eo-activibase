/**
 * EO Lean Context System
 * Implements context-as-metadata with minimal storage overhead
 *
 * Philosophy: Store context templates once, reference via IDs, only store deltas
 *
 * Features:
 * - Context template reuse across records
 * - String interning for common values
 * - Delta-only storage for overrides
 * - Lazy computation of stability and scale
 * - Compressed event history
 */

class EOLeanContext {
  constructor() {
    // Core storage
    this.contextTemplates = new Map();
    this.stringTable = new Map();
    this.stringIdCounter = 0;
    this.stabilityCache = new Map();
    this.templateIdCounter = 0;
  }

  /**
   * PHASE 1: CONTEXT TEMPLATE SYSTEM
   */

  /**
   * Create a minimal context template
   */
  createContextTemplate(config = {}) {
    const templateId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const template = {
      id: templateId,
      method: config.method || 'declared',
      scale: config.scale || 'individual',
      agent: config.agent || (typeof state !== 'undefined' ? state.currentUser?.id : null),
      source: this.internString(config.source) || 'workbase'
    };

    // Only store what matters - omit nulls and defaults
    if (config.definition) {
      template.definition = this.internString(config.definition);
    }
    if (config.jurisdiction) {
      template.jurisdiction = this.internString(config.jurisdiction);
    }
    if (config.timeframe) {
      template.timeframe = config.timeframe;
    }

    this.contextTemplates.set(templateId, template);
    return templateId;
  }

  /**
   * Register a context template for batch operations (like CSV import)
   */
  registerContextTemplate(config = {}) {
    return this.createContextTemplate(config);
  }

  /**
   * PHASE 1: STRING INTERNING
   * Reuse common strings instead of duplicating them
   */

  internString(str) {
    if (!str || typeof str !== 'string') return str;

    // Check if we've seen this string before
    for (const [id, value] of this.stringTable.entries()) {
      if (value === str) return id;
    }

    // New string - intern it
    const id = `$${this.stringIdCounter++}`;
    this.stringTable.set(id, str);
    return id;
  }

  getString(idOrString) {
    if (typeof idOrString === 'string' && idOrString.startsWith('$')) {
      return this.stringTable.get(idOrString) || idOrString;
    }
    return idOrString;
  }

  /**
   * PHASE 1: LEAN RECORD STRUCTURE
   * Create records with template references instead of full context
   */

  createLeanRecord(setId, data, templateId = null) {
    const recordId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const record = {
      id: recordId
      // Single template reference for whole record (usually)
    };

    // Only add template if provided
    if (templateId) {
      record.__ctx = templateId;
    }

    // Only store non-default values
    for (const [fieldId, value] of Object.entries(data)) {
      // Always store values - we'll let the field type determine defaults
      record[fieldId] = value;
    }

    // NOTE: We omit __stability and __ctxOverrides by default
    // They're only added when needed

    return record;
  }

  /**
   * Set field-specific context (when it differs from record template)
   */
  setFieldContext(record, fieldId, contextDelta) {
    if (!record.__ctxOverrides) {
      record.__ctxOverrides = {};
    }

    // Only store what's different from template
    const template = this.contextTemplates.get(record.__ctx) || {};
    const delta = {};

    for (const [key, value] of Object.entries(contextDelta)) {
      const templateValue = this.getString(template[key]);
      const deltaValue = typeof value === 'string' ? value : value;

      if (templateValue !== deltaValue) {
        delta[key] = value;
      }
    }

    // Only store if there are actual differences
    if (Object.keys(delta).length > 0) {
      record.__ctxOverrides[fieldId] = delta;
    }
  }

  /**
   * Get effective context for a field (template + overrides)
   */
  getFieldContext(record, fieldId) {
    const template = this.contextTemplates.get(record.__ctx) || {};
    const overrides = record.__ctxOverrides?.[fieldId] || {};

    // Expand interned strings
    const expandedTemplate = {};
    for (const [key, value] of Object.entries(template)) {
      if (key === 'id') continue; // Skip ID
      expandedTemplate[key] = this.getString(value);
    }

    return { ...expandedTemplate, ...overrides };
  }

  /**
   * PHASE 2: ULTRA-LEAN CONTEXT COMPARISON
   * Compare only critical dimensions
   */

  explainContextDifference(contextA, contextB) {
    const diffs = [];

    // Critical dimensions that block comparison
    const critical = [
      { key: 'definition', label: 'Definition' },
      { key: 'scale', label: 'Scale' },
      { key: 'method', label: 'Method' }
    ];

    critical.forEach(({ key, label }) => {
      const a = this.getString(contextA?.[key]);
      const b = this.getString(contextB?.[key]);

      if (a !== b) {
        diffs.push({ dimension: key, label, a, b, critical: true });
      }
    });

    // Secondary dimensions (informational only)
    const sourceA = this.getString(contextA?.source);
    const sourceB = this.getString(contextB?.source);
    if (sourceA !== sourceB) {
      diffs.push({
        dimension: 'source',
        label: 'Source System',
        a: sourceA,
        b: sourceB,
        critical: false
      });
    }

    const incompatible = diffs.some(d => d.critical);

    return {
      compatible: !incompatible,
      diffs,
      summary: diffs.length === 0 ? 'Same context' :
               incompatible ? `${diffs.filter(d => d.critical).map(d => d.label).join(', ')} differ` :
               'Minor differences only'
    };
  }

  /**
   * PHASE 3: LAZY STABILITY CALCULATION
   * Calculate on-demand instead of storing
   */

  getRecordStability(recordId) {
    // Check memory cache first (expires after 5 min)
    const cached = this.stabilityCache.get(recordId);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.tag;
    }

    // Calculate only last 30 days of events
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const recentEvents = (typeof state !== 'undefined' ? state.eventStream : []).filter(e =>
      e.object?.id === recordId &&
      (e.op === 'SEG' || e.o === 'SEG') &&
      new Date(e.published || e.t).getTime() >= thirtyDaysAgo
    );

    // Simple heuristic - no complex calculations
    let tag;
    if (recentEvents.length >= 10) tag = 'emerging';
    else if (recentEvents.length >= 3) tag = 'forming';
    else tag = 'stable';

    // Cache result
    this.stabilityCache.set(recordId, { tag, timestamp: Date.now() });

    // Limit cache size to prevent unbounded growth
    if (this.stabilityCache.size > 200) {
      const firstKey = this.stabilityCache.keys().next().value;
      this.stabilityCache.delete(firstKey);
    }

    return tag;
  }

  /**
   * Clear stability cache (call after major changes)
   */
  clearStabilityCache() {
    this.stabilityCache.clear();
  }

  /**
   * PHASE 4: IMPLICIT SCALE DETECTION
   * Infer scale without storing it
   */

  inferRecordScale(record) {
    // Quick heuristics - no heavy computation

    // Check for explicit scale field
    if (record.scale) return record.scale;

    // Check for organizational hierarchy fields
    if (record.org_id || record.organization_id) return 'organization';
    if (record.department_id || record.dept_id) return 'department';
    if (record.team_id) return 'team';

    // Check context template
    const template = this.contextTemplates.get(record.__ctx);
    if (template?.scale) return template.scale;

    // Default
    return 'individual';
  }

  /**
   * Group records by scale (lazy grouping - no pre-computation)
   */
  groupRecordsByScale(records, targetScale) {
    const groups = new Map();

    records.forEach(record => {
      const scale = this.inferRecordScale(record);

      // Determine group key
      let groupKey, groupLabel;

      if (targetScale === 'individual') {
        groupKey = record.id;
        groupLabel = record.name || record.id;
      } else if (targetScale === 'team') {
        groupKey = record.team_id || 'ungrouped';
        groupLabel = record.team_name || 'Ungrouped';
      } else if (targetScale === 'department') {
        groupKey = record.department_id || record.dept_id || 'ungrouped';
        groupLabel = record.department_name || record.dept_name || 'Ungrouped';
      } else {
        groupKey = 'organization';
        groupLabel = 'Organization';
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          label: groupLabel,
          records: []
        });
      }

      groups.get(groupKey).records.push(record);
    });

    return Array.from(groups.values());
  }

  /**
   * PHASE 5: COMPACT HISTORY EVENTS
   * Store minimal event data with abbreviated keys
   */

  createCompactEvent(verb, op, object, data = {}, options = {}) {
    const operator = this.detectOperator(verb, data);

    const event = {
      id: (typeof state !== 'undefined' ? state.eventIdCounter++ : Date.now()),
      v: verb,  // Abbreviated keys
      o: op,
      op: operator,  // Friendly name
      t: Date.now(),  // Timestamp as number, not ISO string
      a: (typeof state !== 'undefined' ? state.currentUser?.id : null),
      obj: object,
      d: {}  // Data - only populated if needed
    };

    // Only store what's not default
    if (data.fieldId) event.d.f = data.fieldId;
    if (data.oldValue !== undefined) event.d.old = data.oldValue;
    if (data.newValue !== undefined) event.d.new = data.newValue;
    if (data.summary) event.d.sum = data.summary;
    if (data.count) event.d.count = data.count;
    if (data.templateId) event.d.tpl = data.templateId;

    return event;
  }

  detectOperator(verb, data) {
    // Pattern matching - no lookup table needed
    if (verb.includes('Create') || verb.includes('Import')) return 'created';
    if (verb.includes('Delete')) return 'deleted';
    if (verb.includes('Connect')) return 'connected';
    if (data?.summary?.includes('split')) return 'split';
    if (data?.summary?.includes('merge')) return 'merged';
    return 'updated';
  }

  /**
   * Get human-readable time ago string
   */
  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  /**
   * UTILITY: Get storage size estimate
   */
  estimateStorageSize() {
    const templateSize = JSON.stringify(Array.from(this.contextTemplates.entries())).length;
    const stringTableSize = JSON.stringify(Array.from(this.stringTable.entries())).length;

    return {
      templates: templateSize,
      strings: stringTableSize,
      total: templateSize + stringTableSize,
      templateCount: this.contextTemplates.size,
      stringCount: this.stringTable.size
    };
  }

  /**
   * UTILITY: Export state for persistence
   */
  exportState() {
    return {
      contextTemplates: Array.from(this.contextTemplates.entries()),
      stringTable: Array.from(this.stringTable.entries()),
      stringIdCounter: this.stringIdCounter,
      templateIdCounter: this.templateIdCounter
    };
  }

  /**
   * UTILITY: Import state from persistence
   */
  importState(exportedState) {
    this.contextTemplates = new Map(exportedState.contextTemplates || []);
    this.stringTable = new Map(exportedState.stringTable || []);
    this.stringIdCounter = exportedState.stringIdCounter || 0;
    this.templateIdCounter = exportedState.templateIdCounter || 0;
    this.stabilityCache.clear(); // Don't persist cache
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOLeanContext;
}

if (typeof window !== 'undefined') {
  window.EOLeanContext = EOLeanContext;
}
