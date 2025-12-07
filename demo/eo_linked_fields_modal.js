/**
 * EO Linked Fields Modal
 *
 * Allows users to add lookup fields from linked/related sets.
 *
 * KEY CONCEPT: All lookups can optionally have a rollup formula.
 * - A lookup without a rollup formula returns the raw value(s)
 * - A lookup with a rollup formula aggregates the values
 *
 * REQUIREMENTS:
 * - Lookup fields REQUIRE a linked record field first
 * - All lookup fields CAN be rollups - the rollup formula is a parameter on the lookup
 *
 * Implements Airtable-style linked field UX with automatic cardinality detection.
 */

class EOLinkedFieldsModal {
    constructor() {
        this.modal = null;
        this.currentView = null;
        this.currentSet = null;
        this.linkedSets = [];
        this.selectedLinkedSet = null;
        this.selectedFields = new Map(); // fieldId -> { fieldName, fieldType, rollupFormula }
        this.state = null;
    }

    /**
     * Show the modal for the current view
     * @param {Object} view - Current view entity
     * @param {Object} set - Current set
     * @param {Object} state - Global state
     */
    show(view, set, state) {
        this.currentView = view;
        this.currentSet = set;
        this.state = state;
        this.selectedFields.clear();

        // Find all sets that are linked to the current set
        this.linkedSets = this.detectLinkedSets();

        if (this.linkedSets.length === 0) {
            // Show a more helpful message with guidance
            const message = 'No linked sets found.\n\n' +
                'To use this feature:\n' +
                '1. Add a field with type "Link Record" to this set, OR\n' +
                '2. Add a field with type "Link Record" in another set that links to this set.\n\n' +
                'Link Record fields create relationships between sets.';
            alert(message);
            return;
        }

        // Select first linked set by default
        this.selectedLinkedSet = this.linkedSets[0];

        this.render();
        this.attachEventListeners();
    }

    /**
     * Detect all sets that are linked to the current set
     * @returns {Array} Array of linked set info with cardinality
     */
    detectLinkedSets() {
        const linkedSets = [];
        const currentSetId = this.currentSet.id;

        // Find all LINK_RECORD fields in the current set (outgoing links)
        this.currentSet.schema.forEach(field => {
            if (field.type === 'LINK_RECORD' && field.config?.linkedSetId) {
                const targetSetId = field.config.linkedSetId;
                const targetSet = this.state.sets.get(targetSetId);

                if (!targetSet) return;

                // Check if already added
                if (linkedSets.find(ls => ls.setId === targetSetId && ls.direction === 'outgoing')) return;

                // Use configured cardinality, or detect from data as fallback
                let cardinality = field.config?.cardinality || null;
                if (cardinality === 'limit') {
                    const limit = field.config?.limit || 1;
                    cardinality = limit > 1 ? 'many' : 'one';
                }
                if (!cardinality) {
                    cardinality = this.detectCardinality(currentSetId, field.id, targetSetId);
                }

                linkedSets.push({
                    setId: targetSetId,
                    setName: targetSet.name,
                    fieldId: field.id,
                    fieldName: field.name,
                    cardinality: cardinality, // 'one' or 'many'
                    configuredCardinality: field.config?.cardinality || null,
                    configuredLimit: field.config?.limit || null,
                    recordCount: this.getLinkedRecordCount(currentSetId, field.id),
                    direction: 'outgoing'
                });
            }
        });

        // Also find sets that link TO this set (incoming links)
        this.state.sets.forEach((otherSet, otherSetId) => {
            if (otherSetId === currentSetId) return;

            otherSet.schema.forEach(field => {
                if (field.type === 'LINK_RECORD' && field.config?.linkedSetId === currentSetId) {
                    // Check if already added
                    if (linkedSets.find(ls => ls.setId === otherSetId && ls.direction === 'incoming')) return;

                    // Use configured cardinality, or detect from data as fallback
                    let cardinality = field.config?.cardinality || null;
                    if (cardinality === 'limit') {
                        const limit = field.config?.limit || 1;
                        cardinality = limit > 1 ? 'many' : 'one';
                    }
                    if (!cardinality) {
                        cardinality = this.detectCardinality(otherSetId, field.id, currentSetId);
                    }

                    linkedSets.push({
                        setId: otherSetId,
                        setName: otherSet.name,
                        fieldId: field.id,
                        fieldName: field.name,
                        cardinality: cardinality,
                        configuredCardinality: field.config?.cardinality || null,
                        configuredLimit: field.config?.limit || null,
                        recordCount: this.getLinkedRecordCount(otherSetId, field.id),
                        direction: 'incoming',
                        sourceSetId: otherSetId,
                        sourceSetName: otherSet.name
                    });
                }
            });
        });

        return linkedSets;
    }

