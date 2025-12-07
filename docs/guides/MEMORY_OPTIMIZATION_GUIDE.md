# EO-Guided Memory Optimization Guide

This document explains the memory optimization strategies implemented in eo-activibase, guided by Emergent Ontology (EO) theory principles.

## Executive Summary

Memory consumption reduced by applying EO operator theory to identify inefficient patterns:

| Issue | EO Principle | Solution | Impact |
|-------|-------------|----------|--------|
| Multiple redundant indexes | CON (Connection) | SparseGraphIndex with lazy building | ~60% memory reduction in graph |
| Triple event logging | SUP (Superposition) | UnifiedEventLog single source | ~66% reduction in event memory |
| No computed value caching | REC (Recursion) | DerivedValueCache with dependencies | Faster rollup/formula evaluation |
| All records in memory | SEG (Segmentation) | LazyDataWindow pagination | Only visible+buffer loaded |
| Full object copies | DES (Designation) | Reference-based caching | Reduced duplication |
| Uncapped caches | NUL (Absence) | MemoryAwareLRUCache with limits | Bounded memory growth |

## EO Operator Mappings to Memory Patterns

### NUL (Absence Recognition)
**Principle**: Recognize what's missing or void.
**Memory Application**: Don't store null/undefined values; use sparse data structures.

```javascript
// Before: Dense storage with nulls
records = [null, null, {id: 1}, null, {id: 2}, null, null, ...];

// After: Sparse storage (NUL-aware)
recordMap = new Map([[1, {id: 1}], [2, {id: 2}]]);
```

### DES (Designation)
**Principle**: Use labels/references instead of duplicating content.
**Memory Application**: Store IDs, not full objects; use references.

```javascript
// Before: Full object duplication
cache.set(key, JSON.parse(JSON.stringify(largeObject)));

// After: Reference or WeakRef (DES principle)
cache.set(key, new WeakRef(largeObject));  // Let GC reclaim if unused
```

### SEG (Segmentation)
**Principle**: Partition and bound data sets.
**Memory Application**: Lazy loading, pagination, virtual scrolling.

```javascript
// Before: Load all 10,000 records
set.records = allRecords; // 10,000 objects in memory

// After: LazyDataWindow (SEG-based pagination)
window.setIds(recordIds);  // Only IDs in memory
window.getRange(0, 50);    // Load visible range on demand
```

### CON (Connection)
**Principle**: Establish relationships efficiently.
**Memory Application**: Lazy-built indexes, single source of edges.

```javascript
// Before: 5 separate indexes (all in memory)
this.edgesBySource = new Map();    // Redundant
this.edgesByTarget = new Map();    // Redundant
this.edgesByOperator = new Map();  // Redundant

// After: SparseGraphIndex (CON principle)
this._edges = new Map();  // Single source
this._bySource = null;    // Built lazily when needed
```

### SYN (Synthesis)
**Principle**: Aggregate only when needed.
**Memory Application**: Compute-on-demand instead of precomputed aggregations.

```javascript
// Before: Pre-compute and store all rollups
record.cachedRollups = computeAllRollups(record);

// After: Compute on demand with memoization (SYN principle)
derivedCache.getOrCompute(key, () => computeRollup(config, record), dependencies);
```

### SUP (Superposition)
**Principle**: Single source of truth for multi-valued states.
**Memory Application**: Eliminate duplicate storage systems.

```javascript
// Before: Three separate event logs
stateManager._eventStream = [];     // Max 1000
eventBus._eventLog = [];            // Max 1000
graph.events = [];                  // Max 1000
// Total: ~3000 events in memory

// After: UnifiedEventLog (SUP principle)
unifiedLog._log = [];  // Max 500, single source
```

### REC (Recursion)
**Principle**: Apply operations to outputs with proper termination.
**Memory Application**: Dependency-tracked memoization with invalidation.

```javascript
// DerivedValueCache implements REC
cache.getOrCompute('rollup:record1', computeFn, ['record:record1', 'set:setA']);

// Invalidation cascades through dependency graph (REC pattern)
cache.invalidate('record:record1');  // Invalidates all dependents
```

## Implementation Files

