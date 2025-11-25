/**
 * EO Context Query
 *
 * Provides context filter parsing, matching, and query execution.
 * This is the foundation for all context-aware data operations.
 *
 * Features:
 * - Smart timeframe parsing (Q4_2025, 2025-11, last_30_days)
 * - Context dimension matching (method, scale, source, agent)
 * - Flexible filter composition
 * - Observation-level and record-level filtering
 */

class EOContextQuery {
  constructor() {
    // Method priority for scoring/preference
    this.methodPriority = {
      'measured': 5,
      'declared': 4,
      'derived': 3,
      'inferred': 2,
      'aggregated': 1
    };

    // Valid values for validation
    this.validMethods = ['measured', 'declared', 'aggregated', 'inferred', 'derived'];
    this.validScales = ['individual', 'team', 'department', 'organization'];
    this.validGranularities = ['instant', 'day', 'week', 'month', 'quarter', 'year'];
  }

  // ============================================================================
  // TIMEFRAME PARSING
  // ============================================================================

  /**
   * Parse a timeframe specification into a normalized { start, end, granularity } object
   *
   * @param {string|object} input - Timeframe specification
   * @returns {object} { start: ISO string, end: ISO string, granularity: string }
   *
   * Supported formats:
   * - 'Q1_2025', 'Q4_2025' - Quarters
   * - '2025' - Full year
   * - '2025-11' - Month
   * - '2025-11-25' - Specific day
   * - 'last_7_days', 'last_30_days', 'last_90_days' - Relative ranges
   * - 'this_week', 'this_month', 'this_quarter', 'this_year' - Current period
   * - 'last_week', 'last_month', 'last_quarter', 'last_year' - Previous period
   * - { start, end, granularity? } - Direct object specification
   */
  parseTimeframe(input) {
    if (!input) return null;

    // Already an object with start/end
    if (typeof input === 'object' && input.start) {
      return {
        start: this.normalizeDate(input.start),
        end: this.normalizeDate(input.end || input.start),
        granularity: input.granularity || 'day'
      };
    }

    const str = String(input).trim();
    const now = new Date();

    // Quarter pattern: Q1_2025, Q4-2025, Q1 2025
    const quarterMatch = str.match(/^Q([1-4])[_\s-]*(\d{4})$/i);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]);
      const year = parseInt(quarterMatch[2]);
      const startMonth = (quarter - 1) * 3;

      return {
        start: new Date(year, startMonth, 1).toISOString(),
        end: new Date(year, startMonth + 3, 0, 23, 59, 59, 999).toISOString(),
        granularity: 'quarter'
      };
    }

    // Year pattern: 2025
    if (/^\d{4}$/.test(str)) {
      const year = parseInt(str);
      return {
        start: new Date(year, 0, 1).toISOString(),
        end: new Date(year, 11, 31, 23, 59, 59, 999).toISOString(),
        granularity: 'year'
      };
    }

    // Month pattern: 2025-11
    const monthMatch = str.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) {
      const year = parseInt(monthMatch[1]);
      const month = parseInt(monthMatch[2]) - 1;
      const lastDay = new Date(year, month + 1, 0).getDate();

      return {
        start: new Date(year, month, 1).toISOString(),
        end: new Date(year, month, lastDay, 23, 59, 59, 999).toISOString(),
        granularity: 'month'
      };
    }

    // Day pattern: 2025-11-25
    const dayMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dayMatch) {
      const year = parseInt(dayMatch[1]);
      const month = parseInt(dayMatch[2]) - 1;
      const day = parseInt(dayMatch[3]);

      return {
        start: new Date(year, month, day, 0, 0, 0, 0).toISOString(),
        end: new Date(year, month, day, 23, 59, 59, 999).toISOString(),
        granularity: 'day'
      };
    }

    // Relative: last_N_days
    const lastDaysMatch = str.match(/^last[_-]?(\d+)[_-]?days?$/i);
    if (lastDaysMatch) {
      const days = parseInt(lastDaysMatch[1]);
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - days);

      return {
        start: start.toISOString(),
        end: end.toISOString(),
        granularity: 'day'
      };
    }

    // Current period: this_week, this_month, this_quarter, this_year
    const thisPeriodMatch = str.match(/^this[_-]?(week|month|quarter|year)$/i);
    if (thisPeriodMatch) {
      return this.getCurrentPeriod(thisPeriodMatch[1].toLowerCase());
    }

    // Previous period: last_week, last_month, last_quarter, last_year
    const lastPeriodMatch = str.match(/^last[_-]?(week|month|quarter|year)$/i);
    if (lastPeriodMatch) {
      return this.getPreviousPeriod(lastPeriodMatch[1].toLowerCase());
    }

    // Fallback: try to parse as date
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return {
        start: parsed.toISOString(),
        end: parsed.toISOString(),
        granularity: 'instant'
      };
    }

    return null;
  }

  /**
   * Get the current period (this week, this month, etc.)
   */
  getCurrentPeriod(period) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const dayOfWeek = now.getDay();

    switch (period) {
      case 'week': {
        const startOfWeek = new Date(year, month, day - dayOfWeek);
        const endOfWeek = new Date(year, month, day + (6 - dayOfWeek), 23, 59, 59, 999);
        return { start: startOfWeek.toISOString(), end: endOfWeek.toISOString(), granularity: 'week' };
      }
      case 'month': {
        const lastDay = new Date(year, month + 1, 0).getDate();
        return {
          start: new Date(year, month, 1).toISOString(),
          end: new Date(year, month, lastDay, 23, 59, 59, 999).toISOString(),
          granularity: 'month'
        };
      }
      case 'quarter': {
        const quarter = Math.floor(month / 3);
        const startMonth = quarter * 3;
        return {
          start: new Date(year, startMonth, 1).toISOString(),
          end: new Date(year, startMonth + 3, 0, 23, 59, 59, 999).toISOString(),
          granularity: 'quarter'
        };
      }
      case 'year': {
        return {
          start: new Date(year, 0, 1).toISOString(),
          end: new Date(year, 11, 31, 23, 59, 59, 999).toISOString(),
          granularity: 'year'
        };
      }
    }
    return null;
  }

  /**
   * Get the previous period (last week, last month, etc.)
   */
  getPreviousPeriod(period) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const dayOfWeek = now.getDay();

    switch (period) {
      case 'week': {
        const startOfLastWeek = new Date(year, month, day - dayOfWeek - 7);
        const endOfLastWeek = new Date(year, month, day - dayOfWeek - 1, 23, 59, 59, 999);
        return { start: startOfLastWeek.toISOString(), end: endOfLastWeek.toISOString(), granularity: 'week' };
      }
      case 'month': {
        const lastMonth = month === 0 ? 11 : month - 1;
        const lastMonthYear = month === 0 ? year - 1 : year;
        const lastDay = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
        return {
          start: new Date(lastMonthYear, lastMonth, 1).toISOString(),
          end: new Date(lastMonthYear, lastMonth, lastDay, 23, 59, 59, 999).toISOString(),
          granularity: 'month'
        };
      }
      case 'quarter': {
        const currentQuarter = Math.floor(month / 3);
        const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const lastQuarterYear = currentQuarter === 0 ? year - 1 : year;
        const startMonth = lastQuarter * 3;
        return {
          start: new Date(lastQuarterYear, startMonth, 1).toISOString(),
          end: new Date(lastQuarterYear, startMonth + 3, 0, 23, 59, 59, 999).toISOString(),
          granularity: 'quarter'
        };
      }
      case 'year': {
        return {
          start: new Date(year - 1, 0, 1).toISOString(),
          end: new Date(year - 1, 11, 31, 23, 59, 59, 999).toISOString(),
          granularity: 'year'
        };
      }
    }
    return null;
  }

  /**
   * Parse an interval string to milliseconds
   * @param {string} interval - e.g., '7d', '2w', '1m'
   */
  parseInterval(interval) {
    if (typeof interval === 'number') return interval;

    const match = String(interval).match(/^(\d+)\s*(s|m|h|d|w|mo|y)$/i);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
      'mo': 30 * 24 * 60 * 60 * 1000,
      'y': 365 * 24 * 60 * 60 * 1000
    };

    return value * (multipliers[unit] || 0);
  }

  /**
   * Normalize a date to ISO string
   */
  normalizeDate(date) {
    if (!date) return null;
    if (typeof date === 'string') return date;
    if (date instanceof Date) return date.toISOString();
    return null;
  }

  /**
   * Check if two timeframes overlap
   */
  timeframesOverlap(tf1, tf2) {
    if (!tf1 || !tf2) return true; // No timeframe = always matches

    const start1 = new Date(tf1.start).getTime();
    const end1 = new Date(tf1.end).getTime();
    const start2 = new Date(tf2.start).getTime();
    const end2 = new Date(tf2.end).getTime();

    return start1 <= end2 && start2 <= end1;
  }

  // ============================================================================
  // CONTEXT MATCHING
  // ============================================================================

  /**
   * Check if a value observation matches a context filter
   *
   * @param {object} observation - ValueObservation with context_schema
   * @param {object} filter - ContextFilter specification
   * @returns {boolean}
   */
  observationMatchesFilter(observation, filter) {
    if (!filter || Object.keys(filter).length === 0) return true;
    if (!observation) return false;

    const ctx = observation.context_schema || {};

    // Method matching
    if (filter.method !== undefined) {
      const methods = this.normalizeToArray(filter.method);
      if (!methods.includes(ctx.method)) return false;
    }

    // Definition matching (supports wildcards)
    if (filter.definition !== undefined) {
      const definitions = this.normalizeToArray(filter.definition);
      const matches = definitions.some(def => this.matchDefinition(ctx.definition, def));
      if (!matches) return false;
    }

    // Scale matching
    if (filter.scale !== undefined) {
      const scales = this.normalizeToArray(filter.scale);
      if (!scales.includes(ctx.scale)) return false;
    }

    // Timeframe matching
    if (filter.timeframe !== undefined) {
      const range = this.parseTimeframe(filter.timeframe);
      if (range && !this.timeframesOverlap(ctx.timeframe, range)) return false;
    }

    // Source matching
    if (filter.source !== undefined) {
      if (!this.sourceMatches(ctx.source, filter.source)) return false;
    }

    // Agent matching
    if (filter.agent !== undefined) {
      if (!this.agentMatches(ctx.agent, filter.agent)) return false;
    }

    // Temporal filters on observation timestamp
    if (filter.updatedAfter !== undefined) {
      const afterDate = new Date(filter.updatedAfter);
      const obsDate = new Date(observation.timestamp);
      if (obsDate < afterDate) return false;
    }

    if (filter.updatedBefore !== undefined) {
      const beforeDate = new Date(filter.updatedBefore);
      const obsDate = new Date(observation.timestamp);
      if (obsDate > beforeDate) return false;
    }

    // Custom function filter
    if (typeof filter.custom === 'function') {
      if (!filter.custom(observation)) return false;
    }

    // Negation filter
    if (filter.not !== undefined) {
      if (this.observationMatchesFilter(observation, filter.not)) return false;
    }

    return true;
  }

  /**
   * Check if a cell has any value matching the filter
   */
  cellMatchesFilter(cell, filter) {
    if (!cell || !cell.values || cell.values.length === 0) return false;
    return cell.values.some(obs => this.observationMatchesFilter(obs, filter));
  }

  /**
   * Check if a record has any cell matching the filter
   */
  recordMatchesFilter(record, filter) {
    if (!record) return false;

    // Check stability filter at record level
    if (filter.stability !== undefined) {
      if (record.stability?.classification !== filter.stability) return false;
    }

    // Check cells
    const cells = record.cells || {};
    for (const fieldId of Object.keys(cells)) {
      if (this.cellMatchesFilter(cells[fieldId], filter)) {
        return true;
      }
    }

    // Also check legacy fields if no cells
    if (Object.keys(cells).length === 0 && record.fields) {
      // For legacy records, check if any field value exists
      return Object.values(record.fields).some(v => v !== null && v !== undefined);
    }

    return false;
  }

  /**
   * Match a definition with potential wildcard support
   */
  matchDefinition(actual, pattern) {
    if (!pattern) return true;
    if (!actual) return false;

    // Wildcard matching: revenue_* matches revenue_gaap, revenue_manual, etc.
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
      return regex.test(actual);
    }

    return actual.toLowerCase() === pattern.toLowerCase();
  }

  /**
   * Match source specification
   */
  sourceMatches(actual, pattern) {
    if (!pattern) return true;
    if (!actual) return false;

    if (typeof pattern === 'string') {
      // Simple string match on system
      return actual.system?.toLowerCase().includes(pattern.toLowerCase());
    }

    // Object match
    if (pattern.system && !actual.system?.toLowerCase().includes(pattern.system.toLowerCase())) {
      return false;
    }
    if (pattern.file && !actual.file?.toLowerCase().includes(pattern.file.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * Match agent specification
   */
  agentMatches(actual, pattern) {
    if (!pattern) return true;
    if (!actual) return false;

    if (typeof pattern === 'string') {
      // String match on agent ID
      return actual.id === pattern;
    }

    // Object match
    if (pattern.type && actual.type !== pattern.type) return false;
    if (pattern.id && actual.id !== pattern.id) return false;
    if (pattern.name && !actual.name?.includes(pattern.name)) return false;

    return true;
  }

  // ============================================================================
  // CONTEXT COMPARISON
  // ============================================================================

  /**
   * Check if two contexts are equivalent (for merge decisions)
   * Equivalent = same method, definition, and scale
   */
  contextsEquivalent(ctx1, ctx2) {
    if (!ctx1 && !ctx2) return true;
    if (!ctx1 || !ctx2) return false;

    return (
      ctx1.method === ctx2.method &&
      ctx1.definition === ctx2.definition &&
      ctx1.scale === ctx2.scale
    );
  }

  /**
   * Check if two contexts have the same source
   */
  contextsSameSource(ctx1, ctx2) {
    if (!ctx1?.source && !ctx2?.source) return true;
    if (!ctx1?.source || !ctx2?.source) return false;

    return ctx1.source.system === ctx2.source.system;
  }

  /**
   * Calculate similarity between two contexts (0-1)
   */
  contextSimilarity(ctx1, ctx2) {
    if (!ctx1 || !ctx2) return 0;

    let score = 0;
    let dimensions = 0;

    // Method match
    dimensions++;
    if (ctx1.method === ctx2.method) score++;

    // Definition match
    dimensions++;
    if (ctx1.definition === ctx2.definition) score++;

    // Scale match
    dimensions++;
    if (ctx1.scale === ctx2.scale) score++;

    // Source match
    dimensions++;
    if (this.contextsSameSource(ctx1, ctx2)) score++;

    // Timeframe overlap
    dimensions++;
    if (this.timeframesOverlap(ctx1.timeframe, ctx2.timeframe)) score++;

    return score / dimensions;
  }

  // ============================================================================
  // VALUE SELECTION
  // ============================================================================

  /**
   * Get matching values from a cell based on filter
   */
  getMatchingValues(cell, filter) {
    if (!cell || !cell.values) return [];
    return cell.values.filter(obs => this.observationMatchesFilter(obs, filter));
  }

  /**
   * Get the best value from a cell for a given view context
   */
  getBestValue(cell, viewContext = {}) {
    if (!cell || !cell.values || cell.values.length === 0) return null;
    if (cell.values.length === 1) return cell.values[0];

    // Score each value
    const scored = cell.values.map(obs => ({
      observation: obs,
      score: this.scoreValueForContext(obs, viewContext)
    }));

    // Return highest scoring
    scored.sort((a, b) => b.score - a.score);
    return scored[0].observation;
  }

  /**
   * Score a value observation for relevance to a view context
   */
  scoreValueForContext(observation, viewContext) {
    let score = 0;
    const ctx = observation.context_schema || {};

    // Matching scale: +10
    if (viewContext.scale && ctx.scale === viewContext.scale) {
      score += 10;
    }

    // Matching definition: +10
    if (viewContext.definition && ctx.definition === viewContext.definition) {
      score += 10;
    }

    // Matching method: +5
    if (viewContext.method && ctx.method === viewContext.method) {
      score += 5;
    }

    // Matching source: +5
    if (viewContext.source && this.sourceMatches(ctx.source, viewContext.source)) {
      score += 5;
    }

    // Recency: up to 10 points
    if (observation.timestamp) {
      const age = Date.now() - new Date(observation.timestamp).getTime();
      const daysSinceUpdate = age / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysSinceUpdate);
    }

    // Method priority
    score += this.methodPriority[ctx.method] || 0;

    return score;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Normalize a value to an array
   */
  normalizeToArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    return [value];
  }

  /**
   * Extract primary source system from a record
   */
  getPrimarySource(record) {
    if (!record?.cells) return null;

    // Look at most recent value's source
    let latestTimestamp = 0;
    let latestSource = null;

    for (const cell of Object.values(record.cells)) {
      for (const obs of cell.values || []) {
        const ts = new Date(obs.timestamp).getTime();
        if (ts > latestTimestamp) {
          latestTimestamp = ts;
          latestSource = obs.context_schema?.source?.system;
        }
      }
    }

    return latestSource;
  }

  /**
   * Get aggregate context for a record (most common values)
   */
  getRecordContext(record) {
    if (!record?.cells) return {};

    const methods = [];
    const scales = [];
    const sources = [];
    let timeframeStart = null;
    let timeframeEnd = null;

    for (const cell of Object.values(record.cells)) {
      for (const obs of cell.values || []) {
        const ctx = obs.context_schema || {};
        if (ctx.method) methods.push(ctx.method);
        if (ctx.scale) scales.push(ctx.scale);
        if (ctx.source?.system) sources.push(ctx.source.system);

        if (ctx.timeframe) {
          const start = new Date(ctx.timeframe.start);
          const end = new Date(ctx.timeframe.end);
          if (!timeframeStart || start < timeframeStart) timeframeStart = start;
          if (!timeframeEnd || end > timeframeEnd) timeframeEnd = end;
        }
      }
    }

    return {
      method: this.mode(methods),
      scale: this.mode(scales),
      source: { system: this.mode(sources) },
      timeframe: timeframeStart ? {
        start: timeframeStart.toISOString(),
        end: timeframeEnd.toISOString()
      } : null
    };
  }

  /**
   * Get the most common value in an array
   */
  mode(arr) {
    if (!arr || arr.length === 0) return null;

    const counts = {};
    for (const item of arr) {
      counts[item] = (counts[item] || 0) + 1;
    }

    return Object.entries(counts).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0];
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOContextQuery;
}

if (typeof window !== 'undefined') {
  window.EOContextQuery = EOContextQuery;
}
