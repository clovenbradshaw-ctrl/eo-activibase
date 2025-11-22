# Formula Fields in Demo

This demo now includes working example formula fields that automatically calculate values based on other fields.

## Formula Fields Added

### 1. Air Temp (°F) - Temperature Conversion
**Formula:** `{Air Temp (°C)} * 1.8 + 32`

**Purpose:** Converts Celsius temperature to Fahrenheit

**Example:**
- Input: 18.6°C
- Output: 65.5°F

### 2. Battery Status - Conditional Status
**Formula:** `IF({Battery (%)} >= 90, "Excellent", IF({Battery (%)} >= 70, "Good", IF({Battery (%)} >= 50, "Fair", "Low")))`

**Purpose:** Categorizes battery level into status labels

**Status Levels:**
- **Excellent**: Battery ≥ 90%
- **Good**: Battery ≥ 70% and < 90%
- **Fair**: Battery ≥ 50% and < 70%
- **Low**: Battery < 50%

**Examples:**
- 94% → "Excellent"
- 90% → "Excellent"
- 88% → "Good"

## How It Works

1. **Schema Definition**: Formula fields are defined in the `schema` array with type `'FORMULA'` and a `formula` property
2. **Field References**: Formulas reference other fields using curly braces: `{Field Name}`
3. **Evaluation**: The `FormulaFieldService` evaluates formulas using the `FormulaEngine`
4. **Display**: Formula results are displayed in the table with a 🧮 icon and green background

## Implementation Details

### Schema Structure
```javascript
{
    id: 'air_temp_f',
    name: 'Air Temp (°F)',
    type: 'FORMULA',
    formula: '{Air Temp (°C)} * 1.8 + 32'
}
```

### Evaluation Method
```javascript
evaluateFormula(formulaField, recordId) {
    const record = this.eo.getAllRecords().find(r => r.record_id === recordId);
    const recordData = {};
    record.cells.forEach(cell => {
        recordData[cell.field_name] = this.eo.getCellDisplayValue(recordId, cell.field_name);
    });
    const result = this.formulaService.evaluateForRecord(
        formulaField.formula,
        recordData,
        this.schema
    );
    return result.result;
}
```

## Visual Indicators

- Formula field columns have a 🧮 calculator emoji in the header
- Formula field cells have a light green background (`#f0fdf4`)
- Formula field values are displayed in italic text

## Available Formula Functions

The formula engine supports 80+ functions including:

- **Arithmetic**: `+`, `-`, `*`, `/`, `POWER`, `SQRT`, `ABS`, `ROUND`
- **Logical**: `IF`, `AND`, `OR`, `NOT`, `SWITCH`
- **Text**: `CONCATENATE`, `UPPER`, `LOWER`, `LEN`, `TRIM`
- **Numeric**: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`
- **Date**: `NOW`, `TODAY`, `DATEADD`, `DATESTR`

## Testing

To test the formula fields:

1. Open `eo_demo.html` in a web browser
2. Click "📥 Simulate CSV Import" to load sample data
3. Verify the formula columns show calculated values:
   - Air Temp (°F) should show temperatures converted from Celsius
   - Battery Status should show status labels based on battery percentage

## Files Modified

- `/demo/eo_demo.html` - Added formula engine integration, schema definitions, and formula evaluation
