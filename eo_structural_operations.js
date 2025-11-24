/**
 * EO Structural Operations
 *
 * This module implements structural operations on data: dedupe, merge, split, harmonize.
 * Each operation produces new entities and a result view showing provenance.
 *
 * Key principles:
 * - Operations are first-class entities tracked with full provenance
 * - Every operation creates a result view showing inputs and outputs
 * - Operations can be reverted, creating new operations that inverse the effect
 * - Provenance constitutes position in knowledge space (not just metadata)
 */

// ============================================================================
// STRUCTURAL OPERATION MODEL
// ============================================================================

/**
 * Create a structural operation entity
 */
function createStructuralOperation(config) {
    const id = config.id || `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return {
        id,
        kind: config.kind, // 'dedupe' | 'merge_records' | 'split_record' | 'merge_fields' | 'split_field' | 'definition_reconcile' | 'context_reconcile'

        // Context
        setId: config.setId || null,
        viewId: config.viewId || null, // view from which operation was executed

        // Inputs
        inputRecordIds: config.inputRecordIds || [],
        inputFieldIds: config.inputFieldIds || [],
        inputDefinitionIds: config.inputDefinitionIds || [],

        // Outputs
        outputRecordIds: config.outputRecordIds || [],
        outputFieldIds: config.outputFieldIds || [],
        outputDefinitionIds: config.outputDefinitionIds || [],

        // Configuration
        parameters: config.parameters || {}, // settings, thresholds, strategies

        // Result
        resultViewId: config.resultViewId || null,

        // Provenance
        createdAt: config.createdAt || Date.now(),
        createdBy: config.createdBy || 'system',
        status: config.status || 'draft', // 'draft' | 'applied' | 'reverted'
        notes: config.notes || '',

        // Metadata
        summary: config.summary || null, // human-readable summary
        warnings: config.warnings || [],
        errors: config.errors || []
    };
}

// ============================================================================
// OPERATION MANAGEMENT
// ============================================================================

/**
 * Register a structural operation in state
 */
function createOperation(state, config) {
    if (!state.structuralOperations) {
        state.structuralOperations = new Map();
    }

    const operation = createStructuralOperation(config);
    state.structuralOperations.set(operation.id, operation);

    logEvent(state, {
        type: 'operation_created',
        entityType: 'StructuralOperation',
        entityId: operation.id,
        data: {
            kind: operation.kind,
            setId: operation.setId,
            status: operation.status
        }
    });

    return operation;
}

/**
 * Update an operation (e.g., to set status, result view, outputs)
 */
function updateOperation(state, operationId, patch) {
    const op = state.structuralOperations?.get(operationId);
    if (!op) {
        console.warn(`Operation ${operationId} not found`);
        return null;
    }

    const updated = {
        ...op,
        ...patch,
        id: op.id
    };

    state.structuralOperations.set(operationId, updated);

    logEvent(state, {
        type: 'operation_updated',
        entityType: 'StructuralOperation',
        entityId: operationId,
        data: { changes: Object.keys(patch) }
    });

    return updated;
}

// ============================================================================
// DEDUPE RECORDS
// ============================================================================

/**
 * Find duplicate record candidates based on key fields
 */
function findDuplicateCandidates(state, setId, options = {}) {
    const set = state.sets.get(setId);
    if (!set) return [];

    const keyFieldIds = options.keyFieldIds || [];
    const threshold = options.threshold || 0.85;
    const algorithm = options.algorithm || 'exact'; // 'exact' | 'fuzzy'

    if (keyFieldIds.length === 0) {
        console.warn('No key fields specified for deduplication');
        return [];
    }

    const records = Array.from(set.records.values());
    const clusters = [];
    const processed = new Set();

    for (let i = 0; i < records.length; i++) {
        const recA = records[i];
        if (processed.has(recA.id)) continue;

        const cluster = [recA];
        processed.add(recA.id);

        // Build signature for record A
        const sigA = buildSignature(recA, keyFieldIds);
        if (!sigA) continue; // skip if all key fields are empty

        // Compare with remaining records
        for (let j = i + 1; j < records.length; j++) {
            const recB = records[j];
            if (processed.has(recB.id)) continue;

            const sigB = buildSignature(recB, keyFieldIds);
            if (!sigB) continue;

            const similarity = calculateSimilarity(sigA, sigB, algorithm);

            if (similarity >= threshold) {
                cluster.push(recB);
                processed.add(recB.id);
            }
        }

        if (cluster.length > 1) {
            clusters.push({
                records: cluster,
                signature: sigA,
                count: cluster.length
            });
        }
    }

    return clusters;
}

/**
 * Build a signature string from key fields
 */
function buildSignature(record, keyFieldIds) {
    const parts = keyFieldIds
        .map(fieldId => {
            const value = record[fieldId];
            if (value == null || value === '') return null;
            return String(value).toLowerCase().trim();
        })
        .filter(Boolean);

    return parts.length > 0 ? parts.join('|||') : null;
}

/**
 * Calculate similarity between two signatures
 */
function calculateSimilarity(sigA, sigB, algorithm) {
    if (algorithm === 'exact') {
        return sigA === sigB ? 1.0 : 0.0;
    }

    // Simple fuzzy matching using Jaccard similarity
    const setA = new Set(sigA.split(/\s+/));
    const setB = new Set(sigB.split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return union.size > 0 ? intersection.size / union.size : 0.0;
}

/**
 * Create a dedupe candidates view
 */
function createDedupeCandidatesView(state, setId, clusters, operationId) {
    const set = state.sets.get(setId);
    if (!set) return null;

    // Create a synthetic field to group duplicates
    const groupField = {
        id: '_duplicateGroup',
        name: 'Duplicate Group',
        type: 'text'
    };

    // Annotate records with group IDs
    clusters.forEach((cluster, idx) => {
        const groupId = `group_${idx + 1}`;
        cluster.records.forEach(rec => {
            rec._duplicateGroup = groupId;
            rec._duplicateCount = cluster.count;
        });
    });

    // Create view
    const view = {
        setId,
        name: `Duplicate Candidates - ${new Date().toLocaleString()}`,
        type: 'grid',
        visibleFieldIds: ['_duplicateGroup', '_duplicateCount', ...(set.schema || []).map(f => f.id)],
        sorts: [{ fieldId: '_duplicateGroup', direction: 'asc' }],
        groups: [{ fieldId: '_duplicateGroup' }],
        derivedFromOperationIds: [operationId],
        notes: `Found ${clusters.length} groups with ${clusters.reduce((sum, c) => sum + c.count, 0)} total records`
    };

    return createView(state, view);
}

// ============================================================================
// MERGE RECORDS
// ============================================================================

/**
 * Merge multiple records into one
 * @param resolveField - function(fieldId, candidates) => chosen value
 */
function mergeRecords(state, setId, recordIds, resolveField, options = {}) {
    const set = state.sets.get(setId);
    if (!set) return null;

    const records = recordIds.map(id => set.records.get(id)).filter(Boolean);
    if (records.length === 0) return null;

    const schema = set.schema || [];
    const newRecord = {};

    // Resolve each field
    schema.forEach(field => {
        const fieldId = field.id;
        const candidates = records
            .map(r => r[fieldId])
            .filter(v => v !== undefined && v !== null && v !== '');

        if (candidates.length > 0) {
            newRecord[fieldId] = resolveField(fieldId, candidates, field);
        }
    });

    // Create new record
    const newId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    newRecord.id = newId;
    newRecord._mergedFrom = recordIds;
    newRecord._mergedAt = Date.now();

    set.records.set(newId, newRecord);

    // Mark original records as superseded
    if (options.markSuperseded !== false) {
        records.forEach(rec => {
            rec._supersededBy = newId;
            rec._supersededAt = Date.now();
            if (options.hideSuperseded) {
                rec._hidden = true;
            }
        });
    }

    logEvent(state, {
        type: 'records_merged',
        entityType: 'Record',
        entityId: newId,
        data: {
            setId,
            inputRecordIds: recordIds,
            outputRecordId: newId
        }
    });

    return newRecord;
}

/**
 * Default field resolution strategies
 */
const MERGE_STRATEGIES = {
    // Take first non-empty value
    first: (candidates) => candidates[0],

    // Take last non-empty value
    last: (candidates) => candidates[candidates.length - 1],

    // Take longest value
    longest: (candidates) => candidates.reduce((a, b) => String(a).length > String(b).length ? a : b),

    // Take most recent (if field is a date)
    mostRecent: (candidates) => {
        const dates = candidates.map(c => new Date(c)).filter(d => !isNaN(d));
        return dates.length > 0 ? dates.reduce((a, b) => a > b ? a : b) : candidates[0];
    },

    // Concatenate all unique values
    concat: (candidates) => [...new Set(candidates)].join('; '),

    // Take numeric max
    max: (candidates) => Math.max(...candidates.map(Number)),

    // Take numeric min
    min: (candidates) => Math.min(...candidates.map(Number)),

    // Take numeric average
    average: (candidates) => {
        const nums = candidates.map(Number).filter(n => !isNaN(n));
        return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    }
};

/**
 * Perform merge operation with result view
 */
function executeMergeOperation(state, setId, recordIds, strategyMap, options = {}) {
    // Create operation
    const operation = createOperation(state, {
        kind: 'merge_records',
        setId,
        viewId: state.currentViewId,
        inputRecordIds: recordIds,
        parameters: { strategies: strategyMap, options },
        status: 'draft'
    });

    // Resolve fields using strategy map
    const resolveField = (fieldId, candidates, field) => {
        const strategyName = strategyMap[fieldId] || strategyMap['_default'] || 'first';
        const strategy = MERGE_STRATEGIES[strategyName] || MERGE_STRATEGIES.first;
        return strategy(candidates, field);
    };

    // Execute merge
    const newRecord = mergeRecords(state, setId, recordIds, resolveField, options);
    if (!newRecord) {
        return null;
    }

    // Update operation with output
    updateOperation(state, operation.id, {
        outputRecordIds: [newRecord.id],
        status: 'applied',
        summary: `Merged ${recordIds.length} records into 1`
    });

    // Create result view
    const resultView = createView(state, {
        setId,
        name: `Merge Result - ${new Date().toLocaleString()}`,
        type: 'grid',
        filters: [
            { fieldId: 'id', operator: 'in', value: [newRecord.id, ...recordIds] }
        ],
        visibleFieldIds: ['_supersededBy', '_mergedFrom', ...(state.sets.get(setId).schema || []).map(f => f.id)],
        derivedFromOperationIds: [operation.id],
        notes: `Result of merging ${recordIds.length} records`
    });

    updateOperation(state, operation.id, { resultViewId: resultView.id });

    return {
        operation,
        newRecord,
        resultView
    };
}

// ============================================================================
// SPLIT RECORD
// ============================================================================

/**
 * Split a single record into multiple records
 */
function splitRecord(state, setId, recordId, newRecordsData, options = {}) {
    const set = state.sets.get(setId);
    if (!set) return [];

    const original = set.records.get(recordId);
    if (!original) return [];

    const outputs = newRecordsData.map((data, idx) => {
        const id = `rec_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
        const record = {
            ...original, // inherit all fields
            ...data,     // override with new data
            id,
            _splitFrom: recordId,
            _splitAt: Date.now(),
            _splitIndex: idx
        };
        set.records.set(id, record);
        return record;
    });

    // Mark original as split
    if (options.markSplit !== false) {
        original._splitInto = outputs.map(r => r.id);
        original._splitAt = Date.now();
        if (options.hideOriginal) {
            original._hidden = true;
        }
    }

    logEvent(state, {
        type: 'record_split',
        entityType: 'Record',
        entityId: recordId,
        data: {
            setId,
            inputRecordId: recordId,
            outputRecordIds: outputs.map(r => r.id),
            count: outputs.length
        }
    });

    return outputs;
}

