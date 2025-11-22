/**
 * EO Integration Module
 * Main integration point for Epistemic Observability in Workbase
 *
 * This module provides easy-to-use APIs for integrating EO features
 * into your existing Workbase application.
 *
 * Usage:
 *   const eo = new EOIntegration();
 *   eo.initialize();
 *
 *   // On CSV import
 *   eo.handleImport(filename, records);
 *
 *   // On cell edit
 *   eo.handleEdit(recordId, fieldName, oldValue, newValue);
 *
 *   // Show cell modal
 *   eo.showCellModal(recordId, fieldName);
 */

class EOIntegration {
  constructor(options = {}) {
    this.options = {
      enableSUP: true,
      enableStability: true,
      enableContextInference: true,
      autoClassifyStability: true,
      ...options
    };

    // Initialize components
    this.dataStructures = EODataStructures;
    this.contextEngine = new EOContextEngine();
    this.supDetector = new EOSUPDetector();
    this.stabilityClassifier = new EOStabilityClassifier();
    this.cellModal = new EOCellModal();

    // Storage
    this.records = new Map(); // recordId -> record (with SUP-enabled cells)
    this.legacyMode = false; // Whether to maintain legacy field-value structure
  }

  /**
   * Initialize EO system
   */
  initialize() {
    console.log('🌟 Initializing EO (Epistemic Observability) Framework');

    // Inject styles
    this.injectStyles();

    // Set up event listeners
    this.setupEventListeners();

    console.log('✓ EO Framework initialized successfully');
    return this;
  }

