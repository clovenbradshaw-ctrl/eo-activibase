/**
 * EO Import Manager
 * Manages imports as first-class objects with full provenance tracking
 *
 * Features:
 * - Imports persist as navigable objects (like files)
 * - Maximum metadata extraction from source files
 * - Schema inference with relationship detection
 * - Data quality analysis
 * - Provenance tracking for every record
 * - Support for CSV, JSON, Excel formats
 */

class EOImportManager {
  constructor() {
    this.imports = new Map(); // id -> Import object
    this.listeners = new Set();
  }

  /**
   * Generate unique import ID
   */
  generateImportId() {
    return 'imp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Create an import from a file
   */
  async createImportFromFile(file) {
    const importId = this.generateImportId();
    const startTime = Date.now();

    // Extract file metadata
    const fileMetadata = this.extractFileMetadata(file);

    // Parse file content based on type
    const parseResult = await this.parseFile(file);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    // Analyze schema and data quality
    const schemaAnalysis = this.analyzeSchema(parseResult.rows, parseResult.headers);
    const qualityAnalysis = this.analyzeDataQuality(parseResult.rows, schemaAnalysis);
    const relationshipHints = this.detectRelationshipHints(schemaAnalysis, parseResult.rows);

    // Extract embedded metadata from content
    const embeddedMetadata = this.extractEmbeddedMetadata(parseResult);

    // Create the import object
    const importObj = {
      id: importId,
      name: file.name,

      // Source information
      source: {
        type: 'file',
        format: this.getFileFormat(file.name),
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
        importedAt: new Date().toISOString(),
        parseTimeMs: Date.now() - startTime
      },

      // File-level metadata
      fileMetadata,

      // Embedded metadata (from file contents)
      embeddedMetadata,

      // Schema analysis
      schema: {
        columns: schemaAnalysis.columns,
        inferredTypes: schemaAnalysis.inferredTypes,
        primaryKeyCandidate: schemaAnalysis.primaryKeyCandidate,
        definitionColumns: schemaAnalysis.definitionColumns,
        dateColumns: schemaAnalysis.dateColumns,
        numericColumns: schemaAnalysis.numericColumns,
        categoricalColumns: schemaAnalysis.categoricalColumns,
        foreignKeyHints: relationshipHints.foreignKeyColumns,
        relationshipHints: relationshipHints.relationships
      },

      // Data quality metrics
      quality: qualityAnalysis,

      // The actual data
      headers: parseResult.headers,
      rows: parseResult.rows,
      rowCount: parseResult.rows.length,
      columnCount: parseResult.headers.length,

      // Usage tracking (where this import has been used)
      usedIn: [],

      // Status
      status: 'ready', // ready, processing, error, archived

      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.imports.set(importId, importObj);
    this.notifyListeners('import_created', importObj);

    return { success: true, import: importObj };
  }

  /**
   * Extract metadata from file object
   */
  extractFileMetadata(file) {
    return {
      name: file.name,
      size: file.size,
      sizeFormatted: this.formatFileSize(file.size),
      type: file.type,
      lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      lastModifiedFormatted: file.lastModified ? new Date(file.lastModified).toLocaleString() : null,
      extension: this.getFileExtension(file.name),

      // Derived metadata from filename
      filenameAnalysis: this.analyzeFilename(file.name)
    };
  }

  /**
   * Analyze filename for embedded information
   */
  analyzeFilename(filename) {
    const analysis = {
      baseName: filename.replace(/\.[^/.]+$/, ''),
      extension: this.getFileExtension(filename),

      // Temporal patterns
      timeframe: null,

      // Version patterns
      version: null,

      // Entity hints
      entityHints: [],

      // Source system hints
      sourceSystemHint: null
    };

    const baseName = analysis.baseName.toLowerCase();

    // Quarter detection: Q1_2024, 2024-Q1, Q1-2024
    const quarterMatch = baseName.match(/q([1-4])[_\-\s]*(\d{4})|(\d{4})[_\-\s]*q([1-4])/i);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1] || quarterMatch[4]);
      const year = parseInt(quarterMatch[2] || quarterMatch[3]);
      const startMonth = (quarter - 1) * 3;
      analysis.timeframe = {
        type: 'quarter',
        quarter,
        year,
        start: new Date(year, startMonth, 1).toISOString(),
        end: new Date(year, startMonth + 3, 0).toISOString(),
        label: `Q${quarter} ${year}`
      };
    }

