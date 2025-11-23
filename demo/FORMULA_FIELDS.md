# EO Formula Fields

A powerful, Airtable-like formula field system for the EO Activibase project. This implementation includes a complete formula parser, evaluator, and UI for creating and managing computed fields with full context awareness.

## Features

- ✅ **Full Formula Parser** - Custom-built AST parser with support for complex expressions
- ✅ **40+ Built-in Functions** - Math, logic, text, date, and utility functions
- ✅ **Field References** - Use `{FieldName}` syntax to reference other fields
- ✅ **Dependency Tracking** - Automatic detection of field dependencies
- ✅ **Circular Dependency Detection** - Prevents infinite loops
- ✅ **Multiple Display Formats** - Number, currency, percentage, text, date, datetime
- ✅ **EO Context Integration** - All formula results include proper EO context metadata
- ✅ **SUP Support** - Works with superposition-enabled cells
- ✅ **Real-time Validation** - Instant feedback on formula syntax
- ✅ **Beautiful UI** - Modern, responsive interface for formula management

## Quick Start

### 1. Include the Files

```html
<link rel="stylesheet" href="demo/eo_formula_styles.css">
<script src="demo/eo_formula_engine.js"></script>
<script src="demo/eo_formula_field.js"></script>
<script src="demo/eo_formula_ui.js"></script>
```

### 2. Initialize the System

```javascript
const formulaEngine = new EOFormulaEngine();
const formulaField = new EOFormulaField(formulaEngine);
const formulaUI = new EOFormulaUI(formulaField);
```

### 3. Register a Formula Field

```javascript
formulaField.registerFormulaField('Total Revenue', {
  formula: '{Price} * {Quantity}',
  displayFormat: 'currency',
  decimals: 2
});
```

### 4. Calculate Values

```javascript
const record = {
  Price: 100,
  Quantity: 5
};

const result = formulaField.calculateFormulaValue('Total Revenue', record);
console.log(result.value); // 500
console.log(result.formattedValue); // "$500.00"
```

## Formula Syntax

### Field References

Reference other fields using curly braces:
```
{Price} * {Quantity}
{FirstName} & " " & {LastName}
```

### Operators

**Arithmetic:** `+`, `-`, `*`, `/`, `^` (power), `%` (modulo)
```
{Price} * 1.1
{Quantity} ^ 2
{Total} % 10
```

**Comparison:** `=`, `!=`, `<`, `>`, `<=`, `>=`
```
{Price} > 100
{Status} = "Active"
```

**String Concatenation:** `&`
```
{FirstName} & " " & {LastName}
```

### Literals

**Numbers:** `42`, `3.14`, `-10`
**Strings:** `"Hello"`, `'World'`
**Booleans:** `TRUE`, `FALSE`

## Built-in Functions

### Mathematical Functions

| Function | Description | Example |
|----------|-------------|---------|
| `SUM(a, b, ...)` | Sum all arguments | `SUM({Q1}, {Q2}, {Q3}, {Q4})` |
| `AVG(a, b, ...)` | Average of arguments | `AVG({Score1}, {Score2})` |
| `MIN(a, b, ...)` | Minimum value | `MIN({Price}, {CompetitorPrice})` |
| `MAX(a, b, ...)` | Maximum value | `MAX({Bid1}, {Bid2}, {Bid3})` |
| `ROUND(num, decimals)` | Round to decimals | `ROUND({Price}, 2)` |
| `ABS(num)` | Absolute value | `ABS({Difference})` |
| `SQRT(num)` | Square root | `SQRT({Area})` |
| `POWER(base, exp)` | Power function | `POWER({Base}, 2)` |
| `MOD(num, divisor)` | Modulo | `MOD({Total}, 10)` |

### Logical Functions

| Function | Description | Example |
|----------|-------------|---------|
| `IF(cond, true, false)` | Conditional | `IF({Score} > 90, "A", "B")` |
| `AND(a, b, ...)` | Logical AND | `AND({Active}, {Verified})` |
| `OR(a, b, ...)` | Logical OR | `OR({Premium}, {VIP})` |
| `NOT(value)` | Logical NOT | `NOT({Expired})` |

### Text Functions

