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
                    linkCount: countLinkedRecords(set, field.id)
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
                        linkCount: countLinkedRecords(otherSet, field.id)
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
     */
    function openSetManagementModal(setId) {
        const set = state.sets.get(setId);
        if (!set) return;

        const provenance = getSetProvenance(state, setId);
        const relationships = getSetRelationships(state, setId);
        const tossPileStats = typeof TossPile !== 'undefined' ?
            TossPile.getTossPileStats(state, setId) : null;

        const modalHtml = `
            <div class="modal-overlay" id="setManagementModal" onclick="SetManagement.closeModal(event)">
                <div class="modal large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <div class="modal-title-group">
                            <span class="set-icon">${set.icon || '<i class="ph ph-squares-four"></i>'}</span>
                            <h2 id="setModalTitle">${escapeHtml(set.name)}</h2>
                        </div>
                        <button class="modal-close" onclick="SetManagement.closeModal()">×</button>
                    </div>
                    <div class="modal-body set-management-body">
                        <div class="set-management-tabs">
                            <button class="tab-btn active" data-tab="details" onclick="SetManagement.switchTab('details')">Details</button>
                            <button class="tab-btn" data-tab="provenance" onclick="SetManagement.switchTab('provenance')">Provenance</button>
                            <button class="tab-btn" data-tab="relationships" onclick="SetManagement.switchTab('relationships')">Relationships</button>
                            ${tossPileStats && tossPileStats.totalEntries > 0 ? `
                                <button class="tab-btn" data-tab="tossed" onclick="SetManagement.switchTab('tossed')">
                                    Tossed <span class="tab-badge">${tossPileStats.totalEntries}</span>
                                </button>
                            ` : ''}
                        </div>

                        <div class="tab-content active" id="tab-details">
                            ${renderDetailsTab(set, setId)}
                        </div>

                        <div class="tab-content" id="tab-provenance">
                            ${renderProvenanceTab(provenance)}
                        </div>

                        <div class="tab-content" id="tab-relationships">
                            ${renderRelationshipsTab(relationships)}
                        </div>

                        ${tossPileStats && tossPileStats.totalEntries > 0 ? `
                            <div class="tab-content" id="tab-tossed">
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
                        <span class="current-icon">${set.icon || '<i class="ph ph-squares-four"></i>'}</span>
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
                                    <span class="rel-via">via ${escapeHtml(link.fieldName)}</span>
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
                                    <span class="rel-via">via ${escapeHtml(ref.fieldName)}</span>
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

        // UI functions
        openSetManagementModal,
        switchTab,
        closeModal,
        saveChanges,
        tossSet,
        pickUpAll,
        openIconPicker
    };

    global.SetManagement = SetManagement;

})(typeof window !== 'undefined' ? window : global);
