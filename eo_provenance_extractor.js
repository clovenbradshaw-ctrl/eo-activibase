/**
 * EO Provenance Extractor
 * Automatically extracts maximum provenance from CSV imports
 *
 * 4-Tier Extraction:
 * 1. Silent auto-extraction (file metadata, filename patterns, embedded metadata)
 * 2. Confident inferences (source systems, jurisdictions, scales)
 * 3. High-value user input (frame, authority, trust level)
 * 4. Column-level provenance (definitions, methods, external links)
 */

class EOProvenanceExtractor {
  constructor() {
    // Detection patterns for various provenance markers
    this.patterns = {
      sourceSystems: [
        { pattern: /salesforce|sfdc/i, name: 'Salesforce', confidence: 0.95 },
        { pattern: /stripe/i, name: 'Stripe', confidence: 0.95 },
        { pattern: /quickbooks|qbo/i, name: 'QuickBooks', confidence: 0.90 },
        { pattern: /hubspot/i, name: 'HubSpot', confidence: 0.95 },
        { pattern: /zendesk/i, name: 'Zendesk', confidence: 0.90 },
        { pattern: /jira/i, name: 'Jira', confidence: 0.90 },
        { pattern: /shopify/i, name: 'Shopify', confidence: 0.95 },
        { pattern: /google[_-]analytics|ga4/i, name: 'Google Analytics', confidence: 0.85 },
        { pattern: /aws|amazon[_-]web/i, name: 'AWS', confidence: 0.80 },
        { pattern: /azure/i, name: 'Azure', confidence: 0.80 },
        { pattern: /postgres|postgresql/i, name: 'PostgreSQL', confidence: 0.85 },
        { pattern: /mysql/i, name: 'MySQL', confidence: 0.85 }
      ],

      jurisdictions: [
        { pattern: /gaap/i, name: 'US GAAP', confidence: 0.90 },
        { pattern: /ifrs/i, name: 'IFRS', confidence: 0.90 },
        { pattern: /sox|sarbanes[_-]oxley/i, name: 'SOX', confidence: 0.95 },
        { pattern: /gdpr/i, name: 'GDPR', confidence: 0.95 },
        { pattern: /hipaa/i, name: 'HIPAA', confidence: 0.95 },
        { pattern: /iso[_-]?(\d+)/i, name: 'ISO Standard', confidence: 0.85 }
      ],

      frames: [
        { pattern: /financ(e|ial)|accounting|gaap|ifrs/i, name: 'financial_reporting', confidence: 0.85 },
        { pattern: /operations?|ops|operational/i, name: 'operational', confidence: 0.80 },
        { pattern: /sales|revenue|mrr|arr/i, name: 'sales_metrics', confidence: 0.75 },
        { pattern: /product|usage|engagement/i, name: 'product_analytics', confidence: 0.75 },
        { pattern: /hr|human[_-]resources|employee/i, name: 'hr', confidence: 0.80 },
        { pattern: /legal|compliance|audit/i, name: 'legal_compliance', confidence: 0.85 },
        { pattern: /research|scientific|experiment/i, name: 'scientific', confidence: 0.80 }
      ],

      versions: /[_-]v(\d+)|[_-](draft|final|approved|revision|rev)(\d*)/i,

      orgUnits: [
        { pattern: /^finance[_-]/i, name: 'Finance', confidence: 0.90 },
        { pattern: /^sales[_-]/i, name: 'Sales', confidence: 0.90 },
        { pattern: /^ops[_-]|^operations[_-]/i, name: 'Operations', confidence: 0.90 },
        { pattern: /^hr[_-]|^people[_-]/i, name: 'HR', confidence: 0.90 },
        { pattern: /^marketing[_-]/i, name: 'Marketing', confidence: 0.90 },
        { pattern: /^eng[_-]|^engineering[_-]/i, name: 'Engineering', confidence: 0.90 },
        { pattern: /^product[_-]/i, name: 'Product', confidence: 0.90 }
      ],

      dataTypes: [
        { pattern: /account|customer|client/i, name: 'accounts', confidence: 0.85 },
        { pattern: /transaction|payment|invoice/i, name: 'transactions', confidence: 0.85 },
        { pattern: /contact|person|user/i, name: 'contacts', confidence: 0.85 },
        { pattern: /revenue|sales|deal/i, name: 'revenue', confidence: 0.80 },
        { pattern: /employee|staff/i, name: 'employees', confidence: 0.85 },
        { pattern: /project|initiative/i, name: 'projects', confidence: 0.80 },
        { pattern: /ticket|issue|case/i, name: 'support_tickets', confidence: 0.85 }
      ],

      externalIdPatterns: [
        { pattern: /^(sfdc|salesforce)[_-]?id$/i, system: 'Salesforce', confidence: 0.95 },
        { pattern: /^stripe[_-]?(customer|payment|subscription)[_-]?id$/i, system: 'Stripe', confidence: 0.95 },
        { pattern: /^qb[o]?[_-]?id$/i, system: 'QuickBooks', confidence: 0.90 },
        { pattern: /^hubspot[_-]?id$/i, system: 'HubSpot', confidence: 0.95 },
        { pattern: /^external[_-]?id$/i, system: 'External System', confidence: 0.60 },
        { pattern: /[_-]?uuid$/i, system: 'UUID', confidence: 0.70 }
      ],

      timestampPatterns: [
        /created[_-]?(at|date|time)/i,
        /updated[_-]?(at|date|time)/i,
        /modified[_-]?(at|date|time)/i,
        /effective[_-]?(date|time)/i,
        /timestamp/i,
        /date/i
      ],

      definitionPatterns: [
        /_definition$/i,
        /_definition_id$/i,
        /_def$/i,
        /_type$/i,
        /_category$/i
      ],

      jurisdictionColumnPatterns: [
        /currency[_-]?code/i,
        /country[_-]?code/i,
        /region/i,
        /locale/i,
        /standard/i
      ]
    };
  }

