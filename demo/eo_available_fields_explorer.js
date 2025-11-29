/**
 * EO Available Fields Explorer
 *
 * A panel/modal for exploring all available fields in a set/view.
 * Helps users discover existing fields (including hidden ones) before
 * deciding to add new fields.
 *
 * Features:
 * - Shows all fields categorized by visibility state
 * - Field preview with sample values and usage stats
 * - Search and filter capabilities
 * - Quick actions: show/hide, add to view, view details
 * - Links to related/lookup fields from other sets
 */

class EOAvailableFieldsExplorer {
    constructor() {
        this.panel = null;
        this.currentView = null;
        this.currentSet = null;
        this.state = null;
        this.searchQuery = '';
        this.filterType = 'all'; // all, visible, hidden, available, linked
        this.expandedSections = new Set(['visible', 'hidden', 'available']);
    }

    /**
     * Show the explorer panel for the current view
     * @param {Object} view - Current view entity
     * @param {Object} set - Current set
     * @param {Object} state - Global state
     */
    show(view, set, state) {
        this.currentView = view;
        this.currentSet = set;
        this.state = state;
        this.searchQuery = '';
        this.filterType = 'all';

        this.render();
        this.attachEventListeners();
    }

    /**
     * Get all fields organized by category
     */
    getFieldCategories() {
        const schema = this.currentSet.schema || [];
        const visibleFieldIds = this.currentView.visibleFieldIds || [];
        const hiddenFieldIds = this.currentView.hiddenFields || [];
        const columnOrder = this.currentView.columnOrder || [];

        // Determine field states
        const visible = [];
        const hidden = [];
        const available = [];

        schema.forEach(field => {
            const fieldWithStats = this.enrichFieldWithStats(field);

            // Check if in visible
            if (visibleFieldIds.includes(field.id) && !hiddenFieldIds.includes(field.id)) {
                visible.push(fieldWithStats);
            }
            // Check if explicitly hidden
            else if (hiddenFieldIds.includes(field.id)) {
                hidden.push(fieldWithStats);
            }
            // Otherwise available but not in view
            else {
                available.push(fieldWithStats);
            }
        });

        // Sort visible by column order if available
        if (columnOrder.length > 0) {
            visible.sort((a, b) => {
                const aIdx = columnOrder.indexOf(a.id);
                const bIdx = columnOrder.indexOf(b.id);
                if (aIdx === -1 && bIdx === -1) return 0;
                if (aIdx === -1) return 1;
                if (bIdx === -1) return -1;
                return aIdx - bIdx;
            });
        }

        // Get linked fields
        const linked = this.getLinkedFieldOpportunities();

        // Get existing lookups/rollups
        const computed = this.getExistingComputedFields();

        return { visible, hidden, available, linked, computed };
    }

    /**
     * Enrich a field with sample values and usage statistics
     */
    enrichFieldWithStats(field) {
        const records = Array.from(this.currentSet.records?.values() || []);
        const values = [];
        let nonEmptyCount = 0;

        records.forEach(record => {
            const value = record[field.id];
            if (value !== undefined && value !== null && value !== '') {
                nonEmptyCount++;
                // Collect unique sample values (up to 5)
                const strValue = String(value);
                if (!values.includes(strValue) && values.length < 5) {
                    values.push(strValue);
                }
            }
        });

        return {
            ...field,
            sampleValues: values,
            usageCount: nonEmptyCount,
            totalRecords: records.length,
            usagePercent: records.length > 0 ? Math.round((nonEmptyCount / records.length) * 100) : 0
        };
    }

