/**
 * EO Memory Optimization Module
 *
 * Applies EO theory principles to optimize browser memory usage:
 *
 * EO OPERATOR MAPPINGS:
 * - NUL: Recognize absence - don't store null/undefined, use sparse patterns
 * - DES: Use lightweight IDs/references instead of full object copies
 * - SEG: Partition data for lazy loading and pagination
 * - CON: Reference-based relationships instead of embedded data
 * - SYN: Compute aggregations on-demand, not precomputed/cached
 * - REC: Memoize recursive computations with dependency-based invalidation
 * - SUP: Single source of truth - avoid duplicate stores
 */

(function(global) {
    'use strict';

    // ============================================================================
    // MEMORY-EFFICIENT LRU CACHE
    // ============================================================================

    /**
     * Memory-aware LRU Cache with WeakRef support for large objects
     * Uses DES principle: store references, not copies
     */
    class MemoryAwareLRUCache {
        constructor(options = {}) {
            this.maxSize = options.maxSize || 500;
            this.maxMemoryMB = options.maxMemoryMB || 50;
            this.cache = new Map();
            this.accessOrder = [];
            this._estimatedBytes = 0;
            this._useWeakRefs = options.useWeakRefs || false;
        }

        get(key) {
            if (!this.cache.has(key)) return undefined;

            const entry = this.cache.get(key);

            // Handle WeakRef entries
            if (entry.isWeak) {
                const value = entry.ref.deref();
                if (value === undefined) {
                    // Object was garbage collected
                    this.cache.delete(key);
                    this._removeFromAccessOrder(key);
                    return undefined;
                }
                this._touchKey(key);
                return value;
            }

            this._touchKey(key);
            return entry.value;
        }

        set(key, value, options = {}) {
            const estimatedSize = options.estimatedSize || this._estimateSize(value);

            // Evict if needed
            while (this.cache.size >= this.maxSize ||
                   this._estimatedBytes + estimatedSize > this.maxMemoryMB * 1024 * 1024) {
                if (!this._evictOldest()) break;
            }

            // Remove existing entry if present
            if (this.cache.has(key)) {
                const existing = this.cache.get(key);
                this._estimatedBytes -= existing.size || 0;
                this._removeFromAccessOrder(key);
            }

            // Use WeakRef for large objects (> 100KB)
            const useWeak = this._useWeakRefs && estimatedSize > 100 * 1024;

            const entry = useWeak
                ? { isWeak: true, ref: new WeakRef(value), size: estimatedSize }
                : { isWeak: false, value, size: estimatedSize };

            this.cache.set(key, entry);
            this.accessOrder.push(key);
            this._estimatedBytes += estimatedSize;
        }

        has(key) {
            if (!this.cache.has(key)) return false;
            const entry = this.cache.get(key);
            if (entry.isWeak && entry.ref.deref() === undefined) {
                this.cache.delete(key);
                this._removeFromAccessOrder(key);
                return false;
            }
            return true;
        }

        delete(key) {
            if (this.cache.has(key)) {
                const entry = this.cache.get(key);
                this._estimatedBytes -= entry.size || 0;
                this.cache.delete(key);
                this._removeFromAccessOrder(key);
                return true;
            }
            return false;
        }

        clear() {
            this.cache.clear();
            this.accessOrder = [];
            this._estimatedBytes = 0;
        }

        get size() {
            return this.cache.size;
        }

        get estimatedMemoryMB() {
            return this._estimatedBytes / (1024 * 1024);
        }

        _touchKey(key) {
            this._removeFromAccessOrder(key);
            this.accessOrder.push(key);
        }

        _removeFromAccessOrder(key) {
            const idx = this.accessOrder.indexOf(key);
            if (idx > -1) {
                this.accessOrder.splice(idx, 1);
            }
        }

        _evictOldest() {
            if (this.accessOrder.length === 0) return false;
            const key = this.accessOrder.shift();
            const entry = this.cache.get(key);
            if (entry) {
                this._estimatedBytes -= entry.size || 0;
            }
            this.cache.delete(key);
            return true;
        }

        _estimateSize(value) {
            if (value === null || value === undefined) return 8;
            if (typeof value === 'boolean') return 4;
            if (typeof value === 'number') return 8;
            if (typeof value === 'string') return value.length * 2;
            if (Array.isArray(value)) {
                return 24 + value.reduce((sum, item) => sum + this._estimateSize(item), 0);
            }
            if (typeof value === 'object') {
                let size = 24;
                for (const key in value) {
                    size += key.length * 2 + this._estimateSize(value[key]);
                }
                return size;
            }
            return 8;
        }

        getStats() {
            return {
                size: this.cache.size,
                maxSize: this.maxSize,
                estimatedMemoryMB: this.estimatedMemoryMB,
                maxMemoryMB: this.maxMemoryMB,
                accessOrderLength: this.accessOrder.length
            };
        }
    }

    // ============================================================================
    // LAZY DATA WINDOW (SEG Operator)
    // ============================================================================

    /**
     * Lazy Data Window - implements SEG for efficient pagination
     * Only keeps a sliding window of data in memory
     */
    class LazyDataWindow {
        constructor(options = {}) {
            this.windowSize = options.windowSize || 100;
            this.bufferSize = options.bufferSize || 50; // Extra records for smooth scrolling
            this._data = new Map(); // Sparse storage - only loaded records
            this._allIds = []; // Full list of IDs (lightweight)
            this._loadedRange = { start: -1, end: -1 };
            this._dataLoader = options.dataLoader || null;
        }

        /**
         * Set the full list of record IDs (lightweight references - DES principle)
         */
        setIds(ids) {
            this._allIds = ids;
            this._data.clear();
            this._loadedRange = { start: -1, end: -1 };
        }

        get totalCount() {
            return this._allIds.length;
        }

        get loadedCount() {
            return this._data.size;
        }

        /**
         * Get a record by index (loads if needed)
         */
        async getByIndex(index) {
            if (index < 0 || index >= this._allIds.length) return null;

            const id = this._allIds[index];

            // Check if already loaded
            if (this._data.has(id)) {
                return this._data.get(id);
            }

            // Load the window around this index
            await this._loadWindow(index);

            return this._data.get(id) || null;
        }

        /**
         * Get a record by ID
         */
        getById(id) {
            return this._data.get(id) || null;
        }

        /**
         * Get a range of records (for rendering visible rows)
         */
        async getRange(startIndex, endIndex) {
            // Clamp to valid range
            startIndex = Math.max(0, startIndex);
            endIndex = Math.min(endIndex, this._allIds.length - 1);

            // Check if we need to load more
            if (startIndex < this._loadedRange.start || endIndex > this._loadedRange.end) {
                await this._loadWindow(Math.floor((startIndex + endIndex) / 2));
            }

            // Collect records
            const records = [];
            for (let i = startIndex; i <= endIndex; i++) {
                const id = this._allIds[i];
                const record = this._data.get(id);
                if (record) {
                    records.push({ index: i, id, record });
                }
            }

            return records;
        }

        /**
         * Load a window of data centered on an index (SEG operation)
         */
        async _loadWindow(centerIndex) {
            const halfWindow = Math.floor((this.windowSize + this.bufferSize) / 2);
            const start = Math.max(0, centerIndex - halfWindow);
            const end = Math.min(this._allIds.length - 1, centerIndex + halfWindow);

            // Determine what needs loading
            const idsToLoad = [];
            for (let i = start; i <= end; i++) {
                const id = this._allIds[i];
                if (!this._data.has(id)) {
                    idsToLoad.push({ index: i, id });
                }
            }

            // Load via callback
            if (idsToLoad.length > 0 && this._dataLoader) {
                const loadedRecords = await this._dataLoader(idsToLoad.map(x => x.id));

                for (let i = 0; i < idsToLoad.length; i++) {
                    if (loadedRecords[i]) {
                        this._data.set(idsToLoad[i].id, loadedRecords[i]);
                    }
                }
            }

            // Evict records outside the new window to save memory
            this._evictOutsideWindow(start, end);

            this._loadedRange = { start, end };
        }

        /**
         * Evict records outside the active window (NUL - release absence)
         */
        _evictOutsideWindow(start, end) {
            const idsInWindow = new Set();
            for (let i = start; i <= end; i++) {
                idsInWindow.add(this._allIds[i]);
            }

            for (const id of this._data.keys()) {
                if (!idsInWindow.has(id)) {
                    this._data.delete(id);
                }
            }
        }

        /**
         * Force a record into the cache (for newly created/edited records)
         */
        setRecord(id, record) {
            this._data.set(id, record);
            // Add to ID list if not present
            if (!this._allIds.includes(id)) {
                this._allIds.push(id);
            }
        }

        /**
         * Remove a record
         */
        removeRecord(id) {
            this._data.delete(id);
            const idx = this._allIds.indexOf(id);
            if (idx > -1) {
                this._allIds.splice(idx, 1);
            }
        }

        getStats() {
            return {
                totalIds: this._allIds.length,
                loadedRecords: this._data.size,
                loadedRange: this._loadedRange,
                windowSize: this.windowSize,
                memoryEfficiency: this._data.size / Math.max(1, this._allIds.length)
            };
        }
    }

    // ============================================================================
    // MEMOIZED COMPUTATION CACHE (REC Operator)
    // ============================================================================

    /**
     * Dependency-aware memoization for derived values
     * Implements REC operator with proper invalidation
     */
    class DerivedValueCache {
        constructor(options = {}) {
            this._cache = new Map();
            this._dependencies = new Map(); // value_key -> Set of source_keys
            this._dependents = new Map();   // source_key -> Set of value_keys
            this._maxEntries = options.maxEntries || 1000;
            this._computeCount = 0;
            this._hitCount = 0;
        }

        /**
         * Get or compute a derived value
         * @param {string} key - Unique key for this computation
         * @param {Function} computeFn - Function to compute the value
         * @param {string[]} dependencyKeys - Keys this value depends on
         */
        getOrCompute(key, computeFn, dependencyKeys = []) {
            // Check cache
            if (this._cache.has(key)) {
                this._hitCount++;
                return this._cache.get(key).value;
            }

            // Compute
            this._computeCount++;
            const value = computeFn();

            // Store with dependencies
            this._cache.set(key, {
                value,
                computedAt: Date.now(),
                dependencyKeys
            });

            // Track dependencies (CON operator - establish relationships)
            this._dependencies.set(key, new Set(dependencyKeys));

            for (const depKey of dependencyKeys) {
                if (!this._dependents.has(depKey)) {
                    this._dependents.set(depKey, new Set());
                }
                this._dependents.get(depKey).add(key);
            }

            // Evict if over limit
            if (this._cache.size > this._maxEntries) {
                this._evictOldest();
            }

            return value;
        }

        /**
         * Invalidate a source value and all its dependents (REC cascade)
         */
        invalidate(sourceKey) {
            const toInvalidate = new Set([sourceKey]);
            const queue = [sourceKey];

            // Breadth-first search through dependency graph
            while (queue.length > 0) {
                const current = queue.shift();
                const dependents = this._dependents.get(current);

                if (dependents) {
                    for (const dep of dependents) {
                        if (!toInvalidate.has(dep)) {
                            toInvalidate.add(dep);
                            queue.push(dep);
                        }
                    }
                }
            }

            // Remove all invalidated entries
            for (const key of toInvalidate) {
                this._cache.delete(key);
                this._dependencies.delete(key);
            }

            // Clean up dependent mappings
            this._dependents.delete(sourceKey);

            return toInvalidate.size;
        }

        /**
         * Invalidate all entries
         */
        clear() {
            this._cache.clear();
            this._dependencies.clear();
            this._dependents.clear();
        }

        _evictOldest() {
            // Find oldest entry
            let oldestKey = null;
            let oldestTime = Infinity;

            for (const [key, entry] of this._cache) {
                if (entry.computedAt < oldestTime) {
                    oldestTime = entry.computedAt;
                    oldestKey = key;
                }
            }

            if (oldestKey) {
                this.invalidate(oldestKey);
            }
        }

        getStats() {
            return {
                cacheSize: this._cache.size,
                hitCount: this._hitCount,
                computeCount: this._computeCount,
                hitRate: this._hitCount / Math.max(1, this._hitCount + this._computeCount),
                dependencyMappings: this._dependencies.size,
                dependentMappings: this._dependents.size
            };
        }
    }

    // ============================================================================
    // UNIFIED EVENT LOG (SUP Operator - Single Source of Truth)
    // ============================================================================

    /**
     * Unified Event Log - single source of truth for all event logging
     * Eliminates duplication across EventBus, State, and Graph
     */
    class UnifiedEventLog {
        constructor(options = {}) {
            this._log = [];
            this._maxSize = options.maxSize || 500; // Reduced from 1000 x 3 systems
            this._subscribers = new Map();
            this._typeIndex = new Map(); // Quick lookup by type
        }

        /**
         * Log an event (single point of entry)
         */
        log(event) {
            const entry = {
                id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                type: event.type,
                source: event.source || 'unknown',
                timestamp: event.timestamp || Date.now(),
                // Store minimal data - DES principle
                dataKeys: event.data ? Object.keys(event.data) : [],
                // Only store data if explicitly requested
                data: event.preserveData ? event.data : undefined
            };

            this._log.push(entry);

            // Update type index
            if (!this._typeIndex.has(entry.type)) {
                this._typeIndex.set(entry.type, []);
            }
            this._typeIndex.get(entry.type).push(this._log.length - 1);

            // Trim if over size
            if (this._log.length > this._maxSize) {
                this._trimLog();
            }

            // Notify subscribers
            this._notifySubscribers(entry);

            return entry;
        }

        /**
         * Get events by type (fast indexed lookup)
         */
        getByType(type, limit = 100) {
            const indices = this._typeIndex.get(type) || [];
            const result = [];

            // Get most recent first
            for (let i = indices.length - 1; i >= 0 && result.length < limit; i--) {
                const idx = indices[i];
                if (idx < this._log.length) {
                    result.push(this._log[idx]);
                }
            }

            return result;
        }

        /**
         * Get recent events
         */
        getRecent(limit = 50) {
            return this._log.slice(-limit);
        }

        /**
         * Subscribe to new events
         */
        subscribe(callback, filter = null) {
            const id = Date.now() + Math.random();
            this._subscribers.set(id, { callback, filter });
            return () => this._subscribers.delete(id);
        }

        _trimLog() {
            // Remove oldest 20%
            const removeCount = Math.floor(this._maxSize * 0.2);
            this._log.splice(0, removeCount);

            // Rebuild type index
            this._typeIndex.clear();
            for (let i = 0; i < this._log.length; i++) {
                const type = this._log[i].type;
                if (!this._typeIndex.has(type)) {
                    this._typeIndex.set(type, []);
                }
                this._typeIndex.get(type).push(i);
            }
        }

        _notifySubscribers(event) {
            for (const [id, { callback, filter }] of this._subscribers) {
                if (!filter || filter(event)) {
                    try {
                        callback(event);
                    } catch (e) {
                        console.error('Event subscriber error:', e);
                    }
                }
            }
        }

        clear() {
            this._log = [];
            this._typeIndex.clear();
        }

        getStats() {
            return {
                eventCount: this._log.length,
                maxSize: this._maxSize,
                typeCount: this._typeIndex.size,
                subscriberCount: this._subscribers.size
            };
        }
    }

    // ============================================================================
    // SPARSE GRAPH INDEX (CON Operator Optimization)
    // ============================================================================

    /**
     * Memory-efficient graph index using sparse storage
     * Consolidates multiple indexes into one with lazy computation
     */
    class SparseGraphIndex {
        constructor() {
            // Single unified edge storage
            this._edges = new Map();

            // Lazy-built indexes (computed on demand, cleared on mutation)
            this._bySource = null;
            this._byTarget = null;
            this._byOperator = null;

            this._dirty = true;
        }

        addEdge(edge) {
            this._edges.set(edge.id, edge);
            this._dirty = true;
        }

        removeEdge(edgeId) {
            this._edges.delete(edgeId);
            this._dirty = true;
        }

        updateEdge(edgeId, updates) {
            const edge = this._edges.get(edgeId);
            if (edge) {
                Object.assign(edge, updates);
                this._dirty = true;
            }
        }

        getEdge(edgeId) {
            return this._edges.get(edgeId);
        }

        /**
         * Get edges by source (lazy index build)
         */
        getBySource(sourceId) {
            this._ensureIndexes();
            return this._bySource.get(sourceId) || [];
        }

        /**
         * Get edges by target (lazy index build)
         */
        getByTarget(targetId) {
            this._ensureIndexes();
            return this._byTarget.get(targetId) || [];
        }

        /**
         * Get edges by operator (lazy index build)
         */
        getByOperator(operator) {
            this._ensureIndexes();
            return this._byOperator.get(operator) || [];
        }

        _ensureIndexes() {
            if (!this._dirty) return;

            this._bySource = new Map();
            this._byTarget = new Map();
            this._byOperator = new Map();

            for (const [id, edge] of this._edges) {
                // By source
                if (!this._bySource.has(edge.source)) {
                    this._bySource.set(edge.source, []);
                }
                this._bySource.get(edge.source).push(edge);

                // By target
                if (!this._byTarget.has(edge.target)) {
                    this._byTarget.set(edge.target, []);
                }
                this._byTarget.get(edge.target).push(edge);

                // By operator
                if (!this._byOperator.has(edge.operator)) {
                    this._byOperator.set(edge.operator, []);
                }
                this._byOperator.get(edge.operator).push(edge);
            }

            this._dirty = false;
        }

        /**
         * Clear lazy indexes (for memory pressure)
         */
        clearIndexes() {
            this._bySource = null;
            this._byTarget = null;
            this._byOperator = null;
            this._dirty = true;
        }

        get size() {
            return this._edges.size;
        }

        getStats() {
            return {
                edgeCount: this._edges.size,
                indexesCached: !this._dirty,
                estimatedMemoryKB: this._estimateMemory() / 1024
            };
        }

        _estimateMemory() {
            let bytes = this._edges.size * 200; // Base edge storage

            if (!this._dirty) {
                // Add index overhead
                bytes += (this._bySource?.size || 0) * 50;
                bytes += (this._byTarget?.size || 0) * 50;
                bytes += (this._byOperator?.size || 0) * 50;
            }

            return bytes;
        }
    }

    // ============================================================================
    // MEMORY MONITOR
    // ============================================================================

    /**
     * Monitor memory usage and trigger cleanup when needed
     */
    class MemoryMonitor {
        constructor(options = {}) {
            this._warningThresholdMB = options.warningThresholdMB || 100;
            this._criticalThresholdMB = options.criticalThresholdMB || 200;
            this._checkIntervalMs = options.checkIntervalMs || 30000;
            this._cleanupCallbacks = [];
            this._timer = null;
            this._lastCheck = null;
        }

        /**
         * Start monitoring
         */
        start() {
            if (this._timer) return;

            this._timer = setInterval(() => this._check(), this._checkIntervalMs);
            this._check(); // Initial check
        }

        /**
         * Stop monitoring
         */
        stop() {
            if (this._timer) {
                clearInterval(this._timer);
                this._timer = null;
            }
        }

        /**
         * Register a cleanup callback
         */
        onCleanup(callback) {
            this._cleanupCallbacks.push(callback);
            return () => {
                const idx = this._cleanupCallbacks.indexOf(callback);
                if (idx > -1) this._cleanupCallbacks.splice(idx, 1);
            };
        }

        /**
         * Get current memory usage (if available)
         */
        getMemoryUsage() {
            if (typeof performance !== 'undefined' && performance.memory) {
                return {
                    usedHeapMB: performance.memory.usedJSHeapSize / (1024 * 1024),
                    totalHeapMB: performance.memory.totalJSHeapSize / (1024 * 1024),
                    limitMB: performance.memory.jsHeapSizeLimit / (1024 * 1024)
                };
            }
            return null;
        }

        _check() {
            const memory = this.getMemoryUsage();
            this._lastCheck = { timestamp: Date.now(), memory };

            if (!memory) return;

            if (memory.usedHeapMB > this._criticalThresholdMB) {
                console.warn(`[MemoryMonitor] Critical memory usage: ${memory.usedHeapMB.toFixed(1)}MB`);
                this._triggerCleanup('critical');
            } else if (memory.usedHeapMB > this._warningThresholdMB) {
                console.warn(`[MemoryMonitor] High memory usage: ${memory.usedHeapMB.toFixed(1)}MB`);
                this._triggerCleanup('warning');
            }
        }

        _triggerCleanup(level) {
            for (const callback of this._cleanupCallbacks) {
                try {
                    callback(level, this._lastCheck);
                } catch (e) {
                    console.error('Cleanup callback error:', e);
                }
            }
        }

        getStats() {
            return {
                running: this._timer !== null,
                lastCheck: this._lastCheck,
                cleanupCallbackCount: this._cleanupCallbacks.length,
                thresholds: {
                    warningMB: this._warningThresholdMB,
                    criticalMB: this._criticalThresholdMB
                }
            };
        }
    }

    // ============================================================================
    // DEBOUNCE & THROTTLE UTILITIES
    // ============================================================================

    /**
     * Debounce function calls
     */
    function debounce(fn, delay) {
        let timeoutId = null;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Throttle function calls
     */
    function throttle(fn, interval) {
        let lastTime = 0;
        let timeoutId = null;

        return function(...args) {
            const now = Date.now();
            const remaining = interval - (now - lastTime);

            if (remaining <= 0) {
                clearTimeout(timeoutId);
                timeoutId = null;
                lastTime = now;
                fn.apply(this, args);
            } else if (!timeoutId) {
                timeoutId = setTimeout(() => {
                    lastTime = Date.now();
                    timeoutId = null;
                    fn.apply(this, args);
                }, remaining);
            }
        };
    }

    /**
     * Request idle callback polyfill
     */
    const requestIdleCallback =
        (typeof window !== 'undefined' && window.requestIdleCallback) ||
        function(callback) {
            return setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 1);
        };

    const cancelIdleCallback =
        (typeof window !== 'undefined' && window.cancelIdleCallback) ||
        clearTimeout;

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOMemoryOptimization = {
        // Classes
        MemoryAwareLRUCache,
        LazyDataWindow,
        DerivedValueCache,
        UnifiedEventLog,
        SparseGraphIndex,
        MemoryMonitor,

        // Utilities
        debounce,
        throttle,
        requestIdleCallback,
        cancelIdleCallback,

        // Singleton instances
        _globalCache: null,
        _globalDerivedCache: null,
        _globalEventLog: null,
        _globalMonitor: null,

        /**
         * Initialize global memory optimization instances
         */
        init(options = {}) {
            this._globalCache = new MemoryAwareLRUCache(options.cache);
            this._globalDerivedCache = new DerivedValueCache(options.derivedCache);
            this._globalEventLog = new UnifiedEventLog(options.eventLog);
            this._globalMonitor = new MemoryMonitor(options.monitor);

            // Start monitoring
            this._globalMonitor.start();

            // Register cleanup callbacks
            this._globalMonitor.onCleanup((level) => {
                if (level === 'critical') {
                    this._globalCache.clear();
                    this._globalDerivedCache.clear();
                } else if (level === 'warning') {
                    // Partial cleanup - evict half
                    const cacheSize = this._globalCache.size;
                    for (let i = 0; i < cacheSize / 2; i++) {
                        this._globalCache._evictOldest();
                    }
                }
            });

            return this;
        },

        getGlobalCache() {
            if (!this._globalCache) {
                this._globalCache = new MemoryAwareLRUCache();
            }
            return this._globalCache;
        },

        getDerivedCache() {
            if (!this._globalDerivedCache) {
                this._globalDerivedCache = new DerivedValueCache();
            }
            return this._globalDerivedCache;
        },

        getEventLog() {
            if (!this._globalEventLog) {
                this._globalEventLog = new UnifiedEventLog();
            }
            return this._globalEventLog;
        },

        getMonitor() {
            if (!this._globalMonitor) {
                this._globalMonitor = new MemoryMonitor();
            }
            return this._globalMonitor;
        },

        /**
         * Get comprehensive stats
         */
        getStats() {
            return {
                cache: this._globalCache?.getStats() || null,
                derivedCache: this._globalDerivedCache?.getStats() || null,
                eventLog: this._globalEventLog?.getStats() || null,
                monitor: this._globalMonitor?.getStats() || null
            };
        }
    };

    // Export to global scope
    global.EOMemoryOptimization = EOMemoryOptimization;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOMemoryOptimization;
    }

})(typeof window !== 'undefined' ? window : global);
