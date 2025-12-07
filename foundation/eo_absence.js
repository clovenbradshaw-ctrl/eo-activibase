/**
 * EO Absence (NUL Operator)
 * Reusable framework for handling missing data and absence
 *
 * @eo_operator NUL
 * @eo_layer foundation
 *
 * The NUL operator handles the concept of "nothing" or "absence" in data.
 * This module provides utilities for detecting, handling, and representing
 * missing values in a consistent, EO-aligned manner.
 */

(function(global) {
    'use strict';

    /**
     * Absence types
     * @typedef {'null'|'undefined'|'empty'|'missing'|'unknown'|'not_applicable'} AbsenceType
     */

    /**
     * Absence handling strategy
     * @typedef {'keep'|'remove'|'default'|'throw'|'mark'} AbsenceStrategy
     */

    /**
     * EOAbsence - Missing data detection and handling framework
     */
    const EOAbsence = {
        // ============================================================================
        // DETECTION
        // ============================================================================

        /**
         * Check if a value represents absence
         * @param {*} value - Value to check
         * @param {Object} options - Detection options
         * @returns {boolean}
         */
        isAbsent(value, options = {}) {
            const {
                treatEmptyStringAsAbsent = true,
                treatEmptyArrayAsAbsent = false,
                treatEmptyObjectAsAbsent = false,
                treatZeroAsAbsent = false,
                treatFalseAsAbsent = false,
                customAbsentValues = []
            } = options;

            // Null and undefined are always absent
            if (value === null || value === undefined) return true;

            // Check custom absent values
            if (customAbsentValues.includes(value)) return true;

            // Empty string
            if (treatEmptyStringAsAbsent && value === '') return true;

            // Empty array
            if (treatEmptyArrayAsAbsent && Array.isArray(value) && value.length === 0) return true;

            // Empty object
            if (treatEmptyObjectAsAbsent && typeof value === 'object' && Object.keys(value).length === 0) return true;

            // Zero
            if (treatZeroAsAbsent && value === 0) return true;

            // False
            if (treatFalseAsAbsent && value === false) return true;

            return false;
        },

        /**
         * Classify the type of absence
         * @param {*} value - Value to classify
         * @returns {AbsenceType|null}
         */
        classifyAbsence(value) {
            if (value === null) return 'null';
            if (value === undefined) return 'undefined';
            if (value === '') return 'empty';
            if (value === 'N/A' || value === 'n/a' || value === '-') return 'not_applicable';
            if (value === '?' || value === 'unknown' || value === 'Unknown') return 'unknown';
            if (Array.isArray(value) && value.length === 0) return 'empty';
            if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) return 'empty';
            return null;
        },

        /**
         * Check if any values in an array are absent
         * @param {Array} values - Values to check
         * @param {Object} options - Detection options
         * @returns {boolean}
         */
        hasAbsent(values, options = {}) {
            if (!Array.isArray(values)) return this.isAbsent(values, options);
            return values.some(v => this.isAbsent(v, options));
        },

        /**
         * Count absent values in an array
         * @param {Array} values - Values to check
         * @param {Object} options - Detection options
         * @returns {number}
         */
        countAbsent(values, options = {}) {
            if (!Array.isArray(values)) return this.isAbsent(values, options) ? 1 : 0;
            return values.filter(v => this.isAbsent(v, options)).length;
        },

        /**
         * Get indices of absent values
         * @param {Array} values - Values to check
         * @param {Object} options - Detection options
         * @returns {number[]}
         */
        findAbsentIndices(values, options = {}) {
            if (!Array.isArray(values)) return [];
            return values
                .map((v, i) => this.isAbsent(v, options) ? i : -1)
                .filter(i => i >= 0);
        },

        // ============================================================================
        // HANDLING
        // ============================================================================

        /**
         * Apply a handling strategy to absent values
         * @param {*} value - Value to handle
         * @param {AbsenceStrategy} strategy - Handling strategy
         * @param {Object} options - Strategy options
         * @returns {*}
         */
        handle(value, strategy = 'keep', options = {}) {
            const { defaultValue = null, marker = '__ABSENT__', errorMessage = 'Absent value encountered' } = options;

            if (!this.isAbsent(value, options)) return value;

            switch (strategy) {
                case 'keep':
                    return value;
                case 'remove':
                    return undefined; // Signal for removal
                case 'default':
                    return defaultValue;
                case 'throw':
                    throw new Error(errorMessage);
                case 'mark':
                    return { __eo_absent: true, type: this.classifyAbsence(value), marker };
                default:
                    return value;
            }
        },

        /**
         * Handle absent values in an array
         * @param {Array} values - Values to handle
         * @param {AbsenceStrategy} strategy - Handling strategy
         * @param {Object} options - Strategy options
         * @returns {Array}
         */
        handleArray(values, strategy = 'keep', options = {}) {
            if (!Array.isArray(values)) return [this.handle(values, strategy, options)];

            const result = values.map(v => this.handle(v, strategy, options));

            if (strategy === 'remove') {
                return result.filter(v => v !== undefined);
            }

            return result;
        },

        /**
         * Handle absent values in an object
         * @param {Object} obj - Object to handle
         * @param {AbsenceStrategy} strategy - Handling strategy
         * @param {Object} options - Strategy options
         * @returns {Object}
         */
        handleObject(obj, strategy = 'keep', options = {}) {
            if (typeof obj !== 'object' || obj === null) return obj;

            const result = {};

            for (const [key, value] of Object.entries(obj)) {
                const handled = this.handle(value, strategy, options);
                if (strategy === 'remove' && handled === undefined) {
                    continue;
                }
                result[key] = handled;
            }

            return result;
        },

        // ============================================================================
        // COALESCE (First non-absent value)
        // ============================================================================

        /**
         * Return the first non-absent value
         * @param {...*} values - Values to coalesce
         * @returns {*}
         */
        coalesce(...values) {
            for (const value of values) {
                if (!this.isAbsent(value)) return value;
            }
            return null;
        },

        /**
         * Return the first non-absent value from an array
         * @param {Array} values - Values to coalesce
         * @param {*} defaultValue - Default if all absent
         * @returns {*}
         */
        coalesceArray(values, defaultValue = null) {
            if (!Array.isArray(values)) return this.isAbsent(values) ? defaultValue : values;
            const found = values.find(v => !this.isAbsent(v));
            return found !== undefined ? found : defaultValue;
        },

        // ============================================================================
        // IMPUTATION (Fill absent values)
        // ============================================================================

        /**
         * Impute absent values using a strategy
         * @param {Array<number>} values - Numeric values with potential absences
         * @param {string} method - Imputation method (mean, median, mode, forward, backward, constant)
         * @param {Object} options - Imputation options
         * @returns {Array<number>}
         */
        impute(values, method = 'mean', options = {}) {
            if (!Array.isArray(values)) return values;

            const present = values.filter(v => !this.isAbsent(v) && typeof v === 'number');

            let imputeValue;

            switch (method) {
                case 'mean':
                    imputeValue = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0;
                    break;

                case 'median':
                    if (present.length === 0) {
                        imputeValue = 0;
                    } else {
                        const sorted = [...present].sort((a, b) => a - b);
                        const mid = Math.floor(sorted.length / 2);
                        imputeValue = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                    }
                    break;

                case 'mode':
                    const freq = {};
                    present.forEach(v => freq[v] = (freq[v] || 0) + 1);
                    imputeValue = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
                    break;

                case 'constant':
                    imputeValue = options.constant ?? 0;
                    break;

                case 'forward':
                    return this._forwardFill(values);

                case 'backward':
                    return this._backwardFill(values);

                default:
                    imputeValue = 0;
            }

            return values.map(v => this.isAbsent(v) ? imputeValue : v);
        },

        /**
         * Forward fill absent values
         * @param {Array} values - Values to fill
         * @returns {Array}
         */
        _forwardFill(values) {
            let lastValid = null;
            return values.map(v => {
                if (!this.isAbsent(v)) {
                    lastValid = v;
                    return v;
                }
                return lastValid;
            });
        },

        /**
         * Backward fill absent values
         * @param {Array} values - Values to fill
         * @returns {Array}
         */
        _backwardFill(values) {
            let lastValid = null;
            const result = [...values];
            for (let i = result.length - 1; i >= 0; i--) {
                if (!this.isAbsent(result[i])) {
                    lastValid = result[i];
                } else {
                    result[i] = lastValid;
                }
            }
            return result;
        },

        // ============================================================================
        // STATISTICS
        // ============================================================================

        /**
         * Calculate absence statistics for a dataset
         * @param {Array<Object>} records - Array of record objects
         * @param {string[]} fields - Fields to analyze (all if not specified)
         * @returns {Object}
         */
        analyzeAbsence(records, fields = null) {
            if (!Array.isArray(records) || records.length === 0) {
                return { totalRecords: 0, fields: {} };
            }

            const fieldsToAnalyze = fields || Object.keys(records[0]);
            const stats = {
                totalRecords: records.length,
                fields: {}
            };

            fieldsToAnalyze.forEach(field => {
                const values = records.map(r => r[field]);
                const absentCount = this.countAbsent(values);
                const presentCount = values.length - absentCount;

                stats.fields[field] = {
                    absent: absentCount,
                    present: presentCount,
                    total: values.length,
                    absentPercentage: ((absentCount / values.length) * 100).toFixed(2) + '%',
                    absenceTypes: this._countAbsenceTypes(values)
                };
            });

            return stats;
        },

        /**
         * Count absence types in values
         * @param {Array} values - Values to analyze
         * @returns {Object}
         */
        _countAbsenceTypes(values) {
            const types = {};
            values.forEach(v => {
                const type = this.classifyAbsence(v);
                if (type) {
                    types[type] = (types[type] || 0) + 1;
                }
            });
            return types;
        },

        // ============================================================================
        // UTILITIES
        // ============================================================================

        /**
         * Create an absence marker object
         * @param {AbsenceType} type - Type of absence
         * @param {string} reason - Reason for absence
         * @returns {Object}
         */
        createMarker(type = 'missing', reason = null) {
            return {
                __eo_absent: true,
                type,
                reason,
                createdAt: new Date().toISOString()
            };
        },

        /**
         * Check if a value is an absence marker
         * @param {*} value - Value to check
         * @returns {boolean}
         */
        isMarker(value) {
            return value && typeof value === 'object' && value.__eo_absent === true;
        },

        /**
         * Represent absence as a display string
         * @param {*} value - Absent value
         * @param {Object} options - Display options
         * @returns {string}
         */
        toDisplayString(value, options = {}) {
            const { nullString = '—', undefinedString = '—', emptyString = '(empty)', markerString = null } = options;

            if (this.isMarker(value)) {
                return markerString || `[${value.type}]`;
            }

            const type = this.classifyAbsence(value);
            switch (type) {
                case 'null':
                    return nullString;
                case 'undefined':
                    return undefinedString;
                case 'empty':
                    return emptyString;
                case 'not_applicable':
                    return 'N/A';
                case 'unknown':
                    return '?';
                default:
                    return String(value);
            }
        }
    };

    // Export to global scope
    global.EOAbsence = EOAbsence;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOAbsence;
    }

})(typeof window !== 'undefined' ? window : global);