  /**
   * Full extraction pipeline - Tiers 1-4
   */
  extractFullProvenance(file, csvText, headers, rows) {
    // Tier 1: Silent extraction
    const fileMetadata = this.extractFileMetadata(file);
    const embeddedMetadata = this.extractEmbeddedMetadata(csvText);
    const filenameProvenance = this.parseFilenameProvenance(file.name);
    const headerAnalysis = this.analyzeHeaders(headers);
    const valueShapes = this.analyzeValueShapes(rows, headers);

    // Tier 2: Confident inferences
    const inferred = this.makeInferences({
      fileMetadata,
      embeddedMetadata,
      filenameProvenance,
      headerAnalysis,
      valueShapes
    });

    // Calculate confidence scores
    const confidence = this.calculateConfidence(inferred);

    return {
      file: fileMetadata,
      embedded: embeddedMetadata,
      filename: filenameProvenance,
      schema: headerAnalysis,
      values: valueShapes,
      inferred,
      confidence
    };
  }

  /**
   * Tier 1A: Extract file system metadata
   */
  extractFileMetadata(file) {
    if (!file) return {};

    return {
      filename: file.name,
      size: file.size,
      mimeType: file.type || 'text/csv',
      lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      // Clean filename without extension
      basename: file.name.replace(/\.(csv|tsv|txt)$/i, '')
    };
  }

  /**
   * Tier 1B: Extract embedded metadata from CSV comments
   */
  extractEmbeddedMetadata(csvText) {
    if (!csvText) return {};

    const metadata = {};
    const lines = csvText.split('\n').slice(0, 20); // Check first 20 lines

    lines.forEach(line => {
      const trimmed = line.trim();

      // Common metadata patterns
      if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
        const content = trimmed.substring(trimmed.startsWith('//') ? 2 : 1).trim();
        const colonIndex = content.indexOf(':');

        if (colonIndex > 0) {
          const key = content.substring(0, colonIndex).trim().toLowerCase().replace(/\s+/g, '_');
          const value = content.substring(colonIndex + 1).trim();

          if (key && value) {
            metadata[key] = value;
          }
        }
      }
    });

