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
        renderStructuralOperationsToolbar,
        showDedupeDialog,
        showMergeRecordsDialog,
        showSplitRecordDialog,
        showHarmonizeFieldsDialog,
        renderEnhancedSearchModal,
        handleSearchInput
    };
}
