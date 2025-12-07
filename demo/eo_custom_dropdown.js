/**
 * EO Custom Dropdown Component
 *
 * A modern, customizable dropdown replacement for native HTML selects.
 * Features:
 * - Keyboard navigation (arrow keys, enter, escape, type-ahead search)
 * - Accessible (ARIA attributes)
 * - Searchable options
 * - Custom option rendering
 * - Grouped options support
 * - Multiple sizes
 * - Animation support
 */

(function(global) {
    'use strict';

    class EOCustomDropdown {
        static instances = new Map();
        static instanceCounter = 0;

        /**
         * Create a custom dropdown
         * @param {Object} options - Configuration options
         * @param {HTMLElement|string} options.target - Target element or selector to replace
         * @param {Array} options.options - Array of options: { value, label, icon?, disabled?, group? }
         * @param {string} options.value - Initial selected value
         * @param {string} options.placeholder - Placeholder text when no selection
         * @param {boolean} options.searchable - Enable search/filter
         * @param {string} options.size - Size variant: 'sm', 'md', 'lg'
         * @param {boolean} options.disabled - Disable the dropdown
         * @param {Function} options.onChange - Callback when value changes
         * @param {Function} options.renderOption - Custom option render function
         * @param {string} options.width - Custom width (e.g., '200px', '100%')
         * @param {string} options.dropdownClass - Additional CSS class for dropdown
         */
        constructor(options = {}) {
            this.id = `eo-dropdown-${++EOCustomDropdown.instanceCounter}`;
            this.options = options.options || [];
            this.value = options.value ?? null;
            this.placeholder = options.placeholder || 'Select...';
            this.searchable = options.searchable || false;
            this.size = options.size || 'md';
            this.disabled = options.disabled || false;
            this.onChange = options.onChange || (() => {});
            this.renderOption = options.renderOption || null;
            this.width = options.width || null;
            this.dropdownClass = options.dropdownClass || '';
            this.maxHeight = options.maxHeight || '280px';

            this.isOpen = false;
            this.highlightedIndex = -1;
            this.searchQuery = '';
            this.searchTimeout = null;
            this.filteredOptions = [...this.options];

            this.container = null;
            this.trigger = null;
            this.dropdown = null;
            this.searchInput = null;
            this.optionsList = null;

            // If target provided, replace it
            if (options.target) {
                this.replaceElement(options.target);
            }

            EOCustomDropdown.instances.set(this.id, this);
        }

        /**
         * Replace an existing select element with this dropdown
         */
        replaceElement(target) {
            const element = typeof target === 'string'
                ? document.querySelector(target)
                : target;

            if (!element) return this;

            // If it's a native select, extract options from it
            if (element.tagName === 'SELECT') {
                this.options = Array.from(element.options).map(opt => ({
                    value: opt.value,
                    label: opt.textContent,
                    disabled: opt.disabled
                }));
                this.value = element.value;
                this.disabled = element.disabled;

                // Copy ID for form association
                if (element.id) {
                    this.originalId = element.id;
                }
            }

            // Create the dropdown
            this.create();

            // Insert after the target and remove it
            element.parentNode.insertBefore(this.container, element);
            element.remove();

            return this;
        }

        /**
         * Create the dropdown DOM structure
         */
        create() {
            // Main container
            this.container = document.createElement('div');
            this.container.className = `eo-dropdown eo-dropdown-${this.size}`;
            if (this.dropdownClass) {
                this.container.classList.add(this.dropdownClass);
            }
            if (this.disabled) {
                this.container.classList.add('eo-dropdown-disabled');
            }
            if (this.width) {
                this.container.style.width = this.width;
            }
            this.container.setAttribute('data-dropdown-id', this.id);

            // Hidden input for form compatibility
            this.hiddenInput = document.createElement('input');
            this.hiddenInput.type = 'hidden';
            this.hiddenInput.value = this.value || '';
            if (this.originalId) {
                this.hiddenInput.id = this.originalId;
                this.hiddenInput.name = this.originalId;
            }
            this.container.appendChild(this.hiddenInput);

            // Trigger button
            this.trigger = document.createElement('button');
            this.trigger.type = 'button';
            this.trigger.className = 'eo-dropdown-trigger';
            this.trigger.setAttribute('role', 'combobox');
            this.trigger.setAttribute('aria-expanded', 'false');
            this.trigger.setAttribute('aria-haspopup', 'listbox');
            this.trigger.setAttribute('aria-controls', `${this.id}-listbox`);
            if (this.disabled) {
                this.trigger.disabled = true;
            }
            this.updateTriggerDisplay();
            this.container.appendChild(this.trigger);

            // Bind events
            this.bindEvents();

            return this.container;
        }

        /**
         * Update the trigger button display
         */
        updateTriggerDisplay() {
            const selectedOption = this.options.find(opt => opt.value === this.value);

            let html = '<div class="eo-dropdown-trigger-content">';

            if (selectedOption) {
                if (selectedOption.icon) {
                    html += `<span class="eo-dropdown-trigger-icon">${selectedOption.icon}</span>`;
                }
                html += `<span class="eo-dropdown-trigger-text">${this.escapeHtml(selectedOption.label)}</span>`;
            } else {
                html += `<span class="eo-dropdown-trigger-placeholder">${this.escapeHtml(this.placeholder)}</span>`;
            }

            html += '</div>';
            html += '<span class="eo-dropdown-arrow"><i class="ph ph-caret-down"></i></span>';

            this.trigger.innerHTML = html;
        }

        /**
         * Bind event listeners
         */
        bindEvents() {
            // Trigger click
            this.trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
            });

            // Keyboard navigation on trigger
            this.trigger.addEventListener('keydown', (e) => this.handleTriggerKeydown(e));

            // Close on outside click
            this._outsideClickHandler = (e) => {
                if (this.isOpen && !this.container.contains(e.target)) {
                    this.close();
                }
            };
            document.addEventListener('click', this._outsideClickHandler);

            // Close on escape
            this._escapeHandler = (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                    this.trigger.focus();
                }
            };
            document.addEventListener('keydown', this._escapeHandler);
        }

        /**
         * Handle keydown on trigger
         */
        handleTriggerKeydown(e) {
            switch (e.key) {
                case 'Enter':
                case ' ':
                case 'ArrowDown':
                case 'ArrowUp':
                    e.preventDefault();
                    if (!this.isOpen) {
                        this.open();
                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                            this.highlightFirst();
                        }
                    }
                    break;
            }
        }

        /**
         * Handle keydown in dropdown
         */
        handleDropdownKeydown(e) {
            const enabledOptions = this.filteredOptions.filter(opt => !opt.disabled);

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.highlightNext();
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    this.highlightPrevious();
                    break;

                case 'Enter':
                    e.preventDefault();
                    if (this.highlightedIndex >= 0) {
                        const option = this.filteredOptions[this.highlightedIndex];
                        if (option && !option.disabled) {
                            this.selectOption(option);
                        }
                    }
                    break;

                case 'Escape':
                    e.preventDefault();
                    this.close();
                    this.trigger.focus();
                    break;

                case 'Tab':
                    this.close();
                    break;

                default:
                    // Type-ahead search (if not searchable mode)
                    if (!this.searchable && e.key.length === 1) {
                        this.typeAheadSearch(e.key);
                    }
                    break;
            }
        }

        /**
         * Type-ahead search
         */
        typeAheadSearch(char) {
            clearTimeout(this.searchTimeout);
            this.searchQuery += char.toLowerCase();

            // Find matching option
            const matchIndex = this.filteredOptions.findIndex(opt =>
                !opt.disabled && opt.label.toLowerCase().startsWith(this.searchQuery)
            );

            if (matchIndex >= 0) {
                this.highlightIndex(matchIndex);
            }

            // Clear search query after delay
            this.searchTimeout = setTimeout(() => {
                this.searchQuery = '';
            }, 500);
        }

        /**
         * Open the dropdown
         */
        open() {
            if (this.isOpen || this.disabled) return;

            this.isOpen = true;
            this.container.classList.add('eo-dropdown-open');
            this.trigger.setAttribute('aria-expanded', 'true');

            // Create dropdown panel
            this.createDropdownPanel();

            // Position dropdown
            this.positionDropdown();

            // Highlight current value
            const currentIndex = this.filteredOptions.findIndex(opt => opt.value === this.value);
            if (currentIndex >= 0) {
                this.highlightIndex(currentIndex);
                this.scrollToHighlighted();
            }

            // Focus search input or options list
            if (this.searchable && this.searchInput) {
                this.searchInput.focus();
            } else if (this.optionsList) {
                this.optionsList.focus();
            }
        }

        /**
         * Close the dropdown
         */
        close() {
            if (!this.isOpen) return;

            this.isOpen = false;
            this.container.classList.remove('eo-dropdown-open');
            this.trigger.setAttribute('aria-expanded', 'false');
            this.highlightedIndex = -1;
            this.filteredOptions = [...this.options];
            this.searchQuery = '';

            // Remove dropdown panel
            if (this.dropdown) {
                this.dropdown.remove();
                this.dropdown = null;
                this.searchInput = null;
                this.optionsList = null;
            }
        }

        /**
         * Toggle dropdown
         */
        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }

        /**
         * Create the dropdown panel
         */
        createDropdownPanel() {
            this.dropdown = document.createElement('div');
            this.dropdown.className = 'eo-dropdown-panel';
            this.dropdown.id = `${this.id}-panel`;

            // Search input
            if (this.searchable) {
                const searchWrapper = document.createElement('div');
                searchWrapper.className = 'eo-dropdown-search';
                searchWrapper.innerHTML = `
                    <i class="ph ph-magnifying-glass"></i>
                    <input type="text"
                           class="eo-dropdown-search-input"
                           placeholder="Search..."
                           autocomplete="off">
                `;
                this.dropdown.appendChild(searchWrapper);
                this.searchInput = searchWrapper.querySelector('input');

                this.searchInput.addEventListener('input', (e) => {
                    this.filterOptions(e.target.value);
                });

                this.searchInput.addEventListener('keydown', (e) => {
                    this.handleDropdownKeydown(e);
                });
            }

            // Options list
            this.optionsList = document.createElement('div');
            this.optionsList.className = 'eo-dropdown-options';
            this.optionsList.id = `${this.id}-listbox`;
            this.optionsList.setAttribute('role', 'listbox');
            this.optionsList.setAttribute('tabindex', '-1');
            this.optionsList.style.maxHeight = this.maxHeight;

            this.renderOptions();
            this.dropdown.appendChild(this.optionsList);

            // Keyboard navigation
            this.optionsList.addEventListener('keydown', (e) => {
                this.handleDropdownKeydown(e);
            });

            // Append to body for proper positioning
            document.body.appendChild(this.dropdown);
        }

        /**
         * Render options list
         */
        renderOptions() {
            if (!this.optionsList) return;

            if (this.filteredOptions.length === 0) {
                this.optionsList.innerHTML = `
                    <div class="eo-dropdown-empty">
                        <i class="ph ph-magnifying-glass"></i>
                        <span>No options found</span>
                    </div>
                `;
                return;
            }

            let html = '';
            let currentGroup = null;

            this.filteredOptions.forEach((option, index) => {
                // Group header
                if (option.group && option.group !== currentGroup) {
                    currentGroup = option.group;
                    html += `<div class="eo-dropdown-group-header">${this.escapeHtml(currentGroup)}</div>`;
                }

                const isSelected = option.value === this.value;
                const isHighlighted = index === this.highlightedIndex;
                const isDisabled = option.disabled;

                let classes = 'eo-dropdown-option';
                if (isSelected) classes += ' eo-dropdown-option-selected';
                if (isHighlighted) classes += ' eo-dropdown-option-highlighted';
                if (isDisabled) classes += ' eo-dropdown-option-disabled';

                html += `
                    <div class="${classes}"
                         role="option"
                         data-index="${index}"
                         data-value="${this.escapeHtml(option.value)}"
                         aria-selected="${isSelected}"
                         ${isDisabled ? 'aria-disabled="true"' : ''}>
                `;

                if (this.renderOption) {
                    html += this.renderOption(option);
                } else {
                    if (option.icon) {
                        html += `<span class="eo-dropdown-option-icon">${option.icon}</span>`;
                    }
                    html += `<span class="eo-dropdown-option-label">${this.escapeHtml(option.label)}</span>`;
                    if (isSelected) {
                        html += '<span class="eo-dropdown-option-check"><i class="ph ph-check"></i></span>';
                    }
                }

                html += '</div>';
            });

            this.optionsList.innerHTML = html;

            // Bind click events
            this.optionsList.querySelectorAll('.eo-dropdown-option').forEach(el => {
                el.addEventListener('click', (e) => {
                    const index = parseInt(el.dataset.index, 10);
                    const option = this.filteredOptions[index];
                    if (option && !option.disabled) {
                        this.selectOption(option);
                    }
                });

                el.addEventListener('mouseenter', () => {
                    const index = parseInt(el.dataset.index, 10);
                    this.highlightIndex(index, false);
                });
            });
        }

        /**
         * Filter options based on search query
         */
        filterOptions(query) {
            query = query.toLowerCase().trim();

            if (!query) {
                this.filteredOptions = [...this.options];
            } else {
                this.filteredOptions = this.options.filter(opt =>
                    opt.label.toLowerCase().includes(query)
                );
            }

            this.highlightedIndex = -1;
            this.renderOptions();

            // Highlight first enabled option
            if (this.filteredOptions.length > 0) {
                const firstEnabledIndex = this.filteredOptions.findIndex(opt => !opt.disabled);
                if (firstEnabledIndex >= 0) {
                    this.highlightIndex(firstEnabledIndex, false);
                }
            }
        }

        /**
         * Position the dropdown panel
         */
        positionDropdown() {
            if (!this.dropdown || !this.trigger) return;

            const triggerRect = this.trigger.getBoundingClientRect();
            const dropdownRect = this.dropdown.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // Calculate position
            let top = triggerRect.bottom + 4;
            let left = triggerRect.left;

            // Flip to top if not enough space below
            if (top + dropdownRect.height > viewportHeight - 8) {
                top = triggerRect.top - dropdownRect.height - 4;
                this.dropdown.classList.add('eo-dropdown-panel-top');
            } else {
                this.dropdown.classList.remove('eo-dropdown-panel-top');
            }

            // Ensure not off right edge
            if (left + dropdownRect.width > viewportWidth - 8) {
                left = viewportWidth - dropdownRect.width - 8;
            }

            // Ensure not off left edge
            if (left < 8) {
                left = 8;
            }

            this.dropdown.style.position = 'fixed';
            this.dropdown.style.top = `${top}px`;
            this.dropdown.style.left = `${left}px`;
            this.dropdown.style.width = `${Math.max(triggerRect.width, 150)}px`;
        }

        /**
         * Select an option
         */
        selectOption(option) {
            const oldValue = this.value;
            this.value = option.value;
            this.hiddenInput.value = option.value;

            this.updateTriggerDisplay();
            this.close();
            this.trigger.focus();

            if (oldValue !== option.value) {
                this.onChange(option.value, option);

                // Dispatch change event for form compatibility
                const event = new Event('change', { bubbles: true });
                this.hiddenInput.dispatchEvent(event);
            }
        }

        /**
         * Highlight functions
         */
        highlightFirst() {
            const firstIndex = this.filteredOptions.findIndex(opt => !opt.disabled);
            if (firstIndex >= 0) {
                this.highlightIndex(firstIndex);
            }
        }

        highlightNext() {
            let nextIndex = this.highlightedIndex + 1;
            while (nextIndex < this.filteredOptions.length) {
                if (!this.filteredOptions[nextIndex].disabled) {
                    this.highlightIndex(nextIndex);
                    return;
                }
                nextIndex++;
            }
        }

        highlightPrevious() {
            let prevIndex = this.highlightedIndex - 1;
            while (prevIndex >= 0) {
                if (!this.filteredOptions[prevIndex].disabled) {
                    this.highlightIndex(prevIndex);
                    return;
                }
                prevIndex--;
            }
        }

        highlightIndex(index, scroll = true) {
            this.highlightedIndex = index;
            this.renderOptions();
            if (scroll) {
                this.scrollToHighlighted();
            }
        }

        scrollToHighlighted() {
            if (!this.optionsList) return;

            const highlighted = this.optionsList.querySelector('.eo-dropdown-option-highlighted');
            if (highlighted) {
                highlighted.scrollIntoView({ block: 'nearest' });
            }
        }

        /**
         * Public API methods
         */
        setValue(value) {
            this.value = value;
            this.hiddenInput.value = value || '';
            this.updateTriggerDisplay();
            return this;
        }

        getValue() {
            return this.value;
        }

        setOptions(options) {
            this.options = options;
            this.filteredOptions = [...options];
            if (this.isOpen) {
                this.renderOptions();
            }
            this.updateTriggerDisplay();
            return this;
        }

        getOptions() {
            return this.options;
        }

        enable() {
            this.disabled = false;
            this.container.classList.remove('eo-dropdown-disabled');
            this.trigger.disabled = false;
            return this;
        }

        disable() {
            this.disabled = true;
            this.container.classList.add('eo-dropdown-disabled');
            this.trigger.disabled = true;
            this.close();
            return this;
        }

        focus() {
            this.trigger.focus();
            return this;
        }

        destroy() {
            document.removeEventListener('click', this._outsideClickHandler);
            document.removeEventListener('keydown', this._escapeHandler);

            if (this.dropdown) {
                this.dropdown.remove();
            }
            if (this.container) {
                this.container.remove();
            }

            EOCustomDropdown.instances.delete(this.id);
        }

        /**
         * Utility functions
         */
        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Static helper to replace a select element
         */
        static replace(selector, options = {}) {
            const elements = typeof selector === 'string'
                ? document.querySelectorAll(selector)
                : [selector];

            const instances = [];
            elements.forEach(el => {
                const dropdown = new EOCustomDropdown({
                    ...options,
                    target: el
                });
                instances.push(dropdown);
            });

            return instances.length === 1 ? instances[0] : instances;
        }

        /**
         * Static helper to get instance by ID
         */
        static getInstance(id) {
            return EOCustomDropdown.instances.get(id);
        }

        /**
         * Static helper to get instance from element
         */
        static getInstanceFromElement(element) {
            const container = element.closest('.eo-dropdown');
            if (container) {
                const id = container.getAttribute('data-dropdown-id');
                return EOCustomDropdown.instances.get(id);
            }
            return null;
        }
    }

    // Export
    global.EOCustomDropdown = EOCustomDropdown;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { EOCustomDropdown };
    }

})(typeof window !== 'undefined' ? window : global);
