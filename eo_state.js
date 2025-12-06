/**
 * EO State Manager
 * Centralized state contract with immutable update patterns
 *
 * Philosophy: Single source of truth with explicit schema
 * All modules access state through this interface, not raw objects
 *
 * EO Operator: INS (Instantiate) - Creating missing foundation
 */

(function(global) {
    'use strict';

    // ============================================================================
    // STATE SCHEMA DEFINITION
    // ============================================================================

    /**
     * @typedef {Object} EOStateSchema
     * @property {Map<string, Object>} sets - All data sets
     * @property {string|null} currentSetId - Active set ID
     * @property {Map<string, Object>} views - All view configurations
     * @property {string|null} currentViewId - Active view ID
     * @property {Map<string, Object>} entities - Entity registry
     * @property {Set<string>} selectedRecordIds - Selected records
     * @property {string|null} lastSelectedRecordId - Last selected record
     * @property {Object} tossPile - Toss pile state
     * @property {Object} user - Current user info
     * @property {Object} ui - UI state (panels, modals)
     * @property {Object} imports - Import manager state
     */

    const STATE_SCHEMA = {
        // Core data
        sets: { type: 'Map', default: () => new Map() },
        currentSetId: { type: 'string', default: null, nullable: true },

        // Views
        views: { type: 'Map', default: () => new Map() },
        currentViewId: { type: 'string', default: null, nullable: true },

        // Entities
        entities: { type: 'Map', default: () => new Map() },

        // Selection
        selectedRecordIds: { type: 'Set', default: () => new Set() },
        lastSelectedRecordId: { type: 'string', default: null, nullable: true },

        // Toss Pile
        tossPile: {
            type: 'Object',
            default: () => ({
                entries: new Map(),
                actions: new Map(),
                actionIdCounter: 1,
                entryIdCounter: 1,
                settings: {
                    showGhosts: true,
                    ghostMaxAge: null,
                    panelOpen: false,
                    panelWidth: 320
                }
            })
        },

        // User
        user: {
            type: 'Object',
            default: () => ({
                id: null,
                name: null,
                preferences: {}
            })
        },

        // UI State
        ui: {
            type: 'Object',
            default: () => ({
                sidebarOpen: true,
                sidebarWidth: 280,
                activePanels: new Set(),
                modals: [],
                notifications: [],
                searchQuery: '',
                focusMode: false
            })
        },

        // Imports
        imports: { type: 'Map', default: () => new Map() },

        // Event stream for provenance
        eventStream: { type: 'Array', default: () => [] },
        eventIdCounter: { type: 'number', default: 1 },

        // Lean context
        leanContext: { type: 'Object', default: null, nullable: true }
    };

    // ============================================================================
    // STATE MANAGER CLASS
    // ============================================================================

    class EOStateManager {
        constructor(initialState = {}) {
            this._state = this._createInitialState(initialState);
            this._subscribers = new Map();
            this._subscriberId = 0;
            this._history = [];
            this._historyIndex = -1;
            this._maxHistory = 50;
            this._frozen = false;
        }

        /**
         * Create initial state from schema
         */
        _createInitialState(overrides = {}) {
            const state = {};

            for (const [key, schema] of Object.entries(STATE_SCHEMA)) {
                if (overrides[key] !== undefined) {
                    state[key] = overrides[key];
                } else if (typeof schema.default === 'function') {
                    state[key] = schema.default();
                } else {
                    state[key] = schema.default;
                }
            }

            return state;
        }

        /**
         * Get current state (read-only snapshot)
         */
        getState() {
            return this._state;
        }

        /**
         * Get a specific state property
         */
        get(key) {
            if (!STATE_SCHEMA.hasOwnProperty(key)) {
                console.warn(`EOState: Unknown state key "${key}"`);
            }
            return this._state[key];
        }

        /**
         * Set a state property with validation
         */
        set(key, value) {
            if (this._frozen) {
                console.warn('EOState: State is frozen, cannot modify');
                return false;
            }

            if (!STATE_SCHEMA.hasOwnProperty(key)) {
                console.warn(`EOState: Unknown state key "${key}"`);
                return false;
            }

            const schema = STATE_SCHEMA[key];

            // Validate nullable
            if (value === null && !schema.nullable) {
                console.warn(`EOState: "${key}" cannot be null`);
                return false;
            }

            // Store previous value for history
            const previousValue = this._state[key];

            // Update state
            this._state[key] = value;

            // Add to history
            this._addToHistory(key, previousValue, value);

            // Notify subscribers
            this._notify(key, value, previousValue);

            return true;
        }

        /**
         * Update state with a patch object
         */
        patch(updates) {
            const changes = {};

            for (const [key, value] of Object.entries(updates)) {
                const previousValue = this._state[key];
                if (this.set(key, value)) {
                    changes[key] = { previous: previousValue, current: value };
                }
            }

            return changes;
        }

        /**
         * Subscribe to state changes
         */
        subscribe(keyOrKeys, callback) {
            const id = ++this._subscriberId;
            const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];

            keys.forEach(key => {
                if (!this._subscribers.has(key)) {
                    this._subscribers.set(key, new Map());
                }
                this._subscribers.get(key).set(id, callback);
            });

            // Return unsubscribe function
            return () => {
                keys.forEach(key => {
                    this._subscribers.get(key)?.delete(id);
                });
            };
        }

        /**
         * Subscribe to all state changes
         */
        subscribeAll(callback) {
            return this.subscribe(Object.keys(STATE_SCHEMA), callback);
        }

        /**
         * Notify subscribers of changes
         */
        _notify(key, value, previousValue) {
            const subscribers = this._subscribers.get(key);
            if (subscribers) {
                subscribers.forEach(callback => {
                    try {
                        callback(value, previousValue, key);
                    } catch (err) {
                        console.error(`EOState: Subscriber error for "${key}":`, err);
                    }
                });
            }
        }

        /**
         * Add change to history
         */
        _addToHistory(key, previousValue, newValue) {
            // Truncate future history if we're not at the end
            if (this._historyIndex < this._history.length - 1) {
                this._history = this._history.slice(0, this._historyIndex + 1);
            }

            this._history.push({
                timestamp: Date.now(),
                key,
                previousValue,
                newValue
            });

            // Limit history size
            if (this._history.length > this._maxHistory) {
                this._history.shift();
            } else {
                this._historyIndex++;
            }
        }

        /**
         * Undo last state change
         */
        undo() {
            if (this._historyIndex < 0) return false;

            const entry = this._history[this._historyIndex];
            this._state[entry.key] = entry.previousValue;
            this._historyIndex--;

            this._notify(entry.key, entry.previousValue, entry.newValue);
            return true;
        }

        /**
         * Redo undone state change
         */
        redo() {
            if (this._historyIndex >= this._history.length - 1) return false;

            this._historyIndex++;
            const entry = this._history[this._historyIndex];
            this._state[entry.key] = entry.newValue;

            this._notify(entry.key, entry.newValue, entry.previousValue);
            return true;
        }

        /**
         * Freeze state (prevent modifications)
         */
        freeze() {
            this._frozen = true;
        }

        /**
         * Unfreeze state
         */
        unfreeze() {
            this._frozen = false;
        }

        /**
         * Reset state to initial values
         */
        reset() {
            this._state = this._createInitialState();
            this._history = [];
            this._historyIndex = -1;

            // Notify all subscribers
            for (const key of Object.keys(STATE_SCHEMA)) {
                this._notify(key, this._state[key], undefined);
            }
        }

        /**
         * Export state for persistence
         */
        export() {
            const exported = {};

            for (const [key, value] of Object.entries(this._state)) {
                if (value instanceof Map) {
                    exported[key] = Array.from(value.entries());
                } else if (value instanceof Set) {
                    exported[key] = Array.from(value);
                } else {
                    exported[key] = value;
                }
            }

            return {
                version: 1,
                timestamp: new Date().toISOString(),
                state: exported
            };
        }

        /**
         * Import state from persistence
         */
        import(data) {
            if (data.version !== 1) {
                console.warn('EOState: Unknown state version');
                return false;
            }

            const imported = data.state;

            for (const [key, schema] of Object.entries(STATE_SCHEMA)) {
                if (imported[key] !== undefined) {
                    let value = imported[key];

                    // Reconstruct Maps and Sets
                    if (schema.type === 'Map' && Array.isArray(value)) {
                        value = new Map(value);
                    } else if (schema.type === 'Set' && Array.isArray(value)) {
                        value = new Set(value);
                    }

                    this._state[key] = value;
                }
            }

            return true;
        }

        /**
         * Get state statistics
         */
        getStats() {
            return {
                setCount: this._state.sets.size,
                viewCount: this._state.views.size,
                entityCount: this._state.entities.size,
                importCount: this._state.imports.size,
                eventCount: this._state.eventStream.length,
                historyLength: this._history.length,
                subscriberCount: Array.from(this._subscribers.values())
                    .reduce((sum, map) => sum + map.size, 0)
            };
        }
    }

    // ============================================================================
    // HELPER FUNCTIONS FOR COMMON OPERATIONS
    // ============================================================================

    /**
     * Get current set from state
     */
    function getCurrentSet(state) {
        const setId = state.currentSetId;
        return setId ? state.sets.get(setId) : null;
    }

    /**
     * Get current view from state
     */
    function getCurrentView(state) {
        const viewId = state.currentViewId;
        return viewId ? state.views.get(viewId) : null;
    }

    /**
     * Get set by ID
     */
    function getSet(state, setId) {
        return state.sets.get(setId);
    }

    /**
     * Get view by ID
     */
    function getView(state, viewId) {
        return state.views.get(viewId);
    }

    /**
     * Get views for a set
     */
    function getSetViews(state, setId) {
        return Array.from(state.views.values())
            .filter(v => v.setId === setId);
    }

    /**
     * Get selected records for current set
     */
    function getSelectedRecords(state) {
        const set = getCurrentSet(state);
        if (!set) return [];

        return Array.from(state.selectedRecordIds)
            .map(id => set.records.get(id))
            .filter(Boolean);
    }

    /**
     * Check if record is selected
     */
    function isRecordSelected(state, recordId) {
        return state.selectedRecordIds.has(recordId);
    }

    // ============================================================================
    // SINGLETON INSTANCE
    // ============================================================================

    let _instance = null;

    function getStateManager() {
        if (!_instance) {
            _instance = new EOStateManager();
        }
        return _instance;
    }

    function initStateManager(initialState = {}) {
        _instance = new EOStateManager(initialState);
        return _instance;
    }

    // ============================================================================
    // BACKWARD COMPATIBILITY - Bridge to old global state
    // ============================================================================

    /**
     * Create a proxy that bridges old `state` object to new StateManager
     */
    function createStateBridge(stateManager) {
        return new Proxy({}, {
            get(target, prop) {
                return stateManager.get(prop);
            },
            set(target, prop, value) {
                return stateManager.set(prop, value);
            },
            has(target, prop) {
                return STATE_SCHEMA.hasOwnProperty(prop);
            },
            ownKeys() {
                return Object.keys(STATE_SCHEMA);
            }
        });
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOState = {
        // Classes
        StateManager: EOStateManager,

        // Schema
        SCHEMA: STATE_SCHEMA,

        // Singleton
        getManager: getStateManager,
        init: initStateManager,

        // Helpers
        getCurrentSet,
        getCurrentView,
        getSet,
        getView,
        getSetViews,
        getSelectedRecords,
        isRecordSelected,

        // Bridge
        createBridge: createStateBridge
    };

    // Export to global scope
    global.EOState = EOState;
    global.EOStateManager = EOStateManager;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOState;
    }

})(typeof window !== 'undefined' ? window : global);
