/**
 * EO Data Workbench UI Components
 *
 * EO Operator: SEG (Segmentation) - FACADE MODULE
 *
 * This module has been split into focused sub-modules:
 * - eo_workbench_ui_core.js    - Pure rendering functions
 * - eo_workbench_ui_dialogs.js - Modal dialog components
 * - eo_workbench_ui_events.js  - Event handlers and listeners
 *
 * This file serves as the backward-compatible facade that re-exports
 * all functions from the sub-modules.
 *
 * Components provided:
 * - View management (switcher, editor)
 * - View reification (save, save as, from focus)
 * - Structural operations (dedupe, merge, split, harmonize)
 * - Zero-input search/discovery surface
 *
 * Script loading order:
 * 1. eo_workbench_ui_core.js
 * 2. eo_workbench_ui_dialogs.js
 * 3. eo_workbench_ui_events.js
 * 4. eo_workbench_ui.js (this file - facade)
 */

// ============================================================================
// MODULE DETECTION
// ============================================================================

/**
 * Get a function from sub-modules or provide fallback
 * @param {string} funcName - Function name
 * @param {string} moduleName - Module name (Core, Dialogs, Events)
 * @returns {Function} The function or a warning stub
 */
function getSubModuleFunc(funcName, moduleName) {
    // Try namespaced version first
    const namespace = 'EOWorkbenchUI' + moduleName;
    if (window[namespace] && window[namespace][funcName]) {
        return window[namespace][funcName];
    }

    // Try global version
    if (window[funcName]) {
        return window[funcName];
    }

    // Return warning stub
    return function() {
        console.warn(`[EO Workbench UI] ${funcName} not available. Ensure eo_workbench_ui_${moduleName.toLowerCase()}.js is loaded.`);
    };
}

// ============================================================================
// CORE RENDERING FUNCTIONS (from eo_workbench_ui_core.js)
// ============================================================================

function escapeHtml(text) {
    return getSubModuleFunc('escapeHtml', 'Core')(text);
}

function capitalize(str) {
    return getSubModuleFunc('capitalize', 'Core')(str);
}

function getEntityDisplayName(entity) {
    return getSubModuleFunc('getEntityDisplayName', 'Core')(entity);
}

function showToast(message, duration) {
    return getSubModuleFunc('showToast', 'Core')(message, duration);
}

function renderViewManager(state, setId) {
    return getSubModuleFunc('renderViewManager', 'Core')(state, setId);
}

function renderViewToolbar(state, setId) {
    return getSubModuleFunc('renderViewToolbar', 'Core')(state, setId);
}

function renderStructuralOperationsToolbar(state) {
    return getSubModuleFunc('renderStructuralOperationsToolbar', 'Core')(state);
}

function renderCreateViewFromFocusButton(state, focus) {
    return getSubModuleFunc('renderCreateViewFromFocusButton', 'Core')(state, focus);
}

function renderEnhancedSearchModal(state) {
    return getSubModuleFunc('renderEnhancedSearchModal', 'Core')(state);
}

function renderMergeTable(schema, records) {
    return getSubModuleFunc('renderMergeTable', 'Core')(schema, records);
}

// ============================================================================
// DIALOG FUNCTIONS (from eo_workbench_ui_dialogs.js)
// ============================================================================

function showViewMenu(state, viewId, buttonElement) {
    return getSubModuleFunc('showViewMenu', 'Dialogs')(state, viewId, buttonElement);
}

function showCreateViewDialog(state, setId, baseConfig) {
    return getSubModuleFunc('showCreateViewDialog', 'Dialogs')(state, setId, baseConfig);
}

function showSaveViewAsDialog(state, viewId) {
    return getSubModuleFunc('showSaveViewAsDialog', 'Dialogs')(state, viewId);
}

function showDedupeDialog(state, setId) {
    return getSubModuleFunc('showDedupeDialog', 'Dialogs')(state, setId);
}

function showMergeRecordsDialog(state, setId, recordIds) {
    return getSubModuleFunc('showMergeRecordsDialog', 'Dialogs')(state, setId, recordIds);
}

function showSplitRecordDialog(state, setId, recordId) {
    return getSubModuleFunc('showSplitRecordDialog', 'Dialogs')(state, setId, recordId);
}

function showHarmonizeFieldsDialog(state, setId) {
    return getSubModuleFunc('showHarmonizeFieldsDialog', 'Dialogs')(state, setId);
}

function showJSONScrubberMenu(state, setId, buttonElement) {
    return getSubModuleFunc('showJSONScrubberMenu', 'Dialogs')(state, setId, buttonElement);
}

