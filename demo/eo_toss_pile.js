/**
 * EO Toss Pile System
 *
 * A granular undo/restore system that stores deletions at the cell level
 * and allows surgical restoration of any subset of tossed data.
 *
 * Key concepts:
 * - TossEntry: Individual cell-level data (value, recordId, fieldId, setId)
 * - TossAction: Groups entries from a single user action (delete record, delete column, etc.)
 * - Pick up: Restore data from the toss pile (can be partial)
 * - Ghost cells: Visual indicators of tossed data in the grid
 */

(function(global) {
    'use strict';

    // ============================================================================
    // DATA MODEL
    // ============================================================================

    /**
     * TossEntry - A single cell-level tossed value
     * @typedef {Object} TossEntry
     * @property {string} id - Unique entry ID
     * @property {*} value - The actual cell value
     * @property {string} setId - Set the value belonged to
     * @property {string} recordId - Record the value belonged to
     * @property {string} fieldId - Field/column the value belonged to
     * @property {string} fieldName - Human-readable field name
     * @property {string} fieldType - Field type (TEXT, NUMBER, etc.)
     * @property {string} actionId - TossAction that caused this entry
     * @property {string} tossedAt - ISO timestamp
     * @property {string} status - 'tossed' | 'picked_up'
     * @property {Object} recordSnapshot - Snapshot of the full record at toss time (for context)
     * @property {Object} fieldSnapshot - Snapshot of the field schema at toss time
     */

    /**
     * TossAction - Groups entries from a single user action
     * @typedef {Object} TossAction
     * @property {string} id - Unique action ID
     * @property {string} type - 'toss_record' | 'toss_records' | 'toss_column' | 'toss_cell' | 'toss_set' | 'clear_cell'
     * @property {string} setId - Set affected
     * @property {string} setName - Set name at time of toss
     * @property {string} timestamp - ISO timestamp
     * @property {string} summary - Human-readable summary
     * @property {string[]} entryIds - IDs of TossEntries in this action
     * @property {Object} metadata - Additional context (recordId, fieldId, count, etc.)
     * @property {boolean} undone - Whether this action has been undone via pick up
     */

    /**
     * TossPileState - Full toss pile state
     * @typedef {Object} TossPileState
     * @property {Map<string, TossEntry>} entries - All toss entries
     * @property {Map<string, TossAction>} actions - All toss actions
     * @property {Object} settings - User preferences
     */

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    function initTossPile(state) {
        if (!state.tossPile) {
            state.tossPile = {
                entries: new Map(),
                actions: new Map(),
                actionIdCounter: 1,
                entryIdCounter: 1,
                settings: {
                    showGhosts: true,
                    ghostMaxAge: null, // null = show all, otherwise ms
                    panelOpen: false,
                    panelWidth: 320
                }
            };
        }
        return state.tossPile;
    }

    // ============================================================================
    // TOSS FUNCTIONS
    // ============================================================================

    /**
     * Create a toss entry for a single cell
     */
    function createTossEntry(state, { value, setId, recordId, fieldId, fieldName, fieldType, actionId, recordSnapshot = null, fieldSnapshot = null }) {
        const pile = initTossPile(state);
        const entry = {
            id: `toss_entry_${pile.entryIdCounter++}`,
            value,
            setId,
            recordId,
            fieldId,
            fieldName: fieldName || fieldId,
            fieldType: fieldType || 'TEXT',
            actionId,
            tossedAt: new Date().toISOString(),
            status: 'tossed',
            recordSnapshot,
            fieldSnapshot
        };
        pile.entries.set(entry.id, entry);
        return entry;
    }

    /**
     * Create a toss action that groups multiple entries
     */
    function createTossAction(state, { type, setId, setName, summary, metadata = {} }) {
        const pile = initTossPile(state);
        const action = {
            id: `toss_action_${pile.actionIdCounter++}`,
            type,
            setId,
            setName: setName || setId,
            timestamp: new Date().toISOString(),
            summary,
            entryIds: [],
            metadata,
            undone: false
        };
        pile.actions.set(action.id, action);
        return action;
    }

    /**
     * Toss a single record - moves all field values to toss pile
     */
    function tossRecord(state, recordId, options = {}) {
        const set = state.sets.get(state.currentSetId);
        if (!set) return null;

        const record = set.records.get(recordId);
        if (!record) return null;

        // Create snapshot of record before deletion
        const recordSnapshot = { ...record };

        // Create the toss action
        const action = createTossAction(state, {
            type: 'toss_record',
            setId: set.id,
            setName: set.name,
            summary: `Tossed record`,
            metadata: { recordId, recordSnapshot }
        });

        // Create toss entries for each field value
        set.schema.forEach(field => {
            const value = record[field.id];
            if (value !== undefined && value !== null && value !== '') {
                const entry = createTossEntry(state, {
                    value,
                    setId: set.id,
                    recordId,
                    fieldId: field.id,
                    fieldName: field.name,
                    fieldType: field.type,
                    actionId: action.id,
                    recordSnapshot,
                    fieldSnapshot: { ...field }
                });
                action.entryIds.push(entry.id);
            }
        });

        // Store record structure even if no values (for ghost row)
        action.metadata.fieldCount = action.entryIds.length;
        action.metadata.schema = set.schema.map(f => ({ id: f.id, name: f.name, type: f.type }));

        // Remove from set
        set.records.delete(recordId);
        if (state.selectedRecordIds) state.selectedRecordIds.delete(recordId);
        if (state.lastSelectedRecordId === recordId) state.lastSelectedRecordId = null;

        // Remove from entities
        if (state.entities?.has(recordId)) {
            state.entities.delete(recordId);
        }

        // Create event for audit trail
        if (typeof createEvent === 'function') {
            createEvent(
                'Toss Record',
                'NUL',
                { type: 'Record', id: recordId, setId: set.id },
                { setId: set.id, recordId, actionId: action.id, summary: 'Record tossed to pile' }
            );
        }

        return action;
    }

    /**
     * Toss multiple records
     */
    function tossRecords(state, recordIds, options = {}) {
        const set = state.sets.get(state.currentSetId);
        if (!set) return null;

        const validIds = recordIds.filter(id => set.records.has(id));
        if (validIds.length === 0) return null;

        // Create the bulk toss action
        const action = createTossAction(state, {
            type: 'toss_records',
            setId: set.id,
            setName: set.name,
            summary: `Tossed ${validIds.length} record${validIds.length === 1 ? '' : 's'}`,
            metadata: { recordIds: validIds, count: validIds.length }
        });

        // Toss each record's values
        validIds.forEach(recordId => {
            const record = set.records.get(recordId);
            if (!record) return;

            const recordSnapshot = { ...record };

            set.schema.forEach(field => {
                const value = record[field.id];
                if (value !== undefined && value !== null && value !== '') {
                    const entry = createTossEntry(state, {
                        value,
                        setId: set.id,
                        recordId,
                        fieldId: field.id,
                        fieldName: field.name,
                        fieldType: field.type,
                        actionId: action.id,
                        recordSnapshot,
                        fieldSnapshot: { ...field }
                    });
                    action.entryIds.push(entry.id);
                }
            });

            // Remove from set
            set.records.delete(recordId);
            if (state.selectedRecordIds) state.selectedRecordIds.delete(recordId);
            if (state.entities?.has(recordId)) {
                state.entities.delete(recordId);
            }
        });

        state.lastSelectedRecordId = null;
        action.metadata.schema = set.schema.map(f => ({ id: f.id, name: f.name, type: f.type }));

        // Create event
        if (typeof createEvent === 'function') {
            createEvent(
                'Toss Records',
                'NUL',
                { type: 'Records', ids: validIds, setId: set.id },
                { setId: set.id, count: validIds.length, actionId: action.id, summary: `${validIds.length} records tossed to pile` }
            );
        }

        return action;
    }

    /**
     * Toss a column (field) - archives field schema and moves all values to toss pile
     */
    function tossColumn(state, fieldId, options = {}) {
        const set = state.sets.get(state.currentSetId);
        if (!set) return null;

        const fieldIndex = set.schema.findIndex(f => f.id === fieldId);
        if (fieldIndex === -1) return null;

        const field = set.schema[fieldIndex];
        const fieldSnapshot = { ...field, _index: fieldIndex };

        // Create the toss action
        const action = createTossAction(state, {
            type: 'toss_column',
            setId: set.id,
            setName: set.name,
            summary: `Tossed column "${field.name}"`,
            metadata: { fieldId, fieldName: field.name, fieldSnapshot }
        });

        // Create toss entries for each record's value in this column
        let valueCount = 0;
        set.records.forEach((record, recordId) => {
            const value = record[fieldId];
            if (value !== undefined && value !== null && value !== '') {
                const entry = createTossEntry(state, {
                    value,
                    setId: set.id,
                    recordId,
                    fieldId,
                    fieldName: field.name,
                    fieldType: field.type,
                    actionId: action.id,
                    recordSnapshot: { id: recordId },
                    fieldSnapshot
                });
                action.entryIds.push(entry.id);
                valueCount++;
            }
            // Remove the field value from record
            delete record[fieldId];
        });

        action.metadata.valueCount = valueCount;

        // Remove field from schema
        set.schema.splice(fieldIndex, 1);

        // Update views to remove references to this field
        if (set.views) {
            set.views.forEach(view => {
                if (view.columns) {
                    view.columns = view.columns.filter(c => c.fieldId !== fieldId);
                }
                if (view.sorts) {
                    view.sorts = view.sorts.filter(s => s.fieldId !== fieldId);
                }
                if (view.filters) {
                    view.filters = view.filters.filter(f => f.fieldId !== fieldId);
                }
            });
        }

        // Create event
        if (typeof createEvent === 'function') {
            createEvent(
                'Toss Column',
                'NUL',
                { type: 'Field', id: fieldId, setId: set.id },
                { setId: set.id, fieldId, fieldName: field.name, actionId: action.id, valueCount, summary: `Column "${field.name}" tossed (${valueCount} values)` }
            );
        }

        return action;
    }

    /**
     * Toss a single cell value
     */
    function tossCell(state, recordId, fieldId, options = {}) {
        const set = state.sets.get(state.currentSetId);
        if (!set) return null;

        const record = set.records.get(recordId);
        if (!record) return null;

        const field = set.schema.find(f => f.id === fieldId);
        if (!field) return null;

        const value = record[fieldId];
        if (value === undefined || value === null || value === '') return null;

        // Create the toss action
        const action = createTossAction(state, {
            type: 'toss_cell',
            setId: set.id,
            setName: set.name,
            summary: `Cleared "${field.name}" value`,
            metadata: { recordId, fieldId, fieldName: field.name }
        });

        // Create toss entry
        const entry = createTossEntry(state, {
            value,
            setId: set.id,
            recordId,
            fieldId,
            fieldName: field.name,
            fieldType: field.type,
            actionId: action.id,
            recordSnapshot: { id: recordId },
            fieldSnapshot: { ...field }
        });
        action.entryIds.push(entry.id);

        // Clear the cell
        record[fieldId] = null;

        // Create event
        if (typeof createEvent === 'function') {
            createEvent(
                'Toss Cell',
                'NUL',
                { type: 'Cell', recordId, fieldId, setId: set.id },
                { setId: set.id, recordId, fieldId, actionId: action.id, summary: `Cell value cleared` }
            );
        }

        return action;
    }

    // ============================================================================
    // PICK UP FUNCTIONS
    // ============================================================================

    /**
     * Pick up a single toss entry
     */
    function pickUpEntry(state, entryId, options = {}) {
        const pile = initTossPile(state);
        const entry = pile.entries.get(entryId);
        if (!entry || entry.status === 'picked_up') return null;

        const set = state.sets.get(entry.setId);

        // Auto-restore set if needed
        if (!set) {
            if (options.autoRestoreStructure !== false) {
                // Would need to restore set - for now, fail
                console.warn('Cannot pick up entry: set does not exist');
                return null;
            }
            return null;
        }

        // Auto-restore field/column if needed
        let field = set.schema.find(f => f.id === entry.fieldId);
        if (!field && entry.fieldSnapshot) {
            if (options.autoRestoreStructure !== false) {
                // Restore the field schema
                const snapshot = entry.fieldSnapshot;
                field = {
                    id: snapshot.id,
                    name: snapshot.name,
                    type: snapshot.type,
                    width: snapshot.width || '200',
                    config: snapshot.config || {}
                };
                // Insert at original position if known, otherwise append
                const insertIndex = snapshot._index !== undefined ? snapshot._index : set.schema.length;
                set.schema.splice(Math.min(insertIndex, set.schema.length), 0, field);
            } else {
                console.warn('Cannot pick up entry: field does not exist');
                return null;
            }
        }

        // Auto-restore record if needed
        let record = set.records.get(entry.recordId);
        if (!record) {
            if (options.autoRestoreStructure !== false) {
                // Create sparse record
                record = {
                    id: entry.recordId,
                    _restoredFromTossPile: true,
                    _restoredAt: new Date().toISOString()
                };
                set.records.set(entry.recordId, record);

                // Register entity
                if (typeof registerEntity === 'function') {
                    registerEntity({
                        id: entry.recordId,
                        type: 'Record',
                        setId: set.id,
                        origin: 'toss_pile_restore'
                    });
                }
            } else {
                console.warn('Cannot pick up entry: record does not exist');
                return null;
            }
        }

        // Restore the value
        record[entry.fieldId] = entry.value;
        entry.status = 'picked_up';

        // Create event
        if (typeof createEvent === 'function') {
            createEvent(
                'Pick Up Entry',
                'INS',
                { type: 'Cell', recordId: entry.recordId, fieldId: entry.fieldId, setId: entry.setId },
                { setId: entry.setId, entryId, summary: `Restored "${entry.fieldName}" value` }
            );
        }

        return entry;
    }

    /**
     * Pick up all entries from a toss action
     */
    function pickUpAction(state, actionId, options = {}) {
        const pile = initTossPile(state);
        const action = pile.actions.get(actionId);
        if (!action || action.undone) return null;

        const restoredEntries = [];
        const failedEntries = [];

        // Pick up all entries in this action
        action.entryIds.forEach(entryId => {
            const entry = pile.entries.get(entryId);
            if (entry && entry.status === 'tossed') {
                const result = pickUpEntry(state, entryId, options);
                if (result) {
                    restoredEntries.push(result);
                } else {
                    failedEntries.push(entryId);
                }
            }
        });

        // Mark action as undone if all entries were restored
        if (failedEntries.length === 0) {
            action.undone = true;
        }

        // Create event
        if (typeof createEvent === 'function') {
            createEvent(
                'Pick Up Action',
                'INS',
                { type: 'TossAction', id: actionId, setId: action.setId },
                {
                    setId: action.setId,
                    actionId,
                    restoredCount: restoredEntries.length,
                    failedCount: failedEntries.length,
                    summary: `Restored ${restoredEntries.length} items from "${action.summary}"`
                }
            );
        }

        return { action, restoredEntries, failedEntries };
    }

    /**
     * Pick up a full record (all entries for a given recordId from a specific action)
     */
    function pickUpRecord(state, actionId, recordId, options = {}) {
        const pile = initTossPile(state);
        const action = pile.actions.get(actionId);
        if (!action) return null;

        const recordEntries = action.entryIds
            .map(id => pile.entries.get(id))
            .filter(e => e && e.recordId === recordId && e.status === 'tossed');

        const restoredEntries = [];
        recordEntries.forEach(entry => {
            const result = pickUpEntry(state, entry.id, options);
            if (result) restoredEntries.push(result);
        });

        return { recordId, restoredEntries };
    }

    /**
     * Pick up specific entries (selective restore)
     */
    function pickUpEntries(state, entryIds, options = {}) {
        const restoredEntries = [];
        const failedEntries = [];

        entryIds.forEach(entryId => {
            const result = pickUpEntry(state, entryId, options);
            if (result) {
                restoredEntries.push(result);
            } else {
                failedEntries.push(entryId);
            }
        });

        // Create event
        if (typeof createEvent === 'function' && restoredEntries.length > 0) {
            createEvent(
                'Pick Up Entries',
                'INS',
                { type: 'TossEntries', count: restoredEntries.length },
                {
                    restoredCount: restoredEntries.length,
                    failedCount: failedEntries.length,
                    summary: `Restored ${restoredEntries.length} selected items`
                }
            );
        }

        return { restoredEntries, failedEntries };
    }

    // ============================================================================
    // QUERY FUNCTIONS
    // ============================================================================

    /**
     * Get all tossed entries for a set
     */
    function getTossedEntriesForSet(state, setId) {
        const pile = initTossPile(state);
        return Array.from(pile.entries.values())
            .filter(e => e.setId === setId && e.status === 'tossed');
    }

    /**
     * Get all toss actions for a set
     */
    function getTossActionsForSet(state, setId) {
        const pile = initTossPile(state);
        return Array.from(pile.actions.values())
            .filter(a => a.setId === setId && !a.undone)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Get toss entries grouped by record
     */
    function getTossedEntriesByRecord(state, setId) {
        const entries = getTossedEntriesForSet(state, setId);
        const byRecord = new Map();

        entries.forEach(entry => {
            if (!byRecord.has(entry.recordId)) {
                byRecord.set(entry.recordId, []);
            }
            byRecord.get(entry.recordId).push(entry);
        });

        return byRecord;
    }

    /**
     * Get toss entries grouped by field
     */
    function getTossedEntriesByField(state, setId) {
        const entries = getTossedEntriesForSet(state, setId);
        const byField = new Map();

        entries.forEach(entry => {
            if (!byField.has(entry.fieldId)) {
                byField.set(entry.fieldId, { fieldName: entry.fieldName, entries: [] });
            }
            byField.get(entry.fieldId).entries.push(entry);
        });

        return byField;
    }

    /**
     * Get ghost data for rendering in grid
     * Returns entries that should appear as ghosts in the current view
     */
    function getGhostData(state, setId) {
        const pile = initTossPile(state);
        if (!pile.settings.showGhosts) return { records: new Map(), columns: new Map() };

        const entries = getTossedEntriesForSet(state, setId);
        const set = state.sets.get(setId);
        if (!set) return { records: new Map(), columns: new Map() };

        // Filter by max age if set
        const maxAge = pile.settings.ghostMaxAge;
        const now = Date.now();
        const filteredEntries = maxAge
            ? entries.filter(e => now - new Date(e.tossedAt).getTime() < maxAge)
            : entries;

        // Group by record and field
        const ghostRecords = new Map(); // recordId -> { fields: Map<fieldId, entry>, isFullRecord: boolean }
        const ghostColumns = new Map(); // fieldId -> { fieldName, count }

        // Check for tossed columns (fields not in current schema)
        const currentFieldIds = new Set(set.schema.map(f => f.id));

        filteredEntries.forEach(entry => {
            // Track ghost records
            if (!ghostRecords.has(entry.recordId)) {
                ghostRecords.set(entry.recordId, {
                    fields: new Map(),
                    isFullRecord: false,
                    action: pile.actions.get(entry.actionId)
                });
            }
            ghostRecords.get(entry.recordId).fields.set(entry.fieldId, entry);

            // Track ghost columns (for fields that no longer exist)
            if (!currentFieldIds.has(entry.fieldId)) {
                if (!ghostColumns.has(entry.fieldId)) {
                    ghostColumns.set(entry.fieldId, {
                        fieldId: entry.fieldId,
                        fieldName: entry.fieldName,
                        fieldType: entry.fieldType,
                        fieldSnapshot: entry.fieldSnapshot,
                        count: 0
                    });
                }
                ghostColumns.get(entry.fieldId).count++;
            }
        });

        // Check if records are "full" ghosts (entire record was tossed)
        ghostRecords.forEach((data, recordId) => {
            // If record doesn't exist in set, it's a full ghost
            if (!set.records.has(recordId)) {
                data.isFullRecord = true;
            }
        });

        return { records: ghostRecords, columns: ghostColumns };
    }

    /**
     * Get summary stats for toss pile
     */
    function getTossPileStats(state, setId = null) {
        const pile = initTossPile(state);

        let entries = Array.from(pile.entries.values()).filter(e => e.status === 'tossed');
        let actions = Array.from(pile.actions.values()).filter(a => !a.undone);

        if (setId) {
            entries = entries.filter(e => e.setId === setId);
            actions = actions.filter(a => a.setId === setId);
        }

        const bySet = new Map();
        entries.forEach(entry => {
            if (!bySet.has(entry.setId)) {
                bySet.set(entry.setId, { setId: entry.setId, count: 0, actions: new Set() });
            }
            bySet.get(entry.setId).count++;
            bySet.get(entry.setId).actions.add(entry.actionId);
        });

        return {
            totalEntries: entries.length,
            totalActions: actions.length,
            bySet: Array.from(bySet.values()).map(s => ({ ...s, actionCount: s.actions.size })),
            oldestEntry: entries.length > 0 ? entries.reduce((oldest, e) =>
                new Date(e.tossedAt) < new Date(oldest.tossedAt) ? e : oldest
            ) : null,
            newestEntry: entries.length > 0 ? entries.reduce((newest, e) =>
                new Date(e.tossedAt) > new Date(newest.tossedAt) ? e : newest
            ) : null
        };
    }

    /**
     * Get related entries for a given entry (same action, same record, or same column)
     */
    function getRelatedEntries(state, entryId) {
        const pile = initTossPile(state);
        const entry = pile.entries.get(entryId);
        if (!entry) return null;

        const action = pile.actions.get(entry.actionId);
        const allEntries = Array.from(pile.entries.values()).filter(e => e.status === 'tossed');

        // Same action (most closely related)
        const sameAction = action ? action.entryIds
            .map(id => pile.entries.get(id))
            .filter(e => e && e.status === 'tossed' && e.id !== entryId) : [];

        // Same record (from different actions)
        const sameRecord = allEntries.filter(e =>
            e.recordId === entry.recordId &&
            e.actionId !== entry.actionId &&
            e.id !== entryId
        );

        // Same field/column (from different actions)
        const sameField = allEntries.filter(e =>
            e.fieldId === entry.fieldId &&
            e.actionId !== entry.actionId &&
            e.id !== entryId
        );

        return {
            entry,
            action,
            sameAction,
            sameRecord,
            sameField,
            // Recommended grouping for "pick up with related"
            recommended: sameAction.length > 0 ? sameAction : sameRecord
        };
    }

    // ============================================================================
    // SETTINGS
    // ============================================================================

    function setGhostVisibility(state, visible) {
        const pile = initTossPile(state);
        pile.settings.showGhosts = visible;
    }

    function setGhostMaxAge(state, maxAgeMs) {
        const pile = initTossPile(state);
        pile.settings.ghostMaxAge = maxAgeMs;
    }

    function toggleTossPilePanel(state, open = null) {
        const pile = initTossPile(state);
        pile.settings.panelOpen = open !== null ? open : !pile.settings.panelOpen;
        return pile.settings.panelOpen;
    }

    // ============================================================================
    // CLEANUP
    // ============================================================================

    /**
     * Permanently delete entries older than a threshold
     */
    function purgeTossPile(state, options = {}) {
        const pile = initTossPile(state);
        const { maxAge = null, setId = null, confirm = false } = options;

        if (!confirm) {
            console.warn('Purge requires confirm: true');
            return null;
        }

        let entriesToPurge = Array.from(pile.entries.values());

        if (setId) {
            entriesToPurge = entriesToPurge.filter(e => e.setId === setId);
        }

        if (maxAge) {
            const cutoff = Date.now() - maxAge;
            entriesToPurge = entriesToPurge.filter(e => new Date(e.tossedAt).getTime() < cutoff);
        }

        const purgedCount = entriesToPurge.length;
        const affectedActions = new Set();

        entriesToPurge.forEach(entry => {
            affectedActions.add(entry.actionId);
            pile.entries.delete(entry.id);
        });

        // Clean up actions with no remaining entries
        affectedActions.forEach(actionId => {
            const action = pile.actions.get(actionId);
            if (action) {
                action.entryIds = action.entryIds.filter(id => pile.entries.has(id));
                if (action.entryIds.length === 0) {
                    pile.actions.delete(actionId);
                }
            }
        });

        return { purgedCount, affectedActions: affectedActions.size };
    }

    // ============================================================================
    // EXPORT
    // ============================================================================

    const TossPile = {
        // Initialization
        init: initTossPile,

        // Toss functions
        tossRecord,
        tossRecords,
        tossColumn,
        tossCell,

        // Pick up functions
        pickUpEntry,
        pickUpAction,
        pickUpRecord,
        pickUpEntries,

        // Query functions
        getTossedEntriesForSet,
        getTossActionsForSet,
        getTossedEntriesByRecord,
        getTossedEntriesByField,
        getGhostData,
        getTossPileStats,
        getRelatedEntries,

        // Settings
        setGhostVisibility,
        setGhostMaxAge,
        toggleTossPilePanel,

        // Cleanup
        purgeTossPile
    };

    // Export to global scope
    global.TossPile = TossPile;

})(typeof window !== 'undefined' ? window : global);
