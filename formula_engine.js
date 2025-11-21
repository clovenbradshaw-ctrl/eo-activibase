/**
 * Formula Language Engine
 * Complete implementation of spreadsheet-style formulas in JavaScript
 * 
 * Usage:
 *   const engine = new FormulaEngine();
 *   engine.setField('Price', 10);
 *   engine.setField('Quantity', 5);
 *   const result = engine.evaluate('Price * Quantity'); // Returns 50
 */

class FormulaEngine {
  constructor() {
    this.fields = {};
    this.functions = this.initializeFunctions();
    this.fieldReferenceCache = new Map();
  }

  /**
   * Set a field value for formula evaluation
   */
  setField(name, value) {
    this.fields[name] = value;
  }

  /**
   * Set multiple fields at once
   */
  setFields(fieldsObject) {
    Object.assign(this.fields, fieldsObject);
  }

  /**
   * Get a field value
   */
  getField(name) {
    return this.fields[name];
  }

  /**
   * Evaluate a formula string
   */
  evaluate(formula) {
    try {
      // Replace field references {Field Name} with their values
      let processed = this.replaceFieldReferences(formula);

      // Replace formula functions with JavaScript equivalents
      processed = this.replaceFunctionCalls(processed);

      // Replace operators
      processed = this.replaceOperators(processed);

      // Evaluate using Function constructor (safer than eval)
      const result = this.executeFormula(processed);
      return result;
    } catch (error) {
      throw new Error(`Formula evaluation error: ${error.message}`);
    }
  }

  /**
   * Replace field references like {Field Name} or FieldName with their values
   */
  replaceFieldReferences(formula) {
    const references = this.getFieldReferences(formula);
    let result = formula;

    // Replace {Field Name} style references
    references.braced.forEach((fieldName) => {
      const escapedName = this.escapeRegExp(fieldName);
      const pattern = new RegExp(`\\{${escapedName}\\}`, 'g');
      const value = this.serializeValue(this.fields[fieldName]);
      result = result.replace(pattern, value);
    });

    // Replace single-word field references (without braces)
    references.bare.forEach((fieldName) => {
      if (!this.fields.hasOwnProperty(fieldName)) {
        return;
      }
      const escapedName = this.escapeRegExp(fieldName);
      const pattern = new RegExp(`\\b${escapedName}\\b`, 'g');
      const value = this.serializeValue(this.fields[fieldName]);
      result = result.replace(pattern, value);
    });

    return result;
  }

