# EO Data Workbench Integration Guide

This guide explains how to integrate the new view management, structural operations, and zero-input search features into your EO Activibase application.

## Overview

The data workbench enhancement adds three major capabilities:

1. **View Management** - Views as first-class entities with provenance
2. **Structural Operations** - Dedupe, merge, split, harmonize with full tracking
3. **Zero-Input Search** - Discovery surface showing relevant content before typing

## Files Added

- `eo_view_management.js` - Core view entity model and functions
- `eo_structural_operations.js` - Structural operation functions (dedupe, merge, split, harmonize)
- `eo_discovery.js` - Zero-input search and discovery functions
- `eo_workbench_ui.js` - UI components for all features
- `eo_workbench_styles.css` - Styles for all UI components
- `DATA_WORKBENCH_INTEGRATION.md` - This file

## Integration Steps

### Step 1: Add Script References to index.html

Add these script tags before your main application code (after any existing library includes):

```html
<!-- EO Data Workbench Modules -->
<script src="eo_view_management.js"></script>
<script src="eo_structural_operations.js"></script>
<script src="eo_discovery.js"></script>
<script src="eo_workbench_ui.js"></script>
```

Add the CSS:

```html
<!-- EO Data Workbench Styles -->
<link rel="stylesheet" href="eo_workbench_styles.css">
```

### Step 2: Update State Initialization

In your state initialization (around line 4246 in index.html), add:

```javascript
const state = {
    worlds: new Map(),
    entities: new Map(),
    currentWorldId: null,
    sets: new Map(),
    currentSetId: null,
    currentViewId: null,
    currentProfileId: 'default',
    eventStream: [],
    eventIdCounter: 1,
    currentUser: { type: 'Person', id: 'user_1', name: 'User' },

    // NEW: Add these for data workbench
    views: new Map(),                    // Global views map
    structuralOperations: new Map(),     // Structural operations tracking

    // ... rest of existing state
};
```

### Step 3: Migrate Existing Views

After loading a world from JSON (in `importWorldFromJson` function), add migration:

```javascript
function importWorldFromJson(payload) {
    // ... existing import code ...

    // NEW: Migrate views to ViewEntity structure
    if (typeof migrateViews === 'function') {
        migrateViews(state);
    }

    // ... rest of function ...
}
```

### Step 4: Update createView Function

Replace the existing `createView` function (around line 6882) with a wrapper that uses the new system:

```javascript
// Original createView - now delegates to new view management
function createView(setId, name, config = {}) {
    const set = state.sets.get(setId);
    if (!set) return null;

    // Use new createView from eo_view_management.js
    if (typeof window.createView === 'undefined') {
        // Fallback to old behavior if module not loaded
        const viewId = 'view_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const defaultIdentifier = config.identifierField || inferIdentifierFieldId(set);
        const viewPayload = {
            id: viewId,
            setId,
            name: name,
            type: config.type || 'grid',
            icon: config.icon || VIEW_TYPE_ICONS[config.type || 'grid'] || '📋',
            filters: config.filters || [],
            sorts: config.sorts || [],
            hiddenFields: config.hiddenFields || [],
            // ... rest of existing fields ...
            createdAt: Date.now(),
            createdBy: state.currentUser.id
        };
        set.views.set(viewId, viewPayload);
        return viewPayload;
    }

    // NEW: Use enhanced createView
    return createView(state, {
        setId,
        name,
        ...config,
        createdBy: state.currentUser.id
    });
}
```

### Step 5: Add View Manager UI

In your set rendering function (where you display a set), add the view manager:

```javascript
function renderSet(setId, viewId) {
    const set = state.sets.get(setId);
    if (!set) return;

    const container = document.getElementById('main-content');

    let html = '';

    // NEW: Add view manager
    if (typeof renderViewManager === 'function') {
        html += renderViewManager(state, setId);
    }

    // NEW: Add structural operations toolbar (optional)
    if (typeof renderStructuralOperationsToolbar === 'function') {
        html += renderStructuralOperationsToolbar(state);
    }

    // ... existing set rendering code ...

    container.innerHTML = html;

    // NEW: Attach event listeners for view manager
    attachViewManagerListeners(state);
}
```

### Step 6: Add Event Listeners

Add a function to attach event listeners for the new UI components:

