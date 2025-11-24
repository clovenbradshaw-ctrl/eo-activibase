/**
 * EO Discovery & Zero-Input Search
 *
 * This module implements a zero-input search surface that shows relevant
 * content before the user types anything. It analyzes the event stream,
 * data usage patterns, and structural characteristics to surface insights.
 *
 * Key features:
 * - Recent items from interaction history
 * - Frequently used fields
 * - New & updated entities
 * - Structural highlights (high-variety fields, missingness, connections)
 * - Browse by entity type
 */

// ============================================================================
// RECENT ITEMS
// ============================================================================

/**
 * Get recently accessed items from event stream
 */
function getRecentItems(state, limit = 8) {
    const events = state.eventStream || [];
    const seen = new Set();
    const results = [];

    // Walk backwards through events
    for (let i = events.length - 1; i >= 0 && results.length < limit; i--) {
        const event = events[i];
        if (!event.entityType || !event.entityId) continue;

        const key = `${event.entityType}:${event.entityId}`;
        if (seen.has(key)) continue;

        seen.add(key);

        // Resolve entity
        const entity = resolveEntity(state, event.entityType, event.entityId);
        if (entity) {
            results.push({
                type: event.entityType,
                id: event.entityId,
                entity,
                lastAccessed: event.timestamp,
                action: event.type
            });
        }
    }

    return results;
}

/**
 * Resolve an entity by type and ID
 */
function resolveEntity(state, entityType, entityId) {
    switch (entityType) {
        case 'Set':
            return state.sets.get(entityId);
        case 'View':
            return state.views?.get(entityId);
        case 'Record': {
            // Search across all sets
            for (const set of state.sets.values()) {
                const record = set.records.get(entityId);
                if (record) return { ...record, _setId: set.id };
            }
            return null;
        }
        case 'Field': {
            // Search across all sets' schemas
            for (const set of state.sets.values()) {
                const field = (set.schema || []).find(f => f.id === entityId);
                if (field) return { ...field, _setId: set.id };
            }
            return null;
        }
        case 'Definition':
            return state.definitions?.get(entityId);
        case 'Connection':
            return state.connections?.get(entityId);
        case 'StructuralOperation':
            return state.structuralOperations?.get(entityId);
        default:
            return null;
    }
}

// ============================================================================
// FREQUENTLY USED FIELDS
// ============================================================================

/**
 * Count field usage across all records
 */
function getFieldUsageCounts(state) {
    const counts = new Map(); // fieldId -> { count, setId, field }

    state.sets.forEach(set => {
        const schema = set.schema || [];

        set.records.forEach(rec => {
            schema.forEach(field => {
                const value = rec[field.id];
                if (value !== undefined && value !== null && value !== '') {
                    const key = field.id;
                    if (!counts.has(key)) {
                        counts.set(key, {
                            fieldId: field.id,
                            field,
                            setId: set.id,
                            setName: set.name,
                            count: 0
                        });
                    }
                    counts.get(key).count++;
                }
            });
        });
    });

    return counts;
}

/**
 * Get top N most frequently used fields
 */
function getTopFields(state, limit = 10) {
    const counts = getFieldUsageCounts(state);
    const pairs = Array.from(counts.values());
    pairs.sort((a, b) => b.count - a.count);
    return pairs.slice(0, limit);
}

// ============================================================================
// NEW & UPDATED ENTITIES
// ============================================================================

/**
 * Get recently created or updated entities
 */
