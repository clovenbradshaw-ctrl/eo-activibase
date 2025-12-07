/**
 * EO Atomic Operators System
 *
 * Defines the fundamental building blocks for formula computation.
 * Each operator is an atomic unit with:
 * - Type signature (input types -> output type)
 * - Algebraic properties (associativity, commutativity, identity, etc.)
 * - Composition rules
 * - Visual representation for the function builder
 *
 * ARCHITECTURE FOR AI CODERS:
 * ===========================
 *
 * The atomic operator system follows these principles:
 *
 * 1. TYPE SYSTEM
 *    - Every value has a type: number, text, boolean, date, array, null
 *    - Operators declare input/output types
 *    - Type coercion happens automatically where safe
 *
 * 2. ALGEBRAIC PROPERTIES
 *    - Operators declare their algebraic properties
 *    - This enables optimization and validation of chains
 *    - Example: (a + b) + c === a + (b + c) [associative]
 *
 * 3. COMPOSITION
 *    - Operators can be chained: op1 -> op2 -> op3
 *    - Output type of op1 must match input type of op2
 *    - Nested composition: op1(op2(x), op3(y))
 *
 * 4. CATEGORIES
 *    - arithmetic: +, -, *, /, ^, %
 *    - comparison: =, !=, <, >, <=, >=
 *    - logical: AND, OR, NOT
 *    - text: CONCAT, UPPER, LOWER, etc.
 *    - aggregate: SUM, AVG, COUNT, etc.
 *    - date: TODAY, DATEDIFF, etc.
 *    - type: VALUE, TEXT, ISBLANK, etc.
 */

