/**
 * EOInlineCellEditor
 *
 * Level 1: Inline Cell Editing
 * Provides fast, inline editing with hover states showing type badges and indicators.
 * Recognizes:
 * - primitive values → inline edit
 * - derived values (linked or rollup) → inline edit if editable
 * - relationship-driven values → open modal
 */
class EOInlineCellEditor {
  constructor() {
    this.activeEditor = null;
    this.hoverTooltip = null;
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
      getFieldType: config.getFieldType || (() => 'text'),
      getFieldMetadata: config.getFieldMetadata || (() => ({})),
      ...config
    };

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

    // If it's a relationship field, open modal
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
   */
  copyValueToClipboard(cell) {
    const text = cell.textContent.replace(/●\d+/, '').trim(); // Remove SUP indicator
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

    // Create input element
    const input = this.createInputElement(fieldType, currentValue);

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
      originalValue: currentValue
    };

    // Handle save/cancel
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
   * Create appropriate input element based on field type
   */
  createInputElement(fieldType, currentValue) {
    let input;

    switch (fieldType.toLowerCase()) {
      case 'number':
        input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue;
        input.step = 'any';
        break;

      case 'date':
        input = document.createElement('input');
        input.type = 'date';
        input.value = currentValue;
        break;

      case 'checkbox':
      case 'boolean':
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = currentValue === 'true' || currentValue === '✓';
        break;

      case 'select':
        input = document.createElement('select');
        // Options would be populated by config
        break;

      case 'textarea':
      case 'long_text':
        input = document.createElement('textarea');
        input.value = currentValue;
        input.rows = 3;
        break;

      default:
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
    }

    input.className = 'eo-cell-input';
    return input;
  }

  /**
   * Exit edit mode and optionally save
   */
  exitEditMode(save = false) {
    if (!this.activeEditor) return;

    const { cell, input, recordId, fieldName, originalContent, originalValue } = this.activeEditor;

    let newValue = originalValue;

    if (save) {
      // Get new value
      if (input.type === 'checkbox') {
        newValue = input.checked;
      } else {
        newValue = input.value;
      }

      // Only save if value changed
      if (newValue !== originalValue) {
        this.config.onEdit(recordId, fieldName, originalValue, newValue);
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
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOInlineCellEditor;
}
