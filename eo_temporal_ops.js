/**
 * EO Temporal Operations
 *
 * Time-based operations for working with data history:
 * - asOf() - Point-in-time snapshots
 * - during() - Filter by applicable timeframe
 * - changes() - Change log with interval filtering
 * - timeline() - Build a timeline of changes
 *
 * These operations leverage the timestamp on every ValueObservation
 * and the timeframe in every context_schema.
 */

// Dependency imports
let EOContextQuery;
if (typeof require !== 'undefined') {
  EOContextQuery = require('./eo_context_query');
}

class EOTemporalOps {
  constructor() {
    this.query = new EOContextQuery();
  }

  // ============================================================================
  // AS-OF QUERIES - Point in Time
  // ============================================================================

  /**
   * Return records as they existed at a specific point in time
   *
   * @param {array} records - Records to query
   * @param {string|Date} date - Point in time
   * @returns {array} Records with values as of that date
   *
   * @example
   * asOf(records, '2025-09-30')  // End of Q3
   * asOf(records, new Date('2025-01-01'))
   */
  asOf(records, date) {
    const asOfDate = new Date(date);
    const asOfTime = asOfDate.getTime();

    return records.map(record => {
      const snapshotCells = {};
      let hasValues = false;

      for (const [fieldId, cell] of Object.entries(record.cells || {})) {
        // Find values that existed at asOfDate
        const validValues = (cell.values || []).filter(obs => {
          const obsTime = new Date(obs.timestamp).getTime();
          return obsTime <= asOfTime;
        });

        if (validValues.length > 0) {
          // Take the most recent value as of that date
          const latest = validValues.reduce((a, b) =>
            new Date(a.timestamp) > new Date(b.timestamp) ? a : b
          );

          snapshotCells[fieldId] = {
            ...cell,
            values: [latest],
            _asOfOriginalCount: cell.values.length
          };
          hasValues = true;
        }
      }

      if (!hasValues) return null;

      return {
        ...record,
        cells: snapshotCells,
        _asOf: date,
        _asOfTimestamp: asOfTime
      };
    }).filter(Boolean);
  }

  /**
   * Return records as they existed at the start of a period
   */
  asOfPeriodStart(records, period) {
    const timeframe = this.query.parseTimeframe(period);
    if (!timeframe) return records;

    return this.asOf(records, timeframe.start);
  }

  /**
   * Return records as they existed at the end of a period
   */
  asOfPeriodEnd(records, period) {
    const timeframe = this.query.parseTimeframe(period);
    if (!timeframe) return records;

    return this.asOf(records, timeframe.end);
  }

  // ============================================================================
  // DURING QUERIES - Timeframe Filtering
  // ============================================================================

  /**
   * Return values that apply to a specific timeframe
   *
   * @param {array} records - Records to filter
   * @param {string|object} timeframe - Timeframe specification
   * @returns {array} Records with values from that timeframe
   *
   * @example
   * during(records, 'Q4_2025')
   * during(records, { start: '2025-10-01', end: '2025-12-31' })
   * during(records, 'last_30_days')
   */
  during(records, timeframe) {
    const range = this.query.parseTimeframe(timeframe);
    if (!range) return records;

    return records.map(record => {
      const filteredCells = {};
      let hasValues = false;

      for (const [fieldId, cell] of Object.entries(record.cells || {})) {
        const matchingValues = (cell.values || []).filter(obs => {
          const tf = obs.context_schema?.timeframe;

          // If observation has no timeframe, check observation timestamp
          if (!tf || !tf.start) {
            const obsTime = new Date(obs.timestamp).getTime();
            const rangeStart = new Date(range.start).getTime();
            const rangeEnd = new Date(range.end).getTime();
            return obsTime >= rangeStart && obsTime <= rangeEnd;
          }

          // Check if timeframes overlap
          return this.query.timeframesOverlap(tf, range);
        });

        if (matchingValues.length > 0) {
          filteredCells[fieldId] = {
            ...cell,
            values: matchingValues,
            _duringOriginalCount: cell.values.length
          };
          hasValues = true;
        }
      }

      if (!hasValues) return null;

      return {
        ...record,
        cells: filteredCells,
        _during: timeframe,
        _duringRange: range
      };
    }).filter(Boolean);
  }

