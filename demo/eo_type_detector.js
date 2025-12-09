/**
 * EO Type Detector
 * Robust field type detection inspired by @datatables/type-detector
 *
 * Features:
 * - Multi-pass type detection with confidence scoring
 * - Date format detection with locale support
 * - Number/currency pattern recognition
 * - JSON structure detection
 * - Phone, email, URL validation
 * - Type assessment review with suggestions
 *
 * Detection order (from most specific to least):
 * 1. Empty/null values
 * 2. Excel-formatted data
 * 3. Boolean values
 * 4. JSON structures
 * 5. Email addresses
 * 6. URLs
 * 7. Phone numbers
 * 8. Currency values
 * 9. Percentages
 * 10. Numeric sequences (IDs)
 * 11. Numbers (integers/decimals)
 * 12. Dates/times
 * 13. UUIDs
 * 14. Long text
 * 15. Categorical (SELECT)
 * 16. Plain text (fallback)
 */

class EOTypeDetector {
  constructor(options = {}) {
    this.options = {
      decimalCharacter: options.decimalCharacter || '.',
      thousandsSeparator: options.thousandsSeparator || ',',
      locale: options.locale || 'en',
      confidenceThreshold: options.confidenceThreshold || 0.7,
      maxSampleSize: options.maxSampleSize || 1000,
      ...options
    };

    // Date patterns with format strings
    this.datePatterns = this.buildDatePatterns();

    // Localized month/day names
    this.i18n = this.buildI18n();
  }

  /**
   * Build comprehensive date patterns
   */
  buildDatePatterns() {
    return [
      // ISO 8601
      { regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/, format: 'ISO8601', type: 'DATETIME' },
      { regex: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD', type: 'DATE' },
      { regex: /^\d{4}\/\d{2}\/\d{2}$/, format: 'YYYY/MM/DD', type: 'DATE' },

      // US formats
      { regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/, format: 'MM/DD/YYYY', type: 'DATE' },
      { regex: /^\d{1,2}-\d{1,2}-\d{4}$/, format: 'MM-DD-YYYY', type: 'DATE' },
      { regex: /^\d{1,2}\/\d{1,2}\/\d{2}$/, format: 'MM/DD/YY', type: 'DATE' },

      // European formats
      { regex: /^\d{1,2}\.\d{1,2}\.\d{4}$/, format: 'DD.MM.YYYY', type: 'DATE' },
      { regex: /^\d{1,2}\.\d{1,2}\.\d{2}$/, format: 'DD.MM.YY', type: 'DATE' },

      // Written dates
      { regex: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}$/i, format: 'MMM DD, YYYY', type: 'DATE' },
      { regex: /^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}$/i, format: 'DD MMM YYYY', type: 'DATE' },
      { regex: /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2},? \d{4}$/i, format: 'MMMM DD, YYYY', type: 'DATE' },

