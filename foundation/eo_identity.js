/**
 * EO Identity
 * Unified ID generation for the EO Framework
 *
 * @eo_operator DES
 * @eo_layer foundation
 *
 * This module provides consistent ID generation across the entire codebase.
 * Format: {operator}_{entity}_{timestamp}_{random}
 *
 * Replaces 33+ scattered ID generation patterns with a single source of truth.
 */

(function(global) {
    'use strict';

    /**
     * Generate a random alphanumeric string
     * @param {number} length - Length of the random string
     * @returns {string}
     */
    function randomString(length) {
        return Math.random().toString(36).substr(2, length);
    }

    /**
     * Get current timestamp
     * @returns {number}
     */
    function timestamp() {
        return Date.now();
    }

    /**
     * EOIdentity - Unified ID generation system
     */
    const EOIdentity = {
        /**
         * Generate a generic ID with custom prefix
         * @param {string} prefix - ID prefix (e.g., 'rec', 'set')
         * @param {Object} options - Generation options
         * @param {number} [options.randomLength=9] - Length of random component
         * @param {boolean} [options.includeTimestamp=true] - Include timestamp
         * @returns {string}
         */
        generate(prefix, options = {}) {
            const randomLength = options.randomLength ||
                (global.EO_CONSTANTS?.RANDOM_LENGTH?.DEFAULT || 9);
            const includeTimestamp = options.includeTimestamp !== false;

            if (includeTimestamp) {
                return `${prefix}_${timestamp()}_${randomString(randomLength)}`;
            }
            return `${prefix}_${randomString(randomLength)}`;
        },

        // ============================================================================
        // ENTITY-SPECIFIC GENERATORS
        // ============================================================================

        /**
         * Generate a record ID
         * @returns {string} rec_{timestamp}_{random}
         */
        record() {
            return this.generate('rec');
        },

        /**
         * Generate a set ID
         * @returns {string} set_{timestamp}_{random}
         */
        set() {
            return this.generate('set');
        },

        /**
         * Generate a view ID
         * @returns {string} view_{timestamp}_{random}
         */
        view() {
            return this.generate('view');
        },

        /**
         * Generate a field ID
         * @returns {string} fld_{timestamp}_{random}
         */
        field() {
            return this.generate('fld');
        },

        /**
         * Generate a cell ID (deterministic from record + field)
         * @param {string} recordId - Parent record ID
         * @param {string} fieldId - Parent field ID
         * @returns {string} {recordId}_field_{fieldId}
         */
        cell(recordId, fieldId) {
            return `${recordId}_field_${fieldId}`;
        },

        /**
         * Generate an import ID
         * @returns {string} imp_{timestamp}_{random}
         */
        import() {
            return this.generate('imp');
        },

        /**
         * Generate an event ID
         * @returns {string} evt_{timestamp}_{random}
         */
        event() {
            return this.generate('evt', { randomLength: 7 });
        },

        /**
         * Generate a context ID
         * @returns {string} ctx_{timestamp}_{random}
         */
        context() {
            return this.generate('ctx', { randomLength: 5 });
        },

        /**
         * Generate an operator execution ID
         * @param {string} operator - EO operator (NUL, DES, etc.)
         * @returns {string} op_{operator}_{timestamp}_{random}
         */
        operator(operator) {
            return this.generate(`op_${operator.toLowerCase()}`);
        },

        /**
         * Generate a pane ID
         * @returns {string} pane_{timestamp}_{random}
         */
        pane() {
            return this.generate('pane');
        },

        /**
         * Generate a split ID
         * @returns {string} split_{timestamp}_{random}
         */
        split() {
            return this.generate('split');
        },

        /**
         * Generate a portal ID
         * @returns {string} portal_{timestamp}_{random}
         */
        portal() {
            return this.generate('portal');
        },

        /**
         * Generate a graph ID
         * @returns {string} graph_{timestamp}_{random}
         */
        graph() {
            return this.generate('graph');
        },

        /**
         * Generate an edge ID
         * @returns {string} edge_{timestamp}_{random}
         */
        edge() {
            return this.generate('edge');
        },

        /**
         * Generate a relationship ID
         * @returns {string} rel_{timestamp}_{random}
         */
        relationship() {
            return this.generate('rel');
        },

        /**
         * Generate a preset ID
         * @returns {string} preset_{timestamp}_{random}
         */
        preset() {
            return this.generate('preset', { randomLength: 5 });
        },

        /**
         * Generate a toss entry ID
         * @returns {string} toss_{timestamp}_{random}
         */
        toss() {
            return this.generate('toss');
        },

        /**
         * Generate an action ID
         * @returns {string} act_{timestamp}_{random}
         */
        action() {
            return this.generate('act');
        },

        // ============================================================================
        // PARSING UTILITIES
        // ============================================================================

        /**
         * Parse an ID into its components
         * @param {string} id - ID to parse
         * @returns {Object} { prefix, timestamp, random, entityType }
         */
        parse(id) {
            const parts = id.split('_');
            if (parts.length < 2) {
                return { prefix: id, timestamp: null, random: null, entityType: 'unknown' };
            }

            const prefix = parts[0];
            const timestampPart = parts.length >= 3 ? parseInt(parts[1], 10) : null;
            const randomPart = parts.length >= 3 ? parts.slice(2).join('_') : parts[1];

            const entityTypeMap = {
                rec: 'record',
                set: 'set',
                view: 'view',
                fld: 'field',
                imp: 'import',
                evt: 'event',
                ctx: 'context',
                op: 'operator',
                pane: 'pane',
                split: 'split',
                portal: 'portal',
                graph: 'graph',
                edge: 'edge',
                rel: 'relationship',
                preset: 'preset',
                toss: 'toss',
                act: 'action'
            };

            return {
                prefix,
                timestamp: isNaN(timestampPart) ? null : timestampPart,
                random: randomPart,
                entityType: entityTypeMap[prefix] || 'unknown'
            };
        },

        /**
         * Extract creation time from an ID
         * @param {string} id - ID to extract time from
         * @returns {Date|null}
         */
        getCreationTime(id) {
            const parsed = this.parse(id);
            return parsed.timestamp ? new Date(parsed.timestamp) : null;
        },

        /**
         * Validate an ID format
         * @param {string} id - ID to validate
         * @param {string} [expectedPrefix] - Expected prefix
         * @returns {boolean}
         */
        validate(id, expectedPrefix = null) {
            if (!id || typeof id !== 'string') return false;

            const parsed = this.parse(id);
            if (parsed.entityType === 'unknown' && !id.includes('_field_')) {
                // Allow cell IDs which have special format
                return false;
            }

            if (expectedPrefix && parsed.prefix !== expectedPrefix) {
                return false;
            }

            return true;
        },

        /**
         * Check if an ID is a cell ID
         * @param {string} id - ID to check
         * @returns {boolean}
         */
        isCell(id) {
            return id && id.includes('_field_');
        },

        /**
         * Extract record and field IDs from a cell ID
         * @param {string} cellId - Cell ID to parse
         * @returns {{ recordId: string, fieldId: string }|null}
         */
        parseCellId(cellId) {
            if (!this.isCell(cellId)) return null;

            const parts = cellId.split('_field_');
            if (parts.length !== 2) return null;

            return {
                recordId: parts[0],
                fieldId: parts[1]
            };
        }
    };

    // Export to global scope
    global.EOIdentity = EOIdentity;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOIdentity;
    }

})(typeof window !== 'undefined' ? window : global);
