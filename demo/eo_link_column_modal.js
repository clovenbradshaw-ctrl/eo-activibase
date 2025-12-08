/**
 * EO Link Column Modal
 *
 * Modal for creating new LINK_RECORD columns with semantic relationship types.
 * Encourages users to define the type of edge/connection between records.
 *
 * Features:
 * - Select target set to link to
 * - Define relationship type/verb (e.g., "belongs to", "manages", "references")
 * - Set cardinality (one-to-one, one-to-many)
 * - Auto-suggest inverse relationship on target set
 * - Preview the relationship definition
 */

class EOLinkColumnModal {
    constructor() {
        this.modal = null;
        this.currentSet = null;
        this.state = null;
        this.availableSets = [];
        this.selectedSetId = null;
        this.relationshipVerb = '';
        this.inverseVerb = '';
        this.cardinality = 'many'; // 'one' or 'many'
        this.fieldName = '';
        this.createInverse = false;
    }

    // Common relationship types with their typical inverses
    static RELATIONSHIP_PRESETS = [
        { verb: 'belongs to', inverse: 'has', description: 'Ownership or membership', icon: '👤' },
        { verb: 'is assigned to', inverse: 'is assigned', description: 'Task/work assignment', icon: '📋' },
        { verb: 'references', inverse: 'is referenced by', description: 'Cross-reference', icon: '🔗' },
        { verb: 'is child of', inverse: 'is parent of', description: 'Hierarchical parent-child', icon: '🌳' },
        { verb: 'depends on', inverse: 'is dependency of', description: 'Dependencies', icon: '⚙️' },
        { verb: 'manages', inverse: 'is managed by', description: 'Management relationship', icon: '👔' },
        { verb: 'contains', inverse: 'is contained in', description: 'Container relationship', icon: '📦' },
        { verb: 'created', inverse: 'was created by', description: 'Authorship', icon: '✍️' },
        { verb: 'relates to', inverse: 'relates to', description: 'Generic relation', icon: '↔️' },
        { verb: 'is part of', inverse: 'includes', description: 'Part-whole relationship', icon: '🧩' },
        { verb: 'works with', inverse: 'works with', description: 'Collaboration', icon: '🤝' },
        { verb: 'is located at', inverse: 'is location of', description: 'Location relationship', icon: '📍' }
    ];

    /**
     * Show the modal
     * @param {Object} currentSet - The current set where the link column will be added
     * @param {Object} state - Global application state
     */
    show(currentSet, state) {
        this.currentSet = currentSet;
        this.state = state;
        this.selectedSetId = null;
        this.relationshipVerb = '';
        this.inverseVerb = '';
        this.cardinality = 'many';
        this.fieldName = '';
        this.createInverse = false;

        // Get available sets (exclude current set)
        this.availableSets = [];
        state.sets.forEach((set, setId) => {
            if (setId !== currentSet.id) {
                this.availableSets.push({ id: setId, name: set.name, recordCount: set.records?.size || 0 });
            }
        });

        this.render();
        this.attachEventListeners();
    }

