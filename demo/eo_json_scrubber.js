/**
 * EO JSON Scrubber
 *
 * A card-based JSON explorer where every element (keys, values, objects, arrays)
 * is rendered as an interactive card that can be clicked to create views, filters,
 * groups, and pivots.
 *
 * Features:
 * - Scrub through JSON structure with visual cards
 * - Click any card to pivot: filter by value, group by field, create focused view
 * - Path breadcrumb navigation
 * - Value frequency analysis
 * - Type-aware styling
 * - Integration with view management
 */

class EOJSONScrubber {
    constructor(options = {}) {
        this.container = null;
        this.panel = null;
        this.state = options.state || null;
        this.currentSet = options.set || null;
        this.currentView = options.view || null;

        // JSON data source
        this.jsonData = null;
        this.dataSource = null; // 'record' | 'schema' | 'raw' | 'records'
        this.sourceRecordId = null;

        // Navigation state
        this.currentPath = [];
        this.expandedPaths = new Set();
        this.selectedPath = null;

        // Analysis cache
        this.valueFrequencies = new Map();
        this.pathStats = new Map();

        // Callbacks
        this.onViewCreate = options.onViewCreate || null;
        this.onFilterApply = options.onFilterApply || null;
        this.onGroupApply = options.onGroupApply || null;
        this.onClose = options.onClose || null;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Show scrubber for a specific record
     */
    showForRecord(record, set, state) {
        this.jsonData = record;
        this.dataSource = 'record';
        this.sourceRecordId = record.id || record._id;
        this.currentSet = set;
        this.state = state;
        this.analyzeData();
        this.render();
    }

    /**
     * Show scrubber for set schema
     */
    showForSchema(set, state) {
        const schemaObj = {};
        (set.schema || []).forEach(field => {
            schemaObj[field.name || field.id] = {
                _type: field.type,
                _id: field.id,
                ...field
            };
        });
        this.jsonData = schemaObj;
        this.dataSource = 'schema';
        this.currentSet = set;
        this.state = state;
        this.analyzeData();
        this.render();
    }

    /**
     * Show scrubber for all records (aggregated view)
     */
    showForRecords(records, set, state) {
        // Create structure showing all unique paths and sample values
        const aggregated = this.aggregateRecords(records, set);
        this.jsonData = aggregated;
        this.dataSource = 'records';
        this.currentSet = set;
        this.state = state;
        this.analyzeData();
        this.render();
    }

    /**
     * Show scrubber for raw JSON
     */
    showForJSON(json, label = 'JSON Data') {
        this.jsonData = json;
        this.dataSource = 'raw';
        this.dataLabel = label;
        this.analyzeData();
        this.render();
    }

    /**
     * Close the scrubber
     */
    close() {
        // Remove escape key handler
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }

        // Close any open pivot menu
        this.closePivotMenu();

        // Remove panel
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
        if (this.onClose) {
            this.onClose();
        }
    }

    // ========================================================================
    // DATA ANALYSIS
    // ========================================================================

    /**
     * Aggregate records to show field structure with value frequencies
     */
    aggregateRecords(records, set) {
        const result = {};
        const fieldStats = new Map();

        records.forEach(record => {
            Object.keys(record).forEach(key => {
                if (key === 'id' || key === '_id') return;

                const value = record[key];
                if (!fieldStats.has(key)) {
                    fieldStats.set(key, {
                        count: 0,
                        values: new Map(),
                        types: new Set(),
                        samples: []
                    });
                }

                const stats = fieldStats.get(key);
                stats.count++;

                const type = this.getValueType(value);
                stats.types.add(type);

                const valueKey = JSON.stringify(value);
                stats.values.set(valueKey, (stats.values.get(valueKey) || 0) + 1);

                if (stats.samples.length < 5 && value !== null && value !== undefined && value !== '') {
                    const exists = stats.samples.some(s => JSON.stringify(s) === valueKey);
                    if (!exists) {
                        stats.samples.push(value);
                    }
                }
            });
        });

        // Build result structure
        const schema = set?.schema || [];
        schema.forEach(field => {
            const fieldId = field.id;
            const fieldName = field.name || fieldId;
            const stats = fieldStats.get(fieldId) || { count: 0, values: new Map(), types: new Set(), samples: [] };

            result[fieldName] = {
                _fieldId: fieldId,
                _type: field.type,
                _count: stats.count,
                _total: records.length,
                _coverage: records.length > 0 ? Math.round((stats.count / records.length) * 100) : 0,
                _uniqueValues: stats.values.size,
                _samples: stats.samples,
                _valueDistribution: this.getTopValues(stats.values, 5)
            };
        });

        return result;
    }

