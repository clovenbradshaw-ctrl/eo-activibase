/**
 * EO Function Builder
 *
 * Allows users to create custom functions by composing atomic operators.
 * Functions are defined as directed acyclic graphs (DAGs) of operators.
 *
 * ARCHITECTURE FOR AI CODERS:
 * ===========================
 *
 * 1. FUNCTION DEFINITION STRUCTURE
 *    A custom function is a DAG where:
 *    - Nodes are either inputs, operators, or outputs
 *    - Edges define data flow between nodes
 *
 * 2. NODE TYPES
 *    - INPUT: Function parameter (e.g., {Price}, {Quantity})
 *    - OPERATOR: An atomic operator from EOAtomicOperators
 *    - LITERAL: A constant value
 *    - OUTPUT: The final result
 *
 * 3. EXECUTION MODEL
 *    - Topological sort determines execution order
 *    - Each node computes once all inputs are available
 *    - Results flow through the graph
 *
 * 4. SERIALIZATION
 *    - Functions can be exported as JSON
 *    - Supports versioning for compatibility
 *    - Can generate formula syntax from graph
 */

class EOFunctionBuilder {
  constructor(atomicOperators) {
    this.operators = atomicOperators || (typeof EOAtomicOperators !== 'undefined' ? EOAtomicOperators : null);
    this.customFunctions = new Map();
    this.version = '1.0.0';
  }

  // ===========================================
  // FUNCTION DEFINITION
  // ===========================================

  /**
   * Create a new custom function definition
   */
  createFunction(config) {
    const {
      id,
      name,
      description = '',
      category = 'custom',
      inputs = [],
      nodes = [],
      connections = []
    } = config;

    const func = {
      id,
      name,
      description,
      category,
      version: this.version,
      inputs: inputs.map((input, idx) => ({
        id: input.id || `input_${idx}`,
        name: input.name,
        type: input.type || 'any',
        description: input.description || '',
        defaultValue: input.defaultValue ?? null
      })),
      nodes: [],
      connections: [],
      outputNodeId: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Add nodes
    for (const node of nodes) {
      this.addNode(func, node);
    }

    // Add connections
    for (const conn of connections) {
      this.addConnection(func, conn);
    }

    return func;
  }

  /**
   * Add a node to a function
   */
  addNode(func, nodeConfig) {
    const {
      id,
      type,         // 'operator' | 'literal' | 'input_ref'
      operatorId,   // For operator nodes
      value,        // For literal nodes
      inputId,      // For input_ref nodes
      position = { x: 0, y: 0 },
      isOutput = false
    } = nodeConfig;

    const node = {
      id: id || `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      position
    };

    if (type === 'operator') {
      const op = this.operators.get(operatorId);
      if (!op) throw new Error(`Unknown operator: ${operatorId}`);

      node.operatorId = operatorId;
      node.operator = {
        name: op.name,
        symbol: op.symbol,
        arity: op.arity,
        inputTypes: op.inputTypes,
        outputType: op.outputType
      };
    } else if (type === 'literal') {
      node.value = value;
      node.valueType = this.getValueType(value);
    } else if (type === 'input_ref') {
      node.inputId = inputId;
    }

    if (isOutput) {
      func.outputNodeId = node.id;
    }

    func.nodes.push(node);
    func.updatedAt = Date.now();

    return node;
  }

  /**
   * Add a connection between nodes
   */
  addConnection(func, connConfig) {
    const {
      id,
      fromNodeId,
      fromPort = 'output',  // 'output' for most nodes
      toNodeId,
      toPort = 0            // Input index for operators
    } = connConfig;

    // Validate nodes exist
    const fromNode = func.nodes.find(n => n.id === fromNodeId);
    const toNode = func.nodes.find(n => n.id === toNodeId);

    if (!fromNode) throw new Error(`Source node not found: ${fromNodeId}`);
    if (!toNode) throw new Error(`Target node not found: ${toNodeId}`);

    // Check for cycles
    if (this.wouldCreateCycle(func, fromNodeId, toNodeId)) {
      throw new Error('Connection would create a cycle');
    }

    const connection = {
      id: id || `conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fromNodeId,
      fromPort,
      toNodeId,
      toPort
    };

    func.connections.push(connection);
    func.updatedAt = Date.now();

    return connection;
  }

  /**
   * Remove a node and its connections
   */
  removeNode(func, nodeId) {
    const nodeIdx = func.nodes.findIndex(n => n.id === nodeId);
    if (nodeIdx === -1) return false;

    func.nodes.splice(nodeIdx, 1);

    // Remove connections to/from this node
    func.connections = func.connections.filter(
      c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId
    );

    if (func.outputNodeId === nodeId) {
      func.outputNodeId = null;
    }

    func.updatedAt = Date.now();
    return true;
  }

  /**
   * Remove a connection
   */
  removeConnection(func, connectionId) {
    const connIdx = func.connections.findIndex(c => c.id === connectionId);
    if (connIdx === -1) return false;

    func.connections.splice(connIdx, 1);
    func.updatedAt = Date.now();
    return true;
  }

  // ===========================================
  // VALIDATION
  // ===========================================

  /**
   * Check if adding a connection would create a cycle
   */
  wouldCreateCycle(func, fromNodeId, toNodeId) {
    // DFS from toNode to see if we can reach fromNode
    const visited = new Set();

    const dfs = (nodeId) => {
      if (nodeId === fromNodeId) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);

      // Find all outgoing connections from this node
      const outgoing = func.connections.filter(c => c.fromNodeId === nodeId);

      for (const conn of outgoing) {
        if (dfs(conn.toNodeId)) return true;
      }

      return false;
    };

    return dfs(toNodeId);
  }

