/**
 * EO Number Field Settings UI
 * Provides a modal interface for configuring number field options
 *
 * Features:
 * - Format type selection (integer, decimal, percentage, scientific, fraction, currency)
 * - Decimal places control
 * - Rounding mode selection
 * - Thousand separator toggle
 * - Negative display options
 * - Custom prefix/suffix
 * - Min/max constraints
 * - Live preview
 */

(function(global) {
    'use strict';

    class EONumberFieldSettings {
        constructor() {
            this.modal = null;
            this.currentFieldId = null;
            this.currentSetId = null;
            this.config = null;
            this.onSave = null;
        }

        /**
         * Show the number field settings modal
         * @param {Object} options - { fieldId, setId, config, onSave }
         */
        show(options = {}) {
            this.currentFieldId = options.fieldId;
            this.currentSetId = options.setId;
            this.config = options.config ? { ...EONumberFormatter.getDefaultConfig(), ...options.config } : EONumberFormatter.getDefaultConfig();
            this.onSave = options.onSave || (() => {});
            this.fieldName = options.fieldName || 'Number Field';

            this.render();
            this.attachEventListeners();
            this.updateFormatDependentUI();
            this.updatePreview();
        }

        /**
         * Render the modal
         */
        render() {
            // Remove existing modal if present
            this.close();

            const currencies = EONumberFormatter.getAvailableCurrencies();

            this.modal = document.createElement('div');
            this.modal.className = 'modal-overlay eo-number-settings-overlay';
            this.modal.innerHTML = `
                <div class="modal eo-number-settings-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2><i class="ph ph-hash"></i> Number Field Settings</h2>
                        <span class="modal-field-name">${this.escapeHtml(this.fieldName)}</span>
                        <button class="modal-close" id="btnCloseNumberSettings">&times;</button>
                    </div>

                    <div class="modal-body">
                        <div class="number-settings-layout">
                            <div class="number-settings-main">
                                <!-- Format Type -->
                                <div class="settings-section">
                                    <h3>Format Type</h3>
                                    <div class="format-type-grid">
                                        ${this.renderFormatOption('integer', 'Integer', '1234', 'ph-number-circle-zero')}
                                        ${this.renderFormatOption('decimal', 'Decimal', '1234.56', 'ph-number-square-two')}
                                        ${this.renderFormatOption('percentage', 'Percentage', '12.34%', 'ph-percent')}
                                        ${this.renderFormatOption('currency', 'Currency', '$1,234', 'ph-currency-dollar')}
                                        ${this.renderFormatOption('scientific', 'Scientific', '1.23e+3', 'ph-function')}
                                        ${this.renderFormatOption('fraction', 'Fraction', '1 1/2', 'ph-stack')}
                                    </div>
                                </div>

                                <!-- Precision -->
                                <div class="settings-section" id="sectionPrecision">
                                    <h3>Precision</h3>
                                    <div class="settings-row">
                                        <div class="form-group">
                                            <label for="numDecimalPlaces">Decimal Places</label>
                                            <div class="decimal-places-control">
                                                <button type="button" class="btn-decrement" id="btnDecrementDecimals">-</button>
                                                <input type="number" id="numDecimalPlaces" min="0" max="10" value="${this.config.decimalPlaces}">
                                                <button type="button" class="btn-increment" id="btnIncrementDecimals">+</button>
                                            </div>
                                        </div>
                                        <div class="form-group">
                                            <label for="selRoundingMode">Rounding</label>
                                            <div id="selRoundingModeContainer"></div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Display Options -->
                                <div class="settings-section" id="sectionDisplayOptions">
                                    <h3>Display Options</h3>
                                    <div class="settings-row" id="rowThousandSeparator">
                                        <label class="checkbox-toggle">
                                            <input type="checkbox" id="chkThousandSeparator" ${this.config.thousandSeparator ? 'checked' : ''}>
                                            <span class="toggle-label">Use thousand separator (1,234,567)</span>
                                        </label>
                                    </div>

                                    <div class="settings-row" id="rowNegativeDisplay">
                                        <div class="form-group">
                                            <label>Negative Numbers</label>
                                            <div class="negative-display-options">
                                                <label class="radio-option ${this.config.negativeDisplay === 'minus' ? 'selected' : ''}">
                                                    <input type="radio" name="negativeDisplay" value="minus" ${this.config.negativeDisplay === 'minus' ? 'checked' : ''}>
                                                    <span class="option-preview">-1234</span>
                                                </label>
                                                <label class="radio-option ${this.config.negativeDisplay === 'parentheses' ? 'selected' : ''}">
                                                    <input type="radio" name="negativeDisplay" value="parentheses" ${this.config.negativeDisplay === 'parentheses' ? 'checked' : ''}>
                                                    <span class="option-preview">(1234)</span>
                                                </label>
                                                <label class="radio-option ${this.config.negativeDisplay === 'red' ? 'selected' : ''}">
                                                    <input type="radio" name="negativeDisplay" value="red" ${this.config.negativeDisplay === 'red' ? 'checked' : ''}>
                                                    <span class="option-preview negative-red">-1234</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="settings-row">
                                        <label class="checkbox-toggle">
                                            <input type="checkbox" id="chkAllowNegative" ${this.config.allowNegative ? 'checked' : ''}>
                                            <span class="toggle-label">Allow negative values</span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Currency Options -->
                                <div class="settings-section" id="sectionCurrency" style="display: ${this.config.format === 'currency' ? 'block' : 'none'}">
                                    <h3>Currency</h3>
                                    <div class="settings-row">
                                        <div class="form-group full-width">
                                            <label for="selCurrencyCode">Currency</label>
                                            <div id="selCurrencyCodeContainer"></div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Prefix/Suffix -->
                                <div class="settings-section" id="sectionPrefixSuffix" style="display: ${this.config.format === 'currency' ? 'none' : 'block'}">
                                    <h3>Prefix & Suffix</h3>
                                    <div class="settings-row">
                                        <div class="form-group">
                                            <label for="txtPrefix">Prefix</label>
                                            <input type="text" id="txtPrefix" value="${this.escapeHtml(this.config.prefix)}" placeholder="e.g., $, €">
                                        </div>
                                        <div class="form-group">
                                            <label for="txtSuffix">Suffix</label>
                                            <input type="text" id="txtSuffix" value="${this.escapeHtml(this.config.suffix)}" placeholder="e.g., kg, m, units">
                                        </div>
                                    </div>
                                </div>

                                <!-- Constraints -->
                                <div class="settings-section">
                                    <h3>Constraints</h3>
                                    <div class="settings-row">
                                        <div class="form-group">
                                            <label for="numMin">Minimum Value</label>
                                            <input type="number" id="numMin" value="${this.config.min !== null ? this.config.min : ''}" placeholder="No limit" step="any">
                                        </div>
                                        <div class="form-group">
                                            <label for="numMax">Maximum Value</label>
                                            <input type="number" id="numMax" value="${this.config.max !== null ? this.config.max : ''}" placeholder="No limit" step="any">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Preview Panel -->
                            <div class="number-settings-preview">
                                <h3>Preview</h3>
                                <div class="preview-container" id="previewContainer">
                                    <!-- Preview will be rendered here -->
                                </div>
                                <div class="preview-custom">
                                    <label for="txtCustomPreview">Test Value</label>
                                    <input type="text" id="txtCustomPreview" placeholder="Enter a number to test">
                                    <div class="custom-preview-result" id="customPreviewResult"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn-secondary" id="btnResetToDefaults">Reset to Defaults</button>
                        <div class="modal-footer-right">
                            <button class="btn-secondary" id="btnCancelNumberSettings">Cancel</button>
                            <button class="btn-primary" id="btnSaveNumberSettings">Save Settings</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(this.modal);

            // Focus trap and accessibility
            requestAnimationFrame(() => {
                const firstInput = this.modal.querySelector('.format-type-option input:checked');
                if (firstInput) {
                    firstInput.focus();
                }
            });
        }

        /**
         * Render a format option card
         */
        renderFormatOption(value, label, example, iconClass) {
            const isSelected = this.config.format === value;
            return `
                <label class="format-type-option ${isSelected ? 'selected' : ''}">
                    <input type="radio" name="formatType" value="${value}" ${isSelected ? 'checked' : ''}>
                    <div class="format-option-content">
                        <i class="ph ${iconClass}"></i>
                        <span class="format-label">${label}</span>
                        <span class="format-example">${example}</span>
                    </div>
                </label>
            `;
        }

        /**
         * Attach event listeners
         */
        attachEventListeners() {
            // Close buttons
            this.modal.querySelector('#btnCloseNumberSettings').addEventListener('click', () => this.close());
            this.modal.querySelector('#btnCancelNumberSettings').addEventListener('click', () => this.close());
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });

            // Escape key
            this.escapeHandler = (e) => {
                if (e.key === 'Escape') this.close();
            };
            document.addEventListener('keydown', this.escapeHandler);

            // Save button
            this.modal.querySelector('#btnSaveNumberSettings').addEventListener('click', () => this.save());

            // Reset button
            this.modal.querySelector('#btnResetToDefaults').addEventListener('click', () => this.resetToDefaults());

            // Format type selection
            this.modal.querySelectorAll('input[name="formatType"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.config.format = e.target.value;
                    this.updateFormatDependentUI();
                    this.updatePreview();

                    // Update selected state
                    this.modal.querySelectorAll('.format-type-option').forEach(opt => {
                        opt.classList.toggle('selected', opt.querySelector('input').checked);
                    });
                });
            });

            // Decimal places controls
            const decimalInput = this.modal.querySelector('#numDecimalPlaces');
            decimalInput.addEventListener('change', () => {
                this.config.decimalPlaces = parseInt(decimalInput.value) || 0;
                this.updatePreview();
            });

            this.modal.querySelector('#btnDecrementDecimals').addEventListener('click', () => {
                if (this.config.decimalPlaces > 0) {
                    this.config.decimalPlaces--;
                    decimalInput.value = this.config.decimalPlaces;
                    this.updatePreview();
                }
            });

            this.modal.querySelector('#btnIncrementDecimals').addEventListener('click', () => {
                if (this.config.decimalPlaces < 10) {
                    this.config.decimalPlaces++;
                    decimalInput.value = this.config.decimalPlaces;
                    this.updatePreview();
                }
            });

            // Rounding mode - Initialize custom dropdown
            const roundingModeContainer = this.modal.querySelector('#selRoundingModeContainer');
            if (roundingModeContainer) {
                this.roundingModeDropdown = new EOCustomDropdown({
                    options: [
                        { value: 'round', label: 'Round (standard)' },
                        { value: 'floor', label: 'Floor (round down)' },
                        { value: 'ceil', label: 'Ceiling (round up)' },
                        { value: 'truncate', label: 'Truncate' }
                    ],
                    value: this.config.roundingMode,
                    placeholder: 'Select rounding...',
                    onChange: (value) => {
                        this.config.roundingMode = value;
                        this.updatePreview();
                    }
                });
                roundingModeContainer.appendChild(this.roundingModeDropdown.create());
            }

            // Thousand separator
            this.modal.querySelector('#chkThousandSeparator').addEventListener('change', (e) => {
                this.config.thousandSeparator = e.target.checked;
                this.updatePreview();
            });

            // Negative display
            this.modal.querySelectorAll('input[name="negativeDisplay"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.config.negativeDisplay = e.target.value;
                    this.updatePreview();

                    // Update selected state
                    this.modal.querySelectorAll('.radio-option').forEach(opt => {
                        opt.classList.toggle('selected', opt.querySelector('input').checked);
                    });
                });
            });

            // Allow negative
            this.modal.querySelector('#chkAllowNegative').addEventListener('change', (e) => {
                this.config.allowNegative = e.target.checked;
                this.updatePreview();
            });

            // Currency code - Initialize custom dropdown
            const currencyCodeContainer = this.modal.querySelector('#selCurrencyCodeContainer');
            if (currencyCodeContainer) {
                const currencies = EONumberFormatter.getAvailableCurrencies();
                this.currencyCodeDropdown = new EOCustomDropdown({
                    options: currencies.map(c => ({
                        value: c.code,
                        label: c.name,
                        icon: c.symbol ? `<span style="font-weight:bold;min-width:20px;display:inline-block;text-align:center">${c.symbol}</span>` : ''
                    })),
                    value: this.config.currencyCode,
                    placeholder: 'Select currency...',
                    searchable: true,
                    onChange: (value) => {
                        this.config.currencyCode = value;
                        this.updatePreview();
                    }
                });
                currencyCodeContainer.appendChild(this.currencyCodeDropdown.create());
            }

            // Prefix/Suffix
            this.modal.querySelector('#txtPrefix').addEventListener('input', (e) => {
                this.config.prefix = e.target.value;
                this.updatePreview();
            });

            this.modal.querySelector('#txtSuffix').addEventListener('input', (e) => {
                this.config.suffix = e.target.value;
                this.updatePreview();
            });

            // Min/Max
            this.modal.querySelector('#numMin').addEventListener('change', (e) => {
                this.config.min = e.target.value !== '' ? parseFloat(e.target.value) : null;
                this.updatePreview();
            });

            this.modal.querySelector('#numMax').addEventListener('change', (e) => {
                this.config.max = e.target.value !== '' ? parseFloat(e.target.value) : null;
                this.updatePreview();
            });

            // Custom preview input
            this.modal.querySelector('#txtCustomPreview').addEventListener('input', (e) => {
                this.updateCustomPreview(e.target.value);
            });
        }

        /**
         * Update UI sections based on format type
         */
        updateFormatDependentUI() {
            const format = this.config.format;

            // Show/hide precision section (hidden for fraction)
            const precisionSection = this.modal.querySelector('#sectionPrecision');
            if (format === 'fraction') {
                precisionSection.style.display = 'none';
            } else {
                precisionSection.style.display = 'block';
            }

            // Show/hide currency section
            const currencySection = this.modal.querySelector('#sectionCurrency');
            currencySection.style.display = format === 'currency' ? 'block' : 'none';

            // Show/hide prefix/suffix section (hidden for currency)
            const prefixSuffixSection = this.modal.querySelector('#sectionPrefixSuffix');
            prefixSuffixSection.style.display = format === 'currency' ? 'none' : 'block';

            // Show/hide thousand separator (hidden for fraction and scientific)
            const thousandSeparatorRow = this.modal.querySelector('#rowThousandSeparator');
            if (format === 'fraction' || format === 'scientific') {
                thousandSeparatorRow.style.display = 'none';
                this.config.thousandSeparator = false;
            } else {
                thousandSeparatorRow.style.display = 'block';
            }

            // Set default decimal places based on format
            const decimalInput = this.modal.querySelector('#numDecimalPlaces');
            const decrementBtn = this.modal.querySelector('#btnDecrementDecimals');
            const incrementBtn = this.modal.querySelector('#btnIncrementDecimals');

            if (format === 'integer') {
                // Lock decimal places to 0 for integer format
                this.config.decimalPlaces = 0;
                decimalInput.value = 0;
                decimalInput.disabled = true;
                decrementBtn.disabled = true;
                incrementBtn.disabled = true;
            } else {
                decimalInput.disabled = false;
                decrementBtn.disabled = false;
                incrementBtn.disabled = false;

                if (format === 'currency' && this.config.decimalPlaces === 0) {
                    this.config.decimalPlaces = 2;
                    decimalInput.value = 2;
                }
            }
        }

        /**
         * Update the preview panel
         */
        updatePreview() {
            const container = this.modal.querySelector('#previewContainer');
            const samples = [
                { value: 1234.567, label: 'Positive' },
                { value: -1234.567, label: 'Negative' },
                { value: 0, label: 'Zero' },
                { value: 0.5, label: 'Fraction' },
                { value: 1000000, label: 'Large' }
            ];

            let html = '<div class="preview-samples">';
            samples.forEach(sample => {
                const result = EONumberFormatter.formatNumber(sample.value, this.config);
                const errorClass = !result.isValid ? ' preview-error' : '';
                html += `
                    <div class="preview-item${errorClass}">
                        <span class="preview-original">${sample.value}</span>
                        <span class="preview-arrow">&rarr;</span>
                        <span class="preview-formatted ${result.cssClass}">${result.formatted}</span>
                    </div>
                `;
            });
            html += '</div>';

            container.innerHTML = html;
        }

        /**
         * Update custom preview
         */
        updateCustomPreview(value) {
            const resultContainer = this.modal.querySelector('#customPreviewResult');

            if (!value.trim()) {
                resultContainer.innerHTML = '';
                return;
            }

            const result = EONumberFormatter.formatNumber(value, this.config);

            if (result.rawValue === null) {
                resultContainer.innerHTML = `<span class="preview-error">Invalid number</span>`;
            } else {
                resultContainer.innerHTML = `
                    <span class="${result.cssClass}">${result.formatted}</span>
                    ${!result.isValid ? `<span class="preview-error-msg">${result.error}</span>` : ''}
                `;
            }
        }

        /**
         * Reset to default settings
         */
        resetToDefaults() {
            this.config = EONumberFormatter.getDefaultConfig();

            // Update all form fields
            this.modal.querySelectorAll('input[name="formatType"]').forEach(radio => {
                radio.checked = radio.value === this.config.format;
            });
            this.modal.querySelectorAll('.format-type-option').forEach(opt => {
                opt.classList.toggle('selected', opt.querySelector('input').checked);
            });

            this.modal.querySelector('#numDecimalPlaces').value = this.config.decimalPlaces;
            if (this.roundingModeDropdown) {
                this.roundingModeDropdown.setValue(this.config.roundingMode);
            }
            this.modal.querySelector('#chkThousandSeparator').checked = this.config.thousandSeparator;
            this.modal.querySelector('#chkAllowNegative').checked = this.config.allowNegative;
            if (this.currencyCodeDropdown) {
                this.currencyCodeDropdown.setValue(this.config.currencyCode);
            }
            this.modal.querySelector('#txtPrefix').value = this.config.prefix;
            this.modal.querySelector('#txtSuffix').value = this.config.suffix;
            this.modal.querySelector('#numMin').value = '';
            this.modal.querySelector('#numMax').value = '';

            this.modal.querySelectorAll('input[name="negativeDisplay"]').forEach(radio => {
                radio.checked = radio.value === this.config.negativeDisplay;
            });
            this.modal.querySelectorAll('.radio-option').forEach(opt => {
                opt.classList.toggle('selected', opt.querySelector('input').checked);
            });

            this.updateFormatDependentUI();
            this.updatePreview();
        }

        /**
         * Save settings
         */
        save() {
            // Clean up config - remove null/undefined values
            const cleanConfig = {};
            Object.keys(this.config).forEach(key => {
                const value = this.config[key];
                if (value !== null && value !== undefined && value !== '') {
                    cleanConfig[key] = value;
                }
            });

            // Handle min/max
            if (this.config.min !== null) cleanConfig.min = this.config.min;
            if (this.config.max !== null) cleanConfig.max = this.config.max;

            this.onSave(cleanConfig, this.currentFieldId, this.currentSetId);
            this.close();

            // Show toast if available
            if (typeof showToast === 'function') {
                showToast('Number field settings saved');
            }
        }

        /**
         * Close the modal
         */
        close() {
            if (this.modal) {
                this.modal.remove();
                this.modal = null;
            }
            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
                this.escapeHandler = null;
            }
        }

        /**
         * Escape HTML for display
         */
        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // ============================================================================
    // EXPORT
    // ============================================================================

    global.EONumberFieldSettings = EONumberFieldSettings;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EONumberFieldSettings;
    }

})(typeof window !== 'undefined' ? window : global);
