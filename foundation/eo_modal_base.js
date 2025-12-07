/**
 * EO Modal Base
 * Reusable modal UI base class for consistent modal behavior
 *
 * @eo_operator DES
 * @eo_layer foundation
 *
 * This module provides a base class for creating consistent modal
 * dialogs throughout the application. Follows the DES operator
 * pattern for structured UI designation.
 */

(function(global) {
    'use strict';

    /**
     * Modal configuration
     * @typedef {Object} EOModalConfig
     * @property {string} id - Modal ID
     * @property {string} title - Modal title
     * @property {string} [size='medium'] - Modal size (small, medium, large, full)
     * @property {boolean} [closeOnBackdrop=true] - Close when backdrop clicked
     * @property {boolean} [closeOnEscape=true] - Close on Escape key
     * @property {boolean} [showCloseButton=true] - Show close button
     * @property {string} [customClass] - Additional CSS class
     * @property {Function} [onOpen] - Called when modal opens
     * @property {Function} [onClose] - Called when modal closes
     */

    /**
     * EOModalBase - Base class for modal dialogs
     */
    class EOModalBase {
        /**
         * Create a new modal
         * @param {EOModalConfig} config - Modal configuration
         */
        constructor(config) {
            this.config = {
                id: config.id || global.EOIdentity?.generate('modal') || `modal_${Date.now()}`,
                title: config.title || 'Modal',
                size: config.size || 'medium',
                closeOnBackdrop: config.closeOnBackdrop !== false,
                closeOnEscape: config.closeOnEscape !== false,
                showCloseButton: config.showCloseButton !== false,
                customClass: config.customClass || '',
                onOpen: config.onOpen || (() => {}),
                onClose: config.onClose || (() => {})
            };

            this.isOpen = false;
            this.element = null;
            this.backdrop = null;
            this._boundKeyHandler = this._handleKeyDown.bind(this);
        }

        /**
         * Get size CSS class
         * @returns {string}
         */
        _getSizeClass() {
            const sizes = {
                small: 'max-w-sm',
                medium: 'max-w-lg',
                large: 'max-w-2xl',
                xlarge: 'max-w-4xl',
                full: 'max-w-full mx-4'
            };
            return sizes[this.config.size] || sizes.medium;
        }

        /**
         * Render modal header
         * @returns {string}
         */
        renderHeader() {
            return `
                <div class="eo-modal-header flex items-center justify-between p-4 border-b">
                    <h2 class="text-lg font-semibold">${this.config.title}</h2>
                    ${this.config.showCloseButton ? `
                        <button class="eo-modal-close p-1 hover:bg-gray-100 rounded" aria-label="Close">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        /**
         * Render modal body - override in subclass
         * @returns {string}
         */
        renderBody() {
            return `
                <div class="eo-modal-body p-4">
                    <!-- Override in subclass -->
                </div>
            `;
        }

        /**
         * Render modal footer - override in subclass
         * @returns {string}
         */
        renderFooter() {
            return `
                <div class="eo-modal-footer flex justify-end gap-2 p-4 border-t">
                    <button class="eo-modal-cancel px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                        Cancel
                    </button>
                    <button class="eo-modal-confirm px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded">
                        Confirm
                    </button>
                </div>
            `;
        }

        /**
         * Render the complete modal
         * @returns {string}
         */
        render() {
            return `
                <div class="eo-modal-container ${this.config.customClass} ${this._getSizeClass()} bg-white rounded-lg shadow-xl overflow-hidden"
                     role="dialog" aria-modal="true" aria-labelledby="${this.config.id}-title">
                    ${this.renderHeader()}
                    ${this.renderBody()}
                    ${this.renderFooter()}
                </div>
            `;
        }

        /**
         * Create and show the modal
         */
        open() {
            if (this.isOpen) return;

            // Create backdrop
            this.backdrop = document.createElement('div');
            this.backdrop.className = 'eo-modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            this.backdrop.innerHTML = this.render();

            // Get modal container
            this.element = this.backdrop.querySelector('.eo-modal-container');

            // Attach event listeners
            this._attachEventListeners();

            // Add to DOM
            document.body.appendChild(this.backdrop);
            document.body.style.overflow = 'hidden';

            // Trigger animation
            requestAnimationFrame(() => {
                this.backdrop.style.opacity = '0';
                this.backdrop.offsetHeight; // Force reflow
                this.backdrop.style.transition = 'opacity 0.2s ease-out';
                this.backdrop.style.opacity = '1';
            });

            this.isOpen = true;

            // Focus first focusable element
            const focusable = this.element.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable) focusable.focus();

            // Callback
            this.config.onOpen();

            // Emit event
            this._emit('open');
        }

        /**
         * Close the modal
         * @param {*} result - Result to pass to onClose
         */
        close(result = null) {
            if (!this.isOpen) return;

            // Animate out
            this.backdrop.style.opacity = '0';

            setTimeout(() => {
                this._detachEventListeners();

                if (this.backdrop && this.backdrop.parentNode) {
                    this.backdrop.parentNode.removeChild(this.backdrop);
                }

                document.body.style.overflow = '';

                this.isOpen = false;
                this.element = null;
                this.backdrop = null;

                // Callback
                this.config.onClose(result);

                // Emit event
                this._emit('close', result);
            }, 200);
        }

        /**
         * Attach event listeners
         */
        _attachEventListeners() {
            // Backdrop click
            if (this.config.closeOnBackdrop) {
                this.backdrop.addEventListener('click', (e) => {
                    if (e.target === this.backdrop) {
                        this.close();
                    }
                });
            }

            // Close button
            const closeBtn = this.element.querySelector('.eo-modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }

            // Cancel button
            const cancelBtn = this.element.querySelector('.eo-modal-cancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.close());
            }

            // Confirm button
            const confirmBtn = this.element.querySelector('.eo-modal-confirm');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => this.onConfirm());
            }

            // Escape key
            if (this.config.closeOnEscape) {
                document.addEventListener('keydown', this._boundKeyHandler);
            }

            // Custom event listeners
            this.attachCustomListeners();
        }

        /**
         * Detach event listeners
         */
        _detachEventListeners() {
            document.removeEventListener('keydown', this._boundKeyHandler);
        }

        /**
         * Handle keydown events
         * @param {KeyboardEvent} e
         */
        _handleKeyDown(e) {
            if (e.key === 'Escape') {
                this.close();
            }
        }

        /**
         * Attach custom event listeners - override in subclass
         */
        attachCustomListeners() {
            // Override in subclass
        }

        /**
         * Handle confirm action - override in subclass
         */
        onConfirm() {
            this.close({ confirmed: true });
        }

        /**
         * Update modal content
         * @param {string} selector - Element selector
         * @param {string} html - New HTML content
         */
        updateContent(selector, html) {
            if (!this.element) return;

            const target = this.element.querySelector(selector);
            if (target) {
                target.innerHTML = html;
            }
        }

        /**
         * Update modal title
         * @param {string} title - New title
         */
        setTitle(title) {
            this.config.title = title;
            const titleEl = this.element?.querySelector('.eo-modal-header h2');
            if (titleEl) {
                titleEl.textContent = title;
            }
        }

        /**
         * Show loading state
         * @param {boolean} loading - Whether to show loading
         */
        setLoading(loading) {
            if (!this.element) return;

            const body = this.element.querySelector('.eo-modal-body');
            const footer = this.element.querySelector('.eo-modal-footer');

            if (loading) {
                body.style.opacity = '0.5';
                body.style.pointerEvents = 'none';
                if (footer) footer.querySelectorAll('button').forEach(b => b.disabled = true);
            } else {
                body.style.opacity = '1';
                body.style.pointerEvents = '';
                if (footer) footer.querySelectorAll('button').forEach(b => b.disabled = false);
            }
        }

        /**
         * Show error message
         * @param {string} message - Error message
         */
        showError(message) {
            const errorEl = this.element?.querySelector('.eo-modal-error');
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.style.display = 'block';
            } else {
                const body = this.element?.querySelector('.eo-modal-body');
                if (body) {
                    const error = document.createElement('div');
                    error.className = 'eo-modal-error p-3 mb-4 bg-red-50 text-red-600 rounded';
                    error.textContent = message;
                    body.insertBefore(error, body.firstChild);
                }
            }
        }

        /**
         * Clear error message
         */
        clearError() {
            const errorEl = this.element?.querySelector('.eo-modal-error');
            if (errorEl) {
                errorEl.style.display = 'none';
            }
        }

        // Event system
        _listeners = [];

        /**
         * Subscribe to modal events
         * @param {string} event - Event name
         * @param {Function} callback - Event handler
         * @returns {Function} Unsubscribe function
         */
        on(event, callback) {
            const listener = { event, callback };
            this._listeners.push(listener);
            return () => {
                const idx = this._listeners.indexOf(listener);
                if (idx >= 0) this._listeners.splice(idx, 1);
            };
        }

        /**
         * Emit an event
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        _emit(event, data) {
            this._listeners
                .filter(l => l.event === event)
                .forEach(l => l.callback(data));
        }
    }

    /**
     * EOConfirmModal - Simple confirmation modal
     */
    class EOConfirmModal extends EOModalBase {
        constructor(options = {}) {
            super({
                title: options.title || 'Confirm',
                size: 'small',
                ...options
            });

            this.message = options.message || 'Are you sure?';
            this.confirmText = options.confirmText || 'Confirm';
            this.cancelText = options.cancelText || 'Cancel';
            this.dangerous = options.dangerous || false;
        }

        renderBody() {
            return `
                <div class="eo-modal-body p-4">
                    <p class="text-gray-600">${this.message}</p>
                </div>
            `;
        }

        renderFooter() {
            const confirmClass = this.dangerous
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700';

            return `
                <div class="eo-modal-footer flex justify-end gap-2 p-4 border-t">
                    <button class="eo-modal-cancel px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                        ${this.cancelText}
                    </button>
                    <button class="eo-modal-confirm px-4 py-2 ${confirmClass} text-white rounded">
                        ${this.confirmText}
                    </button>
                </div>
            `;
        }
    }

    /**
     * EOFormModal - Form-based modal
     */
    class EOFormModal extends EOModalBase {
        constructor(options = {}) {
            super({
                title: options.title || 'Form',
                size: options.size || 'medium',
                ...options
            });

            this.fields = options.fields || [];
            this.values = options.values || {};
            this.submitText = options.submitText || 'Submit';
        }

        renderBody() {
            const fieldsHtml = this.fields.map(field => this._renderField(field)).join('');

            return `
                <div class="eo-modal-body p-4">
                    <form class="eo-modal-form space-y-4">
                        ${fieldsHtml}
                    </form>
                </div>
            `;
        }

        _renderField(field) {
            const value = this.values[field.name] || field.default || '';
            const required = field.required ? 'required' : '';

            switch (field.type) {
                case 'textarea':
                    return `
                        <div class="eo-form-field">
                            <label class="block text-sm font-medium mb-1">${field.label}</label>
                            <textarea name="${field.name}" class="w-full px-3 py-2 border rounded"
                                      rows="${field.rows || 3}" ${required}>${value}</textarea>
                        </div>
                    `;

                case 'select':
                    const options = field.options.map(opt =>
                        `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                    ).join('');
                    return `
                        <div class="eo-form-field">
                            <label class="block text-sm font-medium mb-1">${field.label}</label>
                            <select name="${field.name}" class="w-full px-3 py-2 border rounded" ${required}>
                                ${options}
                            </select>
                        </div>
                    `;

                case 'checkbox':
                    return `
                        <div class="eo-form-field flex items-center gap-2">
                            <input type="checkbox" name="${field.name}" id="${field.name}"
                                   ${value ? 'checked' : ''} ${required}>
                            <label for="${field.name}" class="text-sm">${field.label}</label>
                        </div>
                    `;

                default:
                    return `
                        <div class="eo-form-field">
                            <label class="block text-sm font-medium mb-1">${field.label}</label>
                            <input type="${field.type || 'text'}" name="${field.name}"
                                   value="${value}" class="w-full px-3 py-2 border rounded"
                                   ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
                                   ${required}>
                        </div>
                    `;
            }
        }

        renderFooter() {
            return `
                <div class="eo-modal-footer flex justify-end gap-2 p-4 border-t">
                    <button type="button" class="eo-modal-cancel px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                        Cancel
                    </button>
                    <button type="submit" class="eo-modal-confirm px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded">
                        ${this.submitText}
                    </button>
                </div>
            `;
        }

        attachCustomListeners() {
            const form = this.element?.querySelector('.eo-modal-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.onConfirm();
                });
            }
        }

        onConfirm() {
            const form = this.element?.querySelector('.eo-modal-form');
            if (!form) return;

            const formData = new FormData(form);
            const values = {};

            this.fields.forEach(field => {
                if (field.type === 'checkbox') {
                    values[field.name] = formData.get(field.name) === 'on';
                } else {
                    values[field.name] = formData.get(field.name);
                }
            });

            this.close({ confirmed: true, values });
        }
    }

    /**
     * Modal factory function
     */
    const EOModal = {
        /**
         * Show a confirmation modal
         * @param {Object} options - Modal options
         * @returns {Promise<boolean>}
         */
        confirm(options) {
            return new Promise(resolve => {
                const modal = new EOConfirmModal({
                    ...options,
                    onClose: (result) => resolve(result?.confirmed === true)
                });
                modal.open();
            });
        },

        /**
         * Show a form modal
         * @param {Object} options - Modal options
         * @returns {Promise<Object|null>}
         */
        form(options) {
            return new Promise(resolve => {
                const modal = new EOFormModal({
                    ...options,
                    onClose: (result) => resolve(result?.confirmed ? result.values : null)
                });
                modal.open();
            });
        },

        /**
         * Create a custom modal
         * @param {Object} config - Modal configuration
         * @returns {EOModalBase}
         */
        create(config) {
            return new EOModalBase(config);
        }
    };

    // Export to global scope
    global.EOModalBase = EOModalBase;
    global.EOConfirmModal = EOConfirmModal;
    global.EOFormModal = EOFormModal;
    global.EOModal = EOModal;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { EOModalBase, EOConfirmModal, EOFormModal, EOModal };
    }

})(typeof window !== 'undefined' ? window : global);
