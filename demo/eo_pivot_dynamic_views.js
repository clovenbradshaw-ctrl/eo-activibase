/**
 * EO Pivot and Dynamic Views
 *
 * This module provides advanced data organization features:
 *
 * 1. Pivot - Creates a non-editable pivot from a column's key values
 *    - Pivots show data organized around unique key values
 *    - Data in pivots is static (snapshot) - read-only to preserve integrity
 *    - Pivots are fundamentally key-based groupings of data
 *
 * 2. Dynamic Set - Creates a new linked "table" (set) from column values
 *    - Extracts unique values from the column into a new set
 *    - Creates a LINK_RECORD relationship back to the original set
 *    - All data within a set is dynamic unless in a scratchpad
 *
 * Data Philosophy:
 * - Within a set: All data is dynamic (live, editable) unless in a scratchpad
 * - Pivots: Static snapshots organized by key values (read-only)
 * - Across sets: Lookup fields join data from different datasets
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const PIVOT_VIEW_ICON = 'ph-chart-pie-slice';
    const DYNAMIC_VIEW_ICON = 'ph-link-simple';
    const DYNAMIC_SET_ICON = 'ph-stack';

    // ============================================================================
    // PIVOT VIEW CREATION
    // ============================================================================

    /**
     * Create a pivot from a column's key values
     * Pivots are static snapshots - read-only and organized around key values
     * Data in pivots is non-dynamic (frozen at creation time)
     *
     * @param {Object} state - Application state
     * @param {string} setId - Source set ID
     * @param {Object} field - The field to pivot on (the key field)
     * @param {Object} options - Additional options
     * @returns {Object} The created pivot
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

        // Build the pivot configuration
        // Pivots are key-based static views - data is non-dynamic (snapshot)
        const pivotView = {
            id: viewId,
            name: viewName,
            setId: setId,
            type: 'grid',
            icon: PIVOT_VIEW_ICON,

            // Data configuration - put pivot key field first
            visibleFieldIds: [field.id, ...(set.schema || []).map(f => f.id).filter(id => id !== field.id)],
            hiddenFields: [],
            columnOrder: [field.id, ...(set.schema || []).map(f => f.id).filter(id => id !== field.id)],
            columnWidths: {},
            columnWidthMode: 'auto',

            // View logic - group by pivot key field
            filters: [],
            sorts: [{ fieldId: field.id, direction: 'asc' }],
            groups: [{ fieldId: field.id }],

            // Pivot-specific configuration
            isPivot: true,           // Mark as pivot (key-based grouping)
            isReadOnly: true,        // Pivots are read-only (static data)
            pivotFieldId: field.id,  // The key field being pivoted on
            dataMode: 'static',      // Data is non-dynamic (snapshot at creation)

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
                pivotType: 'key_pivot',
                uniqueValueCount: uniqueValues.length,
                createdAt: Date.now(),
                snapshotTimestamp: Date.now()  // When the static data was captured
            },

            // Data source indicator - derived for pivot views
            dataSource: 'derived',

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
            dataSource: 'live',
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
            visibleFieldIds: [linkFieldId, ...(sourceSet.schema || []).map(f => f.id).filter(id => id !== linkFieldId && id !== field.id)],
            hiddenFields: [field.id], // Hide original field, show link instead
            filters: [],
            sorts: [{ fieldId: linkFieldId, direction: 'asc' }],
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
            dataSource: 'live',
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
                                <h3>Create Pivot</h3>
                                <p>Create a pivot organized by this column's key values. Data is static (snapshot) and cannot be edited.</p>
                                <ul class="option-features">
                                    <li><i class="ph ph-check"></i> Groups by key values</li>
                                    <li><i class="ph ph-check"></i> Static snapshot</li>
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
                                <h3>Create Dynamic Set</h3>
                                <p>Create a new linked set from unique values. Data stays dynamic and editable across sets via lookups.</p>
                                <ul class="option-features">
                                    <li><i class="ph ph-check"></i> Creates new set with ${uniqueValues.length} records</li>
                                    <li><i class="ph ph-check"></i> Bidirectional linking</li>
                                    <li><i class="ph ph-check"></i> Dynamic data via lookups</li>
                                </ul>
                            </div>
                            <div class="option-select">
                                <input type="radio" name="pivotOption" value="dynamic" id="optDynamic">
                                <label for="optDynamic"></label>
                            </div>
                        </div>
                    </div>

                    <div class="pivot-name-section">
                        <label for="pivotName">Pivot/Set Name</label>
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
            name: `${name} Pivot`
        });

        if (pivotView) {
            state.currentViewId = pivotView.id;

            // Trigger re-render
            if (typeof renderSidebar === 'function') renderSidebar();
            if (typeof switchSet === 'function') switchSet(setId, pivotView.id);

            showPivotToast(`Pivot created - static data snapshot`, 'info');
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
     * Render pivot indicator badge
     */
    function renderPivotViewBadge(view) {
        if (!view) return '';

        if (view.isPivot || view.isReadOnly) {
            return `
                <span class="view-badge pivot-badge" title="Pivot - Static data snapshot">
                    <i class="ph ${PIVOT_VIEW_ICON}"></i>
                    <span>Pivot</span>
                </span>
            `;
        }

        if (view.isLinkedView || view.pivotMetadata?.pivotType === 'dynamic_link') {
            return `
                <span class="view-badge dynamic-badge" title="Dynamic set - Data linked across sets">
                    <i class="ph ${DYNAMIC_VIEW_ICON}"></i>
                    <span>Linked</span>
                </span>
            `;
        }

        return '';
    }

    /**
     * Render read-only indicator overlay for pivots
     */
    function renderPivotReadOnlyOverlay() {
        return `
            <div class="pivot-readonly-banner">
                <i class="ph ${PIVOT_VIEW_ICON}"></i>
                <span>Pivot - Static snapshot (data is non-dynamic)</span>
                <button class="btn btn-sm btn-secondary" onclick="EOPivotDynamicViews.convertToEditableView()">
                    Make Dynamic
                </button>
            </div>
        `;
    }

    /**
     * Convert a pivot to dynamic data (removes static/read-only constraint)
     */
    function convertToEditableView(state, viewId) {
        const view = state?.views?.get(viewId || state?.currentViewId);
        if (!view) return;

        view.isPivot = false;
        view.isReadOnly = false;
        view.dataMode = 'dynamic';  // Switch from static to dynamic
        view.provenance.notes = (view.provenance.notes || '') + ' - Converted from static pivot to dynamic view';
        view.provenance.updatedAt = Date.now();
        view.isDirty = true;

        showPivotToast('Data is now dynamic (editable)', 'success');

        // Re-render
        if (typeof renderCurrentView === 'function') {
            renderCurrentView();
        }
    }

    // ============================================================================
    // CELL EDITING INTEGRATION
    // ============================================================================

    /**
     * Check if cell editing should be blocked for a pivot
     * Call this from inline cell editor before allowing edits
     */
    function shouldBlockCellEdit(state, viewId, recordId, fieldId) {
        const view = state?.views?.get(viewId);
        if (!view) return false;

        // Block all edits in pivots (static data)
        if (view.isPivot || view.isReadOnly || view.dataMode === 'static') {
            return {
                blocked: true,
                reason: 'This is a pivot with static data. Convert to dynamic to edit.',
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
    // ENHANCED PIVOT TABLE CONFIGURATION
    // ============================================================================

    /**
     * Standard pivot table aggregation functions
     */
    const PIVOT_AGGREGATIONS = {
        count: {
            label: 'Count',
            icon: 'ph-hash',
            apply: (values) => values.length,
            applicableTypes: ['*']
        },
        countUnique: {
            label: 'Count Unique',
            icon: 'ph-fingerprint',
            apply: (values) => new Set(values.filter(v => v != null)).size,
            applicableTypes: ['*']
        },
        sum: {
            label: 'Sum',
            icon: 'ph-plus',
            apply: (values) => values.reduce((sum, v) => sum + (parseFloat(v) || 0), 0),
            applicableTypes: ['NUMBER', 'FORMULA']
        },
        average: {
            label: 'Average',
            icon: 'ph-chart-line',
            apply: (values) => {
                const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
                return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
            },
            applicableTypes: ['NUMBER', 'FORMULA']
        },
        min: {
            label: 'Min',
            icon: 'ph-arrow-down',
            apply: (values) => {
                const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
                return nums.length > 0 ? Math.min(...nums) : null;
            },
            applicableTypes: ['NUMBER', 'FORMULA', 'DATE']
        },
        max: {
            label: 'Max',
            icon: 'ph-arrow-up',
            apply: (values) => {
                const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
                return nums.length > 0 ? Math.max(...nums) : null;
            },
            applicableTypes: ['NUMBER', 'FORMULA', 'DATE']
        },
        first: {
            label: 'First',
            icon: 'ph-arrow-line-left',
            apply: (values) => values.length > 0 ? values[0] : null,
            applicableTypes: ['*']
        },
        last: {
            label: 'Last',
            icon: 'ph-arrow-line-right',
            apply: (values) => values.length > 0 ? values[values.length - 1] : null,
            applicableTypes: ['*']
        },
        list: {
            label: 'List All',
            icon: 'ph-list',
            apply: (values) => values.filter(v => v != null).join(', '),
            applicableTypes: ['*']
        }
    };

    /**
     * Create an enhanced pivot table view with multiple groupings and aggregations
     * @param {Object} state - Application state
     * @param {string} setId - Source set ID
     * @param {Object} config - Pivot configuration
     * @returns {Object} The created pivot view
     */
    function createEnhancedPivotView(state, setId, config = {}) {
        const set = state.sets.get(setId);
        if (!set) {
            console.error('Cannot create pivot view: set not found');
            return null;
        }

        const {
            name = 'Pivot Table',
            rowGroupFields = [],      // Fields to group by in rows
            columnGroupField = null,  // Field to pivot into columns
            valueFields = [],         // Fields to aggregate with their aggregation type
            showSubtotals = true,
            showGrandTotal = true,
            sortRowsBy = 'label',     // 'label' | 'value' | 'count'
            sortDirection = 'asc'
        } = config;

        const currentViewId = state.currentViewId;
        const currentView = currentViewId ? state.views?.get(currentViewId) : null;
        const viewId = `view_pivot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        // Build pivot view configuration
        const pivotView = {
            id: viewId,
            name: name,
            setId: setId,
            type: 'grid',
            icon: PIVOT_VIEW_ICON,

            // Pivot-specific configuration
            isPivot: true,
            isReadOnly: true,
            pivotConfig: {
                rowGroupFields: rowGroupFields,
                columnGroupField: columnGroupField,
                valueFields: valueFields.map(vf => ({
                    fieldId: vf.fieldId,
                    aggregation: vf.aggregation || 'count'
                })),
                showSubtotals: showSubtotals,
                showGrandTotal: showGrandTotal,
                sortRowsBy: sortRowsBy,
                sortDirection: sortDirection
            },

            // Standard view config
            visibleFieldIds: [
                ...rowGroupFields,
                ...valueFields.map(vf => vf.fieldId)
            ],
            hiddenFields: [],
            filters: [],
            sorts: rowGroupFields.map(fid => ({ fieldId: fid, direction: sortDirection })),
            groups: rowGroupFields.map(fid => ({ fieldId: fid })),

            // Provenance
            provenance: {
                createdBy: state.currentUser || 'user',
                createdAt: Date.now(),
                derivedFromViewIds: currentView ? [currentView.id] : [],
                notes: `Enhanced pivot table with ${rowGroupFields.length} row group(s) and ${valueFields.length} value field(s)`
            },

            pivotMetadata: {
                sourceViewId: currentViewId,
                sourceViewName: currentView?.name,
                pivotType: 'enhanced_pivot',
                rowGroupCount: rowGroupFields.length,
                valueFieldCount: valueFields.length,
                hasColumnPivot: !!columnGroupField,
                createdAt: Date.now()
            },

            dataSource: 'derived',
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

        return pivotView;
    }

    /**
     * Calculate pivot table data from records
     * @param {Object} set - The data set
     * @param {Object} pivotConfig - Pivot configuration
     * @returns {Object} Calculated pivot data
     */
    function calculatePivotData(set, pivotConfig) {
        const {
            rowGroupFields = [],
            columnGroupField = null,
            valueFields = [],
            showSubtotals = true,
            showGrandTotal = true
        } = pivotConfig;

        const records = Array.from(set.records?.values() || []);

        // Group records by row keys
        const rowGroups = new Map();
        const columnValues = new Set();

        records.forEach(record => {
            // Build row key from group fields
            const rowKey = rowGroupFields.map(fid => String(record[fid] || '')).join('|||');

            // Track column value if pivoting by column
            if (columnGroupField) {
                const colValue = String(record[columnGroupField] || '');
                columnValues.add(colValue);
            }

            // Initialize row group
            if (!rowGroups.has(rowKey)) {
                rowGroups.set(rowKey, {
                    key: rowKey,
                    labels: rowGroupFields.map(fid => record[fid] || ''),
                    records: [],
                    byColumn: new Map()
                });
            }

            const rowGroup = rowGroups.get(rowKey);
            rowGroup.records.push(record);

            // Group by column if pivoting
            if (columnGroupField) {
                const colValue = String(record[columnGroupField] || '');
                if (!rowGroup.byColumn.has(colValue)) {
                    rowGroup.byColumn.set(colValue, []);
                }
                rowGroup.byColumn.get(colValue).push(record);
            }
        });

        // Calculate aggregated values
        const rows = [];
        const sortedColumnValues = Array.from(columnValues).sort();

        rowGroups.forEach((group, key) => {
            const row = {
                key: key,
                labels: group.labels,
                values: {},
                columnValues: {}
            };

            // Calculate values for each value field
            valueFields.forEach(vf => {
                const { fieldId, aggregation = 'count' } = vf;
                const aggFn = PIVOT_AGGREGATIONS[aggregation];

                if (aggFn) {
                    // Overall value for this row
                    const allValues = group.records.map(r => r[fieldId]);
                    row.values[fieldId] = aggFn.apply(allValues);

                    // Values by column
                    if (columnGroupField) {
                        row.columnValues[fieldId] = {};
                        sortedColumnValues.forEach(colVal => {
                            const colRecords = group.byColumn.get(colVal) || [];
                            const colValues = colRecords.map(r => r[fieldId]);
                            row.columnValues[fieldId][colVal] = aggFn.apply(colValues);
                        });
                    }
                }
            });

            rows.push(row);
        });

        // Calculate grand totals
        let grandTotals = {};
        if (showGrandTotal) {
            valueFields.forEach(vf => {
                const { fieldId, aggregation = 'count' } = vf;
                const aggFn = PIVOT_AGGREGATIONS[aggregation];
                if (aggFn) {
                    const allValues = records.map(r => r[fieldId]);
                    grandTotals[fieldId] = aggFn.apply(allValues);
                }
            });
        }

        return {
            rows,
            columns: sortedColumnValues,
            grandTotals,
            rowGroupFields,
            valueFields,
            recordCount: records.length
        };
    }

    /**
     * Show enhanced pivot table configuration dialog
     */
    function showEnhancedPivotDialog(state, setId) {
        const set = state.sets.get(setId);
        if (!set) return;

        const schema = set.schema || [];
        const numericFields = schema.filter(f =>
            f.type === 'NUMBER' || f.type === 'FORMULA'
        );

        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';
        dialog.id = 'enhancedPivotModal';
        dialog.innerHTML = `
            <div class="modal enhanced-pivot-modal" style="max-width: 700px;">
                <div class="modal-header">
                    <h2>Configure Pivot Table</h2>
                    <button class="modal-close" onclick="closeEnhancedPivotModal()">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    <div class="pivot-config-section">
                        <h3>Row Grouping</h3>
                        <p class="config-help">Select fields to group rows by (drag to reorder)</p>
                        <div class="field-select-list" id="rowGroupFields">
                            ${schema.map(field => `
                                <label class="field-select-item">
                                    <input type="checkbox" name="rowGroup" value="${field.id}">
                                    <span class="field-name">${escapeHtml(field.name)}</span>
                                    <span class="field-type">${field.type}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div class="pivot-config-section">
                        <h3>Column Pivot (Optional)</h3>
                        <p class="config-help">Pivot a field's values into columns</p>
                        <select id="columnPivotField" class="config-select">
                            <option value="">None - single column layout</option>
                            ${schema.map(field => `
                                <option value="${field.id}">${escapeHtml(field.name)}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="pivot-config-section">
                        <h3>Values & Aggregations</h3>
                        <p class="config-help">Select fields to aggregate and how</p>
                        <div class="value-field-list" id="valueFieldList">
                            ${schema.map(field => {
                                const applicableAggs = Object.entries(PIVOT_AGGREGATIONS)
                                    .filter(([key, agg]) =>
                                        agg.applicableTypes.includes('*') ||
                                        agg.applicableTypes.includes(field.type)
                                    );
                                return `
                                    <div class="value-field-row">
                                        <label class="value-field-check">
                                            <input type="checkbox" name="valueField" value="${field.id}">
                                            <span>${escapeHtml(field.name)}</span>
                                        </label>
                                        <select class="agg-select" data-field="${field.id}" disabled>
                                            ${applicableAggs.map(([key, agg]) => `
                                                <option value="${key}">${agg.label}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="pivot-config-section">
                        <h3>Options</h3>
                        <div class="pivot-options-grid">
                            <label class="option-check">
                                <input type="checkbox" id="showSubtotals" checked>
                                <span>Show Subtotals</span>
                            </label>
                            <label class="option-check">
                                <input type="checkbox" id="showGrandTotal" checked>
                                <span>Show Grand Total</span>
                            </label>
                        </div>
                    </div>

                    <div class="pivot-config-section">
                        <h3>Pivot Table Name</h3>
                        <input type="text" id="pivotName" class="config-input"
                               value="Pivot Table" placeholder="Enter name...">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeEnhancedPivotModal()">Cancel</button>
                    <button class="btn btn-primary" id="btnCreateEnhancedPivot">
                        <i class="ph ph-table"></i> Create Pivot Table
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Enable aggregation selects when value field is checked
        dialog.querySelectorAll('input[name="valueField"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const fieldId = e.target.value;
                const select = dialog.querySelector(`.agg-select[data-field="${fieldId}"]`);
                if (select) {
                    select.disabled = !e.target.checked;
                }
            });
        });

        // Create button handler
        dialog.querySelector('#btnCreateEnhancedPivot').onclick = () => {
            const rowGroupFields = Array.from(dialog.querySelectorAll('input[name="rowGroup"]:checked'))
                .map(cb => cb.value);

            const columnGroupField = dialog.querySelector('#columnPivotField').value || null;

            const valueFields = Array.from(dialog.querySelectorAll('input[name="valueField"]:checked'))
                .map(cb => {
                    const fieldId = cb.value;
                    const aggSelect = dialog.querySelector(`.agg-select[data-field="${fieldId}"]`);
                    return {
                        fieldId,
                        aggregation: aggSelect?.value || 'count'
                    };
                });

            const showSubtotals = dialog.querySelector('#showSubtotals').checked;
            const showGrandTotal = dialog.querySelector('#showGrandTotal').checked;
            const name = dialog.querySelector('#pivotName').value.trim() || 'Pivot Table';

            if (rowGroupFields.length === 0) {
                alert('Please select at least one field to group by');
                return;
            }

            if (valueFields.length === 0) {
                // Default to count if no value fields selected
                valueFields.push({ fieldId: rowGroupFields[0], aggregation: 'count' });
            }

            const pivotView = createEnhancedPivotView(state, setId, {
                name,
                rowGroupFields,
                columnGroupField,
                valueFields,
                showSubtotals,
                showGrandTotal
            });

            if (pivotView) {
                state.currentViewId = pivotView.id;
                dialog.remove();

                if (typeof renderSidebar === 'function') renderSidebar();
                if (typeof switchSet === 'function') switchSet(setId, pivotView.id);

                showPivotToast(`Pivot table "${name}" created`, 'success');
            }
        };

        // Click outside to close
        dialog.onclick = (e) => {
            if (e.target === dialog) dialog.remove();
        };
    }

    /**
     * Close enhanced pivot modal
     */
    function closeEnhancedPivotModal() {
        const modal = document.getElementById('enhancedPivotModal');
        if (modal) modal.remove();
    }

    /**
     * Get applicable aggregations for a field type
     */
    function getApplicableAggregations(fieldType) {
        return Object.entries(PIVOT_AGGREGATIONS)
            .filter(([key, agg]) =>
                agg.applicableTypes.includes('*') ||
                agg.applicableTypes.includes(fieldType)
            )
            .map(([key, agg]) => ({
                key,
                label: agg.label,
                icon: agg.icon
            }));
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

        // Enhanced pivot functions
        createEnhancedPivotView,
        calculatePivotData,
        showEnhancedPivotDialog,
        closeEnhancedPivotModal,
        PIVOT_AGGREGATIONS,
        getApplicableAggregations,

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
    global.closeEnhancedPivotModal = closeEnhancedPivotModal;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOPivotDynamicViews;
    }

})(typeof window !== 'undefined' ? window : global);
