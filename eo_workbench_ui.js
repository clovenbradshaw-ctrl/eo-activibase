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
 * Get view relationship info for display
 * Returns an object describing the view's relationships to other views
 */
function getViewRelationshipInfo(state, view, allViews) {
    const info = {
        isSource: false,       // Other views depend on this one
        isLinked: false,       // This view is derived from another
        parentView: null,      // The view this one derives from
        dependentCount: 0,     // Number of views that depend on this one
        isDerived: view.dataSource === 'derived' || view.isPivot || view.isReadOnly,
        derivationType: null   // 'filter', 'pivot', 'clone', etc.
    };

    // Check if this view is derived from another
    const derivedFromIds = view.provenance?.derivedFromViewIds || [];
    if (derivedFromIds.length > 0) {
        info.isLinked = true;
        info.parentView = state.views?.get(derivedFromIds[0]);

        // Determine derivation type from notes or pivot metadata
        if (view.pivotMetadata) {
            info.derivationType = 'pivot';
        } else if (view.provenance?.notes?.includes('Cloned')) {
            info.derivationType = 'clone';
        } else if (view.provenance?.notes?.includes('filter') || view.filters?.length > 0) {
            info.derivationType = 'filter';
        } else {
            info.derivationType = 'derived';
        }
    }

    // Check if other views depend on this one
    const dependents = allViews.filter(v =>
        v.id !== view.id &&
        (v.provenance?.derivedFromViewIds || []).includes(view.id)
    );
    info.dependentCount = dependents.length;
    info.isSource = dependents.length > 0;

    return info;
}

/**
 * Render the relationship indicator badge for a view tab
 */
function renderViewRelationshipBadge(relationshipInfo) {
    if (!relationshipInfo.isLinked && !relationshipInfo.isSource) {
        return ''; // No relationships to show
    }

    const parts = [];

    // Linked/derived indicator
    if (relationshipInfo.isLinked) {
        const parentName = relationshipInfo.parentView?.name || 'another view';
        const typeLabel = {
            'pivot': 'Pivoted from',
            'clone': 'Cloned from',
            'filter': 'Filtered from',
            'derived': 'Based on'
        }[relationshipInfo.derivationType] || 'Based on';

        parts.push(`
            <span class="view-link-badge linked"
                  title="${typeLabel}: ${escapeHtml(parentName)}">
                <span class="link-icon">⛓️</span>
            </span>
        `);
    }

    // Source indicator (has dependents)
    if (relationshipInfo.isSource) {
        const depCount = relationshipInfo.dependentCount;
        const depLabel = depCount === 1 ? '1 view depends on this' : `${depCount} views depend on this`;
        parts.push(`
            <span class="view-link-badge source"
                  title="${depLabel}">
                <span class="source-count">${depCount}</span>
            </span>
        `);
    }

    return parts.join('');
}

/**
 * Render view switcher for a set
 * Shows tabs/list of views with + New View button
 */
