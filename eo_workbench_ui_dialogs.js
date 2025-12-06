/**
 * EO Workbench UI - Dialog Components
 *
 * EO Operator: SEG (Segmentation)
 * - Split from eo_workbench_ui.js for cohesion
 * - Modal dialogs for structural operations
 * - Each dialog creates DOM, attaches listeners, and cleans up
 *
 * Dependencies: eo_workbench_ui_core.js (escapeHtml, showToast, renderMergeTable)
 * Consumers: eo_workbench_ui.js, eo_workbench_ui_events.js
 */

// ============================================================================
// VIEW MENU DIALOG
// ============================================================================

/**
 * Show view options menu
 * @param {Object} state - Application state
 * @param {string} viewId - View ID
 * @param {HTMLElement} buttonElement - Button that triggered the menu
 */
function showViewMenu(state, viewId, buttonElement) {
    const view = state.views?.get(viewId);
    if (!view) return;

    const menu = document.createElement('div');
    menu.className = 'context-menu view-menu';
    menu.innerHTML = `
        <div class="menu-item" data-action="rename" data-view-id="${viewId}">
            <span class="icon">✏️</span> Rename
        </div>
        <div class="menu-item" data-action="duplicate" data-view-id="${viewId}">
            <span class="icon">📋</span> Duplicate
        </div>
        <div class="menu-separator"></div>
        <div class="menu-item" data-action="export" data-view-id="${viewId}">
            <span class="icon">📤</span> Export View
        </div>
        <div class="menu-separator"></div>
        <div class="menu-item danger" data-action="delete" data-view-id="${viewId}">
            <span class="icon">🗑️</span> Delete View
        </div>
    `;

    // Position near button
    const rect = buttonElement.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;

    document.body.appendChild(menu);

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// ============================================================================
// CREATE VIEW DIALOG
// ============================================================================

/**
 * Create new view dialog
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 * @param {Object} baseConfig - Base configuration for the new view
 */
function showCreateViewDialog(state, setId, baseConfig = {}) {
    const set = state.sets.get(setId);
    if (!set) return;

    const escapeHtml = window.escapeHtml || window.EOWorkbenchUICore?.escapeHtml || ((s) => s);

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal create-view-modal">
            <div class="modal-header">
                <h2>Create New View</h2>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>View Name</label>
                    <input type="text" id="view-name" placeholder="Untitled view" value="${escapeHtml(baseConfig.name || '')}">
                </div>
                <div class="form-group">
                    <label>View Type</label>
                    <select id="view-type">
                        <option value="grid" ${baseConfig.type === 'grid' ? 'selected' : ''}>Grid</option>
                        <option value="gallery" ${baseConfig.type === 'gallery' ? 'selected' : ''}>Gallery</option>
                        <option value="kanban" ${baseConfig.type === 'kanban' ? 'selected' : ''}>Kanban</option>
                        <option value="calendar" ${baseConfig.type === 'calendar' ? 'selected' : ''}>Calendar</option>
                    </select>
                </div>
                ${baseConfig.derivedFrom ? `
                    <div class="form-group">
                        <label>Based on</label>
                        <div class="derived-from-info">
                            ${escapeHtml(baseConfig.derivedFrom)}
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">Cancel</button>
                <button class="btn-primary" id="btn-create-view">Create View</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Event listeners
    dialog.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => dialog.remove());
    });

    dialog.querySelector('#btn-create-view').addEventListener('click', () => {
        const name = dialog.querySelector('#view-name').value.trim() || 'Untitled view';
        const type = dialog.querySelector('#view-type').value;

        // Use createView from data structures if available
        const createView = window.createView || function(state, config) {
            const view = {
                id: 'view_' + Date.now(),
                ...config
            };
            if (!state.views) state.views = new Map();
            state.views.set(view.id, view);
            return view;
        };

        const view = createView(state, {
            setId,
            name,
            type,
            ...baseConfig
        });

        state.currentViewId = view.id;
        dialog.remove();

        // Trigger re-render
        if (window.switchSet) {
            window.switchSet(setId, view.id);
        }
    });
}

// ============================================================================
// SAVE VIEW AS DIALOG
// ============================================================================

/**
 * Show "Save As..." dialog for reifying temporary view
 * @param {Object} state - Application state
 * @param {string} viewId - View ID
 */
function showSaveViewAsDialog(state, viewId) {
    const view = state.views?.get(viewId);
    if (!view) return;

    const escapeHtml = window.escapeHtml || window.EOWorkbenchUICore?.escapeHtml || ((s) => s);

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal save-view-as-modal">
            <div class="modal-header">
                <h2>Save View As</h2>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>New View Name</label>
                    <input type="text" id="new-view-name" placeholder="${escapeHtml(view.name)} (copy)" value="${escapeHtml(view.name)} (copy)">
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="new-view-notes" rows="3" placeholder="Optional description..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">Cancel</button>
                <button class="btn-primary" id="btn-save-as">Save As New View</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => dialog.remove());
    });

    dialog.querySelector('#btn-save-as').addEventListener('click', () => {
        const newName = dialog.querySelector('#new-view-name').value.trim();
        const notes = dialog.querySelector('#new-view-notes').value.trim();

        // Use cloneView from data structures if available
        const cloneView = window.cloneView || function(state, viewId, newName) {
            const original = state.views?.get(viewId);
            if (!original) return null;
            const newView = {
                ...original,
                id: 'view_' + Date.now(),
                name: newName,
                isDirty: false
            };
            state.views.set(newView.id, newView);
            return newView;
        };

        const updateView = window.updateView || function(state, viewId, updates) {
            const view = state.views?.get(viewId);
            if (view) Object.assign(view, updates);
        };

        const newView = cloneView(state, viewId, newName);
        if (newView && notes) {
            updateView(state, newView.id, {
                provenance: {
                    ...newView.provenance,
                    notes
                }
            });
        }

        state.currentViewId = newView.id;
        dialog.remove();

        // Trigger re-render
        if (window.switchSet) {
            window.switchSet(view.setId, newView.id);
        }
    });
}

// ============================================================================
// DEDUPE DIALOG
// ============================================================================

/**
 * Show dedupe dialog
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 */
function showDedupeDialog(state, setId) {
    const set = state.sets.get(setId);
    if (!set) return;

    const schema = set.schema || [];
    const escapeHtml = window.escapeHtml || window.EOWorkbenchUICore?.escapeHtml || ((s) => s);
    const showToast = window.showToast || window.EOWorkbenchUICore?.showToast || ((m) => alert(m));

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal dedupe-modal">
            <div class="modal-header">
                <h2>Find Duplicates</h2>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Key Fields (select fields to compare)</label>
                    <div class="field-checkboxes">
                        ${schema.map(field => `
                            <label class="checkbox-label">
                                <input type="checkbox" name="keyField" value="${field.id}">
                                ${escapeHtml(field.name || field.id)}
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label>Algorithm</label>
                    <select id="dedupe-algorithm">
                        <option value="exact">Exact match</option>
                        <option value="fuzzy" selected>Fuzzy match</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Similarity Threshold</label>
                    <input type="range" id="dedupe-threshold" min="0.5" max="1.0" step="0.05" value="0.85">
                    <span id="threshold-value">85%</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">Cancel</button>
                <button class="btn-primary" id="btn-find-dupes">Find Duplicates</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Update threshold display
    const thresholdInput = dialog.querySelector('#dedupe-threshold');
    const thresholdDisplay = dialog.querySelector('#threshold-value');
    thresholdInput.addEventListener('input', () => {
        thresholdDisplay.textContent = `${Math.round(thresholdInput.value * 100)}%`;
    });

    dialog.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => dialog.remove());
    });

    dialog.querySelector('#btn-find-dupes').addEventListener('click', () => {
        const keyFieldIds = Array.from(dialog.querySelectorAll('input[name="keyField"]:checked'))
            .map(cb => cb.value);

        if (keyFieldIds.length === 0) {
            alert('Please select at least one key field');
            return;
        }

        const algorithm = dialog.querySelector('#dedupe-algorithm').value;
        const threshold = parseFloat(dialog.querySelector('#dedupe-threshold').value);

        // Find duplicates using external function if available
        const findDuplicateCandidates = window.findDuplicateCandidates || function() {
            return [];
        };

        const clusters = findDuplicateCandidates(state, setId, {
            keyFieldIds,
            algorithm,
            threshold
        });

        if (clusters.length === 0) {
            alert('No duplicates found!');
            dialog.remove();
            return;
        }

        // Create operation and view using external functions if available
        const createOperation = window.createOperation || function(state, config) {
            return { id: 'op_' + Date.now(), ...config };
        };
        const createDedupeCandidatesView = window.createDedupeCandidatesView || function(state, setId, clusters) {
            return { id: 'view_dedupe_' + Date.now(), setId };
        };
        const updateOperation = window.updateOperation || function() {};

        const operation = createOperation(state, {
            kind: 'dedupe',
            setId,
            viewId: state.currentViewId,
            parameters: { keyFieldIds, algorithm, threshold },
            status: 'applied'
        });

        const resultView = createDedupeCandidatesView(state, setId, clusters, operation.id);
        updateOperation(state, operation.id, { resultViewId: resultView.id });

        state.currentViewId = resultView.id;
        dialog.remove();

        // Show results
        if (window.switchSet) {
            window.switchSet(setId, resultView.id);
        }

        showToast(`Found ${clusters.length} duplicate groups with ${clusters.reduce((s, c) => s + c.count, 0)} total records`);
    });
}

