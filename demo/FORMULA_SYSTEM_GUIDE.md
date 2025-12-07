# EO Formula System - Implementation Guide for AI Coders

## Overview

The EO formula system provides spreadsheet-style formulas with:
- **Atomic Operators**: Fundamental building blocks with type signatures and algebraic properties
- **Function Builder**: Compose custom functions from operators
- **Unified Rollup/Lookup**: Pull and aggregate data from linked records
- **Visual Editor**: UI for building functions with live testing

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Formula Bar      │  │ Function Builder │  │ Linked Fields    │  │
│  │ (text input)     │  │ (visual editor)  │  │ Modal            │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼────────────────────┼────────────────────┼──────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CORE ENGINES                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ EOFormulaEngine  │  │ EOFunctionBuilder│  │ EOCRollupEngine  │  │
│  │ (parse/evaluate) │  │ (compose funcs)  │  │ (link/rollup)    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼────────────────────┼────────────────────┼──────────────┘
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EOAtomicOperators                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│  │  ADD   │ │MULTIPLY│ │  SUM   │ │ CONCAT │ │ TODAY  │  ...       │
│  │  (+)   │ │  (*)   │ │        │ │  (&)   │ │        │            │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Atomic Operators (`eo_atomic_operators.js`)

### Concept

Every computation is built from atomic operators. Each operator has:
- **Type signature**: Input types → Output type
- **Algebraic properties**: Mathematical properties for optimization
- **Evaluation function**: The actual computation

### Operator Structure

```javascript
EOAtomicOperators.register({
  id: 'ADD',                        // Unique identifier
  name: 'Add',                      // Display name
  symbol: '+',                      // Symbol for formulas
  category: 'arithmetic',           // Grouping
  description: 'Adds two numbers',
  inputTypes: ['number', 'number'], // Required input types
  outputType: 'number',             // Result type
  arity: 2,                         // Number of arguments
  properties: ['associative', 'commutative', 'identity'],
  identity: 0,                      // x + 0 = x
  inverse: 'SUBTRACT',              // Related operator
  evaluate: (a, b) => a + b,        // Implementation
  format: (args) => `(${args[0]} + ${args[1]})`,  // Formula string
  examples: [{ inputs: [5, 3], output: 8 }]
});
```

### Algebraic Properties

| Property | Meaning | Example |
|----------|---------|---------|
| `associative` | `(a op b) op c = a op (b op c)` | `(1+2)+3 = 1+(2+3)` |
| `commutative` | `a op b = b op a` | `2*3 = 3*2` |
| `idempotent` | `a op a = a` | `MAX(5,5) = 5` |
| `involutory` | `op(op(a)) = a` | `NOT(NOT(true)) = true` |
| `identity` | Has element where `a op id = a` | `x * 1 = x` |
| `absorbing` | Has element where `a op abs = abs` | `x * 0 = 0` |

### Using Operators

```javascript
// Get an operator
const addOp = EOAtomicOperators.get('ADD');

// Evaluate directly
const result = addOp.evaluate(5, 3); // 8

// Execute with trace (for debugging/visualization)
const trace = EOAtomicOperators.executeWithTrace([
  { id: 'ADD', args: [{ ref: 0 }, { ref: 1 }] },    // Add inputs
  { id: 'MULTIPLY', args: [{ ref: 2 }, 2] }         // Multiply result by 2
], [5, 3]);
// trace.result = 16
// trace.trace = [step-by-step execution]
```

### Type Coercion

```javascript
// Automatic type coercion
EOAtomicOperators.coerce.toNumber('42')     // 42
EOAtomicOperators.coerce.toText(42)         // '42'
EOAtomicOperators.coerce.toBoolean(1)       // true
EOAtomicOperators.coerce.toDate('2024-01-01') // Date object
EOAtomicOperators.coerce.toArray('single')  // ['single']
```

### Available Operators by Category

**Arithmetic**: `ADD`, `SUBTRACT`, `MULTIPLY`, `DIVIDE`, `POWER`, `MODULO`, `NEGATE`, `ABS`, `SQRT`, `ROUND`, `FLOOR`, `CEIL`

**Comparison**: `EQUAL`, `NOT_EQUAL`, `LESS_THAN`, `GREATER_THAN`, `LESS_EQUAL`, `GREATER_EQUAL`

**Logical**: `AND`, `OR`, `NOT`, `IF`

