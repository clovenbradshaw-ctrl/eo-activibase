/**
 * EO Recursion (REC Operator)
 * Framework for fixed-point computation, iterative refinement, and lineage tracking
 *
 * @eo_operator REC
 * @eo_layer foundation
 *
 * The REC operator handles recursive structures and iterative processes -
 * fixed-point computation, lineage tracking, and recursive data transformations.
 */

(function(global) {
    'use strict';

    /**
     * EORecursion - Fixed-point computation and recursion framework
     */
    const EORecursion = {
        // ============================================================================
        // FIXED-POINT COMPUTATION
        // ============================================================================

        /**
         * Compute fixed point of a function
         * @param {Function} fn - Transform function
         * @param {*} initial - Initial value
         * @param {Object} options - Computation options
         * @returns {{ value: *, iterations: number, converged: boolean }}
         */
        fixedPoint(fn, initial, options = {}) {
            const {
                maxIterations = 1000,
                tolerance = 1e-10,
                compare = null,
                onIteration = null
            } = options;

            let current = initial;
            let iterations = 0;

            while (iterations < maxIterations) {
                const next = fn(current, iterations);

                // Custom comparison
                if (compare) {
                    if (compare(current, next)) {
                        return { value: next, iterations: iterations + 1, converged: true };
                    }
                }
                // Numeric tolerance
                else if (typeof next === 'number' && typeof current === 'number') {
                    if (Math.abs(next - current) < tolerance) {
                        return { value: next, iterations: iterations + 1, converged: true };
                    }
                }
                // Deep equality for objects
                else if (JSON.stringify(next) === JSON.stringify(current)) {
                    return { value: next, iterations: iterations + 1, converged: true };
                }

                if (onIteration) {
                    onIteration(next, iterations);
                }

                current = next;
                iterations++;
            }

            return { value: current, iterations, converged: false };
        },

        /**
         * Iterate until condition is met
         * @param {Function} fn - Transform function
         * @param {*} initial - Initial value
         * @param {Function} condition - Stop condition
         * @param {Object} options - Options
         * @returns {{ value: *, iterations: number }}
         */
        iterateUntil(fn, initial, condition, options = {}) {
            const { maxIterations = 1000, onIteration = null } = options;

            let current = initial;
            let iterations = 0;

            while (iterations < maxIterations && !condition(current, iterations)) {
                current = fn(current, iterations);

                if (onIteration) {
                    onIteration(current, iterations);
                }

                iterations++;
            }

            return { value: current, iterations, satisfied: condition(current, iterations) };
        },

        /**
         * Apply function N times
         * @param {Function} fn - Transform function
         * @param {*} initial - Initial value
         * @param {number} times - Number of iterations
         * @returns {*}
         */
        times(fn, initial, times) {
            let current = initial;
            for (let i = 0; i < times; i++) {
                current = fn(current, i);
            }
            return current;
        },

        // ============================================================================
        // ACCUMULATION
        // ============================================================================

        /**
         * Reduce with history (keeps all intermediate values)
         * @param {Array} items - Items to process
         * @param {Function} reducer - Reducer function
         * @param {*} initial - Initial accumulator
         * @returns {{ result: *, history: Array }}
         */
        reduceWithHistory(items, reducer, initial) {
            const history = [initial];
            let acc = initial;

            for (let i = 0; i < items.length; i++) {
                acc = reducer(acc, items[i], i, items);
                history.push(acc);
            }

            return { result: acc, history };
        },

        /**
         * Scan (like reduce but returns all intermediate results)
         * @param {Array} items - Items to process
         * @param {Function} fn - Transform function
         * @param {*} initial - Initial value
         * @returns {Array}
         */
        scan(items, fn, initial) {
            const result = [initial];
            let acc = initial;

            for (const item of items) {
                acc = fn(acc, item);
                result.push(acc);
            }

            return result;
        },

        /**
         * Unfold (inverse of reduce)
         * @param {Function} fn - Generator function (state) => [value, nextState] | null
         * @param {*} initial - Initial state
         * @param {Object} options - Options
         * @returns {Array}
         */
        unfold(fn, initial, options = {}) {
            const { maxLength = 1000 } = options;
            const result = [];
            let state = initial;

            while (result.length < maxLength) {
                const output = fn(state);
                if (output === null) break;

                const [value, nextState] = output;
                result.push(value);
                state = nextState;
            }

            return result;
        },

        // ============================================================================
        // TREE/GRAPH TRAVERSAL
        // ============================================================================

        /**
         * Walk a tree structure
         * @param {Object} node - Root node
         * @param {Function} visitor - Visit function
         * @param {Object} options - Traversal options
         */
        walkTree(node, visitor, options = {}) {
            const {
                childrenKey = 'children',
                order = 'pre', // 'pre', 'post', 'breadth'
                maxDepth = Infinity
            } = options;

            if (order === 'breadth') {
                this._breadthFirst(node, visitor, childrenKey, maxDepth);
            } else {
                this._depthFirst(node, visitor, childrenKey, order, 0, maxDepth);
            }
        },

        /**
         * Depth-first traversal
         */
        _depthFirst(node, visitor, childrenKey, order, depth, maxDepth) {
            if (depth > maxDepth || !node) return;

            if (order === 'pre') {
                visitor(node, depth);
            }

            const children = node[childrenKey];
            if (Array.isArray(children)) {
                for (const child of children) {
                    this._depthFirst(child, visitor, childrenKey, order, depth + 1, maxDepth);
                }
            }

            if (order === 'post') {
                visitor(node, depth);
            }
        },

        /**
         * Breadth-first traversal
         */
        _breadthFirst(root, visitor, childrenKey, maxDepth) {
            const queue = [{ node: root, depth: 0 }];

            while (queue.length > 0) {
                const { node, depth } = queue.shift();

                if (depth > maxDepth) continue;

                visitor(node, depth);

                const children = node[childrenKey];
                if (Array.isArray(children)) {
                    for (const child of children) {
                        queue.push({ node: child, depth: depth + 1 });
                    }
                }
            }
        },

        /**
         * Map over a tree structure
         * @param {Object} node - Root node
         * @param {Function} mapper - Map function
         * @param {string} childrenKey - Key for children array
         * @returns {Object}
         */
        mapTree(node, mapper, childrenKey = 'children') {
            if (!node) return node;

            const mapped = mapper(node);
            const children = node[childrenKey];

            if (Array.isArray(children)) {
                return {
                    ...mapped,
                    [childrenKey]: children.map(child =>
                        this.mapTree(child, mapper, childrenKey)
                    )
                };
            }

            return mapped;
        },

        /**
         * Filter a tree structure
         * @param {Object} node - Root node
         * @param {Function} predicate - Filter predicate
         * @param {string} childrenKey - Key for children array
         * @returns {Object|null}
         */
        filterTree(node, predicate, childrenKey = 'children') {
            if (!node || !predicate(node)) return null;

            const children = node[childrenKey];

            if (Array.isArray(children)) {
                const filteredChildren = children
                    .map(child => this.filterTree(child, predicate, childrenKey))
                    .filter(child => child !== null);

                return {
                    ...node,
                    [childrenKey]: filteredChildren
                };
            }

            return node;
        },

        /**
         * Find in a tree structure
         * @param {Object} node - Root node
         * @param {Function} predicate - Find predicate
         * @param {string} childrenKey - Key for children array
         * @returns {Object|null}
         */
        findInTree(node, predicate, childrenKey = 'children') {
            if (!node) return null;
            if (predicate(node)) return node;

            const children = node[childrenKey];
            if (Array.isArray(children)) {
                for (const child of children) {
                    const found = this.findInTree(child, predicate, childrenKey);
                    if (found) return found;
                }
            }

            return null;
        },

        /**
         * Flatten a tree to an array
         * @param {Object} node - Root node
         * @param {string} childrenKey - Key for children array
         * @returns {Array}
         */
        flattenTree(node, childrenKey = 'children') {
            const result = [];

            this.walkTree(node, n => result.push(n), { childrenKey });

            return result;
        },

        // ============================================================================
        // LINEAGE TRACKING
        // ============================================================================

        /**
         * Create a lineage tracker
         * @returns {EOLineageTracker}
         */
        createLineageTracker() {
            return new EOLineageTracker();
        },

        /**
         * Track a computation with lineage
         * @param {Function} computation - Computation function
         * @param {Array} inputs - Input values
         * @param {Object} metadata - Computation metadata
         * @returns {{ result: *, lineage: Object }}
         */
        tracked(computation, inputs, metadata = {}) {
            const startTime = Date.now();
            const result = computation(...inputs);
            const endTime = Date.now();

            const lineage = {
                id: global.EOIdentity?.generate('lin') || `lin_${Date.now()}`,
                inputs: inputs.map((input, i) => ({
                    index: i,
                    type: typeof input,
                    id: input?.id || input?._id || null
                })),
                output: {
                    type: typeof result,
                    id: result?.id || result?._id || null
                },
                computation: metadata.name || 'anonymous',
                operator: metadata.operator || 'REC',
                timestamp: startTime,
                duration: endTime - startTime,
                metadata
            };

            return { result, lineage };
        },

        // ============================================================================
        // MEMOIZATION
        // ============================================================================

        /**
         * Memoize a function
         * @param {Function} fn - Function to memoize
         * @param {Object} options - Memoization options
         * @returns {Function}
         */
        memoize(fn, options = {}) {
            const {
                maxSize = 100,
                keyGenerator = JSON.stringify,
                ttl = null
            } = options;

            const cache = new Map();

            const memoized = (...args) => {
                const key = keyGenerator(args);

                if (cache.has(key)) {
                    const entry = cache.get(key);

                    // Check TTL
                    if (ttl && Date.now() - entry.timestamp > ttl) {
                        cache.delete(key);
                    } else {
                        return entry.value;
                    }
                }

                const value = fn(...args);

                // Evict oldest if at capacity
                if (cache.size >= maxSize) {
                    const oldestKey = cache.keys().next().value;
                    cache.delete(oldestKey);
                }

                cache.set(key, { value, timestamp: Date.now() });
                return value;
            };

            memoized.cache = cache;
            memoized.clear = () => cache.clear();

            return memoized;
        },

        // ============================================================================
        // RECURSIVE UTILITIES
        // ============================================================================

        /**
         * Deep clone with cycle detection
         * @param {*} value - Value to clone
         * @param {WeakMap} seen - Seen objects (internal)
         * @returns {*}
         */
        deepClone(value, seen = new WeakMap()) {
            if (value === null || typeof value !== 'object') {
                return value;
            }

            if (seen.has(value)) {
                return seen.get(value);
            }

            if (Array.isArray(value)) {
                const clone = [];
                seen.set(value, clone);
                value.forEach((item, i) => {
                    clone[i] = this.deepClone(item, seen);
                });
                return clone;
            }

            if (value instanceof Date) {
                return new Date(value);
            }

            if (value instanceof Map) {
                const clone = new Map();
                seen.set(value, clone);
                value.forEach((v, k) => {
                    clone.set(k, this.deepClone(v, seen));
                });
                return clone;
            }

            if (value instanceof Set) {
                const clone = new Set();
                seen.set(value, clone);
                value.forEach(v => {
                    clone.add(this.deepClone(v, seen));
                });
                return clone;
            }

            const clone = {};
            seen.set(value, clone);
            Object.keys(value).forEach(key => {
                clone[key] = this.deepClone(value[key], seen);
            });
            return clone;
        },

        /**
         * Deep merge objects
         * @param {Object} target - Target object
         * @param {...Object} sources - Source objects
         * @returns {Object}
         */
        deepMerge(target, ...sources) {
            if (!sources.length) return target;

            const source = sources.shift();

            if (this._isObject(target) && this._isObject(source)) {
                for (const key in source) {
                    if (this._isObject(source[key])) {
                        if (!target[key]) target[key] = {};
                        this.deepMerge(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }

            return this.deepMerge(target, ...sources);
        },

        /**
         * Check if value is a plain object
         */
        _isObject(item) {
            return item && typeof item === 'object' && !Array.isArray(item);
        }
    };

    /**
     * EOLineageTracker - Track data lineage and provenance
     */
    class EOLineageTracker {
        constructor() {
            this.nodes = new Map();  // id -> node
            this.edges = [];         // { from, to, type, metadata }
        }

        /**
         * Record a data node
         * @param {string} id - Node ID
         * @param {Object} metadata - Node metadata
         */
        addNode(id, metadata = {}) {
            this.nodes.set(id, {
                id,
                createdAt: Date.now(),
                ...metadata
            });
        }

        /**
         * Record a derivation edge
         * @param {string} fromId - Source node ID
         * @param {string} toId - Target node ID
         * @param {Object} metadata - Edge metadata
         */
        addDerivation(fromId, toId, metadata = {}) {
            this.edges.push({
                from: fromId,
                to: toId,
                type: 'derived_from',
                timestamp: Date.now(),
                ...metadata
            });
        }

        /**
         * Get ancestors of a node
         * @param {string} id - Node ID
         * @returns {string[]}
         */
        getAncestors(id) {
            const ancestors = new Set();
            const queue = [id];

            while (queue.length > 0) {
                const current = queue.shift();
                const parents = this.edges
                    .filter(e => e.to === current)
                    .map(e => e.from);

                for (const parent of parents) {
                    if (!ancestors.has(parent)) {
                        ancestors.add(parent);
                        queue.push(parent);
                    }
                }
            }

            return Array.from(ancestors);
        }

        /**
         * Get descendants of a node
         * @param {string} id - Node ID
         * @returns {string[]}
         */
        getDescendants(id) {
            const descendants = new Set();
            const queue = [id];

            while (queue.length > 0) {
                const current = queue.shift();
                const children = this.edges
                    .filter(e => e.from === current)
                    .map(e => e.to);

                for (const child of children) {
                    if (!descendants.has(child)) {
                        descendants.add(child);
                        queue.push(child);
                    }
                }
            }

            return Array.from(descendants);
        }

        /**
         * Get full lineage graph
         * @returns {{ nodes: Array, edges: Array }}
         */
        getGraph() {
            return {
                nodes: Array.from(this.nodes.values()),
                edges: [...this.edges]
            };
        }

        /**
         * Clear all lineage data
         */
        clear() {
            this.nodes.clear();
            this.edges = [];
        }
    }

    // Export to global scope
    global.EORecursion = EORecursion;
    global.EOLineageTracker = EOLineageTracker;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { EORecursion, EOLineageTracker };
    }

})(typeof window !== 'undefined' ? window : global);
