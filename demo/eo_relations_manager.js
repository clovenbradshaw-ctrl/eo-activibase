/**
 * EO Relations Manager
 *
 * Page-level component for managing relations in a world/base.
 * Follows the tabbed page pattern similar to Chrome settings.
 *
 * Features:
 * - Filter tabs by EO operator type
 * - List view of all relations
 * - Add/Edit/Delete relations via modal
 * - Import relations
 * - Relation types accordion
 */

(function(global) {
    'use strict';

    // EO Operators for filtering
    const EO_OPERATORS = [
        { code: 'All', name: 'All', description: 'Show all relations' },
        { code: 'NUL', name: 'NUL', description: 'Recognize absence' },
        { code: 'DES', name: 'DES', description: 'Designate / name' },
        { code: 'INS', name: 'INS', description: 'Instantiate / create / produce' },
        { code: 'SEG', name: 'SEG', description: 'Segment / bound' },
        { code: 'CON', name: 'CON', description: 'Connect / relate / depend' },
        { code: 'ALT', name: 'ALT', description: 'Alternate / cycle / order' },
        { code: 'SYN', name: 'SYN', description: 'Synthesize / merge / combine' },
        { code: 'SUP', name: 'SUP', description: 'Superpose / layer contexts' },
        { code: 'REC', name: 'REC', description: 'Recurse / feedback / self-update' }
    ];

    // State
    let currentWorldId = null;
    let currentFilter = 'All';
    let relations = [];
    let relationTypes = [];
    let showRelationTypesPanel = false;

    // ============================================================================
    // DATA ACCESS
    // ============================================================================

    /**
     * Load relation types from the mappings file
     */
    async function loadRelationTypes() {
        try {
            const response = await fetch('data/relationship_operator_mappings.json');
            const data = await response.json();
            relationTypes = data.mappings || [];
            return relationTypes;
        } catch (error) {
            console.error('Failed to load relation types:', error);
            return [];
        }
    }

    /**
     * Get relations for a world
     */
    function getRelations(state, worldId) {
        if (!state || !state.relations) return [];
        return Array.from(state.relations.values()).filter(r => r.worldId === worldId);
    }

    /**
     * Filter relations by operator
     */
    function filterRelations(allRelations, operatorCode) {
        if (operatorCode === 'All') return allRelations;
        return allRelations.filter(r => r.operator === operatorCode);
    }

    /**
     * Get relation type info by name
     */
    function getRelationTypeInfo(relationName) {
        return relationTypes.find(t =>
            t.relationship.toLowerCase() === relationName.toLowerCase()
        ) || null;
    }

    // ============================================================================
    // RENDER FUNCTIONS
    // ============================================================================

    /**
     * Render the complete Relations Manager page
     */
    function render(state, worldId) {
        currentWorldId = worldId;
        const world = state?.worlds?.get(worldId) || { name: 'Unknown World' };
        relations = getRelations(state, worldId);
        const filteredRelations = filterRelations(relations, currentFilter);

        return `
            <div class="relations-manager">
                ${renderHeader(world, relations.length)}
                ${renderFilterTabs()}
                ${renderRelationsList(filteredRelations)}
                ${renderRelationTypesAccordion()}
            </div>
        `;
    }

    /**
     * Render page header
     */
    function renderHeader(world, count) {
        return `
            <div class="relations-header">
                <div class="relations-header-left">
                    <span class="world-badge">
                        <i class="ph ph-globe"></i>
                        ${escapeHtml(world.name || 'WORLD')}
                    </span>
                    <div class="relations-title-group">
                        <h1 class="relations-title">Relations</h1>
                        <span class="relations-count">${count} relationship${count !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="relations-header-right">
                    <button class="btn-import" onclick="RelationsManager.showImportModal()">
                        <i class="ph ph-upload-simple"></i>
                        Import
                    </button>
                    <button class="btn-add" onclick="RelationsManager.showAddModal()">
                        <i class="ph ph-plus"></i>
                        Add
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render filter tabs
     */
    function renderFilterTabs() {
        return `
            <div class="relations-filter-tabs">
                ${EO_OPERATORS.map(op => `
                    <button
                        class="filter-tab ${currentFilter === op.code ? 'active' : ''}"
                        data-operator="${op.code}"
                        onclick="RelationsManager.setFilter('${op.code}')"
                        title="${op.description}"
                    >
                        ${op.name}
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render relations list
     */
    function renderRelationsList(relationsList) {
        if (relationsList.length === 0) {
            return `
                <div class="relations-empty">
                    <i class="ph ph-link-break"></i>
                    <p>No relations found</p>
                    <span class="hint">
                        ${currentFilter === 'All'
                            ? 'Add your first relation to get started'
                            : `No relations with operator "${currentFilter}"`}
                    </span>
                </div>
            `;
        }

        return `
            <div class="relations-list">
                ${relationsList.map(rel => renderRelationItem(rel)).join('')}
            </div>
        `;
    }

    /**
     * Render a single relation item
     */
    function renderRelationItem(relation) {
        const typeInfo = getRelationTypeInfo(relation.type);
        const operatorClass = relation.operator ? `operator-${relation.operator.toLowerCase()}` : '';

        return `
            <div class="relation-item ${operatorClass}" data-relation-id="${relation.id}">
                <div class="relation-content">
                    <div class="relation-main">
                        <span class="relation-source">${escapeHtml(relation.source)}</span>
                        <span class="relation-connector">
                            <span class="relation-dash">&mdash;</span>
                            <a href="#" class="relation-type" onclick="RelationsManager.showTypeInfo('${relation.type}'); return false;">
                                ${escapeHtml(relation.type)}
                            </a>
                            <span class="relation-arrow">&rarr;</span>
                        </span>
                        <span class="relation-target">${escapeHtml(relation.target)}</span>
                    </div>
                    ${relation.description ? `
                        <div class="relation-description">${escapeHtml(relation.description)}</div>
                    ` : ''}
                </div>
                <div class="relation-actions">
                    <button class="btn-text" onclick="RelationsManager.showEditModal('${relation.id}')">Edit</button>
                    <button class="btn-text danger" onclick="RelationsManager.confirmDelete('${relation.id}')">Delete</button>
                </div>
            </div>
        `;
    }

    /**
     * Render relation types accordion
     */
    function renderRelationTypesAccordion() {
        return `
            <div class="relation-types-accordion">
                <button
                    class="accordion-toggle ${showRelationTypesPanel ? 'open' : ''}"
                    onclick="RelationsManager.toggleRelationTypes()"
                >
                    <i class="ph ${showRelationTypesPanel ? 'ph-caret-down' : 'ph-caret-right'}"></i>
                    Relation types (${relationTypes.length})
                </button>
                ${showRelationTypesPanel ? renderRelationTypesPanel() : ''}
            </div>
        `;
    }

    /**
     * Render relation types panel
     */
    function renderRelationTypesPanel() {
        // Group by operator
        const grouped = {};
        EO_OPERATORS.filter(op => op.code !== 'All').forEach(op => {
            grouped[op.code] = relationTypes.filter(t => t.operator === op.code);
        });

        return `
            <div class="relation-types-panel">
                ${Object.entries(grouped).map(([operator, types]) => `
                    <div class="type-group">
                        <h4 class="type-group-header">
                            <span class="operator-badge operator-${operator.toLowerCase()}">${operator}</span>
                            <span class="type-count">${types.length} types</span>
                        </h4>
                        <div class="type-list">
                            ${types.slice(0, 10).map(t => `
                                <span class="type-chip" title="Category: ${t.category}">
                                    ${escapeHtml(t.relationship)}
                                </span>
                            `).join('')}
                            ${types.length > 10 ? `
                                <span class="type-more">+${types.length - 10} more</span>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ============================================================================
    // MODAL FUNCTIONS
    // ============================================================================

    /**
     * Show Add Relation modal
     */
    function showAddModal() {
        showRelationModal({
            title: 'Add Relation',
            relation: {
                source: '',
                type: '',
                target: '',
                operator: 'CON',
                description: ''
            },
            onSave: (data) => {
                // Add relation logic here
                console.log('Adding relation:', data);
                closeModal();
                refreshPage();
            }
        });
    }

    /**
     * Show Edit Relation modal
     */
    function showEditModal(relationId) {
        const relation = relations.find(r => r.id === relationId);
        if (!relation) return;

        showRelationModal({
            title: 'Edit Relation',
            relation: { ...relation },
            onSave: (data) => {
                // Update relation logic here
                console.log('Updating relation:', relationId, data);
                closeModal();
                refreshPage();
            }
        });
    }

    /**
     * Show the relation modal (add/edit)
     */
    function showRelationModal(config) {
        const { title, relation, onSave } = config;

        const modalHtml = `
            <div class="modal-overlay" id="relationModal" onclick="RelationsManager.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>${escapeHtml(title)}</h2>
                        <button class="modal-close" onclick="RelationsManager.closeModal()">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="relationSource">Source</label>
                            <input
                                type="text"
                                id="relationSource"
                                class="form-input"
                                value="${escapeHtml(relation.source)}"
                                placeholder="Enter source entity..."
                            >
                        </div>
                        <div class="form-group">
                            <label for="relationType">Relationship Type</label>
                            <div class="relation-type-input">
                                <input
                                    type="text"
                                    id="relationType"
                                    class="form-input"
                                    value="${escapeHtml(relation.type)}"
                                    placeholder="e.g., is linked to, creates, filters by..."
                                    list="relationTypesList"
                                >
                                <datalist id="relationTypesList">
                                    ${relationTypes.slice(0, 50).map(t => `
                                        <option value="${escapeHtml(t.relationship)}">${t.operator}</option>
                                    `).join('')}
                                </datalist>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="relationTarget">Target</label>
                            <input
                                type="text"
                                id="relationTarget"
                                class="form-input"
                                value="${escapeHtml(relation.target)}"
                                placeholder="Enter target entity..."
                            >
                        </div>
                        <div class="form-group">
                            <label for="relationOperator">Operator</label>
                            <select id="relationOperator" class="form-input">
                                ${EO_OPERATORS.filter(op => op.code !== 'All').map(op => `
                                    <option value="${op.code}" ${relation.operator === op.code ? 'selected' : ''}>
                                        ${op.code} - ${op.description}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="relationDescription">Description (optional)</label>
                            <textarea
                                id="relationDescription"
                                class="form-input form-textarea"
                                placeholder="Describe this relationship..."
                            >${escapeHtml(relation.description || '')}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="RelationsManager.closeModal()">Cancel</button>
                        <button class="btn-primary" id="saveRelationBtn">
                            <i class="ph ph-check"></i>
                            Save
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Attach save handler
        document.getElementById('saveRelationBtn').addEventListener('click', () => {
            const data = {
                source: document.getElementById('relationSource').value,
                type: document.getElementById('relationType').value,
                target: document.getElementById('relationTarget').value,
                operator: document.getElementById('relationOperator').value,
                description: document.getElementById('relationDescription').value
            };
            onSave(data);
        });

        // Focus first input
        document.getElementById('relationSource').focus();
    }

    /**
     * Show Import modal
     */
    function showImportModal() {
        const modalHtml = `
            <div class="modal-overlay" id="importModal" onclick="RelationsManager.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Import Relations</h2>
                        <button class="modal-close" onclick="RelationsManager.closeModal()">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="import-zone">
                            <i class="ph ph-file-arrow-up"></i>
                            <p>Drop a file here or click to browse</p>
                            <span class="hint">Supports JSON, CSV formats</span>
                            <input type="file" id="importFileInput" accept=".json,.csv" hidden>
                        </div>
                        <div class="import-options">
                            <label class="checkbox-label">
                                <input type="checkbox" id="importOverwrite">
                                <span>Overwrite existing relations</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="importAutoOperator" checked>
                                <span>Auto-detect operator from relation type</span>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="RelationsManager.closeModal()">Cancel</button>
                        <button class="btn-primary" id="importBtn" disabled>
                            <i class="ph ph-upload-simple"></i>
                            Import
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Setup file input
        const importZone = document.querySelector('.import-zone');
        const fileInput = document.getElementById('importFileInput');

        importZone.addEventListener('click', () => fileInput.click());
        importZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            importZone.classList.add('dragover');
        });
        importZone.addEventListener('dragleave', () => {
            importZone.classList.remove('dragover');
        });
        importZone.addEventListener('drop', (e) => {
            e.preventDefault();
            importZone.classList.remove('dragover');
            handleImportFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleImportFile(fileInput.files[0]);
            }
        });
    }

    /**
     * Handle import file selection
     */
    function handleImportFile(file) {
        if (!file) return;

        const importZone = document.querySelector('.import-zone');
        const importBtn = document.getElementById('importBtn');

        importZone.innerHTML = `
            <i class="ph ph-file-text"></i>
            <p>${escapeHtml(file.name)}</p>
            <span class="hint">${formatFileSize(file.size)}</span>
        `;
        importBtn.disabled = false;

        importBtn.onclick = () => {
            // Handle import logic here
            console.log('Importing file:', file.name);
            closeModal();
        };
    }

    /**
     * Show type info tooltip/popover
     */
    function showTypeInfo(typeName) {
        const typeInfo = getRelationTypeInfo(typeName);
        if (!typeInfo) {
            console.log('Type not found:', typeName);
            return;
        }

        alert(`Relation Type: ${typeInfo.relationship}\nOperator: ${typeInfo.operator}\nCategory: ${typeInfo.category}`);
    }

    /**
     * Confirm delete relation
     */
    function confirmDelete(relationId) {
        const relation = relations.find(r => r.id === relationId);
        if (!relation) return;

        const confirmed = confirm(`Delete relation "${relation.source} → ${relation.type} → ${relation.target}"?`);
        if (confirmed) {
            // Delete relation logic here
            console.log('Deleting relation:', relationId);
            refreshPage();
        }
    }

    /**
     * Close modal
     */
    function closeModal(event) {
        if (event && event.target !== event.currentTarget) return;

        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => modal.remove());
    }

    // ============================================================================
    // INTERACTION HANDLERS
    // ============================================================================

    /**
     * Set filter and re-render
     */
    function setFilter(operatorCode) {
        currentFilter = operatorCode;
        refreshPage();
    }

    /**
     * Toggle relation types panel
     */
    function toggleRelationTypes() {
        showRelationTypesPanel = !showRelationTypesPanel;
        refreshPage();
    }

    /**
     * Refresh the page content
     */
    function refreshPage() {
        const container = document.querySelector('.relations-manager');
        if (container && global.state) {
            container.outerHTML = render(global.state, currentWorldId);
        }
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Escape HTML entities
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format file size
     */
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Initialize the Relations Manager
     */
    async function initialize(state, worldId) {
        currentWorldId = worldId;
        await loadRelationTypes();
        return render(state, worldId);
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    global.RelationsManager = {
        initialize,
        render,
        setFilter,
        toggleRelationTypes,
        showAddModal,
        showEditModal,
        showImportModal,
        showTypeInfo,
        confirmDelete,
        closeModal,
        loadRelationTypes
    };

})(typeof window !== 'undefined' ? window : this);
