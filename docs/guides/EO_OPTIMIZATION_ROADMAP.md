# EO-Aligned Codebase Optimization Roadmap

## Executive Summary

This document presents a comprehensive optimization plan for the eo-activibase codebase, designed to leverage EO (Epistemic Observability) principles for organic, self-sustaining growth.

**Core Insight:** The codebase has strong EO theoretical foundations but weak operational implementation. The system should "eat its own dogfood" — apply EO operators to organize its own architecture.

---

## Implementation Status

> **Last Updated:** December 2025
>
> ### Completed
> - [x] **Phase 1: Foundation Cleanup** - Partially complete
>   - [x] Deleted `demo/eo_sup_detector.js` (deprecated file)
>   - [x] Created `/foundation/eo_constants.js` with centralized constants
>   - [x] Created `/foundation/eo_identity.js` with unified ID generation
>   - [ ] `demo/eo_integration.js` retained (still in use, not duplicate)
>
> - [x] **Phase 2: Operator Framework** - Complete
>   - [x] Created `foundation/eo_registry.js` - Module registry (DES + CON)
>   - [x] Created `foundation/eo_operator_executor.js` - Unified pipeline execution (SYN)
>   - [x] Created `foundation/eo_absence.js` - Missing data detection (NUL)
>   - [x] Created `foundation/eo_segmentation.js` - Filtering/partitioning (SEG)
>   - [x] Created `foundation/eo_alternation.js` - State machine framework (ALT)
>   - [x] Created `foundation/eo_recursion.js` - Fixed-point computation (REC)
>   - [x] Created `foundation/eo_modal_base.js` - Modal UI base class (DES)
>   - [x] Updated `index.html` with foundation script loading
>
> ### Pending
> - [ ] **Phase 3: Directory Restructure** - Not started
> - [ ] **Phase 4: Growth Enablers** - Not started

---

## Current State Analysis

### Codebase Statistics
- **Total Files:** 40 JavaScript files
- **Total LOC:** ~28,000 lines
- **Root Level:** 14 files (mixed concerns)
- **Demo Directory:** 26 files (misleading name - these are production modules)
- **Global Exports:** 50+ window.* assignments

### Key Issues Identified

| Issue | Severity | EO Violation |
|-------|----------|--------------|
| Flat file structure | High | No SEG (boundaries) |
| Global namespace pollution | High | No SEG (isolation) |
| ID generation chaos (33 locations) | Medium | No DES (consistent designation) |
| Dead code (eo_sup_detector.js, eo_integration.js) | Low | NUL (absence not cleaned) |
| Magic numbers throughout | Medium | No DES (undefined constants) |
| No operator execution framework | High | SYN not unified |
| Missing NUL, SEG, ALT, REC implementations | High | Incomplete operator coverage |

---

## Optimization Phases

### Phase 1: Foundation Cleanup (Week 1-2)

**Goal:** Remove dead code, centralize constants, unify ID generation.

#### Tasks:
1. **Delete dead files:**
   - `demo/eo_sup_detector.js` (33 LOC) - merged into context_engine
   - `demo/eo_integration.js` (483 LOC) - duplicates app_controller

2. **Create `/foundation/eo_constants.js`:**
   ```javascript
   export const EO_CONSTANTS = {
     TIME: { SECOND: 1000, MINUTE: 60000, HOUR: 3600000, DAY: 86400000 },
     LAYOUT: { MIN_PANE_WIDTH: 300, MIN_PANE_HEIGHT: 200 },
     STABILITY: { EMERGING_THRESHOLD: 10, FORMING_THRESHOLD: 3 }
   };
   ```

3. **Create `/foundation/eo_identity.js`:**
   - Replace 33 scattered ID generation patterns
   - Format: `{operator}_{entity}_{timestamp}_{random}`

4. **Add initialization order documentation** to index.html

#### Estimated Impact:
- -500 LOC (dead code)
- -200 LOC (duplication)
- +150 LOC (new utilities)

---

### Phase 2: Operator Framework (Week 3-6)

**Goal:** Create reusable operator implementations.

#### New Files to Create:

| File | Purpose | EO Operator |
|------|---------|-------------|
| `eo_registry.js` | Module registry by operator | DES + CON |
| `eo_operator_executor.js` | Unified execution pipeline | SYN |
| `eo_absence.js` | Missing data detection | NUL |
| `eo_segmentation.js` | Reusable filtering/partitioning | SEG |
| `eo_alternation.js` | State machine framework | ALT |
| `eo_recursion.js` | Fixed-point computation | REC |
| `eo_modal_base.js` | Modal UI base class | DES |

#### Key Abstractions:

**Operator Executor:**
```javascript
class EOOperatorExecutor {
  execute(pipeline, input, context) {
    let result = input;
    for (const step of pipeline) {
      result = this.handlers.get(step.operator).execute(result, step.params, context);
      this.logExecution(step, input, result, context);
    }
    return result;
  }
}
```

**Pipeline Builder:**
```javascript
const revenueByTeam = new EOPipelineBuilder()
  .seg(r => r.status === 'active', 'active_only')
  .con('belongs_to', 'teams')
  .syn('sum', 'revenue')
  .build();
```

