/**
 * EO Segmentation (SEG Operator)
 * Reusable framework for filtering, partitioning, and grouping data
 *
 * @eo_operator SEG
 * @eo_layer foundation
 *
 * The SEG operator handles data segmentation - dividing data into
 * meaningful groups or filtering to subsets. This module provides
 * a comprehensive framework for all segmentation operations.
 */

(function(global) {
    'use strict';

    /**
     * EOSegmentation - Data filtering and partitioning framework
     */
    const EOSegmentation = {
        // ============================================================================
        // FILTERING
        // ============================================================================

        /**
         * Filter records by a predicate
         * @param {Array} records - Records to filter
         * @param {Function|Object} predicate - Filter function or condition object
         * @returns {Array}
         */
        filter(records, predicate) {
            if (!Array.isArray(records)) return [];

            if (typeof predicate === 'function') {
                return records.filter(predicate);
            }

            // Object-based predicate (field conditions)
            return records.filter(record => this._matchesConditions(record, predicate));
        },

        /**
         * Filter with limit (take first N matching)
         * @param {Array} records - Records to filter
         * @param {Function} predicate - Filter function
         * @param {number} limit - Maximum records to return
         * @returns {Array}
         */
        filterLimit(records, predicate, limit) {
            const result = [];
            for (const record of records) {
                if (predicate(record)) {
                    result.push(record);
                    if (result.length >= limit) break;
                }
            }
            return result;
        },

        /**
         * Reject records matching predicate (inverse of filter)
         * @param {Array} records - Records to filter
         * @param {Function|Object} predicate - Rejection criteria
         * @returns {Array}
         */
        reject(records, predicate) {
            if (typeof predicate === 'function') {
                return records.filter(r => !predicate(r));
            }
            return records.filter(r => !this._matchesConditions(r, predicate));
        },

        /**
         * Check if record matches condition object
         * @param {Object} record - Record to check
         * @param {Object} conditions - Field conditions
         * @returns {boolean}
         */
        _matchesConditions(record, conditions) {
            for (const [field, condition] of Object.entries(conditions)) {
                const value = this._getNestedValue(record, field);

                if (typeof condition === 'object' && condition !== null) {
                    // Complex condition object
                    if (!this._evaluateCondition(value, condition)) return false;
                } else {
                    // Simple equality
                    if (value !== condition) return false;
                }
            }
            return true;
        },

        /**
         * Get nested value from object using dot notation
         * @param {Object} obj - Object to query
         * @param {string} path - Dot-notation path
         * @returns {*}
         */
        _getNestedValue(obj, path) {
            return path.split('.').reduce((current, key) => current?.[key], obj);
        },

        /**
         * Evaluate a condition against a value
         * @param {*} value - Value to check
         * @param {Object} condition - Condition object
         * @returns {boolean}
         */
        _evaluateCondition(value, condition) {
            const { $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regex, $exists, $type } = condition;

            if ($eq !== undefined && value !== $eq) return false;
            if ($ne !== undefined && value === $ne) return false;
            if ($gt !== undefined && !(value > $gt)) return false;
            if ($gte !== undefined && !(value >= $gte)) return false;
            if ($lt !== undefined && !(value < $lt)) return false;
            if ($lte !== undefined && !(value <= $lte)) return false;
            if ($in !== undefined && !$in.includes(value)) return false;
            if ($nin !== undefined && $nin.includes(value)) return false;
            if ($regex !== undefined && !new RegExp($regex).test(value)) return false;
            if ($exists !== undefined && ($exists ? value === undefined : value !== undefined)) return false;
            if ($type !== undefined && typeof value !== $type) return false;

            return true;
        },

        // ============================================================================
        // PARTITIONING
        // ============================================================================

        /**
         * Partition records into two groups
         * @param {Array} records - Records to partition
         * @param {Function} predicate - Partition function
         * @returns {{ pass: Array, fail: Array }}
         */
        partition(records, predicate) {
            const pass = [];
            const fail = [];

            for (const record of records) {
                (predicate(record) ? pass : fail).push(record);
            }

            return { pass, fail };
        },

        /**
         * Partition into multiple buckets by ranges
         * @param {Array} records - Records to partition
         * @param {string} field - Field to partition by
         * @param {Array<{min: number, max: number, name: string}>} ranges - Range definitions
         * @returns {Object}
         */
        partitionByRange(records, field, ranges) {
            const result = { _unmatched: [] };

            ranges.forEach(range => {
                result[range.name] = [];
            });

            for (const record of records) {
                const value = this._getNestedValue(record, field);
                let matched = false;

                for (const range of ranges) {
                    if (value >= range.min && value < range.max) {
                        result[range.name].push(record);
                        matched = true;
                        break;
                    }
                }

                if (!matched) {
                    result._unmatched.push(record);
                }
            }

            return result;
        },

        // ============================================================================
        // GROUPING
        // ============================================================================

        /**
         * Group records by a field or function
         * @param {Array} records - Records to group
         * @param {string|Function} keySelector - Field name or key function
         * @returns {Object}
         */
        groupBy(records, keySelector) {
            const getKey = typeof keySelector === 'function'
                ? keySelector
                : record => this._getNestedValue(record, keySelector);

            return records.reduce((groups, record) => {
                const key = getKey(record);
                const keyStr = key === null || key === undefined ? '__null__' : String(key);

                if (!groups[keyStr]) {
                    groups[keyStr] = [];
                }
                groups[keyStr].push(record);
                return groups;
            }, {});
        },

        /**
         * Group by multiple fields
         * @param {Array} records - Records to group
         * @param {string[]} fields - Field names to group by
         * @returns {Object}
         */
        groupByMultiple(records, fields) {
            const getKey = record => fields.map(f => this._getNestedValue(record, f)).join('|');
            return this.groupBy(records, getKey);
        },

        /**
         * Group and aggregate
         * @param {Array} records - Records to group
         * @param {string|Function} keySelector - Key selector
         * @param {Object} aggregations - Aggregation definitions
         * @returns {Array}
         */
        groupAndAggregate(records, keySelector, aggregations) {
            const groups = this.groupBy(records, keySelector);

            return Object.entries(groups).map(([key, items]) => {
                const result = { _key: key, _count: items.length };

                for (const [name, agg] of Object.entries(aggregations)) {
                    const { field, operation } = agg;
                    const values = items.map(r => this._getNestedValue(r, field));

                    result[name] = this._aggregate(values, operation);
                }

                return result;
            });
        },

        /**
         * Aggregate values
         * @param {Array} values - Values to aggregate
         * @param {string} operation - Aggregation operation
         * @returns {*}
         */
        _aggregate(values, operation) {
            const numbers = values.filter(v => typeof v === 'number' && !isNaN(v));

            switch (operation) {
                case 'sum':
                    return numbers.reduce((a, b) => a + b, 0);
                case 'avg':
                case 'average':
                    return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
                case 'count':
                    return values.length;
                case 'min':
                    return numbers.length ? Math.min(...numbers) : null;
                case 'max':
                    return numbers.length ? Math.max(...numbers) : null;
                case 'first':
                    return values[0];
                case 'last':
                    return values[values.length - 1];
                case 'unique':
                    return [...new Set(values)];
                case 'uniqueCount':
                    return new Set(values).size;
                default:
                    return values;
            }
        },

        // ============================================================================
        // SLICING
        // ============================================================================

        /**
         * Take first N records
         * @param {Array} records - Records
         * @param {number} n - Count
         * @returns {Array}
         */
        take(records, n) {
            return records.slice(0, n);
        },

        /**
         * Skip first N records
         * @param {Array} records - Records
         * @param {number} n - Count
         * @returns {Array}
         */
        skip(records, n) {
            return records.slice(n);
        },

        /**
         * Paginate records
         * @param {Array} records - Records
         * @param {number} page - Page number (1-indexed)
         * @param {number} pageSize - Items per page
         * @returns {{ items: Array, page: number, pageSize: number, totalPages: number, totalItems: number }}
         */
        paginate(records, page = 1, pageSize = 20) {
            const startIndex = (page - 1) * pageSize;
            const items = records.slice(startIndex, startIndex + pageSize);

            return {
                items,
                page,
                pageSize,
                totalPages: Math.ceil(records.length / pageSize),
                totalItems: records.length
            };
        },

        /**
         * Sample random records
         * @param {Array} records - Records to sample from
         * @param {number} n - Number of samples
         * @param {boolean} withReplacement - Allow duplicates
         * @returns {Array}
         */
        sample(records, n, withReplacement = false) {
            if (withReplacement) {
                return Array.from({ length: n }, () =>
                    records[Math.floor(Math.random() * records.length)]
                );
            }

            const shuffled = [...records].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, n);
        },

        // ============================================================================
        // SORTING
        // ============================================================================

        /**
         * Sort records
         * @param {Array} records - Records to sort
         * @param {string|Function|Array} criteria - Sort criteria
         * @param {string} direction - 'asc' or 'desc'
         * @returns {Array}
         */
        sort(records, criteria, direction = 'asc') {
            const sorted = [...records];

            if (typeof criteria === 'function') {
                sorted.sort(criteria);
            } else if (Array.isArray(criteria)) {
                // Multi-field sort
                sorted.sort((a, b) => {
                    for (const { field, direction: dir = 'asc' } of criteria) {
                        const aVal = this._getNestedValue(a, field);
                        const bVal = this._getNestedValue(b, field);
                        const cmp = this._compare(aVal, bVal);
                        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
                    }
                    return 0;
                });
            } else {
                // Single field sort
                sorted.sort((a, b) => {
                    const aVal = this._getNestedValue(a, criteria);
                    const bVal = this._getNestedValue(b, criteria);
                    const cmp = this._compare(aVal, bVal);
                    return direction === 'desc' ? -cmp : cmp;
                });
            }

            return sorted;
        },

        /**
         * Compare two values for sorting
         * @param {*} a - First value
         * @param {*} b - Second value
         * @returns {number}
         */
        _compare(a, b) {
            if (a === b) return 0;
            if (a === null || a === undefined) return 1;
            if (b === null || b === undefined) return -1;
            if (typeof a === 'string' && typeof b === 'string') {
                return a.localeCompare(b);
            }
            return a < b ? -1 : 1;
        },

        // ============================================================================
        // SET OPERATIONS
        // ============================================================================

        /**
         * Get unique records by field
         * @param {Array} records - Records
         * @param {string} field - Field to check uniqueness
         * @returns {Array}
         */
        unique(records, field = null) {
            if (!field) {
                return [...new Map(records.map(r => [JSON.stringify(r), r])).values()];
            }

            const seen = new Set();
            return records.filter(record => {
                const value = this._getNestedValue(record, field);
                if (seen.has(value)) return false;
                seen.add(value);
                return true;
            });
        },

        /**
         * Intersection of two record sets
         * @param {Array} a - First set
         * @param {Array} b - Second set
         * @param {string|Function} key - Key for comparison
         * @returns {Array}
         */
        intersection(a, b, key) {
            const getKey = typeof key === 'function' ? key : r => this._getNestedValue(r, key);
            const bKeys = new Set(b.map(getKey));
            return a.filter(r => bKeys.has(getKey(r)));
        },

        /**
         * Difference of two record sets (a - b)
         * @param {Array} a - First set
         * @param {Array} b - Second set
         * @param {string|Function} key - Key for comparison
         * @returns {Array}
         */
        difference(a, b, key) {
            const getKey = typeof key === 'function' ? key : r => this._getNestedValue(r, key);
            const bKeys = new Set(b.map(getKey));
            return a.filter(r => !bKeys.has(getKey(r)));
        },

        /**
         * Union of two record sets
         * @param {Array} a - First set
         * @param {Array} b - Second set
         * @param {string|Function} key - Key for comparison
         * @returns {Array}
         */
        union(a, b, key) {
            const getKey = typeof key === 'function' ? key : r => this._getNestedValue(r, key);
            const seen = new Set();
            const result = [];

            for (const record of [...a, ...b]) {
                const k = getKey(record);
                if (!seen.has(k)) {
                    seen.add(k);
                    result.push(record);
                }
            }

            return result;
        },

        // ============================================================================
        // FLUENT API
        // ============================================================================

        /**
         * Create a fluent segmentation chain
         * @param {Array} records - Initial records
         * @returns {EOSegmentationChain}
         */
        chain(records) {
            return new EOSegmentationChain(records, this);
        }
    };

    /**
     * Fluent API for chaining segmentation operations
     */
    class EOSegmentationChain {
        constructor(records, seg) {
            this._records = records;
            this._seg = seg;
        }

        filter(predicate) {
            this._records = this._seg.filter(this._records, predicate);
            return this;
        }

        reject(predicate) {
            this._records = this._seg.reject(this._records, predicate);
            return this;
        }

        groupBy(keySelector) {
            this._records = this._seg.groupBy(this._records, keySelector);
            return this;
        }

        sort(criteria, direction) {
            this._records = this._seg.sort(this._records, criteria, direction);
            return this;
        }

        take(n) {
            this._records = this._seg.take(this._records, n);
            return this;
        }

        skip(n) {
            this._records = this._seg.skip(this._records, n);
            return this;
        }

        unique(field) {
            this._records = this._seg.unique(this._records, field);
            return this;
        }

        value() {
            return this._records;
        }
    }

    // Export to global scope
    global.EOSegmentation = EOSegmentation;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOSegmentation;
    }

})(typeof window !== 'undefined' ? window : global);
