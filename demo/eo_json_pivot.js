/**
 * EO JSON Pivot
 *
 * Provides logic for pivoting JSON data into views by keys or values.
 *
 * Key Features:
 * - Key-based pivoting: Create exploratory views grouped by a field (Kanban)
 * - Value-based pivoting: Create filtered views for specific values
 * - Link detection: Automatically identify record IDs in JSON values
 * - Auto-enhancement: Add lookup/rollup fields for linked records
 * - Nested view navigation: Easy drill-down into linked records
 */

class EOJSONPivot {
    constructor(state) {
        this.state = state;
    }

    // ========================================================================
    // LINK DETECTION
    // ========================================================================

    /**
     * Detect if a field contains record IDs (links to other records)
     * @param {string} fieldId - Field ID to analyze
     * @param {Object} set - The set containing the field
     * @returns {Object|null} - Link info or null if not a link
     */
    detectLinkField(fieldId, set) {
        if (!set || !set.records) return null;

        const records = Array.from(set.records.values());
        if (records.length === 0) return null;

        // Sample up to 100 records
        const sampleSize = Math.min(100, records.length);
        const samples = records.slice(0, sampleSize);

        let linkInfo = {
            isLink: false,
            targetSetId: null,
            targetSetName: null,
            cardinality: 'one', // 'one' or 'many'
            pattern: null
        };

        // Collect sample values
        const values = samples
            .map(r => r[fieldId])
            .filter(v => v !== null && v !== undefined && v !== '');

        if (values.length === 0) return null;

        // Check for array values (one-to-many)
        const hasArrays = values.some(v => Array.isArray(v));
        if (hasArrays) {
            linkInfo.cardinality = 'many';
            // Flatten array values for pattern detection
            const flatValues = values.flatMap(v => Array.isArray(v) ? v : [v]);
            const detected = this.detectRecordIdPattern(flatValues);
            if (detected.isLink) {
                return { ...linkInfo, ...detected };
            }
        } else {
            // Check single values (one-to-one)
            const detected = this.detectRecordIdPattern(values);
            if (detected.isLink) {
                return { ...linkInfo, ...detected };
            }
        }

        return null;
    }

    /**
     * Detect if values match record ID patterns
     * @param {Array} values - Array of values to check
     * @returns {Object} - Detection result
     */
    detectRecordIdPattern(values) {
        if (!values || values.length === 0) {
            return { isLink: false };
        }

        // Common record ID patterns
        const patterns = [
            { regex: /^rec_[a-zA-Z0-9]{10,}$/, prefix: 'rec', name: 'Records' },
            { regex: /^user_[a-zA-Z0-9]{10,}$/, prefix: 'user', name: 'Users' },
            { regex: /^proj_[a-zA-Z0-9]{10,}$/, prefix: 'proj', name: 'Projects' },
            { regex: /^task_[a-zA-Z0-9]{10,}$/, prefix: 'task', name: 'Tasks' },
            { regex: /^org_[a-zA-Z0-9]{10,}$/, prefix: 'org', name: 'Organizations' },
            { regex: /^set_[a-zA-Z0-9]{10,}$/, prefix: 'set', name: 'Sets' },
            { regex: /^[a-zA-Z0-9]{20,}$/, prefix: null, name: 'Generic IDs' }
        ];

        // Test each pattern
        for (const pattern of patterns) {
            const matchCount = values.filter(v =>
                typeof v === 'string' && pattern.regex.test(v)
            ).length;

            const matchPercentage = (matchCount / values.length) * 100;

            // If 80% or more values match the pattern, consider it a link
            if (matchPercentage >= 80) {
                const targetSet = this.findSetByPattern(pattern.prefix);

                return {
                    isLink: true,
                    pattern: pattern.regex,
                    targetSetId: targetSet?.id || null,
                    targetSetName: targetSet?.name || pattern.name,
                    confidence: matchPercentage
                };
            }
        }

        return { isLink: false };
    }

    /**
     * Find a set by record ID prefix
     * @param {string} prefix - Record ID prefix (e.g., 'user', 'proj')
     * @returns {Object|null} - Set object or null
     */
    findSetByPattern(prefix) {
        if (!prefix || !this.state.sets) return null;

        // Try to find a set whose records have IDs matching this prefix
        for (const set of this.state.sets.values()) {
            if (!set.records || set.records.size === 0) continue;

            const firstRecord = Array.from(set.records.values())[0];
            const recordId = firstRecord.id || firstRecord._id || firstRecord.record_id;

            if (recordId && typeof recordId === 'string' && recordId.startsWith(prefix + '_')) {
                return set;
            }
        }

        return null;
    }

    // ========================================================================
    // PIVOT VIEW CREATION
    // ========================================================================

