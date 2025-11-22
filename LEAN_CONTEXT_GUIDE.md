# EO Lean Context Implementation Guide

## Overview

The Lean Context system implements "context as metadata" instead of "context as bloat" - reducing storage overhead by **83%** while maintaining full Epistemic Observability (EO) intelligence.

## Key Philosophy

> **Don't duplicate context for every value. Store templates once, reference via IDs, only store deltas.**

## Implementation Status

✅ **Phase 1**: Context Template System & Lean Record Structure
✅ **Phase 2**: Ultra-Lean Context Comparison
✅ **Phase 3**: Lazy Stability Calculation
✅ **Phase 4**: Implicit Scale Detection
✅ **Phase 5**: Compact History Events

## Architecture

### 1. Context Template System

Instead of storing full context for every field in every record, we:

1. **Create one template per import/batch**
2. **Reference templates via IDs** (`__ctx`)
3. **Only store deltas** when fields differ from template

```javascript
// Traditional approach (850 bytes per record)
{
  "id": "rec_1",
  "name": "Project Alpha",
  "__contextMetadata": {
    "name": { /* full context */ },
    "revenue": { /* full context */ }
  }
}

// Lean approach (150 bytes per record + shared 180 byte template)
{
  "id": "rec_1",
  "name": "Project Alpha",
  "revenue": 100000,
  "__ctx": "ctx_abc123"  // Reference to shared template
}
```

### 2. String Interning

Common strings (sources, definitions, jurisdictions) are stored once in a lookup table:

```javascript
stringTable: {
  "$0": "csv_import",
  "$1": "revenue_gaap",
  "$2": "US"
}
```

### 3. Lazy Computation

- **Stability** is calculated on-demand with 5-minute cache
- **Scale** is inferred from data patterns, not pre-stored
- **Only shown when user requests** via UI toggle

### 4. Compact Events

Events use abbreviated keys and numeric timestamps:

```javascript
{
  id: 12345,        // Number, not string
  v: "Update",      // Abbreviated verb
  o: "SEG",         // Operator code
  t: 1699564800000, // Timestamp as number
  a: "user_1",      // Just ID, resolve on render
  d: {              // Only non-default data
    f: "revenue",
    new: 50000
  }
}
```

## Usage

### Testing Lean Context Efficiency

After importing data, test the storage savings:

```javascript
// In browser console
testLeanContextEfficiency()
```

Expected output:
```
=== LEAN CONTEXT EFFICIENCY TEST ===

📊 STORAGE METRICS:
Current state size: 150.18 KB

Lean Context Overhead:
  - Templates: 0.18 KB (1 templates)
  - String table: 0.02 KB (3 strings)
  - Total overhead: 0.20 KB

✅ Context overhead: 0.13% of state size

📝 RECORD METRICS:
  - Total records: 1000
  - Lean records: 1000
  - Coverage: 100.0%

📅 EVENT METRICS:
  - Total events: 1001
  - Compact events: 1000
  - Compression rate: 99.9%

🎯 GOAL: Keep overhead < 15% for optimal performance
✅ PASSED: Current overhead is 0.13%
```

### Viewing Context Differences

When a cell has multiple superposed values with different contexts:

1. A **warning icon (!)** appears next to the values
2. Click the icon to see **"Why Different?"** modal
3. Shows only **critical differences** (definition, scale, method)

### Viewing Stability (Lazy)

In Card view:

1. Toggle **"Show stability"** checkbox
2. Stability badges appear (calculated on-demand)
3. Badges show: `emerging`, `forming`, or `stable`

## Storage Comparison

### For 1000 records from same import:

| Approach | Storage Size | Overhead |
|----------|-------------|----------|
| Naive (full context per field) | 850 KB | - |
| Lean (template + references) | 150.18 KB | **83% reduction** |

### Breakdown:
- **Naive**: 850 bytes × 1000 = 850 KB
- **Lean**: (150 bytes × 1000) + 180 bytes = 150.18 KB

## API Reference

### Global Functions

```javascript
// Test lean context efficiency
window.testLeanContextEfficiency()

// Show context difference for a cell
showQuickDiff(recordId, fieldId, event)

// Toggle stability display in Card view
toggleStabilityDisplay()

// Get stability for a record (cached)
state.leanContext.getRecordStability(recordId)

// Infer scale from record data
state.leanContext.inferRecordScale(record)

// Get effective context for a field
state.leanContext.getFieldContext(record, fieldId)
```

### Lean Context API