| Function | Description | Example |
|----------|-------------|---------|
| `CONCAT(a, b, ...)` | Concatenate strings | `CONCAT({First}, " ", {Last})` |
| `UPPER(text)` | Convert to uppercase | `UPPER({Name})` |
| `LOWER(text)` | Convert to lowercase | `LOWER({Email})` |
| `TRIM(text)` | Remove whitespace | `TRIM({Input})` |
| `LEN(text)` | String length | `LEN({Description})` |
| `LEFT(text, count)` | First N characters | `LEFT({Code}, 3)` |
| `RIGHT(text, count)` | Last N characters | `RIGHT({Phone}, 4)` |
| `MID(text, start, count)` | Substring | `MID({Text}, 5, 10)` |
| `FIND(search, text)` | Find substring | `FIND("@", {Email})` |
| `REPLACE(text, old, new)` | Replace text | `REPLACE({Text}, "old", "new")` |

### Date Functions

| Function | Description | Example |
|----------|-------------|---------|
| `TODAY()` | Current date (midnight) | `TODAY()` |
| `NOW()` | Current date and time | `NOW()` |
| `YEAR(date)` | Extract year | `YEAR({Created})` |
| `MONTH(date)` | Extract month (1-12) | `MONTH({Created})` |
| `DAY(date)` | Extract day | `DAY({Created})` |
| `HOUR(date)` | Extract hour | `HOUR({Timestamp})` |
| `MINUTE(date)` | Extract minute | `MINUTE({Timestamp})` |
| `DATEDIFF(d1, d2, unit)` | Difference between dates | `DATEDIFF(TODAY(), {Created}, "days")` |
| `DATEADD(date, count, unit)` | Add time to date | `DATEADD({Start}, 7, "days")` |

**Date units:** `"seconds"`, `"minutes"`, `"hours"`, `"days"`, `"weeks"`, `"months"`, `"years"`

### Utility Functions

| Function | Description | Example |
|----------|-------------|---------|
| `COUNT(a, b, ...)` | Count non-null values | `COUNT({A}, {B}, {C})` |
| `COUNTA(a, b, ...)` | Count non-empty values | `COUNTA({Fields})` |
| `COUNTBLANK(a, b, ...)` | Count blank values | `COUNTBLANK({Optional})` |
| `ISBLANK(value)` | Check if blank | `ISBLANK({Field})` |
| `ISNUMBER(value)` | Check if number | `ISNUMBER({Input})` |
| `ISTEXT(value)` | Check if text | `ISTEXT({Value})` |
| `VALUE(text)` | Convert to number | `VALUE({StringNum})` |
| `TEXT(value)` | Convert to text | `TEXT({Number})` |
| `BLANK()` | Return null | `BLANK()` |

## Real-World Examples

### E-commerce

```javascript
// Calculate total with discount
{Price} * {Quantity} * (1 - {DiscountRate})

// Shipping eligibility
IF({Total} > 50, "Free Shipping", "Standard Shipping")

// Product code
CONCAT(UPPER(LEFT({Category}, 3)), "-", {SKU})

// Stock status
IF({Quantity} > 100, "In Stock", IF({Quantity} > 0, "Low Stock", "Out of Stock"))
```

### Sales & Marketing

```javascript
// Commission calculation
{SalesAmount} * IF({Region} = "North", 0.15, 0.10)

// Lead score
SUM(
  IF({EmailVerified}, 10, 0),
  IF({CompanySize} > 100, 20, 0),
  IF({Budget} > 10000, 30, 0)
)

// Deal age in days
DATEDIFF(TODAY(), {CreatedDate}, "days")

// Quarter
IF(MONTH({Date}) <= 3, "Q1", IF(MONTH({Date}) <= 6, "Q2", IF(MONTH({Date}) <= 9, "Q3", "Q4")))
```

### Project Management

```javascript
// Days until deadline
DATEDIFF({DueDate}, TODAY(), "days")

// Project health
IF(
  AND({Progress} >= 75, {DaysRemaining} > 7),
  "On Track",
  IF({Progress} < 50, "At Risk", "Attention Needed")
)

// Completion percentage
ROUND(({CompletedTasks} / {TotalTasks}) * 100, 1)

// Task label
CONCAT({ProjectCode}, "-", {TaskNumber})
```

### HR & People

```javascript
// Years of service
DATEDIFF(TODAY(), {HireDate}, "years")

// Full name
CONCAT({FirstName}, " ", {LastName})

// Salary band
IF({Salary} > 100000, "Senior", IF({Salary} > 60000, "Mid", "Junior"))

// Days since last review
DATEDIFF(TODAY(), {LastReviewDate}, "days")
```

## Display Formats

### Number
```javascript
formulaField.registerFormulaField('Score', {
  formula: '{Points} * 1.5',
  displayFormat: 'number',
  decimals: 2
});
// Result: "75.50"
```