function getNewAndUpdated(state, options = {}) {
    const limit = options.limit || 10;
    const sinceDays = options.sinceDays || 7;
    const sinceTimestamp = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);

    const items = [];

    // Check sets
    state.sets.forEach(set => {
        if (set.createdAt && set.createdAt > sinceTimestamp) {
            items.push({
                type: 'Set',
                id: set.id,
                name: set.name,
                timestamp: set.createdAt,
                action: 'created'
            });
        }
        if (set.updatedAt && set.updatedAt > sinceTimestamp) {
            items.push({
                type: 'Set',
                id: set.id,
                name: set.name,
                timestamp: set.updatedAt,
                action: 'updated'
            });
        }
    });

    // Check views
    if (state.views) {
        state.views.forEach(view => {
            const created = view.provenance?.createdAt;
            const updated = view.provenance?.updatedAt;

            if (created && created > sinceTimestamp) {
                items.push({
                    type: 'View',
                    id: view.id,
                    name: view.name,
                    timestamp: created,
                    action: 'created'
                });
            }
            if (updated && updated > sinceTimestamp) {
                items.push({
                    type: 'View',
                    id: view.id,
                    name: view.name,
                    timestamp: updated,
                    action: 'updated'
                });
            }
        });
    }

    // Check definitions
    if (state.definitions) {
        state.definitions.forEach(def => {
            if (def.createdAt && def.createdAt > sinceTimestamp) {
                items.push({
                    type: 'Definition',
                    id: def.id,
                    name: def.term || def.id,
                    timestamp: def.createdAt,
                    action: 'created'
                });
            }
        });
    }

    // Sort by timestamp descending
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items.slice(0, limit);
}

// ============================================================================
// STRUCTURAL HIGHLIGHTS
// ============================================================================

/**
 * Analyze data structure and find interesting patterns
 */
function getStructuralHighlights(state) {
    const highlights = [];

    // 1. Fields with definitions
    const fieldsWithDefinitions = getFieldsWithDefinitions(state);
    if (fieldsWithDefinitions.length > 0) {
        highlights.push({
            type: 'fieldsWithDefinitions',
            label: `${fieldsWithDefinitions.length} fields have definitions`,
            count: fieldsWithDefinitions.length,
            items: fieldsWithDefinitions.slice(0, 5)
        });
    }

    // 2. Fields with connections
    const fieldsWithConnections = getFieldsWithConnections(state);
    if (fieldsWithConnections.length > 0) {
        highlights.push({
            type: 'fieldsWithConnections',
            label: `${fieldsWithConnections.length} fields have connections`,
            count: fieldsWithConnections.length,
            items: fieldsWithConnections.slice(0, 5)
        });
    }

    // 3. Large sets (potential performance issues)
    const largeSets = getLargeSets(state, 1000);
    if (largeSets.length > 0) {
        highlights.push({
            type: 'largeSets',
            label: `${largeSets.length} sets with >1000 records`,
            count: largeSets.length,
            items: largeSets
        });
    }

    // 4. High-variety fields (many unique values)
    const highVarietyFields = getHighVarietyFields(state, 0.9);
    if (highVarietyFields.length > 0) {
        highlights.push({
            type: 'highVarietyFields',
            label: `${highVarietyFields.length} fields with high variety`,
            count: highVarietyFields.length,
            items: highVarietyFields.slice(0, 5)
        });
    }

    // 5. Sparse fields (high missingness)
    const sparseFields = getSparseFields(state, 0.5);
    if (sparseFields.length > 0) {
        highlights.push({
            type: 'sparseFields',
            label: `${sparseFields.length} fields with >50% missing values`,
            count: sparseFields.length,
            items: sparseFields.slice(0, 5)
        });
    }

    // 6. Recent operations
    if (state.structuralOperations && state.structuralOperations.size > 0) {
        const recentOps = Array.from(state.structuralOperations.values())
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5);

        highlights.push({
            type: 'recentOperations',
            label: `${state.structuralOperations.size} structural operations`,
            count: state.structuralOperations.size,
            items: recentOps
        });
    }

    return highlights;
}

/**
 * Get fields that have definitions
 */
function getFieldsWithDefinitions(state) {
    const fields = [];
    if (!state.definitions) return fields;

    state.definitions.forEach(def => {
        if (def.entity?.type === 'Field') {
            fields.push({
                fieldId: def.entity.id,
                definitionId: def.id,
                term: def.term
            });
        }
    });

    return fields;
}

