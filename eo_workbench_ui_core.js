/**
 * EO Workbench UI - Core Rendering Functions
 *
 * EO Operator: SEG (Segmentation)
 * - Split from eo_workbench_ui.js for cohesion
 * - Pure rendering functions that take state and return HTML
 * - No side effects, no DOM manipulation (except escapeHtml)
 *
 * Dependencies: None (pure functions)
 * Consumers: eo_workbench_ui.js, eo_workbench_ui_dialogs.js
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Raw text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get display name from entity
 * @param {Object} entity - Entity object
 * @returns {string} Display name
 */
function getEntityDisplayName(entity) {
    if (!entity) return 'Unknown';
    return entity.name || entity.term || entity.id || 'Unnamed';
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms
 */
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
// VIEW MANAGER RENDERING
// ============================================================================

/**
 * Render view switcher for a set
 * Shows tabs/list of views with + New View button
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 * @returns {string} HTML string
 */
function renderViewManager(state, setId) {
    const set = state.sets.get(setId);
    if (!set) return '';

    // Get views for this set
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
 * Helper to get views for a set
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 * @returns {Array} Array of views
 */
function getSetViews(state, setId) {
    if (!state.views) return [];

    const views = [];
    state.views.forEach(view => {
        if (view.setId === setId) {
            views.push(view);
        }
    });
    return views;
}

// ============================================================================
// VIEW TOOLBAR RENDERING
// ============================================================================

/**
 * Render view toolbar with field management and operations
 * This toolbar appears below the view tabs and provides quick access to common actions
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 * @returns {string} HTML string
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
 * Render structural operations toolbar
 * @param {Object} state - Application state
 * @returns {string} HTML string
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

// ============================================================================
// VIEW REIFICATION RENDERING
// ============================================================================

/**
 * Show "Create View from Focus" button in focus panel
 * @param {Object} state - Application state
 * @param {Object} focus - Focus configuration
 * @returns {string} HTML string
 */
function renderCreateViewFromFocusButton(state, focus) {
    if (!focus) return '';

    return `
        <button class="btn-create-view-from-focus" data-focus='${JSON.stringify(focus)}'>
            <span class="icon">📌</span> Create View from Focus
        </button>
    `;
}

// ============================================================================
// SEARCH UI RENDERING
// ============================================================================

/**
 * Render enhanced search modal with zero-input surface
 * @param {Object} state - Application state
 * @returns {string} HTML string
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
 * @param {Object} data - Zero-input data
 * @returns {string} HTML string
 */
function renderZeroInputContent(data) {
    let html = '<div class="zero-input-search">';

    // Recent items
    if (data.recent && data.recent.length > 0) {
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
    if (data.frequentFields && data.frequentFields.length > 0) {
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
    if (data.newAndUpdated && data.newAndUpdated.length > 0) {
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
    if (data.structuralHighlights && data.structuralHighlights.length > 0) {
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
    if (data.browse) {
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
    }

    html += '</div>'; // .zero-input-search
    return html;
}

/**
 * Build zero-input search data from state
 * @param {Object} state - Application state
 * @returns {Object} Zero-input data structure
 */
function buildZeroInputSearchData(state) {
    return {
        recent: state.recentItems || [],
        frequentFields: state.frequentFields || [],
        newAndUpdated: state.newAndUpdated || [],
        structuralHighlights: state.structuralHighlights || [],
        browse: {
            sets: state.sets?.size || 0,
            views: state.views?.size || 0,
            fields: countAllFields(state),
            definitions: state.definitions?.size || 0
        }
    };
}

/**
 * Count all fields across all sets
 * @param {Object} state - Application state
 * @returns {number} Total field count
 */
function countAllFields(state) {
    let count = 0;
    if (state.sets) {
        state.sets.forEach(set => {
            count += (set.schema || []).length;
        });
    }
    return count;
}

/**
 * Render merge comparison table
 * @param {Array} schema - Field schema array
 * @param {Array} records - Records to merge
 * @returns {string} HTML string
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

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Utilities
        escapeHtml,
        capitalize,
        getEntityDisplayName,
        showToast,
        // View rendering
        renderViewManager,
        getSetViews,
        renderViewToolbar,
        renderStructuralOperationsToolbar,
        renderCreateViewFromFocusButton,
        // Search rendering
        renderEnhancedSearchModal,
        renderZeroInputContent,
        buildZeroInputSearchData,
        countAllFields,
        renderMergeTable
    };
}

// Expose to window for browser use
if (typeof window !== 'undefined') {
    window.EOWorkbenchUICore = {
        escapeHtml,
        capitalize,
        getEntityDisplayName,
        showToast,
        renderViewManager,
        getSetViews,
        renderViewToolbar,
        renderStructuralOperationsToolbar,
        renderCreateViewFromFocusButton,
        renderEnhancedSearchModal,
        renderZeroInputContent,
        buildZeroInputSearchData,
        countAllFields,
        renderMergeTable
    };

    // Also expose utilities globally for backward compatibility
    window.escapeHtml = escapeHtml;
    window.showToast = showToast;
}