    /**
     * Detect if a relationship is one-to-one or one-to-many
     * @param {string} sourceSetId - Source set ID
     * @param {string} fieldId - Link field ID
     * @param {string} targetSetId - Target set ID
     * @returns {string} 'one' or 'many'
     */
    detectCardinality(sourceSetId, fieldId, targetSetId) {
        const sourceSet = this.state.sets.get(sourceSetId);
        if (!sourceSet) return 'one';

        // Check if any record has an array value for this field
        const records = Array.from(sourceSet.records.values());

        for (const record of records) {
            const value = record[fieldId];

            // If value is an array, it's one-to-many
            if (Array.isArray(value) && value.length > 0) {
                return 'many';
            }
        }

        // Default to one-to-one if no arrays found
        return 'one';
    }

    /**
     * Get linked record count for display
     * @param {string} sourceSetId - Source set ID
     * @param {string} fieldId - Link field ID
     * @returns {string} Description like "1 record per observation" or "Multiple records linked"
     */
    getLinkedRecordCount(sourceSetId, fieldId) {
        const cardinality = this.detectCardinality(sourceSetId, fieldId, null);
        return cardinality === 'one' ? '1 record per observation' : 'Multiple records linked';
    }

    /**
     * Render the modal HTML
     */
    render() {
        const modalHTML = `
            <div class="eo-linked-fields-modal-overlay" id="eoLinkedFieldsModal">
                <div class="eo-linked-fields-modal">
                    <div class="eo-linked-fields-modal-header">
                        <div>
                            <h2 class="modal-title">Add Linked Fields</h2>
                            <p class="modal-subtitle">
                                This view shows <strong>${this.currentSet.name}</strong>. You can add fields from related records.
                            </p>
                        </div>
                        <button class="eo-modal-close" id="eoLinkedFieldsClose">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>

                    <div class="eo-linked-fields-modal-body">
                        <!-- LEFT PANEL: Linked Sets -->
                        <div class="eo-linked-fields-panel">
                            <h3 class="panel-title">Linked Sets</h3>
                            <div class="linked-sets-list" id="linkedSetsList">
                                ${this.renderLinkedSetsList()}
                            </div>
                        </div>

                        <!-- MIDDLE PANEL: Fields from selected linked set -->
                        <div class="eo-linked-fields-panel eo-linked-fields-panel-wide">
                            <h3 class="panel-title">Fields from ${this.selectedLinkedSet?.setName || ''}</h3>
                            <div class="fields-list" id="fieldsList">
                                ${this.renderFieldsList()}
                            </div>
                        </div>

                        <!-- RIGHT PANEL: Selected Fields Summary -->
                        <div class="eo-linked-fields-panel">
                            <h3 class="panel-title">Selected Fields</h3>
                            <div class="selected-fields-list" id="selectedFieldsList">
                                ${this.renderSelectedFieldsList()}
                            </div>
                        </div>
                    </div>

                    <div class="eo-linked-fields-modal-footer">
                        <button class="btn btn-secondary" id="eoLinkedFieldsCancel">Cancel</button>
                        <button class="btn btn-primary" id="eoLinkedFieldsAdd" ${this.selectedFields.size === 0 ? 'disabled' : ''}>
                            Add ${this.selectedFields.size || ''} Field${this.selectedFields.size !== 1 ? 's' : ''} to View
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('eoLinkedFieldsModal');
    }

    /**
     * Render the list of linked sets in left panel
     */
    renderLinkedSetsList() {
        return this.linkedSets.map(linkedSet => {
            const isActive = this.selectedLinkedSet?.setId === linkedSet.setId;
            return `
                <div class="linked-set-item ${isActive ? 'active' : ''}" data-set-id="${linkedSet.setId}">
                    <div class="linked-set-name">${linkedSet.setName}</div>
                    <div class="linked-set-meta">${linkedSet.recordCount}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render the list of fields from selected linked set
     */
    renderFieldsList() {
        if (!this.selectedLinkedSet) return '<p class="text-gray-500">Select a linked set</p>';

        const targetSet = this.state.sets.get(this.selectedLinkedSet.setId);
        if (!targetSet) return '<p class="text-gray-500">Set not found</p>';

        const cardinality = this.selectedLinkedSet.cardinality;

        return targetSet.schema.map(field => {
            const fieldKey = `${this.selectedLinkedSet.setId}.${field.id}`;
            const isSelected = this.selectedFields.has(fieldKey);
            const selectedConfig = this.selectedFields.get(fieldKey) || { rollupFormula: null };

            return `
                <div class="field-row" data-field-id="${field.id}" data-field-key="${fieldKey}">
                    <div class="field-label">
                        <input type="checkbox"
                               class="field-checkbox"
                               data-field-key="${fieldKey}"
                               ${isSelected ? 'checked' : ''}>
                        <span class="field-name">${field.name}</span>
                        <span class="field-type-badge">${field.type}</span>
                    </div>
                    <div class="agg-controls">
                        ${this.renderRollupFormulaControl(fieldKey, selectedConfig, field, cardinality)}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render rollup formula control for lookups
     * All lookups can optionally have a rollup formula
     */
    renderRollupFormulaControl(fieldKey, config, field, cardinality) {
        const rollupFormula = config.rollupFormula || null;
        const fieldType = field.type;

        // Get applicable aggregation functions for this field type
        const aggregations = this.getApplicableAggregations(fieldType);

        // For 1-to-1, default display shows single value; for 1-to-many, shows all values
        const defaultLabel = cardinality === 'one' ? '(single value)' : '(all values)';

        return `
            <select class="rollup-formula-select" data-field-key="${fieldKey}">
                <option value="" ${!rollupFormula ? 'selected' : ''}>No formula ${defaultLabel}</option>
                ${aggregations.map(agg => `
                    <option value="${agg.value}" ${rollupFormula === agg.value ? 'selected' : ''}>
                        ${agg.label}
                    </option>
                `).join('')}
            </select>
        `;
    }

    /**
     * Get applicable aggregation functions based on field type
     */
    getApplicableAggregations(fieldType) {
        const allAggregations = [
            { value: 'count', label: 'Count', types: ['*'] },
            { value: 'sum', label: 'Sum', types: ['NUMBER', 'FORMULA'] },
            { value: 'avg', label: 'Average', types: ['NUMBER', 'FORMULA'] },
            { value: 'min', label: 'Min', types: ['NUMBER', 'FORMULA', 'DATE'] },
            { value: 'max', label: 'Max', types: ['NUMBER', 'FORMULA', 'DATE'] },
            { value: 'arrayjoin', label: 'Array Join (comma)', types: ['TEXT', 'SELECT', 'CONTACT'] },
            { value: 'unique', label: 'Unique Values', types: ['*'] },
            { value: 'any', label: 'Any Value', types: ['*'] },
        ];

        return allAggregations.filter(agg =>
            agg.types.includes('*') || agg.types.includes(fieldType)
        );
    }

    /**
     * Render selected fields summary in right panel
     */
    renderSelectedFieldsList() {
        if (this.selectedFields.size === 0) {
            return '<p class="text-gray-500 text-sm">No fields selected</p>';
        }

        const items = [];
        this.selectedFields.forEach((config, fieldKey) => {
            const [setId, fieldId] = fieldKey.split('.');
            const targetSet = this.state.sets.get(setId);
            const field = targetSet?.schema.find(f => f.id === fieldId);

            if (!field || !targetSet) return;

            // Show lookup with optional rollup formula
            const formulaText = config.rollupFormula
                ? `with ${config.rollupFormula} formula`
                : '(raw values)';

            items.push(`
                <div class="summary-item">
                    <div class="summary-item-name">${targetSet.name} – ${field.name}</div>
                    <div class="summary-meta">Lookup ${formulaText}</div>
                </div>
            `);
        });

        return items.join('');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        const closeBtn = document.getElementById('eoLinkedFieldsClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Cancel button
        const cancelBtn = document.getElementById('eoLinkedFieldsCancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }

        // Add button
        const addBtn = document.getElementById('eoLinkedFieldsAdd');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addFieldsToView());
        }

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', this.handleEscapeKey.bind(this));

        // Linked set selection
        const linkedSetItems = this.modal.querySelectorAll('.linked-set-item');
        linkedSetItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const setId = e.currentTarget.dataset.setId;
                this.selectLinkedSet(setId);
            });
        });

        // Field checkbox toggle
        const checkboxes = this.modal.querySelectorAll('.field-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const fieldKey = e.target.dataset.fieldKey;
                this.toggleFieldSelection(fieldKey, e.target.checked);
            });
        });

        // Rollup formula select change
        this.attachRollupFormulaListeners();
    }

    /**
     * Attach rollup formula select listeners
     */
    attachRollupFormulaListeners() {
        const rollupFormulaSelects = this.modal.querySelectorAll('.rollup-formula-select');
        rollupFormulaSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const fieldKey = e.target.dataset.fieldKey;
                const rollupFormula = e.target.value || null;
                this.updateRollupFormula(fieldKey, rollupFormula);
            });
        });
    }

    /**
     * Handle escape key press
     */
    handleEscapeKey(e) {
        if (e.key === 'Escape' && this.modal) {
            this.close();
        }
    }

    /**
     * Select a linked set
     */
    selectLinkedSet(setId) {
        this.selectedLinkedSet = this.linkedSets.find(ls => ls.setId === setId);
        this.refreshMiddlePanel();
    }

    /**
     * Toggle field selection
     */
    toggleFieldSelection(fieldKey, isChecked) {
        if (isChecked) {
            const [setId, fieldId] = fieldKey.split('.');
            const targetSet = this.state.sets.get(setId);
            const field = targetSet?.schema.find(f => f.id === fieldId);

            if (!field) return;

            this.selectedFields.set(fieldKey, {
                fieldId,
                fieldName: field.name,
                fieldType: field.type,
                setId,
                setName: targetSet.name,
                rollupFormula: null, // No formula by default - returns raw value(s)
                linkFieldId: this.selectedLinkedSet.fieldId,
                cardinality: this.selectedLinkedSet.cardinality
            });
        } else {
            this.selectedFields.delete(fieldKey);
        }

        this.refreshRightPanel();
        this.refreshFooter();
    }

    /**
     * Update rollup formula for a lookup field
     */
    updateRollupFormula(fieldKey, rollupFormula) {
        const config = this.selectedFields.get(fieldKey);
        if (!config) return;

        config.rollupFormula = rollupFormula;
        this.selectedFields.set(fieldKey, config);

        this.refreshRightPanel();
    }

    /**
     * Refresh middle panel
     */
    refreshMiddlePanel() {
        const fieldsList = document.getElementById('fieldsList');
        if (fieldsList) {
            fieldsList.innerHTML = this.renderFieldsList();

            // Re-attach checkbox listeners
            const checkboxes = fieldsList.querySelectorAll('.field-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const fieldKey = e.target.dataset.fieldKey;
                    this.toggleFieldSelection(fieldKey, e.target.checked);
                });
            });

            // Re-attach rollup formula select listeners
            this.attachRollupFormulaListeners();
        }

        // Update linked sets list
        const linkedSetsList = document.getElementById('linkedSetsList');
        if (linkedSetsList) {
            linkedSetsList.innerHTML = this.renderLinkedSetsList();

            const linkedSetItems = linkedSetsList.querySelectorAll('.linked-set-item');
            linkedSetItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    const setId = e.currentTarget.dataset.setId;
                    this.selectLinkedSet(setId);
                });
            });
        }
    }

    /**
     * Refresh right panel
     */
    refreshRightPanel() {
        const selectedFieldsList = document.getElementById('selectedFieldsList');
        if (selectedFieldsList) {
            selectedFieldsList.innerHTML = this.renderSelectedFieldsList();
        }
    }

    /**
     * Refresh footer button
     */
    refreshFooter() {
        const addBtn = document.getElementById('eoLinkedFieldsAdd');
        if (addBtn) {
            addBtn.disabled = this.selectedFields.size === 0;
            addBtn.textContent = `Add ${this.selectedFields.size || ''} Field${this.selectedFields.size !== 1 ? 's' : ''} to View`;
        }
    }

    /**
     * Add selected fields to view
     *
     * All fields are stored as lookups in view.relationships.
     * Each lookup can optionally have a rollupFormula property.
     */
    addFieldsToView() {
        if (this.selectedFields.size === 0) return;

        // Initialize relationships array if needed
        if (!this.currentView.relationships) {
            this.currentView.relationships = [];
        }

        // Add all fields as lookups (with optional rollup formula)
        this.selectedFields.forEach((config, fieldKey) => {
            const displayName = config.rollupFormula
                ? `${config.setName} – ${config.fieldName} (${config.rollupFormula})`
                : `${config.setName} – ${config.fieldName}`;

            this.currentView.relationships.push({
                id: `lookup_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                type: 'lookup',
                sourceFieldId: config.linkFieldId,
                targetSetId: config.setId,
                targetFieldId: config.fieldId,
                rollupFormula: config.rollupFormula, // null if no aggregation, or aggregation function name
                cardinality: config.cardinality,
                displayName: displayName,
                createdAt: Date.now()
            });
        });

        // Mark view as dirty
        this.currentView.isDirty = true;

        // Update the view in state (it's already updated by reference, but ensure it's in the map)
        if (this.state.views && this.state.views instanceof Map) {
            this.state.views.set(this.currentView.id, this.currentView);
        }

        // Re-render the current view to show new fields
        if (window.renderCurrentView) {
            window.renderCurrentView();
        } else {
            console.warn('renderCurrentView function not found');
        }

        // Show success toast
        if (window.showToast) {
            window.showToast(`✓ Added ${this.selectedFields.size} linked field${this.selectedFields.size !== 1 ? 's' : ''} to view`);
        } else {
            alert(`Added ${this.selectedFields.size} linked field${this.selectedFields.size !== 1 ? 's' : ''} to view`);
        }

        this.close();
    }

    /**
     * Close the modal
     */
    close() {
        document.removeEventListener('keydown', this.handleEscapeKey.bind(this));

        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    window.EOLinkedFieldsModal = EOLinkedFieldsModal;
}