    /**
     * Get top N values by frequency
     */
    getTopValues(valueMap, n) {
        return Array.from(valueMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([value, count]) => ({
                value: JSON.parse(value),
                count
            }));
    }

    /**
     * Analyze JSON data for frequencies and stats
     */
    analyzeData() {
        this.valueFrequencies.clear();
        this.pathStats.clear();

        if (this.dataSource === 'records' && this.currentSet) {
            // Already analyzed during aggregation
            return;
        }

        this.walkJSON(this.jsonData, [], (path, value) => {
            const pathKey = path.join('.');

            if (!this.pathStats.has(pathKey)) {
                this.pathStats.set(pathKey, {
                    path,
                    type: this.getValueType(value),
                    count: 0
                });
            }
            this.pathStats.get(pathKey).count++;

            if (typeof value !== 'object' || value === null) {
                const valueKey = `${pathKey}:${JSON.stringify(value)}`;
                this.valueFrequencies.set(valueKey, (this.valueFrequencies.get(valueKey) || 0) + 1);
            }
        });
    }

    /**
     * Walk JSON structure calling callback for each element
     */
    walkJSON(obj, path, callback) {
        callback(path, obj);

        if (obj === null || typeof obj !== 'object') {
            return;
        }

        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                this.walkJSON(item, [...path, `[${index}]`], callback);
            });
        } else {
            Object.keys(obj).forEach(key => {
                this.walkJSON(obj[key], [...path, key], callback);
            });
        }
    }

    /**
     * Get value type for display
     */
    getValueType(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'string') {
            if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
            if (/^https?:\/\//.test(value)) return 'url';
            if (/@/.test(value) && /\./.test(value)) return 'email';
            return 'string';
        }
        return typeof value;
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    /**
     * Main render method
     */
    render() {
        this.close(); // Remove existing panel

        const overlay = document.createElement('div');
        overlay.className = 'eo-json-scrubber-overlay';
        overlay.innerHTML = this.renderPanel();

        document.body.appendChild(overlay);
        this.panel = overlay;

        this.attachEventListeners();

        // Auto-expand first level
        if (this.jsonData && typeof this.jsonData === 'object') {
            this.expandedPaths.add('$');
        }
        this.refreshContent();
    }

    /**
     * Render panel structure
     */
    renderPanel() {
        const sourceLabel = this.getSourceLabel();

        return `
            <div class="eo-json-scrubber-panel">
                <div class="scrubber-header">
                    <div class="header-content">
                        <h2 class="scrubber-title">JSON Scrubber</h2>
                        <p class="scrubber-subtitle">${this.escapeHtml(sourceLabel)}</p>
                    </div>
                    <div class="header-actions">
                        <button class="scrubber-btn" id="scrubberExpandAll" title="Expand All">
                            <i class="ph ph-arrows-out-simple"></i>
                        </button>
                        <button class="scrubber-btn" id="scrubberCollapseAll" title="Collapse All">
                            <i class="ph ph-arrows-in-simple"></i>
                        </button>
                        <button class="scrubber-close" id="scrubberClose">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                </div>

                <div class="scrubber-breadcrumb" id="scrubberBreadcrumb">
                    <span class="breadcrumb-item root" data-path="$">$</span>
                </div>

                <div class="scrubber-body" id="scrubberBody">
                    <!-- Cards rendered here -->
                </div>

                <div class="scrubber-footer">
                    <div class="footer-hint">
                        Click any card to filter, group, or create a view
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get source description
     */
    getSourceLabel() {
        switch (this.dataSource) {
            case 'record':
                return `Record: ${this.sourceRecordId || 'Unknown'}`;
            case 'schema':
                return `Schema: ${this.currentSet?.name || 'Set'}`;
            case 'records':
                return `All Records: ${this.currentSet?.name || 'Set'}`;
            case 'raw':
                return this.dataLabel || 'JSON Data';
            default:
                return 'JSON Data';
        }
    }

    /**
     * Refresh the card content
     */
    refreshContent() {
        const body = this.panel?.querySelector('#scrubberBody');
        if (!body) return;

        body.innerHTML = this.renderCards(this.jsonData, ['$']);
        this.updateBreadcrumb();
        this.attachCardListeners();
    }

    /**
     * Render cards for JSON structure
     */
    renderCards(data, path) {
        if (data === null || data === undefined) {
            return this.renderValueCard(data, path);
        }

        const pathKey = path.join('.');
        const isExpanded = this.expandedPaths.has(pathKey);

        if (Array.isArray(data)) {
            return this.renderArrayCards(data, path, isExpanded);
        } else if (typeof data === 'object') {
            return this.renderObjectCards(data, path, isExpanded);
        } else {
            return this.renderValueCard(data, path);
        }
    }

    /**
     * Render object as cards
     */
    renderObjectCards(obj, path, isExpanded) {
        const pathKey = path.join('.');
        const keys = Object.keys(obj).filter(k => !k.startsWith('_'));
        const metaKeys = Object.keys(obj).filter(k => k.startsWith('_'));

        let html = '<div class="card-grid">';

        keys.forEach(key => {
            const value = obj[key];
            const childPath = [...path, key];
            const childPathKey = childPath.join('.');
            const valueType = this.getValueType(value);
            const isComplex = valueType === 'object' || valueType === 'array';
            const isChildExpanded = this.expandedPaths.has(childPathKey);

            // Check if this is an aggregated field card
            const isAggregated = this.dataSource === 'records' && value && typeof value === 'object' && value._fieldId;

            html += `
                <div class="scrubber-card ${valueType} ${isComplex ? 'expandable' : ''} ${isChildExpanded ? 'expanded' : ''}"
                     data-path="${this.escapeHtml(childPathKey)}"
                     data-key="${this.escapeHtml(key)}"
                     data-type="${valueType}">
                    <div class="card-header">
                        ${isComplex ? `<span class="card-toggle">${isChildExpanded ? '▼' : '▶'}</span>` : ''}
                        <span class="card-key">${this.escapeHtml(key)}</span>
                        <span class="card-type-badge ${valueType}">${this.getTypeBadge(valueType, value)}</span>
                    </div>
                    ${isAggregated ? this.renderAggregatedCardBody(value) : this.renderCardBody(value, valueType)}
                    <div class="card-actions">
                        <button class="card-action pivot-btn" data-action="pivot" title="Pivot options">
                            <i class="ph ph-funnel"></i>
                        </button>
                    </div>
                </div>
            `;

            // Render children if expanded
            if (isComplex && isChildExpanded) {
                html += `<div class="card-children" data-parent="${this.escapeHtml(childPathKey)}">`;
                html += this.renderCards(value, childPath);
                html += '</div>';
            }
        });

        html += '</div>';
        return html;
    }

    /**
     * Render aggregated field card body (from records view)
     */
    renderAggregatedCardBody(fieldData) {
        const coverage = fieldData._coverage || 0;
        const uniqueValues = fieldData._uniqueValues || 0;
        const samples = fieldData._samples || [];
        const distribution = fieldData._valueDistribution || [];

        let html = '<div class="card-body aggregated">';

        // Coverage bar
        html += `
            <div class="coverage-stat">
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${coverage}%"></div>
                </div>
                <span class="coverage-label">${coverage}% coverage</span>
            </div>
        `;

        // Unique values count
        html += `<div class="unique-stat">${uniqueValues} unique value${uniqueValues !== 1 ? 's' : ''}</div>`;

        // Value distribution as clickable chips
        if (distribution.length > 0) {
            html += '<div class="value-distribution">';
            distribution.forEach(item => {
                const displayValue = this.formatValuePreview(item.value);
                html += `
                    <button class="value-chip" data-value="${this.escapeHtml(JSON.stringify(item.value))}" data-field-id="${fieldData._fieldId}">
                        <span class="chip-value">${this.escapeHtml(displayValue)}</span>
                        <span class="chip-count">${item.count}</span>
                    </button>
                `;
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Render card body for simple values
     */
    renderCardBody(value, type) {
        let preview = '';

        if (type === 'array') {
            preview = `${value.length} item${value.length !== 1 ? 's' : ''}`;
        } else if (type === 'object') {
            const keys = Object.keys(value).filter(k => !k.startsWith('_'));
            preview = `${keys.length} field${keys.length !== 1 ? 's' : ''}`;
        } else if (type === 'null' || type === 'undefined') {
            preview = type;
        } else {
            preview = this.formatValuePreview(value);
        }

        return `
            <div class="card-body">
                <span class="card-value ${type}">${this.escapeHtml(preview)}</span>
            </div>
        `;
    }

    /**
     * Render array as cards
     */
    renderArrayCards(arr, path, isExpanded) {
        let html = '<div class="array-cards">';

        arr.forEach((item, index) => {
            const childPath = [...path, `[${index}]`];
            const childPathKey = childPath.join('.');
            const valueType = this.getValueType(item);
            const isComplex = valueType === 'object' || valueType === 'array';
            const isChildExpanded = this.expandedPaths.has(childPathKey);

            html += `
                <div class="scrubber-card array-item ${valueType} ${isComplex ? 'expandable' : ''} ${isChildExpanded ? 'expanded' : ''}"
                     data-path="${this.escapeHtml(childPathKey)}"
                     data-index="${index}"
                     data-type="${valueType}">
                    <div class="card-header">
                        ${isComplex ? `<span class="card-toggle">${isChildExpanded ? '▼' : '▶'}</span>` : ''}
                        <span class="card-index">[${index}]</span>
                        <span class="card-type-badge ${valueType}">${this.getTypeBadge(valueType, item)}</span>
                    </div>
                    ${this.renderCardBody(item, valueType)}
                    <div class="card-actions">
                        <button class="card-action pivot-btn" data-action="pivot" title="Pivot options">
                            <i class="ph ph-funnel"></i>
                        </button>
                    </div>
                </div>
            `;

            // Render children if expanded
            if (isComplex && isChildExpanded) {
                html += `<div class="card-children" data-parent="${this.escapeHtml(childPathKey)}">`;
                html += this.renderCards(item, childPath);
                html += '</div>';
            }
        });

        html += '</div>';
        return html;
    }

    /**
     * Render value card
     */
    renderValueCard(value, path) {
        const type = this.getValueType(value);
        const pathKey = path.join('.');

        return `
            <div class="scrubber-card value-only ${type}"
                 data-path="${this.escapeHtml(pathKey)}"
                 data-type="${type}">
                <div class="card-body">
                    <span class="card-value ${type}">${this.escapeHtml(this.formatValuePreview(value))}</span>
                </div>
                <div class="card-actions">
                    <button class="card-action pivot-btn" data-action="pivot" title="Pivot options">
                        <i class="ph ph-funnel"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get type badge text
     */
    getTypeBadge(type, value) {
        switch (type) {
            case 'array':
                return `[] ${Array.isArray(value) ? value.length : ''}`;
            case 'object':
                return '{}';
            case 'string':
                return 'str';
            case 'integer':
            case 'number':
                return 'num';
            case 'boolean':
                return 'bool';
            case 'null':
                return 'null';
            case 'date':
                return 'date';
            case 'url':
                return 'url';
            case 'email':
                return 'email';
            default:
                return type;
        }
    }

    /**
     * Format value for preview
     */
    formatValuePreview(value, maxLen = 50) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
            return value.length > maxLen ? value.substring(0, maxLen) + '...' : value;
        }
        if (Array.isArray(value)) return `[${value.length}]`;
        if (typeof value === 'object') return '{...}';
        return String(value);
    }

    /**
     * Update breadcrumb trail
     */
    updateBreadcrumb() {
        const breadcrumb = this.panel?.querySelector('#scrubberBreadcrumb');
        if (!breadcrumb) return;

        let html = '<span class="breadcrumb-item root" data-path="$">$</span>';

        if (this.selectedPath && this.selectedPath.length > 1) {
            const parts = this.selectedPath.slice(1); // Skip $
            let currentPath = ['$'];

            parts.forEach((part, i) => {
                currentPath.push(part);
                const pathKey = currentPath.join('.');
                html += `<span class="breadcrumb-sep">›</span>`;
                html += `<span class="breadcrumb-item ${i === parts.length - 1 ? 'active' : ''}" data-path="${this.escapeHtml(pathKey)}">${this.escapeHtml(part)}</span>`;
            });
        }

        breadcrumb.innerHTML = html;
        this.attachBreadcrumbListeners();
    }

    // ========================================================================
    // PIVOT ACTIONS
    // ========================================================================

    /**
     * Show pivot menu for a card
     */
    showPivotMenu(card, event) {
        // Remove existing menu
        this.closePivotMenu();

        const path = card.dataset.path;
        const pathParts = path.split('.');
        const key = card.dataset.key || pathParts[pathParts.length - 1];
        const type = card.dataset.type;
        const value = this.getValueAtPath(pathParts);

        // Get field info if available
        const fieldId = this.getFieldIdFromPath(pathParts);

        const menu = document.createElement('div');
        menu.className = 'pivot-menu';
        menu.innerHTML = this.renderPivotMenuContent(key, value, type, fieldId, path);

        // Position menu
        const rect = event.target.closest('.card-action').getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left}px`;

        document.body.appendChild(menu);
        this.currentPivotMenu = menu;

        // Attach menu action listeners
        menu.querySelectorAll('.pivot-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const action = opt.dataset.action;
                this.executePivotAction(action, {
                    path,
                    pathParts,
                    key,
                    value,
                    type,
                    fieldId,
                    filterValue: opt.dataset.filterValue ? JSON.parse(opt.dataset.filterValue) : value
                });
                this.closePivotMenu();
            });
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick = (e) => {
                if (!menu.contains(e.target)) {
                    this.closePivotMenu();
                }
            }, { once: true });
        }, 0);
    }

    /**
     * Render pivot menu content
     */
    renderPivotMenuContent(key, value, type, fieldId, path) {
        const isComplex = type === 'object' || type === 'array';
        const isPrimitive = !isComplex && value !== null && value !== undefined;
        const hasFieldId = !!fieldId;

        let html = '<div class="pivot-menu-header">Pivot Actions</div>';

        // Filter actions
        html += '<div class="pivot-section">';
        html += '<div class="pivot-section-title">Filter</div>';

        if (isPrimitive && hasFieldId) {
            html += `
                <button class="pivot-option" data-action="filter-equals" data-filter-value="${this.escapeHtml(JSON.stringify(value))}">
                    <i class="ph ph-equals"></i>
                    <span>Where ${this.escapeHtml(key)} = "${this.formatValuePreview(value, 20)}"</span>
                </button>
            `;

            if (type === 'string') {
                html += `
                    <button class="pivot-option" data-action="filter-contains" data-filter-value="${this.escapeHtml(JSON.stringify(value))}">
                        <i class="ph ph-text-aa"></i>
                        <span>Where ${this.escapeHtml(key)} contains "${this.formatValuePreview(value, 15)}"</span>
                    </button>
                `;
            }

            if (type === 'number' || type === 'integer') {
                html += `
                    <button class="pivot-option" data-action="filter-greater">
                        <i class="ph ph-caret-up"></i>
                        <span>Where ${this.escapeHtml(key)} > ${value}</span>
                    </button>
                    <button class="pivot-option" data-action="filter-less">
                        <i class="ph ph-caret-down"></i>
                        <span>Where ${this.escapeHtml(key)} < ${value}</span>
                    </button>
                `;
            }
        }

        if (hasFieldId) {
            html += `
                <button class="pivot-option" data-action="filter-not-empty">
                    <i class="ph ph-check-circle"></i>
                    <span>Where ${this.escapeHtml(key)} is not empty</span>
                </button>
                <button class="pivot-option" data-action="filter-empty">
                    <i class="ph ph-prohibit"></i>
                    <span>Where ${this.escapeHtml(key)} is empty</span>
                </button>
            `;
        }
        html += '</div>';

        // Group/Sort actions
        if (hasFieldId) {
            html += '<div class="pivot-section">';
            html += '<div class="pivot-section-title">Organize</div>';
            html += `
                <button class="pivot-option" data-action="group-by">
                    <i class="ph ph-rows"></i>
                    <span>Group by ${this.escapeHtml(key)}</span>
                </button>
                <button class="pivot-option" data-action="sort-asc">
                    <i class="ph ph-sort-ascending"></i>
                    <span>Sort by ${this.escapeHtml(key)} (A→Z)</span>
                </button>
                <button class="pivot-option" data-action="sort-desc">
                    <i class="ph ph-sort-descending"></i>
                    <span>Sort by ${this.escapeHtml(key)} (Z→A)</span>
                </button>
            `;
            html += '</div>';
        }

        // View creation actions
        html += '<div class="pivot-section">';
        html += '<div class="pivot-section-title">Create View</div>';
        html += `
            <button class="pivot-option" data-action="create-focused-view">
                <i class="ph ph-eye"></i>
                <span>Create focused view on ${this.escapeHtml(key)}</span>
            </button>
        `;

        if (isPrimitive && hasFieldId) {
            html += `
                <button class="pivot-option" data-action="create-filtered-view">
                    <i class="ph ph-funnel-simple"></i>
                    <span>Create view: ${this.escapeHtml(key)} = "${this.formatValuePreview(value, 15)}"</span>
                </button>
            `;
        }

        if (type === 'array' && Array.isArray(value)) {
            html += `
                <button class="pivot-option" data-action="explore-array">
                    <i class="ph ph-list-bullets"></i>
                    <span>Explore ${value.length} items</span>
                </button>
            `;
        }
        html += '</div>';

        // Copy actions
        html += '<div class="pivot-section">';
        html += '<div class="pivot-section-title">Copy</div>';
        html += `
            <button class="pivot-option" data-action="copy-path">
                <i class="ph ph-path"></i>
                <span>Copy path: ${this.escapeHtml(path)}</span>
            </button>
            <button class="pivot-option" data-action="copy-value">
                <i class="ph ph-copy"></i>
                <span>Copy value</span>
            </button>
        `;
        html += '</div>';

        return html;
    }

    /**
     * Execute pivot action
     */
    executePivotAction(action, context) {
        const { path, pathParts, key, value, type, fieldId, filterValue } = context;

        switch (action) {
            case 'filter-equals':
                this.applyFilter(fieldId, 'equals', filterValue);
                break;

            case 'filter-contains':
                this.applyFilter(fieldId, 'contains', filterValue);
                break;

            case 'filter-greater':
                this.applyFilter(fieldId, 'greaterThan', value);
                break;

            case 'filter-less':
                this.applyFilter(fieldId, 'lessThan', value);
                break;

            case 'filter-not-empty':
                this.applyFilter(fieldId, 'notEmpty', null);
                break;

            case 'filter-empty':
                this.applyFilter(fieldId, 'isEmpty', null);
                break;

            case 'group-by':
                this.applyGroup(fieldId);
                break;

            case 'sort-asc':
                this.applySort(fieldId, 'asc');
                break;

            case 'sort-desc':
                this.applySort(fieldId, 'desc');
                break;

            case 'create-focused-view':
                this.createFocusedView(fieldId, key);
                break;

            case 'create-filtered-view':
                this.createFilteredView(fieldId, key, filterValue);
                break;

            case 'explore-array':
                this.expandPath(pathParts);
                break;

            case 'copy-path':
                navigator.clipboard?.writeText(path);
                this.showToast('Path copied');
                break;

            case 'copy-value':
                navigator.clipboard?.writeText(JSON.stringify(value, null, 2));
                this.showToast('Value copied');
                break;
        }
    }

    /**
     * Apply filter action
     */
    applyFilter(fieldId, operator, value) {
        if (!fieldId) {
            this.showToast('Cannot filter: no field ID');
            return;
        }

        const filter = { fieldId, operator, value };

        if (this.onFilterApply) {
            this.onFilterApply(filter);
        } else if (this.currentView) {
            if (!this.currentView.filters) {
                this.currentView.filters = [];
            }
            this.currentView.filters.push(filter);
            this.currentView.isDirty = true;

            if (window.renderCurrentView) {
                window.renderCurrentView();
            }
        }

        this.showToast(`Filter applied: ${operator}`);
    }

    /**
     * Apply group action
     */
    applyGroup(fieldId) {
        if (!fieldId) {
            this.showToast('Cannot group: no field ID');
            return;
        }

        if (this.onGroupApply) {
            this.onGroupApply(fieldId);
        } else if (this.currentView) {
            if (!this.currentView.groups) {
                this.currentView.groups = [];
            }
            // Clear existing groups and add new one
            this.currentView.groups = [{ fieldId }];
            this.currentView.isDirty = true;

            if (window.renderCurrentView) {
                window.renderCurrentView();
            }
        }

        this.showToast(`Grouped by field`);
    }

    /**
     * Apply sort action
     */
    applySort(fieldId, direction) {
        if (!fieldId) {
            this.showToast('Cannot sort: no field ID');
            return;
        }

        if (this.currentView) {
            if (!this.currentView.sorts) {
                this.currentView.sorts = [];
            }
            // Clear existing sorts and add new one
            this.currentView.sorts = [{ fieldId, direction }];
            this.currentView.isDirty = true;

            if (window.renderCurrentView) {
                window.renderCurrentView();
            }
        }

        this.showToast(`Sorted ${direction === 'asc' ? 'ascending' : 'descending'}`);
    }

    /**
     * Create focused view
     */
    createFocusedView(fieldId, fieldName) {
        if (!this.state || !this.currentSet) {
            this.showToast('Cannot create view: no state context');
            return;
        }

        if (typeof createViewFromFocus === 'function') {
            const focus = {
                kind: 'field',
                id: fieldId,
                fieldName
            };
            const view = createViewFromFocus(this.state, focus, `Focus: ${fieldName}`);
            if (view && this.onViewCreate) {
                this.onViewCreate(view);
            }
            this.showToast(`View created: Focus: ${fieldName}`);
        } else {
            this.showToast('View management not available');
        }
    }

    /**
     * Create filtered view
     */
    createFilteredView(fieldId, fieldName, value) {
        if (!this.state || !this.currentSet) {
            this.showToast('Cannot create view: no state context');
            return;
        }

        if (typeof createViewFromFocus === 'function') {
            const focus = {
                kind: 'value',
                fieldId,
                fieldName,
                value
            };
            const displayValue = this.formatValuePreview(value, 20);
            const view = createViewFromFocus(this.state, focus, `${fieldName} = ${displayValue}`);
            if (view && this.onViewCreate) {
                this.onViewCreate(view);
            }
            this.showToast(`View created: ${fieldName} = ${displayValue}`);
        } else {
            this.showToast('View management not available');
        }
    }

    /**
     * Close pivot menu
     */
    closePivotMenu() {
        if (this.currentPivotMenu) {
            this.currentPivotMenu.remove();
            this.currentPivotMenu = null;
        }
        if (this.handleOutsideClick) {
            document.removeEventListener('click', this.handleOutsideClick);
        }
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    /**
     * Get value at JSON path
     */
    getValueAtPath(pathParts) {
        let current = this.jsonData;

        for (let i = 1; i < pathParts.length; i++) { // Skip '$'
            const part = pathParts[i];
            if (current === null || current === undefined) return undefined;

            // Handle array index
            if (part.startsWith('[') && part.endsWith(']')) {
                const index = parseInt(part.slice(1, -1), 10);
                current = Array.isArray(current) ? current[index] : undefined;
            } else {
                current = current[part];
            }
        }

        return current;
    }

    /**
     * Get field ID from path
     */
    getFieldIdFromPath(pathParts) {
        if (pathParts.length < 2) return null;

        const fieldKey = pathParts[1]; // First key after $

        if (this.dataSource === 'records' || this.dataSource === 'schema') {
            // Look up field by name
            const schema = this.currentSet?.schema || [];
            const field = schema.find(f => f.name === fieldKey || f.id === fieldKey);
            return field?.id || null;
        }

        if (this.dataSource === 'record') {
            // Direct field access
            const schema = this.currentSet?.schema || [];
            const field = schema.find(f => f.id === fieldKey || f.name === fieldKey);
            return field?.id || fieldKey;
        }

        return fieldKey;
    }

    /**
     * Expand path to show children
     */
    expandPath(pathParts) {
        const pathKey = pathParts.join('.');
        this.expandedPaths.add(pathKey);
        this.selectedPath = pathParts;
        this.refreshContent();
    }

    /**
     * Collapse path
     */
    collapsePath(pathParts) {
        const pathKey = pathParts.join('.');
        this.expandedPaths.delete(pathKey);
        this.refreshContent();
    }

    /**
     * Toggle path expansion
     */
    togglePath(pathKey) {
        if (this.expandedPaths.has(pathKey)) {
            this.expandedPaths.delete(pathKey);
        } else {
            this.expandedPaths.add(pathKey);
        }
        this.refreshContent();
    }

    /**
     * Expand all paths
     */
    expandAll() {
        this.walkJSON(this.jsonData, ['$'], (path, value) => {
            if (typeof value === 'object' && value !== null) {
                this.expandedPaths.add(path.join('.'));
            }
        });
        this.refreshContent();
    }

    /**
     * Collapse all paths
     */
    collapseAll() {
        this.expandedPaths.clear();
        this.expandedPaths.add('$'); // Keep root expanded
        this.refreshContent();
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    /**
     * Attach main event listeners
     */
    attachEventListeners() {
        // Close button
        this.panel?.querySelector('#scrubberClose')?.addEventListener('click', () => this.close());

        // Click outside to close
        this.panel?.addEventListener('click', (e) => {
            if (e.target === this.panel) {
                this.close();
            }
        });

        // Escape key
        document.addEventListener('keydown', this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.panel) {
                this.closePivotMenu();
                // If no menu was open, close panel
                if (!this.currentPivotMenu) {
                    this.close();
                }
            }
        });

        // Expand/collapse all
        this.panel?.querySelector('#scrubberExpandAll')?.addEventListener('click', () => this.expandAll());
        this.panel?.querySelector('#scrubberCollapseAll')?.addEventListener('click', () => this.collapseAll());
    }

    /**
     * Attach card event listeners
     */
    attachCardListeners() {
        const body = this.panel?.querySelector('#scrubberBody');
        if (!body) return;

        // Card click to expand/collapse
        body.querySelectorAll('.scrubber-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger on action button clicks
                if (e.target.closest('.card-actions')) return;
                if (e.target.closest('.value-chip')) return;

                const pathKey = card.dataset.path;
                if (card.classList.contains('expandable')) {
                    this.togglePath(pathKey);
                }

                this.selectedPath = pathKey.split('.');
                this.updateBreadcrumb();
            });
        });

        // Pivot button clicks
        body.querySelectorAll('.pivot-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.scrubber-card');
                this.showPivotMenu(card, e);
            });
        });

        // Value chip clicks (direct filter)
        body.querySelectorAll('.value-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = JSON.parse(chip.dataset.value);
                const fieldId = chip.dataset.fieldId;
                this.applyFilter(fieldId, 'equals', value);
            });
        });
    }

    /**
     * Attach breadcrumb listeners
     */
    attachBreadcrumbListeners() {
        const breadcrumb = this.panel?.querySelector('#scrubberBreadcrumb');
        if (!breadcrumb) return;

        breadcrumb.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const pathKey = item.dataset.path;
                const pathParts = pathKey.split('.');
                this.selectedPath = pathParts;

                // Collapse everything below this path
                const toRemove = [];
                this.expandedPaths.forEach(p => {
                    if (p.startsWith(pathKey) && p !== pathKey && p.length > pathKey.length) {
                        toRemove.push(p);
                    }
                });
                toRemove.forEach(p => this.expandedPaths.delete(p));

                this.refreshContent();
            });
        });
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        if (window.showToast) {
            window.showToast(message);
        } else {
            const toast = document.createElement('div');
            toast.className = 'scrubber-toast';
            toast.textContent = message;
            document.body.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('show'));
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        }
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.EOJSONScrubber = EOJSONScrubber;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EOJSONScrubber };
}
