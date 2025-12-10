/**
 * EOCellModal
 *
 * Level 3: Cell Modal
 * Opens when clicking a cell or field label.
 * Shows full cell details with tabs:
 * - Value
 * - Relationships
 * - Provenance
 * - History
 * - Context
 *
 * Mirrors the structure and styling of EORecordModal for consistency.
 * Each cell is treated as a first-class entity with its own story.
 */
class EOCellModal {
  constructor() {
    this.modal = null;
    this.currentCellId = null;
    this.currentRecordId = null;
    this.currentFieldName = null;
    this.currentTab = 'value';
    this.config = {};
  }

  /**
   * Initialize the modal with configuration
   * @param {Object} config - Configuration object
   */
  initialize(config = {}) {
    this.config = {
      onRelationClick: config.onRelationClick || (() => {}),
      getCell: config.getCell || (() => ({})),
      getFieldSchema: config.getFieldSchema || (() => ({})),
      getRelationships: config.getRelationships || (() => []),
      getProvenance: config.getProvenance || (() => ({})),
      getHistory: config.getHistory || (() => []),
      getCellHistory: config.getCellHistory || ((recordId, fieldName) => []),
      getContext: config.getContext || (() => ({})),
      ...config
    };
  }

  /**
   * Show the modal for a specific cell
   * @param {string} recordId - The parent record ID
   * @param {string} fieldName - The field name
   */
  show(recordId, fieldName) {
    this.currentRecordId = recordId;
    this.currentFieldName = fieldName;
    this.currentCellId = `${recordId}:${fieldName}`;
    this.currentTab = 'value';

    if (!this.modal) {
      this.createModal();
    }

    this.updateContent();
    this.modal.style.display = 'flex';

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Add ESC key handler
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.escHandler);
  }

  /**
   * Hide the modal
   */
  hide() {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
      document.removeEventListener('keydown', this.escHandler);
    }
  }

  /**
   * Create the modal structure
   */
  createModal() {
    const overlay = document.createElement('div');
    overlay.className = 'eo-cell-modal-overlay';

    overlay.innerHTML = `
      <div class="eo-cell-modal">
        <div class="eo-cell-modal-header">
          <div class="eo-cell-modal-title">
            <h2 class="eo-cell-modal-name"></h2>
            <div class="eo-cell-modal-id"></div>
          </div>
          <button class="eo-cell-modal-close" aria-label="Close">×</button>
        </div>

        <div class="eo-cell-modal-tabs">
          <button class="eo-cell-tab active" data-tab="value">Value</button>
          <button class="eo-cell-tab" data-tab="relationships">Relationships</button>
          <button class="eo-cell-tab" data-tab="provenance">Provenance</button>
          <button class="eo-cell-tab" data-tab="history">History</button>
          <button class="eo-cell-tab" data-tab="context">Context</button>
        </div>

        <div class="eo-cell-modal-content">
          <!-- Content will be dynamically populated -->
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modal = overlay;

    // Add event listeners
    this.attachEventListeners();
  }

  /**
   * Attach event listeners to modal elements
   */
  attachEventListeners() {
    // Close button
    const closeBtn = this.modal.querySelector('.eo-cell-modal-close');
    closeBtn.addEventListener('click', () => this.hide());

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Tab switching
    const tabs = this.modal.querySelectorAll('.eo-cell-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  /**
   * Switch to a different tab
   */
  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    const tabs = this.modal.querySelectorAll('.eo-cell-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update content
    this.updateContent();
  }

  /**
   * Update modal content based on current cell and tab
   */
  updateContent() {
    const cell = this.config.getCell(this.currentRecordId, this.currentFieldName);
    if (!cell) return;

    const fieldSchema = this.config.getFieldSchema(this.currentFieldName);

    // Update header
    const nameEl = this.modal.querySelector('.eo-cell-modal-name');
    const idEl = this.modal.querySelector('.eo-cell-modal-id');

    nameEl.textContent = this.currentFieldName;
    idEl.textContent = this.currentCellId;

    // Update content area
    const contentEl = this.modal.querySelector('.eo-cell-modal-content');

    switch (this.currentTab) {
      case 'value':
        contentEl.innerHTML = this.renderValueTab(cell, fieldSchema);
        break;
      case 'relationships':
        contentEl.innerHTML = this.renderRelationshipsTab(cell);
        this.attachRelationshipClickListeners();
        break;
      case 'provenance':
        contentEl.innerHTML = this.renderProvenanceTab(cell);
        break;
      case 'history':
        contentEl.innerHTML = this.renderHistoryTab(cell);
        break;
      case 'context':
        contentEl.innerHTML = this.renderContextTab(cell);
        break;
    }
  }

  /**
   * Render Value tab
   */
  renderValueTab(cell, fieldSchema) {
    const values = cell.values || [];
    const primaryValue = values[0];
    const hasSuperposition = values.length > 1;

    // Format the primary value
    let displayValue = '';
    if (primaryValue) {
      displayValue = this.formatValue(primaryValue.value);
    } else if (cell.value !== undefined) {
      displayValue = this.formatValue(cell.value);
    } else {
      displayValue = '<span class="eo-cell-empty">No value</span>';
    }

    return `
      <div class="eo-cell-value-section">
        <div class="eo-cell-value-display">
          <span class="eo-cell-value-main">${displayValue}</span>
          ${hasSuperposition ? `
            <span class="eo-sup-indicator" title="${values.length} observations">
              ●${values.length}
            </span>
          ` : ''}
        </div>

        <div class="eo-cell-field-info">
          <div class="eo-cell-info-row">
            <span class="eo-cell-info-label">Field Type</span>
            <span class="eo-cell-info-value">
              <span class="eo-field-type-badge">${fieldSchema.type || 'TEXT'}</span>
            </span>
          </div>
          <div class="eo-cell-info-row">
            <span class="eo-cell-info-label">Record</span>
            <span class="eo-cell-info-value">${this.currentRecordId}</span>
          </div>
          ${fieldSchema.formula ? `
            <div class="eo-cell-info-row">
              <span class="eo-cell-info-label">Formula</span>
              <span class="eo-cell-info-value eo-monospace">${fieldSchema.formula}</span>
            </div>
          ` : ''}
        </div>

        ${hasSuperposition ? `
          <div class="eo-cell-superposition-summary">
            <h4>Multiple Observations</h4>
            <p class="eo-cell-sup-intro">
              This cell has ${values.length} valid observations from different contexts or methods.
            </p>
            <div class="eo-cell-observations-list">
              ${values.map((obs, idx) => `
                <div class="eo-cell-observation ${idx === 0 ? 'primary' : ''}">
                  <div class="eo-cell-obs-value">${this.formatValue(obs.value)}</div>
                  <div class="eo-cell-obs-meta">
                    ${obs.context_schema?.method ? `
                      <span class="eo-badge eo-badge-${obs.context_schema.method}">${obs.context_schema.method}</span>
                    ` : ''}
                    ${obs.context_schema?.scale ? `
                      <span class="eo-badge eo-badge-${obs.context_schema.scale}">${obs.context_schema.scale}</span>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render Relationships tab
   */
  renderRelationshipsTab(cell) {
    const relationships = this.config.getRelationships(this.currentRecordId, this.currentFieldName);

    if (!relationships || relationships.length === 0) {
      return '<div class="eo-cell-empty">No relationships found</div>';
    }

    const relationshipRows = relationships.map(rel => `
      <div class="eo-relationship-row">
        <div class="eo-relationship-type">${rel.type}</div>
        <div class="eo-relationship-target">
          <span class="eo-relationship-arrow">→</span>
          <a href="#" class="eo-relationship-link" data-record="${rel.targetRecordId}" data-field="${rel.targetFieldName}">
            ${rel.targetFieldName} @ ${rel.targetRecordName || rel.targetRecordId}
          </a>
        </div>
        ${rel.description ? `<div class="eo-relationship-desc">${rel.description}</div>` : ''}
      </div>
    `).join('');

    return `<div class="eo-relationship-list">${relationshipRows}</div>`;
  }

  /**
   * Render Provenance tab
   */
  renderProvenanceTab(cell) {
    const provenance = this.config.getProvenance(this.currentRecordId, this.currentFieldName);
    const primaryValue = cell.values?.[0];
    const context = primaryValue?.context_schema || {};

    return `
      <div class="eo-provenance-section">
        <h4>Cell Origin</h4>
        <div class="eo-provenance-item">
          <span class="eo-provenance-label">Created:</span>
          <span class="eo-provenance-value">${this.formatTimestamp(provenance.created_at || cell.created_at)}</span>
        </div>
        <div class="eo-provenance-item">
          <span class="eo-provenance-label">Last Modified:</span>
          <span class="eo-provenance-value">${this.formatTimestamp(provenance.updated_at || cell.updated_at)}</span>
        </div>
        <div class="eo-provenance-item">
          <span class="eo-provenance-label">Source:</span>
          <span class="eo-provenance-value">${this.humanize(context.source?.system) || provenance.source || 'Unknown'}</span>
        </div>
        ${context.source?.file ? `
          <div class="eo-provenance-item">
            <span class="eo-provenance-label">Source File:</span>
            <span class="eo-provenance-value eo-monospace">${context.source.file}</span>
          </div>
        ` : ''}
      </div>

      <div class="eo-provenance-section">
        <h4>Method & Agent</h4>
        <div class="eo-provenance-item">
          <span class="eo-provenance-label">Method:</span>
          <span class="eo-provenance-value">
            <span class="eo-badge eo-badge-${context.method || 'unknown'}">${context.method || 'unknown'}</span>
          </span>
        </div>
        <div class="eo-provenance-item">
          <span class="eo-provenance-label">Agent:</span>
          <span class="eo-provenance-value">${context.agent?.name || context.agent?.type || provenance.agent || 'system'}</span>
        </div>
        ${context.definition ? `
          <div class="eo-provenance-item">
            <span class="eo-provenance-label">Definition:</span>
            <span class="eo-provenance-value">${context.definition}</span>
          </div>
        ` : ''}
      </div>

      <div class="eo-provenance-section">
        <h4>Transformations</h4>
        ${provenance.operations && provenance.operations.length > 0
          ? provenance.operations.map(op => `
              <div class="eo-operation-item">
                <span class="eo-operation-type">${op.type}</span>
                <span class="eo-operation-desc">${op.description}</span>
                <span class="eo-operation-time">${this.formatTimestamp(op.timestamp)}</span>
              </div>
            `).join('')
          : '<div class="eo-cell-empty">No transformations applied</div>'
        }
      </div>
    `;
  }

  /**
   * Render History tab
   */
  renderHistoryTab(cell) {
    // Use getCellHistory to get field-specific history
    const history = this.config.getCellHistory(this.currentRecordId, this.currentFieldName);

    if (!history || history.length === 0) {
      return '<div class="eo-cell-empty">No changes yet</div>';
    }

    const historyItems = history.map(item => `
      <div class="eo-history-item">
        <div class="eo-history-header">
          <span class="eo-history-field">${item.operator || 'ALT'}</span>
          <span class="eo-history-time">${this.formatTimestamp(item.timestamp)}</span>
        </div>
        <div class="eo-history-change">
          <span class="eo-history-old">${this.formatValue(item.old_value)}</span>
          <span class="eo-history-arrow">→</span>
          <span class="eo-history-new">${this.formatValue(item.new_value)}</span>
        </div>
        ${item.agent ? `<div class="eo-history-operator">by ${item.agent}</div>` : ''}
      </div>
    `).join('');

    return `<div class="eo-history-list">${historyItems}</div>`;
  }

  /**
   * Render Context tab
   */
  renderContextTab(cell) {
    const context = this.config.getContext(this.currentRecordId, this.currentFieldName);
    const primaryValue = cell.values?.[0];
    const valueContext = primaryValue?.context_schema || {};

    return `
      <div class="eo-context-section">
        <h4>Temporal Context</h4>
        <div class="eo-context-item">
          <span class="eo-context-label">Granularity:</span>
          <span class="eo-context-value">${valueContext.timeframe?.granularity || context.temporal?.granularity || 'N/A'}</span>
        </div>
        ${valueContext.timeframe?.start || context.temporal?.start
          ? `<div class="eo-context-item">
              <span class="eo-context-label">Start:</span>
              <span class="eo-context-value">${this.formatTimestamp(valueContext.timeframe?.start || context.temporal?.start)}</span>
            </div>`
          : ''
        }
        ${valueContext.timeframe?.end || context.temporal?.end
          ? `<div class="eo-context-item">
              <span class="eo-context-label">End:</span>
              <span class="eo-context-value">${this.formatTimestamp(valueContext.timeframe?.end || context.temporal?.end)}</span>
            </div>`
          : ''
        }
      </div>

      <div class="eo-context-section">
        <h4>Subject Context</h4>
        <div class="eo-context-item">
          <span class="eo-context-label">Subject:</span>
          <span class="eo-context-value">${this.formatSubject(valueContext.subject) || context.subject || 'N/A'}</span>
        </div>
        <div class="eo-context-item">
          <span class="eo-context-label">Scale:</span>
          <span class="eo-context-value">
            ${valueContext.scale || context.spatial?.scale
              ? `<span class="eo-badge eo-badge-${valueContext.scale || context.spatial?.scale}">${valueContext.scale || context.spatial?.scale}</span>`
              : 'N/A'
            }
          </span>
        </div>
        ${context.spatial?.location
          ? `<div class="eo-context-item">
              <span class="eo-context-label">Location:</span>
              <span class="eo-context-value">${context.spatial.location}</span>
            </div>`
          : ''
        }
      </div>

      <div class="eo-context-section">
        <h4>Measurement Context</h4>
        <div class="eo-context-item">
          <span class="eo-context-label">Method:</span>
          <span class="eo-context-value">
            ${valueContext.method || context.method
              ? `<span class="eo-badge eo-badge-${valueContext.method || context.method}">${valueContext.method || context.method}</span>`
              : 'N/A'
            }
          </span>
        </div>
        <div class="eo-context-item">
          <span class="eo-context-label">Observer:</span>
          <span class="eo-context-value">${valueContext.agent?.name || context.agent?.name || 'N/A'}</span>
        </div>
        ${valueContext.definition || context.definition
          ? `<div class="eo-context-item">
              <span class="eo-context-label">Definition:</span>
              <span class="eo-context-value">${valueContext.definition || context.definition}</span>
            </div>`
          : ''
        }
      </div>
    `;
  }

  /**
   * Attach click listeners to relationship links
   */
  attachRelationshipClickListeners() {
    const links = this.modal.querySelectorAll('.eo-relationship-link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetRecordId = link.dataset.record;
        const targetFieldName = link.dataset.field;
        this.config.onRelationClick(targetRecordId, targetFieldName);
      });
    });
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Unknown';

    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // Full date
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  /**
   * Format value for display
   */
  formatValue(value) {
    if (value === null || value === undefined) return '<span class="eo-null">empty</span>';
    if (typeof value === 'number') {
      return new Intl.NumberFormat().format(value);
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    if (typeof value === 'boolean') {
      return value ? '<span class="eo-bool-true">true</span>' : '<span class="eo-bool-false">false</span>';
    }
    // Check for ISO timestamp strings
    if (typeof value === 'string' && typeof EOISOTimeDisplay !== 'undefined' && EOISOTimeDisplay.isISOTimestamp(value)) {
      return EOISOTimeDisplay.formatISOTimeHTML(value, {
        timezone: null,
        showTimezone: true,
        clickable: true
      });
    }
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    return String(value);
  }

  /**
   * Format subject for display
   */
  formatSubject(subject) {
    if (!subject) return null;
    const parts = [];
    if (subject.label) parts.push(subject.label);
    if (subject.id) parts.push(`(${subject.id})`);
    return parts.join(' ') || null;
  }

  /**
   * Humanize technical terms
   */
  humanize(str) {
    if (!str) return null;
    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Destroy and cleanup all resources
   */
  destroy() {
    // Remove escape key handler if present
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }

    // Remove modal from DOM
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Clear references
    this.currentCellId = null;
    this.currentRecordId = null;
    this.currentFieldName = null;
    this.config = {};
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOCellModal;
}

if (typeof window !== 'undefined') {
  window.EOCellModal = EOCellModal;
}
