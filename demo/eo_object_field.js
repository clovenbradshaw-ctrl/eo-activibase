/**
 * EO Object Field
 *
 * Implements OBJECT field type - composite fields with nested subfields.
 *
 * Key concepts:
 * - An OBJECT field contains multiple subfields (like a mini-schema)
 * - Each OBJECT field has an embedded set that stores its schema
 * - The embedded set can be "surfaced" as a real view
 * - When expanded, subfields can be "split out" into linked record + lookups
 *
 * Architecture:
 * - OBJECT field config stores: { embeddedSetId, subfields, displayTemplate, cardinality }
 * - Each OBJECT value is stored as { _id, subfield1, subfield2, ... } or array thereof
 * - Embedded sets are marked with isEmbedded: true and don't appear in main nav
 */

(function(global) {
    'use strict';

    // ============================================================================
    // OBJECT FIELD CREATION
    // ============================================================================

    /**
     * Create an OBJECT field with its embedded set and view
     * @param {Object} state - Global state
     * @param {string} setId - Parent set ID
     * @param {string} fieldName - Name for the OBJECT field
     * @param {Object} options - Creation options
     * @returns {Object} { fieldId, embeddedSetId, embeddedViewId }
     */
    function createObjectField(state, setId, fieldName, options = {}) {
        const set = state.sets.get(setId);
        if (!set) {
            console.error(`Set ${setId} not found`);
            return null;
        }

        // Generate IDs
        const fieldId = options.fieldId || generateId('fld');
        const embeddedSetId = generateId('set_obj');
        const embeddedViewId = generateId('view_obj');

        // Create the embedded set (hidden from main nav)
        const embeddedSet = {
            id: embeddedSetId,
            name: `_${fieldName}`,  // Underscore prefix indicates embedded
            isEmbedded: true,
            parentSetId: setId,
            parentFieldId: fieldId,
            schema: options.initialSubfields || [],
            records: new Map(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            views: new Map()
        };

        // Create the embedded view
        const embeddedView = {
            id: embeddedViewId,
            name: fieldName,
            setId: embeddedSetId,
            type: 'grid',
            visibleFieldIds: (options.initialSubfields || []).map(f => f.id),
            hiddenFields: [],
            columnOrder: (options.initialSubfields || []).map(f => f.id),
            filters: [],
            sorts: [],
            isEmbeddedView: true,
            parentSetId: setId,
            parentFieldId: fieldId,
            provenance: {
                createdBy: 'system',
                createdAt: Date.now(),
                notes: `Embedded view for OBJECT field ${fieldName}`
            }
        };

        // Add view to embedded set
        embeddedSet.views.set(embeddedViewId, { id: embeddedViewId });

        // Add embedded set to state
        state.sets.set(embeddedSetId, embeddedSet);

        // Add view to global views if it exists
        if (state.views) {
            state.views.set(embeddedViewId, embeddedView);
        }

        // Create the OBJECT field schema
        const objectField = {
            id: fieldId,
            name: fieldName,
            type: 'OBJECT',
            width: options.width || '200px',
            config: {
                embeddedSetId: embeddedSetId,
                embeddedViewId: embeddedViewId,
                subfields: options.initialSubfields || [],
                displayTemplate: options.displayTemplate || null,  // e.g., '{email}' or '{firstName} {lastName}'
                cardinality: options.cardinality || 'one',  // 'one' or 'many'
                isSplitOut: false  // Becomes true when promoted to visible set
            },
            hidden: false,
            locked: false
        };

        // Add field to parent set schema
        set.schema.push(objectField);

        // Initialize empty object values for existing records
        const defaultValue = options.cardinality === 'many' ? [] : {};
        set.records.forEach((record, recordId) => {
            if (record[fieldId] === undefined) {
                record[fieldId] = defaultValue;
            }
        });

        // Log event
        if (typeof logEvent === 'function') {
            logEvent(state, {
                type: 'object_field_created',
                entityType: 'Field',
                entityId: fieldId,
                data: {
                    setId,
                    fieldName,
                    embeddedSetId,
                    embeddedViewId,
                    cardinality: options.cardinality || 'one'
                }
            });
        }

        return {
            fieldId,
            embeddedSetId,
            embeddedViewId,
            field: objectField,
            embeddedSet,
            embeddedView
        };
    }

    // ============================================================================
    // SUBFIELD MANAGEMENT
    // ============================================================================

    /**
     * Add a subfield to an OBJECT field
     * @param {Object} state - Global state
     * @param {string} setId - Parent set ID
     * @param {string} objectFieldId - The OBJECT field ID
     * @param {Object} subfieldDef - Subfield definition { name, type, config }
     * @returns {Object} The created subfield
     */
    function addSubfield(state, setId, objectFieldId, subfieldDef) {
        const set = state.sets.get(setId);
        if (!set) return null;

        const objectField = set.schema.find(f => f.id === objectFieldId);
        if (!objectField || objectField.type !== 'OBJECT') {
            console.error(`Field ${objectFieldId} is not an OBJECT field`);
            return null;
        }

        const embeddedSet = state.sets.get(objectField.config.embeddedSetId);
        if (!embeddedSet) {
            console.error(`Embedded set not found for OBJECT field ${objectFieldId}`);
            return null;
        }

        // Generate subfield ID
        const subfieldId = generateId('sf');

        // Create subfield schema
        const subfield = {
            id: subfieldId,
            name: subfieldDef.name,
            type: subfieldDef.type || 'TEXT',
            width: subfieldDef.width || '150px',
            config: subfieldDef.config || {}
        };

        // Add to embedded set schema
        embeddedSet.schema.push(subfield);

        // Also update the config.subfields array for quick access
        if (!objectField.config.subfields) {
            objectField.config.subfields = [];
        }
        objectField.config.subfields.push(subfield);

        // Update embedded view to show new field
        const embeddedView = state.views?.get(objectField.config.embeddedViewId);
        if (embeddedView) {
            if (!embeddedView.visibleFieldIds) embeddedView.visibleFieldIds = [];
            if (!embeddedView.columnOrder) embeddedView.columnOrder = [];

            embeddedView.visibleFieldIds.push(subfieldId);
            embeddedView.columnOrder.push(subfieldId);
        }

        // Update timestamps
        embeddedSet.updatedAt = Date.now();

        return subfield;
    }

    /**
     * Remove a subfield from an OBJECT field
     */
    function removeSubfield(state, setId, objectFieldId, subfieldId) {
        const set = state.sets.get(setId);
        if (!set) return false;

        const objectField = set.schema.find(f => f.id === objectFieldId);
        if (!objectField || objectField.type !== 'OBJECT') return false;

        const embeddedSet = state.sets.get(objectField.config.embeddedSetId);
        if (!embeddedSet) return false;

        // Remove from embedded set schema
        embeddedSet.schema = embeddedSet.schema.filter(f => f.id !== subfieldId);

        // Remove from config.subfields
        if (objectField.config.subfields) {
            objectField.config.subfields = objectField.config.subfields.filter(f => f.id !== subfieldId);
        }

        // Remove from embedded view
        const embeddedView = state.views?.get(objectField.config.embeddedViewId);
        if (embeddedView) {
            embeddedView.visibleFieldIds = (embeddedView.visibleFieldIds || []).filter(id => id !== subfieldId);
            embeddedView.columnOrder = (embeddedView.columnOrder || []).filter(id => id !== subfieldId);
        }

        // Remove subfield values from all object instances
        set.records.forEach((record) => {
            const objectValue = record[objectFieldId];
            if (objectValue) {
                if (Array.isArray(objectValue)) {
                    objectValue.forEach(entry => delete entry[subfieldId]);
                } else {
                    delete objectValue[subfieldId];
                }
            }
        });

        return true;
    }

    // ============================================================================
    // OBJECT VALUE MANAGEMENT
    // ============================================================================

    /**
     * Set a value for an OBJECT field
     * @param {Object} state - Global state
     * @param {string} setId - Set ID
     * @param {string} recordId - Record ID
     * @param {string} objectFieldId - OBJECT field ID
     * @param {Object|Array} value - The object value(s)
     */
    function setObjectValue(state, setId, recordId, objectFieldId, value) {
        const set = state.sets.get(setId);
        if (!set) return false;

        const record = set.records.get(recordId);
        if (!record) return false;

        const objectField = set.schema.find(f => f.id === objectFieldId);
        if (!objectField || objectField.type !== 'OBJECT') return false;

        // Ensure value has _id for tracking
        if (objectField.config.cardinality === 'many') {
            if (!Array.isArray(value)) value = [value];
            value = value.map(v => ({
                _id: v._id || generateId('obj'),
                ...v
            }));
        } else {
            if (!value._id) value._id = generateId('obj');
        }

        record[objectFieldId] = value;
        return true;
    }

    /**
     * Add an entry to a multi-value OBJECT field
     */
    function addObjectEntry(state, setId, recordId, objectFieldId, entryData = {}) {
        const set = state.sets.get(setId);
        if (!set) return null;

        const record = set.records.get(recordId);
        if (!record) return null;

        const objectField = set.schema.find(f => f.id === objectFieldId);
        if (!objectField || objectField.type !== 'OBJECT') return null;

        if (objectField.config.cardinality !== 'many') {
            console.warn('addObjectEntry called on single-cardinality OBJECT field');
            return null;
        }

        const entry = {
            _id: generateId('obj'),
            ...entryData
        };

        if (!Array.isArray(record[objectFieldId])) {
            record[objectFieldId] = [];
        }

        record[objectFieldId].push(entry);
        return entry;
    }

    /**
     * Remove an entry from a multi-value OBJECT field
     */
    function removeObjectEntry(state, setId, recordId, objectFieldId, entryId) {
        const set = state.sets.get(setId);
        if (!set) return false;

        const record = set.records.get(recordId);
        if (!record) return false;

        if (!Array.isArray(record[objectFieldId])) return false;

        record[objectFieldId] = record[objectFieldId].filter(e => e._id !== entryId);
        return true;
    }

    // ============================================================================
    // DISPLAY RENDERING
    // ============================================================================

    /**
     * Get display value for an OBJECT field (for grid cell)
     * @param {Object} objectField - The OBJECT field schema
     * @param {Object|Array} value - The object value(s)
     * @returns {string} Formatted display string
     */
    function getObjectDisplayValue(objectField, value) {
        if (!value) return '';

        const config = objectField.config || {};
        const subfields = config.subfields || [];

        // Handle array of objects
        if (Array.isArray(value)) {
            if (value.length === 0) return '';

            // Get display for first entry
            const primaryDisplay = formatSingleObjectValue(value[0], config, subfields);

            if (value.length === 1) {
                return primaryDisplay;
            }

            // Show count for additional entries
            return `${primaryDisplay} +${value.length - 1}`;
        }

        // Single object
        return formatSingleObjectValue(value, config, subfields);
    }

    /**
     * Format a single object value for display
     */
    function formatSingleObjectValue(obj, config, subfields) {
        if (!obj || typeof obj !== 'object') return '';

        // Use display template if provided
        if (config.displayTemplate) {
            let display = config.displayTemplate;
            subfields.forEach(sf => {
                const placeholder = `{${sf.name}}`;
                const value = obj[sf.id] ?? obj[sf.name] ?? '';
                display = display.replace(placeholder, String(value));
            });
            return display.trim();
        }

        // Default: show first non-empty subfield value
        for (const sf of subfields) {
            const value = obj[sf.id] ?? obj[sf.name];
            if (value !== undefined && value !== null && value !== '') {
                return String(value);
            }
        }

        // Fallback: show object summary
        const nonEmpty = Object.entries(obj)
            .filter(([k, v]) => k !== '_id' && v !== undefined && v !== null && v !== '')
            .slice(0, 2);

        if (nonEmpty.length === 0) return '(empty)';

        return nonEmpty.map(([k, v]) => String(v)).join(', ');
    }

    /**
     * Render OBJECT field cell HTML
     */
    function renderObjectCell(objectField, value, options = {}) {
        const displayValue = getObjectDisplayValue(objectField, value);
        const isMultiple = Array.isArray(value) && value.length > 1;
        const isEmpty = !value || (Array.isArray(value) && value.length === 0) ||
                        (typeof value === 'object' && Object.keys(value).filter(k => k !== '_id').length === 0);

        const classes = [
            'eo-object-cell',
            isEmpty ? 'empty' : '',
            isMultiple ? 'multiple' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${classes}"
                 data-field-id="${objectField.id}"
                 data-field-type="OBJECT"
                 title="Click to expand">
                <span class="eo-object-value">${escapeHtml(displayValue) || '<span class="placeholder">Click to add...</span>'}</span>
                ${isMultiple ? `<span class="eo-object-count">+${value.length - 1}</span>` : ''}
                <span class="eo-object-expand-icon"><i class="ph ph-caret-right"></i></span>
            </div>
        `;
    }

    // ============================================================================
    // SPLIT OUT OPERATION
    // ============================================================================

    /**
     * Split out an OBJECT field into a visible linked set
     * This converts the embedded set to a regular set and creates lookup fields
     *
     * @param {Object} state - Global state
     * @param {string} setId - Parent set ID
     * @param {string} objectFieldId - OBJECT field ID
     * @param {Object} options - { subfieldIdsToShow: string[], createBackLink: boolean }
     * @returns {Object} { setId, viewId, lookupFieldIds }
     */
    function splitOutObjectField(state, setId, objectFieldId, options = {}) {
        const set = state.sets.get(setId);
        if (!set) return null;

        const objectField = set.schema.find(f => f.id === objectFieldId);
        if (!objectField || objectField.type !== 'OBJECT') return null;

        const embeddedSet = state.sets.get(objectField.config.embeddedSetId);
        if (!embeddedSet) return null;

        // 1. Make the embedded set visible
        embeddedSet.isEmbedded = false;
        embeddedSet.name = embeddedSet.name.replace(/^_/, '');  // Remove underscore prefix

        // 2. Migrate object data to linked records
        const lookupFieldIds = [];
        const subfieldIdsToShow = options.subfieldIdsToShow ||
            objectField.config.subfields.slice(0, 3).map(f => f.id);  // Default: first 3 subfields

        set.records.forEach((record, recordId) => {
            const objectValue = record[objectFieldId];
            if (!objectValue) return;

            const entries = Array.isArray(objectValue) ? objectValue : [objectValue];
            const linkedRecordIds = [];

            entries.forEach(entry => {
                // Create a record in the embedded set for each object entry
                const linkedRecordId = entry._id || generateId('rec');
                const linkedRecord = { id: linkedRecordId };

                // Copy subfield values
                objectField.config.subfields.forEach(sf => {
                    linkedRecord[sf.id] = entry[sf.id] ?? entry[sf.name] ?? '';
                });

                // Add back-link if requested
                if (options.createBackLink) {
                    linkedRecord._parentRecordId = recordId;
                    linkedRecord._parentSetId = setId;
                }

                embeddedSet.records.set(linkedRecordId, linkedRecord);
                linkedRecordIds.push(linkedRecordId);
            });

            // Update the parent record to store linked record IDs instead of inline data
            record[objectFieldId] = objectField.config.cardinality === 'many'
                ? linkedRecordIds
                : linkedRecordIds[0] || null;
        });

        // 3. Convert OBJECT field to LINKED_RECORD
        objectField.type = 'LINKED_RECORD';
        objectField.config = {
            linkedSetId: embeddedSet.id,
            cardinality: objectField.config.cardinality,
            previousType: 'OBJECT',
            wasSplitOut: true
        };

        // 4. Create LOOKUP fields for selected subfields
        subfieldIdsToShow.forEach(subfieldId => {
            const subfield = embeddedSet.schema.find(f => f.id === subfieldId);
            if (!subfield) return;

            const lookupFieldId = generateId('fld_lookup');
            const lookupField = {
                id: lookupFieldId,
                name: subfield.name,
                type: 'LOOKUP',
                width: subfield.width || '150px',
                config: {
                    sourceFieldId: objectFieldId,
                    targetSetId: embeddedSet.id,
                    targetFieldId: subfieldId,
                    createdFromSplitOut: true
                }
            };

            set.schema.push(lookupField);
            lookupFieldIds.push(lookupFieldId);
        });

        // 5. Create back-link field if requested
        if (options.createBackLink) {
            const backLinkFieldId = generateId('fld_backlink');
            embeddedSet.schema.push({
                id: backLinkFieldId,
                name: set.name,
                type: 'LINKED_RECORD',
                width: '150px',
                config: {
                    linkedSetId: setId,
                    cardinality: 'one',
                    isBackLink: true
                }
            });
        }

        // 6. Mark as split out
        objectField.config.isSplitOut = true;

        // Log event
        if (typeof logEvent === 'function') {
            logEvent(state, {
                type: 'object_field_split_out',
                entityType: 'Field',
                entityId: objectFieldId,
                data: {
                    setId,
                    embeddedSetId: embeddedSet.id,
                    lookupFieldIds,
                    subfieldCount: objectField.config.subfields?.length || 0
                }
            });
        }

        return {
            setId: embeddedSet.id,
            viewId: objectField.config.embeddedViewId,
            lookupFieldIds
        };
    }

    // ============================================================================
    // OBJECT FIELD MODAL
    // ============================================================================

    /**
     * Object Field Editor Modal
     * Opens when clicking on an OBJECT field cell
     */
    class EOObjectFieldModal {
        constructor() {
            this.modal = null;
            this.currentState = null;
            this.currentSetId = null;
            this.currentRecordId = null;
            this.currentFieldId = null;
            this.onSave = null;
        }

        /**
         * Show the modal for editing an OBJECT field value
         */
        show(state, setId, recordId, fieldId, options = {}) {
            this.currentState = state;
            this.currentSetId = setId;
            this.currentRecordId = recordId;
            this.currentFieldId = fieldId;
            this.onSave = options.onSave;

            const set = state.sets.get(setId);
            const record = set?.records.get(recordId);
            const field = set?.schema.find(f => f.id === fieldId);

            if (!set || !record || !field || field.type !== 'OBJECT') {
                console.error('Invalid OBJECT field context');
                return;
            }

            this.createModal(set, record, field);
            this.attachEventListeners();
        }

        createModal(set, record, field) {
            const value = record[field.id];
            const subfields = field.config.subfields || [];
            const isMultiple = field.config.cardinality === 'many';
            const entries = isMultiple ? (value || []) : [value || {}];

            const modalHTML = `
                <div class="eo-object-modal-overlay" id="eoObjectModal">
                    <div class="eo-object-modal">
                        <div class="eo-object-modal-header">
                            <div class="eo-object-modal-title">
                                <i class="ph ph-cube"></i>
                                <span>${escapeHtml(field.name)}</span>
                                ${isMultiple ? `<span class="entry-count">(${entries.length} entries)</span>` : ''}
                            </div>
                            <div class="eo-object-modal-actions">
                                <button class="btn btn-sm btn-secondary" id="eoObjectAddSubfield">
                                    <i class="ph ph-plus"></i> Add Subfield
                                </button>
                                <button class="btn btn-sm btn-secondary" id="eoObjectOpenView" title="Open as view">
                                    <i class="ph ph-arrows-out"></i>
                                </button>
                                <button class="eo-object-modal-close" id="eoObjectModalClose">
                                    <i class="ph ph-x"></i>
                                </button>
                            </div>
                        </div>

                        <div class="eo-object-modal-body">
                            ${subfields.length === 0 ? `
                                <div class="eo-object-empty-state">
                                    <i class="ph ph-cube-transparent"></i>
                                    <p>No subfields defined yet</p>
                                    <button class="btn btn-primary" id="eoObjectAddFirstSubfield">
                                        <i class="ph ph-plus"></i> Add First Subfield
                                    </button>
                                </div>
                            ` : `
                                <div class="eo-object-entries" id="eoObjectEntries">
                                    ${entries.map((entry, idx) => this.renderEntry(entry, idx, subfields, isMultiple)).join('')}
                                </div>
                                ${isMultiple ? `
                                    <button class="btn btn-secondary btn-sm eo-add-entry-btn" id="eoObjectAddEntry">
                                        <i class="ph ph-plus"></i> Add Entry
                                    </button>
                                ` : ''}
                            `}
                        </div>

                        <div class="eo-object-modal-footer">
                            <div class="footer-left">
                                <button class="btn btn-sm btn-secondary" id="eoObjectSplitOut" title="Split to separate table">
                                    <i class="ph ph-arrows-split"></i> Split to Table
                                </button>
                            </div>
                            <div class="footer-right">
                                <button class="btn btn-secondary" id="eoObjectCancel">Cancel</button>
                                <button class="btn btn-primary" id="eoObjectSave">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.modal = document.getElementById('eoObjectModal');
        }

        renderEntry(entry, index, subfields, isMultiple) {
            const entryId = entry._id || `temp_${index}`;

            return `
                <div class="eo-object-entry" data-entry-id="${entryId}" data-entry-index="${index}">
                    ${isMultiple ? `
                        <div class="eo-entry-header">
                            <span class="entry-number">#${index + 1}</span>
                            <button class="eo-entry-remove" data-entry-id="${entryId}" title="Remove entry">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    ` : ''}
                    <div class="eo-subfields">
                        ${subfields.map(sf => this.renderSubfieldInput(sf, entry[sf.id] ?? entry[sf.name] ?? '', entryId)).join('')}
                    </div>
                </div>
            `;
        }

        renderSubfieldInput(subfield, value, entryId) {
            const inputId = `sf_${entryId}_${subfield.id}`;

            let inputHtml = '';
            switch (subfield.type) {
                case 'LONG_TEXT':
                    inputHtml = `<textarea id="${inputId}" class="eo-subfield-input"
                                          data-subfield-id="${subfield.id}"
                                          rows="2">${escapeHtml(value)}</textarea>`;
                    break;
                case 'NUMBER':
                    inputHtml = `<input type="number" id="${inputId}" class="eo-subfield-input"
                                        data-subfield-id="${subfield.id}"
                                        value="${escapeHtml(value)}" step="any">`;
                    break;
                case 'DATE':
                    inputHtml = `<input type="date" id="${inputId}" class="eo-subfield-input"
                                        data-subfield-id="${subfield.id}"
                                        value="${escapeHtml(value)}">`;
                    break;
                case 'CHECKBOX':
                    inputHtml = `<input type="checkbox" id="${inputId}" class="eo-subfield-checkbox"
                                        data-subfield-id="${subfield.id}"
                                        ${value ? 'checked' : ''}>`;
                    break;
                case 'EMAIL':
                    inputHtml = `<input type="email" id="${inputId}" class="eo-subfield-input"
                                        data-subfield-id="${subfield.id}"
                                        value="${escapeHtml(value)}" placeholder="email@example.com">`;
                    break;
                case 'URL':
                    inputHtml = `<input type="url" id="${inputId}" class="eo-subfield-input"
                                        data-subfield-id="${subfield.id}"
                                        value="${escapeHtml(value)}" placeholder="https://...">`;
                    break;
                default:
                    inputHtml = `<input type="text" id="${inputId}" class="eo-subfield-input"
                                        data-subfield-id="${subfield.id}"
                                        value="${escapeHtml(value)}">`;
            }

            return `
                <div class="eo-subfield-row">
                    <label class="eo-subfield-label" for="${inputId}">
                        ${escapeHtml(subfield.name)}
                        <span class="eo-subfield-type">${subfield.type.toLowerCase()}</span>
                    </label>
                    ${inputHtml}
                </div>
            `;
        }

        attachEventListeners() {
            // Close button
            this.modal.querySelector('#eoObjectModalClose')?.addEventListener('click', () => this.close());
            this.modal.querySelector('#eoObjectCancel')?.addEventListener('click', () => this.close());

            // Click outside to close
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });

            // Escape key
            this.escHandler = (e) => {
                if (e.key === 'Escape') this.close();
            };
            document.addEventListener('keydown', this.escHandler);

            // Save button
            this.modal.querySelector('#eoObjectSave')?.addEventListener('click', () => this.save());

            // Add subfield buttons
            this.modal.querySelector('#eoObjectAddSubfield')?.addEventListener('click', () => this.showAddSubfieldDialog());
            this.modal.querySelector('#eoObjectAddFirstSubfield')?.addEventListener('click', () => this.showAddSubfieldDialog());

            // Add entry button
            this.modal.querySelector('#eoObjectAddEntry')?.addEventListener('click', () => this.addEntry());

            // Remove entry buttons
            this.modal.querySelectorAll('.eo-entry-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const entryId = e.currentTarget.dataset.entryId;
                    this.removeEntry(entryId);
                });
            });

            // Open view button
            this.modal.querySelector('#eoObjectOpenView')?.addEventListener('click', () => this.openAsView());

            // Split out button
            this.modal.querySelector('#eoObjectSplitOut')?.addEventListener('click', () => this.showSplitOutDialog());
        }

        save() {
            const set = this.currentState.sets.get(this.currentSetId);
            const record = set?.records.get(this.currentRecordId);
            const field = set?.schema.find(f => f.id === this.currentFieldId);

            if (!set || !record || !field) return;

            const isMultiple = field.config.cardinality === 'many';
            const entryElements = this.modal.querySelectorAll('.eo-object-entry');
            const values = [];

            entryElements.forEach(entryEl => {
                const entryId = entryEl.dataset.entryId;
                const entry = { _id: entryId.startsWith('temp_') ? generateId('obj') : entryId };

                entryEl.querySelectorAll('.eo-subfield-input, .eo-subfield-checkbox').forEach(input => {
                    const subfieldId = input.dataset.subfieldId;
                    if (input.type === 'checkbox') {
                        entry[subfieldId] = input.checked;
                    } else {
                        entry[subfieldId] = input.value;
                    }
                });

                values.push(entry);
            });

            // Update record
            record[this.currentFieldId] = isMultiple ? values : (values[0] || {});

            // Call save callback
            if (this.onSave) {
                this.onSave(record[this.currentFieldId]);
            }

            this.close();

            // Refresh view if available
            if (typeof renderCurrentView === 'function') {
                renderCurrentView();
            }

            if (typeof showToast === 'function') {
                showToast('Object updated');
            }
        }

        addEntry() {
            const set = this.currentState.sets.get(this.currentSetId);
            const field = set?.schema.find(f => f.id === this.currentFieldId);
            if (!field) return;

            const subfields = field.config.subfields || [];
            const entriesContainer = this.modal.querySelector('#eoObjectEntries');
            const currentCount = entriesContainer.querySelectorAll('.eo-object-entry').length;

            const newEntryHtml = this.renderEntry({}, currentCount, subfields, true);
            entriesContainer.insertAdjacentHTML('beforeend', newEntryHtml);

            // Attach remove listener to new entry
            const newEntry = entriesContainer.lastElementChild;
            newEntry.querySelector('.eo-entry-remove')?.addEventListener('click', (e) => {
                const entryId = e.currentTarget.dataset.entryId;
                this.removeEntry(entryId);
            });

            // Focus first input
            newEntry.querySelector('input, textarea')?.focus();
        }

        removeEntry(entryId) {
            const entryEl = this.modal.querySelector(`.eo-object-entry[data-entry-id="${entryId}"]`);
            if (entryEl) {
                entryEl.remove();
                // Renumber remaining entries
                const entries = this.modal.querySelectorAll('.eo-object-entry');
                entries.forEach((el, idx) => {
                    const numSpan = el.querySelector('.entry-number');
                    if (numSpan) numSpan.textContent = `#${idx + 1}`;
                });
            }
        }

        showAddSubfieldDialog() {
            const dialogHtml = `
                <div class="eo-subfield-dialog-overlay" id="eoSubfieldDialog">
                    <div class="eo-subfield-dialog">
                        <h3>Add Subfield</h3>
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" id="newSubfieldName" placeholder="e.g., Phone, Email, Address">
                        </div>
                        <div class="form-group">
                            <label>Type</label>
                            <select id="newSubfieldType">
                                <option value="TEXT">Text</option>
                                <option value="NUMBER">Number</option>
                                <option value="DATE">Date</option>
                                <option value="EMAIL">Email</option>
                                <option value="URL">URL</option>
                                <option value="CHECKBOX">Checkbox</option>
                                <option value="LONG_TEXT">Long Text</option>
                            </select>
                        </div>
                        <div class="dialog-actions">
                            <button class="btn btn-secondary" id="cancelSubfieldBtn">Cancel</button>
                            <button class="btn btn-primary" id="addSubfieldBtn">Add</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', dialogHtml);
            const dialog = document.getElementById('eoSubfieldDialog');

            dialog.querySelector('#cancelSubfieldBtn').addEventListener('click', () => dialog.remove());
            dialog.querySelector('#addSubfieldBtn').addEventListener('click', () => {
                const name = document.getElementById('newSubfieldName').value.trim();
                const type = document.getElementById('newSubfieldType').value;

                if (!name) {
                    alert('Please enter a subfield name');
                    return;
                }

                // Add subfield
                const subfield = addSubfield(
                    this.currentState,
                    this.currentSetId,
                    this.currentFieldId,
                    { name, type }
                );

                if (subfield) {
                    dialog.remove();
                    // Refresh modal
                    this.close();
                    this.show(this.currentState, this.currentSetId, this.currentRecordId, this.currentFieldId, {
                        onSave: this.onSave
                    });
                }
            });

            document.getElementById('newSubfieldName').focus();
        }

        openAsView() {
            const set = this.currentState.sets.get(this.currentSetId);
            const field = set?.schema.find(f => f.id === this.currentFieldId);
            if (!field) return;

            const embeddedViewId = field.config.embeddedViewId;
            const embeddedSetId = field.config.embeddedSetId;

            this.close();

            // Navigate to the embedded view
            if (typeof switchSet === 'function') {
                switchSet(embeddedSetId, embeddedViewId);
            }
        }

        showSplitOutDialog() {
            const set = this.currentState.sets.get(this.currentSetId);
            const field = set?.schema.find(f => f.id === this.currentFieldId);
            if (!field) return;

            const subfields = field.config.subfields || [];

            const dialogHtml = `
                <div class="eo-splitout-dialog-overlay" id="eoSplitOutDialog">
                    <div class="eo-splitout-dialog">
                        <h3>Split to Table</h3>
                        <p class="dialog-description">
                            This will convert "${escapeHtml(field.name)}" to a linked record field
                            and create a separate table for the data.
                        </p>

                        <div class="form-group">
                            <label>Subfields to show as columns:</label>
                            <div class="subfield-checkboxes">
                                ${subfields.map((sf, idx) => `
                                    <label class="subfield-checkbox">
                                        <input type="checkbox" value="${sf.id}" ${idx < 3 ? 'checked' : ''}>
                                        ${escapeHtml(sf.name)}
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="createBackLink" checked>
                                Create back-link to ${escapeHtml(set.name)}
                            </label>
                        </div>

                        <div class="dialog-actions">
                            <button class="btn btn-secondary" id="cancelSplitOutBtn">Cancel</button>
                            <button class="btn btn-primary" id="confirmSplitOutBtn">Split to Table</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', dialogHtml);
            const dialog = document.getElementById('eoSplitOutDialog');

            dialog.querySelector('#cancelSplitOutBtn').addEventListener('click', () => dialog.remove());
            dialog.querySelector('#confirmSplitOutBtn').addEventListener('click', () => {
                const selectedSubfields = Array.from(
                    dialog.querySelectorAll('.subfield-checkboxes input:checked')
                ).map(cb => cb.value);

                const createBackLink = document.getElementById('createBackLink').checked;

                const result = splitOutObjectField(
                    this.currentState,
                    this.currentSetId,
                    this.currentFieldId,
                    { subfieldIdsToShow: selectedSubfields, createBackLink }
                );

                dialog.remove();
                this.close();

                if (result) {
                    if (typeof renderCurrentView === 'function') {
                        renderCurrentView();
                    }
                    if (typeof showToast === 'function') {
                        showToast(`"${field.name}" split to separate table`);
                    }
                }
            });
        }

        close() {
            document.removeEventListener('keydown', this.escHandler);
            if (this.modal) {
                this.modal.remove();
                this.modal = null;
            }
        }
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    function generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOObjectField = {
        // Field creation
        createObjectField,
        addSubfield,
        removeSubfield,

        // Value management
        setObjectValue,
        addObjectEntry,
        removeObjectEntry,

        // Display
        getObjectDisplayValue,
        renderObjectCell,

        // Split out
        splitOutObjectField,

        // Modal
        ObjectFieldModal: EOObjectFieldModal
    };

    global.EOObjectField = EOObjectField;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOObjectField;
    }

})(typeof window !== 'undefined' ? window : global);
