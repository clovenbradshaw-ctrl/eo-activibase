/**
 * EO Rollup Engine
 *
 * Handles aggregation functions for linked field rollups
 * Implements Airtable-style aggregation: count, sum, avg, min, max, arrayjoin, unique, any
 */

const EOCRollupEngine = {
    /**
     * Evaluate a rollup field for a record
     * @param {Object} rollupConfig - Rollup configuration from view
     * @param {Object} record - Source record
     * @param {Object} state - Global state
     * @returns {any} Computed rollup value
     */
    evaluate(rollupConfig, record, state) {
        const {
            sourceFieldId,
            targetSetId,
            targetFieldId,
            aggregation
        } = rollupConfig;

        // Get linked record IDs from source field
        const linkedRecordIds = this.getLinkedRecordIds(record, sourceFieldId);

        if (!linkedRecordIds || linkedRecordIds.length === 0) {
            return this.getEmptyValue(aggregation);
        }

        // Get target set
        const targetSet = state.sets.get(targetSetId);
        if (!targetSet) return this.getEmptyValue(aggregation);

        // Get values from linked records
        const values = linkedRecordIds
            .map(recordId => {
                const linkedRecord = targetSet.records.get(recordId);
                return linkedRecord ? linkedRecord[targetFieldId] : null;
            })
            .filter(value => value !== null && value !== undefined && value !== '');

        // Apply aggregation
        return this.aggregate(values, aggregation);
    },

    /**
     * Get linked record IDs from a link field
     * @param {Object} record - Source record
     * @param {string} fieldId - Link field ID
     * @returns {Array} Array of linked record IDs
     */
    getLinkedRecordIds(record, fieldId) {
        const value = record[fieldId];

        if (!value) return [];

        // Handle array of IDs (one-to-many)
        if (Array.isArray(value)) {
            return value.filter(id => typeof id === 'string' && id.length > 0);
        }

        // Handle single ID (one-to-one)
        if (typeof value === 'string' && value.length > 0) {
            return [value];
        }

        return [];
    },

    /**
     * Apply aggregation function to values
     * @param {Array} values - Array of values to aggregate
     * @param {string} aggregation - Aggregation function name
     * @returns {any} Aggregated value
     */
    aggregate(values, aggregation) {
        if (!values || values.length === 0) {
            return this.getEmptyValue(aggregation);
        }

        switch (aggregation) {
            case 'count':
                return this.count(values);

            case 'sum':
                return this.sum(values);

            case 'avg':
                return this.average(values);

            case 'min':
                return this.min(values);

            case 'max':
                return this.max(values);

            case 'arrayjoin':
                return this.arrayJoin(values);

            case 'unique':
                return this.unique(values);

            case 'any':
                return this.any(values);

            default:
                console.warn(`Unknown aggregation function: ${aggregation}`);
                return null;
        }
    },

    /**
     * Count aggregation
     */
    count(values) {
        return values.length;
    },

    /**
     * Sum aggregation
     */
    sum(values) {
        const numbers = values
            .map(v => this.toNumber(v))
            .filter(n => !isNaN(n));

        if (numbers.length === 0) return 0;

        return numbers.reduce((sum, n) => sum + n, 0);
    },

    /**
     * Average aggregation
     */
    average(values) {
        const numbers = values
            .map(v => this.toNumber(v))
            .filter(n => !isNaN(n));

        if (numbers.length === 0) return 0;

        const sum = numbers.reduce((sum, n) => sum + n, 0);
        return sum / numbers.length;
    },

    /**
     * Min aggregation (handles both numbers and dates)
     */
    min(values) {
        // Check if values appear to be dates
        const dateValues = values
            .map(v => ({ original: v, timestamp: this.toTimestamp(v) }))
            .filter(item => item.timestamp !== null);

        if (dateValues.length > 0) {
            // Find the minimum timestamp and return the original date value
            const minItem = dateValues.reduce((min, item) =>
                item.timestamp < min.timestamp ? item : min
            );
            return minItem.original;
        }

        // Fall back to numeric comparison
        const numbers = values
            .map(v => this.toNumber(v))
            .filter(n => !isNaN(n));

        if (numbers.length === 0) return null;

        return Math.min(...numbers);
    },

    /**
     * Max aggregation (handles both numbers and dates)
     */
    max(values) {
        // Check if values appear to be dates
        const dateValues = values
            .map(v => ({ original: v, timestamp: this.toTimestamp(v) }))
            .filter(item => item.timestamp !== null);

        if (dateValues.length > 0) {
            // Find the maximum timestamp and return the original date value
            const maxItem = dateValues.reduce((max, item) =>
                item.timestamp > max.timestamp ? item : max
            );
            return maxItem.original;
        }

        // Fall back to numeric comparison
        const numbers = values
            .map(v => this.toNumber(v))
            .filter(n => !isNaN(n));

        if (numbers.length === 0) return null;

        return Math.max(...numbers);
    },

    /**
     * Array join aggregation (comma-separated)
     */
    arrayJoin(values) {
        return values
            .map(v => String(v))
            .filter(s => s.length > 0)
            .join(', ');
    },

    /**
     * Unique values aggregation
     */
    unique(values) {
        const uniqueValues = [...new Set(values.map(v => String(v)))];
        return uniqueValues.join(', ');
    },

    /**
     * Any value aggregation (return first non-empty value)
     */
    any(values) {
        return values[0];
    },

    /**
     * Convert value to number for numeric aggregations
     */
    toNumber(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? NaN : parsed;
        }
        return NaN;
    },

    /**
     * Convert value to timestamp for date comparisons
     * Returns null if the value is not a valid date
     */
    toTimestamp(value) {
        if (!value) return null;

        // If it's already a Date object
        if (value instanceof Date) {
            const ts = value.getTime();
            return isNaN(ts) ? null : ts;
        }

        // If it's a string, try to parse as date
        if (typeof value === 'string') {
            // Skip if it looks like just a number (not a date)
            if (/^\d+(\.\d+)?$/.test(value.trim())) {
                return null;
            }

            // Try parsing the date
            const date = new Date(value);
            const ts = date.getTime();

            // Validate: reject if invalid or if the timestamp is suspiciously small
            // (which would indicate a number was parsed, not a date)
            if (isNaN(ts)) return null;

            // Check if the parsed year is reasonable (1900-2100)
            const year = date.getFullYear();
            if (year < 1900 || year > 2100) return null;

            return ts;
        }

        // If it's a number, check if it could be a timestamp (milliseconds since epoch)
        if (typeof value === 'number') {
            // Timestamps are typically > 1 billion (year ~2001)
            // Years are typically < 10000
            if (value > 100000000000) {
                // Likely a millisecond timestamp
                return value;
            }
            // Not a date
            return null;
        }

        return null;
    },

    /**
     * Get empty value for aggregation type
     */
    getEmptyValue(aggregation) {
        switch (aggregation) {
            case 'count':
                return 0;
            case 'sum':
            case 'avg':
                return 0;
            case 'min':
            case 'max':
                return null;
            case 'arrayjoin':
            case 'unique':
                return '';
            case 'any':
                return null;
            default:
                return null;
        }
    },

    /**
     * Format rollup value for display
     * @param {any} value - Rollup value
     * @param {string} aggregation - Aggregation function name
     * @param {Object} targetField - Target field definition
     * @returns {string} Formatted display value
     */
    formatValue(value, aggregation, targetField) {
        if (value === null || value === undefined) return '';

        switch (aggregation) {
            case 'count':
                return String(value);

            case 'sum':
            case 'avg':
                // Format numbers with 2 decimal places if needed
                if (typeof value === 'number') {
                    return Number.isInteger(value) ? String(value) : value.toFixed(2);
                }
                return String(value);

            case 'min':
            case 'max':
                if (targetField?.type === 'DATE' && value) {
                    return new Date(value).toLocaleDateString();
                }
                if (typeof value === 'number') {
                    return Number.isInteger(value) ? String(value) : value.toFixed(2);
                }
                return String(value);

            case 'arrayjoin':
            case 'unique':
                return String(value);

            case 'any':
                if (targetField?.type === 'DATE' && value) {
                    return new Date(value).toLocaleDateString();
                }
                if (targetField?.type === 'CHECKBOX') {
                    return value ? '✅' : '⬜';
                }
                return String(value);

            default:
                return String(value);
        }
    }
};

// Export for use in main app
if (typeof window !== 'undefined') {
    window.EOCRollupEngine = EOCRollupEngine;
}
