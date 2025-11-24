/**
 * EOFieldLensPanel
 *
 * Level 3: Field Drilldown Panel
 * Opens when clicking a field in the record modal.
 * Shows deep semantic metadata:
 * - Field definition (with SUP support for multiple definitions)
 * - Field provenance (creation, transformations, harmonizations)
 * - Field relationships (related sets, linked fields, mappings)
 * - Data lineage (value provenance for specific record)
 * - Actions (edit, split, harmonize, convert, add to view)
 */
class EOFieldLensPanel {
  constructor() {
    this.panel = null;
    this.currentRecordId = null;
    this.currentFieldName = null;
    this.config = {};
  }

  /**
   * Initialize the panel with configuration
   * @param {Object} config - Configuration object
   */
  initialize(config = {}) {
    this.config = {
      getFieldDefinition: config.getFieldDefinition || (() => ({})),
      getFieldProvenance: config.getFieldProvenance || (() => ({})),
      getFieldRelationships: config.getFieldRelationships || (() => []),
      getValueLineage: config.getValueLineage || (() => []),
      onEditField: config.onEditField || (() => {}),
      onSplitField: config.onSplitField || (() => {}),
      onHarmonizeField: config.onHarmonizeField || (() => {}),
      onConvertToLinked: config.onConvertToLinked || (() => {}),
      onAddLinkedFields: config.onAddLinkedFields || (() => {}),
      ...config
    };
  }

