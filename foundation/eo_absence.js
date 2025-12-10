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
 *
 * === E.F. Codd NULL Theory Support ===
 *
 * This module implements Codd's formal NULL semantics:
 *
 * 1. Four-Valued Logic (Codd 1986-1990):
 *    - A-mark (Applicable): Value exists but is unknown ("I don't know")
 *    - I-mark (Inapplicable): Value doesn't apply ("The question doesn't make sense")
 *
 * 2. Three-Valued Logic for Comparisons:
 *    - TRUE, FALSE, UNKNOWN
 *    - NULL = NULL → UNKNOWN (not TRUE)
 *    - NULL in expressions → UNKNOWN propagation
 *
 * 3. NULL Propagation:
 *    - Arithmetic with NULL yields NULL (NULL + 5 = NULL)
 *    - Comparisons with NULL yield UNKNOWN
 *
 * References:
 * - Codd, E.F. "Missing Information (Applicable and Inapplicable) in Relational Databases"
 * - Codd, E.F. "The Relational Model for Database Management: Version 2" (1990)
 */

(function(global) {
    'use strict';

    /**
     * Absence types - Extended with Codd's formal marks
     * @typedef {'null'|'undefined'|'empty'|'missing'|'unknown'|'not_applicable'|'a_mark'|'i_mark'} AbsenceType
     */

    /**
     * Codd Mark Types
     * @typedef {'a_mark'|'i_mark'} CoddMarkType
     */

    /**
     * Three-valued logic result
     * @typedef {true|false|'UNKNOWN'} ThreeValuedResult
     */

    /**
     * Absence handling strategy
     * @typedef {'keep'|'remove'|'default'|'throw'|'mark'|'propagate'} AbsenceStrategy
     */

    /**
     * UNKNOWN constant for three-valued logic
     * This is a sentinel value representing Codd's UNKNOWN truth value
     */
    const UNKNOWN = Object.freeze({
        __eo_unknown: true,
        toString: () => 'UNKNOWN',
        valueOf: () => NaN  // UNKNOWN in boolean context should be falsy but distinct
    });

    /**
     * EOAbsence - Missing data detection and handling framework
     * Extended with E.F. Codd's formal NULL semantics
     */
    const EOAbsence = {
        // ============================================================================
        // CODD CONSTANTS
        // ============================================================================

        /**
         * UNKNOWN - Three-valued logic unknown result
         * Use for comparisons involving NULL: NULL = NULL → UNKNOWN
         */
        UNKNOWN: UNKNOWN,

        /**
         * Codd Mark Types
         */
        CODD_MARKS: Object.freeze({
            A_MARK: 'a_mark',    // Applicable but unknown - value exists, we don't know it
            I_MARK: 'i_mark'    // Inapplicable - the attribute doesn't apply to this entity
        }),
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
            // Check for Codd marks
            if (this.isAMark(value)) return 'a_mark';
            if (this.isIMark(value)) return 'i_mark';
            return null;
        },

        // ============================================================================
        // CODD MARK DETECTION (A-marks and I-marks)
        // ============================================================================

        /**
         * Check if value is the UNKNOWN sentinel (three-valued logic)
         * @param {*} value - Value to check
         * @returns {boolean}
         */
        isUnknown(value) {
            return value === UNKNOWN || (value && value.__eo_unknown === true);
        },

        /**
         * Check if value is an A-mark (Applicable but unknown)
         * Per Codd: "The value exists but we don't know what it is"
         * Example: A person's birthdate that wasn't recorded
         * @param {*} value - Value to check
         * @returns {boolean}
         */
        isAMark(value) {
            if (!value || typeof value !== 'object') return false;
            return value.__eo_absent === true && value.coddMark === 'a_mark';
        },

        /**
         * Check if value is an I-mark (Inapplicable)
         * Per Codd: "The attribute doesn't apply to this entity"
         * Example: "Spouse name" for an unmarried person
         * @param {*} value - Value to check
         * @returns {boolean}
         */
        isIMark(value) {
            if (!value || typeof value !== 'object') return false;
            return value.__eo_absent === true && value.coddMark === 'i_mark';
        },

        /**
         * Check if value is any Codd mark (A-mark or I-mark)
         * @param {*} value - Value to check
         * @returns {boolean}
         */
        isCoddMark(value) {
            return this.isAMark(value) || this.isIMark(value);
        },

        /**
         * Determine the appropriate Codd mark type for a NULL value
         * @param {*} value - Value to analyze
         * @param {Object} fieldSchema - Optional field schema with nullability info
         * @returns {CoddMarkType|null}
         */
        inferCoddMark(value, fieldSchema = null) {
            if (!this.isAbsent(value)) return null;

            // If field schema specifies the null type, use it
            if (fieldSchema && fieldSchema.nullType) {
                return fieldSchema.nullType;
            }

            // Heuristics for inferring Codd mark type
            const absenceType = this.classifyAbsence(value);

            // 'not_applicable', 'N/A' → I-mark
            if (absenceType === 'not_applicable') {
                return 'i_mark';
            }

            // 'unknown', '?' → A-mark (value exists but unknown)
            if (absenceType === 'unknown') {
                return 'a_mark';
            }

            // Default: assume A-mark (value could exist)
            return 'a_mark';
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
        // THREE-VALUED LOGIC (Codd's 3VL)
        // ============================================================================

        /**
         * Three-valued AND operation
         * Truth table:
         *   T AND T = T    T AND F = F    T AND U = U
         *   F AND T = F    F AND F = F    F AND U = F
         *   U AND T = U    U AND F = F    U AND U = U
         * @param {*} a - First operand
         * @param {*} b - Second operand
         * @returns {ThreeValuedResult}
         */
        threeValuedAnd(a, b) {
            const aUnknown = this.isAbsent(a) || this.isUnknown(a);
            const bUnknown = this.isAbsent(b) || this.isUnknown(b);

            // If either is definitely FALSE, result is FALSE
            if (a === false || b === false) return false;

            // If either is UNKNOWN and neither is FALSE, result is UNKNOWN
            if (aUnknown || bUnknown) return UNKNOWN;

            // Both are TRUE
            return true;
        },

        /**
         * Three-valued OR operation
         * Truth table:
         *   T OR T = T    T OR F = T    T OR U = T
         *   F OR T = T    F OR F = F    F OR U = U
         *   U OR T = T    U OR F = U    U OR U = U
         * @param {*} a - First operand
         * @param {*} b - Second operand
         * @returns {ThreeValuedResult}
         */
        threeValuedOr(a, b) {
            const aUnknown = this.isAbsent(a) || this.isUnknown(a);
            const bUnknown = this.isAbsent(b) || this.isUnknown(b);

            // If either is definitely TRUE, result is TRUE
            if (a === true || b === true) return true;

            // If either is UNKNOWN and neither is TRUE, result is UNKNOWN
            if (aUnknown || bUnknown) return UNKNOWN;

            // Both are FALSE
            return false;
        },

        /**
         * Three-valued NOT operation
         * Truth table: NOT T = F, NOT F = T, NOT U = U
         * @param {*} a - Operand
         * @returns {ThreeValuedResult}
         */
        threeValuedNot(a) {
            if (this.isAbsent(a) || this.isUnknown(a)) return UNKNOWN;
            return !a;
        },

        /**
         * Three-valued equality comparison (Codd semantics)
         * NULL = NULL → UNKNOWN (not TRUE!)
         * @param {*} a - First operand
         * @param {*} b - Second operand
         * @returns {ThreeValuedResult}
         */
        threeValuedEquals(a, b) {
            const aAbsent = this.isAbsent(a) || this.isUnknown(a);
            const bAbsent = this.isAbsent(b) || this.isUnknown(b);

            // If either operand is NULL/absent, result is UNKNOWN
            if (aAbsent || bAbsent) return UNKNOWN;

            return a === b;
        },

        /**
         * IS DISTINCT FROM comparison (SQL:1999)
         * Unlike =, this treats NULLs as equal values for comparison
         * NULL IS DISTINCT FROM NULL → FALSE
         * NULL IS DISTINCT FROM 5 → TRUE
         * 5 IS DISTINCT FROM 5 → FALSE
         * @param {*} a - First operand
         * @param {*} b - Second operand
         * @returns {boolean} Always returns boolean (never UNKNOWN)
         */
        isDistinctFrom(a, b) {
            const aAbsent = this.isAbsent(a);
            const bAbsent = this.isAbsent(b);

            // Both NULL = not distinct
            if (aAbsent && bAbsent) return false;

            // One NULL, one not = distinct
            if (aAbsent || bAbsent) return true;

            // Neither NULL = compare values
            return a !== b;
        },

        /**
         * IS NOT DISTINCT FROM comparison (SQL:1999)
         * The negation of IS DISTINCT FROM
         * NULL IS NOT DISTINCT FROM NULL → TRUE
         * @param {*} a - First operand
         * @param {*} b - Second operand
         * @returns {boolean}
         */
        isNotDistinctFrom(a, b) {
            return !this.isDistinctFrom(a, b);
        },

        /**
         * NULLIF function (SQL standard)
         * Returns NULL if the two arguments are equal, otherwise returns the first argument
         * @param {*} a - First operand
         * @param {*} b - Second operand
         * @returns {*}
         */
        nullIf(a, b) {
            if (this.isAbsent(a) || this.isAbsent(b)) return a;
            return a === b ? null : a;
        },

        // ============================================================================
        // CODD-COMPLIANT ARITHMETIC (NULL Propagation)
        // ============================================================================

        /**
         * Add with NULL propagation (Codd semantics)
         * NULL + 5 = NULL (we don't know what NULL represents)
         * @param {*} a - First operand
         * @param {*} b - Second operand
         * @returns {number|null}
         */
        add(a, b) {
            if (this.isAbsent(a) || this.isAbsent(b)) return null;
            return Number(a) + Number(b);
        },

        /**
         * Subtract with NULL propagation
         * @param {*} a - First operand
         * @param {*} b - Second operand
         * @returns {number|null}
         */
        subtract(a, b) {
            if (this.isAbsent(a) || this.isAbsent(b)) return null;
            return Number(a) - Number(b);
        },

        /**
         * Multiply with NULL propagation
         * @param {*} a - First operand
         * @param {*} b - Second operand
         * @returns {number|null}
         */
        multiply(a, b) {
            if (this.isAbsent(a) || this.isAbsent(b)) return null;
            return Number(a) * Number(b);
        },

        /**
         * Divide with NULL propagation
         * @param {*} a - Dividend
         * @param {*} b - Divisor
         * @returns {number|null}
         */
        divide(a, b) {
            if (this.isAbsent(a) || this.isAbsent(b)) return null;
            const divisor = Number(b);
            if (divisor === 0) return null;  // Division by zero → NULL
            return Number(a) / divisor;
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
         * Create a Codd A-mark (Applicable but unknown)
         * Use when the value should exist but is not known
         * @param {string} reason - Why the value is unknown
         * @param {Object} metadata - Additional metadata
         * @returns {Object}
         */
        createAMark(reason = null, metadata = {}) {
            return {
                __eo_absent: true,
                type: 'a_mark',
                coddMark: 'a_mark',
                reason: reason || 'Value exists but is unknown',
                createdAt: new Date().toISOString(),
                ...metadata
            };
        },

        /**
         * Create a Codd I-mark (Inapplicable)
         * Use when the attribute doesn't apply to this entity
         * @param {string} reason - Why the attribute doesn't apply
         * @param {Object} metadata - Additional metadata
         * @returns {Object}
         */
        createIMark(reason = null, metadata = {}) {
            return {
                __eo_absent: true,
                type: 'i_mark',
                coddMark: 'i_mark',
                reason: reason || 'Attribute does not apply to this entity',
                createdAt: new Date().toISOString(),
                ...metadata
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
            const {
                nullString = '—',
                undefinedString = '—',
                emptyString = '(empty)',
                aMarkString = '?',        // Codd A-mark: unknown but applicable
                iMarkString = 'N/A',      // Codd I-mark: not applicable
                unknownString = 'UNKNOWN', // Three-valued logic UNKNOWN
                markerString = null
            } = options;

            // Handle UNKNOWN sentinel (three-valued logic)
            if (this.isUnknown(value)) {
                return unknownString;
            }

            if (this.isMarker(value)) {
                // Handle Codd marks specifically
                if (value.coddMark === 'a_mark') {
                    return markerString || aMarkString;
                }
                if (value.coddMark === 'i_mark') {
                    return markerString || iMarkString;
                }
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
                    return iMarkString;
                case 'unknown':
                    return aMarkString;
                case 'a_mark':
                    return aMarkString;
                case 'i_mark':
                    return iMarkString;
                default:
                    return String(value);
            }
        },

        // ============================================================================
        // CODD-COMPLIANT AGGREGATES
        // ============================================================================

        /**
         * Codd-compliant SUM with NULL tracking
         * NULLs are excluded from sum but tracked
         * @param {Array} values - Values to sum
         * @returns {Object} Result with value and metadata
         */
        sumWithNullTracking(values) {
            if (!Array.isArray(values)) {
                return { value: null, nullCount: 0, presentCount: 0, certainty: 0 };
            }

            const present = [];
            let nullCount = 0;
            let iMarkCount = 0;

            for (const v of values) {
                if (this.isIMark(v)) {
                    iMarkCount++;
                } else if (this.isAbsent(v)) {
                    nullCount++;
                } else if (typeof v === 'number' && !isNaN(v)) {
                    present.push(v);
                }
            }

            const sum = present.reduce((a, b) => a + b, 0);
            const totalApplicable = present.length + nullCount;  // I-marks don't count

            return {
                value: present.length > 0 ? sum : null,
                nullCount,
                iMarkCount,
                presentCount: present.length,
                totalApplicable,
                certainty: totalApplicable > 0 ? present.length / totalApplicable : 0
            };
        },

        /**
         * Codd-compliant AVG with NULL tracking
         * NULLs excluded from both sum and count, I-marks excluded entirely
         * @param {Array} values - Values to average
         * @returns {Object} Result with value and metadata
         */
        avgWithNullTracking(values) {
            const sumResult = this.sumWithNullTracking(values);

            if (sumResult.presentCount === 0) {
                return {
                    value: null,
                    ...sumResult
                };
            }

            return {
                value: sumResult.value / sumResult.presentCount,
                ...sumResult
            };
        },

        /**
         * Codd-compliant COUNT variations
         * @param {Array} values - Values to count
         * @param {string} mode - 'all' (COUNT(*)), 'present' (COUNT(column)), 'null' (null only)
         * @returns {Object} Count result with breakdown
         */
        countWithNullTracking(values, mode = 'present') {
            if (!Array.isArray(values)) {
                return { value: 0, total: 0, nullCount: 0, presentCount: 0 };
            }

            let nullCount = 0;
            let iMarkCount = 0;
            let presentCount = 0;

            for (const v of values) {
                if (this.isIMark(v)) {
                    iMarkCount++;
                } else if (this.isAbsent(v)) {
                    nullCount++;
                } else {
                    presentCount++;
                }
            }

            const total = values.length;
            let value;

            switch (mode) {
                case 'all':       // COUNT(*) - all rows
                    value = total;
                    break;
                case 'present':   // COUNT(column) - non-null values
                    value = presentCount;
                    break;
                case 'null':      // Count nulls only
                    value = nullCount;
                    break;
                case 'applicable': // Exclude I-marks
                    value = presentCount + nullCount;
                    break;
                default:
                    value = presentCount;
            }

            return {
                value,
                total,
                nullCount,
                iMarkCount,
                presentCount,
                applicableCount: presentCount + nullCount
            };
        }
    };

    // Export to global scope
    global.EOAbsence = EOAbsence;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOAbsence;
    }

})(typeof window !== 'undefined' ? window : global);
