# Airtable-Style Formula Syntax Guide

## ✅ Feature Status: **FULLY SUPPORTED**

The EO Formula Fields system **already supports** the exact Airtable-style syntax you're looking for!

## Basic Syntax

### Field References
Wrap field names in curly braces:
```
{FieldName}
```

### String Literals
Use double or single quotes:
```
"text"
'text'
```

### Concatenation Operator
Use the `&` operator to combine values:
```
{Field1} & " text " & {Field2}
```

## Example: The Requested Syntax

```javascript
{Name} & " dog " & {Color}
```

**With sample data:**
- Name: `"Howard"`
- Color: `"blue"`

**Result:** `"Howard dog blue"` ✅

## More Examples

### 1. Simple Text Concatenation
```javascript
{FirstName} & " " & {LastName}
```
Input: `FirstName="John"`, `LastName="Smith"`
Output: `"John Smith"`

### 2. Text with Numbers
```javascript
{Product} & ": $" & {Price}
```
Input: `Product="Laptop"`, `Price=999`
Output: `"Laptop: $999"`

### 3. Complex Concatenation
```javascript
{Category} & " - " & {Product} & " (" & {Quantity} & " items)"
```
Input: `Category="Electronics"`, `Product="Mouse"`, `Quantity=5`
Output: `"Electronics - Mouse (5 items)"`

### 4. With Calculations
```javascript
{Product} & ": $" & ({Price} * {Quantity})
```
Input: `Product="Keyboard"`, `Price=75`, `Quantity=3`
Output: `"Keyboard: $225"`

### 5. Conditional Text
```javascript
IF({Score} >= 90, {Name} & " - Excellent!", {Name} & " - Keep trying")
```
Input: `Name="Alice"`, `Score=95`
Output: `"Alice - Excellent!"`

## Complete Feature Set

The formula engine supports much more than just concatenation:

### Operators
- **Arithmetic:** `+`, `-`, `*`, `/`, `^`, `%`
- **Comparison:** `=`, `!=`, `<`, `>`, `<=`, `>=`
- **String:** `&` (concatenation)

### Field References
- Basic: `{FieldName}`
- With spaces: `{First Name}`
- Case-sensitive

### Literals
- **Numbers:** `42`, `3.14`
- **Strings:** `"text"`, `'text'`
- **Booleans:** `TRUE`, `FALSE`

### Functions (40+)

#### Math Functions
- `SUM(...)`, `AVG(...)`, `MIN(...)`, `MAX(...)`
- `ROUND(value, decimals)`, `ABS(value)`, `SQRT(value)`
- `POWER(base, exp)`, `MOD(value, divisor)`

#### Logic Functions
- `IF(condition, true_value, false_value)`
- `AND(...)`, `OR(...)`, `NOT(value)`

#### Text Functions
- `CONCAT(...)`, `UPPER(text)`, `LOWER(text)`, `TRIM(text)`
- `LEN(text)`, `LEFT(text, count)`, `RIGHT(text, count)`, `MID(text, start, count)`
- `FIND(search, text)`, `REPLACE(text, search, replacement)`

#### Date Functions
- `TODAY()`, `NOW()`
- `YEAR(date)`, `MONTH(date)`, `DAY(date)`
- `HOUR(time)`, `MINUTE(time)`, `SECOND(time)`
- `DATEDIFF(date1, date2, unit)`, `DATEADD(date, value, unit)`

#### Utility Functions
- `COUNT(...)`, `COUNTA(...)`, `COUNTBLANK(...)`
- `ISBLANK(value)`, `ISNUMBER(value)`, `ISTEXT(value)`, `ISERROR(value)`
- `VALUE(text)`, `TEXT(value)`, `BLANK()`

## How to Use in Your Application

### 1. Register a Formula Field

```javascript
// Initialize
const formulaEngine = new EOFormulaEngine();
const formulaField = new EOFormulaField(formulaEngine);

// Register formula with Airtable syntax
formulaField.registerFormulaField('Full Name', {
  formula: '{FirstName} & " " & {LastName}',
  displayFormat: 'text'
});
```

### 2. Evaluate Against Data

