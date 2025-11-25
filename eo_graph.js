/**
 * EO Graph Module
 *
 * Core graph functionality built on the 9 EO operators as relationship types.
 * Every edge in the graph is one of 9 operators; every node occupies one of 27 positions.
 *
 * The 9 Operators (from Elegance of Objects, Chapter 8):
 *   NUL - recognize absence
 *   DES - designate/name
 *   INS - instantiate
 *   SEG - segment/bound
 *   CON - connect
 *   ALT - alternate
 *   SYN - synthesize
 *   SUP - superpose
 *   REC - recurse
 *
 * The 27 Positions (organized into 5 realms):
 *   Realm I   (1-6):   Pre-formation
 *   Realm II  (7-12):  Nascent Form
 *   Realm III (13-18): Explicit Form
 *   Realm IV  (19-24): Pattern Mastery
 *   Realm V   (25-27): Meta-stability
 */

// ============================================================================
// EO OPERATORS - The 9 fundamental relation types
// ============================================================================

const EO_OPERATORS = {
    NUL: {
        code: 'NUL',
        name: 'Null/Absence',
        symbol: '∅',
        description: 'Recognizes absence; detects what is missing or void',
        verbs: [
            'detects absence of',
            'flags missing value in',
            'depends on lack of',
            'reveals void in',
            'identifies gap in',
            'surfaces incomplete state of'
        ],
        style: {
            color: '#9E9E9E',
            strokeStyle: 'dashed',
            strokeWidth: 1,
            arrowShape: 'none'
        },
        precedence: 0
    },
    DES: {
        code: 'DES',
        name: 'Designate',
        symbol: '≝',
        description: 'Labels, names, or assigns identity to an entity',
        verbs: [
            'labels',
            'defines as',
            'names',
            'classifies as',
            'assigns identity',
            'tags',
            'indexes',
            'marks',
            'annotates'
        ],
        style: {
            color: '#424242',
            strokeStyle: 'solid',
            strokeWidth: 1,
            arrowShape: 'triangle'
        },
        precedence: 1
    },
    INS: {
        code: 'INS',
        name: 'Instantiate',
        symbol: '⊕',
        description: 'Creates, generates, or brings into existence',
        verbs: [
            'creates',
            'generates',
            'instantiates',
            'spawns',
            'produces',
            'originates',
            'initializes',
            'seeds',
            'emits',
            'constructs',
            'yields'
        ],
        style: {
            color: '#2E7D32',
            strokeStyle: 'solid',
            strokeWidth: 2,
            arrowShape: 'triangle-filled'
        },
        precedence: 2
    },
    SEG: {
        code: 'SEG',
        name: 'Segment',
        symbol: '⊢',
        description: 'Bounds, filters, partitions, or constrains scope',
        verbs: [
            'filters by',
            'limits to',
            'excludes',
            'includes',
            'constrains',
            'segments by',
            'partitions into',
            'sorts by',
            'extracts subset of',
            'bounds',
            'gates through'
        ],
        style: {
            color: '#C62828',
            strokeStyle: 'solid',
            strokeWidth: 1.5,
            arrowShape: 'bar'
        },
        precedence: 3
    },
    CON: {
        code: 'CON',
        name: 'Connect',
        symbol: '⋈',
        description: 'Links, relates, or associates entities',
        verbs: [
            'is linked to',
            'relates to',
            'connects with',
            'associates with',
            'depends on',
            'references',
            'maps onto',
            'joins with',
            'cross-references',
            'corresponds to',
            'aligns with'
        ],
        style: {
            color: '#1565C0',
            strokeStyle: 'solid',
            strokeWidth: 2,
            arrowShape: 'diamond'
        },
        precedence: 4
    },
    ALT: {
        code: 'ALT',
        name: 'Alternate',
        symbol: '⇌',
        description: 'Toggles, oscillates, or switches between states',
        verbs: [
            'toggles with',
            'alternates between',
            'cycles through',
            'flips with',
            'oscillates with',
            'switches based on',
            'transitions via'
        ],
        style: {
            color: '#00838F',
            strokeStyle: 'dotted',
            strokeWidth: 2,
            arrowShape: 'tee'
        },
        precedence: 5
    },
    SYN: {
        code: 'SYN',
        name: 'Synthesize',
        symbol: '⊗',
        description: 'Integrates, combines, or fuses into unified whole',
        verbs: [
            'integrates',
            'combines with',
            'aggregates',
            'fuses with',
            'summarizes from',
            'harmonizes with',
            'computes across',
            'merges into',
            'derives from'
        ],
        style: {
            color: '#6A1B9A',
            strokeStyle: 'solid',
            strokeWidth: 3,
            arrowShape: 'triangle-filled'
        },
        precedence: 6
    },
    SUP: {
        code: 'SUP',
        name: 'Superpose',
        symbol: '⧦',
        description: 'Overlays, holds in parallel, maintains multiple valid states',
        verbs: [
            'superposes',
            'overlays',
            'holds in parallel',
            'maintains layers of',
            'captures multi-valued inputs from',
            'bundles perspectives from',
            'keeps alternate forms of'
        ],
        style: {
            color: '#AD1457',
            strokeStyle: 'double',
            strokeWidth: 2,
            arrowShape: 'vee'
        },
        precedence: 7
    },
    REC: {
        code: 'REC',
        name: 'Recurse',
        symbol: '↻',
        description: 'Loops, iterates, feeds back into self',
        verbs: [
            'feeds back into',
            'iterates with',
            'recalibrates against',
            'loops through',
            'updates based on',
            'evolves using',
            'learns from'
        ],
        style: {
            color: '#E65100',
            strokeStyle: 'solid',
            strokeWidth: 2,
            arrowShape: 'circle',
            curved: true
        },
        precedence: 8
    }
};

