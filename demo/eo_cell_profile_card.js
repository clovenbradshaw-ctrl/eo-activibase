/**
 * EOCellProfileCard
 *
 * A profile card that treats a CELL as a first-class record/entity.
 * Shows on right-click, displaying:
 * - Cell identity (record, field, cell_id)
 * - Provenance information
 * - History of changes
 * - Relations to other cells/records
 *
 * The key insight: "a cell IS a record that we can tell things about"
 * Every cell has its own story - where it came from, how it's changed, what it relates to.
 */
class EOCellProfileCard {
  constructor() {
    this.card = null;
    this.currentCell = null;
    this.currentRecordId = null;
    this.currentFieldName = null;
    this.currentTab = 'provenance';
    this.config = {};
  }

  /**
   * Initialize with configuration
   * @param {Object} config - Configuration object
   */
  initialize(config = {}) {
    this.config = {
      getCellData: config.getCellData || (() => ({})),
      getCellProvenance: config.getCellProvenance || (() => ({})),
      getCellHistory: config.getCellHistory || (() => []),
      getCellRelations: config.getCellRelations || (() => []),
      getFieldSchema: config.getFieldSchema || (() => ({})),
      onNavigateToRecord: config.onNavigateToRecord || (() => {}),
      onNavigateToCell: config.onNavigateToCell || (() => {}),
      ...config
    };
  }

  /**
   * Show the profile card at the specified position
   * @param {HTMLElement} cell - The cell element
   * @param {string} recordId - The parent record ID
   * @param {string} fieldName - The field name
   * @param {Object} position - {x, y} position for the card
   */
  show(cell, recordId, fieldName, position) {
    this.currentCell = cell;
    this.currentRecordId = recordId;
    this.currentFieldName = fieldName;
    this.currentTab = 'provenance';

    this.render(position);
    this.attachEventListeners();
  }

