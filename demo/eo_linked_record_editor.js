/**
 * EOLinkedRecordEditor
 *
 * Inline/popover editor for linked record fields.
 * Allows users to:
 * - View current linked records as editable pills
 * - Remove linked records by clicking X on pills
 * - Add new linked records via search/autocomplete
 * - Click on a linked record pill to open its record modal
 *
 * The key insight: clicking INTO a linked record field puts you in edit mode,
 * but clicking ON a specific record pill opens that record's modal view.
 */
class EOLinkedRecordEditor {
  constructor() {
    this.overlay = null;
    this.editor = null;
    this.currentCell = null;
    this.currentRecordId = null;
    this.currentFieldName = null;
    this.linkedRecords = [];
    this.availableRecords = [];
    this.searchQuery = '';
    this.config = {};
  }

  /**
   * Initialize the editor with configuration
   * @param {Object} config - Configuration object
   */
  initialize(config = {}) {
    this.config = {
      onSave: config.onSave || (() => {}),
      onRecordClick: config.onRecordClick || (() => {}),
      getLinkedRecords: config.getLinkedRecords || (() => []),
      getAvailableRecords: config.getAvailableRecords || (() => []),
      getRecordDisplayName: config.getRecordDisplayName || ((r) => r.name || r.id),
      getFieldConfig: config.getFieldConfig || (() => ({})),
      ...config
    };
  }

  /**
   * Show the editor for a specific cell
   * @param {HTMLElement} cell - The cell element that was clicked
   * @param {string} recordId - The parent record ID
   * @param {string} fieldName - The field name
   */
  show(cell, recordId, fieldName) {
    this.currentCell = cell;
    this.currentRecordId = recordId;
    this.currentFieldName = fieldName;
    this.searchQuery = '';

    // Get current linked records and available records
    this.linkedRecords = [...this.config.getLinkedRecords(recordId, fieldName)];
    this.availableRecords = this.config.getAvailableRecords(recordId, fieldName);

    this.render();
    this.attachEventListeners();
    this.positionEditor();
  }