// ============================================================================
// MERGE RECORDS DIALOG
// ============================================================================

/**
 * Show merge records dialog
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 * @param {Array} recordIds - Array of record IDs to merge
 */
function showMergeRecordsDialog(state, setId, recordIds) {
    if (recordIds.length < 2) {
        alert('Please select at least 2 records to merge');
        return;
    }

    const set = state.sets.get(setId);
    if (!set) return;

    const records = recordIds.map(id => set.records.get(id)).filter(Boolean);
    const schema = set.schema || [];

    const renderMergeTable = window.renderMergeTable || window.EOWorkbenchUICore?.renderMergeTable || function() {
        return '<p>Merge table unavailable</p>';
    };
    const showToast = window.showToast || window.EOWorkbenchUICore?.showToast || ((m) => alert(m));

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal merge-records-modal large">
            <div class="modal-header">
                <h2>Merge ${records.length} Records</h2>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <p>Choose which value to keep for each field:</p>
                <div class="merge-table">
                    ${renderMergeTable(schema, records)}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">Cancel</button>
                <button class="btn-primary" id="btn-execute-merge">Merge Records</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => dialog.remove());
    });

    dialog.querySelector('#btn-execute-merge').addEventListener('click', () => {
        // Collect strategy selections
        const strategyMap = {};
        schema.forEach(field => {
            const selected = dialog.querySelector(`input[name="field_${field.id}"]:checked`);
            if (selected) {
                strategyMap[field.id] = selected.value;
            }
        });

        // Execute merge using external function if available
        const executeMergeOperation = window.executeMergeOperation || function() {
            return null;
        };

        const result = executeMergeOperation(state, setId, recordIds, strategyMap);
        if (!result) {
            alert('Merge failed');
            return;
        }

        dialog.remove();
        state.currentViewId = result.resultView.id;

        if (window.switchSet) {
            window.switchSet(setId, result.resultView.id);
        }

        showToast(`Merged ${recordIds.length} records into 1`);
    });
}

