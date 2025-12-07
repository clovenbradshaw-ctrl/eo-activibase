/**
 * EO Field Type Utilities
 * Centralized utilities for field type icons, colors, and badges
 *
 * @eo_operator DES
 * @eo_layer foundation
 *
 * This module provides consistent field type icons and styling
 * across all UI components in the application.
 */

(function(global) {
    'use strict';

    // ============================================================================
    // FIELD TYPE CONFIGURATION
    // Get from EO_CONSTANTS if available, otherwise use defaults
    // ============================================================================

    const getFieldTypeIcons = () => {
        if (global.EO_CONSTANTS?.FIELD_TYPE_ICONS) {
            return global.EO_CONSTANTS.FIELD_TYPE_ICONS;
        }
        // Fallback defaults
        return {
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
            'JSON': 'ph-brackets-curly',
            'MULTI_FIELD': 'ph-stack'
        };
    };

    const getFieldTypeColors = () => {
        if (global.EO_CONSTANTS?.FIELD_TYPE_COLORS) {
            return global.EO_CONSTANTS.FIELD_TYPE_COLORS;
        }
        // Fallback defaults
        return {
            'TEXT': '#3b82f6',
            'NUMBER': '#10b981',
            'CURRENCY': '#f59e0b',
            'SELECT': '#ec4899',
            'MULTI_SELECT': '#d946ef',
            'DATE': '#f97316',
            'DATETIME': '#f97316',
            'TIME': '#f97316',
            'CHECKBOX': '#14b8a6',
            'EMAIL': '#6366f1',
            'URL': '#8b5cf6',
            'LONG_TEXT': '#0ea5e9',
            'FORMULA': '#a855f7',
            'ROLLUP': '#06b6d4',
            'LOOKUP': '#22d3ee',
            'LINKED_RECORD': '#8b5cf6',
            'LINK_RECORD': '#8b5cf6',
            'JSON': '#64748b',
            'MULTI_FIELD': '#059669'
        };
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Get the icon class for a field type
     * @param {string} fieldType - The field type (e.g., 'TEXT', 'NUMBER')
     * @returns {string} The Phosphor icon class (e.g., 'ph-text-aa')
     */
    function getFieldTypeIcon(fieldType) {
        const icons = getFieldTypeIcons();
        const type = (fieldType || 'TEXT').toUpperCase();
        return icons[type] || icons['TEXT'];
    }

    /**
     * Get the color for a field type
     * @param {string} fieldType - The field type (e.g., 'TEXT', 'NUMBER')
     * @returns {string} The hex color code
     */
    function getFieldTypeColor(fieldType) {
        const colors = getFieldTypeColors();
        const type = (fieldType || 'TEXT').toUpperCase();
        return colors[type] || colors['TEXT'];
    }

    /**
     * Render an icon element for a field type
     * @param {string} fieldType - The field type
     * @param {Object} options - Options for rendering
     * @param {string} options.size - CSS size (e.g., '14px', '1em')
     * @param {boolean} options.colored - Whether to apply the field type color
     * @param {string} options.className - Additional CSS classes
     * @returns {string} HTML string for the icon element
     */
    function renderFieldTypeIcon(fieldType, options = {}) {
        const iconClass = getFieldTypeIcon(fieldType);
        const color = options.colored ? getFieldTypeColor(fieldType) : 'currentColor';
        const sizeStyle = options.size ? `font-size: ${options.size};` : '';
        const className = options.className ? ` ${options.className}` : '';

        return `<i class="ph ${iconClass}${className}" style="color: ${color}; ${sizeStyle}"></i>`;
    }

    /**
     * Render a field type badge with icon and label
     * @param {string} fieldType - The field type
     * @param {Object} options - Options for rendering
     * @param {boolean} options.showLabel - Whether to show the type label (default: true)
     * @param {boolean} options.showIcon - Whether to show the icon (default: true)
     * @param {string} options.size - Badge size: 'small', 'medium', 'large'
     * @param {string} options.className - Additional CSS classes
     * @returns {string} HTML string for the badge element
     */
    function renderFieldTypeBadge(fieldType, options = {}) {
        const showLabel = options.showLabel !== false;
        const showIcon = options.showIcon !== false;
        const size = options.size || 'medium';
        const className = options.className || '';

        const color = getFieldTypeColor(fieldType);
        const iconClass = getFieldTypeIcon(fieldType);
        const type = (fieldType || 'TEXT').toUpperCase();

        // Size-specific styles
        const sizeStyles = {
            small: 'padding: 2px 6px; font-size: 10px; gap: 3px;',
            medium: 'padding: 3px 8px; font-size: 11px; gap: 4px;',
            large: 'padding: 4px 10px; font-size: 12px; gap: 5px;'
        };

        const iconSizes = {
            small: '10px',
            medium: '12px',
            large: '14px'
        };

        const baseStyle = `
            display: inline-flex;
            align-items: center;
            background-color: ${color}20;
            color: ${color};
            border-radius: 4px;
            font-weight: 500;
            ${sizeStyles[size] || sizeStyles.medium}
        `;

        const iconHtml = showIcon
            ? `<i class="ph ${iconClass}" style="font-size: ${iconSizes[size] || iconSizes.medium};"></i>`
            : '';
        const labelHtml = showLabel ? `<span>${type}</span>` : '';

        return `<span class="field-type-badge ${className}" style="${baseStyle}">${iconHtml}${labelHtml}</span>`;
    }

    /**
     * Render a field type selector dropdown option
     * @param {string} fieldType - The field type
     * @param {boolean} selected - Whether this option is selected
     * @returns {string} HTML string for the option element
     */
    function renderFieldTypeOption(fieldType, selected = false) {
        const iconClass = getFieldTypeIcon(fieldType);
        const color = getFieldTypeColor(fieldType);
        const type = (fieldType || 'TEXT').toUpperCase();

        const selectedClass = selected ? 'selected' : '';
        const selectedStyle = selected ? `background-color: ${color}10;` : '';

        return `
            <div class="field-type-option ${selectedClass}"
                 data-field-type="${type}"
                 style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; ${selectedStyle}">
                <i class="ph ${iconClass}" style="color: ${color}; font-size: 16px;"></i>
                <span style="flex: 1;">${formatFieldTypeName(type)}</span>
                ${selected ? '<i class="ph ph-check" style="color: ' + color + ';"></i>' : ''}
            </div>
        `;
    }

    /**
     * Format a field type name for display
     * @param {string} fieldType - The field type (e.g., 'LINKED_RECORD')
     * @returns {string} Formatted name (e.g., 'Linked Record')
     */
    function formatFieldTypeName(fieldType) {
        const type = (fieldType || 'TEXT').toUpperCase();

        // Special case mappings
        const specialNames = {
            'LINK_RECORD': 'Linked Record',
            'LINKED_RECORD': 'Linked Record',
            'MULTI_SELECT': 'Multi-Select',
            'LONG_TEXT': 'Long Text',
            'URL': 'URL',
            'JSON': 'JSON',
            'MULTI_FIELD': 'Multi-Field'
        };

        if (specialNames[type]) {
            return specialNames[type];
        }

        // Default: capitalize first letter
        return type.charAt(0) + type.slice(1).toLowerCase();
    }

    /**
     * Get all available field types with their metadata
     * @returns {Array} Array of field type objects with id, name, icon, color
     */
    function getAllFieldTypes() {
        const icons = getFieldTypeIcons();
        const colors = getFieldTypeColors();

        return Object.keys(icons).map(type => ({
            id: type,
            name: formatFieldTypeName(type),
            icon: icons[type],
            color: colors[type],
            iconHtml: renderFieldTypeIcon(type),
            badgeHtml: renderFieldTypeBadge(type)
        }));
    }

    /**
     * Render a field type selector UI
     * @param {string} currentType - Currently selected field type
     * @param {Object} options - Options for rendering
     * @param {string} options.id - Element ID for the selector
     * @param {Array} options.excludeTypes - Field types to exclude from the list
     * @returns {string} HTML string for the selector
     */
    function renderFieldTypeSelector(currentType, options = {}) {
        const id = options.id || 'fieldTypeSelector';
        const excludeTypes = options.excludeTypes || [];
        const types = getAllFieldTypes().filter(t => !excludeTypes.includes(t.id));
        const current = currentType || 'TEXT';
        const currentData = types.find(t => t.id === current) || types[0];

        return `
            <div class="field-type-selector" id="${id}" data-current-type="${current}">
                <button class="field-type-selector-trigger" type="button">
                    ${renderFieldTypeBadge(current, { showLabel: true })}
                    <i class="ph ph-caret-down" style="margin-left: 4px; font-size: 12px;"></i>
                </button>
                <div class="field-type-selector-dropdown" style="display: none; position: absolute; top: 100%; left: 0; z-index: 1000; background: white; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-height: 300px; overflow-y: auto; min-width: 180px;">
                    ${types.map(t => renderFieldTypeOption(t.id, t.id === current)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to a field type selector
     * @param {string} selectorId - The selector element ID
     * @param {Function} onChange - Callback when type changes: (newType) => void
     */
    function attachFieldTypeSelectorEvents(selectorId, onChange) {
        const selector = document.getElementById(selectorId);
        if (!selector) return;

        const trigger = selector.querySelector('.field-type-selector-trigger');
        const dropdown = selector.querySelector('.field-type-selector-dropdown');

        if (!trigger || !dropdown) return;

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display !== 'none';
            dropdown.style.display = isVisible ? 'none' : 'block';
        });

        // Handle option selection
        dropdown.querySelectorAll('.field-type-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const newType = option.dataset.fieldType;
                const currentType = selector.dataset.currentType;

                if (newType !== currentType) {
                    // Update selector
                    selector.dataset.currentType = newType;
                    trigger.innerHTML = `
                        ${renderFieldTypeBadge(newType, { showLabel: true })}
                        <i class="ph ph-caret-down" style="margin-left: 4px; font-size: 12px;"></i>
                    `;

                    // Update options
                    dropdown.querySelectorAll('.field-type-option').forEach(opt => {
                        opt.classList.toggle('selected', opt.dataset.fieldType === newType);
                    });

                    // Callback
                    if (onChange) onChange(newType);
                }

                dropdown.style.display = 'none';
            });
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!selector.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOFieldTypeUtils = {
        getFieldTypeIcon,
        getFieldTypeColor,
        renderFieldTypeIcon,
        renderFieldTypeBadge,
        renderFieldTypeOption,
        formatFieldTypeName,
        getAllFieldTypes,
        renderFieldTypeSelector,
        attachFieldTypeSelectorEvents
    };

    // Export to global scope
    global.EOFieldTypeUtils = EOFieldTypeUtils;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOFieldTypeUtils;
    }

})(typeof window !== 'undefined' ? window : global);