```javascript
function attachViewManagerListeners(state) {
    // View tab clicks
    document.querySelectorAll('.view-tab').forEach(tab => {
        if (!tab.classList.contains('view-tab-add')) {
            tab.addEventListener('click', (e) => {
                if (e.target.closest('.view-menu-btn')) return; // handled separately
                const viewId = tab.dataset.viewId;
                if (viewId && state.currentSetId) {
                    switchSet(state.currentSetId, viewId);
                }
            });
        }
    });

    // View menu buttons
    document.querySelectorAll('.view-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const viewId = btn.dataset.viewId;
            if (typeof showViewMenu === 'function') {
                showViewMenu(state, viewId, btn);
            }
        });
    });

    // New view button
    const newViewBtn = document.querySelector('.view-tab-add');
    if (newViewBtn) {
        newViewBtn.addEventListener('click', () => {
            if (typeof showCreateViewDialog === 'function') {
                showCreateViewDialog(state, state.currentSetId);
            }
        });
    }

    // Save view buttons
    document.querySelectorAll('.btn-save-view').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.viewId;
            const view = state.views?.get(viewId);
            if (view) {
                updateView(state, viewId, view);
                renderSet(state.currentSetId, viewId);
            }
        });
    });

    document.querySelectorAll('.btn-save-view-as').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.viewId;
            if (typeof showSaveViewAsDialog === 'function') {
                showSaveViewAsDialog(state, viewId);
            }
        });
    });

    // Structural operation buttons
    document.querySelectorAll('.btn-structural-op').forEach(btn => {
        btn.addEventListener('click', () => {
            const op = btn.dataset.op;
            handleStructuralOperation(state, op);
        });
    });
}

function handleStructuralOperation(state, operation) {
    const setId = state.currentSetId;
    if (!setId) return;

    switch (operation) {
        case 'dedupe':
            if (typeof showDedupeDialog === 'function') {
                showDedupeDialog(state, setId);
            }
            break;
        case 'merge':
            const selectedIds = Array.from(state.selectedRecordIds || []);
            if (selectedIds.length < 2) {
                alert('Please select at least 2 records to merge');
                return;
            }
            if (typeof showMergeRecordsDialog === 'function') {
                showMergeRecordsDialog(state, setId, selectedIds);
            }
            break;
        case 'split':
            const selectedId = state.lastSelectedRecordId;
            if (!selectedId) {
                alert('Please select a record to split');
                return;
            }
            if (typeof showSplitRecordDialog === 'function') {
                showSplitRecordDialog(state, setId, selectedId);
            }
            break;
        case 'harmonize':
            if (typeof showHarmonizeFieldsDialog === 'function') {
                showHarmonizeFieldsDialog(state, setId);
            }
            break;
    }
}
```

### Step 7: Enhance Search Modal

Update your search modal to use the zero-input search:

```javascript
function showSearchModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    // NEW: Use enhanced search modal with zero-input
    if (typeof renderEnhancedSearchModal === 'function') {
        modal.innerHTML = `
            <div class="modal large">
                ${renderEnhancedSearchModal(state)}
            </div>
        `;
    } else {
        // Fallback to old search
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2>Search</h2>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <input type="text" id="search-input" placeholder="Search...">
                    <div id="search-results"></div>
                </div>
            </div>
        `;
    }

    document.body.appendChild(modal);

    // Close handlers
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-close')) {
            modal.remove();
        }
    });

    // NEW: Search input handler
    const searchInput = modal.querySelector('#search-input');
    if (searchInput && typeof handleSearchInput === 'function') {
        searchInput.addEventListener('input', (e) => {
            handleSearchInput(state, e.target.value);
        });
        searchInput.focus();
    }

    // Click handlers for search results
    modal.addEventListener('click', (e) => {
        const resultItem = e.target.closest('.search-result-item');
        if (resultItem) {
            const type = resultItem.dataset.type;
            const id = resultItem.dataset.id;
            handleSearchResultClick(type, id);
            modal.remove();
        }

        const browseItem = e.target.closest('.browse-item');
        if (browseItem) {
            const entityType = browseItem.dataset.entityType;
            handleBrowseClick(entityType);
        }
    });
}

function handleSearchResultClick(type, id) {
    switch (type) {
        case 'Set':
            switchSet(id);
            break;
        case 'View':
            const view = state.views?.get(id);
            if (view) {
                switchSet(view.setId, id);
            }
            break;
        case 'Record':
            // Handle record navigation
            break;
        case 'Field':
            // Handle field focus
            break;
        case 'Definition':
            // Handle definition view
            break;
    }
}

function handleBrowseClick(entityType) {
    // Show browsing interface for entity type
    if (typeof getAllEntitiesByType === 'function') {
        const results = getAllEntitiesByType(state, entityType);
        // Display results...
    }
}
```

### Step 8: Add Focus Panel Integration

In your focus panel (when showing field/record/value focus), add the "Create View from Focus" button:

```javascript
function renderFocusPanel(focus) {
    let html = '<div class="focus-panel">';

    // ... existing focus rendering ...

    // NEW: Add create view from focus button
    if (typeof renderCreateViewFromFocusButton === 'function') {
        html += renderCreateViewFromFocusButton(state, focus);
    }

    html += '</div>';
    return html;
}

// Add listener for the button
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-create-view-from-focus')) {
        const btn = e.target.closest('.btn-create-view-from-focus');
        const focus = JSON.parse(btn.dataset.focus);
        if (typeof createViewFromFocus === 'function') {
            const view = createViewFromFocus(state, focus);
            if (view) {
                switchSet(view.setId, view.id);
            }
        }
    }
});
```

### Step 9: Track View Changes (Mark as Dirty)

When filters, sorts, or visible fields change, mark the view as dirty:

```javascript
function updateViewFilters(viewId, filters) {
    const view = state.views?.get(viewId);
    if (view) {
        view.filters = filters;
        if (typeof markViewDirty === 'function') {
            markViewDirty(state, viewId);
        }
        // Re-render to show "unsaved changes"
        renderSet(state.currentSetId, viewId);
    }
}

