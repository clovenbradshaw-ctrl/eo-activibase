/**
 * EO Graph Visualization
 *
 * Interactive graph visualization using Canvas/SVG rendering.
 * Displays nodes by EO position (27 positions, 5 realms) and
 * edges by EO operator (9 operators with distinct visual styles).
 *
 * Integrates with EOGraph for data and provides:
 * - Force-directed layout
 * - Operator-aware edge styling
 * - Position/realm-based node styling
 * - Interactive pan, zoom, and selection
 * - Operator palette for edge creation
 */

class EOGraphVisualization {
    constructor(container, graph, options = {}) {
        this.container = typeof container === 'string'
            ? document.getElementById(container)
            : container;

        this.graph = graph;
        this.options = {
            width: options.width || this.container.clientWidth || 800,
            height: options.height || this.container.clientHeight || 600,
            nodeRadius: options.nodeRadius || 30,
            edgeLabelSize: options.edgeLabelSize || 10,
            nodeLabelSize: options.nodeLabelSize || 11,
            showOperatorSymbols: options.showOperatorSymbols !== false,
            showPositionBadges: options.showPositionBadges !== false,
            enablePhysics: options.enablePhysics !== false,
            onNodeClick: options.onNodeClick || null,
            onEdgeClick: options.onEdgeClick || null,
            onOperatorSelect: options.onOperatorSelect || null,
            ...options
        };

        // Canvas and context
        this.canvas = null;
        this.ctx = null;

        // State
        this.nodePositions = new Map(); // nodeId -> {x, y}
        this.selectedNode = null;
        this.selectedEdge = null;
        this.hoveredNode = null;
        this.hoveredEdge = null;
        this.selectedOperator = 'CON'; // Default operator for new edges

        // Interaction
        this.isDragging = false;
        this.dragNode = null;
        this.panOffset = { x: 0, y: 0 };
        this.zoom = 1;
        this.lastMousePos = { x: 0, y: 0 };

        // Physics simulation
        this.simulation = null;
        this.animationFrame = null;

        this._init();
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    _init() {
        this._createCanvas();
        this._createOperatorPalette();
        this._initializeNodePositions();
        this._bindEvents();

        if (this.options.enablePhysics) {
            this._startSimulation();
        } else {
            this._render();
        }
    }

    _createCanvas() {
        // Clear container
        this.container.innerHTML = '';

        // Create wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'eo-graph-wrapper';
        this.wrapper.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #fafafa;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
        `;

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.cssText = 'display: block; cursor: grab;';
        this.ctx = this.canvas.getContext('2d');

        this.wrapper.appendChild(this.canvas);
        this.container.appendChild(this.wrapper);

        // Create info panel
        this._createInfoPanel();
    }

    _createInfoPanel() {
        this.infoPanel = document.createElement('div');
        this.infoPanel.className = 'eo-graph-info';
        this.infoPanel.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 10px;
            font-size: 12px;
            max-width: 200px;
            display: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        this.wrapper.appendChild(this.infoPanel);
    }

    _createOperatorPalette() {
        this.palette = document.createElement('div');
        this.palette.className = 'eo-operator-palette';
        this.palette.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            max-width: 300px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;

        // Add operator buttons
        Object.entries(EO_OPERATORS).forEach(([code, op]) => {
            const btn = document.createElement('button');
            btn.className = 'eo-operator-btn';
            btn.dataset.operator = code;
            btn.title = `${op.name}: ${op.description}`;
            btn.innerHTML = `<span style="color:${op.style.color}">${op.symbol}</span> ${code}`;
            btn.style.cssText = `
                border: 2px solid ${code === this.selectedOperator ? op.style.color : '#e0e0e0'};
                background: ${code === this.selectedOperator ? op.style.color + '20' : 'white'};
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 11px;
                font-family: monospace;
                transition: all 0.2s;
            `;

            btn.addEventListener('click', () => this._selectOperator(code));
            btn.addEventListener('mouseenter', () => {
                btn.style.background = op.style.color + '30';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = code === this.selectedOperator ? op.style.color + '20' : 'white';
            });

            this.palette.appendChild(btn);
        });

        this.wrapper.appendChild(this.palette);
    }

    _selectOperator(code) {
        this.selectedOperator = code;

        // Update palette buttons
        this.palette.querySelectorAll('.eo-operator-btn').forEach(btn => {
            const op = EO_OPERATORS[btn.dataset.operator];
            const isSelected = btn.dataset.operator === code;
            btn.style.border = `2px solid ${isSelected ? op.style.color : '#e0e0e0'}`;
            btn.style.background = isSelected ? op.style.color + '20' : 'white';
        });

        if (this.options.onOperatorSelect) {
            this.options.onOperatorSelect(code, EO_OPERATORS[code]);
        }
    }

    _initializeNodePositions() {
        const centerX = this.options.width / 2;
        const centerY = this.options.height / 2;
        const radius = Math.min(this.options.width, this.options.height) * 0.35;

        const nodes = Array.from(this.graph.nodes.values());
        nodes.forEach((node, i) => {
            // Arrange in circle by realm
            const realmOffset = this._getRealmOffset(node.realm);
            const angle = (2 * Math.PI * i) / nodes.length + realmOffset;
            const r = radius * (0.6 + Math.random() * 0.4);

            this.nodePositions.set(node.id, {
                x: centerX + r * Math.cos(angle),
                y: centerY + r * Math.sin(angle),
                vx: 0,
                vy: 0
            });
        });
    }

    _getRealmOffset(realm) {
        const offsets = { 'I': 0, 'II': Math.PI / 5, 'III': 2 * Math.PI / 5, 'IV': 3 * Math.PI / 5, 'V': 4 * Math.PI / 5 };
        return offsets[realm] || 0;
    }

    // =========================================================================
    // PHYSICS SIMULATION
    // =========================================================================

    _startSimulation() {
        const simulate = () => {
            this._simulationStep();
            this._render();
            this.animationFrame = requestAnimationFrame(simulate);
        };

        this.animationFrame = requestAnimationFrame(simulate);
    }

    _simulationStep() {
        const nodes = Array.from(this.graph.nodes.values());
        const edges = Array.from(this.graph.edges.values());

        // Reset forces
        nodes.forEach(node => {
            const pos = this.nodePositions.get(node.id);
            if (pos) {
                pos.fx = 0;
                pos.fy = 0;
            }
        });

        // Repulsion between nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const posA = this.nodePositions.get(nodes[i].id);
                const posB = this.nodePositions.get(nodes[j].id);
                if (!posA || !posB) continue;

                const dx = posB.x - posA.x;
                const dy = posB.y - posA.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = 5000 / (dist * dist);

                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                posA.fx -= fx;
                posA.fy -= fy;
                posB.fx += fx;
                posB.fy += fy;
            }
        }

        // Attraction along edges
        edges.forEach(edge => {
            const posA = this.nodePositions.get(edge.source);
            const posB = this.nodePositions.get(edge.target);
            if (!posA || !posB) return;

            const dx = posB.x - posA.x;
            const dy = posB.y - posA.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist - 150) * 0.05;

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            posA.fx += fx;
            posA.fy += fy;
            posB.fx -= fx;
            posB.fy -= fy;
        });

        // Center gravity
        const centerX = this.options.width / 2;
        const centerY = this.options.height / 2;

        nodes.forEach(node => {
            const pos = this.nodePositions.get(node.id);
            if (!pos) return;

            pos.fx += (centerX - pos.x) * 0.01;
            pos.fy += (centerY - pos.y) * 0.01;
        });

        // Apply forces with damping
        const damping = 0.9;
        nodes.forEach(node => {
            const pos = this.nodePositions.get(node.id);
            if (!pos || (this.isDragging && this.dragNode === node.id)) return;

            pos.vx = (pos.vx + pos.fx * 0.1) * damping;
            pos.vy = (pos.vy + pos.fy * 0.1) * damping;

            pos.x += pos.vx;
            pos.y += pos.vy;

            // Bounds
            const margin = this.options.nodeRadius;
            pos.x = Math.max(margin, Math.min(this.options.width - margin, pos.x));
            pos.y = Math.max(margin, Math.min(this.options.height - margin, pos.y));
        });
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    _render() {
        const ctx = this.ctx;
        const { width, height } = this.options;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Apply transform
        ctx.save();
        ctx.translate(this.panOffset.x, this.panOffset.y);
        ctx.scale(this.zoom, this.zoom);

        // Draw edges
        this.graph.edges.forEach(edge => this._drawEdge(edge));

        // Draw nodes
        this.graph.nodes.forEach(node => this._drawNode(node));

        ctx.restore();
    }

    _drawNode(node) {
        const pos = this.nodePositions.get(node.id);
        if (!pos) return;

        const ctx = this.ctx;
        const r = this.options.nodeRadius;
        const realm = EO_REALMS[node.realm] || EO_REALMS.III;
        const isSelected = this.selectedNode === node.id;
        const isHovered = this.hoveredNode === node.id;

        // Draw node shape based on realm
        ctx.beginPath();
        this._drawShape(pos.x, pos.y, r, realm.style.shape);

        // Fill
        ctx.fillStyle = node.style.backgroundColor || realm.style.backgroundColor;
        ctx.fill();

        // Stroke
        ctx.strokeStyle = isSelected ? '#1976D2' : isHovered ? '#42A5F5' : realm.style.borderColor;
        ctx.lineWidth = isSelected ? 3 : isHovered ? 2 : 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#333';
        ctx.font = `${this.options.nodeLabelSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, pos.x, pos.y);

        // Position badge
        if (this.options.showPositionBadges) {
            const badgeX = pos.x + r * 0.7;
            const badgeY = pos.y - r * 0.7;

            ctx.beginPath();
            ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
            ctx.fillStyle = realm.style.borderColor;
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = '9px Arial';
            ctx.fillText(`P${node.position}`, badgeX, badgeY);
        }

        // Stability type indicator
        const stabilityColors = {
            'holon-positive': '#4CAF50',
            'holon-negative': '#F44336',
            'transition': '#FF9800',
            'void': '#9E9E9E'
        };
        const stabilityColor = stabilityColors[node.stabilityType] || '#9E9E9E';

        ctx.beginPath();
        ctx.arc(pos.x - r * 0.7, pos.y + r * 0.7, 5, 0, Math.PI * 2);
        ctx.fillStyle = stabilityColor;
        ctx.fill();
    }

    _drawShape(x, y, r, shape) {
        const ctx = this.ctx;

        switch (shape) {
            case 'ellipse':
                ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
                break;

            case 'rectangle':
                ctx.rect(x - r, y - r * 0.7, r * 2, r * 1.4);
                break;

            case 'round-rectangle':
                this._roundRect(x - r, y - r * 0.7, r * 2, r * 1.4, 8);
                break;

            case 'diamond':
                ctx.moveTo(x, y - r);
                ctx.lineTo(x + r, y);
                ctx.lineTo(x, y + r);
                ctx.lineTo(x - r, y);
                ctx.closePath();
                break;

            case 'star':
                this._drawStar(x, y, 5, r, r * 0.5);
                break;

            default:
                ctx.arc(x, y, r, 0, Math.PI * 2);
        }
    }

    _roundRect(x, y, w, h, radius) {
        const ctx = this.ctx;
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
    }

    _drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        const ctx = this.ctx;
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
    }

