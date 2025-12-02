/**
 * EO Data Workbench UI Components
 *
 * This module provides UI components for:
 * - View management (switcher, editor)
 * - View reification (save, save as, from focus)
 * - Structural operations (dedupe, merge, split, harmonize)
 * - Zero-input search/discovery surface
 *
 * These components integrate with the existing EO Activibase UI.
 */

// ============================================================================
// VIEW MANAGER UI
// ============================================================================

/**
 * Render view switcher for a set
 * Shows tabs/list of views with + New View button
 */
function renderViewManager(state, setId) {
    const set = state.sets.get(setId);
    if (!set) return '';

    const views = getSetViews(state, setId);
    const currentViewId = state.currentViewId;

    let html = '<div class="view-manager">';
    html += '<div class="view-tabs">';

    views.forEach(view => {
        const isActive = view.id === currentViewId;
        const isDirty = view.isDirty ? ' *' : '';
        html += `
            <div class="view-tab ${isActive ? 'active' : ''}" data-view-id="${view.id}">
                <span class="view-icon">${view.icon || '📋'}</span>
                <span class="view-name">${escapeHtml(view.name)}${isDirty}</span>
                <button class="view-menu-btn" data-view-id="${view.id}" title="View options">⋮</button>
            </div>
        `;
    });

    html += `
        <button class="view-tab-add" title="New view">
            <span class="icon">+</span> New View
        </button>
    `;

    html += '</div>'; // .view-tabs

    // View actions (shown when view is dirty)
    if (currentViewId) {
        const currentView = state.views?.get(currentViewId);
        if (currentView?.isDirty) {
            html += `
                <div class="view-actions">
                    <span class="unsaved-label">Unsaved changes</span>
                    <button class="btn-save-view" data-view-id="${currentViewId}">Save View</button>
                    <button class="btn-save-view-as" data-view-id="${currentViewId}">Save As...</button>
                </div>
            `;
        }
    }

    html += '</div>'; // .view-manager

    return html;
}

/**
 * Show view options menu
 */