**Text**: `CONCAT`, `UPPER`, `LOWER`, `TRIM`, `LEN`, `LEFT`, `RIGHT`, `MID`

**Aggregate**: `SUM`, `AVG`, `COUNT`, `MIN`, `MAX`, `ARRAY_JOIN`, `UNIQUE`, `FIRST`, `LAST`

**Date**: `TODAY`, `NOW`, `YEAR`, `MONTH`, `DAY`, `DATEDIFF`

**Type**: `TO_NUMBER`, `TO_TEXT`, `ISBLANK`, `ISNUMBER`

---

## 2. Function Builder (`eo_function_builder.js`)

### Concept

Users create custom functions by connecting operators in a directed acyclic graph (DAG).

### Function Definition Structure

```javascript
const myFunction = builder.createFunction({
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
    { fromNodeId: 'n1', toNodeId: 'n3', toPort: 0 },  // revenue -> subtract
    { fromNodeId: 'n2', toNodeId: 'n3', toPort: 1 },  // cost -> subtract
    { fromNodeId: 'n3', toNodeId: 'n4', toPort: 0 },  // (revenue-cost) -> divide
    { fromNodeId: 'n1', toNodeId: 'n4', toPort: 1 },  // revenue -> divide
    { fromNodeId: 'n4', toNodeId: 'n6', toPort: 0 },  // ratio -> multiply
    { fromNodeId: 'n5', toNodeId: 'n6', toPort: 1 }   // 100 -> multiply
  ]
});
```

### Node Types

| Type | Purpose | Properties |
|------|---------|------------|
| `input_ref` | Reference to function input | `inputId` |
| `operator` | Atomic operator | `operatorId` |
| `literal` | Constant value | `value`, `valueType` |

### Executing Functions

```javascript
// Create builder
const builder = new EOFunctionBuilder(EOAtomicOperators);

// Execute function
const result = builder.execute(myFunction, {
  revenue: 1000,
  cost: 700
});
// result = 30 (30% profit margin)

// Execute with trace
const { result, trace, success } = builder.executeWithTrace(myFunction, {
  revenue: 1000,
  cost: 700
});
// trace shows each step:
// 1. Input "Revenue": 1000
// 2. Input "Cost": 700
// 3. Subtract(1000, 700) = 300
// 4. Divide(300, 1000) = 0.3
// 5. Multiply(0.3, 100) = 30
```

### Code Generation

```javascript
// Generate formula string
const formula = builder.generateFormula(myFunction);
// "((({Revenue} - {Cost}) / {Revenue}) * 100)"

// Generate JavaScript code
const js = builder.generateJavaScript(myFunction);
// "function Profit_Margin(Revenue, Cost) {
//    return ((Revenue - Cost) / Revenue) * 100;
// }"
```

### Template Functions

```javascript
// List available templates
builder.getTemplates();
// [{ id: 'percentage', name: 'Percentage', ... }, ...]

// Create from template
const percentFunc = builder.createTemplate('percentage');
```

---

## 3. Unified Rollup System (`eo_rollup_engine.js`)

### Key Concept

**A lookup becomes a rollup when drawn from a multipick linked record.**

| Link Cardinality | Default Output | Can Aggregate? |
|------------------|----------------|----------------|
| `one` (single pick) | Single value | No (use formula instead) |
| `many` (multi pick) | Array | Yes |

### Output Modes

```javascript
// Single: For 1-to-1 links, returns first linked value
{ outputMode: 'single' }

// Array: Returns all linked values as array (DEFAULT for many)
{ outputMode: 'array' }

// Aggregated: Applies aggregation function
{ outputMode: 'aggregated', aggregation: 'sum' }
```

### Derived Field Configuration

```javascript
const derivedField = EOCRollupEngine.createDerivedFieldConfig({
  name: 'Total Order Value',
  sourceFieldId: 'orders_link',      // LINK_RECORD field
  targetSetId: 'orders',             // Linked set
  targetFieldId: 'amount',           // Field to pull
  outputMode: 'aggregated',          // or 'array', 'single'
  aggregation: 'sum'                 // SUM, AVG, COUNT, etc.
});
```

### Evaluating Derived Fields