/**
 * Get fields that participate in connections
 */
function getFieldsWithConnections(state) {
    const fieldSet = new Set();
    if (!state.connections) return [];

    state.connections.forEach(conn => {
        // Assuming connections reference fields in some way
        // Adjust based on your connection schema
        if (conn.sourceFieldId) fieldSet.add(conn.sourceFieldId);
        if (conn.targetFieldId) fieldSet.add(conn.targetFieldId);
    });

    return Array.from(fieldSet).map(fieldId => ({ fieldId }));
}

/**
 * Get sets with more than threshold records
 */
function getLargeSets(state, threshold = 1000) {
    const large = [];

    state.sets.forEach(set => {
        const count = set.records.size;
        if (count > threshold) {
            large.push({
                setId: set.id,
                name: set.name,
                recordCount: count
            });
        }
    });

    large.sort((a, b) => b.recordCount - a.recordCount);
    return large;
}

/**
 * Get fields with high variety (unique values / total values)
 */
function getHighVarietyFields(state, threshold = 0.9) {
    const highVariety = [];

    state.sets.forEach(set => {
        const schema = set.schema || [];

        schema.forEach(field => {
            const values = [];
            set.records.forEach(rec => {
                const val = rec[field.id];
                if (val !== undefined && val !== null && val !== '') {
                    values.push(String(val));
                }
            });

            if (values.length === 0) return;

            const uniqueCount = new Set(values).size;
            const variety = uniqueCount / values.length;

            if (variety >= threshold) {
                highVariety.push({
                    fieldId: field.id,
                    field,
                    setId: set.id,
                    setName: set.name,
                    variety,
                    uniqueCount,
                    totalCount: values.length
                });
            }
        });
    });

    highVariety.sort((a, b) => b.variety - a.variety);
    return highVariety;
}

/**
 * Get fields with high missingness
 */
function getSparseFields(state, threshold = 0.5) {
    const sparse = [];

    state.sets.forEach(set => {
        const schema = set.schema || [];
        const totalRecords = set.records.size;

        if (totalRecords === 0) return;

        schema.forEach(field => {
            let nonEmpty = 0;
            set.records.forEach(rec => {
                const val = rec[field.id];
                if (val !== undefined && val !== null && val !== '') {
                    nonEmpty++;
                }
            });

            const missingness = 1 - (nonEmpty / totalRecords);

            if (missingness >= threshold) {
                sparse.push({
                    fieldId: field.id,
                    field,
                    setId: set.id,
                    setName: set.name,
                    missingness,
                    nonEmpty,
                    totalRecords
                });
            }
        });
    });

    sparse.sort((a, b) => b.missingness - a.missingness);
    return sparse;
}

// ============================================================================
// BROWSE CATEGORIES
// ============================================================================

/**
 * Get entity counts for browse interface
 */
function getBrowseCounts(state) {
    return {
        worlds: state.worlds?.size || 0,
        sets: state.sets?.size || 0,
        views: state.views?.size || 0,
        records: Array.from(state.sets.values()).reduce((sum, set) => sum + set.records.size, 0),
        fields: Array.from(state.sets.values()).reduce((sum, set) => sum + (set.schema?.length || 0), 0),
        definitions: state.definitions?.size || 0,
        connections: state.connections?.size || 0,
        operations: state.structuralOperations?.size || 0
    };
}

/**
 * Get all entities of a specific type
 */