function renderViewManager(state, setId) {
    const set = state.sets.get(setId);
    if (!set) return '';

    const views = getSetViews(state, setId);
    const currentViewId = state.currentViewId;

    // Use array.push() + join() for better performance
    const parts = ['<div class="view-manager">', '<div class="view-tabs">'];

    views.forEach(view => {
        const isActive = view.id === currentViewId;
        const isDirty = view.isDirty ? ' *' : '';
        const relationshipInfo = getViewRelationshipInfo(state, view, views);
        const relationshipBadge = renderViewRelationshipBadge(relationshipInfo);

        // Build CSS classes
        const tabClasses = ['view-tab'];
        if (isActive) tabClasses.push('active');
        if (relationshipInfo.isDerived) tabClasses.push('derived-data');
        if (relationshipInfo.isLinked) tabClasses.push('linked');
        if (relationshipInfo.isSource) tabClasses.push('source');

        // Build tooltip
        let tooltip = view.name;
        if (relationshipInfo.isLinked && relationshipInfo.parentView) {
            const typeLabel = {
                'pivot': 'Pivoted from',
                'clone': 'Cloned from',
                'filter': 'Filtered from',
                'derived': 'Based on'
            }[relationshipInfo.derivationType] || 'Based on';
            tooltip += ` (${typeLabel}: ${relationshipInfo.parentView.name})`;
        }
        if (relationshipInfo.isDerived) {
            tooltip += ' [Derived data - not live source]';
        }

        // Show scratch pad indicator for derived/computed data views
        const scratchPadIndicator = relationshipInfo.isDerived
            ? '<span class="scratch-pad-indicator" title="Scratch pad: derived/computed data">📊</span>'
            : '';

        parts.push(`
            <div class="${tabClasses.join(' ')}" data-view-id="${view.id}" title="${escapeHtml(tooltip)}">
                ${relationshipBadge}
                <span class="view-icon">${view.icon || '📋'}</span>
                <span class="view-name">${escapeHtml(view.name)}${isDirty}</span>
                ${scratchPadIndicator}
                <button class="view-menu-btn" data-view-id="${view.id}" title="View options">⋮</button>
            </div>
        `);
    });

    parts.push(`
        <button class="view-tab-add" title="New view">
            <span class="icon">+</span> New View
        </button>
    `);

    parts.push('</div>'); // .view-tabs

    // View lineage bar (shown when current view is linked)
    if (currentViewId) {
        const currentView = state.views?.get(currentViewId);
        if (currentView) {
            const relationshipInfo = getViewRelationshipInfo(state, currentView, views);
            if (relationshipInfo.isLinked || relationshipInfo.isSource) {
                parts.push(renderViewLineageBar(state, currentView, views));
            }
        }
    }

    // View actions (shown when view is dirty)
    if (currentViewId) {
        const currentView = state.views?.get(currentViewId);
        if (currentView?.isDirty) {
            parts.push(`
                <div class="view-actions">
                    <span class="unsaved-label">Unsaved changes</span>
                    <button class="btn-save-view" data-view-id="${currentViewId}">Save View</button>
                    <button class="btn-save-view-as" data-view-id="${currentViewId}">Save As...</button>
                </div>
            `);
        }
    }

    parts.push('</div>'); // .view-manager

    return parts.join('');
}

/**
 * Render the view lineage bar showing relationship chain
 */