  /**
   * Validate a function definition
   */
  validate(func) {
    const errors = [];
    const warnings = [];

    // Check for output node
    if (!func.outputNodeId) {
      errors.push({ code: 'NO_OUTPUT', message: 'Function has no output node' });
    }

    // Check for disconnected nodes
    const connectedNodes = new Set();
    for (const conn of func.connections) {
      connectedNodes.add(conn.fromNodeId);
      connectedNodes.add(conn.toNodeId);
    }

    for (const node of func.nodes) {
      if (node.type !== 'input_ref' && !connectedNodes.has(node.id) && node.id !== func.outputNodeId) {
        warnings.push({
          code: 'DISCONNECTED_NODE',
          message: `Node ${node.id} is not connected`,
          nodeId: node.id
        });
      }
    }

    // Check operator input counts
    for (const node of func.nodes) {
      if (node.type === 'operator') {
        const op = this.operators.get(node.operatorId);
        if (op && op.arity > 0) {
          const incomingConns = func.connections.filter(c => c.toNodeId === node.id);
          if (incomingConns.length < op.arity) {
            errors.push({
              code: 'MISSING_INPUTS',
              message: `Operator ${op.name} requires ${op.arity} inputs, but only ${incomingConns.length} connected`,
              nodeId: node.id
            });
          }
        }
      }
    }

    // Type checking
    const typeErrors = this.validateTypes(func);
    errors.push(...typeErrors);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate type compatibility in connections
   */
  validateTypes(func) {
    const errors = [];
    const nodeOutputTypes = new Map();

    // Determine output types for each node
    for (const node of func.nodes) {
      if (node.type === 'literal') {
        nodeOutputTypes.set(node.id, node.valueType);
      } else if (node.type === 'input_ref') {
        const input = func.inputs.find(i => i.id === node.inputId);
        nodeOutputTypes.set(node.id, input?.type || 'any');
      } else if (node.type === 'operator') {
        const op = this.operators.get(node.operatorId);
        nodeOutputTypes.set(node.id, op?.outputType || 'any');
      }
    }

    // Check connection type compatibility
    for (const conn of func.connections) {
      const toNode = func.nodes.find(n => n.id === conn.toNodeId);
      if (toNode?.type !== 'operator') continue;

      const op = this.operators.get(toNode.operatorId);
      if (!op || op.inputTypes === 'variadic') continue;

      const fromType = nodeOutputTypes.get(conn.fromNodeId);
      const expectedType = op.inputTypes[conn.toPort];

      if (expectedType && expectedType !== 'any' && fromType !== expectedType) {
        if (!this.operators.canCoerce(fromType, expectedType)) {
          errors.push({
            code: 'TYPE_MISMATCH',
            message: `Cannot connect ${fromType} to ${expectedType} input`,
            connectionId: conn.id
          });
        }
      }
    }

    return errors;
  }

  // ===========================================
  // EXECUTION
  // ===========================================

  /**
   * Get topological order of nodes for execution
   */
  getExecutionOrder(func) {
    const order = [];
    const visited = new Set();
    const temp = new Set();

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      if (temp.has(nodeId)) throw new Error('Cycle detected');

      temp.add(nodeId);

      // Visit dependencies first
      const incoming = func.connections.filter(c => c.toNodeId === nodeId);
      for (const conn of incoming) {
        visit(conn.fromNodeId);
      }

      temp.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    // Start from output node
    if (func.outputNodeId) {
      visit(func.outputNodeId);
    }

    return order;
  }

  /**
   * Execute a function with given inputs
   */
  execute(func, inputValues) {
    const validation = this.validate(func);
    if (!validation.valid) {
      throw new Error(`Invalid function: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const order = this.getExecutionOrder(func);
    const nodeValues = new Map();

    // Execute nodes in order
    for (const nodeId of order) {
      const node = func.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      let value;

      if (node.type === 'literal') {
        value = node.value;
      } else if (node.type === 'input_ref') {
        value = inputValues[node.inputId] ?? null;
      } else if (node.type === 'operator') {
        // Gather inputs
        const incoming = func.connections
          .filter(c => c.toNodeId === nodeId)
          .sort((a, b) => a.toPort - b.toPort);

        const args = incoming.map(conn => nodeValues.get(conn.fromNodeId));

        // Execute operator
        const op = this.operators.get(node.operatorId);
        value = op.evaluate(...args);
      }

      nodeValues.set(nodeId, value);
    }

    return nodeValues.get(func.outputNodeId);
  }

  /**
   * Execute with full trace for debugging/visualization
   */
  executeWithTrace(func, inputValues) {
    const trace = [];
    const validation = this.validate(func);

    trace.push({
      step: 0,
      type: 'start',
      inputs: { ...inputValues },
      description: `Starting execution with inputs: ${JSON.stringify(inputValues)}`
    });

    if (!validation.valid) {
      trace.push({
        step: 1,
        type: 'error',
        errors: validation.errors,
        description: 'Validation failed'
      });
      return { result: null, trace, success: false };
    }

    const order = this.getExecutionOrder(func);
    const nodeValues = new Map();
    let stepNum = 1;

    for (const nodeId of order) {
      const node = func.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      let value;
      let description;

      if (node.type === 'literal') {
        value = node.value;
        description = `Literal: ${value}`;
      } else if (node.type === 'input_ref') {
        value = inputValues[node.inputId] ?? null;
        const inputDef = func.inputs.find(i => i.id === node.inputId);
        description = `Input "${inputDef?.name || node.inputId}": ${value}`;
      } else if (node.type === 'operator') {
        const incoming = func.connections
          .filter(c => c.toNodeId === nodeId)
          .sort((a, b) => a.toPort - b.toPort);

        const args = incoming.map(conn => nodeValues.get(conn.fromNodeId));

        const op = this.operators.get(node.operatorId);

        try {
          value = op.evaluate(...args);
          description = `${op.name}(${args.join(', ')}) = ${value}`;
        } catch (err) {
          trace.push({
            step: stepNum++,
            type: 'error',
            nodeId,
            operator: op.name,
            args,
            error: err.message,
            description: `Error in ${op.name}: ${err.message}`
          });
          return { result: null, trace, success: false };
        }
      }

      nodeValues.set(nodeId, value);

      trace.push({
        step: stepNum++,
        type: node.type,
        nodeId,
        value,
        description
      });
    }

    const result = nodeValues.get(func.outputNodeId);

    trace.push({
      step: stepNum,
      type: 'output',
      result,
      description: `Final result: ${result}`
    });

    return { result, trace, success: true };
  }

  // ===========================================
  // FUNCTION REGISTRATION
  // ===========================================

  /**
   * Register a custom function for use in formulas
   */
  registerFunction(func) {
    const validation = this.validate(func);
    if (!validation.valid) {
      throw new Error(`Cannot register invalid function: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Create an evaluator function
    const evaluator = (...args) => {
      const inputValues = {};
      func.inputs.forEach((input, idx) => {
        inputValues[input.id] = args[idx] ?? input.defaultValue;
      });
      return this.execute(func, inputValues);
    };

    // Store the function
    this.customFunctions.set(func.id, {
      definition: func,
      evaluator,
      inputTypes: func.inputs.map(i => i.type),
      outputType: this.inferOutputType(func)
    });

    return true;
  }

  /**
   * Unregister a custom function
   */
  unregisterFunction(funcId) {
    return this.customFunctions.delete(funcId);
  }

  /**
   * Get a registered custom function
   */
  getFunction(funcId) {
    return this.customFunctions.get(funcId);
  }

  /**
   * Get all registered custom functions
   */
  getAllFunctions() {
    return Array.from(this.customFunctions.values()).map(f => ({
      id: f.definition.id,
      name: f.definition.name,
      description: f.definition.description,
      category: f.definition.category,
      inputs: f.definition.inputs,
      inputTypes: f.inputTypes,
      outputType: f.outputType
    }));
  }

  // ===========================================
  // CODE GENERATION
  // ===========================================

  /**
   * Generate formula syntax from function definition
   */
  generateFormula(func) {
    if (!func.outputNodeId) return '';

    const nodeFormulas = new Map();

    const generateNodeFormula = (nodeId) => {
      if (nodeFormulas.has(nodeId)) return nodeFormulas.get(nodeId);

      const node = func.nodes.find(n => n.id === nodeId);
      if (!node) return '';

      let formula;

      if (node.type === 'literal') {
        if (typeof node.value === 'string') {
          formula = `"${node.value}"`;
        } else {
          formula = String(node.value);
        }
      } else if (node.type === 'input_ref') {
        const input = func.inputs.find(i => i.id === node.inputId);
        formula = `{${input?.name || node.inputId}}`;
      } else if (node.type === 'operator') {
        const op = this.operators.get(node.operatorId);
        const incoming = func.connections
          .filter(c => c.toNodeId === nodeId)
          .sort((a, b) => a.toPort - b.toPort);

        const argFormulas = incoming.map(conn => generateNodeFormula(conn.fromNodeId));
        formula = op.format(argFormulas);
      }

      nodeFormulas.set(nodeId, formula);
      return formula;
    };

    return generateNodeFormula(func.outputNodeId);
  }

  /**
   * Generate JavaScript code from function definition
   */
  generateJavaScript(func) {
    const inputNames = func.inputs.map(i => i.name.replace(/\s+/g, '_'));
    const formula = this.generateFormula(func);

    // Convert formula to JS
    let jsBody = formula
      .replace(/\{([^}]+)\}/g, (_, name) => name.replace(/\s+/g, '_'))
      .replace(/&/g, '+')
      .replace(/\^/g, '**');

    return `function ${func.name.replace(/\s+/g, '_')}(${inputNames.join(', ')}) {
  return ${jsBody};
}`;
  }

  // ===========================================
  // SERIALIZATION
  // ===========================================

  /**
   * Export function to JSON
   */
  exportFunction(func) {
    return JSON.stringify(func, null, 2);
  }

  /**
   * Import function from JSON
   */
  importFunction(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    // Validate structure
    if (!data.id || !data.name || !data.inputs || !data.nodes) {
      throw new Error('Invalid function format');
    }

    return this.createFunction(data);
  }

  // ===========================================
  // UTILITIES
  // ===========================================

  /**
   * Get the type of a value
   */
  getValueType(value) {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    return typeof value;
  }

  /**
   * Infer output type of a function
   */
  inferOutputType(func) {
    if (!func.outputNodeId) return 'any';

    const outputNode = func.nodes.find(n => n.id === func.outputNodeId);
    if (!outputNode) return 'any';

    if (outputNode.type === 'literal') {
      return outputNode.valueType;
    } else if (outputNode.type === 'operator') {
      const op = this.operators.get(outputNode.operatorId);
      return op?.outputType || 'any';
    } else if (outputNode.type === 'input_ref') {
      const input = func.inputs.find(i => i.id === outputNode.inputId);
      return input?.type || 'any';
    }

    return 'any';
  }

  // ===========================================
  // PREDEFINED FUNCTION TEMPLATES
  // ===========================================

  /**
   * Create common function templates
   */
  createTemplate(templateName) {
    const templates = {
      'percentage': {
        id: 'percentage',
        name: 'Percentage',
        description: 'Calculate percentage of a value',
        inputs: [
          { id: 'value', name: 'Value', type: 'number' },
          { id: 'total', name: 'Total', type: 'number' }
        ],
        nodes: [
          { id: 'n1', type: 'input_ref', inputId: 'value' },
          { id: 'n2', type: 'input_ref', inputId: 'total' },
          { id: 'n3', type: 'operator', operatorId: 'DIVIDE' },
          { id: 'n4', type: 'literal', value: 100 },
          { id: 'n5', type: 'operator', operatorId: 'MULTIPLY', isOutput: true }
        ],
        connections: [
          { fromNodeId: 'n1', toNodeId: 'n3', toPort: 0 },
          { fromNodeId: 'n2', toNodeId: 'n3', toPort: 1 },
          { fromNodeId: 'n3', toNodeId: 'n5', toPort: 0 },
          { fromNodeId: 'n4', toNodeId: 'n5', toPort: 1 }
        ]
      },

      'profit_margin': {
        id: 'profit_margin',
        name: 'Profit Margin',
        description: 'Calculate profit margin percentage',
        inputs: [
          { id: 'revenue', name: 'Revenue', type: 'number' },
          { id: 'cost', name: 'Cost', type: 'number' }
        ],
        nodes: [
          { id: 'n1', type: 'input_ref', inputId: 'revenue' },
          { id: 'n2', type: 'input_ref', inputId: 'cost' },
          { id: 'n3', type: 'operator', operatorId: 'SUBTRACT' },
          { id: 'n4', type: 'operator', operatorId: 'DIVIDE' },
          { id: 'n5', type: 'literal', value: 100 },
          { id: 'n6', type: 'operator', operatorId: 'MULTIPLY', isOutput: true }
        ],
        connections: [
          { fromNodeId: 'n1', toNodeId: 'n3', toPort: 0 },
          { fromNodeId: 'n2', toNodeId: 'n3', toPort: 1 },
          { fromNodeId: 'n3', toNodeId: 'n4', toPort: 0 },
          { fromNodeId: 'n1', toNodeId: 'n4', toPort: 1 },
          { fromNodeId: 'n4', toNodeId: 'n6', toPort: 0 },
          { fromNodeId: 'n5', toNodeId: 'n6', toPort: 1 }
        ]
      },

      'days_until': {
        id: 'days_until',
        name: 'Days Until',
        description: 'Calculate days until a future date',
        inputs: [
          { id: 'target_date', name: 'Target Date', type: 'date' }
        ],
        nodes: [
          { id: 'n1', type: 'operator', operatorId: 'TODAY' },
          { id: 'n2', type: 'input_ref', inputId: 'target_date' },
          { id: 'n3', type: 'literal', value: 'days' },
          { id: 'n4', type: 'operator', operatorId: 'DATEDIFF', isOutput: true }
        ],
        connections: [
          { fromNodeId: 'n1', toNodeId: 'n4', toPort: 0 },
          { fromNodeId: 'n2', toNodeId: 'n4', toPort: 1 },
          { fromNodeId: 'n3', toNodeId: 'n4', toPort: 2 }
        ]
      },

      'weighted_average': {
        id: 'weighted_average',
        name: 'Weighted Average',
        description: 'Calculate weighted average of two values',
        inputs: [
          { id: 'value1', name: 'Value 1', type: 'number' },
          { id: 'weight1', name: 'Weight 1', type: 'number' },
          { id: 'value2', name: 'Value 2', type: 'number' },
          { id: 'weight2', name: 'Weight 2', type: 'number' }
        ],
        nodes: [
          { id: 'n1', type: 'input_ref', inputId: 'value1' },
          { id: 'n2', type: 'input_ref', inputId: 'weight1' },
          { id: 'n3', type: 'input_ref', inputId: 'value2' },
          { id: 'n4', type: 'input_ref', inputId: 'weight2' },
          { id: 'n5', type: 'operator', operatorId: 'MULTIPLY' },  // v1 * w1
          { id: 'n6', type: 'operator', operatorId: 'MULTIPLY' },  // v2 * w2
          { id: 'n7', type: 'operator', operatorId: 'ADD' },       // sum of products
          { id: 'n8', type: 'operator', operatorId: 'ADD' },       // sum of weights
          { id: 'n9', type: 'operator', operatorId: 'DIVIDE', isOutput: true }
        ],
        connections: [
          { fromNodeId: 'n1', toNodeId: 'n5', toPort: 0 },
          { fromNodeId: 'n2', toNodeId: 'n5', toPort: 1 },
          { fromNodeId: 'n3', toNodeId: 'n6', toPort: 0 },
          { fromNodeId: 'n4', toNodeId: 'n6', toPort: 1 },
          { fromNodeId: 'n5', toNodeId: 'n7', toPort: 0 },
          { fromNodeId: 'n6', toNodeId: 'n7', toPort: 1 },
          { fromNodeId: 'n2', toNodeId: 'n8', toPort: 0 },
          { fromNodeId: 'n4', toNodeId: 'n8', toPort: 1 },
          { fromNodeId: 'n7', toNodeId: 'n9', toPort: 0 },
          { fromNodeId: 'n8', toNodeId: 'n9', toPort: 1 }
        ]
      }
    };

    const template = templates[templateName];
    if (!template) {
      throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(templates).join(', ')}`);
    }

    return this.createFunction(template);
  }

  /**
   * Get list of available templates
   */
  getTemplates() {
    return [
      { id: 'percentage', name: 'Percentage', description: 'Calculate percentage of a value' },
      { id: 'profit_margin', name: 'Profit Margin', description: 'Calculate profit margin percentage' },
      { id: 'days_until', name: 'Days Until', description: 'Calculate days until a future date' },
      { id: 'weighted_average', name: 'Weighted Average', description: 'Calculate weighted average of two values' }
    ];
  }
}


// Export for use in other modules
if (typeof window !== 'undefined') {
  window.EOFunctionBuilder = EOFunctionBuilder;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOFunctionBuilder;
}
