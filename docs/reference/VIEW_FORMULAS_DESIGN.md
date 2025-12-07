# View-Specific Formula System Design

## Overview

This design document outlines a system for adding **view-specific formulas** to fields, where the formula calculation is context-dependent on the view that displays it. This enables different views to show different calculated values for the same logical "field" based on the view's filters, aggregations, and context.

---

## Core Concepts

### 1. View-Scoped Formula Fields

Unlike traditional spreadsheet formulas which exist at the record level, **view-scoped formulas** exist at the view level and can:

- **Reference filtered data**: Only operate on records visible in the current view
- **Aggregate across records**: Calculate sums, averages, counts of filtered records
- **Apply view-specific context**: Inherit timeframe, scale, and method from view configuration
- **Handle superposition**: Different views may show different values from SUP cells

### 2. Two Types of Formula Fields

#### A. **Record-Level Formulas** (Row Formulas)
Calculated per record, can be shown in any view:
- `{Revenue} * 1.2` - markup calculation
- `{Price} * {Quantity}` - line total
- `IF({Status} = "Active", {Budget}, 0)` - conditional value

#### B. **View-Level Formulas** (Aggregate Formulas)
Calculated across all filtered records in the view:
- `SUM({Revenue})` - total of visible records
- `AVG({Salary})` - average of filtered employees
- `COUNT()` - number of records in view

---

## Architecture Design

### 1. Data Model Extensions

#### View Schema Extension
```javascript
// View object extension
{
  id: "view_1234",
  setId: "set_1234",
  name: "Q1 Revenue View",
  type: "grid",

  // Existing properties...
  filters: [...],
  sorts: [...],
  columnOrder: [...],

  // NEW: View-specific formula fields
  formulaFields: [
    {
      id: "vformula_1234_abc",      // Unique ID for this view formula
      viewId: "view_1234",           // Parent view
      name: "Profit Margin",         // Display name
      type: "FORMULA",               // Field type
      formulaType: "RECORD",         // RECORD | VIEW_AGGREGATE

      // Formula definition
      formula: "({Revenue} - {Cost}) / {Revenue} * 100",

      // Display configuration
      displayConfig: {
        format: "percentage",        // number | currency | percentage | text | date
        decimals: 2,
        width: "120px",
        icon: "ph-percent"
      },

      // Dependencies (auto-detected from formula)
      dependencies: ["revenue", "cost"],

      // Context inference rules
      contextRules: {
        method: "derived",           // Always "derived" for formulas
        inheritScale: true,          // Inherit scale from dependencies
        inheritTimeframe: true,      // Inherit timeframe from dependencies
        definitionPattern: "profit_margin_calculated"
      },

      // Caching
      cache: {
        enabled: true,
        lastCalculated: timestamp,
        invalidateOn: ["revenue", "cost"]  // Field changes that invalidate cache
      },

      // Metadata
      createdAt: timestamp,
      createdBy: "user_1"
    }
  ],

  // NEW: View-level calculations (aggregates)
  viewCalculations: [
    {
      id: "vcalc_1234_xyz",
      viewId: "view_1234",
      name: "Total Revenue",
      type: "AGGREGATE",

      formula: "SUM({Revenue})",
      aggregateFunction: "SUM",      // SUM | AVG | COUNT | MIN | MAX | MEDIAN
      targetField: "revenue",

      displayPosition: "footer",     // footer | header | sidebar
      displayConfig: {
        format: "currency",
        decimals: 2
      },

      // Context for aggregate
      contextRules: {
        method: "aggregated",        // Always "aggregated" for view calculations
        scale: "team",               // Defined by view
        definition: "total_revenue_view"
      }
    }
  ]
}
```

#### Formula Field Type
```javascript
// Add to FIELD_TYPES constant
FIELD_TYPES.FORMULA = {
  id: 'FORMULA',
  name: 'Formula',
  defaultValue: null,
  icon: 'ph-function',
  needsConfig: true,
  configOptions: {
    formulaType: ['RECORD', 'VIEW_AGGREGATE'],
    returnType: ['NUMBER', 'TEXT', 'CURRENCY', 'DATE', 'BOOLEAN']
  }
};
```

---

### 2. Formula Syntax & Parsing

#### Basic Syntax (Spreadsheet-Style)

**Field References:**
```
{FieldName}              // Reference to field in same record
{FieldName@RecordId}     // Reference to specific record (advanced)
```