    /**
     * Create a key-based pivot view (exploratory, grouped by field)
     * @param {string} fieldId - Field ID to pivot on
     * @param {string} fieldName - Field name for display
     * @param {Object} set - Source set
     * @param {Object} options - Additional options
     * @returns {Object} - Created view
     */
    createKeyPivotView(fieldId, fieldName, set, options = {}) {
        const {
            sourceRecordId = null,
            derivedFromJSON = true
        } = options;

        // Detect if this field is a link
        const linkInfo = this.detectLinkField(fieldId, set);

        // Create a Kanban view grouped by this field
        const viewConfig = {
            setId: set.id,
            name: options.name || `By ${fieldName}`,
            type: 'kanban',
            icon: '📊',
            visibleFieldIds: (set.schema || []).map(f => f.id),
            kanbanGroupField: fieldId,
            cardFields: this.selectDefaultCardFields(set, fieldId),
            filters: [
                {
                    fieldId: fieldId,
                    operator: 'notEmpty',
                    value: null
                }
            ],
            sorts: [],
            groups: [],
            focus: {
                kind: 'field',
                id: fieldId,
                fieldName: fieldName
            },
            provenance: {
                createdBy: 'user',
                createdAt: Date.now(),
                derivedFromJSON: derivedFromJSON ? {
                    sourceRecordId,
                    pivotType: 'key',
                    pivotField: fieldName,
                    fieldId
                } : undefined,
                notes: `Key pivot: Exploring all values of "${fieldName}"`
            }
        };

        const view = window.createView ? window.createView(this.state, viewConfig) : null;

        // Auto-enhance with linked fields if this is a link field
        if (view && linkInfo && linkInfo.isLink) {
            this.enhanceViewWithLinks(view, fieldId, linkInfo, set);
        }

        return view;
    }

    /**
     * Create a value-based pivot view (filtered by specific value)
     * @param {string} fieldId - Field ID to filter on
     * @param {string} fieldName - Field name for display
     * @param {*} value - Value to filter by
     * @param {Object} set - Source set
     * @param {Object} options - Additional options
     * @returns {Object} - Created view
     */
    createValuePivotView(fieldId, fieldName, value, set, options = {}) {
        const {
            sourceRecordId = null,
            derivedFromJSON = true
        } = options;

        // Detect if this field is a link
        const linkInfo = this.detectLinkField(fieldId, set);

        // Format value for display
        const displayValue = this.formatValueForDisplay(value);

        // Create a filtered grid view
        const viewConfig = {
            setId: set.id,
            name: options.name || `${fieldName} = ${displayValue}`,
            type: 'grid',
            icon: '🔍',
            visibleFieldIds: (set.schema || []).map(f => f.id),
            filters: [
                {
                    fieldId: fieldId,
                    operator: 'equals',
                    value: value
                }
            ],
            sorts: [],
            groups: [],
            focus: {
                kind: 'value',
                fieldId: fieldId,
                fieldName: fieldName,
                value: value
            },
            provenance: {
                createdBy: 'user',
                createdAt: Date.now(),
                derivedFromJSON: derivedFromJSON ? {
                    sourceRecordId,
                    pivotType: 'value',
                    pivotField: fieldName,
                    pivotValue: value,
                    fieldId
                } : undefined,
                notes: `Value pivot: Filtering where "${fieldName}" = "${displayValue}"`
            }
        };

        const view = window.createView ? window.createView(this.state, viewConfig) : null;

        // Auto-enhance with linked fields if this is a link field
        if (view && linkInfo && linkInfo.isLink) {
            this.enhanceViewWithLinks(view, fieldId, linkInfo, set);
        }

        return view;
    }

    // ========================================================================
    // AUTO-ENHANCEMENT WITH LINKED FIELDS
    // ========================================================================

    /**
     * Enhance a view by automatically adding lookup/rollup fields for linked records
     * @param {Object} view - View to enhance
     * @param {string} linkFieldId - ID of the link field
     * @param {Object} linkInfo - Link information from detectLinkField
     * @param {Object} sourceSet - Source set
     */
    enhanceViewWithLinks(view, linkFieldId, linkInfo, sourceSet) {
        if (!linkInfo.targetSetId) return;

        const targetSet = this.state.sets.get(linkInfo.targetSetId);
        if (!targetSet || !targetSet.schema) return;

        // Initialize relationships and rollups arrays if they don't exist
        if (!view.relationships) {
            view.relationships = [];
        }
        if (!view.rollups) {
            view.rollups = [];
        }

        // Select fields to add from target set
        const fieldsToAdd = this.selectFieldsForAutoEnhancement(targetSet);

        fieldsToAdd.forEach(field => {
            if (linkInfo.cardinality === 'one') {
                // Add lookup field for one-to-one relationship
                const lookupField = {
                    id: `lookup_${linkFieldId}_${field.id}`,
                    name: `${linkInfo.targetSetName}: ${field.name}`,
                    type: 'LOOKUP',
                    sourceFieldId: linkFieldId,
                    targetSetId: targetSet.id,
                    targetFieldId: field.id
                };
                view.relationships.push(lookupField);
            } else {
                // Add rollup field for one-to-many relationship
                const rollupField = {
                    id: `rollup_${linkFieldId}_${field.id}`,
                    name: `${linkInfo.targetSetName}: ${field.name} (count)`,
                    type: 'ROLLUP',
                    sourceFieldId: linkFieldId,
                    targetSetId: targetSet.id,
                    targetFieldId: field.id,
                    aggregation: 'count' // Default to count
                };
                view.rollups.push(rollupField);
            }
        });

        // Mark view as dirty to trigger re-render
        view.isDirty = true;
    }

