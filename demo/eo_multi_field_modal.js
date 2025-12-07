/**
 * EO Multi-Field Modal
 *
 * Modal for creating and configuring MULTI_FIELD columns.
 * Multi-fields allow storing multiple related values in a single field
 * (e.g., Address with street, city, state, zip, country).
 *
 * Features:
 * - Define sub-fields with names and types
 * - Set display concatenation format
 * - Configure parsing rules for text input (line-break or JSON)
 * - Preview the result
 * - Preset templates (Address, Name, etc.)
 */

class EOMultiFieldModal {
    constructor() {
        this.modal = null;
        this.currentSet = null;
        this.state = null;
        this.fieldName = '';
        this.subFields = [];
        this.displayFormat = 'concatenate'; // 'concatenate', 'first_line', 'json'
        this.displaySeparator = ', ';
        this.parseMode = 'lines'; // 'lines', 'json'
        this.editingField = null; // For editing existing fields
    }

    // Common multi-field presets
    static PRESETS = [
        {
            id: 'address',
            name: 'Address',
            icon: 'ph-map-pin',
            description: 'Street, City, State, ZIP, Country',
            subFields: [
                { id: 'street', name: 'Street', placeholder: '123 Main St' },
                { id: 'unit', name: 'Unit/Apt', placeholder: 'Apt 4B', optional: true },
                { id: 'city', name: 'City', placeholder: 'Springfield' },
                { id: 'state', name: 'State/Province', placeholder: 'IL' },
                { id: 'zip', name: 'ZIP/Postal Code', placeholder: '62701' },
                { id: 'country', name: 'Country', placeholder: 'United States', optional: true }
            ],
            displayFormat: 'concatenate',
            displaySeparator: ', ',
            displayTemplate: '{street}{unit ? ", " + unit : ""}, {city}, {state} {zip}{country ? ", " + country : ""}'
        },
        {
            id: 'full_name',
            name: 'Full Name',
            icon: 'ph-user',
            description: 'First, Middle, Last name',
            subFields: [
                { id: 'first', name: 'First Name', placeholder: 'John' },
                { id: 'middle', name: 'Middle Name', placeholder: 'Michael', optional: true },
                { id: 'last', name: 'Last Name', placeholder: 'Doe' }
            ],
            displayFormat: 'concatenate',
            displaySeparator: ' ',
            displayTemplate: '{first}{middle ? " " + middle : ""} {last}'
        },
        {
            id: 'phone',
            name: 'Phone Number',
            icon: 'ph-phone',
            description: 'Country code, Area code, Number, Extension',
            subFields: [
                { id: 'country_code', name: 'Country Code', placeholder: '+1', optional: true },
                { id: 'area_code', name: 'Area Code', placeholder: '555' },
                { id: 'number', name: 'Number', placeholder: '123-4567' },
                { id: 'extension', name: 'Extension', placeholder: 'x123', optional: true }
            ],
            displayFormat: 'concatenate',
            displaySeparator: ' ',
            displayTemplate: '{country_code} ({area_code}) {number}{extension ? " " + extension : ""}'
        },
        {
            id: 'social_links',
            name: 'Social Links',
            icon: 'ph-share-network',
            description: 'Website, LinkedIn, Twitter, etc.',
            subFields: [
                { id: 'website', name: 'Website', placeholder: 'https://example.com', optional: true },
                { id: 'linkedin', name: 'LinkedIn', placeholder: 'linkedin.com/in/username', optional: true },
                { id: 'twitter', name: 'Twitter/X', placeholder: '@username', optional: true },
                { id: 'github', name: 'GitHub', placeholder: 'github.com/username', optional: true }
            ],
            displayFormat: 'first_non_empty',
            displaySeparator: ' | '
        },
        {
            id: 'custom',
            name: 'Custom',
            icon: 'ph-sliders-horizontal',
            description: 'Define your own sub-fields',
            subFields: [],
            displayFormat: 'concatenate',
            displaySeparator: ', '
        }
    ];

