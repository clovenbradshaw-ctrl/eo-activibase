# EO Architecture Manifest for eo-activibase

**Generated:** 2025-12-06
**Last Updated:** 2025-12-06
**Framework Version:** EO Refactor Playbook v1.0
**Codebase Size:** ~24,309 LOC across 46 modules (+ 4 new foundation modules)

---

## PHASE 0 — Orientation (Figure, Pattern, Ground)

### Figure (Visible Structure)
- **10 Core Framework Modules** (root level) — ~8,501 LOC
- **36 Application Modules** (demo/) — ~15,808 LOC
- **3 JSON Configuration Files** — ~100KB
- **12 CSS Stylesheets** — ~177KB
- **Single Entry Point:** `index.html` (1.4MB consolidated)

### Pattern (Dependencies & Flows)

```
┌─────────────────────────────────────────────────────────────────┐
│                     EO CORE FRAMEWORK                           │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ eo_graph.js  │→ │eo_lean_context  │→ │eo_provenance     │   │
│  │  (Operators) │  │   (Storage)     │  │   (Tracking)     │   │
│  └──────────────┘  └─────────────────┘  └──────────────────┘   │
│         ↓                   ↓                    ↓              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               eo_workbench_ui.js (Main UI)              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER (demo/)                     │
│                                                                 │
│  DATA DOMAIN          RELATIONSHIP DOMAIN      CALCULATION DOMAIN│
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────┐│
│  │import_manager│    │relations_manager │    │ formula_engine ││
│  │json_scrubber │    │linked_fields     │    │ rollup_engine  ││
│  │file_explorer │    │set_management    │    │ context_engine ││
│  └──────────────┘    └──────────────────┘    └────────────────┘│
│         ↓                    ↓                      ↓          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              UI COMPONENTS (modals, panels)             │   │
│  │   cell_modal | record_modal | toss_pile_ui | field_lens │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Ground (Invisible Enabling Conditions)

1. **No Build System** — Direct browser loading via `<script>` tags
2. **Global Namespace** — All modules export to `window.*`
3. **Script Order Dependency** — Modules must load in specific sequence
4. **CDN Dependencies** — React 18, Tailwind CSS, Vis-Network, ChartJS, SheetJS
5. **No Package Manager** — No npm/yarn, standalone architecture
6. **Browser-First** — Pure client-side, no server backend
7. **Single Global State** — `state` object passed between modules

---

## PHASE 1 — Entity Designation (DES) & Developmental Classification

### 1.1 Module Entity Map

| Module | Purpose | LOC | Inputs | Outputs | Hidden State | Dependencies |
|--------|---------|-----|--------|---------|--------------|--------------|
| `eo_graph.js` | Core EO operators (9) and 27-position realm system | 1,181 | config | graph instance | nodes, edges, indexes | None |
| `eo_lean_context.js` | Memory-optimized context storage | 428 | config | templates, strings | contextTemplates, stringTable | None |
| `eo_provenance_extractor.js` | Data lineage tracking | 733 | events | provenance graph | None | eo_graph |
| `eo_view_management.js` | View lifecycle management | 491 | state | views | view configs | None |
| `eo_layout_management.js` | Grid/panel layout system | 1,454 | state | layout DOM | layout state | None |
| `eo_workbench_ui.js` | Primary UI rendering | 1,203 | state | DOM | render state | all core |
| `eo_import_manager.js` | CSV/JSON/Excel import with provenance | 1,272 | file | import object | imports Map | eo_lean_context |
| `eo_context_engine.js` | Context inference from actions | 499 | data | context schema | currentUser, viewContext | EODataStructures |
| `eo_toss_pile.js` | Cell-level undo/restore system | 897 | state | entries, actions | tossPile state | None |
| `eo_relations_manager.js` | Relationship definition | 707 | state | relations | relation configs | None |
| `eo_formula_engine.js` | Expression evaluation | 596 | formula | result | None | None |
| `eo_data_structures.js` | Core schemas & models | 382 | config | schema objects | None | None |

### 1.2 Developmental State Classification

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    MODULE DEVELOPMENTAL STATES                             ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │                         HOLON (Stable)                              │ ║
║  │  Clear boundaries, well-defined APIs, reliable tests implied       │ ║
║  │                                                                     │ ║
║  │  • eo_graph.js — Complete operator system, export formats          │ ║
║  │  • eo_lean_context.js — Stable storage patterns                    │ ║
║  │  • eo_data_structures.js — Static schema definitions               │ ║
║  │  • eo_toss_pile.js — Complete undo/restore API                     │ ║
║  │  • eo_import_manager.js — Full file handling, schema inference     │ ║
║  │  • eo_context_engine.js — Stable inference patterns                │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │                       PROTOGON (Forming)                            │ ║
║  │  Active development, unclear boundaries, expect rewrite            │ ║
║  │                                                                     │ ║
║  │  • eo_workbench_ui.js — Large, mixed concerns, UI + logic          │ ║
║  │  • eo_layout_management.js — Complex state, many edge cases        │ ║
║  │  • eo_formula_engine.js — Expanding feature set                    │ ║
║  │  • eo_formula_ui.js — Active UI iteration                          │ ║
║  │  • eo_relations_manager.js — API still evolving                    │ ║
║  │  • eo_set_management.js — Boundary with relations unclear          │ ║
║  │  • eo_three_level_integration.js — Integration pattern emerging    │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │                       EMANON (Unstable)                             │ ║
║  │  Measurement-resistant, no clear identity, mixed functions         │ ║
║  │                                                                     │ ║
║  │  • eo_integration.js — Glue code, duplicates logic                 │ ║
║  │  • eo_import_integration.js — Wrapper over import_manager          │ ║
║  │  • eo_graph_integration.js — Unclear purpose                       │ ║
║  │  • eo_stability_classifier.js — Needs context_engine?              │ ║
║  │  • eo_sup_detector.js — Could merge with context_engine            │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## PHASE 2 — Boundary Extraction (SEG & CON)

### 2.1 Current Boundary Issues

| Issue | Location | Severity | Description |
|-------|----------|----------|-------------|
| **Mixed Concerns** | eo_workbench_ui.js | HIGH | UI rendering + business logic + state management |
| **Leaky Abstraction** | eo_integration.js | HIGH | Re-implements context engine logic |
| **Duplicate Logic** | sup_detector + context_engine | MEDIUM | Superposition detection duplicated |
| **Unclear Ownership** | eo_graph_integration.js | MEDIUM | Purpose overlaps with eo_graph.js |
| **Missing Interface** | Global state | HIGH | `state` object passed everywhere without contract |
| **Tight Coupling** | Layout + Views | MEDIUM | Layout management touches view state directly |

### 2.2 Proposed SEG Operations

#### SEG-1: Split `eo_workbench_ui.js` into 3 modules

```
BEFORE:                          AFTER:
┌──────────────────────┐         ┌──────────────────────┐
│  eo_workbench_ui.js  │         │ eo_workbench_ui.js   │  (rendering only)
│  - Rendering         │   SEG   ├──────────────────────┤
│  - Event handling    │   ───→  │ eo_ui_events.js      │  (event coordination)
│  - State updates     │         ├──────────────────────┤
│  - DOM manipulation  │         │ eo_state_manager.js  │  (state mutations)
└──────────────────────┘         └──────────────────────┘
```

#### SEG-2: Create dedicated `eo_state.js` for state contract

```javascript
// PROPOSED: eo_state.js
const StateContract = {
  sets: Map,
  currentSetId: String,
  views: Map,
  currentViewId: String,
  entities: Map,
  selectedRecordIds: Set,
  tossPile: Object,
  // ... explicit schema
};
```

#### SEG-3: Extract formula evaluation from formula UI

```
BEFORE:                          AFTER:
┌──────────────────────┐         ┌──────────────────────┐
│  eo_formula_ui.js    │         │ eo_formula_ui.js     │  (UI only)
│  - UI rendering      │   SEG   ├──────────────────────┤
│  - Formula parsing   │   ───→  │ eo_formula_parser.js │  (parsing)
│  - Evaluation        │         ├──────────────────────┤
│  - Error handling    │         │ eo_formula_engine.js │  (evaluation)
└──────────────────────┘         └──────────────────────┘
```

### 2.3 Proposed CON Operations

#### CON-1: Define Module Interface Protocol

```javascript
// Each module MUST export:
{
  // Identity
  MODULE_ID: string,
  VERSION: string,

  // Interface
  init: (deps) => void,
  destroy: () => void,

  // Events
  on: (event, handler) => unsubscribe,
  emit: (event, data) => void,

  // State (if stateful)
  getState: () => snapshot,
  setState: (patch) => void
}
```

#### CON-2: Event Bus for Cross-Module Communication

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Module A   │────→│  Event Bus  │←────│  Module B   │
└─────────────┘     └─────────────┘     └─────────────┘
                          ↓
                    ┌───────────┐
                    │  Module C │
                    └───────────┘

Events:
- record:created
- record:updated
- record:tossed
- cell:edited
- view:switched
- import:completed
- relationship:created
```

