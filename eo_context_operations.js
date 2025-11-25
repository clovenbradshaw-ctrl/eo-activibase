/**
 * EO Context Operations
 *
 * Unified context-aware data operations for slicing, merging, joining,
 * and deduplicating data based on epistemic context.
 *
 * Key operations:
 * - slice() - Filter records by context dimensions
 * - smartMerge() - Merge records with automatic SUP detection
 * - bulkMerge() - Batch merge with source preference
 * - fromSource() / byAgent() / byMethod() - Provenance-based filters
 * - smartDedupe() - Context-aware deduplication
 * - contextJoin() - Join sets based on context matching
 */

// Dependency imports (for Node.js)
let EOContextQuery;
if (typeof require !== 'undefined') {
  EOContextQuery = require('./eo_context_query');
}

class EOContextOperations {
  constructor(state) {
    this.state = state;
    this.query = new EOContextQuery();
  }

  // ============================================================================
  // SLICING - Filter by Context
  // ============================================================================

  /**
   * Slice records by context filter
   *
   * @param {array|Map} records - Records to filter
   * @param {object} contextFilter - Context filter specification
   * @returns {array} Matching records
   *
   * @example
   * // Get Q4 2025 measured data
   * slice(records, { timeframe: 'Q4_2025', method: 'measured' })
   *
   * // Get data from Salesforce
   * slice(records, { source: 'salesforce' })
   *
   * // Get recent user edits
   * slice(records, { updatedAfter: '2025-11-01', agent: { type: 'person' } })
   */
  slice(records, contextFilter) {
    const recordArray = this.normalizeRecords(records);

    return recordArray.filter(record =>
      this.query.recordMatchesFilter(record, contextFilter)
    );
  }

  /**
   * Slice and return filtered cells (not just matching records)
   * Only returns values that match the filter
   */
  sliceValues(records, contextFilter) {
    const recordArray = this.normalizeRecords(records);

    return recordArray.map(record => {
      const filteredCells = {};

      for (const [fieldId, cell] of Object.entries(record.cells || {})) {
        const matchingValues = this.query.getMatchingValues(cell, contextFilter);
        if (matchingValues.length > 0) {
          filteredCells[fieldId] = {
            ...cell,
            values: matchingValues
          };
        }
      }

      if (Object.keys(filteredCells).length === 0) return null;

      return {
        ...record,
        cells: filteredCells,
        _slicedBy: contextFilter
      };
    }).filter(Boolean);
  }

  // ============================================================================
  // PROVENANCE-BASED FILTERING
  // ============================================================================

  /**
   * Filter records by source system
   *
   * @param {array} records - Records to filter
   * @param {string|string[]} sourceSystem - Source system(s) to match
   * @returns {array} Matching records
   *
   * @example
   * fromSource(records, 'salesforce')
   * fromSource(records, ['salesforce', 'hubspot'])
   */
  fromSource(records, sourceSystem) {
    const systems = Array.isArray(sourceSystem) ? sourceSystem : [sourceSystem];
    return this.slice(records, {
      source: obs => systems.some(s =>
        obs.context_schema?.source?.system?.toLowerCase().includes(s.toLowerCase())
      ),
      custom: obs => systems.some(s =>
        this.query.sourceMatches(obs.context_schema?.source, s)
      )
    });
  }

  /**
   * Filter records by contributing agent
   *
   * @param {array} records - Records to filter
   * @param {string|object} agentFilter - Agent ID or specification
   * @returns {array} Matching records
   *
   * @example
   * byAgent(records, 'user_123')
   * byAgent(records, { type: 'person' })
   * byAgent(records, { type: 'system' })
   */
  byAgent(records, agentFilter) {
    return this.slice(records, { agent: agentFilter });
  }

  /**
   * Filter records by epistemological method
   *
   * @param {array} records - Records to filter
   * @param {string|string[]} methods - Method(s) to match
   * @returns {array} Matching records
   *
   * @example
   * byMethod(records, 'measured')
   * byMethod(records, ['measured', 'declared'])
   */
  byMethod(records, methods) {
    return this.slice(records, { method: methods });
  }