// ============================================================================
// EVENT HANDLER FUNCTIONS (from eo_workbench_ui_events.js)
// ============================================================================

function attachViewToolbarListeners(state, setId) {
    return getSubModuleFunc('attachViewToolbarListeners', 'Events')(state, setId);
}

function showAvailableFieldsExplorer(state, setId) {
    return getSubModuleFunc('showAvailableFieldsExplorer', 'Events')(state, setId);
}

function showJSONScrubber(state, setId, mode, record) {
    return getSubModuleFunc('showJSONScrubber', 'Events')(state, setId, mode, record);
}

function handleSearchInput(state, query) {
    return getSubModuleFunc('handleSearchInput', 'Events')(state, query);
}

function attachViewTabListeners(state, setId) {
    return getSubModuleFunc('attachViewTabListeners', 'Events')(state, setId);
}

function attachStructuralOpsListeners(state, setId) {
    return getSubModuleFunc('attachStructuralOpsListeners', 'Events')(state, setId);
}

// ============================================================================
// HELPER: Get set views (needed by core rendering)
// ============================================================================

function getSetViews(state, setId) {
    return getSubModuleFunc('getSetViews', 'Core')(state, setId);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize workbench UI for a set
 * Attaches all event listeners after rendering
 * @param {Object} state - Application state
 * @param {string} setId - Set ID
 */
function initWorkbenchUI(state, setId) {
    // Attach all event listeners
    attachViewToolbarListeners(state, setId);
    attachViewTabListeners(state, setId);
    attachStructuralOpsListeners(state, setId);
}

// ============================================================================
// MODULE STATUS CHECK
// ============================================================================

/**
 * Check if all sub-modules are loaded
 * @returns {Object} Status of each sub-module
 */
function checkModuleStatus() {
    return {
        core: !!window.EOWorkbenchUICore,
        dialogs: !!window.EOWorkbenchUIDialogs,
        events: !!window.EOWorkbenchUIEvents,
        allLoaded: !!(window.EOWorkbenchUICore && window.EOWorkbenchUIDialogs && window.EOWorkbenchUIEvents)
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Core rendering
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
        renderMergeTable,
        // Dialogs
        showViewMenu,
        showCreateViewDialog,
        showSaveViewAsDialog,
        showDedupeDialog,
        showMergeRecordsDialog,
        showSplitRecordDialog,
        showHarmonizeFieldsDialog,
        showJSONScrubberMenu,
        // Events
        attachViewToolbarListeners,
        showAvailableFieldsExplorer,
        showJSONScrubber,
        handleSearchInput,
        attachViewTabListeners,
        attachStructuralOpsListeners,
        // Initialization
        initWorkbenchUI,
        checkModuleStatus
    };
}

// Expose to window for browser use
if (typeof window !== 'undefined') {
    // Main namespace
    window.EOWorkbenchUI = {
        // Core rendering
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
        renderMergeTable,
        // Dialogs
        showViewMenu,
        showCreateViewDialog,
        showSaveViewAsDialog,
        showDedupeDialog,
        showMergeRecordsDialog,
        showSplitRecordDialog,
        showHarmonizeFieldsDialog,
        showJSONScrubberMenu,
        // Events
        attachViewToolbarListeners,
        showAvailableFieldsExplorer,
        showJSONScrubber,
        handleSearchInput,
        attachViewTabListeners,
        attachStructuralOpsListeners,
        // Initialization
        initWorkbenchUI,
        checkModuleStatus
    };

    // Global exports for backward compatibility
    // (Only export if not already defined by sub-modules)
    const globalExports = [
        'showAvailableFieldsExplorer',
        'showJSONScrubber',
        'showJSONScrubberMenu',
        'renderViewToolbar',
        'attachViewToolbarListeners'
    ];

    globalExports.forEach(name => {
        if (!window[name]) {
            window[name] = window.EOWorkbenchUI[name];
        }
    });

    // Log module status in development
    if (typeof console !== 'undefined') {
        setTimeout(() => {
            const status = checkModuleStatus();
            if (!status.allLoaded) {
                console.warn('[EO Workbench UI] Sub-modules not fully loaded:', status);
                console.info('Required script load order:');
                console.info('  1. eo_workbench_ui_core.js');
                console.info('  2. eo_workbench_ui_dialogs.js');
                console.info('  3. eo_workbench_ui_events.js');
                console.info('  4. eo_workbench_ui.js (facade)');
            }
        }, 100);
    }
}