#### CON-3: Dependency Injection Pattern

```javascript
// PROPOSED: Replace global window.* with explicit injection
class EOImportManager {
  constructor(deps) {
    this.contextEngine = deps.contextEngine;
    this.dataStructures = deps.dataStructures;
    this.eventBus = deps.eventBus;
  }
}
```

---

## PHASE 3 — Transformation Operators Applied

### INS (Instantiate) — Create Missing Modules

| New Module | Purpose | Derived From |
|------------|---------|--------------|
| `eo_state.js` | Centralized state management | Extracted from scattered state usage |
| `eo_event_bus.js` | Cross-module event communication | New architecture need |
| `eo_formula_parser.js` | Formula AST generation | Extracted from formula_ui |
| `eo_validation.js` | Schema validation utilities | Extracted from data_structures |
| `eo_types.js` | TypeScript-style type definitions | New (JSDoc annotations) |

### SYN (Synthesize) — Merge Modules That Belong Together

| Merge | Into | Rationale |
|-------|------|-----------|
| `eo_sup_detector.js` + `eo_context_engine.js` | `eo_context_engine.js` | SUP detection is context-dependent |
| `eo_stability_classifier.js` + `eo_context_engine.js` | `eo_analysis_engine.js` | Both analyze entity state |
| `eo_integration.js` + `eo_import_integration.js` + `eo_three_level_integration.js` | `eo_app_controller.js` | All are integration glue |
| `eo_toss_pile.js` + `eo_toss_pile_ui.js` | Keep separate | UI/logic split is correct |