// ============================================================================
// OPERATOR SEQUENCE VALIDATION
// ============================================================================

/**
 * Valid operator transitions (ontologically coherent sequences)
 */
const VALID_OPERATOR_TRANSITIONS = {
    NUL: ['DES', 'INS'],           // Absence leads to naming or creation
    DES: ['INS', 'SEG', 'CON'],    // Names enable instantiation, scoping, or linking
    INS: ['SEG', 'CON', 'ALT'],    // Created things can be scoped, linked, or varied
    SEG: ['CON', 'ALT', 'SYN'],    // Bounded things connect, alternate, or synthesize
    CON: ['ALT', 'SYN', 'SUP', 'REC'], // Connected things can vary, merge, layer, or loop
    ALT: ['CON', 'SYN', 'REC'],    // Alternates reconnect, synthesize, or recurse
    SYN: ['SUP', 'REC'],           // Syntheses can layer or recurse
    SUP: ['REC', 'ALT'],           // Superpositions can recurse or collapse to alternates
    REC: ['REC', 'SYN', 'ALT']     // Recursion can continue, synthesize, or alternate
};

/**
 * Check if an operator transition is valid
 */
function isValidOperatorTransition(fromOp, toOp) {
    const allowed = VALID_OPERATOR_TRANSITIONS[fromOp];
    return allowed ? allowed.includes(toOp) : false;
}

/**
 * Get valid next operators from current operator
 */
function getValidNextOperators(currentOp) {
    return VALID_OPERATOR_TRANSITIONS[currentOp] || [];
}

// ============================================================================
// EO POSITIONS - The 27 positions in 5 realms
// ============================================================================

const EO_REALMS = {
    I: {
        name: 'Pre-formation',
        range: [1, 6],
        description: 'Raw potential, undifferentiated possibility',
        style: {
            backgroundColor: '#FAFAFA',
            borderColor: '#E0E0E0',
            shape: 'ellipse'
        }
    },
    II: {
        name: 'Nascent Form',
        range: [7, 12],
        description: 'Emerging structure, initial differentiation',
        style: {
            backgroundColor: '#E3F2FD',
            borderColor: '#90CAF9',
            shape: 'round-rectangle'
        }
    },
    III: {
        name: 'Explicit Form',
        range: [13, 18],
        description: 'Stable structure, clear identity',
        style: {
            backgroundColor: '#E8F5E9',
            borderColor: '#A5D6A7',
            shape: 'rectangle'
        }
    },
    IV: {
        name: 'Pattern Mastery',
        range: [19, 24],
        description: 'Recognized patterns, established behavior',
        style: {
            backgroundColor: '#FFF3E0',
            borderColor: '#FFCC80',
            shape: 'diamond'
        }
    },
    V: {
        name: 'Meta-stability',
        range: [25, 27],
        description: 'Self-referential stability, recursive coherence',
        style: {
            backgroundColor: '#FFFDE7',
            borderColor: '#FFF59D',
            shape: 'star'
        }
    }
};