/**
 * Execute split operation with result view
 */
function executeSplitOperation(state, setId, recordId, newRecordsData, options = {}) {
    const operation = createOperation(state, {
        kind: 'split_record',
        setId,
        viewId: state.currentViewId,
        inputRecordIds: [recordId],
        parameters: { count: newRecordsData.length, options },
        status: 'draft'
    });

    const outputs = splitRecord(state, setId, recordId, newRecordsData, options);
    if (outputs.length === 0) {
        return null;
    }

    updateOperation(state, operation.id, {
        outputRecordIds: outputs.map(r => r.id),
        status: 'applied',
        summary: `Split 1 record into ${outputs.length} records`
    });

    // Create result view showing original and splits
    const resultView = createView(state, {
        setId,
        name: `Split Result - ${new Date().toLocaleString()}`,
        type: 'grid',
        filters: [
            { fieldId: 'id', operator: 'in', value: [recordId, ...outputs.map(r => r.id)] }
        ],
        visibleFieldIds: ['_splitFrom', '_splitInto', '_splitIndex', ...(state.sets.get(setId).schema || []).map(f => f.id)],
        sorts: [{ fieldId: '_splitIndex', direction: 'asc' }],
        derivedFromOperationIds: [operation.id],
        notes: `Result of splitting record ${recordId} into ${outputs.length} records`
    });

    updateOperation(state, operation.id, { resultViewId: resultView.id });

    return {
        operation,
        outputs,
        resultView
    };
}