### ALT (Alternate/Rhythm) — Add Operational Rhythms

| Rhythm | Module | Interval | Purpose |
|--------|--------|----------|---------|
| Stability recalculation | eo_stability_classifier | 5 min | Update entity stability classifications |
| Context cache cleanup | eo_lean_context | 15 min | Prune expired context templates |
| Toss pile purge check | eo_toss_pile | 1 hour | Warn about old tossed items |
| Auto-save views | eo_view_management | 30 sec | Persist dirty views |
| Import relationship scan | eo_import_manager | On import | Detect cross-import relationships |

### SUP (Superpose) — Enable Multi-Context Support

| Module | Superposition Pattern | Implementation |
|--------|----------------------|----------------|
| `eo_lean_context` | Environment-specific configs | `contextTemplates.get(env + '_' + id)` |
| `eo_view_management` | User-specific view preferences | `views.get(userId + '_' + viewId)` |
| `eo_formula_engine` | Locale-aware calculations | `evaluate(formula, { locale })` |
| `eo_import_manager` | Multi-format parsing | Already implemented via format detection |

### REC (Recurse) — Self-Maintenance Capabilities

| Module | Recursion Pattern | Implementation |
|--------|------------------|----------------|
| `eo_context_engine` | Self-updating inference rules | Learn from user corrections |
| `eo_stability_classifier` | Adaptive thresholds | Adjust based on data distribution |
| `eo_toss_pile` | Auto-purge based on usage | More aggressive cleanup for unused items |
| `eo_import_manager` | Schema evolution | Track schema changes across imports |
| `eo_graph` | Graph optimization | Periodically rebuild indexes |

---

## PHASE 4 — Holon Formation

### Holon Checklist for Each Module

#### Required Capacities (from EO Holarchies)

| Module | Boundary | Interface | Feedback | Alignment | Reconfigurability |
|--------|----------|-----------|----------|-----------|-------------------|
| eo_graph.js | ✅ Clear | ✅ Explicit API | ⚠️ Events needed | ✅ Core framework | ✅ Configurable |
| eo_lean_context.js | ✅ Clear | ✅ Explicit API | ❌ No metrics | ✅ Core framework | ✅ Template-based |
| eo_import_manager.js | ✅ Clear | ✅ Listener pattern | ✅ Quality metrics | ✅ Data layer | ✅ Format plugins |
| eo_toss_pile.js | ✅ Clear | ✅ Explicit API | ⚠️ Stats only | ✅ Undo system | ✅ Configurable |
| eo_context_engine.js | ⚠️ Depends on DataStructures | ✅ Explicit API | ❌ No learning | ✅ Context layer | ⚠️ Hard-coded rules |
| eo_workbench_ui.js | ❌ Mixed | ❌ Implicit DOM | ❌ None | ⚠️ Unclear role | ❌ Tightly coupled |
| eo_formula_engine.js | ✅ Clear | ⚠️ Partial | ❌ No errors | ✅ Calculation | ⚠️ Limited |