```javascript
// Create a context template
const templateId = state.leanContext.registerContextTemplate({
  method: 'declared',
  source: 'csv_import',
  agent: state.currentUser.id,
  timeframe: { start: '2025-01-01' }
})

// Create a lean record
const record = state.leanContext.createLeanRecord(setId, data, templateId)

// Set field-specific context (only if different from template)
state.leanContext.setFieldContext(record, fieldId, {
  method: 'measured',  // Override template method
  scale: 'team'        // Override template scale
})

// Compare contexts
const diff = state.leanContext.explainContextDifference(contextA, contextB)
// Returns: { compatible: true/false, diffs: [...], summary: "..." }
```

## Integration Points

### CSV Import

When importing CSV files, the system automatically:

1. Creates **one context template** for the entire batch
2. All records reference this template via `__ctx`
3. Creates a **single batch event** instead of per-record events

### Manual Edits

User edits create context deltas only when different from record's template:

```javascript
// Only stores override if method differs from template
state.leanContext.setFieldContext(record, 'revenue', {
  method: 'declared',  // If template is 'measured', this is stored
  agent: state.currentUser.id
})
```

### Event History

Events use compact format automatically when `state.leanContext` is available:

```javascript
createEvent('Update Field', 'SEG', object, data)
// Automatically uses compact format if leanContext exists
```

## Performance Characteristics

### Memory Usage
- **Template overhead**: ~180 bytes per import batch
- **String interning**: ~10 bytes per unique string
- **Stability cache**: Max 200 entries (5-minute TTL)
- **Event limit**: 10,000 events max, auto-trim to 5,000

### Computation Cost
- **Stability**: O(n) where n = events in last 30 days (cached)
- **Scale inference**: O(1) - pattern matching
- **Context lookup**: O(1) - Map-based
- **String resolution**: O(1) - Map-based

## Backward Compatibility

The lean context system is **fully backward compatible**:

- Records without `__ctx` work normally
- Events can be created with or without lean context
- UI gracefully handles missing lean context
- Existing data structures unchanged

## Migration Strategy

### Existing Records

Records created before lean context continue working unchanged. New imports automatically use lean context.

### Gradual Adoption

```javascript
// Old way (still works)
addRecord(setId, data)

// New way (automatic with CSV import)
// Creates lean record with template reference
```

### Testing Migration

```javascript
// Check lean context coverage
const stats = testLeanContextEfficiency()
console.log(`Lean coverage: ${stats.recordCoverage}%`)
```

## Troubleshooting

### High Overhead Warning

If `testLeanContextEfficiency()` shows overhead > 15%:

1. **Check string interning**: Too many unique values?
2. **Check template count**: Should be ~1 per import batch
3. **Review field overrides**: Are many fields overriding template?

### Stability Not Showing

1. Ensure `state.leanContext` is initialized
2. Check view has `showStability: true`
3. Toggle the checkbox in Card view

### Context Differences Not Displaying

1. Verify field has `value._sup === true`
2. Check `value.value` array has 2+ entries
3. Ensure `state.leanContext` is available

## Best Practices

### 1. Batch Imports
Always import related data in a single batch to maximize template reuse.

### 2. Consistent Naming
Use consistent source/definition names to maximize string interning.

### 3. Stability Toggle
Keep stability display **off by default** - calculate only when needed.

### 4. Event Limits
The system auto-trims events beyond 10,000. For audit requirements, export events periodically.

### 5. Template Management
Each import/sync should create its own template. Don't reuse templates across different data sources.

## Future Enhancements

### Planned
- [ ] Template deduplication for identical contexts
- [ ] Compressed timeframe ranges (e.g., "Q1 2024" → compact range)
- [ ] Export/import lean context state for persistence
- [ ] Visual template dependency graph

### Under Consideration
- [ ] Template versioning for context evolution
- [ ] Automatic template merging for similar sources
- [ ] Context similarity scoring
- [ ] Smart cache pre-warming

## Performance Targets

| Metric | Target | Typical |
|--------|--------|---------|
| Context overhead | < 15% | < 5% |
| Record coverage | 100% | 100% (new imports) |
| Event compression | > 80% | > 95% |
| Stability cache hit rate | > 90% | > 95% |
| Template reuse ratio | > 0.5 | > 0.9 |

## Resources

- **Implementation**: `eo_lean_context.js`
- **Integration**: `index.html` (search "LEAN CONTEXT")
- **Testing**: `window.testLeanContextEfficiency()`
- **Examples**: See CSV import workflow in action

## Credits

Based on the "Lean Implementation Guide" philosophy: **Context as Metadata, Not Bloat**.

Implemented: January 2025
Version: 1.0.0