    /**
     * Render the modal
     */
    render() {
        // Get the link field type styling
        const linkTypeColor = window.EOFieldTypeUtils?.getFieldTypeColor('LINKED_RECORD')
            || window.EO_CONSTANTS?.FIELD_TYPE_COLORS?.['LINKED_RECORD']
            || '#8b5cf6';
        const linkIconClass = window.EOFieldTypeUtils?.getFieldTypeIcon('LINKED_RECORD')
            || window.EO_CONSTANTS?.FIELD_TYPE_ICONS?.['LINKED_RECORD']
            || 'ph-link'; // Editable dynamic link (U+E2E2)

        const modalHTML = `
            <div class="eo-link-modal-overlay" id="eoLinkColumnModal">
                <div class="eo-link-modal">
                    <div class="eo-link-modal-header">
                        <div>
                            <h2 class="modal-title" style="display: flex; align-items: center; gap: 8px;">
                                <span style="background-color: ${linkTypeColor}20; color: ${linkTypeColor}; padding: 6px; border-radius: 6px; display: inline-flex;">
                                    <i class="ph ${linkIconClass}" style="font-size: 18px;"></i>
                                </span>
                                Create Link Column
                            </h2>
                            <p class="modal-subtitle">
                                Connect <strong>${this.escapeHtml(this.currentSet.name)}</strong> to another set
                            </p>
                        </div>
                        <button class="eo-modal-close" id="eoLinkModalClose">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>

                    <div class="eo-link-modal-body">
                        <!-- Step 1: Select Target Set -->
                        <div class="link-step">
                            <div class="step-header">
                                <span class="step-number">1</span>
                                <span class="step-title">Which set do you want to link to?</span>
                            </div>
                            <div class="set-selector" id="setSelector">
                                ${this.renderSetSelector()}
                            </div>
                        </div>

                        <!-- Step 2: Define Relationship Type -->
                        <div class="link-step ${!this.selectedSetId ? 'disabled' : ''}">
                            <div class="step-header">
                                <span class="step-number">2</span>
                                <span class="step-title">What type of relationship is this?</span>
                            </div>
                            <p class="step-description">
                                Defining the relationship type helps you and others understand how records connect.
                            </p>
                            <div class="relationship-selector" id="relationshipSelector">
                                ${this.renderRelationshipSelector()}
                            </div>
                        </div>

                        <!-- Step 3: Cardinality -->
                        <div class="link-step ${!this.selectedSetId ? 'disabled' : ''}">
                            <div class="step-header">
                                <span class="step-number">3</span>
                                <span class="step-title">How many records can be linked?</span>
                            </div>
                            <div class="cardinality-options" id="cardinalityOptions">
                                ${this.renderCardinalityOptions()}
                            </div>
                        </div>

                        <!-- Step 4: Field Name -->
                        <div class="link-step ${!this.selectedSetId ? 'disabled' : ''}">
                            <div class="step-header">
                                <span class="step-number">4</span>
                                <span class="step-title">What should this column be called?</span>
                            </div>
                            <div class="field-name-input">
                                <input type="text"
                                       id="linkFieldName"
                                       class="eo-input"
                                       placeholder="e.g., Project, Assigned To, Parent Task..."
                                       value="${this.escapeHtml(this.fieldName)}">
                            </div>
                        </div>

                        <!-- Relationship Preview -->
                        <div class="relationship-preview ${!this.selectedSetId || !this.relationshipVerb ? 'hidden' : ''}" id="relationshipPreview">
                            ${this.renderPreview()}
                        </div>

                        <!-- Optional: Create Inverse -->
                        <div class="inverse-option ${!this.selectedSetId ? 'hidden' : ''}" id="inverseOption">
                            <label class="checkbox-label">
                                <input type="checkbox" id="createInverseCheck" ${this.createInverse ? 'checked' : ''}>
                                <span class="checkbox-text">
                                    Also create inverse link column in <strong>${this.getSelectedSetName()}</strong>
                                </span>
                            </label>
                            ${this.createInverse ? `
                                <div class="inverse-details">
                                    <label>Inverse relationship:</label>
                                    <input type="text"
                                           id="inverseVerbInput"
                                           class="eo-input small"
                                           placeholder="e.g., has, contains..."
                                           value="${this.escapeHtml(this.inverseVerb)}">
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="eo-link-modal-footer">
                        <button class="btn btn-secondary" id="eoLinkModalCancel">Cancel</button>
                        <button class="btn btn-primary" id="eoLinkModalCreate" ${!this.canCreate() ? 'disabled' : ''}>
                            Create Link Column
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('eoLinkColumnModal');
    }

