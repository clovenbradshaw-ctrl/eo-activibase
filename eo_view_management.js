/**
 * EO View Management
 *
 * This module implements view reification - treating views as first-class entities
 * with provenance, context, and lifecycle tracking.
 *
 * Key concepts:
 * - Views are no longer just configurations, but entities with identity and history
 * - Every analytical artifact can become a reified view
 * - Provenance tracks view derivation (from filters, operations, focus, etc.)
 */

// ============================================================================
// VIEW ENTITY MODEL
// ============================================================================

/**
 * Enhanced ViewEntity structure
 * Extends the existing view structure with EO-specific provenance and context
 */
function createViewEntity(config) {
    const id = config.id || `view_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return {
        // Core identity
        id,
        name: config.name || 'Untitled view',
        setId: config.setId,

        // Layout configuration
        type: config.type || 'grid', // 'grid' | 'gallery' | 'kanban' | 'calendar'
        icon: config.icon || '📋',

        // Data configuration
        visibleFieldIds: config.visibleFieldIds || [],
        hiddenFields: config.hiddenFields || [],
        columnOrder: config.columnOrder || null,
        columnRules: config.columnRules || {},

        // View logic
        filters: config.filters || [],
        sorts: config.sorts || [],
        groups: config.groups || [],

        // View-specific settings
        kanbanGroupField: config.kanbanGroupField || null,
        cardFields: config.cardFields || [],
        popupVisibilityRules: config.popupVisibilityRules || [],
        popupLayout: config.popupLayout || { size: 'medium', columns: 4, rows: 4 },
        showRecordId: config.showRecordId || false,
        showRowNumbers: config.showRowNumbers !== undefined ? config.showRowNumbers : true,
        identifierField: config.identifierField || null,

        // Relationships
        parentId: config.parentId || null,
        key: config.key || null,
        schema: config.schema || null,
        relationships: config.relationships || [],
        rollups: config.rollups || [],

        // EO-specific: Focus
        focus: config.focus || null, // { kind: 'field'|'record'|'value'|'definition', id, fieldId?, value? }

        // EO-specific: Context (9-dimension context schema)
        context: config.context || null,

        // EO-specific: Provenance
        provenance: {
            createdBy: config.createdBy || config.provenance?.createdBy || 'system',
            createdAt: config.createdAt || config.provenance?.createdAt || Date.now(),
            updatedAt: config.updatedAt || config.provenance?.updatedAt || null,
            derivedFromViewIds: config.derivedFromViewIds || config.provenance?.derivedFromViewIds || [],
            derivedFromOperationIds: config.derivedFromOperationIds || config.provenance?.derivedFromOperationIds || [],
            notes: config.notes || config.provenance?.notes || ''
        },

        // State tracking
        isDirty: false, // tracks unsaved changes
        isTemporary: config.isTemporary || false // ephemeral views not yet reified
    };
}

// ============================================================================
// VIEW MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create a new view and add it to global state
 */
function createView(state, config) {
    const view = createViewEntity(config);

    // Add to global views map
    if (!state.views) {
        state.views = new Map();
    }
    state.views.set(view.id, view);

    // Add reference to set
    const set = state.sets.get(config.setId);
    if (set) {
        if (!set.views) {
            set.views = new Map();
        }
        // Store lightweight reference in set
        set.views.set(view.id, { id: view.id });
    }

    // Log to event stream
    logEvent(state, {
        type: 'view_created',
        entityType: 'View',
        entityId: view.id,
        data: {
            setId: view.setId,
            name: view.name,
            derivedFrom: {
                views: view.provenance.derivedFromViewIds,
                operations: view.provenance.derivedFromOperationIds
            }
        }
    });

    return view;
}

/**
 * Update an existing view
 */
function updateView(state, viewId, patch) {
    const view = state.views?.get(viewId);
    if (!view) {
        console.warn(`View ${viewId} not found`);
        return null;
    }

    const updated = {
        ...view,
        ...patch,
        id: view.id, // preserve id
        provenance: {
            ...view.provenance,
            ...(patch.provenance || {}),
            updatedAt: Date.now()
        },
        isDirty: false // clear dirty flag on save
    };

    state.views.set(viewId, updated);

    logEvent(state, {
        type: 'view_updated',
        entityType: 'View',
        entityId: viewId,
        data: { changes: Object.keys(patch) }
    });

    return updated;
}

/**
 * Mark a view as having unsaved changes
 */
function markViewDirty(state, viewId) {
    const view = state.views?.get(viewId);
    if (view) {
        view.isDirty = true;
    }
}

/**
 * Delete a view
 */
function deleteView(state, viewId) {
    const view = state.views?.get(viewId);
    if (!view) return false;

    // Remove from global map
    state.views.delete(viewId);

    // Remove from set
    const set = state.sets.get(view.setId);
    if (set?.views) {
        set.views.delete(viewId);
    }

    // Log event
    logEvent(state, {
        type: 'view_deleted',
        entityType: 'View',
        entityId: viewId,
        data: { setId: view.setId, name: view.name }
    });

    return true;
}

/**
 * Clone a view (Save As...)
 */
function cloneView(state, viewId, newName) {
    const original = state.views?.get(viewId);
    if (!original) return null;

    const cloned = createView(state, {
        ...original,
        name: newName || `${original.name} (copy)`,
        derivedFromViewIds: [viewId],
        notes: `Cloned from ${original.name}`
    });

    return cloned;
}

// ============================================================================
// VIEW REIFICATION
// ============================================================================

/**
 * Create a view from current focus
 * Captures the focused entity and creates a filtered view around it
 */
function createViewFromFocus(state, focus, name) {
    const set = state.sets.get(state.currentSetId);
    if (!set) return null;

    const config = {
        setId: set.id,
        name: name || focusToName(focus),
        type: 'grid',
        focus,
        visibleFieldIds: (set.schema || []).map(f => f.id),
        filters: [],
        sorts: [],
        groups: [],
        notes: 'View created from focus'
    };

    // Add default filter based on focus type
    if (focus.kind === 'value' && focus.fieldId) {
        config.filters.push({
            fieldId: focus.fieldId,
            operator: 'equals',
            value: focus.value
        });
    } else if (focus.kind === 'record' && focus.id) {
        config.filters.push({
            fieldId: 'id',
            operator: 'equals',
            value: focus.id
        });
    } else if (focus.kind === 'field' && focus.id) {
        // Focus on records where this field is not empty
        config.filters.push({
            fieldId: focus.id,
            operator: 'notEmpty'
        });
        config.visibleFieldIds = [focus.id, ...(set.schema || []).map(f => f.id).filter(id => id !== focus.id)];
    }

    return createView(state, config);
}

/**
 * Create a view from ad-hoc filters/sorts (reify temporary state)
 */
function reifyTemporaryView(state, tempConfig, name) {
    const set = state.sets.get(tempConfig.setId);
    if (!set) return null;

    const baseView = tempConfig.baseViewId ? state.views.get(tempConfig.baseViewId) : null;

    return createView(state, {
        ...tempConfig,
        name: name || 'Filtered view',
        derivedFromViewIds: baseView ? [baseView.id] : [],
        notes: 'Reified from temporary filters'
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a descriptive name from a focus object
 */
function focusToName(focus) {
    switch (focus.kind) {
        case 'field':
            return `Focus: ${focus.fieldName || focus.id}`;
        case 'record':
            return `Focus: Record ${focus.id}`;
        case 'value':
            return `Focus: ${focus.fieldName || focus.fieldId} = ${focus.value}`;
        case 'definition':
            return `Focus: Definition ${focus.id}`;
        default:
            return 'Focused view';
    }
}

/**
 * Get all views for a set (resolves lightweight references)
 */
function getSetViews(state, setId) {
    const set = state.sets.get(setId);
    if (!set?.views) return [];

    return Array.from(set.views.keys())
        .map(viewId => state.views?.get(viewId))
        .filter(Boolean);
}

/**
 * Get view hierarchy (parent-child relationships)
 */
function getViewHierarchy(state, setId) {
    const views = getSetViews(state, setId);
    const hierarchy = [];

    // Find root views (no parent)
    const roots = views.filter(v => !v.parentId);

    function buildTree(parentId) {
        return views
            .filter(v => v.parentId === parentId)
            .map(v => ({
                ...v,
                children: buildTree(v.id)
            }));
    }

    roots.forEach(root => {
        hierarchy.push({
            ...root,
            children: buildTree(root.id)
        });
    });

    return hierarchy;
}

/**
 * Check if view has unsaved changes
 */
function hasUnsavedChanges(state, viewId) {
    const view = state.views?.get(viewId);
    return view?.isDirty || false;
}

/**
 * Log an event to the event stream
 */
function logEvent(state, event) {
    if (!state.eventStream) {
        state.eventStream = [];
    }

    const eventRecord = {
        id: state.eventIdCounter || 1,
        timestamp: Date.now(),
        user: state.currentUser,
        ...event
    };

    state.eventStream.push(eventRecord);
    state.eventIdCounter = (state.eventIdCounter || 1) + 1;

    return eventRecord;
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Migrate existing views to new ViewEntity structure
 * Call this during importWorldFromJson or on startup
 */
function migrateViews(state) {
    if (!state.views) {
        state.views = new Map();
    }

    let migrated = 0;

    state.sets.forEach(set => {
        if (!set.views) return;

        set.views.forEach((viewData, viewId) => {
            // Skip if already in global views
            if (state.views.has(viewId)) return;

            // Create full view entity
            const viewEntity = createViewEntity({
                ...viewData,
                id: viewId,
                setId: set.id
            });

            // Add to global views
            state.views.set(viewId, viewEntity);

            // Replace with lightweight reference
            set.views.set(viewId, { id: viewId });

            migrated++;
        });
    });

    if (migrated > 0) {
        console.log(`Migrated ${migrated} views to ViewEntity structure`);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createViewEntity,
        createView,
        updateView,
        deleteView,
        cloneView,
        markViewDirty,
        createViewFromFocus,
        reifyTemporaryView,
        getSetViews,
        getViewHierarchy,
        hasUnsavedChanges,
        migrateViews,
        focusToName
    };
}