  /**
   * Return values observed during a specific timeframe
   * (based on observation timestamp, not value's applicable timeframe)
   */
  observedDuring(records, timeframe) {
    const range = this.query.parseTimeframe(timeframe);
    if (!range) return records;

    const rangeStart = new Date(range.start).getTime();
    const rangeEnd = new Date(range.end).getTime();

    return records.map(record => {
      const filteredCells = {};
      let hasValues = false;

      for (const [fieldId, cell] of Object.entries(record.cells || {})) {
        const matchingValues = (cell.values || []).filter(obs => {
          const obsTime = new Date(obs.timestamp).getTime();
          return obsTime >= rangeStart && obsTime <= rangeEnd;
        });

        if (matchingValues.length > 0) {
          filteredCells[fieldId] = {
            ...cell,
            values: matchingValues
          };
          hasValues = true;
        }
      }

      if (!hasValues) return null;

      return {
        ...record,
        cells: filteredCells,
        _observedDuring: timeframe
      };
    }).filter(Boolean);
  }

  // ============================================================================
  // CHANGES QUERY - Change Log
  // ============================================================================

  /**
   * Get a log of significant changes over time
   *
   * @param {array} records - Records to analyze
   * @param {object} options - Filter options
   * @returns {array} Change log entries
   *
   * @example
   * changes(records, { minInterval: '7d' })  // Ignore changes < 7 days apart
   * changes(records, { methods: ['measured', 'declared'], since: '2025-01-01' })
   */
  changes(records, options = {}) {
    const {
      minInterval = null,      // Minimum time between changes (e.g., '7d')
      methods = null,          // Filter by method types
      fieldIds = null,         // Specific fields only
      since = null,            // Only changes after this date
      until = null,            // Only changes before this date
      agents = null,           // Filter by agent IDs
      sources = null           // Filter by source systems
    } = options;

    const minIntervalMs = minInterval ? this.query.parseInterval(minInterval) : null;
    const sinceTime = since ? new Date(since).getTime() : null;
    const untilTime = until ? new Date(until).getTime() : null;

    const changeLog = [];

    for (const record of records) {
      for (const [fieldId, cell] of Object.entries(record.cells || {})) {
        // Field filter
        if (fieldIds && !fieldIds.includes(fieldId)) continue;

        // Sort values by timestamp
        const sortedValues = [...(cell.values || [])].sort((a, b) =>
          new Date(a.timestamp) - new Date(b.timestamp)
        );

        let prevObs = null;
        let lastAcceptedTime = 0;

        for (const obs of sortedValues) {
          const ctx = obs.context_schema || {};
          const obsTime = new Date(obs.timestamp).getTime();

          // Method filter
          if (methods && !methods.includes(ctx.method)) continue;

          // Time range filters
          if (sinceTime && obsTime < sinceTime) continue;
          if (untilTime && obsTime > untilTime) continue;

          // Agent filter
          if (agents && !agents.includes(ctx.agent?.id)) continue;

          // Source filter
          if (sources) {
            const sourceSystem = ctx.source?.system?.toLowerCase();
            if (!sources.some(s => sourceSystem?.includes(s.toLowerCase()))) continue;
          }

          // Minimum interval filter
          if (minIntervalMs && lastAcceptedTime > 0) {
            if (obsTime - lastAcceptedTime < minIntervalMs) continue;
          }

          // Record the change
          if (prevObs !== null) {
            changeLog.push({
              recordId: record.record_id,
              fieldId,
              fieldName: cell.field_name,
              timestamp: obs.timestamp,
              oldValue: prevObs.value,
              newValue: obs.value,
              oldContext: prevObs.context_schema,
              newContext: obs.context_schema,
              agent: ctx.agent,
              source: ctx.source,
              method: ctx.method,
              changeType: this.classifyChange(prevObs, obs)
            });
          } else {
            // First value = creation
            changeLog.push({
              recordId: record.record_id,
              fieldId,
              fieldName: cell.field_name,
              timestamp: obs.timestamp,
              oldValue: null,
              newValue: obs.value,
              oldContext: null,
              newContext: obs.context_schema,
              agent: ctx.agent,
              source: ctx.source,
              method: ctx.method,
              changeType: 'created'
            });
          }

          prevObs = obs;
          lastAcceptedTime = obsTime;
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    return changeLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Classify the type of change between two observations
   */
  classifyChange(oldObs, newObs) {
    const oldCtx = oldObs.context_schema || {};
    const newCtx = newObs.context_schema || {};

    // Context dimension changes
    if (oldCtx.method !== newCtx.method) {
      return 'method_change';
    }
    if (oldCtx.definition !== newCtx.definition) {
      return 'redefinition';
    }
    if (oldCtx.scale !== newCtx.scale) {
      return 'scale_change';
    }
    if (oldCtx.source?.system !== newCtx.source?.system) {
      return 'source_change';
    }

    // Value magnitude changes for numbers
    if (typeof oldObs.value === 'number' && typeof newObs.value === 'number') {
      const percentChange = Math.abs((newObs.value - oldObs.value) / oldObs.value);
      if (percentChange > 0.5) return 'major_change';
      if (percentChange > 0.1) return 'moderate_change';
      return 'minor_change';
    }

    return 'value_update';
  }

  // ============================================================================
  // TIMELINE - Structured History
  // ============================================================================

  /**
   * Build a timeline of all changes for a record or records
   *
   * @param {object|array} recordOrRecords - Record(s) to build timeline for
   * @param {object} options - Timeline options
   * @returns {array} Timeline entries sorted by date
   *
   * @example
   * timeline(record)
   * timeline(records, { groupBy: 'day' })
   */
  timeline(recordOrRecords, options = {}) {
    const {
      groupBy = null,  // null | 'hour' | 'day' | 'week' | 'month'
      includeMetadata = true
    } = options;

    const records = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords];
    const entries = [];

    for (const record of records) {
      // Record creation
      if (record.created_at) {
        entries.push({
          timestamp: record.created_at,
          type: 'record_created',
          recordId: record.record_id,
          details: includeMetadata ? {
            stability: record.stability?.classification
          } : null
        });
      }

      // Value changes
      for (const [fieldId, cell] of Object.entries(record.cells || {})) {
        for (const obs of cell.values || []) {
          entries.push({
            timestamp: obs.timestamp,
            type: 'value_set',
            recordId: record.record_id,
            fieldId,
            fieldName: cell.field_name,
            value: obs.value,
            details: includeMetadata ? {
              method: obs.context_schema?.method,
              source: obs.context_schema?.source?.system,
              agent: obs.context_schema?.agent,
              definition: obs.context_schema?.definition
            } : null
          });
        }
      }

      // Edit history entries
      for (const entry of record.edit_history || []) {
        entries.push({
          timestamp: entry.timestamp,
          type: 'edit',
          recordId: record.record_id,
          operator: entry.operator,
          description: entry.description,
          details: includeMetadata ? {
            agent: entry.agent,
            oldValue: entry.old_value,
            newValue: entry.new_value
          } : null
        });
      }
    }

    // Sort by timestamp
    entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Group if requested
    if (groupBy) {
      return this.groupTimelineEntries(entries, groupBy);
    }

    return entries;
  }

  /**
   * Group timeline entries by time period
   */
  groupTimelineEntries(entries, groupBy) {
    const groups = new Map();

    for (const entry of entries) {
      const key = this.getTimeGroupKey(entry.timestamp, groupBy);
      if (!groups.has(key)) {
        groups.set(key, {
          period: key,
          periodStart: this.getPeriodStart(entry.timestamp, groupBy),
          periodEnd: this.getPeriodEnd(entry.timestamp, groupBy),
          entries: []
        });
      }
      groups.get(key).entries.push(entry);
    }

    return Array.from(groups.values());
  }

  /**
   * Get a grouping key for a timestamp
   */
  getTimeGroupKey(timestamp, groupBy) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');

    switch (groupBy) {
      case 'hour':
        return `${year}-${month}-${day}T${hour}`;
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week':
        const weekNum = this.getWeekNumber(date);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
      case 'month':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Get ISO week number
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Get the start of a time period
   */
  getPeriodStart(timestamp, groupBy) {
    const date = new Date(timestamp);

    switch (groupBy) {
      case 'hour':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).toISOString();
      case 'day':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      case 'week':
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek;
        return new Date(date.getFullYear(), date.getMonth(), diff).toISOString();
      case 'month':
        return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
      default:
        return timestamp;
    }
  }

  /**
   * Get the end of a time period
   */
  getPeriodEnd(timestamp, groupBy) {
    const date = new Date(timestamp);

    switch (groupBy) {
      case 'hour':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 59, 59, 999).toISOString();
      case 'day':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).toISOString();
      case 'week':
        const dayOfWeek = date.getDay();
        const diff = date.getDate() + (6 - dayOfWeek);
        return new Date(date.getFullYear(), date.getMonth(), diff, 23, 59, 59, 999).toISOString();
      case 'month':
        return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      default:
        return timestamp;
    }
  }

  // ============================================================================
  // COMPARISON OPERATIONS
  // ============================================================================

  /**
   * Compare records between two points in time
   *
   * @param {array} records - Records to compare
   * @param {string} fromDate - Start date
   * @param {string} toDate - End date
   * @returns {array} Comparison results
   */
  compare(records, fromDate, toDate) {
    const fromSnapshot = this.asOf(records, fromDate);
    const toSnapshot = this.asOf(records, toDate);

    const comparisons = [];

    // Build maps for efficient lookup
    const fromMap = new Map(fromSnapshot.map(r => [r.record_id, r]));
    const toMap = new Map(toSnapshot.map(r => [r.record_id, r]));

    // Find all record IDs
    const allIds = new Set([...fromMap.keys(), ...toMap.keys()]);

    for (const recordId of allIds) {
      const fromRecord = fromMap.get(recordId);
      const toRecord = toMap.get(recordId);

      if (!fromRecord && toRecord) {
        comparisons.push({
          recordId,
          status: 'added',
          from: null,
          to: toRecord
        });
      } else if (fromRecord && !toRecord) {
        comparisons.push({
          recordId,
          status: 'removed',
          from: fromRecord,
          to: null
        });
      } else if (fromRecord && toRecord) {
        const changes = this.compareRecordValues(fromRecord, toRecord);
        if (changes.length > 0) {
          comparisons.push({
            recordId,
            status: 'modified',
            from: fromRecord,
            to: toRecord,
            changes
          });
        }
      }
    }

    return comparisons;
  }

  /**
   * Compare values between two record snapshots
   */
  compareRecordValues(fromRecord, toRecord) {
    const changes = [];
    const allFieldIds = new Set([
      ...Object.keys(fromRecord.cells || {}),
      ...Object.keys(toRecord.cells || {})
    ]);

    for (const fieldId of allFieldIds) {
      const fromCell = fromRecord.cells?.[fieldId];
      const toCell = toRecord.cells?.[fieldId];

      const fromValue = fromCell?.values?.[0]?.value;
      const toValue = toCell?.values?.[0]?.value;

      if (fromValue !== toValue) {
        changes.push({
          fieldId,
          from: fromValue,
          to: toValue,
          change: this.calculateValueChange(fromValue, toValue)
        });
      }
    }

    return changes;
  }

  /**
   * Calculate the change between two values
   */
  calculateValueChange(from, to) {
    if (from === null || from === undefined) {
      return { type: 'added' };
    }
    if (to === null || to === undefined) {
      return { type: 'removed' };
    }
    if (typeof from === 'number' && typeof to === 'number') {
      const diff = to - from;
      const percentChange = from !== 0 ? (diff / from) * 100 : null;
      return {
        type: 'numeric',
        difference: diff,
        percentChange
      };
    }
    return { type: 'value_change' };
  }

  // ============================================================================
  // TREND ANALYSIS
  // ============================================================================

  /**
   * Analyze trends for a specific field across records
   *
   * @param {array} records - Records to analyze
   * @param {string} fieldId - Field to analyze
   * @param {object} options - Analysis options
   * @returns {object} Trend analysis results
   */
  analyzeTrend(records, fieldId, options = {}) {
    const {
      period = 'month',  // Aggregation period
      aggregation = 'average'  // 'sum' | 'average' | 'count' | 'min' | 'max'
    } = options;

    const dataPoints = [];

    for (const record of records) {
      const cell = record.cells?.[fieldId];
      if (!cell?.values) continue;

      for (const obs of cell.values) {
        const value = obs.value;
        if (typeof value !== 'number') continue;

        const timestamp = obs.timestamp;
        const periodKey = this.getTimeGroupKey(timestamp, period);

        dataPoints.push({
          periodKey,
          timestamp,
          value
        });
      }
    }

    // Group by period
    const byPeriod = new Map();
    for (const point of dataPoints) {
      if (!byPeriod.has(point.periodKey)) {
        byPeriod.set(point.periodKey, []);
      }
      byPeriod.get(point.periodKey).push(point.value);
    }

    // Aggregate
    const aggregatedPoints = [];
    for (const [periodKey, values] of byPeriod) {
      let aggregatedValue;
      switch (aggregation) {
        case 'sum':
          aggregatedValue = values.reduce((a, b) => a + b, 0);
          break;
        case 'average':
          aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        default:
          aggregatedValue = values[0];
      }

      aggregatedPoints.push({
        period: periodKey,
        value: aggregatedValue,
        count: values.length
      });
    }

    // Sort by period
    aggregatedPoints.sort((a, b) => a.period.localeCompare(b.period));

    // Calculate trend direction
    let trendDirection = 'stable';
    if (aggregatedPoints.length >= 2) {
      const first = aggregatedPoints[0].value;
      const last = aggregatedPoints[aggregatedPoints.length - 1].value;
      const change = last - first;
      const percentChange = first !== 0 ? (change / first) * 100 : 0;

      if (percentChange > 5) trendDirection = 'increasing';
      else if (percentChange < -5) trendDirection = 'decreasing';
    }

    return {
      fieldId,
      period,
      aggregation,
      dataPoints: aggregatedPoints,
      trendDirection,
      summary: {
        totalPeriods: aggregatedPoints.length,
        latestValue: aggregatedPoints[aggregatedPoints.length - 1]?.value,
        earliestValue: aggregatedPoints[0]?.value
      }
    };
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOTemporalOps;
}

if (typeof window !== 'undefined') {
  window.EOTemporalOps = EOTemporalOps;
}
