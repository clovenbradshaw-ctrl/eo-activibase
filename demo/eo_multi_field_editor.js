/**
 * EO Multi-Field Editor
 *
 * Modal for editing MULTI_FIELD values.
 * Allows users to:
 * - Input values field-by-field with type-appropriate inputs
 * - Paste text and have it auto-parsed into sub-fields
 * - View and edit existing multi-field data
 * - Copy JSON format for data entry
 *
 * The editor supports typed sub-fields (TEXT, NUMBER, EMAIL, URL, DATE, etc.)
 * and two input modes:
 * - Field-by-field: Individual typed inputs for each sub-field
 * - Paste mode: Paste text that gets parsed based on field config
 */

class EOMultiFieldEditor {
    constructor() {
        this.modal = null;
        this.fieldSchema = null;
        this.currentValue = null;
        this.recordId = null;
        this.onSave = null;
        this.inputMode = 'fields'; // 'fields' or 'paste'
    }

    // Sub-field type info for rendering
    static SUB_FIELD_TYPES = {
        'TEXT': { inputType: 'text', placeholder: 'Enter text...', icon: 'ph-text-aa', color: '#3b82f6' },
        'NUMBER': { inputType: 'number', placeholder: '0', icon: 'ph-hash', color: '#10b981' },
        'EMAIL': { inputType: 'email', placeholder: 'email@example.com', icon: 'ph-envelope', color: '#6366f1' },
        'URL': { inputType: 'url', placeholder: 'https://example.com', icon: 'ph-link', color: '#8b5cf6' },
        'DATE': { inputType: 'date', placeholder: 'YYYY-MM-DD', icon: 'ph-calendar', color: '#f97316' },
        'CHECKBOX': { inputType: 'checkbox', placeholder: '', icon: 'ph-check-square', color: '#14b8a6' },
        'CURRENCY': { inputType: 'number', placeholder: '0.00', icon: 'ph-currency-dollar', color: '#f59e0b', step: '0.01' },
        'LONG_TEXT': { inputType: 'textarea', placeholder: 'Enter text...', icon: 'ph-article', color: '#0ea5e9' }
    };

    /**
     * Show the editor for a multi-field value
     * @param {Object} options - Editor options
     * @param {Object} options.fieldSchema - The field schema with config
     * @param {Object} options.currentValue - Current value (object with sub-field values)
     * @param {string} options.recordId - The record ID being edited
     * @param {Function} options.onSave - Callback when value is saved: (newValue) => void
     */
    show(options) {
        this.fieldSchema = options.fieldSchema;
        this.currentValue = options.currentValue ? { ...options.currentValue } : {};
        this.recordId = options.recordId;
        this.onSave = options.onSave;
        this.inputMode = 'fields';

        this.render();
        this.attachEventListeners();
    }

    /**
     * Get the sub-fields configuration
     */
    getSubFields() {
        return this.fieldSchema?.config?.subFields || [];
    }

    /**
     * Get the parse mode
     */
    getParseMode() {
        return this.fieldSchema?.config?.parseMode || 'json';
    }

    /**
     * Get sub-field type info
     */
    getTypeInfo(type) {
        return EOMultiFieldEditor.SUB_FIELD_TYPES[type] || EOMultiFieldEditor.SUB_FIELD_TYPES['TEXT'];
    }

