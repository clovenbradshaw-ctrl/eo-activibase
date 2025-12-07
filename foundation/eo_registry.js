/**
 * EO Registry
 * Module registry organized by EO operator
 *
 * @eo_operator DES + CON
 * @eo_layer foundation
 *
 * This module provides a centralized registry for all EO modules,
 * enabling dependency injection, lifecycle management, and
 * operator-based organization.
 */

(function(global) {
    'use strict';

    /**
     * Module metadata structure
     * @typedef {Object} EOModuleMetadata
     * @property {string} id - Unique module identifier
     * @property {string} version - Module version
     * @property {string} operator - Primary EO operator (NUL, DES, INS, etc.)
     * @property {string} layer - Module layer (foundation, state, transform, ui, etc.)
     * @property {string[]} dependencies - Required module IDs
     * @property {string[]} provides - Capabilities this module provides
     * @property {Object} instance - The actual module instance
     * @property {'pending'|'initializing'|'ready'|'error'|'destroyed'} status
     */

    const EORegistry = {
        /** @type {Map<string, EOModuleMetadata>} */
        _modules: new Map(),

        /** @type {Map<string, Set<string>>} */
        _byOperator: new Map(),

        /** @type {Map<string, Set<string>>} */
        _byLayer: new Map(),

        /** @type {Map<string, Set<string>>} */
        _byCapability: new Map(),

        /** @type {Array<{event: string, callback: Function}>} */
        _listeners: [],

        // ============================================================================
        // REGISTRATION
        // ============================================================================

        /**
         * Register a module with the registry
         * @param {Object} module - Module to register
         * @param {Object} metadata - Module metadata
         * @returns {boolean} Success
         */
        register(module, metadata) {
            const {
                id,
                version = '1.0.0',
                operator = 'DES',
                layer = 'unknown',
                dependencies = [],
                provides = []
            } = metadata;

            if (!id) {
                console.error('[EORegistry] Module ID is required');
                return false;
            }

            if (this._modules.has(id)) {
                console.warn(`[EORegistry] Module ${id} already registered, updating...`);
            }

            const entry = {
                id,
                version,
                operator,
                layer,
                dependencies,
                provides,
                instance: module,
                status: 'pending',
                registeredAt: Date.now()
            };

            // Store in main registry
            this._modules.set(id, entry);

            // Index by operator
            if (!this._byOperator.has(operator)) {
                this._byOperator.set(operator, new Set());
            }
            this._byOperator.get(operator).add(id);

            // Index by layer
            if (!this._byLayer.has(layer)) {
                this._byLayer.set(layer, new Set());
            }
            this._byLayer.get(layer).add(id);

            // Index by capability
            provides.forEach(capability => {
                if (!this._byCapability.has(capability)) {
                    this._byCapability.set(capability, new Set());
                }
                this._byCapability.get(capability).add(id);
            });

            this._emit('registered', { moduleId: id, metadata: entry });

            console.log(`[EORegistry] Registered: ${id} (${operator}/${layer})`);
            return true;
        },

        /**
         * Unregister a module
         * @param {string} moduleId - Module ID to unregister
         * @returns {boolean} Success
         */
        unregister(moduleId) {
            const entry = this._modules.get(moduleId);
            if (!entry) return false;

            // Call destroy if available
            if (entry.instance && typeof entry.instance.destroy === 'function') {
                try {
                    entry.instance.destroy();
                } catch (e) {
                    console.error(`[EORegistry] Error destroying ${moduleId}:`, e);
                }
            }

            // Remove from indices
            this._byOperator.get(entry.operator)?.delete(moduleId);
            this._byLayer.get(entry.layer)?.delete(moduleId);
            entry.provides.forEach(cap => {
                this._byCapability.get(cap)?.delete(moduleId);
            });

            // Remove from main registry
            this._modules.delete(moduleId);

            this._emit('unregistered', { moduleId });
            return true;
        },

        // ============================================================================
        // LOOKUP
        // ============================================================================

        /**
         * Get a module by ID
         * @param {string} moduleId - Module ID
         * @returns {Object|null} Module instance
         */
        get(moduleId) {
            const entry = this._modules.get(moduleId);
            return entry ? entry.instance : null;
        },

        /**
         * Get module metadata
         * @param {string} moduleId - Module ID
         * @returns {EOModuleMetadata|null}
         */
        getMetadata(moduleId) {
            return this._modules.get(moduleId) || null;
        },

        /**
         * Check if a module is registered
         * @param {string} moduleId - Module ID
         * @returns {boolean}
         */
        has(moduleId) {
            return this._modules.has(moduleId);
        },

        /**
         * Get all modules for an operator
         * @param {string} operator - EO operator
         * @returns {Object[]} Module instances
         */
        getByOperator(operator) {
            const ids = this._byOperator.get(operator);
            if (!ids) return [];
            return Array.from(ids).map(id => this.get(id)).filter(Boolean);
        },

        /**
         * Get all modules for a layer
         * @param {string} layer - Layer name
         * @returns {Object[]} Module instances
         */
        getByLayer(layer) {
            const ids = this._byLayer.get(layer);
            if (!ids) return [];
            return Array.from(ids).map(id => this.get(id)).filter(Boolean);
        },

        /**
         * Get all modules providing a capability
         * @param {string} capability - Capability name
         * @returns {Object[]} Module instances
         */
        getByCapability(capability) {
            const ids = this._byCapability.get(capability);
            if (!ids) return [];
            return Array.from(ids).map(id => this.get(id)).filter(Boolean);
        },

        /**
         * Get all registered module IDs
         * @returns {string[]}
         */
        getAllIds() {
            return Array.from(this._modules.keys());
        },

        // ============================================================================
        // LIFECYCLE
        // ============================================================================

        /**
         * Initialize a module and its dependencies
         * @param {string} moduleId - Module ID to initialize
         * @returns {Promise<boolean>}
         */
        async initialize(moduleId) {
            const entry = this._modules.get(moduleId);
            if (!entry) {
                console.error(`[EORegistry] Module not found: ${moduleId}`);
                return false;
            }

            if (entry.status === 'ready') return true;
            if (entry.status === 'initializing') {
                console.warn(`[EORegistry] Module ${moduleId} is already initializing`);
                return true;
            }

            entry.status = 'initializing';

            try {
                // Initialize dependencies first
                for (const depId of entry.dependencies) {
                    if (!this.has(depId)) {
                        throw new Error(`Missing dependency: ${depId}`);
                    }
                    await this.initialize(depId);
                }

                // Gather dependency instances
                const deps = {};
                entry.dependencies.forEach(depId => {
                    deps[depId] = this.get(depId);
                });

                // Initialize module
                if (entry.instance && typeof entry.instance.init === 'function') {
                    await entry.instance.init(deps);
                }

                entry.status = 'ready';
                entry.initializedAt = Date.now();

                this._emit('initialized', { moduleId });
                console.log(`[EORegistry] Initialized: ${moduleId}`);
                return true;

            } catch (error) {
                entry.status = 'error';
                entry.error = error;
                console.error(`[EORegistry] Failed to initialize ${moduleId}:`, error);
                this._emit('error', { moduleId, error });
                return false;
            }
        },

        /**
         * Initialize all registered modules in dependency order
         * @returns {Promise<boolean>}
         */
        async initializeAll() {
            const sorted = this._topologicalSort();

            for (const moduleId of sorted) {
                const success = await this.initialize(moduleId);
                if (!success) {
                    console.error(`[EORegistry] Initialization chain failed at: ${moduleId}`);
                    return false;
                }
            }

            return true;
        },

        /**
         * Destroy all modules (reverse order)
         */
        destroyAll() {
            const sorted = this._topologicalSort().reverse();
            sorted.forEach(id => this.unregister(id));
        },

        // ============================================================================
        // EVENTS
        // ============================================================================

        /**
         * Subscribe to registry events
         * @param {string} event - Event name
         * @param {Function} callback - Event handler
         * @returns {Function} Unsubscribe function
         */
        on(event, callback) {
            const listener = { event, callback };
            this._listeners.push(listener);
            return () => {
                const idx = this._listeners.indexOf(listener);
                if (idx >= 0) this._listeners.splice(idx, 1);
            };
        },

        /**
         * Emit an event
         * @param {string} event - Event name
         * @param {Object} data - Event data
         */
        _emit(event, data) {
            this._listeners
                .filter(l => l.event === event)
                .forEach(l => {
                    try {
                        l.callback(data);
                    } catch (e) {
                        console.error(`[EORegistry] Event handler error:`, e);
                    }
                });
        },

        // ============================================================================
        // UTILITIES
        // ============================================================================

        /**
         * Topological sort of modules by dependencies
         * @returns {string[]} Sorted module IDs
         */
        _topologicalSort() {
            const visited = new Set();
            const result = [];

            const visit = (id) => {
                if (visited.has(id)) return;
                visited.add(id);

                const entry = this._modules.get(id);
                if (entry) {
                    entry.dependencies.forEach(depId => visit(depId));
                    result.push(id);
                }
            };

            this._modules.forEach((_, id) => visit(id));
            return result;
        },

        /**
         * Get registry statistics
         * @returns {Object}
         */
        getStats() {
            const stats = {
                totalModules: this._modules.size,
                byOperator: {},
                byLayer: {},
                byStatus: { pending: 0, initializing: 0, ready: 0, error: 0, destroyed: 0 }
            };

            this._modules.forEach(entry => {
                stats.byOperator[entry.operator] = (stats.byOperator[entry.operator] || 0) + 1;
                stats.byLayer[entry.layer] = (stats.byLayer[entry.layer] || 0) + 1;
                stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;
            });

            return stats;
        },

        /**
         * Get dependency graph for visualization
         * @returns {Object} { nodes: [], edges: [] }
         */
        getDependencyGraph() {
            const nodes = [];
            const edges = [];

            this._modules.forEach((entry, id) => {
                nodes.push({
                    id,
                    operator: entry.operator,
                    layer: entry.layer,
                    status: entry.status
                });

                entry.dependencies.forEach(depId => {
                    edges.push({ from: id, to: depId });
                });
            });

            return { nodes, edges };
        },

        /**
         * Clear the registry
         */
        clear() {
            this.destroyAll();
            this._modules.clear();
            this._byOperator.clear();
            this._byLayer.clear();
            this._byCapability.clear();
        }
    };

    // Export to global scope
    global.EORegistry = EORegistry;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EORegistry;
    }

})(typeof window !== 'undefined' ? window : global);
