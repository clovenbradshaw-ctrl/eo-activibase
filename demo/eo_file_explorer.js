/**
 * EO File Explorer
 * File-explorer style UI for navigating imports, sets, and views
 *
 * Features:
 * - Tree view of imports, sets, and views
 * - Drag and drop support
 * - Import preview panel
 * - Provenance visualization
 * - Relationship indicators
 */

class EOFileExplorer {
  constructor(options = {}) {
    this.container = options.container || null;
    this.importManager = options.importManager || null;
    this.state = options.state || null; // Main app state

    this.selectedItem = null;
    this.expandedSections = new Set(['imports', 'sets', 'views']);
    this.dragState = null;

    this.onImportSelect = options.onImportSelect || (() => {});
    this.onSetSelect = options.onSetSelect || (() => {});
    this.onViewSelect = options.onViewSelect || (() => {});
    this.onImportToSet = options.onImportToSet || (() => {});
    this.onCreateSet = options.onCreateSet || (() => {});
    this.onCreateView = options.onCreateView || (() => {});
  }

  /**
   * Initialize the file explorer
   */
  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('File explorer container not found:', containerId);
      return;
    }

    this.render();
    this.setupEventListeners();

    // Listen for import changes
    if (this.importManager) {
      this.importManager.addListener(() => this.render());
    }
  }

  /**
   * Render the file explorer
   */
  render() {
    if (!this.container) return;

    const imports = this.importManager ? this.importManager.getAllImports() : [];
    const sets = this.state ? Array.from(this.state.sets.values()) : [];
    const views = this.getViews();

    // Separate used and unused imports
    const usedImports = imports.filter(imp => imp.usedIn && imp.usedIn.length > 0);
    const unusedImports = imports.filter(imp => !imp.usedIn || imp.usedIn.length === 0);

    this.container.innerHTML = `
      <div class="eo-file-explorer">
        <!-- Drop zone for new files -->
        <div class="eo-drop-zone" id="eoDropZone">
          <i class="ph-bold ph-cloud-arrow-up"></i>
          <span>Add your data</span>
          <span class="eo-drop-formats">CSV, JSON, Excel</span>
        </div>

        <!-- YOUR DATA Section (formerly Imports) -->
        <div class="eo-section">
          <div class="eo-section-header" data-section="imports">
            <i class="ph-bold ${this.expandedSections.has('imports') ? 'ph-caret-down' : 'ph-caret-right'}"></i>
            <i class="ph-bold ph-database"></i>
            <span>Your Data</span>
            <span class="eo-count">${imports.length}</span>
          </div>
          ${this.expandedSections.has('imports') ? `
            <div class="eo-section-content">
              ${imports.length === 0 ? `
                <div class="eo-empty">
                  <i class="ph-bold ph-cloud-arrow-up" style="font-size: 24px; opacity: 0.5;"></i>
                  <span>Drop files above to add data</span>
                </div>
              ` : imports.map(imp => this.renderImportItem(imp, sets)).join('')}
            </div>
          ` : ''}
        </div>

        <!-- WORKSPACES Section (formerly Sets) -->
        <div class="eo-section">
          <div class="eo-section-header" data-section="sets">
            <i class="ph-bold ${this.expandedSections.has('sets') ? 'ph-caret-down' : 'ph-caret-right'}"></i>
            <i class="ph-bold ph-squares-four"></i>
            <span>Workspaces</span>
            <span class="eo-count">${sets.length}</span>
            <button class="eo-add-btn" data-action="add-set" title="Create Workspace">
              <i class="ph-bold ph-plus"></i>
            </button>
          </div>
          ${this.expandedSections.has('sets') ? `
            <div class="eo-section-content eo-droppable" data-drop-target="sets">
              ${sets.length === 0 ? `
                <div class="eo-empty">
                  <span>No workspaces yet</span>
                  <span class="eo-empty-hint">Drag data files here to create one</span>
                </div>
              ` : sets.map(set => this.renderSetItem(set, imports)).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Views Section (only if there are views) -->
        ${views.length > 0 ? `
          <div class="eo-section">
            <div class="eo-section-header" data-section="views">
              <i class="ph-bold ${this.expandedSections.has('views') ? 'ph-caret-down' : 'ph-caret-right'}"></i>
              <i class="ph-bold ph-eye"></i>
              <span>Views</span>
              <span class="eo-count">${views.length}</span>
            </div>
            ${this.expandedSections.has('views') ? `
              <div class="eo-section-content">
                ${views.map(view => this.renderViewItem(view)).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Detected Relationships -->
        ${this.renderRelationshipsSection(imports)}
      </div>
    `;

    this.attachItemListeners();
  }

  /**
   * Render a single import item (data file)
   */
  renderImportItem(imp, sets = []) {
    const isSelected = this.selectedItem?.type === 'import' && this.selectedItem?.id === imp.id;
    const formatIcon = this.getFormatIcon(imp.source.format);
    const timeAgo = this.getTimeAgo(imp.createdAt);
    const usedCount = imp.usedIn ? imp.usedIn.length : 0;
    const isUnused = usedCount === 0;

    // Find workspace names this import is used in
    const usedInWorkspaces = (imp.usedIn || []).map(usage => {
      if (usage.type === 'set') {
        const set = sets.find(s => s.id === usage.id);
        return set ? set.name : 'Unknown workspace';
      }
      return null;
    }).filter(Boolean);

    return `
      <div class="eo-item eo-import-item ${isSelected ? 'eo-selected' : ''} ${isUnused ? 'eo-unused' : ''}"
           data-type="import"
           data-id="${imp.id}"
           draggable="true">
        <div class="eo-item-icon">
          <i class="ph-bold ${formatIcon}"></i>
        </div>
        <div class="eo-item-content">
          <div class="eo-item-name" title="${imp.name}">${this.truncate(imp.name, 24)}</div>
          <div class="eo-item-meta">
            <span>${imp.rowCount} rows</span>
            <span class="eo-dot">·</span>
            <span>${timeAgo}</span>
          </div>
          ${usedInWorkspaces.length > 0 ? `
            <div class="eo-item-usage">
              <i class="ph ph-arrow-bend-down-right"></i>
              <span>Used in: ${usedInWorkspaces.slice(0, 2).map(n => this.truncate(n, 15)).join(', ')}${usedInWorkspaces.length > 2 ? ` +${usedInWorkspaces.length - 2}` : ''}</span>
            </div>
          ` : `
            <div class="eo-item-usage eo-unused-hint">
              <i class="ph ph-info"></i>
              <span>Not used yet - drag to a workspace</span>
            </div>
          `}
        </div>
        <div class="eo-item-badges">
          ${imp.schema && imp.schema.foreignKeyHints && imp.schema.foreignKeyHints.length > 0 ? `<span class="eo-badge eo-badge-link" title="Has relationships"><i class="ph-bold ph-link"></i></span>` : ''}
        </div>
        <div class="eo-item-actions">
          <button class="eo-action-btn" data-action="preview" data-id="${imp.id}" title="Preview">
            <i class="ph-bold ph-eye"></i>
          </button>
          <button class="eo-action-btn" data-action="delete-import" data-id="${imp.id}" title="Delete">
            <i class="ph-bold ph-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render a single workspace item with its data sources
   */
  renderSetItem(set, allImports) {
    const isSelected = this.selectedItem?.type === 'set' && this.selectedItem?.id === set.id;
    const recordCount = set.records ? set.records.size : 0;

    // Find imports (data files) that feed into this workspace
    const sourceImports = allImports.filter(imp =>
      imp.usedIn && imp.usedIn.some(u => u.type === 'set' && u.id === set.id)
    );

    // Get source file names for display
    const sourceNames = sourceImports.map(imp => this.truncate(imp.name, 12));

    return `
      <div class="eo-item eo-set-item ${isSelected ? 'eo-selected' : ''} eo-droppable"
           data-type="set"
           data-id="${set.id}"
           data-drop-target="set">
        <div class="eo-item-icon">
          <i class="ph-bold ${set.icon || 'ph-squares-four'}"></i>
        </div>
        <div class="eo-item-content">
          <div class="eo-item-name" title="${set.name}">${this.truncate(set.name, 24)}</div>
          <div class="eo-item-meta">
            <span>${recordCount} records</span>
          </div>
          ${sourceImports.length > 0 ? `
            <div class="eo-item-sources-list">
              <i class="ph ph-files"></i>
              <span>Sources: ${sourceNames.slice(0, 2).join(', ')}${sourceNames.length > 2 ? ` +${sourceNames.length - 2}` : ''}</span>
            </div>
          ` : `
            <div class="eo-item-sources-list eo-no-sources">
              <i class="ph ph-plus-circle"></i>
              <span>Drop data files here</span>
            </div>
          `}
        </div>
        ${sourceImports.length > 0 ? `
          <div class="eo-item-sources">
            ${sourceImports.slice(0, 3).map(imp => `
              <span class="eo-source-indicator" title="From: ${imp.name}">
                <i class="ph-bold ${this.getFormatIcon(imp.source.format)}"></i>
              </span>
            `).join('')}
            ${sourceImports.length > 3 ? `<span class="eo-more">+${sourceImports.length - 3}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render a single view item
   */
  renderViewItem(view) {
    const isSelected = this.selectedItem?.type === 'view' && this.selectedItem?.id === view.id;
    const viewIcon = view.icon || (view.config?.type === 'kanban' ? 'ph-kanban' : 'ph-table');

    return `
      <div class="eo-item eo-view-item ${isSelected ? 'eo-selected' : ''}"
           data-type="view"
           data-id="${view.id}"
           data-set-id="${view.setId}">
        <div class="eo-item-icon">
          <i class="ph-bold ${viewIcon}"></i>
        </div>
        <div class="eo-item-content">
          <div class="eo-item-name" title="${view.name}">${this.truncate(view.name, 24)}</div>
          <div class="eo-item-meta">
            <span>${view.setName || 'Unknown set'}</span>
          </div>
        </div>
        ${view.isTemporary ? `<span class="eo-badge eo-badge-temp" title="Temporary import view">temp</span>` : ''}
      </div>
    `;
  }

  /**
   * Render relationships section
   */
  renderRelationshipsSection(imports) {
    if (!this.importManager || imports.length < 2) return '';

    const relationships = this.importManager.findAllRelationships();
    if (relationships.length === 0) return '';

    return `
      <div class="eo-section eo-relationships-section">
        <div class="eo-section-header" data-section="relationships">
          <i class="ph-bold ${this.expandedSections.has('relationships') ? 'ph-caret-down' : 'ph-caret-right'}"></i>
          <i class="ph-bold ph-git-branch"></i>
          <span>Detected Relationships</span>
          <span class="eo-count">${relationships.length}</span>
        </div>
        ${this.expandedSections.has('relationships') ? `
          <div class="eo-section-content">
            ${relationships.slice(0, 5).map(rel => `
              <div class="eo-relationship-item">
                <div class="eo-rel-from">
                  <span class="eo-rel-name">${this.truncate(rel.from.importName, 15)}</span>
                  <span class="eo-rel-col">.${rel.from.column}</span>
                </div>
                <div class="eo-rel-arrow">
                  <i class="ph-bold ph-arrow-right"></i>
                  <span class="eo-rel-match">${Math.round(rel.matchRate * 100)}%</span>
                </div>
                <div class="eo-rel-to">
                  <span class="eo-rel-name">${this.truncate(rel.to.importName, 15)}</span>
                  <span class="eo-rel-col">.${rel.to.column}</span>
                </div>
                <button class="eo-action-btn eo-link-btn" data-action="create-link"
                        data-from-import="${rel.from.importId}"
                        data-from-col="${rel.from.column}"
                        data-to-import="${rel.to.importId}"
                        data-to-col="${rel.to.column}"
                        title="Create relationship">
                  <i class="ph-bold ph-link"></i>
                </button>
              </div>
            `).join('')}
            ${relationships.length > 5 ? `
              <div class="eo-more-rels">+${relationships.length - 5} more relationships</div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get all views from state
   */
  getViews() {
    if (!this.state || !this.state.sets) return [];

    const views = [];
    this.state.sets.forEach(set => {
      if (set.views) {
        set.views.forEach(view => {
          views.push({
            ...view,
            setId: set.id,
            setName: set.name
          });
        });
      }
    });
    return views;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (!this.container) return;

    // Section toggle
    this.container.addEventListener('click', (e) => {
      const header = e.target.closest('.eo-section-header');
      if (header) {
        const section = header.dataset.section;
        if (section) {
          if (this.expandedSections.has(section)) {
            this.expandedSections.delete(section);
          } else {
            this.expandedSections.add(section);
          }
          this.render();
        }
      }
    });

    // Setup drop zone
    const dropZone = this.container.querySelector('#eoDropZone');
    if (dropZone) {
      this.setupDropZone(dropZone);
    }
  }

  /**
   * Attach listeners to rendered items
   */
  attachItemListeners() {
    if (!this.container) return;

    // Item click
    this.container.querySelectorAll('.eo-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.eo-action-btn')) return;
        this.handleItemClick(item);
      });
    });

    // Action buttons
    this.container.querySelectorAll('.eo-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleAction(btn.dataset.action, btn.dataset);
      });
    });

    // Add buttons
    this.container.querySelectorAll('.eo-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleAction(btn.dataset.action, btn.dataset);
      });
    });

    // Drag and drop for imports
    this.setupDragAndDrop();

    // File drop zone
    this.setupDropZone(this.container.querySelector('#eoDropZone'));
  }

  /**
   * Handle item click
   */
  handleItemClick(item) {
    const type = item.dataset.type;
    const id = item.dataset.id;

    this.selectedItem = { type, id };
    this.render();

    switch (type) {
      case 'import':
        this.onImportSelect(id);
        break;
      case 'set':
        this.onSetSelect(id);
        break;
      case 'view':
        this.onViewSelect(id, item.dataset.setId);
        break;
    }
  }

  /**
   * Handle action button click
   */
  handleAction(action, data) {
    switch (action) {
      case 'preview':
        this.showImportPreview(data.id);
        break;
      case 'delete-import':
        this.deleteImport(data.id);
        break;
      case 'add-set':
        this.onCreateSet();
        break;
      case 'create-link':
        this.createLink(data);
        break;
    }
  }

  /**
   * Setup drag and drop for imports
   */
  setupDragAndDrop() {
    // Draggable imports
    this.container.querySelectorAll('.eo-import-item[draggable="true"]').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        this.dragState = {
          type: 'import',
          id: item.dataset.id
        };
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', item.dataset.id);
        item.classList.add('eo-dragging');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('eo-dragging');
        this.dragState = null;
        this.container.querySelectorAll('.eo-drag-over').forEach(el => {
          el.classList.remove('eo-drag-over');
        });
      });
    });

    // Drop targets (sets)
    this.container.querySelectorAll('.eo-set-item').forEach(item => {
      item.addEventListener('dragover', (e) => {
        if (this.dragState?.type === 'import') {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          item.classList.add('eo-drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('eo-drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('eo-drag-over');

        if (this.dragState?.type === 'import') {
          const importId = this.dragState.id;
          const setId = item.dataset.id;
          this.onImportToSet(importId, setId);
        }
      });
    });
  }

  /**
   * Setup file drop zone
   */
  setupDropZone(dropZone) {
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('eo-drop-active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('eo-drop-active');
      });
    });

    dropZone.addEventListener('drop', async (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        for (const file of files) {
          await this.handleFileDrop(file);
        }
      }
    });

    // Also handle click to open file picker
    dropZone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,.json,.xlsx,.xls,.tsv';
      input.multiple = true;
      input.onchange = async (e) => {
        for (const file of e.target.files) {
          await this.handleFileDrop(file);
        }
      };
      input.click();
    });
  }

  /**
   * Handle file drop
   */
  async handleFileDrop(file) {
    if (!this.importManager) {
      console.error('Import manager not configured');
      return;
    }

    // Show loading state
    const dropZone = this.container.querySelector('#eoDropZone');
    if (dropZone) {
      dropZone.innerHTML = `
        <i class="ph-bold ph-spinner eo-spin"></i>
        <span>Importing ${file.name}...</span>
      `;
    }

    const result = await this.importManager.createImportFromFile(file);

    if (result.success) {
      this.render();
      // Show preview modal for dragged data (same prompting as imported data)
      this.showImportPreview(result.import.id);
    } else {
      console.error('Import failed:', result.error);
      if (dropZone) {
        dropZone.innerHTML = `
          <i class="ph-bold ph-warning-circle" style="color: var(--red-500)"></i>
          <span>Import failed: ${result.error}</span>
        `;
        setTimeout(() => this.render(), 3000);
      }
    }
  }

  /**
   * Show import preview modal
   */
  showImportPreview(importId) {
    const imp = this.importManager?.getImport(importId);
    if (!imp) return;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'eo-modal-overlay';
    modal.innerHTML = `
      <div class="eo-import-preview-modal">
        <div class="eo-modal-header">
          <div class="eo-modal-title">
            <i class="ph-bold ${this.getFormatIcon(imp.source.format)}"></i>
            <span>${imp.name}</span>
          </div>
          <button class="eo-modal-close" onclick="this.closest('.eo-modal-overlay').remove()">
            <i class="ph-bold ph-x"></i>
          </button>
        </div>

        <div class="eo-modal-body">
          <!-- Tabs -->
          <div class="eo-preview-tabs">
            <button class="eo-preview-tab eo-active" data-tab="data">Data</button>
            <button class="eo-preview-tab" data-tab="schema">Schema</button>
            <button class="eo-preview-tab" data-tab="metadata">Metadata</button>
            <button class="eo-preview-tab" data-tab="quality">Quality</button>
          </div>

          <!-- Data Tab -->
          <div class="eo-preview-content eo-active" data-content="data">
            <div class="eo-data-table-wrapper">
              <table class="eo-data-table">
                <thead>
                  <tr>
                    ${imp.headers.map(h => `<th>${h}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${imp.rows.slice(0, 50).map(row => `
                    <tr>
                      ${imp.headers.map(h => `<td>${this.formatCellValue(row[h])}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ${imp.rows.length > 50 ? `
                <div class="eo-table-footer">Showing 50 of ${imp.rowCount} rows</div>
              ` : ''}
            </div>
          </div>

          <!-- Schema Tab -->
          <div class="eo-preview-content" data-content="schema">
            <div class="eo-schema-grid">
              ${imp.headers.map(h => {
                const col = imp.schema.columns[h];
                const inferredType = imp.schema.inferredTypes[h];
                const isPK = imp.schema.primaryKeyCandidate === h;
                const isFK = imp.schema.foreignKeyHints.some(fk => fk.column === h);

                return `
                  <div class="eo-schema-item ${isPK ? 'eo-pk' : ''} ${isFK ? 'eo-fk' : ''}">
                    <div class="eo-schema-header">
                      <span class="eo-schema-name">${h}</span>
                      ${isPK ? '<span class="eo-schema-badge eo-badge-pk">PK</span>' : ''}
                      ${isFK ? '<span class="eo-schema-badge eo-badge-fk">FK</span>' : ''}
                    </div>
                    <div class="eo-schema-type">${inferredType}</div>
                    <div class="eo-schema-stats">
                      <span>${col.uniqueCount} unique</span>
                      <span>${col.nullCount} nulls</span>
                    </div>
                    ${col.samples.length > 0 ? `
                      <div class="eo-schema-samples">
                        ${col.samples.slice(0, 3).map(s => `<code>${this.truncate(String(s), 20)}</code>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Metadata Tab -->
          <div class="eo-preview-content" data-content="metadata">
            <div class="eo-metadata-sections">
              <div class="eo-metadata-section">
                <h4>File Information</h4>
                <dl>
                  <dt>Filename</dt><dd>${imp.source.filename}</dd>
                  <dt>Format</dt><dd>${imp.source.format.toUpperCase()}</dd>
                  <dt>Size</dt><dd>${imp.fileMetadata.sizeFormatted}</dd>
                  <dt>Last Modified</dt><dd>${imp.fileMetadata.lastModifiedFormatted || 'Unknown'}</dd>
                  <dt>Imported</dt><dd>${new Date(imp.createdAt).toLocaleString()}</dd>
                  <dt>Parse Time</dt><dd>${imp.source.parseTimeMs}ms</dd>
                </dl>
              </div>

              ${imp.fileMetadata.filenameAnalysis.timeframe ? `
                <div class="eo-metadata-section">
                  <h4>Detected Timeframe</h4>
                  <dl>
                    <dt>Type</dt><dd>${imp.fileMetadata.filenameAnalysis.timeframe.type}</dd>
                    <dt>Label</dt><dd>${imp.fileMetadata.filenameAnalysis.timeframe.label}</dd>
                    <dt>Start</dt><dd>${new Date(imp.fileMetadata.filenameAnalysis.timeframe.start).toLocaleDateString()}</dd>
                    <dt>End</dt><dd>${new Date(imp.fileMetadata.filenameAnalysis.timeframe.end).toLocaleDateString()}</dd>
                  </dl>
                </div>
              ` : ''}

              ${imp.fileMetadata.filenameAnalysis.entityHints.length > 0 ? `
                <div class="eo-metadata-section">
                  <h4>Detected Entities</h4>
                  <div class="eo-entity-hints">
                    ${imp.fileMetadata.filenameAnalysis.entityHints.map(e => `<span class="eo-entity-tag">${e}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              ${imp.fileMetadata.filenameAnalysis.sourceSystemHint ? `
                <div class="eo-metadata-section">
                  <h4>Source System</h4>
                  <p>${imp.fileMetadata.filenameAnalysis.sourceSystemHint}</p>
                </div>
              ` : ''}

              ${imp.embeddedMetadata.dataDateRange ? `
                <div class="eo-metadata-section">
                  <h4>Data Date Range</h4>
                  <dl>
                    <dt>Earliest</dt><dd>${new Date(imp.embeddedMetadata.dataDateRange.earliest).toLocaleDateString()}</dd>
                    <dt>Latest</dt><dd>${new Date(imp.embeddedMetadata.dataDateRange.latest).toLocaleDateString()}</dd>
                    <dt>Span</dt><dd>${imp.embeddedMetadata.dataDateRange.span}</dd>
                  </dl>
                </div>
              ` : ''}

              ${imp.schema.foreignKeyHints.length > 0 ? `
                <div class="eo-metadata-section">
                  <h4>Foreign Key Hints</h4>
                  <ul class="eo-fk-list">
                    ${imp.schema.foreignKeyHints.map(fk => `
                      <li>
                        <code>${fk.column}</code> → <em>${fk.referencedEntity}</em>
                        <span class="eo-confidence">${Math.round(fk.confidence * 100)}% confidence</span>
                      </li>
                    `).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Quality Tab -->
          <div class="eo-preview-content" data-content="quality">
            <div class="eo-quality-overview">
              <div class="eo-quality-score">
                <div class="eo-score-circle" style="--score: ${imp.quality.score}">
                  <span>${imp.quality.score}</span>
                </div>
                <div class="eo-score-label">Quality Score</div>
              </div>

              <div class="eo-quality-metrics">
                <div class="eo-metric">
                  <span class="eo-metric-value">${imp.quality.completenessPercent}</span>
                  <span class="eo-metric-label">Completeness</span>
                </div>
                <div class="eo-metric">
                  <span class="eo-metric-value">${imp.quality.uniqueRows}</span>
                  <span class="eo-metric-label">Unique Rows</span>
                </div>
                <div class="eo-metric">
                  <span class="eo-metric-value">${imp.quality.duplicateRows}</span>
                  <span class="eo-metric-label">Duplicates</span>
                </div>
              </div>
            </div>

            <div class="eo-quality-details">
              <h4>Column Completeness</h4>
              <div class="eo-completeness-bars">
                ${imp.headers.map(h => {
                  const col = imp.schema.columns[h];
                  const pct = imp.rowCount > 0 ? ((imp.rowCount - col.nullCount) / imp.rowCount * 100) : 100;
                  return `
                    <div class="eo-completeness-row">
                      <span class="eo-col-name">${this.truncate(h, 20)}</span>
                      <div class="eo-bar-container">
                        <div class="eo-bar" style="width: ${pct}%"></div>
                      </div>
                      <span class="eo-pct">${pct.toFixed(0)}%</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="eo-modal-footer">
          <div class="eo-footer-info">
            ${imp.usedIn.length > 0 ? `Used in ${imp.usedIn.length} workspace(s)` : 'Not used yet'}
          </div>
          <div class="eo-footer-actions">
            <button class="eo-btn eo-btn-secondary" onclick="this.closest('.eo-modal-overlay').remove()">Close</button>
            <button class="eo-btn eo-btn-primary" data-action="add-to-set" data-import-id="${imp.id}">
              <i class="ph-bold ph-plus"></i>
              Use in Workspace
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Tab switching
    modal.querySelectorAll('.eo-preview-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.eo-preview-tab').forEach(t => t.classList.remove('eo-active'));
        modal.querySelectorAll('.eo-preview-content').forEach(c => c.classList.remove('eo-active'));
        tab.classList.add('eo-active');
        modal.querySelector(`[data-content="${tab.dataset.tab}"]`).classList.add('eo-active');
      });
    });

    // Add to set button
    modal.querySelector('[data-action="add-to-set"]')?.addEventListener('click', () => {
      modal.remove();
      this.showAddToSetDialog(importId);
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /**
   * Show dialog to add import to a set
   */
  showAddToSetDialog(importId) {
    const imp = this.importManager?.getImport(importId);
    if (!imp || !this.state) return;

    const sets = Array.from(this.state.sets.values());

    const modal = document.createElement('div');
    modal.className = 'eo-modal-overlay';
    modal.innerHTML = `
      <div class="eo-add-to-set-modal">
        <div class="eo-modal-header">
          <div class="eo-modal-title">Use "${imp.name}" in Workspace</div>
          <button class="eo-modal-close" onclick="this.closest('.eo-modal-overlay').remove()">
            <i class="ph-bold ph-x"></i>
          </button>
        </div>
        <div class="eo-modal-body">
          <div class="eo-option-group">
            <label class="eo-option">
              <input type="radio" name="target" value="new" checked>
              <span>Create new workspace</span>
            </label>
            <input type="text" class="eo-input" id="newSetName" value="${imp.fileMetadata.filenameAnalysis.baseName}" placeholder="Workspace name">
          </div>

          ${sets.length > 0 ? `
            <div class="eo-option-group">
              <label class="eo-option">
                <input type="radio" name="target" value="existing">
                <span>Add to existing workspace</span>
              </label>
              <select class="eo-select" id="existingSetId" disabled>
                ${sets.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
          ` : ''}
        </div>
        <div class="eo-modal-footer">
          <button class="eo-btn eo-btn-secondary" onclick="this.closest('.eo-modal-overlay').remove()">Cancel</button>
          <button class="eo-btn eo-btn-primary" id="confirmAddToSet">
            <i class="ph-bold ph-plus"></i>
            Add ${imp.rowCount} Records
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Radio toggle
    modal.querySelectorAll('input[name="target"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const isNew = modal.querySelector('input[name="target"]:checked').value === 'new';
        modal.querySelector('#newSetName').disabled = !isNew;
        const existingSelect = modal.querySelector('#existingSetId');
        if (existingSelect) existingSelect.disabled = isNew;
      });
    });

    // Confirm button
    modal.querySelector('#confirmAddToSet').addEventListener('click', () => {
      const isNew = modal.querySelector('input[name="target"]:checked').value === 'new';
      const setId = isNew ? null : modal.querySelector('#existingSetId')?.value;
      const setName = isNew ? modal.querySelector('#newSetName').value : null;

      // Validate inputs before closing modal
      if (isNew && !setName?.trim()) {
        alert('Please enter a name for the new workspace');
        return;
      }

      if (!isNew && !setId) {
        alert('Please select an existing workspace');
        return;
      }

      modal.remove();
      this.onImportToSet(importId, setId, setName);
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /**
   * Delete import with confirmation
   */
  deleteImport(importId) {
    const imp = this.importManager?.getImport(importId);
    if (!imp) return;

    if (confirm(`Delete import "${imp.name}"? This cannot be undone.`)) {
      this.importManager.deleteImport(importId);
      this.render();
    }
  }

  /**
   * Create link between imports
   */
  createLink(data) {
    // This would open a dialog to configure the relationship
    console.log('Create link:', data);
    // TODO: Implement relationship creation UI
  }

  // ============================================
  // Utility Methods
  // ============================================

  getFormatIcon(format) {
    const icons = {
      'csv': 'ph-file-csv',
      'tsv': 'ph-file-csv',
      'json': 'ph-file-js',
      'xlsx': 'ph-file-xls',
      'xls': 'ph-file-xls'
    };
    return icons[format] || 'ph-file';
  }

  truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
  }

  getTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  formatCellValue(value) {
    if (value === null || value === undefined) return '<span class="eo-null">null</span>';
    if (value === '') return '<span class="eo-empty">empty</span>';
    if (typeof value === 'object') return `<code>${JSON.stringify(value)}</code>`;
    return this.escapeHtml(String(value));
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOFileExplorer;
}

if (typeof window !== 'undefined') {
  window.EOFileExplorer = EOFileExplorer;
}