    /**
     * Render the editor modal
     */
    render() {
        const subFields = this.getSubFields();
        const multiFieldColor = window.EOFieldTypeUtils?.getFieldTypeColor('MULTI_FIELD')
            || window.EO_CONSTANTS?.FIELD_TYPE_COLORS?.['MULTI_FIELD']
            || '#059669';
        const multiFieldIcon = window.EOFieldTypeUtils?.getFieldTypeIcon('MULTI_FIELD')
            || window.EO_CONSTANTS?.FIELD_TYPE_ICONS?.['MULTI_FIELD']
            || 'ph-stack';

        const modalHTML = `
            <div class="eo-multi-field-editor-overlay" id="eoMultiFieldEditor">
                <div class="eo-multi-field-editor">
                    <div class="eo-multi-field-editor-header">
                        <div class="header-info">
                            <h3 class="editor-title" style="display: flex; align-items: center; gap: 8px;">
                                <span style="background-color: ${multiFieldColor}20; color: ${multiFieldColor}; padding: 4px; border-radius: 4px; display: inline-flex;">
                                    <i class="ph ${multiFieldIcon}" style="font-size: 14px;"></i>
                                </span>
                                ${this.escapeHtml(this.fieldSchema.name)}
                            </h3>
                        </div>
                        <button class="eo-editor-close" id="eoMultiFieldEditorClose">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>

                    <div class="eo-multi-field-editor-tabs">
                        <button class="editor-tab ${this.inputMode === 'fields' ? 'active' : ''}" data-mode="fields">
                            <i class="ph ph-textbox"></i> Field by Field
                        </button>
                        <button class="editor-tab ${this.inputMode === 'paste' ? 'active' : ''}" data-mode="paste">
                            <i class="ph ph-clipboard-text"></i> Paste Text
                        </button>
                    </div>

                    <div class="eo-multi-field-editor-body">
                        <!-- Field-by-field mode -->
                        <div class="editor-mode-content" id="fieldsMode" ${this.inputMode !== 'fields' ? 'style="display:none"' : ''}>
                            <div class="sub-field-inputs">
                                ${subFields.map(sf => this.renderSubFieldInput(sf)).join('')}
                            </div>
                        </div>

                        <!-- Paste mode -->
                        <div class="editor-mode-content" id="pasteMode" ${this.inputMode !== 'paste' ? 'style="display:none"' : ''}>
                            <div class="paste-instructions">
                                <p>Paste your text below. It will be parsed ${this.getParseMode() === 'lines' ? 'line by line' : 'as JSON'}.</p>
                                ${this.renderParseHint()}
                            </div>
                            <textarea id="pasteTextarea"
                                      class="paste-textarea"
                                      placeholder="${this.getPastePlaceholder()}"
                                      rows="8"></textarea>
                            <button class="btn btn-secondary" id="btnParseText">
                                <i class="ph ph-magic-wand"></i> Parse & Fill Fields
                            </button>
                        </div>

                        <!-- JSON Format Section (Always visible) -->
                        <div class="json-format-panel">
                            <div class="json-format-header">
                                <span><i class="ph ph-code" style="margin-right: 6px;"></i>JSON Format</span>
                                <button class="btn-copy-json" id="btnCopyJsonFormat" title="Copy JSON format to clipboard">
                                    <i class="ph ph-copy"></i> Copy Format
                                </button>
                            </div>
                            <pre class="json-format-code" id="jsonFormatDisplay">${this.escapeHtml(this.getJsonFormatExample())}</pre>
                            <p class="json-format-hint">Use this JSON structure when pasting data into this field</p>
                        </div>
                    </div>

                    <div class="eo-multi-field-editor-footer">
                        <button class="btn btn-text" id="btnClearAll">Clear All</button>
                        <div class="footer-actions">
                            <button class="btn btn-secondary" id="eoMultiFieldEditorCancel">Cancel</button>
                            <button class="btn btn-primary" id="eoMultiFieldEditorSave">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('eoMultiFieldEditor');
    }

    /**
     * Render a single sub-field input based on its type
     */
    renderSubFieldInput(sf) {
        const typeInfo = this.getTypeInfo(sf.type);
        const currentVal = this.currentValue[sf.id];
        const displayVal = currentVal !== undefined && currentVal !== null ? currentVal : '';

        // Handle checkbox specially
        if (sf.type === 'CHECKBOX') {
            const isChecked = currentVal === true || currentVal === 'true';
            return `
                <div class="sub-field-input-row checkbox-row">
                    <label class="sub-field-label">
                        <span class="type-indicator" style="color: ${typeInfo.color};">
                            <i class="ph ${typeInfo.icon}"></i>
                        </span>
                        ${this.escapeHtml(sf.name)}
                        ${sf.optional ? '<span class="optional-badge">optional</span>' : ''}
                    </label>
                    <input type="checkbox"
                           class="sub-field-checkbox"
                           data-field-id="${sf.id}"
                           ${isChecked ? 'checked' : ''}>
                </div>
            `;
        }

        // Handle textarea for LONG_TEXT
        if (sf.type === 'LONG_TEXT') {
            return `
                <div class="sub-field-input-row">
                    <label class="sub-field-label">
                        <span class="type-indicator" style="color: ${typeInfo.color};">
                            <i class="ph ${typeInfo.icon}"></i>
                        </span>
                        ${this.escapeHtml(sf.name)}
                        ${sf.optional ? '<span class="optional-badge">optional</span>' : ''}
                    </label>
                    <textarea class="sub-field-input sub-field-textarea eo-input"
                           data-field-id="${sf.id}"
                           data-field-type="${sf.type}"
                           placeholder="${this.escapeHtml(sf.placeholder || typeInfo.placeholder)}"
                           rows="3">${this.escapeHtml(String(displayVal))}</textarea>
                </div>
            `;
        }

        // Standard input for other types
        const stepAttr = typeInfo.step ? `step="${typeInfo.step}"` : '';
        return `
            <div class="sub-field-input-row">
                <label class="sub-field-label">
                    <span class="type-indicator" style="color: ${typeInfo.color};">
                        <i class="ph ${typeInfo.icon}"></i>
                    </span>
                    ${this.escapeHtml(sf.name)}
                    ${sf.optional ? '<span class="optional-badge">optional</span>' : ''}
                </label>
                <input type="${typeInfo.inputType}"
                       class="sub-field-input eo-input"
                       data-field-id="${sf.id}"
                       data-field-type="${sf.type}"
                       placeholder="${this.escapeHtml(sf.placeholder || typeInfo.placeholder)}"
                       ${stepAttr}
                       value="${this.escapeHtml(String(displayVal))}">
            </div>
        `;
    }

    /**
     * Get JSON format example for display
     */
    getJsonFormatExample() {
        const subFields = this.getSubFields();
        const exampleObj = {};

        subFields.forEach(sf => {
            const typeInfo = this.getTypeInfo(sf.type);
            switch (sf.type) {
                case 'NUMBER':
                    exampleObj[sf.id] = 0;
                    break;
                case 'CURRENCY':
                    exampleObj[sf.id] = 0.00;
                    break;
                case 'CHECKBOX':
                    exampleObj[sf.id] = false;
                    break;
                case 'DATE':
                    exampleObj[sf.id] = "2024-01-01";
                    break;
                case 'EMAIL':
                    exampleObj[sf.id] = "email@example.com";
                    break;
                case 'URL':
                    exampleObj[sf.id] = "https://example.com";
                    break;
                default:
                    exampleObj[sf.id] = sf.placeholder || "";
            }
        });

        return JSON.stringify(exampleObj, null, 2);
    }

    /**
     * Render the parse hint based on sub-fields
     */
    renderParseHint() {
        const subFields = this.getSubFields();
        const parseMode = this.getParseMode();

        if (parseMode === 'lines') {
            return `
                <div class="parse-hint">
                    <strong>Expected format (one value per line):</strong>
                    <pre class="hint-example">${subFields.map(sf => `${sf.placeholder || sf.name}`).join('\n')}</pre>
                </div>
            `;
        } else {
            const exampleObj = {};
            subFields.forEach(sf => {
                exampleObj[sf.id] = sf.placeholder || this.getExampleValueForType(sf.type);
            });
            return `
                <div class="parse-hint">
                    <strong>Expected JSON format:</strong>
                    <pre class="hint-example">${JSON.stringify(exampleObj, null, 2)}</pre>
                </div>
            `;
        }
    }

    /**
     * Get example value for a field type
     */
    getExampleValueForType(type) {
        switch (type) {
            case 'NUMBER': return 0;
            case 'CURRENCY': return 0.00;
            case 'CHECKBOX': return false;
            case 'DATE': return '2024-01-01';
            case 'EMAIL': return 'email@example.com';
            case 'URL': return 'https://example.com';
            default: return '';
        }
    }

    /**
     * Get placeholder text for paste mode
     */
    getPastePlaceholder() {
        const subFields = this.getSubFields();
        const parseMode = this.getParseMode();

        if (parseMode === 'lines') {
            return subFields.map(sf => sf.placeholder || sf.name).join('\n');
        } else {
            const exampleObj = {};
            subFields.forEach(sf => {
                exampleObj[sf.id] = '';
            });
            return JSON.stringify(exampleObj, null, 2);
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        document.getElementById('eoMultiFieldEditorClose')?.addEventListener('click', () => this.close());
        document.getElementById('eoMultiFieldEditorCancel')?.addEventListener('click', () => this.close());

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Escape key
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.modal) this.close();
        };
        document.addEventListener('keydown', this._escHandler);

        // Tab switching
        this.modal.querySelectorAll('.editor-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const mode = tab.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Field inputs (text, number, email, url, date, etc.)
        this.modal.querySelectorAll('.sub-field-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const fieldId = e.target.dataset.fieldId;
                const fieldType = e.target.dataset.fieldType;
                this.currentValue[fieldId] = this.parseInputValue(e.target.value, fieldType);
            });
        });

        // Checkbox inputs
        this.modal.querySelectorAll('.sub-field-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const fieldId = e.target.dataset.fieldId;
                this.currentValue[fieldId] = e.target.checked;
            });
        });

        // Parse button
        document.getElementById('btnParseText')?.addEventListener('click', () => {
            this.parseAndFillFields();
        });

        // Clear all button
        document.getElementById('btnClearAll')?.addEventListener('click', () => {
            this.clearAll();
        });

        // Save button
        document.getElementById('eoMultiFieldEditorSave')?.addEventListener('click', () => {
            this.save();
        });

        // Copy JSON format button
        document.getElementById('btnCopyJsonFormat')?.addEventListener('click', () => {
            this.copyJsonFormat();
        });

        // Focus first input
        setTimeout(() => {
            const firstInput = this.modal.querySelector('.sub-field-input, .sub-field-checkbox');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    /**
     * Parse input value based on type
     */
    parseInputValue(value, type) {
        if (value === '' || value === null || value === undefined) return null;

        switch (type) {
            case 'NUMBER':
                const num = parseFloat(value);
                return isNaN(num) ? null : num;
            case 'CURRENCY':
                const currency = parseFloat(value);
                return isNaN(currency) ? null : Math.round(currency * 100) / 100;
            default:
                return value;
        }
    }

    /**
     * Copy JSON format to clipboard
     */
    copyJsonFormat() {
        const jsonFormat = this.getJsonFormatExample();
        navigator.clipboard.writeText(jsonFormat).then(() => {
            if (window.showToast) {
                window.showToast('JSON format copied to clipboard');
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    /**
     * Switch between input modes
     */
    switchMode(mode) {
        this.inputMode = mode;

        // Update tabs
        this.modal.querySelectorAll('.editor-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // Update content visibility
        const fieldsMode = document.getElementById('fieldsMode');
        const pasteMode = document.getElementById('pasteMode');

        if (fieldsMode) fieldsMode.style.display = mode === 'fields' ? '' : 'none';
        if (pasteMode) pasteMode.style.display = mode === 'paste' ? '' : 'none';

        // Focus appropriate element
        if (mode === 'paste') {
            const textarea = document.getElementById('pasteTextarea');
            if (textarea) textarea.focus();
        } else {
            const firstInput = this.modal.querySelector('.sub-field-input, .sub-field-checkbox');
            if (firstInput) firstInput.focus();
        }
    }

    /**
     * Parse pasted text and fill fields
     */
    parseAndFillFields() {
        const textarea = document.getElementById('pasteTextarea');
        if (!textarea) return;

        const text = textarea.value.trim();
        if (!text) return;

        const subFields = this.getSubFields();
        const parseMode = this.getParseMode();
        let parsedValues = {};

        try {
            if (parseMode === 'lines') {
                // Parse line by line
                const lines = text.split('\n').map(l => l.trim());
                subFields.forEach((sf, idx) => {
                    if (idx < lines.length) {
                        parsedValues[sf.id] = this.convertValueForType(lines[idx], sf.type);
                    }
                });
            } else {
                // Parse as JSON
                const jsonObj = JSON.parse(text);
                subFields.forEach(sf => {
                    if (jsonObj[sf.id] !== undefined) {
                        parsedValues[sf.id] = this.convertValueForType(jsonObj[sf.id], sf.type);
                    } else if (jsonObj[sf.name] !== undefined) {
                        // Also try matching by name
                        parsedValues[sf.id] = this.convertValueForType(jsonObj[sf.name], sf.type);
                    }
                });
            }

            // Update current value and UI
            this.currentValue = { ...this.currentValue, ...parsedValues };
            this.updateFieldInputs();

            // Switch to fields mode to show results
            this.switchMode('fields');

            // Show toast
            if (window.showToast) {
                const filledCount = Object.values(parsedValues).filter(v => v !== null && v !== undefined && v !== '').length;
                window.showToast(`Parsed ${filledCount} field${filledCount !== 1 ? 's' : ''}`);
            }
        } catch (error) {
            console.error('Parse error:', error);
            if (window.showToast) {
                window.showToast('Failed to parse text. Check the format and try again.', 'error');
            } else {
                alert('Failed to parse text. Please check the format.');
            }
        }
    }

    /**
     * Convert a value to the appropriate type
     */
    convertValueForType(value, type) {
        if (value === null || value === undefined || value === '') return null;

        switch (type) {
            case 'NUMBER':
                const num = parseFloat(value);
                return isNaN(num) ? null : num;
            case 'CURRENCY':
                const currency = parseFloat(value);
                return isNaN(currency) ? null : Math.round(currency * 100) / 100;
            case 'CHECKBOX':
                if (typeof value === 'boolean') return value;
                return value === 'true' || value === '1' || value === 'yes';
            case 'DATE':
                // Validate date format
                const date = new Date(value);
                if (isNaN(date.getTime())) return String(value);
                return value;
            default:
                return String(value);
        }
    }

    /**
     * Update field input values from currentValue
     */
    updateFieldInputs() {
        // Update text/number/etc inputs
        this.modal.querySelectorAll('.sub-field-input').forEach(input => {
            const fieldId = input.dataset.fieldId;
            const value = this.currentValue[fieldId];
            input.value = value !== null && value !== undefined ? value : '';
        });

        // Update checkboxes
        this.modal.querySelectorAll('.sub-field-checkbox').forEach(checkbox => {
            const fieldId = checkbox.dataset.fieldId;
            const value = this.currentValue[fieldId];
            checkbox.checked = value === true || value === 'true';
        });
    }

    /**
     * Clear all field values
     */
    clearAll() {
        this.currentValue = {};
        this.updateFieldInputs();

        const textarea = document.getElementById('pasteTextarea');
        if (textarea) textarea.value = '';
    }

    /**
     * Save the current value
     */
    save() {
        // Clean up empty values and format based on type
        const cleanValue = {};
        let hasValue = false;

        this.getSubFields().forEach(sf => {
            const val = this.currentValue[sf.id];
            if (val !== undefined && val !== null && val !== '') {
                // Store the properly typed value
                cleanValue[sf.id] = val;
                hasValue = true;
            } else if (sf.type === 'CHECKBOX') {
                // Checkbox defaults to false if not set
                cleanValue[sf.id] = false;
            }
        });

        // If all empty, save null
        const finalValue = hasValue ? cleanValue : null;

        // Call save callback
        if (this.onSave) {
            this.onSave(finalValue);
        }

        this.close();
    }

    /**
     * Close the modal
     */
    close() {
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Utility functions for multi-field values
 */
const EOMultiFieldUtils = {
    /**
     * Format a multi-field value for cell display
     * @param {Object} value - The multi-field value object
     * @param {Object} fieldConfig - The field configuration
     * @returns {string} Formatted display string
     */
    formatForDisplay(value, fieldConfig) {
        if (!value || typeof value !== 'object') return '';

        const subFields = fieldConfig?.subFields || [];
        const displayFormat = fieldConfig?.displayFormat || 'concatenate';
        const separator = fieldConfig?.displaySeparator || ', ';

        if (displayFormat === 'first_line' || displayFormat === 'first_non_empty') {
            // Return first non-empty value
            for (const sf of subFields) {
                const val = value[sf.id];
                if (val !== undefined && val !== null && val !== '') {
                    return this.formatSingleValue(val, sf.type);
                }
            }
            return '';
        }

        if (displayFormat === 'compact') {
            // Return count of filled fields
            const filled = subFields.filter(sf => {
                const val = value[sf.id];
                return val !== undefined && val !== null && val !== '';
            }).length;
            return `${filled} of ${subFields.length} fields`;
        }

        // Default: concatenate
        const parts = [];
        for (const sf of subFields) {
            const val = value[sf.id];
            if (val !== undefined && val !== null && val !== '') {
                parts.push(this.formatSingleValue(val, sf.type));
            }
        }
        return parts.join(separator);
    },

    /**
     * Format a single value based on its type
     */
    formatSingleValue(value, type) {
        if (value === null || value === undefined || value === '') return '';

        switch (type) {
            case 'CURRENCY':
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
            case 'NUMBER':
                return Number(value).toLocaleString();
            case 'CHECKBOX':
                return value === true || value === 'true' ? '✓' : '✗';
            case 'DATE':
                try {
                    return new Date(value).toLocaleDateString();
                } catch (e) {
                    return String(value);
                }
            case 'EMAIL':
                return String(value);
            case 'URL':
                return String(value);
            default:
                return String(value);
        }
    },

    /**
     * Parse text input into multi-field value
     * @param {string} text - The text to parse
     * @param {Object} fieldConfig - The field configuration
     * @returns {Object} Parsed multi-field value
     */
    parseFromText(text, fieldConfig) {
        if (!text) return null;

        const subFields = fieldConfig?.subFields || [];
        const parseMode = fieldConfig?.parseMode || 'json';
        const result = {};

        try {
            if (parseMode === 'json') {
                const jsonObj = JSON.parse(text);
                subFields.forEach(sf => {
                    if (jsonObj[sf.id] !== undefined) {
                        result[sf.id] = this.convertValue(jsonObj[sf.id], sf.type);
                    } else if (jsonObj[sf.name] !== undefined) {
                        result[sf.id] = this.convertValue(jsonObj[sf.name], sf.type);
                    }
                });
            } else {
                // Line-by-line parsing
                const lines = text.split('\n').map(l => l.trim());
                subFields.forEach((sf, idx) => {
                    if (idx < lines.length && lines[idx]) {
                        result[sf.id] = this.convertValue(lines[idx], sf.type);
                    }
                });
            }
        } catch (error) {
            console.error('Multi-field parse error:', error);
            return null;
        }

        // Return null if no values parsed
        const hasValue = Object.values(result).some(v => v !== undefined && v !== null && v !== '');
        return hasValue ? result : null;
    },

    /**
     * Convert a value to the appropriate type
     */
    convertValue(value, type) {
        if (value === null || value === undefined) return null;

        switch (type) {
            case 'NUMBER':
                const num = parseFloat(value);
                return isNaN(num) ? null : num;
            case 'CURRENCY':
                const currency = parseFloat(value);
                return isNaN(currency) ? null : Math.round(currency * 100) / 100;
            case 'CHECKBOX':
                if (typeof value === 'boolean') return value;
                return value === 'true' || value === '1' || value === 'yes';
            default:
                return String(value);
        }
    },

    /**
     * Convert multi-field value to string for export/copy
     * @param {Object} value - The multi-field value
     * @param {Object} fieldConfig - The field configuration
     * @param {string} format - Export format: 'display', 'lines', 'json'
     * @returns {string} String representation
     */
    toExportString(value, fieldConfig, format = 'display') {
        if (!value || typeof value !== 'object') return '';

        if (format === 'json') {
            return JSON.stringify(value, null, 2);
        }

        if (format === 'lines') {
            const subFields = fieldConfig?.subFields || [];
            return subFields.map(sf => value[sf.id] || '').join('\n');
        }

        // Default: display format
        return this.formatForDisplay(value, fieldConfig);
    },

    /**
     * Get JSON template for a multi-field
     * @param {Object} fieldConfig - The field configuration
     * @returns {string} JSON template string
     */
    getJsonTemplate(fieldConfig) {
        const subFields = fieldConfig?.subFields || [];
        const template = {};

        subFields.forEach(sf => {
            switch (sf.type) {
                case 'NUMBER':
                    template[sf.id] = 0;
                    break;
                case 'CURRENCY':
                    template[sf.id] = 0.00;
                    break;
                case 'CHECKBOX':
                    template[sf.id] = false;
                    break;
                case 'DATE':
                    template[sf.id] = '2024-01-01';
                    break;
                case 'EMAIL':
                    template[sf.id] = 'email@example.com';
                    break;
                case 'URL':
                    template[sf.id] = 'https://example.com';
                    break;
                default:
                    template[sf.id] = sf.placeholder || '';
            }
        });

        return JSON.stringify(template, null, 2);
    },

    /**
     * Check if a multi-field value is empty
     * @param {Object} value - The value to check
     * @returns {boolean} True if empty
     */
    isEmpty(value) {
        if (!value || typeof value !== 'object') return true;
        return !Object.values(value).some(v => v !== undefined && v !== null && v !== '');
    }
};

// Export
if (typeof window !== 'undefined') {
    window.EOMultiFieldEditor = EOMultiFieldEditor;
    window.EOMultiFieldUtils = EOMultiFieldUtils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EOMultiFieldEditor, EOMultiFieldUtils };
}
