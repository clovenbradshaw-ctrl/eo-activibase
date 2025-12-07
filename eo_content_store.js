/**
 * EO Content Store - Content-Addressable Storage with Delta Encoding
 *
 * Provides deduplication for imported data:
 * - Identical imports share the same content storage
 * - Similar records (updates/variants) store only deltas
 * - Full data is hydrated on-demand for views/exports
 *
 * @module EOContentStore
 */

const EOContentStore = (function() {
    'use strict';

    // ============================================================
    // CONTENT STORE STATE
    // ============================================================

    /**
     * Main content storage - hash to content mapping
     * @type {Map<string, Object>}
     */
    const contentStore = new Map();

    /**
     * Record pointer registry - recordId to content reference
     * @type {Map<string, ContentRef>}
     */
    const recordPointers = new Map();

    /**
     * Import deduplication statistics
     * @type {Map<string, DeduplicationStats>}
     */
    const importStats = new Map();

    /**
     * Content reference count for garbage collection
     * @type {Map<string, number>}
     */
    const refCounts = new Map();

    // ============================================================
    // HASHING UTILITIES
    // ============================================================

    /**
     * Generate a stable hash for content using djb2 algorithm
     * @param {Object} content - The content to hash
     * @returns {string} Hash string prefixed with 'ch_'
     */
    function hashContent(content) {
        const str = stableStringify(content);
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }
        // Convert to unsigned and then to hex
        const unsigned = hash >>> 0;
        return 'ch_' + unsigned.toString(16).padStart(8, '0');
    }

    /**
     * Stable JSON stringify for consistent hashing
     * Sorts object keys to ensure same content = same hash
     * @param {*} obj - Object to stringify
     * @returns {string} Stable JSON string
     */
    function stableStringify(obj) {
        if (obj === null || obj === undefined) return 'null';
        if (typeof obj !== 'object') return JSON.stringify(obj);
        if (Array.isArray(obj)) {
            return '[' + obj.map(stableStringify).join(',') + ']';
        }
        const keys = Object.keys(obj).sort();
        const pairs = keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k]));
        return '{' + pairs.join(',') + '}';
    }

    /**
     * Hash a single field value
     * @param {*} value - Field value to hash
     * @returns {string} Hash string prefixed with 'fh_'
     */
    function hashFieldValue(value) {
        const str = stableStringify(value);
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        const unsigned = hash >>> 0;
        return 'fh_' + unsigned.toString(16).padStart(8, '0');
    }

    // ============================================================
    // CONTENT REFERENCE TYPES
    // ============================================================

    /**
     * @typedef {Object} DirectRef
     * @property {'direct'} type - Reference type
     * @property {string} contentHash - Hash pointing to full content
     */

    /**
     * @typedef {Object} DeltaRef
     * @property {'delta'} type - Reference type
     * @property {string} baseHash - Hash of base content
     * @property {string} deltaHash - Hash of delta (changed fields only)
     * @property {string[]} removedFields - Fields removed from base
     */

    /**
     * @typedef {DirectRef|DeltaRef} ContentRef
     */

    /**
     * @typedef {Object} DeduplicationStats
     * @property {string} importId - Import identifier
     * @property {number} totalRecords - Total records in import
     * @property {number} uniqueContents - Unique content hashes
     * @property {number} duplicateRecords - Exact duplicates found
     * @property {number} deltaRecords - Records stored as deltas
     * @property {number} rawBytes - Estimated raw storage bytes
     * @property {number} actualBytes - Actual storage bytes used
     * @property {number} savedBytes - Bytes saved by deduplication
     * @property {number} compressionRatio - Ratio of saved vs raw
     * @property {Object} fieldDedup - Per-field deduplication stats
     * @property {string} createdAt - When stats were calculated
     */

    // ============================================================
    // CORE STORAGE OPERATIONS
    // ============================================================

    /**
     * Store content and return its hash
     * If content already exists, returns existing hash without storing again
     * @param {Object} content - Content to store
     * @returns {string} Content hash
     */
    function store(content) {
        const hash = hashContent(content);
        if (!contentStore.has(hash)) {
            contentStore.set(hash, content);
            refCounts.set(hash, 0);
        }
        return hash;
    }

    /**
     * Retrieve content by hash
     * @param {string} hash - Content hash
     * @returns {Object|null} Stored content or null if not found
     */
    function retrieve(hash) {
        return contentStore.get(hash) || null;
    }

    /**
     * Increment reference count for a content hash
     * @param {string} hash - Content hash
     */
    function addRef(hash) {
        const count = refCounts.get(hash) || 0;
        refCounts.set(hash, count + 1);
    }

    /**
     * Decrement reference count and potentially garbage collect
     * @param {string} hash - Content hash
     */
    function releaseRef(hash) {
        const count = refCounts.get(hash) || 0;
        if (count <= 1) {
            refCounts.delete(hash);
            contentStore.delete(hash);
        } else {
            refCounts.set(hash, count - 1);
        }
    }

    // ============================================================
    // DELTA ENCODING
    // ============================================================

    /**
     * Calculate similarity between two content objects
     * @param {Object} content1 - First content object
     * @param {Object} content2 - Second content object
     * @returns {number} Similarity ratio (0-1)
     */
    function calculateSimilarity(content1, content2) {
        const keys1 = Object.keys(content1);
        const keys2 = Object.keys(content2);
        const allKeys = new Set([...keys1, ...keys2]);

        if (allKeys.size === 0) return 1;

        let matchingFields = 0;
        for (const key of allKeys) {
            if (stableStringify(content1[key]) === stableStringify(content2[key])) {
                matchingFields++;
            }
        }

        return matchingFields / allKeys.size;
    }

    /**
     * Calculate delta between base content and new content
     * @param {Object} baseContent - Original content
     * @param {Object} newContent - New content to diff against base
     * @returns {{delta: Object, removedFields: string[]}} Delta and removed fields
     */
    function calculateDelta(baseContent, newContent) {
        const delta = {};
        const removedFields = [];

        // Find changed and added fields
        for (const [key, value] of Object.entries(newContent)) {
            if (stableStringify(baseContent[key]) !== stableStringify(value)) {
                delta[key] = value;
            }
        }

        // Find removed fields
        for (const key of Object.keys(baseContent)) {
            if (!(key in newContent)) {
                removedFields.push(key);
            }
        }

        return { delta, removedFields };
    }

    /**
     * Apply delta to base content to reconstruct full content
     * @param {Object} baseContent - Base content
     * @param {Object} delta - Delta to apply
     * @param {string[]} removedFields - Fields to remove
     * @returns {Object} Reconstructed full content
     */
    function applyDelta(baseContent, delta, removedFields = []) {
        const result = { ...baseContent };

        // Apply delta changes
        for (const [key, value] of Object.entries(delta)) {
            result[key] = value;
        }

        // Remove deleted fields
        for (const field of removedFields) {
            delete result[field];
        }

        return result;
    }

    /**
     * Find the best base content for delta encoding
     * @param {Object} content - Content to find base for
     * @param {number} minSimilarity - Minimum similarity threshold (default 0.7)
     * @returns {{hash: string, similarity: number}|null} Best matching base or null
     */
    function findBestBase(content, minSimilarity = 0.7) {
        let bestMatch = null;
        let bestSimilarity = minSimilarity;

        for (const [hash, storedContent] of contentStore) {
            const similarity = calculateSimilarity(storedContent, content);
            if (similarity > bestSimilarity && similarity < 1) {
                bestSimilarity = similarity;
                bestMatch = { hash, similarity };
            }
        }

        return bestMatch;
    }

    // ============================================================
    // RECORD MANAGEMENT
    // ============================================================

    /**
     * Extract deduplicated field data from a record's fields
     * Separates content from metadata for storage
     * @param {Object} fields - Record fields object
     * @returns {Object} Clean content without metadata
     */
    function extractContent(fields) {
        const content = {};
        for (const [key, value] of Object.entries(fields)) {
            // Skip internal/provenance fields
            if (key.startsWith('_')) continue;
            content[key] = value;
        }
        return content;
    }

    /**
     * Store a record's content with automatic deduplication
     * @param {string} recordId - Unique record identifier
     * @param {Object} fields - Record fields to store
     * @param {Object} options - Storage options
     * @param {boolean} options.enableDelta - Enable delta encoding (default true)
     * @param {number} options.deltaThreshold - Min similarity for delta (default 0.7)
     * @returns {ContentRef} Reference to stored content
     */
    function storeRecord(recordId, fields, options = {}) {
        const { enableDelta = true, deltaThreshold = 0.7 } = options;
        const content = extractContent(fields);
        const contentHash = hashContent(content);

        // Check for exact duplicate
        if (contentStore.has(contentHash)) {
            const ref = { type: 'direct', contentHash };
            recordPointers.set(recordId, ref);
            addRef(contentHash);
            return ref;
        }

        // Try delta encoding if enabled
        if (enableDelta && contentStore.size > 0) {
            const bestBase = findBestBase(content, deltaThreshold);
            if (bestBase) {
                const baseContent = contentStore.get(bestBase.hash);
                const { delta, removedFields } = calculateDelta(baseContent, content);

                // Only use delta if it's actually smaller
                const deltaSize = stableStringify(delta).length + removedFields.length * 20;
                const fullSize = stableStringify(content).length;

                if (deltaSize < fullSize * 0.8) {
                    const deltaHash = store(delta);
                    const ref = {
                        type: 'delta',
                        baseHash: bestBase.hash,
                        deltaHash,
                        removedFields
                    };
                    recordPointers.set(recordId, ref);
                    addRef(bestBase.hash);
                    addRef(deltaHash);
                    return ref;
                }
            }
        }

        // Store as direct content
        store(content);
        const ref = { type: 'direct', contentHash };
        recordPointers.set(recordId, ref);
        addRef(contentHash);
        return ref;
    }

    /**
     * Hydrate a record - reconstruct full content from storage
     * @param {string} recordId - Record identifier
     * @returns {Object|null} Full content or null if not found
     */
    function hydrateRecord(recordId) {
        const ref = recordPointers.get(recordId);
        if (!ref) return null;

        if (ref.type === 'direct') {
            return retrieve(ref.contentHash);
        }

        if (ref.type === 'delta') {
            const baseContent = retrieve(ref.baseHash);
            const delta = retrieve(ref.deltaHash);
            if (!baseContent || !delta) return null;
            return applyDelta(baseContent, delta, ref.removedFields);
        }

        return null;
    }

    /**
     * Remove a record's content reference
     * @param {string} recordId - Record identifier
     */
    function removeRecord(recordId) {
        const ref = recordPointers.get(recordId);
        if (!ref) return;

        if (ref.type === 'direct') {
            releaseRef(ref.contentHash);
        } else if (ref.type === 'delta') {
            releaseRef(ref.baseHash);
            releaseRef(ref.deltaHash);
        }

        recordPointers.delete(recordId);
    }

    /**
     * Check if a record is stored as a duplicate (shares content)
     * @param {string} recordId - Record identifier
     * @returns {boolean} True if record shares content with others
     */
    function isDuplicate(recordId) {
        const ref = recordPointers.get(recordId);
        if (!ref || ref.type !== 'direct') return false;
        return (refCounts.get(ref.contentHash) || 0) > 1;
    }

    /**
     * Get all record IDs that share the same content
     * @param {string} recordId - Record identifier
     * @returns {string[]} Array of record IDs with same content
     */
    function getDuplicateRecordIds(recordId) {
        const ref = recordPointers.get(recordId);
        if (!ref || ref.type !== 'direct') return [recordId];

        const duplicates = [];
        for (const [rid, rref] of recordPointers) {
            if (rref.type === 'direct' && rref.contentHash === ref.contentHash) {
                duplicates.push(rid);
            }
        }
        return duplicates;
    }

    // ============================================================
    // IMPORT DEDUPLICATION
    // ============================================================

    /**
     * Process an import batch with deduplication
     * @param {string} importId - Import identifier
     * @param {Array<{recordId: string, fields: Object}>} records - Records to process
     * @param {Object} options - Processing options
     * @returns {DeduplicationStats} Statistics about the deduplication
     */
    function processImportBatch(importId, records, options = {}) {
        const stats = {
            importId,
            totalRecords: records.length,
            uniqueContents: 0,
            duplicateRecords: 0,
            deltaRecords: 0,
            rawBytes: 0,
            actualBytes: 0,
            savedBytes: 0,
            compressionRatio: 0,
            fieldDedup: {},
            contentHashes: new Map(), // hash -> count
            deltaBaseUsage: new Map(), // baseHash -> count
            createdAt: new Date().toISOString()
        };

        const preExistingHashes = new Set(contentStore.keys());
        const newHashes = new Set();

        for (const { recordId, fields } of records) {
            const content = extractContent(fields);
            const rawSize = stableStringify(content).length;
            stats.rawBytes += rawSize;

            const ref = storeRecord(recordId, fields, options);

            if (ref.type === 'direct') {
                const hashCount = stats.contentHashes.get(ref.contentHash) || 0;
                stats.contentHashes.set(ref.contentHash, hashCount + 1);

                if (preExistingHashes.has(ref.contentHash) || newHashes.has(ref.contentHash)) {
                    stats.duplicateRecords++;
                } else {
                    newHashes.add(ref.contentHash);
                    stats.actualBytes += rawSize;
                }
            } else if (ref.type === 'delta') {
                stats.deltaRecords++;
                const deltaContent = retrieve(ref.deltaHash);
                const deltaSize = stableStringify(deltaContent).length;
                stats.actualBytes += deltaSize;

                const baseCount = stats.deltaBaseUsage.get(ref.baseHash) || 0;
                stats.deltaBaseUsage.set(ref.baseHash, baseCount + 1);
            }
        }

        stats.uniqueContents = newHashes.size;
        stats.savedBytes = stats.rawBytes - stats.actualBytes;
        stats.compressionRatio = stats.rawBytes > 0
            ? ((stats.savedBytes / stats.rawBytes) * 100).toFixed(1)
            : 0;

        // Calculate field-level deduplication stats
        stats.fieldDedup = analyzeFieldDeduplication(records);

        // Convert Maps to objects for storage
        stats.contentHashCounts = Object.fromEntries(stats.contentHashes);
        stats.deltaBaseUsageCounts = Object.fromEntries(stats.deltaBaseUsage);
        delete stats.contentHashes;
        delete stats.deltaBaseUsage;

        importStats.set(importId, stats);
        return stats;
    }

    /**
     * Analyze field-level deduplication across records
     * @param {Array<{recordId: string, fields: Object}>} records - Records to analyze
     * @returns {Object} Per-field deduplication statistics
     */
    function analyzeFieldDeduplication(records) {
        const fieldValues = new Map(); // fieldName -> Map<valueHash, count>

        for (const { fields } of records) {
            for (const [key, value] of Object.entries(fields)) {
                if (key.startsWith('_')) continue;

                if (!fieldValues.has(key)) {
                    fieldValues.set(key, new Map());
                }

                const valueHash = hashFieldValue(value);
                const valueCounts = fieldValues.get(key);
                valueCounts.set(valueHash, (valueCounts.get(valueHash) || 0) + 1);
            }
        }

        const fieldStats = {};
        for (const [fieldName, valueCounts] of fieldValues) {
            const totalValues = Array.from(valueCounts.values()).reduce((a, b) => a + b, 0);
            const uniqueValues = valueCounts.size;
            const duplicateValues = totalValues - uniqueValues;
            const mostCommonCount = Math.max(...valueCounts.values());

            fieldStats[fieldName] = {
                totalValues,
                uniqueValues,
                duplicateValues,
                deduplicationRatio: totalValues > 0
                    ? ((duplicateValues / totalValues) * 100).toFixed(1)
                    : 0,
                mostCommonValueCount: mostCommonCount,
                cardinality: uniqueValues // Number of distinct values
            };
        }

        return fieldStats;
    }

    /**
     * Get deduplication statistics for an import
     * @param {string} importId - Import identifier
     * @returns {DeduplicationStats|null} Statistics or null if not found
     */
    function getImportStats(importId) {
        return importStats.get(importId) || null;
    }

    /**
     * Get aggregated statistics across all imports
     * @returns {Object} Aggregated deduplication statistics
     */
    function getGlobalStats() {
        let totalRecords = 0;
        let totalDuplicates = 0;
        let totalDeltas = 0;
        let totalRawBytes = 0;
        let totalActualBytes = 0;

        for (const stats of importStats.values()) {
            totalRecords += stats.totalRecords;
            totalDuplicates += stats.duplicateRecords;
            totalDeltas += stats.deltaRecords;
            totalRawBytes += stats.rawBytes;
            totalActualBytes += stats.actualBytes;
        }

        return {
            totalRecords,
            totalDuplicates,
            totalDeltas,
            uniqueContents: contentStore.size,
            totalRawBytes,
            totalActualBytes,
            totalSavedBytes: totalRawBytes - totalActualBytes,
            overallCompressionRatio: totalRawBytes > 0
                ? (((totalRawBytes - totalActualBytes) / totalRawBytes) * 100).toFixed(1)
                : 0,
            importCount: importStats.size
        };
    }

    // ============================================================
    // CROSS-IMPORT DEDUPLICATION ANALYSIS
    // ============================================================

    /**
     * Find records that are duplicated across different imports
     * @returns {Array<{contentHash: string, recordIds: string[], importIds: string[]}>}
     */
    function findCrossImportDuplicates() {
        const hashToRecords = new Map();

        for (const [recordId, ref] of recordPointers) {
            if (ref.type !== 'direct') continue;

            if (!hashToRecords.has(ref.contentHash)) {
                hashToRecords.set(ref.contentHash, []);
            }
            hashToRecords.get(ref.contentHash).push(recordId);
        }

        const duplicates = [];
        for (const [hash, recordIds] of hashToRecords) {
            if (recordIds.length > 1) {
                // Extract import IDs from record IDs if possible
                const importIds = [...new Set(recordIds.map(rid => {
                    // Assuming record ID format includes import reference
                    const match = rid.match(/imp_[^_]+_[^_]+/);
                    return match ? match[0] : 'unknown';
                }))];

                duplicates.push({
                    contentHash: hash,
                    recordIds,
                    importIds,
                    count: recordIds.length
                });
            }
        }

        return duplicates.sort((a, b) => b.count - a.count);
    }

    // ============================================================
    // EXPORT/IMPORT FOR PERSISTENCE
    // ============================================================

    /**
     * Export the content store for persistence
     * @returns {Object} Serializable content store state
     */
    function exportStore() {
        return {
            version: 1,
            contentStore: Array.from(contentStore.entries()),
            recordPointers: Array.from(recordPointers.entries()),
            refCounts: Array.from(refCounts.entries()),
            importStats: Array.from(importStats.entries()),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import content store from persisted state
     * @param {Object} data - Previously exported state
     */
    function importStore(data) {
        if (!data || data.version !== 1) {
            console.warn('EOContentStore: Invalid or incompatible import data');
            return false;
        }

        contentStore.clear();
        recordPointers.clear();
        refCounts.clear();
        importStats.clear();

        for (const [hash, content] of data.contentStore || []) {
            contentStore.set(hash, content);
        }

        for (const [recordId, ref] of data.recordPointers || []) {
            recordPointers.set(recordId, ref);
        }

        for (const [hash, count] of data.refCounts || []) {
            refCounts.set(hash, count);
        }

        for (const [importId, stats] of data.importStats || []) {
            importStats.set(importId, stats);
        }

        return true;
    }

    /**
     * Clear all stored content (for testing or reset)
     */
    function clear() {
        contentStore.clear();
        recordPointers.clear();
        refCounts.clear();
        importStats.clear();
    }

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Number of bytes
     * @returns {string} Formatted string (e.g., "1.5 KB")
     */
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get a summary of deduplication for display
     * @param {string} importId - Import identifier
     * @returns {Object} Human-readable summary
     */
    function getImportSummary(importId) {
        const stats = getImportStats(importId);
        if (!stats) return null;

        return {
            importId,
            totalRecords: stats.totalRecords,
            uniqueRecords: stats.totalRecords - stats.duplicateRecords - stats.deltaRecords,
            duplicateRecords: stats.duplicateRecords,
            deltaRecords: stats.deltaRecords,
            storageUsed: formatBytes(stats.actualBytes),
            storageSaved: formatBytes(stats.savedBytes),
            compressionRatio: stats.compressionRatio + '%',
            efficiency: stats.duplicateRecords > 0 || stats.deltaRecords > 0
                ? 'Optimized'
                : 'No duplicates found',
            fieldStats: stats.fieldDedup
        };
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    return {
        // Core storage
        store,
        retrieve,
        hashContent,

        // Record management
        storeRecord,
        hydrateRecord,
        removeRecord,
        isDuplicate,
        getDuplicateRecordIds,

        // Delta encoding
        calculateSimilarity,
        calculateDelta,
        applyDelta,
        findBestBase,

        // Import processing
        processImportBatch,
        getImportStats,
        getImportSummary,
        getGlobalStats,
        findCrossImportDuplicates,
        analyzeFieldDeduplication,

        // Persistence
        exportStore,
        importStore,
        clear,

        // Utilities
        formatBytes,
        stableStringify,

        // For debugging/testing
        _getContentStore: () => contentStore,
        _getRecordPointers: () => recordPointers,
        _getRefCounts: () => refCounts
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EOContentStore;
}
