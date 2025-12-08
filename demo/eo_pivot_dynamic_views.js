/**
 * EO Pivot and Dynamic Views
 *
 * This module provides advanced view creation features:
 *
 * 1. Pivot Column - Creates a non-editable pivot view from a column
 *    - The pivot view shows data organized around that column's values
 *    - Data in pivot views is read-only to preserve data integrity
 *
 * 2. Make Dynamic View - Creates a new linked "table" (set) from column values
 *    - Extracts unique values from the column into a new set
 *    - Creates a LINK_RECORD relationship back to the original set
 *    - The original view becomes a pivot table linked to the new dynamic set
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const PIVOT_VIEW_ICON = 'ph-chart-pie-slice';
    const DYNAMIC_VIEW_ICON = 'ph-link'; // Editable dynamic link (U+E2E2)
    const DYNAMIC_SET_ICON = 'ph-stack';

    // ============================================================================
    // PIVOT VIEW CREATION
    // ============================================================================

    /**
     * Create a pivot view from a column
     * The pivot view is non-editable (read-only) and organized around the column's values
     *
     * @param {Object} state - Application state
     * @param {string} setId - Source set ID
     * @param {Object} field - The field to pivot on
     * @param {Object} options - Additional options
     * @returns {Object} The created pivot view
     */
    function createPivotView(state, setId, field, options = {}) {
        const set = state.sets.get(setId);
        if (!set) {
            console.error('Cannot create pivot view: set not found');
            return null;
        }

        const currentViewId = state.currentViewId;
        const currentView = currentViewId ? state.views?.get(currentViewId) : null;

        // Generate unique view ID
        const viewId = `view_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const viewName = options.name || `${field.name} Pivot`;

        // Get unique values for the pivot field
        const uniqueValues = getUniqueFieldValues(set, field.id);

        // Build the pivot view configuration
        const pivotView = {
            id: viewId,
            name: viewName,
            setId: setId,
            type: 'grid',
            icon: PIVOT_VIEW_ICON,

            // Data configuration - put pivot field first
            visibleFieldIds: [field.id, ...(set.schema || []).map(f => f.id).filter(id => id !== field.id)],
            hiddenFields: [],
            columnOrder: [field.id, ...(set.schema || []).map(f => f.id).filter(id => id !== field.id)],
            columnWidths: {},
            columnWidthMode: 'auto',

            // View logic - group by pivot field
            filters: [],
            sorts: [{ fieldId: field.id, direction: 'asc' }],
            groups: [{ fieldId: field.id }],

            // Pivot-specific configuration
            isPivot: true,           // Mark as pivot view
            isReadOnly: true,        // Pivot views are read-only
            pivotFieldId: field.id,  // The field being pivoted on

            // Provenance
            provenance: {
                createdBy: state.currentUser || 'user',
                createdAt: Date.now(),
                updatedAt: null,
                derivedFromViewIds: currentView ? [currentView.id] : [],
                derivedFromOperationIds: [],
                notes: `Pivot view created from column "${field.name}"${currentView ? ` on "${currentView.name}"` : ''}`
            },

            // Pivot metadata for lineage tracking
            pivotMetadata: {
                sourceViewId: currentViewId,
                sourceViewName: currentView?.name,
                pivotField: field.id,
                pivotFieldName: field.name,
                pivotType: 'column_pivot',
                uniqueValueCount: uniqueValues.length,
                createdAt: Date.now()
            },

            // View mode - sandbox for exploratory
            viewMode: options.viewMode || 'sandbox',

            // State tracking
            isDirty: false,
            isTemporary: false
        };

        // Add to global views
        if (!state.views) {
            state.views = new Map();
        }
        state.views.set(viewId, pivotView);

        // Add reference to set
        if (!set.views) {
            set.views = new Map();
        }
        set.views.set(viewId, { id: viewId });

        // Log event
        logPivotEvent(state, {
            type: 'pivot_view_created',
            viewId: viewId,
            setId: setId,
            fieldId: field.id,
            fieldName: field.name
        });

        return pivotView;
    }

    /**
     * Check if a view is a pivot view (read-only)
     */
    function isPivotView(view) {
        return view?.isPivot === true || view?.isReadOnly === true;
    }

    /**
     * Check if editing is allowed for a view
     */
    function isViewEditable(view) {
        if (!view) return true;
        return !view.isPivot && !view.isReadOnly;
    }

    // ============================================================================
    // DYNAMIC VIEW CREATION
    // ============================================================================

    /**
     * Create a dynamic view from a column
     * This creates a new set from the unique values in the column and links it back
     *
     * @param {Object} state - Application state
     * @param {string} setId - Source set ID
     * @param {Object} field - The field to create dynamic view from
     * @param {Object} options - Additional options
     * @returns {Object} Object containing the new set, view, and link field info
     */
    function createDynamicView(state, setId, field, options = {}) {
        const sourceSet = state.sets.get(setId);
        if (!sourceSet) {
            console.error('Cannot create dynamic view: source set not found');
            return null;
        }

        // Get unique values from the column
        const uniqueValues = getUniqueFieldValues(sourceSet, field.id);

        if (uniqueValues.length === 0) {
            console.warn('No values found in column for dynamic view');
            return null;
        }

        // Generate IDs
        const newSetId = `set_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const newViewId = `view_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const linkFieldId = `fld_link_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const inverseLinkFieldId = `fld_inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

        // Create the new set name
        const newSetName = options.setName || `${field.name} Records`;

        // Build schema for the new set
        // Primary field is the value field, plus we add a link back to source
        const newSetSchema = [
            {
                id: 'name',
                name: field.name,
                type: field.type || 'TEXT',
                isPrimary: true
            },
            {
                id: inverseLinkFieldId,
                name: `${sourceSet.name} Records`,
                type: 'LINK_RECORD',
                config: {
                    linkedSetId: setId,
                    cardinality: 'many',
                    relationshipVerb: 'is referenced by',
                    inverseVerb: 'references',
                    inverseLinkFieldId: linkFieldId,
                    createdAt: Date.now()
                }
            }
        ];

        // Create records for each unique value
        const newRecords = new Map();
        uniqueValues.forEach((value, index) => {
            const recordId = `rec_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 5)}`;
            newRecords.set(recordId, {
                id: recordId,
                record_id: recordId,
                name: value !== null && value !== undefined ? String(value) : '',
                [inverseLinkFieldId]: [], // Will be populated when we link records
                created_at: Date.now(),
                updated_at: Date.now()
            });
        });

        // Create the new set
        const newSet = {
            id: newSetId,
            name: newSetName,
            schema: newSetSchema,
            records: newRecords,
            views: new Map(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            origin: 'dynamic',
            sourceSetId: setId,
            sourceFieldId: field.id,
            isDynamicSet: true
        };

        // Add new set to state
        state.sets.set(newSetId, newSet);

        // Create default view for the new set
        const newSetDefaultView = {
            id: newViewId,
            name: 'All Records',
            setId: newSetId,
            type: 'grid',
            icon: DYNAMIC_SET_ICON,
            visibleFieldIds: newSetSchema.map(f => f.id),
            hiddenFields: [],
            filters: [],
            sorts: [],
            groups: [],
            provenance: {
                createdBy: state.currentUser || 'user',
                createdAt: Date.now(),
                notes: `Default view for dynamic set created from "${field.name}"`
            },
            viewMode: 'live',
            isDirty: false
        };

        // Add view to state
        if (!state.views) state.views = new Map();
        state.views.set(newViewId, newSetDefaultView);
        newSet.views.set(newViewId, { id: newViewId });

        // Now add the link field to the source set
        const linkField = {
            id: linkFieldId,
            name: newSetName,
            type: 'LINK_RECORD',
            config: {
                linkedSetId: newSetId,
                cardinality: field.type === 'MULTI_SELECT' ? 'many' : 'one',
                relationshipVerb: 'references',
                inverseVerb: 'is referenced by',
                inverseLinkFieldId: inverseLinkFieldId,
                createdAt: Date.now(),
                isDynamicLink: true
            }
        };

        // Add link field to source set schema
        sourceSet.schema.push(linkField);

        // Build value-to-record mapping for the new set
        const valueToRecordId = new Map();
        newRecords.forEach((record, recordId) => {
            valueToRecordId.set(record.name, recordId);
        });

        // Update source records to link to the new set records
        sourceSet.records.forEach((record, recordId) => {
            const value = record[field.id];
            if (value !== null && value !== undefined && value !== '') {
                const linkedRecordId = valueToRecordId.get(String(value));
                if (linkedRecordId) {
                    // Set the link field value
                    record[linkFieldId] = [linkedRecordId];

                    // Update inverse link in new set
                    const linkedRecord = newRecords.get(linkedRecordId);
                    if (linkedRecord) {
                        if (!linkedRecord[inverseLinkFieldId]) {
                            linkedRecord[inverseLinkFieldId] = [];
                        }
                        linkedRecord[inverseLinkFieldId].push(recordId);
                    }
                }
            }
        });

        // Update all views in source set to include the new link field
        if (sourceSet.views) {
            sourceSet.views.forEach((viewRef, viewId) => {
                const view = state.views?.get(viewId);
                if (view && Array.isArray(view.visibleFieldIds)) {
                    view.visibleFieldIds.push(linkFieldId);
                }
            });
        }

        // Create a linked pivot view in the source set
        const linkedPivotViewId = `view_pivot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const currentView = state.currentViewId ? state.views?.get(state.currentViewId) : null;

        const linkedPivotView = {
            id: linkedPivotViewId,
            name: `${field.name} (Linked)`,
            setId: setId,
            type: 'grid',
            icon: DYNAMIC_VIEW_ICON,
            // Put the original field in column 1, then the rest of the data (pivoted)
            // The link field is available but not primary - editing the original field edits underlying data
            visibleFieldIds: [field.id, ...(sourceSet.schema || []).map(f => f.id).filter(id => id !== field.id && id !== linkFieldId), linkFieldId],
            hiddenFields: [], // Don't hide the original field - it's column 1
            // Column order: original field first, then other fields, link field last
            columnOrder: [field.id, ...(sourceSet.schema || []).map(f => f.id).filter(id => id !== field.id && id !== linkFieldId), linkFieldId],
            filters: [],
            sorts: [{ fieldId: field.id, direction: 'asc' }], // Sort by original field, not link
            groups: [],
            isPivot: false, // Not a pivot - editing allowed through link
            isLinkedView: true,
            dynamicLinkFieldId: linkFieldId,
            dynamicSetId: newSetId,
            provenance: {
                createdBy: state.currentUser || 'user',
                createdAt: Date.now(),
                derivedFromViewIds: currentView ? [currentView.id] : [],
                notes: `Linked view created from column "${field.name}" - dynamically linked to ${newSetName}`
            },
            pivotMetadata: {
                sourceViewId: state.currentViewId,
                sourceViewName: currentView?.name,
                pivotField: field.id,
                pivotFieldName: field.name,
                pivotType: 'dynamic_link',
                dynamicSetId: newSetId,
                dynamicSetName: newSetName,
                linkFieldId: linkFieldId,
                createdAt: Date.now()
            },
            viewMode: 'live',
            isDirty: false
        };

        state.views.set(linkedPivotViewId, linkedPivotView);
        sourceSet.views.set(linkedPivotViewId, { id: linkedPivotViewId });

        // Log event
        logPivotEvent(state, {
            type: 'dynamic_view_created',
            sourceSetId: setId,
            newSetId: newSetId,
            fieldId: field.id,
            fieldName: field.name,
            recordCount: uniqueValues.length,
            linkedPivotViewId: linkedPivotViewId
        });

        return {
            newSet: newSet,
            newSetView: newSetDefaultView,
            linkedPivotView: linkedPivotView,
            linkFieldId: linkFieldId,
            inverseLinkFieldId: inverseLinkFieldId,
            valueCount: uniqueValues.length
        };
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Get unique values from a field across all records
     */
    function getUniqueFieldValues(set, fieldId) {
        if (!set?.records) return [];

        const values = new Set();
        set.records.forEach(record => {
            const value = record[fieldId];
            if (value !== null && value !== undefined && value !== '') {
                // Handle arrays (multi-select)
                if (Array.isArray(value)) {
                    value.forEach(v => values.add(String(v)));
                } else {
                    values.add(String(value));
                }
            }
        });

        return Array.from(values).sort();
    }

    /**
     * Log pivot/dynamic view events
     */
    function logPivotEvent(state, event) {
        if (!state.eventStream) {
            state.eventStream = [];
        }

        state.eventStream.push({
            id: (state.eventIdCounter || 0) + 1,
            timestamp: Date.now(),
            user: state.currentUser,
            ...event
        });

        state.eventIdCounter = (state.eventIdCounter || 0) + 1;
    }

    // ============================================================================
    // UI COMPONENTS
    // ============================================================================

    /**
     * Show pivot/dynamic view creation dialog
     */
    function showPivotDynamicDialog(state, setId, field) {
        const set = state.sets.get(setId);
        if (!set) return;

        const uniqueValues = getUniqueFieldValues(set, field.id);

        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';
        dialog.id = 'pivotDynamicModal';
        dialog.innerHTML = `
            <div class="modal pivot-dynamic-modal">
                <div class="modal-header">
                    <h2>Create View from "${escapeHtml(field.name)}"</h2>
                    <button class="modal-close" onclick="closePivotDynamicModal()">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="pivot-info">
                        <div class="info-stat">
                            <span class="stat-label">Unique Values</span>
                            <span class="stat-value">${uniqueValues.length}</span>
                        </div>
                        <div class="info-stat">
                            <span class="stat-label">Total Records</span>
                            <span class="stat-value">${set.records?.size || 0}</span>
                        </div>
                    </div>

                    <div class="pivot-options">
                        <div class="option-card" data-option="pivot">
                            <div class="option-icon">
                                <i class="ph ${PIVOT_VIEW_ICON}"></i>
                            </div>
                            <div class="option-content">
                                <h3>Pivot Column</h3>
                                <p>Create a read-only pivot view grouped by this column's values. Data cannot be edited in pivot views.</p>
                                <ul class="option-features">
                                    <li><i class="ph ph-check"></i> Groups records by value</li>
                                    <li><i class="ph ph-check"></i> Read-only view</li>
                                    <li><i class="ph ph-check"></i> Quick analysis</li>
                                </ul>
                            </div>
                            <div class="option-select">
                                <input type="radio" name="pivotOption" value="pivot" id="optPivot" checked>
                                <label for="optPivot"></label>
                            </div>
                        </div>

                        <div class="option-card" data-option="dynamic">
                            <div class="option-icon">
                                <i class="ph ${DYNAMIC_VIEW_ICON}"></i>
                            </div>
                            <div class="option-content">
                                <h3>Make Dynamic View</h3>
                                <p>Create a new linked table from this column's values. Records become linked entities you can manage separately.</p>
                                <ul class="option-features">
                                    <li><i class="ph ph-check"></i> Creates new table with ${uniqueValues.length} records</li>
                                    <li><i class="ph ph-check"></i> Bidirectional linking</li>
                                    <li><i class="ph ph-check"></i> Full editing support</li>
                                </ul>
                            </div>
                            <div class="option-select">
                                <input type="radio" name="pivotOption" value="dynamic" id="optDynamic">
                                <label for="optDynamic"></label>
                            </div>
                        </div>
                    </div>

                    <div class="pivot-name-section">
                        <label for="pivotName">View/Table Name</label>
                        <input type="text" id="pivotName" value="${escapeHtml(field.name)}" placeholder="Enter name...">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closePivotDynamicModal()">Cancel</button>
                    <button class="btn btn-primary" id="btnCreatePivotDynamic">Create</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Store data for later
        dialog._state = state;
        dialog._setId = setId;
        dialog._field = field;

        // Event listeners
        dialog.querySelector('#btnCreatePivotDynamic').onclick = () => {
            const option = dialog.querySelector('input[name="pivotOption"]:checked').value;
            const name = dialog.querySelector('#pivotName').value.trim() || field.name;

            if (option === 'pivot') {
                executePivotColumnAction(state, setId, field, name);
            } else {
                executeDynamicViewAction(state, setId, field, name);
            }

            dialog.remove();
        };

        // Click outside to close
        dialog.onclick = (e) => {
            if (e.target === dialog) dialog.remove();
        };

        // Option card selection
        dialog.querySelectorAll('.option-card').forEach(card => {
            card.onclick = () => {
                const radio = card.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
            };
        });
    }

    /**
     * Execute pivot column action
     */
    function executePivotColumnAction(state, setId, field, name) {
        const pivotView = createPivotView(state, setId, field, {
            name: `${name} Pivot`,
            viewMode: 'sandbox'
        });

        if (pivotView) {
            state.currentViewId = pivotView.id;

            // Trigger re-render
            if (typeof renderSidebar === 'function') renderSidebar();
            if (typeof switchSet === 'function') switchSet(setId, pivotView.id);

            showPivotToast(`Pivot view created - data is read-only`, 'info');
        }
    }

    /**
     * Execute dynamic view action
     */
    function executeDynamicViewAction(state, setId, field, name) {
        const result = createDynamicView(state, setId, field, {
            setName: name
        });

        if (result) {
            state.currentViewId = result.linkedPivotView.id;

            // Trigger re-render
            if (typeof renderSidebar === 'function') renderSidebar();
            if (typeof switchSet === 'function') switchSet(setId, result.linkedPivotView.id);

            showPivotToast(`Dynamic view created - ${result.valueCount} records in new "${name}" table`, 'success');
        }
    }

    /**
     * Close the pivot/dynamic modal
     */
    function closePivotDynamicModal() {
        const modal = document.getElementById('pivotDynamicModal');
        if (modal) modal.remove();
    }

    /**
     * Show toast notification
     */
    function showPivotToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="ph ${type === 'success' ? 'ph-check-circle' : type === 'error' ? 'ph-x-circle' : 'ph-info'}"></i>
                <span>${escapeHtml(message)}</span>
            </div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Render pivot view indicator badge
     */
    function renderPivotViewBadge(view) {
        if (!view) return '';

        if (view.isPivot || view.isReadOnly) {
            return `
                <span class="view-badge pivot-badge" title="Pivot view - Read-only">
                    <i class="ph ${PIVOT_VIEW_ICON}"></i>
                    <span>Pivot</span>
                </span>
            `;
        }

        if (view.isLinkedView || view.pivotMetadata?.pivotType === 'dynamic_link') {
            return `
                <span class="view-badge dynamic-badge" title="Dynamic linked view">
                    <i class="ph ${DYNAMIC_VIEW_ICON}"></i>
                    <span>Linked</span>
                </span>
            `;
        }

        return '';
    }

    /**
     * Render read-only indicator overlay for pivot views
     */
    function renderPivotReadOnlyOverlay() {
        return `
            <div class="pivot-readonly-banner">
                <i class="ph ${PIVOT_VIEW_ICON}"></i>
                <span>Pivot View - Data is read-only</span>
                <button class="btn btn-sm btn-secondary" onclick="EOPivotDynamicViews.convertToEditableView()">
                    Make Editable
                </button>
            </div>
        `;
    }

    /**
     * Convert a pivot view to an editable view (removes read-only constraint)
     */
    function convertToEditableView(state, viewId) {
        const view = state?.views?.get(viewId || state?.currentViewId);
        if (!view) return;

        view.isPivot = false;
        view.isReadOnly = false;
        view.provenance.notes = (view.provenance.notes || '') + ' - Converted to editable view';
        view.provenance.updatedAt = Date.now();
        view.isDirty = true;

        showPivotToast('View is now editable', 'success');

        // Re-render
        if (typeof renderCurrentView === 'function') {
            renderCurrentView();
        }
    }

    // ============================================================================
    // CELL EDITING INTEGRATION
    // ============================================================================

    /**
     * Check if cell editing should be blocked for a pivot view
     * Call this from inline cell editor before allowing edits
     */
    function shouldBlockCellEdit(state, viewId, recordId, fieldId) {
        const view = state?.views?.get(viewId);
        if (!view) return false;

        // Block all edits in pivot views
        if (view.isPivot || view.isReadOnly) {
            return {
                blocked: true,
                reason: 'This is a pivot view. Data is read-only.',
                icon: PIVOT_VIEW_ICON
            };
        }

        return { blocked: false };
    }

    /**
     * Show blocked edit notification
     */
    function showBlockedEditNotification(reason) {
        showPivotToast(reason, 'info');
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

    const EOPivotDynamicViews = {
        // Core functions
        createPivotView,
        createDynamicView,
        isPivotView,
        isViewEditable,

        // UI functions
        showPivotDynamicDialog,
        closePivotDynamicModal,
        renderPivotViewBadge,
        renderPivotReadOnlyOverlay,
        convertToEditableView,

        // Cell editing integration
        shouldBlockCellEdit,
        showBlockedEditNotification,

        // Utilities
        getUniqueFieldValues,

        // Constants
        PIVOT_VIEW_ICON,
        DYNAMIC_VIEW_ICON,
        DYNAMIC_SET_ICON
    };

    // Export to global namespace
    global.EOPivotDynamicViews = EOPivotDynamicViews;
    global.closePivotDynamicModal = closePivotDynamicModal;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOPivotDynamicViews;
    }

})(typeof window !== 'undefined' ? window : global);
