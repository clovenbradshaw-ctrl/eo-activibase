/**
 * EO Set Data Flow Visualization
 *
 * Visual diagram showing how data flows through a set:
 * - Import sources feeding in (left)
 * - Set as the central hub (center)
 * - Views consuming the data (right)
 * - Linked sets as connections
 */

(function(global) {
    'use strict';

    /**
     * Render a data flow diagram for a set
     * @param {string} setId - The set to visualize
     * @param {Object} state - Application state
     * @returns {string} HTML for the data flow diagram
     */
    function renderSetDataFlow(setId, state) {
        const set = state.sets.get(setId);
        if (!set) return '';

        // Gather data sources
        const sources = gatherSources(set, state);

        // Gather views
        const views = gatherViews(set);

        // Gather linked sets
        const linkedSets = gatherLinkedSets(set, state);

        // Calculate layout dimensions
        const maxItems = Math.max(sources.length, views.length, 1);
        const diagramHeight = Math.max(280, 80 + maxItems * 56);

        return `
            <div class="data-flow-container" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                    <h3 style="font-size: 16px; font-weight: 600; color: #374151; margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class="ph ph-flow-arrow" style="color: #6366f1;"></i>
                        Data Flow
                    </h3>
                    <div style="font-size: 12px; color: #64748b;">
                        ${sources.length} source${sources.length !== 1 ? 's' : ''} → ${set.records.size} records → ${views.length} view${views.length !== 1 ? 's' : ''}
                    </div>
                </div>

                <div class="data-flow-diagram" style="display: flex; align-items: stretch; justify-content: space-between; min-height: ${diagramHeight}px; position: relative;">

                    <!-- SOURCES COLUMN -->
                    <div class="flow-column flow-sources" style="flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center; padding-right: 20px;">
                        <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; text-align: center;">
                            Sources
                        </div>
                        ${sources.length > 0 ? sources.map((source, idx) => renderSourceNode(source, idx)).join('') : renderEmptySourceNode()}
                    </div>

                    <!-- FLOW ARROWS LEFT -->
                    <div class="flow-arrows" style="display: flex; flex-direction: column; justify-content: center; padding: 0 8px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            ${sources.map(() => '<i class="ph ph-caret-right" style="color: #94a3b8; font-size: 16px;"></i>').join('') || '<i class="ph ph-caret-right" style="color: #d1d5db; font-size: 16px;"></i>'}
                        </div>
                    </div>

                    <!-- SET NODE (CENTER) -->
                    <div class="flow-column flow-set" style="flex: 0 0 200px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        ${renderSetNode(set, setId, linkedSets)}
                    </div>

                    <!-- FLOW ARROWS RIGHT -->
                    <div class="flow-arrows" style="display: flex; flex-direction: column; justify-content: center; padding: 0 8px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            ${views.map(() => '<i class="ph ph-caret-right" style="color: #94a3b8; font-size: 16px;"></i>').join('') || '<i class="ph ph-caret-right" style="color: #d1d5db; font-size: 16px;"></i>'}
                        </div>
                    </div>

                    <!-- VIEWS COLUMN -->
                    <div class="flow-column flow-views" style="flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center; padding-left: 20px;">
                        <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; text-align: center;">
                            Views
                        </div>
                        ${views.length > 0 ? views.map((view, idx) => renderViewNode(view, setId, idx)).join('') : renderEmptyViewNode(setId)}
                    </div>

                </div>

                ${linkedSets.outgoing.length > 0 || linkedSets.incoming.length > 0 ? renderLinkedSetsSection(linkedSets) : ''}
            </div>
        `;
    }

    /**
     * Gather all data sources for a set
     */
    function gatherSources(set, state) {
        const sources = [];

        // Check set.sources array (multi-source architecture)
        if (set.sources && Array.isArray(set.sources)) {
            set.sources.forEach(source => {
                const importObj = state.importManager?.getImport(source.importId);
                sources.push({
                    type: 'import',
                    id: source.importId,
                    name: source.importName || importObj?.source?.filename || 'Import',
                    recordCount: source.recordCount || 0,
                    format: importObj?.source?.format || 'file',
                    addedAt: source.addedAt
                });
            });
        }

        // Check for single importId (legacy)
        if (set.importId && !sources.find(s => s.id === set.importId)) {
            const importObj = state.importManager?.getImport(set.importId);
            sources.push({
                type: 'import',
                id: set.importId,
                name: importObj?.source?.filename || 'Import',
                recordCount: importObj?.records?.length || 0,
                format: importObj?.source?.format || 'file'
            });
        }

        // Count manual entries
        let manualCount = 0;
        set.records.forEach(record => {
            if (!record.sourceImportId) {
                manualCount++;
            }
        });

        if (manualCount > 0) {
            sources.push({
                type: 'manual',
                id: 'manual',
                name: 'Manual Entries',
                recordCount: manualCount,
                format: 'manual'
            });
        }

        return sources;
    }

    /**
     * Gather all views for a set
     */
    function gatherViews(set) {
        const views = [];

        if (set.views && set.views.size > 0) {
            set.views.forEach((view, viewId) => {
                views.push({
                    id: viewId,
                    name: view.name,
                    type: view.type || 'grid',
                    icon: view.icon,
                    parentId: view.parentId,
                    isDerived: !!view.derivedFrom || !!view.pivotMetadata
                });
            });
        }

        // Sort: parent views first, then children
        views.sort((a, b) => {
            if (a.parentId && !b.parentId) return 1;
            if (!a.parentId && b.parentId) return -1;
            return 0;
        });

        return views;
    }

    /**
     * Gather linked sets (outgoing and incoming relationships)
     */
    function gatherLinkedSets(set, state) {
        const outgoing = [];
        const incoming = [];

        // Outgoing: LINKED_RECORD fields pointing to other sets
        set.schema.forEach(field => {
            if (field.type === 'LINKED_RECORD' && field.config?.linkedSetId) {
                const targetSet = state.sets.get(field.config.linkedSetId);
                if (targetSet) {
                    outgoing.push({
                        setId: field.config.linkedSetId,
                        setName: targetSet.name,
                        fieldName: field.name,
                        verb: field.config.relationshipVerb || 'links to',
                        icon: targetSet.icon
                    });
                }
            }
        });

        // Incoming: Other sets linking to this set
        state.sets.forEach((otherSet, otherSetId) => {
            if (otherSetId === set.id) return;

            otherSet.schema.forEach(field => {
                if (field.type === 'LINKED_RECORD' && field.config?.linkedSetId === set.id) {
                    incoming.push({
                        setId: otherSetId,
                        setName: otherSet.name,
                        fieldName: field.name,
                        verb: field.config.inverseVerb || field.config.relationshipVerb || 'referenced by',
                        icon: otherSet.icon
                    });
                }
            });
        });

        return { outgoing, incoming };
    }

    /**
     * Render a source node
     */
    function renderSourceNode(source, index) {
        const iconMap = {
            'csv': 'ph-file-csv',
            'json': 'ph-brackets-curly',
            'xlsx': 'ph-file-xls',
            'manual': 'ph-pencil-simple',
            'file': 'ph-file'
        };
        const icon = iconMap[source.format] || iconMap.file;
        const bgColor = source.type === 'manual' ? '#ecfdf5' : '#f0f9ff';
        const borderColor = source.type === 'manual' ? '#a7f3d0' : '#bae6fd';
        const iconColor = source.type === 'manual' ? '#059669' : '#0284c7';

        return `
            <div class="flow-node source-node"
                 style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; cursor: pointer; transition: all 0.15s;"
                 onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';"
                 onmouseout="this.style.transform='none'; this.style.boxShadow='none';"
                 title="${source.name}&#10;${source.recordCount} records">
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 6px; flex-shrink: 0;">
                    <i class="ph ${icon}" style="font-size: 16px; color: ${iconColor};"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(source.name)}</div>
                    <div style="font-size: 11px; color: #64748b;">${source.recordCount} records</div>
                </div>
            </div>
        `;
    }

    /**
     * Render empty source placeholder
     */
    function renderEmptySourceNode() {
        return `
            <div class="flow-node source-node empty"
                 style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 6px;">
                    <i class="ph ph-plus" style="font-size: 16px; color: #94a3b8;"></i>
                </div>
                <div style="font-size: 13px; color: #94a3b8;">No sources yet</div>
            </div>
        `;
    }

    /**
     * Render the central set node
     */
    function renderSetNode(set, setId, linkedSets) {
        const iconHtml = typeof renderIcon === 'function'
            ? renderIcon(set.icon || 'ph-squares-four')
            : '<i class="ph ph-squares-four"></i>';

        const linkedCount = linkedSets.outgoing.length + linkedSets.incoming.length;
        const linkedBadge = linkedCount > 0
            ? `<div style="position: absolute; top: -8px; right: -8px; background: #8b5cf6; color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; display: flex; align-items: center; gap: 3px;">
                   <i class="ph ph-link" style="font-size: 10px;"></i> ${linkedCount}
               </div>`
            : '';

        return `
            <div class="flow-node set-node"
                 style="position: relative; display: flex; flex-direction: column; align-items: center; padding: 20px 24px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border-radius: 12px; color: white; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); min-width: 160px;">
                ${linkedBadge}
                <div style="font-size: 32px; margin-bottom: 8px;">${iconHtml}</div>
                <div style="font-size: 15px; font-weight: 700; text-align: center; margin-bottom: 4px;">${escapeHtml(set.name)}</div>
                <div style="font-size: 12px; opacity: 0.85;">${set.records.size} records</div>
                <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">${set.schema.length} fields</div>
            </div>
        `;
    }

    /**
     * Render a view node
     */
    function renderViewNode(view, setId, index) {
        const VIEW_TYPE_ICONS = {
            'grid': 'ph-table',
            'gallery': 'ph-squares-four',
            'kanban': 'ph-kanban',
            'calendar': 'ph-calendar',
            'timeline': 'ph-chart-line'
        };
        const icon = view.icon || VIEW_TYPE_ICONS[view.type] || 'ph-table';
        const derivedBadge = view.isDerived
            ? '<span style="background: #fef3c7; color: #92400e; font-size: 9px; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">derived</span>'
            : '';
        const indent = view.parentId ? 'margin-left: 16px;' : '';

        return `
            <div class="flow-node view-node"
                 onclick="switchSet('${setId}', '${view.id}')"
                 style="${indent} display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; cursor: pointer; transition: all 0.15s;"
                 onmouseover="this.style.transform='translateX(-4px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';"
                 onmouseout="this.style.transform='none'; this.style.boxShadow='none';"
                 title="Open ${view.name} view">
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 6px; flex-shrink: 0;">
                    <i class="ph ${icon}" style="font-size: 16px; color: #9333ea;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${escapeHtml(view.name)}${derivedBadge}
                    </div>
                    <div style="font-size: 11px; color: #64748b;">${view.type}</div>
                </div>
            </div>
        `;
    }

    /**
     * Render empty view placeholder
     */
    function renderEmptyViewNode(setId) {
        return `
            <div class="flow-node view-node empty"
                 onclick="createViewForSet('${setId}')"
                 style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; cursor: pointer;"
                 onmouseover="this.style.borderColor='#a78bfa';"
                 onmouseout="this.style.borderColor='#cbd5e1';">
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 6px;">
                    <i class="ph ph-plus" style="font-size: 16px; color: #94a3b8;"></i>
                </div>
                <div style="font-size: 13px; color: #94a3b8;">Create first view</div>
            </div>
        `;
    }

    /**
     * Render linked sets section at bottom
     */
    function renderLinkedSetsSection(linkedSets) {
        const outgoingHtml = linkedSets.outgoing.map(link => `
            <div onclick="openSetOverview('${link.setId}')"
                 style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; cursor: pointer; font-size: 12px;"
                 onmouseover="this.style.background='#dbeafe';"
                 onmouseout="this.style.background='#eff6ff';">
                <i class="ph ph-arrow-right" style="color: #3b82f6;"></i>
                <span style="color: #1e40af; font-weight: 500;">${escapeHtml(link.setName)}</span>
                <span style="color: #64748b;">via ${escapeHtml(link.fieldName)}</span>
            </div>
        `).join('');

        const incomingHtml = linkedSets.incoming.map(link => `
            <div onclick="openSetOverview('${link.setId}')"
                 style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; cursor: pointer; font-size: 12px;"
                 onmouseover="this.style.background='#dcfce7';"
                 onmouseout="this.style.background='#f0fdf4';">
                <i class="ph ph-arrow-left" style="color: #22c55e;"></i>
                <span style="color: #166534; font-weight: 500;">${escapeHtml(link.setName)}</span>
                <span style="color: #64748b;">via ${escapeHtml(link.fieldName)}</span>
            </div>
        `).join('');

        return `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                    <i class="ph ph-link" style="margin-right: 4px;"></i>
                    Linked Sets
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${outgoingHtml}
                    ${incomingHtml}
                </div>
            </div>
        `;
    }

    /**
     * Simple HTML escape helper
     */
    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Export
    global.EOSetDataFlow = {
        renderSetDataFlow
    };

})(typeof window !== 'undefined' ? window : this);
