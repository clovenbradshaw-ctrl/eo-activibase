# 🚀 EO Integration Guide for Workbase

This guide explains how to integrate the Epistemic Observability (EO) framework into your existing Workbase application.

## 📦 What's Included

The EO framework consists of these files:

### Core Modules
- **`eo_data_structures.js`** - Data models and schemas for SUP-enabled cells
- **`eo_context_engine.js`** - Automatic context inference from user actions
- **`eo_sup_detector.js`** - Superposition detection and analysis
- **`eo_stability_classifier.js`** - Entity stability classification
- **`eo_cell_modal.js`** - Interactive cell modal UI component
- **`eo_integration.js`** - Main integration API
- **`eo_styles.css`** - Styling for all EO components

### Documentation
- **`EO_FRAMEWORK.md`** - Complete framework documentation
- **`EO_INTEGRATION_GUIDE.md`** - This file
- **`demo/eo_demo.html`** - Working demo with examples

---

## ⚡ Quick Start (5 minutes)

### Step 1: Add Scripts to Your HTML

Add these script tags to your `index.html` **before your main application code**:

```html
<!-- EO Framework -->
<link rel="stylesheet" href="eo_styles.css">
<script src="eo_data_structures.js"></script>
<script src="eo_context_engine.js"></script>
<script src="eo_sup_detector.js"></script>
<script src="eo_stability_classifier.js"></script>
<script src="eo_cell_modal.js"></script>
<script src="eo_integration.js"></script>
```

### Step 2: Initialize EO

In your main JavaScript code:

```javascript
// Create and initialize EO
const eo = new EOIntegration();
eo.initialize();

// Set current user (optional but recommended)
eo.setCurrentUser('user_123', 'John Doe');
```

### Step 3: Hook into CSV Import

Find your CSV import handler and add:

```javascript
// When importing CSV
function handleCSVImport(filename, records) {
  // Your existing import code...

  // Add EO import handling
  eo.handleImport(filename, records);

  // Render table with EO enhancements
  renderTable();
}
```

### Step 4: Hook into Cell Edits

Find your cell edit handler and add:

```javascript
// When user edits a cell
function handleCellEdit(recordId, fieldName, oldValue, newValue) {
  // Your existing edit code...

  // Add EO edit handling
  eo.handleEdit(recordId, fieldName, oldValue, newValue);

  // Update display
  updateCell(recordId, fieldName);
}
```

### Step 5: Make Cells Clickable

Enhance your table cells to open the EO modal:

```javascript
function renderTableCell(recordId, fieldName, value) {
  const cell = document.createElement('td');

  // Enable EO modal on click
  eo.enhanceTableCell(cell, recordId, fieldName);

  // Display value with SUP indicator
  const displayValue = eo.getCellDisplayValue(recordId, fieldName);
  const supIndicator = eo.getCellSUPIndicator(recordId, fieldName);

  cell.innerHTML = `${displayValue}${supIndicator}`;

  return cell;
}
```

**That's it!** Your application now has:
- ✅ Automatic context tracking
- ✅ Superposition support
- ✅ Stability classification
- ✅ Interactive cell modals

---

## 🎯 Common Integration Patterns

### Pattern 1: CSV Import with Context Inference

```javascript
function importCSV(file) {
  Papa.parse(file, {
    header: true,
    complete: function(results) {
      const records = results.data;

      // EO automatically infers:
      // - Timeframe from filename
      // - Scale from column names
      // - Definition from data types
      // - Method (measured/aggregated)
      eo.handleImport(file.name, records);

      refreshTable();
    }
  });
}
```

### Pattern 2: User Edit with Automatic SUP Detection

```javascript
function onCellEdit(event) {
  const recordId = event.target.dataset.recordId;
  const fieldName = event.target.dataset.fieldName;
  const oldValue = event.target.dataset.oldValue;
  const newValue = event.target.value;

  // EO automatically:
  // - Captures context (agent, timestamp, method)
  // - Detects if SUP should be created
  // - Updates stability classification
  eo.handleEdit(recordId, fieldName, oldValue, newValue);

  // Check if SUP was created
  const cell = eo.getRecord(recordId).cells
    .find(c => c.field_name === fieldName);

  if (cell.values.length > 1) {
    console.log('SUP detected!', cell.values.length, 'perspectives');
  }
}
```

### Pattern 3: Display Values with SUP Indicators

```javascript
function renderCell(recordId, fieldName) {
  // Get the dominant value for current view context
  const value = eo.getCellDisplayValue(recordId, fieldName);

  // Get SUP indicator if applicable
  const indicator = eo.getCellSUPIndicator(recordId, fieldName);

  return `
    <td data-eo-cell
        data-record-id="${recordId}"
        data-field-name="${fieldName}">
      ${formatValue(value)}
      ${indicator}
    </td>
  `;
}
```

### Pattern 4: Display Stability Badges

```javascript
function renderRow(recordId) {
  const record = eo.getRecord(recordId);
  const badge = eo.getStabilityBadge(recordId);

  return `
    <tr>
      <td>${record.fields.name}</td>
      <td>${badge}</td>
      <!-- other cells -->
    </tr>
  `;
}
```


```javascript


  return result;
}
```

---

## 🎨 Customizing the Cell Modal

The cell modal is automatically styled, but you can customize it:

```javascript
// Customize modal appearance
const style = document.createElement('style');
style.textContent = `
  .eo-cell-modal {
    border-radius: 20px; /* More rounded */
    max-width: 900px;    /* Wider */
  }

  .eo-value-text {
    color: #3b82f6;      /* Custom color */
  }