/**
 * Get realm for a position number
 */
function getRealmForPosition(position) {
    for (const [realmId, realm] of Object.entries(EO_REALMS)) {
        if (position >= realm.range[0] && position <= realm.range[1]) {
            return { id: realmId, ...realm };
        }
    }
    return null;
}

/**
 * EO Position definition with 3D coordinates
 * Coordinates: [identity, space, time] each -1, 0, or +1
 */
const EO_POSITIONS = {};

// Generate all 27 positions (3x3x3 cube)
let positionIndex = 1;
for (let identity = -1; identity <= 1; identity++) {
    for (let space = -1; space <= 1; space++) {
        for (let time = -1; time <= 1; time++) {
            EO_POSITIONS[positionIndex] = {
                position: positionIndex,
                coords: [identity, space, time],
                realm: getRealmForPosition(positionIndex),
                getStabilityType() {
                    // Holon positions have all coords same sign or zero
                    const nonZero = this.coords.filter(c => c !== 0);
                    if (nonZero.length === 0) return 'void';
                    if (nonZero.every(c => c > 0)) return 'holon-positive';
                    if (nonZero.every(c => c < 0)) return 'holon-negative';
                    return 'transition';
                }
            };
            positionIndex++;
        }
    }
}

// ============================================================================
// EO GRAPH - Core graph data structure
// ============================================================================