```javascript
// Evaluate for a single record
const result = EOCRollupEngine.evaluate(
  derivedField,
  record,
  state
);

// result = {
//   value: 1500,
//   context: { method: 'aggregated', scale: 'collective', ... },
//   linkedCount: 5
// }

// Evaluate for all records
const allResults = EOCRollupEngine.evaluateAll(derivedField, sourceSet, state);

// Get statistics
const stats = EOCRollupEngine.getStatistics(derivedField, sourceSet, state);
// stats = {
//   totalRecords: 100,
//   recordsWithLinks: 85,
//   totalLinked: 342,
//   avgLinksPerRecord: 4.02,
//   distinctValues: 156
// }
```

### Aggregation Functions

| Function | Input Type | Output | Description |
|----------|------------|--------|-------------|
| `count` | Any | Number | Count of values |
| `sum` | Number | Number | Sum of values |
| `avg` | Number | Number | Average |
| `min` | Number/Date | Number/Date | Minimum value |
| `max` | Number/Date | Number/Date | Maximum value |
| `arrayjoin` | Text | Text | Comma-separated string |
| `unique` | Any | Text | Unique values joined |
| `first` | Any | Any | First non-empty value |
| `last` | Any | Any | Last non-empty value |

### EO Context Propagation

Each derived value includes EO context for provenance tracking:

```javascript
// Lookup (single)
{
  method: 'derived',
  scale: 'individual',
  source: {
    system: 'lookup',
    linkedVia: 'company_link',
    targetField: 'industry'
  }
}

// Rollup (array)
{
  method: 'derived',
  scale: 'collective',
  source: {
    system: 'rollup',
    output: 'array',
    arrayLength: 5
  }
}

// Rollup (aggregated)
{
  method: 'aggregated',
  scale: 'collective',
  source: {
    system: 'rollup',
    aggregation: 'sum',
    aggregatedFrom: 5
  }
}
```

---

## 4. Function Builder UI (`eo_function_builder_ui.js`)

### Initialization

```javascript
// Create container element
<div id="function-builder-container" style="height: 600px;"></div>

// Initialize UI
const ui = new EOFunctionBuilderUI('function-builder-container', {
  operators: EOAtomicOperators,
  builder: new EOFunctionBuilder(EOAtomicOperators)
});
```

### UI Components

1. **Operator Palette** (left): Drag operators onto canvas
2. **Canvas** (center): Visual node editor
3. **Properties Panel** (right): Configure selected node
4. **Test Panel** (bottom): Enter test data, run tests, see execution trace

### Programmatic Control

```javascript
// Load a template
ui.loadTemplate('percentage');

// Create new function
ui.createNewFunction();

// Run test with data
ui.testData = { value: 50, total: 200 };
ui.runTest();

// Export function
ui.exportFunction(); // Downloads JSON file

// Save function (registers with builder)
ui.saveFunction();
```

---

## 5. Integration Examples

### Adding a Formula Field to a View

```javascript
// 1. Register the formula
const formulaField = new EOFormulaField(new EOFormulaEngine());
formulaField.registerFormulaField('TotalWithTax', {
  formula: '{Total} * 1.1',
  displayFormat: 'currency',
  decimals: 2
});

// 2. Calculate for a record
const result = formulaField.calculateFormulaValue('TotalWithTax', record);
// result.value = 110.00
// result.formattedValue = '$110.00'
// result.context = { method: 'derived', ... }
```

### Adding a Derived Field (Lookup/Rollup)

```javascript
// 1. Create derived field config
const orderTotals = EOCRollupEngine.createDerivedFieldConfig({
  name: 'Order Totals',
  sourceFieldId: 'customer_orders',
  targetSetId: 'orders',
  targetFieldId: 'total',
  outputMode: 'aggregated',
  aggregation: 'sum'
});

// 2. Add to view
view.derivedFields = view.derivedFields || [];
view.derivedFields.push(orderTotals);

// 3. Evaluate when rendering
const value = EOCRollupEngine.evaluate(orderTotals, record, state);
```

### Creating a Custom Function

```javascript
// 1. Create via builder
const builder = new EOFunctionBuilder(EOAtomicOperators);
const taxCalc = builder.createFunction({
  id: 'tax_calc',
  name: 'Calculate Tax',
  inputs: [
    { id: 'amount', name: 'Amount', type: 'number' },
    { id: 'rate', name: 'Tax Rate', type: 'number' }
  ],
  nodes: [
    { id: 'n1', type: 'input_ref', inputId: 'amount' },
    { id: 'n2', type: 'input_ref', inputId: 'rate' },
    { id: 'n3', type: 'operator', operatorId: 'MULTIPLY', isOutput: true }
  ],
  connections: [
    { fromNodeId: 'n1', toNodeId: 'n3', toPort: 0 },
    { fromNodeId: 'n2', toNodeId: 'n3', toPort: 1 }
  ]
});

// 2. Register for use
builder.registerFunction(taxCalc);

// 3. Use in formulas (after integrating with EOFormulaEngine)
const customFuncs = builder.getAllFunctions();
```

