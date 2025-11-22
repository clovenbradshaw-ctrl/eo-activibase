/**
 * EO SUP (Superposition) Detector
 * Detects and analyzes multiple co-valid values in cells
 *
 * Features:
 * - Detect when superposition exists
 * - Analyze differences between superposed values
 * - Generate context diffs
 * - Provide natural language explanations
 *
 * Usage:
 *   const detector = new EOSUPDetector();
 *   const hasSUP = detector.detectSuperposition(cell);
 *   const diff = detector.generateContextDiff(cell);
 */

class EOSUPDetector {
  constructor() {
    this.diffThreshold = {
      value: 0.05, // 5% difference threshold for numeric values
      temporal: 24 * 60 * 60 * 1000 // 24 hours for temporal difference
    };
  }

  /**
   * Detect if a cell has superposition
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
   */
  contextsAreDifferent(ctx1, ctx2) {
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
        parts.push(`  • ${dim.description}`);
      });
    });

    return parts.join('\n');
  }

  /**
   * Get human-readable summary of superposition
   */
  getSummary(cell) {
    if (!this.detectSuperposition(cell)) {
      return null;
    }

    const values = cell.values;
    const summary = {
      count: values.length,
      perspectives: values.map(obs => {
        return {
          value: obs.value,
          method: obs.context_schema.method,
          scale: obs.context_schema.scale,
          definition: this.humanize(obs.context_schema.definition),
          source: this.humanize(obs.context_schema.source?.system),
          timestamp: obs.timestamp,
          agent: obs.context_schema.agent?.name || obs.context_schema.agent?.type
        };
      })
    };

    return summary;
  }

  /**
   * Check if values are numerically significant different
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
   */
  getStrongestValue(cell, viewContext = {}) {
    if (!cell || !cell.values || cell.values.length === 0) {
      return null;
    }

    if (cell.values.length === 1) {
      return cell.values[0];
    }

    // Use EODataStructures scoring if available
    if (typeof EODataStructures !== 'undefined') {
      return EODataStructures.getDominantValue(cell, viewContext);
    }

    // Fallback: simple priority
    const methodPriority = {
      'measured': 5,
      'declared': 4,
      'derived': 3,
      'inferred': 2,
      'aggregated': 1
    };

    const scored = cell.values.map(obs => ({
      observation: obs,
      score: methodPriority[obs.context_schema.method] || 0
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].observation;
  }

  /**
   * Format value for display
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
   */
  getIndicatorText(cell) {
    if (!this.detectSuperposition(cell)) {
      return null;
    }

    return `●${cell.values.length}`;
  }

  /**
   * Get tooltip text for grid hover
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
    const methodPriority = {
      'measured': 5,
      'declared': 4,
      'derived': 3,
      'inferred': 2,
      'aggregated': 1
    };

    const olderPriority = methodPriority[older.context_schema.method] || 0;
    const newerPriority = methodPriority[newer.context_schema.method] || 0;

    if (newerPriority <= olderPriority) return false;

    // Check if enough time has passed
    const age = new Date(newer.timestamp) - new Date(older.timestamp);
    if (age < minAge) return false;

    return true;
  }

  /**
   * Collapse superposition (remove lower-priority values)
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

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOSUPDetector;
}

if (typeof window !== 'undefined') {
  window.EOSUPDetector = EOSUPDetector;
}
