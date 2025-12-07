/**
 * EOInlineCellEditor
 *
 * Level 1: Inline Cell Editing
 * Provides fast, inline editing with hover states showing type badges and indicators.
 * Recognizes:
 * - primitive values → inline edit
 * - derived values (linked or rollup) → inline edit if editable
 * - relationship-driven values → open modal
 *
 * NEW BEHAVIORS:
 * - Click into linked record field → opens linked record editor
 * - Click on linked record pill → opens that record's modal view
 * - Right-click on any cell → shows cell profile card (cell as record)
 */
class EOInlineCellEditor {
  constructor() {
    this.activeEditor = null;
    this.hoverTooltip = null;
    this.linkedRecordEditor = null;
    this.cellProfileCard = null;
    this.initHoverTooltip();
  }

  /**
   * Initialize hover tooltip element
   */
  initHoverTooltip() {
    this.hoverTooltip = document.createElement('div');
    this.hoverTooltip.className = 'eo-cell-hover-tooltip';
    this.hoverTooltip.style.display = 'none';
    document.body.appendChild(this.hoverTooltip);
  }

  /**
   * Attach event listeners to grid cells
   * @param {HTMLElement} container - The container element with cells
   * @param {Object} config - Configuration object with callbacks
   */
  attachToGrid(container, config = {}) {
    this.config = {
      onEdit: config.onEdit || (() => {}),
      onViewDetails: config.onViewDetails || (() => {}),
      onViewRecord: config.onViewRecord || (() => {}),
      onEditLinkedRecords: config.onEditLinkedRecords || (() => {}),
      getFieldType: config.getFieldType || (() => 'text'),
      getFieldMetadata: config.getFieldMetadata || (() => ({})),
      getLinkedRecords: config.getLinkedRecords || (() => []),
      getAvailableRecords: config.getAvailableRecords || (() => []),
      getFieldConfig: config.getFieldConfig || (() => ({})),
      getCellData: config.getCellData || (() => ({})),
      getCellProvenance: config.getCellProvenance || (() => ({})),
      getCellHistory: config.getCellHistory || (() => []),
      getCellRelations: config.getCellRelations || (() => []),
      getFieldSchema: config.getFieldSchema || (() => ({})),
      getRecordDisplayName: config.getRecordDisplayName || ((r) => r.name || r.id),
      ...config
    };

    // Initialize linked record editor if available
    if (typeof EOLinkedRecordEditor !== 'undefined') {
      this.linkedRecordEditor = new EOLinkedRecordEditor();
      this.linkedRecordEditor.initialize({
        onSave: (recordId, fieldName, linkedIds) => {
          this.config.onEditLinkedRecords(recordId, fieldName, linkedIds);
        },
        onRecordClick: (recordId) => {
          this.config.onViewRecord(recordId);
        },
        getLinkedRecords: this.config.getLinkedRecords,
        getAvailableRecords: this.config.getAvailableRecords,
        getRecordDisplayName: this.config.getRecordDisplayName,
        getFieldConfig: this.config.getFieldConfig
      });
    }

    // Initialize cell profile card if available
    if (typeof EOCellProfileCard !== 'undefined') {
      this.cellProfileCard = new EOCellProfileCard();
      this.cellProfileCard.initialize({
        getCellData: this.config.getCellData,
        getCellProvenance: this.config.getCellProvenance,
        getCellHistory: this.config.getCellHistory,
        getCellRelations: this.config.getCellRelations,
        getFieldSchema: this.config.getFieldSchema,
        onNavigateToRecord: this.config.onViewRecord,
        onNavigateToCell: (recordId, fieldName) => {
          this.config.onViewDetails(recordId, fieldName);
        }
      });
    }

    // Find all cells with data-eo-cell attribute
    const cells = container.querySelectorAll('[data-eo-cell]');

    cells.forEach(cell => {
      // Hover events
      cell.addEventListener('mouseenter', (e) => this.handleCellHover(e, cell));
      cell.addEventListener('mouseleave', (e) => this.handleCellLeave(e, cell));
      cell.addEventListener('mousemove', (e) => this.handleCellMove(e, cell));

      // Click events
      cell.addEventListener('click', (e) => this.handleCellClick(e, cell));

      // Double-click for direct edit
      cell.addEventListener('dblclick', (e) => this.handleCellDoubleClick(e, cell));

      // Right-click for cell profile card
      cell.addEventListener('contextmenu', (e) => this.handleCellRightClick(e, cell));
    });
  }