// ============================================================================
// MERGE FIELDS (FIELD HARMONIZATION)
// ============================================================================

/**
 * Merge multiple fields into a canonical field
 */
function mergeFields(state, setId, fieldIds, canonicalField, options = {}) {
    const set = state.sets.get(setId);
    if (!set) return null;

    const schema = set.schema || [];
    const canonicalId = canonicalField.id || `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Add canonical field to schema if not exists
    if (!schema.find(f => f.id === canonicalId)) {
        schema.push({
            ...canonicalField,
            id: canonicalId
        });
    }

    // Merge values from old fields into canonical field
    let recordsUpdated = 0;
    const strategy = options.strategy || 'first'; // 'first' | 'concat' | 'coalesce'

    set.records.forEach(rec => {
        const values = fieldIds
            .map(fid => rec[fid])
            .filter(v => v !== undefined && v !== null && v !== '');

        if (values.length > 0) {
            if (strategy === 'first') {
                rec[canonicalId] = values[0];
            } else if (strategy === 'concat') {
                rec[canonicalId] = values.join('; ');
            } else if (strategy === 'coalesce') {
                rec[canonicalId] = rec[canonicalId] || values[0];
            }
            recordsUpdated++;
        }
    });

    // Mark old fields as deprecated (keep for provenance)
    if (options.deprecateOldFields !== false) {
        schema.forEach(f => {
            if (fieldIds.includes(f.id) && f.id !== canonicalId) {
                f._deprecated = true;
                f._deprecatedAt = Date.now();
                f._mergedInto = canonicalId;
            }
        });
    }

    logEvent(state, {
        type: 'fields_merged',
        entityType: 'Field',
        entityId: canonicalId,
        data: {
            setId,
            inputFieldIds: fieldIds,
            outputFieldId: canonicalId,
            recordsUpdated
        }
    });

    return {
        canonicalField: schema.find(f => f.id === canonicalId),
        recordsUpdated
    };
}

/**
 * Execute field merge operation with result view
 */
function executeMergeFieldsOperation(state, setId, fieldIds, canonicalField, options = {}) {
    const operation = createOperation(state, {
        kind: 'merge_fields',
        setId,
        viewId: state.currentViewId,
        inputFieldIds: fieldIds,
        parameters: { canonicalField, strategy: options.strategy, options },
        status: 'draft'
    });

    const result = mergeFields(state, setId, fieldIds, canonicalField, options);
    if (!result) {
        return null;
    }

    updateOperation(state, operation.id, {
        outputFieldIds: [result.canonicalField.id],
        status: 'applied',
        summary: `Merged ${fieldIds.length} fields into 1 canonical field, updated ${result.recordsUpdated} records`
    });

    // Create result view showing before/after
    const resultView = createView(state, {
        setId,
        name: `Field Merge Result - ${new Date().toLocaleString()}`,
        type: 'grid',
        visibleFieldIds: [result.canonicalField.id, ...fieldIds],
        derivedFromOperationIds: [operation.id],
        notes: `Result of merging fields: ${fieldIds.join(', ')} → ${result.canonicalField.id}`
    });

    updateOperation(state, operation.id, { resultViewId: resultView.id });

    return {
        operation,
        canonicalField: result.canonicalField,
        recordsUpdated: result.recordsUpdated,
        resultView
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function logEvent(state, event) {
    if (!state.eventStream) {
        state.eventStream = [];
    }
    state.eventStream.push({
        id: state.eventIdCounter || 1,
        timestamp: Date.now(),
        user: state.currentUser,
        ...event
    });
    state.eventIdCounter = (state.eventIdCounter || 1) + 1;
}

// Import createView if in browser environment
let createView;
if (typeof window !== 'undefined' && window.createView) {
    createView = window.createView;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createStructuralOperation,
        createOperation,
        updateOperation,
        findDuplicateCandidates,
        createDedupeCandidatesView,
        mergeRecords,
        executeMergeOperation,
        splitRecord,
        executeSplitOperation,
        mergeFields,
        executeMergeFieldsOperation,
        MERGE_STRATEGIES
    };
}
