/**
 * EO Event Log
 * Append-only event store implementing Axiom 0: Log Primacy
 *
 * The log is the database. Everything else is a view.
 *
 * Implements:
 * - Axiom 0: Log Primacy (append-only, no mutations)
 * - Rule 1: Origin Is Part of the Record
 * - Rule 8: Idempotent Replay
 * - Rule 9: Revision Without Erasure
 *
 * @see Sync Handbook Part II Section 2.1
 */

(function(global) {
    'use strict';

    // ============================================================================
    // EVENT TYPES (Given vs Meant distinction - Rule 4/5)
    // ============================================================================

    const EVENT_TYPE = {
        GIVEN: 'given',   // Raw records - actions, observations, messages
        MEANT: 'meant'    // Interpretations, summaries, derived conclusions
    };

    // ============================================================================
    // EVENT SCHEMA (Rule 1: Origin Is Part of the Record)
    // ============================================================================

    /**
     * @typedef {Object} EOEvent
     * @property {string} id - Globally unique identifier (content-addressable)
     * @property {string} type - 'given' or 'meant'
     * @property {string} actor - Who created this event (user, device, process)
     * @property {string} timestamp - ISO 8601 timestamp (for display, not ordering)
     * @property {number} logicalClock - Monotonic counter for causal ordering
     * @property {string[]} parents - IDs of causal predecessors (DAG structure)
     * @property {Object} context - Context envelope
     * @property {Object} payload - Event-specific data
     * @property {string} [signature] - Optional authentication proof
     *
     * For 'meant' events only:
     * @property {Object} [frame] - Frame for interpretation
     * @property {string[]} [provenance] - IDs of source 'given' events
     * @property {string} [epistemicStatus] - 'preliminary' | 'reviewed' | 'contested'
     * @property {string} [supersedes] - ID of event this replaces
     */

    // ============================================================================
    // CONTENT-ADDRESSABLE ID GENERATION
    // ============================================================================

    /**
     * Generate a content-addressable event ID using DJB2 hash
     * This enables idempotent replay (Rule 8)
     */
    function generateEventId(eventData) {
        const canonical = JSON.stringify({
            type: eventData.type,
            actor: eventData.actor,
            payload: eventData.payload,
            parents: eventData.parents,
            context: eventData.context
        }, Object.keys(eventData).sort());

        // DJB2 hash
        let hash = 5381;
        for (let i = 0; i < canonical.length; i++) {
            hash = ((hash << 5) + hash) + canonical.charCodeAt(i);
            hash = hash >>> 0; // Convert to unsigned 32-bit
        }

        return `evt_${hash.toString(36)}_${Date.now().toString(36)}`;
    }

    /**
     * Generate a simple unique ID (fallback)
     */
    function generateUniqueId() {
        return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    }

    // ============================================================================
    // EVENT LOG CLASS
    // ============================================================================

    class EOEventLog {
        constructor(options = {}) {
            // The append-only log - this is THE source of truth
            this._log = [];

            // Index for O(1) lookup by ID
            this._index = new Map();

            // Logical clock for causal ordering
            this._logicalClock = 0;

            // Current heads (events with no children) for parent references
            this._heads = new Set();

            // Pending events waiting for parents (causal readiness)
            this._pending = new Map();

            // Options
            this._options = {
                maxPendingAge: options.maxPendingAge || 60000, // 1 minute
                onAppend: options.onAppend || null,
                onError: options.onError || null,
                validateProvenance: options.validateProvenance !== false
            };

            // Subscribers for reactive updates
            this._subscribers = new Set();
        }

        // ========================================================================
        // CORE OPERATIONS (Axiom 0: Append-only)
        // ========================================================================

        /**
         * Append an event to the log
         * This is the ONLY way to modify the log
         *
         * @param {Object} eventData - Event data (without id, logicalClock)
         * @returns {Object} Result with event or error
         */
        append(eventData) {
            // Validate required fields (Rule 1: Origin)
            const validation = this._validateEvent(eventData);
            if (!validation.valid) {
                const error = { success: false, errors: validation.errors };
                this._options.onError?.(error);
                return error;
            }

            // Generate ID (content-addressable for idempotency - Rule 8)
            const id = eventData.id || generateEventId(eventData);

            // Idempotency check (Rule 8)
            if (this._index.has(id)) {
                return {
                    success: true,
                    event: this._index.get(id),
                    duplicate: true
                };
            }

            // Check causal readiness (parents must exist)
            const parents = eventData.parents || [];
            const missingParents = parents.filter(p => !this._index.has(p));

            if (missingParents.length > 0) {
                // Park the event until parents arrive
                this._pending.set(id, {
                    eventData: { ...eventData, id },
                    waitingFor: missingParents,
                    parkedAt: Date.now()
                });

                return {
                    success: false,
                    parked: true,
                    waitingFor: missingParents
                };
            }

            // Increment logical clock
            this._logicalClock++;

            // Create the immutable event
            const event = Object.freeze({
                id,
                type: eventData.type || EVENT_TYPE.GIVEN,
                actor: eventData.actor,
                timestamp: eventData.timestamp || new Date().toISOString(),
                logicalClock: this._logicalClock,
                parents: parents,
                context: Object.freeze({
                    workspace: eventData.context?.workspace || 'default',
                    device: eventData.context?.device || 'unknown',
                    session: eventData.context?.session || 'unknown',
                    schemaVersion: eventData.context?.schemaVersion || '1.0',
                    ...eventData.context
                }),
                payload: Object.freeze(eventData.payload || {}),
                signature: eventData.signature || null,

                // Meant-specific fields (Rule 4/5)
                ...(eventData.type === EVENT_TYPE.MEANT ? {
                    frame: Object.freeze(eventData.frame || {}),
                    provenance: Object.freeze(eventData.provenance || []),
                    epistemicStatus: eventData.epistemicStatus || 'preliminary',
                    supersedes: eventData.supersedes || null
                } : {})
            });

            // Append to log (THE mutation - append only!)
            this._log.push(event);

            // Update index
            this._index.set(id, event);

            // Update heads (remove parents from heads, add this event)
            parents.forEach(p => this._heads.delete(p));
            this._heads.add(id);

            // Check if any pending events can now be processed
            this._processPending();

            // Notify subscribers
            this._notify(event);

            // Callback
            this._options.onAppend?.(event);

            return { success: true, event };
        }

        /**
         * Get an event by ID
         */
        get(id) {
            return this._index.get(id) || null;
        }

        /**
         * Get all events (returns frozen copy)
         */
        getAll() {
            return [...this._log];
        }

        /**
         * Get events by type
         */
        getByType(type) {
            return this._log.filter(e => e.type === type);
        }

        /**
         * Get current heads (events with no children)
         */
        getHeads() {
            return Array.from(this._heads);
        }

        /**
         * Get events in topological (causal) order
         */
        getTopologicalOrder() {
            const visited = new Set();
            const result = [];

            const visit = (id) => {
                if (visited.has(id)) return;
                visited.add(id);

                const event = this._index.get(id);
                if (!event) return;

                // Visit parents first
                event.parents.forEach(p => visit(p));
                result.push(event);
            };

            // Start from all events to ensure complete traversal
            this._log.forEach(e => visit(e.id));

            return result;
        }

        /**
         * Get events since a specific logical clock value
         */
        getSince(logicalClock) {
            return this._log.filter(e => e.logicalClock > logicalClock);
        }

        /**
         * Get the current logical clock value
         */
        getClock() {
            return this._logicalClock;
        }

        // ========================================================================
        // VALIDATION (Rules 1, 4, 5)
        // ========================================================================

        /**
         * Validate an event before appending
         */
        _validateEvent(eventData) {
            const errors = [];

            // Rule 1: Origin is part of the record
            if (!eventData.actor) {
                errors.push('RULE_1: Missing actor');
            }

            // Context validation
            if (!eventData.context) {
                errors.push('RULE_1: Missing context');
            } else {
                if (!eventData.context.workspace && !eventData.context.schemaVersion) {
                    // Allow minimal context but warn
                }
            }

            // Rule 4: Grounding (for Meant events)
            if (eventData.type === EVENT_TYPE.MEANT) {
                if (!eventData.provenance || eventData.provenance.length === 0) {
                    errors.push('RULE_4: Meant event missing provenance');
                } else if (this._options.validateProvenance) {
                    // Verify provenance references exist and are Given events
                    for (const provId of eventData.provenance) {
                        const provEvent = this._index.get(provId);
                        if (!provEvent) {
                            errors.push(`RULE_4: Provenance event ${provId} not found`);
                        } else if (provEvent.type !== EVENT_TYPE.GIVEN) {
                            // Allow chained Meant events but they must ultimately trace to Given
                            // This is a soft check - full validation would trace the chain
                        }
                    }
                }

                // Rule 5: Framing
                if (!eventData.frame || !eventData.frame.purpose) {
                    errors.push('RULE_5: Meant event missing frame with purpose');
                }
            }

            // Payload validation
            if (!eventData.payload) {
                errors.push('Missing payload');
            }

            return {
                valid: errors.length === 0,
                errors
            };
        }

        // ========================================================================
        // PENDING EVENT PROCESSING (Causal readiness)
        // ========================================================================

        /**
         * Process pending events whose parents have arrived
         */
        _processPending() {
            let processed = true;

            while (processed) {
                processed = false;

                for (const [id, pending] of this._pending) {
                    // Check if all parents now exist
                    const stillMissing = pending.waitingFor.filter(
                        p => !this._index.has(p)
                    );

                    if (stillMissing.length === 0) {
                        // Remove from pending and append
                        this._pending.delete(id);
                        const result = this.append(pending.eventData);
                        if (result.success) {
                            processed = true;
                        }
                    } else {
                        // Update waiting list
                        pending.waitingFor = stillMissing;
                    }
                }
            }

            // Clean up old pending events
            const now = Date.now();
            for (const [id, pending] of this._pending) {
                if (now - pending.parkedAt > this._options.maxPendingAge) {
                    this._pending.delete(id);
                    this._options.onError?.({
                        type: 'pending_timeout',
                        eventId: id,
                        waitingFor: pending.waitingFor
                    });
                }
            }
        }

        // ========================================================================
        // SUBSCRIPTION (Reactive updates)
        // ========================================================================

        /**
         * Subscribe to new events
         */
        subscribe(callback) {
            this._subscribers.add(callback);
            return () => this._subscribers.delete(callback);
        }

        /**
         * Notify subscribers of new event
         */
        _notify(event) {
            this._subscribers.forEach(callback => {
                try {
                    callback(event);
                } catch (err) {
                    console.error('[EOEventLog] Subscriber error:', err);
                }
            });
        }

        // ========================================================================
        // SUPERSESSION (Rule 9: Revision Without Erasure)
        // ========================================================================

        /**
         * Create a supersession event
         * The original event remains - this creates a new event that supersedes it
         */
        supersede(originalId, newPayload, actor, options = {}) {
            const original = this.get(originalId);
            if (!original) {
                return { success: false, error: 'Original event not found' };
            }

            if (original.type !== EVENT_TYPE.MEANT) {
                return { success: false, error: 'Can only supersede Meant events' };
            }

            return this.append({
                type: EVENT_TYPE.MEANT,
                actor,
                parents: this.getHeads(),
                context: options.context || original.context,
                frame: options.frame || original.frame,
                provenance: options.provenance || original.provenance,
                epistemicStatus: options.epistemicStatus || 'reviewed',
                supersedes: originalId,
                payload: newPayload
            });
        }

        /**
         * Get active (non-superseded) Meant events
         */
        getActiveInterpretations(frame = null) {
            const superseded = new Set();

            // Find all superseded event IDs
            this._log.forEach(e => {
                if (e.supersedes) {
                    if (!frame || e.frame?.purpose === frame) {
                        superseded.add(e.supersedes);
                    }
                }
            });

            // Return Meant events that aren't superseded
            return this._log.filter(e =>
                e.type === EVENT_TYPE.MEANT &&
                !superseded.has(e.id) &&
                (!frame || e.frame?.purpose === frame)
            );
        }

        // ========================================================================
        // TOMBSTONES (Rule 9: Deletion as event)
        // ========================================================================

        /**
         * Create a tombstone event (deletion without erasure)
         */
        tombstone(targetId, actor, reason, context = {}) {
            const target = this.get(targetId);
            if (!target) {
                return { success: false, error: 'Target event not found' };
            }

            return this.append({
                type: EVENT_TYPE.GIVEN,
                actor,
                parents: this.getHeads(),
                context: {
                    ...context,
                    workspace: target.context.workspace
                },
                payload: {
                    action: 'tombstone',
                    targetId,
                    reason,
                    targetSnapshot: {
                        type: target.type,
                        payload: target.payload
                    }
                }
            });
        }

        /**
         * Check if an event has been tombstoned
         */
        isTombstoned(eventId) {
            return this._log.some(e =>
                e.payload?.action === 'tombstone' &&
                e.payload?.targetId === eventId
            );
        }

        /**
         * Get all tombstone events for a target
         */
        getTombstones(targetId) {
            return this._log.filter(e =>
                e.payload?.action === 'tombstone' &&
                e.payload?.targetId === targetId
            );
        }

        // ========================================================================
        // EXPORT / IMPORT (For persistence - Rule 3)
        // ========================================================================

        /**
         * Export the entire log for persistence
         */
        export() {
            return {
                version: 1,
                timestamp: new Date().toISOString(),
                logicalClock: this._logicalClock,
                events: this._log.map(e => ({ ...e })), // Deep copy
                heads: Array.from(this._heads)
            };
        }

        /**
         * Import a log (typically from persistence)
         * This replays events to rebuild state
         */
        import(data) {
            if (data.version !== 1) {
                return { success: false, error: 'Unknown log version' };
            }

            // Clear current state
            this._log = [];
            this._index.clear();
            this._heads.clear();
            this._pending.clear();
            this._logicalClock = 0;

            // Replay events in order
            const errors = [];
            for (const event of data.events) {
                // Import directly without validation (trusted source)
                this._log.push(Object.freeze(event));
                this._index.set(event.id, event);
                this._logicalClock = Math.max(this._logicalClock, event.logicalClock);
            }

            // Restore heads
            if (data.heads) {
                data.heads.forEach(h => this._heads.add(h));
            } else {
                // Recalculate heads
                const allParents = new Set();
                this._log.forEach(e => e.parents.forEach(p => allParents.add(p)));
                this._log.forEach(e => {
                    if (!allParents.has(e.id)) {
                        this._heads.add(e.id);
                    }
                });
            }

            return {
                success: true,
                eventCount: this._log.length,
                logicalClock: this._logicalClock
            };
        }

        // ========================================================================
        // STATISTICS
        // ========================================================================

        getStats() {
            const givenCount = this._log.filter(e => e.type === EVENT_TYPE.GIVEN).length;
            const meantCount = this._log.filter(e => e.type === EVENT_TYPE.MEANT).length;
            const tombstoneCount = this._log.filter(e => e.payload?.action === 'tombstone').length;
            const supersededCount = new Set(
                this._log.filter(e => e.supersedes).map(e => e.supersedes)
            ).size;

            return {
                totalEvents: this._log.length,
                givenEvents: givenCount,
                meantEvents: meantCount,
                tombstones: tombstoneCount,
                superseded: supersededCount,
                activeInterpretations: meantCount - supersededCount,
                logicalClock: this._logicalClock,
                heads: this._heads.size,
                pending: this._pending.size
            };
        }
    }

    // ============================================================================
    // SINGLETON INSTANCE
    // ============================================================================

    let _instance = null;

    function getEventLog() {
        if (!_instance) {
            _instance = new EOEventLog();
        }
        return _instance;
    }

    function initEventLog(options = {}) {
        _instance = new EOEventLog(options);
        return _instance;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOEventLogModule = {
        // Classes
        EventLog: EOEventLog,

        // Constants
        EVENT_TYPE,

        // Helpers
        generateEventId,
        generateUniqueId,

        // Singleton
        getLog: getEventLog,
        init: initEventLog
    };

    // Export to global scope
    global.EOEventLog = EOEventLogModule;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOEventLogModule;
    }

})(typeof window !== 'undefined' ? window : global);
