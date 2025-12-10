/**
 * EO Import Review Modal
 *
 * A required step before imported data is displayed. Users must review
 * and confirm cell/field assignments before the data is added to a workspace.
 *
 * This ensures:
 * 1. Users understand what data types were detected
 * 2. Users can correct any misdetected types
 * 3. Users explicitly confirm before data is loaded
 */

class EOImportReviewModal {
  constructor(options = {}) {
    this.importManager = options.importManager || null;
    this.onConfirm = options.onConfirm || (() => {});
    this.onCancel = options.onCancel || (() => {});

    // Available field types for override
    this.fieldTypes = [
      { id: 'TEXT', label: 'Text', icon: 'ph-text-aa' },
      { id: 'NUMBER', label: 'Number', icon: 'ph-hash' },
      { id: 'CURRENCY', label: 'Currency', icon: 'ph-currency-dollar' },
      { id: 'DATE', label: 'Date', icon: 'ph-calendar' },
      { id: 'CHECKBOX', label: 'Checkbox', icon: 'ph-check-square' },
      { id: 'SELECT', label: 'Select', icon: 'ph-list-bullets' },
      { id: 'EMAIL', label: 'Email', icon: 'ph-envelope' },
      { id: 'URL', label: 'URL', icon: 'ph-link' },
      { id: 'PERCENT', label: 'Percent', icon: 'ph-percent' }
    ];
  }

  /**
   * Show the review modal for an import
   * Returns a promise that resolves with the confirmed field mappings
   * or rejects if the user cancels
   *
   * @param {string} importId - The import to review
   * @param {string|null} targetSetId - Target set ID (if adding to existing)
   * @param {string|null} newSetName - Name for new set (if creating new)
   * @returns {Promise<object>} Resolves with confirmed configuration
   */
  show(importId, targetSetId = null, newSetName = null) {
    return new Promise((resolve, reject) => {
      const imp = this.importManager?.getImport(importId);
      if (!imp) {
        reject(new Error('Import not found'));
        return;
      }

      // Track user's field type overrides
      const fieldOverrides = {};

      // Create the modal
      const modal = document.createElement('div');
      modal.className = 'eo-modal-overlay eo-import-review-overlay';
      modal.innerHTML = this._renderModalContent(imp, targetSetId, newSetName);

      document.body.appendChild(modal);

      // Prevent background scrolling
      document.body.style.overflow = 'hidden';

      // Setup event handlers
      this._setupEventHandlers(modal, imp, fieldOverrides, resolve, reject);
    });
  }

