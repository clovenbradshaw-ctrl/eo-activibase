/**
 * EO Sync Rules - Canonical Rule Definitions
 *
 * This file defines the sync compliance rules as code.
 * Import this to reference rules in other modules.
 *
 * @fileoverview Sync Handbook rule definitions
 * @see SYNC_HANDBOOK.md for full documentation
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SYNC SYSTEM COMPLIANCE RULES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * These rules exist to prevent three collapse modes:
 *
 *   1. IDENTITY COLLAPSE - "The system decided"
 *      When authorship disappears, responsibility disappears.
 *
 *   2. SPACE COLLAPSE - "Last write wins"
 *      When concurrent changes are silently merged, reality is centralized.
 *
 *   3. TIME COLLAPSE - "Current state is all that matters"
 *      When history is overwritten, learning and recovery become impossible.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function(global) {
    'use strict';

    // =========================================================================
    // AXIOM 0: LOG PRIMACY
    // =========================================================================

    /**
     * @rule AXIOM_0
     * @name Log Primacy
     * @severity CRITICAL
     *
     * The append-only log is the database. Everything else is a view.
     *
     * REQUIREMENTS:
     * - All changes MUST be recorded as events in the log
     * - State MUST be derived from the log via a pure function: State = f(Log)
     * - No operation may modify the log by reading from mutable state
     * - Once recorded, an event cannot be undone—only superseded
     *
     * VIOLATIONS:
     * - Direct mutation of state objects
     * - UPDATE or DELETE operations on event storage
     * - Deriving log entries from current state
     *
     * @example
     * // ❌ WRONG: Mutating state directly
     * state.records.set(id, record);
     *
     * // ✓ CORRECT: Append to log, derive state
     * eventLog.append({ payload: { action: 'record:create', ... } });
     * state = deriveFromLog(eventLog);
     */
    const AXIOM_0 = {
        id: 'axiom_0',
        name: 'Log Primacy',
        severity: 'critical',
        category: 'foundation',
        prevents: 'time_collapse',
        description: 'The append-only log is the database. Everything else is a view.',
        requirements: [
            'All changes must be recorded as events',
            'State must be derived from the log',
            'Events cannot be modified, only superseded'
        ]
    };

    // =========================================================================
    // IDENTITY RULES (Rules 1-2)
    // =========================================================================

    /**
     * @rule RULE_1
     * @name Origin Is Part of the Record
     * @severity CRITICAL
     *
     * Every event MUST retain origin information sufficient to distinguish
     * authorship and intent.
     *
     * REQUIRED FIELDS:
     * - id: Globally unique identifier
     * - actor: Who created this event (user, device, process)
     * - timestamp/logicalClock: Temporal marker
     * - context: Workspace, device, session, schema version
     *
     * @example
     * {
     *   id: 'evt_abc123',
     *   actor: 'user_alice',  // NEVER 'system' for user actions
     *   timestamp: '2025-01-15T10:30:00Z',
     *   logicalClock: 42,
     *   context: {
     *     workspace: 'project_alpha',
     *     device: 'device_001',
     *     schemaVersion: '1.0'
     *   },
     *   payload: { ... }
     * }
     */
    const RULE_1 = {
        id: 'rule_1',
        name: 'Origin Is Part of the Record',
        severity: 'critical',
        category: 'identity',
        prevents: 'identity_collapse',
        description: 'Every event must retain origin information.',
        requiredFields: ['id', 'actor', 'timestamp|logicalClock', 'context']
    };

    /**
     * @rule RULE_2
     * @name Identity Must Not Be Laundered
     * @severity CRITICAL
     *
     * Synchronization must NOT transform locally authored events into
     * anonymous or server-authored facts.
     *
     * REQUIREMENTS:
     * - Local intent remains identifiable after sync
     * - Server acceptance does not replace authorship
     * - Authority does not erase responsibility
     *
     * @example
     * // ❌ WRONG: Server overwrites actor
     * syncedEvent.actor = 'server';
     *
     * // ✓ CORRECT: Preserve original actor
     * syncedEvent = originalEvent;  // Unchanged
     */
    const RULE_2 = {
        id: 'rule_2',
        name: 'Identity Must Not Be Laundered',
        severity: 'critical',
        category: 'identity',
        prevents: 'identity_collapse',
        description: 'Sync must not transform authored events into anonymous facts.'
    };

    // =========================================================================
    // SPACE RULES (Rules 3-5)
    // =========================================================================

    /**
     * @rule RULE_3
     * @name Capture Before Coordination
     * @severity REQUIRED
     *
     * Recording an event must NOT require network connectivity or remote agreement.
     *
     * REQUIREMENTS:
     * - Events are recorded locally first
     * - Coordination is asynchronous
     * - Offline operation is first-class, not degraded
     *
     * @example
     * // ❌ WRONG: Blocks on network
     * await server.save(record);
     *
     * // ✓ CORRECT: Local first
     * eventLog.append(event);  // Always succeeds
     * syncQueue.enqueue(event);  // Sync later
     */
    const RULE_3 = {
        id: 'rule_3',
        name: 'Capture Before Coordination',
        severity: 'required',
        category: 'space',
        prevents: 'space_collapse',
        description: 'Events are recorded locally first; coordination is async.'
    };

    /**
     * @rule RULE_4
     * @name Non-Collapse of Concurrency
     * @severity REQUIRED
     *
     * Distinct events recorded in different places MUST remain distinct
     * until explicitly reconciled.
     *
     * REQUIREMENTS:
     * - No implicit last-write-wins
     * - No silent merges at transport time
     * - Conflicts are recorded, not hidden
     *
     * @example
     * // ❌ WRONG: Silent merge
     * return a.timestamp > b.timestamp ? a : b;
     *
     * // ✓ CORRECT: Record conflict
     * if (concurrent(a, b)) {
     *   eventLog.append({ action: 'conflict:detected', events: [a.id, b.id] });
     * }
     */
    const RULE_4 = {
        id: 'rule_4',
        name: 'Non-Collapse of Concurrency',
        severity: 'required',
        category: 'space',
        prevents: 'space_collapse',
        description: 'Concurrent events remain distinct until explicitly reconciled.'
    };

    /**
     * @rule RULE_5
     * @name Views Are Local and Disposable
     * @severity REQUIRED
     *
     * All materialized state is local, rebuildable, and non-authoritative.
     *
     * REQUIREMENTS:
     * - Views may differ across replicas
     * - Views may be discarded and rebuilt from the log
     * - Views must not overwrite the log
     *
     * @example
     * const state = deriveFromLog(eventLog);
     * // If corrupted:
     * state = deriveFromLog(eventLog);  // Just rebuild
     */
    const RULE_5 = {
        id: 'rule_5',
        name: 'Views Are Local and Disposable',
        severity: 'required',
        category: 'space',
        prevents: 'space_collapse',
        description: 'All materialized state is rebuildable from the log.'
    };

    // =========================================================================
    // TIME RULES (Rules 6-9)
    // =========================================================================

    /**
     * @rule RULE_6
     * @name Operations, Not Snapshots
     * @severity REQUIRED
     *
     * Synchronization MUST transmit events, not reconstructed state.
     *
     * @example
     * // ❌ WRONG: Syncing state
     * await sync({ state: currentState });
     *
     * // ✓ CORRECT: Syncing events
     * await sync({ events: eventLog.getSince(lastSync) });
     */
    const RULE_6 = {
        id: 'rule_6',
        name: 'Operations, Not Snapshots',
        severity: 'required',
        category: 'time',
        prevents: 'time_collapse',
        description: 'Sync transmits events, not reconstructed state.'
    };

    /**
     * @rule RULE_7
     * @name Failure Is a State
     * @severity RECOMMENDED
     *
     * Failure to synchronize is itself a representable condition.
     *
     * @example
     * try {
     *   await sync();
     * } catch (err) {
     *   eventLog.append({
     *     action: 'sync:failure',
     *     error: err.message
     *   });
     * }
     */
    const RULE_7 = {
        id: 'rule_7',
        name: 'Failure Is a State',
        severity: 'recommended',
        category: 'time',
        prevents: 'time_collapse',
        description: 'Sync failures are recorded as events.'
    };

    /**
     * @rule RULE_8
     * @name Idempotent Replay
     * @severity CRITICAL
     *
     * Reapplying an event MUST NOT create new semantic effects.
     *
     * REQUIREMENTS:
     * - Duplicate delivery is expected
     * - Exactly-once delivery is not assumed
     * - Events carry enough information to be recognized as duplicates
     *
     * @example
     * eventLog.append(event);  // First time
     * eventLog.append(event);  // Same event again
     * // Log should still have exactly one copy
     */
    const RULE_8 = {
        id: 'rule_8',
        name: 'Idempotent Replay',
        severity: 'critical',
        category: 'time',
        prevents: 'time_collapse',
        description: 'Reapplying an event must not create new effects.'
    };

    /**
     * @rule RULE_9
     * @name Revision Without Erasure
     * @severity CRITICAL
     *
     * Deletion, correction, or undo MUST be represented as new events.
     *
     * REQUIREMENTS:
     * - Past events remain in the log
     * - Meaning changes; history does not
     * - Supersession is explicit, not implicit
     *
     * @example
     * // ❌ WRONG: True deletion
     * log = log.filter(e => e.id !== targetId);
     *
     * // ✓ CORRECT: Tombstone event
     * eventLog.append({
     *   action: 'tombstone',
     *   targetId,
     *   reason: 'User requested deletion'
     * });
     */
    const RULE_9 = {
        id: 'rule_9',
        name: 'Revision Without Erasure',
        severity: 'critical',
        category: 'time',
        prevents: 'time_collapse',
        description: 'Deletion/correction represented as new events, not erasure.'
    };

    // =========================================================================
    // GIVEN/MEANT SEPARATION
    // =========================================================================

    /**
     * @rule SEPARATION
     * @name Given/Meant Separation
     * @severity REQUIRED
     *
     * Raw records (Given) must be separated from interpretations (Meant).
     *
     * GIVEN EVENTS:
     * - Actions taken, observations made, messages sent
     * - type: 'given'
     * - No interpretation or inference
     *
     * MEANT EVENTS:
     * - Summaries, conclusions, AI outputs
     * - type: 'meant'
     * - MUST have provenance (source Given events)
     * - MUST have frame (purpose, horizon)
     *
     * CONSTRAINT:
     * Given events can NEVER be generated from Meant events alone.
     */
    const SEPARATION = {
        id: 'separation',
        name: 'Given/Meant Separation',
        severity: 'required',
        category: 'semantic',
        givenRequirements: [],
        meantRequirements: ['provenance', 'frame.purpose']
    };

    // =========================================================================
    // ALL RULES
    // =========================================================================

    const ALL_RULES = {
        AXIOM_0,
        RULE_1,
        RULE_2,
        RULE_3,
        RULE_4,
        RULE_5,
        RULE_6,
        RULE_7,
        RULE_8,
        RULE_9,
        SEPARATION
    };

    // =========================================================================
    // COMPLIANCE LEVELS
    // =========================================================================

    const COMPLIANCE_LEVELS = {
        0: {
            name: 'Pre-Conformance',
            description: 'Critical rules violated',
            requiredRules: []
        },
        1: {
            name: 'Core Conformance',
            description: 'Append-only, origin, idempotent, tombstones',
            requiredRules: ['axiom_0', 'rule_1', 'rule_8', 'rule_9']
        },
        2: {
            name: 'Collaborative Conformance',
            description: 'Full offline and sync support',
            requiredRules: ['axiom_0', 'rule_1', 'rule_2', 'rule_3', 'rule_4', 'rule_5', 'rule_6', 'rule_8', 'rule_9']
        },
        3: {
            name: 'Full Conformance',
            description: 'All rules satisfied',
            requiredRules: Object.keys(ALL_RULES).map(k => k.toLowerCase())
        }
    };

    // =========================================================================
    // VALIDATION HELPERS
    // =========================================================================

    /**
     * Check if an event satisfies Rule 1 (Origin)
     */
    function validateOrigin(event) {
        const errors = [];
        if (!event.id) errors.push('Missing id');
        if (!event.actor) errors.push('Missing actor');
        if (!event.timestamp && !event.logicalClock) errors.push('Missing temporal marker');
        if (!event.context) errors.push('Missing context');
        return { valid: errors.length === 0, errors };
    }

    /**
     * Check if a Meant event satisfies separation requirements
     */
    function validateMeant(event) {
        if (event.type !== 'meant') return { valid: true, errors: [] };

        const errors = [];
        if (!event.provenance || event.provenance.length === 0) {
            errors.push('Missing provenance');
        }
        if (!event.frame || !event.frame.purpose) {
            errors.push('Missing frame.purpose');
        }
        return { valid: errors.length === 0, errors };
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    const EOSyncRules = {
        // Individual rules
        AXIOM_0,
        RULE_1,
        RULE_2,
        RULE_3,
        RULE_4,
        RULE_5,
        RULE_6,
        RULE_7,
        RULE_8,
        RULE_9,
        SEPARATION,

        // Collections
        ALL_RULES,
        COMPLIANCE_LEVELS,

        // Categories
        IDENTITY_RULES: [RULE_1, RULE_2],
        SPACE_RULES: [RULE_3, RULE_4, RULE_5],
        TIME_RULES: [RULE_6, RULE_7, RULE_8, RULE_9],

        // Validators
        validateOrigin,
        validateMeant,

        // Quick reference
        getRuleById: (id) => ALL_RULES[id.toUpperCase()],
        getCriticalRules: () => Object.values(ALL_RULES).filter(r => r.severity === 'critical'),
        getRulesByCategory: (cat) => Object.values(ALL_RULES).filter(r => r.category === cat)
    };

    // Export
    global.EOSyncRules = EOSyncRules;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOSyncRules;
    }

})(typeof window !== 'undefined' ? window : global);
