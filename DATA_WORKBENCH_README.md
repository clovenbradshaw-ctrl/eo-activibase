# EO Data Workbench

A comprehensive data management system for the EO Activibase that treats views and structural operations as first-class entities with full provenance tracking.

## Overview

The EO Data Workbench extends your existing Activibase with three major capabilities:

### 1. View Management 📋

Views are no longer just configurations—they're **entities with identity and history**.

**Key Features:**
- Views as first-class objects in global state
- Full provenance tracking (who created, when, derived from what)
- View hierarchy (parent-child relationships)
- Dirty state tracking for unsaved changes
- Save / Save As / Clone operations
- View manager UI with tabs and options

**Why This Matters:**
- Every analytical artifact is preserved
- You can trace how insights evolved
- Views capture context and intent, not just layout

### 2. Structural Operations 🔀

Operations like dedupe, merge, split, and harmonize are tracked entities that link inputs to outputs.

**Operations Supported:**

- **Dedupe** 🔍 - Find and merge duplicate records
  - Exact or fuzzy matching
  - Configurable similarity threshold
  - Multi-field key comparison

- **Merge Records** 🔀 - Combine multiple records into one
  - Side-by-side field comparison
  - Configurable resolution strategies (first, longest, concat, etc.)
  - Preserves original records with supersession links

- **Split Record** ✂️ - Divide one record into multiple
  - Manual field value editing
  - Links back to original

- **Field Harmonization** ⚖️ - Merge similar fields into canonical field
  - Example: `observer`, `observer_name`, `recorded_by` → `observer_name`
  - Multiple merge strategies
  - Deprecates old fields while preserving them for provenance

**Each operation:**
- Creates a StructuralOperation entity with full metadata
- Generates a result view showing inputs and outputs
- Links entities with provenance (supersededBy, splitFrom, mergedInto, etc.)
- Can be examined, analyzed, and potentially reverted

**Why This Matters:**
- Provenance constitutes position in knowledge space
- Every transformation is auditable
- Data lineage is explicit and queryable

### 3. Zero-Input Search 🔎

Search doesn't start blank—it shows you what's relevant **before you type**.

**What You See:**

- **Recent** - Items you've accessed recently
- **Frequently Used Fields** - Fields with the most data
- **New & Updated** - Recently created or modified entities
- **Structural Highlights**:
  - Fields with definitions
  - Fields with connections
  - Large sets (potential performance issues)
  - High-variety fields (many unique values)
  - Sparse fields (high missingness)
  - Recent structural operations
- **Browse** - Entity counts by type (sets, views, records, definitions, etc.)

**As You Type:**
- Real-time filtering across all entity types
- Results grouped by category
- Instant navigation to any entity

**Why This Matters:**
- Reduces cognitive load of "what to search for"
- Surfaces insights about data structure
- Makes exploration natural and discoverable

## Mental Model

Think of this system as a **world-based data workbench**:

- **Worlds** group everything
- **Sets** ≈ tables (collections of records)
- **Records** ≈ rows (individual data points)
- **Fields** ≈ columns (schema elements)
- **Views** are windows into sets with filters, sorts, layouts, and **provenance**
- **Definitions** describe the meaning of terms/fields/records
- **Connections** are typed relationships (graph edges)
- **Structural Operations** transform data and produce new views
- **Event Stream** logs all interactions

## Architecture

### Data Model

```
state = {
  worlds: Map<worldId, World>
  sets: Map<setId, Set>
  views: Map<viewId, ViewEntity>              // NEW: Global views
  definitions: Map<definitionId, Definition>
  connections: Map<connectionId, Connection>
  structuralOperations: Map<opId, Operation>  // NEW: Operations
  eventStream: Event[]                        // Interaction history

  currentWorldId: string
  currentSetId: string
  currentViewId: string
}
```

### ViewEntity Structure

```javascript
{
  id: string
  name: string
  setId: string

  // Layout
  type: 'grid' | 'gallery' | 'kanban' | 'calendar'
  icon: string

  // Configuration
  visibleFieldIds: string[]
  filters: Filter[]
  sorts: Sort[]
  groups: Group[]

  // EO-specific
  focus: { kind, id, fieldId?, value? } | null
  context: any  // 9-dimension context schema

  // Provenance
  provenance: {
    createdBy: string
    createdAt: number
    updatedAt: number
    derivedFromViewIds: string[]
    derivedFromOperationIds: string[]
    notes: string
  }

  // State
  isDirty: boolean
  isTemporary: boolean
}
```

### StructuralOperation Structure

```javascript
{
  id: string
  kind: 'dedupe' | 'merge_records' | 'split_record' |
        'merge_fields' | 'split_field' |
        'definition_reconcile' | 'context_reconcile'

  setId: string
  viewId: string  // view from which operation was executed

  inputRecordIds: string[]
  outputRecordIds: string[]
  inputFieldIds: string[]
  outputFieldIds: string[]

  parameters: any  // operation-specific config
  resultViewId: string  // view showing results

  createdAt: number
  createdBy: string
  status: 'draft' | 'applied' | 'reverted'
  summary: string
  notes: string
}
```

## Usage Examples

### Creating a View

```javascript
// Create a filtered view
const view = createView(state, {
  setId: 'observations',
  name: 'Recent Sightings',
  type: 'grid',
  filters: [
    { fieldId: 'date', operator: '>', value: '2024-01-01' },
    { fieldId: 'verified', operator: 'equals', value: true }
  ],
  sorts: [
    { fieldId: 'date', direction: 'desc' }
  ]
});
```

### Deduplicating Records

