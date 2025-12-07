/**
 * EO Number Formatter
 * Provides comprehensive number formatting options similar to Google Sheets
 *
 * Supports:
 * - Format types: integer, decimal, percentage, scientific, fraction, currency
 * - Decimal places: 0-10
 * - Rounding modes: round, floor, ceil, truncate
 * - Thousand separators
 * - Negative display: minus, parentheses, red (via CSS class)
 * - Custom prefix/suffix
 * - Min/max validation
 */

(function(global) {
    'use strict';

    /**
     * Default number field configuration
     */
    const DEFAULT_NUMBER_CONFIG = Object.freeze({
        format: 'decimal',        // 'integer' | 'decimal' | 'percentage' | 'scientific' | 'fraction' | 'currency'
        decimalPlaces: 2,         // 0-10
        roundingMode: 'round',    // 'round' | 'floor' | 'ceil' | 'truncate'
        thousandSeparator: true,  // true | false
        negativeDisplay: 'minus', // 'minus' | 'parentheses' | 'red'
        prefix: '',               // e.g., '$', '€'
        suffix: '',               // e.g., 'kg', 'm', '%'
        allowNegative: true,      // true | false
        min: null,                // minimum value (null = no limit)
        max: null,                // maximum value (null = no limit)
        currencyCode: 'USD',      // ISO 4217 currency code
        locale: 'en-US'           // Locale for formatting
    });

    /**
     * Common fraction denominators for fraction display
     */
    const FRACTION_DENOMINATORS = [2, 4, 8, 16, 32, 3, 6, 12, 5, 10, 100];

    /**
     * Get default number configuration
     * @returns {Object} Default config object
     */
    function getDefaultConfig() {
        return { ...DEFAULT_NUMBER_CONFIG };
    }

    /**
     * Merge user config with defaults
     * @param {Object} config - User config
     * @returns {Object} Merged config
     */
    function mergeConfig(config = {}) {
        return { ...DEFAULT_NUMBER_CONFIG, ...config };
    }

    /**
     * Apply rounding based on mode
     * @param {number} value - Number to round
     * @param {number} decimals - Decimal places
     * @param {string} mode - Rounding mode
     * @returns {number} Rounded number
     */
    function applyRounding(value, decimals, mode) {
        const multiplier = Math.pow(10, decimals);
        const shifted = value * multiplier;

        switch (mode) {
            case 'floor':
                return Math.floor(shifted) / multiplier;
            case 'ceil':
                return Math.ceil(shifted) / multiplier;
            case 'truncate':
                return Math.trunc(shifted) / multiplier;
            case 'round':
            default:
                return Math.round(shifted) / multiplier;
        }
    }

    /**
     * Convert decimal to fraction string
     * @param {number} value - Number to convert
     * @param {number} maxDenominator - Maximum denominator to consider
     * @returns {string} Fraction representation
     */
    function toFraction(value, maxDenominator = 100) {
        if (value === 0) return '0';

        const isNegative = value < 0;
        value = Math.abs(value);

        const wholePart = Math.floor(value);
        const decimalPart = value - wholePart;

        if (decimalPart === 0) {
            return isNegative ? `-${wholePart}` : String(wholePart);
        }

        // Find best fraction approximation
        let bestNumerator = 0;
        let bestDenominator = 1;
        let bestError = decimalPart;

        for (const denom of FRACTION_DENOMINATORS) {
            if (denom > maxDenominator) continue;

            const numer = Math.round(decimalPart * denom);
            const error = Math.abs(decimalPart - numer / denom);

            if (error < bestError) {
                bestError = error;
                bestNumerator = numer;
                bestDenominator = denom;
            }

            // Perfect match found
            if (error === 0) break;
        }

        // Simplify fraction
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(bestNumerator, bestDenominator);
        bestNumerator /= divisor;
        bestDenominator /= divisor;

        let result = '';
        if (wholePart > 0) {
            result = `${wholePart} `;
        }

        if (bestNumerator > 0) {
            result += `${bestNumerator}/${bestDenominator}`;
        }

        return isNegative ? `-${result.trim()}` : result.trim();
    }

    /**
     * Format a number according to the configuration
     * @param {number|string} value - Value to format
     * @param {Object} config - Formatting configuration
     * @returns {Object} { formatted: string, cssClass: string, isValid: boolean, error: string|null }
     */
    function formatNumber(value, config = {}) {
        config = mergeConfig(config);

        // Parse the value
        let numValue = parseNumber(value);

        // Handle invalid numbers
        if (numValue === null || isNaN(numValue)) {
            return {
                formatted: '',
                cssClass: '',
                isValid: false,
                error: 'Invalid number',
                rawValue: null
            };
        }

        // Apply min/max constraints
        let constraintError = null;
        if (config.min !== null && numValue < config.min) {
            constraintError = `Value must be at least ${config.min}`;
        }
        if (config.max !== null && numValue > config.max) {
            constraintError = `Value must be at most ${config.max}`;
        }

        // Handle negative values
        if (!config.allowNegative && numValue < 0) {
            constraintError = 'Negative values not allowed';
        }

        const isNegative = numValue < 0;
        const absValue = Math.abs(numValue);

        // Determine decimal places based on format
        let decimalPlaces = config.decimalPlaces;
        if (config.format === 'integer') {
            decimalPlaces = 0;
        } else if (config.format === 'percentage') {
            // Percentage values are multiplied by 100
            numValue = numValue * 100;
        }

        // Apply rounding
        let roundedValue = applyRounding(
            config.format === 'percentage' ? Math.abs(numValue) : absValue,
            decimalPlaces,
            config.roundingMode
        );

        // Format based on type
        let formatted = '';
        let cssClass = 'eo-number';

        switch (config.format) {
            case 'integer':
                formatted = formatWithSeparators(roundedValue, 0, config.thousandSeparator, config.locale);
                break;

            case 'decimal':
                formatted = formatWithSeparators(roundedValue, decimalPlaces, config.thousandSeparator, config.locale);
                break;

            case 'percentage':
                formatted = formatWithSeparators(roundedValue, decimalPlaces, config.thousandSeparator, config.locale);
                formatted += '%';
                cssClass += ' eo-number-percentage';
                break;

            case 'scientific':
                formatted = roundedValue.toExponential(decimalPlaces);
                cssClass += ' eo-number-scientific';
                break;

            case 'fraction':
                formatted = toFraction(isNegative ? -roundedValue : roundedValue);
                cssClass += ' eo-number-fraction';
                // Handle negative for fraction separately
                if (isNegative && !formatted.startsWith('-')) {
                    formatted = '-' + formatted;
                }
                break;

            case 'currency':
                try {
                    formatted = new Intl.NumberFormat(config.locale, {
                        style: 'currency',
                        currency: config.currencyCode,
                        minimumFractionDigits: decimalPlaces,
                        maximumFractionDigits: decimalPlaces
                    }).format(roundedValue);
                } catch (e) {
                    // Fallback if currency code is invalid
                    formatted = config.currencyCode + ' ' + formatWithSeparators(roundedValue, decimalPlaces, config.thousandSeparator, config.locale);
                }
                cssClass += ' eo-number-currency';
                break;

            default:
                formatted = formatWithSeparators(roundedValue, decimalPlaces, config.thousandSeparator, config.locale);
        }

        // Handle negative display (except for fraction which handles it internally)
        if (isNegative && config.format !== 'fraction' && config.format !== 'currency') {
            switch (config.negativeDisplay) {
                case 'parentheses':
                    formatted = `(${formatted})`;
                    cssClass += ' eo-number-negative-parens';
                    break;
                case 'red':
                    formatted = `-${formatted}`;
                    cssClass += ' eo-number-negative-red';
                    break;
                case 'minus':
                default:
                    formatted = `-${formatted}`;
                    cssClass += ' eo-number-negative';
                    break;
            }
        }

        // Add prefix and suffix (if not currency format which has its own symbol)
        if (config.format !== 'currency') {
            if (config.prefix) {
                formatted = config.prefix + formatted;
            }
            if (config.suffix) {
                formatted = formatted + config.suffix;
            }
        }

        return {
            formatted,
            cssClass,
            isValid: constraintError === null,
            error: constraintError,
            rawValue: config.format === 'percentage' ? numValue / 100 : (isNegative ? -roundedValue : roundedValue)
        };
    }

    /**
     * Format number with thousand separators
     * @param {number} value - Number to format
     * @param {number} decimals - Decimal places
     * @param {boolean} useSeparator - Whether to use thousand separator
     * @param {string} locale - Locale for formatting
     * @returns {string} Formatted string
     */
    function formatWithSeparators(value, decimals, useSeparator, locale) {
        if (useSeparator) {
            return new Intl.NumberFormat(locale, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
                useGrouping: true
            }).format(value);
        } else {
            return value.toFixed(decimals);
        }
    }

    /**
     * Parse a value to a number
     * Handles various formats: "1,234.56", "$1,234", "50%", "1 1/2"
     * @param {any} value - Value to parse
     * @returns {number|null} Parsed number or null
     */
    function parseNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        if (typeof value === 'number') {
            return isNaN(value) ? null : value;
        }

        if (typeof value !== 'string') {
            value = String(value);
        }

        value = value.trim();

        // Handle percentage
        const isPercentage = value.endsWith('%');
        if (isPercentage) {
            value = value.slice(0, -1);
        }

        // Handle parentheses for negative
        const hasParens = value.startsWith('(') && value.endsWith(')');
        if (hasParens) {
            value = '-' + value.slice(1, -1);
        }

        // Handle fractions like "1 1/2" or "3/4"
        const fractionMatch = value.match(/^(-?\d*)\s*(\d+)\/(\d+)$/);
        if (fractionMatch) {
            const whole = parseInt(fractionMatch[1]) || 0;
            const numerator = parseInt(fractionMatch[2]);
            const denominator = parseInt(fractionMatch[3]);
            if (denominator !== 0) {
                const fraction = numerator / denominator;
                return whole >= 0 ? whole + fraction : whole - fraction;
            }
        }

        // Remove currency symbols and thousand separators
        value = value.replace(/[^0-9.\-+eE]/g, '');

        const num = parseFloat(value);

        if (isNaN(num)) {
            return null;
        }

        // Convert percentage back
        if (isPercentage) {
            return num / 100;
        }

        return num;
    }

    /**
     * Validate a number against config constraints
     * @param {number} value - Value to validate
     * @param {Object} config - Field configuration
     * @returns {Object} { isValid: boolean, errors: string[] }
     */
    function validateNumber(value, config = {}) {
        config = mergeConfig(config);
        const errors = [];

        const numValue = parseNumber(value);
        if (numValue === null) {
            return { isValid: false, errors: ['Invalid number'] };
        }

        if (!config.allowNegative && numValue < 0) {
            errors.push('Negative values not allowed');
        }

        if (config.min !== null && numValue < config.min) {
            errors.push(`Must be at least ${config.min}`);
        }

        if (config.max !== null && numValue > config.max) {
            errors.push(`Must be at most ${config.max}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get format display name
     * @param {string} format - Format key
     * @returns {string} Display name
     */
    function getFormatDisplayName(format) {
        const names = {
            'integer': 'Integer (1234)',
            'decimal': 'Decimal (1234.56)',
            'percentage': 'Percentage (12.34%)',
            'scientific': 'Scientific (1.23e+3)',
            'fraction': 'Fraction (1 1/2)',
            'currency': 'Currency ($1,234.56)'
        };
        return names[format] || format;
    }

    /**
     * Get rounding mode display name
     * @param {string} mode - Rounding mode key
     * @returns {string} Display name
     */
    function getRoundingDisplayName(mode) {
        const names = {
            'round': 'Round (standard)',
            'floor': 'Floor (round down)',
            'ceil': 'Ceiling (round up)',
            'truncate': 'Truncate (towards zero)'
        };
        return names[mode] || mode;
    }

    /**
     * Get available currency codes
     * @returns {Array} Array of { code, name } objects
     */
    function getAvailableCurrencies() {
        return [
            { code: 'USD', name: 'US Dollar ($)' },
            { code: 'EUR', name: 'Euro (€)' },
            { code: 'GBP', name: 'British Pound (£)' },
            { code: 'JPY', name: 'Japanese Yen (¥)' },
            { code: 'CNY', name: 'Chinese Yuan (¥)' },
            { code: 'INR', name: 'Indian Rupee (₹)' },
            { code: 'CAD', name: 'Canadian Dollar (C$)' },
            { code: 'AUD', name: 'Australian Dollar (A$)' },
            { code: 'CHF', name: 'Swiss Franc (CHF)' },
            { code: 'KRW', name: 'Korean Won (₩)' },
            { code: 'MXN', name: 'Mexican Peso (MX$)' },
            { code: 'BRL', name: 'Brazilian Real (R$)' },
            { code: 'RUB', name: 'Russian Ruble (₽)' },
            { code: 'SEK', name: 'Swedish Krona (kr)' },
            { code: 'NOK', name: 'Norwegian Krone (kr)' },
            { code: 'DKK', name: 'Danish Krone (kr)' },
            { code: 'SGD', name: 'Singapore Dollar (S$)' },
            { code: 'HKD', name: 'Hong Kong Dollar (HK$)' },
            { code: 'NZD', name: 'New Zealand Dollar (NZ$)' },
            { code: 'ZAR', name: 'South African Rand (R)' }
        ];
    }

    /**
     * Preview formatting with sample values
     * @param {Object} config - Field configuration
     * @returns {Array} Array of { value, formatted } objects
     */
    function getFormatPreview(config) {
        const samples = [
            1234.567,
            -1234.567,
            0,
            0.5,
            1000000,
            0.001,
            -0.25
        ];

        return samples.map(value => ({
            value,
            ...formatNumber(value, config)
        }));
    }

    // ============================================================================
    // EXPORT
    // ============================================================================

    const EONumberFormatter = {
        // Configuration
        DEFAULT_CONFIG: DEFAULT_NUMBER_CONFIG,
        getDefaultConfig,
        mergeConfig,

        // Formatting
        formatNumber,
        parseNumber,
        toFraction,
        applyRounding,

        // Validation
        validateNumber,

        // Utilities
        getFormatDisplayName,
        getRoundingDisplayName,
        getAvailableCurrencies,
        getFormatPreview
    };

    global.EONumberFormatter = EONumberFormatter;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EONumberFormatter;
    }

})(typeof window !== 'undefined' ? window : global);