// ============================================================================
// SPLIT RECORD DIALOG
// ============================================================================

/**
 * Show split record dialog
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 * @param {string} recordId - Record ID to split
 */
function showSplitRecordDialog(state, setId, recordId) {
    const set = state.sets.get(setId);
    const record = set?.records.get(recordId);
    if (!record) return;

    const escapeHtml = window.escapeHtml || window.EOWorkbenchUICore?.escapeHtml || ((s) => s);
    const showToast = window.showToast || window.EOWorkbenchUICore?.showToast || ((m) => alert(m));

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal split-record-modal">
            <div class="modal-header">
                <h2>Split Record</h2>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Number of records to create</label>
                    <input type="number" id="split-count" min="2" max="10" value="2">
                </div>
                <div id="split-records-container"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">Cancel</button>
                <button class="btn-primary" id="btn-execute-split">Split Record</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const countInput = dialog.querySelector('#split-count');
    const container = dialog.querySelector('#split-records-container');
    const schema = set.schema || [];

    function renderSplitForms() {
        const count = parseInt(countInput.value);

        let html = '';
        for (let i = 0; i < count; i++) {
            html += `<div class="split-record-form"><h4>Record ${i + 1}</h4>`;
            schema.forEach(field => {
                const originalValue = record[field.id] || '';
                html += `
                    <div class="form-group inline">
                        <label>${escapeHtml(field.name || field.id)}</label>
                        <input type="text" name="split_${i}_${field.id}" value="${escapeHtml(String(originalValue))}">
                    </div>
                `;
            });
            html += '</div>';
        }

        container.innerHTML = html;
    }

    renderSplitForms();
    countInput.addEventListener('change', renderSplitForms);

    dialog.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => dialog.remove());
    });

    dialog.querySelector('#btn-execute-split').addEventListener('click', () => {
        const count = parseInt(countInput.value);
        const newRecordsData = [];

        for (let i = 0; i < count; i++) {
            const data = {};
            schema.forEach(field => {
                const input = dialog.querySelector(`input[name="split_${i}_${field.id}"]`);
                if (input) {
                    data[field.id] = input.value;
                }
            });
            newRecordsData.push(data);
        }

        // Execute split using external function if available
        const executeSplitOperation = window.executeSplitOperation || function() {
            return null;
        };

        const result = executeSplitOperation(state, setId, recordId, newRecordsData);
        if (!result) {
            alert('Split failed');
            return;
        }

        dialog.remove();
        state.currentViewId = result.resultView.id;

        if (window.switchSet) {
            window.switchSet(setId, result.resultView.id);
        }

        showToast(`Split 1 record into ${count} records`);
    });
}