**Operators:**
```
+ - * /                  // Arithmetic
= <> > < >= <=          // Comparison
& |                      // Logical AND/OR
```

**Functions (Record-Level):**
```javascript
// Mathematical
SUM(value1, value2, ...)
AVG(value1, value2, ...)
MIN(value1, value2, ...)
MAX(value1, value2, ...)
ROUND(value, decimals)
ABS(value)

// Logical
IF(condition, valueIfTrue, valueIfFalse)
AND(condition1, condition2, ...)
OR(condition1, condition2, ...)
NOT(condition)

// Text
CONCAT(text1, text2, ...)
UPPER(text)
LOWER(text)
TRIM(text)
LEN(text)

// Date
TODAY()
NOW()
YEAR(date)
MONTH(date)
DAY(date)
DATEDIFF(date1, date2, unit)

// Conversion
NUMBER(value)
TEXT(value)
```

**Functions (View-Level Aggregates):**
```javascript
// Aggregation (operates on filtered records)
SUM({FieldName})         // Sum across all visible records
AVG({FieldName})         // Average across visible records
COUNT()                  // Count visible records
COUNT({FieldName})       // Count non-empty values
MIN({FieldName})         // Minimum value
MAX({FieldName})         // Maximum value
MEDIAN({FieldName})      // Median value

// Conditional aggregation
SUMIF({FieldName}, condition)
COUNTIF({FieldName}, condition)
AVGIF({FieldName}, condition)
```

#### Example Formulas

**Record-Level:**
```javascript
// Simple calculation
{Price} * {Quantity}

// Conditional logic
IF({Status} = "Active", {Budget}, 0)

// Multiple conditions
IF(AND({Revenue} > 100000, {Status} = "Active"), "High Value", "Standard")

// Text manipulation
CONCAT({FirstName}, " ", {LastName})

// Date calculations
DATEDIFF(TODAY(), {StartDate}, "days")

// Percentage
({Revenue} - {Cost}) / {Revenue} * 100
```

**View-Level:**
```javascript
// Total across view
SUM({Revenue})

// Average of filtered records
AVG({Salary})

// Conditional count
COUNTIF({Status}, "Active")

// Percentage of total
SUM({Revenue}) / SUM({Budget}) * 100
```

---

### 3. Formula Parser Implementation

```javascript
class FormulaParser {
  constructor() {
    this.functions = new Map();
    this.registerStandardFunctions();
  }

  /**
   * Parse formula string into AST (Abstract Syntax Tree)
   */
  parse(formulaString) {
    // Tokenize
    const tokens = this.tokenize(formulaString);

    // Build AST
    const ast = this.buildAST(tokens);

    // Extract dependencies
    const dependencies = this.extractDependencies(ast);

    return {
      ast,
      dependencies,
      formulaType: this.detectFormulaType(ast)
    };
  }

  /**
   * Tokenize formula into components
   */
  tokenize(formula) {
    const tokens = [];
    let current = 0;

    while (current < formula.length) {
      let char = formula[current];

      // Field reference: {FieldName}
      if (char === '{') {
        let value = '';
        char = formula[++current];
        while (char !== '}') {
          value += char;
          char = formula[++current];
        }
        tokens.push({ type: 'FIELD_REF', value });
        current++;
        continue;
      }

      // Number
      if (/[0-9]/.test(char)) {
        let value = '';
        while (/[0-9.]/.test(char)) {
          value += char;
          char = formula[++current];
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(value) });
        continue;
      }

      // String
      if (char === '"') {
        let value = '';
        char = formula[++current];
        while (char !== '"') {
          value += char;
          char = formula[++current];
        }
        tokens.push({ type: 'STRING', value });
        current++;
        continue;
      }

      // Function
      if (/[A-Z]/.test(char)) {
        let value = '';
        while (/[A-Z]/.test(char)) {
          value += char;
          char = formula[++current];
        }
        tokens.push({ type: 'FUNCTION', value });
        continue;
      }

      // Operators
      if ('+-*/=<>(),.'.includes(char)) {
        tokens.push({ type: 'OPERATOR', value: char });
        current++;
        continue;
      }

      // Whitespace
      if (/\s/.test(char)) {
        current++;
        continue;
      }

      throw new Error(`Unexpected character: ${char}`);
    }

    return tokens;
  }

  /**
   * Build Abstract Syntax Tree
   */
  buildAST(tokens) {
    // Simplified recursive descent parser
    // Returns tree structure like:
    // {
    //   type: 'BINARY_OP',
    //   operator: '*',
    //   left: { type: 'FIELD_REF', field: 'Price' },
    //   right: { type: 'FIELD_REF', field: 'Quantity' }
    // }

    // Implementation details omitted for brevity
    // Use standard expression parsing with precedence
  }

  /**
   * Extract field dependencies from AST
   */
  extractDependencies(ast) {
    const dependencies = new Set();

    const traverse = (node) => {
      if (node.type === 'FIELD_REF') {
        dependencies.add(node.field);
      }
      if (node.left) traverse(node.left);
      if (node.right) traverse(node.right);
      if (node.args) node.args.forEach(traverse);
    };

    traverse(ast);
    return Array.from(dependencies);
  }

  /**
   * Detect if formula is record-level or view-level
   */
  detectFormulaType(ast) {
    const aggregateFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'MEDIAN', 'SUMIF', 'COUNTIF', 'AVGIF'];

    const hasAggregate = (node) => {
      if (node.type === 'FUNCTION' && aggregateFunctions.includes(node.name)) {
        return true;
      }
      if (node.left && hasAggregate(node.left)) return true;
      if (node.right && hasAggregate(node.right)) return true;
      if (node.args && node.args.some(hasAggregate)) return true;
      return false;
    };

    return hasAggregate(ast) ? 'VIEW_AGGREGATE' : 'RECORD';
  }
}
```