  /**
   * Handle cell hover - show type badge and metadata
   */
  handleCellHover(event, cell) {
    const recordId = cell.dataset.recordId;
    const fieldName = cell.dataset.fieldName;

    if (!recordId || !fieldName) return;

    const fieldType = this.config.getFieldType(fieldName);
    const metadata = this.config.getFieldMetadata(recordId, fieldName);

    // Build tooltip content
    const tooltipContent = this.buildTooltipContent(fieldType, metadata);

    this.hoverTooltip.innerHTML = tooltipContent;
    this.hoverTooltip.style.display = 'block';

    // Position tooltip
    this.positionTooltip(event);
  }

  /**
   * Handle cell mouse move - update tooltip position
   */
  handleCellMove(event, cell) {
    if (this.hoverTooltip.style.display === 'block') {
      this.positionTooltip(event);
    }
  }

  /**
   * Handle cell leave - hide tooltip
   */
  handleCellLeave(event, cell) {
    this.hoverTooltip.style.display = 'none';
  }

  /**
   * Position tooltip near cursor
   */
  positionTooltip(event) {
    const offset = 15;
    const tooltipRect = this.hoverTooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = event.clientX + offset;
    let top = event.clientY + offset;

    // Adjust if tooltip would go off-screen
    if (left + tooltipRect.width > viewportWidth) {
      left = event.clientX - tooltipRect.width - offset;
    }
    if (top + tooltipRect.height > viewportHeight) {
      top = event.clientY - tooltipRect.height - offset;
    }

    this.hoverTooltip.style.left = left + 'px';
    this.hoverTooltip.style.top = top + 'px';
  }

  /**
   * Build tooltip content HTML
   */
  buildTooltipContent(fieldType, metadata) {
    const tags = [];

    // Type badge
    tags.push(`<span class="eo-tooltip-tag type-${fieldType.toLowerCase()}">${fieldType.toLowerCase()}</span>`);

    // Source indicators
    if (metadata.isLinked) {
      tags.push('<span class="eo-tooltip-tag linked">linked</span>');
    }
    if (metadata.isRollup) {
      tags.push('<span class="eo-tooltip-tag rollup">rollup</span>');
    }
    if (metadata.isDerived) {
      tags.push('<span class="eo-tooltip-tag derived">derived</span>');
    }
    if (metadata.isFormula) {
      tags.push('<span class="eo-tooltip-tag formula">formula</span>');
    }

    // Add value count if superposed
    if (metadata.valueCount > 1) {
      tags.push(`<span class="eo-tooltip-tag sup">${metadata.valueCount} values</span>`);
    }

    return `
      <div class="eo-tooltip-content">
        <div class="eo-tooltip-tags">
          ${tags.join('')}
        </div>
        ${metadata.hint ? `<div class="eo-tooltip-hint">${metadata.hint}</div>` : ''}
      </div>
    `;
  }

  /**
   * Handle cell click
   */
  handleCellClick(event, cell) {
    // Don't interfere with SUP indicator clicks
    if (event.target.classList.contains('eo-sup-indicator')) {
      return;
    }

    const recordId = cell.dataset.recordId;
    const fieldName = cell.dataset.fieldName;
    const fieldType = this.config.getFieldType(fieldName);
    const metadata = this.config.getFieldMetadata(recordId, fieldName);

    // Check if clicking on a linked record pill
    const linkedPill = event.target.closest('.linked-record-pill, .eo-linked-pill');
    if (linkedPill) {
      // Get the linked record ID from the pill
      const linkedRecordId = linkedPill.dataset.recordId || linkedPill.dataset.linkedRecordId;
      if (linkedRecordId) {
        event.stopPropagation();
        this.config.onViewRecord(linkedRecordId);
        return;
      }
    }

    // If it's a linked record field and we have the editor, open the editor
    if (metadata.isLinked && this.linkedRecordEditor) {
      event.stopPropagation();
      this.linkedRecordEditor.show(cell, recordId, fieldName);
      return;
    }

    // If it's a relationship field without editor, open modal
    if (metadata.isLinked && !metadata.isEditable) {
      this.config.onViewDetails(recordId, fieldName);
      return;
    }

    // For complex derived fields, show option
    if ((metadata.isDerived || metadata.isRollup) && !metadata.isEditable) {
      this.showCellMenu(cell, recordId, fieldName);
      return;
    }
  }

