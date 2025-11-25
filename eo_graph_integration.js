/**
 * EO Graph Integration
 *
 * Integrates EOGraph with the existing EO entity system (sets, records, fields, views).
 * Provides utilities to:
 * - Build graphs from entity relationships
 * - Apply operators to existing linked record fields
 * - Generate relationship views
 * - Export/import graphs
 */

class EOGraphIntegration {
    constructor(eoIntegration) {
        this.eo = eoIntegration;
        this.graphs = new Map(); // graphId -> EOGraph
        this.activeGraphId = null;
    }

    // =========================================================================
    // GRAPH CREATION FROM ENTITIES
    // =========================================================================

    /**
     * Create a graph from a set's records and their relationships
     */
    createGraphFromSet(setId, options = {}) {
        const set = this.eo?.sets?.get(setId);
        if (!set) {
            console.warn(`Set ${setId} not found`);
            return null;
        }

        const graph = new EOGraph({
            name: options.name || `${set.name} Graph`,
            description: `Entity graph for set: ${set.name}`,
            frameId: setId
        });

        const schema = set.schema || [];
        const records = Array.from(set.records?.values() || []);

        // Add records as nodes
        records.forEach(record => {
            const position = this._inferPositionFromRecord(record, schema);

            graph.addNode(record.id, {
                label: this._getRecordLabel(record, schema),
                position,
                entityType: 'record',
                entityId: record.id,
                data: {
                    setId,
                    fields: record
                }
            });
        });

        // Find linked record fields and create edges
        const linkedFields = schema.filter(f => f.type === 'LINKED_RECORD');

        linkedFields.forEach(field => {
            records.forEach(record => {
                const linkedValue = record[field.id] || record[field.name];
                if (!linkedValue) return;

                // Handle single or multiple linked records
                const linkedIds = Array.isArray(linkedValue) ? linkedValue : [linkedValue];

                linkedIds.forEach(targetId => {
                    // Infer operator from field configuration or name
                    const operator = this._inferOperatorFromField(field);

                    graph.addEdge(record.id, targetId, operator, {
                        verb: field.linkVerb || EO_OPERATORS[operator].verbs[0],
                        data: {
                            fieldId: field.id,
                            fieldName: field.name
                        }
                    });
                });
            });
        });

        // Also add formula dependency edges
        const formulaFields = schema.filter(f => f.type === 'FORMULA');

        formulaFields.forEach(field => {
            if (!field.formula) return;

            // Extract field references from formula
            const refs = this._extractFormulaRefs(field.formula);

            refs.forEach(refFieldName => {
                // SYN operator for formula derivation
                graph.addEdge(`field_${refFieldName}`, `field_${field.name}`, 'SYN', {
                    verb: 'derives from',
                    data: {
                        formula: field.formula
                    }
                });
            });
        });

        this.graphs.set(graph.id, graph);
        this.activeGraphId = graph.id;

        return graph;
    }

    /**
     * Create a cross-set relationship graph
     */
    createCrossSetGraph(setIds, options = {}) {
        const graph = new EOGraph({
            name: options.name || 'Cross-Set Relationships',
            description: `Relationships across sets: ${setIds.join(', ')}`
        });

        // Add nodes from all sets
        setIds.forEach(setId => {
            const set = this.eo?.sets?.get(setId);
            if (!set) return;

            // Add set as a container node
            graph.addNode(`set_${setId}`, {
                label: set.name,
                position: 14, // Explicit Form - center
                entityType: 'set',
                entityId: setId
            });

            // Add records
            const records = Array.from(set.records?.values() || []);
            records.forEach(record => {
                graph.addNode(record.id, {
                    label: this._getRecordLabel(record, set.schema || []),
                    position: 15,
                    entityType: 'record',
                    entityId: record.id,
                    data: { setId }
                });

                // INS edge from set to record
                graph.addEdge(`set_${setId}`, record.id, 'INS', {
                    verb: 'instantiates'
                });
            });
        });

        // Find cross-set links
        setIds.forEach(setId => {
            const set = this.eo?.sets?.get(setId);
            if (!set) return;

            const schema = set.schema || [];
            const linkedFields = schema.filter(f =>
                f.type === 'LINKED_RECORD' && f.linkedSetId && setIds.includes(f.linkedSetId)
            );

            linkedFields.forEach(field => {
                const records = Array.from(set.records?.values() || []);
                records.forEach(record => {
                    const linkedValue = record[field.id] || record[field.name];
                    if (!linkedValue) return;

                    const linkedIds = Array.isArray(linkedValue) ? linkedValue : [linkedValue];
                    linkedIds.forEach(targetId => {
                        const operator = this._inferOperatorFromField(field);
                        graph.addEdge(record.id, targetId, operator, {
                            verb: field.linkVerb,
                            data: { fieldId: field.id, crossSet: true }
                        });
                    });
                });
            });
        });

        this.graphs.set(graph.id, graph);
        return graph;
    }