---

### 4. Formula Evaluation Engine

```javascript
class FormulaEvaluator {
  constructor(state) {
    this.state = state;
    this.parser = new FormulaParser();
    this.cache = new Map();
  }

  /**
   * Evaluate a record-level formula for a specific record
   */
  evaluateRecordFormula(formula, record, view, set) {
    const { ast, dependencies } = this.parser.parse(formula);

    // Build context with field values
    const context = this.buildRecordContext(record, set, dependencies);

    // Evaluate AST
    const result = this.evaluateAST(ast, context, view);

    // Infer context metadata
    const resultContext = this.inferFormulaContext(
      dependencies,
      record,
      set,
      view,
      'derived'
    );

    return {
      value: result,
      context: resultContext
    };
  }

  /**
   * Evaluate a view-level aggregate formula
   */
  evaluateViewFormula(formula, view, set) {
    const { ast } = this.parser.parse(formula);

    // Get filtered records from view
    const filteredRecords = this.getFilteredRecords(view, set);

    // Build context with all records
    const context = {
      records: filteredRecords,
      set: set
    };

    // Evaluate AST
    const result = this.evaluateAST(ast, context, view);

    // Create aggregate context
    const resultContext = {
      method: 'aggregated',
      scale: view.aggregateScale || 'team',
      definition: `${formula}_view_${view.id}`,
      timeframe: this.inferTimeframeFromView(view),
      source: {
        system: 'formula',
        formula: formula
      },
      agent: {
        type: 'system',
        id: 'formula_engine'
      }
    };

    return {
      value: result,
      context: resultContext
    };
  }

  /**
   * Evaluate AST node recursively
   */
  evaluateAST(node, context, view) {
    switch (node.type) {
      case 'NUMBER':
        return node.value;

      case 'STRING':
        return node.value;

      case 'FIELD_REF':
        return this.resolveFieldRef(node.field, context);

      case 'BINARY_OP':
        const left = this.evaluateAST(node.left, context, view);
        const right = this.evaluateAST(node.right, context, view);
        return this.applyOperator(node.operator, left, right);

      case 'FUNCTION':
        return this.evaluateFunction(node.name, node.args, context, view);

      default:
        throw new Error(`Unknown AST node type: ${node.type}`);
    }
  }

  /**
   * Resolve field reference
   */
  resolveFieldRef(fieldName, context) {
    // For record context
    if (context.record) {
      const fieldId = this.findFieldId(fieldName, context.set);
      const value = context.record[fieldId];

      // Handle superposition - use dominant value
      if (this.hasSuperposition(context.record, fieldId)) {
        return this.getDominantValue(context.record, fieldId);
      }

      return value;
    }

    // For view context (shouldn't happen for field refs)
    throw new Error(`Cannot reference field ${fieldName} in view-level formula`);
  }

  /**
   * Evaluate function call
   */
  evaluateFunction(name, args, context, view) {
    // Record-level functions
    if (name === 'IF') {
      const condition = this.evaluateAST(args[0], context, view);
      return condition ?
        this.evaluateAST(args[1], context, view) :
        this.evaluateAST(args[2], context, view);
    }

    if (name === 'CONCAT') {
      return args.map(arg => this.evaluateAST(arg, context, view)).join('');
    }

    if (name === 'ROUND') {
      const value = this.evaluateAST(args[0], context, view);
      const decimals = this.evaluateAST(args[1], context, view);
      return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    // View-level aggregate functions
    if (name === 'SUM') {
      const fieldName = args[0].field;
      const fieldId = this.findFieldId(fieldName, context.set);
      return context.records.reduce((sum, record) => {
        return sum + (parseFloat(record[fieldId]) || 0);
      }, 0);
    }

    if (name === 'AVG') {
      const sumResult = this.evaluateFunction('SUM', args, context, view);
      return sumResult / context.records.length;
    }

    if (name === 'COUNT') {
      if (args.length === 0) {
        return context.records.length;
      }
      const fieldName = args[0].field;
      const fieldId = this.findFieldId(fieldName, context.set);
      return context.records.filter(r => r[fieldId] != null && r[fieldId] !== '').length;
    }

    // Add more functions as needed
    throw new Error(`Unknown function: ${name}`);
  }

  /**
   * Get filtered records from view
   */
  getFilteredRecords(view, set) {
    let records = Array.from(set.records.values());

    // Apply filters
    if (view.filters && view.filters.length > 0) {
      records = applyFilterGroups(records, view.filters, set.schema);
    }

    return records;
  }

  /**
   * Infer context metadata for formula result
   */
  inferFormulaContext(dependencies, record, set, view, method) {
    // Get contexts of all dependency fields
    const depContexts = dependencies.map(fieldId => {
      return this.getFieldContext(record, fieldId);
    });

    // Merge contexts
    return {
      method: method,
      scale: this.inferScale(depContexts),
      definition: this.inferDefinition(dependencies),
      timeframe: this.mergeTimeframes(depContexts),
      source: {
        system: 'formula',
        dependencies: dependencies
      },
      agent: {
        type: 'system',
        id: 'formula_engine'
      }
    };
  }
}
```

