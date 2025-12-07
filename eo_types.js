/**
 * EO Types
 * JSDoc type definitions for the EO system
 *
 * Philosophy: TypeScript-style type safety via JSDoc
 * Enables IDE autocomplete and documentation
 *
 * EO Operator: DES (Designate) - Naming and defining types
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CORE EO TYPES
    // ============================================================================

    /**
     * @typedef {'NUL'|'DES'|'INS'|'SEG'|'CON'|'ALT'|'SYN'|'SUP'|'REC'} EOOperator
     * The 9 fundamental EO operators
     */

    /**
     * @typedef {1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27} EOPosition
     * The 27 positions in the EO realm system
     */

    /**
     * @typedef {'I'|'II'|'III'|'IV'|'V'} EORealm
     * The 5 EO realms
     * - I: Pre-formation (1-6)
     * - II: Nascent Form (7-12)
     * - III: Explicit Form (13-18)
     * - IV: Pattern Mastery (19-24)
     * - V: Meta-stability (25-27)
     */

    /**
     * @typedef {'emanon'|'protogon'|'holon'} EOEntityType
     * Module developmental states
     */

    /**
     * @typedef {'emerging'|'forming'|'stable'} EOStability
     * Entity stability classification
     */

    // ============================================================================
    // CONTEXT TYPES
    // ============================================================================

    /**
     * @typedef {'measured'|'declared'|'aggregated'|'inferred'|'derived'} EOMethod
     * How a value was obtained
     */

    /**
     * @typedef {'individual'|'team'|'department'|'organization'} EOScale
     * Hierarchical scale of a value
     */

    /**
     * @typedef {'instant'|'day'|'week'|'month'|'quarter'|'year'} EOTimeGranularity
     * Timeframe granularity
     */

    /**
     * @typedef {Object} EOTimeframe
     * @property {EOTimeGranularity} granularity - Time granularity
     * @property {string} start - ISO 8601 start timestamp
     * @property {string} end - ISO 8601 end timestamp
     */

    /**
     * @typedef {Object} EOAgent
     * @property {'system'|'person'} type - Agent type
     * @property {string|null} id - Agent ID
     * @property {string|null} name - Agent display name
     */

    /**
     * @typedef {Object} EOSource
     * @property {string} system - Source system identifier
     * @property {string} [file] - Source filename
     * @property {string} [formula] - Source formula
     * @property {string[]} [dependencies] - Formula dependencies
     */

    /**
     * @typedef {Object} EOContextSchema
     * @property {EOMethod} method - How value was obtained
     * @property {string|null} definition - What this value means
     * @property {EOScale} scale - Hierarchical scale
     * @property {EOTimeframe} timeframe - Time context
     * @property {EOSource} source - Data source
     * @property {EOAgent} agent - Who/what created this
     * @property {Object|null} subject - Subject of the value
     */

    // ============================================================================
    // DATA TYPES
    // ============================================================================

    /**
     * @typedef {Object} EOValueObservation
     * @property {*} value - The actual value
     * @property {string} timestamp - ISO 8601 timestamp
     * @property {string} source - Source identifier
     * @property {EOContextSchema} context_schema - Full context
     */

    /**
     * @typedef {Object} EOCell
     * @property {string} cell_id - Unique cell identifier
     * @property {string} record_id - Parent record ID
     * @property {string} field_name - Field/column name
     * @property {EOValueObservation[]} values - Value observations (SUP support)
     * @property {string} created_at - Creation timestamp
     * @property {string} updated_at - Last update timestamp
     */

    /**
     * @typedef {Object} EOHistoryEntry
     * @property {string} timestamp - ISO 8601 timestamp
     * @property {EOOperator} operator - EO operator applied
     * @property {string} description - Human-readable description
     * @property {EOAgent} agent - Who made the change
     * @property {*} old_value - Previous value
     * @property {*} new_value - New value
     */

    /**
     * @typedef {Object} EORecord
     * @property {string} record_id - Unique record identifier
     * @property {Object} fields - Legacy field-value map
     * @property {EOCell[]} cells - SUP-enabled cells
     * @property {string} created_at - Creation timestamp
     * @property {string} updated_at - Last update timestamp
     * @property {EOHistoryEntry[]} edit_history - Edit history
     * @property {*[]} value_history - Value change history
     * @property {EOStabilityInfo} stability - Stability classification
     * @property {string} [sourceImportId] - Import this record came from (null if manual)
     * @property {number} [sourceRowNumber] - Row number in source import
     * @property {string} [contentHash] - Hash for deduplication
     */

    /**
     * @typedef {Object} EOStabilityInfo
     * @property {EOStability} classification - Stability level
     * @property {string} calculated_at - When classification was made
     */

    // ============================================================================
    // SET & VIEW TYPES
    // ============================================================================

    /**
     * @typedef {'TEXT'|'NUMBER'|'CURRENCY'|'SELECT'|'MULTI_SELECT'|'DATE'|'DATETIME'|'TIME'|'CHECKBOX'|'EMAIL'|'URL'|'LONG_TEXT'|'FORMULA'|'ROLLUP'|'LOOKUP'|'LINKED_RECORD'|'MULTI_FIELD'} EOFieldType
     */

    /**
     * @typedef {'date'|'datetime'|'time'} EODateTimeMode
     * Date/time field mode
     */

    /**
     * @typedef {'24h'|'12h'|'12h_ampm'} EOTimeFormat
     * Time display format
     */

    /**
     * @typedef {Object} EODateTimeConfig
     * Configuration for DATE, DATETIME, and TIME fields
     * @property {EODateTimeMode} mode - Field mode (date, datetime, time)
     * @property {EOTimeFormat} timeFormat - Time format (24h, 12h, 12h_ampm)
     * @property {string} dateFormat - Date display format (MM/DD/YYYY, DD/MM/YYYY, etc.)
     * @property {boolean} showTimezone - Whether to show timezone
     * @property {string|null} timezone - Timezone identifier (America/Chicago, etc.)
     * @property {boolean} includeSeconds - Whether to include seconds in time
     * @property {boolean} allowClear - Whether to allow clearing the value
     */

    /**
     * @typedef {Object} EOFieldSchema
     * @property {string} id - Field identifier
     * @property {string} name - Display name
     * @property {EOFieldType} type - Field type
     * @property {string} width - Column width (CSS)
     * @property {Object|EODateTimeConfig} config - Type-specific configuration
     * @property {boolean} [hidden] - Whether field is hidden
     * @property {boolean} [locked] - Whether field is locked
     */

    /**
     * @typedef {Object} EOImportSource
     * @property {string} importId - Import identifier
     * @property {string} importName - Import filename
     * @property {number} recordCount - Records from this import
     * @property {string[]} recordIds - Record IDs from this import
     * @property {string} addedAt - When import was added to set
     * @property {'additive'|'merge'|'linked'} mode - How import was added
     * @property {Object} dedupStats - Deduplication statistics
     * @property {number} dedupStats.duplicatesFound - Duplicates detected
     * @property {number} dedupStats.duplicatesHidden - Duplicates currently hidden
     * @property {'hide'|'show'|'sup'} dedupStats.handling - How duplicates are handled
     */

    /**
     * @typedef {Object} EOSet
     * @property {string} id - Set identifier
     * @property {string} name - Display name
     * @property {EOFieldSchema[]} schema - Field definitions
     * @property {Map<string, Object>} records - Record map
     * @property {string} createdAt - Creation timestamp
     * @property {string} updatedAt - Last update timestamp
     * @property {string} [importId] - Source import ID (legacy, single import)
     * @property {EOImportSource[]} [sources] - All import sources feeding this set
     * @property {'import'|'manual'|'derived'} [origin] - How set was created
     */

    /**
     * @typedef {'grid'|'gallery'|'kanban'|'calendar'|'timeline'} EOViewType
     */

    /**
     * @typedef {Object} EOViewColumn
     * @property {string} fieldId - Field ID
     * @property {string} width - Column width
     * @property {boolean} visible - Whether visible
     */

    /**
     * @typedef {Object} EOViewSort
     * @property {string} fieldId - Field to sort by
     * @property {'asc'|'desc'} direction - Sort direction
     */

    /**
     * @typedef {Object} EOViewFilter
     * @property {string} fieldId - Field to filter
     * @property {string} operator - Filter operator
     * @property {*} value - Filter value
     */

    /**
     * @typedef {Object} EOView
     * @property {string} id - View identifier
     * @property {string} name - Display name
     * @property {EOViewType} type - View type
     * @property {string} setId - Parent set ID
     * @property {EOViewColumn[]} columns - Column configuration
     * @property {EOViewSort[]} sorts - Sort configuration
     * @property {EOViewFilter[]} filters - Filter configuration
     * @property {Object} config - Type-specific configuration
     * @property {boolean} isDirty - Has unsaved changes
     * @property {string} createdAt - Creation timestamp
     * @property {string} updatedAt - Last update timestamp
     */

    // ============================================================================
    // IMPORT TYPES
    // ============================================================================

    /**
     * @typedef {'csv'|'tsv'|'json'|'xlsx'|'xls'} EOImportFormat
     */

    /**
     * @typedef {Object} EOImportQuality
     * @property {number} rowCount - Number of rows
     * @property {number} columnCount - Number of columns
     * @property {number} completeness - Completeness ratio (0-1)
     * @property {string} completenessPercent - Formatted completeness
     * @property {number} duplicateRows - Number of duplicate rows
     * @property {number} score - Quality score (0-100)
     */

    /**
     * @typedef {Object} EOImport
     * @property {string} id - Import identifier
     * @property {string} name - Filename
     * @property {Object} source - Source metadata
     * @property {Object} fileMetadata - File metadata
     * @property {Object} embeddedMetadata - Content metadata
     * @property {Object} schema - Inferred schema
     * @property {EOImportQuality} quality - Quality metrics
     * @property {string[]} headers - Column headers
     * @property {Object[]} rows - Data rows
     * @property {number} rowCount - Row count
     * @property {number} columnCount - Column count
     * @property {Object[]} usedIn - Usage tracking
     * @property {'ready'|'processing'|'error'|'archived'} status - Import status
     * @property {string} createdAt - Creation timestamp
     * @property {string} updatedAt - Last update timestamp
     */

    // ============================================================================
    // TOSS PILE TYPES
    // ============================================================================

    /**
     * @typedef {'tossed'|'picked_up'} EOTossEntryStatus
     */

    /**
     * @typedef {Object} EOTossEntry
     * @property {string} id - Entry identifier
     * @property {*} value - Tossed value
     * @property {string} setId - Source set ID
     * @property {string} recordId - Source record ID
     * @property {string} fieldId - Source field ID
     * @property {string} fieldName - Field display name
     * @property {EOFieldType} fieldType - Field type
     * @property {string} actionId - Parent action ID
     * @property {string} tossedAt - Toss timestamp
     * @property {EOTossEntryStatus} status - Entry status
     * @property {Object} recordSnapshot - Record snapshot at toss time
     * @property {Object} fieldSnapshot - Field snapshot at toss time
     */

    /**
     * @typedef {'toss_record'|'toss_records'|'toss_column'|'toss_cell'|'toss_set'|'clear_cell'} EOTossActionType
     */

    /**
     * @typedef {Object} EOTossAction
     * @property {string} id - Action identifier
     * @property {EOTossActionType} type - Action type
     * @property {string} setId - Affected set ID
     * @property {string} setName - Set name at toss time
     * @property {string} timestamp - Action timestamp
     * @property {string} summary - Human-readable summary
     * @property {string[]} entryIds - Child entry IDs
     * @property {Object} metadata - Additional context
     * @property {boolean} undone - Whether action was undone
     */

    // ============================================================================
    // RELATIONSHIP TYPES
    // ============================================================================

    /**
     * @typedef {Object} EORelationship
     * @property {string} id - Relationship identifier
     * @property {string} fromSetId - Source set ID
     * @property {string} fromFieldId - Source field ID
     * @property {string} toSetId - Target set ID
     * @property {string} toFieldId - Target field ID
     * @property {EOOperator} operator - EO operator describing relationship
     * @property {string} verb - Human-readable verb
     * @property {'one_to_one'|'one_to_many'|'many_to_many'} cardinality - Relationship cardinality
     * @property {Object} metadata - Additional metadata
     */

    // ============================================================================
    // MODULE INTERFACE TYPE
    // ============================================================================

    /**
     * @typedef {Object} EOModuleInterface
     * @property {string} MODULE_ID - Unique module identifier
     * @property {string} VERSION - Module version
     * @property {function(Object): void} init - Initialize module with dependencies
     * @property {function(): void} destroy - Cleanup module
     * @property {function(string, Function): Function} on - Subscribe to events
     * @property {function(string, Object): void} emit - Emit events
     * @property {function(): Object} getState - Get module state snapshot
     * @property {function(Object): void} setState - Update module state
     */

    // ============================================================================
    // VALIDATION HELPERS
    // ============================================================================

    const VALID_OPERATORS = ['NUL', 'DES', 'INS', 'SEG', 'CON', 'ALT', 'SYN', 'SUP', 'REC'];
    const VALID_METHODS = ['measured', 'declared', 'aggregated', 'inferred', 'derived'];
    const VALID_SCALES = ['individual', 'team', 'department', 'organization'];
    const VALID_GRANULARITIES = ['instant', 'day', 'week', 'month', 'quarter', 'year'];
    const VALID_STABILITY = ['emerging', 'forming', 'stable'];
    const VALID_FIELD_TYPES = [
        'TEXT', 'NUMBER', 'CURRENCY', 'SELECT', 'MULTI_SELECT',
        'DATE', 'DATETIME', 'TIME', 'CHECKBOX', 'EMAIL', 'URL', 'LONG_TEXT',
        'FORMULA', 'ROLLUP', 'LOOKUP', 'LINKED_RECORD', 'JSON', 'MULTI_FIELD'
    ];

    /**
     * Validate an EO operator
     * @param {string} operator - Operator to validate
     * @returns {boolean}
     */
    function isValidOperator(operator) {
        return VALID_OPERATORS.includes(operator);
    }

    /**
     * Validate a method
     * @param {string} method - Method to validate
     * @returns {boolean}
     */
    function isValidMethod(method) {
        return VALID_METHODS.includes(method);
    }

    /**
     * Validate a scale
     * @param {string} scale - Scale to validate
     * @returns {boolean}
     */
    function isValidScale(scale) {
        return VALID_SCALES.includes(scale);
    }

    /**
     * Validate time granularity
     * @param {string} granularity - Granularity to validate
     * @returns {boolean}
     */
    function isValidGranularity(granularity) {
        return VALID_GRANULARITIES.includes(granularity);
    }

    /**
     * Validate stability
     * @param {string} stability - Stability to validate
     * @returns {boolean}
     */
    function isValidStability(stability) {
        return VALID_STABILITY.includes(stability);
    }

    /**
     * Validate field type
     * @param {string} type - Field type to validate
     * @returns {boolean}
     */
    function isValidFieldType(type) {
        return VALID_FIELD_TYPES.includes(type);
    }

    /**
     * Validate a context schema
     * @param {Object} schema - Schema to validate
     * @returns {{valid: boolean, errors: string[]}}
     */
    function validateContextSchema(schema) {
        const errors = [];

        if (!isValidMethod(schema.method)) {
            errors.push(`Invalid method: ${schema.method}`);
        }

        if (!isValidScale(schema.scale)) {
            errors.push(`Invalid scale: ${schema.scale}`);
        }

        if (schema.timeframe && !isValidGranularity(schema.timeframe.granularity)) {
            errors.push(`Invalid granularity: ${schema.timeframe?.granularity}`);
        }

        return { valid: errors.length === 0, errors };
    }

    // ============================================================================
    // ID GENERATORS
    // ============================================================================

    /**
     * Generate a unique record ID
     * @returns {string}
     */
    function generateRecordId() {
        return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate a unique set ID
     * @returns {string}
     */
    function generateSetId() {
        return 'set_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate a unique view ID
     * @returns {string}
     */
    function generateViewId() {
        return 'view_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate a unique field ID
     * @returns {string}
     */
    function generateFieldId() {
        return 'fld_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate a unique cell ID
     * @param {string} recordId - Record ID
     * @param {string} fieldId - Field ID
     * @returns {string}
     */
    function generateCellId(recordId, fieldId) {
        return `${recordId}_field_${fieldId}`;
    }

    /**
     * Generate a unique import ID
     * @returns {string}
     */
    function generateImportId() {
        return 'imp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate a unique event ID
     * @returns {string}
     */
    function generateEventId() {
        return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOTypes = {
        // Validation constants
        OPERATORS: VALID_OPERATORS,
        METHODS: VALID_METHODS,
        SCALES: VALID_SCALES,
        GRANULARITIES: VALID_GRANULARITIES,
        STABILITY_LEVELS: VALID_STABILITY,
        FIELD_TYPES: VALID_FIELD_TYPES,

        // Validators
        isValidOperator,
        isValidMethod,
        isValidScale,
        isValidGranularity,
        isValidStability,
        isValidFieldType,
        validateContextSchema,

        // ID Generators
        generateRecordId,
        generateSetId,
        generateViewId,
        generateFieldId,
        generateCellId,
        generateImportId,
        generateEventId
    };

    // Export to global scope
    global.EOTypes = EOTypes;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOTypes;
    }

})(typeof window !== 'undefined' ? window : global);