function getAllEntitiesByType(state, entityType, options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    let items = [];

    switch (entityType) {
        case 'Set':
            items = Array.from(state.sets.values()).map(set => ({
                type: 'Set',
                id: set.id,
                name: set.name,
                recordCount: set.records.size,
                fieldCount: set.schema?.length || 0
            }));
            break;

        case 'View':
            if (state.views) {
                items = Array.from(state.views.values()).map(view => ({
                    type: 'View',
                    id: view.id,
                    name: view.name,
                    setId: view.setId,
                    viewType: view.type
                }));
            }
            break;

        case 'Definition':
            if (state.definitions) {
                items = Array.from(state.definitions.values()).map(def => ({
                    type: 'Definition',
                    id: def.id,
                    term: def.term,
                    entityType: def.entity?.type,
                    entityId: def.entity?.id
                }));
            }
            break;

        case 'Connection':
            if (state.connections) {
                items = Array.from(state.connections.values()).map(conn => ({
                    type: 'Connection',
                    id: conn.id,
                    relation: conn.relation,
                    source: conn.source,
                    target: conn.target
                }));
            }
            break;

        case 'StructuralOperation':
            if (state.structuralOperations) {
                items = Array.from(state.structuralOperations.values()).map(op => ({
                    type: 'StructuralOperation',
                    id: op.id,
                    kind: op.kind,
                    status: op.status,
                    createdAt: op.createdAt
                }));
            }
            break;

        default:
            return { items: [], total: 0, hasMore: false };
    }

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
        items: paginated,
        total,
        hasMore,
        offset,
        limit
    };
}

// ============================================================================
// ZERO-INPUT SEARCH DATA STRUCTURE
// ============================================================================

/**
 * Build the complete zero-input search data
 * This is what powers the search modal before the user types
 */
function buildZeroInputSearchData(state, options = {}) {
    return {
        recent: getRecentItems(state, options.recentLimit || 8),
        frequentFields: getTopFields(state, options.fieldsLimit || 10),
        newAndUpdated: getNewAndUpdated(state, {
            limit: options.newLimit || 10,
            sinceDays: options.sinceDays || 7
        }),
        structuralHighlights: getStructuralHighlights(state),
        browse: getBrowseCounts(state)
    };
}

// ============================================================================
// FILTERED SEARCH
// ============================================================================

/**
 * Search across all entity types
 */
function searchAllEntities(state, query, options = {}) {
    const limit = options.limit || 50;
    const lowerQuery = query.toLowerCase();

    const results = {
        sets: [],
        views: [],
        records: [],
        fields: [],
        definitions: [],
        connections: [],
        operations: []
    };

    // Search sets
    state.sets.forEach(set => {
        if (set.name.toLowerCase().includes(lowerQuery)) {
            results.sets.push({
                type: 'Set',
                id: set.id,
                name: set.name,
                match: 'name'
            });
        }
    });

    // Search views
    if (state.views) {
        state.views.forEach(view => {
            if (view.name.toLowerCase().includes(lowerQuery)) {
                results.views.push({
                    type: 'View',
                    id: view.id,
                    name: view.name,
                    setId: view.setId,
                    match: 'name'
                });
            }
        });
    }

    // Search definitions
    if (state.definitions) {
        state.definitions.forEach(def => {
            if (def.term?.toLowerCase().includes(lowerQuery) ||
                def.description?.toLowerCase().includes(lowerQuery)) {
                results.definitions.push({
                    type: 'Definition',
                    id: def.id,
                    term: def.term,
                    match: def.term?.toLowerCase().includes(lowerQuery) ? 'term' : 'description'
                });
            }
        });
    }

    // Search fields (across all sets)
    state.sets.forEach(set => {
        (set.schema || []).forEach(field => {
            if (field.name?.toLowerCase().includes(lowerQuery) ||
                field.id.toLowerCase().includes(lowerQuery)) {
                results.fields.push({
                    type: 'Field',
                    id: field.id,
                    name: field.name,
                    setId: set.id,
                    setName: set.name,
                    match: field.name?.toLowerCase().includes(lowerQuery) ? 'name' : 'id'
                });
            }
        });
    });

    // Limit each category
    Object.keys(results).forEach(key => {
        if (results[key].length > limit) {
            results[key] = results[key].slice(0, limit);
        }
    });

    return results;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getRecentItems,
        getTopFields,
        getNewAndUpdated,
        getStructuralHighlights,
        getBrowseCounts,
        getAllEntitiesByType,
        buildZeroInputSearchData,
        searchAllEntities
    };
}