    _drawEdge(edge) {
        const sourcePos = this.nodePositions.get(edge.source);
        const targetPos = this.nodePositions.get(edge.target);
        if (!sourcePos || !targetPos) return;

        const ctx = this.ctx;
        const op = EO_OPERATORS[edge.operator];
        const style = edge.style || op.style;
        const isSelected = this.selectedEdge === edge.id;
        const isHovered = this.hoveredEdge === edge.id;

        // Calculate edge endpoints (outside of nodes)
        const r = this.options.nodeRadius;
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        const startX = sourcePos.x + nx * r;
        const startY = sourcePos.y + ny * r;
        const endX = targetPos.x - nx * r;
        const endY = targetPos.y - ny * r;

        // Draw line
        ctx.beginPath();

        if (style.curved || edge.source === edge.target) {
            // Curved edge (for REC or self-loops)
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const cpX = midX + ny * 50;
            const cpY = midY - nx * 50;
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        } else {
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
        }

        // Line style
        ctx.strokeStyle = isSelected ? '#1976D2' : isHovered ? '#42A5F5' : style.color;
        ctx.lineWidth = (style.strokeWidth || 1) * (isSelected ? 1.5 : 1);

        if (style.strokeStyle === 'dashed') {
            ctx.setLineDash([8, 4]);
        } else if (style.strokeStyle === 'dotted') {
            ctx.setLineDash([3, 3]);
        } else if (style.strokeStyle === 'double') {
            // Draw double line
            ctx.setLineDash([]);
            ctx.stroke();
            ctx.beginPath();
            const offset = 3;
            ctx.moveTo(startX + ny * offset, startY - nx * offset);
            ctx.lineTo(endX + ny * offset, endY - nx * offset);
        } else {
            ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Draw arrow
        if (edge.directed) {
            this._drawArrow(endX, endY, nx, ny, style.color);
        }

        // Draw label
        if (this.options.showOperatorSymbols) {
            const labelX = (startX + endX) / 2;
            const labelY = (startY + endY) / 2 - 10;

            // Background
            ctx.fillStyle = 'white';
            ctx.fillRect(labelX - 15, labelY - 8, 30, 16);

            // Label
            ctx.fillStyle = style.color;
            ctx.font = `bold ${this.options.edgeLabelSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${op.symbol} ${edge.operator}`, labelX, labelY);
        }
    }

