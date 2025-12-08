/**
 * EO Query Builder UI
 * Visual interface for building EOQL queries
 *
 * @eo_operator DES
 * @eo_layer demo
 *
 * Provides a drag-and-drop visual interface for:
 * - Building EOQL queries graphically
 * - Editing SQL with live EOQL preview
 * - Viewing operator pipeline visualization
 * - Managing custom holons
 */

(function(global) {
    'use strict';

    // ============================================================================
    // QUERY BUILDER UI
    // ============================================================================

    /**
     * EOQueryBuilderUI - Visual query builder component
     */
    class EOQueryBuilderUI {
        constructor(container, options = {}) {
            this.container = typeof container === 'string'
                ? document.querySelector(container)
                : container;

            this.options = {
                theme: 'light',
                showSQL: true,
                showPipeline: true,
                showCrosswalk: true,
                dialect: 'postgresql',
                onQueryChange: null,
                ...options
            };

            this.query = null;
            this.sqlInput = '';

            this._init();
        }

        _init() {
            this._createStyles();
            this._render();
            this._attachEvents();

            // Initialize with empty query
            this._newQuery();
        }

        _createStyles() {
            if (document.getElementById('eoql-builder-styles')) return;

            const styles = document.createElement('style');
            styles.id = 'eoql-builder-styles';
            styles.textContent = `
                .eoql-builder {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--eoql-bg, #f5f5f5);
                    color: var(--eoql-text, #333);
                }

                .eoql-builder.theme-dark {
                    --eoql-bg: #1e1e1e;
                    --eoql-text: #e0e0e0;
                    --eoql-panel-bg: #252526;
                    --eoql-border: #3c3c3c;
                    --eoql-input-bg: #1e1e1e;
                    --eoql-accent: #569cd6;
                }

                .eoql-builder.theme-light {
                    --eoql-bg: #f5f5f5;
                    --eoql-text: #333;
                    --eoql-panel-bg: #fff;
                    --eoql-border: #ddd;
                    --eoql-input-bg: #fff;
                    --eoql-accent: #0066cc;
                }

                .eoql-toolbar {
                    display: flex;
                    align-items: center;
                    padding: 8px 12px;
                    background: var(--eoql-panel-bg);
                    border-bottom: 1px solid var(--eoql-border);
                    gap: 8px;
                }

                .eoql-toolbar-group {
                    display: flex;
                    gap: 4px;
                }

                .eoql-btn {
                    padding: 6px 12px;
                    border: 1px solid var(--eoql-border);
                    background: var(--eoql-panel-bg);
                    color: var(--eoql-text);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .eoql-btn:hover {
                    background: var(--eoql-accent);
                    color: white;
                    border-color: var(--eoql-accent);
                }

                .eoql-btn.active {
                    background: var(--eoql-accent);
                    color: white;
                }

                .eoql-main {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }

                .eoql-panel {
                    display: flex;
                    flex-direction: column;
                    background: var(--eoql-panel-bg);
                    border-right: 1px solid var(--eoql-border);
                }

                .eoql-panel-header {
                    padding: 8px 12px;
                    font-weight: 600;
                    font-size: 12px;
                    text-transform: uppercase;
                    color: var(--eoql-text);
                    opacity: 0.7;
                    border-bottom: 1px solid var(--eoql-border);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .eoql-panel-content {
                    flex: 1;
                    overflow: auto;
                    padding: 8px;
                }

                .eoql-operators-panel {
                    width: 200px;
                }

                .eoql-operator-item {
                    padding: 8px 12px;
                    margin: 4px 0;
                    border-radius: 4px;
                    cursor: grab;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    background: var(--eoql-input-bg);
                    border: 1px solid var(--eoql-border);
                }

                .eoql-operator-item:hover {
                    border-color: var(--eoql-accent);
                }

                .eoql-operator-item.dragging {
                    opacity: 0.5;
                }

                .eoql-operator-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 20px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: 600;
                    color: white;
                }

                .eoql-operator-NUL { background: #6c757d; }
                .eoql-operator-DES { background: #0d6efd; }
                .eoql-operator-INS { background: #198754; }
                .eoql-operator-SEG { background: #fd7e14; }
                .eoql-operator-CON { background: #6f42c1; }
                .eoql-operator-ALT { background: #d63384; }
                .eoql-operator-SYN { background: #20c997; }
                .eoql-operator-SUP { background: #0dcaf0; }
                .eoql-operator-REC { background: #dc3545; }

                .eoql-canvas {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }

                .eoql-pipeline {
                    flex: 1;
                    padding: 16px;
                    overflow: auto;
                    min-height: 200px;
                }

                .eoql-pipeline-empty {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--eoql-text);
                    opacity: 0.5;
                    font-style: italic;
                }

                .eoql-pipeline-node {
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    margin: 8px 0;
                    background: var(--eoql-input-bg);
                    border: 1px solid var(--eoql-border);
                    border-radius: 6px;
                    gap: 12px;
                }

                .eoql-pipeline-node:hover {
                    border-color: var(--eoql-accent);
                }

                .eoql-pipeline-node.selected {
                    border-color: var(--eoql-accent);
                    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
                }

                .eoql-node-content {
                    flex: 1;
                }

                .eoql-node-title {
                    font-weight: 600;
                    font-size: 13px;
                }

                .eoql-node-params {
                    font-size: 12px;
                    color: var(--eoql-text);
                    opacity: 0.7;
                    margin-top: 4px;
                    font-family: monospace;
                }

                .eoql-node-actions {
                    display: flex;
                    gap: 4px;
                }

                .eoql-node-btn {
                    padding: 4px 8px;
                    border: none;
                    background: transparent;
                    color: var(--eoql-text);
                    opacity: 0.5;
                    cursor: pointer;
                    border-radius: 3px;
                }

                .eoql-node-btn:hover {
                    opacity: 1;
                    background: var(--eoql-border);
                }

                .eoql-connector {
                    display: flex;
                    justify-content: center;
                    padding: 4px 0;
                }

                .eoql-connector-line {
                    width: 2px;
                    height: 20px;
                    background: var(--eoql-border);
                }

                .eoql-sql-panel {
                    border-top: 1px solid var(--eoql-border);
                    max-height: 300px;
                    display: flex;
                    flex-direction: column;
                }

                .eoql-sql-editor {
                    flex: 1;
                    padding: 12px;
                    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
                    font-size: 13px;
                    line-height: 1.5;
                    border: none;
                    resize: none;
                    background: var(--eoql-input-bg);
                    color: var(--eoql-text);
                }

                .eoql-sql-editor:focus {
                    outline: none;
                }

                .eoql-crosswalk-panel {
                    width: 280px;
                    border-left: 1px solid var(--eoql-border);
                }

                .eoql-crosswalk-item {
                    padding: 8px;
                    border-bottom: 1px solid var(--eoql-border);
                    font-size: 12px;
                }

                .eoql-crosswalk-sql {
                    font-family: monospace;
                    color: var(--eoql-accent);
                    font-weight: 600;
                }

                .eoql-crosswalk-arrow {
                    margin: 0 8px;
                    opacity: 0.5;
                }

                .eoql-crosswalk-eo {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }

                .eoql-holon-item {
                    padding: 8px 12px;
                    margin: 4px 0;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    background: var(--eoql-input-bg);
                    border: 1px solid var(--eoql-border);
                }

                .eoql-holon-item:hover {
                    border-color: var(--eoql-accent);
                }

                .eoql-holon-name {
                    font-weight: 600;
                }

                .eoql-holon-desc {
                    font-size: 11px;
                    opacity: 0.7;
                    margin-top: 2px;
                }

                .eoql-tabs {
                    display: flex;
                    border-bottom: 1px solid var(--eoql-border);
                }

                .eoql-tab {
                    padding: 8px 16px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    font-size: 13px;
                }

                .eoql-tab:hover {
                    background: var(--eoql-border);
                }

                .eoql-tab.active {
                    border-bottom-color: var(--eoql-accent);
                    color: var(--eoql-accent);
                }

                .eoql-drop-zone {
                    border: 2px dashed var(--eoql-border);
                    border-radius: 6px;
                    padding: 20px;
                    text-align: center;
                    margin: 8px 0;
                    opacity: 0.5;
                }

                .eoql-drop-zone.drag-over {
                    border-color: var(--eoql-accent);
                    background: rgba(0, 102, 204, 0.1);
                    opacity: 1;
                }

                .eoql-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .eoql-modal-content {
                    background: var(--eoql-panel-bg);
                    border-radius: 8px;
                    width: 500px;
                    max-height: 80vh;
                    overflow: auto;
                }

                .eoql-modal-header {
                    padding: 16px;
                    border-bottom: 1px solid var(--eoql-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .eoql-modal-title {
                    font-weight: 600;
                    font-size: 16px;
                }

                .eoql-modal-body {
                    padding: 16px;
                }

                .eoql-form-group {
                    margin-bottom: 16px;
                }

                .eoql-form-label {
                    display: block;
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 4px;
                }

                .eoql-form-input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--eoql-border);
                    border-radius: 4px;
                    background: var(--eoql-input-bg);
                    color: var(--eoql-text);
                    font-size: 13px;
                }

                .eoql-form-input:focus {
                    outline: none;
                    border-color: var(--eoql-accent);
                }

                .eoql-modal-footer {
                    padding: 16px;
                    border-top: 1px solid var(--eoql-border);
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }

                .eoql-status {
                    padding: 8px 12px;
                    font-size: 12px;
                    border-top: 1px solid var(--eoql-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .eoql-status-text {
                    opacity: 0.7;
                }

                .eoql-dialect-select {
                    padding: 4px 8px;
                    border: 1px solid var(--eoql-border);
                    border-radius: 4px;
                    background: var(--eoql-input-bg);
                    color: var(--eoql-text);
                    font-size: 12px;
                }
            `;
            document.head.appendChild(styles);
        }

        _render() {
            const theme = this.options.theme === 'dark' ? 'theme-dark' : 'theme-light';

            this.container.innerHTML = `
                <div class="eoql-builder ${theme}">
                    <div class="eoql-toolbar">
                        <div class="eoql-toolbar-group">
                            <button class="eoql-btn" data-action="new">
                                <span>New</span>
                            </button>
                            <button class="eoql-btn" data-action="import-sql">
                                <span>Import SQL</span>
                            </button>
                            <button class="eoql-btn" data-action="export-sql">
                                <span>Export SQL</span>
                            </button>
                        </div>
                        <div class="eoql-toolbar-group">
                            <button class="eoql-btn" data-action="undo">Undo</button>
                            <button class="eoql-btn" data-action="redo">Redo</button>
                        </div>
                        <div style="flex: 1;"></div>
                        <div class="eoql-toolbar-group">
                            <button class="eoql-btn ${this.options.showCrosswalk ? 'active' : ''}" data-action="toggle-crosswalk">
                                <span>Crosswalk</span>
                            </button>
                        </div>
                    </div>

                    <div class="eoql-main">
                        <!-- Operators Panel -->
                        <div class="eoql-panel eoql-operators-panel">
                            <div class="eoql-tabs">
                                <div class="eoql-tab active" data-tab="operators">Operators</div>
                                <div class="eoql-tab" data-tab="holons">Holons</div>
                            </div>
                            <div class="eoql-panel-content" id="eoql-operators-content">
                                ${this._renderOperatorsList()}
                            </div>
                        </div>

                        <!-- Main Canvas -->
                        <div class="eoql-canvas">
                            <div class="eoql-pipeline" id="eoql-pipeline">
                                <div class="eoql-pipeline-empty">
                                    Drag operators here to build your query
                                </div>
                            </div>

                            ${this.options.showSQL ? `
                                <div class="eoql-sql-panel">
                                    <div class="eoql-panel-header">
                                        <span>SQL</span>
                                        <select class="eoql-dialect-select" id="eoql-dialect">
                                            <option value="postgresql">PostgreSQL</option>
                                            <option value="mysql">MySQL</option>
                                            <option value="sqlite">SQLite</option>
                                            <option value="sqlserver">SQL Server</option>
                                            <option value="oracle">Oracle</option>
                                        </select>
                                    </div>
                                    <textarea class="eoql-sql-editor" id="eoql-sql-editor" placeholder="SELECT * FROM ..."></textarea>
                                </div>
                            ` : ''}
                        </div>

                        ${this.options.showCrosswalk ? `
                            <!-- Crosswalk Panel -->
                            <div class="eoql-panel eoql-crosswalk-panel" id="eoql-crosswalk-panel">
                                <div class="eoql-panel-header">
                                    <span>Crosswalk</span>
                                </div>
                                <div class="eoql-panel-content" id="eoql-crosswalk-content">
                                    ${this._renderCrosswalkList()}
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="eoql-status">
                        <span class="eoql-status-text" id="eoql-status">Ready</span>
                        <span id="eoql-node-count">0 operators</span>
                    </div>
                </div>
            `;
        }

        _renderOperatorsList() {
            const operators = [
                { op: 'INS', name: 'FROM', desc: 'Data source' },
                { op: 'DES', name: 'SELECT', desc: 'Select columns' },
                { op: 'SEG', name: 'WHERE', desc: 'Filter rows' },
                { op: 'SEG', name: 'GROUP BY', desc: 'Group rows' },
                { op: 'SEG', name: 'HAVING', desc: 'Filter groups' },
                { op: 'SEG', name: 'LIMIT', desc: 'Limit results' },
                { op: 'CON', name: 'JOIN', desc: 'Join tables' },
                { op: 'CON', name: 'LEFT JOIN', desc: 'Left outer join' },
                { op: 'ALT', name: 'ORDER BY', desc: 'Sort results' },
                { op: 'SYN', name: 'Aggregate', desc: 'SUM, COUNT, etc.' },
                { op: 'SUP', name: 'WINDOW', desc: 'Window function' },
                { op: 'SUP', name: 'WITH (CTE)', desc: 'Common table expr' },
                { op: 'NUL', name: 'COALESCE', desc: 'Handle nulls' },
                { op: 'REC', name: 'RECURSIVE', desc: 'Recursive query' }
            ];

            return operators.map(({ op, name, desc }) => `
                <div class="eoql-operator-item" draggable="true" data-operator="${op}" data-holon="${name}">
                    <span class="eoql-operator-badge eoql-operator-${op}">${op}</span>
                    <div>
                        <div style="font-weight: 600;">${name}</div>
                        <div style="font-size: 11px; opacity: 0.7;">${desc}</div>
                    </div>
                </div>
            `).join('');
        }

        _renderHolonsList() {
            const holons = global.EOQL?.registry?.getUserHolons() || {};
            const builtIn = [
                { name: 'WHERE', desc: 'Filter rows by condition' },
                { name: 'GROUP_BY', desc: 'Group rows by columns' },
                { name: 'ORDER_BY', desc: 'Sort results' },
                { name: 'INNER_JOIN', desc: 'Inner join tables' },
                { name: 'LEFT_JOIN', desc: 'Left outer join' },
                { name: 'SUM', desc: 'Sum aggregation' },
                { name: 'COUNT', desc: 'Count aggregation' },
                { name: 'AVG', desc: 'Average aggregation' }
            ];

            let html = '<div style="font-size: 11px; opacity: 0.7; margin-bottom: 8px;">Built-in Holons</div>';

            html += builtIn.map(h => `
                <div class="eoql-holon-item" data-holon="${h.name}">
                    <div class="eoql-holon-name">${h.name}</div>
                    <div class="eoql-holon-desc">${h.desc}</div>
                </div>
            `).join('');

            if (Object.keys(holons).length > 0) {
                html += '<div style="font-size: 11px; opacity: 0.7; margin: 12px 0 8px;">Custom Holons</div>';
                html += Object.entries(holons).map(([name, h]) => `
                    <div class="eoql-holon-item" data-holon="${name}">
                        <div class="eoql-holon-name">${name}</div>
                        <div class="eoql-holon-desc">${h.metadata?.description || ''}</div>
                    </div>
                `).join('');
            }

            return html;
        }

        _renderCrosswalkList() {
            const crosswalk = global.EOQueryCrosswalk?.SQL_TO_EOQL || {};
            const items = Object.entries(crosswalk).slice(0, 30);

            return items.map(([sql, mapping]) => `
                <div class="eoql-crosswalk-item">
                    <span class="eoql-crosswalk-sql">${sql}</span>
                    <span class="eoql-crosswalk-arrow">→</span>
                    <span class="eoql-crosswalk-eo">
                        <span class="eoql-operator-badge eoql-operator-${mapping.operator}">${mapping.operator}</span>
                    </span>
                </div>
            `).join('');
        }

        _renderPipeline() {
            const pipeline = this.container.querySelector('#eoql-pipeline');
            if (!this.query || this.query._pipeline.length === 0) {
                pipeline.innerHTML = `
                    <div class="eoql-drop-zone" id="eoql-drop-zone">
                        Drop operators here to build your query
                    </div>
                `;
                return;
            }

            let html = '';
            this.query._pipeline.forEach((node, index) => {
                if (index > 0) {
                    html += `
                        <div class="eoql-connector">
                            <div class="eoql-connector-line"></div>
                        </div>
                    `;
                }

                const paramsStr = JSON.stringify(node.params, null, 0)
                    .replace(/[{}"]/g, '')
                    .substring(0, 50);

                html += `
                    <div class="eoql-pipeline-node" data-index="${index}">
                        <span class="eoql-operator-badge eoql-operator-${node.operator}">${node.operator}</span>
                        <div class="eoql-node-content">
                            <div class="eoql-node-title">${this._getNodeTitle(node)}</div>
                            <div class="eoql-node-params">${paramsStr || 'No parameters'}</div>
                        </div>
                        <div class="eoql-node-actions">
                            <button class="eoql-node-btn" data-action="edit" title="Edit">✏️</button>
                            <button class="eoql-node-btn" data-action="delete" title="Delete">🗑️</button>
                        </div>
                    </div>
                `;
            });

            html += `
                <div class="eoql-drop-zone" id="eoql-drop-zone">
                    Drop to add operator
                </div>
            `;

            pipeline.innerHTML = html;
            this._updateStatus();
        }

        _getNodeTitle(node) {
            const { operator, params } = node;

            switch (operator) {
                case 'INS':
                    return `FROM ${params.source || '?'}`;
                case 'DES':
                    return `SELECT ${(params.columns || []).join(', ') || '*'}`;
                case 'SEG':
                    if (params.where) return 'WHERE ...';
                    if (params.groupBy) return `GROUP BY ${params.groupBy.join(', ')}`;
                    if (params.having) return 'HAVING ...';
                    if (params.limit) return `LIMIT ${params.limit}`;
                    if (params.distinct) return 'DISTINCT';
                    return 'SEG';
                case 'CON':
                    const joinType = (params.type || 'inner').toUpperCase();
                    return `${joinType} JOIN ${params.target || '?'}`;
                case 'ALT':
                    if (params.orderBy) return `ORDER BY ${params.orderBy.map(o => o.field).join(', ')}`;
                    return 'ALT';
                case 'SYN':
                    return `Aggregate: ${Object.keys(params.aggregations || {}).join(', ')}`;
                case 'SUP':
                    if (params.cte) return `WITH ${Object.keys(params.cte).join(', ')}`;
                    if (params.window) return `WINDOW ${params.window.fn}`;
                    return 'SUP';
                case 'NUL':
                    return params.coalesce ? 'COALESCE' : 'NULL handling';
                case 'REC':
                    return 'RECURSIVE';
                default:
                    return operator;
            }
        }

        _updateSQL() {
            if (!this.query || !this.options.showSQL) return;

            const editor = this.container.querySelector('#eoql-sql-editor');
            const dialect = this.container.querySelector('#eoql-dialect')?.value || 'postgresql';

            try {
                if (global.toSQL) {
                    editor.value = global.toSQL(this.query, dialect);
                } else {
                    editor.value = '-- SQL compiler not loaded';
                }
            } catch (e) {
                editor.value = `-- Error: ${e.message}`;
            }
        }

        _updateStatus() {
            const status = this.container.querySelector('#eoql-status');
            const count = this.container.querySelector('#eoql-node-count');

            if (this.query) {
                const nodeCount = this.query._pipeline.length;
                count.textContent = `${nodeCount} operator${nodeCount !== 1 ? 's' : ''}`;

                const validation = this.query.validate ? this.query.validate() : { valid: true };
                if (validation.valid) {
                    status.textContent = 'Valid query';
                    status.style.color = '#198754';
                } else {
                    status.textContent = validation.errors[0]?.message || 'Invalid query';
                    status.style.color = '#dc3545';
                }
            }
        }

        _attachEvents() {
            // Toolbar buttons
            this.container.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (btn) {
                    const action = btn.dataset.action;
                    this._handleAction(action, e);
                }

                // Pipeline node actions
                const nodeBtn = e.target.closest('.eoql-node-btn');
                if (nodeBtn) {
                    const node = nodeBtn.closest('.eoql-pipeline-node');
                    const index = parseInt(node.dataset.index);
                    const nodeAction = nodeBtn.dataset.action;

                    if (nodeAction === 'delete') {
                        this._deleteNode(index);
                    } else if (nodeAction === 'edit') {
                        this._editNode(index);
                    }
                }

                // Tab switching
                const tab = e.target.closest('.eoql-tab');
                if (tab) {
                    this._switchTab(tab.dataset.tab);
                }
            });

            // Drag and drop
            this.container.addEventListener('dragstart', (e) => {
                const item = e.target.closest('.eoql-operator-item');
                if (item) {
                    e.dataTransfer.setData('operator', item.dataset.operator);
                    e.dataTransfer.setData('holon', item.dataset.holon);
                    item.classList.add('dragging');
                }
            });

            this.container.addEventListener('dragend', (e) => {
                const item = e.target.closest('.eoql-operator-item');
                if (item) {
                    item.classList.remove('dragging');
                }
            });

            this.container.addEventListener('dragover', (e) => {
                const dropZone = e.target.closest('.eoql-drop-zone');
                if (dropZone) {
                    e.preventDefault();
                    dropZone.classList.add('drag-over');
                }
            });

            this.container.addEventListener('dragleave', (e) => {
                const dropZone = e.target.closest('.eoql-drop-zone');
                if (dropZone) {
                    dropZone.classList.remove('drag-over');
                }
            });

            this.container.addEventListener('drop', (e) => {
                const dropZone = e.target.closest('.eoql-drop-zone');
                if (dropZone) {
                    e.preventDefault();
                    dropZone.classList.remove('drag-over');

                    const operator = e.dataTransfer.getData('operator');
                    const holon = e.dataTransfer.getData('holon');

                    this._addOperator(operator, holon);
                }
            });

            // SQL editor changes
            const sqlEditor = this.container.querySelector('#eoql-sql-editor');
            if (sqlEditor) {
                let debounceTimer;
                sqlEditor.addEventListener('input', () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        this._parseSQL(sqlEditor.value);
                    }, 500);
                });
            }

            // Dialect change
            const dialectSelect = this.container.querySelector('#eoql-dialect');
            if (dialectSelect) {
                dialectSelect.addEventListener('change', () => {
                    this._updateSQL();
                });
            }
        }

        _handleAction(action, e) {
            switch (action) {
                case 'new':
                    this._newQuery();
                    break;
                case 'import-sql':
                    this._showImportModal();
                    break;
                case 'export-sql':
                    this._exportSQL();
                    break;
                case 'toggle-crosswalk':
                    this._toggleCrosswalk(e.target.closest('.eoql-btn'));
                    break;
                case 'undo':
                    // TODO: Implement undo
                    break;
                case 'redo':
                    // TODO: Implement redo
                    break;
            }
        }

        _newQuery() {
            if (global.EOQL) {
                this.query = global.EOQL.query();
            } else {
                this.query = {
                    _pipeline: [],
                    _addOp(op, params) {
                        this._pipeline.push({ operator: op, params });
                        return this;
                    },
                    toAST() {
                        return { type: 'query', pipeline: this._pipeline };
                    },
                    validate() {
                        return { valid: true, errors: [] };
                    }
                };
            }

            this._renderPipeline();
            this._updateSQL();
        }

        _addOperator(operator, holon) {
            if (!this.query) this._newQuery();

            // Map holon to operator params
            const params = this._getDefaultParams(operator, holon);

            this.query._addOp(operator, params);
            this._renderPipeline();
            this._updateSQL();
            this._notifyChange();
        }

        _getDefaultParams(operator, holon) {
            switch (holon) {
                case 'FROM':
                    return { source: 'table_name' };
                case 'SELECT':
                    return { columns: ['*'] };
                case 'WHERE':
                    return { where: { field: { $eq: 'value' } } };
                case 'GROUP BY':
                    return { groupBy: ['column'] };
                case 'HAVING':
                    return { having: { field: { $gt: 0 } } };
                case 'LIMIT':
                    return { limit: 100 };
                case 'JOIN':
                case 'INNER JOIN':
                    return { target: 'other_table', on: { id: 'other_table.foreign_id' }, type: 'inner' };
                case 'LEFT JOIN':
                    return { target: 'other_table', on: { id: 'other_table.foreign_id' }, type: 'left' };
                case 'ORDER BY':
                    return { orderBy: [{ field: 'column', direction: 'asc' }] };
                case 'Aggregate':
                    return { aggregations: { total: { fn: 'COUNT', field: '*' } } };
                case 'WINDOW':
                    return { window: { fn: 'ROW_NUMBER', partitionBy: ['column'] } };
                case 'WITH (CTE)':
                    return { cte: { cte_name: 'SELECT 1' } };
                case 'COALESCE':
                    return { coalesce: ['field1', 'field2'] };
                case 'RECURSIVE':
                    return { anchor: 'SELECT 1', recursive: 'SELECT n+1' };
                default:
                    return {};
            }
        }

        _deleteNode(index) {
            if (this.query && this.query._pipeline) {
                this.query._pipeline.splice(index, 1);
                this._renderPipeline();
                this._updateSQL();
                this._notifyChange();
            }
        }

        _editNode(index) {
            if (!this.query || !this.query._pipeline[index]) return;

            const node = this.query._pipeline[index];
            this._showEditModal(node, index);
        }

        _showEditModal(node, index) {
            const modal = document.createElement('div');
            modal.className = 'eoql-modal';
            modal.innerHTML = `
                <div class="eoql-modal-content">
                    <div class="eoql-modal-header">
                        <span class="eoql-modal-title">Edit ${node.operator} Operator</span>
                        <button class="eoql-btn" data-action="close-modal">×</button>
                    </div>
                    <div class="eoql-modal-body">
                        <div class="eoql-form-group">
                            <label class="eoql-form-label">Parameters (JSON)</label>
                            <textarea class="eoql-form-input" id="eoql-edit-params" rows="10">${JSON.stringify(node.params, null, 2)}</textarea>
                        </div>
                    </div>
                    <div class="eoql-modal-footer">
                        <button class="eoql-btn" data-action="close-modal">Cancel</button>
                        <button class="eoql-btn" data-action="save-edit" style="background: var(--eoql-accent); color: white;">Save</button>
                    </div>
                </div>
            `;

            modal.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;

                if (action === 'close-modal' || e.target === modal) {
                    modal.remove();
                } else if (action === 'save-edit') {
                    try {
                        const params = JSON.parse(modal.querySelector('#eoql-edit-params').value);
                        this.query._pipeline[index].params = params;
                        this._renderPipeline();
                        this._updateSQL();
                        this._notifyChange();
                        modal.remove();
                    } catch (err) {
                        alert('Invalid JSON: ' + err.message);
                    }
                }
            });

            document.body.appendChild(modal);
        }

        _showImportModal() {
            const modal = document.createElement('div');
            modal.className = 'eoql-modal';
            modal.innerHTML = `
                <div class="eoql-modal-content">
                    <div class="eoql-modal-header">
                        <span class="eoql-modal-title">Import SQL</span>
                        <button class="eoql-btn" data-action="close-modal">×</button>
                    </div>
                    <div class="eoql-modal-body">
                        <div class="eoql-form-group">
                            <label class="eoql-form-label">Paste SQL query</label>
                            <textarea class="eoql-form-input" id="eoql-import-sql" rows="10" placeholder="SELECT * FROM ..."></textarea>
                        </div>
                    </div>
                    <div class="eoql-modal-footer">
                        <button class="eoql-btn" data-action="close-modal">Cancel</button>
                        <button class="eoql-btn" data-action="import" style="background: var(--eoql-accent); color: white;">Import</button>
                    </div>
                </div>
            `;

            modal.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;

                if (action === 'close-modal' || e.target === modal) {
                    modal.remove();
                } else if (action === 'import') {
                    const sql = modal.querySelector('#eoql-import-sql').value;
                    this._parseSQL(sql);
                    modal.remove();
                }
            });

            document.body.appendChild(modal);
        }

        _parseSQL(sql) {
            if (!sql.trim()) return;

            try {
                if (global.parseSQL) {
                    this.query = global.parseSQL(sql);
                    this._renderPipeline();
                    this._updateSQL();
                    this._notifyChange();
                    this._setStatus('SQL imported successfully', 'success');
                } else {
                    this._setStatus('SQL parser not loaded', 'error');
                }
            } catch (e) {
                this._setStatus(`Parse error: ${e.message}`, 'error');
            }
        }

        _exportSQL() {
            const editor = this.container.querySelector('#eoql-sql-editor');
            if (editor) {
                navigator.clipboard?.writeText(editor.value);
                this._setStatus('SQL copied to clipboard', 'success');
            }
        }

        _toggleCrosswalk(btn) {
            const panel = this.container.querySelector('#eoql-crosswalk-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
                btn.classList.toggle('active');
            }
        }

        _switchTab(tab) {
            const tabs = this.container.querySelectorAll('.eoql-tab');
            tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

            const content = this.container.querySelector('#eoql-operators-content');
            if (tab === 'operators') {
                content.innerHTML = this._renderOperatorsList();
            } else if (tab === 'holons') {
                content.innerHTML = this._renderHolonsList();
            }
        }

        _setStatus(message, type = 'info') {
            const status = this.container.querySelector('#eoql-status');
            if (status) {
                status.textContent = message;
                status.style.color = type === 'error' ? '#dc3545' : type === 'success' ? '#198754' : '';
            }
        }

        _notifyChange() {
            if (this.options.onQueryChange) {
                this.options.onQueryChange(this.query);
            }
        }

        // ============================================================================
        // PUBLIC API
        // ============================================================================

        /**
         * Get current query
         */
        getQuery() {
            return this.query;
        }

        /**
         * Set query
         */
        setQuery(query) {
            this.query = query;
            this._renderPipeline();
            this._updateSQL();
        }

        /**
         * Get SQL
         */
        getSQL(dialect) {
            if (global.toSQL && this.query) {
                return global.toSQL(this.query, dialect || this.options.dialect);
            }
            return '';
        }

        /**
         * Import SQL
         */
        importSQL(sql) {
            this._parseSQL(sql);
        }

        /**
         * Set theme
         */
        setTheme(theme) {
            const builder = this.container.querySelector('.eoql-builder');
            builder.classList.remove('theme-light', 'theme-dark');
            builder.classList.add(`theme-${theme}`);
            this.options.theme = theme;
        }

        /**
         * Destroy the builder
         */
        destroy() {
            this.container.innerHTML = '';
        }
    }

    // ============================================================================
    // EXPORTS
    // ============================================================================

    global.EOQueryBuilderUI = EOQueryBuilderUI;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EOQueryBuilderUI;
    }

})(typeof window !== 'undefined' ? window : global);
