/**
 * EO ISO Time Display
 *
 * Component for displaying ISO timestamps as formatted date/time for a given timezone.
 * Clickable to show full details including:
 * - Original ISO timestamp
 * - Local time
 * - Selected timezone time
 * - UTC time
 * - Relative time (e.g., "2 hours ago")
 * - Timezone offset information
 */

(function(global) {
    'use strict';

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const COMMON_TIMEZONES = [
        { id: 'UTC', label: 'UTC', offset: '+00:00' },
        { id: 'America/New_York', label: 'Eastern Time', abbr: 'ET' },
        { id: 'America/Chicago', label: 'Central Time', abbr: 'CT' },
        { id: 'America/Denver', label: 'Mountain Time', abbr: 'MT' },
        { id: 'America/Los_Angeles', label: 'Pacific Time', abbr: 'PT' },
        { id: 'America/Anchorage', label: 'Alaska Time', abbr: 'AKT' },
        { id: 'Pacific/Honolulu', label: 'Hawaii Time', abbr: 'HST' },
        { id: 'Europe/London', label: 'London', abbr: 'GMT/BST' },
        { id: 'Europe/Paris', label: 'Paris', abbr: 'CET/CEST' },
        { id: 'Europe/Berlin', label: 'Berlin', abbr: 'CET/CEST' },
        { id: 'Asia/Tokyo', label: 'Tokyo', abbr: 'JST' },
        { id: 'Asia/Shanghai', label: 'Shanghai', abbr: 'CST' },
        { id: 'Asia/Dubai', label: 'Dubai', abbr: 'GST' },
        { id: 'Asia/Kolkata', label: 'India', abbr: 'IST' },
        { id: 'Australia/Sydney', label: 'Sydney', abbr: 'AEST/AEDT' }
    ];

    const DEFAULT_DISPLAY_OPTIONS = {
        timezone: null, // null = local timezone
        dateFormat: 'short', // 'short', 'medium', 'long', 'full', or custom
        timeFormat: 'short', // 'short', 'medium', or custom
        showTimezone: true,
        showRelative: false,
        clickable: true
    };

    // Store for active popover (only one at a time)
    let activePopover = null;
    let activePopoverCleanup = null;

    // ============================================================================
    // PARSING & VALIDATION
    // ============================================================================

    /**
     * Check if a string is a valid ISO 8601 timestamp
     */
    function isISOTimestamp(value) {
        if (!value || typeof value !== 'string') return false;

        // Match ISO 8601 format: YYYY-MM-DDTHH:MM:SS[.sss][Z|+/-HH:MM]
        const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
        if (!isoRegex.test(value)) return false;

        const date = new Date(value);
        return !isNaN(date.getTime());
    }

    /**
     * Parse ISO timestamp and extract components
     */
    function parseISOTimestamp(isoString) {
        if (!isISOTimestamp(isoString)) return null;

        const date = new Date(isoString);
        if (isNaN(date.getTime())) return null;

        // Extract timezone offset from original string
        let originalOffset = null;
        const offsetMatch = isoString.match(/([+-])(\d{2}):?(\d{2})$/);
        if (offsetMatch) {
            const sign = offsetMatch[1] === '+' ? 1 : -1;
            const hours = parseInt(offsetMatch[2], 10);
            const minutes = parseInt(offsetMatch[3], 10);
            originalOffset = sign * (hours * 60 + minutes);
        } else if (isoString.includes('Z')) {
            originalOffset = 0;
        }

        return {
            date,
            isoString,
            timestamp: date.getTime(),
            originalOffset,
            hasTime: isoString.includes('T'),
            hasTimezone: isoString.includes('Z') || offsetMatch !== null
        };
    }

    // ============================================================================
    // TIMEZONE FORMATTING
    // ============================================================================

    /**
     * Format a date in a specific timezone
     */
    function formatInTimezone(date, timezone, options = {}) {
        const {
            dateStyle = 'medium',
            timeStyle = 'short',
            includeTimezone = true
        } = options;

        try {
            const formatOptions = {
                timeZone: timezone || undefined
            };

            // Build format options
            if (dateStyle) {
                if (dateStyle === 'custom' && options.customDateFormat) {
                    // Custom format will be handled separately
                } else {
                    formatOptions.dateStyle = dateStyle;
                }
            }
            if (timeStyle) {
                formatOptions.timeStyle = timeStyle;
            }
            if (includeTimezone && timezone) {
                formatOptions.timeZoneName = 'short';
            }

            return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
        } catch (e) {
            // Fallback for unsupported timezone
            console.warn(`Timezone "${timezone}" not supported, using local time`, e);
            return date.toLocaleString();
        }
    }

    /**
     * Get timezone offset string (e.g., "+05:30", "-08:00")
     */
    function getTimezoneOffset(date, timezone) {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone || undefined,
                timeZoneName: 'longOffset'
            });

            const parts = formatter.formatToParts(date);
            const tzPart = parts.find(p => p.type === 'timeZoneName');

            if (tzPart) {
                // Extract offset from "GMT+05:30" format
                const match = tzPart.value.match(/GMT([+-]\d{2}:?\d{2})/);
                if (match) return match[1];
                if (tzPart.value === 'GMT') return '+00:00';
            }

            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get timezone abbreviation
     */
    function getTimezoneAbbreviation(date, timezone) {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone || undefined,
                timeZoneName: 'short'
            });

            const parts = formatter.formatToParts(date);
            const tzPart = parts.find(p => p.type === 'timeZoneName');

            return tzPart ? tzPart.value : null;
        } catch (e) {
            return null;
        }
    }

    // ============================================================================
    // RELATIVE TIME
    // ============================================================================

    /**
     * Get relative time string (e.g., "2 hours ago", "in 3 days")
     */
    function getRelativeTime(date) {
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffSec = Math.round(diffMs / 1000);
        const diffMin = Math.round(diffSec / 60);
        const diffHour = Math.round(diffMin / 60);
        const diffDay = Math.round(diffHour / 24);
        const diffWeek = Math.round(diffDay / 7);
        const diffMonth = Math.round(diffDay / 30);
        const diffYear = Math.round(diffDay / 365);

        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

        if (Math.abs(diffSec) < 60) {
            return rtf.format(diffSec, 'second');
        } else if (Math.abs(diffMin) < 60) {
            return rtf.format(diffMin, 'minute');
        } else if (Math.abs(diffHour) < 24) {
            return rtf.format(diffHour, 'hour');
        } else if (Math.abs(diffDay) < 7) {
            return rtf.format(diffDay, 'day');
        } else if (Math.abs(diffWeek) < 4) {
            return rtf.format(diffWeek, 'week');
        } else if (Math.abs(diffMonth) < 12) {
            return rtf.format(diffMonth, 'month');
        } else {
            return rtf.format(diffYear, 'year');
        }
    }

    // ============================================================================
    // DISPLAY FORMATTING
    // ============================================================================

    /**
     * Format ISO timestamp for display
     */
    function formatISOForDisplay(isoString, options = {}) {
        const opts = { ...DEFAULT_DISPLAY_OPTIONS, ...options };
        const parsed = parseISOTimestamp(isoString);

        if (!parsed) {
            return { formatted: isoString, isValid: false };
        }

        const { date, hasTime } = parsed;

        // Build format options
        const formatOpts = {
            dateStyle: opts.dateFormat === 'custom' ? undefined : opts.dateFormat,
            timeStyle: hasTime ? (opts.timeFormat === 'custom' ? undefined : opts.timeFormat) : undefined,
            includeTimezone: opts.showTimezone && opts.timezone
        };

        let formatted = formatInTimezone(date, opts.timezone, formatOpts);

        return {
            formatted,
            isValid: true,
            date,
            parsed
        };
    }

    /**
     * Get all time representations for a given ISO timestamp
     */
    function getAllTimeRepresentations(isoString, displayTimezone = null) {
        const parsed = parseISOTimestamp(isoString);
        if (!parsed) return null;

        const { date } = parsed;
        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

        return {
            original: {
                iso: isoString,
                label: 'Original ISO'
            },
            utc: {
                formatted: formatInTimezone(date, 'UTC', { dateStyle: 'medium', timeStyle: 'medium', includeTimezone: true }),
                offset: '+00:00',
                label: 'UTC'
            },
            local: {
                formatted: formatInTimezone(date, localTz, { dateStyle: 'medium', timeStyle: 'medium', includeTimezone: true }),
                timezone: localTz,
                offset: getTimezoneOffset(date, localTz),
                abbr: getTimezoneAbbreviation(date, localTz),
                label: `Local (${localTz})`
            },
            display: displayTimezone && displayTimezone !== localTz ? {
                formatted: formatInTimezone(date, displayTimezone, { dateStyle: 'medium', timeStyle: 'medium', includeTimezone: true }),
                timezone: displayTimezone,
                offset: getTimezoneOffset(date, displayTimezone),
                abbr: getTimezoneAbbreviation(date, displayTimezone),
                label: `Display (${displayTimezone})`
            } : null,
            relative: {
                formatted: getRelativeTime(date),
                label: 'Relative'
            },
            unix: {
                timestamp: date.getTime(),
                seconds: Math.floor(date.getTime() / 1000),
                label: 'Unix Timestamp'
            }
        };
    }

    // ============================================================================
    // POPOVER COMPONENT
    // ============================================================================

    /**
     * Close active popover
     */
    function closeActivePopover() {
        if (activePopover) {
            activePopover.remove();
            activePopover = null;
        }
        if (activePopoverCleanup) {
            activePopoverCleanup();
            activePopoverCleanup = null;
        }
    }

    /**
     * Create and show the details popover
     */
    function showDetailsPopover(isoString, targetElement, displayTimezone = null) {
        // Close any existing popover
        closeActivePopover();

        const representations = getAllTimeRepresentations(isoString, displayTimezone);
        if (!representations) return;

        // Create popover element
        const popover = document.createElement('div');
        popover.className = 'eo-iso-time-popover';

        popover.innerHTML = `
            <div class="eo-iso-time-popover-header">
                <span class="eo-iso-time-popover-title">Time Details</span>
                <button class="eo-iso-time-popover-close" aria-label="Close">&times;</button>
            </div>
            <div class="eo-iso-time-popover-content">
                <div class="eo-iso-time-row eo-iso-time-row-highlight">
                    <span class="eo-iso-time-label">Relative</span>
                    <span class="eo-iso-time-value">${representations.relative.formatted}</span>
                </div>

                <div class="eo-iso-time-section">
                    <div class="eo-iso-time-section-title">Formatted Times</div>

                    <div class="eo-iso-time-row">
                        <span class="eo-iso-time-label">${representations.local.label}</span>
                        <span class="eo-iso-time-value">${representations.local.formatted}</span>
                    </div>

                    ${representations.display ? `
                    <div class="eo-iso-time-row">
                        <span class="eo-iso-time-label">${representations.display.label}</span>
                        <span class="eo-iso-time-value">${representations.display.formatted}</span>
                    </div>
                    ` : ''}

                    <div class="eo-iso-time-row">
                        <span class="eo-iso-time-label">${representations.utc.label}</span>
                        <span class="eo-iso-time-value">${representations.utc.formatted}</span>
                    </div>
                </div>

                <div class="eo-iso-time-section">
                    <div class="eo-iso-time-section-title">Raw Values</div>

                    <div class="eo-iso-time-row eo-iso-time-row-mono">
                        <span class="eo-iso-time-label">ISO 8601</span>
                        <span class="eo-iso-time-value eo-iso-time-copyable" data-copy="${representations.original.iso}" title="Click to copy">
                            ${representations.original.iso}
                            <span class="eo-iso-time-copy-icon">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </span>
                        </span>
                    </div>

                    <div class="eo-iso-time-row eo-iso-time-row-mono">
                        <span class="eo-iso-time-label">Unix (ms)</span>
                        <span class="eo-iso-time-value eo-iso-time-copyable" data-copy="${representations.unix.timestamp}" title="Click to copy">
                            ${representations.unix.timestamp}
                            <span class="eo-iso-time-copy-icon">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </span>
                        </span>
                    </div>

                    <div class="eo-iso-time-row eo-iso-time-row-mono">
                        <span class="eo-iso-time-label">Unix (s)</span>
                        <span class="eo-iso-time-value eo-iso-time-copyable" data-copy="${representations.unix.seconds}" title="Click to copy">
                            ${representations.unix.seconds}
                            <span class="eo-iso-time-copy-icon">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </span>
                        </span>
                    </div>
                </div>

                <div class="eo-iso-time-section">
                    <div class="eo-iso-time-section-title">Timezone Info</div>

                    <div class="eo-iso-time-row">
                        <span class="eo-iso-time-label">Local TZ</span>
                        <span class="eo-iso-time-value">${representations.local.timezone} (${representations.local.offset || 'N/A'})</span>
                    </div>

                    ${representations.display ? `
                    <div class="eo-iso-time-row">
                        <span class="eo-iso-time-label">Display TZ</span>
                        <span class="eo-iso-time-value">${representations.display.timezone} (${representations.display.offset || 'N/A'})</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Position popover near target
        document.body.appendChild(popover);
        activePopover = popover;

        // Position the popover
        positionPopover(popover, targetElement);

        // Add event listeners
        const closeBtn = popover.querySelector('.eo-iso-time-popover-close');
        closeBtn.addEventListener('click', closeActivePopover);

        // Copy functionality
        popover.querySelectorAll('.eo-iso-time-copyable').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const textToCopy = el.dataset.copy;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    // Show copied feedback
                    const originalText = el.innerHTML;
                    el.innerHTML = '<span style="color: #10b981;">Copied!</span>';
                    setTimeout(() => {
                        el.innerHTML = originalText;
                    }, 1000);
                });
            });
        });

        // Close on outside click
        const outsideClickHandler = (e) => {
            if (!popover.contains(e.target) && e.target !== targetElement && !targetElement.contains(e.target)) {
                closeActivePopover();
            }
        };

        // Close on escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeActivePopover();
            }
        };

        document.addEventListener('click', outsideClickHandler);
        document.addEventListener('keydown', escHandler);

        activePopoverCleanup = () => {
            document.removeEventListener('click', outsideClickHandler);
            document.removeEventListener('keydown', escHandler);
        };
    }

    /**
     * Position the popover relative to target element
     */
    function positionPopover(popover, targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();

        let top = targetRect.bottom + 8;
        let left = targetRect.left;

        // Adjust if popover goes off right edge
        if (left + popoverRect.width > window.innerWidth - 16) {
            left = window.innerWidth - popoverRect.width - 16;
        }

        // Adjust if popover goes off left edge
        if (left < 16) {
            left = 16;
        }

        // If popover goes below viewport, show above target
        if (top + popoverRect.height > window.innerHeight - 16) {
            top = targetRect.top - popoverRect.height - 8;
        }

        // If still off screen, just position at top
        if (top < 16) {
            top = 16;
        }

        popover.style.position = 'fixed';
        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    }

    // ============================================================================
    // RENDER COMPONENT
    // ============================================================================

    /**
     * Create an ISO time display element
     */
    function createISOTimeDisplay(isoString, options = {}) {
        const opts = { ...DEFAULT_DISPLAY_OPTIONS, ...options };
        const result = formatISOForDisplay(isoString, opts);

        const container = document.createElement('span');
        container.className = 'eo-iso-time-display';

        if (!result.isValid) {
            container.textContent = isoString;
            container.classList.add('eo-iso-time-invalid');
            return container;
        }

        container.innerHTML = `
            <span class="eo-iso-time-formatted">${result.formatted}</span>
            ${opts.showRelative ? `<span class="eo-iso-time-relative">(${getRelativeTime(result.date)})</span>` : ''}
        `;

        if (opts.clickable) {
            container.classList.add('eo-iso-time-clickable');
            container.setAttribute('role', 'button');
            container.setAttribute('tabindex', '0');
            container.setAttribute('title', 'Click to see time details');

            const showPopover = (e) => {
                e.stopPropagation();
                showDetailsPopover(isoString, container, opts.timezone);
            };

            container.addEventListener('click', showPopover);
            container.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showPopover(e);
                }
            });
        }

        return container;
    }

    /**
     * Format ISO for inline display (returns HTML string)
     */
    function formatISOTimeHTML(isoString, options = {}) {
        const opts = { ...DEFAULT_DISPLAY_OPTIONS, ...options };
        const result = formatISOForDisplay(isoString, opts);

        if (!result.isValid) {
            return `<span class="eo-iso-time-display eo-iso-time-invalid">${escapeHtml(isoString)}</span>`;
        }

        const relativeHtml = opts.showRelative
            ? `<span class="eo-iso-time-relative">(${escapeHtml(getRelativeTime(result.date))})</span>`
            : '';

        const clickableAttrs = opts.clickable
            ? `class="eo-iso-time-display eo-iso-time-clickable" role="button" tabindex="0" title="Click to see time details" data-iso="${escapeHtml(isoString)}" data-timezone="${escapeHtml(opts.timezone || '')}"`
            : `class="eo-iso-time-display"`;

        return `<span ${clickableAttrs}><span class="eo-iso-time-formatted">${escapeHtml(result.formatted)}</span>${relativeHtml}</span>`;
    }

    /**
     * Initialize click handlers for ISO time elements rendered via HTML
     */
    function initializeISOTimeElements(container = document) {
        container.querySelectorAll('.eo-iso-time-clickable[data-iso]').forEach(el => {
            // Skip if already initialized
            if (el.dataset.initialized) return;
            el.dataset.initialized = 'true';

            const isoString = el.dataset.iso;
            const timezone = el.dataset.timezone || null;

            const showPopover = (e) => {
                e.stopPropagation();
                showDetailsPopover(isoString, el, timezone);
            };

            el.addEventListener('click', showPopover);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showPopover(e);
                }
            });
        });
    }

    /**
     * Helper to escape HTML
     */
    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    const EOISOTimeDisplay = {
        // Constants
        COMMON_TIMEZONES,
        DEFAULT_DISPLAY_OPTIONS,

        // Parsing & Validation
        isISOTimestamp,
        parseISOTimestamp,

        // Formatting
        formatISOForDisplay,
        formatInTimezone,
        getRelativeTime,
        getAllTimeRepresentations,
        getTimezoneOffset,
        getTimezoneAbbreviation,

        // Rendering
        createISOTimeDisplay,
        formatISOTimeHTML,
        initializeISOTimeElements,

        // Popover
        showDetailsPopover,
        closeActivePopover
    };

    global.EOISOTimeDisplay = EOISOTimeDisplay;

})(typeof window !== 'undefined' ? window : global);
