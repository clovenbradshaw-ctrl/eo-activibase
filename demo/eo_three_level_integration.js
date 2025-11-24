/**
 * EOThreeLevelIntegration
 *
 * Coordinates the three levels of detail:
 * Level 1: Inline cell editing
 * Level 2: Record modal
 * Level 3: Field lens panel
 *
 * Integrates with existing EO systems (EOIntegration, EODataStructures, etc.)
 */
class EOThreeLevelIntegration {
  constructor(eoIntegration) {
    this.eo = eoIntegration;

    // Initialize components
    this.cellEditor = new EOInlineCellEditor();
    this.recordModal = new EORecordModal();
    this.fieldLens = new EOFieldLensPanel();

    // Configure components
    this.configureComponents();
  }

  /**
   * Configure all components with proper callbacks
   */
  configureComponents() {
    // Configure inline cell editor
    this.cellEditor.config = {
      onEdit: (recordId, fieldName, oldValue, newValue) => {
        this.handleCellEdit(recordId, fieldName, oldValue, newValue);
      },
      onViewDetails: (recordId, fieldName) => {
        this.showRecordModal(recordId);
      },
      getFieldType: (fieldName) => {
        return this.getFieldType(fieldName);
      },
      getFieldMetadata: (recordId, fieldName) => {
        return this.getFieldMetadata(recordId, fieldName);
      }
    };

    // Configure record modal
    this.recordModal.initialize({
      onFieldClick: (recordId, fieldName) => {
        this.showFieldLens(recordId, fieldName);
      },
      getRecord: (recordId) => {
        return this.getRecord(recordId);
      },
      getFieldSchema: (fieldName) => {
        return this.getFieldSchema(fieldName);
      },
      getRelationships: (recordId) => {
        return this.getRelationships(recordId);
      },
      getProvenance: (recordId) => {
        return this.getProvenance(recordId);
      },
      getHistory: (recordId) => {
        return this.getHistory(recordId);
      },
      getContext: (recordId) => {
        return this.getContext(recordId);
      }
    });

    // Configure field lens panel
    this.fieldLens.initialize({
      getFieldDefinition: (fieldName) => {
        return this.getFieldDefinition(fieldName);
      },
      getFieldProvenance: (fieldName) => {
        return this.getFieldProvenance(fieldName);
      },
      getFieldRelationships: (fieldName) => {
        return this.getFieldRelationships(fieldName);
      },
      getValueLineage: (recordId, fieldName) => {
        return this.getValueLineage(recordId, fieldName);
      },
      onEditField: (fieldName) => {
        this.handleEditField(fieldName);
      },
      onSplitField: (fieldName) => {
        this.handleSplitField(fieldName);
      },
      onHarmonizeField: (fieldName) => {
        this.handleHarmonizeField(fieldName);
      },
      onConvertToLinked: (fieldName) => {
        this.handleConvertToLinked(fieldName);
      },
      onAddLinkedFields: (fieldName) => {
        this.handleAddLinkedFields(fieldName);
      }
    });
  }

  /**
   * Attach to a grid container
   * @param {HTMLElement} container - The grid container element
   */
  attachToGrid(container) {
    this.cellEditor.attachToGrid(container, this.cellEditor.config);

    // Also attach row label click handlers for opening record modal
    this.attachRowLabelHandlers(container);
  }

  /**
   * Attach click handlers to row labels
   */
  attachRowLabelHandlers(container) {
    // Find row labels (typically first cell or header with record ID)
    const rowLabels = container.querySelectorAll('[data-record-label]');

    rowLabels.forEach(label => {
      label.addEventListener('click', () => {
        const recordId = label.dataset.recordId;
        if (recordId) {
          this.showRecordModal(recordId);
        }
      });

      // Add visual indication that it's clickable
      label.style.cursor = 'pointer';
      label.title = 'Click to view full record';
    });
  }

  /**
   * Handle cell edit
   */
  handleCellEdit(recordId, fieldName, oldValue, newValue) {
    if (this.eo && this.eo.handleEdit) {
      this.eo.handleEdit(recordId, fieldName, oldValue, newValue);

      // Refresh display after edit
      setTimeout(() => {
        this.refreshCellDisplay(recordId, fieldName);
      }, 100);
    }
  }

  /**
   * Show record modal (Level 2)
   */
  showRecordModal(recordId) {
    this.recordModal.show(recordId);
  }

  /**
   * Show field lens panel (Level 3)
   */
  showFieldLens(recordId, fieldName) {
    this.fieldLens.show(recordId, fieldName);
  }

