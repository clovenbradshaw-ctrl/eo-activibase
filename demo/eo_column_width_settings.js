/**
 * EO Column Width Settings
 *
 * Provides column width customization features including:
 * - Fit to screen (distribute columns to fill available width)
 * - Uniform widths (minimum, average, or maximum)
 * - Content overflow modes (clip, wrap, expand, tooltip)
 * - Auto-fit to content
 * - Manual column resizing with persistence
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const COLUMN_WIDTH_MIN = 40;
    const COLUMN_WIDTH_MAX = 800;
    const COLUMN_WIDTH_DEFAULT = 150;

    // Field-type-specific width constraints (based on UX patterns from Airtable, Notion, Handsontable)
    const FIELD_WIDTH_RULES = {
        // Compact fields - just need enough for the control
        CHECKBOX: { min: 40, max: 60, default: 50 },
        BOOLEAN: { min: 40, max: 60, default: 50 },
        RATING: { min: 80, max: 150, default: 100 },

        // Numeric fields - sized for typical number display
        NUMBER: { min: 60, max: 200, default: 100 },
        CURRENCY: { min: 80, max: 200, default: 120 },
        PERCENT: { min: 60, max: 150, default: 80 },
        DURATION: { min: 80, max: 180, default: 120 },

        // Date/Time fields - sized for typical date formats
        DATE: { min: 90, max: 180, default: 120 },
        DATETIME: { min: 140, max: 220, default: 180 },
        TIME: { min: 70, max: 120, default: 90 },

        // Selection fields - sized for typical option labels
        SELECT: { min: 80, max: 300, default: 150 },
        MULTI_SELECT: { min: 100, max: 400, default: 200 },
        STATUS: { min: 80, max: 200, default: 120 },

        // Reference fields
        LINK: { min: 100, max: 400, default: 180 },
        LOOKUP: { min: 100, max: 400, default: 180 },
        ROLLUP: { min: 80, max: 300, default: 150 },

        // Rich content fields - need more space
        TEXT: { min: 80, max: 600, default: 180 },
        LONG_TEXT: { min: 120, max: 800, default: 250 },
        RICH_TEXT: { min: 150, max: 800, default: 280 },
        URL: { min: 150, max: 500, default: 220 },
        EMAIL: { min: 150, max: 400, default: 200 },
        PHONE: { min: 100, max: 200, default: 140 },

        // Special fields
        ATTACHMENT: { min: 80, max: 300, default: 150 },
        USER: { min: 100, max: 250, default: 150 },
        COLLABORATOR: { min: 100, max: 250, default: 150 },
        CREATED_TIME: { min: 140, max: 200, default: 160 },
        MODIFIED_TIME: { min: 140, max: 200, default: 160 },
        CREATED_BY: { min: 100, max: 200, default: 140 },
        MODIFIED_BY: { min: 100, max: 200, default: 140 },
        AUTONUMBER: { min: 50, max: 120, default: 70 },
        BARCODE: { min: 100, max: 250, default: 150 },

        // Formula fields inherit based on output type, default to text
        FORMULA: { min: 80, max: 400, default: 150 },

        // JSON/object fields need more space
        JSON: { min: 150, max: 800, default: 300 },
        OBJECT: { min: 150, max: 800, default: 300 }
    };

    /**
     * Get width constraints for a field based on its type
     * @param {Object} field - The field definition
     * @returns {Object} - { min, max, default }
     */
    function getFieldWidthRules(field) {
        if (!field) return { min: COLUMN_WIDTH_MIN, max: COLUMN_WIDTH_MAX, default: COLUMN_WIDTH_DEFAULT };

        const fieldType = (field.type || 'TEXT').toUpperCase();
        const rules = FIELD_WIDTH_RULES[fieldType];

        if (rules) {
            return rules;
        }

        // Default fallback
        return { min: COLUMN_WIDTH_MIN, max: COLUMN_WIDTH_MAX, default: COLUMN_WIDTH_DEFAULT };
    }

    /**
     * Validate and clamp a width value based on field type
     * @param {number} width - The proposed width
     * @param {Object} field - The field definition
     * @returns {number} - Clamped width
     */
    function validateColumnWidth(width, field) {
        const rules = getFieldWidthRules(field);
        return Math.max(rules.min, Math.min(rules.max, width));
    }

    /**
     * Get the recommended default width for a field
     * @param {Object} field - The field definition
     * @returns {number} - Default width for this field type
     */
    function getDefaultWidthForField(field) {
        const rules = getFieldWidthRules(field);
        return rules.default;
    }

    const WIDTH_MODES = {
        AUTO: 'auto',
        FIT_TO_SCREEN: 'fit-to-screen',
        UNIFORM_MIN: 'uniform-min',
        UNIFORM_AVG: 'uniform-avg',
        UNIFORM_MAX: 'uniform-max',
        CUSTOM: 'custom'
    };

    const OVERFLOW_MODES = {
        CLIP: 'clip',
        WRAP: 'wrap',
        EXPAND: 'expand',
        TOOLTIP: 'tooltip'
    };

    // ============================================================================
    // COLUMN WIDTH CALCULATIONS
    // ============================================================================

    /**
     * Calculate the natural content width for a column
     * @param {Object} state - Application state
     * @param {string} setId - Set ID
     * @param {string} fieldId - Field ID
     * @returns {number} - Width in pixels
     */
    function calculateContentWidth(state, setId, fieldId) {
        const set = state.sets.get(setId);
        if (!set) return COLUMN_WIDTH_DEFAULT;

        const field = set.schema.find(f => f.id === fieldId);
        if (!field) return getDefaultWidthForField(field);

        const rules = getFieldWidthRules(field);

        // Get all values for this field
        const values = Array.from(set.records.values())
            .map(r => r[fieldId])
            .filter(v => v !== null && v !== undefined && v !== '');

        if (values.length === 0) return rules.default;

        // Create temporary element to measure text width
        const measureEl = document.createElement('span');
        measureEl.style.cssText = 'visibility: hidden; position: absolute; white-space: nowrap; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
        document.body.appendChild(measureEl);

        let maxWidth = 0;
        values.forEach(value => {
            const displayValue = formatValueForMeasurement(value, field);
            measureEl.textContent = displayValue;
            maxWidth = Math.max(maxWidth, measureEl.offsetWidth);
        });

        // Also measure header
        measureEl.textContent = field.name;
        measureEl.style.fontWeight = '600';
        maxWidth = Math.max(maxWidth, measureEl.offsetWidth);

        document.body.removeChild(measureEl);

        // Add padding and apply field-type-aware constraints
        return validateColumnWidth(maxWidth + 32, field);
    }

    /**
     * Format a value for width measurement
     */
    function formatValueForMeasurement(value, field) {
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }

    /**
     * Calculate fit-to-screen column widths
     * @param {Object} state - Application state
     * @param {Object} view - Current view
     * @param {Object} set - Current set
     * @param {number} availableWidth - Available container width
     * @returns {Object} - Map of fieldId to width
     */
    function calculateFitToScreenWidths(state, view, set, availableWidth) {
        const schema = getVisibleSchema(view, set);
        if (schema.length === 0) return {};

        // Subtract fixed columns (checkbox, row numbers, hidden fields indicator)
        const fixedWidth = 50 + (view.showRowNumbers ? 50 : 0) + 60;
        const distributedWidth = Math.max(0, availableWidth - fixedWidth - 20); // 20px buffer

        const widthPerColumn = Math.floor(distributedWidth / schema.length);

        const widths = {};
        schema.forEach(field => {
            // Apply field-type-aware constraints to each column
            widths[field.id] = validateColumnWidth(widthPerColumn, field);
        });

        return widths;
    }

    /**
     * Calculate uniform column widths based on mode
     * @param {Object} state - Application state
     * @param {Object} view - Current view
     * @param {Object} set - Current set
     * @param {string} mode - 'min', 'avg', or 'max'
     * @returns {Object} - Map of fieldId to width
     */
    function calculateUniformWidths(state, view, set, mode) {
        const schema = getVisibleSchema(view, set);
        if (schema.length === 0) return {};

        // Calculate content widths for all columns
        const contentWidths = schema.map(field =>
            calculateContentWidth(state, set.id, field.id)
        );

        let uniformWidth;
        switch (mode) {
            case 'min':
                uniformWidth = Math.min(...contentWidths);
                break;
            case 'max':
                uniformWidth = Math.max(...contentWidths);
                break;
            case 'avg':
            default:
                uniformWidth = Math.round(contentWidths.reduce((a, b) => a + b, 0) / contentWidths.length);
                break;
        }

        uniformWidth = Math.max(COLUMN_WIDTH_MIN, Math.min(COLUMN_WIDTH_MAX, uniformWidth));

        const widths = {};
        schema.forEach(field => {
            widths[field.id] = uniformWidth;
        });

        return widths;
    }

    /**
     * Auto-fit a single column to its content
     */
    function autoFitColumn(state, setId, fieldId) {
        return calculateContentWidth(state, setId, fieldId);
    }

    /**
     * Auto-fit all columns to their content
     */
    function autoFitAllColumns(state, view, set) {
        const schema = getVisibleSchema(view, set);
        const widths = {};
        schema.forEach(field => {
            widths[field.id] = calculateContentWidth(state, set.id, field.id);
        });
        return widths;
    }

    /**
     * Get visible schema fields based on view configuration
     */
    function getVisibleSchema(view, set) {
        if (!set?.schema) return [];

        let schema = set.schema;

        // Filter by visible fields if specified
        if (view?.visibleFieldIds?.length > 0) {
            schema = schema.filter(f => view.visibleFieldIds.includes(f.id));
        }

        // Exclude hidden fields
        if (view?.hiddenFields?.length > 0) {
            schema = schema.filter(f => !view.hiddenFields.includes(f.id));
        }

        // Apply column order if specified
        if (view?.columnOrder?.length > 0) {
            const orderMap = new Map(view.columnOrder.map((id, i) => [id, i]));
            schema = [...schema].sort((a, b) => {
                const aOrder = orderMap.get(a.id) ?? Infinity;
                const bOrder = orderMap.get(b.id) ?? Infinity;
                return aOrder - bOrder;
            });
        }

        return schema;
    }

    // ============================================================================
    // VIEW WIDTH SETTINGS
    // ============================================================================

    /**
     * Apply column width mode to a view
     */
    function applyColumnWidthMode(state, viewId, mode, options = {}) {
        const view = state.views?.get(viewId);
        if (!view) return;

        const set = state.sets.get(view.setId);
        if (!set) return;

        view.columnWidthMode = mode;
        view.isDirty = true;

        let newWidths = {};

        switch (mode) {
            case WIDTH_MODES.FIT_TO_SCREEN:
                const container = document.querySelector('.table-scroll');
                const availableWidth = container?.clientWidth || 1200;
                newWidths = calculateFitToScreenWidths(state, view, set, availableWidth);
                break;

            case WIDTH_MODES.UNIFORM_MIN:
                newWidths = calculateUniformWidths(state, view, set, 'min');
                break;

            case WIDTH_MODES.UNIFORM_AVG:
                newWidths = calculateUniformWidths(state, view, set, 'avg');
                break;

            case WIDTH_MODES.UNIFORM_MAX:
                newWidths = calculateUniformWidths(state, view, set, 'max');
                break;

            case WIDTH_MODES.AUTO:
                newWidths = autoFitAllColumns(state, view, set);
                break;

            case WIDTH_MODES.CUSTOM:
                // Keep existing custom widths
                newWidths = view.columnWidths || {};
                break;
        }

        view.columnWidths = newWidths;

        // Apply widths to DOM
        applyColumnWidthsToDOM(view, set);

        // Trigger re-render if callback provided
        if (options.onApply) {
            options.onApply(view);
        }

        return newWidths;
    }

    /**
     * Set content overflow mode for a view
     */
    function setContentOverflowMode(state, viewId, mode) {
        const view = state.views?.get(viewId);
        if (!view) return;

        view.contentOverflow = mode;
        view.isDirty = true;

        // Apply overflow styles to DOM
        applyContentOverflowToDOM(view);
    }

    /**
     * Set individual column width
     */
    function setColumnWidth(state, viewId, fieldId, width) {
        const view = state.views?.get(viewId);
        if (!view) return;

        const set = state.sets.get(view.setId);
        const field = set?.schema?.find(f => f.id === fieldId);

        if (!view.columnWidths) {
            view.columnWidths = {};
        }

        // Apply field-type-aware constraints
        const clampedWidth = validateColumnWidth(width, field);
        view.columnWidths[fieldId] = clampedWidth;
        view.columnWidthMode = WIDTH_MODES.CUSTOM;
        view.isDirty = true;

        // Apply to DOM
        document.querySelectorAll(`[data-field-id="${fieldId}"]`).forEach(el => {
            el.style.width = `${clampedWidth}px`;
        });
    }

    /**
     * Get column width for a field
     */
    function getColumnWidth(view, field) {
        // Check view-level column widths first
        if (view?.columnWidths?.[field.id]) {
            return view.columnWidths[field.id];
        }

        // Check field-level width
        if (field?.width) {
            const parsed = parseInt(field.width, 10);
            if (!isNaN(parsed)) return parsed;
        }

        // Return field-type-aware default or global default
        return getDefaultWidthForField(field);
    }

    // ============================================================================
    // DOM MANIPULATION
    // ============================================================================

    /**
     * Apply column widths from view config to DOM
     */
    function applyColumnWidthsToDOM(view, set) {
        const schema = getVisibleSchema(view, set);

        schema.forEach(field => {
            const width = getColumnWidth(view, field);
            document.querySelectorAll(`[data-field-id="${field.id}"]`).forEach(el => {
                el.style.width = `${width}px`;
            });
        });

        // Update table min-width
        const table = document.getElementById('dataTable');
        if (table) {
            const totalWidth = schema.reduce((sum, field) => sum + getColumnWidth(view, field), 0);
            table.style.minWidth = `${Math.max(totalWidth + 150, 600)}px`;
        }
    }

    /**
     * Apply content overflow styles to DOM
     */
    function applyContentOverflowToDOM(view) {
        const mode = view?.contentOverflow || OVERFLOW_MODES.CLIP;
        const table = document.getElementById('dataTable');
        if (!table) return;

        // Remove existing overflow classes
        table.classList.remove('overflow-clip', 'overflow-wrap', 'overflow-expand', 'overflow-tooltip');

        // Add new class
        table.classList.add(`overflow-${mode}`);

        // Apply specific styles
        const cells = table.querySelectorAll('td.cell-editable');
        cells.forEach(cell => {
            switch (mode) {
                case OVERFLOW_MODES.CLIP:
                    cell.style.whiteSpace = 'nowrap';
                    cell.style.overflow = 'hidden';
                    cell.style.textOverflow = 'ellipsis';
                    cell.style.maxHeight = null;
                    break;

                case OVERFLOW_MODES.WRAP:
                    cell.style.whiteSpace = 'normal';
                    cell.style.overflow = 'visible';
                    cell.style.textOverflow = 'clip';
                    cell.style.maxHeight = view.cellMaxHeight ? `${view.cellMaxHeight}px` : null;
                    break;

                case OVERFLOW_MODES.EXPAND:
                    cell.style.whiteSpace = 'normal';
                    cell.style.overflow = 'visible';
                    cell.style.textOverflow = 'clip';
                    cell.style.maxHeight = null;
                    break;

                case OVERFLOW_MODES.TOOLTIP:
                    cell.style.whiteSpace = 'nowrap';
                    cell.style.overflow = 'hidden';
                    cell.style.textOverflow = 'ellipsis';
                    cell.style.maxHeight = null;
                    // Tooltip is handled by title attribute
                    const content = cell.textContent;
                    if (content && cell.scrollWidth > cell.clientWidth) {
                        cell.title = content;
                    }
                    break;
            }
        });
    }

    // ============================================================================
    // UI COMPONENTS
    // ============================================================================

    /**
     * Render column width settings toolbar
     */
    function renderColumnWidthToolbar(view) {
        const currentMode = view?.columnWidthMode || WIDTH_MODES.AUTO;
        const currentOverflow = view?.contentOverflow || OVERFLOW_MODES.CLIP;

        return `
            <div class="column-width-toolbar">
                <div class="toolbar-section">
                    <span class="toolbar-label">Column Widths:</span>
                    <div class="toolbar-btn-group">
                        <button class="toolbar-btn ${currentMode === WIDTH_MODES.AUTO ? 'active' : ''}"
                                data-width-mode="${WIDTH_MODES.AUTO}" title="Auto-fit to content">
                            <i class="ph ph-text-columns"></i>
                            Auto
                        </button>
                        <button class="toolbar-btn ${currentMode === WIDTH_MODES.FIT_TO_SCREEN ? 'active' : ''}"
                                data-width-mode="${WIDTH_MODES.FIT_TO_SCREEN}" title="Fit columns to screen">
                            <i class="ph ph-arrows-out-line-horizontal"></i>
                            Fit Screen
                        </button>
                        <button class="toolbar-btn dropdown-trigger" title="Uniform width options">
                            <i class="ph ph-equals"></i>
                            Uniform
                            <i class="ph ph-caret-down" style="font-size: 10px;"></i>
                        </button>
                    </div>
                </div>
                <div class="toolbar-divider"></div>
                <div class="toolbar-section">
                    <span class="toolbar-label">Overflow:</span>
                    <div class="toolbar-btn-group">
                        <button class="toolbar-btn ${currentOverflow === OVERFLOW_MODES.CLIP ? 'active' : ''}"
                                data-overflow-mode="${OVERFLOW_MODES.CLIP}" title="Clip content with ellipsis">
                            <i class="ph ph-dots-three"></i>
                            Clip
                        </button>
                        <button class="toolbar-btn ${currentOverflow === OVERFLOW_MODES.WRAP ? 'active' : ''}"
                                data-overflow-mode="${OVERFLOW_MODES.WRAP}" title="Wrap text to multiple lines">
                            <i class="ph ph-text-align-left"></i>
                            Wrap
                        </button>
                        <button class="toolbar-btn ${currentOverflow === OVERFLOW_MODES.EXPAND ? 'active' : ''}"
                                data-overflow-mode="${OVERFLOW_MODES.EXPAND}" title="Expand cell to show all content">
                            <i class="ph ph-arrows-out-simple"></i>
                            Expand
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show column width settings modal
     */
    function showColumnWidthSettingsModal(state, viewId) {
        const view = state.views?.get(viewId);
        const set = state.sets.get(view?.setId);
        if (!view || !set) return;

        const schema = getVisibleSchema(view, set);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'columnWidthSettingsModal';
        modal.innerHTML = `
            <div class="modal column-width-modal">
                <div class="modal-header">
                    <h2>Column Width Settings</h2>
                    <button class="modal-close" onclick="ColumnWidthSettings.closeModal()">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="column-width-modes">
                        <h3>Width Mode</h3>
                        <div class="mode-options">
                            <label class="mode-option ${view.columnWidthMode === WIDTH_MODES.AUTO ? 'selected' : ''}">
                                <input type="radio" name="widthMode" value="${WIDTH_MODES.AUTO}"
                                       ${view.columnWidthMode === WIDTH_MODES.AUTO ? 'checked' : ''}>
                                <div class="mode-info">
                                    <div class="mode-title"><i class="ph ph-text-columns"></i> Auto-fit Content</div>
                                    <div class="mode-desc">Each column sized to fit its content</div>
                                </div>
                            </label>
                            <label class="mode-option ${view.columnWidthMode === WIDTH_MODES.FIT_TO_SCREEN ? 'selected' : ''}">
                                <input type="radio" name="widthMode" value="${WIDTH_MODES.FIT_TO_SCREEN}"
                                       ${view.columnWidthMode === WIDTH_MODES.FIT_TO_SCREEN ? 'checked' : ''}>
                                <div class="mode-info">
                                    <div class="mode-title"><i class="ph ph-arrows-out-line-horizontal"></i> Fit to Screen</div>
                                    <div class="mode-desc">Columns distributed to fill available width</div>
                                </div>
                            </label>
                            <label class="mode-option ${view.columnWidthMode === WIDTH_MODES.UNIFORM_MIN ? 'selected' : ''}">
                                <input type="radio" name="widthMode" value="${WIDTH_MODES.UNIFORM_MIN}"
                                       ${view.columnWidthMode === WIDTH_MODES.UNIFORM_MIN ? 'checked' : ''}>
                                <div class="mode-info">
                                    <div class="mode-title"><i class="ph ph-equals"></i> Uniform (Minimum)</div>
                                    <div class="mode-desc">All columns set to smallest content width</div>
                                </div>
                            </label>
                            <label class="mode-option ${view.columnWidthMode === WIDTH_MODES.UNIFORM_AVG ? 'selected' : ''}">
                                <input type="radio" name="widthMode" value="${WIDTH_MODES.UNIFORM_AVG}"
                                       ${view.columnWidthMode === WIDTH_MODES.UNIFORM_AVG ? 'checked' : ''}>
                                <div class="mode-info">
                                    <div class="mode-title"><i class="ph ph-equals"></i> Uniform (Average)</div>
                                    <div class="mode-desc">All columns set to average content width</div>
                                </div>
                            </label>
                            <label class="mode-option ${view.columnWidthMode === WIDTH_MODES.UNIFORM_MAX ? 'selected' : ''}">
                                <input type="radio" name="widthMode" value="${WIDTH_MODES.UNIFORM_MAX}"
                                       ${view.columnWidthMode === WIDTH_MODES.UNIFORM_MAX ? 'checked' : ''}>
                                <div class="mode-info">
                                    <div class="mode-title"><i class="ph ph-equals"></i> Uniform (Maximum)</div>
                                    <div class="mode-desc">All columns set to largest content width</div>
                                </div>
                            </label>
                            <label class="mode-option ${view.columnWidthMode === WIDTH_MODES.CUSTOM ? 'selected' : ''}">
                                <input type="radio" name="widthMode" value="${WIDTH_MODES.CUSTOM}"
                                       ${view.columnWidthMode === WIDTH_MODES.CUSTOM ? 'checked' : ''}>
                                <div class="mode-info">
                                    <div class="mode-title"><i class="ph ph-sliders"></i> Custom</div>
                                    <div class="mode-desc">Set individual column widths manually</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="column-width-overflow">
                        <h3>Content Overflow</h3>
                        <div class="overflow-options">
                            <label class="overflow-option ${view.contentOverflow === OVERFLOW_MODES.CLIP ? 'selected' : ''}">
                                <input type="radio" name="overflowMode" value="${OVERFLOW_MODES.CLIP}"
                                       ${view.contentOverflow === OVERFLOW_MODES.CLIP ? 'checked' : ''}>
                                <div class="overflow-info">
                                    <div class="overflow-title"><i class="ph ph-dots-three"></i> Clip</div>
                                    <div class="overflow-desc">Truncate with ellipsis (like Google Sheets default)</div>
                                </div>
                            </label>
                            <label class="overflow-option ${view.contentOverflow === OVERFLOW_MODES.WRAP ? 'selected' : ''}">
                                <input type="radio" name="overflowMode" value="${OVERFLOW_MODES.WRAP}"
                                       ${view.contentOverflow === OVERFLOW_MODES.WRAP ? 'checked' : ''}>
                                <div class="overflow-info">
                                    <div class="overflow-title"><i class="ph ph-text-align-left"></i> Wrap</div>
                                    <div class="overflow-desc">Wrap text to multiple lines within column</div>
                                </div>
                            </label>
                            <label class="overflow-option ${view.contentOverflow === OVERFLOW_MODES.EXPAND ? 'selected' : ''}">
                                <input type="radio" name="overflowMode" value="${OVERFLOW_MODES.EXPAND}"
                                       ${view.contentOverflow === OVERFLOW_MODES.EXPAND ? 'checked' : ''}>
                                <div class="overflow-info">
                                    <div class="overflow-title"><i class="ph ph-arrows-out-simple"></i> Expand</div>
                                    <div class="overflow-desc">Rows expand to show full content</div>
                                </div>
                            </label>
                            <label class="overflow-option ${view.contentOverflow === OVERFLOW_MODES.TOOLTIP ? 'selected' : ''}">
                                <input type="radio" name="overflowMode" value="${OVERFLOW_MODES.TOOLTIP}"
                                       ${view.contentOverflow === OVERFLOW_MODES.TOOLTIP ? 'checked' : ''}>
                                <div class="overflow-info">
                                    <div class="overflow-title"><i class="ph ph-chat-circle-text"></i> Tooltip</div>
                                    <div class="overflow-desc">Show full content on hover</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="column-width-custom" id="customWidthsSection" style="display: ${view.columnWidthMode === WIDTH_MODES.CUSTOM ? 'block' : 'none'}">
                        <h3>Individual Column Widths</h3>
                        <div class="custom-widths-list">
                            ${schema.map(field => {
                                const rules = getFieldWidthRules(field);
                                return `
                                <div class="custom-width-item">
                                    <div class="field-info">
                                        <span class="field-name">${escapeHtml(field.name)}</span>
                                        <span class="field-type-hint">${field.type || 'Text'} · ${rules.min}-${rules.max}px</span>
                                    </div>
                                    <div class="width-controls">
                                        <input type="range"
                                               class="width-slider"
                                               data-field-id="${field.id}"
                                               data-field-type="${field.type || 'TEXT'}"
                                               min="${rules.min}"
                                               max="${rules.max}"
                                               value="${getColumnWidth(view, field)}">
                                        <input type="number"
                                               class="width-input"
                                               data-field-id="${field.id}"
                                               data-field-type="${field.type || 'TEXT'}"
                                               min="${rules.min}"
                                               max="${rules.max}"
                                               value="${getColumnWidth(view, field)}">
                                        <span class="width-unit">px</span>
                                        <button class="btn-auto-fit"
                                                data-field-id="${field.id}"
                                                title="Auto-fit to content">
                                            <i class="ph ph-arrows-in-line-horizontal"></i>
                                        </button>
                                    </div>
                                </div>
                            `}).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="ColumnWidthSettings.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="ColumnWidthSettings.saveSettings()">Apply</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Store reference for later
        modal._state = state;
        modal._viewId = viewId;

        // Wire up event listeners
        wireModalEvents(modal, state, viewId, set);

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    /**
     * Wire up modal event listeners
     */
    function wireModalEvents(modal, state, viewId, set) {
        // Width mode radio buttons
        modal.querySelectorAll('input[name="widthMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                modal.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('selected'));
                e.target.closest('.mode-option').classList.add('selected');

                // Show/hide custom widths section
                const customSection = modal.querySelector('#customWidthsSection');
                if (customSection) {
                    customSection.style.display = e.target.value === WIDTH_MODES.CUSTOM ? 'block' : 'none';
                }
            });
        });

        // Overflow mode radio buttons
        modal.querySelectorAll('input[name="overflowMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                modal.querySelectorAll('.overflow-option').forEach(opt => opt.classList.remove('selected'));
                e.target.closest('.overflow-option').classList.add('selected');
            });
        });

        // Width sliders
        modal.querySelectorAll('.width-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const fieldId = e.target.dataset.fieldId;
                const value = parseInt(e.target.value, 10);
                const input = modal.querySelector(`.width-input[data-field-id="${fieldId}"]`);
                if (input) input.value = value;
            });
        });

        // Width inputs
        modal.querySelectorAll('.width-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const fieldId = e.target.dataset.fieldId;
                let value = parseInt(e.target.value, 10);
                value = Math.max(COLUMN_WIDTH_MIN, Math.min(COLUMN_WIDTH_MAX, value || COLUMN_WIDTH_DEFAULT));
                const slider = modal.querySelector(`.width-slider[data-field-id="${fieldId}"]`);
                if (slider) slider.value = value;
            });
        });

        // Auto-fit buttons
        modal.querySelectorAll('.btn-auto-fit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldId = e.currentTarget.dataset.fieldId;
                const width = calculateContentWidth(state, set.id, fieldId);
                const slider = modal.querySelector(`.width-slider[data-field-id="${fieldId}"]`);
                const input = modal.querySelector(`.width-input[data-field-id="${fieldId}"]`);
                if (slider) slider.value = width;
                if (input) input.value = width;
            });
        });
    }

    /**
     * Save settings from modal
     */
    function saveSettings() {
        const modal = document.getElementById('columnWidthSettingsModal');
        if (!modal) return;

        const state = modal._state;
        const viewId = modal._viewId;
        const view = state.views?.get(viewId);
        if (!view) return;

        // Get selected width mode
        const widthMode = modal.querySelector('input[name="widthMode"]:checked')?.value || WIDTH_MODES.AUTO;

        // Get selected overflow mode
        const overflowMode = modal.querySelector('input[name="overflowMode"]:checked')?.value || OVERFLOW_MODES.CLIP;

        // Apply overflow mode
        setContentOverflowMode(state, viewId, overflowMode);

        // Apply width mode
        if (widthMode === WIDTH_MODES.CUSTOM) {
            // Collect custom widths
            const customWidths = {};
            modal.querySelectorAll('.width-input').forEach(input => {
                const fieldId = input.dataset.fieldId;
                customWidths[fieldId] = parseInt(input.value, 10);
            });
            view.columnWidths = customWidths;
            view.columnWidthMode = WIDTH_MODES.CUSTOM;

            const set = state.sets.get(view.setId);
            if (set) applyColumnWidthsToDOM(view, set);
        } else {
            applyColumnWidthMode(state, viewId, widthMode);
        }

        // Close modal
        closeModal();

        // Re-render view
        if (typeof renderCurrentView === 'function') {
            renderCurrentView();
        }
    }

    /**
     * Close the settings modal
     */
    function closeModal() {
        const modal = document.getElementById('columnWidthSettingsModal');
        if (modal) modal.remove();
    }

    /**
     * Show uniform width submenu
     */
    function showUniformWidthMenu(button, state, viewId) {
        const existingMenu = document.querySelector('.uniform-width-menu');
        if (existingMenu) existingMenu.remove();

        const rect = button.getBoundingClientRect();
        const menu = document.createElement('div');
        menu.className = 'context-menu uniform-width-menu';
        menu.style.cssText = `position: fixed; top: ${rect.bottom + 4}px; left: ${rect.left}px; z-index: 1000;`;
        menu.innerHTML = `
            <div class="context-menu-item" data-mode="${WIDTH_MODES.UNIFORM_MIN}">
                <i class="ph ph-arrow-line-left"></i>
                <span>Minimum Width</span>
            </div>
            <div class="context-menu-item" data-mode="${WIDTH_MODES.UNIFORM_AVG}">
                <i class="ph ph-equals"></i>
                <span>Average Width</span>
            </div>
            <div class="context-menu-item" data-mode="${WIDTH_MODES.UNIFORM_MAX}">
                <i class="ph ph-arrow-line-right"></i>
                <span>Maximum Width</span>
            </div>
        `;

        document.body.appendChild(menu);

        // Close on click outside - define handler first for proper cleanup
        const closeMenuHandler = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenuHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenuHandler), 0);

        // Handle menu item clicks with proper listener cleanup
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                document.removeEventListener('click', closeMenuHandler);
                applyColumnWidthMode(state, viewId, item.dataset.mode, {
                    onApply: () => {
                        if (typeof renderCurrentView === 'function') {
                            renderCurrentView();
                        }
                    }
                });
                menu.remove();
            });
        });
    }

    /**
     * Add column width option to column context menu
     */
    function addToColumnMenu(menuItems, state, viewId, fieldId) {
        menuItems.push({
            label: 'Auto-fit Width',
            icon: 'ph-arrows-in-line-horizontal',
            action: () => {
                const view = state.views?.get(viewId);
                const set = state.sets.get(view?.setId);
                if (!view || !set) return;

                const width = calculateContentWidth(state, set.id, fieldId);
                setColumnWidth(state, viewId, fieldId, width);

                if (typeof renderCurrentView === 'function') {
                    renderCurrentView();
                }
            }
        });

        return menuItems;
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const ColumnWidthSettings = {
        // Constants
        WIDTH_MODES,
        OVERFLOW_MODES,
        COLUMN_WIDTH_MIN,
        COLUMN_WIDTH_MAX,
        COLUMN_WIDTH_DEFAULT,
        FIELD_WIDTH_RULES,

        // Field-type-aware width functions
        getFieldWidthRules,
        validateColumnWidth,
        getDefaultWidthForField,

        // Calculation functions
        calculateContentWidth,
        calculateFitToScreenWidths,
        calculateUniformWidths,
        autoFitColumn,
        autoFitAllColumns,

        // Settings functions
        applyColumnWidthMode,
        setContentOverflowMode,
        setColumnWidth,
        getColumnWidth,

        // DOM functions
        applyColumnWidthsToDOM,
        applyContentOverflowToDOM,

        // UI functions
        renderColumnWidthToolbar,
        showColumnWidthSettingsModal,
        showUniformWidthMenu,
        addToColumnMenu,
        saveSettings,
        closeModal
    };

    global.ColumnWidthSettings = ColumnWidthSettings;

})(typeof window !== 'undefined' ? window : global);