function renderViewLineageBar(state, currentView, allViews) {
    const relationshipInfo = getViewRelationshipInfo(state, currentView, allViews);
    const parts = ['<div class="view-lineage-bar">'];

    // Build lineage chain (parents)
    const lineageChain = [];
    let cursor = currentView;
    const visited = new Set();

    while (cursor && !visited.has(cursor.id)) {
        visited.add(cursor.id);
        const derivedFromIds = cursor.provenance?.derivedFromViewIds || [];
        if (derivedFromIds.length > 0) {
            const parentView = state.views?.get(derivedFromIds[0]);
            if (parentView) {
                lineageChain.unshift(parentView);
                cursor = parentView;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    // Render lineage chain
    if (lineageChain.length > 0) {
        parts.push('<div class="lineage-chain">');
        parts.push('<span class="lineage-label">Lineage:</span>');

        lineageChain.forEach((view, idx) => {
            parts.push(`
                <button class="lineage-item" data-view-id="${view.id}" title="Go to ${escapeHtml(view.name)}">
                    <span class="lineage-icon">${view.icon || '📋'}</span>
                    <span class="lineage-name">${escapeHtml(view.name)}</span>
                </button>
            `);
            parts.push('<span class="lineage-arrow">→</span>');
        });

        // Current view (highlighted)
        parts.push(`
            <span class="lineage-item current">
                <span class="lineage-icon">${currentView.icon || '📋'}</span>
                <span class="lineage-name">${escapeHtml(currentView.name)}</span>
            </span>
        `);

        parts.push('</div>');
    }

    // Show dependents info
    if (relationshipInfo.isSource) {
        const dependents = allViews.filter(v =>
            v.id !== currentView.id &&
            (v.provenance?.derivedFromViewIds || []).includes(currentView.id)
        );

        parts.push('<div class="lineage-dependents">');
        parts.push(`<span class="dependents-label">${dependents.length} derived view${dependents.length !== 1 ? 's' : ''}:</span>`);

        dependents.slice(0, 3).forEach(dep => {
            parts.push(`
                <button class="dependent-item" data-view-id="${dep.id}" title="Go to ${escapeHtml(dep.name)}">
                    ${escapeHtml(dep.name)}
                </button>
            `);
        });

        if (dependents.length > 3) {
            parts.push(`<span class="more-dependents">+${dependents.length - 3} more</span>`);
        }

        parts.push('</div>');
    }

    // Derived data indicator - clear visual that this is "scratch pad" data
    if (relationshipInfo.isDerived) {
        parts.push(`
            <div class="derived-data-bar">
                <span class="derived-icon">📊</span>
                <span class="derived-text">Scratch Pad - This view shows derived/computed data, not live source</span>
            </div>
        `);
    }

    parts.push('</div>');
    return parts.join('');
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

    // Close on click outside - use a named function for proper cleanup
    const closeMenuHandler = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenuHandler);
        }
    };
    // Delay to prevent immediate close from the triggering click
    setTimeout(() => document.addEventListener('click', closeMenuHandler), 0);

    // Also clean up when menu items are clicked
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            document.removeEventListener('click', closeMenuHandler);
        });
    });
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
                <button class="toolbar-btn" id="btnNewLinkColumn" title="Create a new link column to connect sets">
                    <span class="icon">➕🔗</span>
                    <span class="label">New Link</span>
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

    // Close on click outside - use a named function for proper cleanup
    const closeMenuHandler = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenuHandler);
        }
    };
    // Delay to prevent immediate close from the triggering click
    setTimeout(() => document.addEventListener('click', closeMenuHandler), 0);

    // Handle menu item clicks with proper listener cleanup
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const mode = item.dataset.mode;
            document.removeEventListener('click', closeMenuHandler);
            menu.remove();
            showJSONScrubber(state, setId, mode);
        });
    });
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

    // New Link Column button - creates a LINK_RECORD field with relationship type
    const btnNewLink = document.getElementById('btnNewLinkColumn');
    if (btnNewLink) {
        btnNewLink.addEventListener('click', () => {
            if (window.EOLinkColumnModal) {
                const set = state.sets.get(setId);
                if (set) {
                    const modal = new window.EOLinkColumnModal();
                    modal.show(set, state);
                }
            } else {
                console.warn('EOLinkColumnModal not loaded');
                alert('Link Column Modal not available. Please ensure eo_link_column_modal.js is loaded.');
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
    // Use array.push() + join() for better performance
    const parts = ['<table class="merge-comparison-table">', '<thead><tr><th>Field</th>'];
    records.forEach((rec, idx) => {
        parts.push(`<th>Record ${idx + 1}</th>`);
    });
    parts.push('<th>Strategy</th></tr></thead><tbody>');

    schema.forEach(field => {
        parts.push('<tr>');
        parts.push(`<td class="field-name">${escapeHtml(field.name || field.id)}</td>`);

        records.forEach((rec, idx) => {
            const value = rec[field.id];
            const displayValue = value !== undefined && value !== null && value !== '' ?
                escapeHtml(String(value)) : '<em>empty</em>';

            parts.push(`
                <td>
                    <label>
                        <input type="radio" name="field_${field.id}" value="index_${idx}" ${idx === 0 ? 'checked' : ''}>
                        ${displayValue}
                    </label>
                </td>
            `);
        });

        parts.push(`
            <td>
                <select class="strategy-select" data-field="${field.id}">
                    <option value="first">First</option>
                    <option value="longest">Longest</option>
                    <option value="concat">Concatenate</option>
                </select>
            </td>
        `);

        parts.push('</tr>');
    });

    parts.push('</tbody></table>');
    return parts.join('');
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
    // Use array.push() + join() for better performance
    const parts = ['<div class="zero-input-search">'];

    // Recent items
    if (data.recent.length > 0) {
        parts.push('<div class="search-section">');
        parts.push('<h3>Recent</h3>');
        parts.push('<div class="recent-items">');
        data.recent.forEach(item => {
            parts.push(`
                <div class="search-result-item" data-type="${item.type}" data-id="${item.id}">
                    <span class="type-badge">${item.type}</span>
                    <span class="item-name">${getEntityDisplayName(item.entity)}</span>
                    <span class="item-meta">${new Date(item.lastAccessed).toLocaleString()}</span>
                </div>
            `);
        });
        parts.push('</div></div>');
    }

    // Frequent fields
    if (data.frequentFields.length > 0) {
        parts.push('<div class="search-section">');
        parts.push('<h3>Frequently Used Fields</h3>');
        parts.push('<div class="frequent-fields">');
        data.frequentFields.forEach(item => {
            parts.push(`
                <div class="search-result-item" data-type="Field" data-id="${item.fieldId}" data-set-id="${item.setId}">
                    <span class="type-badge">Field</span>
                    <span class="item-name">${escapeHtml(item.field.name || item.fieldId)}</span>
                    <span class="item-meta">${item.count} uses in ${item.setName}</span>
                </div>
            `);
        });
        parts.push('</div></div>');
    }

    // New & Updated
    if (data.newAndUpdated.length > 0) {
        parts.push('<div class="search-section">');
        parts.push('<h3>New & Updated</h3>');
        parts.push('<div class="new-updated-items">');
        data.newAndUpdated.forEach(item => {
            parts.push(`
                <div class="search-result-item" data-type="${item.type}" data-id="${item.id}">
                    <span class="type-badge">${item.type}</span>
                    <span class="item-name">${escapeHtml(item.name)}</span>
                    <span class="item-meta">${item.action} ${new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
            `);
        });
        parts.push('</div></div>');
    }

    // Structural Highlights
    if (data.structuralHighlights.length > 0) {
        parts.push('<div class="search-section">');
        parts.push('<h3>Structural Highlights</h3>');
        parts.push('<div class="highlights">');
        data.structuralHighlights.forEach(highlight => {
            parts.push(`
                <div class="highlight-item" data-highlight-type="${highlight.type}">
                    <span class="highlight-label">${highlight.label}</span>
                    <span class="highlight-count">${highlight.count}</span>
                </div>
            `);
        });
        parts.push('</div></div>');
    }

    // Browse
    parts.push('<div class="search-section">');
    parts.push('<h3>Browse</h3>');
    parts.push('<div class="browse-categories">');
    Object.entries(data.browse).forEach(([type, count]) => {
        if (count > 0) {
            parts.push(`
                <div class="browse-item" data-entity-type="${type}">
                    <span class="browse-label">${capitalize(type)}</span>
                    <span class="browse-count">${count}</span>
                </div>
            `);
        }
    });
    parts.push('</div></div>');

    parts.push('</div>'); // .zero-input-search
    return parts.join('');
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

    // Render filtered results using array.push() + join() for better performance
    const parts = ['<div class="filtered-search-results">'];

    Object.entries(results).forEach(([category, items]) => {
        if (items.length > 0) {
            parts.push(`<div class="search-section">`);
            parts.push(`<h3>${capitalize(category)} (${items.length})</h3>`);
            parts.push('<div class="search-results-list">');

            items.forEach(item => {
                parts.push(`
                    <div class="search-result-item" data-type="${item.type}" data-id="${item.id}">
                        <span class="type-badge">${item.type}</span>
                        <span class="item-name">${escapeHtml(item.name || item.term || item.id)}</span>
                        ${item.setName ? `<span class="item-meta">in ${escapeHtml(item.setName)}</span>` : ''}
                    </div>
                `);
            });

            parts.push('</div></div>');
        }
    });

    if (Object.values(results).every(arr => arr.length === 0)) {
        parts.push('<div class="no-results">No results found</div>');
    }

    parts.push('</div>');
    resultsContainer.innerHTML = parts.join('');
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
        getViewRelationshipInfo,
        renderViewRelationshipBadge,
        renderViewLineageBar
    };
}

// Also expose to window for browser use
if (typeof window !== 'undefined') {
    window.showAvailableFieldsExplorer = showAvailableFieldsExplorer;
    window.showJSONScrubber = showJSONScrubber;
    window.showJSONScrubberMenu = showJSONScrubberMenu;
    window.renderViewToolbar = renderViewToolbar;
    window.attachViewToolbarListeners = attachViewToolbarListeners;
    window.getViewRelationshipInfo = getViewRelationshipInfo;
    window.renderViewRelationshipBadge = renderViewRelationshipBadge;
    window.renderViewLineageBar = renderViewLineageBar;
}