  /**
   * Get field type from schema
   */
  getFieldType(fieldName) {
    if (!this.eo || !this.eo.schema) {
      return 'TEXT';
    }

    const field = this.eo.schema.find(f => f.name === fieldName || f.id === fieldName);
    return field ? field.type : 'TEXT';
  }

  /**
   * Get field metadata for tooltip
   */
  getFieldMetadata(recordId, fieldName) {
    const metadata = {
      isEditable: true,
      isLinked: false,
      isRollup: false,
      isDerived: false,
      isFormula: false,
      valueCount: 1,
      hint: null
    };

    // Get field schema
    if (this.eo && this.eo.schema) {
      const field = this.eo.schema.find(f => f.name === fieldName || f.id === fieldName);

      if (field) {
        metadata.isFormula = field.type === 'FORMULA';
        metadata.isRollup = field.type === 'ROLLUP';
        metadata.isLinked = field.type === 'LINKED_RECORD';
        metadata.isDerived = metadata.isFormula || metadata.isRollup;

        // Formula fields are not directly editable
        if (metadata.isFormula) {
          metadata.isEditable = false;
          metadata.hint = `Calculated: ${field.formula}`;
        }
      }
    }

    // Get SUP count from record
    if (this.eo && this.eo.records) {
      const record = this.eo.records.find(r => r.record_id === recordId);

      if (record && record.cells) {
        const cell = record.cells.find(c => c.field_name === fieldName);

        if (cell && cell.values) {
          metadata.valueCount = cell.values.length;
        }
      }
    }

    return metadata;
  }

  /**
   * Get record by ID
   */
  getRecord(recordId) {
    if (!this.eo || !this.eo.records) {
      return null;
    }

    return this.eo.records.find(r => r.record_id === recordId);
  }

  /**
   * Get field schema
   */
  getFieldSchema(fieldName) {
    if (!this.eo || !this.eo.schema) {
      return {};
    }

    return this.eo.schema.find(f => f.name === fieldName || f.id === fieldName) || {};
  }

  /**
   * Get relationships for a record
   */
  getRelationships(recordId) {
    // This would be populated from linked fields
    // For now, return mock data structure
    const relationships = [];

    // Check for linked record fields
    if (this.eo && this.eo.schema) {
      const record = this.getRecord(recordId);
      if (!record) return relationships;

      this.eo.schema.forEach(field => {
        if (field.type === 'LINKED_RECORD' && record.fields && record.fields[field.name]) {
          relationships.push({
            type: 'linked_record',
            fieldName: field.name,
            targetId: record.fields[field.name],
            targetName: record.fields[field.name]
          });
        }
      });
    }

    return relationships;
  }

  /**
   * Get provenance for a record
   */
  getProvenance(recordId) {
    const record = this.getRecord(recordId);
    if (!record) {
      return {
        created_at: null,
        source: 'Unknown',
        import_file: null,
        operations: []
      };
    }

    return {
      created_at: record.created_at,
      source: record.source || 'import',
      import_file: record.import_file,
      operations: record.structural_operations || []
    };
  }

  /**
   * Get edit history for a record
   */
  getHistory(recordId) {
    const record = this.getRecord(recordId);
    if (!record || !record.edit_history) {
      return [];
    }

    return record.edit_history;
  }

  /**
   * Get context for a record
   */
  getContext(recordId) {
    const record = this.getRecord(recordId);
    if (!record) {
      return {};
    }

    // Get context from first cell value
    if (record.cells && record.cells.length > 0) {
      const firstCell = record.cells[0];
      if (firstCell.values && firstCell.values.length > 0) {
        return firstCell.values[0].context_schema || {};
      }
    }

    return {};
  }

  /**
   * Get field definition
   */
  getFieldDefinition(fieldName) {
    const schema = this.getFieldSchema(fieldName);

    // Check for multiple definitions (SUP)
    // In a real implementation, this would check a definitions store
    return {
      definitions: [
        {
          text: schema.description || `The ${fieldName} field`,
          source: 'Schema',
          conflicts: false
        }
      ],
      type: schema.type,
      format: schema.format,
      unit: schema.unit
    };
  }

  /**
   * Get field provenance
   */
  getFieldProvenance(fieldName) {
    const schema = this.getFieldSchema(fieldName);

    return {
      created_at: schema.created_at,
      created_in: schema.type === 'FORMULA' ? 'formula definition' : 'import',
      harmonized_from: schema.harmonized_from || [],
      transformations: [],
      merged_with: schema.merged_with,
      split_from: schema.split_from
    };
  }

