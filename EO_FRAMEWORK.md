# 🌟 Epistemic Observability (EO) Framework for Workbase

## Overview

This document describes the **Epistemic Observability (EO)** framework integrated into Workbase - an autonomous inference engine that captures context, tracks provenance, and enables superposition of multiple valid values.

**Core Principle:** Users add NOTHING. All context, operators, and superpositions are inferred automatically. UX stays simple: row modal + cell modal.

---

## 🔥 Core Concepts

### 1. Context Schema

Every value in Workbase carries invisible **context**:

```json
{
  "method": "measured | declared | aggregated | inferred | derived",
  "definition": "what this value means (e.g., revenue_gaap_auto)",
  "scale": "individual | team | department | organization",
  "timeframe": {
    "granularity": "instant | day | week | month | quarter | year",
    "start": "ISO 8601 timestamp",
    "end": "ISO 8601 timestamp"
  },
  "source": {
    "file": "optional filename"
  },
  "agent": {
    "type": "system | person",
    "id": "user_id or 'system'",
    "name": "optional display name"
  }
}
```

### 2. SUP (Superposition)

**Definition:** Multiple co-valid values existing simultaneously for the same cell, each anchored to a different context.

SUP occurs when:
- Two or more observations refer to the same row + field
- They cover overlapping timeframes
- They have differing contexts (definition/method/scale/provenance)
- Neither has been superseded or deleted

**Example:**
```json
{
  "cell_id": "rec_123_field_revenue",
  "values": [
    {
      "value": 4200000,
      "timestamp": "2025-01-05T10:20:00Z",
      "context_schema": {
        "method": "measured",
        "definition": "revenue_gaap_auto",
        "scale": "team"
      }
    },
    {
      "value": 3900000,
      "timestamp": "2025-01-10T15:15:00Z",
      "context_schema": {
        "method": "declared",
        "definition": "manual_estimate",
        "scale": "individual"
      }
    }
  ]
}
```

### 3. Stability Classification

Entities are automatically classified based on change patterns:

- **Emerging** - High change frequency, less than 7 days old, or high variability
- **Forming** - Moderate changes, 7-30 days old, stabilizing patterns
- **Stable** - Low change rate, over 30 days old, consistent values

### 4. EO Operators (Invisible to Users)

These operators describe what happened to data, but are translated to natural language:

| Operator | Internal Meaning | User Sees |
|----------|-----------------|-----------|
| INS | Insertion | "Created" |
| DES | Description/Definition | "Defined" |
| SEG | Segmentation | "Split into..." |
| CON | Connection | "Connected to..." |
| SYN | Synthesis/Merge | "Merged" |
| REC | Reconfiguration | "Rule updated" |
| ALT | Alternation | "Cyclic change" |
| SUP | Superposition | "Multiple values exist" |

---

## 🔥 Autonomous Context Capture

### From CSV Import

**Automatically inferred:**
- `method`: "measured" or "aggregated"
- `timeframe`: from filename patterns or import timestamp
- `scale`: from column names / entity type
- `definition`: from column headers
- `source.system`: "csv_import"
- `agent.type`: "system"

**Example:**
Importing `sales_Q4_2025.csv` produces:
```json
{
  "method": "aggregated",
  "definition": "revenue_gaap_auto",
  "scale": "team",
  "timeframe": {
    "granularity": "quarter",
    "start": "2025-10-01",
    "end": "2025-12-31"
  },
  "source": { "system": "csv_import" },
  "agent": { "type": "system" }
}
```

### From User Edit

**Automatically captured:**
- `method`: "declared"
- `agent`: current user ID and name
- `timeframe`: edit timestamp
- `scale`: inferred from row type

### From Value Shape

**Inferred from column name and data type:**
- Revenue → term: "revenue", definition: "gaap_auto"
- Score → term: "score", method: "declared"
- Department → structural, scale: "team/department"
- Date → timeframe element

### From UI Flow

**Inferred from operation type:**
- Sync → method: "inferred"
- Duplication → method: "derived"
- Merge → method: "aggregated"

---

## 🔥 Two-Layer Modal UX

### Row Modal (Entity Profile)

Click a row → opens row modal with:

**Enhanced Features:**
1. **Stability Tag** (auto-inferred)
   ```
   🟢 Emerging — High change in last 7 days
   ```