---

## 6. Enabling User-Created Functions

Users can create their own functions through the visual Function Builder UI:

### Step 1: Open Function Builder
```javascript
// Show modal with function builder
const modal = document.createElement('div');
modal.innerHTML = '<div id="fb-container" style="width:1000px;height:600px;"></div>';
document.body.appendChild(modal);

const ui = new EOFunctionBuilderUI('fb-container');
```

### Step 2: Build Function Visually
1. Name the function
2. Add inputs (parameters)
3. Drag operators from palette
4. Connect nodes to create data flow
5. Double-click node to set as output

### Step 3: Test with Sample Data
1. Enter test values in Test Panel
2. Click "Run Test"
3. View result and execution trace
4. Trace shows step-by-step computation

### Step 4: Save and Use
```javascript
// Save function (registers with builder)
ui.saveFunction();

// Get all custom functions
const funcs = builder.getAllFunctions();

// Use in code
const func = builder.getFunction('my_custom_func');
const result = func.evaluator(arg1, arg2);
```

---

## 7. Best Practices

### For AI Coders Implementing New Operators

```javascript
// 1. Always include type information
inputTypes: ['number', 'number'],  // Be specific
outputType: 'number',

// 2. Document algebraic properties
properties: ['associative', 'commutative'],

// 3. Provide examples for testing
examples: [
  { inputs: [5, 3], output: 8 },
  { inputs: [-2, 7], output: 5 }
]

// 4. Handle edge cases in evaluate
evaluate: (a, b) => {
  const numA = EOAtomicOperators.coerce.toNumber(a);
  const numB = EOAtomicOperators.coerce.toNumber(b);
  if (numB === 0) throw new Error('Division by zero');
  return numA / numB;
}
```

### For Formula Validation

```javascript
// Validate before registering
const validation = builder.validate(func);
if (!validation.valid) {
  console.error('Errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}

// Check for circular dependencies
if (builder.wouldCreateCycle(func, fromNode, toNode)) {
  alert('This connection would create a cycle!');
}
```

### For Performance

```javascript
// Batch evaluate for all records
const results = EOCRollupEngine.evaluateAll(config, set, state);

// Cache formula AST
const parseResult = engine.parse(formula);
// Store parseResult.ast for repeated evaluation

// Use topological sort for dependent formulas
const order = formulaField.getCalculationOrder();
```

---

## File Reference

| File | Purpose |
|------|---------|
| `eo_atomic_operators.js` | Core operator definitions |
| `eo_function_builder.js` | Function composition engine |
| `eo_function_builder_ui.js` | Visual editor UI |
| `eo_formula_engine.js` | Formula parsing and evaluation |
| `eo_formula_field.js` | Formula field management |
| `eo_rollup_engine.js` | Unified lookup/rollup system |
| `eo_linked_fields_modal.js` | UI for adding linked fields |

---

## Quick Reference: Operator Chaining Rules

```
┌─────────────────────────────────────────────────────────────┐
│                    CHAINING RULES                           │
├─────────────────────────────────────────────────────────────┤
│ Output Type  →  Can Connect To                              │
├─────────────────────────────────────────────────────────────┤
│ number       →  number, text, boolean, any                  │
│ text         →  text, number (via coercion), any            │
│ boolean      →  boolean, number, text, any                  │
│ date         →  date, number (timestamp), text, any         │
│ array        →  array, aggregate operators, any             │
│ any          →  any                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  NESTING EXAMPLE                            │
├─────────────────────────────────────────────────────────────┤
│ SUM(                                                        │
│   MULTIPLY({Price}, {Quantity}),  ← Returns number          │
│   IF(                                                       │
│     {HasDiscount},                ← Returns boolean         │
│     NEGATE({Discount}),           ← Returns number          │
│     0                             ← Literal number          │
│   )                               ← Returns number          │
│ )                                 ← Returns number          │
└─────────────────────────────────────────────────────────────┘
```