---

### 5. Dependency Tracking & Auto-Recalculation

```javascript
class FormulaDependencyGraph {
  constructor() {
    this.dependencies = new Map();  // formulaId -> [fieldIds]
    this.dependents = new Map();    // fieldId -> [formulaIds]
  }

  /**
   * Register a formula and its dependencies
   */
  registerFormula(formulaId, dependencies) {
    this.dependencies.set(formulaId, dependencies);

    // Build reverse map
    dependencies.forEach(fieldId => {
      if (!this.dependents.has(fieldId)) {
        this.dependents.set(fieldId, []);
      }
      this.dependents.get(fieldId).push(formulaId);
    });
  }

  /**
   * Get formulas that depend on a field
   */
  getAffectedFormulas(fieldId) {
    return this.dependents.get(fieldId) || [];
  }

  /**
   * Get topologically sorted formulas (for cascading updates)
   */
  getCalculationOrder(affectedFormulas) {
    // Topological sort to handle A depends on B depends on C
    const sorted = [];
    const visited = new Set();

    const visit = (formulaId) => {
      if (visited.has(formulaId)) return;
      visited.add(formulaId);

      // Visit dependencies first
      const deps = this.dependencies.get(formulaId) || [];
      deps.forEach(depFieldId => {
        const depFormulas = this.dependents.get(depFieldId) || [];
        depFormulas.forEach(visit);
      });

      sorted.push(formulaId);
    };

    affectedFormulas.forEach(visit);
    return sorted;
  }

  /**
   * Detect circular dependencies
   */
  detectCircular(formulaId, dependencies) {
    const visited = new Set();

    const visit = (fieldId, path) => {
      if (path.includes(fieldId)) {
        throw new Error(`Circular dependency detected: ${path.join(' -> ')} -> ${fieldId}`);
      }

      const formulas = this.dependents.get(fieldId) || [];
      formulas.forEach(fId => {
        const deps = this.dependencies.get(fId) || [];
        deps.forEach(depFieldId => {
          visit(depFieldId, [...path, fieldId]);
        });
      });
    };

    dependencies.forEach(fieldId => visit(fieldId, [formulaId]));
  }
}
```

