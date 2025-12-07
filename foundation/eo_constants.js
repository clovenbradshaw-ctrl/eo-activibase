/**
 * EO Constants
 * Centralized constant definitions for the EO Framework
 *
 * @eo_operator DES
 * @eo_layer foundation
 *
 * This module centralizes all magic numbers and configuration constants
 * that were previously scattered throughout the codebase.
 */

(function(global) {
    'use strict';

    const EO_CONSTANTS = {
        // ============================================================================
        // TIME CONSTANTS (in milliseconds)
        // ============================================================================
        TIME: {
            SECOND: 1000,
            MINUTE: 60000,
            HOUR: 3600000,
            DAY: 86400000,
            WEEK: 604800000,
            MONTH: 2592000000,  // 30 days approximation
            QUARTER: 7776000000, // 90 days
            YEAR: 31536000000
        },

        // ============================================================================
        // LAYOUT CONSTANTS
        // ============================================================================
        LAYOUT: {
            MIN_PANE_WIDTH: 300,
            MIN_PANE_HEIGHT: 200,
            MAX_PANE_WIDTH: 2000,
            MAX_PANE_HEIGHT: 1500,
            DEFAULT_SIDEBAR_WIDTH: 260,
            COLLAPSED_SIDEBAR_WIDTH: 64,
            MOBILE_PADDING: 16,
            MOBILE_BOTTOM_BAR_HEIGHT: 72
        },

        // ============================================================================
        // COLUMN CONSTANTS
        // ============================================================================
        COLUMN: {
            WIDTH_MIN: 50,
            WIDTH_MAX: 800,
            WIDTH_DEFAULT: 150,
            RESIZE_HANDLE_WIDTH: 8
        },

        // ============================================================================
        // STABILITY THRESHOLDS
        // ============================================================================
        STABILITY: {
            EMERGING_THRESHOLD: 10,   // Min edits for emerging
            FORMING_THRESHOLD: 3,     // Min edits for forming
            STABLE_VARIABILITY: 0.1,  // Max variability for stable
            RECALC_THRESHOLD: 5       // Edits before recalculation
        },

        // ============================================================================
        // GRAPH/VISUALIZATION CONSTANTS
        // ============================================================================
        GRAPH: {
            ARROW_LENGTH: 12,
            NODE_RADIUS: 20,
            FORCE_CONSTANT: 5000,
            DAMPING: 0.85,
            SPRING_LENGTH: 100,
            MIN_DISTANCE: 30
        },

        // ============================================================================
        // IMPORT CONSTANTS
        // ============================================================================
        IMPORT: {
            MAX_FILE_SIZE: 10 * 1024 * 1024,  // 10 MB
            CHUNK_SIZE: 1024,                  // 1 KB for chunked reading
            MAX_PREVIEW_ROWS: 100,
            SUPPORTED_FORMATS: ['csv', 'tsv', 'json', 'xlsx', 'xls']
        },

        // ============================================================================
        // PROVENANCE CONSTANTS
        // ============================================================================
        PROVENANCE: {
            MAX_HISTORY_ENTRIES: 1000,
            SNAPSHOT_INTERVAL: 10,  // Create snapshot every N changes
            RETENTION_DAYS: 90
        },

        // ============================================================================
        // UI ANIMATION TIMING (in milliseconds)
        // ============================================================================
        ANIMATION: {
            FAST: 150,
            NORMAL: 300,
            SLOW: 500,
            MODAL_TRANSITION: 200
        },

        // ============================================================================
        // EO OPERATORS
        // ============================================================================
        OPERATORS: Object.freeze(['NUL', 'DES', 'INS', 'SEG', 'CON', 'ALT', 'SYN', 'SUP', 'REC']),

        // ============================================================================
        // EO REALMS
        // ============================================================================
        REALMS: Object.freeze({
            I: { name: 'Pre-formation', positions: [1, 2, 3, 4, 5, 6] },
            II: { name: 'Nascent Form', positions: [7, 8, 9, 10, 11, 12] },
            III: { name: 'Explicit Form', positions: [13, 14, 15, 16, 17, 18] },
            IV: { name: 'Pattern Mastery', positions: [19, 20, 21, 22, 23, 24] },
            V: { name: 'Meta-stability', positions: [25, 26, 27] }
        }),

        // ============================================================================
        // CONTEXT SCHEMA DEFAULTS
        // ============================================================================
        CONTEXT: {
            METHODS: Object.freeze(['measured', 'declared', 'aggregated', 'inferred', 'derived']),
            SCALES: Object.freeze(['individual', 'team', 'department', 'organization']),
            GRANULARITIES: Object.freeze(['instant', 'day', 'week', 'month', 'quarter', 'year']),
            STABILITY_LEVELS: Object.freeze(['emerging', 'forming', 'stable'])
        },

        // ============================================================================
        // FIELD TYPES
        // ============================================================================
        FIELD_TYPES: Object.freeze([
            'TEXT', 'NUMBER', 'CURRENCY', 'SELECT', 'MULTI_SELECT',
            'DATE', 'CHECKBOX', 'EMAIL', 'URL', 'LONG_TEXT',
            'FORMULA', 'ROLLUP', 'LOOKUP', 'LINKED_RECORD', 'JSON'
        ]),

        // ============================================================================
        // FIELD TYPE ICONS (Phosphor Icons)
        // Standard icons for identifying field types across the application
        // ============================================================================
        FIELD_TYPE_ICONS: Object.freeze({
            'TEXT': 'ph-text-aa',
            'NUMBER': 'ph-hash',
            'CURRENCY': 'ph-currency-dollar',
            'SELECT': 'ph-list-bullets',
            'MULTI_SELECT': 'ph-list-checks',
            'DATE': 'ph-calendar',
            'DATETIME': 'ph-calendar-blank',
            'TIME': 'ph-clock',
            'CHECKBOX': 'ph-check-square',
            'EMAIL': 'ph-envelope',
            'URL': 'ph-link',
            'LONG_TEXT': 'ph-article',
            'FORMULA': 'ph-function',
            'ROLLUP': 'ph-chart-bar',
            'LOOKUP': 'ph-arrow-square-out',
            'LINKED_RECORD': 'ph-link-simple',
            'LINK_RECORD': 'ph-link-simple',
            'JSON': 'ph-brackets-curly'
        }),

        // ============================================================================
        // FIELD TYPE COLORS
        // Standard colors for field type badges and indicators
        // ============================================================================
        FIELD_TYPE_COLORS: Object.freeze({
            'TEXT': '#3b82f6',         // Blue
            'NUMBER': '#10b981',       // Emerald
            'CURRENCY': '#f59e0b',     // Amber
            'SELECT': '#ec4899',       // Pink
            'MULTI_SELECT': '#d946ef', // Fuchsia
            'DATE': '#f97316',         // Orange
            'DATETIME': '#f97316',     // Orange
            'TIME': '#f97316',         // Orange
            'CHECKBOX': '#14b8a6',     // Teal
            'EMAIL': '#6366f1',        // Indigo
            'URL': '#8b5cf6',          // Violet
            'LONG_TEXT': '#0ea5e9',    // Sky
            'FORMULA': '#a855f7',      // Purple
            'ROLLUP': '#06b6d4',       // Cyan
            'LOOKUP': '#22d3ee',       // Cyan light
            'LINKED_RECORD': '#8b5cf6',// Violet
            'LINK_RECORD': '#8b5cf6',  // Violet
            'JSON': '#64748b'          // Slate
        }),

        // ============================================================================
        // ID PREFIXES
        // ============================================================================
        ID_PREFIX: Object.freeze({
            RECORD: 'rec_',
            SET: 'set_',
            VIEW: 'view_',
            FIELD: 'fld_',
            IMPORT: 'imp_',
            EVENT: 'evt_',
            CONTEXT: 'ctx_',
            OPERATOR: 'op_',
            PANE: 'pane_',
            SPLIT: 'split_',
            PORTAL: 'portal_',
            EDGE: 'edge_',
            GRAPH: 'graph_',
            RELATION: 'rel_',
            PRESET: 'preset_',
            TOSS: 'toss_',
            ACTION: 'act_'
        }),

        // ============================================================================
        // RANDOM STRING LENGTHS
        // ============================================================================
        RANDOM_LENGTH: {
            DEFAULT: 9,
            SHORT: 7,
            COMPACT: 5
        }
    };

    // Freeze all nested objects
    Object.keys(EO_CONSTANTS).forEach(key => {
        if (typeof EO_CONSTANTS[key] === 'object' && !Object.isFrozen(EO_CONSTANTS[key])) {
            Object.freeze(EO_CONSTANTS[key]);
        }
    });
    Object.freeze(EO_CONSTANTS);

    // Export to global scope
    global.EO_CONSTANTS = EO_CONSTANTS;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EO_CONSTANTS;
    }

})(typeof window !== 'undefined' ? window : global);