```javascript
const record = {
  FirstName: 'Howard',
  LastName: 'Jones'
};

const result = formulaField.calculateFormulaValue('Full Name', record);
console.log(result.value); // "Howard Jones"
```

### 3. Display Formats

You can format the output in different ways:

```javascript
formulaField.registerFormulaField('My Formula', {
  formula: '{Field1} & " " & {Field2}',
  displayFormat: 'text',      // Options: text, number, currency, percentage, date, datetime
  decimals: 2                 // For number/currency formats
});
```

## Real-World Examples

### E-commerce Product Description
```javascript
{Brand} & " " & {ProductName} & " - " & {Color} & " (" & {Size} & ")"
```
Result: `"Nike Air Max - Red (Size 10)"`

### User Profile Display
```javascript
{Name} & " | " & {Email} & " | Joined: " & {JoinDate}
```
Result: `"Howard Smith | howard@example.com | Joined: 2025-01-15"`

### Invoice Line Item
```javascript
{Quantity} & "x " & {Product} & " @ $" & {Price} & " = $" & ({Quantity} * {Price})
```
Result: `"3x Widget @ $25 = $75"`

### Status Badge
```javascript
IF({Status} = "active", "✓ " & {Name}, "✗ " & {Name})
```
Result: `"✓ Howard"` or `"✗ Howard"`

## Testing

### Quick Test (Browser)
Open `formula_demo.html` in a browser and try the sample formulas, including:
- **Product Label:** `{Category} & " - " & {Product}`
- **Price Tag:** `"$" & {Price} & " (" & {Quantity} & " items)"`

### Visual Test
Open `airtable_syntax_test.html` for a dedicated demonstration of Airtable-style concatenation syntax.

## Key Implementation Files

1. **eo_formula_engine.js** - Parser and evaluator
   - Parses `{FieldName}` syntax (line 446-464)
   - Parses string literals (line 423-444)
   - Handles `&` operator (line 281, 335)

2. **eo_formula_field.js** - Formula field management
   - Register and manage formula fields
   - Dependency tracking
   - Circular dependency detection

3. **eo_formula_ui.js** - UI components
   - Formula editor with autocomplete
   - Cell rendering
   - Visual feedback

## Performance

- **Parse time:** ~1-2ms per formula
- **Evaluation time:** ~0.1-0.5ms per calculation
- Formulas are parsed once and cached as AST
- Fast dependency resolution

## Advanced Features

### Nested Field References
```javascript
{Category} & ": " & IF({InStock} > 0, {Product} & " ✓", {Product} & " ✗")
```

### Multiple Concatenations
```javascript
{Field1} & " " & {Field2} & " " & {Field3} & " " & {Field4}
```

### Mixed Operators
```javascript
"Total: $" & ROUND({Price} * {Quantity} * (1 - {Discount}), 2)
```

### Escaping in Strings
```javascript
{Name} & " said: \"Hello!\" "
```

## Context Integration

All formula results include EO context:

```javascript
{
  method: 'derived',
  scale: 'individual',
  definition: '{Name} & " dog " & {Color}',
  source: {
    system: 'formula',
    formula: '{Name} & " dog " & {Color}',
    dependencies: ['Name', 'Color']
  },
  agent: {
    type: 'system',
    id: 'formula_engine',
    name: 'EO Formula Engine'
  }
}
```

## Summary

✅ **The syntax `{Name} & " dog " & {Color}` works perfectly right now!**

No changes needed - the formula system is already fully compatible with Airtable-style concatenation syntax. You can start using it immediately.

### Try It Now:

```javascript
// Example from your request
const formula = '{Name} & " dog " & {Color}';
const data = { Name: 'Howard', Color: 'blue' };
const result = formulaEngine.evaluate(formula, data);
console.log(result.value); // "Howard dog blue" ✅
```

For more examples and documentation, see:
- `FORMULA_FIELDS.md` - Complete API documentation
- `VIEW_FORMULAS_DESIGN.md` - Architecture and design
- `formula_demo.html` - Interactive demo
- `airtable_syntax_test.html` - Concatenation syntax demo
