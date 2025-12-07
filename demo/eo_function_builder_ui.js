/**
 * EO Function Builder UI
 *
 * Visual interface for building custom functions from atomic operators.
 * Features:
 * - Operator palette organized by category
 * - Node-based visual editor
 * - Test data panel for live testing
 * - Execution trace visualization
 * - Formula preview
 *
 * ARCHITECTURE FOR AI CODERS:
 * ===========================
 *
 * The UI consists of these main components:
 *
 * 1. OPERATOR PALETTE (left panel)
 *    - Operators grouped by category
 *    - Drag-and-drop to canvas
 *    - Search/filter functionality
 *
 * 2. CANVAS (center)
 *    - Node-based visual editor
 *    - Connection drawing
 *    - Zoom/pan controls
 *
 * 3. PROPERTIES PANEL (right)
 *    - Selected node properties
 *    - Input configuration
 *    - Output settings
 *
 * 4. TEST PANEL (bottom)
 *    - Sample data input
 *    - Live result preview
 *    - Execution trace steps
 */

class EOFunctionBuilderUI {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    this.operators = options.operators || (typeof EOAtomicOperators !== 'undefined' ? EOAtomicOperators : null);
    this.builder = options.builder || new EOFunctionBuilder(this.operators);

    this.currentFunction = null;
    this.selectedNode = null;
    this.isDragging = false;
    this.isConnecting = false;
    this.connectionStart = null;

    this.canvas = null;
    this.ctx = null;