---

### 6. Context Integration

#### Context Inference for Formulas

```javascript
class FormulaContextEngine {
  /**
   * Infer context for a formula result
   */
  inferContext(formula, dependencies, record, set, view) {
    // Always "derived" for formulas
    const method = 'derived';

    // Scale: inherit from highest scale in dependencies
    const scale = this.inferScale(dependencies, record);

    // Definition: generate from formula pattern
    const definition = this.generateDefinition(formula, dependencies);

    // Timeframe: union of dependency timeframes
    const timeframe = this.mergeTimeframes(dependencies, record);

    // Source: formula engine
    const source = {
      system: 'formula',
      formula: formula,
      dependencies: dependencies
    };

    // Agent: system
    const agent = {
      type: 'system',
      id: 'formula_engine'
    };

    return {
      method,
      scale,
      definition,
      timeframe,
      source,
      agent
    };
  }

  /**
   * Infer scale from dependencies
   */
  inferScale(dependencies, record) {
    const scaleHierarchy = ['individual', 'team', 'department', 'organization'];

    let maxScale = 'individual';
    dependencies.forEach(fieldId => {
      const fieldContext = this.getFieldContext(record, fieldId);
      if (fieldContext && fieldContext.scale) {
        const currentIndex = scaleHierarchy.indexOf(maxScale);
        const fieldIndex = scaleHierarchy.indexOf(fieldContext.scale);
        if (fieldIndex > currentIndex) {
          maxScale = fieldContext.scale;
        }
      }
    });

    return maxScale;
  }

  /**
   * Generate definition from formula
   */
  generateDefinition(formula, dependencies) {
    // Simple pattern matching
    if (formula.includes('/') && formula.includes('*') && formula.includes('100')) {
      return 'percentage_calculation';
    }
    if (formula.includes('SUM')) {
      return 'sum_aggregation';
    }
    if (formula.includes('AVG')) {
      return 'average_aggregation';
    }

    // Default: formula hash
    return `formula_${this.hashFormula(formula)}`;
  }

  /**
   * Merge timeframes from dependencies
   */
  mergeTimeframes(dependencies, record) {
    let minStart = null;
    let maxEnd = null;
    let granularity = 'instant';

    dependencies.forEach(fieldId => {
      const fieldContext = this.getFieldContext(record, fieldId);
      if (fieldContext && fieldContext.timeframe) {
        const tf = fieldContext.timeframe;

        if (!minStart || tf.start < minStart) minStart = tf.start;
        if (!maxEnd || tf.end > maxEnd) maxEnd = tf.end;

        // Use coarsest granularity
        const granularityOrder = ['instant', 'day', 'week', 'month', 'quarter', 'year'];
        if (granularityOrder.indexOf(tf.granularity) > granularityOrder.indexOf(granularity)) {
          granularity = tf.granularity;
        }
      }
    });

    return minStart ? {
      granularity,
      start: minStart,
      end: maxEnd
    } : null;
  }
}
```

#### Handling Superposition in Formulas

```javascript
class FormulaSupHandler {
  /**
   * Handle superposition in formula inputs
   */
  handleSupInFormula(formula, record, set, view) {
    const { dependencies } = this.parser.parse(formula);

    // Check if any dependencies have SUP
    const supDependencies = dependencies.filter(fieldId =>
      this.hasSuperposition(record, fieldId)
    );

    if (supDependencies.length === 0) {
      // No SUP, evaluate normally
      return this.evaluator.evaluateRecordFormula(formula, record, view, set);
    }

    // Strategy 1: Use dominant values
    // (Simplest - use the "dominant" value from SUP based on view context)
    const result = this.evaluator.evaluateRecordFormula(formula, record, view, set);

    // Strategy 2: Create SUP from all combinations
    // (Advanced - generate all possible formula results from SUP combinations)
    // const results = this.generateSupResults(formula, record, supDependencies, view, set);

    return result;
  }

  /**
   * Generate all possible formula results from SUP combinations
   */
  generateSupResults(formula, record, supDependencies, view, set) {
    // Get all value combinations
    const combinations = this.getValueCombinations(record, supDependencies);

    // Evaluate formula for each combination
    const results = combinations.map(combo => {
      const tempRecord = { ...record, ...combo };
      return this.evaluator.evaluateRecordFormula(formula, tempRecord, view, set);
    });

    // Return as SUP if multiple distinct results
    if (new Set(results.map(r => r.value)).size > 1) {
      return {
        type: 'SUP',
        values: results
      };
    }

    // Return single value if all same
    return results[0];
  }
}
```