    return metadata;
  }

  /**
   * Tier 1C: Parse filename for provenance markers
   */
  parseFilenameProvenance(filename) {
    if (!filename) return {};

    const provenance = {
      original: filename,
      basename: filename.replace(/\.(csv|tsv|txt)$/i, '')
    };

    // Detect source system
    const sourceMatch = this.detectPattern(filename, this.patterns.sourceSystems);
    if (sourceMatch) {
      provenance.sourceSystem = sourceMatch.name;
      provenance.sourceSystemConfidence = sourceMatch.confidence;
    }

    // Detect jurisdiction
    const jurisdictionMatch = this.detectPattern(filename, this.patterns.jurisdictions);
    if (jurisdictionMatch) {
      provenance.jurisdiction = jurisdictionMatch.name;
      provenance.jurisdictionConfidence = jurisdictionMatch.confidence;
    }

    // Detect frame
    const frameMatch = this.detectPattern(filename, this.patterns.frames);
    if (frameMatch) {
      provenance.frame = frameMatch.name;
      provenance.frameConfidence = frameMatch.confidence;
    }

    // Detect organizational unit
    const orgUnitMatch = this.detectPattern(filename, this.patterns.orgUnits);
    if (orgUnitMatch) {
      provenance.organizationalUnit = orgUnitMatch.name;
      provenance.orgUnitConfidence = orgUnitMatch.confidence;
    }

    // Detect data type
    const dataTypeMatch = this.detectPattern(filename, this.patterns.dataTypes);
    if (dataTypeMatch) {
      provenance.dataType = dataTypeMatch.name;
      provenance.dataTypeConfidence = dataTypeMatch.confidence;
    }

    // Detect version
    const versionMatch = filename.match(this.patterns.versions);
    if (versionMatch) {
      provenance.version = versionMatch[0];
      provenance.versionConfidence = 0.95;
    }

    // Detect timeframe (reuse existing logic from eo_context_engine.js)
    provenance.timeframe = this.extractTimeframe(filename);

    return provenance;
  }

  /**
   * Tier 1D: Analyze CSV headers for semantic markers
   */
  analyzeHeaders(headers) {
    if (!headers || !headers.length) return {};

    const analysis = {
      totalColumns: headers.length,
      externalIds: [],
      timestamps: [],
      definitionColumns: [],
      jurisdictionMarkers: [],
      schemaStandard: null
    };

    headers.forEach(header => {
      const normalized = header.toLowerCase().trim();

      // Check for external ID columns
      this.patterns.externalIdPatterns.forEach(pattern => {
        if (pattern.pattern.test(normalized)) {
          analysis.externalIds.push({
            column: header,
            system: pattern.system,
            confidence: pattern.confidence
          });
        }
      });

      // Check for timestamp columns
      this.patterns.timestampPatterns.forEach(pattern => {
        if (pattern.test(normalized)) {
          analysis.timestamps.push(header);
        }
      });

      // Check for definition columns
      this.patterns.definitionPatterns.forEach(pattern => {
        if (pattern.test(normalized)) {
          analysis.definitionColumns.push(header);
        }
      });

      // Check for jurisdiction markers
      this.patterns.jurisdictionColumnPatterns.forEach(pattern => {
        if (pattern.test(normalized)) {
          analysis.jurisdictionMarkers.push(header);
        }
      });
    });

    // Infer schema standard
    analysis.schemaStandard = this.inferSchemaStandard(headers);

    return analysis;
  }

  /**
   * Tier 1E: Analyze value shapes for ontological clues
   */
  analyzeValueShapes(rows, headers) {
    if (!rows || !rows.length || !headers || !headers.length) return [];

    const sampleSize = Math.min(50, rows.length);
    const sample = rows.slice(0, sampleSize);

    return headers.map(header => {
      const values = sample.map(r => r[header]).filter(v => v !== null && v !== undefined && v !== '');

      if (values.length === 0) {
        return {
          header,
          dataType: 'unknown',
          hasNulls: true,
          uniqueness: 0,
          patterns: [],
          scale: null
        };
      }

      const uniqueValues = new Set(values);
      const uniqueness = uniqueValues.size / values.length;

      return {
        header,
        dataType: this.inferDataType(values),
        hasNulls: values.length < sampleSize,
        uniqueness,
        cardinality: uniqueValues.size,
        patterns: this.detectValuePatterns(values),
        scale: this.inferScaleFromValues(header, values),
        sampleValues: Array.from(uniqueValues).slice(0, 5)
      };
    });
  }

  /**
   * Tier 2: Make confident inferences from extracted data
   */
  makeInferences(extracted) {
    const { fileMetadata, embeddedMetadata, filenameProvenance, headerAnalysis, valueShapes } = extracted;

    return {
      sourceSystem: this.inferSourceSystem({ filenameProvenance, headerAnalysis, embeddedMetadata }),
      jurisdiction: this.inferJurisdiction({ filenameProvenance, headerAnalysis, valueShapes }),
      frame: this.inferFrame({ filenameProvenance, headerAnalysis, valueShapes }),
      method: this.inferMethod({ headerAnalysis, valueShapes }),
      scale: this.inferScale({ filenameProvenance, headerAnalysis, valueShapes }),
      dataType: filenameProvenance.dataType || 'records',
      organizationalUnit: filenameProvenance.organizationalUnit,
      version: filenameProvenance.version,
      externalLinks: this.detectExternalLinks({ headerAnalysis, valueShapes }),
      timeframe: filenameProvenance.timeframe
    };
  }

  /**
   * Infer source system from multiple signals
   */
  inferSourceSystem({ filenameProvenance, headerAnalysis, embeddedMetadata }) {
    // Priority 1: Embedded metadata
    if (embeddedMetadata.source || embeddedMetadata.system) {
      return { name: embeddedMetadata.source || embeddedMetadata.system, confidence: 0.95 };
    }

    // Priority 2: Filename
    if (filenameProvenance.sourceSystem) {
      return { name: filenameProvenance.sourceSystem, confidence: filenameProvenance.sourceSystemConfidence };
    }

    // Priority 3: External ID columns
    if (headerAnalysis.externalIds && headerAnalysis.externalIds.length > 0) {
      const bestMatch = headerAnalysis.externalIds.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
      return { name: bestMatch.system, confidence: bestMatch.confidence * 0.8 }; // Reduce confidence slightly
    }

    return null;
  }

  /**
   * Infer jurisdiction from multiple signals
   */
  inferJurisdiction({ filenameProvenance, headerAnalysis, valueShapes }) {
    // Priority 1: Filename
    if (filenameProvenance.jurisdiction) {
      return { name: filenameProvenance.jurisdiction, confidence: filenameProvenance.jurisdictionConfidence };
    }

    // Priority 2: Currency code or country code in data
    if (headerAnalysis.jurisdictionMarkers && headerAnalysis.jurisdictionMarkers.length > 0) {
      const marker = headerAnalysis.jurisdictionMarkers[0];
      return { name: `detected_from_${marker}`, confidence: 0.70 };
    }

    return null;
  }

  /**
   * Infer conceptual frame from context
   */
  inferFrame({ filenameProvenance, headerAnalysis, valueShapes }) {
    // Priority 1: Filename
    if (filenameProvenance.frame) {
      return { name: filenameProvenance.frame, confidence: filenameProvenance.frameConfidence };
    }

    // Priority 2: Column patterns
    const financialTerms = ['revenue', 'expense', 'cost', 'profit', 'loss', 'asset', 'liability'];
    const operationalTerms = ['count', 'volume', 'capacity', 'utilization', 'efficiency'];
    const salesTerms = ['deal', 'opportunity', 'mrr', 'arr', 'churn', 'ltv'];

    const columnText = (headerAnalysis.externalIds || [])
      .map(e => e.column)
      .concat(valueShapes.map(v => v.header))
      .join(' ')
      .toLowerCase();

    if (financialTerms.some(term => columnText.includes(term))) {
      return { name: 'financial_reporting', confidence: 0.75 };
    }

    if (salesTerms.some(term => columnText.includes(term))) {
      return { name: 'sales_metrics', confidence: 0.75 };
    }

    if (operationalTerms.some(term => columnText.includes(term))) {
      return { name: 'operational', confidence: 0.70 };
    }

    return { name: 'general', confidence: 0.50 };
  }

  /**
   * Infer method from data characteristics
   */
  inferMethod({ headerAnalysis, valueShapes }) {
    // If has timestamps and external IDs, likely measured/imported
    if (headerAnalysis.externalIds && headerAnalysis.externalIds.length > 0) {
      return { name: 'measured', confidence: 0.80 };
    }

    // If many numeric fields, likely measured
    const numericFields = valueShapes.filter(v => v.dataType === 'number' || v.dataType === 'currency');
    if (numericFields.length > valueShapes.length * 0.5) {
      return { name: 'measured', confidence: 0.70 };
    }

    return { name: 'declared', confidence: 0.60 };
  }

  /**
   * Infer scale from context
   */
  inferScale({ filenameProvenance, headerAnalysis, valueShapes }) {
    const columnText = valueShapes.map(v => v.header).join(' ').toLowerCase();

    if (columnText.includes('company') || columnText.includes('total') || columnText.includes('global')) {
      return { name: 'organization', confidence: 0.85 };
    }

    if (columnText.includes('department') || columnText.includes('division')) {
      return { name: 'department', confidence: 0.85 };
    }

    if (columnText.includes('team') || columnText.includes('group')) {
      return { name: 'team', confidence: 0.85 };
    }

    if (filenameProvenance.organizationalUnit) {
      return { name: 'department', confidence: 0.70 };
    }

    return { name: 'individual', confidence: 0.60 };
  }

  /**
   * Detect external system linkages
   */
  detectExternalLinks({ headerAnalysis, valueShapes }) {
    const links = [];

    if (headerAnalysis.externalIds) {
      headerAnalysis.externalIds.forEach(extId => {
        const valueShape = valueShapes.find(v => v.header === extId.column);

        links.push({
          system: extId.system,
          idColumn: extId.column,
          confidence: extId.confidence,
          sampleValues: valueShape ? valueShape.sampleValues : [],
          cardinality: valueShape ? valueShape.cardinality : 0
        });
      });
    }

    return links;
  }

  /**
   * Calculate confidence scores for all inferences
   */
  calculateConfidence(inferred) {
    return {
      sourceSystem: inferred.sourceSystem?.confidence || 0,
      jurisdiction: inferred.jurisdiction?.confidence || 0,
      frame: inferred.frame?.confidence || 0,
      method: inferred.method?.confidence || 0,
      scale: inferred.scale?.confidence || 0,
      externalLinks: inferred.externalLinks.length > 0 ? 0.90 : 0
    };
  }

  /**
   * Helper: Detect pattern match with confidence
   */
  detectPattern(text, patterns) {
    if (!text || !patterns) return null;

    for (const pattern of patterns) {
      if (pattern.pattern.test(text)) {
        return { name: pattern.name, confidence: pattern.confidence };
      }
    }

    return null;
  }

  /**
   * Helper: Infer data type from values
   */
  inferDataType(values) {
    if (!values || values.length === 0) return 'unknown';

    const sample = values.slice(0, 10);

    // Check for numbers
    const numericCount = sample.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
    if (numericCount > sample.length * 0.8) {
      // Check for currency indicators
      const hasCurrencySymbol = sample.some(v => /[$€£¥]/.test(String(v)));
      return hasCurrencySymbol ? 'currency' : 'number';
    }

    // Check for dates
    const dateCount = sample.filter(v => !isNaN(Date.parse(v))).length;
    if (dateCount > sample.length * 0.8) {
      return 'date';
    }

    // Check for booleans
    const boolCount = sample.filter(v =>
      ['true', 'false', 'yes', 'no', '1', '0'].includes(String(v).toLowerCase())
    ).length;
    if (boolCount > sample.length * 0.8) {
      return 'boolean';
    }

    // Check for URLs
    const urlCount = sample.filter(v => /^https?:\/\//.test(String(v))).length;
    if (urlCount > sample.length * 0.8) {
      return 'url';
    }

    // Check for emails
    const emailCount = sample.filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))).length;
    if (emailCount > sample.length * 0.8) {
      return 'email';
    }

    return 'text';
  }

  /**
   * Helper: Detect value patterns
   */
  detectValuePatterns(values) {
    const patterns = [];
    const sample = values.slice(0, 10);

    // UUID pattern
    if (sample.some(v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))) {
      patterns.push('uuid');
    }

    // ISO date pattern
    if (sample.some(v => /^\d{4}-\d{2}-\d{2}/.test(v))) {
      patterns.push('iso_date');
    }

    // Currency pattern
    if (sample.some(v => /[$€£¥]/.test(String(v)))) {
      patterns.push('currency');
    }

    // Phone number pattern
    if (sample.some(v => /^\+?[\d\s\-()]+$/.test(String(v)) && String(v).replace(/\D/g, '').length >= 10)) {
      patterns.push('phone');
    }

    return patterns;
  }

  /**
   * Helper: Infer scale from values
   */
  inferScaleFromValues(header, values) {
    const headerLower = header.toLowerCase();
    const uniqueCount = new Set(values).size;
    const totalCount = values.length;

    // High uniqueness suggests individual-level data
    if (uniqueCount / totalCount > 0.9) {
      return 'individual';
    }

    // Low uniqueness suggests aggregated data
    if (uniqueCount < 10) {
      if (headerLower.includes('team')) return 'team';
      if (headerLower.includes('department')) return 'department';
      if (headerLower.includes('company') || headerLower.includes('organization')) return 'organization';
    }

    return null;
  }

  /**
   * Helper: Infer schema standard from headers
   */
  inferSchemaStandard(headers) {
    const normalized = headers.map(h => h.toLowerCase().trim());

    // Common CRM fields
    const crmFields = ['first_name', 'last_name', 'email', 'phone', 'company'];
    if (crmFields.filter(f => normalized.includes(f)).length >= 3) {
      return 'crm_contact';
    }

    // Common accounting fields
    const accountingFields = ['account_number', 'debit', 'credit', 'balance'];
    if (accountingFields.filter(f => normalized.includes(f)).length >= 2) {
      return 'accounting';
    }

    // Common transaction fields
    const transactionFields = ['transaction_id', 'amount', 'date', 'status'];
    if (transactionFields.filter(f => normalized.includes(f)).length >= 3) {
      return 'transaction';
    }

    return null;
  }

  /**
   * Helper: Extract timeframe from filename (reused from eo_context_engine.js logic)
   */
  extractTimeframe(filename) {
    if (!filename) return null;

    const now = new Date();

    // Quarter pattern: Q1, Q2, Q3, Q4
    const quarterMatch = filename.match(/Q([1-4])[_\s-]*(\d{4})/i);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]);
      const year = parseInt(quarterMatch[2]);
      const startMonth = (quarter - 1) * 3;
      const endMonth = startMonth + 2;

      return {
        granularity: 'quarter',
        start: new Date(year, startMonth, 1).toISOString().split('T')[0],
        end: new Date(year, endMonth + 1, 0).toISOString().split('T')[0]
      };
    }

    // Year pattern: 2024, 2025, etc.
    const yearMatch = filename.match(/(\d{4})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (year >= 2000 && year <= 2100) {
        return {
          granularity: 'year',
          start: `${year}-01-01`,
          end: `${year}-12-31`
        };
      }
    }

    // Month pattern: Jan, January, 01, etc.
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthMatch = filename.toLowerCase().match(new RegExp(`(${monthNames.join('|')})`));
    if (monthMatch) {
      const monthIndex = monthNames.indexOf(monthMatch[1]);
      const year = now.getFullYear();

      return {
        granularity: 'month',
        start: new Date(year, monthIndex, 1).toISOString().split('T')[0],
        end: new Date(year, monthIndex + 1, 0).toISOString().split('T')[0]
      };
    }

    // Date pattern: YYYY-MM-DD
    const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      return {
        granularity: 'day',
        start: dateMatch[0],
        end: dateMatch[0]
      };
    }

    return null;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOProvenanceExtractor;
}

if (typeof window !== 'undefined') {
  window.EOProvenanceExtractor = EOProvenanceExtractor;
}
