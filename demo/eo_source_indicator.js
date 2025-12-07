/**
 * EO Source Indicator
 *
 * Utility for displaying data source indicators in grids and tables.
 * Shows colored dots/badges that indicate which data file a record came from.
 *
 * Features:
 * - Consistent color assignment per source
 * - Hover tooltips showing source details
 * - Click to filter by source
 * - Legend generation
 */

class EOSourceIndicator {
  constructor(options = {}) {
    this.importManager = options.importManager || null;
    this.state = options.state || null;

    // Color palette for source indicators
    this.colors = [
      { bg: '#dcfce7', dot: '#22c55e', name: 'green' },
      { bg: '#dbeafe', dot: '#3b82f6', name: 'blue' },
      { bg: '#fef3c7', dot: '#f59e0b', name: 'amber' },
      { bg: '#f3e8ff', dot: '#a855f7', name: 'purple' },
      { bg: '#fce7f3', dot: '#ec4899', name: 'pink' },
      { bg: '#e0f2fe', dot: '#0ea5e9', name: 'sky' },
      { bg: '#fef08a', dot: '#eab308', name: 'yellow' },
      { bg: '#d1fae5', dot: '#10b981', name: 'emerald' },
      { bg: '#fed7aa', dot: '#f97316', name: 'orange' },
      { bg: '#e0e7ff', dot: '#6366f1', name: 'indigo' }
    ];

    // Cache for source -> color mapping
    this.sourceColorMap = new Map();
    this.colorIndex = 0;
  }

  /**
   * Get or assign a color for a source
   */
  getColorForSource(sourceId) {
    if (!this.sourceColorMap.has(sourceId)) {
      const color = this.colors[this.colorIndex % this.colors.length];
      this.sourceColorMap.set(sourceId, color);
      this.colorIndex++;
    }
    return this.sourceColorMap.get(sourceId);
  }

  /**
   * Reset color assignments (e.g., when switching sets)
   */
  resetColors() {
    this.sourceColorMap.clear();
    this.colorIndex = 0;
  }

  /**
   * Get source info from a record's provenance
   */
  getSourceFromRecord(record) {
    if (!record) return null;

    // Check for _provenance on the record
    if (record._provenance) {
      return {
        id: record._provenance.importId,
        name: record._provenance.importName || record._provenance.sourceFile,
        format: record._provenance.sourceFormat
      };
    }

    // Check for provenance in cells
    if (record.cells) {
      for (const cell of record.cells) {
        if (cell.values && cell.values[0]?.context_schema?.source?.importId) {
          const ctx = cell.values[0].context_schema.source;
          return {
            id: ctx.importId,
            name: ctx.filename || ctx.importId,
            format: ctx.format
          };
        }
      }
    }

    return null;
  }

  /**
   * Generate HTML for a source indicator dot
   */
  renderIndicator(sourceId, sourceName = null, options = {}) {
    const color = this.getColorForSource(sourceId);
    const size = options.size || 8;
    const showTooltip = options.showTooltip !== false;

    const tooltip = showTooltip && sourceName ? `title="From: ${this.escapeHtml(sourceName)}"` : '';

    return `
      <span class="eo-source-dot"
            data-source-id="${sourceId}"
            ${tooltip}
            style="
              display: inline-block;
              width: ${size}px;
              height: ${size}px;
              background: ${color.dot};
              border-radius: 50%;
              flex-shrink: 0;
            ">
      </span>
    `;
  }

  /**
   * Generate HTML for a source indicator badge (with label)
   */
  renderBadge(sourceId, sourceName, options = {}) {
    const color = this.getColorForSource(sourceId);
    const maxLength = options.maxLength || 12;

    const displayName = sourceName.length > maxLength
      ? sourceName.slice(0, maxLength) + '...'
      : sourceName;

    return `
      <span class="eo-source-badge"
            data-source-id="${sourceId}"
            title="From: ${this.escapeHtml(sourceName)}"
            style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 2px 8px;
              font-size: 10px;
              font-weight: 500;
              color: ${color.dot};
              background: ${color.bg};
              border-radius: 10px;
              white-space: nowrap;
            ">
        <span style="
          display: inline-block;
          width: 6px;
          height: 6px;
          background: ${color.dot};
          border-radius: 50%;
        "></span>
        ${this.escapeHtml(displayName)}
      </span>
    `;
  }

  /**
   * Generate a legend for all sources in a set
   */
  renderLegend(setId, options = {}) {
    if (!this.importManager || !this.state) return '';

    const set = this.state.sets.get(setId);
    if (!set) return '';

    const allImports = this.importManager.getAllImports();
    const sources = allImports.filter(imp =>
      imp.usedIn && imp.usedIn.some(u => u.type === 'set' && u.id === setId)
    );

    if (sources.length === 0) return '';

    const items = sources.map(source => {
      const color = this.getColorForSource(source.id);
      const usage = source.usedIn.find(u => u.type === 'set' && u.id === setId);
      const count = usage?.recordCount || source.rowCount;

      return `
        <div class="eo-source-legend-item"
             data-source-id="${source.id}"
             style="
               display: flex;
               align-items: center;
               gap: 6px;
               padding: 4px 8px;
               font-size: 11px;
               cursor: pointer;
               border-radius: 4px;
               transition: background-color 0.15s;
             ">
          <span style="
            display: inline-block;
            width: 8px;
            height: 8px;
            background: ${color.dot};
            border-radius: 50%;
          "></span>
          <span style="color: #374151; font-weight: 500;">${this.escapeHtml(this.truncate(source.name, 20))}</span>
          <span style="color: #9ca3af;">(${count})</span>
        </div>
      `;
    }).join('');

    return `
      <div class="eo-source-legend" style="
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 8px;
        background: #f9fafb;
        border-radius: 6px;
      ">
        ${items}
      </div>
    `;
  }

  /**
   * Get all unique source IDs from records in a set
   */
  getSourcesInSet(setId) {
    if (!this.state) return [];

    const set = this.state.sets.get(setId);
    if (!set || !set.records) return [];

    const sourceIds = new Set();
    set.records.forEach(record => {
      const source = this.getSourceFromRecord(record);
      if (source?.id) {
        sourceIds.add(source.id);
      }
    });

    return Array.from(sourceIds);
  }

  /**
   * Filter records by source ID
   */
  filterRecordsBySource(setId, sourceId) {
    if (!this.state) return [];

    const set = this.state.sets.get(setId);
    if (!set || !set.records) return [];

    const matching = [];
    set.records.forEach((record, recordId) => {
      const source = this.getSourceFromRecord(record);
      if (source?.id === sourceId) {
        matching.push({ recordId, record });
      }
    });

    return matching;
  }

  /**
   * Truncate string
   */
  truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
  }

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOSourceIndicator;
}

if (typeof window !== 'undefined') {
  window.EOSourceIndicator = EOSourceIndicator;
}