    this.testData = {};
    this.lastTrace = null;

    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
    this.createNewFunction();
  }

  render() {
    this.container.innerHTML = `
      <div class="eo-fb-container">
        <!-- Header -->
        <div class="eo-fb-header">
          <div class="eo-fb-title">
            <i class="ph ph-function"></i>
            <input type="text" class="eo-fb-name-input" id="eoFbName" value="New Function" placeholder="Function name">
          </div>
          <div class="eo-fb-actions">
            <button class="btn btn-sm btn-secondary" id="eoFbNew" title="New Function">
              <i class="ph ph-file-plus"></i> New
            </button>
            <button class="btn btn-sm btn-secondary" id="eoFbLoad" title="Load Template">
              <i class="ph ph-folder-open"></i> Templates
            </button>
            <button class="btn btn-sm btn-secondary" id="eoFbExport" title="Export">
              <i class="ph ph-export"></i> Export
            </button>
            <button class="btn btn-sm btn-primary" id="eoFbSave" title="Save Function">
              <i class="ph ph-check"></i> Save
            </button>
          </div>
        </div>

        <div class="eo-fb-main">
          <!-- Left: Operator Palette -->
          <div class="eo-fb-palette">
            <div class="eo-fb-palette-header">
              <input type="text" class="eo-fb-search" id="eoFbSearch" placeholder="Search operators...">
            </div>
            <div class="eo-fb-palette-content" id="eoFbPalette">
              ${this.renderOperatorPalette()}
            </div>
          </div>

          <!-- Center: Canvas -->
          <div class="eo-fb-canvas-container">
            <div class="eo-fb-toolbar">
              <button class="btn btn-icon" id="eoFbZoomIn" title="Zoom In">
                <i class="ph ph-magnifying-glass-plus"></i>
              </button>
              <button class="btn btn-icon" id="eoFbZoomOut" title="Zoom Out">
                <i class="ph ph-magnifying-glass-minus"></i>
              </button>
              <button class="btn btn-icon" id="eoFbFit" title="Fit to View">
                <i class="ph ph-arrows-out"></i>
              </button>
              <span class="eo-fb-separator"></span>
              <button class="btn btn-icon" id="eoFbDelete" title="Delete Selected">
                <i class="ph ph-trash"></i>
              </button>
            </div>
            <div class="eo-fb-canvas-wrapper" id="eoFbCanvasWrapper">
              <canvas id="eoFbCanvas"></canvas>
              <div class="eo-fb-nodes" id="eoFbNodes">
                <!-- Nodes rendered here -->
              </div>
            </div>
            <div class="eo-fb-formula-preview">
              <span class="label">Formula:</span>
              <code id="eoFbFormula">=</code>
            </div>
          </div>

          <!-- Right: Properties & Inputs -->
          <div class="eo-fb-sidebar">
            <!-- Inputs Section -->
            <div class="eo-fb-section">
              <div class="eo-fb-section-header">
                <h4>Function Inputs</h4>
                <button class="btn btn-icon btn-sm" id="eoFbAddInput" title="Add Input">
                  <i class="ph ph-plus"></i>
                </button>
              </div>
              <div class="eo-fb-inputs-list" id="eoFbInputsList">
                <!-- Input fields rendered here -->
              </div>
            </div>

            <!-- Properties Section -->
            <div class="eo-fb-section">
              <div class="eo-fb-section-header">
                <h4>Node Properties</h4>
              </div>
              <div class="eo-fb-properties" id="eoFbProperties">
                <p class="eo-fb-hint">Select a node to view properties</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom: Test Panel -->
        <div class="eo-fb-test-panel">
          <div class="eo-fb-test-header">
            <h4><i class="ph ph-flask"></i> Test Data</h4>
            <button class="btn btn-sm btn-primary" id="eoFbRunTest">
              <i class="ph ph-play"></i> Run Test
            </button>
          </div>
          <div class="eo-fb-test-content">
            <div class="eo-fb-test-inputs" id="eoFbTestInputs">
              <!-- Test input fields -->
            </div>
            <div class="eo-fb-test-result">
              <div class="eo-fb-result-value" id="eoFbResultValue">
                <span class="label">Result:</span>
                <span class="value">-</span>
              </div>
            </div>
            <div class="eo-fb-test-trace" id="eoFbTestTrace">
              <!-- Execution trace -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Initialize canvas
    this.initCanvas();
  }

  renderOperatorPalette() {
    if (!this.operators) return '<p>No operators available</p>';

    const categories = this.operators.getCategories();
    let html = '';

    // Add special nodes first
    html += `
      <div class="eo-fb-category">
        <div class="eo-fb-category-header" data-category="special">
          <i class="ph ph-caret-right"></i>
          <span>Special</span>
        </div>
        <div class="eo-fb-category-items">
          <div class="eo-fb-op-item" data-type="input_ref" draggable="true">
            <span class="eo-fb-op-symbol">{x}</span>
            <span class="eo-fb-op-name">Input Reference</span>
          </div>
          <div class="eo-fb-op-item" data-type="literal" data-subtype="number" draggable="true">
            <span class="eo-fb-op-symbol">123</span>
            <span class="eo-fb-op-name">Number Literal</span>
          </div>
          <div class="eo-fb-op-item" data-type="literal" data-subtype="text" draggable="true">
            <span class="eo-fb-op-symbol">"a"</span>
            <span class="eo-fb-op-name">Text Literal</span>
          </div>
        </div>
      </div>
    `;

    for (const category of categories) {
      const ops = this.operators.getByCategory(category);

      html += `
        <div class="eo-fb-category">
          <div class="eo-fb-category-header" data-category="${category}">
            <i class="ph ph-caret-right"></i>
            <span>${this.formatCategoryName(category)}</span>
          </div>
          <div class="eo-fb-category-items">
            ${ops.map(op => `
              <div class="eo-fb-op-item" data-type="operator" data-operator-id="${op.id}" draggable="true" title="${op.description}">
                <span class="eo-fb-op-symbol">${op.symbol}</span>
                <span class="eo-fb-op-name">${op.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  formatCategoryName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  initCanvas() {
    this.canvas = document.getElementById('eoFbCanvas');
    this.ctx = this.canvas.getContext('2d');

    const wrapper = document.getElementById('eoFbCanvasWrapper');
    this.canvas.width = wrapper.clientWidth;
    this.canvas.height = wrapper.clientHeight;

    this.drawConnections();
  }

  addStyles() {
    if (document.getElementById('eo-fb-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'eo-fb-styles';
    styles.textContent = `
      .eo-fb-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-primary, #1a1a2e);
        color: var(--text-primary, #e0e0e0);
        font-family: var(--font-family, system-ui, sans-serif);
      }

      .eo-fb-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color, #333);
        background: var(--bg-secondary, #242442);
      }

      .eo-fb-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .eo-fb-title i {
        font-size: 20px;
        color: var(--accent-color, #6366f1);
      }

      .eo-fb-name-input {
        background: transparent;
        border: 1px solid transparent;
        color: inherit;
        font-size: 16px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        width: 200px;
      }

      .eo-fb-name-input:hover,
      .eo-fb-name-input:focus {
        border-color: var(--border-color, #333);
        outline: none;
      }

      .eo-fb-actions {
        display: flex;
        gap: 8px;
      }

      .eo-fb-main {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      .eo-fb-palette {
        width: 220px;
        border-right: 1px solid var(--border-color, #333);
        display: flex;
        flex-direction: column;
        background: var(--bg-secondary, #242442);
      }

      .eo-fb-palette-header {
        padding: 12px;
        border-bottom: 1px solid var(--border-color, #333);
      }

      .eo-fb-search {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-color, #333);
        border-radius: 6px;
        background: var(--bg-primary, #1a1a2e);
        color: inherit;
        font-size: 13px;
      }

      .eo-fb-palette-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }

      .eo-fb-category {
        margin-bottom: 8px;
      }

      .eo-fb-category-header {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px;
        cursor: pointer;
        border-radius: 4px;
        font-weight: 500;
        font-size: 13px;
        color: var(--text-secondary, #aaa);
      }

      .eo-fb-category-header:hover {
        background: var(--bg-hover, #333);
      }

      .eo-fb-category-header.collapsed + .eo-fb-category-items {
        display: none;
      }

      .eo-fb-category-items {
        padding-left: 12px;
      }

      .eo-fb-op-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: grab;
        font-size: 12px;
        transition: background 0.15s;
      }

      .eo-fb-op-item:hover {
        background: var(--bg-hover, #333);
      }

      .eo-fb-op-item:active {
        cursor: grabbing;
      }

      .eo-fb-op-symbol {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 24px;
        background: var(--bg-primary, #1a1a2e);
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
        color: var(--accent-color, #6366f1);
      }

      .eo-fb-op-name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .eo-fb-canvas-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        position: relative;
      }

      .eo-fb-toolbar {
        display: flex;
        gap: 4px;
        padding: 8px;
        background: var(--bg-secondary, #242442);
        border-bottom: 1px solid var(--border-color, #333);
      }

      .eo-fb-separator {
        width: 1px;
        background: var(--border-color, #333);
        margin: 0 8px;
      }

      .eo-fb-canvas-wrapper {
        flex: 1;
        position: relative;
        overflow: hidden;
        background:
          linear-gradient(90deg, var(--grid-color, #2a2a4a) 1px, transparent 1px),
          linear-gradient(var(--grid-color, #2a2a4a) 1px, transparent 1px);
        background-size: 20px 20px;
      }

      #eoFbCanvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      .eo-fb-nodes {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }

      .eo-fb-node {
        position: absolute;
        min-width: 120px;
        background: var(--bg-secondary, #242442);
        border: 2px solid var(--border-color, #444);
        border-radius: 8px;
        cursor: move;
        user-select: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }

      .eo-fb-node.selected {
        border-color: var(--accent-color, #6366f1);
        box-shadow: 0 0 0 2px var(--accent-color-alpha, rgba(99,102,241,0.3));
      }

      .eo-fb-node.output-node {
        border-color: var(--success-color, #10b981);
      }

      .eo-fb-node-header {
        padding: 8px 12px;
        background: var(--bg-tertiary, #333);
        border-radius: 6px 6px 0 0;
        font-weight: 500;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .eo-fb-node-body {
        padding: 8px 12px;
        font-size: 11px;
      }

      .eo-fb-node-ports {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
      }

      .eo-fb-port {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--bg-tertiary, #333);
        border: 2px solid var(--border-color, #555);
        cursor: crosshair;
        transition: all 0.15s;
      }

      .eo-fb-port:hover {
        transform: scale(1.2);
        border-color: var(--accent-color, #6366f1);
      }

      .eo-fb-port.input {
        margin-left: -8px;
      }

      .eo-fb-port.output {
        margin-right: -8px;
      }

      .eo-fb-port.connected {
        background: var(--accent-color, #6366f1);
      }

      .eo-fb-formula-preview {
        padding: 8px 12px;
        background: var(--bg-secondary, #242442);
        border-top: 1px solid var(--border-color, #333);
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .eo-fb-formula-preview code {
        flex: 1;
        font-family: monospace;
        color: var(--accent-color, #6366f1);
        background: var(--bg-primary, #1a1a2e);
        padding: 4px 8px;
        border-radius: 4px;
        overflow-x: auto;
      }

      .eo-fb-sidebar {
        width: 260px;
        border-left: 1px solid var(--border-color, #333);
        display: flex;
        flex-direction: column;
        background: var(--bg-secondary, #242442);
      }

      .eo-fb-section {
        border-bottom: 1px solid var(--border-color, #333);
      }

      .eo-fb-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: var(--bg-tertiary, #2a2a4a);
      }

      .eo-fb-section-header h4 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
      }

      .eo-fb-inputs-list,
      .eo-fb-properties {
        padding: 12px;
        max-height: 200px;
        overflow-y: auto;
      }

      .eo-fb-input-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: var(--bg-primary, #1a1a2e);
        border-radius: 6px;
        margin-bottom: 8px;
      }

      .eo-fb-input-item input {
        flex: 1;
        background: transparent;
        border: none;
        color: inherit;
        font-size: 12px;
        outline: none;
      }

      .eo-fb-input-item select {
        background: var(--bg-secondary, #242442);
        border: 1px solid var(--border-color, #333);
        color: inherit;
        font-size: 11px;
        padding: 2px 4px;
        border-radius: 4px;
      }

      .eo-fb-hint {
        color: var(--text-secondary, #888);
        font-size: 12px;
        font-style: italic;
      }

      .eo-fb-test-panel {
        border-top: 1px solid var(--border-color, #333);
        background: var(--bg-secondary, #242442);
      }

      .eo-fb-test-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--bg-tertiary, #2a2a4a);
      }

      .eo-fb-test-header h4 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .eo-fb-test-content {
        display: flex;
        padding: 12px;
        gap: 16px;
        align-items: flex-start;
      }

      .eo-fb-test-inputs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        flex: 1;
      }

      .eo-fb-test-input {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .eo-fb-test-input label {
        font-size: 11px;
        color: var(--text-secondary, #888);
      }

      .eo-fb-test-input input {
        padding: 6px 8px;
        border: 1px solid var(--border-color, #333);
        border-radius: 4px;
        background: var(--bg-primary, #1a1a2e);
        color: inherit;
        font-size: 12px;
        width: 100px;
      }

      .eo-fb-test-result {
        padding: 12px 16px;
        background: var(--bg-primary, #1a1a2e);
        border-radius: 6px;
        min-width: 150px;
      }

      .eo-fb-result-value {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .eo-fb-result-value .label {
        font-size: 11px;
        color: var(--text-secondary, #888);
      }

      .eo-fb-result-value .value {
        font-size: 18px;
        font-weight: 600;
        color: var(--success-color, #10b981);
        font-family: monospace;
      }

      .eo-fb-test-trace {
        flex: 1;
        max-height: 120px;
        overflow-y: auto;
        font-size: 11px;
        font-family: monospace;
        background: var(--bg-primary, #1a1a2e);
        border-radius: 6px;
        padding: 8px;
      }

      .eo-fb-trace-step {
        padding: 4px 0;
        border-bottom: 1px solid var(--border-color, #333);
        display: flex;
        gap: 8px;
      }

      .eo-fb-trace-step:last-child {
        border-bottom: none;
      }

      .eo-fb-trace-step .step-num {
        color: var(--text-secondary, #666);
        min-width: 20px;
      }

      .eo-fb-trace-step .step-desc {
        flex: 1;
      }

      .eo-fb-trace-step.output {
        color: var(--success-color, #10b981);
        font-weight: 600;
      }

      .eo-fb-trace-step.error {
        color: var(--error-color, #ef4444);
      }

      /* Button styles */
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .btn-sm {
        padding: 6px 10px;
        font-size: 12px;
      }

      .btn-icon {
        padding: 6px;
        background: transparent;
        color: var(--text-secondary, #888);
      }

      .btn-icon:hover {
        background: var(--bg-hover, #333);
        color: var(--text-primary, #fff);
      }

      .btn-primary {
        background: var(--accent-color, #6366f1);
        color: white;
      }

      .btn-primary:hover {
        background: var(--accent-color-hover, #4f46e5);
      }

      .btn-secondary {
        background: var(--bg-tertiary, #333);
        color: var(--text-primary, #e0e0e0);
      }

      .btn-secondary:hover {
        background: var(--bg-hover, #444);
      }
    `;

    document.head.appendChild(styles);
  }

  attachEventListeners() {
    // Search
    const search = document.getElementById('eoFbSearch');
    search?.addEventListener('input', (e) => this.filterOperators(e.target.value));

    // Category collapse
    document.querySelectorAll('.eo-fb-category-header').forEach(header => {
      header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
      });
    });

    // Drag and drop from palette
    document.querySelectorAll('.eo-fb-op-item').forEach(item => {
      item.addEventListener('dragstart', (e) => this.handleDragStart(e));
    });

    const canvasWrapper = document.getElementById('eoFbCanvasWrapper');
    canvasWrapper?.addEventListener('dragover', (e) => e.preventDefault());
    canvasWrapper?.addEventListener('drop', (e) => this.handleDrop(e));
    canvasWrapper?.addEventListener('click', (e) => this.handleCanvasClick(e));

    // Header actions
    document.getElementById('eoFbNew')?.addEventListener('click', () => this.createNewFunction());
    document.getElementById('eoFbLoad')?.addEventListener('click', () => this.showTemplatesModal());
    document.getElementById('eoFbExport')?.addEventListener('click', () => this.exportFunction());
    document.getElementById('eoFbSave')?.addEventListener('click', () => this.saveFunction());

    // Toolbar
    document.getElementById('eoFbDelete')?.addEventListener('click', () => this.deleteSelected());

    // Add input
    document.getElementById('eoFbAddInput')?.addEventListener('click', () => this.addInput());

    // Run test
    document.getElementById('eoFbRunTest')?.addEventListener('click', () => this.runTest());

    // Function name
    document.getElementById('eoFbName')?.addEventListener('change', (e) => {
      if (this.currentFunction) {
        this.currentFunction.name = e.target.value;
      }
    });

    // Window resize - store handler for cleanup
    this._resizeHandler = () => this.resizeCanvas();
    window.addEventListener('resize', this._resizeHandler);
  }

  /**
   * Destroy the UI and clean up all event listeners
   */
  destroy() {
    // Remove window resize listener
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }

    // Clear references
    this.currentFunction = null;
    this.selectedNode = null;
    this.canvas = null;
    this.ctx = null;
    this.operators = null;
    this.builder = null;

    // Clear DOM
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  filterOperators(query) {
    const items = document.querySelectorAll('.eo-fb-op-item');
    const q = query.toLowerCase();

    items.forEach(item => {
      const name = item.querySelector('.eo-fb-op-name')?.textContent.toLowerCase() || '';
      const symbol = item.querySelector('.eo-fb-op-symbol')?.textContent.toLowerCase() || '';
      const matches = name.includes(q) || symbol.includes(q);
      item.style.display = matches ? '' : 'none';
    });
  }

  handleDragStart(e) {
    const type = e.target.dataset.type;
    const data = {
      type,
      operatorId: e.target.dataset.operatorId,
      subtype: e.target.dataset.subtype
    };
    e.dataTransfer.setData('application/json', JSON.stringify(data));
  }

  handleDrop(e) {
    e.preventDefault();

    const data = JSON.parse(e.dataTransfer.getData('application/json'));
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.addNodeAtPosition(data, x, y);
  }

  handleCanvasClick(e) {
    if (e.target.closest('.eo-fb-node')) return;
    this.selectNode(null);
  }

  createNewFunction() {
    this.currentFunction = this.builder.createFunction({
      id: `func_${Date.now()}`,
      name: 'New Function',
      inputs: []
    });

    document.getElementById('eoFbName').value = this.currentFunction.name;
    this.renderNodes();
    this.renderInputsList();
    this.renderTestInputs();
    this.updateFormulaPreview();
  }

  addNodeAtPosition(data, x, y) {
    if (!this.currentFunction) return;

    const nodeConfig = {
      id: `node_${Date.now()}`,
      type: data.type,
      position: { x, y }
    };

    if (data.type === 'operator') {
      nodeConfig.operatorId = data.operatorId;
    } else if (data.type === 'literal') {
      nodeConfig.value = data.subtype === 'number' ? 0 : '';
    } else if (data.type === 'input_ref') {
      // Use first input if available
      if (this.currentFunction.inputs.length > 0) {
        nodeConfig.inputId = this.currentFunction.inputs[0].id;
      } else {
        // Create a new input
        this.addInput();
        nodeConfig.inputId = this.currentFunction.inputs[0].id;
      }
    }

    try {
      this.builder.addNode(this.currentFunction, nodeConfig);
      this.renderNodes();
      this.updateFormulaPreview();
    } catch (err) {
      console.error('Failed to add node:', err);
    }
  }

  renderNodes() {
    const container = document.getElementById('eoFbNodes');
    if (!container || !this.currentFunction) return;

    container.innerHTML = '';

    for (const node of this.currentFunction.nodes) {
      const el = this.createNodeElement(node);
      container.appendChild(el);
    }

    this.drawConnections();
  }

  createNodeElement(node) {
    const el = document.createElement('div');
    el.className = 'eo-fb-node';
    el.dataset.nodeId = node.id;

    if (node.id === this.currentFunction.outputNodeId) {
      el.classList.add('output-node');
    }
    if (this.selectedNode === node.id) {
      el.classList.add('selected');
    }

    el.style.left = `${node.position.x}px`;
    el.style.top = `${node.position.y}px`;

    let headerContent = '';
    let bodyContent = '';

    if (node.type === 'operator') {
      const op = this.operators.get(node.operatorId);
      headerContent = `<span class="eo-fb-op-symbol">${op?.symbol || '?'}</span> ${op?.name || node.operatorId}`;
      bodyContent = `<div class="eo-fb-node-ports">
        ${this.renderInputPorts(op?.arity || 0)}
        <div class="eo-fb-port output" data-port="output"></div>
      </div>`;
    } else if (node.type === 'literal') {
      headerContent = `<span class="eo-fb-op-symbol">${node.valueType === 'number' ? '123' : '"a"'}</span> Literal`;
      bodyContent = `
        <input type="${node.valueType === 'number' ? 'number' : 'text'}"
               value="${node.value}"
               class="eo-fb-literal-input"
               style="width: 80px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px; color: inherit; font-size: 12px;">
        <div class="eo-fb-node-ports">
          <div></div>
          <div class="eo-fb-port output" data-port="output"></div>
        </div>
      `;
    } else if (node.type === 'input_ref') {
      const input = this.currentFunction.inputs.find(i => i.id === node.inputId);
      headerContent = `<span class="eo-fb-op-symbol">{x}</span> ${input?.name || 'Input'}`;
      bodyContent = `<div class="eo-fb-node-ports">
        <div></div>
        <div class="eo-fb-port output" data-port="output"></div>
      </div>`;
    }

    el.innerHTML = `
      <div class="eo-fb-node-header">${headerContent}</div>
      <div class="eo-fb-node-body">${bodyContent}</div>
    `;

    // Dragging
    el.addEventListener('mousedown', (e) => this.startNodeDrag(e, node));

    // Selection
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectNode(node.id);
    });

    // Double-click to set as output
    el.addEventListener('dblclick', () => {
      this.currentFunction.outputNodeId = node.id;
      this.renderNodes();
      this.updateFormulaPreview();
    });

    // Port connections
    el.querySelectorAll('.eo-fb-port').forEach(port => {
      port.addEventListener('mousedown', (e) => this.startConnection(e, node, port));
    });

    // Literal input change
    const literalInput = el.querySelector('.eo-fb-literal-input');
    if (literalInput) {
      literalInput.addEventListener('change', (e) => {
        node.value = node.valueType === 'number' ? parseFloat(e.target.value) : e.target.value;
        this.updateFormulaPreview();
      });
      literalInput.addEventListener('click', (e) => e.stopPropagation());
    }

    return el;
  }

  renderInputPorts(count) {
    if (count <= 0) return '<div></div>';

    let html = '<div style="display: flex; flex-direction: column; gap: 4px;">';
    for (let i = 0; i < count; i++) {
      html += `<div class="eo-fb-port input" data-port="${i}" title="Input ${i + 1}"></div>`;
    }
    html += '</div>';
    return html;
  }

  startNodeDrag(e, node) {
    if (e.target.closest('.eo-fb-port') || e.target.closest('input')) return;

    this.isDragging = true;
    const startX = e.clientX - node.position.x;
    const startY = e.clientY - node.position.y;

    const onMove = (moveE) => {
      node.position.x = moveE.clientX - startX;
      node.position.y = moveE.clientY - startY;

      const el = document.querySelector(`[data-node-id="${node.id}"]`);
      if (el) {
        el.style.left = `${node.position.x}px`;
        el.style.top = `${node.position.y}px`;
      }

      this.drawConnections();
    };

    const onUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  startConnection(e, node, portEl) {
    e.stopPropagation();
    e.preventDefault();

    const isOutput = portEl.classList.contains('output');
    const portIndex = parseInt(portEl.dataset.port) || 0;

    this.isConnecting = true;
    this.connectionStart = {
      nodeId: node.id,
      isOutput,
      port: isOutput ? 'output' : portIndex
    };

    const onMove = (moveE) => {
      this.drawConnections(moveE.clientX, moveE.clientY);
    };

    const onUp = (upE) => {
      this.isConnecting = false;

      // Check if we're over another port
      const targetPort = document.elementFromPoint(upE.clientX, upE.clientY)?.closest('.eo-fb-port');

      if (targetPort) {
        const targetNode = targetPort.closest('.eo-fb-node');
        const targetNodeId = targetNode?.dataset.nodeId;
        const targetIsOutput = targetPort.classList.contains('output');
        const targetPortIndex = parseInt(targetPort.dataset.port) || 0;

        // Can only connect output -> input
        if (this.connectionStart.isOutput && !targetIsOutput && targetNodeId !== this.connectionStart.nodeId) {
          try {
            this.builder.addConnection(this.currentFunction, {
              fromNodeId: this.connectionStart.nodeId,
              fromPort: this.connectionStart.port,
              toNodeId: targetNodeId,
              toPort: targetPortIndex
            });
            this.updateFormulaPreview();
          } catch (err) {
            console.error('Failed to create connection:', err);
          }
        }
      }

      this.connectionStart = null;
      this.drawConnections();

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  drawConnections(mouseX, mouseY) {
    if (!this.ctx || !this.currentFunction) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw existing connections
    for (const conn of this.currentFunction.connections) {
      const fromEl = document.querySelector(`[data-node-id="${conn.fromNodeId}"] .eo-fb-port.output`);
      const toEl = document.querySelector(`[data-node-id="${conn.toNodeId}"] .eo-fb-port.input[data-port="${conn.toPort}"]`);

      if (fromEl && toEl) {
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();

        const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
        const x2 = toRect.left + toRect.width / 2 - canvasRect.left;
        const y2 = toRect.top + toRect.height / 2 - canvasRect.top;

        this.drawBezierConnection(x1, y1, x2, y2, '#6366f1');
      }
    }

    // Draw connection in progress
    if (this.isConnecting && this.connectionStart && mouseX !== undefined) {
      const startEl = document.querySelector(
        `[data-node-id="${this.connectionStart.nodeId}"] .eo-fb-port.${this.connectionStart.isOutput ? 'output' : 'input'}`
      );

      if (startEl) {
        const rect = startEl.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();

        const x1 = rect.left + rect.width / 2 - canvasRect.left;
        const y1 = rect.top + rect.height / 2 - canvasRect.top;
        const x2 = mouseX - canvasRect.left;
        const y2 = mouseY - canvasRect.top;

        this.drawBezierConnection(x1, y1, x2, y2, '#888');
      }
    }
  }

  drawBezierConnection(x1, y1, x2, y2, color) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;

    const cp1x = x1 + (x2 - x1) / 2;
    const cp1y = y1;
    const cp2x = x1 + (x2 - x1) / 2;
    const cp2y = y2;

    this.ctx.moveTo(x1, y1);
    this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    this.ctx.stroke();
  }

  selectNode(nodeId) {
    this.selectedNode = nodeId;

    document.querySelectorAll('.eo-fb-node').forEach(el => {
      el.classList.toggle('selected', el.dataset.nodeId === nodeId);
    });

    this.renderProperties();
  }

  renderProperties() {
    const container = document.getElementById('eoFbProperties');
    if (!container) return;

    if (!this.selectedNode) {
      container.innerHTML = '<p class="eo-fb-hint">Select a node to view properties</p>';
      return;
    }

    const node = this.currentFunction.nodes.find(n => n.id === this.selectedNode);
    if (!node) return;

    let html = `
      <div class="eo-fb-property">
        <label>Node ID:</label>
        <code>${node.id}</code>
      </div>
      <div class="eo-fb-property">
        <label>Type:</label>
        <span>${node.type}</span>
      </div>
    `;

    if (node.type === 'operator') {
      const op = this.operators.get(node.operatorId);
      html += `
        <div class="eo-fb-property">
          <label>Operator:</label>
          <span>${op?.name || node.operatorId}</span>
        </div>
        <div class="eo-fb-property">
          <label>Output Type:</label>
          <span>${op?.outputType || 'any'}</span>
        </div>
      `;

      if (op?.properties?.length > 0) {
        html += `
          <div class="eo-fb-property">
            <label>Properties:</label>
            <span>${op.properties.join(', ')}</span>
          </div>
        `;
      }
    } else if (node.type === 'input_ref') {
      html += `
        <div class="eo-fb-property">
          <label>Input:</label>
          <select id="eoFbNodeInputSelect">
            ${this.currentFunction.inputs.map(i =>
              `<option value="${i.id}" ${i.id === node.inputId ? 'selected' : ''}>${i.name}</option>`
            ).join('')}
          </select>
        </div>
      `;
    }

    html += `
      <div class="eo-fb-property" style="margin-top: 12px;">
        <label>
          <input type="checkbox" id="eoFbNodeIsOutput" ${this.currentFunction.outputNodeId === node.id ? 'checked' : ''}>
          Is Output Node
        </label>
      </div>
    `;

    container.innerHTML = html;

    // Event listeners
    document.getElementById('eoFbNodeInputSelect')?.addEventListener('change', (e) => {
      node.inputId = e.target.value;
      this.renderNodes();
      this.updateFormulaPreview();
    });

    document.getElementById('eoFbNodeIsOutput')?.addEventListener('change', (e) => {
      this.currentFunction.outputNodeId = e.target.checked ? node.id : null;
      this.renderNodes();
      this.updateFormulaPreview();
    });
  }

  renderInputsList() {
    const container = document.getElementById('eoFbInputsList');
    if (!container || !this.currentFunction) return;

    if (this.currentFunction.inputs.length === 0) {
      container.innerHTML = '<p class="eo-fb-hint">No inputs defined</p>';
      return;
    }

    container.innerHTML = this.currentFunction.inputs.map((input, idx) => `
      <div class="eo-fb-input-item" data-input-id="${input.id}">
        <input type="text" value="${input.name}" placeholder="Input name">
        <select>
          <option value="any" ${input.type === 'any' ? 'selected' : ''}>any</option>
          <option value="number" ${input.type === 'number' ? 'selected' : ''}>number</option>
          <option value="text" ${input.type === 'text' ? 'selected' : ''}>text</option>
          <option value="boolean" ${input.type === 'boolean' ? 'selected' : ''}>boolean</option>
          <option value="date" ${input.type === 'date' ? 'selected' : ''}>date</option>
          <option value="array" ${input.type === 'array' ? 'selected' : ''}>array</option>
        </select>
        <button class="btn btn-icon btn-sm" data-action="delete" title="Delete">
          <i class="ph ph-x"></i>
        </button>
      </div>
    `).join('');

    // Event listeners
    container.querySelectorAll('.eo-fb-input-item').forEach(item => {
      const inputId = item.dataset.inputId;
      const input = this.currentFunction.inputs.find(i => i.id === inputId);

      item.querySelector('input')?.addEventListener('change', (e) => {
        input.name = e.target.value;
        this.renderNodes();
        this.renderTestInputs();
        this.updateFormulaPreview();
      });

      item.querySelector('select')?.addEventListener('change', (e) => {
        input.type = e.target.value;
      });

      item.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        this.removeInput(inputId);
      });
    });
  }

  addInput() {
    if (!this.currentFunction) return;

    const idx = this.currentFunction.inputs.length;
    const input = {
      id: `input_${Date.now()}`,
      name: `Input ${idx + 1}`,
      type: 'any',
      defaultValue: null
    };

    this.currentFunction.inputs.push(input);
    this.renderInputsList();
    this.renderTestInputs();
  }

  removeInput(inputId) {
    const idx = this.currentFunction.inputs.findIndex(i => i.id === inputId);
    if (idx === -1) return;

    this.currentFunction.inputs.splice(idx, 1);

    // Remove nodes referencing this input
    this.currentFunction.nodes = this.currentFunction.nodes.filter(n =>
      n.type !== 'input_ref' || n.inputId !== inputId
    );

    this.renderInputsList();
    this.renderNodes();
    this.renderTestInputs();
    this.updateFormulaPreview();
  }

  renderTestInputs() {
    const container = document.getElementById('eoFbTestInputs');
    if (!container || !this.currentFunction) return;

    container.innerHTML = this.currentFunction.inputs.map(input => `
      <div class="eo-fb-test-input">
        <label>${input.name}</label>
        <input type="${input.type === 'number' ? 'number' : 'text'}"
               data-input-id="${input.id}"
               value="${this.testData[input.id] ?? ''}"
               placeholder="${input.type}">
      </div>
    `).join('');

    container.querySelectorAll('input').forEach(el => {
      el.addEventListener('change', (e) => {
        const inputId = e.target.dataset.inputId;
        const input = this.currentFunction.inputs.find(i => i.id === inputId);
        let value = e.target.value;

        if (input?.type === 'number') {
          value = parseFloat(value) || 0;
        } else if (input?.type === 'boolean') {
          value = value.toLowerCase() === 'true';
        }

        this.testData[inputId] = value;
      });
    });
  }

  runTest() {
    if (!this.currentFunction) return;

    const result = this.builder.executeWithTrace(this.currentFunction, this.testData);
    this.lastTrace = result.trace;

    // Update result display
    const resultEl = document.querySelector('#eoFbResultValue .value');
    if (resultEl) {
      resultEl.textContent = result.success ? String(result.result) : 'Error';
      resultEl.style.color = result.success ? 'var(--success-color, #10b981)' : 'var(--error-color, #ef4444)';
    }

    // Update trace display
    const traceEl = document.getElementById('eoFbTestTrace');
    if (traceEl) {
      traceEl.innerHTML = result.trace.map((step, idx) => `
        <div class="eo-fb-trace-step ${step.type}">
          <span class="step-num">${idx}.</span>
          <span class="step-desc">${step.description}</span>
        </div>
      `).join('');
    }
  }

  updateFormulaPreview() {
    const el = document.getElementById('eoFbFormula');
    if (!el || !this.currentFunction) return;

    const formula = this.builder.generateFormula(this.currentFunction);
    el.textContent = formula || '(no output node)';
  }

  deleteSelected() {
    if (!this.selectedNode || !this.currentFunction) return;

    this.builder.removeNode(this.currentFunction, this.selectedNode);
    this.selectedNode = null;
    this.renderNodes();
    this.renderProperties();
    this.updateFormulaPreview();
  }

  showTemplatesModal() {
    const templates = this.builder.getTemplates();

    const html = `
      <div class="eo-fb-modal-overlay" id="eoFbTemplatesModal">
        <div class="eo-fb-modal">
          <div class="eo-fb-modal-header">
            <h3>Function Templates</h3>
            <button class="btn btn-icon" id="eoFbTemplatesClose">
              <i class="ph ph-x"></i>
            </button>
          </div>
          <div class="eo-fb-modal-body">
            ${templates.map(t => `
              <div class="eo-fb-template-item" data-template="${t.id}">
                <h4>${t.name}</h4>
                <p>${t.description}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    const modal = document.getElementById('eoFbTemplatesModal');
    modal.querySelector('#eoFbTemplatesClose').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    modal.querySelectorAll('.eo-fb-template-item').forEach(item => {
      item.addEventListener('click', () => {
        const templateId = item.dataset.template;
        this.loadTemplate(templateId);
        modal.remove();
      });
    });
  }

  loadTemplate(templateId) {
    try {
      this.currentFunction = this.builder.createTemplate(templateId);
      document.getElementById('eoFbName').value = this.currentFunction.name;
      this.renderNodes();
      this.renderInputsList();
      this.renderTestInputs();
      this.updateFormulaPreview();
    } catch (err) {
      console.error('Failed to load template:', err);
    }
  }

  exportFunction() {
    if (!this.currentFunction) return;

    const json = this.builder.exportFunction(this.currentFunction);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentFunction.name.replace(/\s+/g, '_')}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  saveFunction() {
    if (!this.currentFunction) return;

    const validation = this.builder.validate(this.currentFunction);
    if (!validation.valid) {
      alert(`Cannot save: ${validation.errors.map(e => e.message).join(', ')}`);
      return;
    }

    try {
      this.builder.registerFunction(this.currentFunction);

      if (window.showToast) {
        window.showToast(`Function "${this.currentFunction.name}" saved successfully`);
      } else {
        alert(`Function "${this.currentFunction.name}" saved successfully`);
      }
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;

    const wrapper = document.getElementById('eoFbCanvasWrapper');
    this.canvas.width = wrapper.clientWidth;
    this.canvas.height = wrapper.clientHeight;
    this.drawConnections();
  }
}


// Export for use in other modules
if (typeof window !== 'undefined') {
  window.EOFunctionBuilderUI = EOFunctionBuilderUI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOFunctionBuilderUI;
}