```javascript
// Find duplicates by name and location
const clusters = findDuplicateCandidates(state, setId, {
  keyFieldIds: ['name', 'location'],
  algorithm: 'fuzzy',
  threshold: 0.85
});

// Create operation and view
const operation = createOperation(state, {
  kind: 'dedupe',
  setId,
  parameters: { keyFieldIds: ['name', 'location'], threshold: 0.85 }
});

const view = createDedupeCandidatesView(state, setId, clusters, operation.id);
```

### Merging Records

```javascript
// Define merge strategies per field
const strategies = {
  name: 'longest',
  description: 'concat',
  date: 'mostRecent',
  _default: 'first'
};

// Execute merge
const result = executeMergeOperation(state, setId, recordIds, strategies);

// Result contains: { operation, newRecord, resultView }
```

### Creating View from Focus

```javascript
// Focus on a field showing non-empty values
const focus = {
  kind: 'field',
  id: 'species',
  fieldName: 'Species'
};

const view = createViewFromFocus(state, focus);
// Automatically filters to show records where species is not empty
```

### Field Harmonization

```javascript
// Merge similar fields
const result = executeMergeFieldsOperation(state, setId,
  ['observer', 'observer_name', 'recorded_by'],
  { id: 'observer_name', name: 'Observer Name', type: 'text' },
  { strategy: 'first' }
);

// Old fields marked as deprecated but preserved
// All values consolidated into canonical field
```

## UI Components

### View Manager

Shows view tabs at top of set:
- Click tab to switch view
- `⋮` menu for options (rename, duplicate, delete)
- `+ New View` button
- Unsaved changes indicator with Save/Save As buttons

### Structural Operations Toolbar

Buttons for operations:
- 🔍 Dedupe
- 🔀 Merge (requires 2+ selected records)
- ✂️ Split (requires 1 selected record)
- ⚖️ Harmonize

### Zero-Input Search Modal

Press `/` or search button:
- Shows relevant content immediately
- Type to filter across all entity types
- Click any result to navigate
- Browse by category

### Focus Panel

When focusing on field/record/value:
- Shows "📌 Create View from Focus" button
- Captures current focus and creates filtered view

## Integration

See `DATA_WORKBENCH_INTEGRATION.md` for detailed integration steps.

**Quick Start:**

1. Add script references to index.html
2. Initialize `state.views` and `state.structuralOperations` as Maps
3. Call `migrateViews(state)` after loading data
4. Add view manager to set rendering
5. Attach event listeners for UI interactions
6. Enhance search modal with zero-input surface

## Design Principles

### 1. Views are Entities, Not Just Configuration

Every view has an ID, provenance, and can be referenced. This allows:
- Tracing analytical workflows
- Understanding how insights evolved
- Sharing views between users/sessions
- Building view hierarchies and relationships

### 2. Provenance Constitutes Position in Knowledge Space

In ecological ontology (EO), provenance isn't just metadata—it defines **what** something is by describing its context and origins. Every view and operation tracks:
- When and by whom it was created
- What it was derived from
- What context it captures
- What transformations produced it

### 3. Operations are Reversible and Auditable

Structural operations don't just "happen"—they're:
- Tracked as entities with full metadata
- Linked to input and output entities
- Viewable through result views
- Potentially reversible (future enhancement)

### 4. Surfaces Should Reduce Cognitive Load

Zero-input search embodies this: don't make users think about what to search for. Show them:
- What they used recently
- What's popular
- What's new
- What's structurally interesting

## Future Enhancements

### Context Reconciliation
Detect and resolve context mismatches (e.g., different spatial/temporal scales).

### Definition Reconciliation
Side-by-side comparison and merging of definitions with narrower/broader relationships.

### Operation Reversion
Undo structural operations by creating inverse operations.

### View Templates
Save view configurations as templates for reuse.

### Collaborative Features
- View sharing and permissions
- Comments on views and operations
- Annotations on provenance

### Advanced Analytics
- Operation impact analysis
- Data quality scoring
- Automated harmonization suggestions
- Anomaly detection in structural patterns

## Technical Details

### File Structure

```
eo-activibase/
├── index.html                           # Main app
├── eo_view_management.js                # View entities & CRUD
├── eo_structural_operations.js          # Operations (dedupe, merge, split, harmonize)
├── eo_discovery.js                      # Zero-input search & discovery
├── eo_workbench_ui.js                   # UI components
├── eo_workbench_styles.css              # Styles
├── DATA_WORKBENCH_README.md             # This file
└── DATA_WORKBENCH_INTEGRATION.md        # Integration guide
```

### Dependencies

- No external libraries required
- Works with existing EO Activibase codebase
- Uses vanilla JavaScript (ES6+)
- CSS with custom properties for theming

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ required (Map, Set, arrow functions, etc.)
- CSS Grid and Flexbox

### Performance Considerations

- Views stored in Maps for O(1) lookup
- Event stream uses array (consider circular buffer for large histories)
- Deduplication is O(n²) for naive algorithm (optimizations available)
- Search is client-side (consider indexing for large datasets)

## Philosophy

This workbench embodies core EO principles:

1. **Everything is an entity** - Views and operations are not second-class citizens
2. **Provenance is constitutive** - History defines identity
3. **Context matters** - Capture context at every step
4. **Transformations are explicit** - Make data lineage visible
5. **Discovery is proactive** - Don't wait for users to ask

The result is a system where:
- Every analytical step is preserved
- Data lineage is transparent
- Insights are traceable
- Exploration is natural

## Contributing

When extending this system:

1. **Maintain provenance** - Always track origins and derivations
2. **Create views** - Every operation should produce a result view
3. **Log events** - Add to event stream for interaction history
4. **Preserve entities** - Mark as deprecated/superseded, don't delete
5. **Document context** - Capture the "why" not just the "what"

## License

Part of the EO Activibase project.

## Authors

EO Activibase Team

---

**Built with ♥ for ecological data management**