class EOGraph {
    constructor(config = {}) {
        this.id = config.id || `graph_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        this.name = config.name || 'Untitled Graph';
        this.description = config.description || '';

        // Core data structures
        this.nodes = new Map();
        this.edges = new Map();

        // Indexes for fast lookup
        this.edgesBySource = new Map();   // source -> [edge_ids]
        this.edgesByTarget = new Map();   // target -> [edge_ids]
        this.edgesByOperator = new Map(); // operator -> [edge_ids]
        this.nodesByPosition = new Map(); // position -> [node_ids]
        this.nodesByRealm = new Map();    // realm -> [node_ids]

        // Metadata
        this.createdAt = config.createdAt || Date.now();
        this.updatedAt = config.updatedAt || Date.now();
        this.frameId = config.frameId || null;

        // Event tracking
        this.events = [];
    }

    // =========================================================================
    // NODE OPERATIONS
    // =========================================================================

    /**
     * Add a node with EO position
     */
    addNode(id, config = {}) {
        const position = config.position || 14; // Default to center (identity+, space+, time+)
        const positionData = EO_POSITIONS[position];
        const realm = getRealmForPosition(position);

        const node = {
            id,
            label: config.label || id,
            position,
            coords: positionData?.coords || [0, 0, 0],
            stabilityType: positionData?.getStabilityType() || 'unknown',
            realm: realm?.id || 'III',

            // Entity type in the system
            entityType: config.entityType || 'generic', // record, field, set, view, definition
            entityId: config.entityId || null,

            // Visual overrides
            style: config.style || {},

            // Metadata
            data: config.data || {},
            createdAt: Date.now()
        };

        this.nodes.set(id, node);

        // Update indexes
        if (!this.nodesByPosition.has(position)) {
            this.nodesByPosition.set(position, new Set());
        }
        this.nodesByPosition.get(position).add(id);

        if (!this.nodesByRealm.has(node.realm)) {
            this.nodesByRealm.set(node.realm, new Set());
        }
        this.nodesByRealm.get(node.realm).add(id);

        this._logEvent('node_added', { nodeId: id, position, realm: node.realm });
        this.updatedAt = Date.now();

        return node;
    }

    /**
     * Get a node by ID
     */
    getNode(id) {
        return this.nodes.get(id);
    }

    /**
     * Update a node
     */
    updateNode(id, updates) {
        const node = this.nodes.get(id);
        if (!node) return null;

        const oldPosition = node.position;
        const oldRealm = node.realm;

        // Apply updates
        Object.assign(node, updates);

        // If position changed, update indexes
        if (updates.position && updates.position !== oldPosition) {
            this.nodesByPosition.get(oldPosition)?.delete(id);

            if (!this.nodesByPosition.has(updates.position)) {
                this.nodesByPosition.set(updates.position, new Set());
            }
            this.nodesByPosition.get(updates.position).add(id);

            // Update realm
            const newRealm = getRealmForPosition(updates.position);
            if (newRealm && newRealm.id !== oldRealm) {
                this.nodesByRealm.get(oldRealm)?.delete(id);
                if (!this.nodesByRealm.has(newRealm.id)) {
                    this.nodesByRealm.set(newRealm.id, new Set());
                }
                this.nodesByRealm.get(newRealm.id).add(id);
                node.realm = newRealm.id;
            }

            // Update derived properties
            const positionData = EO_POSITIONS[updates.position];
            if (positionData) {
                node.coords = positionData.coords;
                node.stabilityType = positionData.getStabilityType();
            }
        }

        this._logEvent('node_updated', { nodeId: id, updates });
        this.updatedAt = Date.now();

        return node;
    }

    /**
     * Remove a node and all connected edges
     */
    removeNode(id) {
        const node = this.nodes.get(id);
        if (!node) return false;

        // Remove all edges connected to this node
        const connectedEdges = [
            ...(this.edgesBySource.get(id) || []),
            ...(this.edgesByTarget.get(id) || [])
        ];

        connectedEdges.forEach(edgeId => this.removeEdge(edgeId));

        // Remove from indexes
        this.nodesByPosition.get(node.position)?.delete(id);
        this.nodesByRealm.get(node.realm)?.delete(id);

        // Remove node
        this.nodes.delete(id);

        this._logEvent('node_removed', { nodeId: id });
        this.updatedAt = Date.now();

        return true;
    }

    // =========================================================================
    // EDGE OPERATIONS (using EO operators)
    // =========================================================================

    /**
     * Add an edge with an EO operator
     */
    addEdge(sourceId, targetId, operator, config = {}) {
        // Validate operator
        if (!EO_OPERATORS[operator]) {
            console.warn(`Invalid operator: ${operator}. Must be one of: ${Object.keys(EO_OPERATORS).join(', ')}`);
            return null;
        }

        // Validate nodes exist
        if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
            console.warn(`Source or target node not found: ${sourceId} -> ${targetId}`);
            return null;
        }

        const edgeId = config.id || `edge_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const operatorDef = EO_OPERATORS[operator];

        const edge = {
            id: edgeId,
            source: sourceId,
            target: targetId,
            operator,

            // Operator metadata
            symbol: operatorDef.symbol,
            operatorName: operatorDef.name,

            // Specific verb used (optional refinement)
            verb: config.verb || operatorDef.verbs[0],

            // Direction and weight
            directed: config.directed !== false, // Default to directed
            weight: config.weight || 1,

            // Visual
            label: config.label || `${operatorDef.symbol} ${operator}`,
            style: { ...operatorDef.style, ...config.style },

            // Metadata
            data: config.data || {},
            createdAt: Date.now()
        };

        this.edges.set(edgeId, edge);

        // Update indexes
        if (!this.edgesBySource.has(sourceId)) {
            this.edgesBySource.set(sourceId, new Set());
        }
        this.edgesBySource.get(sourceId).add(edgeId);

        if (!this.edgesByTarget.has(targetId)) {
            this.edgesByTarget.set(targetId, new Set());
        }
        this.edgesByTarget.get(targetId).add(edgeId);

        if (!this.edgesByOperator.has(operator)) {
            this.edgesByOperator.set(operator, new Set());
        }
        this.edgesByOperator.get(operator).add(edgeId);

        this._logEvent('edge_added', { edgeId, source: sourceId, target: targetId, operator });
        this.updatedAt = Date.now();

        return edge;
    }

    /**
     * Get an edge by ID
     */
    getEdge(id) {
        return this.edges.get(id);
    }

    /**
     * Get all edges for an operator
     */
    getEdgesByOperator(operator) {
        const edgeIds = this.edgesByOperator.get(operator) || new Set();
        return Array.from(edgeIds).map(id => this.edges.get(id));
    }

    /**
     * Get outgoing edges from a node
     */
    getOutgoingEdges(nodeId) {
        const edgeIds = this.edgesBySource.get(nodeId) || new Set();
        return Array.from(edgeIds).map(id => this.edges.get(id));
    }

    /**
     * Get incoming edges to a node
     */
    getIncomingEdges(nodeId) {
        const edgeIds = this.edgesByTarget.get(nodeId) || new Set();
        return Array.from(edgeIds).map(id => this.edges.get(id));
    }