    /**
     * Select fields from target set to auto-add
     * @param {Object} targetSet - Target set
     * @returns {Array} - Fields to add
     */
    selectFieldsForAutoEnhancement(targetSet) {
        const fields = targetSet.schema || [];
        const selected = [];

        // Priority fields to include
        const priorities = ['name', 'title', 'email', 'status', 'type', 'category'];

        // Add priority fields first
        priorities.forEach(priorityName => {
            const field = fields.find(f =>
                (f.name || '').toLowerCase() === priorityName ||
                (f.id || '').toLowerCase() === priorityName
            );
            if (field && selected.length < 3) {
                selected.push(field);
            }
        });

        // If we don't have enough, add the first few non-system fields
        if (selected.length < 3) {
            const remaining = fields.filter(f =>
                !f.id.startsWith('_') &&
                !selected.includes(f) &&
                f.type !== 'LINK_RECORD'
            );
            selected.push(...remaining.slice(0, 3 - selected.length));
        }

        return selected;
    }

    /**
     * Select default card fields for Kanban view
     * @param {Object} set - Set object
     * @param {string} excludeFieldId - Field ID to exclude (the grouping field)
     * @returns {Array} - Field IDs to show on cards
     */
    selectDefaultCardFields(set, excludeFieldId) {
        const fields = (set.schema || []).filter(f => f.id !== excludeFieldId);
        const priorities = ['name', 'title', 'description', 'status', 'owner'];

        const selected = [];

        // Add priority fields
        priorities.forEach(priorityName => {
            const field = fields.find(f =>
                (f.name || '').toLowerCase() === priorityName
            );
            if (field && selected.length < 3) {
                selected.push(field.id);
            }
        });

        // Add remaining fields if needed
        if (selected.length < 3) {
            const remaining = fields
                .filter(f => !selected.includes(f.id) && f.type !== 'LINK_RECORD')
                .slice(0, 3 - selected.length);
            selected.push(...remaining.map(f => f.id));
        }

        return selected;
    }

    // ========================================================================
    // LINKED RECORD NAVIGATION
    // ========================================================================

    /**
     * Create a view from a linked record field
     * @param {string} linkFieldId - Link field ID
     * @param {string} recordId - Specific record ID to focus on
     * @param {Object} sourceSet - Source set
     * @returns {Object} - Created view
     */
    createViewFromLink(linkFieldId, recordId, sourceSet) {
        const linkField = sourceSet.schema.find(f => f.id === linkFieldId);
        if (!linkField || linkField.type !== 'LINK_RECORD') return null;

        const targetSetId = linkField.config?.linkedSetId;
        if (!targetSetId) return null;

        const targetSet = this.state.sets.get(targetSetId);
        if (!targetSet) return null;

        // Create a view of the linked set filtered to this record
        const viewConfig = {
            setId: targetSetId,
            name: `Linked from ${sourceSet.name}`,
            type: 'grid',
            icon: '🔗',
            visibleFieldIds: (targetSet.schema || []).map(f => f.id),
            filters: [
                {
                    fieldId: 'id',
                    operator: 'equals',
                    value: recordId
                }
            ],
            provenance: {
                createdBy: 'user',
                createdAt: Date.now(),
                notes: `Created from link field: ${linkField.name}`
            }
        };

        return window.createView ? window.createView(this.state, viewConfig) : null;
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Format value for display in view names
     * @param {*} value - Value to format
     * @param {number} maxLen - Maximum length
     * @returns {string} - Formatted value
     */
    formatValueForDisplay(value, maxLen = 20) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
            return value.length > maxLen ? value.substring(0, maxLen) + '...' : value;
        }
        if (Array.isArray(value)) return `[${value.length}]`;
        if (typeof value === 'object') return '{...}';
        return String(value);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.EOJSONPivot = EOJSONPivot;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EOJSONPivot };
}
