/**
 * EO Operator Executor
 * Unified execution pipeline for EO operators
 *
 * @eo_operator SYN
 * @eo_layer foundation
 *
 * This module provides a unified framework for executing EO operators
 * in a consistent, traceable, and composable manner.
 */

(function(global) {
    'use strict';

    /**
     * Operator execution step
     * @typedef {Object} EOOperatorStep
     * @property {string} operator - EO operator (NUL, DES, etc.)
     * @property {Object} params - Operator parameters
     * @property {string} [name] - Optional step name for logging
     */

    /**
     * Execution context
     * @typedef {Object} EOExecutionContext
     * @property {string} pipelineId - Unique pipeline execution ID
     * @property {number} startTime - Execution start timestamp
     * @property {Array} log - Execution log
     * @property {Object} metadata - Additional context metadata
     */

    /**
     * EOOperatorExecutor - Unified operator execution engine
     */
    class EOOperatorExecutor {
        constructor() {
            /** @type {Map<string, Function>} */
            this.handlers = new Map();

            /** @type {Array} */
            this.executionHistory = [];

            /** @type {number} */
            this.maxHistorySize = 100;

            // Register built-in handlers
            this._registerBuiltinHandlers();
        }

        /**
         * Register built-in operator handlers
         */
        _registerBuiltinHandlers() {
            // NUL - Handle absence/null
            this.registerHandler('NUL', (input, params, context) => {
                const { defaultValue = null, treatAs = 'absent' } = params;

                if (input === null || input === undefined) {
                    return treatAs === 'remove' ? undefined : defaultValue;
                }

                if (Array.isArray(input)) {
                    return input.filter(item => item !== null && item !== undefined);
                }

                return input;
            });

            // DES - Designate/name
            this.registerHandler('DES', (input, params, context) => {
                const { name, type, metadata = {} } = params;

                if (typeof input === 'object' && input !== null) {
                    return {
                        ...input,
                        _eo_designation: { name, type, ...metadata }
                    };
                }

                return { value: input, _eo_designation: { name, type, ...metadata } };
            });

            // INS - Insert/create
            this.registerHandler('INS', (input, params, context) => {
                const { target, position = 'append', key } = params;

                if (Array.isArray(target)) {
                    const result = [...target];
                    if (position === 'prepend') {
                        result.unshift(input);
                    } else {
                        result.push(input);
                    }
                    return result;
                }

                if (typeof target === 'object' && target !== null) {
                    return { ...target, [key]: input };
                }

                return input;
            });

            // SEG - Segment/filter
            this.registerHandler('SEG', (input, params, context) => {
                const { predicate, groupBy, partition } = params;

                if (!Array.isArray(input)) {
                    return predicate ? (predicate(input) ? input : null) : input;
                }

                if (groupBy) {
                    return input.reduce((acc, item) => {
                        const key = typeof groupBy === 'function' ? groupBy(item) : item[groupBy];
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(item);
                        return acc;
                    }, {});
                }

                if (partition) {
                    const pass = [];
                    const fail = [];
                    input.forEach(item => {
                        (predicate(item) ? pass : fail).push(item);
                    });
                    return { pass, fail };
                }

                return input.filter(predicate || (() => true));
            });

            // CON - Connect/relate
            this.registerHandler('CON', (input, params, context) => {
                const { field, lookup, type = 'belongs_to' } = params;

                if (!lookup || !field) return input;

                if (Array.isArray(input)) {
                    return input.map(item => {
                        const related = lookup.get?.(item[field]) || lookup[item[field]];
                        return { ...item, _eo_relation: { type, related } };
                    });
                }

                const related = lookup.get?.(input[field]) || lookup[input[field]];
                return { ...input, _eo_relation: { type, related } };
            });

            // ALT - Alternate/switch
            this.registerHandler('ALT', (input, params, context) => {
                const { cases, defaultCase, condition } = params;

                if (typeof condition === 'function') {
                    const key = condition(input);
                    const handler = cases[key] || defaultCase;
                    return typeof handler === 'function' ? handler(input) : handler ?? input;
                }

                // State machine transition
                if (params.currentState && params.transitions) {
                    const transition = params.transitions[params.currentState]?.[params.event];
                    if (transition) {
                        return {
                            ...input,
                            _eo_state: transition.target,
                            _eo_transition: {
                                from: params.currentState,
                                to: transition.target,
                                event: params.event
                            }
                        };
                    }
                }

                return input;
            });

            // SYN - Synthesize/aggregate
            this.registerHandler('SYN', (input, params, context) => {
                const { mode, field, operations = [] } = params;

                if (!Array.isArray(input)) return input;

                const values = field ? input.map(item => item[field]) : input;
                const numbers = values.filter(v => typeof v === 'number' && !isNaN(v));

                switch (mode) {
                    case 'sum':
                        return numbers.reduce((a, b) => a + b, 0);
                    case 'avg':
                    case 'average':
                        return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
                    case 'count':
                        return values.length;
                    case 'min':
                        return Math.min(...numbers);
                    case 'max':
                        return Math.max(...numbers);
                    case 'first':
                        return values[0];
                    case 'last':
                        return values[values.length - 1];
                    case 'concat':
                        return values.join(params.separator || ', ');
                    case 'unique':
                        return [...new Set(values)];
                    default:
                        return values;
                }
            });

            // SUP - Superposition (multiple values)
            this.registerHandler('SUP', (input, params, context) => {
                const { resolve, context: viewContext } = params;

                if (!Array.isArray(input)) return input;

                // Resolve superposition based on view context
                if (resolve === 'dominant' && viewContext) {
                    return input.find(v =>
                        v.context?.scale === viewContext.scale ||
                        v.context?.timeframe?.granularity === viewContext.granularity
                    ) || input[0];
                }

                if (resolve === 'first') return input[0];
                if (resolve === 'last') return input[input.length - 1];
                if (resolve === 'all') return input;

                return input;
            });

            // REC - Recurse/iterate
            this.registerHandler('REC', (input, params, context) => {
                const {
                    transform,
                    condition,
                    maxIterations = 100,
                    accumulator
                } = params;

                let current = input;
                let iterations = 0;
                let acc = accumulator;

                while (iterations < maxIterations) {
                    const next = transform(current, acc, iterations);

                    if (condition && condition(next, current, iterations)) {
                        return next;
                    }

                    // Fixed-point detection
                    if (JSON.stringify(next) === JSON.stringify(current)) {
                        return next;
                    }

                    acc = next;
                    current = next;
                    iterations++;
                }

                console.warn('[EOOperatorExecutor] REC: Max iterations reached');
                return current;
            });
        }

        /**
         * Register a custom operator handler
         * @param {string} operator - Operator name
         * @param {Function} handler - Handler function (input, params, context) => output
         */
        registerHandler(operator, handler) {
            this.handlers.set(operator.toUpperCase(), handler);
        }

        /**
         * Execute a single operator
         * @param {string} operator - Operator name
         * @param {*} input - Input value
         * @param {Object} params - Operator parameters
         * @param {EOExecutionContext} context - Execution context
         * @returns {*} Output value
         */
        executeOne(operator, input, params = {}, context = {}) {
            const handler = this.handlers.get(operator.toUpperCase());

            if (!handler) {
                console.warn(`[EOOperatorExecutor] Unknown operator: ${operator}`);
                return input;
            }

            const startTime = performance.now();

            try {
                const result = handler(input, params, context);

                const logEntry = {
                    operator,
                    params,
                    inputType: typeof input,
                    outputType: typeof result,
                    duration: performance.now() - startTime,
                    timestamp: Date.now()
                };

                if (context.log) {
                    context.log.push(logEntry);
                }

                return result;
            } catch (error) {
                console.error(`[EOOperatorExecutor] Error in ${operator}:`, error);
                throw error;
            }
        }

        /**
         * Execute a pipeline of operators
         * @param {EOOperatorStep[]} pipeline - Pipeline steps
         * @param {*} input - Initial input
         * @param {Object} metadata - Additional context metadata
         * @returns {{ result: *, context: EOExecutionContext }}
         */
        execute(pipeline, input, metadata = {}) {
            const context = {
                pipelineId: global.EOIdentity?.generate('pipe') || `pipe_${Date.now()}`,
                startTime: Date.now(),
                log: [],
                metadata
            };

            let result = input;

            for (const step of pipeline) {
                result = this.executeOne(step.operator, result, step.params, context);
            }

            context.endTime = Date.now();
            context.duration = context.endTime - context.startTime;

            // Store in history
            this._addToHistory({
                pipelineId: context.pipelineId,
                steps: pipeline.length,
                duration: context.duration,
                timestamp: context.startTime
            });

            return { result, context };
        }

        /**
         * Add to execution history
         * @param {Object} entry - History entry
         */
        _addToHistory(entry) {
            this.executionHistory.push(entry);
            if (this.executionHistory.length > this.maxHistorySize) {
                this.executionHistory.shift();
            }
        }

        /**
         * Get execution statistics
         * @returns {Object}
         */
        getStats() {
            const history = this.executionHistory;
            if (history.length === 0) {
                return { executions: 0, avgDuration: 0, avgSteps: 0 };
            }

            const totalDuration = history.reduce((sum, e) => sum + e.duration, 0);
            const totalSteps = history.reduce((sum, e) => sum + e.steps, 0);

            return {
                executions: history.length,
                avgDuration: totalDuration / history.length,
                avgSteps: totalSteps / history.length,
                lastExecution: history[history.length - 1]
            };
        }
    }

    /**
     * EOPipelineBuilder - Fluent API for building pipelines
     */
    class EOPipelineBuilder {
        constructor() {
            this.steps = [];
        }

        /**
         * Add NUL operator step
         * @param {Object} params - NUL parameters
         * @returns {EOPipelineBuilder}
         */
        nul(params = {}) {
            this.steps.push({ operator: 'NUL', params, name: params.name || 'nul' });
            return this;
        }

        /**
         * Add DES operator step
         * @param {string} name - Designation name
         * @param {string} type - Designation type
         * @returns {EOPipelineBuilder}
         */
        des(name, type) {
            this.steps.push({ operator: 'DES', params: { name, type }, name: `des:${name}` });
            return this;
        }

        /**
         * Add INS operator step
         * @param {*} target - Target to insert into
         * @param {Object} options - Insert options
         * @returns {EOPipelineBuilder}
         */
        ins(target, options = {}) {
            this.steps.push({ operator: 'INS', params: { target, ...options }, name: 'ins' });
            return this;
        }

        /**
         * Add SEG operator step
         * @param {Function|string} predicateOrField - Filter predicate or groupBy field
         * @param {string} name - Step name
         * @returns {EOPipelineBuilder}
         */
        seg(predicateOrField, name = 'seg') {
            const params = typeof predicateOrField === 'function'
                ? { predicate: predicateOrField }
                : { groupBy: predicateOrField };
            this.steps.push({ operator: 'SEG', params, name });
            return this;
        }

        /**
         * Add CON operator step
         * @param {string} field - Field to relate on
         * @param {Object|Map} lookup - Lookup table
         * @returns {EOPipelineBuilder}
         */
        con(field, lookup) {
            this.steps.push({ operator: 'CON', params: { field, lookup }, name: `con:${field}` });
            return this;
        }

        /**
         * Add ALT operator step
         * @param {Object} cases - Case handlers
         * @param {*} defaultCase - Default handler
         * @returns {EOPipelineBuilder}
         */
        alt(cases, defaultCase) {
            this.steps.push({ operator: 'ALT', params: { cases, defaultCase }, name: 'alt' });
            return this;
        }

        /**
         * Add SYN operator step
         * @param {string} mode - Aggregation mode (sum, avg, count, etc.)
         * @param {string} field - Optional field to aggregate
         * @returns {EOPipelineBuilder}
         */
        syn(mode, field = null) {
            this.steps.push({ operator: 'SYN', params: { mode, field }, name: `syn:${mode}` });
            return this;
        }

        /**
         * Add SUP operator step
         * @param {string} resolve - Resolution strategy
         * @param {Object} viewContext - View context for resolution
         * @returns {EOPipelineBuilder}
         */
        sup(resolve = 'dominant', viewContext = {}) {
            this.steps.push({ operator: 'SUP', params: { resolve, context: viewContext }, name: 'sup' });
            return this;
        }

        /**
         * Add REC operator step
         * @param {Function} transform - Transform function
         * @param {Function} condition - Stop condition
         * @returns {EOPipelineBuilder}
         */
        rec(transform, condition) {
            this.steps.push({ operator: 'REC', params: { transform, condition }, name: 'rec' });
            return this;
        }

        /**
         * Build the pipeline
         * @returns {EOOperatorStep[]}
         */
        build() {
            return [...this.steps];
        }

        /**
         * Build and execute the pipeline
         * @param {*} input - Input value
         * @param {EOOperatorExecutor} executor - Executor instance (uses default if not provided)
         * @returns {{ result: *, context: EOExecutionContext }}
         */
        run(input, executor = null) {
            const exec = executor || global.EOOperatorExecutor?.default || new EOOperatorExecutor();
            return exec.execute(this.build(), input);
        }
    }

    // Create default executor instance
    const defaultExecutor = new EOOperatorExecutor();

    // Export to global scope
    global.EOOperatorExecutor = EOOperatorExecutor;
    global.EOOperatorExecutor.default = defaultExecutor;
    global.EOPipelineBuilder = EOPipelineBuilder;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { EOOperatorExecutor, EOPipelineBuilder };
    }

})(typeof window !== 'undefined' ? window : global);
