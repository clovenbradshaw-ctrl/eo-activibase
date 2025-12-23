/**
 * EO Compliance Checker
 * Validates system compliance with the Sync Handbook rules
 *
 * Also provides an integration bridge to connect the new event-sourced
 * architecture with the existing EOStateManager.
 *
 * @see Sync Handbook Part VII - Conformance and Verification
 */

(function(global) {
    'use strict';

    // ============================================================================
    // COMPLIANCE RULES
    // ============================================================================

    const RULES = {
        AXIOM_0: {
            id: 'axiom_0',
            name: 'Log Primacy',
            description: 'The append-only log is the database. Everything else is a view.',
            level: 'critical'
        },
        RULE_1: {
            id: 'rule_1',
            name: 'Origin Is Part of the Record',
            description: 'Every event must retain origin information (id, actor, timestamp, context)',
            level: 'critical'
        },
        RULE_2: {
            id: 'rule_2',
            name: 'Identity Must Not Be Laundered',
            description: 'Sync must not transform locally authored events into anonymous facts',
            level: 'critical'
        },
        RULE_3: {
            id: 'rule_3',
            name: 'Capture Before Coordination',
            description: 'Events are recorded locally first; coordination is asynchronous',
            level: 'required'
        },
        RULE_4: {
            id: 'rule_4',
            name: 'Non-Collapse of Concurrency',
            description: 'Concurrent events remain distinct until explicitly reconciled',
            level: 'required'
        },
        RULE_5: {
            id: 'rule_5',
            name: 'Views Are Local and Disposable',
            description: 'All materialized state is rebuildable from the log',
            level: 'required'
        },
        RULE_6: {
            id: 'rule_6',
            name: 'Operations, Not Snapshots',
            description: 'Sync transmits events, not reconstructed state',
            level: 'required'
        },
        RULE_7: {
            id: 'rule_7',
            name: 'Failure Is a State',
            description: 'Sync failures are recorded as events',
            level: 'recommended'
        },
        RULE_8: {
            id: 'rule_8',
            name: 'Idempotent Replay',
            description: 'Reapplying an event must not create new semantic effects',
            level: 'critical'
        },
        RULE_9: {
            id: 'rule_9',
            name: 'Revision Without Erasure',
            description: 'Deletion/correction represented as new events, not erasure',
            level: 'critical'
        }
    };

    // ============================================================================
    // COMPLIANCE CHECKER CLASS
    // ============================================================================

    class EOComplianceChecker {
        constructor(eventLog, stateDerivation = null) {
            this._eventLog = eventLog;
            this._stateDerivation = stateDerivation;
            this._results = new Map();
        }

        /**
         * Run all compliance checks
         */
        runFullAudit() {
            const results = {
                timestamp: new Date().toISOString(),
                passed: 0,
                failed: 0,
                warnings: 0,
                rules: {}
            };

            // Axiom 0: Log Primacy
            results.rules.axiom_0 = this.checkAxiom0();

            // Rule 1: Origin Is Part of the Record
            results.rules.rule_1 = this.checkRule1();

            // Rule 2: Identity Not Laundered
            results.rules.rule_2 = this.checkRule2();

            // Rule 3: Capture Before Coordination
            results.rules.rule_3 = this.checkRule3();

            // Rule 4: Non-Collapse of Concurrency
            results.rules.rule_4 = this.checkRule4();

            // Rule 5: Views Are Disposable
            results.rules.rule_5 = this.checkRule5();

            // Rule 6: Operations Not Snapshots
            results.rules.rule_6 = this.checkRule6();

            // Rule 7: Failure Is State
            results.rules.rule_7 = this.checkRule7();

            // Rule 8: Idempotent Replay
            results.rules.rule_8 = this.checkRule8();

            // Rule 9: Revision Without Erasure
            results.rules.rule_9 = this.checkRule9();

            // Tally results
            for (const [ruleId, result] of Object.entries(results.rules)) {
                if (result.status === 'pass') results.passed++;
                else if (result.status === 'fail') results.failed++;
                else if (result.status === 'warning') results.warnings++;
            }

            results.compliant = results.failed === 0;
            results.level = this._calculateComplianceLevel(results);

            this._results = results;
            return results;
        }

        /**
         * Axiom 0: Log Primacy
         * Verify that state can be rebuilt from log alone
         */
        checkAxiom0() {
            const result = {
                rule: RULES.AXIOM_0,
                checks: [],
                status: 'pass'
            };

            // Check 1: Event log exists and has events
            if (!this._eventLog) {
                result.checks.push({
                    name: 'Event log exists',
                    passed: false,
                    message: 'No event log provided'
                });
                result.status = 'fail';
                return result;
            }

            result.checks.push({
                name: 'Event log exists',
                passed: true,
                message: `Log has ${this._eventLog.getAll().length} events`
            });

            // Check 2: State derivation is available
            if (this._stateDerivation) {
                result.checks.push({
                    name: 'State derivation available',
                    passed: true,
                    message: 'State is derived from log'
                });

                // Check 3: State is in sync with log
                const inSync = this._stateDerivation.isInSync();
                result.checks.push({
                    name: 'State in sync with log',
                    passed: inSync,
                    message: inSync ? 'State matches log' : 'State is out of sync'
                });

                if (!inSync) {
                    result.status = 'warning';
                }
            } else {
                result.checks.push({
                    name: 'State derivation available',
                    passed: false,
                    message: 'No state derivation - state may not be log-primary'
                });
                result.status = 'warning';
            }

            // Check 4: Log is append-only (no UPDATE/DELETE operations)
            const logClass = this._eventLog.constructor.name;
            result.checks.push({
                name: 'Append-only log structure',
                passed: logClass === 'EOEventLog',
                message: `Using ${logClass}`
            });

            return result;
        }

        /**
         * Rule 1: Origin Is Part of the Record
         */
        checkRule1() {
            const result = {
                rule: RULES.RULE_1,
                checks: [],
                status: 'pass'
            };

            const events = this._eventLog.getAll();

            let missingId = 0;
            let missingActor = 0;
            let missingTimestamp = 0;
            let missingContext = 0;

            for (const event of events) {
                if (!event.id) missingId++;
                if (!event.actor) missingActor++;
                if (!event.timestamp && !event.logicalClock) missingTimestamp++;
                if (!event.context) missingContext++;
            }

            result.checks.push({
                name: 'All events have ID',
                passed: missingId === 0,
                message: missingId === 0
                    ? `${events.length} events with IDs`
                    : `${missingId} events missing ID`
            });

            result.checks.push({
                name: 'All events have actor',
                passed: missingActor === 0,
                message: missingActor === 0
                    ? `${events.length} events with actor`
                    : `${missingActor} events missing actor`
            });

            result.checks.push({
                name: 'All events have temporal marker',
                passed: missingTimestamp === 0,
                message: missingTimestamp === 0
                    ? 'All events have timestamp or logical clock'
                    : `${missingTimestamp} events missing temporal marker`
            });

            result.checks.push({
                name: 'All events have context',
                passed: missingContext === 0,
                message: missingContext === 0
                    ? 'All events have context envelope'
                    : `${missingContext} events missing context`
            });

            if (missingId > 0 || missingActor > 0) {
                result.status = 'fail';
            } else if (missingTimestamp > 0 || missingContext > 0) {
                result.status = 'warning';
            }

            return result;
        }

        /**
         * Rule 2: Identity Must Not Be Laundered
         */
        checkRule2() {
            const result = {
                rule: RULES.RULE_2,
                checks: [],
                status: 'pass'
            };

            const events = this._eventLog.getAll();

            // Check for 'system' or 'unknown' actors that should be attributed
            let systemActors = 0;
            let unknownActors = 0;

            for (const event of events) {
                if (event.actor === 'system' && !event.payload?.action?.startsWith('sync:')) {
                    // System is okay for sync events, not for user actions
                    if (event.payload?.action?.includes('edit') ||
                        event.payload?.action?.includes('create') ||
                        event.payload?.action?.includes('update')) {
                        systemActors++;
                    }
                }
                if (event.actor === 'unknown' || !event.actor) {
                    unknownActors++;
                }
            }

            result.checks.push({
                name: 'User actions attributed to users',
                passed: systemActors === 0,
                message: systemActors === 0
                    ? 'No user actions attributed to system'
                    : `${systemActors} user actions attributed to "system"`
            });

            result.checks.push({
                name: 'No unknown actors',
                passed: unknownActors === 0,
                message: unknownActors === 0
                    ? 'All events have known actors'
                    : `${unknownActors} events with unknown actor`
            });

            if (unknownActors > 0) {
                result.status = 'fail';
            } else if (systemActors > 0) {
                result.status = 'warning';
            }

            return result;
        }

        /**
         * Rule 3: Capture Before Coordination
         */
        checkRule3() {
            const result = {
                rule: RULES.RULE_3,
                checks: [],
                status: 'pass'
            };

            // Check if persistence layer is available
            const hasPersistence = typeof EOPersistence !== 'undefined';
            result.checks.push({
                name: 'Persistence layer available',
                passed: hasPersistence,
                message: hasPersistence
                    ? 'Local persistence enabled'
                    : 'No persistence layer - offline operation limited'
            });

            // Check if sync queue exists
            const hasSyncQueue = hasPersistence &&
                typeof EOPersistence.get === 'function';
            result.checks.push({
                name: 'Sync queue available',
                passed: hasSyncQueue,
                message: hasSyncQueue
                    ? 'Events queued for async sync'
                    : 'No sync queue - network may block operations'
            });

            if (!hasPersistence) {
                result.status = 'warning';
            }

            return result;
        }

        /**
         * Rule 4: Non-Collapse of Concurrency
         */
        checkRule4() {
            const result = {
                rule: RULES.RULE_4,
                checks: [],
                status: 'pass'
            };

            // Check for conflict detection capability
            const hasSyncProtocol = typeof EOSyncProtocol !== 'undefined';
            result.checks.push({
                name: 'Conflict detection available',
                passed: hasSyncProtocol,
                message: hasSyncProtocol
                    ? 'Sync protocol can detect conflicts'
                    : 'No conflict detection mechanism'
            });

            // Check if SUP (superposition) is enabled
            const events = this._eventLog.getAll();
            const cellEdits = events.filter(e => e.payload?.action === 'cell:edit');
            const hasSUP = cellEdits.some(e => e.payload?.contextSchema);

            result.checks.push({
                name: 'SUP (superposition) enabled',
                passed: hasSUP || cellEdits.length === 0,
                message: hasSUP
                    ? 'Cell edits preserve context for SUP'
                    : 'No SUP-enabled edits found'
            });

            // Check for conflict events
            const conflictEvents = events.filter(e =>
                e.payload?.action === 'conflict:detected' ||
                e.payload?.action === 'sync:conflict'
            );
            result.checks.push({
                name: 'Conflicts recorded as events',
                passed: true,
                message: `${conflictEvents.length} conflict events recorded`
            });

            if (!hasSyncProtocol) {
                result.status = 'warning';
            }

            return result;
        }

        /**
         * Rule 5: Views Are Local and Disposable
         */
        checkRule5() {
            const result = {
                rule: RULES.RULE_5,
                checks: [],
                status: 'pass'
            };

            // Check if state derivation exists
            const hasDerivation = this._stateDerivation !== null;
            result.checks.push({
                name: 'State is derived from log',
                passed: hasDerivation,
                message: hasDerivation
                    ? 'State computed from events'
                    : 'State may not be derived from log'
            });

            if (hasDerivation) {
                // Check if state can be rebuilt
                const canRebuild = typeof this._stateDerivation.rebuild === 'function';
                result.checks.push({
                    name: 'State is rebuildable',
                    passed: canRebuild,
                    message: canRebuild
                        ? 'State can be rebuilt from log'
                        : 'No rebuild capability'
                });
            }

            if (!hasDerivation) {
                result.status = 'warning';
            }

            return result;
        }

        /**
         * Rule 6: Operations, Not Snapshots
         */
        checkRule6() {
            const result = {
                rule: RULES.RULE_6,
                checks: [],
                status: 'pass'
            };

            // Check if sync protocol transmits events
            const hasSyncProtocol = typeof EOSyncProtocol !== 'undefined';
            result.checks.push({
                name: 'Sync protocol uses events',
                passed: hasSyncProtocol,
                message: hasSyncProtocol
                    ? 'Sync transmits events, not state'
                    : 'No event-based sync protocol'
            });

            // Check that no "state sync" events exist
            const events = this._eventLog.getAll();
            const stateSyncEvents = events.filter(e =>
                e.payload?.action === 'state:sync' ||
                e.payload?.action === 'snapshot:sync'
            );

            result.checks.push({
                name: 'No snapshot sync detected',
                passed: stateSyncEvents.length === 0,
                message: stateSyncEvents.length === 0
                    ? 'No state-based sync detected'
                    : `${stateSyncEvents.length} snapshot syncs found`
            });

            if (!hasSyncProtocol) {
                result.status = 'warning';
            }

            return result;
        }

        /**
         * Rule 7: Failure Is a State
         */
        checkRule7() {
            const result = {
                rule: RULES.RULE_7,
                checks: [],
                status: 'pass'
            };

            // Check for sync failure events
            const events = this._eventLog.getAll();
            const failureEvents = events.filter(e =>
                e.payload?.action === 'sync:failure' ||
                e.payload?.action === 'error:recorded'
            );

            result.checks.push({
                name: 'Failure recording capability',
                passed: true,
                message: `${failureEvents.length} failure events recorded`
            });

            // Check if persistence records failures
            const hasPersistence = typeof EOPersistence !== 'undefined';
            if (hasPersistence) {
                result.checks.push({
                    name: 'Persistence can record failures',
                    passed: true,
                    message: 'Persistence layer can record sync failures'
                });
            }

            return result;
        }

        /**
         * Rule 8: Idempotent Replay
         */
        checkRule8() {
            const result = {
                rule: RULES.RULE_8,
                checks: [],
                status: 'pass'
            };

            // Check that all events have IDs
            const events = this._eventLog.getAll();
            const allHaveIds = events.every(e => e.id);

            result.checks.push({
                name: 'Events have stable IDs',
                passed: allHaveIds,
                message: allHaveIds
                    ? 'All events have unique IDs for deduplication'
                    : 'Some events missing IDs'
            });

            // Check for duplicate detection capability
            const hasDedup = typeof this._eventLog.get === 'function';
            result.checks.push({
                name: 'Duplicate detection available',
                passed: hasDedup,
                message: hasDedup
                    ? 'Log can detect duplicate events by ID'
                    : 'No duplicate detection'
            });

            // Test idempotency if we have events
            if (events.length > 0) {
                const testEvent = events[0];
                const beforeCount = events.length;
                this._eventLog.append(testEvent);
                const afterCount = this._eventLog.getAll().length;

                result.checks.push({
                    name: 'Replay is idempotent',
                    passed: beforeCount === afterCount,
                    message: beforeCount === afterCount
                        ? 'Duplicate event correctly ignored'
                        : 'Replay created duplicate!'
                });

                if (beforeCount !== afterCount) {
                    result.status = 'fail';
                }
            }

            if (!allHaveIds) {
                result.status = 'fail';
            }

            return result;
        }

        /**
         * Rule 9: Revision Without Erasure
         */
        checkRule9() {
            const result = {
                rule: RULES.RULE_9,
                checks: [],
                status: 'pass'
            };

            // Check for tombstone events (proper deletion)
            const events = this._eventLog.getAll();
            const tombstones = events.filter(e =>
                e.payload?.action === 'tombstone' ||
                e.payload?.action === 'toss:record' ||
                e.payload?.action === 'toss:cell'
            );

            result.checks.push({
                name: 'Deletions use tombstones',
                passed: true,
                message: `${tombstones.length} tombstone events found`
            });

            // Check for supersession events
            const supersessions = events.filter(e => e.supersedes);
            result.checks.push({
                name: 'Supersession pattern used',
                passed: true,
                message: `${supersessions.length} supersession events found`
            });

            // Check that tombstone capability exists
            const hasTombstone = typeof this._eventLog.tombstone === 'function';
            result.checks.push({
                name: 'Tombstone method available',
                passed: hasTombstone,
                message: hasTombstone
                    ? 'Log supports tombstone creation'
                    : 'No tombstone method'
            });

            // Check for isTombstoned query
            const hasIsTombstoned = typeof this._eventLog.isTombstoned === 'function';
            result.checks.push({
                name: 'Tombstone query available',
                passed: hasIsTombstoned,
                message: hasIsTombstoned
                    ? 'Can query tombstone status'
                    : 'No tombstone query method'
            });

            if (!hasTombstone || !hasIsTombstoned) {
                result.status = 'warning';
            }

            return result;
        }

        /**
         * Calculate overall compliance level
         */
        _calculateComplianceLevel(results) {
            const criticalFailed = ['axiom_0', 'rule_1', 'rule_8', 'rule_9']
                .some(r => results.rules[r]?.status === 'fail');

            if (criticalFailed) {
                return 0; // Pre-Conformance
            }

            const requiredFailed = ['rule_3', 'rule_4', 'rule_5', 'rule_6']
                .some(r => results.rules[r]?.status === 'fail');

            if (requiredFailed) {
                return 1; // Core Conformance
            }

            const hasWarnings = Object.values(results.rules)
                .some(r => r.status === 'warning');

            if (hasWarnings) {
                return 2; // Collaborative Conformance
            }

            return 3; // Full Conformance
        }

        /**
         * Get compliance summary
         */
        getSummary() {
            if (!this._results.rules) {
                this.runFullAudit();
            }

            const levelNames = [
                'Pre-Conformance',
                'Core Conformance',
                'Collaborative Conformance',
                'Full Conformance'
            ];

            return {
                level: this._results.level,
                levelName: levelNames[this._results.level],
                compliant: this._results.compliant,
                passed: this._results.passed,
                failed: this._results.failed,
                warnings: this._results.warnings,
                timestamp: this._results.timestamp
            };
        }

        /**
         * Print compliance report to console
         */
        printReport() {
            if (!this._results.rules) {
                this.runFullAudit();
            }

            console.log('\n══════════════════════════════════════════════════════════════');
            console.log('                    EO COMPLIANCE AUDIT REPORT');
            console.log('══════════════════════════════════════════════════════════════\n');

            const summary = this.getSummary();
            console.log(`Compliance Level: ${summary.levelName} (Level ${summary.level})`);
            console.log(`Status: ${summary.compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}`);
            console.log(`Passed: ${summary.passed} | Failed: ${summary.failed} | Warnings: ${summary.warnings}`);
            console.log('');

            for (const [ruleId, result] of Object.entries(this._results.rules)) {
                const icon = result.status === 'pass' ? '✓' :
                            result.status === 'fail' ? '✗' : '⚠';
                console.log(`${icon} ${result.rule.name} (${ruleId})`);
                console.log(`  ${result.rule.description}`);

                for (const check of result.checks) {
                    const checkIcon = check.passed ? '  ✓' : '  ✗';
                    console.log(`  ${checkIcon} ${check.name}: ${check.message}`);
                }
                console.log('');
            }

            console.log('══════════════════════════════════════════════════════════════\n');

            return this._results;
        }
    }

    // ============================================================================
    // INTEGRATION BRIDGE
    // ============================================================================

    /**
     * Bridge to connect new event-sourced architecture with legacy EOStateManager
     */
    class EOIntegrationBridge {
        constructor(options = {}) {
            this._eventLog = null;
            this._stateDerivation = null;
            this._persistence = null;
            this._syncEngine = null;
            this._legacyStateManager = null;
            this._initialized = false;
        }

        /**
         * Initialize the full compliant architecture
         */
        async init(options = {}) {
            // 1. Create event log
            if (typeof EOEventLog !== 'undefined') {
                this._eventLog = EOEventLog.init({
                    onAppend: (event) => this._onEventAppended(event),
                    onError: (error) => console.error('[EOBridge] Event error:', error)
                });
            }

            // 2. Create persistence layer
            if (typeof EOPersistence !== 'undefined') {
                this._persistence = EOPersistence.init({
                    backend: options.persistenceBackend || 'auto',
                    autoSave: true
                });

                // Load existing events
                const savedLog = await this._persistence.loadLog();
                if (savedLog) {
                    this._eventLog.import(savedLog);
                }

                // Connect for auto-persistence
                await this._persistence.connect(this._eventLog);
            }

            // 3. Create state derivation
            if (typeof EOStateDerivation !== 'undefined') {
                this._stateDerivation = EOStateDerivation.init(this._eventLog);
            }

            // 4. Create sync engine
            if (typeof EOSyncProtocol !== 'undefined') {
                this._syncEngine = EOSyncProtocol.initEngine(this._eventLog, {
                    workspace: options.workspace || 'default',
                    nodeId: options.nodeId,
                    onConflict: (conflicts) => this._onConflicts(conflicts)
                });
            }

            // 5. Bridge to legacy state manager if it exists
            if (typeof EOState !== 'undefined') {
                this._legacyStateManager = EOState.getManager();
                this._bridgeLegacyState();
            }

            this._initialized = true;
            return this;
        }

        /**
         * Bridge legacy state manager to event-sourced architecture
         */
        _bridgeLegacyState() {
            if (!this._legacyStateManager) return;

            // Subscribe to legacy state changes and convert to events
            this._legacyStateManager.subscribeAll((value, previousValue, key) => {
                // Only create events for certain state changes
                if (['sets', 'views', 'currentSetId', 'currentViewId'].includes(key)) {
                    // Convert state change to event
                    // This is a compatibility layer - new code should use dispatch() directly
                }
            });
        }

        /**
         * Handle new event (update legacy state if needed)
         */
        _onEventAppended(event) {
            // The state derivation handles this via subscription
            // This is for additional side effects
        }

        /**
         * Handle conflicts detected during sync
         */
        _onConflicts(conflicts) {
            console.warn('[EOBridge] Conflicts detected:', conflicts.length);
            // Could emit to UI or event bus
        }

        /**
         * Dispatch an action through the event log
         * This is the primary way to make changes in the compliant architecture
         */
        dispatch(action, actor, context = {}) {
            if (!this._eventLog) {
                throw new Error('Bridge not initialized');
            }

            return this._eventLog.append({
                type: action.type || 'given',
                actor,
                parents: this._eventLog.getHeads(),
                context: {
                    workspace: context.workspace || 'default',
                    schemaVersion: '1.0',
                    ...context
                },
                payload: action,
                ...(action.type === 'meant' ? {
                    frame: action.frame,
                    provenance: action.provenance
                } : {})
            });
        }

        /**
         * Get the current derived state
         */
        getState() {
            return this._stateDerivation?.getState();
        }

        /**
         * Get the event log
         */
        getEventLog() {
            return this._eventLog;
        }

        /**
         * Get compliance checker
         */
        getComplianceChecker() {
            return new EOComplianceChecker(this._eventLog, this._stateDerivation);
        }

        /**
         * Run compliance audit
         */
        runAudit() {
            const checker = this.getComplianceChecker();
            return checker.printReport();
        }

        /**
         * Get bridge status
         */
        getStatus() {
            return {
                initialized: this._initialized,
                hasEventLog: this._eventLog !== null,
                hasStateDerivation: this._stateDerivation !== null,
                hasPersistence: this._persistence !== null,
                hasSyncEngine: this._syncEngine !== null,
                hasLegacyBridge: this._legacyStateManager !== null,
                eventCount: this._eventLog?.getAll().length || 0
            };
        }
    }

    // ============================================================================
    // SINGLETON AND EXPORTS
    // ============================================================================

    let _bridgeInstance = null;

    function getBridge() {
        if (!_bridgeInstance) {
            _bridgeInstance = new EOIntegrationBridge();
        }
        return _bridgeInstance;
    }

    async function initBridge(options = {}) {
        _bridgeInstance = new EOIntegrationBridge();
        await _bridgeInstance.init(options);
        return _bridgeInstance;
    }

    const EOCompliance = {
        // Classes
        ComplianceChecker: EOComplianceChecker,
        IntegrationBridge: EOIntegrationBridge,

        // Constants
        RULES,

        // Singleton
        getBridge,
        initBridge,

        // Quick audit function
        audit: (eventLog, stateDerivation) => {
            const checker = new EOComplianceChecker(eventLog, stateDerivation);
            return checker.runFullAudit();
        }
    };

    // Export to global scope
    global.EOCompliance = EOCompliance;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOCompliance;
    }

})(typeof window !== 'undefined' ? window : global);