### Holon Identity Cards

```
╔════════════════════════════════════════════════════════════════╗
║                    HOLON: eo_graph                             ║
╠════════════════════════════════════════════════════════════════╣
║  Identity:   Core EO operator and relationship graph           ║
║  Space:      Graph nodes (27 positions) and edges (9 operators)║
║  Time:       Immutable operators, mutable graph instances      ║
╠════════════════════════════════════════════════════════════════╣
║  Boundary:   Clear class interface (EOGraph, EOGraphBuilder)   ║
║  Interface:  addNode, addEdge, findPaths, toJSON, toDOT        ║
║  Feedback:   getStatistics(), event log                        ║
║  Alignment:  Foundation for all relationship modeling          ║
║  Reconfig:   Operator definitions could be externalized        ║
╚════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════╗
║                    HOLON: eo_import_manager                    ║
╠════════════════════════════════════════════════════════════════╣
║  Identity:   First-class import objects with provenance        ║
║  Space:      File → Schema → Rows with quality metrics         ║
║  Time:       Immutable imports, mutable usage tracking         ║
╠════════════════════════════════════════════════════════════════╣
║  Boundary:   Clear class with listener pattern                 ║
║  Interface:  createImportFromFile, getImport, findRelationships║
║  Feedback:   Quality scores, schema analysis, relationship hints║
║  Alignment:  Entry point for all external data                 ║
║  Reconfig:   Format parsers could be plugins                   ║
╚════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════╗
║                    HOLON: eo_toss_pile                         ║
╠════════════════════════════════════════════════════════════════╣
║  Identity:   Cell-level undo/restore with surgical precision   ║
║  Space:      TossEntry (cell) → TossAction (batch) hierarchy   ║
║  Time:       Append-only entries, pick-up restores             ║
╠════════════════════════════════════════════════════════════════╣
║  Boundary:   IIFE module with namespace export                 ║
║  Interface:  tossRecord, tossCell, pickUpEntry, getGhostData   ║
║  Feedback:   Statistics, related entries                       ║
║  Alignment:  User safety net for destructive operations        ║
║  Reconfig:   Ghost settings, max age, purge options            ║
╚════════════════════════════════════════════════════════════════╝
```

---

## PHASE 5 — Pattern Extraction & Dependency Analysis

### 5.1 Dependency Graph

```
                    ┌─────────────────────────────────────┐
                    │         FOUNDATION LAYER            │
                    │  (No dependencies, pure modules)    │
                    ├─────────────────────────────────────┤
                    │  eo_graph  │  eo_data_structures    │
                    └──────┬─────┴───────────┬────────────┘
                           │                 │
        ┌──────────────────┼─────────────────┼──────────────────┐
        │                  ↓                 ↓                  │
        │         ┌────────────────────────────────┐           │
        │         │        CONTEXT LAYER            │           │
        │         │  (Depends on foundation)        │           │
        │         ├────────────────────────────────┤           │
        │         │  eo_lean_context │ eo_context_engine       │
        │         └────────────┬───────────────────┘           │
        │                      │                                │
        │                      ↓                                │
        │         ┌────────────────────────────────┐           │
        │         │        SERVICE LAYER            │           │
        │         │  (Business logic)               │           │
        │         ├────────────────────────────────┤           │
        │         │ import_manager │ toss_pile │ formula_engine│
        │         │ relations_manager │ set_management         │
        │         └────────────┬───────────────────┘           │
        │                      │                                │
        │                      ↓                                │
        │         ┌────────────────────────────────┐           │
        │         │      INTEGRATION LAYER          │           │
        │         │  (Glue code - EMANON)           │           │
        │         ├────────────────────────────────┤           │
        │         │ eo_integration │ *_integration.js          │
        │         └────────────┬───────────────────┘           │
        │                      │                                │
        │                      ↓                                │
        │         ┌────────────────────────────────┐           │
        │         │          UI LAYER               │           │
        │         │  (Presentation)                 │           │
        │         ├────────────────────────────────┤           │
        │         │ workbench_ui │ cell_modal │ toss_pile_ui   │
        │         │ file_explorer │ formula_ui                  │
        │         └────────────────────────────────┘           │
        └───────────────────────────────────────────────────────┘
```

