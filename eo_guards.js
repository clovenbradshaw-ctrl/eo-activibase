/**
 * EO Sync Guards
 * Runtime enforcement of Sync Handbook rules
 *
 * These guards prevent accidental violations of sync compliance rules.
 * They can be enabled in development/test and disabled in production.
 *
 * Usage:
 *   EOGuards.enable();  // Turn on all guards
 *   EOGuards.disable(); // Turn off (production)
 *   EOGuards.setMode('strict'); // Throw on violations
 *   EOGuards.setMode('warn');   // Console warnings only
 *
 * @see SYNC_HANDBOOK.md for rule details
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CONFIGURATION
    // ============================================================================

    const CONFIG = {
        enabled: true,
        mode: 'warn',  // 'strict' (throw) | 'warn' (console) | 'silent' (log only)
        logViolations: true,
        violationLog: []
    };

    // ============================================================================
    // VIOLATION HANDLING
    // ============================================================================

    function violation(rule, message, context = {}) {
        const entry = {
            rule,
            message,
            context,
            timestamp: new Date().toISOString(),
            stack: new Error().stack
        };

        if (CONFIG.logViolations) {
            CONFIG.violationLog.push(entry);
        }

        const formatted = `[SYNC VIOLATION] ${rule}: ${message}`;

        switch (CONFIG.mode) {
            case 'strict':
                throw new Error(formatted);
            case 'warn':
                console.error(formatted, context);
                break;
            case 'silent':
                // Just log, no console output
                break;
        }

        return entry;
    }

    // ============================================================================
    // AXIOM 0: LOG PRIMACY GUARDS
    // ============================================================================

    /**
     * Guard: Prevent direct state mutation
     * Wraps an object to detect writes that bypass the event log
     */
    function guardState(state, stateName = 'state') {
        if (!CONFIG.enabled) return state;

        return new Proxy(state, {
            set(target, prop, value) {
                violation('AXIOM_0', `Direct mutation of ${stateName}.${String(prop)} detected. Use eventLog.append() instead.`, {
                    property: prop,
                    value: typeof value === 'object' ? '[object]' : value
                });

                // Still allow the mutation in non-strict mode
                if (CONFIG.mode !== 'strict') {
                    target[prop] = value;
                    return true;
                }
                return false;
            },

            deleteProperty(target, prop) {
                violation('AXIOM_0', `Direct deletion of ${stateName}.${String(prop)} detected. Use tombstone events instead.`, {
                    property: prop
                });

                if (CONFIG.mode !== 'strict') {
                    delete target[prop];
                    return true;
                }
                return false;
            }
        });
    }

    /**
     * Guard: Wrap Map to detect mutations
     */
    function guardMap(map, mapName = 'map') {
        if (!CONFIG.enabled) return map;

        const originalSet = map.set.bind(map);
        const originalDelete = map.delete.bind(map);
        const originalClear = map.clear.bind(map);

        map.set = function(key, value) {
            violation('AXIOM_0', `Direct Map.set() on ${mapName} detected. Use eventLog.append() instead.`, {
                key,
                mapName
            });
            if (CONFIG.mode !== 'strict') {
                return originalSet(key, value);
            }
        };

        map.delete = function(key) {
            violation('AXIOM_0', `Direct Map.delete() on ${mapName} detected. Use tombstone events instead.`, {
                key,
                mapName
            });
            if (CONFIG.mode !== 'strict') {
                return originalDelete(key);
            }
        };

        map.clear = function() {
            violation('AXIOM_0', `Direct Map.clear() on ${mapName} detected. This violates log primacy.`, {
                mapName
            });
            if (CONFIG.mode !== 'strict') {
                return originalClear();
            }
        };

        return map;
    }

    // ============================================================================
    // RULE 1: ORIGIN GUARDS
    // ============================================================================

    /**
     * Guard: Validate event has required origin fields
     */
    function guardEventOrigin(event, source = 'unknown') {
        if (!CONFIG.enabled) return true;

        const errors = [];

        if (!event.id) {
            errors.push('Missing event.id');
        }

        if (!event.actor) {
            errors.push('Missing event.actor');
        } else if (event.actor === 'unknown') {
            errors.push('event.actor is "unknown" - use actual actor identity');
        }

        if (!event.timestamp && !event.logicalClock) {
            errors.push('Missing temporal marker (timestamp or logicalClock)');
        }

        if (!event.context) {
            errors.push('Missing event.context');
        } else {
            if (!event.context.workspace) {
                errors.push('Missing event.context.workspace');
            }
            if (!event.context.schemaVersion) {
                errors.push('Missing event.context.schemaVersion');
            }
        }

        if (errors.length > 0) {
            violation('RULE_1', `Event from ${source} missing origin fields: ${errors.join(', ')}`, {
                event: { id: event.id, actor: event.actor },
                errors
            });
            return false;
        }

        return true;
    }

    // ============================================================================
    // RULE 2: IDENTITY GUARDS
    // ============================================================================

    /**
     * Guard: Detect identity laundering during sync
     */
    function guardIdentityPreservation(originalEvent, syncedEvent, source = 'sync') {
        if (!CONFIG.enabled) return true;

        if (originalEvent.actor !== syncedEvent.actor) {
            violation('RULE_2', `Actor identity changed during ${source}: "${originalEvent.actor}" -> "${syncedEvent.actor}"`, {
                originalActor: originalEvent.actor,
                newActor: syncedEvent.actor,
                eventId: originalEvent.id
            });
            return false;
        }

        return true;
    }

    /**
     * Guard: Detect system actor for user actions
     */
    function guardUserAction(event) {
        if (!CONFIG.enabled) return true;

        const userActions = [
            'cell:edit', 'record:create', 'record:update', 'record:delete',
            'field:create', 'field:update', 'view:create', 'view:update',
            'set:create', 'comment:add', 'button:click'
        ];

        const action = event.payload?.action;
        const isUserAction = userActions.some(ua => action?.includes(ua.split(':')[1]) || action === ua);

        if (isUserAction && (event.actor === 'system' || event.actor === 'unknown')) {
            violation('RULE_2', `User action "${action}" has non-user actor: "${event.actor}"`, {
                action,
                actor: event.actor,
                eventId: event.id
            });
            return false;
        }

        return true;
    }

    // ============================================================================
    // RULE 3: OFFLINE GUARDS
    // ============================================================================

    /**
     * Guard: Detect network-blocking operations
     */
    function guardOfflineCapability(operationName, requiresNetwork) {
        if (!CONFIG.enabled) return true;

        if (requiresNetwork) {
            violation('RULE_3', `Operation "${operationName}" requires network. Should work offline first.`, {
                operation: operationName,
                suggestion: 'Use local event log, then sync asynchronously'
            });
            return false;
        }

        return true;
    }

    /**
     * Guard: Wrap fetch to detect sync-blocking calls
     */
    function guardFetch() {
        if (!CONFIG.enabled || typeof fetch === 'undefined') return;

        const originalFetch = global.fetch;

        global.fetch = function(...args) {
            const url = args[0]?.toString() || '';

            // Check if this looks like a sync/save operation
            if (url.includes('/save') || url.includes('/sync') || url.includes('/update')) {
                violation('RULE_3', `Network call to "${url}" may block on network. Ensure local-first pattern.`, {
                    url,
                    suggestion: 'Save to local event log first, sync asynchronously'
                });
            }

            return originalFetch.apply(this, args);
        };

        return () => { global.fetch = originalFetch; };
    }

    // ============================================================================
    // RULE 4: CONCURRENCY GUARDS
    // ============================================================================

    /**
     * Guard: Detect silent merge (last-write-wins without conflict recording)
     */
    function guardConflictVisibility(event1, event2, mergeResult) {
        if (!CONFIG.enabled) return true;

        // If events are concurrent and we just picked one without recording conflict
        const areConcurrent = !isAncestor(event1, event2) && !isAncestor(event2, event1);

        if (areConcurrent && mergeResult.conflictRecorded !== true) {
            violation('RULE_4', 'Concurrent events merged without recording conflict', {
                event1Id: event1.id,
                event2Id: event2.id,
                suggestion: 'Record conflict as an event before resolving'
            });
            return false;
        }

        return true;
    }

    function isAncestor(possibleAncestor, event) {
        // Simplified check - in production use full DAG traversal
        return event.parents?.includes(possibleAncestor.id);
    }

    // ============================================================================
    // RULE 5: VIEW GUARDS
    // ============================================================================

    /**
     * Guard: Detect authoritative state (should be derived)
     */
    function guardDerivedState(state, log) {
        if (!CONFIG.enabled) return true;

        // Check if state claims to be authoritative
        if (state._authoritative === true) {
            violation('RULE_5', 'State marked as authoritative. State should be derived from log.', {
                suggestion: 'Remove _authoritative flag, derive state from event log'
            });
            return false;
        }

        return true;
    }

    // ============================================================================
    // RULE 6: OPERATIONS GUARDS
    // ============================================================================

    /**
     * Guard: Detect state-based sync (should be event-based)
     */
    function guardEventSync(syncPayload) {
        if (!CONFIG.enabled) return true;

        // Check if payload looks like state rather than events
        if (syncPayload.state && !syncPayload.events) {
            violation('RULE_6', 'Sync payload contains state instead of events', {
                hasState: true,
                hasEvents: false,
                suggestion: 'Sync events, not state snapshots'
            });
            return false;
        }

        if (syncPayload.snapshot) {
            violation('RULE_6', 'Sync payload contains snapshot', {
                suggestion: 'Transmit events, not snapshots'
            });
            return false;
        }

        return true;
    }

    // ============================================================================
    // RULE 7: FAILURE GUARDS
    // ============================================================================

    /**
     * Guard: Ensure sync failures are recorded
     */
    function guardFailureRecording(error, wasRecorded) {
        if (!CONFIG.enabled) return true;

        if (!wasRecorded) {
            violation('RULE_7', 'Sync failure not recorded as event', {
                error: error?.message || error,
                suggestion: 'Record failure as an event in the log'
            });
            return false;
        }

        return true;
    }

    // ============================================================================
    // RULE 8: IDEMPOTENCY GUARDS
    // ============================================================================

    /**
     * Guard: Detect non-idempotent replay
     */
    function guardIdempotentReplay(event, beforeCount, afterCount) {
        if (!CONFIG.enabled) return true;

        if (afterCount > beforeCount) {
            violation('RULE_8', 'Replay created duplicate event', {
                eventId: event.id,
                beforeCount,
                afterCount,
                suggestion: 'Use content-addressable IDs for deduplication'
            });
            return false;
        }

        return true;
    }

    // ============================================================================
    // RULE 9: DELETION GUARDS
    // ============================================================================

    /**
     * Guard: Detect true deletion (should be tombstone)
     */
    function guardTombstoneDeletion(operation, target) {
        if (!CONFIG.enabled) return true;

        const trueDeleteOps = ['delete', 'remove', 'splice', 'filter'];

        if (trueDeleteOps.some(op => operation.toLowerCase().includes(op))) {
            violation('RULE_9', `True deletion detected: "${operation}" on ${target}`, {
                operation,
                target,
                suggestion: 'Use tombstone events instead of true deletion'
            });
            return false;
        }

        return true;
    }

    /**
     * Guard: Wrap Array methods that delete
     */
    function guardArray(arr, arrayName = 'array') {
        if (!CONFIG.enabled) return arr;

        const originalSplice = arr.splice.bind(arr);
        const originalPop = arr.pop.bind(arr);
        const originalShift = arr.shift.bind(arr);

        arr.splice = function(...args) {
            if (args[1] > 0) {  // Deleting elements
                violation('RULE_9', `Array.splice() removing elements from ${arrayName}`, {
                    deleteCount: args[1],
                    suggestion: 'Use tombstone pattern instead'
                });
            }
            if (CONFIG.mode !== 'strict') {
                return originalSplice(...args);
            }
        };

        arr.pop = function() {
            violation('RULE_9', `Array.pop() on ${arrayName}`, {
                suggestion: 'Use tombstone pattern instead'
            });
            if (CONFIG.mode !== 'strict') {
                return originalPop();
            }
        };

        arr.shift = function() {
            violation('RULE_9', `Array.shift() on ${arrayName}`, {
                suggestion: 'Use tombstone pattern instead'
            });
            if (CONFIG.mode !== 'strict') {
                return originalShift();
            }
        };

        return arr;
    }

    // ============================================================================
    // GIVEN/MEANT GUARDS
    // ============================================================================

    /**
     * Guard: Validate Meant events have provenance
     */
    function guardMeantProvenance(event) {
        if (!CONFIG.enabled) return true;

        if (event.type === 'meant') {
            if (!event.provenance || event.provenance.length === 0) {
                violation('RULE_4', 'Meant event missing provenance to Given events', {
                    eventId: event.id,
                    suggestion: 'Add provenance array with IDs of source Given events'
                });
                return false;
            }

            if (!event.frame || !event.frame.purpose) {
                violation('RULE_5', 'Meant event missing frame with purpose', {
                    eventId: event.id,
                    suggestion: 'Add frame: { purpose: "...", horizon: "..." }'
                });
                return false;
            }
        }

        return true;
    }

    /**
     * Guard: Prevent Given events from Meant sources
     */
    function guardGivenFromMeant(givenEvent, sourceEvents) {
        if (!CONFIG.enabled) return true;

        if (givenEvent.type === 'given') {
            const meantSources = sourceEvents.filter(e => e.type === 'meant');
            if (meantSources.length > 0 && meantSources.length === sourceEvents.length) {
                violation('SEPARATION', 'Given event derived only from Meant events', {
                    givenEventId: givenEvent.id,
                    meantSourceIds: meantSources.map(e => e.id),
                    suggestion: 'Given events must derive from raw observations, not interpretations'
                });
                return false;
            }
        }

        return true;
    }

    // ============================================================================
    // COMPREHENSIVE EVENT VALIDATION
    // ============================================================================

    /**
     * Run all guards on an event
     */
    function validateEvent(event, options = {}) {
        if (!CONFIG.enabled) return { valid: true, violations: [] };

        const violations = [];

        // Rule 1: Origin
        if (!guardEventOrigin(event, options.source)) {
            violations.push('RULE_1');
        }

        // Rule 2: User actions
        if (!guardUserAction(event)) {
            violations.push('RULE_2');
        }

        // Given/Meant validation
        if (!guardMeantProvenance(event)) {
            violations.push('RULE_4/5');
        }

        return {
            valid: violations.length === 0,
            violations
        };
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    const EOGuards = {
        // Configuration
        enable: () => { CONFIG.enabled = true; },
        disable: () => { CONFIG.enabled = false; },
        isEnabled: () => CONFIG.enabled,

        setMode: (mode) => {
            if (['strict', 'warn', 'silent'].includes(mode)) {
                CONFIG.mode = mode;
            }
        },
        getMode: () => CONFIG.mode,

        // Violation log
        getViolations: () => [...CONFIG.violationLog],
        clearViolations: () => { CONFIG.violationLog = []; },

        // Guards
        guardState,
        guardMap,
        guardArray,
        guardEventOrigin,
        guardIdentityPreservation,
        guardUserAction,
        guardOfflineCapability,
        guardFetch,
        guardConflictVisibility,
        guardDerivedState,
        guardEventSync,
        guardFailureRecording,
        guardIdempotentReplay,
        guardTombstoneDeletion,
        guardMeantProvenance,
        guardGivenFromMeant,

        // Comprehensive validation
        validateEvent,

        // Direct violation reporting
        violation
    };

    // Export
    global.EOGuards = EOGuards;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOGuards;
    }

})(typeof window !== 'undefined' ? window : global);