    // Year detection: 2024, 2023
    if (!analysis.timeframe) {
      const yearMatch = baseName.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        analysis.timeframe = {
          type: 'year',
          year,
          start: new Date(year, 0, 1).toISOString(),
          end: new Date(year, 11, 31).toISOString(),
          label: `${year}`
        };
      }
    }

    // Month detection: jan, january, 01, etc.
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthMatch = baseName.match(new RegExp(`\\b(${monthNames.join('|')})(?:uary|ruary|ch|il|e|y|ust|ember|ober)?\\b`, 'i'));
    if (monthMatch && analysis.timeframe?.type === 'year') {
      const monthIndex = monthNames.findIndex(m => monthMatch[1].toLowerCase().startsWith(m));
      if (monthIndex >= 0) {
        const year = analysis.timeframe.year;
        analysis.timeframe = {
          type: 'month',
          month: monthIndex + 1,
          year,
          start: new Date(year, monthIndex, 1).toISOString(),
          end: new Date(year, monthIndex + 1, 0).toISOString(),
          label: `${monthMatch[1].charAt(0).toUpperCase() + monthMatch[1].slice(1)} ${year}`
        };
      }
    }

    // Date detection: 2024-03-15, 20240315, 03-15-2024
    const dateMatch = baseName.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch.map(Number);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        analysis.timeframe = {
          type: 'day',
          year, month, day,
          start: new Date(year, month - 1, day).toISOString(),
          end: new Date(year, month - 1, day, 23, 59, 59).toISOString(),
          label: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        };
      }
    }

    // Version detection: v1, v2.1, version_2
    const versionMatch = baseName.match(/v(?:ersion)?[_\-\s]?(\d+(?:\.\d+)?)/i);
    if (versionMatch) {
      analysis.version = versionMatch[1];
    }

    // Entity hints from common patterns
    const entityPatterns = [
      { pattern: /orders?/i, entity: 'order' },
      { pattern: /customers?/i, entity: 'customer' },
      { pattern: /products?/i, entity: 'product' },
      { pattern: /invoices?/i, entity: 'invoice' },
      { pattern: /transactions?/i, entity: 'transaction' },
      { pattern: /employees?|staff|personnel/i, entity: 'employee' },
      { pattern: /users?/i, entity: 'user' },
      { pattern: /contacts?/i, entity: 'contact' },
      { pattern: /companies?|accounts?/i, entity: 'company' },
      { pattern: /payments?/i, entity: 'payment' },
      { pattern: /items?|line_?items?/i, entity: 'line_item' },
      { pattern: /sales/i, entity: 'sale' },
      { pattern: /inventory/i, entity: 'inventory' },
      { pattern: /projects?/i, entity: 'project' },
      { pattern: /tasks?/i, entity: 'task' }
    ];

    entityPatterns.forEach(({ pattern, entity }) => {
      if (pattern.test(baseName)) {
        analysis.entityHints.push(entity);
      }
    });

    // Source system hints
    const sourcePatterns = [
      { pattern: /shopify/i, source: 'Shopify' },
      { pattern: /stripe/i, source: 'Stripe' },
      { pattern: /quickbooks|qb/i, source: 'QuickBooks' },
      { pattern: /salesforce|sfdc/i, source: 'Salesforce' },
      { pattern: /hubspot/i, source: 'HubSpot' },
      { pattern: /airtable/i, source: 'Airtable' },
      { pattern: /notion/i, source: 'Notion' },
      { pattern: /excel|xlsx/i, source: 'Excel' },
      { pattern: /export/i, source: 'Export' },
      { pattern: /backup/i, source: 'Backup' }
    ];

    sourcePatterns.forEach(({ pattern, source }) => {
      if (pattern.test(baseName)) {
        analysis.sourceSystemHint = source;
      }
    });

    return analysis;
  }

  /**
   * Parse file based on format
   */
  async parseFile(file) {
    const format = this.getFileFormat(file.name);

    try {
      switch (format) {
        case 'csv':
        case 'tsv':
          return await this.parseCsv(file, format === 'tsv' ? '\t' : ',');
        case 'json':
          return await this.parseJson(file);
        case 'xlsx':
        case 'xls':
          return await this.parseExcel(file);
        default:
          return { success: false, error: `Unsupported file format: ${format}` };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Parse CSV/TSV file
   */
  async parseCsv(file, delimiter = ',') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter(line => line.trim());

          if (lines.length === 0) {
            resolve({ success: false, error: 'Empty file' });
            return;
          }

          // Parse headers
          const headers = this.parseCsvLine(lines[0], delimiter);

          // Parse rows
          const rows = [];
          for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i], delimiter);
            if (values.length > 0) {
              const row = {};
              headers.forEach((header, idx) => {
                row[header] = values[idx] !== undefined ? values[idx] : '';
              });
              row._sourceRow = i; // Track source row number
              rows.push(row);
            }
          }

          resolve({
            success: true,
            headers,
            rows,
            format: 'csv',
            delimiter,
            encoding: 'utf-8',
            lineCount: lines.length,
            hasHeaderRow: true
          });
        } catch (err) {
          resolve({ success: false, error: err.message });
        }
      };
      reader.onerror = () => resolve({ success: false, error: 'Failed to read file' });
      reader.readAsText(file);
    });
  }

  /**
   * Parse a single CSV line handling quotes
   */
  parseCsvLine(line, delimiter = ',') {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === delimiter) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    values.push(current.trim());

    return values;
  }

  /**
   * Parse JSON file
   */
  async parseJson(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);

          // Handle array of objects
          if (Array.isArray(data)) {
            if (data.length === 0) {
              resolve({ success: false, error: 'Empty JSON array' });
              return;
            }

            // Extract headers from all objects (union of all keys)
            const headerSet = new Set();
            data.forEach(obj => {
              if (typeof obj === 'object' && obj !== null) {
                Object.keys(obj).forEach(key => headerSet.add(key));
              }
            });
            const headers = Array.from(headerSet);

            // Convert to rows
            const rows = data.map((obj, idx) => {
              const row = { _sourceRow: idx };
              headers.forEach(header => {
                row[header] = obj[header] !== undefined ? obj[header] : '';
              });
              return row;
            });

            resolve({
              success: true,
              headers,
              rows,
              format: 'json',
              structure: 'array',
              originalData: data
            });
          }
          // Handle object with data array
          else if (typeof data === 'object' && data !== null) {
            // Look for common data array keys
            const dataKey = ['data', 'records', 'rows', 'items', 'results'].find(
              key => Array.isArray(data[key])
            );

            if (dataKey) {
              const items = data[dataKey];
              const headerSet = new Set();
              items.forEach(obj => {
                if (typeof obj === 'object' && obj !== null) {
                  Object.keys(obj).forEach(key => headerSet.add(key));
                }
              });
              const headers = Array.from(headerSet);

              const rows = items.map((obj, idx) => {
                const row = { _sourceRow: idx };
                headers.forEach(header => {
                  row[header] = obj[header] !== undefined ? obj[header] : '';
                });
                return row;
              });

              // Extract metadata from wrapper object
              const metadata = {};
              Object.keys(data).forEach(key => {
                if (key !== dataKey) {
                  metadata[key] = data[key];
                }
              });

              resolve({
                success: true,
                headers,
                rows,
                format: 'json',
                structure: 'wrapped',
                wrapperKey: dataKey,
                metadata,
                originalData: data
              });
            } else {
              // Single object - treat as one row
              const headers = Object.keys(data);
              const row = { _sourceRow: 0, ...data };

              resolve({
                success: true,
                headers,
                rows: [row],
                format: 'json',
                structure: 'single'
              });
            }
          } else {
            resolve({ success: false, error: 'Invalid JSON structure' });
          }
        } catch (err) {
          resolve({ success: false, error: `JSON parse error: ${err.message}` });
        }
      };
      reader.onerror = () => resolve({ success: false, error: 'Failed to read file' });
      reader.readAsText(file);
    });
  }

  /**
   * Parse Excel file (requires SheetJS/xlsx library)
   */
  async parseExcel(file) {
    // Check if XLSX library is available
    if (typeof XLSX === 'undefined') {
      return {
        success: false,
        error: 'Excel parsing requires the SheetJS library. Add: <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>'
      };
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });

          // Get sheet info
          const sheetNames = workbook.SheetNames;
          const sheets = [];

          sheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            if (jsonData.length > 0) {
              const headers = jsonData[0].map((h, i) => h || `Column_${i + 1}`);
              const rows = [];

              for (let i = 1; i < jsonData.length; i++) {
                const row = { _sourceRow: i };
                headers.forEach((header, idx) => {
                  row[header] = jsonData[i][idx] !== undefined ? jsonData[i][idx] : '';
                });
                rows.push(row);
              }

              sheets.push({
                name: sheetName,
                headers,
                rows,
                rowCount: rows.length
              });
            }
          });

          if (sheets.length === 0) {
            resolve({ success: false, error: 'No data found in Excel file' });
            return;
          }

          // For single sheet, return directly; for multiple, return first with sheet info
          const primarySheet = sheets[0];

          resolve({
            success: true,
            headers: primarySheet.headers,
            rows: primarySheet.rows,
            format: 'xlsx',
            sheets: sheets.map(s => ({ name: s.name, rowCount: s.rowCount })),
            activeSheet: primarySheet.name,
            allSheets: sheets
          });
        } catch (err) {
          resolve({ success: false, error: `Excel parse error: ${err.message}` });
        }
      };
      reader.onerror = () => resolve({ success: false, error: 'Failed to read file' });
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Analyze schema from rows
   * Uses sampling for large datasets (max 1000 rows) to improve performance
   */
  analyzeSchema(rows, headers) {
    const columns = {};

    headers.forEach(header => {
      columns[header] = {
        name: header,
        samples: [],
        types: {},
        nullCount: 0,
        uniqueValues: new Set(),
        minLength: Infinity,
        maxLength: 0,
        isNumeric: true,
        isDate: true,
        isBoolean: true,
        isEmail: true,
        isUrl: true,
        isUuid: true,
        isEmpty: true,
        patterns: {}
      };
    });

    // Sample-based analysis for large datasets (max 1000 rows)
    const MAX_SAMPLE_SIZE = 1000;
    let sampleRows = rows;
    let sampleRatio = 1;

    if (rows.length > MAX_SAMPLE_SIZE) {
      // Stratified sampling: take rows from start, middle, and end
      const startSample = rows.slice(0, Math.floor(MAX_SAMPLE_SIZE / 3));
      const middleStart = Math.floor((rows.length - MAX_SAMPLE_SIZE / 3) / 2);
      const middleSample = rows.slice(middleStart, middleStart + Math.floor(MAX_SAMPLE_SIZE / 3));
      const endSample = rows.slice(-Math.floor(MAX_SAMPLE_SIZE / 3));
      sampleRows = [...startSample, ...middleSample, ...endSample];
      sampleRatio = rows.length / sampleRows.length;
    }

    // Analyze each row in the sample
    sampleRows.forEach((row, rowIdx) => {
      headers.forEach(header => {
        const value = row[header];
        const col = columns[header];
        const strValue = String(value ?? '');

        // Collect samples (first 5 non-empty)
        if (strValue && col.samples.length < 5) {
          col.samples.push(strValue);
        }

        // Track null/empty
        if (value === null || value === undefined || strValue === '') {
          col.nullCount++;
        } else {
          col.isEmpty = false;
        }

        // Track unique values (up to 1000)
        if (col.uniqueValues.size < 1000) {
          col.uniqueValues.add(strValue);
        }

        // Track length
        col.minLength = Math.min(col.minLength, strValue.length);
        col.maxLength = Math.max(col.maxLength, strValue.length);

        // Type detection
        if (strValue) {
          // Numeric
          if (col.isNumeric && !/^-?\d*\.?\d+$/.test(strValue.replace(/[,$%]/g, ''))) {
            col.isNumeric = false;
          }

          // Date
          if (col.isDate && isNaN(Date.parse(strValue)) && !/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
            col.isDate = false;
          }

          // Boolean
          if (col.isBoolean && !['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(strValue.toLowerCase())) {
            col.isBoolean = false;
          }

          // Email
          if (col.isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
            col.isEmail = false;
          }

          // URL
          if (col.isUrl && !/^https?:\/\//.test(strValue)) {
            col.isUrl = false;
          }

          // UUID
          if (col.isUuid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strValue)) {
            col.isUuid = false;
          }

          // Pattern detection
          this.detectPatterns(strValue, col.patterns);
        }
      });
    });

    // Determine inferred types
    const inferredTypes = {};
    const sampleSize = sampleRows.length;
    headers.forEach(header => {
      const col = columns[header];
      inferredTypes[header] = this.inferColumnType(col, sampleSize);

      // Convert unique values set to count, extrapolating for sampled data
      col.uniqueCount = col.uniqueValues.size;
      // Estimate null count for full dataset if sampled
      if (sampleRatio > 1) {
        col.nullCount = Math.round(col.nullCount * sampleRatio);
      }
      col.uniqueRatio = sampleSize > 0 ? col.uniqueCount / sampleSize : 0;
      col.wasSampled = sampleRatio > 1;
      delete col.uniqueValues; // Don't store the full set
    });

    // Find primary key candidate
    const primaryKeyCandidate = this.findPrimaryKeyCandidate(columns, headers, rows.length);

    // Find definition columns
    const definitionColumns = headers.filter(h =>
      /_definition$|_definition_id$|_def$|_type$|_category$/i.test(h)
    );

    // Categorize columns
    const dateColumns = headers.filter(h => inferredTypes[h] === 'DATE');
    const numericColumns = headers.filter(h => ['NUMBER', 'CURRENCY'].includes(inferredTypes[h]));
    const categoricalColumns = headers.filter(h => {
      const col = columns[h];
      return col.uniqueCount <= 20 && col.uniqueRatio < 0.1 && inferredTypes[h] === 'TEXT';
    });

    return {
      columns,
      inferredTypes,
      primaryKeyCandidate,
      definitionColumns,
      dateColumns,
      numericColumns,
      categoricalColumns
    };
  }

  /**
   * Detect value patterns
   */
  detectPatterns(value, patterns) {
    const patternTests = [
      { name: 'id_prefix', test: /^[A-Z]{2,5}[-_]\d+$/, example: 'ORD-123' },
      { name: 'uuid', test: /^[0-9a-f]{8}-[0-9a-f]{4}/i, example: 'uuid' },
      { name: 'email', test: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, example: 'email' },
      { name: 'phone', test: /^[\d\s\-\+\(\)]{10,}$/, example: 'phone' },
      { name: 'currency', test: /^\$[\d,]+\.?\d*$/, example: '$1,234.56' },
      { name: 'percentage', test: /^\d+\.?\d*%$/, example: '45%' },
      { name: 'iso_date', test: /^\d{4}-\d{2}-\d{2}/, example: '2024-01-15' },
      { name: 'us_date', test: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, example: '01/15/2024' }
    ];

    patternTests.forEach(({ name, test }) => {
      if (test.test(value)) {
        patterns[name] = (patterns[name] || 0) + 1;
      }
    });
  }

  /**
   * Infer column type from analysis
   */
  inferColumnType(col, rowCount) {
    // Empty column
    if (col.isEmpty) return 'TEXT';

    // Check specific types first
    if (col.isEmail && col.patterns.email > rowCount * 0.5) return 'EMAIL';
    if (col.isUrl) return 'URL';
    if (col.isUuid) return 'TEXT'; // UUIDs are typically IDs
    if (col.isBoolean) return 'CHECKBOX';
    if (col.isDate) return 'DATE';

    // Numeric types
    if (col.isNumeric) {
      if (col.patterns.currency > rowCount * 0.3) return 'CURRENCY';
      if (col.patterns.percentage > rowCount * 0.3) return 'NUMBER';
      return 'NUMBER';
    }

    // Check for SELECT (categorical)
    if (col.uniqueCount <= 10 && col.uniqueRatio < 0.05) {
      return 'SELECT';
    }

    // Long text
    if (col.maxLength > 200) return 'LONG_TEXT';

    return 'TEXT';
  }

  /**
   * Find best primary key candidate
   */
  findPrimaryKeyCandidate(columns, headers, rowCount) {
    const candidates = [];

    headers.forEach(header => {
      const col = columns[header];
      let score = 0;

      // Unique values = high score
      if (col.uniqueCount === rowCount && rowCount > 0) {
        score += 50;
      } else if (col.uniqueRatio > 0.95) {
        score += 30;
      }

      // ID-like names
      if (/^id$|_id$|Id$/i.test(header)) {
        score += 30;
      }

      // Key-like names
      if (/key|code|number|num|no$/i.test(header)) {
        score += 15;
      }

      // UUID pattern
      if (col.isUuid) {
        score += 20;
      }

      // ID prefix pattern (e.g., ORD-123)
      if (col.patterns.id_prefix > rowCount * 0.8) {
        score += 25;
      }

      // Not nullable
      if (col.nullCount === 0) {
        score += 10;
      }

      // First column bonus (often the ID)
      if (headers.indexOf(header) === 0) {
        score += 5;
      }

      if (score > 20) {
        candidates.push({ column: header, score });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0].column : null;
  }

  /**
   * Detect relationship hints (foreign keys)
   */
  detectRelationshipHints(schemaAnalysis, rows) {
    const foreignKeyColumns = [];
    const relationships = [];
    const { columns } = schemaAnalysis;

    Object.entries(columns).forEach(([header, col]) => {
      // Check for FK naming patterns
      const fkMatch = header.match(/^(.+?)_id$|^(.+?)Id$|^(.+?)_key$/i);
      if (fkMatch) {
        const entityName = (fkMatch[1] || fkMatch[2] || fkMatch[3]).toLowerCase();

        foreignKeyColumns.push({
          column: header,
          referencedEntity: entityName,
          confidence: 0.8,
          uniqueCount: col.uniqueCount,
          nullCount: col.nullCount,
          pattern: 'naming_convention'
        });
      }

      // Check for ID-like patterns that might be FKs
      if (col.patterns.id_prefix > rows.length * 0.5 && !/_id$|Id$/i.test(header)) {
        // Has ID-like values but not named as _id
        const prefix = this.extractIdPrefix(col.samples);
        if (prefix) {
          foreignKeyColumns.push({
            column: header,
            referencedEntity: prefix.toLowerCase(),
            confidence: 0.5,
            uniqueCount: col.uniqueCount,
            pattern: 'value_pattern',
            detectedPrefix: prefix
          });
        }
      }
    });

    return { foreignKeyColumns, relationships };
  }

  /**
   * Extract ID prefix from samples
   */
  extractIdPrefix(samples) {
    const prefixCounts = {};
    samples.forEach(sample => {
      const match = String(sample).match(/^([A-Z]{2,5})[-_]/);
      if (match) {
        prefixCounts[match[1]] = (prefixCounts[match[1]] || 0) + 1;
      }
    });

    const entries = Object.entries(prefixCounts);
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1]);
      return entries[0][0];
    }
    return null;
  }

  /**
   * Analyze data quality
   */
  analyzeDataQuality(rows, schemaAnalysis) {
    const { columns } = schemaAnalysis;
    const rowCount = rows.length;
    const columnCount = Object.keys(columns).length;

    let totalCells = rowCount * columnCount;
    let nullCells = 0;
    let emptyCells = 0;

    Object.values(columns).forEach(col => {
      nullCells += col.nullCount;
      // Approximate empty cells
      if (col.minLength === 0) {
        emptyCells += col.nullCount;
      }
    });

    const completeness = totalCells > 0 ? ((totalCells - nullCells) / totalCells) : 1;

    // Check for duplicate rows using efficient hash-based detection
    const rowHashes = new Set();
    let duplicateCount = 0;
    rows.forEach(row => {
      // Use efficient hash instead of JSON.stringify
      const hash = this._hashRow(row, Object.keys(columns));
      if (rowHashes.has(hash)) {
        duplicateCount++;
      } else {
        rowHashes.add(hash);
      }
    });

    return {
      rowCount,
      columnCount,
      totalCells,
      nullCells,
      completeness,
      completenessPercent: (completeness * 100).toFixed(1) + '%',
      duplicateRows: duplicateCount,
      uniqueRows: rowCount - duplicateCount,

      // Column-level quality
      columnsWithNulls: Object.values(columns).filter(c => c.nullCount > 0).length,
      fullyPopulatedColumns: Object.values(columns).filter(c => c.nullCount === 0).length,

      // Quality score (0-100)
      score: Math.round(
        (completeness * 50) +
        ((1 - duplicateCount / Math.max(rowCount, 1)) * 30) +
        ((Object.values(columns).filter(c => c.nullCount === 0).length / Math.max(columnCount, 1)) * 20)
      )
    };
  }

  /**
   * Extract embedded metadata from file content
   */
  extractEmbeddedMetadata(parseResult) {
    const metadata = {};

    // For JSON with wrapper, extract metadata fields
    if (parseResult.format === 'json' && parseResult.metadata) {
      Object.assign(metadata, parseResult.metadata);
    }

    // Look for common metadata patterns in first rows
    if (parseResult.rows.length > 0) {
      const firstRow = parseResult.rows[0];

      // Check for metadata-like columns
      const metadataColumns = ['_metadata', 'metadata', '__meta', 'export_info', 'generated_at', 'exported_at'];
      metadataColumns.forEach(col => {
        if (firstRow[col]) {
          metadata[col] = firstRow[col];
        }
      });
    }

    // Extract date range from data
    const dateColumns = Object.keys(parseResult.rows[0] || {}).filter(col =>
      /date|time|created|updated|timestamp/i.test(col)
    );

    if (dateColumns.length > 0 && parseResult.rows.length > 0) {
      const dates = [];
      parseResult.rows.forEach(row => {
        dateColumns.forEach(col => {
          const d = new Date(row[col]);
          if (!isNaN(d.getTime())) {
            dates.push(d);
          }
        });
      });

      if (dates.length > 0) {
        dates.sort((a, b) => a - b);
        metadata.dataDateRange = {
          earliest: dates[0].toISOString(),
          latest: dates[dates.length - 1].toISOString(),
          span: Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)) + ' days'
        };
      }
    }

    return metadata;
  }

  /**
   * Get file format from filename
   */
  getFileFormat(filename) {
    const ext = this.getFileExtension(filename);
    const formatMap = {
      'csv': 'csv',
      'tsv': 'tsv',
      'json': 'json',
      'xlsx': 'xlsx',
      'xls': 'xls'
    };
    return formatMap[ext] || 'unknown';
  }

  /**
   * Get file extension
   */
  getFileExtension(filename) {
    return (filename.split('.').pop() || '').toLowerCase();
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ============================================
  // Import Management
  // ============================================

  /**
   * Get all imports
   */
  getAllImports() {
    return Array.from(this.imports.values());
  }

  /**
   * Get import by ID
   */
  getImport(importId) {
    return this.imports.get(importId);
  }

  /**
   * Delete an import
   */
  deleteImport(importId) {
    const imp = this.imports.get(importId);
    if (imp) {
      this.imports.delete(importId);
      this.notifyListeners('import_deleted', { id: importId });
      return true;
    }
    return false;
  }

  /**
   * Update import (e.g., rename)
   */
  updateImport(importId, updates) {
    const imp = this.imports.get(importId);
    if (imp) {
      Object.assign(imp, updates, { updatedAt: new Date().toISOString() });
      this.notifyListeners('import_updated', imp);
      return imp;
    }
    return null;
  }

  /**
   * Track that import is used in a set or view
   */
  trackUsage(importId, usageType, targetId, recordCount) {
    const imp = this.imports.get(importId);
    if (imp) {
      imp.usedIn.push({
        type: usageType, // 'set' or 'view'
        id: targetId,
        recordCount,
        addedAt: new Date().toISOString()
      });
      imp.updatedAt = new Date().toISOString();
      this.notifyListeners('import_updated', imp);
    }
  }

  /**
   * Get imports used in a specific set
   */
  getImportsForSet(setId) {
    return this.getAllImports().filter(imp =>
      imp.usedIn.some(u => u.type === 'set' && u.id === setId)
    );
  }

  // ============================================
  // Relationship Detection Across Imports
  // ============================================

  /**
   * Find potential relationships between imports
   */
  findRelationshipsBetweenImports(importId1, importId2) {
    const imp1 = this.imports.get(importId1);
    const imp2 = this.imports.get(importId2);

    if (!imp1 || !imp2) return [];

    const relationships = [];

    // Check FK columns in imp1 against primary key in imp2
    imp1.schema.foreignKeyHints.forEach(fk => {
      const targetEntity = fk.referencedEntity;

      // Check if imp2 looks like that entity
      const imp2Entities = imp2.fileMetadata.filenameAnalysis.entityHints;
      const imp2Name = imp2.name.toLowerCase();

      if (imp2Entities.includes(targetEntity) || imp2Name.includes(targetEntity)) {
        // Get values from FK column
        const fkValues = new Set(imp1.rows.map(r => String(r[fk.column] || '')).filter(v => v));

        // Check against primary key column in imp2
        const pkColumn = imp2.schema.primaryKeyCandidate;
        if (pkColumn) {
          const pkValues = new Set(imp2.rows.map(r => String(r[pkColumn] || '')));

          // Count matches
          let matches = 0;
          fkValues.forEach(v => {
            if (pkValues.has(v)) matches++;
          });

          const matchRate = fkValues.size > 0 ? matches / fkValues.size : 0;

          if (matchRate > 0.5) {
            relationships.push({
              from: {
                importId: importId1,
                importName: imp1.name,
                column: fk.column
              },
              to: {
                importId: importId2,
                importName: imp2.name,
                column: pkColumn
              },
              matchRate,
              matchCount: matches,
              totalFkValues: fkValues.size,
              confidence: matchRate * fk.confidence,
              type: 'foreign_key'
            });
          }
        }
      }
    });

    // Also check reverse direction
    imp2.schema.foreignKeyHints.forEach(fk => {
      const targetEntity = fk.referencedEntity;
      const imp1Entities = imp1.fileMetadata.filenameAnalysis.entityHints;
      const imp1Name = imp1.name.toLowerCase();

      if (imp1Entities.includes(targetEntity) || imp1Name.includes(targetEntity)) {
        const fkValues = new Set(imp2.rows.map(r => String(r[fk.column] || '')).filter(v => v));
        const pkColumn = imp1.schema.primaryKeyCandidate;

        if (pkColumn) {
          const pkValues = new Set(imp1.rows.map(r => String(r[pkColumn] || '')));

          let matches = 0;
          fkValues.forEach(v => {
            if (pkValues.has(v)) matches++;
          });

          const matchRate = fkValues.size > 0 ? matches / fkValues.size : 0;

          if (matchRate > 0.5) {
            relationships.push({
              from: {
                importId: importId2,
                importName: imp2.name,
                column: fk.column
              },
              to: {
                importId: importId1,
                importName: imp1.name,
                column: pkColumn
              },
              matchRate,
              matchCount: matches,
              totalFkValues: fkValues.size,
              confidence: matchRate * fk.confidence,
              type: 'foreign_key'
            });
          }
        }
      }
    });

    return relationships;
  }

  /**
   * Find all relationships across all imports
   */
  findAllRelationships() {
    const imports = this.getAllImports();
    const relationships = [];

    for (let i = 0; i < imports.length; i++) {
      for (let j = i + 1; j < imports.length; j++) {
        const rels = this.findRelationshipsBetweenImports(imports[i].id, imports[j].id);
        relationships.push(...rels);
      }
    }

    return relationships.sort((a, b) => b.confidence - a.confidence);
  }

  // ============================================
  // Event Listeners
  // ============================================

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (err) {
        console.error('Import manager listener error:', err);
      }
    });
  }

  // ============================================
  // Serialization
  // ============================================

  /**
   * Export all imports for persistence
   */
  exportAll() {
    return {
      version: 1,
      exports: Array.from(this.imports.values()).map(imp => ({
        ...imp,
        // Don't include raw rows in export (they're in sets now)
        rows: null,
        rowCount: imp.rowCount
      }))
    };
  }

  /**
   * Import from persistence
   */
  importAll(data) {
    if (data.version === 1 && Array.isArray(data.exports)) {
      data.exports.forEach(imp => {
        this.imports.set(imp.id, imp);
      });
    }
  }

  /**
   * Efficient hash function for row duplicate detection
   * Uses djb2 algorithm - faster than JSON.stringify for large datasets
   */
  _hashRow(row, keys) {
    let hash = 5381;
    for (const key of keys) {
      if (key === '_sourceRow') continue; // Skip metadata
      const value = row[key];
      const str = value === null || value === undefined ? '' : String(value);
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
      }
      // Add separator between fields
      hash = ((hash << 5) + hash) + 0x1F;
      hash = hash & hash;
    }
    return hash;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOImportManager;
}

if (typeof window !== 'undefined') {
  window.EOImportManager = EOImportManager;
}