// ============================================================================
// HARMONIZE FIELDS DIALOG
// ============================================================================

/**
 * Show field harmonization dialog
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 */
function showHarmonizeFieldsDialog(state, setId) {
    const set = state.sets.get(setId);
    if (!set) return;

    const schema = set.schema || [];
    const escapeHtml = window.escapeHtml || window.EOWorkbenchUICore?.escapeHtml || ((s) => s);
    const showToast = window.showToast || window.EOWorkbenchUICore?.showToast || ((m) => alert(m));

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal harmonize-fields-modal">
            <div class="modal-header">
                <h2>Harmonize Fields</h2>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <p>Select fields to merge into a canonical field:</p>
                <div class="field-checkboxes">
                    ${schema.map(field => `
                        <label class="checkbox-label">
                            <input type="checkbox" name="harmonizeField" value="${field.id}">
                            ${escapeHtml(field.name || field.id)}
                        </label>
                    `).join('')}
                </div>
                <div class="form-group">
                    <label>Canonical Field Name</label>
                    <input type="text" id="canonical-field-name" placeholder="e.g., observer_name">
                </div>
                <div class="form-group">
                    <label>Merge Strategy</label>
                    <select id="harmonize-strategy">
                        <option value="first">Take first non-empty</option>
                        <option value="concat">Concatenate all</option>
                        <option value="coalesce">Coalesce (keep existing)</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">Cancel</button>
                <button class="btn-primary" id="btn-execute-harmonize">Harmonize</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => dialog.remove());
    });

    dialog.querySelector('#btn-execute-harmonize').addEventListener('click', () => {
        const fieldIds = Array.from(dialog.querySelectorAll('input[name="harmonizeField"]:checked'))
            .map(cb => cb.value);

        if (fieldIds.length < 2) {
            alert('Please select at least 2 fields to harmonize');
            return;
        }

        const canonicalName = dialog.querySelector('#canonical-field-name').value.trim();
        if (!canonicalName) {
            alert('Please enter a canonical field name');
            return;
        }

        const strategy = dialog.querySelector('#harmonize-strategy').value;

        const canonicalField = {
            id: canonicalName.toLowerCase().replace(/\s+/g, '_'),
            name: canonicalName,
            type: 'text'
        };

        // Execute harmonization using external function if available
        const executeMergeFieldsOperation = window.executeMergeFieldsOperation || function() {
            return null;
        };

        const result = executeMergeFieldsOperation(state, setId, fieldIds, canonicalField, { strategy });
        if (!result) {
            alert('Harmonization failed');
            return;
        }

        dialog.remove();
        state.currentViewId = result.resultView.id;

        if (window.switchSet) {
            window.switchSet(setId, result.resultView.id);
        }

        showToast(`Harmonized ${fieldIds.length} fields into ${canonicalName}, updated ${result.recordsUpdated} records`);
    });
}