    /**
     * Update an edge
     */
    updateEdge(edgeId, updates) {
        const edge = this.edges.get(edgeId);
        if (!edge) return null;

        const oldOperator = edge.operator;

        // Apply updates
        Object.assign(edge, updates);

        // If operator changed, update index and style
        if (updates.operator && updates.operator !== oldOperator) {
            if (!EO_OPERATORS[updates.operator]) {
                console.warn(`Invalid operator: ${updates.operator}`);
                edge.operator = oldOperator;
                return edge;
            }

            this.edgesByOperator.get(oldOperator)?.delete(edgeId);
            if (!this.edgesByOperator.has(updates.operator)) {
                this.edgesByOperator.set(updates.operator, new Set());
            }
            this.edgesByOperator.get(updates.operator).add(edgeId);

            // Update operator-derived properties
            const operatorDef = EO_OPERATORS[updates.operator];
            edge.symbol = operatorDef.symbol;
            edge.operatorName = operatorDef.name;
            edge.style = { ...operatorDef.style, ...edge.style };
            edge.label = `${operatorDef.symbol} ${updates.operator}`;
        }

        this._logEvent('edge_updated', { edgeId, updates });
        this.updatedAt = Date.now();

        return edge;
    }

    /**
     * Remove an edge
     */
    removeEdge(edgeId) {
        const edge = this.edges.get(edgeId);
        if (!edge) return false;

        // Remove from indexes
        this.edgesBySource.get(edge.source)?.delete(edgeId);
        this.edgesByTarget.get(edge.target)?.delete(edgeId);
        this.edgesByOperator.get(edge.operator)?.delete(edgeId);

        // Remove edge
        this.edges.delete(edgeId);

        this._logEvent('edge_removed', { edgeId });
        this.updatedAt = Date.now();

        return true;
    }

    // =========================================================================
    // GRAPH QUERIES
    // =========================================================================

    /**
     * Find paths between two nodes
     */
    findPaths(sourceId, targetId, maxDepth = 5) {
        const paths = [];
        const visited = new Set();

        const dfs = (currentId, path, operators) => {
            if (path.length > maxDepth) return;
            if (currentId === targetId) {
                paths.push({ nodes: [...path], operators: [...operators] });
                return;
            }

            visited.add(currentId);

            const outgoing = this.getOutgoingEdges(currentId);
            for (const edge of outgoing) {
                if (!visited.has(edge.target)) {
                    path.push(edge.target);
                    operators.push(edge.operator);
                    dfs(edge.target, path, operators);
                    path.pop();
                    operators.pop();
                }
            }

            visited.delete(currentId);
        };

        dfs(sourceId, [sourceId], []);
        return paths;
    }

    /**
     * Get subgraph for a specific operator chain
     */
    getOperatorChain(startNodeId, operatorSequence) {
        const result = {
            nodes: [this.getNode(startNodeId)],
            edges: [],
            valid: true
        };

        let currentNodeId = startNodeId;

        for (const operator of operatorSequence) {
            const edges = this.getOutgoingEdges(currentNodeId)
                .filter(e => e.operator === operator);

            if (edges.length === 0) {
                result.valid = false;
                break;
            }

            // Take first matching edge
            const edge = edges[0];
            result.edges.push(edge);
            result.nodes.push(this.getNode(edge.target));
            currentNodeId = edge.target;
        }

        return result;
    }

    /**
     * Get nodes by realm
     */
    getNodesByRealm(realmId) {
        const nodeIds = this.nodesByRealm.get(realmId) || new Set();
        return Array.from(nodeIds).map(id => this.nodes.get(id));
    }

    /**
     * Get nodes by position
     */
    getNodesByPosition(position) {
        const nodeIds = this.nodesByPosition.get(position) || new Set();
        return Array.from(nodeIds).map(id => this.nodes.get(id));
    }

    /**
     * Get graph statistics
     */
    getStatistics() {
        const operatorCounts = {};
        Object.keys(EO_OPERATORS).forEach(op => {
            operatorCounts[op] = (this.edgesByOperator.get(op) || new Set()).size;
        });

        const realmCounts = {};
        Object.keys(EO_REALMS).forEach(realm => {
            realmCounts[realm] = (this.nodesByRealm.get(realm) || new Set()).size;
        });

        return {
            nodeCount: this.nodes.size,
            edgeCount: this.edges.size,
            operatorCounts,
            realmCounts,
            density: this.nodes.size > 1
                ? this.edges.size / (this.nodes.size * (this.nodes.size - 1))
                : 0
        };
    }

    // =========================================================================
    // EXPORT METHODS
    // =========================================================================

