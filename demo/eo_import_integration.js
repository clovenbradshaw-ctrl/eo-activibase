/**
 * EO Import Integration
 * Bridges the EOImportManager with the main application state
 *
 * Handles:
 * - Adding imports to sets with provenance tracking
 * - Creating sets from imports
 * - Joining/linking imports based on detected relationships
 * - View creation from imports
 */

class EOImportIntegration {
  constructor(options = {}) {
    this.importManager = options.importManager;
    this.state = options.state;
    this.callbacks = {
      onSetCreated: options.onSetCreated || (() => {}),
      onRecordsAdded: options.onRecordsAdded || (() => {}),
      onViewCreated: options.onViewCreated || (() => {}),
      showToast: options.showToast || ((msg) => console.log(msg)),
      createEvent: options.createEvent || (() => {}),
      switchSet: options.switchSet || (() => {})
    };
  }

  /**
   * Add an import to a set (existing or new)
   *
   * @param {string} importId - The import to add
   * @param {string|null} setId - Existing set ID, or null to create new
   * @param {string|null} newSetName - Name for new set (if setId is null)
   * @param {object} options - Additional options
   * @returns {object} Result with recordsAdded, setId, viewId
   */
  addImportToSet(importId, setId = null, newSetName = null, options = {}) {
    const imp = this.importManager?.getImport(importId);
    if (!imp) {
      return { success: false, error: 'Import not found' };
    }

    // Create new set if needed
    let targetSet;
    let targetSetId = setId;
    let createdNewSet = false;

    if (!setId) {
      // Create new set
      const setName = newSetName || imp.fileMetadata.filenameAnalysis.baseName || 'Imported Data';
      targetSetId = this.createSet(setName, imp);
      createdNewSet = true;
    }

    targetSet = this.state.sets.get(targetSetId);
    if (!targetSet) {
      return { success: false, error: 'Target set not found' };
    }

    // Map import columns to set fields
    const fieldMapping = this.mapImportToSetFields(imp, targetSet, options);

    // Create records with provenance
    const importTimestamp = Date.now();
    const recordsAdded = [];

    imp.rows.forEach((row, rowIndex) => {
      const record = this.createRecordWithProvenance(
        targetSet,
        row,
        fieldMapping,
        imp,
        rowIndex,
        importTimestamp
      );
      recordsAdded.push(record);
    });

    // Track usage in import
    this.importManager.trackUsage(importId, 'set', targetSetId, recordsAdded.length);

    // Create import view (temporary view showing just this import's records)
    const viewId = this.createImportView(targetSet, imp, recordsAdded, importTimestamp);

    // Create batch import event
    this.callbacks.createEvent(
      'Import Added to Set',
      'INS',
      { type: 'Set', id: targetSetId },
      {
        importId: imp.id,
        importName: imp.name,
        recordCount: recordsAdded.length,
        createdNewSet,
        viewId,
        timestamp: importTimestamp
      }
    );

    this.callbacks.showToast(`✓ Added ${recordsAdded.length} records from ${imp.name}`);
    this.callbacks.onRecordsAdded(targetSetId, recordsAdded);

    if (createdNewSet) {
      this.callbacks.onSetCreated(targetSetId);
    }

    // Switch to the new view
    this.callbacks.switchSet(targetSetId, viewId);

    return {
      success: true,
      setId: targetSetId,
      viewId,
      recordsAdded: recordsAdded.length,
      createdNewSet
    };
  }

