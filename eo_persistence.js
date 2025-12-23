/**
 * EO Persistence Layer
 * Local-first persistence for the event log
 *
 * Implements Rule 3: Capture Before Coordination
 * - Events are recorded locally first
 * - Network sync is asynchronous
 * - Offline operation is first-class
 *
 * Also supports:
 * - Rule 7: Failure Is a State (sync failures recorded)
 * - Rule 8: Idempotent Replay (log import/export)
 */

(function(global) {
    'use strict';

    // ============================================================================
    // STORAGE BACKENDS
    // ============================================================================

    /**
     * LocalStorage backend (simple, synchronous)
     */
    class LocalStorageBackend {
        constructor(prefix = 'eo_') {
            this._prefix = prefix;
            this._available = this._checkAvailable();
        }

        _checkAvailable() {
            try {
                const test = '__storage_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        }

        isAvailable() {
            return this._available;
        }

        async get(key) {
            if (!this._available) return null;
            try {
                const data = localStorage.getItem(this._prefix + key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.error('[LocalStorageBackend] Get error:', e);
                return null;
            }
        }

        async set(key, value) {
            if (!this._available) return false;
            try {
                localStorage.setItem(this._prefix + key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('[LocalStorageBackend] Set error:', e);
                return false;
            }
        }

        async delete(key) {
            if (!this._available) return false;
            try {
                localStorage.removeItem(this._prefix + key);
                return true;
            } catch (e) {
                return false;
            }
        }

        async keys() {
            if (!this._available) return [];
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(this._prefix)) {
                    keys.push(key.slice(this._prefix.length));
                }
            }
            return keys;
        }

        async clear() {
            if (!this._available) return false;
            const keysToRemove = await this.keys();
            keysToRemove.forEach(key => {
                localStorage.removeItem(this._prefix + key);
            });
            return true;
        }

        getUsage() {
            if (!this._available) return { used: 0, total: 0 };
            let used = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(this._prefix)) {
                    used += localStorage.getItem(key)?.length || 0;
                }
            }
            // localStorage limit is typically 5-10MB
            return { used, total: 5 * 1024 * 1024 };
        }
    }

    /**
     * IndexedDB backend (async, larger storage)
     */
    class IndexedDBBackend {
        constructor(dbName = 'eo_eventlog', storeName = 'events') {
            this._dbName = dbName;
            this._storeName = storeName;
            this._db = null;
            this._ready = this._init();
        }

        async _init() {
            return new Promise((resolve, reject) => {
                if (!('indexedDB' in global)) {
                    resolve(false);
                    return;
                }

                const request = indexedDB.open(this._dbName, 1);

                request.onerror = () => {
                    console.error('[IndexedDBBackend] Open error');
                    resolve(false);
                };

                request.onsuccess = () => {
                    this._db = request.result;
                    resolve(true);
                };

                request.onupgradeneeded = (e) => {
                    const db = e.target.result;

                    // Main event store
                    if (!db.objectStoreNames.contains(this._storeName)) {
                        const store = db.createObjectStore(this._storeName, { keyPath: 'key' });
                        store.createIndex('timestamp', 'timestamp', { unique: false });
                    }

                    // Event log store (append-only)
                    if (!db.objectStoreNames.contains('eventlog')) {
                        const logStore = db.createObjectStore('eventlog', { keyPath: 'id' });
                        logStore.createIndex('logicalClock', 'logicalClock', { unique: false });
                        logStore.createIndex('actor', 'actor', { unique: false });
                        logStore.createIndex('type', 'type', { unique: false });
                    }

                    // Sync queue store
                    if (!db.objectStoreNames.contains('syncqueue')) {
                        db.createObjectStore('syncqueue', { keyPath: 'id', autoIncrement: true });
                    }
                };
            });
        }

        async isAvailable() {
            await this._ready;
            return this._db !== null;
        }

        async get(key) {
            await this._ready;
            if (!this._db) return null;

            return new Promise((resolve) => {
                const tx = this._db.transaction(this._storeName, 'readonly');
                const store = tx.objectStore(this._storeName);
                const request = store.get(key);

                request.onsuccess = () => {
                    resolve(request.result?.value || null);
                };
                request.onerror = () => resolve(null);
            });
        }

        async set(key, value) {
            await this._ready;
            if (!this._db) return false;

            return new Promise((resolve) => {
                const tx = this._db.transaction(this._storeName, 'readwrite');
                const store = tx.objectStore(this._storeName);
                const request = store.put({
                    key,
                    value,
                    timestamp: Date.now()
                });

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        }

        async delete(key) {
            await this._ready;
            if (!this._db) return false;

            return new Promise((resolve) => {
                const tx = this._db.transaction(this._storeName, 'readwrite');
                const store = tx.objectStore(this._storeName);
                const request = store.delete(key);

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        }

        async keys() {
            await this._ready;
            if (!this._db) return [];

            return new Promise((resolve) => {
                const tx = this._db.transaction(this._storeName, 'readonly');
                const store = tx.objectStore(this._storeName);
                const request = store.getAllKeys();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        }

        async clear() {
            await this._ready;
            if (!this._db) return false;

            return new Promise((resolve) => {
                const tx = this._db.transaction(this._storeName, 'readwrite');
                const store = tx.objectStore(this._storeName);
                const request = store.clear();

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        }

        // ========================================================================
        // EVENT LOG SPECIFIC METHODS (Append-only)
        // ========================================================================

        async appendEvent(event) {
            await this._ready;
            if (!this._db) return false;

            return new Promise((resolve) => {
                const tx = this._db.transaction('eventlog', 'readwrite');
                const store = tx.objectStore('eventlog');
                const request = store.add(event);

                request.onsuccess = () => resolve(true);
                request.onerror = () => {
                    // Might be duplicate (idempotent)
                    if (request.error?.name === 'ConstraintError') {
                        resolve(true); // Already exists, that's fine
                    } else {
                        resolve(false);
                    }
                };
            });
        }

        async getAllEvents() {
            await this._ready;
            if (!this._db) return [];

            return new Promise((resolve) => {
                const tx = this._db.transaction('eventlog', 'readonly');
                const store = tx.objectStore('eventlog');
                const index = store.index('logicalClock');
                const request = index.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        }

        async getEventsSince(logicalClock) {
            await this._ready;
            if (!this._db) return [];

            return new Promise((resolve) => {
                const tx = this._db.transaction('eventlog', 'readonly');
                const store = tx.objectStore('eventlog');
                const index = store.index('logicalClock');
                const range = IDBKeyRange.lowerBound(logicalClock, true);
                const request = index.getAll(range);

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        }

        async getEventCount() {
            await this._ready;
            if (!this._db) return 0;

            return new Promise((resolve) => {
                const tx = this._db.transaction('eventlog', 'readonly');
                const store = tx.objectStore('eventlog');
                const request = store.count();

                request.onsuccess = () => resolve(request.result || 0);
                request.onerror = () => resolve(0);
            });
        }

        // ========================================================================
        // SYNC QUEUE METHODS (Rule 3 - offline queue)
        // ========================================================================

        async enqueueSyncEvent(event) {
            await this._ready;
            if (!this._db) return false;

            return new Promise((resolve) => {
                const tx = this._db.transaction('syncqueue', 'readwrite');
                const store = tx.objectStore('syncqueue');
                const request = store.add({
                    event,
                    enqueuedAt: Date.now(),
                    attempts: 0
                });

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        }

        async dequeueSyncEvents(limit = 100) {
            await this._ready;
            if (!this._db) return [];

            return new Promise((resolve) => {
                const tx = this._db.transaction('syncqueue', 'readonly');
                const store = tx.objectStore('syncqueue');
                const request = store.getAll(null, limit);

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        }

        async removeSyncEvent(id) {
            await this._ready;
            if (!this._db) return false;

            return new Promise((resolve) => {
                const tx = this._db.transaction('syncqueue', 'readwrite');
                const store = tx.objectStore('syncqueue');
                const request = store.delete(id);

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        }

        async getSyncQueueSize() {
            await this._ready;
            if (!this._db) return 0;

            return new Promise((resolve) => {
                const tx = this._db.transaction('syncqueue', 'readonly');
                const store = tx.objectStore('syncqueue');
                const request = store.count();

                request.onsuccess = () => resolve(request.result || 0);
                request.onerror = () => resolve(0);
            });
        }
    }

    // ============================================================================
    // PERSISTENCE MANAGER
    // ============================================================================

    class EOPersistence {
        constructor(options = {}) {
            this._options = {
                backend: options.backend || 'auto',
                prefix: options.prefix || 'eo_',
                autoSave: options.autoSave !== false,
                saveDebounce: options.saveDebounce || 1000,
                onSave: options.onSave || null,
                onLoad: options.onLoad || null,
                onError: options.onError || null
            };

            // Initialize backend
            this._backend = null;
            this._idbBackend = null;
            this._ready = this._initBackend();

            // Debounced save
            this._saveTimer = null;
            this._pendingSave = false;

            // Event log reference
            this._eventLog = null;
            this._unsubscribe = null;
        }

        async _initBackend() {
            // Try IndexedDB first (larger storage, async)
            if (this._options.backend === 'auto' || this._options.backend === 'indexeddb') {
                this._idbBackend = new IndexedDBBackend();
                if (await this._idbBackend.isAvailable()) {
                    this._backend = this._idbBackend;
                    return true;
                }
            }

            // Fall back to localStorage
            if (this._options.backend === 'auto' || this._options.backend === 'localstorage') {
                const lsBackend = new LocalStorageBackend(this._options.prefix);
                if (lsBackend.isAvailable()) {
                    this._backend = lsBackend;
                    return true;
                }
            }

            console.warn('[EOPersistence] No storage backend available');
            return false;
        }

        async isAvailable() {
            await this._ready;
            return this._backend !== null;
        }

        // ========================================================================
        // EVENT LOG INTEGRATION
        // ========================================================================

        /**
         * Connect to an event log for automatic persistence
         */
        async connect(eventLog) {
            await this._ready;
            this._eventLog = eventLog;

            // Subscribe to new events
            this._unsubscribe = eventLog.subscribe((event) => {
                this._onNewEvent(event);
            });

            return true;
        }

        /**
         * Disconnect from event log
         */
        disconnect() {
            if (this._unsubscribe) {
                this._unsubscribe();
                this._unsubscribe = null;
            }
            this._eventLog = null;
        }

        /**
         * Handle new event (persist immediately or queue)
         */
        async _onNewEvent(event) {
            if (!this._backend) return;

            // For IndexedDB, use the specialized event log store
            if (this._idbBackend && this._backend === this._idbBackend) {
                await this._idbBackend.appendEvent(event);

                // Also add to sync queue if configured
                if (this._options.autoSync) {
                    await this._idbBackend.enqueueSyncEvent(event);
                }
            } else {
                // For localStorage, debounce full saves
                this._scheduleSave();
            }
        }

        /**
         * Schedule a debounced save
         */
        _scheduleSave() {
            if (this._saveTimer) {
                clearTimeout(this._saveTimer);
            }

            this._pendingSave = true;
            this._saveTimer = setTimeout(() => {
                this._saveTimer = null;
                this._pendingSave = false;
                this.saveLog();
            }, this._options.saveDebounce);
        }

        // ========================================================================
        // SAVE / LOAD OPERATIONS
        // ========================================================================

        /**
         * Save the entire event log
         */
        async saveLog() {
            await this._ready;
            if (!this._backend || !this._eventLog) return false;

            try {
                const exported = this._eventLog.export();
                const success = await this._backend.set('eventlog', exported);

                if (success) {
                    this._options.onSave?.({
                        eventCount: exported.events.length,
                        timestamp: exported.timestamp
                    });
                }

                return success;
            } catch (err) {
                this._options.onError?.({
                    operation: 'save',
                    error: err.message
                });
                return false;
            }
        }

        /**
         * Load the event log from persistence
         */
        async loadLog() {
            await this._ready;
            if (!this._backend) return null;

            try {
                // For IndexedDB, get from event log store
                if (this._idbBackend && this._backend === this._idbBackend) {
                    const events = await this._idbBackend.getAllEvents();
                    if (events.length > 0) {
                        // Reconstruct log format
                        const allParents = new Set();
                        events.forEach(e => e.parents?.forEach(p => allParents.add(p)));
                        const heads = events.filter(e => !allParents.has(e.id)).map(e => e.id);

                        const data = {
                            version: 1,
                            timestamp: new Date().toISOString(),
                            logicalClock: Math.max(...events.map(e => e.logicalClock || 0)),
                            events,
                            heads
                        };

                        this._options.onLoad?.({
                            eventCount: events.length,
                            source: 'indexeddb'
                        });

                        return data;
                    }
                }

                // Try localStorage format
                const data = await this._backend.get('eventlog');
                if (data) {
                    this._options.onLoad?.({
                        eventCount: data.events?.length || 0,
                        source: 'localstorage'
                    });
                }

                return data;
            } catch (err) {
                this._options.onError?.({
                    operation: 'load',
                    error: err.message
                });
                return null;
            }
        }

        /**
         * Clear all persisted data
         */
        async clear() {
            await this._ready;
            if (!this._backend) return false;

            await this._backend.delete('eventlog');
            if (this._idbBackend) {
                // Clear IndexedDB stores too
                const tx = this._idbBackend._db?.transaction(['eventlog', 'syncqueue'], 'readwrite');
                if (tx) {
                    tx.objectStore('eventlog').clear();
                    tx.objectStore('syncqueue').clear();
                }
            }

            return true;
        }

        // ========================================================================
        // SYNC QUEUE (Rule 3 - Offline operation)
        // ========================================================================

        /**
         * Get pending sync events
         */
        async getSyncQueue() {
            await this._ready;
            if (this._idbBackend) {
                return this._idbBackend.dequeueSyncEvents();
            }
            return [];
        }

        /**
         * Mark sync event as completed
         */
        async completeSyncEvent(id) {
            await this._ready;
            if (this._idbBackend) {
                return this._idbBackend.removeSyncEvent(id);
            }
            return false;
        }

        /**
         * Get sync queue size
         */
        async getSyncQueueSize() {
            await this._ready;
            if (this._idbBackend) {
                return this._idbBackend.getSyncQueueSize();
            }
            return 0;
        }

        // ========================================================================
        // FAILURE RECORDING (Rule 7)
        // ========================================================================

        /**
         * Record a sync failure as an event
         */
        async recordSyncFailure(details) {
            if (!this._eventLog) return false;

            return this._eventLog.append({
                type: 'given',
                actor: 'system',
                context: {
                    workspace: 'system',
                    schemaVersion: '1.0'
                },
                payload: {
                    action: 'sync:failure',
                    ...details,
                    recordedAt: new Date().toISOString()
                }
            });
        }

        // ========================================================================
        // STATISTICS
        // ========================================================================

        async getStats() {
            await this._ready;

            const stats = {
                available: this._backend !== null,
                backend: this._idbBackend && this._backend === this._idbBackend
                    ? 'indexeddb'
                    : 'localstorage',
                pendingSave: this._pendingSave,
                connected: this._eventLog !== null
            };

            if (this._idbBackend) {
                stats.eventCount = await this._idbBackend.getEventCount();
                stats.syncQueueSize = await this._idbBackend.getSyncQueueSize();
            }

            if (this._backend) {
                if (this._backend.getUsage) {
                    stats.usage = this._backend.getUsage();
                }
            }

            return stats;
        }
    }

    // ============================================================================
    // SINGLETON INSTANCE
    // ============================================================================

    let _instance = null;

    function getPersistence() {
        if (!_instance) {
            _instance = new EOPersistence();
        }
        return _instance;
    }

    function initPersistence(options = {}) {
        _instance = new EOPersistence(options);
        return _instance;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOPersistenceModule = {
        // Classes
        Persistence: EOPersistence,
        LocalStorageBackend,
        IndexedDBBackend,

        // Singleton
        get: getPersistence,
        init: initPersistence
    };

    // Export to global scope
    global.EOPersistence = EOPersistenceModule;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOPersistenceModule;
    }

})(typeof window !== 'undefined' ? window : global);
