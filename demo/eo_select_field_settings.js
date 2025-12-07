/**
 * EO Select Field Settings
 * Enhanced configuration for Select/Multi-Select field types
 *
 * Features:
 * - Selection modes: single, multi, limit
 * - Conditional selection limits
 * - 6 default colors with extended palette picker
 * - Auto-complementary color generation for options > 6
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    /**
     * Default 6 colors for select options (pastel/soft variants)
     */
    const DEFAULT_OPTION_COLORS = [
        { id: 'blue', bg: '#dbeafe', text: '#1e40af', hex: '#3b82f6' },
        { id: 'green', bg: '#d1fae5', text: '#065f46', hex: '#10b981' },
        { id: 'yellow', bg: '#fef3c7', text: '#92400e', hex: '#f59e0b' },
        { id: 'red', bg: '#fee2e2', text: '#991b1b', hex: '#ef4444' },
        { id: 'purple', bg: '#e9d5ff', text: '#6b21a8', hex: '#a855f7' },
        { id: 'gray', bg: '#f3f4f6', text: '#374151', hex: '#6b7280' }
    ];

    /**
     * Extended palette colors (shown when "More colors" is clicked or auto-assigned)
     */
    const EXTENDED_PALETTE_COLORS = [
        { id: 'cyan', bg: '#cffafe', text: '#155e75', hex: '#06b6d4' },
        { id: 'pink', bg: '#fce7f3', text: '#9f1239', hex: '#ec4899' },
        { id: 'indigo', bg: '#e0e7ff', text: '#3730a3', hex: '#6366f1' },
        { id: 'teal', bg: '#ccfbf1', text: '#115e59', hex: '#14b8a6' },
        { id: 'orange', bg: '#ffedd5', text: '#9a3412', hex: '#f97316' },
        { id: 'lime', bg: '#ecfccb', text: '#3f6212', hex: '#84cc16' },
        { id: 'amber', bg: '#fef3c7', text: '#b45309', hex: '#f59e0b' },
        { id: 'rose', bg: '#ffe4e6', text: '#9f1239', hex: '#f43f5e' },
        { id: 'sky', bg: '#e0f2fe', text: '#075985', hex: '#0ea5e9' },
        { id: 'violet', bg: '#ede9fe', text: '#5b21b6', hex: '#8b5cf6' },
        { id: 'emerald', bg: '#d1fae5', text: '#047857', hex: '#10b981' },
        { id: 'fuchsia', bg: '#fae8ff', text: '#86198f', hex: '#d946ef' },
        { id: 'slate', bg: '#f1f5f9', text: '#334155', hex: '#64748b' },
        { id: 'stone', bg: '#f5f5f4', text: '#44403c', hex: '#78716c' }
    ];

    /**
     * All available colors (default + extended)
     */
    const ALL_COLORS = [...DEFAULT_OPTION_COLORS, ...EXTENDED_PALETTE_COLORS];

    /**
     * Selection mode options
     */
    const SELECTION_MODES = {
        single: {
            id: 'single',
            label: 'Single Select',
            description: 'Choose exactly one option',
            icon: 'ph-check-circle'
        },
        multi: {
            id: 'multi',
            label: 'Multi-Select',
            description: 'Choose multiple options',
            icon: 'ph-checks'
        },
        limit: {
            id: 'limit',
            label: 'Limited Selection',
            description: 'Choose up to a specific number',
            icon: 'ph-list-numbers'
        }
    };

    // ============================================================================
    // COLOR UTILITIES
    // ============================================================================

    /**
     * Get color object by ID
     * @param {string} colorId - The color identifier
     * @returns {Object} Color object with bg, text, hex properties
     */
    function getColorById(colorId) {
        // Check if it's a hex color (custom)
        if (colorId && colorId.startsWith('#')) {
            return generateColorFromHex(colorId);
        }
        return ALL_COLORS.find(c => c.id === colorId) || DEFAULT_OPTION_COLORS[0];
    }

    /**
     * Generate a color object from a hex value
     * @param {string} hex - Hex color code
     * @returns {Object} Color object
     */
    function generateColorFromHex(hex) {
        // Generate a lighter background and appropriate text color
        const rgb = hexToRgb(hex);
        const bgRgb = lightenColor(rgb, 0.85);
        const textRgb = darkenColor(rgb, 0.3);

        return {
            id: hex,
            bg: rgbToHex(bgRgb),
            text: rgbToHex(textRgb),
            hex: hex
        };
    }

    /**
     * Convert hex to RGB
     */
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 59, g: 130, b: 246 }; // Default blue
    }

    /**
     * Convert RGB to hex
     */
    function rgbToHex({ r, g, b }) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Lighten a color
     */
    function lightenColor({ r, g, b }, amount) {
        return {
            r: r + (255 - r) * amount,
            g: g + (255 - g) * amount,
            b: b + (255 - b) * amount
        };
    }

    /**
     * Darken a color
     */
    function darkenColor({ r, g, b }, amount) {
        return {
            r: r * (1 - amount),
            g: g * (1 - amount),
            b: b * (1 - amount)
        };
    }

    /**
     * Generate complementary colors for options beyond the default 6
     * Uses HSL color space for better distribution
     * @param {number} count - Number of colors to generate
     * @param {Array} existingColors - Colors already in use
     * @returns {Array} Array of color objects
     */
    function generateComplementaryColors(count, existingColors = []) {
        const colors = [];
        const existingHues = existingColors.map(c => {
            const color = getColorById(c);
            const rgb = hexToRgb(color.hex);
            return rgbToHsl(rgb).h;
        });

        // Calculate hue step to distribute colors evenly
        const baseHue = existingHues.length > 0
            ? (Math.max(...existingHues) + 60) % 360
            : 0;
        const hueStep = 360 / (count + existingHues.length);

        for (let i = 0; i < count; i++) {
            const hue = (baseHue + i * hueStep) % 360;

            // Skip if too close to an existing hue
            const tooClose = existingHues.some(h => Math.abs(h - hue) < 20 || Math.abs(h - hue) > 340);
            if (tooClose && existingHues.length > 0) {
                // Adjust hue slightly
                const adjustedHue = (hue + 30) % 360;
                const rgb = hslToRgb({ h: adjustedHue, s: 0.65, l: 0.55 });
                colors.push(generateColorFromHex(rgbToHex(rgb)));
            } else {
                const rgb = hslToRgb({ h: hue, s: 0.65, l: 0.55 });
                colors.push(generateColorFromHex(rgbToHex(rgb)));
            }
        }

        return colors;
    }

    /**
     * Convert RGB to HSL
     */
    function rgbToHsl({ r, g, b }) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s;
        const l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return { h: h * 360, s, l };
    }

    /**
     * Convert HSL to RGB
     */
    function hslToRgb({ h, s, l }) {
        h /= 360;
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return { r: r * 255, g: g * 255, b: b * 255 };
    }

    /**
     * Get the next auto-assigned color for a new option
     * @param {Array} existingOptions - Current options with their colors
     * @returns {string} Color ID or hex value
     */
    function getNextAutoColor(existingOptions = []) {
        const usedColors = existingOptions.map(opt => opt.color);
        const optionIndex = existingOptions.length;

        // First 6 options: cycle through defaults
        if (optionIndex < DEFAULT_OPTION_COLORS.length) {
            // Find first unused default color
            for (const color of DEFAULT_OPTION_COLORS) {
                if (!usedColors.includes(color.id)) {
                    return color.id;
                }
            }
            // All defaults used, use index-based selection
            return DEFAULT_OPTION_COLORS[optionIndex % DEFAULT_OPTION_COLORS.length].id;
        }

        // Options 7-20: use extended palette
        const extendedIndex = optionIndex - DEFAULT_OPTION_COLORS.length;
        if (extendedIndex < EXTENDED_PALETTE_COLORS.length) {
            // Find first unused extended color
            for (const color of EXTENDED_PALETTE_COLORS) {
                if (!usedColors.includes(color.id)) {
                    return color.id;
                }
            }
            return EXTENDED_PALETTE_COLORS[extendedIndex % EXTENDED_PALETTE_COLORS.length].id;
        }

        // Beyond 20 options: generate complementary colors
        const newColors = generateComplementaryColors(1, usedColors);
        return newColors[0].hex;
    }

    // ============================================================================
    // SELECT OPTIONS CONFIGURATION CLASS
    // ============================================================================

    class EOSelectFieldSettings {
        constructor() {
            this.container = null;
            this.options = [];
            this.config = {
                selectionMode: 'single',
                selectionLimit: 3,
                acceptNewOptions: true,
                conditionalLimits: []
            };
            this.onChange = null;
            this.colorPickerOpen = false;
            this.activeColorPickerIndex = null;
        }

        /**
         * Initialize the settings UI
         * @param {Object} params - Initialization parameters
         * @param {HTMLElement} params.container - Container element
         * @param {Array} params.options - Initial options array
         * @param {Object} params.config - Initial configuration
         * @param {Function} params.onChange - Callback when options/config change
         */
        initialize(params = {}) {
            this.container = params.container;
            this.options = params.options || [{ value: 'Option 1', color: 'blue' }];
            this.config = {
                selectionMode: params.config?.selectionMode || 'single',
                selectionLimit: params.config?.selectionLimit || 3,
                acceptNewOptions: params.config?.acceptNewOptions !== false,
                conditionalLimits: params.config?.conditionalLimits || []
            };
            this.onChange = params.onChange;

            this.render();
            this.attachEventListeners();
        }

        /**
         * Render the complete settings UI
         */
        render() {
            if (!this.container) return;

            this.container.innerHTML = `
                <div class="eo-select-settings">
                    ${this.renderSelectionModeSection()}
                    ${this.renderOptionsSection()}
                    ${this.renderConditionalLimitsSection()}
                    ${this.renderAcceptNewOptionsSection()}
                </div>
            `;

            // Re-attach event listeners after re-render
            this.attachEventListeners();
        }

        /**
         * Render selection mode section
         */
        renderSelectionModeSection() {
            return `
                <div class="eo-select-section">
                    <label class="eo-select-label">Selection Mode</label>
                    <div class="eo-selection-modes">
                        ${Object.values(SELECTION_MODES).map(mode => `
                            <label class="eo-selection-mode ${this.config.selectionMode === mode.id ? 'selected' : ''}" data-mode="${mode.id}">
                                <input type="radio" name="selectionMode" value="${mode.id}"
                                       ${this.config.selectionMode === mode.id ? 'checked' : ''}>
                                <i class="ph ${mode.icon}"></i>
                                <div class="eo-selection-mode-text">
                                    <span class="eo-selection-mode-label">${mode.label}</span>
                                    <span class="eo-selection-mode-desc">${mode.description}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                    ${this.config.selectionMode === 'limit' ? `
                        <div class="eo-limit-input">
                            <label class="eo-select-sublabel">Maximum selections</label>
                            <input type="number" id="eoSelectionLimit" min="1" max="100"
                                   value="${this.config.selectionLimit}" class="eo-number-input">
                        </div>
                    ` : ''}
                </div>
            `;
        }

        /**
         * Render options list section
         */
        renderOptionsSection() {
            return `
                <div class="eo-select-section">
                    <label class="eo-select-label">Options</label>
                    <div class="eo-options-list" id="eoOptionsList">
                        ${this.options.map((opt, index) => this.renderOptionRow(opt, index)).join('')}
                    </div>
                    <button type="button" class="eo-add-option-btn" id="eoAddOptionBtn">
                        <i class="ph ph-plus"></i> Add Option
                    </button>
                </div>
            `;
        }

        /**
         * Render a single option row
         */
        renderOptionRow(option, index) {
            const color = getColorById(option.color);
            const isCustomColor = option.color && option.color.startsWith('#');

            return `
                <div class="eo-option-row" data-index="${index}">
                    <input type="text" class="eo-option-input" value="${this.escapeHtml(option.value)}"
                           placeholder="Option ${index + 1}" data-index="${index}">
                    <div class="eo-color-picker-wrapper">
                        <button type="button" class="eo-color-trigger" data-index="${index}"
                                style="background-color: ${color.bg}; border-color: ${color.hex};">
                            <span class="eo-color-dot" style="background-color: ${color.hex};"></span>
                        </button>
                        <div class="eo-color-dropdown hidden" data-index="${index}">
                            <div class="eo-color-dropdown-header">Select Color</div>
                            <div class="eo-color-grid eo-default-colors">
                                ${DEFAULT_OPTION_COLORS.map(c => `
                                    <button type="button" class="eo-color-option ${option.color === c.id ? 'selected' : ''}"
                                            data-color="${c.id}" style="background-color: ${c.hex};"
                                            title="${c.id}"></button>
                                `).join('')}
                            </div>
                            <button type="button" class="eo-more-colors-btn" data-index="${index}">
                                <i class="ph ph-palette"></i> More colors
                            </button>
                            <div class="eo-extended-colors hidden" data-index="${index}">
                                <div class="eo-color-grid">
                                    ${EXTENDED_PALETTE_COLORS.map(c => `
                                        <button type="button" class="eo-color-option ${option.color === c.id ? 'selected' : ''}"
                                                data-color="${c.id}" style="background-color: ${c.hex};"
                                                title="${c.id}"></button>
                                    `).join('')}
                                </div>
                                <div class="eo-custom-color">
                                    <label class="eo-custom-color-label">Custom color</label>
                                    <input type="color" class="eo-color-input" data-index="${index}"
                                           value="${isCustomColor ? option.color : color.hex}">
                                </div>
                            </div>
                        </div>
                    </div>
                    ${this.options.length > 1 ? `
                        <button type="button" class="eo-remove-option-btn" data-index="${index}">
                            <i class="ph ph-x"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        /**
         * Render conditional limits section
         */
        renderConditionalLimitsSection() {
            if (this.config.selectionMode === 'single') {
                return ''; // No conditional limits for single select
            }

            return `
                <div class="eo-select-section eo-conditional-limits">
                    <label class="eo-select-label">
                        <span>Conditional Limits</span>
                        <span class="eo-label-hint">(Optional)</span>
                    </label>
                    <p class="eo-section-hint">Set limits based on other field values</p>
                    <div class="eo-conditional-limits-list" id="eoConditionalLimitsList">
                        ${this.config.conditionalLimits.map((limit, index) => this.renderConditionalLimitRow(limit, index)).join('')}
                    </div>
                    <button type="button" class="eo-add-condition-btn" id="eoAddConditionBtn">
                        <i class="ph ph-plus"></i> Add Condition
                    </button>
                </div>
            `;
        }

        /**
         * Render a conditional limit row
         */
        renderConditionalLimitRow(limit, index) {
            return `
                <div class="eo-conditional-row" data-index="${index}">
                    <div class="eo-conditional-config">
                        <span class="eo-conditional-label">When</span>
                        <input type="text" class="eo-conditional-field"
                               value="${this.escapeHtml(limit.field || '')}"
                               placeholder="Field name" data-index="${index}">
                        <select class="eo-conditional-operator" data-index="${index}">
                            <option value="equals" ${limit.operator === 'equals' ? 'selected' : ''}>equals</option>
                            <option value="not_equals" ${limit.operator === 'not_equals' ? 'selected' : ''}>doesn't equal</option>
                            <option value="contains" ${limit.operator === 'contains' ? 'selected' : ''}>contains</option>
                            <option value="is_empty" ${limit.operator === 'is_empty' ? 'selected' : ''}>is empty</option>
                            <option value="is_not_empty" ${limit.operator === 'is_not_empty' ? 'selected' : ''}>is not empty</option>
                        </select>
                        <input type="text" class="eo-conditional-value"
                               value="${this.escapeHtml(limit.value || '')}"
                               placeholder="Value" data-index="${index}"
                               ${['is_empty', 'is_not_empty'].includes(limit.operator) ? 'disabled' : ''}>
                    </div>
                    <div class="eo-conditional-action">
                        <span class="eo-conditional-label">then limit to</span>
                        <input type="number" class="eo-conditional-limit"
                               value="${limit.limit || 1}" min="1" max="100" data-index="${index}">
                        <span class="eo-conditional-label">selection(s)</span>
                    </div>
                    <button type="button" class="eo-remove-condition-btn" data-index="${index}">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
            `;
        }

        /**
         * Render accept new options section
         */
        renderAcceptNewOptionsSection() {
            return `
                <div class="eo-select-section eo-accept-new">
                    <label class="eo-checkbox-label">
                        <input type="checkbox" id="eoAcceptNewOptions"
                               ${this.config.acceptNewOptions ? 'checked' : ''}>
                        <span>Accept new options</span>
                    </label>
                    <p class="eo-section-hint">Allow users to add new options when entering data</p>
                </div>
            `;
        }

        /**
         * Attach event listeners
         */
        attachEventListeners() {
            if (!this.container) return;

            // Selection mode change
            this.container.querySelectorAll('input[name="selectionMode"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.config.selectionMode = e.target.value;
                    this.render();
                    this.triggerChange();
                });
            });

            // Selection limit change
            const limitInput = this.container.querySelector('#eoSelectionLimit');
            if (limitInput) {
                limitInput.addEventListener('change', (e) => {
                    this.config.selectionLimit = parseInt(e.target.value) || 3;
                    this.triggerChange();
                });
            }

            // Add option button
            const addBtn = this.container.querySelector('#eoAddOptionBtn');
            if (addBtn) {
                addBtn.addEventListener('click', () => this.addOption());
            }

            // Option inputs
            this.container.querySelectorAll('.eo-option-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    this.updateOption(index, e.target.value);
                });
            });

            // Remove option buttons
            this.container.querySelectorAll('.eo-remove-option-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index);
                    this.removeOption(index);
                });
            });

            // Color triggers
            this.container.querySelectorAll('.eo-color-trigger').forEach(trigger => {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(e.currentTarget.dataset.index);
                    this.toggleColorPicker(index);
                });
            });

            // Color options
            this.container.querySelectorAll('.eo-color-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dropdown = e.target.closest('.eo-color-dropdown');
                    const index = parseInt(dropdown.dataset.index);
                    const color = e.target.dataset.color;
                    this.updateOptionColor(index, color);
                });
            });

            // More colors button
            this.container.querySelectorAll('.eo-more-colors-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(e.currentTarget.dataset.index);
                    const extendedColors = this.container.querySelector(`.eo-extended-colors[data-index="${index}"]`);
                    if (extendedColors) {
                        extendedColors.classList.toggle('hidden');
                        e.currentTarget.innerHTML = extendedColors.classList.contains('hidden')
                            ? '<i class="ph ph-palette"></i> More colors'
                            : '<i class="ph ph-caret-up"></i> Less colors';
                    }
                });
            });

            // Custom color inputs
            this.container.querySelectorAll('.eo-color-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    this.updateOptionColor(index, e.target.value);
                });
            });

            // Accept new options checkbox
            const acceptCheckbox = this.container.querySelector('#eoAcceptNewOptions');
            if (acceptCheckbox) {
                acceptCheckbox.addEventListener('change', (e) => {
                    this.config.acceptNewOptions = e.target.checked;
                    this.triggerChange();
                });
            }

            // Conditional limits
            const addConditionBtn = this.container.querySelector('#eoAddConditionBtn');
            if (addConditionBtn) {
                addConditionBtn.addEventListener('click', () => this.addConditionalLimit());
            }

            // Conditional limit inputs
            this.container.querySelectorAll('.eo-conditional-row').forEach(row => {
                const index = parseInt(row.dataset.index);

                const fieldInput = row.querySelector('.eo-conditional-field');
                const operatorSelect = row.querySelector('.eo-conditional-operator');
                const valueInput = row.querySelector('.eo-conditional-value');
                const limitInput = row.querySelector('.eo-conditional-limit');
                const removeBtn = row.querySelector('.eo-remove-condition-btn');

                if (fieldInput) {
                    fieldInput.addEventListener('change', (e) => {
                        this.updateConditionalLimit(index, 'field', e.target.value);
                    });
                }

                if (operatorSelect) {
                    operatorSelect.addEventListener('change', (e) => {
                        this.updateConditionalLimit(index, 'operator', e.target.value);
                        // Disable value input for is_empty/is_not_empty
                        if (valueInput) {
                            valueInput.disabled = ['is_empty', 'is_not_empty'].includes(e.target.value);
                        }
                    });
                }

                if (valueInput) {
                    valueInput.addEventListener('change', (e) => {
                        this.updateConditionalLimit(index, 'value', e.target.value);
                    });
                }

                if (limitInput) {
                    limitInput.addEventListener('change', (e) => {
                        this.updateConditionalLimit(index, 'limit', parseInt(e.target.value) || 1);
                    });
                }

                if (removeBtn) {
                    removeBtn.addEventListener('click', () => this.removeConditionalLimit(index));
                }
            });

            // Close color picker on outside click
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.eo-color-picker-wrapper')) {
                    this.closeAllColorPickers();
                }
            });
        }

        /**
         * Toggle color picker dropdown
         */
        toggleColorPicker(index) {
            // Close all other color pickers
            this.container.querySelectorAll('.eo-color-dropdown').forEach(dropdown => {
                if (parseInt(dropdown.dataset.index) !== index) {
                    dropdown.classList.add('hidden');
                }
            });

            const dropdown = this.container.querySelector(`.eo-color-dropdown[data-index="${index}"]`);
            if (dropdown) {
                dropdown.classList.toggle('hidden');
                this.colorPickerOpen = !dropdown.classList.contains('hidden');
                this.activeColorPickerIndex = this.colorPickerOpen ? index : null;
            }
        }

        /**
         * Close all color pickers
         */
        closeAllColorPickers() {
            this.container.querySelectorAll('.eo-color-dropdown').forEach(dropdown => {
                dropdown.classList.add('hidden');
            });
            this.colorPickerOpen = false;
            this.activeColorPickerIndex = null;
        }

        /**
         * Add a new option
         */
        addOption() {
            const nextColor = getNextAutoColor(this.options);
            this.options.push({
                value: `Option ${this.options.length + 1}`,
                color: nextColor
            });
            this.render();
            this.triggerChange();
        }

        /**
         * Update an option's value
         */
        updateOption(index, value) {
            if (this.options[index]) {
                this.options[index].value = value;
                this.triggerChange();
            }
        }

        /**
         * Update an option's color
         */
        updateOptionColor(index, color) {
            if (this.options[index]) {
                this.options[index].color = color;
                this.render();
                this.triggerChange();
            }
        }

        /**
         * Remove an option
         */
        removeOption(index) {
            if (this.options.length > 1) {
                this.options.splice(index, 1);
                this.render();
                this.triggerChange();
            }
        }

        /**
         * Add a conditional limit
         */
        addConditionalLimit() {
            this.config.conditionalLimits.push({
                field: '',
                operator: 'equals',
                value: '',
                limit: 1
            });
            this.render();
            this.triggerChange();
        }

        /**
         * Update a conditional limit
         */
        updateConditionalLimit(index, key, value) {
            if (this.config.conditionalLimits[index]) {
                this.config.conditionalLimits[index][key] = value;
                this.triggerChange();
            }
        }

        /**
         * Remove a conditional limit
         */
        removeConditionalLimit(index) {
            this.config.conditionalLimits.splice(index, 1);
            this.render();
            this.triggerChange();
        }

        /**
         * Trigger onChange callback
         */
        triggerChange() {
            if (this.onChange) {
                this.onChange({
                    options: this.options,
                    config: this.config
                });
            }
        }

        /**
         * Get current state
         */
        getState() {
            return {
                options: this.options,
                config: this.config
            };
        }

        /**
         * Set state
         */
        setState(state) {
            if (state.options) this.options = state.options;
            if (state.config) {
                this.config = { ...this.config, ...state.config };
            }
            this.render();
        }

        /**
         * Escape HTML for safe rendering
         */
        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const exports = {
        EOSelectFieldSettings,
        DEFAULT_OPTION_COLORS,
        EXTENDED_PALETTE_COLORS,
        ALL_COLORS,
        SELECTION_MODES,
        getColorById,
        generateColorFromHex,
        generateComplementaryColors,
        getNextAutoColor
    };

    // Export to global scope
    global.EOSelectFieldSettings = EOSelectFieldSettings;
    global.EOSelectFieldUtils = exports;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }

})(typeof window !== 'undefined' ? window : global);