### 5.2 Repeated Patterns to Abstract

| Pattern | Occurrences | Abstraction |
|---------|-------------|-------------|
| `Map` + `idCounter` + CRUD | import_manager, toss_pile, set_management | `EntityStore` class |
| Event listener pattern | import_manager, toss_pile | `Observable` mixin |
| `*Snapshot` capture | toss_pile, provenance | `Snapshot` utility |
| Field type inference | import_manager, context_engine | `TypeInferrer` utility |
| File format detection | import_manager | Already localized |
| Modal rendering | cell_modal, record_modal, linked_fields_modal | `ModalBase` class |

### 5.3 Accidental Complexity Removal

| Issue | Location | Resolution |
|-------|----------|------------|
| Hard-coded entity patterns | import_manager:226-247 | Extract to config |
| Magic numbers | stability_classifier | Define constants |
| Deep object mutations | Throughout | Immutable update patterns |
| String concatenation for IDs | Many files | Central ID generator |
| Repeated DOM queries | UI components | Cache element references |
| Global `state` dependency | All modules | Dependency injection |

---

## PHASE 6 — Context Schema (9 Dimensions)

### Module Context Cards

| Module | Agent | Method | Source | Term | Definition | Jurisdiction | Scale | Timeframe | Background |
|--------|-------|--------|--------|------|------------|--------------|-------|-----------|------------|
| eo_graph | System | Core | Original | Graph | EO operator graph | All data | Global | Stable | 9 operators, 27 positions |
| eo_lean_context | System | Storage | Optimized | Context | Template-based context | Per-record | Per-field | Stable | String interning, lazy eval |
| eo_import_manager | User | Import | External files | Import | First-class imports | Per-import | Per-file | Session | CSV/JSON/Excel support |
| eo_context_engine | System | Inference | Actions | Context | Auto-captured context | Per-cell | Per-value | Instant | Method/scale/definition |
| eo_toss_pile | User | Undo | UI actions | Deletion | Cell-level undo | Per-set | Per-action | Session | Ghost cells, pick-up |
| eo_relations_manager | User | Define | Manual | Relation | Entity relationships | Per-set | Per-pair | Stable | Typed relationships |
| eo_formula_engine | System | Calculate | Formulas | Formula | Expression evaluation | Per-cell | Per-field | Instant | Airtable-compatible |
| eo_workbench_ui | User | Render | DOM | UI | Main interface | Global | Full app | Instant | React-like rendering |

---

## PHASE 7 — EO Architecture Manifest Summary

### Module Registry