  /**
   * Render the modal content
   * @private
   */
  _renderModalContent(imp, targetSetId, newSetName) {
    const targetName = newSetName || imp.fileMetadata.filenameAnalysis.baseName || 'New Workspace';
    const isNewWorkspace = !targetSetId;

    return `
      <div class="eo-import-review-modal">
        <div class="eo-review-header">
          <div class="eo-review-icon">
            <i class="ph-bold ph-clipboard-text"></i>
          </div>
          <div class="eo-review-title">
            <h2>Review Cell Assignments</h2>
            <p>Please review how your data will be mapped before importing</p>
          </div>
        </div>

        <div class="eo-review-summary">
          <div class="eo-summary-item">
            <i class="ph-bold ph-file-csv"></i>
            <span class="eo-summary-label">File</span>
            <span class="eo-summary-value">${this._escapeHtml(imp.name)}</span>
          </div>
          <div class="eo-summary-item">
            <i class="ph-bold ph-rows"></i>
            <span class="eo-summary-label">Records</span>
            <span class="eo-summary-value">${imp.rowCount.toLocaleString()}</span>
          </div>
          <div class="eo-summary-item">
            <i class="ph-bold ph-columns"></i>
            <span class="eo-summary-label">Fields</span>
            <span class="eo-summary-value">${imp.headers.length}</span>
          </div>
          <div class="eo-summary-item">
            <i class="ph-bold ${isNewWorkspace ? 'ph-plus-circle' : 'ph-squares-four'}"></i>
            <span class="eo-summary-label">${isNewWorkspace ? 'Creating' : 'Adding to'}</span>
            <span class="eo-summary-value">${this._escapeHtml(targetName)}</span>
          </div>
        </div>

        <div class="eo-review-instruction">
          <i class="ph-bold ph-info"></i>
          <span>Review each field below. Click on a field type to change it if the detection is incorrect.</span>
        </div>

        <div class="eo-review-fields-container">
          <div class="eo-review-fields-header">
            <span class="eo-field-col-name">Field Name</span>
            <span class="eo-field-col-type">Detected Type</span>
            <span class="eo-field-col-samples">Sample Values</span>
            <span class="eo-field-col-confidence">Confidence</span>
          </div>
          <div class="eo-review-fields-list">
            ${imp.headers.map(header => this._renderFieldRow(imp, header)).join('')}
          </div>
        </div>

        <div class="eo-review-quality">
          <div class="eo-quality-header">
            <i class="ph-bold ph-chart-bar"></i>
            <span>Data Quality Overview</span>
          </div>
          <div class="eo-quality-metrics">
            <div class="eo-quality-metric">
              <div class="eo-metric-bar">
                <div class="eo-metric-fill" style="width: ${imp.quality.completenessPercent}%; background: ${this._getQualityColor(imp.quality.completenessPercent)}"></div>
              </div>
              <span class="eo-metric-label">Completeness: ${imp.quality.completenessPercent}%</span>
            </div>
            <div class="eo-quality-stat">
              <span class="eo-stat-value">${imp.quality.uniqueRows}</span>
              <span class="eo-stat-label">unique rows</span>
            </div>
            ${imp.quality.duplicateRows > 0 ? `
              <div class="eo-quality-stat eo-warning">
                <span class="eo-stat-value">${imp.quality.duplicateRows}</span>
                <span class="eo-stat-label">duplicates</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="eo-review-footer">
          <button class="eo-btn eo-btn-secondary eo-review-cancel">
            <i class="ph-bold ph-x"></i>
            Cancel
          </button>
          <button class="eo-btn eo-btn-primary eo-review-confirm">
            <i class="ph-bold ph-check"></i>
            Confirm & Import ${imp.rowCount.toLocaleString()} Records
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render a single field row for review
   * @private
   */
  _renderFieldRow(imp, header) {
    const col = imp.schema.columns[header];
    const inferredType = imp.schema.inferredTypes[header] || 'TEXT';
    const typeInfo = this.fieldTypes.find(t => t.id === inferredType) || this.fieldTypes[0];

    // Calculate confidence based on type detection
    const confidence = this._calculateTypeConfidence(col, inferredType);
    const confidenceClass = confidence >= 90 ? 'high' : confidence >= 70 ? 'medium' : 'low';

    // Check for special markers
    const isPK = imp.schema.primaryKeyCandidate === header;
    const fkHint = imp.schema.foreignKeyHints.find(fk => fk.column === header);

    // Get sample values
    const samples = (col.samples || []).slice(0, 3);

    return `
      <div class="eo-review-field-row" data-field="${this._escapeHtml(header)}">
        <div class="eo-field-name">
          <span class="eo-field-name-text">${this._escapeHtml(header)}</span>
          ${isPK ? '<span class="eo-field-badge eo-badge-pk" title="Primary Key Candidate">PK</span>' : ''}
          ${fkHint ? '<span class="eo-field-badge eo-badge-fk" title="Foreign Key Hint">FK</span>' : ''}
        </div>
        <div class="eo-field-type">
          <button class="eo-type-selector" data-field="${this._escapeHtml(header)}" data-current-type="${inferredType}">
            <i class="ph-bold ${typeInfo.icon}"></i>
            <span>${typeInfo.label}</span>
            <i class="ph ph-caret-down"></i>
          </button>
          <div class="eo-type-dropdown" data-field="${this._escapeHtml(header)}">
            ${this.fieldTypes.map(t => `
              <button class="eo-type-option ${t.id === inferredType ? 'eo-selected' : ''}" data-type="${t.id}">
                <i class="ph-bold ${t.icon}"></i>
                <span>${t.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="eo-field-samples">
          ${samples.length > 0 ? samples.map(s =>
            `<code class="eo-sample-value">${this._escapeHtml(this._truncate(String(s), 20))}</code>`
          ).join('') : '<span class="eo-no-samples">No samples</span>'}
        </div>
        <div class="eo-field-confidence eo-confidence-${confidenceClass}">
          <div class="eo-confidence-bar">
            <div class="eo-confidence-fill" style="width: ${confidence}%"></div>
          </div>
          <span class="eo-confidence-value">${confidence}%</span>
        </div>
      </div>
    `;
  }

  /**
   * Calculate type detection confidence
   * @private
   */
  _calculateTypeConfidence(col, inferredType) {
    if (!col) return 50;

    const nonNullCount = (col.totalCount || 0) - (col.nullCount || 0);
    if (nonNullCount === 0) return 50;

    // Higher confidence if more unique values match the pattern
    const uniqueRatio = col.uniqueCount / nonNullCount;

    // Type-specific confidence adjustments
    switch (inferredType) {
      case 'NUMBER':
      case 'CURRENCY':
        // If detected as number, confidence is high if samples are consistent
        return Math.min(95, 70 + (uniqueRatio * 25));
      case 'DATE':
        return Math.min(92, 65 + (uniqueRatio * 27));
      case 'EMAIL':
      case 'URL':
        return 95; // Pattern matching is reliable
      case 'CHECKBOX':
        return 90;
      case 'SELECT':
        // Lower confidence for select - might be text
        return Math.min(80, 60 + ((1 - uniqueRatio) * 20));
      default:
        return 75; // TEXT is default fallback
    }
  }

  /**
   * Setup event handlers for the modal
   * @private
   */
  _setupEventHandlers(modal, imp, fieldOverrides, resolve, reject) {
    // Cancel button
    modal.querySelector('.eo-review-cancel').addEventListener('click', () => {
      this._closeModal(modal);
      reject(new Error('User cancelled import'));
    });

    // Confirm button
    modal.querySelector('.eo-review-confirm').addEventListener('click', () => {
      const result = {
        importId: imp.id,
        fieldOverrides: { ...fieldOverrides },
        confirmed: true
      };
      this._closeModal(modal);
      resolve(result);
    });

    // Overlay click to cancel
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this._closeModal(modal);
        reject(new Error('User cancelled import'));
      }
    });

    // Escape key to cancel
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        this._closeModal(modal);
        reject(new Error('User cancelled import'));
      }
    };
    document.addEventListener('keydown', escHandler);

    // Type selector dropdowns
    modal.querySelectorAll('.eo-type-selector').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const field = btn.dataset.field;
        const dropdown = modal.querySelector(`.eo-type-dropdown[data-field="${field}"]`);

        // Close all other dropdowns
        modal.querySelectorAll('.eo-type-dropdown.eo-open').forEach(d => {
          if (d !== dropdown) d.classList.remove('eo-open');
        });

        dropdown.classList.toggle('eo-open');
      });
    });

    // Type option selection
    modal.querySelectorAll('.eo-type-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = option.closest('.eo-type-dropdown');
        const field = dropdown.dataset.field;
        const newType = option.dataset.type;

        // Update the selector button
        const selector = modal.querySelector(`.eo-type-selector[data-field="${field}"]`);
        const typeInfo = this.fieldTypes.find(t => t.id === newType);
        selector.innerHTML = `
          <i class="ph-bold ${typeInfo.icon}"></i>
          <span>${typeInfo.label}</span>
          <i class="ph ph-caret-down"></i>
        `;
        selector.dataset.currentType = newType;

        // Mark selected option
        dropdown.querySelectorAll('.eo-type-option').forEach(o => o.classList.remove('eo-selected'));
        option.classList.add('eo-selected');

        // Store override
        fieldOverrides[field] = newType;

        // Close dropdown
        dropdown.classList.remove('eo-open');

        // Visual feedback - highlight changed row
        const row = modal.querySelector(`.eo-review-field-row[data-field="${field}"]`);
        row.classList.add('eo-field-modified');
      });
    });

    // Close dropdowns when clicking elsewhere
    modal.addEventListener('click', () => {
      modal.querySelectorAll('.eo-type-dropdown.eo-open').forEach(d => {
        d.classList.remove('eo-open');
      });
    });
  }

  /**
   * Close the modal and cleanup
   * @private
   */
  _closeModal(modal) {
    document.body.style.overflow = '';
    modal.classList.add('eo-closing');
    setTimeout(() => modal.remove(), 200);
  }

  /**
   * Get color for quality percentage
   * @private
   */
  _getQualityColor(pct) {
    if (pct >= 90) return '#22c55e';
    if (pct >= 70) return '#eab308';
    if (pct >= 50) return '#f97316';
    return '#ef4444';
  }

  /**
   * Truncate string
   * @private
   */
  _truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
  }

  /**
   * Escape HTML
   * @private
   */
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOImportReviewModal;
}

if (typeof window !== 'undefined') {
  window.EOImportReviewModal = EOImportReviewModal;
}