  /**
   * Inject EO styles into page
   */
  injectStyles() {
    const existingLink = document.querySelector('link[href*="eo_styles.css"]');
    if (existingLink) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'eo_styles.css';
    document.head.appendChild(link);
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Listen for cell clicks with data-eo-cell attribute
    document.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-eo-cell]');
      if (cell) {
        const recordId = cell.dataset.recordId;
        const fieldName = cell.dataset.fieldName;
        if (recordId && fieldName) {
          this.showCellModal(recordId, fieldName);
        }
      }
    });
  }

  /**
   * Set current user (for agent tracking)
   */
  setCurrentUser(userId, userName) {
    this.contextEngine.setCurrentUser(userId, userName);
    return this;
  }

  /**
   * Handle CSV import
   */
  handleImport(filename, records) {
    console.log(`📥 Handling import: ${filename} (${records.length} records)`);

    const importedRecords = [];

    records.forEach((recordData, index) => {
      const record_id = recordData.id || this.dataStructures.generateRecordId();

      // Infer contexts for all fields
      const contexts = this.contextEngine.inferBatchFromImport({
        filename,
        recordData
      });

      // Create SUP-enabled cells
      const cells = [];
      Object.entries(recordData).forEach(([fieldName, value]) => {
        if (fieldName === 'id') return; // Skip ID field

        const cell_id = this.dataStructures.generateCellId(record_id, fieldName);
        const context = contexts[fieldName];

        const cell = this.dataStructures.createSimpleCell({
          cell_id,
          record_id,
          field_name: fieldName,
          value,
          context_schema: context
        });

        cells.push(cell);
      });

      // Create record
      const record = this.dataStructures.createRecord({
        record_id,
        fields: recordData, // Legacy compatibility
        cells
      });

      // Classify stability if enabled
      if (this.options.autoClassifyStability) {
        record.stability = this.stabilityClassifier.classify(record);
      }

      // Store record
      this.records.set(record_id, record);
      importedRecords.push(record);
    });

    console.log(`✓ Import complete: ${importedRecords.length} records processed`);
    return importedRecords;
  }

  /**
   * Handle user edit
   */
  handleEdit(recordId, fieldName, oldValue, newValue) {
    console.log(`✏️ Handling edit: ${recordId}.${fieldName}`);

    const record = this.records.get(recordId);
    if (!record) {
      console.warn(`Record not found: ${recordId}`);
      return null;
    }

    // Find or create cell
    let cell = record.cells.find(c => c.field_name === fieldName);
    if (!cell) {
      const cell_id = this.dataStructures.generateCellId(recordId, fieldName);
      cell = this.dataStructures.createCell({
        cell_id,
        record_id,
        field_name: fieldName,
        values: []
      });
      record.cells.push(cell);
    }

    // Infer context from edit
    const context = this.contextEngine.inferFromEdit({
      columnName: fieldName,
      oldValue,
      newValue,
      recordData: record.fields
    });

    // Add value to cell (may create SUP)
    this.dataStructures.addValueToCell(cell, newValue, context);

    // Update legacy fields
    record.fields[fieldName] = newValue;
    record.updated_at = new Date().toISOString();

    // Add to edit history
    const operator = this.contextEngine.inferOperator({
      oldValue,
      newValue,
      oldContext: cell.values[cell.values.length - 2]?.context_schema,
      newContext: context
    });

    const historyEntry = this.contextEngine.createHistoryEntry({
      operator,
      oldValue,
      newValue,
      context
    });

    record.edit_history = record.edit_history || [];
    record.edit_history.push(historyEntry);

    // Update value history for variability calculation
    record.value_history = record.value_history || [];
    record.value_history.push(newValue);

    // Reclassify stability if needed
    if (this.options.autoClassifyStability &&
        this.stabilityClassifier.shouldRecalculate(record)) {
      record.stability = this.stabilityClassifier.classify(record);
    }

    console.log(`✓ Edit complete: ${this.supDetector.detectSuperposition(cell) ? 'SUP detected' : 'single value'}`);
    return record;
  }

  /**
   * Handle formula field
   */
  handleFormula(recordId, fieldName, formula, result) {
    const record = this.records.get(recordId);
    if (!record) return null;

    const context = this.contextEngine.inferFromFormula({
      columnName: fieldName,
      formula,
      dependencies: []
    });

    let cell = record.cells.find(c => c.field_name === fieldName);
    if (!cell) {
      const cell_id = this.dataStructures.generateCellId(recordId, fieldName);
      cell = this.dataStructures.createCell({
        cell_id,
        record_id,
        field_name: fieldName,
        values: []
      });
      record.cells.push(cell);
    }

    this.dataStructures.addValueToCell(cell, result, context);
    record.fields[fieldName] = result;

    return record;
  }

  /**
   * Show cell modal
   */
  showCellModal(recordId, fieldName) {
    const record = this.records.get(recordId);
    if (!record) {
      console.warn(`Record not found: ${recordId}`);
      return;
    }

    const cell = record.cells.find(c => c.field_name === fieldName);
    if (!cell) {
      console.warn(`Cell not found: ${fieldName}`);
      return;
    }

    this.cellModal.show(cell, this.contextEngine, this.supDetector);
  }

  /**
   * Get cell value for display (handles SUP)
   */
  getCellDisplayValue(recordId, fieldName) {
    const record = this.records.get(recordId);
    if (!record) return null;

    const cell = record.cells.find(c => c.field_name === fieldName);
    if (!cell) return record.fields[fieldName]; // Fallback to legacy

    const viewContext = this.contextEngine.getViewContext();
    const dominant = this.dataStructures.getDominantValue(cell, viewContext);

    return dominant ? dominant.value : null;
  }

  /**
   * Get SUP indicator HTML for cell
   */
  getCellSUPIndicator(recordId, fieldName) {
    const record = this.records.get(recordId);
    if (!record) return '';

    const cell = record.cells.find(c => c.field_name === fieldName);
    if (!cell || !this.supDetector.detectSuperposition(cell)) {
      return '';
    }

    const count = cell.values.length;
    const tooltip = this.supDetector.getTooltipText(cell);

    return `<span class="eo-sup-indicator" title="${tooltip}">●${count}</span>`;
  }

  /**
   * Get stability badge HTML for record
   */
  getStabilityBadge(recordId) {
    const record = this.records.get(recordId);
    if (!record || !record.stability) return '';

    const display = this.stabilityClassifier.getDisplayInfo(record.stability);

    return `
      <span class="eo-stability-badge ${record.stability.classification}"
            title="${display.description}">
        ${display.icon} ${display.label}
      </span>
    `;
  }

  /**
   * Enhance table cell with EO attributes
   */
  enhanceTableCell(cellElement, recordId, fieldName) {
    cellElement.setAttribute('data-eo-cell', 'true');
    cellElement.setAttribute('data-record-id', recordId);
    cellElement.setAttribute('data-field-name', fieldName);
    cellElement.style.cursor = 'pointer';

    // Add SUP indicator if applicable
    const indicator = this.getCellSUPIndicator(recordId, fieldName);
    if (indicator) {
      cellElement.insertAdjacentHTML('beforeend', indicator);
    }
  }

  /**
   * Get all records with SUP
   */
  getRecordsWithSuperposition() {
    const results = [];

    this.records.forEach((record, recordId) => {
      const cellsWithSUP = record.cells.filter(cell =>
        this.supDetector.detectSuperposition(cell)
      );

      if (cellsWithSUP.length > 0) {
        results.push({
          recordId,
          record,
          cellsWithSUP
        });
      }
    });

    return results;
  }

  /**
   * Get stability statistics
   */
  getStabilityStatistics() {
    const records = Array.from(this.records.values());
    return this.stabilityClassifier.getStatistics(records);
  }

  /**
   * Export record data (with or without EO metadata)
   */
  exportRecord(recordId, includeEO = false) {
    const record = this.records.get(recordId);
    if (!record) return null;

    if (!includeEO) {
      // Export only legacy fields
      return {
        id: recordId,
        ...record.fields
      };
    }

    // Export full EO data
    return {
      record_id: recordId,
      fields: record.fields,
      cells: record.cells,
      stability: record.stability,
      edit_history: record.edit_history,
      value_history: record.value_history,
      created_at: record.created_at,
      updated_at: record.updated_at
    };
  }

  /**
   * Import records from legacy format
   */
  importLegacyRecords(records) {
    console.log(`🔄 Migrating ${records.length} legacy records to EO format`);

    records.forEach(legacyRecord => {
      const record = this.dataStructures.migrateLegacyRecord(legacyRecord);
      this.records.set(record.record_id, record);

      // Classify stability
      if (this.options.autoClassifyStability) {
        record.stability = this.stabilityClassifier.classify(record);
      }
    });

    console.log('✓ Migration complete');
  }

  /**
   * Get all records
   */
  getAllRecords() {
    return Array.from(this.records.values());
  }

  /**
   * Get record by ID
   */
  getRecord(recordId) {
    return this.records.get(recordId);
  }

  /**
   * Clear all records
   */
  clearRecords() {
    this.records.clear();
  }

  /**
   * Get EO statistics
   */
  getStatistics() {
    const records = this.getAllRecords();
    const totalCells = records.reduce((sum, r) => sum + r.cells.length, 0);
    const cellsWithSUP = records.reduce((sum, r) => {
      return sum + r.cells.filter(c => this.supDetector.detectSuperposition(c)).length;
    }, 0);

    return {
      totalRecords: records.length,
      totalCells,
      cellsWithSUP,
      supPercentage: totalCells > 0 ? (cellsWithSUP / totalCells * 100).toFixed(1) : 0,
      stability: this.getStabilityStatistics()
    };
  }

  /**
   * Enable debug mode
   */
  enableDebug() {
    window.eo_debug = {
      records: this.records,
      contextEngine: this.contextEngine,
      supDetector: this.supDetector,
      stabilityClassifier: this.stabilityClassifier,
      integration: this
    };

    console.log('🐛 EO Debug mode enabled. Access via window.eo_debug');
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOIntegration;
}

if (typeof window !== 'undefined') {
  window.EOIntegration = EOIntegration;
}