```yaml
modules:
  # HOLONS (Stable)
  - id: eo_graph
    type: holon
    realm: III (Explicit Form)
    position: 14
    stability: stable
    operators_applied: [DES, SEG, CON]
    dependencies: []
    exports: [EOGraph, EOGraphBuilder, EO_OPERATORS, EO_POSITIONS, EO_REALMS]
    rhythms: []
    recursion: getStatistics()

  - id: eo_lean_context
    type: holon
    realm: III
    position: 14
    stability: stable
    operators_applied: [DES, INS, SEG]
    dependencies: []
    exports: [EOLeanContext]
    rhythms: [stabilityCache expiry (5 min)]
    recursion: estimateStorageSize()

  - id: eo_data_structures
    type: holon
    realm: III
    position: 15
    stability: stable
    operators_applied: [DES]
    dependencies: []
    exports: [EODataStructures]
    rhythms: []
    recursion: validateContextSchema()

  - id: eo_import_manager
    type: holon
    realm: IV (Pattern Mastery)
    position: 20
    stability: stable
    operators_applied: [DES, INS, SEG, CON, SYN]
    dependencies: []
    exports: [EOImportManager]
    rhythms: [relationship detection on import]
    recursion: analyzeDataQuality(), findAllRelationships()

  - id: eo_toss_pile
    type: holon
    realm: IV
    position: 21
    stability: stable
    operators_applied: [DES, INS, SEG, CON]
    dependencies: []
    exports: [TossPile]
    rhythms: [ghost age filtering]
    recursion: getRelatedEntries(), purgeTossPile()

  - id: eo_context_engine
    type: holon
    realm: III
    position: 16
    stability: stable
    operators_applied: [DES, INS, ALT]
    dependencies: [EODataStructures]
    exports: [EOContextEngine]
    rhythms: []
    recursion: inferOperator()

  # PROTOGONS (Forming)
  - id: eo_workbench_ui
    type: protogon
    realm: II (Nascent Form)
    position: 10
    stability: forming
    operators_applied: [INS]
    dependencies: [all core modules]
    exports: [renderViewManager, showViewMenu, ...]
    rhythms: []
    recursion: none
    refactor_needed: [SEG into ui/events/state]

  - id: eo_layout_management
    type: protogon
    realm: II
    position: 11
    stability: forming
    operators_applied: [INS, SEG]
    dependencies: [eo_view_management]
    exports: [layout functions]
    rhythms: [resize handlers]
    recursion: none

  - id: eo_formula_engine
    type: protogon
    realm: II
    position: 9
    stability: forming
    operators_applied: [INS]
    dependencies: []
    exports: [evaluate functions]
    rhythms: []
    recursion: none
    refactor_needed: [SEG parser from evaluator]

  - id: eo_relations_manager
    type: protogon
    realm: II
    position: 8
    stability: forming
    operators_applied: [DES, INS]
    dependencies: [eo_graph]
    exports: [relation functions]
    rhythms: []
    recursion: none

  # EMANONS (Unstable)
  - id: eo_integration
    type: emanon
    realm: I (Pre-formation)
    position: 3
    stability: emerging
    operators_applied: []
    dependencies: [many]
    exports: [EOIntegration]
    rhythms: []
    recursion: none
    action_needed: SYN with app_controller or DELETE

  - id: eo_import_integration
    type: emanon
    realm: I
    position: 2
    stability: emerging
    operators_applied: []
    dependencies: [eo_import_manager]
    exports: [integration functions]
    rhythms: []
    recursion: none
    action_needed: SYN into import_manager or DELETE

  - id: eo_graph_integration
    type: emanon
    realm: I
    position: 1
    stability: emerging
    operators_applied: []
    dependencies: [eo_graph]
    exports: [unclear]
    rhythms: []
    recursion: none
    action_needed: REVIEW purpose, likely DELETE
```

### Operator History Log

```yaml
operator_history:
  - timestamp: 2025-12-06T00:00:00Z
    operator: DES
    target: all modules
    description: Initial entity designation and classification

  - timestamp: 2025-12-06T00:00:00Z
    operator: SEG
    target: architecture
    description: Identified boundary issues, proposed splits

  - timestamp: pending
    operator: SEG
    target: eo_workbench_ui
    description: Split into ui/events/state modules
    priority: HIGH

  - timestamp: pending
    operator: SYN
    target: [eo_sup_detector, eo_context_engine]
    description: Merge SUP detection into context engine
    priority: MEDIUM

  - timestamp: pending
    operator: SYN
    target: [eo_integration, eo_import_integration, eo_three_level_integration]
    description: Consolidate into single app controller
    priority: MEDIUM

  - timestamp: pending
    operator: INS
    target: eo_state
    description: Create centralized state management
    priority: HIGH

  - timestamp: pending
    operator: INS
    target: eo_event_bus
    description: Create cross-module event system
    priority: HIGH

  - timestamp: pending
    operator: CON
    target: all modules
    description: Define standard module interface protocol
    priority: HIGH

  - timestamp: pending
    operator: REC
    target: eo_context_engine
    description: Add learning from user corrections
    priority: LOW

  - timestamp: pending
    operator: ALT
    target: eo_lean_context
    description: Add scheduled cache cleanup rhythm
    priority: LOW
```

### Stability Expectations

| Module | Current | Target | Timeframe |
|--------|---------|--------|-----------|
| eo_graph | Stable | Stable | Maintain |
| eo_lean_context | Stable | Stable | Maintain |
| eo_data_structures | Stable | Stable | Maintain |
| eo_import_manager | Stable | Stable | Maintain |
| eo_toss_pile | Stable | Stable | Maintain |
| eo_context_engine | Stable | Stable | Merge SUP detector |
| eo_workbench_ui | Forming | Stable | After SEG refactor |
| eo_layout_management | Forming | Stable | After UI cleanup |
| eo_formula_engine | Forming | Stable | After parser extraction |
| eo_integration | Emerging | Deleted | SYN or remove |

---

## Recommended Refactor Sequence