    /**
     * Get linked field opportunities (fields from related sets that could be brought in)
     */
    getLinkedFieldOpportunities() {
        const opportunities = [];
        const schema = this.currentSet.schema || [];

        // Find all LINK_RECORD fields
        schema.forEach(linkField => {
            if (linkField.type !== 'LINK_RECORD' || !linkField.config?.linkedSetId) return;

            const targetSetId = linkField.config.linkedSetId;
            const targetSet = this.state.sets?.get(targetSetId);
            if (!targetSet) return;

            // Get fields from target set that aren't already added
            const existingLookups = (this.currentView.relationships || [])
                .filter(r => r.targetSetId === targetSetId)
                .map(r => r.targetFieldId);

            const existingRollups = (this.currentView.rollups || [])
                .filter(r => r.targetSetId === targetSetId)
                .map(r => r.targetFieldId);

            const availableFields = (targetSet.schema || []).filter(f =>
                !existingLookups.includes(f.id) && !existingRollups.includes(f.id)
            );

            if (availableFields.length > 0) {
                opportunities.push({
                    linkFieldId: linkField.id,
                    linkFieldName: linkField.name,
                    targetSetId,
                    targetSetName: targetSet.name,
                    cardinality: this.detectCardinality(linkField),
                    fields: availableFields.map(f => this.enrichFieldWithStats.call(
                        { currentSet: targetSet }, f
                    ))
                });
            }
        });

        return opportunities;
    }

    /**
     * Detect cardinality of a link field
     */
    detectCardinality(linkField) {
        const records = Array.from(this.currentSet.records?.values() || []);
        for (const record of records) {
            const value = record[linkField.id];
            if (Array.isArray(value) && value.length > 1) {
                return 'many';
            }
        }
        return 'one';
    }

    /**
     * Get existing computed fields (lookups and rollups already in the view)
     */
    getExistingComputedFields() {
        const computed = [];

        // Existing lookups
        (this.currentView.relationships || []).forEach(rel => {
            const targetSet = this.state.sets?.get(rel.targetSetId);
            const targetField = targetSet?.schema?.find(f => f.id === rel.targetFieldId);

            computed.push({
                id: rel.id,
                type: 'lookup',
                displayName: rel.displayName || `${targetSet?.name || 'Unknown'} – ${targetField?.name || rel.targetFieldId}`,
                sourceFieldId: rel.sourceFieldId,
                targetSetId: rel.targetSetId,
                targetSetName: targetSet?.name || 'Unknown',
                targetFieldId: rel.targetFieldId,
                targetFieldName: targetField?.name || rel.targetFieldId
            });
        });

        // Existing rollups
        (this.currentView.rollups || []).forEach(rollup => {
            const targetSet = this.state.sets?.get(rollup.targetSetId);
            const targetField = targetSet?.schema?.find(f => f.id === rollup.targetFieldId);

            computed.push({
                id: rollup.id,
                type: 'rollup',
                displayName: rollup.displayName || `${targetSet?.name || 'Unknown'} – ${targetField?.name || rollup.targetFieldId} (${rollup.aggregation})`,
                sourceFieldId: rollup.sourceFieldId,
                targetSetId: rollup.targetSetId,
                targetSetName: targetSet?.name || 'Unknown',
                targetFieldId: rollup.targetFieldId,
                targetFieldName: targetField?.name || rollup.targetFieldId,
                aggregation: rollup.aggregation
            });
        });

        return computed;
    }

    /**
     * Filter fields based on search query
     */
    filterFields(fields) {
        if (!this.searchQuery.trim()) return fields;

        const query = this.searchQuery.toLowerCase();
        return fields.filter(field => {
            const nameMatch = (field.name || '').toLowerCase().includes(query);
            const idMatch = (field.id || '').toLowerCase().includes(query);
            const typeMatch = (field.type || '').toLowerCase().includes(query);
            const defMatch = (field.definition || '').toLowerCase().includes(query);
            const sampleMatch = (field.sampleValues || []).some(v =>
                v.toLowerCase().includes(query)
            );
            return nameMatch || idMatch || typeMatch || defMatch || sampleMatch;
        });
    }