const EOAtomicOperators = {

  // ===========================================
  // TYPE DEFINITIONS
  // ===========================================

  types: {
    NUMBER: 'number',
    TEXT: 'text',
    BOOLEAN: 'boolean',
    DATE: 'date',
    ARRAY: 'array',
    ANY: 'any',
    NULL: 'null'
  },

  // ===========================================
  // ALGEBRAIC PROPERTIES
  // ===========================================

  algebraicProperties: {
    ASSOCIATIVE: 'associative',     // (a op b) op c = a op (b op c)
    COMMUTATIVE: 'commutative',     // a op b = b op a
    IDEMPOTENT: 'idempotent',       // a op a = a
    INVOLUTORY: 'involutory',       // op(op(a)) = a
    IDENTITY: 'identity',           // Has identity element
    ABSORBING: 'absorbing',         // Has absorbing element
    DISTRIBUTIVE: 'distributive'    // a * (b + c) = (a * b) + (a * c)
  },

  // ===========================================
  // OPERATOR REGISTRY
  // ===========================================

  operators: {},

  /**
   * Register an atomic operator
   */
  register(config) {
    const {
      id,
      name,
      symbol,
      category,
      description,
      inputTypes,
      outputType,
      arity,
      properties = [],
      identity = null,
      absorbing = null,
      inverse = null,
      evaluate,
      format,
      examples = []
    } = config;

    this.operators[id] = {
      id,
      name,
      symbol,
      category,
      description,
      inputTypes,
      outputType,
      arity,
      properties,
      identity,
      absorbing,
      inverse,
      evaluate,
      format: format || ((args) => `${symbol}(${args.join(', ')})`),
      examples,

      // Type checking
      checkTypes(args) {
        if (inputTypes === 'variadic') return true;
        if (args.length !== inputTypes.length) return false;

        return args.every((arg, i) => {
          const expected = inputTypes[i];
          if (expected === 'any') return true;
          return this.getType(arg) === expected;
        });
      },

      getType(value) {
        if (value === null || value === undefined) return 'null';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'date';
        return typeof value;
      }
    };

    return this.operators[id];
  },

  /**
   * Get operator by ID
   */
  get(id) {
    return this.operators[id];
  },

  /**
   * Get all operators in a category
   */
  getByCategory(category) {
    return Object.values(this.operators).filter(op => op.category === category);
  },

  /**
   * Get all categories
   */
  getCategories() {
    const categories = new Set();
    Object.values(this.operators).forEach(op => categories.add(op.category));
    return Array.from(categories);
  },

  // ===========================================
  // TYPE COERCION
  // ===========================================

  coerce: {
    toNumber(value) {
      if (typeof value === 'number') return value;
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    },

    toText(value) {
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toISOString();
      return String(value);
    },

    toBoolean(value) {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') return value.length > 0;
      return !!value;
    },

    toDate(value) {
      if (value instanceof Date) return value;
      if (typeof value === 'number') return new Date(value);
      if (typeof value === 'string') return new Date(value);
      return new Date();
    },

    toArray(value) {
      if (Array.isArray(value)) return value;
      if (value === null || value === undefined) return [];
      return [value];
    }
  },

  // ===========================================
  // CHAIN VALIDATION
  // ===========================================

  /**
   * Check if operators can be chained: op1 -> op2
   */
  canChain(op1Id, op2Id) {
    const op1 = this.get(op1Id);
    const op2 = this.get(op2Id);

    if (!op1 || !op2) return { valid: false, reason: 'Unknown operator' };

    // Check if output of op1 can be input to op2
    const outputType = op1.outputType;
    const inputTypes = op2.inputTypes;

    if (inputTypes === 'variadic') return { valid: true };
    if (inputTypes[0] === 'any') return { valid: true };
    if (inputTypes[0] === outputType) return { valid: true };

    // Check if coercion is possible
    const coercible = this.canCoerce(outputType, inputTypes[0]);

    return {
      valid: coercible,
      reason: coercible ? null : `Cannot convert ${outputType} to ${inputTypes[0]}`
    };
  },

  /**
   * Check if type coercion is possible
   */
  canCoerce(from, to) {
    if (from === to) return true;
    if (to === 'any') return true;

    const coercionMatrix = {
      number: ['text', 'boolean'],
      text: ['number', 'boolean'],
      boolean: ['number', 'text'],
      date: ['number', 'text'],
      array: ['text'],
      null: ['number', 'text', 'boolean', 'array']
    };

    return coercionMatrix[from]?.includes(to) || false;
  },

  /**
   * Validate a chain of operators
   */
  validateChain(operatorIds) {
    const errors = [];

    for (let i = 0; i < operatorIds.length - 1; i++) {
      const result = this.canChain(operatorIds[i], operatorIds[i + 1]);
      if (!result.valid) {
        errors.push({
          position: i,
          from: operatorIds[i],
          to: operatorIds[i + 1],
          reason: result.reason
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // ===========================================
  // ALGEBRAIC SIMPLIFICATION
  // ===========================================

  /**
   * Check if two operations can be simplified
   * Example: x + 0 = x (identity)
   */
  canSimplify(opId, args) {
    const op = this.get(opId);
    if (!op) return null;

    // Check for identity element
    if (op.identity !== null && args.includes(op.identity)) {
      const nonIdentity = args.filter(a => a !== op.identity);
      if (nonIdentity.length === 1) {
        return { simplified: true, result: nonIdentity[0], rule: 'identity' };
      }
    }

    // Check for absorbing element
    if (op.absorbing !== null && args.includes(op.absorbing)) {
      return { simplified: true, result: op.absorbing, rule: 'absorbing' };
    }

    // Check for idempotent (a op a = a)
    if (op.properties.includes('idempotent') && args.length === 2 && args[0] === args[1]) {
      return { simplified: true, result: args[0], rule: 'idempotent' };
    }

    return { simplified: false };
  },

  // ===========================================
  // COMPOSITION
  // ===========================================

  /**
   * Compose multiple operators into a function
   * Returns an evaluator function
   */
  compose(...operatorConfigs) {
    // operatorConfigs: [{ id, args: [indices or literals] }]

    return (inputs) => {
      const values = [...inputs];

      for (const config of operatorConfigs) {
        const op = this.get(config.id);
        if (!op) throw new Error(`Unknown operator: ${config.id}`);

        // Resolve arguments
        const args = config.args.map(arg => {
          if (typeof arg === 'object' && arg.ref !== undefined) {
            return values[arg.ref];
          }
          return arg;
        });

        // Evaluate
        const result = op.evaluate(...args);
        values.push(result);
      }

      return values[values.length - 1];
    };
  },

  // ===========================================
  // EXECUTION TRACE
  // ===========================================

  /**
   * Execute an operator chain with full trace
   * Returns step-by-step execution for visualization
   */
  executeWithTrace(operatorConfigs, inputs) {
    const trace = [];
    const values = [...inputs];

    trace.push({
      step: 0,
      type: 'input',
      values: [...inputs],
      description: `Input values: ${inputs.join(', ')}`
    });

    for (let i = 0; i < operatorConfigs.length; i++) {
      const config = operatorConfigs[i];
      const op = this.get(config.id);

      if (!op) {
        trace.push({
          step: i + 1,
          type: 'error',
          error: `Unknown operator: ${config.id}`
        });
        break;
      }

      // Resolve arguments
      const args = config.args.map(arg => {
        if (typeof arg === 'object' && arg.ref !== undefined) {
          return values[arg.ref];
        }
        return arg;
      });

      // Check for simplification
      const simplification = this.canSimplify(config.id, args);

      let result;
      if (simplification.simplified) {
        result = simplification.result;
        trace.push({
          step: i + 1,
          type: 'simplification',
          operator: op,
          args: [...args],
          result,
          rule: simplification.rule,
          description: `${op.name}(${args.join(', ')}) simplified to ${result} [${simplification.rule}]`
        });
      } else {
        result = op.evaluate(...args);
        trace.push({
          step: i + 1,
          type: 'evaluation',
          operator: op,
          args: [...args],
          result,
          description: `${op.name}(${args.join(', ')}) = ${result}`
        });
      }

      values.push(result);
    }

    trace.push({
      step: operatorConfigs.length + 1,
      type: 'output',
      result: values[values.length - 1],
      description: `Final result: ${values[values.length - 1]}`
    });

    return {
      result: values[values.length - 1],
      trace,
      values
    };
  }
};


// ===========================================
// REGISTER ARITHMETIC OPERATORS
// ===========================================

EOAtomicOperators.register({
  id: 'ADD',
  name: 'Add',
  symbol: '+',
  category: 'arithmetic',
  description: 'Adds two numbers together',
  inputTypes: ['number', 'number'],
  outputType: 'number',
  arity: 2,
  properties: ['associative', 'commutative', 'identity'],
  identity: 0,
  inverse: 'SUBTRACT',
  evaluate: (a, b) => EOAtomicOperators.coerce.toNumber(a) + EOAtomicOperators.coerce.toNumber(b),
  format: (args) => `(${args[0]} + ${args[1]})`,
  examples: [
    { inputs: [5, 3], output: 8 },
    { inputs: [-2, 7], output: 5 }
  ]
});

EOAtomicOperators.register({
  id: 'SUBTRACT',
  name: 'Subtract',
  symbol: '-',
  category: 'arithmetic',
  description: 'Subtracts second number from first',
  inputTypes: ['number', 'number'],
  outputType: 'number',
  arity: 2,
  properties: ['identity'],
  identity: 0, // a - 0 = a (right identity only)
  inverse: 'ADD',
  evaluate: (a, b) => EOAtomicOperators.coerce.toNumber(a) - EOAtomicOperators.coerce.toNumber(b),
  format: (args) => `(${args[0]} - ${args[1]})`,
  examples: [
    { inputs: [10, 3], output: 7 },
    { inputs: [5, 8], output: -3 }
  ]
});

EOAtomicOperators.register({
  id: 'MULTIPLY',
  name: 'Multiply',
  symbol: '*',
  category: 'arithmetic',
  description: 'Multiplies two numbers',
  inputTypes: ['number', 'number'],
  outputType: 'number',
  arity: 2,
  properties: ['associative', 'commutative', 'identity', 'absorbing', 'distributive'],
  identity: 1,
  absorbing: 0,
  inverse: 'DIVIDE',
  evaluate: (a, b) => EOAtomicOperators.coerce.toNumber(a) * EOAtomicOperators.coerce.toNumber(b),
  format: (args) => `(${args[0]} * ${args[1]})`,
  examples: [
    { inputs: [4, 5], output: 20 },
    { inputs: [3, 0], output: 0 }
  ]
});

EOAtomicOperators.register({
  id: 'DIVIDE',
  name: 'Divide',
  symbol: '/',
  category: 'arithmetic',
  description: 'Divides first number by second',
  inputTypes: ['number', 'number'],
  outputType: 'number',
  arity: 2,
  properties: ['identity'],
  identity: 1, // a / 1 = a (right identity only)
  inverse: 'MULTIPLY',
  evaluate: (a, b) => {
    const divisor = EOAtomicOperators.coerce.toNumber(b);
    if (divisor === 0) throw new Error('Division by zero');
    return EOAtomicOperators.coerce.toNumber(a) / divisor;
  },
  format: (args) => `(${args[0]} / ${args[1]})`,
  examples: [
    { inputs: [20, 4], output: 5 },
    { inputs: [7, 2], output: 3.5 }
  ]
});

EOAtomicOperators.register({
  id: 'POWER',
  name: 'Power',
  symbol: '^',
  category: 'arithmetic',
  description: 'Raises first number to the power of second',
  inputTypes: ['number', 'number'],
  outputType: 'number',
  arity: 2,
  properties: [],
  evaluate: (a, b) => Math.pow(EOAtomicOperators.coerce.toNumber(a), EOAtomicOperators.coerce.toNumber(b)),
  format: (args) => `(${args[0]} ^ ${args[1]})`,
  examples: [
    { inputs: [2, 3], output: 8 },
    { inputs: [5, 2], output: 25 }
  ]
});

EOAtomicOperators.register({
  id: 'MODULO',
  name: 'Modulo',
  symbol: '%',
  category: 'arithmetic',
  description: 'Returns remainder of division',
  inputTypes: ['number', 'number'],
  outputType: 'number',
  arity: 2,
  properties: [],
  evaluate: (a, b) => EOAtomicOperators.coerce.toNumber(a) % EOAtomicOperators.coerce.toNumber(b),
  format: (args) => `(${args[0]} % ${args[1]})`,
  examples: [
    { inputs: [10, 3], output: 1 },
    { inputs: [15, 5], output: 0 }
  ]
});

EOAtomicOperators.register({
  id: 'NEGATE',
  name: 'Negate',
  symbol: '-',
  category: 'arithmetic',
  description: 'Negates a number',
  inputTypes: ['number'],
  outputType: 'number',
  arity: 1,
  properties: ['involutory'], // -(-a) = a
  evaluate: (a) => -EOAtomicOperators.coerce.toNumber(a),
  format: (args) => `(-${args[0]})`,
  examples: [
    { inputs: [5], output: -5 },
    { inputs: [-3], output: 3 }
  ]
});

EOAtomicOperators.register({
  id: 'ABS',
  name: 'Absolute Value',
  symbol: 'ABS',
  category: 'arithmetic',
  description: 'Returns absolute value',
  inputTypes: ['number'],
  outputType: 'number',
  arity: 1,
  properties: ['idempotent'], // ABS(ABS(a)) = ABS(a)
  evaluate: (a) => Math.abs(EOAtomicOperators.coerce.toNumber(a)),
  format: (args) => `ABS(${args[0]})`,
  examples: [
    { inputs: [-5], output: 5 },
    { inputs: [3], output: 3 }
  ]
});

EOAtomicOperators.register({
  id: 'SQRT',
  name: 'Square Root',
  symbol: 'SQRT',
  category: 'arithmetic',
  description: 'Returns square root',
  inputTypes: ['number'],
  outputType: 'number',
  arity: 1,
  properties: [],
  evaluate: (a) => Math.sqrt(EOAtomicOperators.coerce.toNumber(a)),
  format: (args) => `SQRT(${args[0]})`,
  examples: [
    { inputs: [16], output: 4 },
    { inputs: [2], output: 1.414 }
  ]
});

EOAtomicOperators.register({
  id: 'ROUND',
  name: 'Round',
  symbol: 'ROUND',
  category: 'arithmetic',
  description: 'Rounds to specified decimal places',
  inputTypes: ['number', 'number'],
  outputType: 'number',
  arity: 2,
  properties: ['idempotent'],
  evaluate: (a, decimals = 0) => {
    const multiplier = Math.pow(10, EOAtomicOperators.coerce.toNumber(decimals));
    return Math.round(EOAtomicOperators.coerce.toNumber(a) * multiplier) / multiplier;
  },
  format: (args) => `ROUND(${args[0]}, ${args[1] || 0})`,
  examples: [
    { inputs: [3.14159, 2], output: 3.14 },
    { inputs: [2.5, 0], output: 3 }
  ]
});

EOAtomicOperators.register({
  id: 'FLOOR',
  name: 'Floor',
  symbol: 'FLOOR',
  category: 'arithmetic',
  description: 'Rounds down to nearest integer',
  inputTypes: ['number'],
  outputType: 'number',
  arity: 1,
  properties: ['idempotent'],
  evaluate: (a) => Math.floor(EOAtomicOperators.coerce.toNumber(a)),
  format: (args) => `FLOOR(${args[0]})`,
  examples: [
    { inputs: [3.7], output: 3 },
    { inputs: [-2.3], output: -3 }
  ]
});

EOAtomicOperators.register({
  id: 'CEIL',
  name: 'Ceiling',
  symbol: 'CEIL',
  category: 'arithmetic',
  description: 'Rounds up to nearest integer',
  inputTypes: ['number'],
  outputType: 'number',
  arity: 1,
  properties: ['idempotent'],
  evaluate: (a) => Math.ceil(EOAtomicOperators.coerce.toNumber(a)),
  format: (args) => `CEIL(${args[0]})`,
  examples: [
    { inputs: [3.2], output: 4 },
    { inputs: [-2.7], output: -2 }
  ]
});


// ===========================================
// REGISTER COMPARISON OPERATORS
// ===========================================

EOAtomicOperators.register({
  id: 'EQUAL',
  name: 'Equal',
  symbol: '=',
  category: 'comparison',
  description: 'Tests if two values are equal',
  inputTypes: ['any', 'any'],
  outputType: 'boolean',
  arity: 2,
  properties: ['commutative'],
  evaluate: (a, b) => a === b,
  format: (args) => `(${args[0]} = ${args[1]})`,
  examples: [
    { inputs: [5, 5], output: true },
    { inputs: ['a', 'b'], output: false }
  ]
});

EOAtomicOperators.register({
  id: 'NOT_EQUAL',
  name: 'Not Equal',
  symbol: '!=',
  category: 'comparison',
  description: 'Tests if two values are not equal',
  inputTypes: ['any', 'any'],
  outputType: 'boolean',
  arity: 2,
  properties: ['commutative'],
  evaluate: (a, b) => a !== b,
  format: (args) => `(${args[0]} != ${args[1]})`,
  examples: [
    { inputs: [5, 3], output: true },
    { inputs: ['a', 'a'], output: false }
  ]
});

EOAtomicOperators.register({
  id: 'LESS_THAN',
  name: 'Less Than',
  symbol: '<',
  category: 'comparison',
  description: 'Tests if first value is less than second',
  inputTypes: ['number', 'number'],
  outputType: 'boolean',
  arity: 2,
  properties: [],
  evaluate: (a, b) => EOAtomicOperators.coerce.toNumber(a) < EOAtomicOperators.coerce.toNumber(b),
  format: (args) => `(${args[0]} < ${args[1]})`,
  examples: [
    { inputs: [3, 5], output: true },
    { inputs: [5, 3], output: false }
  ]
});

EOAtomicOperators.register({
  id: 'GREATER_THAN',
  name: 'Greater Than',
  symbol: '>',
  category: 'comparison',
  description: 'Tests if first value is greater than second',
  inputTypes: ['number', 'number'],
  outputType: 'boolean',
  arity: 2,
  properties: [],
  evaluate: (a, b) => EOAtomicOperators.coerce.toNumber(a) > EOAtomicOperators.coerce.toNumber(b),
  format: (args) => `(${args[0]} > ${args[1]})`,
  examples: [
    { inputs: [5, 3], output: true },
    { inputs: [3, 5], output: false }
  ]
});

EOAtomicOperators.register({
  id: 'LESS_EQUAL',
  name: 'Less Than or Equal',
  symbol: '<=',
  category: 'comparison',
  description: 'Tests if first value is less than or equal to second',
  inputTypes: ['number', 'number'],
  outputType: 'boolean',
  arity: 2,
  properties: [],
  evaluate: (a, b) => EOAtomicOperators.coerce.toNumber(a) <= EOAtomicOperators.coerce.toNumber(b),
  format: (args) => `(${args[0]} <= ${args[1]})`,
  examples: [
    { inputs: [3, 5], output: true },
    { inputs: [5, 5], output: true }
  ]
});

EOAtomicOperators.register({
  id: 'GREATER_EQUAL',
  name: 'Greater Than or Equal',
  symbol: '>=',
  category: 'comparison',
  description: 'Tests if first value is greater than or equal to second',
  inputTypes: ['number', 'number'],
  outputType: 'boolean',
  arity: 2,
  properties: [],
  evaluate: (a, b) => EOAtomicOperators.coerce.toNumber(a) >= EOAtomicOperators.coerce.toNumber(b),
  format: (args) => `(${args[0]} >= ${args[1]})`,
  examples: [
    { inputs: [5, 3], output: true },
    { inputs: [5, 5], output: true }
  ]
});


// ===========================================
// REGISTER LOGICAL OPERATORS
// ===========================================

EOAtomicOperators.register({
  id: 'AND',
  name: 'And',
  symbol: 'AND',
  category: 'logical',
  description: 'Returns true if all arguments are true',
  inputTypes: 'variadic',
  outputType: 'boolean',
  arity: -1, // variadic
  properties: ['associative', 'commutative', 'identity', 'absorbing', 'idempotent'],
  identity: true,
  absorbing: false,
  evaluate: (...args) => args.every(a => EOAtomicOperators.coerce.toBoolean(a)),
  format: (args) => `AND(${args.join(', ')})`,
  examples: [
    { inputs: [true, true], output: true },
    { inputs: [true, false], output: false }
  ]
});

EOAtomicOperators.register({
  id: 'OR',
  name: 'Or',
  symbol: 'OR',
  category: 'logical',
  description: 'Returns true if any argument is true',
  inputTypes: 'variadic',
  outputType: 'boolean',
  arity: -1,
  properties: ['associative', 'commutative', 'identity', 'absorbing', 'idempotent'],
  identity: false,
  absorbing: true,
  evaluate: (...args) => args.some(a => EOAtomicOperators.coerce.toBoolean(a)),
  format: (args) => `OR(${args.join(', ')})`,
  examples: [
    { inputs: [false, true], output: true },
    { inputs: [false, false], output: false }
  ]
});

EOAtomicOperators.register({
  id: 'NOT',
  name: 'Not',
  symbol: 'NOT',
  category: 'logical',
  description: 'Negates a boolean value',
  inputTypes: ['boolean'],
  outputType: 'boolean',
  arity: 1,
  properties: ['involutory'], // NOT(NOT(a)) = a
  evaluate: (a) => !EOAtomicOperators.coerce.toBoolean(a),
  format: (args) => `NOT(${args[0]})`,
  examples: [
    { inputs: [true], output: false },
    { inputs: [false], output: true }
  ]
});

EOAtomicOperators.register({
  id: 'IF',
  name: 'If',
  symbol: 'IF',
  category: 'logical',
  description: 'Returns one value if condition is true, another if false',
  inputTypes: ['boolean', 'any', 'any'],
  outputType: 'any',
  arity: 3,
  properties: [],
  evaluate: (condition, trueVal, falseVal) => EOAtomicOperators.coerce.toBoolean(condition) ? trueVal : falseVal,
  format: (args) => `IF(${args[0]}, ${args[1]}, ${args[2]})`,
  examples: [
    { inputs: [true, 'yes', 'no'], output: 'yes' },
    { inputs: [false, 10, 20], output: 20 }
  ]
});


// ===========================================
// REGISTER TEXT OPERATORS
// ===========================================

EOAtomicOperators.register({
  id: 'CONCAT',
  name: 'Concatenate',
  symbol: '&',
  category: 'text',
  description: 'Joins text values together',
  inputTypes: 'variadic',
  outputType: 'text',
  arity: -1,
  properties: ['associative', 'identity'],
  identity: '',
  evaluate: (...args) => args.map(a => EOAtomicOperators.coerce.toText(a)).join(''),
  format: (args) => args.join(' & '),
  examples: [
    { inputs: ['Hello', ' ', 'World'], output: 'Hello World' },
    { inputs: ['A', 'B', 'C'], output: 'ABC' }
  ]
});

EOAtomicOperators.register({
  id: 'UPPER',
  name: 'Uppercase',
  symbol: 'UPPER',
  category: 'text',
  description: 'Converts text to uppercase',
  inputTypes: ['text'],
  outputType: 'text',
  arity: 1,
  properties: ['idempotent'],
  evaluate: (a) => EOAtomicOperators.coerce.toText(a).toUpperCase(),
  format: (args) => `UPPER(${args[0]})`,
  examples: [
    { inputs: ['hello'], output: 'HELLO' }
  ]
});

EOAtomicOperators.register({
  id: 'LOWER',
  name: 'Lowercase',
  symbol: 'LOWER',
  category: 'text',
  description: 'Converts text to lowercase',
  inputTypes: ['text'],
  outputType: 'text',
  arity: 1,
  properties: ['idempotent'],
  evaluate: (a) => EOAtomicOperators.coerce.toText(a).toLowerCase(),
  format: (args) => `LOWER(${args[0]})`,
  examples: [
    { inputs: ['HELLO'], output: 'hello' }
  ]
});

EOAtomicOperators.register({
  id: 'TRIM',
  name: 'Trim',
  symbol: 'TRIM',
  category: 'text',
  description: 'Removes leading and trailing whitespace',
  inputTypes: ['text'],
  outputType: 'text',
  arity: 1,
  properties: ['idempotent'],
  evaluate: (a) => EOAtomicOperators.coerce.toText(a).trim(),
  format: (args) => `TRIM(${args[0]})`,
  examples: [
    { inputs: ['  hello  '], output: 'hello' }
  ]
});

EOAtomicOperators.register({
  id: 'LEN',
  name: 'Length',
  symbol: 'LEN',
  category: 'text',
  description: 'Returns the length of text',
  inputTypes: ['text'],
  outputType: 'number',
  arity: 1,
  properties: [],
  evaluate: (a) => EOAtomicOperators.coerce.toText(a).length,
  format: (args) => `LEN(${args[0]})`,
  examples: [
    { inputs: ['hello'], output: 5 }
  ]
});

EOAtomicOperators.register({
  id: 'LEFT',
  name: 'Left',
  symbol: 'LEFT',
  category: 'text',
  description: 'Returns leftmost characters',
  inputTypes: ['text', 'number'],
  outputType: 'text',
  arity: 2,
  properties: [],
  evaluate: (text, count) => EOAtomicOperators.coerce.toText(text).substring(0, EOAtomicOperators.coerce.toNumber(count)),
  format: (args) => `LEFT(${args[0]}, ${args[1]})`,
  examples: [
    { inputs: ['hello', 3], output: 'hel' }
  ]
});

EOAtomicOperators.register({
  id: 'RIGHT',
  name: 'Right',
  symbol: 'RIGHT',
  category: 'text',
  description: 'Returns rightmost characters',
  inputTypes: ['text', 'number'],
  outputType: 'text',
  arity: 2,
  properties: [],
  evaluate: (text, count) => {
    const str = EOAtomicOperators.coerce.toText(text);
    const n = EOAtomicOperators.coerce.toNumber(count);
    return str.substring(str.length - n);
  },
  format: (args) => `RIGHT(${args[0]}, ${args[1]})`,
  examples: [
    { inputs: ['hello', 3], output: 'llo' }
  ]
});

EOAtomicOperators.register({
  id: 'MID',
  name: 'Mid',
  symbol: 'MID',
  category: 'text',
  description: 'Returns characters from middle of text',
  inputTypes: ['text', 'number', 'number'],
  outputType: 'text',
  arity: 3,
  properties: [],
  evaluate: (text, start, count) => {
    const str = EOAtomicOperators.coerce.toText(text);
    const s = EOAtomicOperators.coerce.toNumber(start);
    const c = EOAtomicOperators.coerce.toNumber(count);
    return str.substring(s, s + c);
  },
  format: (args) => `MID(${args[0]}, ${args[1]}, ${args[2]})`,
  examples: [
    { inputs: ['hello', 1, 3], output: 'ell' }
  ]
});


// ===========================================
// REGISTER AGGREGATE OPERATORS (FOR ROLLUPS)
// ===========================================

EOAtomicOperators.register({
  id: 'SUM',
  name: 'Sum',
  symbol: 'SUM',
  category: 'aggregate',
  description: 'Sums all numeric values in an array',
  inputTypes: ['array'],
  outputType: 'number',
  arity: 1,
  properties: [],
  evaluate: (arr) => {
    const values = EOAtomicOperators.coerce.toArray(arr);
    return values.reduce((sum, v) => sum + EOAtomicOperators.coerce.toNumber(v), 0);
  },
  format: (args) => `SUM(${args[0]})`,
  examples: [
    { inputs: [[1, 2, 3, 4]], output: 10 }
  ]
});

EOAtomicOperators.register({
  id: 'AVG',
  name: 'Average',
  symbol: 'AVG',
  category: 'aggregate',
  description: 'Calculates average of numeric values',
  inputTypes: ['array'],
  outputType: 'number',
  arity: 1,
  properties: [],
  evaluate: (arr) => {
    const values = EOAtomicOperators.coerce.toArray(arr);
    if (values.length === 0) return 0;
    const sum = values.reduce((s, v) => s + EOAtomicOperators.coerce.toNumber(v), 0);
    return sum / values.length;
  },
  format: (args) => `AVG(${args[0]})`,
  examples: [
    { inputs: [[2, 4, 6]], output: 4 }
  ]
});

EOAtomicOperators.register({
  id: 'COUNT',
  name: 'Count',
  symbol: 'COUNT',
  category: 'aggregate',
  description: 'Counts non-empty values',
  inputTypes: ['array'],
  outputType: 'number',
  arity: 1,
  properties: [],
  evaluate: (arr) => {
    const values = EOAtomicOperators.coerce.toArray(arr);
    return values.filter(v => v !== null && v !== undefined && v !== '').length;
  },
  format: (args) => `COUNT(${args[0]})`,
  examples: [
    { inputs: [[1, 2, null, 4]], output: 3 }
  ]
});

EOAtomicOperators.register({
  id: 'MIN',
  name: 'Minimum',
  symbol: 'MIN',
  category: 'aggregate',
  description: 'Returns minimum value',
  inputTypes: ['array'],
  outputType: 'number',
  arity: 1,
  properties: ['idempotent', 'associative', 'commutative'],
  evaluate: (arr) => {
    const values = EOAtomicOperators.coerce.toArray(arr)
      .map(v => EOAtomicOperators.coerce.toNumber(v))
      .filter(v => !isNaN(v));
    if (values.length === 0) return null;
    return Math.min(...values);
  },
  format: (args) => `MIN(${args[0]})`,
  examples: [
    { inputs: [[5, 2, 8, 1]], output: 1 }
  ]
});

EOAtomicOperators.register({
  id: 'MAX',
  name: 'Maximum',
  symbol: 'MAX',
  category: 'aggregate',
  description: 'Returns maximum value',
  inputTypes: ['array'],
  outputType: 'number',
  arity: 1,
  properties: ['idempotent', 'associative', 'commutative'],
  evaluate: (arr) => {
    const values = EOAtomicOperators.coerce.toArray(arr)
      .map(v => EOAtomicOperators.coerce.toNumber(v))
      .filter(v => !isNaN(v));
    if (values.length === 0) return null;
    return Math.max(...values);
  },
  format: (args) => `MAX(${args[0]})`,
  examples: [
    { inputs: [[5, 2, 8, 1]], output: 8 }
  ]
});

EOAtomicOperators.register({
  id: 'ARRAY_JOIN',
  name: 'Array Join',
  symbol: 'ARRAYJOIN',
  category: 'aggregate',
  description: 'Joins array values with separator',
  inputTypes: ['array', 'text'],
  outputType: 'text',
  arity: 2,
  properties: [],
  evaluate: (arr, separator = ', ') => {
    const values = EOAtomicOperators.coerce.toArray(arr);
    return values.map(v => EOAtomicOperators.coerce.toText(v)).filter(s => s.length > 0).join(separator);
  },
  format: (args) => `ARRAYJOIN(${args[0]}, "${args[1] || ', '}")`,
  examples: [
    { inputs: [['a', 'b', 'c'], ', '], output: 'a, b, c' }
  ]
});

EOAtomicOperators.register({
  id: 'UNIQUE',
  name: 'Unique',
  symbol: 'UNIQUE',
  category: 'aggregate',
  description: 'Returns unique values from array',
  inputTypes: ['array'],
  outputType: 'array',
  arity: 1,
  properties: ['idempotent'],
  evaluate: (arr) => {
    const values = EOAtomicOperators.coerce.toArray(arr);
    return [...new Set(values)];
  },
  format: (args) => `UNIQUE(${args[0]})`,
  examples: [
    { inputs: [[1, 2, 2, 3, 3, 3]], output: [1, 2, 3] }
  ]
});

EOAtomicOperators.register({
  id: 'FIRST',
  name: 'First',
  symbol: 'FIRST',
  category: 'aggregate',
  description: 'Returns first non-empty value',
  inputTypes: ['array'],
  outputType: 'any',
  arity: 1,
  properties: [],
  evaluate: (arr) => {
    const values = EOAtomicOperators.coerce.toArray(arr);
    return values.find(v => v !== null && v !== undefined && v !== '') ?? null;
  },
  format: (args) => `FIRST(${args[0]})`,
  examples: [
    { inputs: [[null, 'a', 'b']], output: 'a' }
  ]
});

EOAtomicOperators.register({
  id: 'LAST',
  name: 'Last',
  symbol: 'LAST',
  category: 'aggregate',
  description: 'Returns last non-empty value',
  inputTypes: ['array'],
  outputType: 'any',
  arity: 1,
  properties: [],
  evaluate: (arr) => {
    const values = EOAtomicOperators.coerce.toArray(arr);
    const filtered = values.filter(v => v !== null && v !== undefined && v !== '');
    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  },
  format: (args) => `LAST(${args[0]})`,
  examples: [
    { inputs: [['a', 'b', null]], output: 'b' }
  ]
});


// ===========================================
// REGISTER DATE OPERATORS
// ===========================================

EOAtomicOperators.register({
  id: 'TODAY',
  name: 'Today',
  symbol: 'TODAY',
  category: 'date',
  description: 'Returns current date',
  inputTypes: [],
  outputType: 'date',
  arity: 0,
  properties: [],
  evaluate: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  },
  format: () => 'TODAY()',
  examples: []
});

EOAtomicOperators.register({
  id: 'NOW',
  name: 'Now',
  symbol: 'NOW',
  category: 'date',
  description: 'Returns current date and time',
  inputTypes: [],
  outputType: 'date',
  arity: 0,
  properties: [],
  evaluate: () => new Date(),
  format: () => 'NOW()',
  examples: []
});

EOAtomicOperators.register({
  id: 'YEAR',
  name: 'Year',
  symbol: 'YEAR',
  category: 'date',
  description: 'Extracts year from date',
  inputTypes: ['date'],
  outputType: 'number',
  arity: 1,
  properties: [],
  evaluate: (date) => EOAtomicOperators.coerce.toDate(date).getFullYear(),
  format: (args) => `YEAR(${args[0]})`,
  examples: [
    { inputs: [new Date('2024-06-15')], output: 2024 }
  ]
});

EOAtomicOperators.register({
  id: 'MONTH',
  name: 'Month',
  symbol: 'MONTH',
  category: 'date',
  description: 'Extracts month from date (1-12)',
  inputTypes: ['date'],
  outputType: 'number',
  arity: 1,
  properties: [],
  evaluate: (date) => EOAtomicOperators.coerce.toDate(date).getMonth() + 1,
  format: (args) => `MONTH(${args[0]})`,
  examples: [
    { inputs: [new Date('2024-06-15')], output: 6 }
  ]
});

EOAtomicOperators.register({
  id: 'DAY',
  name: 'Day',
  symbol: 'DAY',
  category: 'date',
  description: 'Extracts day from date',
  inputTypes: ['date'],
  outputType: 'number',
  arity: 1,
  properties: [],
  evaluate: (date) => EOAtomicOperators.coerce.toDate(date).getDate(),
  format: (args) => `DAY(${args[0]})`,
  examples: [
    { inputs: [new Date('2024-06-15')], output: 15 }
  ]
});

EOAtomicOperators.register({
  id: 'DATEDIFF',
  name: 'Date Difference',
  symbol: 'DATEDIFF',
  category: 'date',
  description: 'Calculates difference between two dates',
  inputTypes: ['date', 'date', 'text'],
  outputType: 'number',
  arity: 3,
  properties: [],
  evaluate: (date1, date2, unit = 'days') => {
    const d1 = EOAtomicOperators.coerce.toDate(date1);
    const d2 = EOAtomicOperators.coerce.toDate(date2);
    const diff = d2 - d1;

    switch (String(unit).toLowerCase()) {
      case 'seconds': return Math.floor(diff / 1000);
      case 'minutes': return Math.floor(diff / (1000 * 60));
      case 'hours': return Math.floor(diff / (1000 * 60 * 60));
      case 'days': return Math.floor(diff / (1000 * 60 * 60 * 24));
      case 'weeks': return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
      case 'months': return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      case 'years': return d2.getFullYear() - d1.getFullYear();
      default: return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
  },
  format: (args) => `DATEDIFF(${args[0]}, ${args[1]}, "${args[2] || 'days'}")`,
  examples: []
});


// ===========================================
// REGISTER TYPE OPERATORS
// ===========================================

EOAtomicOperators.register({
  id: 'TO_NUMBER',
  name: 'To Number',
  symbol: 'VALUE',
  category: 'type',
  description: 'Converts value to number',
  inputTypes: ['any'],
  outputType: 'number',
  arity: 1,
  properties: [],
  evaluate: (a) => EOAtomicOperators.coerce.toNumber(a),
  format: (args) => `VALUE(${args[0]})`,
  examples: [
    { inputs: ['42'], output: 42 }
  ]
});

EOAtomicOperators.register({
  id: 'TO_TEXT',
  name: 'To Text',
  symbol: 'TEXT',
  category: 'type',
  description: 'Converts value to text',
  inputTypes: ['any'],
  outputType: 'text',
  arity: 1,
  properties: [],
  evaluate: (a) => EOAtomicOperators.coerce.toText(a),
  format: (args) => `TEXT(${args[0]})`,
  examples: [
    { inputs: [42], output: '42' }
  ]
});

EOAtomicOperators.register({
  id: 'ISBLANK',
  name: 'Is Blank',
  symbol: 'ISBLANK',
  category: 'type',
  description: 'Tests if value is blank/empty',
  inputTypes: ['any'],
  outputType: 'boolean',
  arity: 1,
  properties: [],
  evaluate: (a) => a === null || a === undefined || a === '',
  format: (args) => `ISBLANK(${args[0]})`,
  examples: [
    { inputs: [null], output: true },
    { inputs: ['hello'], output: false }
  ]
});

EOAtomicOperators.register({
  id: 'ISNUMBER',
  name: 'Is Number',
  symbol: 'ISNUMBER',
  category: 'type',
  description: 'Tests if value is a number',
  inputTypes: ['any'],
  outputType: 'boolean',
  arity: 1,
  properties: [],
  evaluate: (a) => typeof a === 'number' && !isNaN(a),
  format: (args) => `ISNUMBER(${args[0]})`,
  examples: [
    { inputs: [42], output: true },
    { inputs: ['hello'], output: false }
  ]
});


// Export for use in other modules
if (typeof window !== 'undefined') {
  window.EOAtomicOperators = EOAtomicOperators;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOAtomicOperators;
}