### Phase A: Foundation (Weeks 1-2)
1. **INS** `eo_state.js` — Centralized state contract
2. **INS** `eo_event_bus.js` — Event-based communication
3. **CON** Define module interface protocol in JSDoc

### Phase B: Consolidation (Weeks 3-4)
4. **SYN** Merge emanon modules (integration files)
5. **SYN** Merge `eo_sup_detector` into `eo_context_engine`
6. **DELETE** Unused integration files after merge

### Phase C: Segmentation (Weeks 5-6)
7. **SEG** Split `eo_workbench_ui` into ui/events/state
8. **SEG** Extract formula parser from formula UI
9. **CON** Wire up event bus between new modules

### Phase D: Rhythms & Recursion (Week 7+)
10. **ALT** Add operational rhythms (auto-save, cache cleanup)
11. **REC** Add learning capabilities to context engine
12. **REC** Add adaptive thresholds to stability classifier

---

## Architecture Vision After Refactor

```
┌─────────────────────────────────────────────────────────────────┐
│                        EO ACTIVIBASE                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    STATE LAYER                            │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │  eo_state   │  │ eo_event_bus│  │ eo_types    │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↕                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   SERVICE HOLONS                          │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │ │
│  │  │eo_graph │ │eo_import│ │eo_toss  │ │eo_context│        │ │
│  │  │(CON,SEG)│ │(INS,SYN)│ │(NUL,INS)│ │(DES,SUP) │        │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↕                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    UI LAYER                               │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │ │
│  │  │workbench│ │  modals │ │ panels  │ │ formula │        │ │
│  │  │   ui    │ │         │ │         │ │   ui    │        │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   RHYTHMS (ALT)                           │ │
│  │  Auto-save (30s) │ Cache cleanup (15m) │ Stability (5m)  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

---

## Refactoring Log

### 2025-12-06: Phase A & B Implementation

**Phase A: Foundation Layer (COMPLETED)**

| Module | Status | Description |
|--------|--------|-------------|
| `eo_state.js` | CREATED | Centralized state management with schema validation, subscriptions, history/undo |
| `eo_event_bus.js` | CREATED | Cross-module event communication with typed events and middleware support |
| `eo_types.js` | CREATED | JSDoc type definitions for IDE autocomplete and documentation |

**Phase B: Consolidation (COMPLETED)**

| Action | Status | Description |
|--------|--------|-------------|
| SUP → Context Engine | MERGED | `eo_sup_detector.js` functionality merged into `eo_context_engine.js` |
| Integration → App Controller | CREATED | `eo_app_controller.js` consolidates all integration modules |

**Phase D: Rhythms (COMPLETED)**

Operational rhythms added to `eo_event_bus.js` and `eo_app_controller.js`:
- Auto-save rhythm (30 seconds)
- Cache cleanup rhythm (5 minutes)
- Stability recalculation rhythm (5 minutes)

**Files Modified:**
- `demo/eo_context_engine.js` - Added SUP detection methods, backward-compatible EOSUPDetector class
- `demo/eo_sup_detector.js` - Replaced with deprecation notice (delegates to context_engine)

**Files Created:**
- `eo_state.js` - EOStateManager class with schema, subscriptions, history
- `eo_event_bus.js` - EOEventBus class with typed events, RhythmManager
- `eo_types.js` - EOTypes with validators and ID generators
- `eo_app_controller.js` - EOAppController unified coordination layer

**New Architecture Diagram:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEW FOUNDATION LAYER                        │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ eo_state.js  │  │ eo_event_bus.js │  │   eo_types.js    │   │
│  │   (State)    │  │    (Events)     │  │    (Types)       │   │
│  └──────────────┘  └─────────────────┘  └──────────────────┘   │
│                           ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            eo_app_controller.js (Coordinator)           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     EO CORE FRAMEWORK                           │
│  (eo_graph, eo_lean_context, eo_provenance, eo_workbench_ui)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER (demo/)                     │
│  (import_manager, toss_pile, formula_engine, context_engine)   │
└─────────────────────────────────────────────────────────────────┘
```

**Remaining Work (Phase C):**
- [ ] SEG split `eo_workbench_ui.js` into ui/events/state modules
- [ ] Wire existing modules to use new EOState and EOEventBus
- [ ] Add integration tests for new foundation layer

---

**End of EO Architecture Manifest**

*This manifest should be reviewed and updated after each significant refactor.*