// ============================================================================
// JSON SCRUBBER MENU
// ============================================================================

/**
 * Show JSON Scrubber mode selection menu
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 * @param {HTMLElement} buttonElement - Button that triggered the menu
 */
function showJSONScrubberMenu(state, setId, buttonElement) {
    const set = state.sets.get(setId);
    if (!set) return;

    const recordCount = set.records?.size || 0;
    const schemaCount = (set.schema || []).length;

    const menu = document.createElement('div');
    menu.className = 'context-menu scrubber-menu';
    menu.innerHTML = `
        <div class="menu-header">Scrub Mode</div>
        <div class="menu-item" data-mode="records">
            <span class="icon">🎴</span>
            <span class="label">All Records</span>
            <span class="meta">${recordCount} records</span>
        </div>
        <div class="menu-item" data-mode="schema">
            <span class="icon">🔧</span>
            <span class="label">Schema Only</span>
            <span class="meta">${schemaCount} fields</span>
        </div>
        <div class="menu-separator"></div>
        <div class="menu-hint">Click a row in the table to scrub a single record</div>
    `;

    // Position near button
    const rect = buttonElement.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;

    document.body.appendChild(menu);

    // Handle menu item clicks
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const mode = item.dataset.mode;
            menu.remove();
            // Use external function if available
            const showJSONScrubber = window.showJSONScrubber || function() {};
            showJSONScrubber(state, setId, mode);
        });
    });

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showViewMenu,
        showCreateViewDialog,
        showSaveViewAsDialog,
        showDedupeDialog,
        showMergeRecordsDialog,
        showSplitRecordDialog,
        showHarmonizeFieldsDialog,
        showJSONScrubberMenu
    };
}

// Expose to window for browser use
if (typeof window !== 'undefined') {
    window.EOWorkbenchUIDialogs = {
        showViewMenu,
        showCreateViewDialog,
        showSaveViewAsDialog,
        showDedupeDialog,
        showMergeRecordsDialog,
        showSplitRecordDialog,
        showHarmonizeFieldsDialog,
        showJSONScrubberMenu
    };

    // Also expose globally for backward compatibility
    window.showViewMenu = showViewMenu;
    window.showCreateViewDialog = showCreateViewDialog;
    window.showSaveViewAsDialog = showSaveViewAsDialog;
    window.showDedupeDialog = showDedupeDialog;
    window.showMergeRecordsDialog = showMergeRecordsDialog;
    window.showSplitRecordDialog = showSplitRecordDialog;
    window.showHarmonizeFieldsDialog = showHarmonizeFieldsDialog;
    window.showJSONScrubberMenu = showJSONScrubberMenu;
}