  /**
   * Render the profile card
   */
  render(position) {
    // Remove existing card if any
    this.hide();

    const cellData = this.config.getCellData(this.currentRecordId, this.currentFieldName);
    const fieldSchema = this.config.getFieldSchema(this.currentFieldName);
    const cellId = cellData.cell_id || `${this.currentRecordId}:${this.currentFieldName}`;

    const cardHTML = `
      <div class="eo-cell-profile-card" id="eoCellProfileCard">
        <div class="eo-cell-profile-header">
          <div class="eo-cell-profile-identity">
            <div class="eo-cell-profile-icon">
              <i class="ph ph-cell-signal-full"></i>
            </div>
            <div class="eo-cell-profile-info">
              <div class="eo-cell-profile-title">Cell Profile</div>
              <div class="eo-cell-profile-subtitle">${this.currentFieldName}</div>
            </div>
          </div>
          <button class="eo-cell-profile-close" id="eoCellProfileClose">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <div class="eo-cell-profile-meta">
          <div class="eo-cell-profile-meta-item">
            <span class="eo-cell-profile-meta-label">Cell ID</span>
            <span class="eo-cell-profile-meta-value eo-monospace">${this.truncateId(cellId)}</span>
          </div>
          <div class="eo-cell-profile-meta-item">
            <span class="eo-cell-profile-meta-label">Field Type</span>
            <span class="eo-cell-profile-meta-value">
              <span class="eo-cell-profile-type-badge">${fieldSchema.type || 'TEXT'}</span>
            </span>
          </div>
          <div class="eo-cell-profile-meta-item">
            <span class="eo-cell-profile-meta-label">Values</span>
            <span class="eo-cell-profile-meta-value">${cellData.values?.length || 1} observation${(cellData.values?.length || 1) !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="eo-cell-profile-tabs">
          <button class="eo-cell-profile-tab active" data-tab="provenance">
            <i class="ph ph-fingerprint"></i> Provenance
          </button>
          <button class="eo-cell-profile-tab" data-tab="history">
            <i class="ph ph-clock-counter-clockwise"></i> History
          </button>
          <button class="eo-cell-profile-tab" data-tab="relations">
            <i class="ph ph-link"></i> Relations
          </button>
        </div>

        <div class="eo-cell-profile-content">
          <div class="eo-cell-profile-tab-content active" data-tab-content="provenance">
            ${this.renderProvenanceTab()}
          </div>
          <div class="eo-cell-profile-tab-content" data-tab-content="history">
            ${this.renderHistoryTab()}
          </div>
          <div class="eo-cell-profile-tab-content" data-tab-content="relations">
            ${this.renderRelationsTab()}
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', cardHTML);
    this.card = document.getElementById('eoCellProfileCard');

    // Position the card
    this.positionCard(position);
  }

  /**
   * Render Provenance tab
   */
  renderProvenanceTab() {
    const provenance = this.config.getCellProvenance(this.currentRecordId, this.currentFieldName);
    const cellData = this.config.getCellData(this.currentRecordId, this.currentFieldName);

    // Get context from first value if available
    const context = cellData.values?.[0]?.context_schema || {};

    return `
      <div class="eo-cell-provenance-section">
        <div class="eo-cell-provenance-item">
          <span class="eo-cell-provenance-label">Origin</span>
          <span class="eo-cell-provenance-value">
            ${provenance.origin || this.humanize(context.source?.system) || 'Unknown'}
          </span>
        </div>

        <div class="eo-cell-provenance-item">
          <span class="eo-cell-provenance-label">Created</span>
          <span class="eo-cell-provenance-value">
            ${this.formatTimestamp(cellData.created_at || provenance.created_at)}
          </span>
        </div>

        <div class="eo-cell-provenance-item">
          <span class="eo-cell-provenance-label">Last Modified</span>
          <span class="eo-cell-provenance-value">
            ${this.formatTimestamp(cellData.updated_at || provenance.updated_at)}
          </span>
        </div>

        <div class="eo-cell-provenance-item">
          <span class="eo-cell-provenance-label">Method</span>
          <span class="eo-cell-provenance-value">
            <span class="eo-badge eo-badge-${context.method || 'unknown'}">${context.method || 'unknown'}</span>
          </span>
        </div>

        <div class="eo-cell-provenance-item">
          <span class="eo-cell-provenance-label">Agent</span>
          <span class="eo-cell-provenance-value">
            ${context.agent?.name || context.agent?.type || provenance.agent || 'system'}
          </span>
        </div>

        ${context.source?.file ? `
          <div class="eo-cell-provenance-item">
            <span class="eo-cell-provenance-label">Source File</span>
            <span class="eo-cell-provenance-value eo-monospace">
              ${context.source.file}
            </span>
          </div>
        ` : ''}

        ${context.definition ? `
          <div class="eo-cell-provenance-item eo-cell-provenance-full">
            <span class="eo-cell-provenance-label">Definition</span>
            <span class="eo-cell-provenance-value">
              ${context.definition}
            </span>
          </div>
        ` : ''}
      </div>

      ${provenance.operations?.length > 0 ? `
        <div class="eo-cell-provenance-operations">
          <div class="eo-cell-provenance-operations-title">Transformations</div>
          ${provenance.operations.map(op => `
            <div class="eo-cell-provenance-operation">
              <span class="eo-cell-op-type">${op.type}</span>
              <span class="eo-cell-op-desc">${op.description}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  /**
   * Render History tab
   */
  renderHistoryTab() {
    const history = this.config.getCellHistory(this.currentRecordId, this.currentFieldName);

    if (!history || history.length === 0) {
      return `
        <div class="eo-cell-profile-empty">
          <i class="ph ph-clock-counter-clockwise"></i>
          <span>No history available</span>
        </div>
      `;
    }

    return `
      <div class="eo-cell-history-list">
        ${history.map((entry, index) => `
          <div class="eo-cell-history-entry ${index === 0 ? 'latest' : ''}">
            <div class="eo-cell-history-marker"></div>
            <div class="eo-cell-history-content">
              <div class="eo-cell-history-header">
                <span class="eo-cell-history-op">${entry.operator || 'ALT'}</span>
                <span class="eo-cell-history-time">${this.formatTimestamp(entry.timestamp)}</span>
              </div>
              ${entry.old_value !== undefined && entry.new_value !== undefined ? `
                <div class="eo-cell-history-change">
                  <span class="eo-cell-history-old">${this.formatValue(entry.old_value)}</span>
                  <i class="ph ph-arrow-right"></i>
                  <span class="eo-cell-history-new">${this.formatValue(entry.new_value)}</span>
                </div>
              ` : `
                <div class="eo-cell-history-desc">${entry.description || 'Value changed'}</div>
              `}
              ${entry.agent ? `<div class="eo-cell-history-agent">by ${entry.agent}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render Relations tab
   */
  renderRelationsTab() {
    const relations = this.config.getCellRelations(this.currentRecordId, this.currentFieldName);

    if (!relations || relations.length === 0) {
      return `
        <div class="eo-cell-profile-empty">
          <i class="ph ph-link-break"></i>
          <span>No relations found</span>
        </div>
      `;
    }

    return `
      <div class="eo-cell-relations-list">
        ${relations.map(rel => `
          <div class="eo-cell-relation-item" data-target-record="${rel.targetRecordId}" data-target-field="${rel.targetFieldName}">
            <div class="eo-cell-relation-icon">
              ${this.getRelationIcon(rel.type)}
            </div>
            <div class="eo-cell-relation-info">
              <div class="eo-cell-relation-type">${this.humanize(rel.type)}</div>
              <div class="eo-cell-relation-target">
                ${rel.targetFieldName} @ ${rel.targetRecordName || rel.targetRecordId}
              </div>
            </div>
            <button class="eo-cell-relation-goto" title="Go to cell">
              <i class="ph ph-arrow-square-out"></i>
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Position the card near the click position
   */
  positionCard(position) {
    if (!this.card) return;

    const cardRect = this.card.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = position.x;
    let top = position.y;

    // Adjust if would go off right edge
    if (left + cardRect.width > viewportWidth - 20) {
      left = position.x - cardRect.width;
    }

    // Adjust if would go off bottom edge
    if (top + cardRect.height > viewportHeight - 20) {
      top = position.y - cardRect.height;
    }

    // Ensure not off left/top edge
    left = Math.max(20, left);
    top = Math.max(20, top);

    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.card) return;

    // Close button
    const closeBtn = document.getElementById('eoCellProfileClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Tab switching
    const tabs = this.card.querySelectorAll('.eo-cell-profile-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Click outside to close
    this.outsideClickHandler = (e) => {
      if (this.card && !this.card.contains(e.target)) {
        this.hide();
      }
    };
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler);
    }, 0);

    // Escape key to close
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.escHandler);

    // Relation navigation
    const relationItems = this.card.querySelectorAll('.eo-cell-relation-goto');
    relationItems.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.eo-cell-relation-item');
        if (item) {
          const targetRecordId = item.dataset.targetRecord;
          const targetFieldName = item.dataset.targetField;
          this.hide();
          this.config.onNavigateToCell(targetRecordId, targetFieldName);
        }
      });
    });
  }

  /**
   * Switch to a different tab
   */
  switchTab(tabName) {
    if (!this.card) return;

    this.currentTab = tabName;

    // Update tab buttons
    this.card.querySelectorAll('.eo-cell-profile-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    this.card.querySelectorAll('.eo-cell-profile-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tabContent === tabName);
    });
  }

  /**
   * Hide the card
   */
  hide() {
    if (this.card) {
      this.card.remove();
      this.card = null;
    }
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
    }
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
    }
    this.currentCell = null;
    this.currentRecordId = null;
    this.currentFieldName = null;
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

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }

    return date.toLocaleDateString();
  }

  /**
   * Format value for display
   */
  formatValue(value) {
    if (value === null || value === undefined) return '<empty>';
    if (typeof value === 'string' && value.length > 30) {
      return value.substring(0, 30) + '...';
    }
    return String(value);
  }

  /**
   * Truncate ID for display
   */
  truncateId(id) {
    if (!id) return 'unknown';
    if (id.length <= 20) return id;
    return id.substring(0, 8) + '...' + id.substring(id.length - 8);
  }

  /**
   * Humanize technical terms
   */
  humanize(str) {
    if (!str) return 'Unknown';
    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get icon for relation type
   */
  getRelationIcon(type) {
    const icons = {
      'linked': '<i class="ph ph-link"></i>',
      'lookup': '<i class="ph ph-eye"></i>',
      'rollup': '<i class="ph ph-calculator"></i>',
      'formula': '<i class="ph ph-function"></i>',
      'derived': '<i class="ph ph-git-branch"></i>',
      'source': '<i class="ph ph-database"></i>'
    };
    return icons[type] || '<i class="ph ph-link"></i>';
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.hide();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOCellProfileCard;
}

if (typeof window !== 'undefined') {
  window.EOCellProfileCard = EOCellProfileCard;
}