  /**
   * Get field relationships
   */
  getFieldRelationships(fieldName) {
    const relationships = [];

    // Check how many records use this field
    if (this.eo && this.eo.records) {
      let recordCount = 0;
      this.eo.records.forEach(record => {
        if (record.fields && record.fields[fieldName] !== undefined) {
          recordCount++;
        }
      });

      if (recordCount > 0) {
        relationships.push({
          type: 'used_in',
          description: `Used in ${recordCount} records`,
          recordCount
        });
      }
    }

    // Check for linked fields (fields that reference this field)
    if (this.eo && this.eo.schema) {
      this.eo.schema.forEach(field => {
        if (field.type === 'FORMULA' && field.formula && field.formula.includes(`{${fieldName}}`)) {
          relationships.push({
            type: 'referenced_by',
            description: `Referenced by ${field.name} formula`,
            fieldName: field.name
          });
        }
      });
    }

    return relationships;
  }

  /**
   * Get value lineage for a specific field in a record
   */
  getValueLineage(recordId, fieldName) {
    const record = this.getRecord(recordId);
    if (!record) return [];

    const lineage = [];

    // Get value history from cell
    if (record.cells) {
      const cell = record.cells.find(c => c.field_name === fieldName);

      if (cell && cell.values) {
        cell.values.forEach((valueObj, index) => {
          lineage.push({
            type: valueObj.context_schema?.method || 'unknown',
            value: valueObj.value,
            description: this.describeContextChange(valueObj.context_schema),
            timestamp: valueObj.timestamp,
            author: valueObj.context_schema?.agent?.name,
            evidence: valueObj.context_schema?.source?.file
          });
        });
      }
    }

    // Also check value_history
    if (record.value_history) {
      record.value_history
        .filter(h => h.field_name === fieldName)
        .forEach(h => {
          lineage.push({
            type: 'edit',
            value: h.new_value,
            description: `Changed from ${h.old_value}`,
            timestamp: h.timestamp,
            author: h.operator
          });
        });
    }

    return lineage;
  }

  /**
   * Describe context change for lineage
   */
  describeContextChange(context) {
    if (!context) return 'No context information';

    const parts = [];

    if (context.method) {
      parts.push(`Method: ${context.method}`);
    }

    if (context.timeframe?.granularity) {
      parts.push(`Timeframe: ${context.timeframe.granularity}`);
    }

    if (context.source?.file) {
      parts.push(`Source: ${context.source.file}`);
    }

    return parts.join(' • ') || 'Context recorded';
  }

  /**
   * Handle edit field action
   */
  handleEditField(fieldName) {
    alert(`Edit field definition: ${fieldName}\n\nThis would open a field definition editor.`);
  }

  /**
   * Handle split field action
   */
  handleSplitField(fieldName) {
    alert(`Split field: ${fieldName}\n\nThis would open the field splitting interface.`);
  }

  /**
   * Handle harmonize field action
   */
  handleHarmonizeField(fieldName) {
    alert(`Harmonize field: ${fieldName}\n\nThis would open the field harmonization interface.`);
  }

  /**
   * Handle convert to linked field action
   */
  handleConvertToLinked(fieldName) {
    alert(`Convert to linked-record field: ${fieldName}\n\nThis would convert the field to a linked record type.`);
  }

  /**
   * Handle add linked fields action
   */
  handleAddLinkedFields(fieldName) {
    alert(`Add linked fields to view: ${fieldName}\n\nThis would open the linked fields modal.`);
  }

  /**
   * Refresh cell display after edit
   */
  refreshCellDisplay(recordId, fieldName) {
    // Find and update the cell in the DOM
    const cells = document.querySelectorAll(`[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);

    cells.forEach(cell => {
      const record = this.getRecord(recordId);
      if (record && record.cells) {
        const cellData = record.cells.find(c => c.field_name === fieldName);
        if (cellData) {
          // Update cell value display
          const value = cellData.values && cellData.values.length > 0
            ? cellData.values[0].value
            : '';

          let html = value;

          // Add SUP indicator if multiple values
          if (cellData.values && cellData.values.length > 1) {
            html += ` <span class="eo-sup-indicator" title="${cellData.values.length} values">●${cellData.values.length}</span>`;
          }

          cell.innerHTML = html;
        }
      }
    });
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    if (this.cellEditor) {
      this.cellEditor.destroy();
    }
    if (this.recordModal) {
      this.recordModal.destroy();
    }
    if (this.fieldLens) {
      this.fieldLens.destroy();
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOThreeLevelIntegration;
}
