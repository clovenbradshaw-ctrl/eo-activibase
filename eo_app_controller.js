/**
 * EO Application Controller
 * Unified coordination layer for the EO Activibase application
 *
 * EO Operator: SYN (Synthesize)
 * - Consolidates: eo_integration.js, eo_import_integration.js, eo_three_level_integration.js
 * - Provides single entry point for application coordination
 * - Integrates with EOState and EOEventBus
 *
 * Philosophy: Single coordinator that wires all subsystems together
 * without duplicating logic from the subsystems themselves.
 */

(function(global) {
    'use strict';

    class EOAppController {
        constructor(options = {}) {
            this.options = {
                enableSUP: true,
                enableStability: true,
                enableContextInference: true,
                autoClassifyStability: true,
                debug: false,
                ...options
            };

            // Core dependencies - injected or created
            this.state = options.state || null;
            this.eventBus = options.eventBus || null;

            // Subsystem references (lazy initialized)
            this._contextEngine = null;
            this._importManager = null;
            this._tossPile = null;
            this._relationsManager = null;

            // UI integration
            this._cellEditor = null;
            this._recordModal = null;
            this._fieldLens = null;

            // Callbacks for legacy compatibility
            this.callbacks = {
                onSetCreated: options.onSetCreated || (() => {}),
                onRecordsAdded: options.onRecordsAdded || (() => {}),
                onViewCreated: options.onViewCreated || (() => {}),
                showToast: options.showToast || ((msg) => console.log('[EO]', msg)),
                createEvent: options.createEvent || (() => {}),
                switchSet: options.switchSet || (() => {}),
                render: options.render || (() => {})
            };

            // Initialization state
            this._initialized = false;
        }

        // ============================================================================
        // INITIALIZATION
        // ============================================================================

        /**
         * Initialize the application controller
         * @param {Object} config - Configuration options
         */
        initialize(config = {}) {
            if (this._initialized) {
                console.warn('[EOAppController] Already initialized');
                return this;
            }

            console.log('[EO] Initializing Application Controller');

            // Initialize state manager
            if (!this.state && typeof EOState !== 'undefined') {
                this.state = EOState.init(config.initialState);
            }

            // Initialize event bus
            if (!this.eventBus && typeof EOEventBus !== 'undefined') {
                const { bus, rhythms } = EOEventBus.init({ debug: this.options.debug });
                this.eventBus = bus;
                this.rhythms = rhythms;
            }

            // Set up event handlers
            this._setupEventHandlers();

            // Initialize subsystems
            this._initializeSubsystems();

            // Set up operational rhythms (ALT operator)
            this._setupRhythms();

            this._initialized = true;
            console.log('[EO] Application Controller initialized');

            return this;
        }

        /**
         * Initialize subsystem references
         */
        _initializeSubsystems() {
            // Context Engine (with merged SUP detection)
            if (typeof EOContextEngine !== 'undefined') {
                this._contextEngine = new EOContextEngine();
            }

            // Import Manager
            if (typeof EOImportManager !== 'undefined') {
                this._importManager = new EOImportManager();
            }

            // Toss Pile
            if (typeof TossPile !== 'undefined') {
                this._tossPile = TossPile;
            }
        }

        /**
         * Set up event handlers
         */
        _setupEventHandlers() {
            if (!this.eventBus) return;

            const events = typeof EO_EVENTS !== 'undefined' ? EO_EVENTS : {};

            // Record events
            this.eventBus.on(events.RECORD_CREATED, (data) => {
                this._handleRecordCreated(data);
            });

            this.eventBus.on(events.RECORD_UPDATED, (data) => {
                this._handleRecordUpdated(data);
            });

            this.eventBus.on(events.RECORD_DELETED, (data) => {
                this._handleRecordDeleted(data);
            });

            // Cell events
            this.eventBus.on(events.CELL_EDITED, (data) => {
                this._handleCellEdit(data);
            });

            // Import events
            this.eventBus.on(events.IMPORT_COMPLETED, (data) => {
                this._handleImportCompleted(data);
            });

            // Error handling
            this.eventBus.on(events.ERROR_OCCURRED, (data) => {
                console.error('[EOAppController] Error:', data);
            });
        }

        /**
         * Set up operational rhythms (ALT operator)
         */
        _setupRhythms() {
            if (!this.rhythms) return;

            // Auto-save rhythm (30 seconds)
            this._autoSaveRhythm = this.rhythms.create(
                'auto_save',
                30000,
                () => this._performAutoSave()
            );

            // Context cache cleanup (5 minutes)
            this._cacheCleanupRhythm = this.rhythms.create(
                'cache_cleanup',
                5 * 60 * 1000,
                () => this._performCacheCleanup()
            );

            // Stability recalculation (5 minutes)
            this._stabilityRhythm = this.rhythms.create(
                'stability_recalc',
                5 * 60 * 1000,
                () => this._recalculateStability()
            );
        }

        /**
         * Start operational rhythms
         */
        startRhythms() {
            if (this._autoSaveRhythm) this._autoSaveRhythm.start();
            if (this._cacheCleanupRhythm) this._cacheCleanupRhythm.start();
            if (this._stabilityRhythm) this._stabilityRhythm.start();
        }

        /**
         * Stop operational rhythms
         */
        stopRhythms() {
            if (this._autoSaveRhythm) this._autoSaveRhythm.stop();
            if (this._cacheCleanupRhythm) this._cacheCleanupRhythm.stop();
            if (this._stabilityRhythm) this._stabilityRhythm.stop();
        }

        // ============================================================================
        // USER & CONTEXT
        // ============================================================================

        /**
         * Set current user
         */
        setCurrentUser(userId, userName) {
            if (this._contextEngine) {
                this._contextEngine.setCurrentUser(userId, userName);
            }
            if (this.state) {
                this.state.set('user', { id: userId, name: userName, preferences: {} });
            }
            return this;
        }

        /**
         * Set view context (affects dominant value selection)
         */
        setViewContext(context) {
            if (this._contextEngine) {
                this._contextEngine.setViewContext(context);
            }
            return this;
        }

        // ============================================================================
        // IMPORT HANDLING
        // ============================================================================

        /**
         * Handle file import
         * @param {File} file - File to import
         * @param {Object} options - Import options
         */
        async handleFileImport(file, options = {}) {
            if (!this._importManager) {
                console.error('[EOAppController] ImportManager not available');
                return null;
            }

            try {
                const imp = await this._importManager.createImportFromFile(file);

                // Emit import completed event
                if (this.eventBus) {
                    this.eventBus.emit(EO_EVENTS?.IMPORT_COMPLETED || 'import:completed', {
                        importId: imp.id,
                        filename: file.name,
                        rowCount: imp.rowCount,
                        columnCount: imp.columnCount
                    }, { source: 'app_controller' });
                }

                return imp;
            } catch (error) {
                console.error('[EOAppController] Import failed:', error);
                this.callbacks.showToast(`Import failed: ${error.message}`);
                return null;
            }
        }

        /**
         * Add import to set
         */
        addImportToSet(importId, setId = null, newSetName = null, options = {}) {
            const imp = this._importManager?.getImport(importId);
            if (!imp) {
                return { success: false, error: 'Import not found' };
            }

            const state = this.state?.getState() || this.options.state;
            if (!state) {
                return { success: false, error: 'State not available' };
            }

            // Create or get target set
            let targetSetId = setId;
            let createdNewSet = false;

            if (!setId) {
                const setName = newSetName || imp.fileMetadata?.filenameAnalysis?.baseName || 'Imported Data';
                targetSetId = this._createSet(setName, imp);
                createdNewSet = true;
            }

            const targetSet = state.sets.get(targetSetId);
            if (!targetSet) {
                return { success: false, error: 'Target set not found' };
            }

            // Create records with provenance
            const recordsAdded = this._createRecordsFromImport(targetSet, imp);

            // Track usage
            if (this._importManager) {
                this._importManager.trackUsage(importId, 'set', targetSetId, recordsAdded.length);
            }

            // Create import view
            const viewId = this._createImportView(targetSet, imp, recordsAdded);

            this.callbacks.showToast(`Added ${recordsAdded.length} records from ${imp.name}`);
            this.callbacks.onRecordsAdded(targetSetId, recordsAdded);

            if (createdNewSet) {
                this.callbacks.onSetCreated(targetSetId);
            }

            this.callbacks.switchSet(targetSetId, viewId);

            return {
                success: true,
                setId: targetSetId,
                viewId,
                recordsAdded: recordsAdded.length,
                createdNewSet
            };
        }

        // ============================================================================
        // CELL & RECORD EDITING
        // ============================================================================

        /**
         * Handle cell edit
         */
        handleEdit(recordId, fieldName, oldValue, newValue) {
            const state = this.state?.getState() || this.options.state;
            if (!state) return null;

            const set = state.sets.get(state.currentSetId);
            if (!set) return null;

            const record = set.records.get(recordId);
            if (!record) return null;

            // Infer context from edit
            let context = null;
            if (this._contextEngine) {
                context = this._contextEngine.inferFromEdit({
                    columnName: fieldName,
                    oldValue,
                    newValue,
                    recordData: record
                });
            }

            // Update record
            record[fieldName] = newValue;
            record.updatedAt = new Date().toISOString();

            // Emit event
            if (this.eventBus) {
                this.eventBus.emit(EO_EVENTS?.CELL_EDITED || 'cell:edited', {
                    recordId,
                    fieldName,
                    oldValue,
                    newValue,
                    context
                }, { source: 'app_controller' });
            }

            // Create provenance event
            this.callbacks.createEvent('Cell Edited', 'ALT', {
                type: 'Cell',
                recordId,
                fieldId: fieldName
            }, {
                oldValue,
                newValue,
                context
            });

            return record;
        }

        /**
         * Handle record creation
         */
        createRecord(setId, data = {}) {
            const state = this.state?.getState() || this.options.state;
            if (!state) return null;

            const set = state.sets.get(setId);
            if (!set) return null;

            const recordId = this._generateId('rec');
            const record = {
                id: recordId,
                ...data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            set.records.set(recordId, record);

            // Emit event
            if (this.eventBus) {
                this.eventBus.emit(EO_EVENTS?.RECORD_CREATED || 'record:created', {
                    recordId,
                    setId,
                    record
                }, { source: 'app_controller' });
            }

            return record;
        }

        // ============================================================================
        // TOSS PILE OPERATIONS
        // ============================================================================

        /**
         * Toss record to pile
         */
        tossRecord(recordId) {
            const state = this.state?.getState() || this.options.state;
            if (!state || !this._tossPile) return null;

            const action = this._tossPile.tossRecord(state, recordId);

            if (action && this.eventBus) {
                this.eventBus.emit(EO_EVENTS?.TOSS_RECORD || 'toss:record', {
                    actionId: action.id,
                    recordId,
                    entryCount: action.entryIds.length
                }, { source: 'app_controller' });
            }

            return action;
        }

        /**
         * Pick up from toss pile
         */
        pickUpAction(actionId) {
            const state = this.state?.getState() || this.options.state;
            if (!state || !this._tossPile) return null;

            const result = this._tossPile.pickUpAction(state, actionId);

            if (result && this.eventBus) {
                this.eventBus.emit(EO_EVENTS?.PICKUP_ACTION || 'pickup:action', {
                    actionId,
                    restoredCount: result.restoredEntries.length
                }, { source: 'app_controller' });
            }

            return result;
        }

        // ============================================================================
        // SUP (SUPERPOSITION) DETECTION
        // ============================================================================

        /**
         * Detect superposition in a cell
         */
        detectSuperposition(cell) {
            if (!this._contextEngine) return false;
            return this._contextEngine.detectSuperposition(cell);
        }

        /**
         * Get superposition summary
         */
        getSuperpositionSummary(cell) {
            if (!this._contextEngine) return null;
            return this._contextEngine.getSuperpositionSummary(cell);
        }

        /**
         * Get strongest value from superposition
         */
        getStrongestValue(cell, viewContext) {
            if (!this._contextEngine) return null;
            return this._contextEngine.getStrongestValue(cell, viewContext);
        }

        // ============================================================================
        // THREE-LEVEL DETAIL INTEGRATION
        // ============================================================================

        /**
         * Attach to grid for three-level detail
         */
        attachToGrid(container) {
            if (this._cellEditor && typeof this._cellEditor.attachToGrid === 'function') {
                this._cellEditor.attachToGrid(container, {
                    onEdit: (recordId, fieldName, oldValue, newValue) => {
                        this.handleEdit(recordId, fieldName, oldValue, newValue);
                    },
                    onViewDetails: (recordId) => {
                        this.showRecordModal(recordId);
                    }
                });
            }
        }

        /**
         * Show record modal (Level 2)
         */
        showRecordModal(recordId) {
            if (this._recordModal) {
                this._recordModal.show(recordId);
            }
        }

        /**
         * Show field lens panel (Level 3)
         */
        showFieldLens(recordId, fieldName) {
            if (this._fieldLens) {
                this._fieldLens.show(recordId, fieldName);
            }
        }

        // ============================================================================
        // STATISTICS & DEBUG
        // ============================================================================

        /**
         * Get application statistics
         */
        getStatistics() {
            const state = this.state?.getState() || this.options.state;
            if (!state) return null;

            const stats = {
                sets: state.sets?.size || 0,
                views: state.views?.size || 0,
                entities: state.entities?.size || 0,
                imports: this._importManager?.getAllImports().length || 0
            };

            if (state.tossPile) {
                stats.tossPile = this._tossPile?.getTossPileStats(state) || null;
            }

            if (this.eventBus) {
                stats.events = this.eventBus.getStats();
            }

            if (this.rhythms) {
                stats.rhythms = this.rhythms.getAllStats();
            }

            return stats;
        }

        /**
         * Enable debug mode
         */
        enableDebug() {
            this.options.debug = true;

            if (this.eventBus) {
                this.eventBus.debug(true);
            }

            global.eo_debug = {
                controller: this,
                state: this.state,
                eventBus: this.eventBus,
                contextEngine: this._contextEngine,
                importManager: this._importManager,
                tossPile: this._tossPile
            };

            console.log('[EO] Debug mode enabled. Access via window.eo_debug');
            return this;
        }

        // ============================================================================
        // PRIVATE HELPERS
        // ============================================================================

        _generateId(prefix) {
            return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        _createSet(name, imp) {
            const state = this.state?.getState() || this.options.state;
            if (!state) return null;

            const setId = this._generateId('set');

            // Create schema from import
            const schema = (imp.headers || []).map(header => ({
                id: this._slugifyFieldId(header),
                name: header,
                type: imp.schema?.inferredTypes?.[header] || 'TEXT',
                width: '150px',
                config: {}
            }));

            const newSet = {
                id: setId,
                name,
                schema,
                records: new Map(),
                views: new Map(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            state.sets.set(setId, newSet);
            return setId;
        }

        _createRecordsFromImport(targetSet, imp) {
            const records = [];
            const timestamp = Date.now();

            (imp.rows || []).forEach((row, index) => {
                const recordId = this._generateId('rec');
                const record = { id: recordId };

                (imp.headers || []).forEach(header => {
                    const fieldId = this._slugifyFieldId(header);
                    record[fieldId] = row[header];
                });

                record._provenance = {
                    importId: imp.id,
                    importName: imp.name,
                    sourceRow: index,
                    importedAt: new Date(timestamp).toISOString()
                };

                targetSet.records.set(recordId, record);
                records.push(record);
            });

            return records;
        }

        _createImportView(targetSet, imp, records) {
            const viewId = this._generateId('view_import');

            const view = {
                id: viewId,
                name: `Import: ${imp.name}`,
                type: 'grid',
                setId: targetSet.id,
                filters: [[{
                    field: '_provenance.importId',
                    operator: 'equals',
                    value: imp.id
                }]],
                sorts: [],
                visibleFields: targetSet.schema.map(f => f.id),
                createdAt: new Date().toISOString()
            };

            targetSet.views.set(viewId, view);
            return viewId;
        }

        _slugifyFieldId(name) {
            return (name || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '')
                .substring(0, 50);
        }

        _handleRecordCreated(data) {
            if (this.options.debug) {
                console.log('[EOAppController] Record created:', data);
            }
        }

        _handleRecordUpdated(data) {
            if (this.options.debug) {
                console.log('[EOAppController] Record updated:', data);
            }
        }

        _handleRecordDeleted(data) {
            if (this.options.debug) {
                console.log('[EOAppController] Record deleted:', data);
            }
        }

        _handleCellEdit(data) {
            if (this.options.debug) {
                console.log('[EOAppController] Cell edited:', data);
            }
        }

        _handleImportCompleted(data) {
            if (this.options.debug) {
                console.log('[EOAppController] Import completed:', data);
            }
        }

        _performAutoSave() {
            // Placeholder for auto-save logic
            if (this.options.debug) {
                console.log('[EOAppController] Auto-save tick');
            }
        }

        _performCacheCleanup() {
            // Placeholder for cache cleanup logic
            if (this.options.debug) {
                console.log('[EOAppController] Cache cleanup tick');
            }
        }

        _recalculateStability() {
            // Placeholder for stability recalculation
            if (this.options.debug) {
                console.log('[EOAppController] Stability recalculation tick');
            }
        }

        /**
         * Cleanup and destroy
         */
        destroy() {
            this.stopRhythms();

            if (this.eventBus) {
                this.eventBus.offAll();
            }

            this._initialized = false;
            console.log('[EO] Application Controller destroyed');
        }
    }

    // ============================================================================
    // SINGLETON
    // ============================================================================

    let _instance = null;

    function getAppController() {
        if (!_instance) {
            _instance = new EOAppController();
        }
        return _instance;
    }

    function initAppController(options = {}) {
        _instance = new EOAppController(options);
        return _instance.initialize(options);
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOApp = {
        Controller: EOAppController,
        get: getAppController,
        init: initAppController
    };

    global.EOAppController = EOAppController;
    global.EOApp = EOApp;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOApp;
    }

})(typeof window !== 'undefined' ? window : global);
