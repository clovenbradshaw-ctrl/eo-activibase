/**
 * EO Set Management
 *
 * Features for managing sets including:
 * - Edit set name and properties
 * - View provenance (origin, history)
 * - View relationships to other sets
 * - View import data connections
 * - Toss entire sets
 */

(function(global) {
    'use strict';

    // ============================================================================
    // ICON RENDERING HELPER
    // ============================================================================

    /**
     * Render an icon token as HTML
     * Handles both raw tokens (ph-map-pin) and HTML strings
     */
    function renderIconHtml(icon) {
        // Use global renderIcon if available
        if (typeof renderIcon === 'function') {
            return renderIcon(icon);
        }
        // Fallback implementation
        if (!icon) return '<i class="ph ph-squares-four"></i>';
        const trimmed = icon.toString().trim();
        if (trimmed.startsWith('<')) return trimmed;
        if (trimmed.startsWith('ph ')) return `<i class="${trimmed}"></i>`;
        if (trimmed.startsWith('ph-')) return `<i class="ph ${trimmed}"></i>`;
        return `<i class="ph ph-squares-four"></i>`;
    }

    // ============================================================================
    // SET PROVENANCE
    // ============================================================================

    /**
     * Get provenance information for a set
     */
    function getSetProvenance(state, setId) {
        const set = state.sets.get(setId);
        if (!set) return null;

        // Get creation event
        const creationEvent = state.eventStream.find(e =>
            e.object?.id === setId &&
            (e.verb === 'Create Set' || e.verb === 'Create' && e.object?.type === 'Set')
        );

        // Get all events related to this set
        const setEvents = state.eventStream.filter(e =>
            e.object?.setId === setId ||
            e.object?.id === setId ||
            e.data?.setId === setId
        );

        // Get import metadata if available
        const importEvent = setEvents.find(e =>
            e.verb?.includes('Import') ||
            e.data?.importSource ||
            e.data?.filename
        );

        // Get record count history from events
        const recordCountEvents = setEvents.filter(e =>
            e.verb === 'Create Record' || e.verb === 'Toss Record' ||
            e.verb === 'Toss Records' || e.verb === 'Import Records'
        );

        // Build provenance object
        const provenance = {
            setId,
            name: set.name,
            created: {
                at: creationEvent?.published || null,
                by: creationEvent?.actor || null,
                method: creationEvent?.data?.method || 'manual'
            },
            origin: set.origin || 'manual',
            source: null,
            statistics: {
                totalRecords: set.records.size,
                totalFields: set.schema.length,
                totalEvents: setEvents.length,
                recordsAdded: recordCountEvents.filter(e => e.verb === 'Create Record' || e.verb === 'Import Records').length,
                recordsTossed: recordCountEvents.filter(e => e.verb === 'Toss Record' || e.verb === 'Toss Records').length
            },
            timeline: buildSetTimeline(setEvents),
            importMetadata: null
        };

        // Add import source if available
        if (importEvent) {
            provenance.source = {
                type: 'import',
                filename: importEvent.data?.filename || null,
                importedAt: importEvent.published,
                importedBy: importEvent.actor
            };
            provenance.importMetadata = importEvent.data;
        }

        // Check entity for additional metadata
        const entity = state.entities?.get(setId);
        if (entity) {
            provenance.entityType = entity.entityType;
            provenance.worldId = entity.worldId;
            if (entity.origin) provenance.origin = entity.origin;
        }

        return provenance;
    }

    /**
     * Build a timeline of significant events for a set
     */
    function buildSetTimeline(events) {
        const significantVerbs = [
            'Create Set', 'Create Record', 'Import Records', 'Toss Record',
            'Toss Records', 'Create Field', 'Delete Field', 'Toss Column',
            'Update Schema', 'Rename Set'
        ];

        return events
            .filter(e => significantVerbs.some(v => e.verb?.includes(v)))
            .slice(0, 20) // Limit to last 20 events
            .map(e => ({
                timestamp: e.published,
                verb: e.verb,
                summary: e.data?.summary || e.verb,
                actor: e.actor
            }));
    }

    // ============================================================================
    // SET RELATIONSHIPS
    // ============================================================================

    /**
     * Get relationships for a set (links to other sets, dependencies)
     */
    function getSetRelationships(state, setId) {
        const set = state.sets.get(setId);
        if (!set) return null;

        const relationships = {
            setId,
            linkedSets: [],
            referencedBy: [],
            sharedFields: [],
            derivedViews: []
        };

        // Find linked record fields that point to other sets
        set.schema.forEach(field => {
            if (field.type === 'LINKED_RECORD' && field.config?.linkedSetId) {
                const linkedSet = state.sets.get(field.config.linkedSetId);
                relationships.linkedSets.push({
                    fieldId: field.id,
                    fieldName: field.name,
                    targetSetId: field.config.linkedSetId,
                    targetSetName: linkedSet?.name || 'Unknown Set',
                    linkCount: countLinkedRecords(set, field.id),
                    relationshipVerb: field.config.relationshipVerb || null,
                    cardinality: field.config.cardinality || 'many'
                });
            }
        });

        // Find other sets that link to this set
        state.sets.forEach((otherSet, otherSetId) => {
            if (otherSetId === setId) return;

            otherSet.schema.forEach(field => {
                if (field.type === 'LINKED_RECORD' && field.config?.linkedSetId === setId) {
                    relationships.referencedBy.push({
                        setId: otherSetId,
                        setName: otherSet.name,
                        fieldId: field.id,
                        fieldName: field.name,
                        linkCount: countLinkedRecords(otherSet, field.id),
                        relationshipVerb: field.config.relationshipVerb || null,
                        inverseVerb: field.config.inverseVerb || null,
                        cardinality: field.config.cardinality || 'many'
                    });
                }
            });
        });

        // Find rollup/lookup fields that reference this set
        state.sets.forEach((otherSet, otherSetId) => {
            if (otherSetId === setId) return;

            otherSet.schema.forEach(field => {
                if ((field.type === 'ROLLUP' || field.type === 'LOOKUP') &&
                    field.config?.sourceSetId === setId) {
                    relationships.sharedFields.push({
                        setId: otherSetId,
                        setName: otherSet.name,
                        fieldId: field.id,
                        fieldName: field.name,
                        fieldType: field.type,
                        sourceField: field.config.sourceFieldId
                    });
                }
            });
        });

        // Find views derived from this set
        if (set.views) {
            set.views.forEach((view, viewId) => {
                if (view.key || view.derivedFrom) {
                    relationships.derivedViews.push({
                        viewId,
                        viewName: view.name,
                        type: view.type || 'grid',
                        derivedFrom: view.derivedFrom
                    });
                }
            });
        }

        return relationships;
    }

    function countLinkedRecords(set, fieldId) {
        let count = 0;
        set.records.forEach(record => {
            const value = record[fieldId];
            if (value) {
                count += Array.isArray(value) ? value.length : 1;
            }
        });
        return count;
    }

    // ============================================================================
    // SET MANAGEMENT UI
    // ============================================================================

    /**
     * Open the set management modal
     * @param {string} setId - The set ID to manage
     * @param {string} activeTab - Optional tab to show initially ('details', 'sources', 'provenance', 'relationships', 'tossed'). Defaults to 'sources'.
     */
    function openSetManagementModal(setId, activeTab = 'sources') {
        const set = state.sets.get(setId);
        if (!set) return;

        const provenance = getSetProvenance(state, setId);
        const relationships = getSetRelationships(state, setId);
        const sourcesInfo = getSetSources(state, setId);
        const tossPileStats = typeof TossPile !== 'undefined' ?
            TossPile.getTossPileStats(state, setId) : null;

        const modalHtml = `
            <div class="modal-overlay" id="setManagementModal" onclick="SetManagement.closeModal(event)">
                <div class="modal large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <div class="modal-title-group">
                            <span class="set-icon">${renderIconHtml(set.icon)}</span>
                            <h2 id="setModalTitle">${escapeHtml(set.name)}</h2>
                        </div>
                        <button class="modal-close" onclick="SetManagement.closeModal()">×</button>
                    </div>
                    <div class="modal-body set-management-body">
                        <div class="set-management-tabs">
                            <button class="tab-btn${activeTab === 'details' ? ' active' : ''}" data-tab="details" onclick="SetManagement.switchTab('details')">Details</button>
                            <button class="tab-btn${activeTab === 'sources' ? ' active' : ''}" data-tab="sources" onclick="SetManagement.switchTab('sources')">
                                Sources
                                ${sourcesInfo.totalSources > 0 ? `<span class="tab-badge">${sourcesInfo.totalSources}</span>` : ''}
                            </button>
                            <button class="tab-btn${activeTab === 'provenance' ? ' active' : ''}" data-tab="provenance" onclick="SetManagement.switchTab('provenance')">Provenance</button>
                            <button class="tab-btn${activeTab === 'relationships' ? ' active' : ''}" data-tab="relationships" onclick="SetManagement.switchTab('relationships')">Relationships</button>
                            ${tossPileStats && tossPileStats.totalEntries > 0 ? `
                                <button class="tab-btn${activeTab === 'tossed' ? ' active' : ''}" data-tab="tossed" onclick="SetManagement.switchTab('tossed')">
                                    Tossed <span class="tab-badge">${tossPileStats.totalEntries}</span>
                                </button>
                            ` : ''}
                        </div>

                        <div class="tab-content${activeTab === 'details' ? ' active' : ''}" id="tab-details">
                            ${renderDetailsTab(set, setId)}
                        </div>

                        <div class="tab-content${activeTab === 'sources' ? ' active' : ''}" id="tab-sources">
                            ${renderSourcesTab(setId, sourcesInfo)}
                        </div>

                        <div class="tab-content${activeTab === 'provenance' ? ' active' : ''}" id="tab-provenance">
                            ${renderProvenanceTab(provenance)}
                        </div>

                        <div class="tab-content${activeTab === 'relationships' ? ' active' : ''}" id="tab-relationships">
                            ${renderRelationshipsTab(relationships)}
                        </div>

                        ${tossPileStats && tossPileStats.totalEntries > 0 ? `
                            <div class="tab-content${activeTab === 'tossed' ? ' active' : ''}" id="tab-tossed">
                                ${renderTossedTab(setId, tossPileStats)}
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="SetManagement.closeModal()">Close</button>
                        <button class="btn-danger" onclick="SetManagement.tossSet('${setId}')">
                            <i class="ph ph-hand-fist"></i>
                            Toss Set
                        </button>
                        <button class="btn-primary" onclick="SetManagement.saveChanges('${setId}')">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    function renderDetailsTab(set, setId) {
        return `
            <div class="details-section">
                <div class="form-group">
                    <label for="setNameInput">Name</label>
                    <input type="text" id="setNameInput" value="${escapeHtml(set.name)}" class="form-input">
                </div>
                <div class="form-group">
                    <label>Icon</label>
                    <div class="icon-selector">
                        <span class="current-icon">${renderIconHtml(set.icon)}</span>
                        <button class="btn-secondary btn-sm" onclick="SetManagement.openIconPicker('${setId}')">Change</button>
                    </div>
                </div>
                <div class="details-stats">
                    <div class="stat-item">
                        <span class="stat-value">${set.records.size}</span>
                        <span class="stat-label">Records</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${set.schema.length}</span>
                        <span class="stat-label">Fields</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${set.views?.size || 1}</span>
                        <span class="stat-label">Views</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderProvenanceTab(provenance) {
        if (!provenance) return '<div class="empty-state">No provenance data available</div>';

        const createdDate = provenance.created.at ?
            new Date(provenance.created.at).toLocaleString() : 'Unknown';

        return `
            <div class="provenance-section">
                <div class="provenance-header">
                    <div class="provenance-origin">
                        <span class="origin-badge ${provenance.origin}">${provenance.origin}</span>
                        ${provenance.source ? `
                            <span class="source-info">
                                from ${provenance.source.filename || 'external source'}
                            </span>
                        ` : ''}
                    </div>
                    <div class="provenance-created">
                        Created ${createdDate}
                        ${provenance.created.by ? `by ${provenance.created.by.name || provenance.created.by.id}` : ''}
                    </div>
                </div>

                <div class="provenance-stats">
                    <h4>Activity Summary</h4>
                    <div class="stats-grid">
                        <div class="stat">
                            <span class="stat-number">${provenance.statistics.recordsAdded}</span>
                            <span class="stat-label">Records added</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${provenance.statistics.recordsTossed}</span>
                            <span class="stat-label">Records tossed</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${provenance.statistics.totalEvents}</span>
                            <span class="stat-label">Total events</span>
                        </div>
                    </div>
                </div>

                ${provenance.timeline.length > 0 ? `
                    <div class="provenance-timeline">
                        <h4>Recent Activity</h4>
                        <div class="timeline-list">
                            ${provenance.timeline.map(event => `
                                <div class="timeline-item">
                                    <span class="timeline-time">${getTimeAgo(event.timestamp)}</span>
                                    <span class="timeline-event">${event.summary}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${provenance.importMetadata ? `
                    <div class="import-info">
                        <h4>Import Details</h4>
                        <div class="import-details">
                            <div class="detail-row">
                                <span class="detail-label">File:</span>
                                <span class="detail-value">${provenance.importMetadata.filename || 'Unknown'}</span>
                            </div>
                            ${provenance.importMetadata.rowCount ? `
                                <div class="detail-row">
                                    <span class="detail-label">Rows imported:</span>
                                    <span class="detail-value">${provenance.importMetadata.rowCount}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderRelationshipsTab(relationships) {
        if (!relationships) return '<div class="empty-state">No relationship data available</div>';

        const hasRelationships = relationships.linkedSets.length > 0 ||
            relationships.referencedBy.length > 0 ||
            relationships.sharedFields.length > 0;

        if (!hasRelationships) {
            return `
                <div class="empty-state">
                    <i class="ph ph-link-simple-break"></i>
                    <p>No relationships to other sets</p>
                    <span class="hint">Add linked record fields to create relationships</span>
                </div>
            `;
        }

        return `
            <div class="relationships-section">
                ${relationships.linkedSets.length > 0 ? `
                    <div class="relationship-group">
                        <h4>Links To</h4>
                        <div class="relationship-list">
                            ${relationships.linkedSets.map(link => `
                                <div class="relationship-item outgoing">
                                    <span class="rel-icon"><i class="ph ph-arrow-right"></i></span>
                                    <span class="rel-set">${escapeHtml(link.targetSetName)}</span>
                                    ${link.relationshipVerb ? `
                                        <span class="rel-verb">"${escapeHtml(link.relationshipVerb)}"</span>
                                    ` : ''}
                                    <span class="rel-via">via ${escapeHtml(link.fieldName)}</span>
                                    <span class="rel-cardinality">${link.cardinality === 'one' ? '1:1' : '1:N'}</span>
                                    <span class="rel-count">${link.linkCount} links</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${relationships.referencedBy.length > 0 ? `
                    <div class="relationship-group">
                        <h4>Referenced By</h4>
                        <div class="relationship-list">
                            ${relationships.referencedBy.map(ref => `
                                <div class="relationship-item incoming">
                                    <span class="rel-icon"><i class="ph ph-arrow-left"></i></span>
                                    <span class="rel-set">${escapeHtml(ref.setName)}</span>
                                    ${ref.relationshipVerb ? `
                                        <span class="rel-verb">"${escapeHtml(ref.relationshipVerb)}"</span>
                                    ` : ''}
                                    <span class="rel-via">via ${escapeHtml(ref.fieldName)}</span>
                                    <span class="rel-cardinality">${ref.cardinality === 'one' ? '1:1' : '1:N'}</span>
                                    <span class="rel-count">${ref.linkCount} links</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${relationships.sharedFields.length > 0 ? `
                    <div class="relationship-group">
                        <h4>Used In Rollups/Lookups</h4>
                        <div class="relationship-list">
                            ${relationships.sharedFields.map(field => `
                                <div class="relationship-item derived">
                                    <span class="rel-icon"><i class="ph ph-function"></i></span>
                                    <span class="rel-set">${escapeHtml(field.setName)}</span>
                                    <span class="rel-field">${field.fieldType}: ${escapeHtml(field.fieldName)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderTossedTab(setId, stats) {
        return `
            <div class="tossed-section">
                <div class="tossed-summary">
                    <span class="tossed-count">${stats.totalEntries}</span>
                    <span class="tossed-label">items in toss pile for this set</span>
                </div>
                <div class="tossed-actions">
                    <button class="btn-primary" onclick="SetManagement.pickUpAll('${setId}')">
                        <i class="ph ph-arrow-arc-left"></i>
                        Pick Up All
                    </button>
                    <button class="btn-secondary" onclick="TossPileUI.openPanel(); SetManagement.closeModal();">
                        View in Toss Pile
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================================================
    // SOURCES TAB
    // ============================================================================

    /**
     * Get sources information for a set
     * Analyzes all imports feeding into the set and record-level provenance
     */
    function getSetSources(state, setId) {
        const set = state.sets.get(setId);
        if (!set) return { totalSources: 0, sources: [], manualRecords: 0, dedupSummary: null };

        // Initialize sources array from set.sources or build from records
        let sources = [];
        const recordsBySource = new Map(); // importId -> record[]
        let manualRecords = 0;
        const contentHashes = new Map(); // hash -> [recordIds]
        let totalDuplicates = 0;

        // Scan all records for source attribution
        set.records.forEach((record, recordId) => {
            const sourceImportId = record.sourceImportId || null;

            if (sourceImportId) {
                if (!recordsBySource.has(sourceImportId)) {
                    recordsBySource.set(sourceImportId, []);
                }
                recordsBySource.get(sourceImportId).push({ recordId, record });
            } else {
                manualRecords++;
            }

            // Track content hashes for deduplication
            const hash = record.contentHash || computeRecordHash(record, set.schema);
            if (!contentHashes.has(hash)) {
                contentHashes.set(hash, []);
            }
            contentHashes.get(hash).push(recordId);
        });

        // Count duplicates
        contentHashes.forEach((recordIds, hash) => {
            if (recordIds.length > 1) {
                totalDuplicates += recordIds.length - 1; // All but one are dupes
            }
        });

        // Build source objects
        // First check if set has explicit sources array
        if (set.sources && set.sources.length > 0) {
            sources = set.sources.map(s => {
                const importObj = state.importManager?.getImport(s.importId);
                const recordsFromSource = recordsBySource.get(s.importId) || [];
                return {
                    ...s,
                    importName: s.importName || importObj?.name || 'Unknown Import',
                    recordCount: recordsFromSource.length,
                    recordIds: recordsFromSource.map(r => r.recordId),
                    import: importObj,
                    isAvailable: !!importObj
                };
            });
        } else {
            // Build from importManager usage tracking + record scanning
            const importManager = state.importManager;
            if (importManager) {
                const importsForSet = importManager.getImportsForSet(setId);
                importsForSet.forEach(imp => {
                    const recordsFromSource = recordsBySource.get(imp.id) || [];
                    sources.push({
                        importId: imp.id,
                        importName: imp.name,
                        recordCount: recordsFromSource.length,
                        recordIds: recordsFromSource.map(r => r.recordId),
                        addedAt: imp.usedIn.find(u => u.id === setId)?.addedAt || imp.createdAt,
                        mode: 'additive',
                        import: imp,
                        isAvailable: true,
                        dedupStats: {
                            duplicatesFound: 0,
                            duplicatesHidden: 0,
                            handling: 'hide'
                        }
                    });
                });
            }

            // Also check legacy importId on set
            if (set.importId && !sources.find(s => s.importId === set.importId)) {
                const imp = state.importManager?.getImport(set.importId);
                const recordsFromSource = recordsBySource.get(set.importId) || [];
                sources.push({
                    importId: set.importId,
                    importName: imp?.name || 'Original Import',
                    recordCount: recordsFromSource.length || set.records.size,
                    recordIds: recordsFromSource.map(r => r.recordId),
                    addedAt: set.createdAt,
                    mode: 'additive',
                    import: imp,
                    isAvailable: !!imp,
                    dedupStats: {
                        duplicatesFound: 0,
                        duplicatesHidden: 0,
                        handling: 'hide'
                    }
                });
            }
        }

        // Calculate dedup summary
        const dedupSummary = {
            totalRecords: set.records.size,
            uniqueRecords: contentHashes.size,
            duplicateRecords: totalDuplicates,
            duplicateGroups: Array.from(contentHashes.values()).filter(ids => ids.length > 1).length,
            handling: set.dedupHandling || 'hide' // 'hide', 'show', or 'sup'
        };

        return {
            setId,
            totalSources: sources.length,
            sources,
            manualRecords,
            dedupSummary,
            availableImports: getAvailableImportsForSet(state, setId, sources)
        };
    }

    /**
     * Get imports that could be added to this set (not already added)
     */
    function getAvailableImportsForSet(state, setId, currentSources) {
        const importManager = state.importManager;
        if (!importManager) return [];

        const currentImportIds = new Set(currentSources.map(s => s.importId));
        return importManager.getAllImports()
            .filter(imp => !currentImportIds.has(imp.id) && imp.status === 'ready')
            .map(imp => ({
                importId: imp.id,
                importName: imp.name,
                rowCount: imp.rowCount,
                columnCount: imp.columnCount,
                quality: imp.quality,
                createdAt: imp.createdAt
            }));
    }

    /**
     * Compute a simple hash for record deduplication
     */
    function computeRecordHash(record, schema) {
        const values = schema
            .filter(f => !f.hidden && f.type !== 'FORMULA' && f.type !== 'ROLLUP')
            .map(f => {
                const val = record[f.id] ?? record[f.name] ?? '';
                return String(val);
            })
            .join('|');

        // Simple djb2 hash
        let hash = 5381;
        for (let i = 0; i < values.length; i++) {
            hash = ((hash << 5) + hash) + values.charCodeAt(i);
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Render the Sources tab
     */
    function renderSourcesTab(setId, sourcesInfo) {
        const { sources, manualRecords, dedupSummary, availableImports } = sourcesInfo;

        // Empty state
        if (sources.length === 0 && manualRecords === 0) {
            return `
                <div class="sources-section">
                    <div class="empty-state">
                        <i class="ph ph-file-arrow-down"></i>
                        <p>No import sources</p>
                        <span class="hint">This set has no imported data yet</span>
                        ${availableImports.length > 0 ? `
                            <button class="btn-primary" onclick="SetManagement.showAddImportModal('${setId}')">
                                <i class="ph ph-plus"></i>
                                Add Import
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        return `
            <div class="sources-section">
                <!-- Summary Header -->
                <div class="sources-summary">
                    <div class="summary-stats">
                        <div class="stat-item">
                            <span class="stat-value">${sources.length}</span>
                            <span class="stat-label">Import${sources.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${dedupSummary.totalRecords}</span>
                            <span class="stat-label">Total Records</span>
                        </div>
                        ${manualRecords > 0 ? `
                            <div class="stat-item">
                                <span class="stat-value">${manualRecords}</span>
                                <span class="stat-label">Manual</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="summary-actions">
                        <button class="btn-secondary btn-sm" onclick="SetManagement.showAddImportModal('${setId}')" ${availableImports.length === 0 ? 'disabled title="No imports available"' : ''}>
                            <i class="ph ph-plus"></i>
                            Add Import
                        </button>
                    </div>
                </div>

                <!-- Deduplication Banner -->
                ${dedupSummary.duplicateRecords > 0 ? `
                    <div class="dedup-banner">
                        <div class="dedup-info">
                            <i class="ph ph-copy"></i>
                            <span><strong>${dedupSummary.duplicateRecords}</strong> duplicate record${dedupSummary.duplicateRecords !== 1 ? 's' : ''} detected across ${dedupSummary.duplicateGroups} group${dedupSummary.duplicateGroups !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="dedup-controls">
                            <select class="dedup-handling" onchange="SetManagement.setDedupHandling('${setId}', this.value)">
                                <option value="hide" ${dedupSummary.handling === 'hide' ? 'selected' : ''}>Hide duplicates</option>
                                <option value="show" ${dedupSummary.handling === 'show' ? 'selected' : ''}>Show all</option>
                                <option value="sup" ${dedupSummary.handling === 'sup' ? 'selected' : ''}>SUP merge</option>
                            </select>
                        </div>
                    </div>
                ` : ''}

                <!-- Source Cards -->
                <div class="sources-list">
                    ${sources.map(source => renderSourceCard(setId, source)).join('')}

                    ${manualRecords > 0 ? `
                        <div class="source-card manual-source">
                            <div class="source-header">
                                <div class="source-icon">
                                    <i class="ph ph-pencil-simple"></i>
                                </div>
                                <div class="source-info">
                                    <span class="source-name">Manual Entries</span>
                                    <span class="source-meta">Created directly in this set</span>
                                </div>
                            </div>
                            <div class="source-stats">
                                <span class="stat">${manualRecords} record${manualRecords !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render a single source card
     */
    function renderSourceCard(setId, source) {
        const formatIcon = getFormatIcon(source.import?.source?.format);
        const qualityScore = source.import?.quality?.score || null;
        const addedDate = source.addedAt ? new Date(source.addedAt).toLocaleDateString() : 'Unknown';

        return `
            <div class="source-card" data-import-id="${source.importId}">
                <div class="source-header">
                    <div class="source-icon">
                        ${formatIcon}
                    </div>
                    <div class="source-info">
                        <span class="source-name">${escapeHtml(source.importName)}</span>
                        <span class="source-meta">
                            Added ${addedDate}
                            ${source.mode ? ` · ${source.mode}` : ''}
                        </span>
                    </div>
                    ${!source.isAvailable ? `
                        <span class="source-warning" title="Original import file no longer available">
                            <i class="ph ph-warning"></i>
                        </span>
                    ` : ''}
                </div>

                <div class="source-stats">
                    <span class="stat">
                        <i class="ph ph-rows"></i>
                        ${source.recordCount} record${source.recordCount !== 1 ? 's' : ''}
                    </span>
                    ${qualityScore !== null ? `
                        <span class="stat quality-score quality-${getQualityLevel(qualityScore)}">
                            <i class="ph ph-chart-bar"></i>
                            ${qualityScore}%
                        </span>
                    ` : ''}
                    ${source.dedupStats?.duplicatesFound > 0 ? `
                        <span class="stat duplicates">
                            <i class="ph ph-copy"></i>
                            ${source.dedupStats.duplicatesHidden} hidden
                        </span>
                    ` : ''}
                </div>

                <div class="source-actions">
                    <button class="btn-icon" onclick="SetManagement.viewSourceRecords('${setId}', '${source.importId}')" title="View records from this import">
                        <i class="ph ph-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="SetManagement.showSourceDetails('${setId}', '${source.importId}')" title="Source details">
                        <i class="ph ph-info"></i>
                    </button>
                    <button class="btn-icon btn-danger-icon" onclick="SetManagement.confirmRemoveSource('${setId}', '${source.importId}')" title="Remove this import from set">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get format icon for import type
     */
    function getFormatIcon(format) {
        const icons = {
            'csv': '<i class="ph ph-file-csv"></i>',
            'tsv': '<i class="ph ph-file-csv"></i>',
            'json': '<i class="ph ph-file-js"></i>',
            'xlsx': '<i class="ph ph-file-xls"></i>',
            'xls': '<i class="ph ph-file-xls"></i>'
        };
        return icons[format] || '<i class="ph ph-file"></i>';
    }

    /**
     * Get quality level for styling
     */
    function getQualityLevel(score) {
        if (score >= 90) return 'high';
        if (score >= 70) return 'medium';
        return 'low';
    }

    // ============================================================================
    // SOURCE MANAGEMENT ACTIONS
    // ============================================================================

    /**
     * Show modal to add an import to the set
     */
    function showAddImportModal(setId) {
        const sourcesInfo = getSetSources(state, setId);
        const availableImports = sourcesInfo.availableImports;

        if (availableImports.length === 0) {
            showToast('No imports available to add');
            return;
        }

        const modalHtml = `
            <div class="modal-overlay" id="addImportModal" onclick="SetManagement.closeAddImportModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Add Import to Set</h2>
                        <button class="modal-close" onclick="SetManagement.closeAddImportModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-description">Select an import to add to this set. Records will be merged based on your chosen mode.</p>

                        <div class="form-group">
                            <label>Select Import</label>
                            <select id="addImportSelect" class="form-select">
                                ${availableImports.map(imp => `
                                    <option value="${imp.importId}">
                                        ${escapeHtml(imp.importName)} (${imp.rowCount} rows)
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Import Mode</label>
                            <select id="addImportMode" class="form-select">
                                <option value="additive">Additive - Add all rows as new records</option>
                                <option value="merge">Merge - Match by primary key, update existing</option>
                                <option value="linked">Linked - Create relationships to existing records</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Duplicate Handling</label>
                            <select id="addImportDedup" class="form-select">
                                <option value="hide">Hide duplicates (default)</option>
                                <option value="show">Show all duplicates</option>
                                <option value="sup">SUP merge duplicates</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="SetManagement.closeAddImportModal()">Cancel</button>
                        <button class="btn-primary" onclick="SetManagement.addImportToSet('${setId}')">
                            <i class="ph ph-plus"></i>
                            Add Import
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    function closeAddImportModal(event) {
        if (event && event.target.id !== 'addImportModal') return;
        const modal = document.getElementById('addImportModal');
        if (modal) modal.remove();
    }

    /**
     * Add an import to the set
     */
    function addImportToSet(setId) {
        const importId = document.getElementById('addImportSelect')?.value;
        const mode = document.getElementById('addImportMode')?.value || 'additive';
        const dedupHandling = document.getElementById('addImportDedup')?.value || 'hide';

        if (!importId) {
            showToast('Please select an import');
            return;
        }

        const set = state.sets.get(setId);
        const importObj = state.importManager?.getImport(importId);

        if (!set || !importObj) {
            showToast('Error: Set or import not found');
            return;
        }

        // Initialize sources array if needed
        if (!set.sources) {
            set.sources = [];
        }

        // Add records from import
        const addedRecordIds = [];
        const timestamp = new Date().toISOString();

        importObj.rows.forEach((row, idx) => {
            const recordId = EOTypes?.generateRecordId?.() ||
                `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Build record with source provenance
            const record = {
                record_id: recordId,
                sourceImportId: importId,
                sourceRowNumber: row._sourceRow || idx,
                created_at: timestamp,
                updated_at: timestamp
            };

            // Copy field values
            set.schema.forEach(field => {
                const value = row[field.name] ?? row[field.id] ?? '';
                record[field.id] = value;
            });

            // Compute content hash for deduplication
            record.contentHash = computeRecordHash(record, set.schema);

            set.records.set(recordId, record);
            addedRecordIds.push(recordId);
        });

        // Add source entry
        set.sources.push({
            importId,
            importName: importObj.name,
            recordCount: addedRecordIds.length,
            recordIds: addedRecordIds,
            addedAt: timestamp,
            mode,
            dedupStats: {
                duplicatesFound: 0,
                duplicatesHidden: 0,
                handling: dedupHandling
            }
        });

        // Track usage in import
        state.importManager?.trackUsage(importId, 'set', setId, addedRecordIds.length);

        // Create event
        if (typeof createEvent === 'function') {
            createEvent(
                'Add Import to Set',
                'INS',
                { type: 'Set', id: setId },
                {
                    importId,
                    importName: importObj.name,
                    recordsAdded: addedRecordIds.length,
                    mode,
                    summary: `Added ${addedRecordIds.length} records from "${importObj.name}"`
                }
            );
        }

        // Close modal and refresh
        closeAddImportModal();
        closeModal();
        openSetManagementModal(setId);

        // Refresh main view if needed
        if (typeof renderCurrentView === 'function') renderCurrentView();

        showToast(`Added ${addedRecordIds.length} records from "${importObj.name}"`);
    }

    /**
     * Confirm removing a source from the set
     */
    function confirmRemoveSource(setId, importId) {
        const set = state.sets.get(setId);
        const source = set?.sources?.find(s => s.importId === importId) ||
            { importName: 'this import', recordCount: 0 };

        // Count records that would be affected
        let recordCount = 0;
        set?.records.forEach(record => {
            if (record.sourceImportId === importId) {
                recordCount++;
            }
        });

        const message = `Remove "${source.importName}" from this set?\n\n` +
            `This will toss ${recordCount} record${recordCount !== 1 ? 's' : ''} to the toss pile.\n` +
            `You can pick them up later if needed.`;

        if (typeof showConfirm === 'function') {
            showConfirm(message, () => removeSourceFromSet(setId, importId));
        } else if (confirm(message)) {
            removeSourceFromSet(setId, importId);
        }
    }

    /**
     * Remove a source (import) from the set
     * Tosses all records from that import
     */
    function removeSourceFromSet(setId, importId) {
        const set = state.sets.get(setId);
        if (!set) return;

        // Find records from this import
        const recordsToToss = [];
        set.records.forEach((record, recordId) => {
            if (record.sourceImportId === importId) {
                recordsToToss.push(recordId);
            }
        });

        // Toss records
        if (recordsToToss.length > 0 && typeof TossPile !== 'undefined') {
            TossPile.tossRecords(state, recordsToToss);
        }

        // Remove source entry
        if (set.sources) {
            set.sources = set.sources.filter(s => s.importId !== importId);
        }

        // Create event
        if (typeof createEvent === 'function') {
            const importObj = state.importManager?.getImport(importId);
            createEvent(
                'Remove Import from Set',
                'NUL',
                { type: 'Set', id: setId },
                {
                    importId,
                    importName: importObj?.name || 'Unknown',
                    recordsTossed: recordsToToss.length,
                    summary: `Removed ${recordsToToss.length} records from import`
                }
            );
        }

        // Refresh modal
        closeModal();
        openSetManagementModal(setId);

        // Refresh main view
        if (typeof renderCurrentView === 'function') renderCurrentView();

        showToast(`Tossed ${recordsToToss.length} records from import`);
    }

    /**
     * View records from a specific source
     */
    function viewSourceRecords(setId, importId) {
        // Create a temporary filter to show only records from this import
        const set = state.sets.get(setId);
        if (!set) return;

        // Close modal
        closeModal();

        // Navigate to set if not already there
        if (state.currentSetId !== setId) {
            if (typeof switchSet === 'function') {
                switchSet(setId, null);
            }
        }

        // Apply source filter
        // This could set a temporary view filter or highlight records
        const sourceRecordIds = new Set();
        set.records.forEach((record, recordId) => {
            if (record.sourceImportId === importId) {
                sourceRecordIds.add(recordId);
            }
        });

        // Store as active source filter
        state.activeSourceFilter = {
            setId,
            importId,
            recordIds: sourceRecordIds
        };

        // Refresh view with filter
        if (typeof renderCurrentView === 'function') {
            renderCurrentView();
        }

        const importObj = state.importManager?.getImport(importId);
        showToast(`Showing ${sourceRecordIds.size} records from "${importObj?.name || 'import'}"`);
    }

    /**
     * Show details about a source
     */
    function showSourceDetails(setId, importId) {
        const importObj = state.importManager?.getImport(importId);
        if (!importObj) {
            showToast('Import details not available');
            return;
        }

        const source = state.sets.get(setId)?.sources?.find(s => s.importId === importId);

        const detailsHtml = `
            <div class="modal-overlay" id="sourceDetailsModal" onclick="SetManagement.closeSourceDetailsModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Import Details</h2>
                        <button class="modal-close" onclick="SetManagement.closeSourceDetailsModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="source-details-grid">
                            <div class="detail-row">
                                <span class="detail-label">Filename</span>
                                <span class="detail-value">${escapeHtml(importObj.name)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Format</span>
                                <span class="detail-value">${importObj.source?.format?.toUpperCase() || 'Unknown'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">File Size</span>
                                <span class="detail-value">${importObj.fileMetadata?.sizeFormatted || 'Unknown'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Imported</span>
                                <span class="detail-value">${importObj.source?.importedAt ? new Date(importObj.source.importedAt).toLocaleString() : 'Unknown'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Total Rows</span>
                                <span class="detail-value">${importObj.rowCount || 0}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Columns</span>
                                <span class="detail-value">${importObj.columnCount || 0}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Quality Score</span>
                                <span class="detail-value">${importObj.quality?.score || 'N/A'}%</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Completeness</span>
                                <span class="detail-value">${importObj.quality?.completenessPercent || 'N/A'}</span>
                            </div>
                            ${source ? `
                                <div class="detail-row">
                                    <span class="detail-label">Added to Set</span>
                                    <span class="detail-value">${source.addedAt ? new Date(source.addedAt).toLocaleString() : 'Unknown'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Import Mode</span>
                                    <span class="detail-value">${source.mode || 'additive'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Records in Set</span>
                                    <span class="detail-value">${source.recordCount || 0}</span>
                                </div>
                            ` : ''}
                        </div>

                        ${importObj.schema?.primaryKeyCandidate ? `
                            <div class="detail-section">
                                <h4>Schema Analysis</h4>
                                <div class="detail-row">
                                    <span class="detail-label">Primary Key</span>
                                    <span class="detail-value">${importObj.schema.primaryKeyCandidate}</span>
                                </div>
                                ${importObj.schema.dateColumns?.length > 0 ? `
                                    <div class="detail-row">
                                        <span class="detail-label">Date Columns</span>
                                        <span class="detail-value">${importObj.schema.dateColumns.join(', ')}</span>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="SetManagement.closeSourceDetailsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', detailsHtml);
    }

    function closeSourceDetailsModal(event) {
        if (event && event.target.id !== 'sourceDetailsModal') return;
        const modal = document.getElementById('sourceDetailsModal');
        if (modal) modal.remove();
    }

    /**
     * Set deduplication handling mode
     */
    function setDedupHandling(setId, handling) {
        const set = state.sets.get(setId);
        if (!set) return;

        set.dedupHandling = handling;

        // Create event
        if (typeof createEvent === 'function') {
            createEvent(
                'Update Dedup Handling',
                'ALT',
                { type: 'Set', id: setId },
                { handling, summary: `Changed duplicate handling to "${handling}"` }
            );
        }

        // Refresh view
        if (typeof renderCurrentView === 'function') renderCurrentView();

        const messages = {
            'hide': 'Duplicates are now hidden',
            'show': 'All records now shown including duplicates',
            'sup': 'Duplicates will be merged using SUP'
        };
        showToast(messages[handling] || 'Duplicate handling updated');
    }

    // ============================================================================
    // UI ACTIONS
    // ============================================================================

    function switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('#setManagementModal .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update tab content
        document.querySelectorAll('#setManagementModal .tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });
    }

    function closeModal(event) {
        if (event && event.target.id !== 'setManagementModal') return;
        const modal = document.getElementById('setManagementModal');
        if (modal) modal.remove();
    }

    function saveChanges(setId) {
        const set = state.sets.get(setId);
        if (!set) return;

        const nameInput = document.getElementById('setNameInput');
        if (nameInput && nameInput.value.trim()) {
            const oldName = set.name;
            set.name = nameInput.value.trim();

            // Update title in modal
            const title = document.getElementById('setModalTitle');
            if (title) title.textContent = set.name;

            // Create event
            if (typeof createEvent === 'function') {
                createEvent(
                    'Rename Set',
                    'UPD',
                    { type: 'Set', id: setId },
                    { oldName, newName: set.name, summary: `Renamed set from "${oldName}" to "${set.name}"` }
                );
            }

            // Refresh UI
            if (typeof renderNav === 'function') renderNav();
            if (typeof renderCurrentView === 'function') renderCurrentView();

            showToast('✓ Set updated');
        }
    }

    function tossSet(setId) {
        const set = state.sets.get(setId);
        if (!set) return;

        const recordCount = set.records.size;
        const message = `Are you sure you want to toss the entire set "${set.name}"?\n\n` +
            `This will toss ${recordCount} record${recordCount === 1 ? '' : 's'} and ${set.schema.length} field${set.schema.length === 1 ? '' : 's'}.\n\n` +
            `Items can be restored from the toss pile.`;

        if (typeof showConfirm === 'function') {
            showConfirm(message, () => {
                // Toss all records first
                if (typeof TossPile !== 'undefined') {
                    const recordIds = Array.from(set.records.keys());
                    if (recordIds.length > 0) {
                        TossPile.tossRecords(state, recordIds);
                    }
                }

                // Close modal
                closeModal();

                // Navigate away from this set
                if (state.currentSetId === setId) {
                    const otherSetId = Array.from(state.sets.keys()).find(id => id !== setId);
                    if (otherSetId) {
                        navigateToSet(otherSetId);
                    }
                }

                showToast(`✓ Set "${set.name}" tossed`);
            });
        }
    }

    function pickUpAll(setId) {
        if (typeof TossPile === 'undefined') return;

        const actions = TossPile.getTossActionsForSet(state, setId);
        let totalRestored = 0;

        actions.forEach(action => {
            const result = TossPile.pickUpAction(state, action.id);
            if (result) {
                totalRestored += result.restoredEntries.length;
            }
        });

        if (totalRestored > 0) {
            if (typeof renderCurrentView === 'function') renderCurrentView();
            showToast(`✓ Picked up ${totalRestored} items`);

            // Refresh the modal
            closeModal();
            openSetManagementModal(setId);
        }
    }

    function openIconPicker(setId) {
        // Use existing icon picker if available
        if (typeof openIconModal === 'function') {
            state.iconPickerTarget = `set:${setId}`;
            openIconModal();
        }
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    function getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================================
    // EXPORT
    // ============================================================================

    const SetManagement = {
        // Data functions
        getSetProvenance,
        getSetRelationships,
        getSetSources,

        // UI functions
        openSetManagementModal,
        switchTab,
        closeModal,
        saveChanges,
        tossSet,
        pickUpAll,
        openIconPicker,

        // Source management functions
        showAddImportModal,
        closeAddImportModal,
        addImportToSet,
        confirmRemoveSource,
        removeSourceFromSet,
        viewSourceRecords,
        showSourceDetails,
        closeSourceDetailsModal,
        setDedupHandling
    };

    global.SetManagement = SetManagement;

})(typeof window !== 'undefined' ? window : global);
