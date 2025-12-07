# EO-Aligned Codebase Optimization Roadmap

## Executive Summary

This document presents a comprehensive optimization plan for the eo-activibase codebase, designed to leverage EO (Epistemic Observability) principles for organic, self-sustaining growth.

**Core Insight:** The codebase has strong EO theoretical foundations but weak operational implementation. The system should "eat its own dogfood" — apply EO operators to organize its own architecture.

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
- [ ] Zero duplicate ID generation patterns
- [ ] 100% of constants in eo_constants.js
- [ ] All modules registered in eo_registry.js

### EO Alignment
- [ ] All 9 operators have framework implementations
- [ ] Every transformation uses operator executor
- [ ] Every module classified by primary operator
- [ ] Lineage tracked for all computed values

### Growth Readiness
- [ ] New operators addable via plugin
- [ ] New aggregations addable without core changes
- [ ] Schema changes via migration system
- [ ] Test coverage > 60%

---

## Appendix: File Classification by Operator

### Current Classification

| Operator | Files | Purpose |
|----------|-------|---------|
| **DES** | eo_types.js, eo_graph.js | Type definitions, operators |
| **INS** | eo_state.js, eo_import_manager.js | State/data creation |
| **SEG** | (none explicit) | Filtering/partitioning |
| **CON** | eo_relations_manager.js, eo_graph_integration.js | Relationships |
| **ALT** | eo_view_management.js, eo_layout_management.js | View switching |
| **SYN** | eo_formula_engine.js, eo_rollup_engine.js, eo_app_controller.js | Aggregation/coordination |
| **SUP** | eo_context_engine.js | Multi-value handling |
| **REC** | eo_provenance_extractor.js | Lineage tracking |
| **NUL** | (none explicit) | Absence detection |

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
