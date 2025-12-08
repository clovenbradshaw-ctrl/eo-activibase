/**
 * EO Field Indicators
 *
 * Provides visual indicators for fields in the grid:
 * 1. Linked field indicators - shows when a field comes from another set
 * 2. Editability indicators - shows whether a field can be edited in the current view
 *
 * These indicators help users understand at-a-glance:
 * - Which fields are linked across sets
 * - Which fields are editable vs read-only
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const INDICATOR_ICONS = {
        linked: 'ph-link-simple',      // Field is a link to another set
        lookup: 'ph-eye',              // Field is a lookup from a linked set
        rollup: 'ph-calculator',       // Field has a rollup formula
        formula: 'ph-function',        // Computed formula field
        readOnly: 'ph-lock-simple',    // Field is read-only
        editable: 'ph-pencil-simple',  // Field is editable
        primary: 'ph-star',            // Primary/identifier field
        incoming: 'ph-arrow-left',     // Incoming link from another set
        outgoing: 'ph-arrow-right'     // Outgoing link to another set
    };

    const INDICATOR_COLORS = {
        linked: '#3b82f6',     // Blue for links
        lookup: '#8b5cf6',     // Purple for lookups
        rollup: '#6366f1',     // Indigo for rollups
        formula: '#ec4899',    // Pink for formulas
        readOnly: '#6b7280',   // Gray for read-only
        editable: '#22c55e',   // Green for editable
        primary: '#f59e0b'     // Amber for primary
    };

    // ============================================================================
    // FIELD INFO DETECTION
    // ============================================================================

    /**
     * Get comprehensive field information for indicators
     * @param {Object} field - Field schema object
     * @param {Object} set - The set containing the field
     * @param {Object} view - Current view (for relationships/lookups)
     * @param {Object} state - Global application state
     * @returns {Object} Field indicator info
     */
    function getFieldIndicatorInfo(field, set, view, state) {
        const info = {
            fieldId: field.id,
            fieldName: field.name,
            fieldType: field.type,

            // Link information
            isLinked: false,
            isLinkField: false,
            isLookupField: false,
            isRollupField: false,
            linkedSetId: null,
            linkedSetName: null,
            linkDirection: null,  // 'outgoing' | 'incoming'
            cardinality: null,    // 'one' | 'many'
            relationshipVerb: null,

            // Editability information
            isEditable: true,
            editableReason: 'Field can be edited',

            // Computed field info
            isComputed: false,
            isFormula: false,

            // Primary field
            isPrimary: field.isPrimary || view?.identifierField === field.id
        };

        // Check if this is a LINK_RECORD field
        if (field.type === 'LINK_RECORD') {
            info.isLinked = true;
            info.isLinkField = true;
            info.linkDirection = 'outgoing';

            if (field.config) {
                info.linkedSetId = field.config.linkedSetId;
                info.cardinality = field.config.cardinality || 'many';
                info.relationshipVerb = field.config.relationshipVerb;

                // Get linked set name
                const linkedSet = state?.sets?.get(field.config.linkedSetId);
                if (linkedSet) {
                    info.linkedSetName = linkedSet.name;
                }
            }
        }

        // Check if this is a lookup/rollup field (from view relationships)
        if (view?.relationships) {
            const relationship = view.relationships.find(r =>
                r.targetFieldId === field.id || r.displayName?.includes(field.name)
            );

            if (relationship) {
                info.isLinked = true;
                info.isLookupField = relationship.type === 'lookup';
                info.isRollupField = !!relationship.rollupFormula;
                info.linkedSetId = relationship.targetSetId;
                info.linkDirection = relationship.direction || 'outgoing';

                const linkedSet = state?.sets?.get(relationship.targetSetId);
                if (linkedSet) {
                    info.linkedSetName = linkedSet.name;
                }

                // Lookup fields are read-only (they show values from linked records)
                if (info.isLookupField || info.isRollupField) {
                    info.isEditable = false;
                    info.editableReason = info.isRollupField
                        ? 'Rollup field (computed from linked records)'
                        : 'Lookup field (shows values from linked records)';
                }
            }
        }

        // Check for formula fields
        if (field.type === 'FORMULA' || field.config?.formula) {
            info.isComputed = true;
            info.isFormula = true;
            info.isEditable = false;
            info.editableReason = 'Formula field (computed value)';
        }

        // Check view-level editability
        if (view?.isPivot || view?.isReadOnly) {
            info.isEditable = false;
            info.editableReason = view.isPivot
                ? 'Pivot view (read-only)'
                : 'Read-only view';
        }

        return info;
    }

    /**
     * Get all linked sets for a given set
     * @param {Object} set - The set to analyze
     * @param {Object} state - Global application state
     * @returns {Array} Array of linked set info objects
     */
    function getLinkedSetsInfo(set, state) {
        const linkedSets = [];

        if (!set?.schema) return linkedSets;

        // Find outgoing links (LINK_RECORD fields in this set)
        set.schema.forEach(field => {
            if (field.type === 'LINK_RECORD' && field.config?.linkedSetId) {
                const linkedSet = state?.sets?.get(field.config.linkedSetId);
                linkedSets.push({
                    direction: 'outgoing',
                    fieldId: field.id,
                    fieldName: field.name,
                    linkedSetId: field.config.linkedSetId,
                    linkedSetName: linkedSet?.name || 'Unknown Set',
                    cardinality: field.config.cardinality || 'many',
                    relationshipVerb: field.config.relationshipVerb
                });
            }
        });

        // Find incoming links (LINK_RECORD fields in other sets pointing to this set)
        state?.sets?.forEach((otherSet, otherSetId) => {
            if (otherSetId === set.id) return;

            otherSet.schema?.forEach(field => {
                if (field.type === 'LINK_RECORD' && field.config?.linkedSetId === set.id) {
                    linkedSets.push({
                        direction: 'incoming',
                        fieldId: field.id,
                        fieldName: field.name,
                        sourceSetId: otherSetId,
                        sourceSetName: otherSet.name,
                        cardinality: field.config.cardinality || 'many',
                        relationshipVerb: field.config.inverseVerb || field.config.relationshipVerb
                    });
                }
            });
        });

        return linkedSets;
    }

    // ============================================================================
    // INDICATOR RENDERING
    // ============================================================================

    /**
     * Render field indicator badges for column header
     * @param {Object} info - Field indicator info from getFieldIndicatorInfo
     * @returns {string} HTML string for indicator badges
     */
    function renderFieldIndicatorBadges(info) {
        const badges = [];

        // Primary field badge
        if (info.isPrimary) {
            badges.push(`
                <span class="field-indicator-badge primary" title="Primary identifier field">
                    <i class="ph ${INDICATOR_ICONS.primary}"></i>
                </span>
            `);
        }

        // Link type badge
        if (info.isLinkField) {
            const dirIcon = info.linkDirection === 'incoming'
                ? INDICATOR_ICONS.incoming
                : INDICATOR_ICONS.outgoing;
            const cardLabel = info.cardinality === 'one' ? '1:1' : '1:N';
            const tooltip = info.linkedSetName
                ? `Links to "${info.linkedSetName}" (${cardLabel})`
                : `Link field (${cardLabel})`;

            badges.push(`
                <span class="field-indicator-badge linked" title="${escapeHtml(tooltip)}">
                    <i class="ph ${INDICATOR_ICONS.linked}"></i>
                    <i class="ph ${dirIcon}" style="font-size: 8px; margin-left: -2px;"></i>
                </span>
            `);
        }

        // Lookup badge
        if (info.isLookupField && !info.isRollupField) {
            const tooltip = info.linkedSetName
                ? `Lookup from "${info.linkedSetName}"`
                : 'Lookup field';
            badges.push(`
                <span class="field-indicator-badge lookup" title="${escapeHtml(tooltip)}">
                    <i class="ph ${INDICATOR_ICONS.lookup}"></i>
                </span>
            `);
        }

        // Rollup badge
        if (info.isRollupField) {
            badges.push(`
                <span class="field-indicator-badge rollup" title="Rollup (aggregated from linked records)">
                    <i class="ph ${INDICATOR_ICONS.rollup}"></i>
                </span>
            `);
        }

        // Formula badge
        if (info.isFormula) {
            badges.push(`
                <span class="field-indicator-badge formula" title="Formula field (computed)">
                    <i class="ph ${INDICATOR_ICONS.formula}"></i>
                </span>
            `);
        }

        // Editability badge
        if (!info.isEditable) {
            badges.push(`
                <span class="field-indicator-badge read-only" title="${escapeHtml(info.editableReason)}">
                    <i class="ph ${INDICATOR_ICONS.readOnly}"></i>
                </span>
            `);
        }

        return badges.length > 0
            ? `<span class="field-indicators">${badges.join('')}</span>`
            : '';
    }

    /**
     * Render linked set summary bar for the view
     * Shows all sets linked to the current set at a glance
     * @param {Object} set - Current set
     * @param {Object} state - Global application state
     * @returns {string} HTML string for linked sets bar
     */
    function renderLinkedSetsSummary(set, state) {
        const linkedSets = getLinkedSetsInfo(set, state);

        if (linkedSets.length === 0) {
            return '';
        }

        const outgoing = linkedSets.filter(ls => ls.direction === 'outgoing');
        const incoming = linkedSets.filter(ls => ls.direction === 'incoming');

        const parts = ['<div class="linked-sets-summary">'];
        parts.push('<span class="linked-sets-label"><i class="ph ph-link-simple"></i> Linked:</span>');

        // Outgoing links
        outgoing.forEach(ls => {
            const cardLabel = ls.cardinality === 'one' ? '1:1' : '1:N';
            parts.push(`
                <span class="linked-set-chip outgoing"
                      data-set-id="${ls.linkedSetId}"
                      title="${escapeHtml(ls.fieldName)} → ${escapeHtml(ls.linkedSetName)}">
                    <i class="ph ph-arrow-right"></i>
                    ${escapeHtml(ls.linkedSetName)}
                    <span class="cardinality-label">${cardLabel}</span>
                </span>
            `);
        });

        // Incoming links
        incoming.forEach(ls => {
            const cardLabel = ls.cardinality === 'one' ? '1:1' : '1:N';
            parts.push(`
                <span class="linked-set-chip incoming"
                      data-set-id="${ls.sourceSetId}"
                      title="${escapeHtml(ls.sourceSetName)} → ${escapeHtml(ls.fieldName)}">
                    <i class="ph ph-arrow-left"></i>
                    ${escapeHtml(ls.sourceSetName)}
                    <span class="cardinality-label">${cardLabel}</span>
                </span>
            `);
        });

        parts.push('</div>');
        return parts.join('');
    }

    /**
     * Render editability summary for the current view
     * @param {Object} view - Current view
     * @param {Object} set - Current set
     * @param {Object} state - Global application state
     * @returns {Object} Summary object with editable/readOnly field counts
     */
    function getViewEditabilitySummary(view, set, state) {
        const summary = {
            totalFields: 0,
            editableFields: 0,
            readOnlyFields: 0,
            readOnlyReasons: {}
        };

        if (!set?.schema) return summary;

        set.schema.forEach(field => {
            const info = getFieldIndicatorInfo(field, set, view, state);
            summary.totalFields++;

            if (info.isEditable) {
                summary.editableFields++;
            } else {
                summary.readOnlyFields++;
                const reason = info.editableReason;
                summary.readOnlyReasons[reason] = (summary.readOnlyReasons[reason] || 0) + 1;
            }
        });

        return summary;
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOFieldIndicators = {
        // Info functions
        getFieldIndicatorInfo,
        getLinkedSetsInfo,
        getViewEditabilitySummary,

        // Rendering functions
        renderFieldIndicatorBadges,
        renderLinkedSetsSummary,

        // Constants
        INDICATOR_ICONS,
        INDICATOR_COLORS
    };

    // Export to global namespace
    global.EOFieldIndicators = EOFieldIndicators;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOFieldIndicators;
    }

})(typeof window !== 'undefined' ? window : global);
