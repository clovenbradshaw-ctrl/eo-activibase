/**
 * EO Data Sources Panel
 *
 * A collapsible panel that shows at the top of a workspace view,
 * displaying all data files that feed into the current workspace.
 *
 * Features:
 * - Shows all source data files for the current set/workspace
 * - Click on a source to filter view to just those records
 * - Add new data button
 * - Collapsible to save space
 */

class EODataSourcesPanel {
  constructor(options = {}) {
    this.container = options.container || null;
    this.importManager = options.importManager || null;
    this.state = options.state || null;
    this.setId = options.setId || null;

    this.isExpanded = true;
    this.activeSourceFilter = null; // Currently selected source for filtering

    // Callbacks
    this.onSourceClick = options.onSourceClick || (() => {});
    this.onAddData = options.onAddData || (() => {});
    this.onClearFilter = options.onClearFilter || (() => {});
  }

  /**
   * Initialize the panel
   */
  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Data sources panel container not found:', containerId);
      return;
    }

    this.render();
  }

  /**
   * Set the current workspace/set ID
   */
  setCurrentSet(setId) {
    this.setId = setId;
    this.activeSourceFilter = null;
    this.render();
  }

  /**
   * Get data sources for the current set
   */
  getSourcesForCurrentSet() {
    if (!this.setId || !this.importManager || !this.state) return [];

    const set = this.state.sets.get(this.setId);
    if (!set) return [];

    const allImports = this.importManager.getAllImports();

    // Find imports that feed into this set
    const sources = allImports.filter(imp =>
      imp.usedIn && imp.usedIn.some(u => u.type === 'set' && u.id === this.setId)
    ).map(imp => {
      // Find the usage info for this set
      const usage = imp.usedIn.find(u => u.type === 'set' && u.id === this.setId);
      return {
        id: imp.id,
        name: imp.name,
        format: imp.source.format,
        recordCount: usage?.recordCount || imp.rowCount,
        importedAt: imp.createdAt,
        quality: imp.quality?.score || null
      };
    });

    return sources;
  }

  /**
   * Get format icon for a data source
   */
  getFormatIcon(format) {
    const icons = {
      'csv': 'ph-file-csv',
      'tsv': 'ph-file-csv',
      'json': 'ph-file-js',
      'xlsx': 'ph-file-xls',
      'xls': 'ph-file-xls'
    };
    return icons[format] || 'ph-file';
  }

  /**
   * Format time ago
   */
  getTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  /**
   * Render the panel
   */
  render() {
    if (!this.container) return;

    const sources = this.getSourcesForCurrentSet();
    const set = this.state?.sets.get(this.setId);

    if (!set) {
      this.container.innerHTML = '';
      return;
    }

    const totalRecords = set.records ? set.records.size : 0;

    this.container.innerHTML = `
      <div class="eo-data-sources-panel ${this.isExpanded ? 'eo-expanded' : 'eo-collapsed'}">
        <div class="eo-dsp-header" data-action="toggle">
          <div class="eo-dsp-header-left">
            <i class="ph-bold ${this.isExpanded ? 'ph-caret-down' : 'ph-caret-right'}"></i>
            <i class="ph-bold ph-files"></i>
            <span class="eo-dsp-title">Data Sources</span>
            <span class="eo-dsp-count">${sources.length} file${sources.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="eo-dsp-header-right">
            ${this.activeSourceFilter ? `
              <button class="eo-dsp-clear-filter" data-action="clear-filter" title="Clear filter">
                <i class="ph-bold ph-x"></i>
                <span>Showing filtered</span>
              </button>
            ` : ''}
            <span class="eo-dsp-total">${totalRecords} records total</span>
          </div>
        </div>

        ${this.isExpanded ? `
          <div class="eo-dsp-content">
            <div class="eo-dsp-sources">
              ${sources.length === 0 ? `
                <div class="eo-dsp-empty">
                  <i class="ph ph-cloud-arrow-up"></i>
                  <span>No data files yet</span>
                  <span class="eo-dsp-empty-hint">Add data files to this workspace to get started</span>
                </div>
              ` : sources.map(source => this.renderSourceCard(source)).join('')}

              <div class="eo-dsp-add-card" data-action="add-data" title="Add more data">
                <i class="ph-bold ph-plus"></i>
                <span>Add Data</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render a single source card
   * Now includes maturity-based visual treatment
   */
  renderSourceCard(source) {
    const isActive = this.activeSourceFilter === source.id;

    // Get the full import to calculate maturity
    const imp = this.importManager?.getImport(source.id);
    const maturity = typeof EODataMaturity !== 'undefined' && imp
      ? EODataMaturity.calculateImportMaturity(imp, {})
      : { stage: 'emanon', score: 0 };

    const maturityClass = typeof EODataMaturity !== 'undefined'
      ? EODataMaturity.getStageClass(maturity.stage)
      : '';

    // Render readiness segments for this source
    const readinessHTML = typeof EODataMaturity !== 'undefined' && maturity.score < 100
      ? EODataMaturity.renderReadinessIndicator(maturity, { compact: true, showHint: false })
      : '';

    return `
      <div class="eo-dsp-source-card ${maturityClass} ${isActive ? 'eo-active' : ''}"
           data-source-id="${source.id}"
           data-maturity="${maturity.stage}"
           data-action="select-source"
           title="Click to filter by this source">
        <div class="eo-dsp-source-icon">
          <i class="ph-bold ${this.getFormatIcon(source.format)}"></i>
        </div>
        <div class="eo-dsp-source-info">
          <div class="eo-dsp-source-name">${this.truncate(source.name, 18)}</div>
          <div class="eo-dsp-source-meta">
            <span>${source.recordCount} records</span>
            <span class="eo-dsp-dot">·</span>
            <span>${this.getTimeAgo(source.importedAt)}</span>
            ${readinessHTML}
          </div>
        </div>
        ${source.quality !== null ? `
          <div class="eo-dsp-source-quality" title="Data quality score">
            <span class="eo-dsp-quality-badge ${this.getQualityClass(source.quality)}">${source.quality}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get quality badge class
   */
  getQualityClass(score) {
    if (score >= 90) return 'eo-quality-excellent';
    if (score >= 70) return 'eo-quality-good';
    if (score >= 50) return 'eo-quality-fair';
    return 'eo-quality-poor';
  }

  /**
   * Truncate string
   */
  truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.container) return;

    // Toggle panel
    const header = this.container.querySelector('[data-action="toggle"]');
    if (header) {
      header.addEventListener('click', (e) => {
        // Don't toggle if clicking on other buttons in header
        if (e.target.closest('[data-action="clear-filter"]')) return;
        this.isExpanded = !this.isExpanded;
        this.render();
      });
    }

    // Source selection
    this.container.querySelectorAll('[data-action="select-source"]').forEach(card => {
      card.addEventListener('click', () => {
        const sourceId = card.dataset.sourceId;
        if (this.activeSourceFilter === sourceId) {
          // Clicking same source again clears the filter
          this.activeSourceFilter = null;
          this.onClearFilter();
        } else {
          this.activeSourceFilter = sourceId;
          this.onSourceClick(sourceId);
        }
        this.render();
      });
    });

    // Add data
    const addBtn = this.container.querySelector('[data-action="add-data"]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.onAddData(this.setId);
      });
    }

    // Clear filter
    const clearBtn = this.container.querySelector('[data-action="clear-filter"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeSourceFilter = null;
        this.onClearFilter();
        this.render();
      });
    }
  }

  /**
   * Clear any active source filter
   */
  clearFilter() {
    this.activeSourceFilter = null;
    this.render();
  }

  /**
   * Toggle expanded state
   */
  toggle() {
    this.isExpanded = !this.isExpanded;
    this.render();
  }

  /**
   * Expand the panel
   */
  expand() {
    this.isExpanded = true;
    this.render();
  }

  /**
   * Collapse the panel
   */
  collapse() {
    this.isExpanded = false;
    this.render();
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EODataSourcesPanel;
}

if (typeof window !== 'undefined') {
  window.EODataSourcesPanel = EODataSourcesPanel;
}
