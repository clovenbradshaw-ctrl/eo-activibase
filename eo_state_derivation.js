/**
 * EO State Derivation
 * Derives application state from the event log
 *
 * Implements Axiom 0: State = f(Log)
 * State is NEVER the source of truth - it's always computed from the log.
 *
 * Pattern:
 *   const log = EOEventLog.getLog();
 *   const state = EOStateDerivation.derive(log);
 *   // state is now a read-only computed view
 *
 * To change state:
 *   log.append({ type: 'given', actor: 'user', payload: {...} });
 *   // State automatically recomputes via subscription
 */

(function(global) {
    'use strict';

    // ============================================================================
    // REDUCER FUNCTIONS (Event -> State transformations)
    // ============================================================================

    /**
     * Registry of payload action handlers
     * Each handler: (state, event) => newState
     */
    const ACTION_HANDLERS = {
        // ========================================================================
        // SET ACTIONS
        // ========================================================================

        'set:create': (state, event) => {
            const { setId, name, schema, records } = event.payload;
            const newSet = {
                setId,
                name,
                schema: schema || { fields: [] },
                records: new Map(records?.map(r => [r.record_id, r]) || []),
                createdAt: event.timestamp,
                createdBy: event.actor,
                _eventId: event.id
            };
            state.sets.set(setId, newSet);
            return state;
        },

        'set:update': (state, event) => {
            const { setId, updates } = event.payload;
            const set = state.sets.get(setId);
            if (set) {
                Object.assign(set, updates, {
                    updatedAt: event.timestamp,
                    updatedBy: event.actor
                });
            }
            return state;
        },

        'set:switch': (state, event) => {
            state.currentSetId = event.payload.setId;
            return state;
        },

        // ========================================================================
        // RECORD ACTIONS
        // ========================================================================

        'record:create': (state, event) => {
            const { setId, record } = event.payload;
            const set = state.sets.get(setId);
            if (set) {
                set.records.set(record.record_id, {
                    ...record,
                    createdAt: event.timestamp,
                    createdBy: event.actor,
                    _eventId: event.id
                });
            }
            return state;
        },

        'record:update': (state, event) => {
            const { setId, recordId, updates } = event.payload;
            const set = state.sets.get(setId);
            if (set) {
                const record = set.records.get(recordId);
                if (record) {
                    Object.assign(record, updates, {
                        updatedAt: event.timestamp,
                        updatedBy: event.actor
                    });
                }
            }
            return state;
        },

        'record:select': (state, event) => {
            const { recordId, multi } = event.payload;
            if (!multi) {
                state.selectedRecordIds.clear();
            }
            state.selectedRecordIds.add(recordId);
            state.lastSelectedRecordId = recordId;
            return state;
        },

        'record:deselect': (state, event) => {
            const { recordId } = event.payload;
            state.selectedRecordIds.delete(recordId);
            if (state.lastSelectedRecordId === recordId) {
                state.lastSelectedRecordId = null;
            }
            return state;
        },

        // ========================================================================
        // CELL ACTIONS (SUP-aware)
        // ========================================================================

        'cell:edit': (state, event) => {
            const { setId, recordId, fieldName, value, contextSchema } = event.payload;
            const set = state.sets.get(setId);
            if (!set) return state;

            const record = set.records.get(recordId);
            if (!record) return state;

            // Get or create cell
            const cellId = `${recordId}_field_${fieldName}`;
            if (!record.cells) record.cells = [];

            let cell = record.cells.find(c => c.cell_id === cellId);
            if (!cell) {
                cell = {
                    cell_id: cellId,
                    record_id: recordId,
                    field_name: fieldName,
                    values: [],
                    created_at: event.timestamp
                };
                record.cells.push(cell);
            }

            // Create observation
            const observation = {
                value,
                timestamp: event.timestamp,
                source: 'user_edit',
                context_schema: contextSchema || {
                    method: 'declared',
                    scale: 'individual',
                    agent: { type: 'person', id: event.actor }
                },
                _eventId: event.id
            };

            // Check if should replace or add (SUP)
            const shouldReplace = shouldReplaceValue(cell, observation);
            if (shouldReplace) {
                cell.values = [observation];
            } else {
                cell.values.push(observation);
            }

            cell.updated_at = event.timestamp;

            // Also update legacy fields object for compatibility
            if (!record.fields) record.fields = {};
            record.fields[fieldName] = value;

            return state;
        },

        // ========================================================================
        // VIEW ACTIONS
        // ========================================================================

        'view:create': (state, event) => {
            const { viewId, setId, name, config } = event.payload;
            state.views.set(viewId, {
                viewId,
                setId,
                name,
                config: config || {},
                createdAt: event.timestamp,
                createdBy: event.actor,
                _eventId: event.id
            });
            return state;
        },

        'view:update': (state, event) => {
            const { viewId, updates } = event.payload;
            const view = state.views.get(viewId);
            if (view) {
                Object.assign(view, updates, {
                    updatedAt: event.timestamp,
                    updatedBy: event.actor
                });
            }
            return state;
        },

        'view:switch': (state, event) => {
            state.currentViewId = event.payload.viewId;
            return state;
        },

        // ========================================================================
        // FIELD/SCHEMA ACTIONS
        // ========================================================================

        'field:create': (state, event) => {
            const { setId, field } = event.payload;
            const set = state.sets.get(setId);
            if (set && set.schema) {
                if (!set.schema.fields) set.schema.fields = [];
                set.schema.fields.push({
                    ...field,
                    createdAt: event.timestamp,
                    createdBy: event.actor
                });
            }
            return state;
        },

        'field:update': (state, event) => {
            const { setId, fieldName, updates } = event.payload;
            const set = state.sets.get(setId);
            if (set && set.schema && set.schema.fields) {
                const field = set.schema.fields.find(f => f.name === fieldName);
                if (field) {
                    Object.assign(field, updates);
                }
            }
            return state;
        },

        // ========================================================================
        // TOSS PILE ACTIONS (Tombstone pattern - Rule 9)
        // ========================================================================

        'toss:record': (state, event) => {
            const { setId, recordId, reason, snapshot } = event.payload;
            const actionId = `toss_${event.id}`;

            state.tossPile.actions.set(actionId, {
                actionId,
                type: 'toss_record',
                setId,
                recordId,
                reason,
                snapshot,
                timestamp: event.timestamp,
                actor: event.actor,
                status: 'tossed',
                _eventId: event.id
            });

            return state;
        },

        'toss:cell': (state, event) => {
            const { setId, recordId, fieldName, value, reason, snapshot } = event.payload;
            const entryId = `toss_cell_${event.id}`;

            state.tossPile.entries.set(entryId, {
                entryId,
                setId,
                recordId,
                fieldName,
                value,
                reason,
                snapshot,
                timestamp: event.timestamp,
                actor: event.actor,
                status: 'tossed',
                _eventId: event.id
            });

            return state;
        },

        'pickup:entry': (state, event) => {
            const { entryId } = event.payload;
            const entry = state.tossPile.entries.get(entryId);
            if (entry) {
                entry.status = 'picked_up';
                entry.pickedUpAt = event.timestamp;
                entry.pickedUpBy = event.actor;
            }
            return state;
        },

        // ========================================================================
        // TOMBSTONE ACTION (Rule 9)
        // ========================================================================

        'tombstone': (state, event) => {
            const { targetId, reason } = event.payload;
            // Mark the target as tombstoned in a tracking structure
            if (!state._tombstones) state._tombstones = new Map();
            state._tombstones.set(targetId, {
                tombstoneEventId: event.id,
                reason,
                timestamp: event.timestamp,
                actor: event.actor
            });
            return state;
        },

        // ========================================================================
        // IMPORT ACTIONS
        // ========================================================================

        'import:complete': (state, event) => {
            const { importId, setId, recordCount, fieldCount } = event.payload;
            state.imports.set(importId, {
                importId,
                setId,
                recordCount,
                fieldCount,
                completedAt: event.timestamp,
                actor: event.actor,
                _eventId: event.id
            });
            return state;
        },

        // ========================================================================
        // USER ACTIONS
        // ========================================================================

        'user:set': (state, event) => {
            const { userId, userName, preferences } = event.payload;
            state.user = {
                id: userId,
                name: userName,
                preferences: preferences || {},
                setAt: event.timestamp
            };
            return state;
        },

        // ========================================================================
        // UI ACTIONS
        // ========================================================================

        'ui:sidebar:toggle': (state, event) => {
            state.ui.sidebarOpen = event.payload.open;
            return state;
        },

        'ui:panel:toggle': (state, event) => {
            const { panelId, open } = event.payload;
            if (open) {
                state.ui.activePanels.add(panelId);
            } else {
                state.ui.activePanels.delete(panelId);
            }
            return state;
        }
    };

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /**
     * Determine if a new value should replace existing or create SUP
     */
    function shouldReplaceValue(cell, newObservation) {
        if (!cell.values || cell.values.length === 0) return true;

        const latestValue = cell.values[cell.values.length - 1];
        const oldCtx = latestValue.context_schema || {};
        const newCtx = newObservation.context_schema || {};

        // Replace if contexts are essentially the same
        return (
            oldCtx.method === newCtx.method &&
            oldCtx.definition === newCtx.definition &&
            oldCtx.scale === newCtx.scale
        );
    }

    /**
     * Create initial empty state
     */
    function createInitialState() {
        return {
            // Core data
            sets: new Map(),
            currentSetId: null,

            // Views
            views: new Map(),
            currentViewId: null,

            // Entities
            entities: new Map(),

            // Selection
            selectedRecordIds: new Set(),
            lastSelectedRecordId: null,

            // Toss Pile
            tossPile: {
                entries: new Map(),
                actions: new Map(),
                settings: {
                    showGhosts: true,
                    ghostMaxAge: null,
                    panelOpen: false
                }
            },

            // User
            user: {
                id: null,
                name: null,
                preferences: {}
            },

            // UI
            ui: {
                sidebarOpen: true,
                sidebarWidth: 280,
                activePanels: new Set(),
                modals: [],
                notifications: []
            },

            // Imports
            imports: new Map(),

            // Internal tracking
            _tombstones: new Map(),
            _lastEventId: null,
            _derivedAt: null
        };
    }

    // ============================================================================
    // STATE DERIVATION CLASS
    // ============================================================================

    class EOStateDerivation {
        constructor() {
            this._state = null;
            this._eventLog = null;
            this._lastProcessedClock = 0;
            this._subscribers = new Set();
            this._unsubscribeLog = null;
        }

        /**
         * Initialize with an event log and derive initial state
         */
        init(eventLog) {
            this._eventLog = eventLog;
            this._state = this.deriveFromLog(eventLog);

            // Subscribe to new events for incremental updates
            this._unsubscribeLog = eventLog.subscribe((event) => {
                this._applyEvent(event);
                this._notifySubscribers();
            });

            return this._state;
        }

        /**
         * Derive complete state from event log (full rebuild)
         * This is the core of Axiom 0: State = f(Log)
         */
        deriveFromLog(eventLog) {
            const state = createInitialState();
            const events = eventLog.getTopologicalOrder();

            for (const event of events) {
                // Skip tombstoned events in state derivation
                if (eventLog.isTombstoned(event.id)) {
                    continue;
                }

                this._applyEventToState(state, event);
            }

            state._lastEventId = events.length > 0 ? events[events.length - 1].id : null;
            state._derivedAt = new Date().toISOString();

            this._state = state;
            this._lastProcessedClock = eventLog.getClock();

            return state;
        }

        /**
         * Apply a single event to state (incremental update)
         */
        _applyEvent(event) {
            if (!this._state) {
                this._state = createInitialState();
            }

            // Check if tombstoned
            if (this._eventLog && this._eventLog.isTombstoned(event.id)) {
                return;
            }

            this._applyEventToState(this._state, event);
            this._state._lastEventId = event.id;
            this._lastProcessedClock = event.logicalClock;
        }

        /**
         * Apply event to a state object using registered handlers
         */
        _applyEventToState(state, event) {
            const action = event.payload?.action;
            const handler = ACTION_HANDLERS[action];

            if (handler) {
                try {
                    handler(state, event);
                } catch (err) {
                    console.error(`[EOStateDerivation] Error applying ${action}:`, err);
                }
            } else if (action) {
                // Unknown action - log for debugging but don't fail
                console.debug(`[EOStateDerivation] No handler for action: ${action}`);
            }

            return state;
        }

        /**
         * Get current derived state (read-only)
         */
        getState() {
            return this._state;
        }

        /**
         * Get a specific property from state
         */
        get(key) {
            return this._state?.[key];
        }

        /**
         * Subscribe to state changes
         */
        subscribe(callback) {
            this._subscribers.add(callback);
            return () => this._subscribers.delete(callback);
        }

        /**
         * Notify subscribers of state change
         */
        _notifySubscribers() {
            this._subscribers.forEach(callback => {
                try {
                    callback(this._state);
                } catch (err) {
                    console.error('[EOStateDerivation] Subscriber error:', err);
                }
            });
        }

        /**
         * Force a full state rebuild from log
         */
        rebuild() {
            if (this._eventLog) {
                this.deriveFromLog(this._eventLog);
                this._notifySubscribers();
            }
            return this._state;
        }

        /**
         * Check if state is in sync with log
         */
        isInSync() {
            if (!this._eventLog) return false;
            return this._lastProcessedClock === this._eventLog.getClock();
        }

        /**
         * Get state derivation statistics
         */
        getStats() {
            return {
                setCount: this._state?.sets?.size || 0,
                viewCount: this._state?.views?.size || 0,
                importCount: this._state?.imports?.size || 0,
                tombstoneCount: this._state?._tombstones?.size || 0,
                lastEventId: this._state?._lastEventId,
                lastProcessedClock: this._lastProcessedClock,
                derivedAt: this._state?._derivedAt,
                inSync: this.isInSync()
            };
        }

        /**
         * Cleanup
         */
        destroy() {
            if (this._unsubscribeLog) {
                this._unsubscribeLog();
            }
            this._subscribers.clear();
            this._state = null;
        }
    }

    // ============================================================================
    // ACTION CREATORS (Convenience functions for common operations)
    // ============================================================================

    /**
     * Create event payloads for common actions
     * These return payload objects to be used with eventLog.append()
     */
    const Actions = {
        // Set actions
        createSet: (setId, name, schema) => ({
            action: 'set:create',
            setId,
            name,
            schema
        }),

        updateSet: (setId, updates) => ({
            action: 'set:update',
            setId,
            updates
        }),

        switchSet: (setId) => ({
            action: 'set:switch',
            setId
        }),

        // Record actions
        createRecord: (setId, record) => ({
            action: 'record:create',
            setId,
            record
        }),

        updateRecord: (setId, recordId, updates) => ({
            action: 'record:update',
            setId,
            recordId,
            updates
        }),

        selectRecord: (recordId, multi = false) => ({
            action: 'record:select',
            recordId,
            multi
        }),

        // Cell actions
        editCell: (setId, recordId, fieldName, value, contextSchema = null) => ({
            action: 'cell:edit',
            setId,
            recordId,
            fieldName,
            value,
            contextSchema
        }),

        // View actions
        createView: (viewId, setId, name, config) => ({
            action: 'view:create',
            viewId,
            setId,
            name,
            config
        }),

        switchView: (viewId) => ({
            action: 'view:switch',
            viewId
        }),

        // Toss actions (Rule 9 - deletion as event)
        tossRecord: (setId, recordId, reason, snapshot) => ({
            action: 'toss:record',
            setId,
            recordId,
            reason,
            snapshot
        }),

        tossCell: (setId, recordId, fieldName, value, reason, snapshot) => ({
            action: 'toss:cell',
            setId,
            recordId,
            fieldName,
            value,
            reason,
            snapshot
        }),

        pickupEntry: (entryId) => ({
            action: 'pickup:entry',
            entryId
        }),

        // Field actions
        createField: (setId, field) => ({
            action: 'field:create',
            setId,
            field
        }),

        updateField: (setId, fieldName, updates) => ({
            action: 'field:update',
            setId,
            fieldName,
            updates
        }),

        // User actions
        setUser: (userId, userName, preferences) => ({
            action: 'user:set',
            userId,
            userName,
            preferences
        }),

        // Import actions
        completeImport: (importId, setId, recordCount, fieldCount) => ({
            action: 'import:complete',
            importId,
            setId,
            recordCount,
            fieldCount
        })
    };

    // ============================================================================
    // SINGLETON INSTANCE
    // ============================================================================

    let _instance = null;

    function getStateDerivation() {
        if (!_instance) {
            _instance = new EOStateDerivation();
        }
        return _instance;
    }

    function initStateDerivation(eventLog) {
        _instance = new EOStateDerivation();
        _instance.init(eventLog);
        return _instance;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOStateDerivationModule = {
        // Classes
        StateDerivation: EOStateDerivation,

        // Action creators
        Actions,

        // Action handlers (for extension)
        registerHandler: (action, handler) => {
            ACTION_HANDLERS[action] = handler;
        },

        // Singleton
        get: getStateDerivation,
        init: initStateDerivation,

        // Helpers
        createInitialState
    };

    // Export to global scope
    global.EOStateDerivation = EOStateDerivationModule;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOStateDerivationModule;
    }

})(typeof window !== 'undefined' ? window : global);
