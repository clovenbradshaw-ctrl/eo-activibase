/**
 * EO Cell Modal Component
 * Interactive modal for viewing cell values, context, history, and superposition
 *
 * Features:
 * - Tab 1: Value & Context
 * - Tab 2: History
 * - Tab 3: Superposition (if applicable)
 * - Tab 4: Context Diff
 *
 * Usage:
 *   const modal = new EOCellModal();
 *   modal.show(cell, contextEngine, supDetector);
 */

class EOCellModal {
  constructor() {
    this.modal = null;
    this.currentCell = null;
    this.contextEngine = null;
    this.supDetector = null;
    this.currentTab = 'value';
  }

  /**
   * Show the cell modal
   */
  show(cell, contextEngine, supDetector) {
    this.currentCell = cell;
    this.contextEngine = contextEngine;
    this.supDetector = supDetector;
    this.currentTab = 'value';

    this.render();
    this.attachEventListeners();
  }

  /**
   * Hide the cell modal
   */
  hide() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  /**
   * Render the modal
   */
  render() {
    // Remove existing modal if any
    this.hide();

    const hasSUP = this.supDetector.detectSuperposition(this.currentCell);
    const dominantValue = this.supDetector.getStrongestValue(
      this.currentCell,
      this.contextEngine.getViewContext()
    );

    const modalHTML = `
      <div class="eo-cell-modal-overlay" id="eoCellModal">
        <div class="eo-cell-modal">
          <div class="eo-cell-modal-header">
            <div class="eo-cell-modal-title">
              <h2>${this.currentCell.field_name}${hasSUP ? ` (${this.currentCell.values.length} perspectives)` : ''}</h2>
            </div>
            <button class="eo-cell-modal-close" id="eoCellModalClose">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <div class="eo-cell-modal-tabs">
            <button class="eo-cell-modal-tab active" data-tab="value">Value & Context</button>
            <button class="eo-cell-modal-tab" data-tab="history">History</button>
            ${hasSUP ? '<button class="eo-cell-modal-tab" data-tab="superposition">Perspectives</button>' : ''}
            ${hasSUP ? '<button class="eo-cell-modal-tab" data-tab="diff">Why Different?</button>' : ''}
          </div>

          <div class="eo-cell-modal-content">
            <div class="eo-cell-modal-tab-content active" data-tab-content="value">
              ${this.renderValueTab(dominantValue)}
            </div>
            <div class="eo-cell-modal-tab-content" data-tab-content="history">
              ${this.renderHistoryTab()}
            </div>
            ${hasSUP ? `<div class="eo-cell-modal-tab-content" data-tab-content="superposition">
              ${this.renderSuperpositionTab()}
            </div>` : ''}
            ${hasSUP ? `<div class="eo-cell-modal-tab-content" data-tab-content="diff">
              ${this.renderDiffTab()}
            </div>` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('eoCellModal');
  }

  /**
   * Render Value & Context tab
   */
  renderValueTab(observation) {
    if (!observation) {
      return '<p class="eo-empty">No value available</p>';
    }

    const ctx = observation.context_schema;
    const formattedValue = this.formatValue(observation.value);
    const timestamp = new Date(observation.timestamp).toLocaleString();

    return `
      <div class="eo-value-display">
        <div class="eo-value-main">
          <span class="eo-value-label">Value:</span>
          <span class="eo-value-text">${formattedValue}</span>
        </div>

        <div class="eo-context-grid">
          <div class="eo-context-item">
            <span class="eo-context-label">Source</span>
            <span class="eo-context-value">${this.humanize(ctx.source?.system)} ${ctx.source?.file ? `(${ctx.source.file})` : ''}</span>
          </div>

          <div class="eo-context-item">
            <span class="eo-context-label">Subject</span>
            <span class="eo-context-value">${this.formatSubject(ctx.subject)}</span>
          </div>

          <div class="eo-context-item">
            <span class="eo-context-label">Method</span>
            <span class="eo-context-value eo-badge eo-badge-${ctx.method}">${ctx.method}</span>
          </div>

          <div class="eo-context-item">
            <span class="eo-context-label">Definition</span>
            <span class="eo-context-value">${ctx.definition || 'Unknown'}</span>
          </div>

          <div class="eo-context-item">
            <span class="eo-context-label">Scale</span>
            <span class="eo-context-value eo-badge eo-badge-${ctx.scale}">${ctx.scale}</span>
          </div>

          <div class="eo-context-item">
            <span class="eo-context-label">Timeframe</span>
            <span class="eo-context-value">${this.formatTimeframe(ctx.timeframe)}</span>
          </div>

          <div class="eo-context-item">
            <span class="eo-context-label">Agent</span>
            <span class="eo-context-value">${ctx.agent?.name || ctx.agent?.type || 'system'}</span>
          </div>

          <div class="eo-context-item">
            <span class="eo-context-label">Timestamp</span>
            <span class="eo-context-value">${timestamp}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render History tab
   */
  renderHistoryTab() {
    // For now, show a placeholder - would integrate with actual history
    const history = [
      {
        timestamp: this.currentCell.created_at,
        description: 'Created',
        operator: 'INS'
      },
      ...(this.currentCell.values || []).map(v => ({
        timestamp: v.timestamp,
        description: this.getHistoryDescription(v),
        operator: 'ALT'
      }))
    ];

    if (history.length === 0) {
      return '<p class="eo-empty">No history available</p>';
    }

    return `
      <div class="eo-history-list">
        ${history.map(entry => `
          <div class="eo-history-item">
            <div class="eo-history-icon">
              ${this.getOperatorIcon(entry.operator)}
            </div>
            <div class="eo-history-content">
              <div class="eo-history-description">${entry.description}</div>
              <div class="eo-history-timestamp">${new Date(entry.timestamp).toLocaleString()}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render Superposition tab
   */
  renderSuperpositionTab() {
    const summary = this.supDetector.getSummary(this.currentCell);
    if (!summary) {
      return '<p class="eo-empty">No superposition detected</p>';
    }

    return `
      <div class="eo-superposition-list">
        <p class="eo-superposition-intro">
          This cell has ${summary.count} valid perspectives. Each represents the same information
          under different contexts or measurement methods.
        </p>

        ${summary.perspectives.map((p, idx) => `
          <div class="eo-perspective-card">
            <div class="eo-perspective-header">
              <span class="eo-perspective-number">Perspective ${idx + 1}</span>
              <span class="eo-perspective-value">${this.formatValue(p.value)}</span>
            </div>
            <div class="eo-perspective-details">
              <div class="eo-perspective-item">
                <span class="eo-label">Method:</span>
                <span class="eo-badge eo-badge-${p.method}">${p.method}</span>
              </div>
              <div class="eo-perspective-item">
                <span class="eo-label">Scale:</span>
                <span class="eo-badge eo-badge-${p.scale}">${p.scale}</span>
              </div>
              <div class="eo-perspective-item">
                <span class="eo-label">Definition:</span>
                <span>${p.definition}</span>
              </div>
              <div class="eo-perspective-item">
                <span class="eo-label">Source:</span>
                <span>${p.source}</span>
              </div>
              <div class="eo-perspective-item">
                <span class="eo-label">Agent:</span>
                <span>${p.agent}</span>
              </div>
              <div class="eo-perspective-item">
                <span class="eo-label">Recorded:</span>
                <span>${new Date(p.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render Context Diff tab
   */
  renderDiffTab() {
    const explanation = this.supDetector.generateExplanation(this.currentCell);
    const diff = this.supDetector.generateContextDiff(this.currentCell);

    if (!diff) {
      return '<p class="eo-empty">No differences to show</p>';
    }

    return `
      <div class="eo-diff-container">
        <div class="eo-diff-explanation">
          <h3>Why are these values different?</h3>
          <pre class="eo-diff-text">${explanation}</pre>
        </div>

        <div class="eo-diff-details">
          <h4>Detailed Comparison</h4>
          ${diff.differences.map((d, idx) => `
            <div class="eo-diff-comparison">
              <div class="eo-diff-values">
                <div class="eo-diff-value">
                  <span class="eo-diff-label">Value A:</span>
                  <span class="eo-diff-value-text">${this.formatValue(d.value1)}</span>
                </div>
                <div class="eo-diff-arrow">⟷</div>
                <div class="eo-diff-value">
                  <span class="eo-diff-label">Value B:</span>
                  <span class="eo-diff-value-text">${this.formatValue(d.value2)}</span>
                </div>
              </div>
              <div class="eo-diff-dimensions">
                ${d.differences.map(dim => `
                  <div class="eo-diff-dimension">
                    <i class="ph ph-arrow-right"></i>
                    <span>${dim.description}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Get history description from value observation
   */
  getHistoryDescription(observation) {
    const ctx = observation.context_schema;
    const source = this.humanize(ctx.source?.system);
    const agent = ctx.agent?.name || ctx.agent?.type;

    if (ctx.method === 'measured' && source.includes('Import')) {
      return `Created via ${source}`;
    } else if (ctx.method === 'declared' && agent !== 'system') {
      return `Updated by ${agent}`;
    } else if (ctx.method === 'derived') {
      return `Calculated via formula`;
    } else {
      return `Value updated`;
    }
  }

  /**
   * Get icon for operator
   */
  getOperatorIcon(operator) {
    const icons = {
      'INS': '<i class="ph ph-plus-circle"></i>',
      'DES': '<i class="ph ph-pencil"></i>',
      'SEG': '<i class="ph ph-split-horizontal"></i>',
      'CON': '<i class="ph ph-link"></i>',
      'SYN': '<i class="ph ph-git-merge"></i>',
      'REC': '<i class="ph ph-gear"></i>',
      'ALT': '<i class="ph ph-arrow-counter-clockwise"></i>',
      'SUP': '<i class="ph ph-copy"></i>'
    };

    return icons[operator] || '<i class="ph ph-circle"></i>';
  }

  /**
   * Format value for display
   */
  formatValue(value) {
    if (value == null) return '<span class="eo-null">null</span>';
    if (typeof value === 'number') {
      return new Intl.NumberFormat().format(value);
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    if (typeof value === 'boolean') {
      return value ? '<span class="eo-bool-true">true</span>' : '<span class="eo-bool-false">false</span>';
    }
    return String(value);
  }

  /**
   * Format timeframe for display
   */
  formatTimeframe(timeframe) {
    if (!timeframe) return 'Unknown';

    const { granularity, start, end } = timeframe;
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (granularity === 'instant') {
      return startDate.toLocaleDateString();
    }

    if (granularity === 'quarter') {
      const quarter = Math.floor(startDate.getMonth() / 3) + 1;
      return `Q${quarter} ${startDate.getFullYear()}`;
    }

    if (granularity === 'year') {
      return startDate.getFullYear().toString();
    }

    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  }

  /**
   * Format subject information
   */
  formatSubject(subject) {
    if (!subject) return 'Unknown subject';
    const parts = [];
    if (subject.label) parts.push(subject.label);
    if (subject.id) parts.push(`(${subject.id})`);
    return parts.join(' ') || 'Unknown subject';
  }

  /**
   * Humanize technical terms
   */
  humanize(str) {
    if (!str) return 'Unknown';

    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\bauto\b/i, '(auto-detected)');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.modal) return;

    // Close button
    const closeBtn = this.modal.querySelector('#eoCellModalClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Tab switching
    const tabs = this.modal.querySelectorAll('.eo-cell-modal-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Escape key to close
    document.addEventListener('keydown', this.handleEscape);
  }

  /**
   * Handle escape key
   */
  handleEscape = (e) => {
    if (e.key === 'Escape' && this.modal) {
      this.hide();
      document.removeEventListener('keydown', this.handleEscape);
    }
  }

  /**
   * Switch to a different tab
   */
  switchTab(tabName) {
    if (!this.modal) return;

    // Update tab buttons
    this.modal.querySelectorAll('.eo-cell-modal-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    this.modal.querySelectorAll('.eo-cell-modal-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tabContent === tabName);
    });

    this.currentTab = tabName;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOCellModal;
}

if (typeof window !== 'undefined') {
  window.EOCellModal = EOCellModal;
}
