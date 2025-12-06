/**
 * EO Workbench UI - Event Handlers
 *
 * EO Operator: SEG (Segmentation)
 * - Split from eo_workbench_ui.js for cohesion
 * - Event attachment and handler functions
 * - Delegates to dialog functions for UI creation
 *
 * Dependencies: eo_workbench_ui_dialogs.js
 * Consumers: eo_workbench_ui.js
 */

// ============================================================================
// VIEW TOOLBAR EVENTS
// ============================================================================

/**
 * Attach view toolbar event listeners
 * Call this after rendering the toolbar
 * @param {Object} state - Application state
 * @param {string} setId - Current set ID
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
            const showJSONScrubberMenu = window.showJSONScrubberMenu ||
                window.EOWorkbenchUIDialogs?.showJSONScrubberMenu;
            if (showJSONScrubberMenu) {
                showJSONScrubberMenu(state, setId, e.currentTarget);
            }
        });
    }

    // Structural operation buttons
    document.querySelectorAll('.toolbar-btn[data-op]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const op = e.currentTarget.dataset.op;
            handleStructuralOperation(state, setId, op);
        });
    });
}

/**
 * Handle structural operation button click
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 * @param {string} op - Operation name
 */
function handleStructuralOperation(state, setId, op) {
    const showDedupeDialog = window.showDedupeDialog ||
        window.EOWorkbenchUIDialogs?.showDedupeDialog;
    const showHarmonizeFieldsDialog = window.showHarmonizeFieldsDialog ||
        window.EOWorkbenchUIDialogs?.showHarmonizeFieldsDialog;

    switch (op) {
        case 'dedupe':
            if (showDedupeDialog) {
                showDedupeDialog(state, setId);
            }
            break;
        case 'harmonize':
            if (showHarmonizeFieldsDialog) {
                showHarmonizeFieldsDialog(state, setId);
            }
            break;
    }
}

// ============================================================================
// AVAILABLE FIELDS EXPLORER
// ============================================================================

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

// ============================================================================
// JSON SCRUBBER
// ============================================================================

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

// ============================================================================
// SEARCH EVENTS
// ============================================================================

/**
 * Handle search input and filter results
 * @param {Object} state - Application state
 * @param {string} query - Search query
 */
function handleSearchInput(state, query) {
    const resultsContainer = document.getElementById('search-results-filtered');
    const zeroInputContainer = document.getElementById('search-results');

    if (!resultsContainer || !zeroInputContainer) return;

    if (!query || query.trim().length === 0) {
        // Show zero-input content
        resultsContainer.style.display = 'none';
        zeroInputContainer.style.display = 'block';
        return;
    }

    // Hide zero-input, show filtered
    zeroInputContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    // Search using external function if available
    const searchAllEntities = window.searchAllEntities || function() {
        return {};
    };

    const results = searchAllEntities(state, query);
    const escapeHtml = window.escapeHtml || window.EOWorkbenchUICore?.escapeHtml || ((s) => s);
    const capitalize = window.capitalize || window.EOWorkbenchUICore?.capitalize || ((s) => s);

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

/**
 * Attach search modal event listeners
 * @param {Object} state - Application state
 */
function attachSearchListeners(state) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                handleSearchInput(state, e.target.value);
            }, 150);
        });

        // Focus on open
        searchInput.focus();
    }

    // Handle result item clicks
    document.addEventListener('click', (e) => {
        const resultItem = e.target.closest('.search-result-item');
        if (resultItem) {
            const type = resultItem.dataset.type;
            const id = resultItem.dataset.id;
            handleSearchResultClick(state, type, id);
        }
    });
}

/**
 * Handle search result item click
 * @param {Object} state - Application state
 * @param {string} type - Entity type
 * @param {string} id - Entity ID
 */