function showViewMenu(state, viewId, buttonElement) {
    const view = state.views?.get(viewId);
    if (!view) return;

    const menu = document.createElement('div');
    menu.className = 'context-menu view-menu';
    menu.innerHTML = `
        <div class="menu-item" data-action="edit" data-view-id="${viewId}">
            <span class="menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
            <span class="menu-label">Edit View</span>
        </div>
        <div class="menu-item" data-action="duplicate" data-view-id="${viewId}">
            <span class="menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
            <span class="menu-label">Duplicate</span>
        </div>
        <div class="menu-item" data-action="history" data-view-id="${viewId}">
            <span class="menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
            <span class="menu-label">History</span>
        </div>
        <div class="menu-separator"></div>
        <div class="menu-item" data-action="close" data-view-id="${viewId}">
            <span class="menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
            <span class="menu-label">Close Tab</span>
        </div>
        <div class="menu-item danger" data-action="delete" data-view-id="${viewId}">
            <span class="menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span>
            <span class="menu-label">Delete View</span>
        </div>
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
            const action = item.dataset.action;
            const vid = item.dataset.viewId;
            menu.remove();

            switch (action) {
                case 'edit':
                    showEditViewDialog(state, vid);
                    break;
                case 'duplicate':
                    const original = state.views?.get(vid);
                    if (original) {
                        const newView = cloneView(state, vid, `${original.name} (copy)`);
                        if (newView && window.switchSet) {
                            state.currentViewId = newView.id;
                            window.switchSet(original.setId, newView.id);
                        }
                        showToast('View duplicated');
                    }
                    break;
                case 'history':
                    showViewHistory(state, vid);
                    break;
                case 'close':
                    closeViewTab(state, vid);
                    break;
                case 'delete':
                    if (confirm('Are you sure you want to delete this view?')) {
                        deleteView(state, vid);
                        if (window.renderCurrentView) {
                            window.renderCurrentView();
                        }
                        showToast('View deleted');
                    }
                    break;
            }
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

/**
 * Create new view dialog
 */
function showCreateViewDialog(state, setId, baseConfig = {}) {
    const set = state.sets.get(setId);
    if (!set) return;

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
                    <input type="text" id="view-name" placeholder="Untitled view" value="${baseConfig.name || ''}">
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
                            ${baseConfig.derivedFrom}
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
// VIEW REIFICATION UI
// ============================================================================

/**
 * Show "Create View from Focus" button in focus panel
 */
function renderCreateViewFromFocusButton(state, focus) {
    if (!focus) return '';

    return `
        <button class="btn-create-view-from-focus" data-focus='${JSON.stringify(focus)}'>
            <span class="icon">📌</span> Create View from Focus
        </button>
    `;
}

/**
 * Show "Save As..." dialog for reifying temporary view
 */
function showSaveViewAsDialog(state, viewId) {
    const view = state.views?.get(viewId);
    if (!view) return;

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
                    <input type="text" id="new-view-name" placeholder="${view.name} (copy)" value="${view.name} (copy)">
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
// VIEW TOOLBAR UI
// ============================================================================

/**
 * Render view toolbar with field management and operations
 * This toolbar appears below the view tabs and provides quick access to common actions
 */
function renderViewToolbar(state, setId) {
    const set = state.sets.get(setId);
    if (!set) return '';

    const currentViewId = state.currentViewId;
    const currentView = state.views?.get(currentViewId);

    // Count field stats
    const schemaCount = (set.schema || []).length;
    const visibleCount = (currentView?.visibleFieldIds || []).length;
    const hiddenCount = (currentView?.hiddenFields || []).length;
    const recordCount = set.records?.size || 0;

    return `
        <div class="view-toolbar">
            <div class="toolbar-left">
                <button class="toolbar-btn" id="btnAvailableFields" title="Explore available fields">
                    <span class="icon">📋</span>
                    <span class="label">Fields</span>
                    <span class="badge">${visibleCount}/${schemaCount}</span>
                </button>
                <button class="toolbar-btn" id="btnAddLinkedField" title="Add field from linked set">
                    <span class="icon">🔗</span>
                    <span class="label">Linked Fields</span>
                </button>
                <button class="toolbar-btn highlight" id="btnJSONScrubber" title="JSON Scrubber - Explore data as cards">
                    <span class="icon">🎴</span>
                    <span class="label">Scrub JSON</span>
                </button>
            </div>
            <div class="toolbar-right">
                <button class="toolbar-btn subtle" data-op="dedupe" title="Find duplicates">
                    <span class="icon">🔍</span> Dedupe
                </button>
                <button class="toolbar-btn subtle" data-op="harmonize" title="Harmonize fields">
                    <span class="icon">⚖️</span> Harmonize
                </button>
            </div>
        </div>
    `;
}

/**
 * Show the Available Fields Explorer panel
 * @param {Object} state - Global state
 * @param {string} setId - Current set ID
 */
function showAvailableFieldsExplorer(state, setId) {
    const set = state.sets.get(setId);
    const viewId = state.currentViewId;
    const view = state.views?.get(viewId);

    if (!set || !view) {
        console.warn('Cannot show fields explorer: missing set or view');
        return;
    }

    // Use the EOAvailableFieldsExplorer component
    if (window.EOAvailableFieldsExplorer) {
        const explorer = new window.EOAvailableFieldsExplorer();
        explorer.show(view, set, state);
    } else {
        console.warn('EOAvailableFieldsExplorer not loaded');
        alert('Fields Explorer component not available. Please ensure eo_available_fields_explorer.js is loaded.');
    }
}

/**
 * Show the JSON Scrubber panel
 * Allows exploring all data as interactive cards for pivoting
 * @param {Object} state - Global state
 * @param {string} setId - Current set ID
 * @param {string} mode - 'records' | 'schema' | 'record'
 * @param {Object} record - Optional specific record to scrub
 */
function showJSONScrubber(state, setId, mode = 'records', record = null) {
    const set = state.sets.get(setId);
    const viewId = state.currentViewId;
    const view = state.views?.get(viewId);

    if (!set) {
        console.warn('Cannot show JSON scrubber: missing set');
        return;
    }

    // Use the EOJSONScrubber component
    if (window.EOJSONScrubber) {
        const scrubber = new window.EOJSONScrubber({
            state,
            set,
            view,
            onViewCreate: (newView) => {
                // Switch to the new view
                state.currentViewId = newView.id;
                if (window.switchSet) {
                    window.switchSet(setId, newView.id);
                }
            },
            onFilterApply: (filter) => {
                // Apply filter to current view
                if (view) {
                    if (!view.filters) view.filters = [];
                    view.filters.push(filter);
                    view.isDirty = true;
                    if (window.renderCurrentView) {
                        window.renderCurrentView();
                    }
                }
            },
            onGroupApply: (fieldId) => {
                // Apply grouping to current view
                if (view) {
                    view.groups = [{ fieldId }];
                    view.isDirty = true;
                    if (window.renderCurrentView) {
                        window.renderCurrentView();
                    }
                }
            }
        });

        if (mode === 'record' && record) {
            scrubber.showForRecord(record, set, state);
        } else if (mode === 'schema') {
            scrubber.showForSchema(set, state);
        } else {
            // Default: show all records aggregated
            const records = Array.from(set.records?.values() || []);
            scrubber.showForRecords(records, set, state);
        }
    } else {
        console.warn('EOJSONScrubber not loaded');
        alert('JSON Scrubber component not available. Please ensure eo_json_scrubber.js is loaded.');
    }
}

/**
 * Show JSON Scrubber mode selection menu
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

/**
 * Attach view toolbar event listeners
 * Call this after rendering the toolbar
 */
function attachViewToolbarListeners(state, setId) {
    // Available Fields button
    const btnFields = document.getElementById('btnAvailableFields');
    if (btnFields) {
        btnFields.addEventListener('click', () => {
            showAvailableFieldsExplorer(state, setId);
        });
    }

    // Linked Fields button
    const btnLinked = document.getElementById('btnAddLinkedField');
    if (btnLinked) {
        btnLinked.addEventListener('click', () => {
            if (window.EOLinkedFieldsModal) {
                const set = state.sets.get(setId);
                const view = state.views?.get(state.currentViewId);
                if (set && view) {
                    const modal = new window.EOLinkedFieldsModal();
                    modal.show(view, set, state);
                }
            }
        });
    }

    // JSON Scrubber button
    const btnScrubber = document.getElementById('btnJSONScrubber');
    if (btnScrubber) {
        btnScrubber.addEventListener('click', (e) => {
            showJSONScrubberMenu(state, setId, e.currentTarget);
        });
    }

    // Structural operation buttons
    document.querySelectorAll('.toolbar-btn[data-op]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const op = e.currentTarget.dataset.op;
            switch (op) {
                case 'dedupe':
                    showDedupeDialog(state, setId);
                    break;
                case 'harmonize':
                    showHarmonizeFieldsDialog(state, setId);
                    break;
            }
        });
    });
}

// ============================================================================
// STRUCTURAL OPERATIONS UI
// ============================================================================

/**
 * Render structural operations toolbar
 */
function renderStructuralOperationsToolbar(state) {
    return `
        <div class="structural-ops-toolbar">
            <button class="btn-structural-op" data-op="dedupe" title="Find and merge duplicates">
                <span class="icon">🔍</span> Dedupe
            </button>
            <button class="btn-structural-op" data-op="merge" title="Merge selected records">
                <span class="icon">🔀</span> Merge
            </button>
            <button class="btn-structural-op" data-op="split" title="Split selected record">
                <span class="icon">✂️</span> Split
            </button>
            <button class="btn-structural-op" data-op="harmonize" title="Harmonize field names">
                <span class="icon">⚖️</span> Harmonize
            </button>
        </div>
    `;
}

/**
 * Show dedupe dialog
 */
function showDedupeDialog(state, setId) {
    const set = state.sets.get(setId);
    if (!set) return;

    const schema = set.schema || [];

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

        // Find duplicates
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

        // Create operation and view
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

/**
 * Show merge records dialog
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

        // Execute merge
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

/**
 * Render merge comparison table
 */
function renderMergeTable(schema, records) {
    let html = '<table class="merge-comparison-table">';
    html += '<thead><tr><th>Field</th>';
    records.forEach((rec, idx) => {
        html += `<th>Record ${idx + 1}</th>`;
    });
    html += '<th>Strategy</th></tr></thead><tbody>';

    schema.forEach(field => {
        html += '<tr>';
        html += `<td class="field-name">${escapeHtml(field.name || field.id)}</td>`;

        records.forEach((rec, idx) => {
            const value = rec[field.id];
            const displayValue = value !== undefined && value !== null && value !== '' ?
                escapeHtml(String(value)) : '<em>empty</em>';

            html += `
                <td>
                    <label>
                        <input type="radio" name="field_${field.id}" value="index_${idx}" ${idx === 0 ? 'checked' : ''}>
                        ${displayValue}
                    </label>
                </td>
            `;
        });

        html += `
            <td>
                <select class="strategy-select" data-field="${field.id}">
                    <option value="first">First</option>
                    <option value="longest">Longest</option>
                    <option value="concat">Concatenate</option>
                </select>
            </td>
        `;

        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}

/**
 * Show split record dialog
 */
function showSplitRecordDialog(state, setId, recordId) {
    const set = state.sets.get(setId);
    const record = set?.records.get(recordId);
    if (!record) return;

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

    function renderSplitForms() {
        const count = parseInt(countInput.value);
        const schema = set.schema || [];

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
        const schema = set.schema || [];
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

/**
 * Show field harmonization dialog
 */
function showHarmonizeFieldsDialog(state, setId) {
    const set = state.sets.get(setId);
    if (!set) return;

    const schema = set.schema || [];

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
// ZERO-INPUT SEARCH UI
// ============================================================================

/**
 * Render enhanced search modal with zero-input surface
 */
function renderEnhancedSearchModal(state) {
    const zeroInputData = buildZeroInputSearchData(state);

    return `
        <div class="search-modal-content">
            <div class="search-input-container">
                <input type="text" id="search-input" placeholder="Search sets, views, records, fields, definitions...">
            </div>

            <div class="search-results" id="search-results">
                ${renderZeroInputContent(zeroInputData)}
            </div>

            <div class="search-results-filtered" id="search-results-filtered" style="display: none;">
                <!-- Populated when user types -->
            </div>
        </div>
    `;
}

/**
 * Render zero-input content (shown before typing)
 */
function renderZeroInputContent(data) {
    let html = '<div class="zero-input-search">';

    // Recent items
    if (data.recent.length > 0) {
        html += '<div class="search-section">';
        html += '<h3>Recent</h3>';
        html += '<div class="recent-items">';
        data.recent.forEach(item => {
            html += `
                <div class="search-result-item" data-type="${item.type}" data-id="${item.id}">
                    <span class="type-badge">${item.type}</span>
                    <span class="item-name">${getEntityDisplayName(item.entity)}</span>
                    <span class="item-meta">${new Date(item.lastAccessed).toLocaleString()}</span>
                </div>
            `;
        });
        html += '</div></div>';
    }

    // Frequent fields
    if (data.frequentFields.length > 0) {
        html += '<div class="search-section">';
        html += '<h3>Frequently Used Fields</h3>';
        html += '<div class="frequent-fields">';
        data.frequentFields.forEach(item => {
            html += `
                <div class="search-result-item" data-type="Field" data-id="${item.fieldId}" data-set-id="${item.setId}">
                    <span class="type-badge">Field</span>
                    <span class="item-name">${escapeHtml(item.field.name || item.fieldId)}</span>
                    <span class="item-meta">${item.count} uses in ${item.setName}</span>
                </div>
            `;
        });
        html += '</div></div>';
    }

    // New & Updated
    if (data.newAndUpdated.length > 0) {
        html += '<div class="search-section">';
        html += '<h3>New & Updated</h3>';
        html += '<div class="new-updated-items">';
        data.newAndUpdated.forEach(item => {
            html += `
                <div class="search-result-item" data-type="${item.type}" data-id="${item.id}">
                    <span class="type-badge">${item.type}</span>
                    <span class="item-name">${escapeHtml(item.name)}</span>
                    <span class="item-meta">${item.action} ${new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
            `;
        });
        html += '</div></div>';
    }

    // Structural Highlights
    if (data.structuralHighlights.length > 0) {
        html += '<div class="search-section">';
        html += '<h3>Structural Highlights</h3>';
        html += '<div class="highlights">';
        data.structuralHighlights.forEach(highlight => {
            html += `
                <div class="highlight-item" data-highlight-type="${highlight.type}">
                    <span class="highlight-label">${highlight.label}</span>
                    <span class="highlight-count">${highlight.count}</span>
                </div>
            `;
        });
        html += '</div></div>';
    }

    // Browse
    html += '<div class="search-section">';
    html += '<h3>Browse</h3>';
    html += '<div class="browse-categories">';
    Object.entries(data.browse).forEach(([type, count]) => {
        if (count > 0) {
            html += `
                <div class="browse-item" data-entity-type="${type}">
                    <span class="browse-label">${capitalize(type)}</span>
                    <span class="browse-count">${count}</span>
                </div>
            `;
        }
    });
    html += '</div></div>';

    html += '</div>'; // .zero-input-search
    return html;
}

/**
 * Handle search input and filter results
 */
function handleSearchInput(state, query) {
    const resultsContainer = document.getElementById('search-results-filtered');
    const zeroInputContainer = document.getElementById('search-results');

    if (!query || query.trim().length === 0) {
        // Show zero-input content
        resultsContainer.style.display = 'none';
        zeroInputContainer.style.display = 'block';
        return;
    }

    // Hide zero-input, show filtered
    zeroInputContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    // Search
    const results = searchAllEntities(state, query);

    // Render filtered results
    let html = '<div class="filtered-search-results">';

    Object.entries(results).forEach(([category, items]) => {
        if (items.length > 0) {
            html += `<div class="search-section">`;
            html += `<h3>${capitalize(category)} (${items.length})</h3>`;
            html += '<div class="search-results-list">';

            items.forEach(item => {
                html += `
                    <div class="search-result-item" data-type="${item.type}" data-id="${item.id}">
                        <span class="type-badge">${item.type}</span>
                        <span class="item-name">${escapeHtml(item.name || item.term || item.id)}</span>
                        ${item.setName ? `<span class="item-meta">in ${escapeHtml(item.setName)}</span>` : ''}
                    </div>
                `;
            });

            html += '</div></div>';
        }
    });

    if (Object.values(results).every(arr => arr.length === 0)) {
        html += '<div class="no-results">No results found</div>';
    }

    html += '</div>';
    resultsContainer.innerHTML = html;
}

// ============================================================================
// VIEW HISTORY
// ============================================================================

/**
 * Show view history modal
 * Displays all changes related to the view including record operations (including deleted/tossed)
 */
function showViewHistory(state, viewId) {
    const view = state.views?.get(viewId);
    if (!view) return;

    const events = state.eventStream || [];
    const set = state.sets.get(view.setId);

    // Collect all events related to this view
    const viewEvents = events.filter(event => {
        // Direct view events
        if (event.entityType === 'View' && event.entityId === viewId) {
            return true;
        }
        // Events with this view in data
        if (event.data?.viewId === viewId) {
            return true;
        }
        // Record events in this view's set
        if (event.entityType === 'Record' && event.data?.setId === view.setId) {
            return true;
        }
        // Structural operations on this view
        if (event.entityType === 'StructuralOperation' && event.data?.viewId === viewId) {
            return true;
        }
        return false;
    });

    // Sort by timestamp descending (newest first)
    viewEvents.sort((a, b) => b.timestamp - a.timestamp);

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal history-modal">
            <div class="modal-header">
                <h2>
                    <span class="history-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                    History: ${escapeHtml(view.name)}
                </h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="history-filters">
                    <label class="history-filter-label">
                        <input type="checkbox" id="history-show-records" checked>
                        Show record changes
                    </label>
                    <label class="history-filter-label">
                        <input type="checkbox" id="history-show-deleted" checked>
                        Show deleted/tossed items
                    </label>
                </div>
                <div class="history-timeline" id="history-timeline">
                    ${renderHistoryTimeline(viewEvents, state)}
                </div>
                ${viewEvents.length === 0 ? '<div class="history-empty">No history recorded yet</div>' : ''}
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Filter handlers
    const showRecordsCheckbox = dialog.querySelector('#history-show-records');
    const showDeletedCheckbox = dialog.querySelector('#history-show-deleted');
    const timeline = dialog.querySelector('#history-timeline');

    function updateTimeline() {
        const showRecords = showRecordsCheckbox.checked;
        const showDeleted = showDeletedCheckbox.checked;

        const filtered = viewEvents.filter(event => {
            if (!showRecords && event.entityType === 'Record') {
                return false;
            }
            if (!showDeleted && (event.type.includes('deleted') || event.type.includes('tossed') || event.type.includes('removed'))) {
                return false;
            }
            return true;
        });

        timeline.innerHTML = renderHistoryTimeline(filtered, state);
    }

    showRecordsCheckbox.addEventListener('change', updateTimeline);
    showDeletedCheckbox.addEventListener('change', updateTimeline);

    // Close handlers
    dialog.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => dialog.remove());
    });

    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.remove();
        }
    });
}

/**
 * Render the history timeline HTML
 */
function renderHistoryTimeline(events, state) {
    if (events.length === 0) {
        return '<div class="history-empty">No events match the current filters</div>';
    }

    let html = '';
    let lastDate = null;

    events.forEach(event => {
        const date = new Date(event.timestamp);
        const dateStr = date.toLocaleDateString();

        // Add date header if new date
        if (dateStr !== lastDate) {
            html += `<div class="history-date-header">${dateStr}</div>`;
            lastDate = dateStr;
        }

        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const { icon, label, description, className } = getEventDisplayInfo(event, state);

        html += `
            <div class="history-event ${className}">
                <div class="history-event-icon">${icon}</div>
                <div class="history-event-content">
                    <div class="history-event-header">
                        <span class="history-event-label">${label}</span>
                        <span class="history-event-time">${timeStr}</span>
                    </div>
                    <div class="history-event-description">${description}</div>
                    ${event.user ? `<div class="history-event-user">by ${escapeHtml(event.user)}</div>` : ''}
                </div>
            </div>
        `;
    });

    return html;
}

/**
 * Get display info for a history event
 */
function getEventDisplayInfo(event, state) {
    const icons = {
        view_created: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        view_updated: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        view_deleted: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        record_created: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        record_updated: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M12 8v8m-4-4h8"/></svg>',
        record_deleted: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>',
        record_tossed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><path d="M3 6h18l-2 13H5L3 6z"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        operation_created: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        default: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
    };

    const type = event.type || 'unknown';
    let icon = icons[type] || icons.default;
    let label = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let description = '';
    let className = '';

    switch (type) {
        case 'view_created':
            description = `View "${event.data?.name || 'Untitled'}" was created`;
            className = 'event-success';
            break;
        case 'view_updated':
            const changes = event.data?.changes?.join(', ') || 'properties';
            description = `Updated ${changes}`;
            className = 'event-info';
            break;
        case 'view_deleted':
            description = `View "${event.data?.name || 'Untitled'}" was deleted`;
            className = 'event-danger';
            break;
        case 'record_created':
            description = `Record added to the set`;
            className = 'event-success';
            break;
        case 'record_updated':
            description = `Record was modified`;
            className = 'event-info';
            break;
        case 'record_deleted':
        case 'record_tossed':
            description = `Record was removed from the view`;
            className = 'event-warning';
            label = 'Record Tossed';
            icon = icons.record_tossed;
            break;
        case 'operation_created':
            const kind = event.data?.kind || 'operation';
            description = `${kind} operation was performed`;
            className = 'event-purple';
            break;
        default:
            description = event.data ? JSON.stringify(event.data).slice(0, 100) : 'No details';
    }

    return { icon, label, description, className };
}

/**
 * Close a view tab without deleting the view
 */
function closeViewTab(state, viewId) {
    const view = state.views?.get(viewId);
    if (!view) return;

    // Get all views for this set
    const setViews = [];
    if (state.views) {
        state.views.forEach(v => {
            if (v.setId === view.setId) {
                setViews.push(v);
            }
        });
    }

    // If this is the current view, switch to another
    if (state.currentViewId === viewId) {
        const otherView = setViews.find(v => v.id !== viewId);
        if (otherView) {
            state.currentViewId = otherView.id;
        } else {
            state.currentViewId = null;
        }
    }

    // We don't delete the view, just close the tab (it can be reopened)
    // For now, this behaves like switching away
    if (window.renderCurrentView) {
        window.renderCurrentView();
    }
}

/**
 * Show edit view dialog
 */
function showEditViewDialog(state, viewId) {
    const view = state.views?.get(viewId);
    if (!view) return;

    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal edit-view-modal">
            <div class="modal-header">
                <h2>Edit View</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>View Name</label>
                    <input type="text" id="edit-view-name" value="${escapeHtml(view.name)}">
                </div>
                <div class="form-group">
                    <label>View Type</label>
                    <select id="edit-view-type">
                        <option value="grid" ${view.type === 'grid' ? 'selected' : ''}>Grid</option>
                        <option value="gallery" ${view.type === 'gallery' ? 'selected' : ''}>Gallery</option>
                        <option value="kanban" ${view.type === 'kanban' ? 'selected' : ''}>Kanban</option>
                        <option value="calendar" ${view.type === 'calendar' ? 'selected' : ''}>Calendar</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="edit-view-notes" rows="3" placeholder="Optional notes about this view...">${escapeHtml(view.provenance?.notes || '')}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">Cancel</button>
                <button class="btn-primary" id="btn-save-edit-view">Save Changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => dialog.remove());
    });

    dialog.querySelector('#btn-save-edit-view').addEventListener('click', () => {
        const name = dialog.querySelector('#edit-view-name').value.trim();
        const type = dialog.querySelector('#edit-view-type').value;
        const notes = dialog.querySelector('#edit-view-notes').value.trim();

        updateView(state, viewId, {
            name: name || view.name,
            type,
            provenance: {
                ...view.provenance,
                notes
            }
        });

        dialog.remove();

        if (window.renderCurrentView) {
            window.renderCurrentView();
        }

        showToast('View updated');
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getEntityDisplayName(entity) {
    if (!entity) return 'Unknown';
    return entity.name || entity.term || entity.id || 'Unnamed';
}

function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderViewManager,
        showViewMenu,
        showCreateViewDialog,
        renderCreateViewFromFocusButton,
        showSaveViewAsDialog,
        renderViewToolbar,
        showAvailableFieldsExplorer,
        showJSONScrubber,
        showJSONScrubberMenu,
        attachViewToolbarListeners,
        renderStructuralOperationsToolbar,
        showDedupeDialog,
        showMergeRecordsDialog,
        showSplitRecordDialog,
        showHarmonizeFieldsDialog,
        renderEnhancedSearchModal,
        handleSearchInput,
        showViewHistory,
        showEditViewDialog,
        closeViewTab
    };
}

// Also expose to window for browser use
if (typeof window !== 'undefined') {
    window.showAvailableFieldsExplorer = showAvailableFieldsExplorer;
    window.showJSONScrubber = showJSONScrubber;
    window.showJSONScrubberMenu = showJSONScrubberMenu;
    window.renderViewToolbar = renderViewToolbar;
    window.attachViewToolbarListeners = attachViewToolbarListeners;
    window.showViewHistory = showViewHistory;
    window.showEditViewDialog = showEditViewDialog;
    window.closeViewTab = closeViewTab;
}