    /**
     * Export to JSON format
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            frameId: this.frameId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            nodes: Array.from(this.nodes.values()),
            edges: Array.from(this.edges.values()),
            statistics: this.getStatistics()
        };
    }

    /**
     * Export to DOT format (Graphviz)
     */
    toDOT() {
        const lines = [
            `digraph "${this.name}" {`,
            '  // Graph settings',
            '  rankdir=LR;',
            '  node [fontname="Arial", fontsize=10];',
            '  edge [fontname="Arial", fontsize=9];',
            ''
        ];

        // Add realm subgraphs
        Object.entries(EO_REALMS).forEach(([realmId, realm]) => {
            const realmNodes = this.getNodesByRealm(realmId);
            if (realmNodes.length > 0) {
                lines.push(`  subgraph cluster_realm_${realmId} {`);
                lines.push(`    label="${realm.name} (Realm ${realmId})";`);
                lines.push(`    style=filled;`);
                lines.push(`    color="${realm.style.borderColor}";`);
                lines.push(`    fillcolor="${realm.style.backgroundColor}";`);
                lines.push('');

                realmNodes.forEach(node => {
                    const shape = realm.style.shape === 'round-rectangle' ? 'box' :
                                  realm.style.shape === 'ellipse' ? 'ellipse' :
                                  realm.style.shape === 'diamond' ? 'diamond' :
                                  realm.style.shape === 'star' ? 'star' : 'box';

                    lines.push(`    "${node.id}" [label="${node.label}\\nP${node.position}", shape=${shape}, fillcolor="${realm.style.backgroundColor}", style=filled];`);
                });

                lines.push('  }');
                lines.push('');
            }
        });

        // Add edges
        lines.push('  // Edges (EO Operators)');
        this.edges.forEach(edge => {
            const opDef = EO_OPERATORS[edge.operator];
            const style = edge.style.strokeStyle === 'dashed' ? 'dashed' :
                          edge.style.strokeStyle === 'dotted' ? 'dotted' : 'solid';

            lines.push(`  "${edge.source}" -> "${edge.target}" [label="${edge.symbol} ${edge.operator}", color="${opDef.style.color}", style=${style}, penwidth=${edge.style.strokeWidth || 1}];`);
        });

        lines.push('}');

        return lines.join('\n');
    }

    /**
     * Export to Cytoscape.js format
     */
    toCytoscape() {
        const elements = [];

        // Add nodes
        this.nodes.forEach(node => {
            const realm = EO_REALMS[node.realm] || EO_REALMS.III;
            elements.push({
                group: 'nodes',
                data: {
                    id: node.id,
                    label: node.label,
                    position: node.position,
                    coords: node.coords,
                    realm: node.realm,
                    stabilityType: node.stabilityType,
                    entityType: node.entityType,
                    ...node.data
                },
                style: {
                    'background-color': realm.style.backgroundColor,
                    'border-color': realm.style.borderColor,
                    'border-width': 2,
                    'shape': realm.style.shape === 'round-rectangle' ? 'round-rectangle' : realm.style.shape,
                    ...node.style
                }
            });
        });

        // Add edges
        this.edges.forEach(edge => {
            elements.push({
                group: 'edges',
                data: {
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    operator: edge.operator,
                    symbol: edge.symbol,
                    label: edge.label,
                    weight: edge.weight,
                    ...edge.data
                },
                style: {
                    'line-color': edge.style.color,
                    'line-style': edge.style.strokeStyle === 'dashed' ? 'dashed' :
                                  edge.style.strokeStyle === 'dotted' ? 'dotted' : 'solid',
                    'width': edge.style.strokeWidth || 1,
                    'target-arrow-color': edge.style.color,
                    'target-arrow-shape': edge.directed ? 'triangle' : 'none',
                    'curve-style': edge.style.curved ? 'bezier' : 'straight',
                    ...edge.style
                }
            });
        });

        return elements;
    }

    /**
     * Import from JSON
     */
    static fromJSON(json) {
        const graph = new EOGraph({
            id: json.id,
            name: json.name,
            description: json.description,
            frameId: json.frameId,
            createdAt: json.createdAt,
            updatedAt: json.updatedAt
        });

        // Add nodes
        (json.nodes || []).forEach(node => {
            graph.addNode(node.id, {
                label: node.label,
                position: node.position,
                entityType: node.entityType,
                entityId: node.entityId,
                style: node.style,
                data: node.data
            });
        });

        // Add edges
        (json.edges || []).forEach(edge => {
            graph.addEdge(edge.source, edge.target, edge.operator, {
                id: edge.id,
                verb: edge.verb,
                directed: edge.directed,
                weight: edge.weight,
                label: edge.label,
                style: edge.style,
                data: edge.data
            });
        });

        return graph;
    }