### Currency
```javascript
formulaField.registerFormulaField('Total', {
  formula: '{Price} * {Quantity}',
  displayFormat: 'currency',
  decimals: 2
});
// Result: "$1,234.56"
```

### Percentage
```javascript
formulaField.registerFormulaField('Growth', {
  formula: '({New} - {Old}) / {Old}',
  displayFormat: 'percentage',
  decimals: 1
});
// Result: "15.3%"
```

### Text
```javascript
formulaField.registerFormulaField('FullName', {
  formula: 'CONCAT({First}, " ", {Last})',
  displayFormat: 'text'
});
// Result: "John Doe"
```

### Date
```javascript
formulaField.registerFormulaField('NextReview', {
  formula: 'DATEADD({LastReview}, 90, "days")',
  displayFormat: 'date'
});
// Result: "3/15/2025"
```

## API Reference

### EOFormulaEngine

```javascript
const engine = new EOFormulaEngine();

// Parse a formula
const parseResult = engine.parse('{Price} * {Quantity}');
// Returns: { ast, dependencies, valid, error }

// Evaluate a formula
const evalResult = engine.evaluate('{Price} * 2', { Price: 100 });
// Returns: { value, dependencies, context, success, error }
```

### EOFormulaField

```javascript
const formulaField = new EOFormulaField(formulaEngine);

// Register a formula field
formulaField.registerFormulaField('Total', {
  formula: '{Price} * {Quantity}',
  displayFormat: 'currency',
  decimals: 2
});

// Calculate value for a record
const result = formulaField.calculateFormulaValue('Total', record);

// Calculate all formulas
const results = formulaField.calculateAllFormulas(record);

// Get all formula fields
const fields = formulaField.getFormulaFields();

// Validate a formula
const validation = formulaField.validateFormula('{Invalid Formula}');

// Export/Import configuration
const config = formulaField.exportConfig();
formulaField.importConfig(config);
```

### EOFormulaUI

```javascript
const formulaUI = new EOFormulaUI(formulaField);

// Show formula editor
formulaUI.showFormulaEditor();

// Render formula fields list
const listElement = formulaUI.renderFormulaFieldsList();
document.body.appendChild(listElement);

// Render a formula cell
const cellElement = formulaUI.renderFormulaCell('Total', record, config);
```

## EO Context Integration

All formula results include proper EO context metadata:

```javascript
{
  method: 'derived',              // Always 'derived' for formulas
  scale: 'individual',            // Could be inherited from dependencies
  definition: 'price_quantity',   // Sanitized formula identifier
  source: {
    system: 'formula',
    formula: '{Price} * {Quantity}',
    dependencies: ['Price', 'Quantity']
  },
  agent: {
    type: 'system',
    id: 'formula_engine',
    name: 'EO Formula Engine'
  }
}
```

## Dependency Management

The system automatically tracks dependencies and detects circular references:

```javascript
// This works fine
formulaField.registerFormulaField('Total', {
  formula: '{Price} * {Quantity}'
});

formulaField.registerFormulaField('WithTax', {
  formula: '{Total} * 1.1'
});

// This will throw an error (circular dependency)
try {
  formulaField.registerFormulaField('Price', {
    formula: '{Total} / {Quantity}'
  });
} catch (error) {
  console.error(error.message); // "Circular dependency detected"
}
```

## SUP (Superposition) Support

When a field has multiple values (SUP), the formula engine uses the dominant value based on recency:

```javascript
const record = {
  Price: {
    values: [
      { value: 100, timestamp: '2025-01-01' },
      { value: 120, timestamp: '2025-01-15' }  // This will be used
    ]
  },
  Quantity: 5
};

const result = formulaField.calculateFormulaValue('Total', record);
// Uses Price = 120 (most recent)
```

## Demo

Open `demo/formula_demo.html` in your browser to see:

- Interactive formula editor
- 20+ working formula examples
- Live formula validation
- Sample data with computed fields
- Formula test suite

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Performance

- **Parse time:** ~1-2ms per formula
- **Evaluation time:** ~0.1-0.5ms per calculation
- **Dependency resolution:** O(n) where n is number of formula fields
- **Circular detection:** O(n) where n is number of dependencies

## Future Enhancements

- [ ] View-level aggregate formulas (SUM across all records)
- [ ] Cross-record references (lookup values from other records)
- [ ] Custom function registration
- [ ] Formula autocomplete
- [ ] Multi-line formula editor with syntax highlighting
- [ ] Formula debugging/step-through
- [ ] Performance optimizations (memoization, lazy evaluation)
- [ ] Import formulas from Airtable

## License

Part of the EO Activibase project.