  /**
   * Create a new set from an import
   */
  createSet(name, imp) {
    const setId = 'set_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Infer icon from entity type
    let icon = 'ph-squares-four';
    if (imp.fileMetadata.filenameAnalysis.entityHints.length > 0) {
      const entityIcons = {
        'order': 'ph-shopping-cart',
        'customer': 'ph-users',
        'product': 'ph-package',
        'invoice': 'ph-receipt',
        'transaction': 'ph-currency-dollar',
        'employee': 'ph-user-circle',
        'user': 'ph-user',
        'contact': 'ph-address-book',
        'company': 'ph-buildings',
        'payment': 'ph-credit-card',
        'line_item': 'ph-list-bullets',
        'sale': 'ph-chart-line-up',
        'inventory': 'ph-warehouse',
        'project': 'ph-folder-notch',
        'task': 'ph-check-square'
      };
      icon = entityIcons[imp.fileMetadata.filenameAnalysis.entityHints[0]] || icon;
    }

    // Create schema from import
    const schema = imp.headers.map(header => {
      const inferredType = imp.schema.inferredTypes[header];
      const colAnalysis = imp.schema.columns[header];

      return {
        id: this.slugifyFieldId(header),
        name: header,
        type: inferredType || 'TEXT',
        width: this.inferColumnWidth(colAnalysis),
        config: this.buildFieldConfig(header, inferredType, colAnalysis, imp)
      };
    });

    // Create the set
    const newSet = {
      id: setId,
      name,
      icon,
      worldId: this.state.currentWorldId,
      schema,
      records: new Map(),
      views: new Map(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Entity metadata from import
      entityType: imp.fileMetadata.filenameAnalysis.entityHints[0] || null,
      primaryKey: imp.schema.primaryKeyCandidate ? this.slugifyFieldId(imp.schema.primaryKeyCandidate) : null,

      // Import provenance
      importSources: [{
        importId: imp.id,
        importName: imp.name,
        addedAt: new Date().toISOString()
      }]
    };

    this.state.sets.set(setId, newSet);

    // Create default "All" view
    const allViewId = 'view_' + Date.now() + '_all';
    newSet.views.set(allViewId, {
      id: allViewId,
      name: 'All ' + name,
      type: 'grid',
      icon: 'ph-table',
      filters: [],
      sorts: [],
      visibleFields: schema.map(f => f.id),
      createdAt: new Date().toISOString()
    });

    return setId;
  }

  /**
   * Map import columns to set fields
   */
  mapImportToSetFields(imp, targetSet, options = {}) {
    const mapping = {};

    imp.headers.forEach(header => {
      const slugified = this.slugifyFieldId(header);

      // Check if field already exists in set
      let existingField = targetSet.schema.find(f =>
        f.id === slugified ||
        f.name.toLowerCase() === header.toLowerCase()
      );

      if (existingField) {
        mapping[header] = existingField.id;
      } else if (options.createMissingFields !== false) {
        // Create new field
        const inferredType = imp.schema.inferredTypes[header];
        const colAnalysis = imp.schema.columns[header];

        const newField = {
          id: slugified,
          name: header,
          type: inferredType || 'TEXT',
          width: this.inferColumnWidth(colAnalysis),
          config: this.buildFieldConfig(header, inferredType, colAnalysis, imp)
        };

        targetSet.schema.push(newField);

        // Add to all views
        targetSet.views.forEach(view => {
          if (!view.visibleFields) view.visibleFields = [];
          view.visibleFields.push(newField.id);
        });

        mapping[header] = newField.id;
      }
    });

    return mapping;
  }

  /**
   * Create a record with full provenance tracking
   */
  createRecordWithProvenance(targetSet, row, fieldMapping, imp, rowIndex, importTimestamp) {
    const recordId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Build record data
    const recordData = { id: recordId };

    Object.entries(fieldMapping).forEach(([header, fieldId]) => {
      const field = targetSet.schema.find(f => f.id === fieldId);
      let value = row[header];

      // Type coercion
      if (field) {
        value = this.coerceValue(value, field.type);
      }

      recordData[fieldId] = value;
    });

    // Add provenance metadata
    recordData._provenance = {
      importId: imp.id,
      importName: imp.name,
      sourceFormat: imp.source.format,
      sourceFile: imp.source.filename,
      sourceRow: row._sourceRow || rowIndex,
      importedAt: new Date(importTimestamp).toISOString(),
      importedBy: this.state.currentUser?.id || 'system',

      // File metadata
      fileLastModified: imp.source.lastModified,
      fileSize: imp.source.size,

      // Schema info at time of import
      schemaVersion: 1,
      columnMapping: { ...fieldMapping },

      // Detected metadata
      detectedTimeframe: imp.fileMetadata.filenameAnalysis.timeframe,
      detectedEntity: imp.fileMetadata.filenameAnalysis.entityHints[0] || null,
      sourceSystem: imp.fileMetadata.filenameAnalysis.sourceSystemHint,

      // Data quality at import
      dataQualityScore: imp.quality.score
    };

    // Add to set
    targetSet.records.set(recordId, recordData);

    return recordData;
  }

  /**
   * Create a view showing records from this import
   */
  createImportView(targetSet, imp, records, importTimestamp) {
    const viewId = 'view_import_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    // Base name from import filename
    const baseName = imp.name.replace(/\.[^/.]+$/, '');
    const viewName = `Import: ${baseName}`;

    const view = {
      id: viewId,
      name: viewName,
      type: 'grid',
      icon: '📥',
      setId: targetSet.id,

      // Filter to show only records from this import
      filters: [{
        id: 'provenance_filter_' + Date.now(),
        type: 'provenance',
        field: '_provenance.importId',
        operator: 'equals',
        value: imp.id
      }],

      sorts: [],
      visibleFields: targetSet.schema.map(f => f.id),

      // Mark as temporary/import view
      isTemporary: true,
      importMetadata: {
        importId: imp.id,
        filename: imp.name,
        timestamp: importTimestamp,
        recordCount: records.length,
        expiresAt: importTimestamp + (7 * 24 * 60 * 60 * 1000) // 7 days
      },

      createdAt: new Date().toISOString()
    };

    targetSet.views.set(viewId, view);

    // Also track in global views state if exists
    if (this.state.views) {
      this.state.views.set(viewId, {
        ...view,
        setId: targetSet.id
      });
    }

    return viewId;
  }

  /**
   * Create a joined view from multiple imports
   */
  createJoinedView(options) {
    const {
      name,
      leftImportId,
      rightImportId,
      leftColumn,
      rightColumn,
      joinType = 'left'
    } = options;

    const leftImp = this.importManager.getImport(leftImportId);
    const rightImp = this.importManager.getImport(rightImportId);

    if (!leftImp || !rightImp) {
      return { success: false, error: 'Imports not found' };
    }

    // Build lookup from right import
    const rightLookup = new Map();
    rightImp.rows.forEach(row => {
      const key = String(row[rightColumn] || '');
      if (key) {
        if (!rightLookup.has(key)) {
          rightLookup.set(key, []);
        }
        rightLookup.get(key).push(row);
      }
    });

    // Create joined set
    const setName = name || `${leftImp.fileMetadata.filenameAnalysis.baseName} + ${rightImp.fileMetadata.filenameAnalysis.baseName}`;
    const setId = this.createSet(setName, leftImp);
    const targetSet = this.state.sets.get(setId);

    // Add right import fields to schema
    rightImp.headers.forEach(header => {
      if (header === rightColumn) return; // Skip join column

      const slugified = this.slugifyFieldId(header);
      // Prefix with right table name to avoid conflicts
      const prefixedId = `${rightImp.fileMetadata.filenameAnalysis.baseName}_${slugified}`;

      const existingField = targetSet.schema.find(f => f.id === prefixedId);
      if (!existingField) {
        const inferredType = rightImp.schema.inferredTypes[header];
        targetSet.schema.push({
          id: prefixedId,
          name: `${rightImp.fileMetadata.filenameAnalysis.baseName}.${header}`,
          type: inferredType || 'TEXT',
          width: '150px',
          config: {},
          fromImport: rightImportId
        });
      }
    });

    // Create joined records
    const importTimestamp = Date.now();
    const recordsAdded = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    leftImp.rows.forEach((leftRow, rowIndex) => {
      const joinKey = String(leftRow[leftColumn] || '');
      const rightRows = rightLookup.get(joinKey);

      if (rightRows && rightRows.length > 0) {
        // Create record for each match (handle one-to-many)
        rightRows.forEach(rightRow => {
          const recordId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          const record = { id: recordId };

          // Left fields
          leftImp.headers.forEach(header => {
            record[this.slugifyFieldId(header)] = this.coerceValue(
              leftRow[header],
              leftImp.schema.inferredTypes[header] || 'TEXT'
            );
          });

          // Right fields
          rightImp.headers.forEach(header => {
            if (header === rightColumn) return;
            const prefixedId = `${rightImp.fileMetadata.filenameAnalysis.baseName}_${this.slugifyFieldId(header)}`;
            record[prefixedId] = this.coerceValue(
              rightRow[header],
              rightImp.schema.inferredTypes[header] || 'TEXT'
            );
          });

          // Provenance
          record._provenance = {
            type: 'joined',
            leftImportId: leftImp.id,
            rightImportId: rightImp.id,
            leftSourceRow: leftRow._sourceRow || rowIndex,
            rightSourceRow: rightRow._sourceRow,
            joinColumn: { left: leftColumn, right: rightColumn },
            importedAt: new Date(importTimestamp).toISOString()
          };

          targetSet.records.set(recordId, record);
          recordsAdded.push(record);
          matchedCount++;
        });
      } else if (joinType === 'left' || joinType === 'outer') {
        // No match - create record with nulls for right side
        const recordId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const record = { id: recordId };

        leftImp.headers.forEach(header => {
          record[this.slugifyFieldId(header)] = this.coerceValue(
            leftRow[header],
            leftImp.schema.inferredTypes[header] || 'TEXT'
          );
        });

        rightImp.headers.forEach(header => {
          if (header === rightColumn) return;
          const prefixedId = `${rightImp.fileMetadata.filenameAnalysis.baseName}_${this.slugifyFieldId(header)}`;
          record[prefixedId] = null;
        });

        record._provenance = {
          type: 'joined',
          leftImportId: leftImp.id,
          rightImportId: rightImp.id,
          leftSourceRow: leftRow._sourceRow || rowIndex,
          rightSourceRow: null,
          joinColumn: { left: leftColumn, right: rightColumn },
          unmatched: true,
          importedAt: new Date(importTimestamp).toISOString()
        };

        targetSet.records.set(recordId, record);
        recordsAdded.push(record);
        unmatchedCount++;
      }
    });

    // Track usage
    this.importManager.trackUsage(leftImportId, 'set', setId, recordsAdded.length);
    this.importManager.trackUsage(rightImportId, 'set', setId, matchedCount);

    // Create view
    const viewId = this.createImportView(targetSet, leftImp, recordsAdded, importTimestamp);

    this.callbacks.showToast(`✓ Joined ${matchedCount} matched + ${unmatchedCount} unmatched records`);

    return {
      success: true,
      setId,
      viewId,
      recordsAdded: recordsAdded.length,
      matchedCount,
      unmatchedCount
    };
  }

  /**
   * Get records from a set that came from a specific import
   */
  getRecordsFromImport(setId, importId) {
    const set = this.state.sets.get(setId);
    if (!set) return [];

    return Array.from(set.records.values()).filter(record =>
      record._provenance?.importId === importId
    );
  }

  /**
   * Get import statistics for a set
   */
  getSetImportStats(setId) {
    const set = this.state.sets.get(setId);
    if (!set) return null;

    const importStats = new Map();

    set.records.forEach(record => {
      const importId = record._provenance?.importId;
      if (importId) {
        if (!importStats.has(importId)) {
          importStats.set(importId, {
            importId,
            importName: record._provenance?.importName || 'Unknown',
            recordCount: 0,
            importedAt: record._provenance?.importedAt
          });
        }
        importStats.get(importId).recordCount++;
      }
    });

    return Array.from(importStats.values());
  }

  /**
   * Remove all records from a specific import
   */
  removeImportFromSet(setId, importId) {
    const set = this.state.sets.get(setId);
    if (!set) return { success: false, error: 'Set not found' };

    let removedCount = 0;
    const toRemove = [];

    set.records.forEach((record, recordId) => {
      if (record._provenance?.importId === importId) {
        toRemove.push(recordId);
      }
    });

    toRemove.forEach(recordId => {
      set.records.delete(recordId);
      removedCount++;
    });

    this.callbacks.showToast(`✓ Removed ${removedCount} records from import`);

    return { success: true, removedCount };
  }

  // ============================================
  // Utility Methods
  // ============================================

  slugifyFieldId(name) {
    return (name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }

  coerceValue(value, fieldType) {
    if (value === null || value === undefined || value === '') {
      return ['NUMBER', 'CURRENCY'].includes(fieldType) ? 0 : '';
    }

    switch (fieldType) {
      case 'NUMBER':
      case 'CURRENCY':
        const num = parseFloat(String(value).replace(/[,$%]/g, ''));
        return isNaN(num) ? 0 : num;

      case 'CHECKBOX':
        const strVal = String(value).toLowerCase();
        return ['true', 'yes', '1', 'y'].includes(strVal);

      case 'DATE':
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toISOString().split('T')[0];

      default:
        return String(value);
    }
  }

  inferColumnWidth(colAnalysis) {
    if (!colAnalysis) return '150px';

    const maxLen = colAnalysis.maxLength || 0;

    if (maxLen > 200) return '300px';
    if (maxLen > 100) return '250px';
    if (maxLen > 50) return '200px';
    if (maxLen > 20) return '150px';
    return '120px';
  }

  buildFieldConfig(header, inferredType, colAnalysis, imp) {
    const config = {};

    // For SELECT fields, add options
    if (inferredType === 'SELECT' && colAnalysis) {
      config.options = colAnalysis.samples || [];
    }

    // Check if this is a foreign key
    const fkHint = imp.schema.foreignKeyHints.find(fk => fk.column === header);
    if (fkHint) {
      config.foreignKey = {
        referencedEntity: fkHint.referencedEntity,
        confidence: fkHint.confidence
      };
    }

    return config;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOImportIntegration;
}

if (typeof window !== 'undefined') {
  window.EOImportIntegration = EOImportIntegration;
}