    // =========================================================================
    // INTERNAL METHODS
    // =========================================================================

    _logEvent(type, data) {
        this.events.push({
            type,
            data,
            timestamp: Date.now()
        });

        // Keep last 1000 events
        if (this.events.length > 1000) {
            this.events = this.events.slice(-1000);
        }
    }
}

// ============================================================================
// GRAPH BUILDER - Fluent API for constructing graphs
// ============================================================================

class EOGraphBuilder {
    constructor(name) {
        this.graph = new EOGraph({ name });
        this._lastNodeId = null;
    }

    /**
     * Add a node
     */
    node(id, config = {}) {
        this.graph.addNode(id, config);
        this._lastNodeId = id;
        return this;
    }

    /**
     * Connect last node to target with operator
     */
    to(targetId, operator, config = {}) {
        if (this._lastNodeId) {
            this.graph.addEdge(this._lastNodeId, targetId, operator, config);
        }
        return this;
    }

    /**
     * Connect from source to target with operator
     */
    connect(sourceId, targetId, operator, config = {}) {
        this.graph.addEdge(sourceId, targetId, operator, config);
        return this;
    }

    /**
     * Set the "current" node for chaining
     */
    from(nodeId) {
        this._lastNodeId = nodeId;
        return this;
    }

    /**
     * Build and return the graph
     */
    build() {
        return this.graph;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get operator definition by code
 */
function getOperator(code) {
    return EO_OPERATORS[code] || null;
}

/**
 * Get all operator codes
 */
function getOperatorCodes() {
    return Object.keys(EO_OPERATORS);
}

/**
 * Get position definition
 */
function getPosition(position) {
    return EO_POSITIONS[position] || null;
}

/**
 * Get realm definition
 */
function getRealm(realmId) {
    return EO_REALMS[realmId] || null;
}

/**
 * Infer operator from verb
 */
function inferOperatorFromVerb(verb) {
    const normalizedVerb = verb.toLowerCase().trim();

    for (const [code, operator] of Object.entries(EO_OPERATORS)) {
        if (operator.verbs.some(v => normalizedVerb.includes(v.toLowerCase()))) {
            return code;
        }
    }

    return 'CON'; // Default to connect
}

/**
 * Create a quick graph from entity relationships
 */
function createGraphFromEntities(entities, relationships) {
    const graph = new EOGraph({ name: 'Entity Graph' });

    // Add entities as nodes
    entities.forEach(entity => {
        graph.addNode(entity.id, {
            label: entity.name || entity.id,
            position: entity.eo_position || 14,
            entityType: entity.type || 'generic',
            entityId: entity.id,
            data: entity
        });
    });

    // Add relationships as edges
    relationships.forEach(rel => {
        const operator = rel.operator || inferOperatorFromVerb(rel.relation || 'connects');
        graph.addEdge(rel.source, rel.target, operator, {
            verb: rel.relation,
            data: rel
        });
    });

    return graph;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Core classes
        EOGraph,
        EOGraphBuilder,

        // Constants
        EO_OPERATORS,
        EO_POSITIONS,
        EO_REALMS,
        VALID_OPERATOR_TRANSITIONS,

        // Utility functions
        getOperator,
        getOperatorCodes,
        getPosition,
        getRealm,
        getRealmForPosition,
        isValidOperatorTransition,
        getValidNextOperators,
        inferOperatorFromVerb,
        createGraphFromEntities
    };
}

// Browser global
if (typeof window !== 'undefined') {
    window.EOGraph = EOGraph;
    window.EOGraphBuilder = EOGraphBuilder;
    window.EO_OPERATORS = EO_OPERATORS;
    window.EO_POSITIONS = EO_POSITIONS;
    window.EO_REALMS = EO_REALMS;
    window.getOperator = getOperator;
    window.getPosition = getPosition;
    window.getRealm = getRealm;
    window.inferOperatorFromVerb = inferOperatorFromVerb;
    window.createGraphFromEntities = createGraphFromEntities;
}