    _drawArrow(x, y, nx, ny, color) {
        const ctx = this.ctx;
        const arrowLength = 12;
        const arrowWidth = 8;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
            x - arrowLength * nx + arrowWidth * ny,
            y - arrowLength * ny - arrowWidth * nx
        );
        ctx.lineTo(
            x - arrowLength * nx - arrowWidth * ny,
            y - arrowLength * ny + arrowWidth * nx
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    // =========================================================================
    // EVENT HANDLING
    // =========================================================================

    _bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this._onWheel(e));
        this.canvas.addEventListener('dblclick', (e) => this._onDoubleClick(e));
    }

    _getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.panOffset.x) / this.zoom,
            y: (e.clientY - rect.top - this.panOffset.y) / this.zoom
        };
    }

    _findNodeAt(x, y) {
        const r = this.options.nodeRadius;
        for (const [id, pos] of this.nodePositions) {
            const dx = x - pos.x;
            const dy = y - pos.y;
            if (dx * dx + dy * dy < r * r) {
                return id;
            }
        }
        return null;
    }

    _findEdgeAt(x, y) {
        const threshold = 10;

        for (const edge of this.graph.edges.values()) {
            const sourcePos = this.nodePositions.get(edge.source);
            const targetPos = this.nodePositions.get(edge.target);
            if (!sourcePos || !targetPos) continue;

            // Distance from point to line segment
            const dist = this._pointToSegmentDistance(
                x, y,
                sourcePos.x, sourcePos.y,
                targetPos.x, targetPos.y
            );

            if (dist < threshold) {
                return edge.id;
            }
        }

        return null;
    }

    _pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        }

        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;

        return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
    }

    _onMouseDown(e) {
        const pos = this._getMousePos(e);
        const nodeId = this._findNodeAt(pos.x, pos.y);

        if (nodeId) {
            this.isDragging = true;
            this.dragNode = nodeId;
            this.canvas.style.cursor = 'grabbing';
        } else {
            this.isDragging = true;
            this.dragNode = null;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
        }
    }

    _onMouseMove(e) {
        const pos = this._getMousePos(e);

        if (this.isDragging) {
            if (this.dragNode) {
                // Drag node
                const nodePos = this.nodePositions.get(this.dragNode);
                if (nodePos) {
                    nodePos.x = pos.x;
                    nodePos.y = pos.y;
                    nodePos.vx = 0;
                    nodePos.vy = 0;
                }
            } else {
                // Pan canvas
                this.panOffset.x += e.clientX - this.lastMousePos.x;
                this.panOffset.y += e.clientY - this.lastMousePos.y;
                this.lastMousePos = { x: e.clientX, y: e.clientY };
            }

            if (!this.options.enablePhysics) {
                this._render();
            }
        } else {
            // Hover detection
            const nodeId = this._findNodeAt(pos.x, pos.y);
            const edgeId = nodeId ? null : this._findEdgeAt(pos.x, pos.y);

            this.hoveredNode = nodeId;
            this.hoveredEdge = edgeId;

            this.canvas.style.cursor = nodeId ? 'pointer' : edgeId ? 'pointer' : 'grab';

            // Show info panel
            if (nodeId) {
                this._showNodeInfo(nodeId);
            } else if (edgeId) {
                this._showEdgeInfo(edgeId);
            } else {
                this.infoPanel.style.display = 'none';
            }

            if (!this.options.enablePhysics) {
                this._render();
            }
        }
    }

    _onMouseUp(e) {
        const pos = this._getMousePos(e);
        const nodeId = this._findNodeAt(pos.x, pos.y);

        if (!this.isDragging || this.dragNode) {
            // Click event
            if (nodeId) {
                this.selectedNode = nodeId;
                this.selectedEdge = null;
                if (this.options.onNodeClick) {
                    this.options.onNodeClick(this.graph.getNode(nodeId));
                }
            } else {
                const edgeId = this._findEdgeAt(pos.x, pos.y);
                if (edgeId) {
                    this.selectedEdge = edgeId;
                    this.selectedNode = null;
                    if (this.options.onEdgeClick) {
                        this.options.onEdgeClick(this.graph.getEdge(edgeId));
                    }
                } else {
                    this.selectedNode = null;
                    this.selectedEdge = null;
                }
            }
        }

        this.isDragging = false;
        this.dragNode = null;
        this.canvas.style.cursor = nodeId ? 'pointer' : 'grab';

        if (!this.options.enablePhysics) {
            this._render();
        }
    }

    _onWheel(e) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom = Math.max(0.1, Math.min(5, this.zoom * factor));

        if (!this.options.enablePhysics) {
            this._render();
        }
    }

    _onDoubleClick(e) {
        const pos = this._getMousePos(e);
        const nodeId = this._findNodeAt(pos.x, pos.y);

        if (nodeId && this.selectedNode && nodeId !== this.selectedNode) {
            // Create edge between selected node and double-clicked node
            this.graph.addEdge(this.selectedNode, nodeId, this.selectedOperator);
            this.selectedNode = nodeId;

            if (!this.options.enablePhysics) {
                this._render();
            }
        }
    }

    // =========================================================================
    // INFO PANELS
    // =========================================================================

    _showNodeInfo(nodeId) {
        const node = this.graph.getNode(nodeId);
        if (!node) return;

        const realm = EO_REALMS[node.realm] || {};

        this.infoPanel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 6px;">${node.label}</div>
            <div style="color: #666; margin-bottom: 4px;">Position: P${node.position}</div>
            <div style="color: #666; margin-bottom: 4px;">Realm: ${realm.name || node.realm}</div>
            <div style="color: #666; margin-bottom: 4px;">Coords: [${node.coords.join(', ')}]</div>
            <div style="color: #666;">Stability: ${node.stabilityType}</div>
        `;
        this.infoPanel.style.display = 'block';
    }

    _showEdgeInfo(edgeId) {
        const edge = this.graph.getEdge(edgeId);
        if (!edge) return;

        const op = EO_OPERATORS[edge.operator] || {};

        this.infoPanel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 6px;">${op.symbol} ${edge.operator}</div>
            <div style="color: #666; margin-bottom: 4px;">${op.name}</div>
            <div style="color: #666; margin-bottom: 4px; font-size: 11px;">${op.description}</div>
            <div style="color: #888; font-size: 11px; margin-top: 6px;">
                ${edge.source} → ${edge.target}
            </div>
        `;
        this.infoPanel.style.display = 'block';
    }

    // =========================================================================
    // PUBLIC METHODS
    // =========================================================================

    /**
     * Refresh the visualization with current graph data
     */
    refresh() {
        // Add positions for any new nodes
        this.graph.nodes.forEach((node, id) => {
            if (!this.nodePositions.has(id)) {
                this.nodePositions.set(id, {
                    x: this.options.width / 2 + (Math.random() - 0.5) * 100,
                    y: this.options.height / 2 + (Math.random() - 0.5) * 100,
                    vx: 0,
                    vy: 0
                });
            }
        });

        // Remove positions for deleted nodes
        this.nodePositions.forEach((_, id) => {
            if (!this.graph.nodes.has(id)) {
                this.nodePositions.delete(id);
            }
        });

        if (!this.options.enablePhysics) {
            this._render();
        }
    }

    /**
     * Fit the graph to the viewport
     */
    fit() {
        if (this.nodePositions.size === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.nodePositions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x);
            maxY = Math.max(maxY, pos.y);
        });

        const graphWidth = maxX - minX + 100;
        const graphHeight = maxY - minY + 100;

        this.zoom = Math.min(
            this.options.width / graphWidth,
            this.options.height / graphHeight,
            1
        );

        this.panOffset.x = (this.options.width - graphWidth * this.zoom) / 2 - minX * this.zoom + 50;
        this.panOffset.y = (this.options.height - graphHeight * this.zoom) / 2 - minY * this.zoom + 50;

        if (!this.options.enablePhysics) {
            this._render();
        }
    }

    /**
     * Export current view as PNG data URL
     */
    toDataURL() {
        return this.canvas.toDataURL('image/png');
    }

    /**
     * Destroy the visualization
     */
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.container.innerHTML = '';
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EOGraphVisualization };
}

if (typeof window !== 'undefined') {
    window.EOGraphVisualization = EOGraphVisualization;
}