  /**
   * Serialize a value for insertion into formula
   */
  serializeValue(value) {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return JSON.stringify(value);
    }
    if (value instanceof Date) {
      return `new Date("${value.toISOString()}")`;
    }
    if (Array.isArray(value)) {
      return `[${value.map(v => this.serializeValue(v)).join(',')}]`;
    }
    return String(value);
  }

  /**
   * Replace function calls with JavaScript function calls
   */
  replaceFunctionCalls(formula) {
    // This is a simplified approach - a full parser would be better
    return formula;
  }

  /**
   * Replace custom operators with JavaScript equivalents
   */
  replaceOperators(formula) {
    // Replace & concatenation operator with +
    // But be careful not to replace && (logical AND)
    let result = formula.replace(/([^&])&([^&])/g, '$1+$2');
    
    // Replace = with === for comparison (but not in ===, !==, <=, >=)
    result = result.replace(/([^=!<>])=([^=])/g, '$1==$2');
    
    // Replace != with !==
    result = result.replace(/!=/g, '!==');
    
    return result;
  }

  /**
   * Execute the processed formula
   */
  executeFormula(processedFormula) {
    // Create a function that has access to all formula functions
    const functionNames = Object.keys(this.functions);
    const functionValues = Object.values(this.functions);

    // Shadow global objects to keep execution isolated
    const sandboxGlobals = [
      'window',
      'global',
      'globalThis',
      'document',
      'process',
      'Function'
    ];
    const shadowDeclarations = sandboxGlobals
      .map(name => `const ${name} = undefined;`)
      .join(' ');

    const executor = new Function(
      ...functionNames,
      `"use strict"; ${shadowDeclarations} return (${processedFormula});`
    );

    return executor(...functionValues);
  }

  /**
   * Parse and cache field references for reuse
   */
  getFieldReferences(formula) {
    if (this.fieldReferenceCache.has(formula)) {
      return this.fieldReferenceCache.get(formula);
    }

    const braced = new Set();
    const bare = new Set();

    // Braced references
    const bracedMatches = formula.match(/\{([^}]+)\}/g) || [];
    bracedMatches.forEach(match => {
      const name = match.slice(1, -1);
      braced.add(name);
    });

    // Bare references while excluding functions/keywords
    const keywords = ['true', 'false', 'null', 'undefined', 'return', 'if', 'else', 'for', 'while'];
    const fieldPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let bareMatch;
    while ((bareMatch = fieldPattern.exec(formula)) !== null) {
      const candidate = bareMatch[1];
      if (this.functions[candidate]) {
        continue;
      }
      if (keywords.includes(candidate.toLowerCase())) {
        continue;
      }
      if (braced.has(candidate)) {
        continue;
      }
      bare.add(candidate);
    }

    const parsed = { braced: Array.from(braced), bare: Array.from(bare) };
    this.fieldReferenceCache.set(formula, parsed);
    return parsed;
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Initialize all formula functions
   */
  initializeFunctions() {
    return {
      // TEXT FUNCTIONS
      ARRAYJOIN: (array, separator) => {
        if (!Array.isArray(array)) return '';
        return array.map(item => String(item ?? '')).join(separator);
      },

      CONCATENATE: (...args) => {
        return args.map(arg => String(arg ?? '')).join('');
      },

      ENCODE_URL_COMPONENT: (str) => {
        return encodeURIComponent(str);
      },

      FIND: (stringToFind, whereToSearch, startFromPosition = 0) => {
        const str = String(whereToSearch);
        const search = String(stringToFind);
        const index = str.indexOf(search, startFromPosition);
        return index === -1 ? 0 : index;
      },

      LEFT: (str, howMany) => {
        return String(str).substring(0, howMany);
      },

      LEN: (str) => {
        return String(str).length;
      },

      LOWER: (str) => {
        return String(str).toLowerCase();
      },

      MID: (str, whereToStart, count) => {
        return String(str).substring(whereToStart - 1, whereToStart - 1 + count);
      },

      REPLACE: (str, whereToStart, count, replacement) => {
        const s = String(str);
        const start = whereToStart - 1;
        return s.substring(0, start) + replacement + s.substring(start + count);
      },

      REPT: (str, number) => {
        return String(str).repeat(number);
      },

      RIGHT: (str, howMany) => {
        const s = String(str);
        return s.substring(s.length - howMany);
      },

      SEARCH: (stringToFind, whereToSearch, startFromPosition = 0) => {
        const str = String(whereToSearch);
        const search = String(stringToFind);
        const index = str.indexOf(search, startFromPosition);
        return index === -1 ? '' : index;
      },

      SUBSTITUTE: (str, oldText, newText, index) => {
        const s = String(str);
        const old = String(oldText);
        const replacement = String(newText);
        
        if (index === undefined) {
          return s.split(old).join(replacement);
        }
        
        let count = 0;
        let pos = 0;
        while ((pos = s.indexOf(old, pos)) !== -1) {
          count++;
          if (count === index) {
            return s.substring(0, pos) + replacement + s.substring(pos + old.length);
          }
          pos += old.length;
        }
        return s;
      },

      T: (value) => {
        return typeof value === 'string' ? value : '';
      },

      TRIM: (str) => {
        return String(str).trim();
      },

      UPPER: (str) => {
        return String(str).toUpperCase();
      },

      // LOGICAL FUNCTIONS
      AND: (...args) => {
        return args.every(arg => Boolean(arg));
      },

      BLANK: () => {
        return null;
      },

      ERROR: () => {
        throw new Error('ERROR()');
      },

      FALSE: () => {
        return false;
      },

      IF: (expression, value1, value2) => {
        return expression ? value1 : value2;
      },

      ISERROR: (expression) => {
        try {
          if (typeof expression === 'function') {
            expression();
          }
          return false;
        } catch (e) {
          return true;
        }
      },

      NOT: (logical) => {
        return !Boolean(logical);
      },

      OR: (...args) => {
        return args.some(arg => Boolean(arg));
      },

      SWITCH: (expression, ...args) => {
        for (let i = 0; i < args.length - 1; i += 2) {
          if (expression === args[i]) {
            return args[i + 1];
          }
        }
        if (args.length % 2 === 1) {
          return args[args.length - 1];
        }
        return null;
      },

      TRUE: () => {
        return true;
      },

      XOR: (...args) => {
        const trueCount = args.filter(arg => Boolean(arg)).length;
        return trueCount % 2 === 1;
      },

      // NUMERIC FUNCTIONS
      ABS: (value) => {
        return Math.abs(Number(value));
      },

      AVERAGE: (...args) => {
        const numbers = args.filter(arg => typeof arg === 'number' || !isNaN(Number(arg)));
        const sum = numbers.reduce((acc, val) => acc + Number(val), 0);
        return numbers.length > 0 ? sum / numbers.length : 0;
      },

      CEILING: (value, significance = 1) => {
        const val = Number(value);
        const sig = Number(significance);
        return Math.ceil(val / sig) * sig;
      },

      COUNT: (...args) => {
        return args.filter(arg => typeof arg === 'number' || !isNaN(Number(arg))).length;
      },

      COUNTA: (...args) => {
        return args.filter(arg => arg !== null && arg !== undefined && arg !== '').length;
      },

      COUNTALL: (...args) => {
        return args.length;
      },

      EVEN: (value) => {
        const val = Number(value);
        if (val >= 0) {
          return Math.ceil(val / 2) * 2;
        } else {
          return Math.floor(val / 2) * 2;
        }
      },

      EXP: (power) => {
        return Math.exp(Number(power));
      },

      FLOOR: (value, significance = 1) => {
        const val = Number(value);
        const sig = Number(significance);
        return Math.floor(val / sig) * sig;
      },

      INT: (value) => {
        return Math.floor(Number(value));
      },

      LOG: (number, base = 10) => {
        return Math.log(Number(number)) / Math.log(Number(base));
      },

      MAX: (...args) => {
        const numbers = args.map(arg => Number(arg)).filter(n => !isNaN(n));
        return numbers.length > 0 ? Math.max(...numbers) : 0;
      },

      MIN: (...args) => {
        const numbers = args.map(arg => Number(arg)).filter(n => !isNaN(n));
        return numbers.length > 0 ? Math.min(...numbers) : 0;
      },

      MOD: (value, divisor) => {
        return Number(value) % Number(divisor);
      },

      ODD: (value) => {
        const val = Number(value);
        if (val >= 0) {
          const rounded = Math.ceil(val);
          return rounded % 2 === 0 ? rounded + 1 : rounded;
        } else {
          const rounded = Math.floor(val);
          return rounded % 2 === 0 ? rounded - 1 : rounded;
        }
      },

      POWER: (base, power) => {
        return Math.pow(Number(base), Number(power));
      },

      ROUND: (value, precision) => {
        const multiplier = Math.pow(10, Number(precision));
        return Math.round(Number(value) * multiplier) / multiplier;
      },

      ROUNDDOWN: (value, precision) => {
        const multiplier = Math.pow(10, Number(precision));
        return Math.floor(Number(value) * multiplier) / multiplier;
      },

      ROUNDUP: (value, precision) => {
        const multiplier = Math.pow(10, Number(precision));
        return Math.ceil(Number(value) * multiplier) / multiplier;
      },

      SQRT: (value) => {
        return Math.sqrt(Number(value));
      },

      SUM: (...args) => {
        return args.reduce((acc, val) => acc + Number(val), 0);
      },

      VALUE: (text) => {
        const cleaned = String(text).replace(/[$,]/g, '');
        return parseFloat(cleaned) || 0;
      },

      // DATE FUNCTIONS
      CREATED_TIME: () => {
        return new Date();
      },

      DATEADD: (date, count, unit) => {
        const d = new Date(date);
        const c = Number(count);
        
        switch(unit.toLowerCase()) {
          case 'years': d.setFullYear(d.getFullYear() + c); break;
          case 'months': d.setMonth(d.getMonth() + c); break;
          case 'weeks': d.setDate(d.getDate() + (c * 7)); break;
          case 'days': d.setDate(d.getDate() + c); break;
          case 'hours': d.setHours(d.getHours() + c); break;
          case 'minutes': d.setMinutes(d.getMinutes() + c); break;
          case 'seconds': d.setSeconds(d.getSeconds() + c); break;
          case 'milliseconds': d.setMilliseconds(d.getMilliseconds() + c); break;
        }
        
        return d;
      },

      DATESTR: (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },

      DATETIME_DIFF: (date1, date2, unit = 'seconds') => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diff = d1 - d2;
        
        switch(unit.toLowerCase()) {
          case 'milliseconds': return diff;
          case 'seconds': return Math.floor(diff / 1000);
          case 'minutes': return Math.floor(diff / (1000 * 60));
          case 'hours': return Math.floor(diff / (1000 * 60 * 60));
          case 'days': return Math.floor(diff / (1000 * 60 * 60 * 24));
          case 'weeks': return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
          case 'months': {
            const years = d1.getFullYear() - d2.getFullYear();
            const months = d1.getMonth() - d2.getMonth();
            return years * 12 + months;
          }
          case 'years': return d1.getFullYear() - d2.getFullYear();
          default: return Math.floor(diff / 1000);
        }
      },

      DATETIME_FORMAT: (date, format = 'YYYY-MM-DD') => {
        const d = new Date(date);
        
        const tokens = {
          'YYYY': d.getFullYear(),
          'YY': String(d.getFullYear()).slice(-2),
          'MMMM': ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()],
          'MMM': ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()],
          'MM': String(d.getMonth() + 1).padStart(2, '0'),
          'M': d.getMonth() + 1,
          'DD': String(d.getDate()).padStart(2, '0'),
          'D': d.getDate(),
          'HH': String(d.getHours()).padStart(2, '0'),
          'H': d.getHours(),
          'hh': String((d.getHours() % 12) || 12).padStart(2, '0'),
          'h': (d.getHours() % 12) || 12,
          'mm': String(d.getMinutes()).padStart(2, '0'),
          'm': d.getMinutes(),
          'ss': String(d.getSeconds()).padStart(2, '0'),
          's': d.getSeconds(),
          'A': d.getHours() >= 12 ? 'PM' : 'AM',
          'a': d.getHours() >= 12 ? 'pm' : 'am'
        };
        
        let result = format;
        for (const [token, value] of Object.entries(tokens)) {
          result = result.replace(new RegExp(token, 'g'), value);
        }
        
        return result;
      },

      DATETIME_PARSE: (dateString) => {
        return new Date(dateString);
      },

      DAY: (date) => {
        return new Date(date).getDate();
      },

      HOUR: (datetime) => {
        return new Date(datetime).getHours();
      },

      IS_AFTER: (date1, date2) => {
        return new Date(date1) > new Date(date2);
      },

      IS_BEFORE: (date1, date2) => {
        return new Date(date1) < new Date(date2);
      },

      IS_SAME: (date1, date2, unit = 'day') => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        
        switch(unit.toLowerCase()) {
          case 'year': return d1.getFullYear() === d2.getFullYear();
          case 'month': return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
          case 'day': return d1.toDateString() === d2.toDateString();
          case 'hour': return d1.toDateString() === d2.toDateString() && d1.getHours() === d2.getHours();
          case 'minute': return Math.floor(d1.getTime() / 60000) === Math.floor(d2.getTime() / 60000);
          case 'second': return Math.floor(d1.getTime() / 1000) === Math.floor(d2.getTime() / 1000);
          default: return d1.toDateString() === d2.toDateString();
        }
      },

      LAST_MODIFIED_TIME: (field) => {
        return new Date();
      },

      MINUTE: (datetime) => {
        return new Date(datetime).getMinutes();
      },

      MONTH: (date) => {
        return new Date(date).getMonth() + 1;
      },

      NOW: () => {
        return new Date();
      },

      SECOND: (datetime) => {
        return new Date(datetime).getSeconds();
      },

      SET_LOCALE: (date, locale) => {
        const d = new Date(date);
        d._locale = locale;
        return d;
      },

      SET_TIMEZONE: (date, timezone) => {
        const d = new Date(date);
        d._timezone = timezone;
        return d;
      },

      TIMESTR: (datetime) => {
        const d = new Date(datetime);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
      },

      TONOW: (date) => {
        const d1 = new Date();
        const d2 = new Date(date);
        const diff = d1 - d2;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      },

      TODAY: () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      },

      WEEKDAY: (date, startDay = 'Sunday') => {
        const day = new Date(date).getDay();
        if (startDay.toLowerCase() === 'monday') {
          return day === 0 ? 6 : day - 1;
        }
        return day;
      },

      WEEKNUM: (date, startDay = 'Sunday') => {
        const d = new Date(date);
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const dayOffset = startDay.toLowerCase() === 'monday' ? 1 : 0;
        const dayOfYear = Math.floor((d - yearStart) / (24 * 60 * 60 * 1000));
        return Math.ceil((dayOfYear + yearStart.getDay() - dayOffset + 1) / 7);
      },

      WORKDAY: (startDate, numDays, holidays = '') => {
        const holidayDates = holidays ? holidays.split(',').map(h => new Date(h.trim()).toDateString()) : [];
        const d = new Date(startDate);
        let daysAdded = 0;
        
        while (daysAdded < numDays) {
          d.setDate(d.getDate() + 1);
          const dayOfWeek = d.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isHoliday = holidayDates.includes(d.toDateString());
          
          if (!isWeekend && !isHoliday) {
            daysAdded++;
          }
        }
        
        return d;
      },

      WORKDAY_DIFF: (startDate, endDate, holidays = '') => {
        const holidayDates = holidays ? holidays.split(',').map(h => new Date(h.trim()).toDateString()) : [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        let workdays = 0;
        
        const current = new Date(start);
        while (current <= end) {
          const dayOfWeek = current.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isHoliday = holidayDates.includes(current.toDateString());
          
          if (!isWeekend && !isHoliday) {
            workdays++;
          }
          
          current.setDate(current.getDate() + 1);
        }
        
        return workdays;
      },

      YEAR: (date) => {
        return new Date(date).getFullYear();
      },

      // ARRAY FUNCTIONS
      ARRAYCOMPACT: (array) => {
        if (!Array.isArray(array)) return [];
        return array.filter(item => item !== null && item !== undefined && item !== '');
      },

      ARRAYFLATTEN: (array) => {
        if (!Array.isArray(array)) return [];
        return array.flat(Infinity);
      },

      ARRAYUNIQUE: (array) => {
        if (!Array.isArray(array)) return [];
        return [...new Set(array)];
      },

      ARRAYSLICE: (array, startIndex, endIndex) => {
        if (!Array.isArray(array)) return [];
        const start = startIndex - 1;
        const end = endIndex ? endIndex : undefined;
        return array.slice(start, end);
      },

      // RECORD FUNCTIONS
      RECORD_ID: () => {
        return 'rec' + Math.random().toString(36).substr(2, 9);
      },

      // REGEX FUNCTIONS
      REGEX_MATCH: (text, regex) => {
        const re = new RegExp(regex);
        return re.test(String(text));
      },

      REGEX_EXTRACT: (text, regex) => {
        const re = new RegExp(regex);
        const match = String(text).match(re);
        return match ? match[0] : '';
      },

      REGEX_REPLACE: (text, regex, replacement) => {
        const re = new RegExp(regex, 'g');
        return String(text).replace(re, replacement);
      }
    };
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormulaEngine;
}

// Export for browsers
if (typeof window !== 'undefined') {
  window.FormulaEngine = FormulaEngine;
}