---

### 7. UI Integration

#### Formula Field Editor Component

```javascript
function FormulaFieldEditor({ view, field, onSave, onCancel }) {
  const [formula, setFormula] = useState(field?.formula || '');
  const [name, setName] = useState(field?.name || '');
  const [formulaType, setFormulaType] = useState(field?.formulaType || 'RECORD');
  const [format, setFormat] = useState(field?.displayConfig?.format || 'number');
  const [parseError, setParseError] = useState(null);
  const [dependencies, setDependencies] = useState([]);

  // Parse and validate formula on change
  useEffect(() => {
    try {
      const parser = new FormulaParser();
      const result = parser.parse(formula);
      setDependencies(result.dependencies);
      setParseError(null);
    } catch (error) {
      setParseError(error.message);
    }
  }, [formula]);

  return html`
    <div class="formula-editor">
      <h3>Formula Field Configuration</h3>

      <div class="form-group">
        <label>Field Name</label>
        <input
          type="text"
          value=${name}
          onChange=${e => setName(e.target.value)}
          placeholder="e.g., Profit Margin"
        />
      </div>

      <div class="form-group">
        <label>Formula Type</label>
        <select value=${formulaType} onChange=${e => setFormulaType(e.target.value)}>
          <option value="RECORD">Record-Level (per row)</option>
          <option value="VIEW_AGGREGATE">View-Level (aggregate)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Formula</label>
        <textarea
          value=${formula}
          onChange=${e => setFormula(e.target.value)}
          placeholder=${formulaType === 'RECORD'
            ? 'e.g., {Revenue} - {Cost}'
            : 'e.g., SUM({Revenue})'
          }
          rows="4"
        />
        ${parseError && html`
          <div class="error">${parseError}</div>
        `}
      </div>

      ${dependencies.length > 0 && html`
        <div class="dependencies">
          <label>Dependencies</label>
          <div class="dep-list">
            ${dependencies.map(dep => html`
              <span class="dep-badge">{${dep}}</span>
            `)}
          </div>
        </div>
      `}

      <div class="form-group">
        <label>Display Format</label>
        <select value=${format} onChange=${e => setFormat(e.target.value)}>
          <option value="number">Number</option>
          <option value="currency">Currency</option>
          <option value="percentage">Percentage</option>
          <option value="text">Text</option>
          <option value="date">Date</option>
        </select>
      </div>

      <div class="actions">
        <button onClick=${onCancel}>Cancel</button>
        <button onClick=${() => onSave({ name, formula, formulaType, format })}
                disabled=${!!parseError || !name || !formula}>
          Save Formula
        </button>
      </div>
    </div>
  `;
}
```

#### Formula Cell Rendering

```javascript
function renderFormulaCell(formulaField, record, view, set) {
  // Evaluate formula
  const evaluator = new FormulaEvaluator(state);
  const result = evaluator.evaluateRecordFormula(
    formulaField.formula,
    record,
    view,
    set
  );

  // Format value
  const formatted = formatFormulaValue(
    result.value,
    formulaField.displayConfig
  );

  // Render with context indicator
  return html`
    <div class="formula-cell" data-context-method=${result.context.method}>
      <span class="value">${formatted}</span>
      ${result.context && html`
        <i class="context-indicator ph-function"
           title="Derived: ${result.context.definition}">
        </i>
      `}
    </div>
  `;
}

function formatFormulaValue(value, config) {
  if (value == null) return '';

  switch (config.format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: config.decimals || 2
      }).format(value);

    case 'percentage':
      return `${value.toFixed(config.decimals || 2)}%`;

    case 'number':
      return value.toFixed(config.decimals || 2);

    case 'text':
      return String(value);

    case 'date':
      return new Date(value).toLocaleDateString();

    default:
      return String(value);
  }
}
```

---

### 8. Event Stream Integration