    /**
     * Create a field dependency graph for a set
     */
    createFieldGraph(setId) {
        const set = this.eo?.sets?.get(setId);
        if (!set) return null;

        const graph = new EOGraph({
            name: `${set.name} Field Dependencies`,
            description: 'Field relationships and dependencies'
        });

        const schema = set.schema || [];

        // Add all fields as nodes
        schema.forEach(field => {
            const position = this._inferPositionFromFieldType(field.type);

            graph.addNode(`field_${field.id}`, {
                label: field.name,
                position,
                entityType: 'field',
                entityId: field.id,
                data: {
                    type: field.type,
                    setId
                }
            });
        });

        // Add dependency edges
        schema.forEach(field => {
            // Formula dependencies (SYN)
            if (field.type === 'FORMULA' && field.formula) {
                const refs = this._extractFormulaRefs(field.formula);
                refs.forEach(refName => {
                    const refField = schema.find(f => f.name === refName);
                    if (refField) {
                        graph.addEdge(`field_${refField.id}`, `field_${field.id}`, 'SYN', {
                            verb: 'derives from'
                        });
                    }
                });
            }

            // Linked record dependencies (CON)
            if (field.type === 'LINKED_RECORD') {
                graph.addEdge(`field_${field.id}`, `set_${field.linkedSetId}`, 'CON', {
                    verb: 'references'
                });
            }

            // Rollup dependencies (SYN + CON)
            if (field.type === 'ROLLUP' && field.sourceField) {
                graph.addEdge(`field_${field.sourceField}`, `field_${field.id}`, 'SYN', {
                    verb: 'aggregates'
                });
            }
        });

        this.graphs.set(graph.id, graph);
        return graph;
    }

    // =========================================================================
    // OPERATOR INFERENCE
    // =========================================================================

    /**
     * Infer EO operator from a field's configuration
     */
    _inferOperatorFromField(field) {
        // Check for explicit operator configuration
        if (field.eoOperator && EO_OPERATORS[field.eoOperator]) {
            return field.eoOperator;
        }

        // Check for verb hint
        if (field.linkVerb) {
            return inferOperatorFromVerb(field.linkVerb);
        }

        // Infer from field type
        switch (field.type) {
            case 'LINKED_RECORD':
                return 'CON';
            case 'ROLLUP':
            case 'FORMULA':
                return 'SYN';
            case 'LOOKUP':
                return 'CON';
            default:
                return 'CON';
        }
    }

    /**
     * Infer position from record data
     */
    _inferPositionFromRecord(record, schema) {
        // Check for explicit position
        if (record._eoPosition) {
            return record._eoPosition;
        }

        // Check for status/state field to determine stability
        const statusField = schema.find(f =>
            f.name.toLowerCase().includes('status') ||
            f.name.toLowerCase().includes('state')
        );

        if (statusField) {
            const status = record[statusField.id] || record[statusField.name];
            if (status) {
                const s = String(status).toLowerCase();
                if (s.includes('draft') || s.includes('pending')) return 9;  // Nascent Form
                if (s.includes('active') || s.includes('approved')) return 14; // Explicit Form
                if (s.includes('complete') || s.includes('archived')) return 20; // Pattern Mastery
            }
        }

        // Default to Explicit Form center
        return 14;
    }

