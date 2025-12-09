/**
 * EORecordModal
 *
 * Level 2: Record Modal
 * Opens when clicking a row label or complex cell.
 * Shows full record with tabs:
 * - Fields
 * - Relationships
 * - Provenance
 * - History
 * - Context
 *
 * Each field is clickable to open Level 3 (Field Lens Panel).
 */
class EORecordModal {
  constructor() {
    this.modal = null;
    this.currentRecordId = null;
    this.currentTab = 'fields';
    this.config = {};

    // View stack for pivot navigation: [{type: 'record'|'cell', recordId, fieldName?, tab?}]
    this.viewStack = [];
  }

  /**
   * Initialize the modal with configuration
   * @param {Object} config - Configuration object
   */
  initialize(config = {}) {
    this.config = {
      onFieldClick: config.onFieldClick || (() => {}),
      getRecord: config.getRecord || (() => ({})),
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
   * Show the modal for a specific record
   * @param {string} recordId - The record ID to display
   */
  show(recordId) {
    this.currentRecordId = recordId;
    this.currentTab = 'fields';

    // Initialize view stack with record view
    this.viewStack = [{ type: 'record', recordId, tab: 'fields' }];

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
        this.handleEscapeKey();
      }
    };
    document.addEventListener('keydown', this.escHandler);
  }

  /**
   * Handle escape key - go back or close
   */
  handleEscapeKey() {
    if (this.viewStack.length > 1) {
      this.goBack();
    } else {
      this.hide();
    }
  }

  /**
   * Pivot to cell history view
   * @param {string} recordId - The record ID
   * @param {string} fieldName - The field name to show history for
   */
  pivotToCell(recordId, fieldName) {
    // Save current tab before pivoting
    const currentView = this.viewStack[this.viewStack.length - 1];
    if (currentView) {
      currentView.tab = this.currentTab;
    }

    // Push cell view onto stack
    this.viewStack.push({ type: 'cell', recordId, fieldName, tab: 'history' });
    this.currentTab = 'history';

    this.updateContent();
  }

  /**
   * Go back to previous view
   */
  goBack() {
    if (this.viewStack.length > 1) {
      this.viewStack.pop();
      const previousView = this.viewStack[this.viewStack.length - 1];

      this.currentRecordId = previousView.recordId;
      this.currentTab = previousView.tab || 'fields';

      this.updateContent();
    }
  }