function handleSearchResultClick(state, type, id) {
    switch (type.toLowerCase()) {
        case 'set':
            if (window.switchSet) {
                window.switchSet(id);
            }
            break;
        case 'view':
            const view = state.views?.get(id);
            if (view && window.switchSet) {
                window.switchSet(view.setId, id);
            }
            break;
        case 'field':
            // Could scroll to field in current view
            console.log('Navigate to field:', id);
            break;
        case 'record':
            // Could open record modal
            console.log('Open record:', id);
            break;
    }

    // Close search modal
    const modal = document.querySelector('.search-modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// ============================================================================
// VIEW TAB EVENTS
// ============================================================================

/**
 * Attach view tab event listeners
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 */
function attachViewTabListeners(state, setId) {
    // View tab clicks
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Don't handle if clicking the menu button
            if (e.target.closest('.view-menu-btn')) return;

            const viewId = tab.dataset.viewId;
            if (viewId && window.switchSet) {
                window.switchSet(setId, viewId);
            }
        });
    });

    // View menu buttons
    document.querySelectorAll('.view-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const viewId = btn.dataset.viewId;
            const showViewMenu = window.showViewMenu ||
                window.EOWorkbenchUIDialogs?.showViewMenu;
            if (viewId && showViewMenu) {
                showViewMenu(state, viewId, e.currentTarget);
            }
        });
    });

    // New view button
    const addViewBtn = document.querySelector('.view-tab-add');
    if (addViewBtn) {
        addViewBtn.addEventListener('click', () => {
            const showCreateViewDialog = window.showCreateViewDialog ||
                window.EOWorkbenchUIDialogs?.showCreateViewDialog;
            if (showCreateViewDialog) {
                showCreateViewDialog(state, setId);
            }
        });
    }

    // Save view button
    document.querySelectorAll('.btn-save-view').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.viewId;
            const view = state.views?.get(viewId);
            if (view) {
                view.isDirty = false;
                // Persist view state
                if (window.saveViewState) {
                    window.saveViewState(view);
                }
                const showToast = window.showToast || window.EOWorkbenchUICore?.showToast;
                if (showToast) {
                    showToast('View saved');
                }
            }
        });
    });

    // Save view as button
    document.querySelectorAll('.btn-save-view-as').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.viewId;
            const showSaveViewAsDialog = window.showSaveViewAsDialog ||
                window.EOWorkbenchUIDialogs?.showSaveViewAsDialog;
            if (viewId && showSaveViewAsDialog) {
                showSaveViewAsDialog(state, viewId);
            }
        });
    });
}

// ============================================================================
// STRUCTURAL OPERATIONS TOOLBAR EVENTS
// ============================================================================

/**
 * Attach structural operations toolbar listeners
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 */
function attachStructuralOpsListeners(state, setId) {
    document.querySelectorAll('.btn-structural-op').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const op = e.currentTarget.dataset.op;
            handleStructuralOpClick(state, setId, op);
        });
    });
}

/**
 * Handle structural operation click
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 * @param {string} op - Operation type
 */
function handleStructuralOpClick(state, setId, op) {
    const dialogs = window.EOWorkbenchUIDialogs || {};

    switch (op) {
        case 'dedupe':
            (dialogs.showDedupeDialog || window.showDedupeDialog)?.(state, setId);
            break;
        case 'merge':
            // Get selected record IDs
            const selectedIds = getSelectedRecordIds(state);
            if (selectedIds.length >= 2) {
                (dialogs.showMergeRecordsDialog || window.showMergeRecordsDialog)?.(state, setId, selectedIds);
            } else {
                alert('Please select at least 2 records to merge');
            }
            break;
        case 'split':
            const selectedId = getSelectedRecordIds(state)[0];
            if (selectedId) {
                (dialogs.showSplitRecordDialog || window.showSplitRecordDialog)?.(state, setId, selectedId);
            } else {
                alert('Please select a record to split');
            }
            break;
        case 'harmonize':
            (dialogs.showHarmonizeFieldsDialog || window.showHarmonizeFieldsDialog)?.(state, setId);
            break;
    }
}

/**
 * Get currently selected record IDs
 * @param {Object} state - Application state
 * @returns {Array} Array of selected record IDs
 */
function getSelectedRecordIds(state) {
    // Check for selection state
    if (state.selectedRecordIds) {
        return Array.from(state.selectedRecordIds);
    }

    // Fallback: check DOM for selected rows
    const selectedRows = document.querySelectorAll('.grid-row.selected, tr.selected');
    return Array.from(selectedRows).map(row => row.dataset.recordId).filter(Boolean);
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        attachViewToolbarListeners,
        handleStructuralOperation,
        showAvailableFieldsExplorer,
        showJSONScrubber,
        handleSearchInput,
        attachSearchListeners,
        handleSearchResultClick,
        attachViewTabListeners,
        attachStructuralOpsListeners,
        handleStructuralOpClick,
        getSelectedRecordIds
    };
}

// Expose to window for browser use
if (typeof window !== 'undefined') {
    window.EOWorkbenchUIEvents = {
        attachViewToolbarListeners,
        handleStructuralOperation,
        showAvailableFieldsExplorer,
        showJSONScrubber,
        handleSearchInput,
        attachSearchListeners,
        handleSearchResultClick,
        attachViewTabListeners,
        attachStructuralOpsListeners,
        handleStructuralOpClick,
        getSelectedRecordIds
    };

    // Also expose globally for backward compatibility
    window.attachViewToolbarListeners = attachViewToolbarListeners;
    window.showAvailableFieldsExplorer = showAvailableFieldsExplorer;
    window.showJSONScrubber = showJSONScrubber;
    window.handleSearchInput = handleSearchInput;
}