  /**
   * Render the editor
   */
  render() {
    // Remove existing editor if any
    this.hide();

    const fieldConfig = this.config.getFieldConfig(this.currentFieldName);
    const maxLinks = fieldConfig.limit || Infinity;
    const canAddMore = this.linkedRecords.length < maxLinks;

    const editorHTML = `
      <div class="eo-linked-editor-overlay" id="eoLinkedEditorOverlay">
        <div class="eo-linked-editor" id="eoLinkedEditor">
          <div class="eo-linked-editor-header">
            <span class="eo-linked-editor-title">Edit linked records</span>
            <button class="eo-linked-editor-close" id="eoLinkedEditorClose">
              <i class="ph ph-x"></i>
            </button>
          </div>

          <div class="eo-linked-editor-body">
            <!-- Current linked records as removable pills -->
            <div class="eo-linked-pills-container" id="eoLinkedPills">
              ${this.renderLinkedPills()}
            </div>

            <!-- Search/add section -->
            ${canAddMore ? `
              <div class="eo-linked-search-container">
                <div class="eo-linked-search-input-wrapper">
                  <i class="ph ph-magnifying-glass"></i>
                  <input
                    type="text"
                    class="eo-linked-search-input"
                    id="eoLinkedSearchInput"
                    placeholder="Search records to link..."
                    autocomplete="off"
                  />
                </div>
                <div class="eo-linked-search-results" id="eoLinkedSearchResults">
                  ${this.renderSearchResults()}
                </div>
              </div>
            ` : `
              <div class="eo-linked-limit-message">
                Maximum ${maxLinks} linked record${maxLinks !== 1 ? 's' : ''} reached
              </div>
            `}
          </div>

          <div class="eo-linked-editor-footer">
            <button class="eo-btn eo-btn-secondary" id="eoLinkedEditorCancel">Cancel</button>
            <button class="eo-btn eo-btn-primary" id="eoLinkedEditorSave">Save</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', editorHTML);
    this.overlay = document.getElementById('eoLinkedEditorOverlay');
    this.editor = document.getElementById('eoLinkedEditor');
  }

  /**
   * Render linked records as pills
   */
  renderLinkedPills() {
    if (this.linkedRecords.length === 0) {
      return '<div class="eo-linked-empty">No linked records</div>';
    }

    return this.linkedRecords.map((record, index) => {
      const displayName = this.config.getRecordDisplayName(record);
      return `
        <div class="eo-linked-pill" data-record-id="${record.id}" data-index="${index}">
          <span class="eo-linked-pill-name" data-action="view">${displayName}</span>
          <button class="eo-linked-pill-remove" data-action="remove" title="Remove link">
            <i class="ph ph-x"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  /**
   * Render search results
   */
  renderSearchResults() {
    const filteredRecords = this.getFilteredAvailableRecords();

    if (this.searchQuery === '') {
      // Show hint when no search
      return `
        <div class="eo-linked-search-hint">
          Type to search for records to link
        </div>
      `;
    }

    if (filteredRecords.length === 0) {
      return `
        <div class="eo-linked-search-empty">
          No matching records found
        </div>
      `;
    }

    return filteredRecords.slice(0, 10).map(record => {
      const displayName = this.config.getRecordDisplayName(record);
      const isAlreadyLinked = this.linkedRecords.some(r => r.id === record.id);

      return `
        <div class="eo-linked-search-result ${isAlreadyLinked ? 'disabled' : ''}"
             data-record-id="${record.id}"
             ${isAlreadyLinked ? 'title="Already linked"' : ''}>
          <span class="eo-linked-search-result-name">${displayName}</span>
          ${isAlreadyLinked ? '<span class="eo-linked-search-result-badge">Linked</span>' : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Get filtered available records based on search query
   */
  getFilteredAvailableRecords() {
    if (!this.searchQuery) {
      return this.availableRecords;
    }

    const query = this.searchQuery.toLowerCase();
    return this.availableRecords.filter(record => {
      const displayName = this.config.getRecordDisplayName(record).toLowerCase();
      return displayName.includes(query);
    });
  }

  /**
   * Position the editor near the cell
   */
  positionEditor() {
    if (!this.editor || !this.currentCell) return;

    const cellRect = this.currentCell.getBoundingClientRect();
    const editorRect = this.editor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Position below the cell by default
    let top = cellRect.bottom + 8;
    let left = cellRect.left;

    // Adjust if would go off right edge
    if (left + editorRect.width > viewportWidth - 20) {
      left = viewportWidth - editorRect.width - 20;
    }

    // Adjust if would go off bottom edge
    if (top + editorRect.height > viewportHeight - 20) {
      // Position above the cell instead
      top = cellRect.top - editorRect.height - 8;
    }

    // Ensure not off left edge
    left = Math.max(20, left);

    this.editor.style.position = 'fixed';
    this.editor.style.top = `${top}px`;
    this.editor.style.left = `${left}px`;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    const closeBtn = document.getElementById('eoLinkedEditorClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Cancel button
    const cancelBtn = document.getElementById('eoLinkedEditorCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hide());
    }

    // Save button
    const saveBtn = document.getElementById('eoLinkedEditorSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.save());
    }

    // Click outside to close (on overlay)
    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.hide();
        }
      });
    }

    // Escape key to close
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.escHandler);

    // Search input
    const searchInput = document.getElementById('eoLinkedSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.refreshSearchResults();
      });
      // Focus the search input
      setTimeout(() => searchInput.focus(), 100);
    }

    // Pill interactions (remove and view)
    this.attachPillListeners();

    // Search result clicks
    this.attachSearchResultListeners();
  }

  /**
   * Attach listeners to pill elements
   */
  attachPillListeners() {
    const pillsContainer = document.getElementById('eoLinkedPills');
    if (!pillsContainer) return;

    pillsContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.eo-linked-pill');
      if (!pill) return;

      const recordId = pill.dataset.recordId;
      const action = e.target.closest('[data-action]')?.dataset.action;

      if (action === 'remove') {
        e.stopPropagation();
        this.removeLinkedRecord(recordId);
      } else if (action === 'view') {
        // Clicking on the name opens the record modal
        e.stopPropagation();
        this.hide();
        this.config.onRecordClick(recordId);
      }
    });
  }

  /**
   * Attach listeners to search result elements
   */
  attachSearchResultListeners() {
    const resultsContainer = document.getElementById('eoLinkedSearchResults');
    if (!resultsContainer) return;

    resultsContainer.addEventListener('click', (e) => {
      const result = e.target.closest('.eo-linked-search-result');
      if (!result || result.classList.contains('disabled')) return;

      const recordId = result.dataset.recordId;
      this.addLinkedRecord(recordId);
    });
  }

  /**
   * Remove a linked record
   */
  removeLinkedRecord(recordId) {
    this.linkedRecords = this.linkedRecords.filter(r => r.id !== recordId);
    this.refreshPills();
    this.refreshSearchResults();
  }

  /**
   * Add a linked record
   */
  addLinkedRecord(recordId) {
    const record = this.availableRecords.find(r => r.id === recordId);
    if (!record) return;

    // Check if already linked
    if (this.linkedRecords.some(r => r.id === recordId)) return;

    // Check limit
    const fieldConfig = this.config.getFieldConfig(this.currentFieldName);
    const maxLinks = fieldConfig.limit || Infinity;
    if (this.linkedRecords.length >= maxLinks) return;

    this.linkedRecords.push(record);
    this.refreshPills();
    this.refreshSearchResults();

    // Clear search
    const searchInput = document.getElementById('eoLinkedSearchInput');
    if (searchInput) {
      searchInput.value = '';
      this.searchQuery = '';
    }
  }

  /**
   * Refresh the pills display
   */
  refreshPills() {
    const pillsContainer = document.getElementById('eoLinkedPills');
    if (pillsContainer) {
      pillsContainer.innerHTML = this.renderLinkedPills();
      this.attachPillListeners();
    }
  }

  /**
   * Refresh the search results display
   */
  refreshSearchResults() {
    const resultsContainer = document.getElementById('eoLinkedSearchResults');
    if (resultsContainer) {
      resultsContainer.innerHTML = this.renderSearchResults();
      this.attachSearchResultListeners();
    }
  }

  /**
   * Save changes and close
   */
  save() {
    const linkedRecordIds = this.linkedRecords.map(r => r.id);
    this.config.onSave(this.currentRecordId, this.currentFieldName, linkedRecordIds);
    this.hide();
  }

  /**
   * Hide the editor
   */
  hide() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.editor = null;
    }
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
    }
    this.currentCell = null;
    this.currentRecordId = null;
    this.currentFieldName = null;
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
  module.exports = EOLinkedRecordEditor;
}

if (typeof window !== 'undefined') {
  window.EOLinkedRecordEditor = EOLinkedRecordEditor;
}