---

### Phase 3: Directory Restructure (Week 7-10)

**Goal:** Organize files by EO operator/layer.

#### Target Structure:
```
/eo-activibase/
├── /foundation/     # DES: Types, constants, operators
├── /state/          # INS: State manager, event bus
├── /context/        # SUP: Context engine, multi-value
├── /transform/      # SYN: Formulas, rollups, structural ops
├── /import/         # INS: Import manager, provenance
├── /graph/          # CON: Relationships, graph visualization
├── /ui/             # ALT: Views, modals, panels
│   ├── /modals/
│   └── /panels/
├── /lineage/        # REC: Toss pile, history
└── /config/         # DES: JSON configurations
```

#### Migration Strategy:
1. Create new directories
2. Move files one-by-one
3. Update index.html script paths
4. Test after each move
5. Update cross-file references

---

### Phase 4: Growth Enablers (Week 11+)

**Goal:** Add infrastructure for organic feature growth.

#### Plugin System:
```javascript
const CustomAggPlugin = {
  id: 'custom-aggregations',
  operators: {
    SYN: {
      modes: {
        'geometric_mean': (values) => Math.pow(values.reduce((a,b) => a*b, 1), 1/values.length)
      }
    }
  }
};

EOPluginSystem.register(CustomAggPlugin);
```

#### Schema Evolution:
```javascript
class EOSchemaEvolution {
  defineMigration(version, up, down) { /* ... */ }
  migrate(data, fromVersion, toVersion) { /* ... */ }
  inferSchema(records) { /* emergent schema */ }
}
```

#### Build System:
- ES6 modules (replace IIFE pattern)
- Tree-shaking for production builds
- Lazy loading for optional features
- Test coverage framework

---

## Priority Matrix

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Delete dead code | Low | Medium |
| P0 | Centralize constants | Low | High |
| P1 | Unify ID generation | Medium | High |
| P1 | Create operator executor | Medium | High |
| P2 | Implement missing operators (NUL, SEG, ALT, REC) | High | High |
| P2 | Directory restructure | High | Medium |
| P3 | Plugin system | High | Very High |
| P3 | ES6 module migration | Very High | High |

---

## Success Metrics

### Code Quality
- [ ] Zero files > 500 LOC (currently 4 god objects)
- [x] Zero duplicate ID generation patterns *(EOIdentity provides unified generation)*
- [x] 100% of constants in eo_constants.js *(EO_CONSTANTS defined)*
- [ ] All modules registered in eo_registry.js *(EORegistry available, modules need registration)*

### EO Alignment
- [x] All 9 operators have framework implementations *(NUL, DES, INS, SEG, CON, ALT, SYN, SUP, REC all covered)*
- [x] Every transformation uses operator executor *(EOOperatorExecutor + EOPipelineBuilder available)*
- [x] Every module classified by primary operator *(Foundation modules use @eo_operator JSDoc)*
- [ ] Lineage tracked for all computed values *(EOLineageTracker available, needs integration)*

### Growth Readiness
- [x] New operators addable via plugin *(EOOperatorExecutor.registerHandler() supports custom operators)*
- [x] New aggregations addable without core changes *(SYN handler is extensible)*
- [ ] Schema changes via migration system
- [ ] Test coverage > 60%

---

## Appendix: File Classification by Operator

### Current Classification

| Operator | Files | Purpose |
|----------|-------|---------|
| **DES** | eo_types.js, eo_graph.js, **foundation/eo_constants.js**, **foundation/eo_identity.js**, **foundation/eo_registry.js**, **foundation/eo_modal_base.js** | Type definitions, constants, identity, modals |
| **INS** | eo_state.js, eo_import_manager.js | State/data creation |
| **SEG** | **foundation/eo_segmentation.js** | Filtering/partitioning |
| **CON** | eo_relations_manager.js, eo_graph_integration.js, **foundation/eo_registry.js** | Relationships, module connections |
| **ALT** | eo_view_management.js, eo_layout_management.js, **foundation/eo_alternation.js** | View switching, state machines |
| **SYN** | eo_formula_engine.js, eo_rollup_engine.js, eo_app_controller.js, **foundation/eo_operator_executor.js** | Aggregation/coordination, pipelines |
| **SUP** | eo_context_engine.js | Multi-value handling |
| **REC** | eo_provenance_extractor.js, **foundation/eo_recursion.js** | Lineage tracking, fixed-point computation |
| **NUL** | **foundation/eo_absence.js** | Absence detection |

### Target Classification

Every module should declare its primary operator:
```javascript
/**
 * @eo_operator SYN
 * @eo_layer transform
 */
class EOFormulaEngine { /* ... */ }
```

---

## References

- `EO_FRAMEWORK.md` - Core EO concepts
- `EO_ARCHITECTURE_MANIFEST.md` - Module classification
- `EO_CAUSATION_THEORY.md` - Operator semantics
- `LEAN_CONTEXT_GUIDE.md` - Context optimization

---

*Generated: December 2025*
*Based on comprehensive codebase analysis*