      // Time formats
      { regex: /^\d{1,2}:\d{2}(:\d{2})?$/, format: 'HH:mm:ss', type: 'TIME' },
      { regex: /^\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM|am|pm)$/, format: 'hh:mm:ss a', type: 'TIME' },

      // Date + Time
      { regex: /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(:\d{2})?(\s?(AM|PM|am|pm))?$/, format: 'MM/DD/YYYY HH:mm', type: 'DATETIME' },
      { regex: /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(:\d{2})?$/, format: 'YYYY-MM-DD HH:mm', type: 'DATETIME' },

      // Unix timestamps (milliseconds)
      { regex: /^1[3-9]\d{11}$/, format: 'UNIX_MS', type: 'DATETIME' },
      // Unix timestamps (seconds)
      { regex: /^1[3-9]\d{8}$/, format: 'UNIX_S', type: 'DATETIME' }
    ];
  }

  /**
   * Build internationalization patterns
   */
  buildI18n() {
    return {
      en: {
        months: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
        monthsShort: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
        days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        daysShort: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        boolTrue: ['true', 'yes', 'y', '1', 'on', 'enabled', 'active'],
        boolFalse: ['false', 'no', 'n', '0', 'off', 'disabled', 'inactive']
      },
      de: {
        months: ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'],
        monthsShort: ['jan', 'feb', 'mär', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'],
        boolTrue: ['wahr', 'ja', 'j', '1'],
        boolFalse: ['falsch', 'nein', 'n', '0']
      },
      fr: {
        months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
        monthsShort: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
        boolTrue: ['vrai', 'oui', 'o', '1'],
        boolFalse: ['faux', 'non', 'n', '0']
      },
      es: {
        months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
        monthsShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
        boolTrue: ['verdadero', 'sí', 's', '1'],
        boolFalse: ['falso', 'no', 'n', '0']
      }
    };
  }

  /**
   * Main entry point: detect type for a column of data
   * @param {Array} values - Array of values from a single column
   * @param {Object} options - Additional options
   * @returns {Object} Type detection result with confidence
   */
  detectColumnType(values, options = {}) {
    const columnName = options.columnName || '';

    // Filter out null/undefined/empty values for analysis
    const nonEmptyValues = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    const emptyCount = values.length - nonEmptyValues.length;
    const emptyRatio = values.length > 0 ? emptyCount / values.length : 0;

    // If all empty, return TEXT
    if (nonEmptyValues.length === 0) {
      return this.createResult('TEXT', 1, { isEmpty: true, emptyRatio: 1 });
    }

    // Sample if too large
    const sampleValues = this.stratifiedSample(nonEmptyValues, this.options.maxSampleSize);

    // Run all type detectors
    const detections = this.runDetectors(sampleValues, columnName);

    // Find the best match
    const bestMatch = this.selectBestType(detections, sampleValues.length);

    // Add metadata
    bestMatch.emptyCount = emptyCount;
    bestMatch.emptyRatio = emptyRatio;
    bestMatch.sampleSize = sampleValues.length;
    bestMatch.totalSize = values.length;
    bestMatch.columnName = columnName;

    // Generate alternative suggestions
    bestMatch.alternatives = this.generateAlternatives(detections, bestMatch.type);

    return bestMatch;
  }

  /**
   * Stratified sampling for large datasets
   */
  stratifiedSample(values, maxSize) {
    if (values.length <= maxSize) return values;

    const thirdSize = Math.floor(maxSize / 3);
    const startSample = values.slice(0, thirdSize);
    const middleStart = Math.floor((values.length - thirdSize) / 2);
    const middleSample = values.slice(middleStart, middleStart + thirdSize);
    const endSample = values.slice(-thirdSize);

    return [...startSample, ...middleSample, ...endSample];
  }

  /**
   * Run all type detectors on the values
   */
  runDetectors(values, columnName) {
    const stringValues = values.map(v => String(v).trim());
    const lowerValues = stringValues.map(v => v.toLowerCase());

    return {
      boolean: this.detectBoolean(lowerValues),
      json: this.detectJson(stringValues),
      email: this.detectEmail(stringValues),
      url: this.detectUrl(stringValues),
      phone: this.detectPhone(stringValues),
      uuid: this.detectUuid(stringValues),
      currency: this.detectCurrency(stringValues),
      percentage: this.detectPercentage(stringValues),
      number: this.detectNumber(stringValues),
      sequence: this.detectSequence(stringValues),
      date: this.detectDate(stringValues),
      time: this.detectTime(stringValues),
      datetime: this.detectDatetime(stringValues),
      longText: this.detectLongText(stringValues),
      select: this.detectSelect(stringValues, values.length),
      multiSelect: this.detectMultiSelect(stringValues),
      idPrefix: this.detectIdPrefix(stringValues),
      columnNameHints: this.detectFromColumnName(columnName)
    };
  }

  /**
   * Detect boolean values
   */
  detectBoolean(lowerValues) {
    const locale = this.i18n[this.options.locale] || this.i18n.en;
    const trueValues = new Set(locale.boolTrue);
    const falseValues = new Set(locale.boolFalse);

    let matches = 0;
    lowerValues.forEach(v => {
      if (trueValues.has(v) || falseValues.has(v)) matches++;
    });

    const confidence = lowerValues.length > 0 ? matches / lowerValues.length : 0;
    return { type: 'CHECKBOX', confidence, matches };
  }

  /**
   * Detect JSON values
   */
  detectJson(values) {
    let matches = 0;
    let hasObjects = false;
    let hasArrays = false;

    values.forEach(v => {
      if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']'))) {
        try {
          const parsed = JSON.parse(v);
          matches++;
          if (typeof parsed === 'object' && parsed !== null) {
            if (Array.isArray(parsed)) hasArrays = true;
            else hasObjects = true;
          }
        } catch (e) {
          // Not valid JSON
        }
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;
    return { type: 'JSON', confidence, matches, hasObjects, hasArrays };
  }

  /**
   * Detect email addresses
   */
  detectEmail(values) {
    // RFC 5322 simplified pattern
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    let matches = 0;
    const domains = new Set();

    values.forEach(v => {
      if (emailRegex.test(v)) {
        matches++;
        const domain = v.split('@')[1];
        if (domain) domains.add(domain.toLowerCase());
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;
    return { type: 'EMAIL', confidence, matches, uniqueDomains: domains.size };
  }

  /**
   * Detect URLs
   */
  detectUrl(values) {
    const urlRegex = /^(https?:\/\/|www\.)[a-zA-Z0-9][-a-zA-Z0-9@:%._+~#=]{0,254}[a-zA-Z0-9]\.[a-z]{2,}(\/[-a-zA-Z0-9@:%_+.~#?&//=]*)?$/i;

    let matches = 0;
    let hasHttps = 0;

    values.forEach(v => {
      if (urlRegex.test(v)) {
        matches++;
        if (v.toLowerCase().startsWith('https://')) hasHttps++;
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;
    return { type: 'URL', confidence, matches, httpsRatio: matches > 0 ? hasHttps / matches : 0 };
  }

  /**
   * Detect phone numbers
   */
  detectPhone(values) {
    // International phone patterns
    const phonePatterns = [
      /^\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/, // US
      /^\+?[1-9]\d{6,14}$/, // International E.164
      /^\+?[0-9]{1,4}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}$/, // General international
      /^\(\d{3}\)\s?\d{3}[-.]?\d{4}$/, // (xxx) xxx-xxxx
    ];

    let matches = 0;
    values.forEach(v => {
      // Remove common formatting
      const cleaned = v.replace(/[\s\-\.\(\)]/g, '');
      // Must have at least 7 digits
      const digits = cleaned.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) {
        if (phonePatterns.some(p => p.test(v))) {
          matches++;
        }
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;
    return { type: 'TEXT', subtype: 'PHONE', confidence, matches };
  }

  /**
   * Detect UUIDs
   */
  detectUuid(values) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    let matches = 0;
    values.forEach(v => {
      if (uuidRegex.test(v)) matches++;
    });

    const confidence = values.length > 0 ? matches / values.length : 0;
    return { type: 'TEXT', subtype: 'UUID', confidence, matches };
  }

  /**
   * Detect currency values
   */
  detectCurrency(values) {
    // Currency symbols and codes
    const currencySymbols = {
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY',
      '₹': 'INR',
      '₽': 'RUB',
      '₩': 'KRW',
      'A$': 'AUD',
      'C$': 'CAD',
      'CHF': 'CHF',
      'kr': 'SEK', // or NOK/DKK
      'R$': 'BRL',
      '₪': 'ILS',
      '₱': 'PHP',
      '฿': 'THB',
      '₫': 'VND',
      'zł': 'PLN'
    };

    // Pattern for currency format (numeric part only - requires explicit currency indicator)
    const currencyNumericPattern = /^-?[0-9]{1,3}(?:[,.\s]?[0-9]{3})*(?:[.,][0-9]{1,2})?$/;

    let matches = 0;
    let detectedCurrency = null;
    let prefixCount = 0;
    let postfixCount = 0;
    let decimalPlaces = new Set();

    values.forEach(v => {
      const trimmed = v.trim();
      let hasPrefix = false;
      let hasPostfix = false;
      let valueWithoutCurrency = trimmed;

      // Check for currency symbol prefix
      for (const [symbol, code] of Object.entries(currencySymbols)) {
        if (trimmed.startsWith(symbol)) {
          detectedCurrency = code;
          prefixCount++;
          hasPrefix = true;
          valueWithoutCurrency = trimmed.slice(symbol.length).trim();
          break;
        }
      }

      // Check for currency code postfix
      const postfixMatch = trimmed.match(/\s?(USD|EUR|GBP|JPY|INR|CHF|CAD|AUD|BRL|CNY|KRW|MXN|SGD|HKD|NZD|SEK|NOK|DKK|ZAR)$/i);
      if (postfixMatch) {
        detectedCurrency = postfixMatch[1].toUpperCase();
        postfixCount++;
        hasPostfix = true;
        valueWithoutCurrency = trimmed.slice(0, -postfixMatch[0].length).trim();
      }

      // IMPORTANT: Only count as currency if it has an explicit currency indicator
      // This prevents plain numbers and dates from being detected as currency
      if (hasPrefix || hasPostfix) {
        // Value has currency indicator - check if numeric part is valid
        if (currencyNumericPattern.test(valueWithoutCurrency) || this.looksLikeCurrency(valueWithoutCurrency)) {
          matches++;

          // Detect decimal places
          const decMatch = valueWithoutCurrency.match(/[.,](\d+)$/);
          if (decMatch) {
            decimalPlaces.add(decMatch[1].length);
          }
        }
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;

    return {
      type: 'CURRENCY',
      confidence,
      matches,
      currency: detectedCurrency,
      prefixCount,
      postfixCount,
      decimalPlaces: [...decimalPlaces]
    };
  }

  /**
   * Helper: check if value looks like currency (numeric portion after symbol/code removed)
   */
  looksLikeCurrency(value) {
    // Reject values that look like dates (contain / or multiple . or -)
    // Date patterns: 01/02/2024, 01.02.2024, 2024-01-02
    if (/^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}$/.test(value)) {
      return false;
    }
    // European date format: 01.02.2024 (has two dots)
    if ((value.match(/\./g) || []).length >= 2) {
      return false;
    }

    // Remove currency symbols and check if numeric
    const cleaned = value.replace(/[\$€£¥₹₽₩₪₱฿₫\s]/g, '');
    const numericPart = cleaned.replace(/[,.\s]/g, '');

    return /^-?\d+$/.test(numericPart) && cleaned.length > 0;
  }

  /**
   * Detect percentage values
   */
  detectPercentage(values) {
    const percentPattern = /^-?\d+([.,]\d+)?%$/;

    let matches = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;

    values.forEach(v => {
      if (percentPattern.test(v.trim())) {
        matches++;
        const numVal = parseFloat(v.replace('%', '').replace(',', '.'));
        if (!isNaN(numVal)) {
          minValue = Math.min(minValue, numVal);
          maxValue = Math.max(maxValue, numVal);
        }
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;
    return {
      type: 'NUMBER',
      subtype: 'PERCENTAGE',
      confidence,
      matches,
      range: matches > 0 ? { min: minValue, max: maxValue } : null
    };
  }

  /**
   * Detect numeric values
   */
  detectNumber(values) {
    const ds = this.options.decimalCharacter;
    const ts = this.options.thousandsSeparator;

    let matches = 0;
    let integerCount = 0;
    let decimalCount = 0;
    let negativeCount = 0;
    let maxDecimalPlaces = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;

    values.forEach(v => {
      const trimmed = v.trim();

      // Remove thousands separators
      let cleaned = trimmed.replace(new RegExp('\\' + ts, 'g'), '');

      // Check for negative
      const isNegative = cleaned.startsWith('-') || cleaned.startsWith('(') && cleaned.endsWith(')');
      if (isNegative) negativeCount++;

      // Remove negative indicators
      cleaned = cleaned.replace(/^-|\(|\)$/g, '');

      // Check decimal pattern
      const decimalPattern = new RegExp(`^\\d+\\${ds}\\d+$`);
      const integerPattern = /^\d+$/;

      if (integerPattern.test(cleaned)) {
        matches++;
        integerCount++;
        const num = parseFloat(cleaned);
        minValue = Math.min(minValue, isNegative ? -num : num);
        maxValue = Math.max(maxValue, isNegative ? -num : num);
      } else if (decimalPattern.test(cleaned)) {
        matches++;
        decimalCount++;
        const decPlaces = cleaned.split(ds)[1].length;
        maxDecimalPlaces = Math.max(maxDecimalPlaces, decPlaces);
        const num = parseFloat(cleaned.replace(ds, '.'));
        minValue = Math.min(minValue, isNegative ? -num : num);
        maxValue = Math.max(maxValue, isNegative ? -num : num);
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;

    return {
      type: 'NUMBER',
      confidence,
      matches,
      integerCount,
      decimalCount,
      negativeCount,
      maxDecimalPlaces,
      range: matches > 0 ? { min: minValue, max: maxValue } : null,
      isInteger: decimalCount === 0 && matches > 0
    };
  }

  /**
   * Detect numeric sequences (IDs without prefixes)
   */
  detectSequence(values) {
    let matches = 0;
    let isIncrementing = true;
    let prevNum = -Infinity;

    const numbers = [];
    values.forEach(v => {
      const trimmed = v.trim();
      if (/^\d+$/.test(trimmed)) {
        matches++;
        const num = parseInt(trimmed, 10);
        numbers.push(num);
        if (num <= prevNum) isIncrementing = false;
        prevNum = num;
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;

    // Check for sequential pattern
    const isSequential = isIncrementing && matches > 2;

    return {
      type: 'NUMBER',
      subtype: 'SEQUENCE',
      confidence,
      matches,
      isSequential,
      isIncrementing
    };
  }

  /**
   * Detect date values
   */
  detectDate(values) {
    let matches = 0;
    let detectedFormat = null;
    const formatCounts = {};

    values.forEach(v => {
      const trimmed = v.trim();

      for (const pattern of this.datePatterns) {
        if (pattern.type === 'DATE' && pattern.regex.test(trimmed)) {
          matches++;
          formatCounts[pattern.format] = (formatCounts[pattern.format] || 0) + 1;
          break;
        }
      }

      // Also try parsing with Date
      if (!Object.keys(formatCounts).length) {
        const parsed = Date.parse(trimmed);
        if (!isNaN(parsed)) {
          // Validate it's a reasonable date (not just a number)
          if (!/^\d+$/.test(trimmed) && trimmed.length > 4) {
            matches++;
            formatCounts['PARSED'] = (formatCounts['PARSED'] || 0) + 1;
          }
        }
      }
    });

    // Find most common format
    let maxCount = 0;
    for (const [format, count] of Object.entries(formatCounts)) {
      if (count > maxCount) {
        maxCount = count;
        detectedFormat = format;
      }
    }

    const confidence = values.length > 0 ? matches / values.length : 0;

    return {
      type: 'DATE',
      confidence,
      matches,
      format: detectedFormat,
      formatCounts
    };
  }

  /**
   * Detect time values
   */
  detectTime(values) {
    let matches = 0;
    let has24Hour = 0;
    let has12Hour = 0;

    values.forEach(v => {
      const trimmed = v.trim();

      for (const pattern of this.datePatterns) {
        if (pattern.type === 'TIME' && pattern.regex.test(trimmed)) {
          matches++;
          if (/AM|PM/i.test(trimmed)) has12Hour++;
          else has24Hour++;
          break;
        }
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;

    return {
      type: 'TIME',
      confidence,
      matches,
      timeFormat: has12Hour > has24Hour ? '12h' : '24h'
    };
  }

  /**
   * Detect datetime values
   */
  detectDatetime(values) {
    let matches = 0;
    let detectedFormat = null;

    values.forEach(v => {
      const trimmed = v.trim();

      for (const pattern of this.datePatterns) {
        if (pattern.type === 'DATETIME' && pattern.regex.test(trimmed)) {
          matches++;
          detectedFormat = pattern.format;
          break;
        }
      }
    });

    const confidence = values.length > 0 ? matches / values.length : 0;

    return {
      type: 'DATETIME',
      confidence,
      matches,
      format: detectedFormat
    };
  }

  /**
   * Detect long text
   */
  detectLongText(values) {
    let longCount = 0;
    let maxLength = 0;
    let avgLength = 0;
    let totalLength = 0;
    let multiLineCount = 0;

    values.forEach(v => {
      const len = v.length;
      totalLength += len;
      maxLength = Math.max(maxLength, len);
      if (len > 200) longCount++;
      if (v.includes('\n')) multiLineCount++;
    });

    avgLength = values.length > 0 ? totalLength / values.length : 0;
    const longRatio = values.length > 0 ? longCount / values.length : 0;

    // Consider long text if avg > 100 or max > 200 or has multiline
    const isLongText = avgLength > 100 || maxLength > 200 || multiLineCount > 0;

    return {
      type: 'LONG_TEXT',
      confidence: isLongText ? Math.max(longRatio, 0.5) : longRatio,
      matches: longCount,
      maxLength,
      avgLength,
      multiLineCount
    };
  }

  /**
   * Detect categorical (SELECT) values
   */
  detectSelect(values, totalCount) {
    const uniqueValues = new Set(values);
    const uniqueCount = uniqueValues.size;
    const uniqueRatio = totalCount > 0 ? uniqueCount / totalCount : 0;

    // SELECT criteria:
    // - Few unique values (<=20)
    // - Low cardinality ratio (<10%)
    // - Values repeat frequently

    const isSelect = uniqueCount <= 20 && uniqueRatio < 0.1 && uniqueCount > 1;
    const isSingleValue = uniqueCount === 1;

    return {
      type: 'SELECT',
      confidence: isSelect ? 1 - uniqueRatio : 0,
      matches: isSelect ? values.length : 0,
      uniqueCount,
      uniqueRatio,
      options: isSelect ? [...uniqueValues].slice(0, 50) : [],
      isSingleValue
    };
  }

  /**
   * Detect multi-select values (comma-separated lists)
   */
  detectMultiSelect(values) {
    let matches = 0;
    let hasDelimiters = 0;
    const allOptions = new Set();

    values.forEach(v => {
      // Check for comma-separated or semicolon-separated values
      if (v.includes(',') || v.includes(';')) {
        const parts = v.split(/[,;]/).map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          hasDelimiters++;
          parts.forEach(p => allOptions.add(p));
        }
      }
    });

    // Consider multi-select if many values have delimiters
    const delimiterRatio = values.length > 0 ? hasDelimiters / values.length : 0;
    const isMultiSelect = delimiterRatio > 0.3 && allOptions.size <= 50;

    return {
      type: 'MULTI_SELECT',
      confidence: isMultiSelect ? delimiterRatio : 0,
      matches: hasDelimiters,
      options: isMultiSelect ? [...allOptions] : [],
      delimiterRatio
    };
  }

  /**
   * Detect ID prefix patterns (e.g., ORD-123, USR_456)
   */
  detectIdPrefix(values) {
    const prefixPattern = /^([A-Z]{2,5})[-_](\d+)$/i;

    let matches = 0;
    const prefixes = {};

    values.forEach(v => {
      const match = v.trim().match(prefixPattern);
      if (match) {
        matches++;
        const prefix = match[1].toUpperCase();
        prefixes[prefix] = (prefixes[prefix] || 0) + 1;
      }
    });

    // Find most common prefix
    let dominantPrefix = null;
    let maxPrefixCount = 0;
    for (const [prefix, count] of Object.entries(prefixes)) {
      if (count > maxPrefixCount) {
        maxPrefixCount = count;
        dominantPrefix = prefix;
      }
    }

    const confidence = values.length > 0 ? matches / values.length : 0;

    return {
      type: 'TEXT',
      subtype: 'ID_PREFIX',
      confidence,
      matches,
      prefix: dominantPrefix,
      prefixes
    };
  }

  /**
   * Detect type hints from column name
   */
  detectFromColumnName(columnName) {
    if (!columnName) return { hints: [] };

    const name = columnName.toLowerCase();
    const hints = [];

    // Date hints
    if (/date|created|updated|modified|born|started|ended|expired|due/i.test(name)) {
      hints.push({ type: 'DATE', confidence: 0.6, reason: 'column name suggests date' });
    }
    if (/time|timestamp|at$/i.test(name)) {
      hints.push({ type: 'DATETIME', confidence: 0.6, reason: 'column name suggests datetime' });
    }

    // Boolean hints
    if (/^is_|^has_|^can_|^should_|^was_|active|enabled|disabled|flag|verified|confirmed/i.test(name)) {
      hints.push({ type: 'CHECKBOX', confidence: 0.7, reason: 'column name suggests boolean' });
    }

    // Email hints
    if (/email|e-mail|mail$/i.test(name)) {
      hints.push({ type: 'EMAIL', confidence: 0.8, reason: 'column name suggests email' });
    }

    // URL hints
    if (/url|link|website|homepage|href/i.test(name)) {
      hints.push({ type: 'URL', confidence: 0.8, reason: 'column name suggests URL' });
    }

    // Phone hints
    if (/phone|tel|mobile|cell|fax/i.test(name)) {
      hints.push({ type: 'TEXT', subtype: 'PHONE', confidence: 0.7, reason: 'column name suggests phone' });
    }

    // Currency hints
    if (/price|cost|amount|total|subtotal|fee|rate|salary|income|revenue|balance|payment/i.test(name)) {
      hints.push({ type: 'CURRENCY', confidence: 0.6, reason: 'column name suggests currency' });
    }

    // Number hints
    if (/count|quantity|qty|num|number|age|score|rating|rank|level|size|weight|height|width|length/i.test(name)) {
      hints.push({ type: 'NUMBER', confidence: 0.5, reason: 'column name suggests number' });
    }

    // ID hints
    if (/^id$|_id$|_key$|_code$/i.test(name)) {
      hints.push({ type: 'TEXT', subtype: 'ID', confidence: 0.5, reason: 'column name suggests ID' });
    }

    // Select/category hints
    if (/status|state|type|category|level|tier|priority|gender|country|region|department/i.test(name)) {
      hints.push({ type: 'SELECT', confidence: 0.4, reason: 'column name suggests category' });
    }

    // Description/notes = long text
    if (/description|desc|notes|comment|remarks|bio|about|summary|content|body|message/i.test(name)) {
      hints.push({ type: 'LONG_TEXT', confidence: 0.5, reason: 'column name suggests long text' });
    }

    // JSON hints
    if (/json|data|metadata|config|settings|options|properties|attributes|payload/i.test(name)) {
      hints.push({ type: 'JSON', confidence: 0.4, reason: 'column name suggests JSON' });
    }

    return { hints };
  }

  /**
   * Select the best type based on all detections
   */
  selectBestType(detections, sampleSize) {
    const candidates = [];
    const threshold = this.options.confidenceThreshold;

    // Order of precedence (most specific first)
    const precedence = [
      'boolean',    // CHECKBOX
      'json',       // JSON
      'email',      // EMAIL
      'url',        // URL
      'uuid',       // TEXT (UUID)
      'currency',   // CURRENCY
      'percentage', // NUMBER (percentage)
      'datetime',   // DATETIME
      'date',       // DATE
      'time',       // TIME
      'idPrefix',   // TEXT (ID prefix)
      'sequence',   // NUMBER (sequence)
      'number',     // NUMBER
      'multiSelect',// MULTI_SELECT
      'select',     // SELECT
      'longText',   // LONG_TEXT
    ];

    // Collect candidates above threshold
    for (const key of precedence) {
      const detection = detections[key];
      if (detection && detection.confidence >= threshold) {
        candidates.push({
          key,
          ...detection,
          priority: precedence.indexOf(key)
        });
      }
    }

    // Apply column name hints as bonus
    const nameHints = detections.columnNameHints.hints || [];
    for (const hint of nameHints) {
      for (const candidate of candidates) {
        if (candidate.type === hint.type) {
          candidate.confidence = Math.min(1, candidate.confidence + hint.confidence * 0.2);
          candidate.nameHintApplied = true;
        }
      }
    }

    // Sort by priority (lower = more specific), then by confidence
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.confidence - a.confidence;
    });

    // Return best match or TEXT as fallback
    if (candidates.length > 0) {
      return this.createResult(
        candidates[0].type,
        candidates[0].confidence,
        candidates[0]
      );
    }

    // Check phone detection (lower threshold)
    if (detections.phone.confidence > 0.5) {
      return this.createResult('TEXT', detections.phone.confidence, {
        subtype: 'PHONE',
        ...detections.phone
      });
    }

    // Default to TEXT
    return this.createResult('TEXT', 1, { reason: 'no specific type detected' });
  }

  /**
   * Create a standardized result object
   */
  createResult(type, confidence, details = {}) {
    return {
      type,
      confidence,
      subtype: details.subtype || null,
      format: details.format || null,
      matches: details.matches || 0,
      ...details
    };
  }

  /**
   * Generate alternative type suggestions
   */
  generateAlternatives(detections, selectedType) {
    const alternatives = [];
    const threshold = 0.3; // Lower threshold for alternatives

    const typeMap = {
      boolean: 'CHECKBOX',
      json: 'JSON',
      email: 'EMAIL',
      url: 'URL',
      currency: 'CURRENCY',
      percentage: 'NUMBER',
      datetime: 'DATETIME',
      date: 'DATE',
      time: 'TIME',
      number: 'NUMBER',
      select: 'SELECT',
      multiSelect: 'MULTI_SELECT',
      longText: 'LONG_TEXT'
    };

    for (const [key, detection] of Object.entries(detections)) {
      if (typeMap[key] && detection.confidence >= threshold && typeMap[key] !== selectedType) {
        alternatives.push({
          type: typeMap[key],
          confidence: detection.confidence,
          reason: this.getTypeReason(key, detection)
        });
      }
    }

    // Add column name hints as alternatives
    for (const hint of (detections.columnNameHints.hints || [])) {
      if (hint.type !== selectedType) {
        alternatives.push({
          type: hint.type,
          confidence: hint.confidence,
          reason: hint.reason
        });
      }
    }

    // Sort by confidence and take top 3
    return alternatives
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  /**
   * Get human-readable reason for type detection
   */
  getTypeReason(key, detection) {
    const reasons = {
      boolean: `${detection.matches} values match boolean patterns`,
      json: `${detection.matches} valid JSON objects/arrays detected`,
      email: `${detection.matches} valid email addresses detected`,
      url: `${detection.matches} valid URLs detected`,
      currency: `${detection.matches} currency values detected${detection.currency ? ` (${detection.currency})` : ''}`,
      percentage: `${detection.matches} percentage values detected`,
      datetime: `${detection.matches} datetime values detected (${detection.format || 'various formats'})`,
      date: `${detection.matches} date values detected (${detection.format || 'various formats'})`,
      time: `${detection.matches} time values detected`,
      number: `${detection.matches} numeric values detected`,
      select: `${detection.uniqueCount} unique values with low cardinality`,
      multiSelect: `${detection.matches} multi-value entries detected`,
      longText: `avg length ${Math.round(detection.avgLength || 0)} chars, max ${detection.maxLength || 0}`
    };

    return reasons[key] || 'pattern detected';
  }

  /**
   * Analyze all columns in a dataset
   * @param {Array} rows - Array of row objects
   * @param {Array} headers - Array of column names
   * @returns {Object} Analysis results for all columns
   */
  analyzeDataset(rows, headers) {
    const results = {};

    headers.forEach(header => {
      const values = rows.map(row => row[header]);
      results[header] = this.detectColumnType(values, { columnName: header });
    });

    return results;
  }

  /**
   * Create a type assessment review object
   * @param {Object} detectionResults - Results from analyzeDataset
   * @returns {Object} Assessment review with suggestions
   */
  createTypeAssessment(detectionResults) {
    const assessment = {
      fields: {},
      summary: {
        totalFields: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        needsReview: []
      }
    };

    for (const [fieldName, result] of Object.entries(detectionResults)) {
      assessment.summary.totalFields++;

      const fieldAssessment = {
        detectedType: result.type,
        detectedSubtype: result.subtype,
        confidence: result.confidence,
        confidenceLevel: this.getConfidenceLevel(result.confidence),
        format: result.format,
        alternatives: result.alternatives || [],
        samples: result.samples || [],
        stats: {
          emptyRatio: result.emptyRatio,
          sampleSize: result.sampleSize,
          matches: result.matches
        },
        needsReview: result.confidence < 0.8 || (result.alternatives || []).length > 0,
        suggestedConfig: this.suggestFieldConfig(result)
      };

      assessment.fields[fieldName] = fieldAssessment;

      // Update summary
      if (result.confidence >= 0.9) assessment.summary.highConfidence++;
      else if (result.confidence >= 0.7) assessment.summary.mediumConfidence++;
      else assessment.summary.lowConfidence++;

      if (fieldAssessment.needsReview) {
        assessment.summary.needsReview.push(fieldName);
      }
    }

    return assessment;
  }

  /**
   * Get confidence level label
   */
  getConfidenceLevel(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    if (confidence >= 0.5) return 'low';
    return 'uncertain';
  }

  /**
   * Suggest field configuration based on detection
   */
  suggestFieldConfig(result) {
    const config = {
      type: result.type
    };

    switch (result.type) {
      case 'NUMBER':
        config.decimalPlaces = result.maxDecimalPlaces || 0;
        config.allowNegative = (result.negativeCount || 0) > 0;
        if (result.subtype === 'PERCENTAGE') {
          config.format = 'percentage';
        }
        break;

      case 'CURRENCY':
        config.currency = result.currency || 'USD';
        config.decimalPlaces = result.decimalPlaces?.[0] || 2;
        config.showSymbol = true;
        break;

      case 'DATE':
      case 'DATETIME':
      case 'TIME':
        config.format = result.format;
        break;

      case 'SELECT':
        config.options = result.options || [];
        break;

      case 'MULTI_SELECT':
        config.options = result.options || [];
        config.delimiter = ',';
        break;

      case 'JSON':
        config.subtype = result.hasArrays ? 'RENDER' : 'DISPLAY';
        break;

      case 'LONG_TEXT':
        config.subtype = 'RICH_TEXT';
        break;
    }

    return config;
  }
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOTypeDetector;
} else if (typeof window !== 'undefined') {
  window.EOTypeDetector = EOTypeDetector;
}