  /**
   * Get current view from stack
   */
  getCurrentView() {
    return this.viewStack[this.viewStack.length - 1] || { type: 'record', recordId: this.currentRecordId };
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
    overlay.className = 'eo-record-modal-overlay';

    overlay.innerHTML = `
      <div class="eo-record-modal">
        <div class="eo-record-modal-header">
          <div class="eo-record-modal-title-area">
            <button class="eo-record-modal-back" aria-label="Go back" style="display: none;">←</button>
            <div class="eo-record-modal-title">
              <h2 class="eo-record-modal-name"></h2>
              <div class="eo-record-modal-id"></div>
            </div>
          </div>
          <button class="eo-record-modal-close" aria-label="Close">×</button>
        </div>

        <div class="eo-record-modal-tabs">
          <button class="eo-record-tab active" data-tab="fields">Fields</button>
          <button class="eo-record-tab" data-tab="relationships">Relationships</button>
          <button class="eo-record-tab" data-tab="provenance">Provenance</button>
          <button class="eo-record-tab" data-tab="history">History</button>
          <button class="eo-record-tab" data-tab="context">Context</button>
        </div>

        <div class="eo-record-modal-content">
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
    const closeBtn = this.modal.querySelector('.eo-record-modal-close');
    closeBtn.addEventListener('click', () => this.hide());

    // Back button
    const backBtn = this.modal.querySelector('.eo-record-modal-back');
    backBtn.addEventListener('click', () => this.goBack());

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Tab switching
    const tabs = this.modal.querySelectorAll('.eo-record-tab');
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
    const tabs = this.modal.querySelectorAll('.eo-record-tab');
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
   * Update modal content based on current view and tab
   */
  updateContent() {
    const currentView = this.getCurrentView();
    const record = this.config.getRecord(currentView.recordId);
    if (!record) return;

    // Update header based on view type
    const nameEl = this.modal.querySelector('.eo-record-modal-name');
    const idEl = this.modal.querySelector('.eo-record-modal-id');
    const backBtn = this.modal.querySelector('.eo-record-modal-back');
    const tabsEl = this.modal.querySelector('.eo-record-modal-tabs');

    // Show/hide back button
    backBtn.style.display = this.viewStack.length > 1 ? 'flex' : 'none';

    if (currentView.type === 'cell') {
      // Cell history view
      nameEl.textContent = currentView.fieldName;
      idEl.textContent = `${currentView.recordId} : ${currentView.fieldName}`;
      tabsEl.style.display = 'none'; // Hide tabs in cell view - it's focused on history
    } else {
      // Record view
      nameEl.textContent = record.name || 'Record';
      idEl.textContent = currentView.recordId;
      tabsEl.style.display = 'flex';
    }

    // Update tab buttons
    const tabs = this.modal.querySelectorAll('.eo-record-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === this.currentTab) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update content area
    const contentEl = this.modal.querySelector('.eo-record-modal-content');

    if (currentView.type === 'cell') {
      // Render cell history view
      contentEl.innerHTML = this.renderCellHistoryView(currentView.recordId, currentView.fieldName, record);
    } else {
      // Render record view based on tab
      switch (this.currentTab) {
        case 'fields':
          contentEl.innerHTML = this.renderFieldsTab(record);
          this.attachFieldClickListeners();
          break;
        case 'relationships':
          contentEl.innerHTML = this.renderRelationshipsTab(record);
          break;
        case 'provenance':
          contentEl.innerHTML = this.renderProvenanceTab(record);
          break;
        case 'history':
          contentEl.innerHTML = this.renderHistoryTab(record);
          this.attachHistoryFieldClickListeners();
          break;
        case 'context':
          contentEl.innerHTML = this.renderContextTab(record);
          break;
      }
    }
  }

  /**
   * Render Fields tab
   */
  renderFieldsTab(record) {
    const fields = this.getRecordFields(record);

    if (fields.length === 0) {
      return '<div class="eo-record-empty">No fields found</div>';
    }

    const fieldRows = fields.map(field => {
      const schema = this.config.getFieldSchema(field.name);
      const isDerived = schema.type === 'FORMULA' || schema.type === 'ROLLUP' || schema.isLinked;
      const derivedClass = isDerived ? 'derived' : '';

      // Format value display
      let valueDisplay = field.value;
      if (field.supCount > 1) {
        valueDisplay += ` <span class="eo-sup-indicator" title="${field.supCount} values">●${field.supCount}</span>`;
      }

      return `
        <div class="eo-field-row">
          <div class="eo-field-label" data-field="${field.name}" title="Click to view field details">
            ${field.name}
            ${schema.type ? `<span class="eo-field-type-badge">${schema.type}</span>` : ''}
          </div>
          <div class="eo-field-value ${derivedClass}">
            ${valueDisplay}
          </div>
        </div>
      `;
    }).join('');

    return `<div class="eo-field-list">${fieldRows}</div>`;
  }

  /**
   * Get all fields from a record
   */
  getRecordFields(record) {
    const fields = [];

    // Get fields from record.fields (legacy) or record.cells
    if (record.fields) {
      Object.entries(record.fields).forEach(([name, value]) => {
        fields.push({ name, value });
      });
    }

    if (record.cells) {
      record.cells.forEach(cell => {
        const existingField = fields.find(f => f.name === cell.field_name);
        if (!existingField) {
          const value = this.getCellDisplayValue(cell);
          const supCount = cell.values ? cell.values.length : 0;
          fields.push({
            name: cell.field_name,
            value,
            supCount
          });
        }
      });
    }

    return fields;
  }

  /**
   * Get display value from a cell
   */
  getCellDisplayValue(cell) {
    if (!cell.values || cell.values.length === 0) {
      return '';
    }

    // Get the primary value (first one or highest scored)
    const primaryValue = cell.values[0];
    return primaryValue.value !== null && primaryValue.value !== undefined
      ? String(primaryValue.value)
      : '';
  }

  /**
   * Render Relationships tab
   */
  renderRelationshipsTab(record) {
    const relationships = this.config.getRelationships(this.currentRecordId);

    if (!relationships || relationships.length === 0) {
      return '<div class="eo-record-empty">No relationships found</div>';
    }

    const relationshipRows = relationships.map(rel => `
      <div class="eo-relationship-row">
        <div class="eo-relationship-type">${rel.type}</div>
        <div class="eo-relationship-target">
          <span class="eo-relationship-arrow">→</span>
          <a href="#" class="eo-relationship-link" data-record="${rel.targetId}">
            ${rel.targetName || rel.targetId}
          </a>
        </div>
        ${rel.fieldName ? `<div class="eo-relationship-field">via ${rel.fieldName}</div>` : ''}
      </div>
    `).join('');

    return `<div class="eo-relationship-list">${relationshipRows}</div>`;
  }

  /**
   * Render Provenance tab
   */
  renderProvenanceTab(record) {
    const provenance = this.config.getProvenance(this.currentRecordId);

    return `
      <div class="eo-provenance-section">
        <h4>Record Origin</h4>
        <div class="eo-provenance-item">
          <span class="eo-provenance-label">Created:</span>
          <span class="eo-provenance-value">${provenance.created_at || 'Unknown'}</span>
        </div>
        <div class="eo-provenance-item">
          <span class="eo-provenance-label">Source:</span>
          <span class="eo-provenance-value">${provenance.source || 'Unknown'}</span>
        </div>
        <div class="eo-provenance-item">
          <span class="eo-provenance-label">Import File:</span>
          <span class="eo-provenance-value">${provenance.import_file || 'N/A'}</span>
        </div>
      </div>

      <div class="eo-provenance-section">
        <h4>Structural Operations</h4>
        ${provenance.operations && provenance.operations.length > 0
          ? provenance.operations.map(op => `
              <div class="eo-operation-item">
                <span class="eo-operation-type">${op.type}</span>
                <span class="eo-operation-desc">${op.description}</span>
                <span class="eo-operation-time">${op.timestamp}</span>
              </div>
            `).join('')
          : '<div class="eo-record-empty">No structural operations</div>'
        }
      </div>

      <div class="eo-provenance-section">
        <h4>Stability</h4>
        <div class="eo-provenance-item">
          <span class="eo-provenance-label">Classification:</span>
          <span class="eo-stability-badge ${record.stability?.classification || 'emerging'}">
            ${record.stability?.classification || 'emerging'}
          </span>
        </div>
        ${record.stability?.reason
          ? `<div class="eo-provenance-note">${record.stability.reason}</div>`
          : ''
        }
      </div>
    `;
  }

  /**
   * Render History tab
   */
  renderHistoryTab(record) {
    const history = this.config.getHistory(this.currentRecordId);

    if (!history || history.length === 0) {
      return '<div class="eo-record-empty">No edit history</div>';
    }

    const historyItems = history.map(item => `
      <div class="eo-history-item">
        <div class="eo-history-header">
          <span class="eo-history-field eo-field-pivot" data-field="${item.field_name}" title="Click to see full history for ${item.field_name}">${item.field_name}</span>
          <span class="eo-history-time">${this.formatTimestamp(item.timestamp)}</span>
        </div>
        <div class="eo-history-change">
          <span class="eo-history-old">${item.old_value}</span>
          <span class="eo-history-arrow">→</span>
          <span class="eo-history-new">${item.new_value}</span>
        </div>
        ${item.operator ? `<div class="eo-history-operator">by ${item.operator}</div>` : ''}
      </div>
    `).join('');

    return `<div class="eo-history-list">${historyItems}</div>`;
  }

  /**
   * Render Context tab
   */
  renderContextTab(record) {
    const context = this.config.getContext(this.currentRecordId);

    return `
      <div class="eo-context-section">
        <h4>Temporal Context</h4>
        <div class="eo-context-item">
          <span class="eo-context-label">Timeframe:</span>
          <span class="eo-context-value">${context.temporal?.granularity || 'N/A'}</span>
        </div>
        ${context.temporal?.start
          ? `<div class="eo-context-item">
              <span class="eo-context-label">Start:</span>
              <span class="eo-context-value">${context.temporal.start}</span>
            </div>`
          : ''
        }
        ${context.temporal?.end
          ? `<div class="eo-context-item">
              <span class="eo-context-label">End:</span>
              <span class="eo-context-value">${context.temporal.end}</span>
            </div>`
          : ''
        }
      </div>

      <div class="eo-context-section">
        <h4>Spatial Context</h4>
        <div class="eo-context-item">
          <span class="eo-context-label">Location:</span>
          <span class="eo-context-value">${context.spatial?.location || 'N/A'}</span>
        </div>
        <div class="eo-context-item">
          <span class="eo-context-label">Scale:</span>
          <span class="eo-context-value">${context.spatial?.scale || 'N/A'}</span>
        </div>
      </div>

      <div class="eo-context-section">
        <h4>Methodological Context</h4>
        <div class="eo-context-item">
          <span class="eo-context-label">Method:</span>
          <span class="eo-context-value">${context.method || 'N/A'}</span>
        </div>
        <div class="eo-context-item">
          <span class="eo-context-label">Observer:</span>
          <span class="eo-context-value">${context.agent?.name || 'N/A'}</span>
        </div>
      </div>
    `;
  }

  /**
   * Attach click listeners to field labels in Fields tab
   * Clicking a field name pivots to cell history
   */
  attachFieldClickListeners() {
    const fieldLabels = this.modal.querySelectorAll('.eo-field-label');
    fieldLabels.forEach(label => {
      label.addEventListener('click', () => {
        const fieldName = label.dataset.field;
        // Pivot to cell history view
        this.pivotToCell(this.currentRecordId, fieldName);
      });
    });
  }

  /**
   * Attach click listeners to field names in History tab
   */
  attachHistoryFieldClickListeners() {
    const fieldPivots = this.modal.querySelectorAll('.eo-history-field.eo-field-pivot');
    fieldPivots.forEach(pivot => {
      pivot.addEventListener('click', () => {
        const fieldName = pivot.dataset.field;
        this.pivotToCell(this.currentRecordId, fieldName);
      });
    });
  }

  /**
   * Render Cell History View
   * Shows the complete history for a specific cell
   * @param {string} recordId - The record ID
   * @param {string} fieldName - The field name
   * @param {Object} record - The record object
   */
  renderCellHistoryView(recordId, fieldName, record) {
    // Get cell-specific history from config
    const cellHistory = this.config.getCellHistory(recordId, fieldName);

    // Get the current cell value
    const cell = record.cells?.find(c => c.field_name === fieldName);
    const currentValue = cell?.values?.[0]?.value ?? record.fields?.[fieldName] ?? '';
    const valueCount = cell?.values?.length || 1;

    // Get field schema for type info
    const schema = this.config.getFieldSchema(fieldName);

    let html = `
      <div class="eo-cell-history-view">
        <div class="eo-cell-history-header">
          <div class="eo-cell-current-value">
            <span class="eo-cell-value-label">Current Value</span>
            <span class="eo-cell-value-display">${this.formatValue(currentValue)}</span>
            ${valueCount > 1 ? `<span class="eo-sup-indicator" title="${valueCount} observations">SUP ${valueCount}</span>` : ''}
          </div>
          <div class="eo-cell-meta">
            <span class="eo-field-type-badge">${schema.type || 'TEXT'}</span>
          </div>
        </div>

        <div class="eo-cell-history-section">
          <h4>Change History</h4>
    `;

    if (!cellHistory || cellHistory.length === 0) {
      html += '<div class="eo-record-empty">No changes recorded for this cell</div>';
    } else {
      html += '<div class="eo-cell-history-timeline">';

      cellHistory.forEach((item, index) => {
        const isFirst = index === 0;
        html += `
          <div class="eo-cell-history-entry ${isFirst ? 'current' : ''}">
            <div class="eo-cell-history-marker">
              <div class="eo-cell-history-dot ${isFirst ? 'active' : ''}"></div>
              ${index < cellHistory.length - 1 ? '<div class="eo-cell-history-line"></div>' : ''}
            </div>
            <div class="eo-cell-history-content">
              <div class="eo-cell-history-time">${this.formatTimestamp(item.timestamp)}</div>
              <div class="eo-cell-history-change">
                ${item.old_value !== undefined && item.old_value !== null
                  ? `<span class="eo-history-old">${this.formatValue(item.old_value)}</span>
                     <span class="eo-history-arrow">→</span>`
                  : '<span class="eo-history-created">Created:</span>'
                }
                <span class="eo-history-new">${this.formatValue(item.new_value)}</span>
              </div>
              ${item.operator ? `<div class="eo-cell-history-operator">${this.formatOperator(item.operator)}</div>` : ''}
              ${item.agent ? `<div class="eo-cell-history-agent">by ${item.agent}</div>` : ''}
              ${item.context?.method ? `<div class="eo-cell-history-method">Method: ${item.context.method}</div>` : ''}
            </div>
          </div>
        `;
      });

      html += '</div>';
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Format a value for display
   */
  formatValue(value) {
    if (value === null || value === undefined) return '<span class="eo-null">empty</span>';
    if (typeof value === 'number') return new Intl.NumberFormat().format(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string' && value.length > 100) return value.substring(0, 100) + '...';
    return String(value);
  }

  /**
   * Format operator code to human-readable text
   */
  formatOperator(operator) {
    const operators = {
      'INS': 'Inserted',
      'DES': 'Destructured',
      'SEG': 'Segmented',
      'CON': 'Consolidated',
      'SYN': 'Synced',
      'REC': 'Reconciled',
      'ALT': 'Altered',
      'SUP': 'Superposed'
    };
    return operators[operator] || operator;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
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
    this.currentRecordId = null;
    this.config = {};
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EORecordModal;
}