  /**
   * Filter records by stability classification
   *
   * @param {array} records - Records to filter
   * @param {string} classification - 'emerging' | 'forming' | 'stable'
   * @returns {array} Matching records
   */
  byStability(records, classification) {
    return this.slice(records, { stability: classification });
  }

  // ============================================================================
  // SMART MERGE - Context-Aware Conflict Resolution
  // ============================================================================

  /**
   * Smart merge two records with automatic SUP detection
   *
   * When contexts differ: creates SUP (preserves both values)
   * When contexts same: takes newer value
   *
   * @param {object} recordA - First record
   * @param {object} recordB - Second record
   * @param {object} options - Merge options
   * @returns {object} Merged record
   *
   * @example
   * smartMerge(csvRecord, salesforceRecord, { conflictStrategy: 'context-aware' })
   */
  smartMerge(recordA, recordB, options = {}) {
    const {
      conflictStrategy = 'context-aware', // 'context-aware' | 'latest-wins' | 'prefer-measured' | 'keep-all'
      preserveIds = true
    } = options;

    const mergedCells = {};
    const allFieldIds = new Set([
      ...Object.keys(recordA.cells || {}),
      ...Object.keys(recordB.cells || {})
    ]);

    for (const fieldId of allFieldIds) {
      const cellA = recordA.cells?.[fieldId];
      const cellB = recordB.cells?.[fieldId];

      if (!cellA && cellB) {
        mergedCells[fieldId] = this.cloneCell(cellB);
      } else if (cellA && !cellB) {
        mergedCells[fieldId] = this.cloneCell(cellA);
      } else if (cellA && cellB) {
        mergedCells[fieldId] = this.resolveCellConflict(cellA, cellB, conflictStrategy);
      }
    }

    const baseId = preserveIds ? recordA.record_id : this.generateRecordId();

    return {
      ...recordA,
      record_id: baseId,
      cells: mergedCells,
      _mergedFrom: [recordA.record_id, recordB.record_id],
      _mergedAt: Date.now(),
      _mergeStrategy: conflictStrategy,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Resolve conflict between two cells
   */
  resolveCellConflict(cellA, cellB, strategy) {
    switch (strategy) {
      case 'context-aware':
        return this.contextAwareResolve(cellA, cellB);

      case 'latest-wins':
        return this.latestWins(cellA, cellB);

      case 'prefer-measured':
        return this.preferMethod(cellA, cellB, 'measured');

      case 'keep-all':
        return this.createSupCell(cellA, cellB);

      default:
        return this.contextAwareResolve(cellA, cellB);
    }
  }

  /**
   * Context-aware resolution: SUP for different contexts, newer for same
   */
  contextAwareResolve(cellA, cellB) {
    const valuesA = cellA.values || [];
    const valuesB = cellB.values || [];
    const merged = [];
    const processedB = new Set();

    for (const obsA of valuesA) {
      // Check if B has a value with equivalent context
      const matchingBIndex = valuesB.findIndex((obsB, idx) =>
        !processedB.has(idx) &&
        this.query.contextsEquivalent(obsA.context_schema, obsB.context_schema)
      );

      if (matchingBIndex >= 0) {
        const obsB = valuesB[matchingBIndex];
        processedB.add(matchingBIndex);

        // Same context: take newer
        const tsA = new Date(obsA.timestamp).getTime();
        const tsB = new Date(obsB.timestamp).getTime();
        merged.push(tsA >= tsB ? obsA : obsB);
      } else {
        // No matching context: keep A
        merged.push(obsA);
      }
    }

    // Add any B values without matching A context
    valuesB.forEach((obsB, idx) => {
      if (!processedB.has(idx)) {
        merged.push(obsB);
      }
    });

    return {
      ...cellA,
      values: merged,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Latest wins resolution
   */
  latestWins(cellA, cellB) {
    const allValues = [...(cellA.values || []), ...(cellB.values || [])];
    if (allValues.length === 0) return cellA;

    const latest = allValues.reduce((a, b) =>
      new Date(a.timestamp) > new Date(b.timestamp) ? a : b
    );

    return {
      ...cellA,
      values: [latest],
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Prefer a specific method
   */
  preferMethod(cellA, cellB, preferredMethod) {
    const allValues = [...(cellA.values || []), ...(cellB.values || [])];
    if (allValues.length === 0) return cellA;

    // Prefer values with the specified method
    const preferred = allValues.filter(obs =>
      obs.context_schema?.method === preferredMethod
    );

    if (preferred.length > 0) {
      // Take the most recent with preferred method
      const latest = preferred.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      );
      return { ...cellA, values: [latest], updated_at: new Date().toISOString() };
    }

    // Fallback to latest if no preferred method found
    return this.latestWins(cellA, cellB);
  }

  /**
   * Create a SUP cell with all values
   */
  createSupCell(cellA, cellB) {
    return {
      ...cellA,
      values: [...(cellA.values || []), ...(cellB.values || [])],
      updated_at: new Date().toISOString()
    };
  }

  // ============================================================================
  // BULK MERGE
  // ============================================================================

  /**
   * Bulk merge multiple records with source preference
   *
   * @param {array} records - Records to merge
   * @param {object} options - Merge options
   * @returns {object} { merged: record, decisions: [] }
   *
   * @example
   * bulkMerge(records, {
   *   conflictStrategy: 'context-aware',
   *   sourcePreference: ['salesforce', 'hubspot', 'csv_import']
   * })
   */
  bulkMerge(records, options = {}) {
    const {
      conflictStrategy = 'context-aware',
      sourcePreference = []
    } = options;

    if (records.length === 0) return null;
    if (records.length === 1) return { merged: records[0], decisions: [] };

    // Sort by source preference
    const sorted = this.sortBySourcePreference(records, sourcePreference);
    const decisions = [];

    // Start with the preferred source record as base
    let merged = sorted[0];
    decisions.push({
      action: 'base_selected',
      recordId: merged.record_id,
      source: this.query.getPrimarySource(merged),
      reason: 'highest_preference'
    });

    // Merge in remaining records
    for (let i = 1; i < sorted.length; i++) {
      const record = sorted[i];
      const beforeSupCount = this.countSupValues(merged);

      merged = this.smartMerge(merged, record, { conflictStrategy });

      const afterSupCount = this.countSupValues(merged);
      const supCreated = afterSupCount - beforeSupCount;

      decisions.push({
        action: 'merged',
        recordId: record.record_id,
        source: this.query.getPrimarySource(record),
        supCreated
      });
    }

    return { merged, decisions };
  }

  /**
   * Sort records by source preference
   */
  sortBySourcePreference(records, preference) {
    if (preference.length === 0) return records;

    return [...records].sort((a, b) => {
      const sourceA = this.query.getPrimarySource(a)?.toLowerCase() || '';
      const sourceB = this.query.getPrimarySource(b)?.toLowerCase() || '';

      const indexA = preference.findIndex(p => sourceA.includes(p.toLowerCase()));
      const indexB = preference.findIndex(p => sourceB.includes(p.toLowerCase()));

      // -1 means not found, push to end
      const rankA = indexA === -1 ? preference.length : indexA;
      const rankB = indexB === -1 ? preference.length : indexB;

      return rankA - rankB;
    });
  }

  /**
   * Count values with superposition (cells with > 1 value)
   */
  countSupValues(record) {
    let count = 0;
    for (const cell of Object.values(record.cells || {})) {
      if (cell.values && cell.values.length > 1) {
        count += cell.values.length - 1;
      }
    }
    return count;
  }

  // ============================================================================
  // SMART DEDUPLICATION
  // ============================================================================

  /**
   * Context-aware deduplication
   *
   * @param {array} records - Records to deduplicate
   * @param {object} options - Dedup options
   * @returns {object} { records, decisions, stats }
   *
   * @example
   * smartDedupe(records, {
   *   identity: ['name', 'email'],
   *   contextStrategy: 'preserve',  // Different sources -> SUP
   *   sourcePreference: ['salesforce', 'hubspot'],
   *   threshold: 0.85,
   *   algorithm: 'fuzzy'
   * })
   */
  smartDedupe(records, options = {}) {
    const {
      identity = [],
      contextStrategy = 'preserve', // 'preserve' | 'merge' | 'latest'
      sourcePreference = [],
      threshold = 0.85,
      algorithm = 'fuzzy' // 'exact' | 'fuzzy'
    } = options;

    if (identity.length === 0) {
      return {
        records,
        decisions: [],
        stats: { clustersFound: 0, recordsMerged: 0 }
      };
    }

    // Find duplicate clusters
    const clusters = this.findDuplicateClusters(records, identity, threshold, algorithm);

    // Process each cluster
    const results = [];
    const decisions = [];

    for (const cluster of clusters) {
      if (cluster.length === 1) {
        results.push(cluster[0]);
        continue;
      }

      const processed = this.processDedupeCluster(cluster, contextStrategy, sourcePreference);
      results.push(processed.record);
      decisions.push(processed.decision);
    }

    return {
      records: results,
      decisions,
      stats: {
        clustersFound: clusters.filter(c => c.length > 1).length,
        recordsMerged: records.length - results.length
      }
    };
  }

  /**
   * Find duplicate clusters based on identity fields
   */
  findDuplicateClusters(records, identityFields, threshold, algorithm) {
    const clusters = [];
    const processed = new Set();

    for (let i = 0; i < records.length; i++) {
      const recA = records[i];
      if (processed.has(recA.record_id)) continue;

      const cluster = [recA];
      processed.add(recA.record_id);

      const sigA = this.buildSignature(recA, identityFields);
      if (!sigA) continue;

      for (let j = i + 1; j < records.length; j++) {
        const recB = records[j];
        if (processed.has(recB.record_id)) continue;

        const sigB = this.buildSignature(recB, identityFields);
        if (!sigB) continue;

        const similarity = this.calculateSimilarity(sigA, sigB, algorithm);

        if (similarity >= threshold) {
          cluster.push(recB);
          processed.add(recB.record_id);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Process a duplicate cluster based on strategy
   */
  processDedupeCluster(cluster, contextStrategy, sourcePreference) {
    // Group by source
    const bySource = new Map();
    for (const record of cluster) {
      const source = this.query.getPrimarySource(record) || 'unknown';
      if (!bySource.has(source)) bySource.set(source, []);
      bySource.get(source).push(record);
    }

    const sources = [...bySource.keys()];

    switch (contextStrategy) {
      case 'preserve': {
        // Different sources -> context-aware merge (creates SUP)
        // Same source -> latest wins
        if (sources.length === 1) {
          // All from same source: take latest
          const latest = cluster.reduce((a, b) =>
            new Date(a.updated_at || 0) > new Date(b.updated_at || 0) ? a : b
          );
          return {
            record: latest,
            decision: {
              action: 'took_latest',
              clusterSize: cluster.length,
              sources,
              reason: 'same_source'
            }
          };
        }

        // Multiple sources: smart merge
        const { merged, decisions } = this.bulkMerge(cluster, {
          conflictStrategy: 'context-aware',
          sourcePreference
        });
        return {
          record: merged,
          decision: {
            action: 'context_merge',
            clusterSize: cluster.length,
            sources,
            subDecisions: decisions,
            supCreated: this.countSupValues(merged)
          }
        };
      }

      case 'merge': {
        // Force merge with source preference
        const { merged, decisions } = this.bulkMerge(cluster, {
          conflictStrategy: 'latest-wins',
          sourcePreference
        });
        return {
          record: merged,
          decision: {
            action: 'force_merge',
            clusterSize: cluster.length,
            sources,
            subDecisions: decisions
          }
        };
      }

      case 'latest': {
        // Take most recently updated
        const latest = cluster.reduce((a, b) =>
          new Date(a.updated_at || 0) > new Date(b.updated_at || 0) ? a : b
        );
        return {
          record: latest,
          decision: {
            action: 'took_latest',
            clusterSize: cluster.length,
            sources,
            selected: latest.record_id,
            discarded: cluster.filter(r => r !== latest).map(r => r.record_id)
          }
        };
      }

      default:
        return { record: cluster[0], decision: { action: 'default', reason: 'unknown_strategy' } };
    }
  }

  /**
   * Build signature from identity fields
   */
  buildSignature(record, identityFields) {
    const parts = identityFields.map(fieldId => {
      // Try cells first
      const cell = record.cells?.[fieldId];
      if (cell?.values?.[0]) {
        const value = cell.values[0].value;
        return value != null ? String(value).toLowerCase().trim() : null;
      }

      // Fall back to legacy fields
      const value = record.fields?.[fieldId] ?? record[fieldId];
      return value != null ? String(value).toLowerCase().trim() : null;
    }).filter(Boolean);

    return parts.length > 0 ? parts.join('|||') : null;
  }

  /**
   * Calculate similarity between two signatures
   */
  calculateSimilarity(sigA, sigB, algorithm) {
    if (algorithm === 'exact') {
      return sigA === sigB ? 1.0 : 0.0;
    }

    // Fuzzy: Jaccard similarity
    const setA = new Set(sigA.split(/\s+/));
    const setB = new Set(sigB.split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return union.size > 0 ? intersection.size / union.size : 0.0;
  }

  // ============================================================================
  // CONTEXT-AWARE JOIN
  // ============================================================================

  /**
   * Join two sets based on context matching
   *
   * @param {Set|Map|array} setA - First set
   * @param {Set|Map|array} setB - Second set
   * @param {object} options - Join options
   * @returns {array} Joined records
   *
   * @example
   * contextJoin(salesData, quotas, {
   *   matchContext: {
   *     subject: 'same',
   *     timeframe: 'overlapping',
   *     scale: 'same'
   *   },
   *   valueStrategy: 'sup'
   * })
   */
  contextJoin(setA, setB, options = {}) {
    const {
      matchContext = {},
      valueStrategy = 'sup', // 'sup' | 'merge' | 'a-wins' | 'b-wins'
      preserveProvenance = true,
      joinType = 'inner' // 'inner' | 'left' | 'right' | 'full'
    } = options;

    const recordsA = this.normalizeRecords(setA);
    const recordsB = this.normalizeRecords(setB);
    const results = [];
    const matchedA = new Set();
    const matchedB = new Set();

    for (const recordA of recordsA) {
      for (const recordB of recordsB) {
        if (this.recordContextsMatch(recordA, recordB, matchContext)) {
          const joined = this.joinRecords(recordA, recordB, valueStrategy, preserveProvenance);
          results.push(joined);
          matchedA.add(recordA.record_id);
          matchedB.add(recordB.record_id);
        }
      }
    }

    // Handle outer join types
    if (joinType === 'left' || joinType === 'full') {
      for (const recordA of recordsA) {
        if (!matchedA.has(recordA.record_id)) {
          results.push({ ...recordA, _joinStatus: 'left_only' });
        }
      }
    }

    if (joinType === 'right' || joinType === 'full') {
      for (const recordB of recordsB) {
        if (!matchedB.has(recordB.record_id)) {
          results.push({ ...recordB, _joinStatus: 'right_only' });
        }
      }
    }

    return results;
  }

  /**
   * Check if two record contexts match based on criteria
   */
  recordContextsMatch(recordA, recordB, matchContext) {
    const ctxA = this.query.getRecordContext(recordA);
    const ctxB = this.query.getRecordContext(recordB);

    if (matchContext.subject === 'same') {
      // Would need subject tracking - for now, skip
    }

    if (matchContext.timeframe === 'overlapping') {
      if (!this.query.timeframesOverlap(ctxA.timeframe, ctxB.timeframe)) {
        return false;
      }
    }

    if (matchContext.scale === 'same') {
      if (ctxA.scale !== ctxB.scale) return false;
    }

    if (matchContext.source === 'same') {
      if (ctxA.source?.system !== ctxB.source?.system) return false;
    }

    if (matchContext.method === 'same') {
      if (ctxA.method !== ctxB.method) return false;
    }

    return true;
  }

  /**
   * Join two records together
   */
  joinRecords(recordA, recordB, valueStrategy, preserveProvenance) {
    const mergedCells = {};

    // Add all cells from A
    for (const [fieldId, cell] of Object.entries(recordA.cells || {})) {
      mergedCells[fieldId] = this.cloneCell(cell);
    }

    // Merge in cells from B
    for (const [fieldId, cell] of Object.entries(recordB.cells || {})) {
      if (!mergedCells[fieldId]) {
        mergedCells[fieldId] = this.cloneCell(cell);
      } else {
        // Conflict: use value strategy
        switch (valueStrategy) {
          case 'sup':
            mergedCells[fieldId] = this.createSupCell(mergedCells[fieldId], cell);
            break;
          case 'merge':
            mergedCells[fieldId] = this.contextAwareResolve(mergedCells[fieldId], cell);
            break;
          case 'a-wins':
            // Keep A's value
            break;
          case 'b-wins':
            mergedCells[fieldId] = this.cloneCell(cell);
            break;
        }
      }
    }

    return {
      record_id: this.generateRecordId(),
      cells: mergedCells,
      _joinedFrom: [recordA.record_id, recordB.record_id],
      _joinedAt: Date.now(),
      _joinStatus: 'matched',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Normalize records input to array
   */
  normalizeRecords(input) {
    if (Array.isArray(input)) return input;
    if (input instanceof Map) return Array.from(input.values());
    if (input?.records instanceof Map) return Array.from(input.records.values());
    if (input?.records && Array.isArray(input.records)) return input.records;
    return [];
  }

  /**
   * Clone a cell deeply
   */
  cloneCell(cell) {
    return {
      ...cell,
      values: (cell.values || []).map(obs => ({
        ...obs,
        context_schema: { ...obs.context_schema }
      }))
    };
  }

  /**
   * Generate a unique record ID
   */
  generateRecordId() {
    return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Log an event to state
   */
  logEvent(eventType, data) {
    if (!this.state) return;

    if (!this.state.eventStream) {
      this.state.eventStream = [];
    }

    this.state.eventStream.push({
      id: (this.state.eventIdCounter || 0) + 1,
      timestamp: Date.now(),
      user: this.state.currentUser,
      type: eventType,
      data
    });

    this.state.eventIdCounter = (this.state.eventIdCounter || 0) + 1;
  }
}

// ============================================================================
// STATIC CONVENIENCE METHODS
// ============================================================================

/**
 * Create a standalone slice function (no state required)
 */
EOContextOperations.slice = function(records, contextFilter) {
  const ops = new EOContextOperations(null);
  return ops.slice(records, contextFilter);
};

/**
 * Create a standalone smartMerge function
 */
EOContextOperations.smartMerge = function(recordA, recordB, options) {
  const ops = new EOContextOperations(null);
  return ops.smartMerge(recordA, recordB, options);
};

/**
 * Create a standalone smartDedupe function
 */
EOContextOperations.smartDedupe = function(records, options) {
  const ops = new EOContextOperations(null);
  return ops.smartDedupe(records, options);
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOContextOperations;
}

if (typeof window !== 'undefined') {
  window.EOContextOperations = EOContextOperations;
}