2. **Scale Indicator** (auto-inferred)
   ```
   Scale: Team
   Derived from 9 fields and relation to Department: Sales
   ```

### Cell Modal (NEW - Core EO Interface)

Click a cell → opens cell modal with 4 tabs:

#### Tab 1: VALUE & CONTEXT
```
Value: $4.2M
Source: CSV Import (Jan 5, 2025)
Method: measured (system)
Definition: GAAP auto-detected
Scale: Team
Timeframe: Q4 2025
```

#### Tab 2: HISTORY
```
Jan 2 — Created via CSV import
Jan 5 — Updated by Alex
Jan 12 — Connected to Team: Marketing
Jan 20 — Split into "Core" + "Expansion"
```

#### Tab 3: SUPERPOSITION (if SUP detected)
```
Multiple values exist:

• $4.2M — measured via import (team scale, Q4)
  Source: CSV Import

• $3.9M — declared manually by Alex (individual scale, Jan 10)
  Source: Alex (manual edit)
```

Button: **⚡ Why are these different?**

#### Tab 4: CONTEXT DIFF
```
These values differ because:

• Scale: team vs individual
• Method: measured vs declared
• Definition: GAAP vs Manual estimate
• Timeframe: Q4 2025 vs Jan 2026
```

---

## 🔥 SUP Detection Algorithm

```javascript
function detectSuperposition(cell) {
  if (!cell.values || cell.values.length <= 1) return false;

  // Check if contexts meaningfully differ
  const [first, ...rest] = cell.values;

  return rest.some(value => {
    const ctx1 = first.context_schema;
    const ctx2 = value.context_schema;

    return (
      ctx1.definition !== ctx2.definition ||
      ctx1.scale !== ctx2.scale ||
      ctx1.method !== ctx2.method ||
      !timeframesOverlap(ctx1.timeframe, ctx2.timeframe)
    );
  });
}
```

---

## 🔥 Display Logic

### In Grid/Table View

**Normal cell:**
```
$4.2M
```

**Cell with SUP:**
```
$4.2M  ●2
```

**Hover tooltip:**
```
2 valid values available
Click to view perspectives
```

### Choosing "Dominant" Value

The system selects which value to display based on:
- Current view scale (team view → show team-scale values)
- Current filter context (GAAP filter → show GAAP definition)
- Most recent timestamp (newer preferred)
- Method priority (measured > declared > inferred)

---

## 🔥 Stability Algorithm

```javascript
function classifyStability(record) {
  const age = Date.now() - record.created_timestamp;
  const editFrequency = record.edit_history.length / age;
  const valueVariability = calculateVariability(record.value_history);
  const hasSuperposition = record.cells.some(c => c.values?.length > 1);

  if (age < 7 * 24 * 60 * 60 * 1000 || editFrequency > 0.5 || valueVariability > 0.3) {
    return 'emerging';
  } else if (age < 30 * 24 * 60 * 60 * 1000 || editFrequency > 0.2) {
    return 'forming';
  } else {
    return 'stable';
  }
}
```

---

## 🔥 Implementation Architecture

### File Structure
```
/eo_context_engine.js       - Context inference and capture
/eo_sup_detector.js         - Superposition detection logic
/eo_stability_classifier.js - Stability classification
/eo_cell_modal.js           - Cell modal UI component
/eo_row_modal_enhancer.js   - Row modal enhancements
/eo_data_structures.js      - Data models and schemas
```

### Integration Points

1. **CSV Import Handler** → Context inference engine
2. **Cell Edit Handler** → Context capture
3. **Cell Click Handler** → Cell modal
4. **Row Click Handler** → Enhanced row modal
5. **Table Render** → SUP indicator display

---

## 🔥 Key Benefits

1. **Zero User Friction** - No forms, no ontology, no extra steps
2. **Automatic Intelligence** - Context captured invisibly
3. **Multiple Truths** - SUP enables coexistence of valid perspectives
4. **Clear Explanations** - Natural language translations of EO operators
5. **Temporal Awareness** - Full history and provenance tracking

---

## Next Steps

See implementation files:
- `eo_context_engine.js` - Context inference engine
- `eo_sup_detector.js` - SUP detection
- `eo_cell_modal.js` - Cell modal UI
- Integration examples in main application code

---

**Version:** 1.0.0
**Last Updated:** 2025-11-21