    /**
     * Render the explorer panel
     */
    render() {
        const categories = this.getFieldCategories();

        const panelHTML = `
            <div class="eo-fields-explorer-overlay" id="eoFieldsExplorer">
                <div class="eo-fields-explorer-panel">
                    <div class="eo-fields-explorer-header">
                        <div class="header-content">
                            <h2 class="panel-title">Available Fields</h2>
                            <p class="panel-subtitle">
                                Explore fields in <strong>${this.escapeHtml(this.currentSet.name)}</strong>
                            </p>
                        </div>
                        <button class="eo-panel-close" id="eoFieldsExplorerClose">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>

                    <div class="eo-fields-explorer-search">
                        <div class="search-input-wrapper">
                            <i class="ph ph-magnifying-glass"></i>
                            <input type="text"
                                   id="fieldsSearchInput"
                                   placeholder="Search fields by name, type, or values..."
                                   value="${this.escapeHtml(this.searchQuery)}">
                            ${this.searchQuery ? '<button class="search-clear" id="fieldSearchClear">×</button>' : ''}
                        </div>
                        <div class="filter-chips">
                            <button class="filter-chip ${this.filterType === 'all' ? 'active' : ''}" data-filter="all">
                                All
                            </button>
                            <button class="filter-chip ${this.filterType === 'visible' ? 'active' : ''}" data-filter="visible">
                                Visible (${categories.visible.length})
                            </button>
                            <button class="filter-chip ${this.filterType === 'hidden' ? 'active' : ''}" data-filter="hidden">
                                Hidden (${categories.hidden.length})
                            </button>
                            <button class="filter-chip ${this.filterType === 'available' ? 'active' : ''}" data-filter="available">
                                Available (${categories.available.length})
                            </button>
                            <button class="filter-chip ${this.filterType === 'linked' ? 'active' : ''}" data-filter="linked">
                                Linked Sets
                            </button>
                        </div>
                    </div>

                    <div class="eo-fields-explorer-body" id="fieldsExplorerBody">
                        ${this.renderFieldSections(categories)}
                    </div>

                    <div class="eo-fields-explorer-footer">
                        <div class="footer-stats">
                            <span>${categories.visible.length} visible</span>
                            <span class="dot">·</span>
                            <span>${categories.hidden.length} hidden</span>
                            <span class="dot">·</span>
                            <span>${categories.available.length} available</span>
                        </div>
                        <button class="btn btn-secondary" id="eoFieldsExplorerDone">Done</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = document.getElementById('eoFieldsExplorer');
    }

    /**
     * Render all field sections
     */
    renderFieldSections(categories) {
        let html = '';

        // Apply filter
        const showSection = (section) => {
            return this.filterType === 'all' || this.filterType === section;
        };

        // Visible fields
        if (showSection('visible') && categories.visible.length > 0) {
            const filtered = this.filterFields(categories.visible);
            if (filtered.length > 0 || !this.searchQuery) {
                html += this.renderSection('visible', 'In This View', filtered, {
                    icon: '👁',
                    emptyMessage: 'No visible fields match your search',
                    actions: ['hide', 'details']
                });
            }
        }

        // Hidden fields
        if (showSection('hidden') && categories.hidden.length > 0) {
            const filtered = this.filterFields(categories.hidden);
            if (filtered.length > 0 || !this.searchQuery) {
                html += this.renderSection('hidden', 'Hidden Fields', filtered, {
                    icon: '🙈',
                    emptyMessage: 'No hidden fields match your search',
                    actions: ['show', 'details']
                });
            }
        }

        // Available fields
        if (showSection('available') && categories.available.length > 0) {
            const filtered = this.filterFields(categories.available);
            if (filtered.length > 0 || !this.searchQuery) {
                html += this.renderSection('available', 'Available in Set', filtered, {
                    icon: '○',
                    emptyMessage: 'No available fields match your search',
                    actions: ['add', 'details']
                });
            }
        }

        // Linked sets
        if (showSection('linked') && categories.linked.length > 0) {
            html += this.renderLinkedSection(categories.linked);
        }

        // Existing computed fields
        if (showSection('all') && categories.computed.length > 0) {
            html += this.renderComputedSection(categories.computed);
        }

        // Empty state
        if (!html) {
            html = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>No fields match your search</p>
                </div>
            `;
        }