// Similar for sorts, visible fields, etc.
```

## Usage Examples

### Creating a New View

```javascript
// Programmatically create a view
const view = createView(state, {
    setId: 'my_set_id',
    name: 'Active Records',
    type: 'grid',
    filters: [{ fieldId: 'status', operator: 'equals', value: 'active' }],
    sorts: [{ fieldId: 'date', direction: 'desc' }]
});

// Switch to the new view
state.currentViewId = view.id;
switchSet(view.setId, view.id);
```

### Finding and Merging Duplicates

```javascript
// Find duplicates
const clusters = findDuplicateCandidates(state, setId, {
    keyFieldIds: ['name', 'email'],
    algorithm: 'fuzzy',
    threshold: 0.85
});

// Create a view showing duplicates
const operation = createOperation(state, {
    kind: 'dedupe',
    setId,
    parameters: { keyFieldIds: ['name', 'email'] }
});

const resultView = createDedupeCandidatesView(state, setId, clusters, operation.id);
```

### Merging Records

```javascript
// Merge strategy: take longest value for each field
const strategyMap = {
    _default: 'first',
    description: 'longest',
    tags: 'concat'
};

const result = executeMergeOperation(state, setId, recordIds, strategyMap);

// Navigate to result view
switchSet(setId, result.resultView.id);
```

### Creating View from Focus

```javascript
// When user focuses on a field
const focus = {
    kind: 'field',
    id: 'observer_name',
    fieldName: 'Observer Name'
};

const view = createViewFromFocus(state, focus, 'Observer Name View');
```

## Advanced Features

### Custom View Provenance

Track where views come from:

```javascript
const view = createView(state, {
    setId,
    name: 'Processed Data',
    derivedFromOperationIds: [operationId],
    notes: 'Created after deduplication and field harmonization'
});
```

### View Hierarchy

Create nested views:

```javascript
const parentView = createView(state, { setId, name: 'All Data' });
const childView = createView(state, {
    setId,
    name: 'Filtered Subset',
    parentId: parentView.id
});
```

### Operation History

Track all structural operations:

```javascript
// Get all operations for a set
const operations = Array.from(state.structuralOperations.values())
    .filter(op => op.setId === setId)
    .sort((a, b) => b.createdAt - a.createdAt);

// Examine operation details
operations.forEach(op => {
    console.log(`${op.kind}: ${op.summary}`);
    console.log(`  Inputs: ${op.inputRecordIds.length} records`);
    console.log(`  Outputs: ${op.outputRecordIds.length} records`);
    console.log(`  View: ${op.resultViewId}`);
});
```

## Testing Checklist

- [ ] Views appear in view manager tabs
- [ ] Clicking view tabs switches views
- [ ] "New View" button shows create dialog
- [ ] View menu (⋮) shows options
- [ ] "Save View" / "Save As" work correctly
- [ ] Dedupe finds duplicates and creates result view
- [ ] Merge records combines selected records
- [ ] Split record creates multiple records
- [ ] Field harmonization merges fields
- [ ] Search modal shows zero-input content
- [ ] Search filters results as you type
- [ ] "Create View from Focus" button works
- [ ] View provenance is tracked correctly
- [ ] Structural operations are logged

## Troubleshooting

### Views not appearing

Check that:
1. `state.views` is initialized as a `Map()`
2. `migrateViews()` was called after import
3. View manager HTML is being rendered
4. Event listeners are attached

### Functions not defined

Ensure script tags are in correct order:
1. eo_view_management.js (first)
2. eo_structural_operations.js
3. eo_discovery.js
4. eo_workbench_ui.js (last)

### Styles not applied

Check that `eo_workbench_styles.css` is linked in the `<head>` section.

### Modal doesn't close

Ensure modal-close buttons have the correct event listener attached.

## API Reference

See individual module files for complete API documentation:

- `eo_view_management.js` - View CRUD operations
- `eo_structural_operations.js` - Structural operations
- `eo_discovery.js` - Search and discovery
- `eo_workbench_ui.js` - UI rendering and interaction

## Future Enhancements

Potential additions:

1. **Context reconciliation** - Detect and resolve context mismatches
2. **Definition reconciliation** - Merge and harmonize definitions
3. **Undo/redo** - Revert structural operations
4. **Operation batching** - Combine multiple operations
5. **View templates** - Save and reuse view configurations
6. **Advanced filters** - Complex filter expressions
7. **Saved searches** - Persist search queries
8. **View sharing** - Export and import views between worlds

## Support

For questions or issues:
1. Check this integration guide
2. Review module source code comments
3. Check existing implementation in index.html
4. Refer to the original design document

---

**Version**: 1.0
**Last Updated**: 2025-11-24
**Author**: EO Activibase Team