    /**
     * Show the modal for creating a new multi-field
     * @param {Object} currentSet - The current set where the field will be added
     * @param {Object} state - Global application state
     */
    show(currentSet, state) {
        this.currentSet = currentSet;
        this.state = state;
        this.fieldName = '';
        this.subFields = [];
        this.displayFormat = 'concatenate';
        this.displaySeparator = ', ';
        this.parseMode = 'lines';
        this.editingField = null;

        this.render();
        this.attachEventListeners();
    }

    /**
     * Show the modal for editing an existing multi-field
     * @param {Object} field - The existing field to edit
     * @param {Object} currentSet - The current set
     * @param {Object} state - Global application state
     */
    showEdit(field, currentSet, state) {
        this.currentSet = currentSet;
        this.state = state;
        this.editingField = field;
        this.fieldName = field.name;
        this.subFields = JSON.parse(JSON.stringify(field.config?.subFields || []));
        this.displayFormat = field.config?.displayFormat || 'concatenate';
        this.displaySeparator = field.config?.displaySeparator || ', ';
        this.parseMode = field.config?.parseMode || 'lines';

        this.render();
        this.attachEventListeners();
    }

    /**
     * Render the modal
     */
    render() {
        const isEditing = !!this.editingField;
        const multiFieldColor = window.EOFieldTypeUtils?.getFieldTypeColor('MULTI_FIELD')
            || window.EO_CONSTANTS?.FIELD_TYPE_COLORS?.['MULTI_FIELD']
            || '#059669';
        const multiFieldIcon = window.EOFieldTypeUtils?.getFieldTypeIcon('MULTI_FIELD')
            || window.EO_CONSTANTS?.FIELD_TYPE_ICONS?.['MULTI_FIELD']
            || 'ph-stack';

        const modalHTML = `
            <div class="eo-multi-field-modal-overlay" id="eoMultiFieldModal">
                <div class="eo-multi-field-modal">
                    <div class="eo-multi-field-modal-header">
                        <div>
                            <h2 class="modal-title" style="display: flex; align-items: center; gap: 8px;">
                                <span style="background-color: ${multiFieldColor}20; color: ${multiFieldColor}; padding: 6px; border-radius: 6px; display: inline-flex;">
                                    <i class="ph ${multiFieldIcon}" style="font-size: 18px;"></i>
                                </span>
                                ${isEditing ? 'Edit Multi-Field' : 'Create Multi-Field'}
                            </h2>
                            <p class="modal-subtitle">
                                ${isEditing ? 'Modify the sub-fields and display settings' : 'A multi-field combines multiple values into one structured field'}
                            </p>
                        </div>
                        <button class="eo-modal-close" id="eoMultiFieldModalClose">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>

                    <div class="eo-multi-field-modal-body">
                        <!-- Step 1: Field Name -->
                        <div class="multi-field-step">
                            <div class="step-header">
                                <span class="step-number">1</span>
                                <span class="step-title">Field Name</span>
                            </div>
                            <div class="field-name-input">
                                <input type="text"
                                       id="multiFieldName"
                                       class="eo-input"
                                       placeholder="e.g., Address, Full Name, Contact Info..."
                                       value="${this.escapeHtml(this.fieldName)}">
                            </div>
                        </div>

                        <!-- Step 2: Choose Template or Custom -->
                        <div class="multi-field-step">
                            <div class="step-header">
                                <span class="step-number">2</span>
                                <span class="step-title">Start with a template or create custom</span>
                            </div>
                            <div class="preset-grid" id="presetGrid">
                                ${this.renderPresetGrid()}
                            </div>
                        </div>

                        <!-- Step 3: Define Sub-fields -->
                        <div class="multi-field-step">
                            <div class="step-header">
                                <span class="step-number">3</span>
                                <span class="step-title">Sub-fields</span>
                            </div>
                            <p class="step-description">
                                Define the individual fields that make up this multi-field
                            </p>
                            <div class="sub-fields-container" id="subFieldsContainer">
                                ${this.renderSubFields()}
                            </div>
                            <button class="btn-add-subfield" id="btnAddSubfield">
                                <i class="ph ph-plus"></i> Add Sub-field
                            </button>
                        </div>

                        <!-- Step 4: Display Settings -->
                        <div class="multi-field-step">
                            <div class="step-header">
                                <span class="step-number">4</span>
                                <span class="step-title">Display Settings</span>
                            </div>
                            <div class="display-settings">
                                <div class="setting-group">
                                    <label>How to display in cell:</label>
                                    <div class="radio-options">
                                        <label class="radio-option">
                                            <input type="radio" name="displayFormat" value="concatenate"
                                                   ${this.displayFormat === 'concatenate' ? 'checked' : ''}>
                                            <span>Concatenate all values</span>
                                        </label>
                                        <label class="radio-option">
                                            <input type="radio" name="displayFormat" value="first_line"
                                                   ${this.displayFormat === 'first_line' ? 'checked' : ''}>
                                            <span>Show first non-empty value</span>
                                        </label>
                                        <label class="radio-option">
                                            <input type="radio" name="displayFormat" value="compact"
                                                   ${this.displayFormat === 'compact' ? 'checked' : ''}>
                                            <span>Compact (count of filled fields)</span>
                                        </label>
                                    </div>
                                </div>
                                <div class="setting-group" id="separatorGroup" ${this.displayFormat !== 'concatenate' ? 'style="display:none"' : ''}>
                                    <label>Separator:</label>
                                    <div class="separator-options">
                                        <button class="separator-btn ${this.displaySeparator === ', ' ? 'active' : ''}" data-sep=", ">Comma</button>
                                        <button class="separator-btn ${this.displaySeparator === ' | ' ? 'active' : ''}" data-sep=" | ">Pipe</button>
                                        <button class="separator-btn ${this.displaySeparator === ' - ' ? 'active' : ''}" data-sep=" - ">Dash</button>
                                        <button class="separator-btn ${this.displaySeparator === '\n' ? 'active' : ''}" data-sep="\n">New Line</button>
                                        <input type="text" class="custom-separator" id="customSeparator"
                                               placeholder="Custom..." value="${this.isCustomSeparator() ? this.escapeHtml(this.displaySeparator) : ''}">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Step 5: Parse Settings -->
                        <div class="multi-field-step">
                            <div class="step-header">
                                <span class="step-number">5</span>
                                <span class="step-title">Text Parsing</span>
                            </div>
                            <p class="step-description">
                                When pasting text, how should it be split into sub-fields?
                            </p>
                            <div class="parse-settings">
                                <div class="radio-options">
                                    <label class="radio-option">
                                        <input type="radio" name="parseMode" value="lines"
                                               ${this.parseMode === 'lines' ? 'checked' : ''}>
                                        <div class="option-content">
                                            <span class="option-label">Line breaks</span>
                                            <span class="option-desc">Each line becomes a sub-field value</span>
                                        </div>
                                    </label>
                                    <label class="radio-option">
                                        <input type="radio" name="parseMode" value="json"
                                               ${this.parseMode === 'json' ? 'checked' : ''}>
                                        <div class="option-content">
                                            <span class="option-label">JSON</span>
                                            <span class="option-desc">Parse as JSON object with matching keys</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Preview -->
                        <div class="multi-field-preview" id="multiFieldPreview">
                            ${this.renderPreview()}
                        </div>
                    </div>

                    <div class="eo-multi-field-modal-footer">
                        <button class="btn btn-secondary" id="eoMultiFieldModalCancel">Cancel</button>
                        <button class="btn btn-primary" id="eoMultiFieldModalCreate" ${!this.canCreate() ? 'disabled' : ''}>
                            ${isEditing ? 'Save Changes' : 'Create Multi-Field'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('eoMultiFieldModal');
    }

    /**
     * Render the preset template grid
     */
    renderPresetGrid() {
        return EOMultiFieldModal.PRESETS.map(preset => `
            <div class="preset-option" data-preset-id="${preset.id}">
                <div class="preset-icon"><i class="ph ${preset.icon}"></i></div>
                <div class="preset-info">
                    <div class="preset-name">${preset.name}</div>
                    <div class="preset-desc">${preset.description}</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render the sub-fields list
     */
    renderSubFields() {
        if (this.subFields.length === 0) {
            return `
                <div class="empty-subfields">
                    <p>No sub-fields defined yet.</p>
                    <p class="hint">Choose a template above or add custom sub-fields.</p>
                </div>
            `;
        }

        return `
            <div class="sub-fields-list">
                ${this.subFields.map((sf, idx) => `
                    <div class="sub-field-row" data-index="${idx}">
                        <div class="sub-field-drag-handle">
                            <i class="ph ph-dots-six-vertical"></i>
                        </div>
                        <div class="sub-field-main">
                            <input type="text" class="sub-field-name" value="${this.escapeHtml(sf.name)}"
                                   placeholder="Field name" data-index="${idx}">
                            <input type="text" class="sub-field-placeholder" value="${this.escapeHtml(sf.placeholder || '')}"
                                   placeholder="Placeholder text" data-index="${idx}">
                        </div>
                        <div class="sub-field-options">
                            <label class="checkbox-small" title="Optional field">
                                <input type="checkbox" class="sub-field-optional" ${sf.optional ? 'checked' : ''} data-index="${idx}">
                                <span>Optional</span>
                            </label>
                        </div>
                        <button class="sub-field-delete" data-index="${idx}" title="Remove sub-field">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render the preview section
     */
    renderPreview() {
        if (this.subFields.length === 0) {
            return '';
        }

        // Generate sample values
        const sampleValues = {};
        this.subFields.forEach(sf => {
            sampleValues[sf.id] = sf.placeholder || `Sample ${sf.name}`;
        });

        // Format display based on settings
        let displayText = '';
        if (this.displayFormat === 'concatenate') {
            const parts = this.subFields
                .filter(sf => !sf.optional || sampleValues[sf.id])
                .map(sf => sampleValues[sf.id]);
            displayText = parts.join(this.displaySeparator);
        } else if (this.displayFormat === 'first_line') {
            const first = this.subFields.find(sf => sampleValues[sf.id]);
            displayText = first ? sampleValues[first.id] : '';
        } else if (this.displayFormat === 'compact') {
            const filled = this.subFields.filter(sf => sampleValues[sf.id]).length;
            displayText = `${filled} of ${this.subFields.length} fields`;
        }

        // Generate parse example
        let parseExample = '';
        if (this.parseMode === 'lines') {
            parseExample = this.subFields.map(sf => sf.placeholder || `[${sf.name}]`).join('\n');
        } else {
            const jsonObj = {};
            this.subFields.forEach(sf => {
                jsonObj[sf.id] = sf.placeholder || `[${sf.name}]`;
            });
            parseExample = JSON.stringify(jsonObj, null, 2);
        }

        return `
            <div class="preview-section">
                <div class="preview-title">Preview</div>
                <div class="preview-content">
                    <div class="preview-item">
                        <div class="preview-label">Cell Display:</div>
                        <div class="preview-value">${this.escapeHtml(displayText)}</div>
                    </div>
                    <div class="preview-item">
                        <div class="preview-label">Paste Format (${this.parseMode === 'lines' ? 'Line breaks' : 'JSON'}):</div>
                        <pre class="preview-code">${this.escapeHtml(parseExample)}</pre>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Check if separator is custom (not one of the presets)
     */
    isCustomSeparator() {
        const presets = [', ', ' | ', ' - ', '\n'];
        return !presets.includes(this.displaySeparator);
    }

    /**
     * Check if we have enough info to create
     */
    canCreate() {
        return this.fieldName.trim() && this.subFields.length > 0;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        document.getElementById('eoMultiFieldModalClose')?.addEventListener('click', () => this.close());
        document.getElementById('eoMultiFieldModalCancel')?.addEventListener('click', () => this.close());

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Escape key
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.modal) this.close();
        };
        document.addEventListener('keydown', this._escHandler);

        // Field name input
        const fieldNameInput = document.getElementById('multiFieldName');
        if (fieldNameInput) {
            fieldNameInput.addEventListener('input', (e) => {
                this.fieldName = e.target.value;
                this.refreshCreateButton();
            });
            // Focus on load
            setTimeout(() => fieldNameInput.focus(), 100);
        }

        // Preset selection
        this.modal.querySelectorAll('.preset-option').forEach(option => {
            option.addEventListener('click', () => {
                const presetId = option.dataset.presetId;
                this.applyPreset(presetId);
            });
        });

        // Add sub-field button
        document.getElementById('btnAddSubfield')?.addEventListener('click', () => {
            this.addSubField();
        });

        // Display format radios
        this.modal.querySelectorAll('input[name="displayFormat"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.displayFormat = e.target.value;
                const sepGroup = document.getElementById('separatorGroup');
                if (sepGroup) {
                    sepGroup.style.display = this.displayFormat === 'concatenate' ? '' : 'none';
                }
                this.refreshPreview();
            });
        });

        // Separator buttons
        this.modal.querySelectorAll('.separator-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.displaySeparator = btn.dataset.sep;
                this.modal.querySelectorAll('.separator-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('customSeparator').value = '';
                this.refreshPreview();
            });
        });

        // Custom separator input
        const customSepInput = document.getElementById('customSeparator');
        if (customSepInput) {
            customSepInput.addEventListener('input', (e) => {
                if (e.target.value) {
                    this.displaySeparator = e.target.value;
                    this.modal.querySelectorAll('.separator-btn').forEach(b => b.classList.remove('active'));
                    this.refreshPreview();
                }
            });
        }

        // Parse mode radios
        this.modal.querySelectorAll('input[name="parseMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.parseMode = e.target.value;
                this.refreshPreview();
            });
        });

        // Create button
        document.getElementById('eoMultiFieldModalCreate')?.addEventListener('click', () => this.create());

        // Attach sub-field listeners
        this.attachSubFieldListeners();
    }

    /**
     * Attach listeners to sub-field elements
     */
    attachSubFieldListeners() {
        // Sub-field name inputs
        this.modal.querySelectorAll('.sub-field-name').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                if (this.subFields[idx]) {
                    this.subFields[idx].name = e.target.value;
                    // Auto-generate ID from name if needed
                    if (!this.subFields[idx].id || this.subFields[idx].id.startsWith('field_')) {
                        this.subFields[idx].id = this.slugify(e.target.value) || `field_${idx}`;
                    }
                    this.refreshPreview();
                }
            });
        });

        // Sub-field placeholder inputs
        this.modal.querySelectorAll('.sub-field-placeholder').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                if (this.subFields[idx]) {
                    this.subFields[idx].placeholder = e.target.value;
                    this.refreshPreview();
                }
            });
        });

        // Sub-field optional checkboxes
        this.modal.querySelectorAll('.sub-field-optional').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                if (this.subFields[idx]) {
                    this.subFields[idx].optional = e.target.checked;
                    this.refreshPreview();
                }
            });
        });

        // Sub-field delete buttons
        this.modal.querySelectorAll('.sub-field-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index);
                this.removeSubField(idx);
            });
        });
    }

    /**
     * Apply a preset template
     */
    applyPreset(presetId) {
        const preset = EOMultiFieldModal.PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        // Update state
        this.subFields = JSON.parse(JSON.stringify(preset.subFields));
        this.displayFormat = preset.displayFormat || 'concatenate';
        this.displaySeparator = preset.displaySeparator || ', ';

        // Auto-set field name if empty
        if (!this.fieldName.trim() && preset.id !== 'custom') {
            this.fieldName = preset.name;
            const nameInput = document.getElementById('multiFieldName');
            if (nameInput) nameInput.value = this.fieldName;
        }

        // Highlight selected preset
        this.modal.querySelectorAll('.preset-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.presetId === presetId);
        });

        // Refresh UI
        this.refreshSubFields();
        this.refreshPreview();
        this.refreshCreateButton();
    }

    /**
     * Add a new sub-field
     */
    addSubField() {
        const newField = {
            id: `field_${this.subFields.length}`,
            name: '',
            placeholder: '',
            optional: false
        };
        this.subFields.push(newField);
        this.refreshSubFields();
        this.refreshCreateButton();

        // Focus the new field's name input
        setTimeout(() => {
            const inputs = this.modal.querySelectorAll('.sub-field-name');
            if (inputs.length > 0) {
                inputs[inputs.length - 1].focus();
            }
        }, 50);
    }

    /**
     * Remove a sub-field
     */
    removeSubField(index) {
        this.subFields.splice(index, 1);
        this.refreshSubFields();
        this.refreshPreview();
        this.refreshCreateButton();
    }

    /**
     * Refresh the sub-fields container
     */
    refreshSubFields() {
        const container = document.getElementById('subFieldsContainer');
        if (container) {
            container.innerHTML = this.renderSubFields();
            this.attachSubFieldListeners();
        }
    }

    /**
     * Refresh the preview section
     */
    refreshPreview() {
        const preview = document.getElementById('multiFieldPreview');
        if (preview) {
            preview.innerHTML = this.renderPreview();
        }
    }

    /**
     * Refresh the create button state
     */
    refreshCreateButton() {
        const createBtn = document.getElementById('eoMultiFieldModalCreate');
        if (createBtn) {
            createBtn.disabled = !this.canCreate();
        }
    }

    /**
     * Create the multi-field
     */
    create() {
        if (!this.canCreate()) return;

        // Generate field ID
        const fieldId = this.slugify(this.fieldName);
        const existingIds = this.currentSet.schema.map(f => f.id);

        // If editing, use existing ID; otherwise ensure unique
        const uniqueId = this.editingField ? this.editingField.id : this.ensureUniqueId(fieldId, existingIds);

        // Ensure all sub-fields have valid IDs
        this.subFields.forEach((sf, idx) => {
            if (!sf.id) {
                sf.id = this.slugify(sf.name) || `field_${idx}`;
            }
        });

        // Create the field config
        const fieldConfig = {
            subFields: this.subFields,
            displayFormat: this.displayFormat,
            displaySeparator: this.displaySeparator,
            parseMode: this.parseMode,
            createdAt: this.editingField?.config?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (this.editingField) {
            // Update existing field
            this.editingField.name = this.fieldName;
            this.editingField.config = fieldConfig;
        } else {
            // Create new field
            const newField = {
                id: uniqueId,
                name: this.fieldName,
                type: 'MULTI_FIELD',
                width: '250px',
                config: fieldConfig
            };

            // Add to current set's schema
            this.currentSet.schema.push(newField);

            // Add to all views
            this.currentSet.views?.forEach(view => {
                if (!view.visibleFieldIds) view.visibleFieldIds = [];
                view.visibleFieldIds.push(uniqueId);
                if (!view.columnOrder) view.columnOrder = [];
                view.columnOrder.push(uniqueId);
            });
        }

        // Emit event if available
        if (typeof window.createEvent === 'function') {
            window.createEvent(
                this.editingField ? 'Update Field' : 'Create Field',
                this.editingField ? 'UPD' : 'CRE',
                { type: 'Field', id: uniqueId, setId: this.currentSet.id },
                {
                    fieldName: this.fieldName,
                    fieldType: 'MULTI_FIELD',
                    subFieldCount: this.subFields.length,
                    summary: `${this.editingField ? 'Updated' : 'Created'} multi-field "${this.fieldName}" with ${this.subFields.length} sub-fields`
                }
            );
        }

        // Refresh the view
        if (window.renderCurrentView) {
            window.renderCurrentView();
        }

        // Show success toast
        if (window.showToast) {
            window.showToast(`${this.editingField ? 'Updated' : 'Created'} multi-field "${this.fieldName}"`);
        }

        this.close();
    }

    /**
     * Slugify a string for use as ID
     */
    slugify(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .substring(0, 50);
    }

    /**
     * Ensure unique ID
     */
    ensureUniqueId(baseId, existingIds) {
        let id = baseId;
        let counter = 1;
        while (existingIds.includes(id)) {
            id = `${baseId}_${counter}`;
            counter++;
        }
        return id;
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

// Export
if (typeof window !== 'undefined') {
    window.EOMultiFieldModal = EOMultiFieldModal;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EOMultiFieldModal };
}