    /**
     * Infer position from field type
     */
    _inferPositionFromFieldType(fieldType) {
        switch (fieldType) {
            case 'TEXT':
            case 'LONG_TEXT':
                return 10; // Nascent Form
            case 'NUMBER':
            case 'CURRENCY':
                return 14; // Explicit Form
            case 'DATE':
            case 'DATETIME':
                return 15;
            case 'SELECT':
            case 'MULTI_SELECT':
                return 12;
            case 'LINKED_RECORD':
                return 16; // Higher in Explicit Form
            case 'FORMULA':
            case 'ROLLUP':
                return 20; // Pattern Mastery - derived
            case 'ATTACHMENT':
                return 11;
            default:
                return 14;
        }
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    /**
     * Get a display label for a record
     */
    _getRecordLabel(record, schema) {
        // Try to find a primary/name field
        const nameField = schema.find(f =>
            f.isPrimary ||
            f.name.toLowerCase() === 'name' ||
            f.name.toLowerCase() === 'title'
        );

        if (nameField) {
            return record[nameField.id] || record[nameField.name] || record.id;
        }

        return record.id;
    }

    /**
     * Extract field references from a formula string
     */
    _extractFormulaRefs(formula) {
        const refs = [];
        const regex = /\{([^}]+)\}/g;
        let match;

        while ((match = regex.exec(formula)) !== null) {
            refs.push(match[1]);
        }

        return refs;
    }

    // =========================================================================
    // GRAPH MANAGEMENT
    // =========================================================================

    /**
     * Get a graph by ID
     */
    getGraph(graphId) {
        return this.graphs.get(graphId);
    }

    /**
     * Get the active graph
     */
    getActiveGraph() {
        return this.activeGraphId ? this.graphs.get(this.activeGraphId) : null;
    }

    /**
     * Set the active graph
     */
    setActiveGraph(graphId) {
        if (this.graphs.has(graphId)) {
            this.activeGraphId = graphId;
            return true;
        }
        return false;
    }

    /**
     * List all graphs
     */
    listGraphs() {
        return Array.from(this.graphs.values()).map(g => ({
            id: g.id,
            name: g.name,
            nodeCount: g.nodes.size,
            edgeCount: g.edges.size,
            createdAt: g.createdAt
        }));
    }

    /**
     * Delete a graph
     */
    deleteGraph(graphId) {
        if (this.activeGraphId === graphId) {
            this.activeGraphId = null;
        }
        return this.graphs.delete(graphId);
    }

    // =========================================================================
    // EXPORT/IMPORT
    // =========================================================================

    /**
     * Export all graphs to JSON
     */
    exportAll() {
        return {
            version: '1.0',
            exportedAt: Date.now(),
            activeGraphId: this.activeGraphId,
            graphs: Array.from(this.graphs.values()).map(g => g.toJSON())
        };
    }

    /**
     * Import graphs from JSON
     */
    importAll(data) {
        if (!data.graphs) return;

        data.graphs.forEach(graphData => {
            const graph = EOGraph.fromJSON(graphData);
            this.graphs.set(graph.id, graph);
        });

        if (data.activeGraphId && this.graphs.has(data.activeGraphId)) {
            this.activeGraphId = data.activeGraphId;
        }
    }

    /**
     * Export active graph to DOT format
     */
    exportToDOT() {
        const graph = this.getActiveGraph();
        return graph ? graph.toDOT() : null;
    }

    /**
     * Export active graph to Cytoscape format
     */
    exportToCytoscape() {
        const graph = this.getActiveGraph();
        return graph ? graph.toCytoscape() : null;
    }
}

// ============================================================================
// OPERATOR SELECTOR COMPONENT
// ============================================================================

/**
 * UI component for selecting an EO operator when creating relationships
 */
class EOOperatorSelector {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.getElementById(container)
            : container;

        this.options = {
            onSelect: options.onSelect || null,
            showDescriptions: options.showDescriptions !== false,
            selectedOperator: options.selectedOperator || 'CON'
        };