```javascript
/**
 * Record formula creation in event stream
 */
function recordFormulaEvent(view, formulaField, operator = 'DES') {
  const event = {
    id: Date.now(),
    timestamp: Date.now(),
    operator: operator,  // DES for definition
    object: {
      type: 'FormulaField',
      id: formulaField.id,
      viewId: view.id
    },
    data: {
      viewId: view.id,
      formulaField: formulaField,
      summary: `${operator === 'DES' ? 'Created' : 'Updated'} formula field "${formulaField.name}" in view "${view.name}"`
    },
    agent: {
      type: 'person',
      id: state.currentUser?.id || 'user_1',
      name: state.currentUser?.name || 'User'
    }
  };

  state.eventStream.push(event);
}

/**
 * Record formula calculation event (optional, for audit)
 */
function recordCalculationEvent(record, formulaField, result) {
  const event = {
    id: Date.now(),
    timestamp: Date.now(),
    operator: 'REC',  // REC for recalculation
    object: {
      type: 'Record',
      id: record.id
    },
    data: {
      recordId: record.id,
      formulaFieldId: formulaField.id,
      result: result.value,
      context: result.context,
      summary: `Recalculated formula "${formulaField.name}" = ${result.value}`
    },
    agent: {
      type: 'system',
      id: 'formula_engine'
    }
  };

  state.eventStream.push(event);
}
```

---

## Implementation Phases

### Phase 1: Basic Record-Level Formulas
**Goal:** Simple spreadsheet-style formulas per record

- [ ] Add FORMULA field type
- [ ] Implement basic formula parser (tokenizer + AST)
- [ ] Implement formula evaluator for arithmetic & field references
- [ ] Add formula field to view schema
- [ ] Create formula editor UI
- [ ] Render formula cells in grid view
- [ ] Basic functions: `+, -, *, /, IF, CONCAT`

**Example:** `{Price} * {Quantity}` → Shows calculated line total per row

---

### Phase 2: Dependency Tracking & Auto-Recalc
**Goal:** Automatic recalculation when dependencies change

- [ ] Build dependency graph
- [ ] Detect circular dependencies
- [ ] Auto-recalculate on field updates
- [ ] Cache formula results
- [ ] Invalidate cache on dependency changes
- [ ] Topological sort for cascading updates

**Example:** Changing `Price` auto-updates `{Price} * {Quantity}`

---

### Phase 3: View-Level Aggregates
**Goal:** Aggregate functions across filtered records

- [ ] Add view-level calculation schema
- [ ] Implement aggregate functions: `SUM, AVG, COUNT, MIN, MAX`
- [ ] Filter-aware aggregation
- [ ] Display aggregates in footer/header
- [ ] Conditional aggregates: `SUMIF, COUNTIF`

**Example:** `SUM({Revenue})` → Shows total of visible records in view footer

---

### Phase 4: Context Integration
**Goal:** Full EO context support for formulas

- [ ] Context inference for derived values
- [ ] Lean context templates for formulas
- [ ] Context propagation from dependencies
- [ ] Superposition handling (dominant value strategy)
- [ ] Event stream integration
- [ ] Context display in formula cells

**Example:** Formula inherits timeframe/scale from input fields

---

### Phase 5: Advanced Features
**Goal:** Power-user features

- [ ] Cross-record references: `{Revenue@rec_123}`
- [ ] Linked record aggregation: `SUM({LinkedProjects.Revenue})`
- [ ] Advanced functions: date math, text manipulation, lookups
- [ ] Formula templates library
- [ ] Performance optimization (virtual scrolling, lazy eval)
- [ ] Export formulas in CSV/API

**Example:** `SUM({Projects->Revenue} WHERE {Projects->Status} = "Active")`

---

## Edge Cases & Considerations

### 1. Superposition Handling
**Question:** When a formula input has multiple values (SUP), which one to use?

**Options:**
- A. Use dominant value based on view context (Recommended for Phase 1)
- B. Generate SUP results (all combinations) - Advanced
- C. Show warning to user - Conservative

**Recommendation:** Start with (A), add (B) in Phase 4

### 2. Circular Dependencies
**Example:** Field A = `{B} * 2`, Field B = `{A} / 2`

**Solution:** Detect cycles during formula save, reject with error message

### 3. Type Coercion
**Example:** `{TextFieldType}} + {NumberField}`

**Solution:** Auto-convert when possible, error otherwise

### 4. Performance with Large Datasets
**Challenge:** Recalculating 10,000 rows on every keystroke

