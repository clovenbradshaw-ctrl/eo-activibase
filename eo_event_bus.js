/**
 * EO Event Bus
 * Cross-module event communication system
 *
 * Philosophy: Decoupled communication via typed events
 * Modules emit events without knowing who listens
 *
 * EO Operator: INS (Instantiate) + CON (Connect)
 */

(function(global) {
    'use strict';

    // ============================================================================
    // EVENT TYPE DEFINITIONS
    // ============================================================================

    /**
     * Standard event types for the EO system
     * Organized by domain
     */
    const EVENT_TYPES = {
        // Record events
        RECORD_CREATED: 'record:created',
        RECORD_UPDATED: 'record:updated',
        RECORD_DELETED: 'record:deleted',
        RECORD_SELECTED: 'record:selected',
        RECORD_DESELECTED: 'record:deselected',

        // Cell events
        CELL_EDITED: 'cell:edited',
        CELL_FOCUSED: 'cell:focused',
        CELL_BLURRED: 'cell:blurred',
        CELL_SUP_DETECTED: 'cell:sup_detected',

        // Set events
        SET_CREATED: 'set:created',
        SET_UPDATED: 'set:updated',
        SET_DELETED: 'set:deleted',
        SET_SWITCHED: 'set:switched',

        // View events
        VIEW_CREATED: 'view:created',
        VIEW_UPDATED: 'view:updated',
        VIEW_DELETED: 'view:deleted',
        VIEW_SWITCHED: 'view:switched',
        VIEW_DIRTY: 'view:dirty',
        VIEW_SAVED: 'view:saved',

        // Field/Schema events
        FIELD_CREATED: 'field:created',
        FIELD_UPDATED: 'field:updated',
        FIELD_DELETED: 'field:deleted',
        FIELD_REORDERED: 'field:reordered',

        // Import events
        IMPORT_STARTED: 'import:started',
        IMPORT_PROGRESS: 'import:progress',
        IMPORT_COMPLETED: 'import:completed',
        IMPORT_FAILED: 'import:failed',

        // Toss pile events
        TOSS_RECORD: 'toss:record',
        TOSS_RECORDS: 'toss:records',
        TOSS_COLUMN: 'toss:column',
        TOSS_CELL: 'toss:cell',
        PICKUP_ENTRY: 'pickup:entry',
        PICKUP_ACTION: 'pickup:action',

        // Relationship events
        RELATIONSHIP_CREATED: 'relationship:created',
        RELATIONSHIP_UPDATED: 'relationship:updated',
        RELATIONSHIP_DELETED: 'relationship:deleted',

        // Context events
        CONTEXT_INFERRED: 'context:inferred',
        CONTEXT_UPDATED: 'context:updated',
        STABILITY_CHANGED: 'stability:changed',

        // UI events
        MODAL_OPENED: 'modal:opened',
        MODAL_CLOSED: 'modal:closed',
        PANEL_TOGGLED: 'panel:toggled',
        SEARCH_QUERY: 'search:query',
        SEARCH_RESULTS: 'search:results',

        // System events
        STATE_RESET: 'state:reset',
        STATE_IMPORTED: 'state:imported',
        STATE_EXPORTED: 'state:exported',
        ERROR_OCCURRED: 'error:occurred',
        RHYTHM_TICK: 'rhythm:tick'
    };

    // ============================================================================
    // EVENT BUS CLASS
    // ============================================================================

    class EOEventBus {
        constructor(options = {}) {
            this._handlers = new Map();
            this._onceHandlers = new Map();
            this._wildcardHandlers = new Set();
            this._handlerId = 0;
            this._eventLog = [];
            this._maxLogSize = options.maxLogSize || 1000;
            this._debug = options.debug || false;
            this._paused = false;
            this._eventQueue = [];

            // Middleware chain
            this._middleware = [];
        }

        /**
         * Register an event handler
         * @param {string} eventType - Event type to listen for
         * @param {Function} handler - Handler function
         * @param {Object} options - Options (priority, context)
         * @returns {Function} Unsubscribe function
         */
        on(eventType, handler, options = {}) {
            const id = ++this._handlerId;
            const entry = {
                id,
                handler,
                priority: options.priority || 0,
                context: options.context || null,
                addedAt: Date.now()
            };

            if (!this._handlers.has(eventType)) {
                this._handlers.set(eventType, []);
            }

            const handlers = this._handlers.get(eventType);
            handlers.push(entry);

            // Sort by priority (higher first)
            handlers.sort((a, b) => b.priority - a.priority);

            if (this._debug) {
                console.log(`[EOEventBus] Registered handler for "${eventType}" (id: ${id})`);
            }

            // Return unsubscribe function
            return () => this.off(eventType, id);
        }

        /**
         * Register a one-time event handler
         */
        once(eventType, handler, options = {}) {
            const id = ++this._handlerId;
            const entry = {
                id,
                handler,
                priority: options.priority || 0,
                context: options.context || null
            };

            if (!this._onceHandlers.has(eventType)) {
                this._onceHandlers.set(eventType, []);
            }

            this._onceHandlers.get(eventType).push(entry);

            return () => {
                const handlers = this._onceHandlers.get(eventType);
                if (handlers) {
                    const index = handlers.findIndex(h => h.id === id);
                    if (index >= 0) handlers.splice(index, 1);
                }
            };
        }

        /**
         * Register a wildcard handler (receives all events)
         */
        onAny(handler, options = {}) {
            const id = ++this._handlerId;
            const entry = { id, handler, context: options.context || null };
            this._wildcardHandlers.add(entry);

            return () => this._wildcardHandlers.delete(entry);
        }

        /**
         * Remove an event handler by ID
         */
        off(eventType, handlerId) {
            const handlers = this._handlers.get(eventType);
            if (handlers) {
                const index = handlers.findIndex(h => h.id === handlerId);
                if (index >= 0) {
                    handlers.splice(index, 1);
                    if (this._debug) {
                        console.log(`[EOEventBus] Removed handler for "${eventType}" (id: ${handlerId})`);
                    }
                    return true;
                }
            }
            return false;
        }

        /**
         * Remove all handlers for an event type
         */
        offAll(eventType) {
            if (eventType) {
                this._handlers.delete(eventType);
                this._onceHandlers.delete(eventType);
            } else {
                this._handlers.clear();
                this._onceHandlers.clear();
                this._wildcardHandlers.clear();
            }
        }

        /**
         * Emit an event
         * @param {string} eventType - Event type
         * @param {Object} data - Event data
         * @param {Object} options - Emit options
         */
        emit(eventType, data = {}, options = {}) {
            const event = {
                type: eventType,
                data,
                timestamp: Date.now(),
                source: options.source || 'unknown',
                id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
            };

            // If paused, queue the event
            if (this._paused && !options.force) {
                this._eventQueue.push(event);
                return event;
            }

            // Run through middleware
            let processedEvent = event;
            for (const middleware of this._middleware) {
                processedEvent = middleware(processedEvent);
                if (!processedEvent) {
                    if (this._debug) {
                        console.log(`[EOEventBus] Event "${eventType}" blocked by middleware`);
                    }
                    return null; // Event was blocked
                }
            }

            // Log event
            this._logEvent(processedEvent);

            if (this._debug) {
                console.log(`[EOEventBus] Emitting "${eventType}"`, processedEvent.data);
            }

            // Call regular handlers
            const handlers = this._handlers.get(eventType) || [];
            handlers.forEach(entry => {
                try {
                    const context = entry.context || global;
                    entry.handler.call(context, processedEvent.data, processedEvent);
                } catch (err) {
                    console.error(`[EOEventBus] Handler error for "${eventType}":`, err);
                    this.emit(EVENT_TYPES.ERROR_OCCURRED, {
                        source: 'event_handler',
                        eventType,
                        error: err.message
                    });
                }
            });

            // Call once handlers
            const onceHandlers = this._onceHandlers.get(eventType) || [];
            onceHandlers.forEach(entry => {
                try {
                    const context = entry.context || global;
                    entry.handler.call(context, processedEvent.data, processedEvent);
                } catch (err) {
                    console.error(`[EOEventBus] Once handler error for "${eventType}":`, err);
                }
            });
            this._onceHandlers.delete(eventType);

            // Call wildcard handlers
            this._wildcardHandlers.forEach(entry => {
                try {
                    const context = entry.context || global;
                    entry.handler.call(context, processedEvent.data, processedEvent, eventType);
                } catch (err) {
                    console.error(`[EOEventBus] Wildcard handler error:`, err);
                }
            });

            return processedEvent;
        }

        /**
         * Emit multiple events in sequence
         */
        emitBatch(events) {
            return events.map(({ type, data, options }) => this.emit(type, data, options));
        }

        /**
         * Emit with promise (waits for async handlers)
         */
        async emitAsync(eventType, data = {}, options = {}) {
            const event = this.emit(eventType, data, options);
            if (!event) return null;

            const handlers = this._handlers.get(eventType) || [];
            const promises = handlers.map(entry => {
                try {
                    const result = entry.handler(event.data, event);
                    return result instanceof Promise ? result : Promise.resolve(result);
                } catch (err) {
                    return Promise.reject(err);
                }
            });

            await Promise.allSettled(promises);
            return event;
        }

        /**
         * Add middleware to event processing chain
         */
        use(middleware) {
            this._middleware.push(middleware);
            return () => {
                const index = this._middleware.indexOf(middleware);
                if (index >= 0) this._middleware.splice(index, 1);
            };
        }

        /**
         * Pause event emission (queue events)
         */
        pause() {
            this._paused = true;
        }

        /**
         * Resume event emission (flush queue)
         */
        resume() {
            this._paused = false;

            // Flush queued events
            while (this._eventQueue.length > 0) {
                const event = this._eventQueue.shift();
                this.emit(event.type, event.data, { source: event.source });
            }
        }

        /**
         * Log event to history
         */
        _logEvent(event) {
            this._eventLog.push({
                type: event.type,
                timestamp: event.timestamp,
                id: event.id,
                source: event.source
            });

            // Limit log size
            if (this._eventLog.length > this._maxLogSize) {
                this._eventLog.shift();
            }
        }

        /**
         * Get event log
         */
        getLog(filter = {}) {
            let log = this._eventLog;

            if (filter.type) {
                log = log.filter(e => e.type === filter.type);
            }

            if (filter.since) {
                log = log.filter(e => e.timestamp >= filter.since);
            }

            if (filter.limit) {
                log = log.slice(-filter.limit);
            }

            return log;
        }

        /**
         * Clear event log
         */
        clearLog() {
            this._eventLog = [];
        }

        /**
         * Get handler count for event type
         */
        listenerCount(eventType) {
            const handlers = this._handlers.get(eventType) || [];
            const onceHandlers = this._onceHandlers.get(eventType) || [];
            return handlers.length + onceHandlers.length;
        }

        /**
         * Get all registered event types
         */
        eventNames() {
            return Array.from(new Set([
                ...this._handlers.keys(),
                ...this._onceHandlers.keys()
            ]));
        }

        /**
         * Check if event type has handlers
         */
        hasListeners(eventType) {
            return this.listenerCount(eventType) > 0;
        }

        /**
         * Get statistics
         */
        getStats() {
            let totalHandlers = 0;
            this._handlers.forEach(handlers => totalHandlers += handlers.length);
            this._onceHandlers.forEach(handlers => totalHandlers += handlers.length);

            return {
                eventTypes: this._handlers.size,
                totalHandlers,
                wildcardHandlers: this._wildcardHandlers.size,
                logSize: this._eventLog.length,
                middlewareCount: this._middleware.length,
                paused: this._paused,
                queuedEvents: this._eventQueue.length
            };
        }

        /**
         * Enable debug mode
         */
        debug(enabled = true) {
            this._debug = enabled;
            return this;
        }

        /**
         * Create a scoped event emitter for a module
         */
        createScope(moduleName) {
            const bus = this;
            return {
                emit(eventType, data, options = {}) {
                    return bus.emit(eventType, data, { ...options, source: moduleName });
                },
                on(eventType, handler, options) {
                    return bus.on(eventType, handler, options);
                },
                once(eventType, handler, options) {
                    return bus.once(eventType, handler, options);
                },
                off(eventType, handlerId) {
                    return bus.off(eventType, handlerId);
                }
            };
        }
    }

    // ============================================================================
    // RHYTHM MANAGER (ALT Operator)
    // ============================================================================

    /**
     * Manages operational rhythms (periodic events)
     */
    class RhythmManager {
        constructor(eventBus) {
            this._eventBus = eventBus;
            this._rhythms = new Map();
            this._rhythmId = 0;
        }

        /**
         * Create a rhythm (periodic event emission)
         * @param {string} name - Rhythm name
         * @param {number} interval - Interval in ms
         * @param {Function} tickHandler - Function to call on each tick
         * @returns {Object} Rhythm control object
         */
        create(name, interval, tickHandler) {
            const id = ++this._rhythmId;

            const rhythm = {
                id,
                name,
                interval,
                tickHandler,
                tickCount: 0,
                startedAt: null,
                lastTick: null,
                timer: null,
                running: false
            };

            this._rhythms.set(id, rhythm);

            return {
                start: () => this.start(id),
                stop: () => this.stop(id),
                restart: () => this.restart(id),
                getStats: () => this.getRhythmStats(id)
            };
        }

        /**
         * Start a rhythm
         */
        start(rhythmId) {
            const rhythm = this._rhythms.get(rhythmId);
            if (!rhythm || rhythm.running) return false;

            rhythm.running = true;
            rhythm.startedAt = Date.now();

            const tick = () => {
                if (!rhythm.running) return;

                rhythm.tickCount++;
                rhythm.lastTick = Date.now();

                // Call handler
                try {
                    const result = rhythm.tickHandler(rhythm.tickCount, rhythm);

                    // Emit rhythm event
                    this._eventBus.emit(EVENT_TYPES.RHYTHM_TICK, {
                        rhythmId,
                        name: rhythm.name,
                        tickCount: rhythm.tickCount,
                        result
                    }, { source: 'rhythm_manager' });
                } catch (err) {
                    console.error(`[RhythmManager] Tick error for "${rhythm.name}":`, err);
                }

                // Schedule next tick
                rhythm.timer = setTimeout(tick, rhythm.interval);
            };

            // Initial tick after interval
            rhythm.timer = setTimeout(tick, rhythm.interval);

            return true;
        }

        /**
         * Stop a rhythm
         */
        stop(rhythmId) {
            const rhythm = this._rhythms.get(rhythmId);
            if (!rhythm) return false;

            rhythm.running = false;
            if (rhythm.timer) {
                clearTimeout(rhythm.timer);
                rhythm.timer = null;
            }

            return true;
        }

        /**
         * Restart a rhythm
         */
        restart(rhythmId) {
            this.stop(rhythmId);
            const rhythm = this._rhythms.get(rhythmId);
            if (rhythm) {
                rhythm.tickCount = 0;
            }
            return this.start(rhythmId);
        }

        /**
         * Stop all rhythms
         */
        stopAll() {
            this._rhythms.forEach((_, id) => this.stop(id));
        }

        /**
         * Get rhythm statistics
         */
        getRhythmStats(rhythmId) {
            const rhythm = this._rhythms.get(rhythmId);
            if (!rhythm) return null;

            return {
                id: rhythm.id,
                name: rhythm.name,
                interval: rhythm.interval,
                running: rhythm.running,
                tickCount: rhythm.tickCount,
                startedAt: rhythm.startedAt,
                lastTick: rhythm.lastTick,
                uptime: rhythm.startedAt ? Date.now() - rhythm.startedAt : 0
            };
        }

        /**
         * Get all rhythm statistics
         */
        getAllStats() {
            const stats = [];
            this._rhythms.forEach((_, id) => {
                stats.push(this.getRhythmStats(id));
            });
            return stats;
        }
    }

    // ============================================================================
    // SINGLETON INSTANCE
    // ============================================================================

    let _busInstance = null;
    let _rhythmInstance = null;

    function getEventBus() {
        if (!_busInstance) {
            _busInstance = new EOEventBus();
        }
        return _busInstance;
    }

    function getRhythmManager() {
        if (!_rhythmInstance) {
            _rhythmInstance = new RhythmManager(getEventBus());
        }
        return _rhythmInstance;
    }

    function initEventBus(options = {}) {
        _busInstance = new EOEventBus(options);
        _rhythmInstance = new RhythmManager(_busInstance);
        return { bus: _busInstance, rhythms: _rhythmInstance };
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOEventBusModule = {
        // Classes
        EventBus: EOEventBus,
        RhythmManager,

        // Event types
        EVENTS: EVENT_TYPES,

        // Singleton accessors
        getBus: getEventBus,
        getRhythms: getRhythmManager,
        init: initEventBus,

        // Convenience methods (delegate to singleton)
        on: (...args) => getEventBus().on(...args),
        once: (...args) => getEventBus().once(...args),
        emit: (...args) => getEventBus().emit(...args),
        off: (...args) => getEventBus().off(...args)
    };

    // Export to global scope
    global.EOEventBus = EOEventBusModule;
    global.EO_EVENTS = EVENT_TYPES;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOEventBusModule;
    }

})(typeof window !== 'undefined' ? window : global);