        this._render();
    }

    _render() {
        this.container.innerHTML = '';
        this.container.className = 'eo-operator-selector';
        this.container.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            padding: 12px;
            background: #f5f5f5;
            border-radius: 8px;
        `;

        Object.entries(EO_OPERATORS).forEach(([code, op]) => {
            const card = document.createElement('div');
            card.className = 'eo-operator-card';
            card.dataset.operator = code;
            card.style.cssText = `
                background: white;
                border: 2px solid ${code === this.options.selectedOperator ? op.style.color : '#e0e0e0'};
                border-radius: 6px;
                padding: 10px;
                cursor: pointer;
                transition: all 0.2s;
            `;

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <span style="font-size: 18px; color: ${op.style.color};">${op.symbol}</span>
                    <span style="font-weight: bold; font-family: monospace;">${code}</span>
                </div>
                <div style="font-size: 11px; color: #666;">${op.name}</div>
                ${this.options.showDescriptions ? `
                    <div style="font-size: 10px; color: #999; margin-top: 4px;">${op.description}</div>
                ` : ''}
            `;

            card.addEventListener('click', () => this._select(code));
            card.addEventListener('mouseenter', () => {
                card.style.borderColor = op.style.color;
                card.style.background = op.style.color + '10';
            });
            card.addEventListener('mouseleave', () => {
                if (code !== this.options.selectedOperator) {
                    card.style.borderColor = '#e0e0e0';
                    card.style.background = 'white';
                }
            });

            this.container.appendChild(card);
        });
    }

    _select(code) {
        this.options.selectedOperator = code;
        this._render();

        if (this.options.onSelect) {
            this.options.onSelect(code, EO_OPERATORS[code]);
        }
    }

    getSelected() {
        return this.options.selectedOperator;
    }

    setSelected(code) {
        if (EO_OPERATORS[code]) {
            this.options.selectedOperator = code;
            this._render();
        }
    }
}

// ============================================================================
// RELATIONSHIP MODAL
// ============================================================================

/**
 * Modal for creating/editing relationships between entities with operator selection
 */
class EORelationshipModal {
    constructor(graphIntegration) {
        this.integration = graphIntegration;
        this.modal = null;
        this.operatorSelector = null;
    }

    show(sourceEntity, targetEntity, existingEdge = null) {
        this._createModal(sourceEntity, targetEntity, existingEdge);
        this.modal.style.display = 'flex';
    }

    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    _createModal(source, target, existingEdge) {
        // Remove existing modal
        if (this.modal) {
            this.modal.remove();
        }

        this.modal = document.createElement('div');
        this.modal.className = 'eo-relationship-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 16px 0;">
                ${existingEdge ? 'Edit' : 'Create'} Relationship
            </h3>
            <div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 6px;">
                <div style="font-weight: bold;">${source.label || source.id}</div>
                <div style="text-align: center; padding: 8px 0; color: #666;">↓</div>
                <div style="font-weight: bold;">${target.label || target.id}</div>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    Select Operator (Relationship Type)
                </label>
                <div id="operator-selector-container"></div>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold;">
                    Verb (optional refinement)
                </label>
                <select id="verb-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </select>
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">
                    Cancel
                </button>
                <button id="save-btn" style="padding: 8px 16px; border: none; background: #1976D2; color: white; border-radius: 4px; cursor: pointer;">
                    ${existingEdge ? 'Update' : 'Create'} Relationship
                </button>
            </div>
        `;

        this.modal.appendChild(content);
        document.body.appendChild(this.modal);

        // Initialize operator selector
        const selectorContainer = content.querySelector('#operator-selector-container');
        this.operatorSelector = new EOOperatorSelector(selectorContainer, {
            selectedOperator: existingEdge?.operator || 'CON',
            showDescriptions: true,
            onSelect: (code, op) => {
                this._updateVerbSelect(code);
            }
        });

        // Initialize verb select
        this._updateVerbSelect(existingEdge?.operator || 'CON');

        // Event handlers
        content.querySelector('#cancel-btn').addEventListener('click', () => this.hide());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        content.querySelector('#save-btn').addEventListener('click', () => {
            const operator = this.operatorSelector.getSelected();
            const verb = content.querySelector('#verb-select').value;

            this._save(source.id, target.id, operator, verb, existingEdge);
            this.hide();
        });
    }

    _updateVerbSelect(operatorCode) {
        const select = this.modal.querySelector('#verb-select');
        const op = EO_OPERATORS[operatorCode];

        select.innerHTML = op.verbs.map(v =>
            `<option value="${v}">${v}</option>`
        ).join('');
    }

    _save(sourceId, targetId, operator, verb, existingEdge) {
        const graph = this.integration.getActiveGraph();
        if (!graph) return;

        if (existingEdge) {
            graph.updateEdge(existingEdge.id, { operator, verb });
        } else {
            graph.addEdge(sourceId, targetId, operator, { verb });
        }
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EOGraphIntegration,
        EOOperatorSelector,
        EORelationshipModal
    };
}

if (typeof window !== 'undefined') {
    window.EOGraphIntegration = EOGraphIntegration;
    window.EOOperatorSelector = EOOperatorSelector;
    window.EORelationshipModal = EORelationshipModal;
}