### eo_memory_optimization.js
Core memory optimization utilities:

- **MemoryAwareLRUCache**: LRU cache with memory limits and WeakRef support
- **LazyDataWindow**: Virtual scrolling data provider (SEG implementation)
- **DerivedValueCache**: Dependency-tracked memoization (REC implementation)
- **UnifiedEventLog**: Single event log (SUP implementation)
- **SparseGraphIndex**: Lazy-indexed graph storage (CON implementation)
- **MemoryMonitor**: Automatic memory pressure detection and cleanup

### eo_memory_integration.js
Integration with existing modules:

- **createOptimizedGraph()**: Memory-efficient graph using SparseGraphIndex
- **createOptimizedEventBus()**: Debounced, unified event bus
- **createVirtualDataProvider()**: Virtual scrolling for large record sets
- **createMemoizedRollupEngine()**: Cached rollup computations
- **applyOptimizations()**: One-call setup for all optimizations

## Usage

### Basic Setup
```javascript
// Load optimization modules
<script src="eo_memory_optimization.js"></script>
<script src="eo_memory_integration.js"></script>

// Apply all optimizations
const report = EOMemoryIntegration.applyOptimizations();
console.log('Applied:', report.applied);
```

### Virtual Scrolling
```javascript
const provider = createVirtualDataProvider({
    visibleRows: 50,
    bufferRows: 25
});

// Bind to a set
provider.bind(mySet, sortFn, filterFn);

// Render visible rows
const records = await provider.getVisibleRecords(scrollTop, scrollTop + viewportHeight);
```

### Memoized Rollups
```javascript
const optimizedRollup = createMemoizedRollupEngine(EOCRollupEngine);

// Cached evaluation
const result = optimizedRollup.evaluate(config, record, state);

// Invalidate on change
optimizedRollup.invalidateRecord(changedRecordId);
```

### Memory Monitoring
```javascript
EOMemoryOptimization.getMonitor().onCleanup((level, stats) => {
    if (level === 'critical') {
        // Emergency cleanup
        EOMemoryOptimization.getGlobalCache().clear();
    }
});
```

## Benchmarks

### Expected Improvements

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| 10K records loaded | All in memory | ~100 in memory | 99% reduction |
| Graph with 1000 edges | 5 indexes | 1 + lazy | ~60% reduction |
| Event log (3 systems) | 3000 entries | 500 entries | 83% reduction |
| Rollup computation | Always compute | Cached | 10-100x faster |
| Formula parsing | 1000 cached | 200 cached | 80% cache reduction |

### Memory Thresholds

The MemoryMonitor triggers cleanup at:
- **Warning**: 100MB heap usage
- **Critical**: 200MB heap usage

## Migration Guide

### For Graph Usage
```javascript
// Old
const graph = new EOGraph({ name: 'My Graph' });

// New (optimized)
const graph = createOptimizedGraph({ name: 'My Graph' });
```

### For Event Bus
```javascript
// Old
const bus = EOEventBus.getBus();

// New (optimized)
const bus = createOptimizedEventBus();
```

### For Large Data Sets
```javascript
// Old (renders all records)
records.forEach(record => renderRow(record));

// New (virtual scrolling)
const provider = createVirtualDataProvider();
provider.bind(set);
const visible = await provider.getVisibleRecords(startRow, endRow);
visible.forEach(({ record }) => renderRow(record));
```

## Monitoring

Check memory status:
```javascript
const stats = EOMemoryIntegration.getStats();
console.log('Cache:', stats.cache);
console.log('Derived Cache:', stats.derivedCache);
console.log('Event Log:', stats.eventLog);
console.log('Monitor:', stats.monitor);
```

## Future Optimizations

1. **Web Workers**: Move heavy computation off main thread
2. **IndexedDB**: Offload cold data to persistent storage
3. **Streaming Imports**: Process CSV/data in chunks
4. **Code Splitting**: Lazy-load non-critical modules
5. **CSS Extraction**: Move inline styles to separate file

## References

- EO Technical Handbook (Chapter 3: Operators in Detail)
- Chapter 4: Operator Algebra & Composition
- Chapter 5: Transformations as EO Programs