**Solutions:**
- Debounced recalculation
- Virtual scrolling (only calculate visible rows)
- Background workers for heavy calculations
- Incremental updates (only affected rows)

### 5. Formula Portability Between Views
**Question:** Should formulas be copyable between views?

**Answer:** Yes, but recalculate dependencies and context for new view

---

## Example Use Cases

### Use Case 1: Sales Dashboard
```javascript
// View: "Q1 Sales"
// Filters: Date >= 2025-01-01 AND Date <= 2025-03-31

// Record-level formulas
{
  name: "Profit",
  formula: "{Revenue} - {Cost}",
  format: "currency"
}

{
  name: "Margin %",
  formula: "({Revenue} - {Cost}) / {Revenue} * 100",
  format: "percentage"
}

// View-level aggregates
{
  name: "Total Revenue",
  formula: "SUM({Revenue})",
  displayPosition: "footer"
}

{
  name: "Average Deal Size",
  formula: "AVG({Revenue})",
  displayPosition: "footer"
}
```

### Use Case 2: Project Health Scorecard
```javascript
// View: "At-Risk Projects"
// Filters: Status = "Active"

// Record-level formula
{
  name: "Health Score",
  formula: `IF(
    {Budget Remaining} < 0,
    "At Risk",
    IF({Days Until Deadline} < 7, "Warning", "Good")
  )`,
  format: "text"
}

// View-level aggregate
{
  name: "At-Risk Count",
  formula: 'COUNTIF({Health Score}, "At Risk")',
  displayPosition: "header"
}
```

### Use Case 3: Team Performance Metrics
```javascript
// View: "Team Performance - Q1"
// Context: scale = "team", timeframe = Q1 2025

// Record-level formulas (per team member)
{
  name: "Quota Attainment",
  formula: "{Actual Revenue} / {Quota} * 100",
  format: "percentage",
  context: {
    method: "derived",
    scale: "individual",  // Per person
    definition: "quota_attainment_percent"
  }
}

// View-level aggregate (whole team)
{
  name: "Team Total",
  formula: "SUM({Actual Revenue})",
  format: "currency",
  context: {
    method: "aggregated",
    scale: "team",  // Team level
    definition: "team_revenue_q1"
  }
}
```

---

## Security & Validation

### 1. Formula Validation
- Max formula length: 1000 characters
- Max dependency depth: 10 levels
- No infinite loops (circular dependency check)
- No access to system internals (sandboxed evaluation)

### 2. Performance Limits
- Max formulas per view: 50
- Max dependencies per formula: 20
- Calculation timeout: 5 seconds
- Cache TTL: 60 seconds

### 3. Permissions
- View owner can create/edit formulas
- Viewers can see formula results but not edit
- Formulas cannot access records outside view filters

---

## Migration Strategy

### For Existing Views
1. No changes to existing views (backward compatible)
2. New `formulaFields` array defaults to `[]`
3. Existing fields unaffected

### For Existing Records
1. Formula fields are virtual (not stored in record)
2. Calculated on-demand during rendering
3. Can be cached for performance

---

## Open Questions

1. **Should formula results be stored or always calculated?**
   - Stored: Faster, but requires cache invalidation
   - Calculated: Slower, but always accurate
   - **Recommendation:** Hybrid - cache with invalidation

2. **Should formulas be exportable in CSV/API?**
   - **Recommendation:** Yes, export calculated values (not formulas)

3. **Should we support JavaScript expressions for advanced users?**
   - **Recommendation:** No (security risk), use structured formula language

4. **How to handle formulas across linked records?**
   - **Recommendation:** Phase 5 feature - `SUM({LinkedSet.Field})`

5. **Should formulas have access to historical data?**
   - **Recommendation:** Future feature - temporal queries

---

## Summary

This design provides a **view-scoped formula system** that:

✅ Supports basic spreadsheet-style formulas
✅ Works with the existing EO context framework
✅ Handles both record-level and view-level calculations
✅ Integrates with superposition and lean context
✅ Enables view-specific calculations (same field, different formula per view)
✅ Provides automatic recalculation via dependency tracking
✅ Maintains audit trail via event stream

**Next Steps:**
1. Review and approve this design
2. Begin Phase 1 implementation (basic formulas)
3. Create test cases for edge scenarios
4. Build prototype UI for formula editor
