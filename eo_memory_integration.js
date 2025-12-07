/**
 * EO Memory Integration
 *
 * Applies memory optimizations to existing modules.
 * This module patches and enhances existing functionality with memory-efficient patterns.
 *
 * INTEGRATION STRATEGY (Based on EO Operators):
 *
 * 1. EOGraph → Use SparseGraphIndex (CON optimization)
 *    - Replace 5 redundant indexes with single lazy-indexed storage
 *    - Reduce memory by ~60% for large graphs
 *
 * 2. EOEventBus → Use UnifiedEventLog (SUP - single source of truth)
 *    - Consolidate 3 separate event logs into one
 *    - Reduce event log memory by ~66%
 *
 * 3. EOCRollupEngine → Use DerivedValueCache (REC memoization)
 *    - Cache computed rollup values with dependency tracking
 *    - Invalidate on source data changes
 *
 * 4. State.sets.records → Use LazyDataWindow (SEG pagination)
 *    - Only load visible + buffer records
 *    - Virtual scrolling support
 */

(function(global) {
    'use strict';

    // Require the optimization module
    const EOMemOpt = global.EOMemoryOptimization;

    if (!EOMemOpt) {
        console.error('[EOMemoryIntegration] EOMemoryOptimization module not loaded');
        return;
    }

    // ============================================================================
    // GRAPH OPTIMIZATION
    // ============================================================================

    /**
     * Create an optimized graph that uses sparse indexing
     */
    function createOptimizedGraph(config = {}) {
        const sparseIndex = new EOMemOpt.SparseGraphIndex();
        const nodeIndex = new Map();
        const nodesByPosition = new Map(); // Keep this for position queries

        return {
            id: config.id || `graph_${Date.now()}`,
            name: config.name || 'Optimized Graph',
            _sparseEdgeIndex: sparseIndex,
            _nodes: nodeIndex,
            _nodesByPosition: nodesByPosition,

            // Node operations
            addNode(id, nodeConfig = {}) {
                const node = {
                    id,
                    label: nodeConfig.label || id,
                    position: nodeConfig.position || 14,
                    data: nodeConfig.data || {},
                    createdAt: Date.now()
                };

                nodeIndex.set(id, node);

                // Sparse position index
                if (!nodesByPosition.has(node.position)) {
                    nodesByPosition.set(node.position, new Set());
                }
                nodesByPosition.get(node.position).add(id);

                return node;
            },

            getNode(id) {
                return nodeIndex.get(id);
            },

            removeNode(id) {
                const node = nodeIndex.get(id);
                if (!node) return false;

                // Remove connected edges
                const outgoing = sparseIndex.getBySource(id);
                const incoming = sparseIndex.getByTarget(id);

                for (const edge of [...outgoing, ...incoming]) {
                    sparseIndex.removeEdge(edge.id);
                }

                // Remove from position index
                nodesByPosition.get(node.position)?.delete(id);

                nodeIndex.delete(id);
                return true;
            },

            // Edge operations (using sparse index)
            addEdge(sourceId, targetId, operator, edgeConfig = {}) {
                const edge = {
                    id: edgeConfig.id || `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    source: sourceId,
                    target: targetId,
                    operator,
                    data: edgeConfig.data || {},
                    createdAt: Date.now()
                };

                sparseIndex.addEdge(edge);
                return edge;
            },

            getEdge(id) {
                return sparseIndex.getEdge(id);
            },

            getOutgoingEdges(nodeId) {
                return sparseIndex.getBySource(nodeId);
            },

            getIncomingEdges(nodeId) {
                return sparseIndex.getByTarget(nodeId);
            },

            getEdgesByOperator(operator) {
                return sparseIndex.getByOperator(operator);
            },

            removeEdge(id) {
                sparseIndex.removeEdge(id);
            },

            // Memory management
            clearIndexCache() {
                sparseIndex.clearIndexes();
            },

            getStats() {
                return {
                    nodeCount: nodeIndex.size,
                    edgeStats: sparseIndex.getStats(),
                    positionGroups: nodesByPosition.size
                };
            }
        };
    }

    // ============================================================================
    // ROLLUP ENGINE OPTIMIZATION
    // ============================================================================

    /**
     * Wrap the rollup engine with memoization
     */
    function createMemoizedRollupEngine(originalEngine) {
        const derivedCache = new EOMemOpt.DerivedValueCache({ maxEntries: 500 });

        return {
            ...originalEngine,

            /**
             * Memoized evaluate that caches results
             */
            evaluate(config, record, state) {
                const cacheKey = this._createCacheKey(config, record);
                const dependencyKeys = this._getDependencyKeys(config, record);

                return derivedCache.getOrCompute(
                    cacheKey,
                    () => originalEngine.evaluate(config, record, state),
                    dependencyKeys
                );
            },

            /**
             * Invalidate cache when source data changes
             */
            invalidateRecord(recordId) {
                derivedCache.invalidate(`record:${recordId}`);
            },

            invalidateField(recordId, fieldId) {
                derivedCache.invalidate(`field:${recordId}:${fieldId}`);
            },

            invalidateSet(setId) {
                derivedCache.invalidate(`set:${setId}`);
            },

            clearCache() {
                derivedCache.clear();
            },

            getCacheStats() {
                return derivedCache.getStats();
            },

            _createCacheKey(config, record) {
                return `rollup:${config.sourceFieldId}:${config.targetSetId}:${config.targetFieldId}:${record.id || record._id}`;
            },

            _getDependencyKeys(config, record) {
                const keys = [];

                // Depend on source record
                const recordId = record.id || record._id;
                if (recordId) {
                    keys.push(`record:${recordId}`);
                    keys.push(`field:${recordId}:${config.sourceFieldId}`);
                }

                // Depend on target set
                keys.push(`set:${config.targetSetId}`);

                return keys;
            }
        };
    }

    // ============================================================================
    // EVENT BUS OPTIMIZATION
    // ============================================================================

    /**
     * Create an optimized event bus using unified logging
     */
    function createOptimizedEventBus(options = {}) {
        const unifiedLog = new EOMemOpt.UnifiedEventLog({
            maxSize: options.maxLogSize || 300 // Reduced from 1000
        });

        const handlers = new Map();
        const onceHandlers = new Map();
        const wildcardHandlers = new Set();
        let handlerId = 0;

        // Debounce high-frequency events
        const debouncedEventTypes = new Set([
            'cell:edited',
            'search:query',
            'scroll:position'
        ]);

        const debouncedEmit = EOMemOpt.debounce((eventType, data, source) => {
            _emit(eventType, data, source);
        }, 100);

        function _emit(eventType, data, source) {
            const event = unifiedLog.log({
                type: eventType,
                source,
                data,
                preserveData: false // Don't store data in log by default
            });

            // Call handlers
            const typeHandlers = handlers.get(eventType) || [];
            for (const entry of typeHandlers) {
                try {
                    entry.handler(data, event);
                } catch (err) {
                    console.error(`Event handler error for "${eventType}":`, err);
                }
            }

            // Call once handlers
            const typeOnceHandlers = onceHandlers.get(eventType) || [];
            for (const entry of typeOnceHandlers) {
                try {
                    entry.handler(data, event);
                } catch (err) {
                    console.error(`Once handler error for "${eventType}":`, err);
                }
            }
            onceHandlers.delete(eventType);

            // Wildcard handlers
            for (const entry of wildcardHandlers) {
                try {
                    entry.handler(data, event, eventType);
                } catch (err) {
                    console.error('Wildcard handler error:', err);
                }
            }

            return event;
        }

        return {
            on(eventType, handler, options = {}) {
                const id = ++handlerId;
                if (!handlers.has(eventType)) {
                    handlers.set(eventType, []);
                }
                handlers.get(eventType).push({ id, handler, priority: options.priority || 0 });
                handlers.get(eventType).sort((a, b) => b.priority - a.priority);

                return () => {
                    const arr = handlers.get(eventType);
                    const idx = arr?.findIndex(h => h.id === id);
                    if (idx > -1) arr.splice(idx, 1);
                };
            },

            once(eventType, handler) {
                const id = ++handlerId;
                if (!onceHandlers.has(eventType)) {
                    onceHandlers.set(eventType, []);
                }
                onceHandlers.get(eventType).push({ id, handler });
                return () => {
                    const arr = onceHandlers.get(eventType);
                    const idx = arr?.findIndex(h => h.id === id);
                    if (idx > -1) arr.splice(idx, 1);
                };
            },

            onAny(handler) {
                const entry = { handler };
                wildcardHandlers.add(entry);
                return () => wildcardHandlers.delete(entry);
            },

            emit(eventType, data = {}, options = {}) {
                const source = options.source || 'unknown';

                // Use debounced emit for high-frequency events
                if (debouncedEventTypes.has(eventType)) {
                    debouncedEmit(eventType, data, source);
                    return null;
                }

                return _emit(eventType, data, source);
            },

            off(eventType, handlerId) {
                const arr = handlers.get(eventType);
                if (arr) {
                    const idx = arr.findIndex(h => h.id === handlerId);
                    if (idx > -1) {
                        arr.splice(idx, 1);
                        return true;
                    }
                }
                return false;
            },

            offAll(eventType) {
                if (eventType) {
                    handlers.delete(eventType);
                    onceHandlers.delete(eventType);
                } else {
                    handlers.clear();
                    onceHandlers.clear();
                    wildcardHandlers.clear();
                }
            },

            getLog(filter = {}) {
                if (filter.type) {
                    return unifiedLog.getByType(filter.type, filter.limit || 100);
                }
                return unifiedLog.getRecent(filter.limit || 50);
            },

            clearLog() {
                unifiedLog.clear();
            },

            getStats() {
                let totalHandlers = 0;
                handlers.forEach(arr => totalHandlers += arr.length);
                onceHandlers.forEach(arr => totalHandlers += arr.length);

                return {
                    eventTypes: handlers.size,
                    totalHandlers,
                    wildcardHandlers: wildcardHandlers.size,
                    log: unifiedLog.getStats()
                };
            }
        };
    }

    // ============================================================================
    // VIRTUAL SCROLLING DATA PROVIDER
    // ============================================================================

    /**
     * Create a virtual scrolling data provider for large record sets
     */
    function createVirtualDataProvider(options = {}) {
        const window = new EOMemOpt.LazyDataWindow({
            windowSize: options.visibleRows || 50,
            bufferSize: options.bufferRows || 25,
            dataLoader: options.dataLoader
        });

        let _sourceSet = null;
        let _sortedIds = [];
        let _filterFn = null;

        return {
            /**
             * Bind to a set
             */
            bind(set, sortFn = null, filterFn = null) {
                _sourceSet = set;
                _filterFn = filterFn;

                // Build ID list
                let ids = Array.from(set.records.keys());

                // Apply filter
                if (filterFn) {
                    ids = ids.filter(id => {
                        const record = set.records.get(id);
                        return record && filterFn(record);
                    });
                }

                // Apply sort
                if (sortFn) {
                    ids.sort((a, b) => {
                        const recordA = set.records.get(a);
                        const recordB = set.records.get(b);
                        return sortFn(recordA, recordB);
                    });
                }

                _sortedIds = ids;
                window.setIds(ids);

                // Set up data loader that reads from the set
                window._dataLoader = (idsToLoad) => {
                    return idsToLoad.map(id => set.records.get(id));
                };
            },

            /**
             * Get records for visible range
             */
            async getVisibleRecords(startRow, endRow) {
                return window.getRange(startRow, endRow);
            },

            /**
             * Get total count (after filtering)
             */
            get totalCount() {
                return window.totalCount;
            },

            /**
             * Get loaded count
             */
            get loadedCount() {
                return window.loadedCount;
            },

            /**
             * Handle record update
             */
            updateRecord(id, record) {
                window.setRecord(id, record);

                // Re-check filter
                if (_filterFn && !_filterFn(record)) {
                    window.removeRecord(id);
                }
            },

            /**
             * Handle record deletion
             */
            deleteRecord(id) {
                window.removeRecord(id);
            },

            /**
             * Force refresh
             */
            refresh() {
                if (_sourceSet) {
                    this.bind(_sourceSet);
                }
            },

            getStats() {
                return window.getStats();
            }
        };
    }

    // ============================================================================
    // STATE MANAGER OPTIMIZATION
    // ============================================================================

    /**
     * Create memory-optimized state manager wrapper
     */
    function createOptimizedStateManager(originalManager) {
        // Reduce history size
        originalManager._maxHistory = 20; // Down from 50

        // Create bounded event stream
        const maxEventStream = 100; // Down from unlimited

        const originalSet = originalManager.set.bind(originalManager);

        originalManager.set = function(key, value) {
            const result = originalSet(key, value);

            // Trim event stream
            if (this._state.eventStream && this._state.eventStream.length > maxEventStream) {
                this._state.eventStream = this._state.eventStream.slice(-maxEventStream);
            }

            return result;
        };

        // Add memory-aware getStats
        const originalGetStats = originalManager.getStats.bind(originalManager);
        originalManager.getStats = function() {
            const stats = originalGetStats();

            // Add memory estimation
            let estimatedMemoryKB = 0;

            // Estimate sets memory
            if (this._state.sets) {
                for (const [setId, set] of this._state.sets) {
                    if (set.records) {
                        estimatedMemoryKB += set.records.size * 2; // ~2KB per record estimate
                    }
                }
            }

            // Estimate views memory
            estimatedMemoryKB += (this._state.views?.size || 0) * 1;

            // Estimate history memory
            estimatedMemoryKB += this._history.length * 5;

            return {
                ...stats,
                estimatedMemoryKB,
                historyLength: this._history.length,
                eventStreamLength: this._state.eventStream?.length || 0
            };
        };

        return originalManager;
    }

    // ============================================================================
    // FORMULA ENGINE OPTIMIZATION
    // ============================================================================

    /**
     * Optimize formula engine with smaller cache
     */
    function optimizeFormulaEngine(engine) {
        // Reduce cache size
        if (engine._parseCache) {
            engine._parseCache.maxSize = 200; // Down from 1000

            // Add memory pressure response
            EOMemOpt.getMonitor().onCleanup((level) => {
                if (level === 'critical') {
                    engine._parseCache.clear();
                } else if (level === 'warning') {
                    // Clear half
                    const size = engine._parseCache.cache.size;
                    let count = 0;
                    for (const key of engine._parseCache.cache.keys()) {
                        if (count++ >= size / 2) break;
                        engine._parseCache.cache.delete(key);
                    }
                }
            });
        }

        return engine;
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Apply all memory optimizations to the application
     */
    function applyOptimizations(app = {}) {
        const report = {
            applied: [],
            skipped: [],
            errors: []
        };

        // Initialize global optimization module
        EOMemOpt.init({
            cache: { maxSize: 300, maxMemoryMB: 30 },
            derivedCache: { maxEntries: 500 },
            eventLog: { maxSize: 300 },
            monitor: { warningThresholdMB: 100, criticalThresholdMB: 200 }
        });
        report.applied.push('Global memory optimization initialized');

        // Optimize EOStateManager if available
        if (global.EOStateManager) {
            try {
                const manager = global.EOState?.getManager?.();
                if (manager) {
                    createOptimizedStateManager(manager);
                    report.applied.push('EOStateManager optimized');
                }
            } catch (e) {
                report.errors.push(`EOStateManager: ${e.message}`);
            }
        }

        // Optimize formula engine if available
        if (global.EOFormulaEngine) {
            try {
                // If there's a singleton instance
                optimizeFormulaEngine(global.EOFormulaEngine.prototype || global.EOFormulaEngine);
                report.applied.push('EOFormulaEngine cache reduced');
            } catch (e) {
                report.errors.push(`EOFormulaEngine: ${e.message}`);
            }
        }

        // Create optimized rollup engine wrapper if available
        if (global.EOCRollupEngine) {
            try {
                global.EOCRollupEngineOptimized = createMemoizedRollupEngine(global.EOCRollupEngine);
                report.applied.push('EOCRollupEngine wrapped with memoization');
            } catch (e) {
                report.errors.push(`EOCRollupEngine: ${e.message}`);
            }
        }

        // Make optimized creators available
        global.createOptimizedGraph = createOptimizedGraph;
        global.createOptimizedEventBus = createOptimizedEventBus;
        global.createVirtualDataProvider = createVirtualDataProvider;
        global.createMemoizedRollupEngine = createMemoizedRollupEngine;

        report.applied.push('Optimization factory functions exported');

        return report;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOMemoryIntegration = {
        // Factory functions
        createOptimizedGraph,
        createOptimizedEventBus,
        createVirtualDataProvider,
        createMemoizedRollupEngine,
        createOptimizedStateManager,
        optimizeFormulaEngine,

        // Main entry point
        applyOptimizations,

        // Get global stats
        getStats() {
            return EOMemOpt.getStats();
        }
    };

    // Export to global scope
    global.EOMemoryIntegration = EOMemoryIntegration;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOMemoryIntegration;
    }

})(typeof window !== 'undefined' ? window : global);