  /**
   * Handle cell right-click - show cell profile card
   */
  handleCellRightClick(event, cell) {
    event.preventDefault();
    event.stopPropagation();

    const recordId = cell.dataset.recordId;
    const fieldName = cell.dataset.fieldName;

    if (!recordId || !fieldName) return;

    // Hide tooltip
    this.hoverTooltip.style.display = 'none';

    // Show cell profile card if available
    if (this.cellProfileCard) {
      this.cellProfileCard.show(cell, recordId, fieldName, {
        x: event.clientX,
        y: event.clientY
      });
    } else {
      // Fallback to cell menu if profile card not available
      this.showCellMenu(cell, recordId, fieldName);
    }
  }

  /**
   * Handle cell double-click - enter edit mode
   */
  handleCellDoubleClick(event, cell) {
    event.preventDefault();
    event.stopPropagation();

    // Don't edit SUP indicators
    if (event.target.classList.contains('eo-sup-indicator')) {
      return;
    }

    const recordId = cell.dataset.recordId;
    const fieldName = cell.dataset.fieldName;
    const metadata = this.config.getFieldMetadata(recordId, fieldName);

    // Only allow editing if field is editable
    if (metadata.isEditable !== false) {
      this.enterEditMode(cell, recordId, fieldName);
    }
  }

  /**
   * Show cell menu for complex fields
   */
  showCellMenu(cell, recordId, fieldName) {
    const menu = document.createElement('div');
    menu.className = 'eo-cell-menu';

    menu.innerHTML = `
      <div class="eo-cell-menu-item" data-action="view">View details...</div>
      <div class="eo-cell-menu-item" data-action="copy">Copy value</div>
    `;

    // Position menu
    const rect = cell.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 5) + 'px';

