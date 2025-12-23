/**
 * EO Sync Protocol
 * Event-based synchronization between clients/servers
 *
 * Implements:
 * - Rule 2: Identity Must Not Be Laundered (actor preserved)
 * - Rule 4: Non-Collapse of Concurrency (conflicts detected, not hidden)
 * - Rule 6: Operations, Not Snapshots (sync events, not state)
 * - Rule 7: Failure Is a State (failures recorded as events)
 *
 * Protocol messages:
 * - SCOPE: Negotiate session parameters
 * - INV: Advertise what you have (heads, bloom filter)
 * - HAVE: Declare possession of specific events
 * - WANT: Request specific events
 * - SEND: Transfer events
 * - REFUSE: Decline with reason
 *
 * @see Sync Handbook Part III Section 3.4
 */

(function(global) {
    'use strict';

    // ============================================================================
    // PROTOCOL MESSAGE TYPES
    // ============================================================================

    const MESSAGE_TYPE = {
        SCOPE: 'scope',
        SCOPE_ACK: 'scope_ack',
        INV: 'inv',
        HAVE: 'have',
        WANT: 'want',
        SEND: 'send',
        ACK: 'ack',
        REFUSE: 'refuse',
        CONFLICT: 'conflict'
    };

    // ============================================================================
    // CONFLICT TYPES
    // ============================================================================

    const CONFLICT_TYPE = {
        CONCURRENT_EDIT: 'concurrent_edit',      // Same field edited concurrently
        DIVERGENT_HISTORY: 'divergent_history',  // Different branches of history
        SCHEMA_MISMATCH: 'schema_mismatch'       // Schema version conflict
    };

    // ============================================================================
    // BLOOM FILTER (For efficient set reconciliation)
    // ============================================================================

    class BloomFilter {
        constructor(size = 1024, hashCount = 3) {
            this._size = size;
            this._hashCount = hashCount;
            this._bits = new Uint8Array(Math.ceil(size / 8));
        }

        _hash(str, seed) {
            let hash = seed;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
                hash = hash >>> 0;
            }
            return hash % this._size;
        }

        add(item) {
            const str = typeof item === 'string' ? item : JSON.stringify(item);
            for (let i = 0; i < this._hashCount; i++) {
                const bit = this._hash(str, i * 0x9E3779B9);
                this._bits[Math.floor(bit / 8)] |= (1 << (bit % 8));
            }
        }

        mightContain(item) {
            const str = typeof item === 'string' ? item : JSON.stringify(item);
            for (let i = 0; i < this._hashCount; i++) {
                const bit = this._hash(str, i * 0x9E3779B9);
                if (!(this._bits[Math.floor(bit / 8)] & (1 << (bit % 8)))) {
                    return false;
                }
            }
            return true;
        }

        export() {
            return {
                size: this._size,
                hashCount: this._hashCount,
                bits: Array.from(this._bits)
            };
        }

        static import(data) {
            const filter = new BloomFilter(data.size, data.hashCount);
            filter._bits = new Uint8Array(data.bits);
            return filter;
        }
    }

    // ============================================================================
    // VECTOR CLOCK (For causal ordering)
    // ============================================================================

    class VectorClock {
        constructor(nodeId, clock = {}) {
            this._nodeId = nodeId;
            this._clock = { ...clock };
        }

        increment() {
            this._clock[this._nodeId] = (this._clock[this._nodeId] || 0) + 1;
            return this;
        }

        merge(other) {
            const otherClock = other instanceof VectorClock ? other._clock : other;
            for (const [node, time] of Object.entries(otherClock)) {
                this._clock[node] = Math.max(this._clock[node] || 0, time);
            }
            return this;
        }

        get(nodeId) {
            return this._clock[nodeId] || 0;
        }

        export() {
            return { ...this._clock };
        }

        /**
         * Compare two vector clocks
         * Returns: 'before' | 'after' | 'concurrent' | 'equal'
         */
        compare(other) {
            const otherClock = other instanceof VectorClock ? other._clock : other;
            const allNodes = new Set([
                ...Object.keys(this._clock),
                ...Object.keys(otherClock)
            ]);

            let thisBefore = false;
            let thisAfter = false;

            for (const node of allNodes) {
                const thisTime = this._clock[node] || 0;
                const otherTime = otherClock[node] || 0;

                if (thisTime < otherTime) thisBefore = true;
                if (thisTime > otherTime) thisAfter = true;
            }

            if (thisBefore && thisAfter) return 'concurrent';
            if (thisBefore) return 'before';
            if (thisAfter) return 'after';
            return 'equal';
        }

        /**
         * Check if two clocks are concurrent (neither causally precedes)
         */
        isConcurrent(other) {
            return this.compare(other) === 'concurrent';
        }
    }

    // ============================================================================
    // SYNC SESSION
    // ============================================================================

    /**
     * Represents a sync session between two nodes
     */
    class SyncSession {
        constructor(localLog, options = {}) {
            this._localLog = localLog;
            this._options = {
                nodeId: options.nodeId || this._generateNodeId(),
                workspace: options.workspace || 'default',
                frames: options.frames || ['*'],
                timeout: options.timeout || 30000,
                onConflict: options.onConflict || null,
                onProgress: options.onProgress || null
            };

            this._scope = null;
            this._remoteHeads = new Set();
            this._vectorClock = new VectorClock(this._options.nodeId);
            this._conflicts = [];
        }

        _generateNodeId() {
            return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        }

        // ========================================================================
        // PROTOCOL MESSAGE CREATION
        // ========================================================================

        /**
         * Create SCOPE message to negotiate session
         */
        createScopeMessage() {
            return {
                type: MESSAGE_TYPE.SCOPE,
                workspace: this._options.workspace,
                frames: this._options.frames,
                nodeId: this._options.nodeId,
                protocolVersion: '1.0',
                vectorClock: this._vectorClock.export()
            };
        }

        /**
         * Create INV (inventory) message
         */
        createInvMessage() {
            const events = this._getEventsInScope();
            const heads = this._localLog.getHeads();

            // Build bloom filter for efficient set difference
            const bloom = new BloomFilter(Math.max(1024, events.length * 10));
            events.forEach(e => bloom.add(e.id));

            return {
                type: MESSAGE_TYPE.INV,
                heads,
                count: events.length,
                bloomFilter: bloom.export(),
                logicalClock: this._localLog.getClock()
            };
        }

        /**
         * Create HAVE message (declare what we have)
         */
        createHaveMessage(eventIds) {
            return {
                type: MESSAGE_TYPE.HAVE,
                ids: eventIds
            };
        }

        /**
         * Create WANT message (request specific events)
         */
        createWantMessage(eventIds) {
            return {
                type: MESSAGE_TYPE.WANT,
                ids: eventIds
            };
        }

        /**
         * Create SEND message with events
         * Rule 2: Actor identity preserved - events sent as-is
         * Rule 6: Operations not snapshots - sending events, not state
         */
        createSendMessage(eventIds) {
            const events = eventIds
                .map(id => this._localLog.get(id))
                .filter(Boolean)
                .filter(e => this._isEventInScope(e));

            return {
                type: MESSAGE_TYPE.SEND,
                events: events.map(e => ({
                    // Rule 2: Preserve ALL original fields including actor
                    ...e
                }))
            };
        }

        /**
         * Create REFUSE message
         */
        createRefuseMessage(eventIds, reason) {
            return {
                type: MESSAGE_TYPE.REFUSE,
                ids: eventIds,
                reason
            };
        }

        /**
         * Create CONFLICT message (Rule 4: Don't hide conflicts)
         */
        createConflictMessage(conflictingEvents, conflictType) {
            return {
                type: MESSAGE_TYPE.CONFLICT,
                conflictType,
                events: conflictingEvents.map(e => e.id),
                detectedAt: new Date().toISOString(),
                detectedBy: this._options.nodeId
            };
        }

        // ========================================================================
        // MESSAGE PROCESSING
        // ========================================================================

        /**
         * Process an incoming SCOPE message
         */
        processScopeMessage(message) {
            // Validate protocol version
            if (message.protocolVersion !== '1.0') {
                return {
                    accepted: false,
                    error: 'unsupported_protocol_version'
                };
            }

            // Check workspace match
            if (message.workspace !== this._options.workspace) {
                return {
                    accepted: false,
                    error: 'workspace_mismatch'
                };
            }

            // Store remote info
            this._scope = {
                workspace: message.workspace,
                frames: message.frames,
                remoteNodeId: message.nodeId
            };

            // Merge vector clocks
            if (message.vectorClock) {
                this._vectorClock.merge(message.vectorClock);
            }

            return {
                accepted: true,
                response: {
                    type: MESSAGE_TYPE.SCOPE_ACK,
                    workspace: this._options.workspace,
                    nodeId: this._options.nodeId,
                    vectorClock: this._vectorClock.export()
                }
            };
        }

        /**
         * Process an incoming INV message
         */
        processInvMessage(message) {
            const remoteHeads = message.heads || [];
            const remoteBloom = message.bloomFilter
                ? BloomFilter.import(message.bloomFilter)
                : null;

            // Find events we have that remote might not
            const localEvents = this._getEventsInScope();
            const toSend = [];

            if (remoteBloom) {
                // Use bloom filter for efficient filtering
                localEvents.forEach(e => {
                    if (!remoteBloom.mightContain(e.id)) {
                        toSend.push(e.id);
                    }
                });
            }

            // Find events we need from remote
            const localIds = new Set(localEvents.map(e => e.id));
            const toRequest = remoteHeads.filter(id => !localIds.has(id));

            return {
                have: this.createHaveMessage(toSend),
                want: this.createWantMessage(toRequest)
            };
        }

        /**
         * Process incoming events (SEND message)
         * Rule 2: Actor is NOT modified - preserved exactly as received
         * Rule 4: Detect and report conflicts
         */
        processReceivedEvents(events) {
            const results = {
                accepted: [],
                rejected: [],
                conflicts: [],
                parked: []
            };

            for (const event of events) {
                // Rule 2: Validate actor is present (identity not laundered)
                if (!event.actor) {
                    results.rejected.push({
                        id: event.id,
                        reason: 'RULE_2: Missing actor - identity laundered'
                    });
                    continue;
                }

                // Validate scope
                if (!this._isEventInScope(event)) {
                    results.rejected.push({
                        id: event.id,
                        reason: 'outside_scope'
                    });
                    continue;
                }

                // Rule 4: Check for concurrent events (potential conflicts)
                const concurrentEvents = this._findConcurrentEvents(event);
                if (concurrentEvents.length > 0) {
                    // Record the conflict - don't hide it!
                    const conflict = {
                        type: CONFLICT_TYPE.CONCURRENT_EDIT,
                        incomingEvent: event,
                        existingEvents: concurrentEvents,
                        detectedAt: new Date().toISOString()
                    };
                    results.conflicts.push(conflict);
                    this._conflicts.push(conflict);

                    // Notify handler
                    this._options.onConflict?.(conflict);

                    // Still accept the event - conflicts are informational
                    // The event log stores all versions; conflict resolution is separate
                }

                // Attempt to append
                const appendResult = this._localLog.append(event);

                if (appendResult.success) {
                    results.accepted.push(event.id);

                    // Update vector clock
                    if (event.context?.nodeId) {
                        const remoteClock = {};
                        remoteClock[event.context.nodeId] = event.logicalClock;
                        this._vectorClock.merge(remoteClock);
                    }
                } else if (appendResult.parked) {
                    results.parked.push({
                        id: event.id,
                        waitingFor: appendResult.waitingFor
                    });
                } else if (appendResult.duplicate) {
                    // Idempotent - already have it
                    results.accepted.push(event.id);
                } else {
                    results.rejected.push({
                        id: event.id,
                        reason: appendResult.errors?.join(', ') || 'validation_failed'
                    });
                }
            }

            // Report progress
            this._options.onProgress?.({
                accepted: results.accepted.length,
                rejected: results.rejected.length,
                conflicts: results.conflicts.length,
                parked: results.parked.length
            });

            return results;
        }

        // ========================================================================
        // CONFLICT DETECTION (Rule 4)
        // ========================================================================

        /**
         * Find events that are concurrent with the incoming event
         */
        _findConcurrentEvents(incomingEvent) {
            const concurrent = [];

            // Get events that might conflict (same target)
            const targetId = incomingEvent.payload?.recordId ||
                            incomingEvent.payload?.setId ||
                            incomingEvent.payload?.targetId;

            if (!targetId) return concurrent;

            // Check for concurrent edits to same target
            const localEvents = this._localLog.getAll();

            for (const localEvent of localEvents) {
                const localTargetId = localEvent.payload?.recordId ||
                                     localEvent.payload?.setId ||
                                     localEvent.payload?.targetId;

                if (localTargetId !== targetId) continue;

                // Check if concurrent using parent DAG
                const isConcurrent = this._areConcurrent(localEvent, incomingEvent);

                if (isConcurrent) {
                    concurrent.push(localEvent);
                }
            }

            return concurrent;
        }

        /**
         * Check if two events are concurrent (neither causally precedes the other)
         */
        _areConcurrent(event1, event2) {
            // If one is ancestor of other, they're not concurrent
            if (this._isAncestor(event1.id, event2)) return false;
            if (this._isAncestor(event2.id, event1)) return false;

            // Neither precedes the other - concurrent
            return true;
        }

        /**
         * Check if ancestorId is an ancestor of event
         */
        _isAncestor(ancestorId, event) {
            const visited = new Set();
            const queue = [...(event.parents || [])];

            while (queue.length > 0) {
                const parentId = queue.shift();
                if (visited.has(parentId)) continue;
                visited.add(parentId);

                if (parentId === ancestorId) return true;

                const parent = this._localLog.get(parentId);
                if (parent?.parents) {
                    queue.push(...parent.parents);
                }
            }

            return false;
        }

        // ========================================================================
        // SCOPE MANAGEMENT
        // ========================================================================

        /**
         * Get events in current scope
         */
        _getEventsInScope() {
            return this._localLog.getAll().filter(e => this._isEventInScope(e));
        }

        /**
         * Check if event is in session scope
         */
        _isEventInScope(event) {
            // Check workspace
            if (event.context?.workspace !== this._options.workspace) {
                return false;
            }

            // Check frames (if not wildcard)
            if (!this._options.frames.includes('*')) {
                if (event.frame && !this._options.frames.includes(event.frame.purpose)) {
                    return false;
                }
            }

            return true;
        }

        // ========================================================================
        // SYNC FAILURE RECORDING (Rule 7)
        // ========================================================================

        /**
         * Record a sync failure as an event
         */
        recordSyncFailure(error, details = {}) {
            return this._localLog.append({
                type: 'given',
                actor: 'system',
                parents: this._localLog.getHeads(),
                context: {
                    workspace: this._options.workspace,
                    nodeId: this._options.nodeId,
                    schemaVersion: '1.0'
                },
                payload: {
                    action: 'sync:failure',
                    error: error.message || error,
                    errorType: error.name || 'SyncError',
                    remoteNodeId: this._scope?.remoteNodeId,
                    ...details,
                    failedAt: new Date().toISOString()
                }
            });
        }

        /**
         * Record a sync success
         */
        recordSyncSuccess(stats) {
            return this._localLog.append({
                type: 'given',
                actor: 'system',
                parents: this._localLog.getHeads(),
                context: {
                    workspace: this._options.workspace,
                    nodeId: this._options.nodeId,
                    schemaVersion: '1.0'
                },
                payload: {
                    action: 'sync:success',
                    remoteNodeId: this._scope?.remoteNodeId,
                    eventsReceived: stats.received || 0,
                    eventsSent: stats.sent || 0,
                    conflicts: stats.conflicts || 0,
                    completedAt: new Date().toISOString()
                }
            });
        }

        // ========================================================================
        // GETTERS
        // ========================================================================

        getConflicts() {
            return [...this._conflicts];
        }

        getVectorClock() {
            return this._vectorClock.export();
        }

        getScope() {
            return this._scope;
        }
    }

    // ============================================================================
    // SYNC ENGINE (High-level sync orchestration)
    // ============================================================================

    class EOSyncEngine {
        constructor(eventLog, options = {}) {
            this._eventLog = eventLog;
            this._options = {
                nodeId: options.nodeId || `node_${Date.now().toString(36)}`,
                workspace: options.workspace || 'default',
                retryAttempts: options.retryAttempts || 4,
                retryBaseDelay: options.retryBaseDelay || 2000,
                onSync: options.onSync || null,
                onConflict: options.onConflict || null,
                onError: options.onError || null
            };

            this._sessions = new Map();
            this._syncInProgress = false;
        }

        /**
         * Perform a full sync with a remote endpoint
         * Implements exponential backoff for retries
         */
        async syncWith(transport, remoteId) {
            if (this._syncInProgress) {
                throw new Error('Sync already in progress');
            }

            this._syncInProgress = true;
            let attempt = 0;

            try {
                while (attempt < this._options.retryAttempts) {
                    try {
                        const result = await this._performSync(transport, remoteId);
                        this._syncInProgress = false;
                        return result;
                    } catch (err) {
                        attempt++;

                        if (attempt >= this._options.retryAttempts) {
                            // Record failure (Rule 7)
                            const session = this._sessions.get(remoteId);
                            if (session) {
                                session.recordSyncFailure(err, {
                                    attempts: attempt,
                                    finalAttempt: true
                                });
                            }

                            this._options.onError?.({
                                type: 'sync_failed',
                                remoteId,
                                error: err.message,
                                attempts: attempt
                            });

                            throw err;
                        }

                        // Exponential backoff
                        const delay = this._options.retryBaseDelay * Math.pow(2, attempt - 1);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            } finally {
                this._syncInProgress = false;
            }
        }

        /**
         * Internal sync implementation
         */
        async _performSync(transport, remoteId) {
            // Create or get session
            let session = this._sessions.get(remoteId);
            if (!session) {
                session = new SyncSession(this._eventLog, {
                    nodeId: this._options.nodeId,
                    workspace: this._options.workspace,
                    onConflict: this._options.onConflict
                });
                this._sessions.set(remoteId, session);
            }

            // Step 1: Scope negotiation
            const scopeMsg = session.createScopeMessage();
            const scopeResponse = await transport.send(scopeMsg);

            if (scopeResponse.type === MESSAGE_TYPE.REFUSE) {
                throw new Error(`Scope refused: ${scopeResponse.reason}`);
            }

            session.processScopeMessage(scopeResponse);

            // Step 2: Exchange inventory
            const invMsg = session.createInvMessage();
            const invResponse = await transport.send(invMsg);

            // Step 3: Process what remote has/wants
            const { have, want } = session.processInvMessage(invResponse);

            // Step 4: Send events remote wants
            if (want.ids.length > 0) {
                const sendMsg = session.createSendMessage(want.ids);
                await transport.send(sendMsg);
            }

            // Step 5: Request events we want
            if (have.ids?.length > 0) {
                const wantMsg = session.createWantMessage(have.ids);
                const sendResponse = await transport.send(wantMsg);

                if (sendResponse.type === MESSAGE_TYPE.SEND) {
                    const results = session.processReceivedEvents(sendResponse.events);

                    // Handle conflicts
                    if (results.conflicts.length > 0) {
                        this._options.onConflict?.(results.conflicts);
                    }
                }
            }

            // Record success
            const stats = {
                received: have.ids?.length || 0,
                sent: want.ids?.length || 0,
                conflicts: session.getConflicts().length
            };

            session.recordSyncSuccess(stats);
            this._options.onSync?.(stats);

            return stats;
        }

        /**
         * Get current sync status
         */
        getStatus() {
            return {
                inProgress: this._syncInProgress,
                nodeId: this._options.nodeId,
                workspace: this._options.workspace,
                sessions: Array.from(this._sessions.keys())
            };
        }
    }

    // ============================================================================
    // SINGLETON AND EXPORTS
    // ============================================================================

    let _engineInstance = null;

    function getSyncEngine() {
        return _engineInstance;
    }

    function initSyncEngine(eventLog, options = {}) {
        _engineInstance = new EOSyncEngine(eventLog, options);
        return _engineInstance;
    }

    const EOSyncProtocol = {
        // Classes
        SyncSession,
        SyncEngine: EOSyncEngine,
        BloomFilter,
        VectorClock,

        // Constants
        MESSAGE_TYPE,
        CONFLICT_TYPE,

        // Singleton
        getEngine: getSyncEngine,
        initEngine: initSyncEngine
    };

    // Export to global scope
    global.EOSyncProtocol = EOSyncProtocol;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOSyncProtocol;
    }

})(typeof window !== 'undefined' ? window : global);
