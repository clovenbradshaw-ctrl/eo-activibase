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
  constructor(options = {}) {
    this.imports = new Map(); // id -> Import object
    this.listeners = new Set();

    // Initialize the robust type detector
    this.typeDetector = new EOTypeDetector({
      decimalCharacter: options.decimalCharacter || '.',
      thousandsSeparator: options.thousandsSeparator || ',',
      locale: options.locale || 'en',
      confidenceThreshold: options.confidenceThreshold || 0.7
    });
  }

  /**
   * Generate unique import ID
   */
  generateImportId() {
    return 'imp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Create a processing placeholder for an import
   * This allows showing the import in the UI immediately while parsing happens in background
   * @param {File} file - The file being imported
   * @returns {object} The placeholder import object
   */
  createProcessingPlaceholder(file) {
    const importId = this.generateImportId();
    const fileMetadata = this.extractFileMetadata(file);

    const placeholderImport = {
      id: importId,
      name: file.name,
      source: {
        type: 'file',
        format: this.getFileFormat(file.name),
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
        importedAt: new Date().toISOString()
      },
      fileMetadata,
      // Placeholder values - will be populated after parsing
      headers: [],
      rows: [],
      rowCount: 0,
      columnCount: 0,
      schema: null,
      quality: null,
      // Usage tracking
      usedIn: [],
      // Mark as processing
      status: 'processing',
      processingProgress: 0,
      processingMessage: 'Parsing file...',
      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.imports.set(importId, placeholderImport);
    this.notifyListeners('import_created', placeholderImport);

    return placeholderImport;
  }

  /**
   * Update processing progress for an import
   * @param {string} importId - The import ID
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} message - Optional progress message
   */
  updateProcessingProgress(importId, progress, message = null) {
    const imp = this.imports.get(importId);
    if (imp) {
      imp.processingProgress = progress;
      if (message) {
        imp.processingMessage = message;
      }
      imp.updatedAt = new Date().toISOString();
      this.notifyListeners('import_progress', imp);
    }
  }

  /**
   * Complete processing for an import placeholder
   * @param {string} importId - The import ID
   * @param {object} fullImportData - The complete import data
   */
  completeProcessing(importId, fullImportData) {
    const imp = this.imports.get(importId);
    if (imp) {
      // Merge full data into the placeholder
      Object.assign(imp, fullImportData, {
        status: 'ready',
        processingProgress: undefined,
        processingMessage: undefined,
        updatedAt: new Date().toISOString()
      });
      this.notifyListeners('import_ready', imp);
    }
  }

  /**
   * Create an import from a file
   * @param {File} file - The file to import
   * @param {Object} options - Import options
   * @param {string[]} options.headerOverride - Override headers (use for recovery of malformed CSVs)
   *   Example: "UniqueId,Subject,Detail,CreatedAt,LastModified,Date,Creator,Updater,Import,MatterId,Matter".split(',')
   */
  async createImportFromFile(file, options = {}) {
    const importId = this.generateImportId();
    const startTime = Date.now();

    // Extract file metadata
    const fileMetadata = this.extractFileMetadata(file);

    // Parse file content based on type
    const parseResult = await this.parseFile(file, options);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    // Analyze schema and data quality using robust type detection
    const schemaAnalysis = this.analyzeSchema(parseResult.rows, parseResult.headers);
    const qualityAnalysis = this.analyzeDataQuality(parseResult.rows, schemaAnalysis);
    const relationshipHints = this.detectRelationshipHints(schemaAnalysis, parseResult.rows);

    // Perform robust type detection and create assessment
    const typeDetectionResults = this.typeDetector.analyzeDataset(parseResult.rows, parseResult.headers);
    const typeAssessment = this.typeDetector.createTypeAssessment(typeDetectionResults);

    // Merge robust type detection into inferred types (prefer robust detection)
    for (const header of parseResult.headers) {
      if (typeDetectionResults[header]) {
        const robustResult = typeDetectionResults[header];
        // Use robust detection if confidence is reasonable
        if (robustResult.confidence >= 0.5) {
          schemaAnalysis.inferredTypes[header] = robustResult.type;
          // Store detailed detection info
          if (schemaAnalysis.columns[header]) {
            schemaAnalysis.columns[header].robustDetection = robustResult;
          }
        }
      }
    }

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

      // Type assessment with confidence scores and alternatives
      typeAssessment,

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
   * Re-import a file with header override for recovering malformed CSVs
   * Use this when a CSV was imported incorrectly (e.g., each cell got its own row)
   *
   * @param {File} file - The original file to re-import
   * @param {string} headerString - Comma-separated header names, e.g., "UniqueId,Subject,Detail,CreatedAt"
   * @returns {Promise<Object>} - Import result
   *
   * @example
   * // Re-import with recovered headers
   * const result = await importManager.reimportWithHeaders(
   *   file,
   *   "UniqueId,Subject,Detail,CreatedAt,LastModified,Date,Creator,Updater,Import,MatterId,Matter"
   * );
   */
  async reimportWithHeaders(file, headerString) {
    const headers = headerString.split(',').map(h => h.trim());
    return this.createImportFromFile(file, { headerOverride: headers });
  }

  /**
   * Detect if a parsed CSV might have multi-line field issues
   * Returns true if the parsing looks suspicious (too many rows with few columns)
   */
  detectMalformedParsing(parseResult) {
    if (!parseResult.success || !parseResult.rows || parseResult.rows.length < 10) {
      return { suspicious: false };
    }

    const headers = parseResult.headers || [];
    const rows = parseResult.rows;

    // Check if most rows have only 1-2 columns when we expect more
    const singleColumnRows = rows.filter(row => {
      const nonEmptyFields = Object.values(row).filter(v => v && v.toString().trim()).length;
      return nonEmptyFields <= 2;
    }).length;

    const ratio = singleColumnRows / rows.length;

    // If more than 70% of rows have only 1-2 values, parsing is likely broken
    if (ratio > 0.7 && headers.length <= 3) {
      return {
        suspicious: true,
        reason: 'Most rows have only 1-2 values, suggesting multi-line fields were split incorrectly',
        suggestion: 'Try re-importing with the correct header string using reimportWithHeaders()',
        singleColumnRatio: ratio
      };
    }

    return { suspicious: false };
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
   * @param {File} file - The file to parse
   * @param {Object} options - Parsing options
   * @param {string[]} options.headerOverride - Override headers if file has none/malformed headers
   */
  async parseFile(file, options = {}) {
    const format = this.getFileFormat(file.name);

    try {
      switch (format) {
        case 'csv':
        case 'tsv':
          return await this.parseCsv(file, format === 'tsv' ? '\t' : ',', options);
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
   * Parse CSV/TSV file with proper multi-line quoted field support
   * @param {File} file - The file to parse
   * @param {string} delimiter - Field delimiter (comma or tab)
   * @param {Object} options - Parsing options
   * @param {string[]} options.headerOverride - Override headers if file has none/malformed headers
   * @param {Function} options.onProgress - Progress callback for large files (percentage, recordCount)
   */
  async parseCsv(file, delimiter = ',', options = {}) {
    // Use chunked parsing for large files (> 10MB)
    const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;
    if (file.size > LARGE_FILE_THRESHOLD) {
      console.log(`Large file detected (${(file.size / 1024 / 1024).toFixed(1)}MB), using chunked parsing`);
      return this.parseCsvChunked(file, delimiter, options, options.onProgress);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;

          // Parse records handling multi-line quoted fields properly
          const records = this.parseCsvText(text, delimiter);

          if (records.length === 0) {
            resolve({ success: false, error: 'Empty file' });
            return;
          }

          // Use override headers or first record as headers
          let headers;
          let dataStartIndex;

          if (options.headerOverride && options.headerOverride.length > 0) {
            headers = options.headerOverride;
            dataStartIndex = 0; // All records are data
          } else {
            headers = records[0];
            dataStartIndex = 1;
          }

          // Parse rows
          const rows = [];
          for (let i = dataStartIndex; i < records.length; i++) {
            const values = records[i];
            if (values.length > 0 && values.some(v => v.trim() !== '')) {
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
            lineCount: records.length,
            hasHeaderRow: !options.headerOverride
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
   * Parse CSV text into array of records, properly handling multi-line quoted fields
   * This is RFC 4180 compliant CSV parsing
   */
  parseCsvText(text, delimiter = ',') {
    const records = [];
    let currentRecord = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote ("") -> add single quote to field
            currentField += '"';
            i += 2;
          } else {
            // End of quoted field
            inQuotes = false;
            i++;
          }
        } else {
          // Regular character inside quotes (including newlines)
          currentField += char;
          i++;
        }
      } else {
        if (char === '"') {
          // Start of quoted field
          inQuotes = true;
          i++;
        } else if (char === delimiter) {
          // End of field
          currentRecord.push(currentField.trim());
          currentField = '';
          i++;
        } else if (char === '\r' && nextChar === '\n') {
          // CRLF line ending - end of record
          currentRecord.push(currentField.trim());
          if (currentRecord.length > 0) {
            records.push(currentRecord);
          }
          currentRecord = [];
          currentField = '';
          i += 2;
        } else if (char === '\n' || char === '\r') {
          // LF or CR line ending - end of record
          currentRecord.push(currentField.trim());
          if (currentRecord.length > 0) {
            records.push(currentRecord);
          }
          currentRecord = [];
          currentField = '';
          i++;
        } else {
          // Regular character
          currentField += char;
          i++;
        }
      }
    }

    // Don't forget the last field/record
    if (currentField || currentRecord.length > 0) {
      currentRecord.push(currentField.trim());
      if (currentRecord.some(f => f !== '')) {
        records.push(currentRecord);
      }
    }

    return records;
  }

  /**
   * Parse a single CSV line handling quotes (kept for backwards compatibility)
   */
  parseCsvLine(line, delimiter = ',') {
    const records = this.parseCsvText(line, delimiter);
    return records.length > 0 ? records[0] : [];
  }

  /**
   * Parse large CSV file in chunks for better memory management
   * Processes data in batches and yields to UI thread to prevent freezing
   * @param {File} file - The file to parse
   * @param {string} delimiter - Field delimiter
   * @param {Object} options - Parsing options
   * @param {Function} onProgress - Progress callback (percentage, recordCount)
   */
  async parseCsvChunked(file, delimiter = ',', options = {}, onProgress = null) {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const BATCH_YIELD_SIZE = 1000; // Yield to UI every N records

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      let records = [];
      let headers = null;
      let offset = 0;
      let leftover = '';
      let inQuotes = false;
      let totalBytes = file.size;

      const processChunk = async (chunk, isFinal = false) => {
        const text = leftover + chunk;
        let currentRecord = [];
        let currentField = '';
        let i = 0;
        let lastSafeBreak = 0;

        while (i < text.length) {
          const char = text[i];
          const nextChar = text[i + 1];

          if (inQuotes) {
            if (char === '"') {
              if (nextChar === '"') {
                currentField += '"';
                i += 2;
              } else {
                inQuotes = false;
                i++;
              }
            } else {
              currentField += char;
              i++;
            }
          } else {
            if (char === '"') {
              inQuotes = true;
              i++;
            } else if (char === delimiter) {
              currentRecord.push(currentField.trim());
              currentField = '';
              i++;
            } else if (char === '\r' && nextChar === '\n') {
              currentRecord.push(currentField.trim());
              if (currentRecord.length > 0) {
                if (!headers) {
                  headers = options.headerOverride || currentRecord;
                  if (!options.headerOverride) currentRecord = null;
                }
                if (currentRecord) {
                  records.push(currentRecord);
                }
              }
              currentRecord = [];
              currentField = '';
              i += 2;
              lastSafeBreak = i;
            } else if (char === '\n' || char === '\r') {
              currentRecord.push(currentField.trim());
              if (currentRecord.length > 0) {
                if (!headers) {
                  headers = options.headerOverride || currentRecord;
                  if (!options.headerOverride) currentRecord = null;
                }
                if (currentRecord) {
                  records.push(currentRecord);
                }
              }
              currentRecord = [];
              currentField = '';
              i++;
              lastSafeBreak = i;
            } else {
              currentField += char;
              i++;
            }
          }

          // Yield to UI periodically
          if (records.length > 0 && records.length % BATCH_YIELD_SIZE === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
        }

        if (isFinal) {
          // Process any remaining content
          if (currentField || currentRecord.length > 0) {
            currentRecord.push(currentField.trim());
            if (currentRecord.some(f => f !== '')) {
              records.push(currentRecord);
            }
          }
          leftover = '';
        } else {
          // Keep leftover for next chunk (from last safe break point)
          if (inQuotes) {
            // We're in the middle of a quoted field - keep everything from field start
            leftover = text.substring(lastSafeBreak);
          } else {
            leftover = text.substring(lastSafeBreak) + currentField;
            currentField = '';
          }
        }
      };

      const readNextChunk = () => {
        if (offset >= totalBytes) {
          // Final processing
          processChunk('', true).then(() => {
            // Convert records to rows
            const rows = records.map((values, idx) => {
              const row = {};
              (headers || []).forEach((header, i) => {
                row[header] = values[i] !== undefined ? values[i] : '';
              });
              row._sourceRow = idx + 1;
              return row;
            });

            resolve({
              success: true,
              headers: headers || [],
              rows,
              format: 'csv',
              delimiter,
              encoding: 'utf-8',
              lineCount: records.length + 1,
              hasHeaderRow: !options.headerOverride,
              chunkedParse: true
            });
          });
          return;
        }

        const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, totalBytes));
        const chunkReader = new FileReader();

        chunkReader.onload = async (e) => {
          await processChunk(e.target.result, false);
          offset += CHUNK_SIZE;

          if (onProgress) {
            onProgress(Math.min(100, Math.round((offset / totalBytes) * 100)), records.length);
          }

          // Continue reading
          readNextChunk();
        };

        chunkReader.onerror = () => reject(new Error('Failed to read file chunk'));
        chunkReader.readAsText(slice);
      };

      readNextChunk();
    });
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

  // ============================================
  // Type Assessment Review Methods
  // ============================================

  /**
   * Get type assessment summary for an import
   * @param {string} importId - The import ID
   * @returns {Object|null} Assessment summary or null if not found
   */
  getTypeAssessmentSummary(importId) {
    const importObj = this.imports.get(importId);
    if (!importObj || !importObj.typeAssessment) return null;

    const assessment = importObj.typeAssessment;
    return {
      importId,
      importName: importObj.name,
      summary: assessment.summary,
      fieldsNeedingReview: assessment.summary.needsReview.map(fieldName => ({
        fieldName,
        ...assessment.fields[fieldName]
      }))
    };
  }

  /**
   * Get detailed type assessment for a specific field
   * @param {string} importId - The import ID
   * @param {string} fieldName - The field name
   * @returns {Object|null} Field assessment or null
   */
  getFieldTypeAssessment(importId, fieldName) {
    const importObj = this.imports.get(importId);
    if (!importObj || !importObj.typeAssessment) return null;

    const fieldAssessment = importObj.typeAssessment.fields[fieldName];
    if (!fieldAssessment) return null;

    // Include sample values from the data
    const samples = importObj.rows
      .slice(0, 10)
      .map(row => row[fieldName])
      .filter(v => v !== null && v !== undefined && String(v).trim() !== '');

    return {
      fieldName,
      ...fieldAssessment,
      sampleValues: samples.slice(0, 5)
    };
  }

  /**
   * Override the detected type for a field
   * @param {string} importId - The import ID
   * @param {string} fieldName - The field name
   * @param {string} newType - The new type to use
   * @param {Object} config - Optional configuration for the type
   * @returns {boolean} Success
   */
  overrideFieldType(importId, fieldName, newType, config = {}) {
    const importObj = this.imports.get(importId);
    if (!importObj) return false;

    // Update inferred types
    if (importObj.schema && importObj.schema.inferredTypes) {
      importObj.schema.inferredTypes[fieldName] = newType;
    }

    // Record the override in assessment
    if (importObj.typeAssessment && importObj.typeAssessment.fields[fieldName]) {
      importObj.typeAssessment.fields[fieldName].userOverride = {
        type: newType,
        config,
        overriddenAt: new Date().toISOString()
      };
      importObj.typeAssessment.fields[fieldName].needsReview = false;

      // Update needs review list
      const idx = importObj.typeAssessment.summary.needsReview.indexOf(fieldName);
      if (idx > -1) {
        importObj.typeAssessment.summary.needsReview.splice(idx, 1);
      }
    }

    // Update the column analysis
    if (importObj.schema && importObj.schema.columns[fieldName]) {
      importObj.schema.columns[fieldName].userOverriddenType = newType;
      importObj.schema.columns[fieldName].userConfig = config;
    }

    importObj.updatedAt = new Date().toISOString();
    this.notifyListeners('type_override', { importId, fieldName, newType, config });

    return true;
  }

  /**
   * Accept the detected type for a field (mark as reviewed)
   * @param {string} importId - The import ID
   * @param {string} fieldName - The field name
   * @returns {boolean} Success
   */
  acceptFieldType(importId, fieldName) {
    const importObj = this.imports.get(importId);
    if (!importObj || !importObj.typeAssessment) return false;

    const field = importObj.typeAssessment.fields[fieldName];
    if (!field) return false;

    field.needsReview = false;
    field.acceptedAt = new Date().toISOString();

    // Update needs review list
    const idx = importObj.typeAssessment.summary.needsReview.indexOf(fieldName);
    if (idx > -1) {
      importObj.typeAssessment.summary.needsReview.splice(idx, 1);
    }

    importObj.updatedAt = new Date().toISOString();
    this.notifyListeners('type_accepted', { importId, fieldName });

    return true;
  }

  /**
   * Accept all detected types (mark entire import as reviewed)
   * @param {string} importId - The import ID
   * @returns {boolean} Success
   */
  acceptAllFieldTypes(importId) {
    const importObj = this.imports.get(importId);
    if (!importObj || !importObj.typeAssessment) return false;

    for (const fieldName of Object.keys(importObj.typeAssessment.fields)) {
      importObj.typeAssessment.fields[fieldName].needsReview = false;
      importObj.typeAssessment.fields[fieldName].acceptedAt = new Date().toISOString();
    }

    importObj.typeAssessment.summary.needsReview = [];
    importObj.updatedAt = new Date().toISOString();
    this.notifyListeners('all_types_accepted', { importId });

    return true;
  }

  /**
   * Re-run type detection for an import with new options
   * @param {string} importId - The import ID
   * @param {Object} options - New detection options
   * @returns {Object|null} Updated assessment or null
   */
  redetectTypes(importId, options = {}) {
    const importObj = this.imports.get(importId);
    if (!importObj || !importObj.rows || !importObj.headers) return null;

    // Create a new detector with updated options
    const detector = new EOTypeDetector({
      ...this.typeDetector.options,
      ...options
    });

    // Re-run detection
    const typeDetectionResults = detector.analyzeDataset(importObj.rows, importObj.headers);
    const typeAssessment = detector.createTypeAssessment(typeDetectionResults);

    // Preserve user overrides
    if (importObj.typeAssessment) {
      for (const [fieldName, field] of Object.entries(importObj.typeAssessment.fields)) {
        if (field.userOverride && typeAssessment.fields[fieldName]) {
          typeAssessment.fields[fieldName].userOverride = field.userOverride;
          typeAssessment.fields[fieldName].needsReview = false;
        }
      }
    }

    // Update import object
    importObj.typeAssessment = typeAssessment;

    // Update inferred types
    for (const header of importObj.headers) {
      if (typeDetectionResults[header] && typeDetectionResults[header].confidence >= 0.5) {
        importObj.schema.inferredTypes[header] = typeDetectionResults[header].type;
        if (importObj.schema.columns[header]) {
          importObj.schema.columns[header].robustDetection = typeDetectionResults[header];
        }
      }
    }

    importObj.updatedAt = new Date().toISOString();
    this.notifyListeners('types_redetected', { importId, assessment: typeAssessment });

    return typeAssessment;
  }

  /**
   * Get confidence breakdown for all fields
   * @param {string} importId - The import ID
   * @returns {Object|null} Confidence breakdown or null
   */
  getConfidenceBreakdown(importId) {
    const importObj = this.imports.get(importId);
    if (!importObj || !importObj.typeAssessment) return null;

    const breakdown = {
      high: [],
      medium: [],
      low: [],
      uncertain: []
    };

    for (const [fieldName, field] of Object.entries(importObj.typeAssessment.fields)) {
      const level = field.confidenceLevel;
      breakdown[level].push({
        fieldName,
        type: field.detectedType,
        confidence: field.confidence,
        alternatives: field.alternatives
      });
    }

    return breakdown;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOImportManager;
}

if (typeof window !== 'undefined') {
  window.EOImportManager = EOImportManager;
}
