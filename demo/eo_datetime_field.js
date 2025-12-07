/**
 * EO DateTime Field
 *
 * Comprehensive date/time field editor with:
 * - DATE, DATETIME, TIME modes
 * - 12/24 hour formats
 * - AM/PM support
 * - Timezone support (America/Chicago style)
 * - Robust copy/paste parsing for virtually any date format
 * - Fixed-size input that doesn't resize
 * - Customizable field configuration
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const DATETIME_MODES = {
        DATE: 'date',
        DATETIME: 'datetime',
        TIME: 'time'
    };

    const TIME_FORMATS = {
        H24: '24h',
        H12: '12h',
        H12_AMPM: '12h_ampm'
    };

    // Common timezone identifiers
    const COMMON_TIMEZONES = [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Anchorage',
        'Pacific/Honolulu',
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Asia/Dubai',
        'Australia/Sydney',
        'UTC'
    ];

    // Default field configuration
    const DEFAULT_CONFIG = {
        mode: DATETIME_MODES.DATE,
        timeFormat: TIME_FORMATS.H12_AMPM,
        timezone: null, // null = local timezone
        showTimezone: false,
        dateFormat: 'MM/DD/YYYY', // Display format
        includeSeconds: false,
        allowClear: true,
        placeholder: 'Select date...'
    };

    // ============================================================================
    // DATE/TIME PARSING
    // ============================================================================

    /**
     * Parse virtually any date/time string format
     * Returns { date, time, timezone } or null if unparseable
     */
    function parseDateTime(input, config = {}) {
        if (!input || typeof input !== 'string') return null;

        input = input.trim();
        if (!input) return null;

        let result = {
            year: null,
            month: null,
            day: null,
            hours: null,
            minutes: null,
            seconds: 0,
            milliseconds: 0,
            timezone: null,
            isPM: null
        };

        // Try ISO 8601 format first (most reliable)
        const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(?:Z|([+-]\d{2}:?\d{2}))?)?$/i);
        if (isoMatch) {
            result.year = parseInt(isoMatch[1], 10);
            result.month = parseInt(isoMatch[2], 10);
            result.day = parseInt(isoMatch[3], 10);
            if (isoMatch[4]) result.hours = parseInt(isoMatch[4], 10);
            if (isoMatch[5]) result.minutes = parseInt(isoMatch[5], 10);
            if (isoMatch[6]) result.seconds = parseInt(isoMatch[6], 10);
            if (isoMatch[7]) result.milliseconds = parseInt(isoMatch[7].padEnd(3, '0').slice(0, 3), 10);
            if (isoMatch[8]) result.timezone = isoMatch[8];
            else if (input.includes('Z')) result.timezone = 'UTC';
            return normalizeResult(result);
        }

        // Extract timezone if present (America/Chicago style or abbreviation)
        const tzMatch = input.match(/\s+([A-Z]{2,5}|[A-Za-z_]+\/[A-Za-z_]+)$/);
        if (tzMatch) {
            result.timezone = tzMatch[1];
            input = input.replace(tzMatch[0], '').trim();
        }

        // Extract AM/PM
        const ampmMatch = input.match(/\s*(AM|PM|A\.M\.|P\.M\.|am|pm|a\.m\.|p\.m\.)\.?\s*$/i);
        if (ampmMatch) {
            result.isPM = ampmMatch[1].toUpperCase().startsWith('P');
            input = input.replace(ampmMatch[0], '').trim();
        }

        // Try various date patterns
        const patterns = [
            // US format: MM/DD/YYYY or M/D/YY
            { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/, groups: ['month', 'day', 'year'] },
            // European format: DD/MM/YYYY or DD.MM.YYYY
            { regex: /^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/, groups: ['day', 'month', 'year'], european: true },
            // YYYY/MM/DD
            { regex: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, groups: ['year', 'month', 'day'] },
            // Month name formats: Jan 1, 2024 or January 1st, 2024
            { regex: /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{2,4})/, groups: ['monthName', 'day', 'year'] },
            // 1 Jan 2024 or 1st January 2024
            { regex: /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s*(\d{2,4})/, groups: ['day', 'monthName', 'year'] }
        ];

        let datePartEnd = 0;
        for (const pattern of patterns) {
            const match = input.match(pattern.regex);
            if (match) {
                datePartEnd = match[0].length;
                for (let i = 0; i < pattern.groups.length; i++) {
                    const group = pattern.groups[i];
                    const value = match[i + 1];

                    if (group === 'monthName') {
                        result.month = parseMonthName(value);
                    } else if (group === 'year') {
                        result.year = parseInt(value, 10);
                        if (result.year < 100) {
                            result.year += result.year > 50 ? 1900 : 2000;
                        }
                    } else {
                        result[group] = parseInt(value, 10);
                    }
                }

                // For European format detection: if first number > 12, swap day/month
                if (pattern.european && result.day > 12 && result.month <= 12) {
                    // Keep as-is, already correct
                } else if (!pattern.european && result.month > 12 && result.day <= 12) {
                    // US format but month > 12, swap
                    [result.day, result.month] = [result.month, result.day];
                }
                break;
            }
        }

        // Extract time part
        const timePart = input.slice(datePartEnd).trim();
        if (timePart) {
            const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?/);
            if (timeMatch) {
                result.hours = parseInt(timeMatch[1], 10);
                result.minutes = parseInt(timeMatch[2], 10);
                if (timeMatch[3]) result.seconds = parseInt(timeMatch[3], 10);
                if (timeMatch[4]) result.milliseconds = parseInt(timeMatch[4].padEnd(3, '0').slice(0, 3), 10);
            }
        }

        // Handle time-only input
        if (result.year === null && result.month === null && result.day === null) {
            const timeOnlyMatch = input.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (timeOnlyMatch) {
                result.hours = parseInt(timeOnlyMatch[1], 10);
                result.minutes = parseInt(timeOnlyMatch[2], 10);
                if (timeOnlyMatch[3]) result.seconds = parseInt(timeOnlyMatch[3], 10);

                // Use today's date for time-only
                const today = new Date();
                result.year = today.getFullYear();
                result.month = today.getMonth() + 1;
                result.day = today.getDate();
            }
        }

        // Apply AM/PM
        if (result.isPM !== null && result.hours !== null) {
            if (result.isPM && result.hours < 12) {
                result.hours += 12;
            } else if (!result.isPM && result.hours === 12) {
                result.hours = 0;
            }
        }

        return normalizeResult(result);
    }

    /**
     * Parse month name to number (1-12)
     */
    function parseMonthName(name) {
        const months = {
            'jan': 1, 'january': 1,
            'feb': 2, 'february': 2,
            'mar': 3, 'march': 3,
            'apr': 4, 'april': 4,
            'may': 5,
            'jun': 6, 'june': 6,
            'jul': 7, 'july': 7,
            'aug': 8, 'august': 8,
            'sep': 9, 'sept': 9, 'september': 9,
            'oct': 10, 'october': 10,
            'nov': 11, 'november': 11,
            'dec': 12, 'december': 12
        };
        return months[name.toLowerCase()] || null;
    }

    /**
     * Normalize and validate parsed result
     */
    function normalizeResult(result) {
        // Validate date components
        if (result.year !== null) {
            if (result.month < 1 || result.month > 12) return null;
            if (result.day < 1 || result.day > 31) return null;

            // Validate day for month
            const daysInMonth = new Date(result.year, result.month, 0).getDate();
            if (result.day > daysInMonth) return null;
        }

        // Validate time components
        if (result.hours !== null) {
            if (result.hours < 0 || result.hours > 23) return null;
            if (result.minutes < 0 || result.minutes > 59) return null;
            if (result.seconds < 0 || result.seconds > 59) return null;
        }

        return result;
    }

    /**
     * Convert parsed result to Date object
     */
    function parsedToDate(parsed, timezone = null) {
        if (!parsed) return null;

        const date = new Date(
            parsed.year,
            parsed.month - 1,
            parsed.day,
            parsed.hours || 0,
            parsed.minutes || 0,
            parsed.seconds || 0,
            parsed.milliseconds || 0
        );

        if (isNaN(date.getTime())) return null;
        return date;
    }

    /**
     * Convert parsed result to ISO string
     */
    function parsedToISO(parsed) {
        if (!parsed || parsed.year === null) return '';
        const date = parsedToDate(parsed);
        if (!date) return '';
        return date.toISOString();
    }

    /**
     * Convert parsed result to date string (YYYY-MM-DD)
     */
    function parsedToDateString(parsed) {
        if (!parsed || parsed.year === null) return '';
        const y = String(parsed.year).padStart(4, '0');
        const m = String(parsed.month).padStart(2, '0');
        const d = String(parsed.day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Convert parsed result to time string
     */
    function parsedToTimeString(parsed, format = TIME_FORMATS.H24, includeSeconds = false) {
        if (!parsed || parsed.hours === null) return '';

        let h = parsed.hours;
        let ampm = '';

        if (format === TIME_FORMATS.H12 || format === TIME_FORMATS.H12_AMPM) {
            ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
        }

        const hStr = String(h).padStart(2, '0');
        const mStr = String(parsed.minutes).padStart(2, '0');
        let result = `${hStr}:${mStr}`;

        if (includeSeconds) {
            result += `:${String(parsed.seconds).padStart(2, '0')}`;
        }

        if (format === TIME_FORMATS.H12_AMPM) {
            result += ` ${ampm}`;
        }

        return result;
    }

    // ============================================================================
    // FORMATTING
    // ============================================================================

    /**
     * Format a date value for display
     */
    function formatDateTime(value, config = {}) {
        const cfg = { ...DEFAULT_CONFIG, ...config };
        const parsed = parseDateTime(value);
        if (!parsed) return '';

        let result = '';

        // Format date part
        if (cfg.mode !== DATETIME_MODES.TIME && parsed.year !== null) {
            const y = String(parsed.year);
            const m = String(parsed.month).padStart(2, '0');
            const d = String(parsed.day).padStart(2, '0');

            switch (cfg.dateFormat) {
                case 'YYYY-MM-DD':
                    result = `${y}-${m}-${d}`;
                    break;
                case 'DD/MM/YYYY':
                    result = `${d}/${m}/${y}`;
                    break;
                case 'DD.MM.YYYY':
                    result = `${d}.${m}.${y}`;
                    break;
                case 'MMM D, YYYY':
                    result = `${getMonthAbbr(parsed.month)} ${parsed.day}, ${y}`;
                    break;
                case 'D MMM YYYY':
                    result = `${parsed.day} ${getMonthAbbr(parsed.month)} ${y}`;
                    break;
                case 'MM/DD/YYYY':
                default:
                    result = `${m}/${d}/${y}`;
                    break;
            }
        }

        // Format time part
        if (cfg.mode !== DATETIME_MODES.DATE && parsed.hours !== null) {
            const timeStr = parsedToTimeString(parsed, cfg.timeFormat, cfg.includeSeconds);
            if (result) {
                result += ' ' + timeStr;
            } else {
                result = timeStr;
            }
        }

        // Add timezone
        if (cfg.showTimezone && cfg.timezone) {
            result += ' ' + cfg.timezone;
        }

        return result;
    }

    /**
     * Get month abbreviation
     */
    function getMonthAbbr(month) {
        const abbrs = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return abbrs[month] || '';
    }

    /**
     * Get month full name
     */
    function getMonthName(month) {
        const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return names[month] || '';
    }

    // ============================================================================
    // DATETIME PICKER COMPONENT
    // ============================================================================

    class EODateTimePicker {
        constructor(options = {}) {
            this.config = { ...DEFAULT_CONFIG, ...options };
            this.value = null;
            this.parsedValue = null;
            this.isOpen = false;
            this.container = null;
            this.input = null;
            this.dropdown = null;
            this.onChange = options.onChange || (() => {});
            this.onClose = options.onClose || (() => {});
            this.currentViewDate = new Date();
        }

        /**
         * Create the picker element
         */
        create(targetCell) {
            // Create container
            this.container = document.createElement('div');
            this.container.className = 'eo-datetime-picker';

            // Create input wrapper
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'eo-datetime-input-wrapper';

            // Create text input for display/editing
            this.input = document.createElement('input');
            this.input.type = 'text';
            this.input.className = 'eo-datetime-input';
            this.input.placeholder = this.config.placeholder || this.getPlaceholder();
            this.input.autocomplete = 'off';
            this.input.spellcheck = false;

            // Create dropdown toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'eo-datetime-toggle';
            toggleBtn.innerHTML = this.getToggleIcon();
            toggleBtn.tabIndex = -1;

            inputWrapper.appendChild(this.input);
            inputWrapper.appendChild(toggleBtn);
            this.container.appendChild(inputWrapper);

            // Event listeners
            this.input.addEventListener('focus', () => this.open());
            this.input.addEventListener('blur', (e) => this.handleBlur(e));
            this.input.addEventListener('input', (e) => this.handleInput(e));
            this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
            this.input.addEventListener('paste', (e) => this.handlePaste(e));
            toggleBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.toggle();
            });

            return this.container;
        }

        /**
         * Get appropriate placeholder based on mode
         */
        getPlaceholder() {
            switch (this.config.mode) {
                case DATETIME_MODES.TIME:
                    return this.config.timeFormat === TIME_FORMATS.H24 ? 'HH:MM' : 'HH:MM AM/PM';
                case DATETIME_MODES.DATETIME:
                    return 'MM/DD/YYYY HH:MM';
                default:
                    return 'MM/DD/YYYY';
            }
        }

        /**
         * Get toggle button icon based on mode
         */
        getToggleIcon() {
            switch (this.config.mode) {
                case DATETIME_MODES.TIME:
                    return '<i class="ph ph-clock"></i>';
                default:
                    return '<i class="ph ph-calendar"></i>';
            }
        }

        /**
         * Set value
         */
        setValue(value) {
            this.value = value;
            this.parsedValue = parseDateTime(value);
            if (this.input) {
                this.input.value = formatDateTime(value, this.config);
            }
            if (this.parsedValue) {
                this.currentViewDate = parsedToDate(this.parsedValue) || new Date();
            }
        }

        /**
         * Get value (as ISO string for storage)
         */
        getValue() {
            if (!this.parsedValue) return '';

            switch (this.config.mode) {
                case DATETIME_MODES.DATE:
                    return parsedToDateString(this.parsedValue);
                case DATETIME_MODES.TIME:
                    return parsedToTimeString(this.parsedValue, TIME_FORMATS.H24, this.config.includeSeconds);
                default:
                    return parsedToISO(this.parsedValue);
            }
        }

        /**
         * Open dropdown
         */
        open() {
            if (this.isOpen) return;
            this.isOpen = true;
            this.createDropdown();
        }

        /**
         * Close dropdown
         */
        close() {
            if (!this.isOpen) return;
            this.isOpen = false;
            if (this.dropdown) {
                this.dropdown.remove();
                this.dropdown = null;
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
                this.input.focus();
            }
        }

        /**
         * Handle blur event
         */
        handleBlur(e) {
            // Check if clicking inside dropdown
            setTimeout(() => {
                if (this.dropdown && this.dropdown.contains(document.activeElement)) {
                    return;
                }
                if (this.container && this.container.contains(document.activeElement)) {
                    return;
                }
                this.commitValue();
                this.close();
                this.onClose(this.getValue());
            }, 150);
        }

        /**
         * Handle input change
         */
        handleInput(e) {
            const text = e.target.value;
            const parsed = parseDateTime(text);
            if (parsed) {
                this.parsedValue = parsed;
                this.currentViewDate = parsedToDate(parsed) || new Date();
                if (this.dropdown) {
                    this.updateDropdown();
                }
            }
        }

        /**
         * Handle paste event - smart paste support
         */
        handlePaste(e) {
            // Let the paste happen, then process
            setTimeout(() => {
                const text = this.input.value;
                const parsed = parseDateTime(text);
                if (parsed) {
                    this.parsedValue = parsed;
                    this.input.value = formatDateTime(text, this.config);
                    this.currentViewDate = parsedToDate(parsed) || new Date();
                    if (this.dropdown) {
                        this.updateDropdown();
                    }
                }
            }, 0);
        }

        /**
         * Handle keydown
         */
        handleKeydown(e) {
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    this.commitValue();
                    this.close();
                    this.onClose(this.getValue());
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.close();
                    this.onClose(null); // Cancel
                    break;
                case 'Tab':
                    this.commitValue();
                    this.close();
                    break;
                case 'ArrowDown':
                    if (!this.isOpen) {
                        e.preventDefault();
                        this.open();
                    }
                    break;
            }
        }

        /**
         * Commit current input value
         */
        commitValue() {
            const text = this.input.value;
            if (!text.trim()) {
                this.parsedValue = null;
                this.value = null;
                return;
            }
            const parsed = parseDateTime(text);
            if (parsed) {
                this.parsedValue = parsed;
                this.input.value = formatDateTime(text, this.config);
                this.value = this.getValue();
                this.onChange(this.value);
            }
        }

        /**
         * Create dropdown picker
         */
        createDropdown() {
            this.dropdown = document.createElement('div');
            this.dropdown.className = 'eo-datetime-dropdown';

            // Position dropdown
            const inputRect = this.container.getBoundingClientRect();
            this.dropdown.style.position = 'fixed';
            this.dropdown.style.top = (inputRect.bottom + 4) + 'px';
            this.dropdown.style.left = inputRect.left + 'px';
            this.dropdown.style.zIndex = '10000';

            this.updateDropdown();
            document.body.appendChild(this.dropdown);

            // Adjust position if off-screen
            const dropdownRect = this.dropdown.getBoundingClientRect();
            if (dropdownRect.bottom > window.innerHeight) {
                this.dropdown.style.top = (inputRect.top - dropdownRect.height - 4) + 'px';
            }
            if (dropdownRect.right > window.innerWidth) {
                this.dropdown.style.left = (window.innerWidth - dropdownRect.width - 8) + 'px';
            }
        }

        /**
         * Update dropdown content
         */
        updateDropdown() {
            if (!this.dropdown) return;

            let html = '';

            // Date picker (for DATE and DATETIME modes)
            if (this.config.mode !== DATETIME_MODES.TIME) {
                html += this.renderCalendar();
            }

            // Time picker (for TIME and DATETIME modes)
            if (this.config.mode !== DATETIME_MODES.DATE) {
                html += this.renderTimePicker();
            }

            // Timezone selector
            if (this.config.showTimezone) {
                html += this.renderTimezoneSelector();
            }

            // Quick actions
            html += this.renderQuickActions();

            this.dropdown.innerHTML = html;
            this.attachDropdownEvents();

            // Initialize custom dropdowns after DOM is ready
            if (this.config.showTimezone) {
                this.initTimezoneDropdown(this.dropdown);
            }
        }

        /**
         * Render calendar grid
         */
        renderCalendar() {
            const viewYear = this.currentViewDate.getFullYear();
            const viewMonth = this.currentViewDate.getMonth();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const selectedDate = this.parsedValue ? parsedToDate(this.parsedValue) : null;
            if (selectedDate) selectedDate.setHours(0, 0, 0, 0);

            // First day of month
            const firstDay = new Date(viewYear, viewMonth, 1);
            const startingDay = firstDay.getDay();

            // Days in month
            const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

            // Days in previous month (for padding)
            const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

            let html = `
                <div class="eo-calendar">
                    <div class="eo-calendar-header">
                        <button type="button" class="eo-cal-nav" data-action="prev-year" title="Previous year">
                            <i class="ph ph-caret-double-left"></i>
                        </button>
                        <button type="button" class="eo-cal-nav" data-action="prev-month" title="Previous month">
                            <i class="ph ph-caret-left"></i>
                        </button>
                        <span class="eo-calendar-title">${getMonthName(viewMonth + 1)} ${viewYear}</span>
                        <button type="button" class="eo-cal-nav" data-action="next-month" title="Next month">
                            <i class="ph ph-caret-right"></i>
                        </button>
                        <button type="button" class="eo-cal-nav" data-action="next-year" title="Next year">
                            <i class="ph ph-caret-double-right"></i>
                        </button>
                    </div>
                    <div class="eo-calendar-weekdays">
                        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                    </div>
                    <div class="eo-calendar-days">
            `;

            // Previous month's trailing days
            for (let i = startingDay - 1; i >= 0; i--) {
                const day = daysInPrevMonth - i;
                html += `<button type="button" class="eo-cal-day other-month" data-date="${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</button>`;
            }

            // Current month's days
            for (let day = 1; day <= daysInMonth; day++) {
                const dateObj = new Date(viewYear, viewMonth, day);
                dateObj.setHours(0, 0, 0, 0);
                const isToday = dateObj.getTime() === today.getTime();
                const isSelected = selectedDate && dateObj.getTime() === selectedDate.getTime();

                let classes = 'eo-cal-day';
                if (isToday) classes += ' today';
                if (isSelected) classes += ' selected';

                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                html += `<button type="button" class="${classes}" data-date="${dateStr}">${day}</button>`;
            }

            // Next month's leading days
            const totalCells = startingDay + daysInMonth;
            const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
            for (let day = 1; day <= remainingCells; day++) {
                html += `<button type="button" class="eo-cal-day other-month" data-date="${viewYear}-${String(viewMonth + 2).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</button>`;
            }

            html += `
                    </div>
                </div>
            `;

            return html;
        }

        /**
         * Render time picker
         */
        renderTimePicker() {
            const hours = this.parsedValue?.hours ?? 12;
            const minutes = this.parsedValue?.minutes ?? 0;
            const seconds = this.parsedValue?.seconds ?? 0;

            const is12Hour = this.config.timeFormat !== TIME_FORMATS.H24;
            const isPM = hours >= 12;
            const displayHours = is12Hour ? (hours % 12 || 12) : hours;

            let html = `
                <div class="eo-time-picker">
                    <div class="eo-time-label">Time</div>
                    <div class="eo-time-inputs">
                        <div class="eo-time-input-group">
                            <button type="button" class="eo-time-spin" data-action="hour-up">
                                <i class="ph ph-caret-up"></i>
                            </button>
                            <input type="text" class="eo-time-input" data-field="hours"
                                   value="${String(displayHours).padStart(2, '0')}"
                                   maxlength="2">
                            <button type="button" class="eo-time-spin" data-action="hour-down">
                                <i class="ph ph-caret-down"></i>
                            </button>
                        </div>
                        <span class="eo-time-separator">:</span>
                        <div class="eo-time-input-group">
                            <button type="button" class="eo-time-spin" data-action="minute-up">
                                <i class="ph ph-caret-up"></i>
                            </button>
                            <input type="text" class="eo-time-input" data-field="minutes"
                                   value="${String(minutes).padStart(2, '0')}"
                                   maxlength="2">
                            <button type="button" class="eo-time-spin" data-action="minute-down">
                                <i class="ph ph-caret-down"></i>
                            </button>
                        </div>
            `;

            if (this.config.includeSeconds) {
                html += `
                        <span class="eo-time-separator">:</span>
                        <div class="eo-time-input-group">
                            <button type="button" class="eo-time-spin" data-action="second-up">
                                <i class="ph ph-caret-up"></i>
                            </button>
                            <input type="text" class="eo-time-input" data-field="seconds"
                                   value="${String(seconds).padStart(2, '0')}"
                                   maxlength="2">
                            <button type="button" class="eo-time-spin" data-action="second-down">
                                <i class="ph ph-caret-down"></i>
                            </button>
                        </div>
                `;
            }

            if (is12Hour) {
                html += `
                        <div class="eo-time-ampm">
                            <button type="button" class="eo-ampm-btn ${!isPM ? 'active' : ''}" data-ampm="am">AM</button>
                            <button type="button" class="eo-ampm-btn ${isPM ? 'active' : ''}" data-ampm="pm">PM</button>
                        </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;

            return html;
        }

        /**
         * Render timezone selector
         */
        renderTimezoneSelector() {
            return `
                <div class="eo-timezone-picker">
                    <div class="eo-timezone-label">Timezone</div>
                    <div class="eo-timezone-select-container" data-field="timezone"></div>
                </div>
            `;
        }

        /**
         * Initialize timezone dropdown
         */
        initTimezoneDropdown(container) {
            const currentTz = this.config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
            const tzContainer = container.querySelector('.eo-timezone-select-container');

            if (tzContainer && typeof EOCustomDropdown !== 'undefined') {
                this.timezoneDropdown = new EOCustomDropdown({
                    options: COMMON_TIMEZONES.map(tz => ({
                        value: tz,
                        label: tz.replace(/_/g, ' ')
                    })),
                    value: currentTz,
                    placeholder: 'Select timezone...',
                    searchable: true,
                    size: 'sm',
                    maxHeight: '200px',
                    onChange: (value) => {
                        this.config.timezone = value;
                        this.updateDisplay();
                    }
                });
                tzContainer.appendChild(this.timezoneDropdown.create());
            }
        }

        /**
         * Render quick action buttons
         */
        renderQuickActions() {
            let html = `
                <div class="eo-datetime-actions">
            `;

            if (this.config.mode !== DATETIME_MODES.TIME) {
                html += `
                    <button type="button" class="eo-datetime-quick" data-action="today">Today</button>
                `;
            }

            if (this.config.mode !== DATETIME_MODES.DATE) {
                html += `
                    <button type="button" class="eo-datetime-quick" data-action="now">Now</button>
                `;
            }

            if (this.config.allowClear) {
                html += `
                    <button type="button" class="eo-datetime-quick eo-clear" data-action="clear">Clear</button>
                `;
            }

            html += `
                </div>
            `;

            return html;
        }

        /**
         * Attach event listeners to dropdown elements
         */
        attachDropdownEvents() {
            if (!this.dropdown) return;

            // Calendar navigation
            this.dropdown.querySelectorAll('.eo-cal-nav').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleCalendarNav(btn.dataset.action);
                });
            });

            // Calendar day selection
            this.dropdown.querySelectorAll('.eo-cal-day').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectDate(btn.dataset.date);
                });
            });

            // Time spin buttons
            this.dropdown.querySelectorAll('.eo-time-spin').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleTimeSpin(btn.dataset.action);
                });
            });

            // Time inputs
            this.dropdown.querySelectorAll('.eo-time-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    this.handleTimeInput(input.dataset.field, input.value);
                });
                input.addEventListener('blur', (e) => {
                    this.handleTimeInput(input.dataset.field, input.value);
                });
            });

            // AM/PM buttons
            this.dropdown.querySelectorAll('.eo-ampm-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleAMPM(btn.dataset.ampm);
                });
            });

            // Timezone select - handled by EOCustomDropdown's onChange callback
            // The initTimezoneDropdown() method sets up the custom dropdown after this

            // Quick actions
            this.dropdown.querySelectorAll('.eo-datetime-quick').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleQuickAction(btn.dataset.action);
                });
            });
        }

        /**
         * Handle calendar navigation
         */
        handleCalendarNav(action) {
            const year = this.currentViewDate.getFullYear();
            const month = this.currentViewDate.getMonth();

            switch (action) {
                case 'prev-year':
                    this.currentViewDate.setFullYear(year - 1);
                    break;
                case 'prev-month':
                    this.currentViewDate.setMonth(month - 1);
                    break;
                case 'next-month':
                    this.currentViewDate.setMonth(month + 1);
                    break;
                case 'next-year':
                    this.currentViewDate.setFullYear(year + 1);
                    break;
            }

            this.updateDropdown();
        }

        /**
         * Select a date from calendar
         */
        selectDate(dateStr) {
            const [year, month, day] = dateStr.split('-').map(Number);

            if (!this.parsedValue) {
                this.parsedValue = {
                    year, month, day,
                    hours: 12,
                    minutes: 0,
                    seconds: 0,
                    milliseconds: 0
                };
            } else {
                this.parsedValue.year = year;
                this.parsedValue.month = month;
                this.parsedValue.day = day;
            }

            this.currentViewDate = new Date(year, month - 1, day);
            this.updateInputDisplay();
            this.updateDropdown();

            // Auto-close for date-only mode
            if (this.config.mode === DATETIME_MODES.DATE) {
                this.commitValue();
                this.close();
                this.onClose(this.getValue());
            }
        }

        /**
         * Handle time spin buttons
         */
        handleTimeSpin(action) {
            if (!this.parsedValue) {
                this.parsedValue = this.getDefaultParsedValue();
            }

            const is12Hour = this.config.timeFormat !== TIME_FORMATS.H24;

            switch (action) {
                case 'hour-up':
                    this.parsedValue.hours = (this.parsedValue.hours + 1) % 24;
                    break;
                case 'hour-down':
                    this.parsedValue.hours = (this.parsedValue.hours - 1 + 24) % 24;
                    break;
                case 'minute-up':
                    this.parsedValue.minutes = (this.parsedValue.minutes + 1) % 60;
                    break;
                case 'minute-down':
                    this.parsedValue.minutes = (this.parsedValue.minutes - 1 + 60) % 60;
                    break;
                case 'second-up':
                    this.parsedValue.seconds = (this.parsedValue.seconds + 1) % 60;
                    break;
                case 'second-down':
                    this.parsedValue.seconds = (this.parsedValue.seconds - 1 + 60) % 60;
                    break;
            }

            this.updateInputDisplay();
            this.updateDropdown();
        }

        /**
         * Handle time input change
         */
        handleTimeInput(field, value) {
            const num = parseInt(value, 10);
            if (isNaN(num)) return;

            if (!this.parsedValue) {
                this.parsedValue = this.getDefaultParsedValue();
            }

            const is12Hour = this.config.timeFormat !== TIME_FORMATS.H24;
            const isPM = this.parsedValue.hours >= 12;

            switch (field) {
                case 'hours':
                    if (is12Hour) {
                        let h = Math.max(1, Math.min(12, num));
                        if (h === 12) h = 0;
                        this.parsedValue.hours = h + (isPM ? 12 : 0);
                    } else {
                        this.parsedValue.hours = Math.max(0, Math.min(23, num));
                    }
                    break;
                case 'minutes':
                    this.parsedValue.minutes = Math.max(0, Math.min(59, num));
                    break;
                case 'seconds':
                    this.parsedValue.seconds = Math.max(0, Math.min(59, num));
                    break;
            }

            this.updateInputDisplay();
        }

        /**
         * Handle AM/PM toggle
         */
        handleAMPM(ampm) {
            if (!this.parsedValue) {
                this.parsedValue = this.getDefaultParsedValue();
            }

            const isPM = ampm === 'pm';
            const currentIsPM = this.parsedValue.hours >= 12;

            if (isPM !== currentIsPM) {
                if (isPM) {
                    this.parsedValue.hours = (this.parsedValue.hours % 12) + 12;
                } else {
                    this.parsedValue.hours = this.parsedValue.hours % 12;
                }
            }

            this.updateInputDisplay();
            this.updateDropdown();
        }

        /**
         * Handle quick action
         */
        handleQuickAction(action) {
            const now = new Date();

            switch (action) {
                case 'today':
                    if (!this.parsedValue) {
                        this.parsedValue = this.getDefaultParsedValue();
                    }
                    this.parsedValue.year = now.getFullYear();
                    this.parsedValue.month = now.getMonth() + 1;
                    this.parsedValue.day = now.getDate();
                    this.currentViewDate = new Date(now);
                    break;

                case 'now':
                    this.parsedValue = {
                        year: now.getFullYear(),
                        month: now.getMonth() + 1,
                        day: now.getDate(),
                        hours: now.getHours(),
                        minutes: now.getMinutes(),
                        seconds: now.getSeconds(),
                        milliseconds: 0
                    };
                    this.currentViewDate = new Date(now);
                    break;

                case 'clear':
                    this.parsedValue = null;
                    this.value = null;
                    this.input.value = '';
                    this.onChange(null);
                    this.updateDropdown();
                    return;
            }

            this.updateInputDisplay();
            this.updateDropdown();
        }

        /**
         * Get default parsed value (current date/time)
         */
        getDefaultParsedValue() {
            const now = new Date();
            return {
                year: now.getFullYear(),
                month: now.getMonth() + 1,
                day: now.getDate(),
                hours: 12,
                minutes: 0,
                seconds: 0,
                milliseconds: 0
            };
        }

        /**
         * Update the input display
         */
        updateInputDisplay() {
            if (this.parsedValue) {
                this.input.value = formatDateTime(this.getValue(), this.config);
            }
        }

        /**
         * Destroy picker
         */
        destroy() {
            this.close();
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
        }

        /**
         * Focus input
         */
        focus() {
            if (this.input) {
                this.input.focus();
                this.input.select();
            }
        }
    }

    // ============================================================================
    // FIELD CONFIGURATION MODAL
    // ============================================================================

    /**
     * Show date field configuration modal
     */
    function showDateFieldConfigModal(currentConfig = {}, onSave) {
        const config = { ...DEFAULT_CONFIG, ...currentConfig };

        const overlay = document.createElement('div');
        overlay.className = 'eo-datetime-config-overlay';
        overlay.innerHTML = `
            <div class="eo-datetime-config-modal">
                <div class="eo-datetime-config-header">
                    <h3>Date/Time Field Settings</h3>
                    <button type="button" class="eo-datetime-config-close">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <div class="eo-datetime-config-body">
                    <div class="eo-config-section">
                        <label class="eo-config-label">Field Type</label>
                        <div class="eo-config-options">
                            <label class="eo-config-option">
                                <input type="radio" name="dateMode" value="${DATETIME_MODES.DATE}"
                                       ${config.mode === DATETIME_MODES.DATE ? 'checked' : ''}>
                                <span><i class="ph ph-calendar"></i> Date only</span>
                            </label>
                            <label class="eo-config-option">
                                <input type="radio" name="dateMode" value="${DATETIME_MODES.DATETIME}"
                                       ${config.mode === DATETIME_MODES.DATETIME ? 'checked' : ''}>
                                <span><i class="ph ph-calendar-plus"></i> Date & Time</span>
                            </label>
                            <label class="eo-config-option">
                                <input type="radio" name="dateMode" value="${DATETIME_MODES.TIME}"
                                       ${config.mode === DATETIME_MODES.TIME ? 'checked' : ''}>
                                <span><i class="ph ph-clock"></i> Time only</span>
                            </label>
                        </div>
                    </div>

                    <div class="eo-config-section" id="dateFormatSection">
                        <label class="eo-config-label">Date Format</label>
                        <div id="dateFormatContainer" class="eo-config-select-container"></div>
                    </div>

                    <div class="eo-config-section" id="timeFormatSection">
                        <label class="eo-config-label">Time Format</label>
                        <div class="eo-config-options">
                            <label class="eo-config-option">
                                <input type="radio" name="timeFormat" value="${TIME_FORMATS.H24}"
                                       ${config.timeFormat === TIME_FORMATS.H24 ? 'checked' : ''}>
                                <span>24-hour (14:30)</span>
                            </label>
                            <label class="eo-config-option">
                                <input type="radio" name="timeFormat" value="${TIME_FORMATS.H12}"
                                       ${config.timeFormat === TIME_FORMATS.H12 ? 'checked' : ''}>
                                <span>12-hour (2:30)</span>
                            </label>
                            <label class="eo-config-option">
                                <input type="radio" name="timeFormat" value="${TIME_FORMATS.H12_AMPM}"
                                       ${config.timeFormat === TIME_FORMATS.H12_AMPM ? 'checked' : ''}>
                                <span>12-hour with AM/PM (2:30 PM)</span>
                            </label>
                        </div>
                    </div>

                    <div class="eo-config-section" id="timeOptionsSection">
                        <label class="eo-config-label">Time Options</label>
                        <label class="eo-config-checkbox">
                            <input type="checkbox" name="includeSeconds" ${config.includeSeconds ? 'checked' : ''}>
                            <span>Include seconds</span>
                        </label>
                    </div>

                    <div class="eo-config-section">
                        <label class="eo-config-label">Timezone</label>
                        <label class="eo-config-checkbox">
                            <input type="checkbox" name="showTimezone" ${config.showTimezone ? 'checked' : ''}>
                            <span>Show timezone</span>
                        </label>
                        <div id="timezoneConfigContainer" class="eo-config-select-container"
                             style="margin-top: 8px; ${config.showTimezone ? '' : 'display: none;'}"></div>
                    </div>
                </div>
                <div class="eo-datetime-config-footer">
                    <button type="button" class="eo-btn eo-btn-secondary" data-action="cancel">Cancel</button>
                    <button type="button" class="eo-btn eo-btn-primary" data-action="save">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Initialize custom dropdowns
        let dateFormatDropdown = null;
        let timezoneConfigDropdown = null;

        const dateFormatContainer = overlay.querySelector('#dateFormatContainer');
        if (dateFormatContainer && typeof EOCustomDropdown !== 'undefined') {
            dateFormatDropdown = new EOCustomDropdown({
                options: [
                    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (European)' },
                    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
                    { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (German)' },
                    { value: 'MMM D, YYYY', label: 'MMM D, YYYY (Jan 1, 2024)' },
                    { value: 'D MMM YYYY', label: 'D MMM YYYY (1 Jan 2024)' }
                ],
                value: config.dateFormat,
                placeholder: 'Select format...'
            });
            dateFormatContainer.appendChild(dateFormatDropdown.create());
        }

        const timezoneConfigContainer = overlay.querySelector('#timezoneConfigContainer');
        if (timezoneConfigContainer && typeof EOCustomDropdown !== 'undefined') {
            timezoneConfigDropdown = new EOCustomDropdown({
                options: [
                    { value: '', label: 'Local timezone' },
                    ...COMMON_TIMEZONES.map(tz => ({
                        value: tz,
                        label: tz.replace(/_/g, ' ')
                    }))
                ],
                value: config.timezone || '',
                placeholder: 'Select timezone...',
                searchable: true
            });
            timezoneConfigContainer.appendChild(timezoneConfigDropdown.create());
        }

        // Update visibility based on mode
        const updateVisibility = () => {
            const mode = overlay.querySelector('input[name="dateMode"]:checked').value;
            const dateSection = overlay.querySelector('#dateFormatSection');
            const timeSection = overlay.querySelector('#timeFormatSection');
            const timeOptions = overlay.querySelector('#timeOptionsSection');

            dateSection.style.display = mode === DATETIME_MODES.TIME ? 'none' : 'block';
            timeSection.style.display = mode === DATETIME_MODES.DATE ? 'none' : 'block';
            timeOptions.style.display = mode === DATETIME_MODES.DATE ? 'none' : 'block';
        };

        // Mode change
        overlay.querySelectorAll('input[name="dateMode"]').forEach(radio => {
            radio.addEventListener('change', updateVisibility);
        });

        // Show/hide timezone select
        overlay.querySelector('input[name="showTimezone"]').addEventListener('change', (e) => {
            const tzContainer = overlay.querySelector('#timezoneConfigContainer');
            if (tzContainer) {
                tzContainer.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Close button
        overlay.querySelector('.eo-datetime-config-close').addEventListener('click', () => {
            if (dateFormatDropdown) dateFormatDropdown.destroy();
            if (timezoneConfigDropdown) timezoneConfigDropdown.destroy();
            overlay.remove();
        });

        // Cancel button
        overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => {
            if (dateFormatDropdown) dateFormatDropdown.destroy();
            if (timezoneConfigDropdown) timezoneConfigDropdown.destroy();
            overlay.remove();
        });

        // Save button
        overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
            const newConfig = {
                mode: overlay.querySelector('input[name="dateMode"]:checked').value,
                dateFormat: dateFormatDropdown ? dateFormatDropdown.getValue() : config.dateFormat,
                timeFormat: overlay.querySelector('input[name="timeFormat"]:checked').value,
                includeSeconds: overlay.querySelector('input[name="includeSeconds"]').checked,
                showTimezone: overlay.querySelector('input[name="showTimezone"]').checked,
                timezone: timezoneConfigDropdown ? (timezoneConfigDropdown.getValue() || null) : config.timezone
            };

            if (onSave) onSave(newConfig);
            if (dateFormatDropdown) dateFormatDropdown.destroy();
            if (timezoneConfigDropdown) timezoneConfigDropdown.destroy();
            overlay.remove();
        });

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (dateFormatDropdown) dateFormatDropdown.destroy();
                if (timezoneConfigDropdown) timezoneConfigDropdown.destroy();
                overlay.remove();
            }
        });

        updateVisibility();
    }

    // ============================================================================
    // INTEGRATION WITH INLINE CELL EDITOR
    // ============================================================================

    /**
     * Create a datetime input element for cell editing
     * Returns { container, picker, getValue, setValue, focus, destroy }
     */
    function createDateTimeEditor(config = {}, onChange, onClose) {
        const picker = new EODateTimePicker({
            ...config,
            onChange,
            onClose
        });

        const container = picker.create();

        return {
            container,
            picker,
            getValue: () => picker.getValue(),
            setValue: (v) => picker.setValue(v),
            focus: () => picker.focus(),
            destroy: () => picker.destroy()
        };
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EODateTimeField = {
        // Constants
        DATETIME_MODES,
        TIME_FORMATS,
        COMMON_TIMEZONES,
        DEFAULT_CONFIG,

        // Parsing & Formatting
        parseDateTime,
        formatDateTime,
        parsedToDate,
        parsedToISO,
        parsedToDateString,
        parsedToTimeString,

        // Components
        EODateTimePicker,
        createDateTimeEditor,
        showDateFieldConfigModal
    };

    global.EODateTimeField = EODateTimeField;

})(typeof window !== 'undefined' ? window : global);