    /**
     * Render the set selector
     */
    renderSetSelector() {
        if (this.availableSets.length === 0) {
            return `
                <div class="empty-sets">
                    <p>No other sets available to link to.</p>
                    <p class="hint">Import or create another set first.</p>
                </div>
            `;
        }

        return `
            <div class="sets-grid">
                ${this.availableSets.map(set => `
                    <div class="set-option ${this.selectedSetId === set.id ? 'selected' : ''}"
                         data-set-id="${set.id}">
                        <div class="set-icon"><i class="ph ph-table"></i></div>
                        <div class="set-info">
                            <div class="set-name">${this.escapeHtml(set.name)}</div>
                            <div class="set-meta">${set.recordCount} record${set.recordCount !== 1 ? 's' : ''}</div>
                        </div>
                        <div class="set-check ${this.selectedSetId === set.id ? 'visible' : ''}">
                            <i class="ph ph-check-circle-fill"></i>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render the relationship type selector
     */
    renderRelationshipSelector() {
        return `
            <div class="relationship-presets">
                ${EOLinkColumnModal.RELATIONSHIP_PRESETS.map(preset => `
                    <button class="preset-btn ${this.relationshipVerb === preset.verb ? 'selected' : ''}"
                            data-verb="${preset.verb}"
                            data-inverse="${preset.inverse}"
                            title="${preset.description}">
                        <span class="preset-icon">${preset.icon}</span>
                        <span class="preset-verb">${preset.verb}</span>
                    </button>
                `).join('')}
            </div>
            <div class="custom-relationship">
                <label class="custom-label">Or define your own:</label>
                <div class="custom-input-group">
                    <span class="input-prefix">${this.escapeHtml(this.currentSet.name)}</span>
                    <input type="text"
                           id="customRelationshipVerb"
                           class="eo-input"
                           placeholder="type relationship here..."
                           value="${this.isCustomVerb() ? this.escapeHtml(this.relationshipVerb) : ''}">
                    <span class="input-suffix">${this.getSelectedSetName() || '...'}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render cardinality options
     */
    renderCardinalityOptions() {
        return `
            <div class="cardinality-grid">
                <div class="cardinality-option ${this.cardinality === 'one' ? 'selected' : ''}" data-cardinality="one">
                    <div class="cardinality-icon">1 → 1</div>
                    <div class="cardinality-label">One record</div>
                    <div class="cardinality-desc">Each record links to exactly one other</div>
                </div>
                <div class="cardinality-option ${this.cardinality === 'many' ? 'selected' : ''}" data-cardinality="many">
                    <div class="cardinality-icon">1 → N</div>
                    <div class="cardinality-label">Many records</div>
                    <div class="cardinality-desc">Each record can link to multiple others</div>
                </div>
            </div>
        `;
    }

    /**
     * Render the relationship preview
     */
    renderPreview() {
        if (!this.selectedSetId || !this.relationshipVerb) {
            return '';
        }

        const targetSetName = this.getSelectedSetName();
        const fieldName = this.fieldName || `Linked ${targetSetName}`;

        return `
            <div class="preview-content">
                <div class="preview-title">Relationship Definition</div>
                <div class="preview-statement">
                    <span class="preview-set">${this.escapeHtml(this.currentSet.name)}</span>
                    <span class="preview-verb">${this.escapeHtml(this.relationshipVerb)}</span>
                    <span class="preview-set">${this.escapeHtml(targetSetName)}</span>
                </div>
                <div class="preview-example">
                    <span class="example-label">Example:</span>
                    <span class="example-text">
                        "A ${this.singularize(this.currentSet.name)} ${this.relationshipVerb} ${this.cardinality === 'many' ? 'multiple' : 'one'} ${this.cardinality === 'many' ? this.escapeHtml(targetSetName) : this.singularize(targetSetName)}"
                    </span>
                </div>
            </div>
        `;
    }

    /**
     * Check if current verb is a custom one (not a preset)
     */
    isCustomVerb() {
        return this.relationshipVerb &&
               !EOLinkColumnModal.RELATIONSHIP_PRESETS.some(p => p.verb === this.relationshipVerb);
    }

    /**
     * Get the selected set name
     */
    getSelectedSetName() {
        if (!this.selectedSetId) return '';
        const set = this.availableSets.find(s => s.id === this.selectedSetId);
        return set ? set.name : '';
    }

    /**
     * Check if we have enough info to create
     */
    canCreate() {
        return this.selectedSetId && this.relationshipVerb && this.fieldName;
    }

    /**
     * Simple singularize helper
     */
    singularize(name) {
        if (!name) return '';
        if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
        if (name.endsWith('es')) return name.slice(0, -2);
        if (name.endsWith('s')) return name.slice(0, -1);
        return name;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        document.getElementById('eoLinkModalClose')?.addEventListener('click', () => this.close());
        document.getElementById('eoLinkModalCancel')?.addEventListener('click', () => this.close());

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Escape key
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.modal) this.close();
        };
        document.addEventListener('keydown', this._escHandler);

        // Set selection
        this.modal.querySelectorAll('.set-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const setId = e.currentTarget.dataset.setId;
                this.selectSet(setId);
            });
        });

        // Relationship preset buttons
        this.modal.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const verb = e.currentTarget.dataset.verb;
                const inverse = e.currentTarget.dataset.inverse;
                this.selectRelationship(verb, inverse);
            });
        });

        // Custom relationship input
        const customInput = document.getElementById('customRelationshipVerb');
        if (customInput) {
            customInput.addEventListener('input', (e) => {
                this.relationshipVerb = e.target.value;
                this.inverseVerb = ''; // Clear inverse for custom
                this.refreshUI();
            });
            customInput.addEventListener('focus', () => {
                // Clear preset selection when typing custom
                this.modal.querySelectorAll('.preset-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
            });
        }

        // Cardinality options
        this.modal.querySelectorAll('.cardinality-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.cardinality = e.currentTarget.dataset.cardinality;
                this.refreshCardinalityUI();
                this.refreshPreview();
            });
        });

        // Field name input
        const fieldNameInput = document.getElementById('linkFieldName');
        if (fieldNameInput) {
            fieldNameInput.addEventListener('input', (e) => {
                this.fieldName = e.target.value;
                this.refreshCreateButton();
                this.refreshPreview();
            });
        }

        // Create inverse checkbox
        const inverseCheck = document.getElementById('createInverseCheck');
        if (inverseCheck) {
            inverseCheck.addEventListener('change', (e) => {
                this.createInverse = e.target.checked;
                this.refreshInverseOption();
            });
        }

        // Create button
        document.getElementById('eoLinkModalCreate')?.addEventListener('click', () => this.create());
    }

    /**
     * Select a target set
     */
    selectSet(setId) {
        this.selectedSetId = setId;

        // Auto-suggest field name based on selected set
        if (!this.fieldName) {
            this.fieldName = this.getSelectedSetName();
            const fieldNameInput = document.getElementById('linkFieldName');
            if (fieldNameInput) fieldNameInput.value = this.fieldName;
        }

        this.refreshUI();
    }

    /**
     * Select a relationship preset
     */
    selectRelationship(verb, inverse) {
        this.relationshipVerb = verb;
        this.inverseVerb = inverse || '';

        // Clear custom input
        const customInput = document.getElementById('customRelationshipVerb');
        if (customInput) customInput.value = '';

        // Update preset buttons
        this.modal.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.verb === verb);
        });

        this.refreshPreview();
        this.refreshCreateButton();
        this.refreshInverseOption();
    }

    /**
     * Refresh all UI elements
     */
    refreshUI() {
        // Refresh set selector
        const setSelector = document.getElementById('setSelector');
        if (setSelector) setSelector.innerHTML = this.renderSetSelector();

        // Re-attach set listeners
        this.modal.querySelectorAll('.set-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const setId = e.currentTarget.dataset.setId;
                this.selectSet(setId);
            });
        });

        // Enable/disable steps
        this.modal.querySelectorAll('.link-step').forEach((step, index) => {
            if (index > 0) {
                step.classList.toggle('disabled', !this.selectedSetId);
            }
        });

        // Refresh relationship selector (update suffix with set name)
        const relationshipSelector = document.getElementById('relationshipSelector');
        if (relationshipSelector) {
            relationshipSelector.innerHTML = this.renderRelationshipSelector();

            // Re-attach preset listeners
            relationshipSelector.querySelectorAll('.preset-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const verb = e.currentTarget.dataset.verb;
                    const inverse = e.currentTarget.dataset.inverse;
                    this.selectRelationship(verb, inverse);
                });
            });

            // Re-attach custom input listener
            const customInput = document.getElementById('customRelationshipVerb');
            if (customInput) {
                customInput.addEventListener('input', (e) => {
                    this.relationshipVerb = e.target.value;
                    this.inverseVerb = '';
                    this.refreshPreview();
                    this.refreshCreateButton();
                });
            }
        }

        this.refreshPreview();
        this.refreshCreateButton();
        this.refreshInverseOption();
    }

    /**
     * Refresh cardinality UI
     */
    refreshCardinalityUI() {
        this.modal.querySelectorAll('.cardinality-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.cardinality === this.cardinality);
        });
    }

    /**
     * Refresh the preview section
     */
    refreshPreview() {
        const preview = document.getElementById('relationshipPreview');
        if (preview) {
            preview.innerHTML = this.renderPreview();
            preview.classList.toggle('hidden', !this.selectedSetId || !this.relationshipVerb);
        }
    }

    /**
     * Refresh the create button state
     */
    refreshCreateButton() {
        const createBtn = document.getElementById('eoLinkModalCreate');
        if (createBtn) {
            createBtn.disabled = !this.canCreate();
        }
    }

    /**
     * Refresh the inverse option section
     */
    refreshInverseOption() {
        const inverseOption = document.getElementById('inverseOption');
        if (!inverseOption) return;

        inverseOption.classList.toggle('hidden', !this.selectedSetId);

        // Update the checkbox label
        const checkboxText = inverseOption.querySelector('.checkbox-text strong');
        if (checkboxText) {
            checkboxText.textContent = this.getSelectedSetName();
        }

        // Show/hide inverse details
        if (this.createInverse) {
            let detailsEl = inverseOption.querySelector('.inverse-details');
            if (!detailsEl) {
                const detailsHTML = `
                    <div class="inverse-details">
                        <label>Inverse relationship:</label>
                        <input type="text"
                               id="inverseVerbInput"
                               class="eo-input small"
                               placeholder="e.g., has, contains..."
                               value="${this.escapeHtml(this.inverseVerb)}">
                    </div>
                `;
                inverseOption.insertAdjacentHTML('beforeend', detailsHTML);

                // Attach listener
                document.getElementById('inverseVerbInput')?.addEventListener('input', (e) => {
                    this.inverseVerb = e.target.value;
                });
            }
        } else {
            const detailsEl = inverseOption.querySelector('.inverse-details');
            if (detailsEl) detailsEl.remove();
        }
    }

    /**
     * Create the link column
     */
    create() {
        if (!this.canCreate()) return;

        // Generate field ID
        const fieldId = this.slugify(this.fieldName);
        const existingIds = this.currentSet.schema.map(f => f.id);
        const uniqueId = this.ensureUniqueId(fieldId, existingIds);

        // Create the new LINK_RECORD field
        const newField = {
            id: uniqueId,
            name: this.fieldName,
            type: 'LINK_RECORD',
            width: '200px',
            config: {
                linkedSetId: this.selectedSetId,
                cardinality: this.cardinality,
                relationshipVerb: this.relationshipVerb,
                inverseVerb: this.inverseVerb || null,
                createdAt: new Date().toISOString()
            }
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

        // Create inverse field if requested
        if (this.createInverse && this.inverseVerb) {
            const targetSet = this.state.sets.get(this.selectedSetId);
            if (targetSet) {
                const inverseFieldName = this.singularize(this.currentSet.name) || this.currentSet.name;
                const inverseFieldId = this.slugify(inverseFieldName);
                const targetExistingIds = targetSet.schema.map(f => f.id);
                const uniqueInverseId = this.ensureUniqueId(inverseFieldId, targetExistingIds);

                const inverseField = {
                    id: uniqueInverseId,
                    name: inverseFieldName,
                    type: 'LINK_RECORD',
                    width: '200px',
                    config: {
                        linkedSetId: this.currentSet.id,
                        cardinality: 'many', // Inverse is usually many
                        relationshipVerb: this.inverseVerb,
                        inverseVerb: this.relationshipVerb,
                        inverseLinkFieldId: uniqueId,
                        createdAt: new Date().toISOString()
                    }
                };

                targetSet.schema.push(inverseField);

                // Update our field with inverse reference
                newField.config.inverseLinkFieldId = uniqueInverseId;
            }
        }

        // Emit event if available
        if (typeof window.createEvent === 'function') {
            window.createEvent(
                'Create Field',
                'CRE',
                { type: 'Field', id: uniqueId, setId: this.currentSet.id },
                {
                    fieldName: this.fieldName,
                    fieldType: 'LINK_RECORD',
                    linkedSetId: this.selectedSetId,
                    relationshipVerb: this.relationshipVerb,
                    summary: `Created link column "${this.fieldName}" (${this.relationshipVerb} ${this.getSelectedSetName()})`
                }
            );
        }

        // Refresh the view
        if (window.renderCurrentView) {
            window.renderCurrentView();
        }

        // Show success toast
        if (window.showToast) {
            window.showToast(`✓ Created link column "${this.fieldName}"`);
        }

        this.close();
    }

    /**
     * Slugify a string for use as ID
     */
    slugify(str) {
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
    window.EOLinkColumnModal = EOLinkColumnModal;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EOLinkColumnModal };
}