  /**
   * Show the panel for a specific field
   * @param {string} recordId - The record ID
   * @param {string} fieldName - The field name to inspect
   */
  show(recordId, fieldName) {
    this.currentRecordId = recordId;
    this.currentFieldName = fieldName;

    if (!this.panel) {
      this.createPanel();
    }

    this.updateContent();
    this.panel.classList.add('visible');

    // Add ESC key handler
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.escHandler);
  }

  /**
   * Hide the panel
   */
  hide() {
    if (this.panel) {
      this.panel.classList.remove('visible');
      document.removeEventListener('keydown', this.escHandler);
    }
  }

  /**
   * Create the panel structure
   */
  createPanel() {
    const panel = document.createElement('div');
    panel.className = 'eo-field-lens-panel';

    panel.innerHTML = `
      <div class="eo-field-lens-header">
        <h3 class="eo-field-lens-title">
          Field Lens: <span class="eo-field-lens-name"></span>
        </h3>
        <button class="eo-field-lens-close" aria-label="Close">×</button>
      </div>

      <div class="eo-field-lens-body">
        <!-- Content will be dynamically populated -->
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    // Add event listeners
    this.attachEventListeners();
  }

  /**
   * Attach event listeners to panel elements
   */
  attachEventListeners() {
    // Close button
    const closeBtn = this.panel.querySelector('.eo-field-lens-close');
    closeBtn.addEventListener('click', () => this.hide());
  }

  /**
   * Update panel content based on current field
   */
  updateContent() {
    const fieldName = this.currentFieldName;

    // Update title
    const nameEl = this.panel.querySelector('.eo-field-lens-name');
    nameEl.textContent = fieldName;

    // Get data
    const definition = this.config.getFieldDefinition(fieldName);
    const provenance = this.config.getFieldProvenance(fieldName);
    const relationships = this.config.getFieldRelationships(fieldName);
    const lineage = this.config.getValueLineage(this.currentRecordId, fieldName);

    // Update body
    const bodyEl = this.panel.querySelector('.eo-field-lens-body');
    bodyEl.innerHTML = this.renderContent(definition, provenance, relationships, lineage);

    // Attach action handlers
    this.attachActionHandlers();
  }

  /**
   * Render the full panel content
   */
  renderContent(definition, provenance, relationships, lineage) {
    return `
      ${this.renderDefinitionSection(definition)}
      ${this.renderProvenanceSection(provenance)}
      ${this.renderRelationshipsSection(relationships)}
      ${this.renderLineageSection(lineage)}
      ${this.renderActionsSection()}
    `;
  }

  /**
   * Render Definition section
   */
  renderDefinitionSection(definition) {
    let content = '';

    if (definition.definitions && definition.definitions.length > 1) {
      // Multiple definitions (SUP)
      content = `
        <div class="eo-lens-sup-notice">
          <span class="eo-sup-indicator">●${definition.definitions.length}</span>
          ${definition.definitions.length} definitions available
        </div>
        ${definition.definitions.map((def, index) => `
          <div class="eo-lens-definition-item">
            <div class="eo-lens-definition-header">
              <span class="eo-lens-definition-label">Definition ${index + 1}</span>
              ${def.source ? `<span class="eo-lens-definition-source">${def.source}</span>` : ''}
            </div>
            <p class="eo-lens-definition-text">${def.text || 'No definition available'}</p>
            ${def.conflicts ? `<div class="eo-lens-conflict-flag">⚠️ Conflicts with other definitions</div>` : ''}
          </div>
        `).join('')}
      `;
    } else {
      // Single definition
      const def = definition.definitions?.[0] || definition;
      content = `
        <p class="eo-lens-definition-text">${def.text || def.description || 'No definition available'}</p>
        ${def.source ? `<div class="eo-lens-definition-source">Source: ${def.source}</div>` : ''}
      `;
    }

    // Add field type and properties
    if (definition.type || definition.format) {
      content += `
        <div class="eo-lens-field-meta">
          ${definition.type ? `<span class="eo-lens-meta-item"><strong>Type:</strong> ${definition.type}</span>` : ''}
          ${definition.format ? `<span class="eo-lens-meta-item"><strong>Format:</strong> ${definition.format}</span>` : ''}
          ${definition.unit ? `<span class="eo-lens-meta-item"><strong>Unit:</strong> ${definition.unit}</span>` : ''}
        </div>
      `;
    }

    return `
      <section class="eo-lens-section">
        <h4 class="eo-lens-section-title">Definition</h4>
        <div class="eo-lens-section-content">
          ${content}
        </div>
      </section>
    `;
  }

  /**
   * Render Provenance section
   */
  renderProvenanceSection(provenance) {
    let content = '';

    // Creation info
    if (provenance.created_at || provenance.created_in) {
      content += `
        <div class="eo-lens-provenance-item">
          <span class="eo-lens-provenance-label">Created:</span>
          <span class="eo-lens-provenance-value">
            ${provenance.created_in || 'Unknown source'}
            ${provenance.created_at ? `(${this.formatDate(provenance.created_at)})` : ''}
          </span>
        </div>
      `;
    }

    // Harmonization info
    if (provenance.harmonized_from && provenance.harmonized_from.length > 0) {
      content += `
        <div class="eo-lens-provenance-item">
          <span class="eo-lens-provenance-label">Harmonized from:</span>
          <div class="eo-lens-harmonization-list">
            ${provenance.harmonized_from.map(field => `
              <span class="eo-lens-harmonization-field">${field}</span>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Transformations
    if (provenance.transformations && provenance.transformations.length > 0) {
      content += `
        <div class="eo-lens-provenance-item">
          <span class="eo-lens-provenance-label">Transformations:</span>
          <div class="eo-lens-transformation-list">
            ${provenance.transformations.map(transform => `
              <div class="eo-lens-transformation-item">
                <span class="eo-lens-transformation-type">${transform.type}</span>
                ${transform.description ? `<span class="eo-lens-transformation-desc">${transform.description}</span>` : ''}
                ${transform.timestamp ? `<span class="eo-lens-transformation-time">${this.formatDate(transform.timestamp)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Merge/split history
    if (provenance.merged_with || provenance.split_from) {
      content += `
        <div class="eo-lens-provenance-item">
          <span class="eo-lens-provenance-label">Structural changes:</span>
          <div class="eo-lens-structural-changes">
            ${provenance.merged_with ? `<div>Merged with: ${provenance.merged_with.join(', ')}</div>` : ''}
            ${provenance.split_from ? `<div>Split from: ${provenance.split_from}</div>` : ''}
          </div>
        </div>
      `;
    }

    if (!content) {
      content = '<div class="eo-lens-empty">No provenance information available</div>';
    }

    return `
      <section class="eo-lens-section">
        <h4 class="eo-lens-section-title">Provenance</h4>
        <div class="eo-lens-section-content">
          ${content}
        </div>
      </section>
    `;
  }

  /**
   * Render Relationships section
   */
  renderRelationshipsSection(relationships) {
    let content = '';

    if (!relationships || relationships.length === 0) {
      content = '<div class="eo-lens-empty">No relationships found</div>';
    } else {
      // Group relationships by type
      const grouped = {};
      relationships.forEach(rel => {
        const type = rel.type || 'other';
        if (!grouped[type]) {
          grouped[type] = [];
        }
        grouped[type].push(rel);
      });

      content = Object.entries(grouped).map(([type, rels]) => `
        <div class="eo-lens-relationship-group">
          <h5 class="eo-lens-relationship-type">${this.formatRelationType(type)}</h5>
          <ul class="eo-lens-relationship-list">
            ${rels.map(rel => `
              <li class="eo-lens-relationship-item">
                ${rel.setName || rel.targetName || rel.description}
                ${rel.recordCount ? `<span class="eo-lens-relationship-count">(${rel.recordCount} records)</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('');

      // Add linked fields section
      const linkedFields = relationships.filter(rel => rel.type === 'linked_field');
      if (linkedFields.length > 0) {
        content += `
          <div class="eo-lens-linked-fields">
            <h5>Automatic Join Candidates</h5>
            <div class="eo-lens-linked-fields-list">
              ${linkedFields.map(field => `
                <div class="eo-lens-linked-field-item">
                  <span class="eo-lens-linked-field-name">${field.linkedFieldName}</span>
                  <span class="eo-lens-linked-field-set">${field.linkedSetName}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Add mappings section
      const mappings = relationships.filter(rel => rel.type === 'mapping');
      if (mappings.length > 0) {
        content += `
          <div class="eo-lens-mappings">
            <h5>Field Mappings</h5>
            <div class="eo-lens-mappings-list">
              ${mappings.map(mapping => `
                <div class="eo-lens-mapping-item">
                  This field corresponds to <strong>${mapping.targetField}</strong> in ${mapping.targetDataset}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    return `
      <section class="eo-lens-section">
        <h4 class="eo-lens-section-title">Relationships</h4>
        <div class="eo-lens-section-content">
          ${content}
        </div>
      </section>
    `;
  }

  /**
   * Render Data Lineage section (for this specific record)
   */
  renderLineageSection(lineage) {
    let content = '';

    if (!lineage || lineage.length === 0) {
      content = '<div class="eo-lens-empty">No lineage information available</div>';
    } else {
      content = `
        <div class="eo-lens-lineage-chain">
          ${lineage.map((step, index) => `
            <div class="eo-lens-lineage-step">
              <div class="eo-lens-lineage-step-header">
                <span class="eo-lens-lineage-step-number">${index + 1}</span>
                <span class="eo-lens-lineage-step-type">${step.type || 'transformation'}</span>
                ${step.timestamp ? `<span class="eo-lens-lineage-step-time">${this.formatDate(step.timestamp)}</span>` : ''}
              </div>
              <div class="eo-lens-lineage-step-content">
                ${step.value ? `<div class="eo-lens-lineage-value">${step.value}</div>` : ''}
                ${step.description ? `<div class="eo-lens-lineage-desc">${step.description}</div>` : ''}
                ${step.author ? `<div class="eo-lens-lineage-author">by ${step.author}</div>` : ''}
                ${step.evidence ? `<div class="eo-lens-lineage-evidence">Evidence: ${step.evidence}</div>` : ''}
              </div>
              ${index < lineage.length - 1 ? '<div class="eo-lens-lineage-arrow">↓</div>' : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <section class="eo-lens-section">
        <h4 class="eo-lens-section-title">Data Lineage <span class="eo-lens-section-subtitle">(for this record)</span></h4>
        <div class="eo-lens-section-content">
          ${content}
        </div>
      </section>
    `;
  }

  /**
   * Render Actions section
   */
  renderActionsSection() {
    return `
      <section class="eo-lens-section eo-lens-actions-section">
        <h4 class="eo-lens-section-title">Actions</h4>
        <div class="eo-lens-section-content">
          <div class="eo-lens-actions">
            <button class="eo-lens-action-btn" data-action="edit">
              <span class="eo-lens-action-icon">✏️</span>
              Edit field definition
            </button>
            <button class="eo-lens-action-btn" data-action="split">
              <span class="eo-lens-action-icon">✂️</span>
              Split field
            </button>
            <button class="eo-lens-action-btn" data-action="harmonize">
              <span class="eo-lens-action-icon">🔗</span>
              Harmonize with another field
            </button>
            <button class="eo-lens-action-btn" data-action="convert">
              <span class="eo-lens-action-icon">🔄</span>
              Convert to linked-record field
            </button>
            <button class="eo-lens-action-btn" data-action="add-linked">
              <span class="eo-lens-action-icon">➕</span>
              Add linked fields to view
            </button>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Attach handlers for action buttons
   */
  attachActionHandlers() {
    const actionBtns = this.panel.querySelectorAll('.eo-lens-action-btn');

    actionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleAction(action);
      });
    });
  }

  /**
   * Handle action button clicks
   */
  handleAction(action) {
    const fieldName = this.currentFieldName;

    switch (action) {
      case 'edit':
        this.config.onEditField(fieldName);
        break;
      case 'split':
        this.config.onSplitField(fieldName);
        break;
      case 'harmonize':
        this.config.onHarmonizeField(fieldName);
        break;
      case 'convert':
        this.config.onConvertToLinked(fieldName);
        break;
      case 'add-linked':
        this.config.onAddLinkedFields(fieldName);
        break;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format relationship type for display
   */
  formatRelationType(type) {
    const typeMap = {
      'used_in': 'Used in Relations',
      'linked_field': 'Linked Fields',
      'mapping': 'Mappings',
      'reference': 'References',
      'other': 'Other Relationships'
    };

    return typeMap[type] || type;
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOFieldLensPanel;
}