`;
document.head.appendChild(style);
```

---

## 📊 Getting EO Statistics

```javascript
// Get comprehensive statistics
const stats = eo.getStatistics();

console.log('Total records:', stats.totalRecords);
console.log('Cells with SUP:', stats.cellsWithSUP);
console.log('SUP percentage:', stats.supPercentage);
console.log('Stability breakdown:', stats.stability);

// Get records with superposition
const recordsWithSUP = eo.getRecordsWithSuperposition();
recordsWithSUP.forEach(({ recordId, cellsWithSUP }) => {
  console.log(`Record ${recordId} has ${cellsWithSUP.length} cells with SUP`);
});
```

---

## 🔧 Advanced Features

### Custom View Context

Control which value is displayed as "dominant":

```javascript
// Set view context (affects which value is shown)
eo.contextEngine.setViewContext({
  scale: 'team',           // Prefer team-scale values
  definition: 'revenue_gaap', // Prefer GAAP definition
  method: 'measured'       // Prefer measured values
});
```

### Manual Context Creation

For advanced cases, create context manually:

```javascript
const context = EODataStructures.createContextSchema({
  method: 'measured',
  definition: 'revenue_arr',
  scale: 'organization',
  timeframe: {
    granularity: 'quarter',
    start: '2025-10-01',
    end: '2025-12-31'
  },
  source: { system: 'salesforce_sync' },
  agent: { type: 'system' }
});
```

### Export Data with EO Metadata

```javascript
// Export without EO metadata (legacy format)
const legacyData = eo.exportRecord(recordId, false);

// Export with full EO metadata
const eoData = eo.exportRecord(recordId, true);
console.log('Cells:', eoData.cells);
console.log('Stability:', eoData.stability);
console.log('History:', eoData.edit_history);
```

### Migrate Existing Data

If you have existing records in the old format:

```javascript
// Migrate legacy records
const legacyRecords = [
  { id: 'rec1', name: 'Alice', score: 85 },
  { id: 'rec2', name: 'Bob', score: 92 }
];

eo.importLegacyRecords(legacyRecords);
```

---

## 🐛 Debugging

Enable debug mode to inspect EO internals:

```javascript
eo.enableDebug();

// Access debug tools in console
window.eo_debug.records      // All records
window.eo_debug.contextEngine // Context engine
window.eo_debug.supDetector   // SUP detector
window.eo_debug.integration   // Integration instance
```

---

## 📱 Mobile Considerations

The cell modal is fully responsive. On mobile:
- Modal fills more of the screen
- Tabs stack vertically
- Context grid becomes single-column

No additional code needed!

---

## ⚙️ Configuration Options

```javascript
const eo = new EOIntegration({
  enableSUP: true,              // Enable superposition
  enableStability: true,         // Enable stability classification
  enableContextInference: true,  // Auto-infer context
  autoClassifyStability: true    // Auto-classify on changes
});
```

---

## 🎬 Example: Full Integration

Here's a complete example integrating EO into a table:

```javascript
class WorkbaseTable {
  constructor() {
    // Initialize EO
    this.eo = new EOIntegration();
    this.eo.initialize();
    this.eo.setCurrentUser(currentUserId, currentUserName);
  }

  // Import CSV
  importCSV(filename, records) {
    this.eo.handleImport(filename, records);
    this.render();
  }

  // Handle cell edit
  onCellEdit(recordId, fieldName, oldValue, newValue) {
    this.eo.handleEdit(recordId, fieldName, oldValue, newValue);
    this.renderCell(recordId, fieldName);
  }

  // Render table
  render() {
    const records = this.eo.getAllRecords();
    const html = records.map(record => `
      <tr>
        ${this.renderCell(record.record_id, 'name')}
        ${this.renderCell(record.record_id, 'revenue')}
        <td>${this.eo.getStabilityBadge(record.record_id)}</td>
      </tr>
    `).join('');

    document.getElementById('tableBody').innerHTML = html;
  }

  // Render individual cell
  renderCell(recordId, fieldName) {
    const value = this.eo.getCellDisplayValue(recordId, fieldName);
    const indicator = this.eo.getCellSUPIndicator(recordId, fieldName);

    return `
      <td data-eo-cell
          data-record-id="${recordId}"
          data-field-name="${fieldName}">
        ${this.formatValue(value)}
        ${indicator}
      </td>
    `;
  }

  formatValue(value) {
    if (typeof value === 'number') {
      return '$' + value.toLocaleString();
    }
    return value;
  }
}

// Initialize
const table = new WorkbaseTable();
```

---

## 🎓 Next Steps

1. **Try the demo**: Open `demo/eo_demo.html` in a browser to see it working
2. **Read the framework docs**: See `EO_FRAMEWORK.md` for theory
3. **Integrate step-by-step**: Start with CSV import, then add edit handling
4. **Customize**: Adjust styles and configuration to match your needs

---

## 💡 Tips

- **Start small**: Integrate import first, then edits, then modals
- **Use debug mode**: `eo.enableDebug()` is your friend
- **Check the demo**: `demo/eo_demo.html` has working examples of everything
- **Context is automatic**: Trust the inference engine, it's smarter than manual entry
- **SUP is a feature**: Multiple values aren't errors, they're different perspectives

---

## 🤝 Support

- Check `EO_FRAMEWORK.md` for conceptual documentation
- Review `demo/eo_demo.html` for working code examples
- Use debug mode to inspect internal state
- All functions are documented with JSDoc comments

---

**You're ready to go!** 🚀

Start with the Quick Start section and you'll have EO running in 5 minutes.