        return html;
    }

    /**
     * Render a section of fields
     */
    renderSection(sectionId, title, fields, options = {}) {
        const isExpanded = this.expandedSections.has(sectionId);
        const count = fields.length;

        return `
            <div class="fields-section ${isExpanded ? 'expanded' : 'collapsed'}" data-section="${sectionId}">
                <div class="section-header" data-section="${sectionId}">
                    <span class="section-toggle">${isExpanded ? '▼' : '▶'}</span>
                    <span class="section-icon">${options.icon || ''}</span>
                    <span class="section-title">${title}</span>
                    <span class="section-count">${count}</span>
                </div>
                <div class="section-content" ${isExpanded ? '' : 'style="display: none;"'}>
                    ${count === 0 ? `<p class="empty-message">${options.emptyMessage || 'No fields'}</p>` : ''}
                    ${fields.map(field => this.renderFieldRow(field, options.actions, sectionId)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render a single field row
     */
    renderFieldRow(field, actions = [], section) {
        const typeColors = {
            'TEXT': '#3b82f6',
            'NUMBER': '#10b981',
            'DATE': '#f59e0b',
            'LINK_RECORD': '#8b5cf6',
            'SELECT': '#ec4899',
            'FORMULA': '#6366f1',
            'CHECKBOX': '#14b8a6'
        };

        const typeColor = typeColors[field.type] || '#6b7280';
        const sampleValuesHtml = field.sampleValues?.length > 0
            ? `<div class="field-samples">
                 <span class="samples-label">Values:</span>
                 ${field.sampleValues.slice(0, 3).map(v =>
                     `<span class="sample-value">${this.escapeHtml(this.truncate(v, 20))}</span>`
                 ).join('')}
                 ${field.sampleValues.length > 3 ? '<span class="more">...</span>' : ''}
               </div>`
            : '';

        const usageHtml = field.usagePercent !== undefined
            ? `<div class="field-usage">
                 <div class="usage-bar">
                     <div class="usage-fill" style="width: ${field.usagePercent}%"></div>
                 </div>
                 <span class="usage-text">${field.usageCount}/${field.totalRecords} records</span>
               </div>`
            : '';

        const definitionHtml = field.definition
            ? `<div class="field-definition">${this.escapeHtml(field.definition)}</div>`
            : '';

        return `
            <div class="field-row" data-field-id="${field.id}" data-section="${section}">
                <div class="field-main">
                    <div class="field-header">
                        <span class="field-name">${this.escapeHtml(field.name || field.id)}</span>
                        <span class="field-type-badge" style="background-color: ${typeColor}20; color: ${typeColor}">
                            ${field.type}
                        </span>
                    </div>
                    ${definitionHtml}
                    ${sampleValuesHtml}
                    ${usageHtml}
                </div>
                <div class="field-actions">
                    ${actions.includes('show') ? `
                        <button class="field-action-btn" data-action="show" data-field-id="${field.id}" title="Show in view">
                            <i class="ph ph-eye"></i> Show
                        </button>
                    ` : ''}
                    ${actions.includes('hide') ? `
                        <button class="field-action-btn" data-action="hide" data-field-id="${field.id}" title="Hide from view">
                            <i class="ph ph-eye-slash"></i> Hide
                        </button>
                    ` : ''}
                    ${actions.includes('add') ? `
                        <button class="field-action-btn primary" data-action="add" data-field-id="${field.id}" title="Add to view">
                            <i class="ph ph-plus"></i> Add
                        </button>
                    ` : ''}
                    ${actions.includes('details') ? `
                        <button class="field-action-btn subtle" data-action="details" data-field-id="${field.id}" title="View details">
                            <i class="ph ph-info"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render linked sets section
     */
    renderLinkedSection(linkedSets) {
        const isExpanded = this.expandedSections.has('linked');

        let content = '';
        linkedSets.forEach(linkedSet => {
            const filtered = this.filterFields(linkedSet.fields);
            if (filtered.length === 0 && this.searchQuery) return;

            content += `
                <div class="linked-set-group">
                    <div class="linked-set-header">
                        <span class="link-icon">🔗</span>
                        <span class="linked-set-name">${this.escapeHtml(linkedSet.targetSetName)}</span>
                        <span class="link-via">via ${this.escapeHtml(linkedSet.linkFieldName)}</span>
                        <span class="cardinality-badge">${linkedSet.cardinality === 'many' ? '1:N' : '1:1'}</span>
                    </div>
                    <div class="linked-set-fields">
                        ${filtered.map(field => this.renderLinkedFieldRow(field, linkedSet)).join('')}
                    </div>
                </div>
            `;
        });

        if (!content) return '';

        return `
            <div class="fields-section ${isExpanded ? 'expanded' : 'collapsed'}" data-section="linked">
                <div class="section-header" data-section="linked">
                    <span class="section-toggle">${isExpanded ? '▼' : '▶'}</span>
                    <span class="section-icon">🔗</span>
                    <span class="section-title">From Linked Sets</span>
                    <span class="section-count">${linkedSets.reduce((sum, ls) => sum + ls.fields.length, 0)}</span>
                </div>
                <div class="section-content" ${isExpanded ? '' : 'style="display: none;"'}>
                    ${content}
                </div>
            </div>
        `;
    }

    /**
     * Render a linked field row
     */
    renderLinkedFieldRow(field, linkedSet) {
        return `
            <div class="field-row linked-field"
                 data-field-id="${field.id}"
                 data-target-set-id="${linkedSet.targetSetId}"
                 data-link-field-id="${linkedSet.linkFieldId}">
                <div class="field-main">
                    <div class="field-header">
                        <span class="field-name">${this.escapeHtml(field.name || field.id)}</span>
                        <span class="field-type-badge">${field.type}</span>
                    </div>
                    ${field.sampleValues?.length > 0 ? `
                        <div class="field-samples">
                            ${field.sampleValues.slice(0, 2).map(v =>
                                `<span class="sample-value">${this.escapeHtml(this.truncate(v, 15))}</span>`
                            ).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="field-actions">
                    <button class="field-action-btn"
                            data-action="lookup"
                            data-field-id="${field.id}"
                            data-target-set-id="${linkedSet.targetSetId}"
                            data-link-field-id="${linkedSet.linkFieldId}"
                            title="Add as lookup">
                        <i class="ph ph-arrow-square-out"></i> Lookup
                    </button>
                    ${linkedSet.cardinality === 'many' ? `
                        <button class="field-action-btn"
                                data-action="rollup"
                                data-field-id="${field.id}"
                                data-target-set-id="${linkedSet.targetSetId}"
                                data-link-field-id="${linkedSet.linkFieldId}"
                                title="Add as rollup">
                            <i class="ph ph-chart-bar"></i> Rollup
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render computed fields section
     */
    renderComputedSection(computed) {
        if (computed.length === 0) return '';

        const isExpanded = this.expandedSections.has('computed');

        return `
            <div class="fields-section ${isExpanded ? 'expanded' : 'collapsed'}" data-section="computed">
                <div class="section-header" data-section="computed">
                    <span class="section-toggle">${isExpanded ? '▼' : '▶'}</span>
                    <span class="section-icon">𝑓</span>
                    <span class="section-title">Computed Fields</span>
                    <span class="section-count">${computed.length}</span>
                </div>
                <div class="section-content" ${isExpanded ? '' : 'style="display: none;"'}>
                    ${computed.map(field => `
                        <div class="field-row computed-field" data-computed-id="${field.id}">
                            <div class="field-main">
                                <div class="field-header">
                                    <span class="computed-type-icon">${field.type === 'lookup' ? '↗' : 'Σ'}</span>
                                    <span class="field-name">${this.escapeHtml(field.displayName)}</span>
                                    <span class="field-type-badge ${field.type}">${field.type}</span>
                                </div>
                                <div class="computed-source">
                                    From ${this.escapeHtml(field.targetSetName)}.${this.escapeHtml(field.targetFieldName)}
                                    ${field.aggregation ? ` (${field.aggregation})` : ''}
                                </div>
                            </div>
                            <div class="field-actions">
                                <button class="field-action-btn subtle danger"
                                        data-action="remove-computed"
                                        data-computed-id="${field.id}"
                                        data-computed-type="${field.type}"
                                        title="Remove from view">
                                    <i class="ph ph-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        this.panel.querySelector('#eoFieldsExplorerClose')?.addEventListener('click', () => this.close());
        this.panel.querySelector('#eoFieldsExplorerDone')?.addEventListener('click', () => this.close());

        // Click outside to close
        this.panel.addEventListener('click', (e) => {
            if (e.target === this.panel) {
                this.close();
            }
        });

        // Escape key
        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.panel) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);

        // Search input
        const searchInput = this.panel.querySelector('#fieldsSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.refreshBody();
            });
            // Focus search on open
            setTimeout(() => searchInput.focus(), 100);
        }

        // Clear search
        this.panel.querySelector('#fieldSearchClear')?.addEventListener('click', () => {
            this.searchQuery = '';
            this.refreshBody();
        });

        // Filter chips
        this.panel.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                this.filterType = e.target.dataset.filter;
                this.panel.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                this.refreshBody();
            });
        });

        // Section toggles
        this.attachSectionListeners();

        // Field actions
        this.attachFieldActionListeners();
    }

    /**
     * Attach section toggle listeners
     */
    attachSectionListeners() {
        this.panel.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                const sectionEl = e.currentTarget.closest('.fields-section');
                const content = sectionEl.querySelector('.section-content');
                const toggle = sectionEl.querySelector('.section-toggle');

                if (this.expandedSections.has(section)) {
                    this.expandedSections.delete(section);
                    content.style.display = 'none';
                    toggle.textContent = '▶';
                    sectionEl.classList.remove('expanded');
                    sectionEl.classList.add('collapsed');
                } else {
                    this.expandedSections.add(section);
                    content.style.display = '';
                    toggle.textContent = '▼';
                    sectionEl.classList.add('expanded');
                    sectionEl.classList.remove('collapsed');
                }
            });
        });
    }

    /**
     * Attach field action listeners
     */
    attachFieldActionListeners() {
        this.panel.querySelectorAll('.field-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const fieldId = btn.dataset.fieldId;

                switch (action) {
                    case 'show':
                        this.showField(fieldId);
                        break;
                    case 'hide':
                        this.hideField(fieldId);
                        break;
                    case 'add':
                        this.addFieldToView(fieldId);
                        break;
                    case 'details':
                        this.showFieldDetails(fieldId);
                        break;
                    case 'lookup':
                        this.addLookupField(
                            btn.dataset.linkFieldId,
                            btn.dataset.targetSetId,
                            fieldId
                        );
                        break;
                    case 'rollup':
                        this.showRollupOptions(
                            btn.dataset.linkFieldId,
                            btn.dataset.targetSetId,
                            fieldId,
                            btn
                        );
                        break;
                    case 'remove-computed':
                        this.removeComputedField(btn.dataset.computedId, btn.dataset.computedType);
                        break;
                }
            });
        });
    }

    /**
     * Refresh the body content
     */
    refreshBody() {
        const body = this.panel.querySelector('#fieldsExplorerBody');
        if (body) {
            const categories = this.getFieldCategories();
            body.innerHTML = this.renderFieldSections(categories);
            this.attachSectionListeners();
            this.attachFieldActionListeners();
        }

        // Update search input
        const searchInput = this.panel.querySelector('#fieldsSearchInput');
        if (searchInput && searchInput.value !== this.searchQuery) {
            searchInput.value = this.searchQuery;
        }
    }

    // ========== ACTIONS ==========

    /**
     * Show a hidden field
     */
    showField(fieldId) {
        // Remove from hiddenFields
        if (Array.isArray(this.currentView.hiddenFields)) {
            const idx = this.currentView.hiddenFields.indexOf(fieldId);
            if (idx !== -1) {
                this.currentView.hiddenFields.splice(idx, 1);
            }
        }

        // Add to visibleFieldIds if not present
        if (Array.isArray(this.currentView.visibleFieldIds)) {
            if (!this.currentView.visibleFieldIds.includes(fieldId)) {
                this.currentView.visibleFieldIds.push(fieldId);
            }
        }

        this.currentView.isDirty = true;
        this.refreshBody();
        this.triggerViewRefresh();
        this.showToast(`Field shown in view`);
    }

    /**
     * Hide a visible field
     */
    hideField(fieldId) {
        // Add to hiddenFields
        if (!Array.isArray(this.currentView.hiddenFields)) {
            this.currentView.hiddenFields = [];
        }
        if (!this.currentView.hiddenFields.includes(fieldId)) {
            this.currentView.hiddenFields.push(fieldId);
        }

        this.currentView.isDirty = true;
        this.refreshBody();
        this.triggerViewRefresh();
        this.showToast(`Field hidden from view`);
    }

    /**
     * Add an available field to the view
     */
    addFieldToView(fieldId) {
        // Add to visibleFieldIds
        if (!Array.isArray(this.currentView.visibleFieldIds)) {
            this.currentView.visibleFieldIds = [];
        }
        if (!this.currentView.visibleFieldIds.includes(fieldId)) {
            this.currentView.visibleFieldIds.push(fieldId);
        }

        // Add to columnOrder if present
        if (Array.isArray(this.currentView.columnOrder)) {
            if (!this.currentView.columnOrder.includes(fieldId)) {
                this.currentView.columnOrder.push(fieldId);
            }
        }

        // Remove from hiddenFields if present
        if (Array.isArray(this.currentView.hiddenFields)) {
            const idx = this.currentView.hiddenFields.indexOf(fieldId);
            if (idx !== -1) {
                this.currentView.hiddenFields.splice(idx, 1);
            }
        }

        this.currentView.isDirty = true;
        this.refreshBody();
        this.triggerViewRefresh();
        this.showToast(`Field added to view`);
    }

    /**
     * Show field details (open Field Lens Panel)
     */
    showFieldDetails(fieldId) {
        if (window.EOFieldLensPanel) {
            const fieldLens = new window.EOFieldLensPanel();
            fieldLens.show(null, fieldId);
        } else {
            // Fallback: show field info in alert
            const field = this.currentSet.schema?.find(f => f.id === fieldId);
            if (field) {
                alert(`Field: ${field.name}\nType: ${field.type}\nID: ${field.id}${field.definition ? '\nDefinition: ' + field.definition : ''}`);
            }
        }
    }

    /**
     * Add a lookup field
     */
    addLookupField(linkFieldId, targetSetId, targetFieldId) {
        const targetSet = this.state.sets?.get(targetSetId);
        const targetField = targetSet?.schema?.find(f => f.id === targetFieldId);
        const linkField = this.currentSet.schema?.find(f => f.id === linkFieldId);

        if (!this.currentView.relationships) {
            this.currentView.relationships = [];
        }

        this.currentView.relationships.push({
            id: `lookup_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            type: 'lookup',
            sourceFieldId: linkFieldId,
            targetSetId: targetSetId,
            targetFieldId: targetFieldId,
            displayName: `${targetSet?.name || 'Unknown'} – ${targetField?.name || targetFieldId}`,
            createdAt: Date.now()
        });

        this.currentView.isDirty = true;
        this.refreshBody();
        this.triggerViewRefresh();
        this.showToast(`Lookup field added`);
    }

    /**
     * Show rollup options popover
     */
    showRollupOptions(linkFieldId, targetSetId, targetFieldId, buttonEl) {
        const targetSet = this.state.sets?.get(targetSetId);
        const targetField = targetSet?.schema?.find(f => f.id === targetFieldId);

        // Determine applicable aggregations
        const aggregations = this.getApplicableAggregations(targetField?.type || 'TEXT');

        // Create popover
        const popover = document.createElement('div');
        popover.className = 'rollup-options-popover';
        popover.innerHTML = `
            <div class="popover-title">Aggregation Function</div>
            ${aggregations.map(agg => `
                <button class="popover-option" data-agg="${agg.value}">
                    <span class="agg-label">${agg.label}</span>
                    <span class="agg-desc">${agg.description || ''}</span>
                </button>
            `).join('')}
        `;

        // Position near button
        const rect = buttonEl.getBoundingClientRect();
        popover.style.position = 'fixed';
        popover.style.top = `${rect.bottom + 5}px`;
        popover.style.left = `${rect.left}px`;

        document.body.appendChild(popover);

        // Handle selection
        popover.querySelectorAll('.popover-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const aggregation = opt.dataset.agg;
                this.addRollupField(linkFieldId, targetSetId, targetFieldId, aggregation);
                popover.remove();
            });
        });

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function closePopover(e) {
                if (!popover.contains(e.target)) {
                    popover.remove();
                    document.removeEventListener('click', closePopover);
                }
            });
        }, 0);
    }

    /**
     * Add a rollup field
     */
    addRollupField(linkFieldId, targetSetId, targetFieldId, aggregation) {
        const targetSet = this.state.sets?.get(targetSetId);
        const targetField = targetSet?.schema?.find(f => f.id === targetFieldId);

        if (!this.currentView.rollups) {
            this.currentView.rollups = [];
        }

        this.currentView.rollups.push({
            id: `rollup_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            type: 'rollup',
            sourceFieldId: linkFieldId,
            targetSetId: targetSetId,
            targetFieldId: targetFieldId,
            aggregation: aggregation,
            displayName: `${targetSet?.name || 'Unknown'} – ${targetField?.name || targetFieldId} (${aggregation})`,
            createdAt: Date.now()
        });

        this.currentView.isDirty = true;
        this.refreshBody();
        this.triggerViewRefresh();
        this.showToast(`Rollup field added (${aggregation})`);
    }

    /**
     * Remove a computed field
     */
    removeComputedField(computedId, computedType) {
        if (computedType === 'lookup') {
            if (Array.isArray(this.currentView.relationships)) {
                this.currentView.relationships = this.currentView.relationships.filter(r => r.id !== computedId);
            }
        } else if (computedType === 'rollup') {
            if (Array.isArray(this.currentView.rollups)) {
                this.currentView.rollups = this.currentView.rollups.filter(r => r.id !== computedId);
            }
        }

        this.currentView.isDirty = true;
        this.refreshBody();
        this.triggerViewRefresh();
        this.showToast(`Computed field removed`);
    }

    /**
     * Get applicable aggregation functions for a field type
     */
    getApplicableAggregations(fieldType) {
        const allAggregations = [
            { value: 'count', label: 'Count', description: 'Number of records', types: ['*'] },
            { value: 'sum', label: 'Sum', description: 'Total of all values', types: ['NUMBER', 'FORMULA'] },
            { value: 'avg', label: 'Average', description: 'Mean of all values', types: ['NUMBER', 'FORMULA'] },
            { value: 'min', label: 'Min', description: 'Smallest value', types: ['NUMBER', 'FORMULA', 'DATE'] },
            { value: 'max', label: 'Max', description: 'Largest value', types: ['NUMBER', 'FORMULA', 'DATE'] },
            { value: 'arrayjoin', label: 'Join', description: 'Comma-separated list', types: ['TEXT', 'SELECT'] },
            { value: 'unique', label: 'Unique', description: 'Distinct values only', types: ['*'] },
            { value: 'any', label: 'Any', description: 'First available value', types: ['*'] }
        ];

        return allAggregations.filter(agg =>
            agg.types.includes('*') || agg.types.includes(fieldType)
        );
    }

    /**
     * Trigger view refresh
     */
    triggerViewRefresh() {
        if (window.renderCurrentView) {
            window.renderCurrentView();
        }
    }

    /**
     * Show a toast notification
     */
    showToast(message) {
        if (window.showToast) {
            window.showToast(message);
        } else {
            // Fallback toast
            const toast = document.createElement('div');
            toast.className = 'eo-toast';
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        }
    }

    /**
     * Close the panel
     */
    close() {
        document.removeEventListener('keydown', this.escapeHandler);
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
    }

    // ========== UTILITIES ==========

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncate(str, maxLen) {
        if (!str) return '';
        return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    window.EOAvailableFieldsExplorer = EOAvailableFieldsExplorer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EOAvailableFieldsExplorer };
}