    // Handle menu clicks
    menu.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'view') {
        this.config.onViewDetails(recordId, fieldName);
      } else if (action === 'copy') {
        this.copyValueToClipboard(cell);
      }
      menu.remove();
    });

    // Close menu on outside click
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);

    document.body.appendChild(menu);
  }

  /**
   * Copy cell value to clipboard
   * Strips superscript numbers and SUP indicators, formats with quotes if needed
   */
  copyValueToClipboard(cell) {
    // Clone the cell to manipulate
    const clone = cell.cloneNode(true);

    // Remove superscript elements (linked superscripts)
    clone.querySelectorAll('.linked-superscript').forEach(el => el.remove());

    // Remove SUP indicators
    clone.querySelectorAll('.eo-sup-indicator').forEach(el => el.remove());

    // Get text content from remaining elements
    let text = '';

    // Check if this is a linked record or lookup container
    const linkedContainer = clone.querySelector('.linked-record-container, .lookup-array-container');
    if (linkedContainer) {
      // Extract values from pills
      const pills = linkedContainer.querySelectorAll('.linked-record-pill, .lookup-value-pill');
      const values = Array.from(pills).map(pill => {
        const val = pill.textContent.trim();
        // Quote if contains comma or quotes
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      });
      text = values.join(', ');
    } else {
      // Regular cell - just get text content
      text = clone.textContent.replace(/●\d+/, '').trim();
    }

    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  /**
   * Enter inline edit mode for a cell
   */
  enterEditMode(cell, recordId, fieldName) {
    if (this.activeEditor) {
      this.exitEditMode();
    }

    const fieldType = this.config.getFieldType(fieldName);
    const currentValue = this.getCurrentCellValue(cell);

    // Hide tooltip
    this.hoverTooltip.style.display = 'none';

    // Create input element (pass fieldName for config lookup)
    const input = this.createInputElement(fieldType, currentValue, fieldName);

    // Store original content
    const originalContent = cell.innerHTML;

    // Replace cell content with input
    cell.innerHTML = '';
    cell.appendChild(input);
    cell.classList.add('eo-cell-editing');

    // Focus input and select text
    input.focus();
    if (input.select) input.select();

    // Store active editor state
    this.activeEditor = {
      cell,
      input,
      recordId,
      fieldName,
      originalContent,
      originalValue: currentValue,
      _datetimeValue: input._datetimeValue || null
    };

    // For datetime inputs, the picker handles its own events
    const isDateTimeInput = input.classList && input.classList.contains('eo-datetime-cell-input');

    if (!isDateTimeInput) {
      // Handle save/cancel for regular inputs
      input.addEventListener('blur', () => this.exitEditMode(true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.exitEditMode(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.exitEditMode(false);
        }
      });
    }
  }

  /**
   * Get current cell value (without SUP indicator)
   */
  getCurrentCellValue(cell) {
    const clone = cell.cloneNode(true);
    const supIndicator = clone.querySelector('.eo-sup-indicator');
    if (supIndicator) {
      supIndicator.remove();
    }
    return clone.textContent.trim();
  }

  /**
   * Normalize a date value to ISO format (YYYY-MM-DD) for native date inputs.
   * Uses EODateTimeField for robust parsing if available, falls back to basic parsing.
   */
  normalizeDateToISO(value) {
    if (!value) return '';

    // Use enhanced datetime field parsing if available
    if (typeof EODateTimeField !== 'undefined') {
      const parsed = EODateTimeField.parseDateTime(value);
      if (parsed) {
        return EODateTimeField.parsedToDateString(parsed);
      }
    }

    // Fallback: Already in ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    // Try parsing with Date object
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return '';
  }

  /**
   * Get date field configuration from field metadata
   */
  getDateFieldConfig(fieldName) {
    const fieldConfig = this.config.getFieldConfig ? this.config.getFieldConfig(fieldName) : {};
    const defaults = typeof EODateTimeField !== 'undefined' ? EODateTimeField.DEFAULT_CONFIG : {};

    return {
      ...defaults,
      mode: fieldConfig.dateMode || fieldConfig.mode || 'date',
      timeFormat: fieldConfig.timeFormat || '12h_ampm',
      dateFormat: fieldConfig.dateFormat || 'MM/DD/YYYY',
      showTimezone: fieldConfig.showTimezone || false,
      timezone: fieldConfig.timezone || null,
      includeSeconds: fieldConfig.includeSeconds || false,
      ...fieldConfig
    };
  }

  /**
   * Create appropriate input element based on field type
   */
  createInputElement(fieldType, currentValue, fieldName) {
    let input;

    switch (fieldType.toLowerCase()) {
      case 'number':
      case 'currency':
        input = this.createNumberInput(fieldType, currentValue, fieldName);
        break;

      case 'date':
      case 'datetime':
      case 'time':
        // Use enhanced datetime picker if available
        if (typeof EODateTimeField !== 'undefined') {
          const config = this.getDateFieldConfig(fieldName);
          // Map field type to mode
          if (fieldType.toLowerCase() === 'datetime') {
            config.mode = 'datetime';
          } else if (fieldType.toLowerCase() === 'time') {
            config.mode = 'time';
          }
          return this.createDateTimeInput(currentValue, config);
        }
        // Fallback to native date input
        input = document.createElement('input');
        input.type = 'date';
        input.value = this.normalizeDateToISO(currentValue);
        input.className = 'eo-cell-input';
        break;

      case 'checkbox':
      case 'boolean':
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = currentValue === 'true' || currentValue === '✓';
        input.className = 'eo-cell-input';
        break;

      case 'select':
        input = document.createElement('select');
        input.className = 'eo-cell-input';
        // Options would be populated by config
        break;

      case 'textarea':
      case 'long_text':
        input = document.createElement('textarea');
        input.value = currentValue;
        input.rows = 3;
        input.className = 'eo-cell-input';
        break;

      default:
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.className = 'eo-cell-input';
    }

    return input;
  }

  /**
   * Create a number input with proper configuration
   * Uses EONumberFormatter for parsing and validation
   */
  createNumberInput(fieldType, currentValue, fieldName) {
    const input = document.createElement('input');
    input.type = 'text'; // Use text to allow formatted input
    input.inputMode = 'decimal'; // Hint for mobile keyboards
    input.className = 'eo-cell-input eo-number-input';

    // Parse the current value - it might be formatted
    if (typeof EONumberFormatter !== 'undefined') {
      const parsed = EONumberFormatter.parseNumber(currentValue);
      input.value = parsed !== null ? parsed : '';
    } else {
      // Fallback: strip non-numeric characters
      const parsed = parseFloat(String(currentValue).replace(/[^0-9.\-+eE]/g, ''));
      input.value = isNaN(parsed) ? '' : parsed;
    }

    // Get field config for constraints
    const fieldConfig = this.config.getFieldConfig ? this.config.getFieldConfig(fieldName) : null;
    const numberConfig = fieldConfig?.number || {};

    // Set step based on format
    if (numberConfig.format === 'integer') {
      input.step = '1';
    } else {
      const decimals = numberConfig.decimalPlaces !== undefined ? numberConfig.decimalPlaces : 2;
      input.step = Math.pow(10, -decimals).toString();
    }

    // Set min/max if defined
    if (numberConfig.min !== null && numberConfig.min !== undefined) {
      input.min = numberConfig.min;
    }
    if (numberConfig.max !== null && numberConfig.max !== undefined) {
      input.max = numberConfig.max;
    }

    // Add validation on input
    input.addEventListener('input', (e) => {
      this.validateNumberInput(e.target, numberConfig);
    });

    return input;
  }

  /**
   * Validate number input in real-time
   */
  validateNumberInput(input, config = {}) {
    const value = input.value.trim();

    if (!value) {
      input.classList.remove('eo-input-invalid');
      return true;
    }

    if (typeof EONumberFormatter !== 'undefined') {
      const result = EONumberFormatter.validateNumber(value, config);
      input.classList.toggle('eo-input-invalid', !result.isValid);
      return result.isValid;
    }

    // Fallback validation
    const num = parseFloat(value);
    const isValid = !isNaN(num);
    input.classList.toggle('eo-input-invalid', !isValid);
    return isValid;
  }

  /**
   * Format a number value for display based on field config
   */
  formatNumberForDisplay(value, fieldConfig) {
    if (typeof EONumberFormatter !== 'undefined' && fieldConfig?.number) {
      const result = EONumberFormatter.formatNumber(value, fieldConfig.number);
      return result.formatted;
    }

    // Fallback: basic formatting
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  }

  /**
   * Create enhanced datetime input element
   */
  createDateTimeInput(currentValue, config) {
    const editor = EODateTimeField.createDateTimeEditor(
      config,
      (value) => {
        // onChange - value updated
        if (this.activeEditor) {
          this.activeEditor._datetimeValue = value;
        }
      },
      (value) => {
        // onClose - close and save
        if (value !== null && this.activeEditor) {
          this.activeEditor._datetimeValue = value;
        }
      }
    );

    // Set initial value
    editor.setValue(currentValue);

    // Store reference for later cleanup
    const container = editor.container;
    container._datetimeEditor = editor;
    container._datetimeValue = editor.getValue();
    container.className = 'eo-cell-input eo-datetime-cell-input';

    // Create a proxy to act like an input element
    Object.defineProperty(container, 'value', {
      get: () => editor.getValue(),
      set: (v) => editor.setValue(v)
    });

    // Focus method
    container.focus = () => editor.focus();

    // Select method (no-op for datetime)
    container.select = () => editor.focus();

    return container;
  }

  /**
   * Exit edit mode and optionally save
   */
  exitEditMode(save = false) {
    if (!this.activeEditor) return;

    const { cell, input, recordId, fieldName, originalContent, originalValue } = this.activeEditor;

    let newValue = originalValue;

    if (save) {
      // Get new value - check for datetime editor first
      if (input._datetimeEditor) {
        newValue = input._datetimeEditor.getValue();
        // Cleanup datetime editor
        input._datetimeEditor.destroy();
      } else if (input.type === 'checkbox') {
        newValue = input.checked;
      } else if (input.classList.contains('eo-number-input')) {
        // Parse number value
        if (typeof EONumberFormatter !== 'undefined') {
          newValue = EONumberFormatter.parseNumber(input.value);
        } else {
          const parsed = parseFloat(input.value);
          newValue = isNaN(parsed) ? null : parsed;
        }
      } else {
        newValue = input.value;
      }

      // Only save if value changed
      if (newValue !== originalValue) {
        this.config.onEdit(recordId, fieldName, originalValue, newValue);
      }
    } else {
      // Cleanup datetime editor on cancel too
      if (input._datetimeEditor) {
        input._datetimeEditor.destroy();
      }
    }

    // Restore original content or update with new value
    if (!save) {
      cell.innerHTML = originalContent;
    }

    cell.classList.remove('eo-cell-editing');
    this.activeEditor = null;
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    if (this.hoverTooltip) {
      this.hoverTooltip.remove();
    }
    if (this.activeEditor) {
      this.exitEditMode(false);
    }
    if (this.linkedRecordEditor) {
      this.linkedRecordEditor.destroy();
    }
    if (this.cellProfileCard) {
      this.cellProfileCard.destroy();
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOInlineCellEditor;
}
