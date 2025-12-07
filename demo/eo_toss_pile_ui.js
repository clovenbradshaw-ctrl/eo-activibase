/**
 * EO Toss Pile UI
 *
 * UI components for the toss pile system including:
 * - Toss pile panel (slide-out with collapsible hierarchy)
 * - Ghost cell rendering
 * - Contextual indicators (badges, banners)
 * - Pick up dialogs
 */

(function(global) {
    'use strict';

    // Helper to get the global state object
    function getState() {
        return global.state;
    }

    // ============================================================================
    // PANEL RENDERING
    // ============================================================================

    /**
     * Render the toss pile panel
     */
    function renderTossPilePanel(state) {
        const pile = TossPile.init(state);
        const currentSetId = state.currentSetId;
        const stats = TossPile.getTossPileStats(state, currentSetId);
        const actions = TossPile.getTossActionsForSet(state, currentSetId);

        const panelHtml = `
            <div class="toss-pile-panel ${pile.settings.panelOpen ? 'open' : ''}" id="tossPilePanel">
                <div class="toss-pile-header">
                    <div class="toss-pile-title">
                        <span class="toss-pile-icon">🗑</span>
                        <span>Toss Pile</span>
                        ${stats.totalEntries > 0 ? `<span class="toss-pile-badge">${stats.totalEntries}</span>` : ''}
                    </div>
                    <button class="toss-pile-close" onclick="TossPileUI.closePanel()">×</button>
                </div>
                <div class="toss-pile-toolbar">
                    ${stats.totalEntries > 0 ? `
                        <label class="ghost-toggle">
                            <input type="checkbox" ${pile.settings.showGhosts ? 'checked' : ''}
                                   onchange="TossPileUI.toggleGhosts(this.checked)">
                            <span>Show ghosts</span>
                        </label>
                        <button class="toss-pile-action-btn" onclick="TossPileUI.pickUpAll()">
                            Pick Up All
                        </button>
                    ` : ''}
                </div>
                <div class="toss-pile-content">
                    ${stats.totalEntries === 0 ? `
                        <div class="toss-pile-empty">
                            <div class="empty-icon">📭</div>
                            <div class="empty-text">Nothing in the toss pile</div>
                            <div class="empty-hint">Deleted items will appear here for recovery</div>
                        </div>
                    ` : renderTossActionsList(state, actions)}
                </div>
            </div>
        `;

        return panelHtml;
    }

    /**
     * Render the list of toss actions (grouped by time)
     */
    function renderTossActionsList(state, actions) {
        if (!actions || actions.length === 0) {
            return '<div class="toss-pile-empty">No tossed items</div>';
        }

        const pile = TossPile.init(state);

        // Group by time periods
        const now = Date.now();
        const groups = {
            recent: { label: 'Just now', actions: [] },
            today: { label: 'Today', actions: [] },
            yesterday: { label: 'Yesterday', actions: [] },
            older: { label: 'Older', actions: [] }
        };

        actions.forEach(action => {
            const age = now - new Date(action.timestamp).getTime();
            const fiveMinutes = 5 * 60 * 1000;
            const oneDay = 24 * 60 * 60 * 1000;
            const twoDays = 2 * 24 * 60 * 60 * 1000;

            if (age < fiveMinutes) {
                groups.recent.actions.push(action);
            } else if (age < oneDay) {
                groups.today.actions.push(action);
            } else if (age < twoDays) {
                groups.yesterday.actions.push(action);
            } else {
                groups.older.actions.push(action);
            }
        });

        let html = '';
        Object.values(groups).forEach(group => {
            if (group.actions.length > 0) {
                html += `
                    <div class="toss-group">
                        <div class="toss-group-header">${group.label}</div>
                        ${group.actions.map(action => renderTossAction(state, action, pile)).join('')}
                    </div>
                `;
            }
        });

        return html;
    }

    /**
     * Render a single toss action (collapsible)
     */
    function renderTossAction(state, action, pile) {
        const entryCount = action.entryIds.filter(id => {
            const entry = pile.entries.get(id);
            return entry && entry.status === 'tossed';
        }).length;

        if (entryCount === 0) return '';

        const timeAgo = getTimeAgo(action.timestamp);
        const typeIcon = getActionTypeIcon(action.type);

        return `
            <div class="toss-action" data-action-id="${action.id}">
                <div class="toss-action-header" onclick="TossPileUI.toggleActionExpand('${action.id}')">
                    <span class="expand-icon">▸</span>
                    <span class="action-icon">${typeIcon}</span>
                    <span class="action-summary">${action.summary}</span>
                    <span class="action-count">${entryCount}</span>
                    <span class="action-time">${timeAgo}</span>
                    <button class="pick-up-btn" onclick="event.stopPropagation(); TossPileUI.pickUpAction('${action.id}')" title="Pick up all">
                        ↩
                    </button>
                </div>
                <div class="toss-action-entries" id="entries-${action.id}">
                    ${renderActionEntries(state, action, pile)}
                </div>
            </div>
        `;
    }

    /**
     * Render entries within an action
     */
    function renderActionEntries(state, action, pile) {
        const entries = action.entryIds
            .map(id => pile.entries.get(id))
            .filter(e => e && e.status === 'tossed');

        if (entries.length === 0) return '';

        // Group by record for record-level actions
        if (action.type === 'toss_record' || action.type === 'toss_records') {
            const byRecord = new Map();
            entries.forEach(entry => {
                if (!byRecord.has(entry.recordId)) {
                    byRecord.set(entry.recordId, []);
                }
                byRecord.get(entry.recordId).push(entry);
            });

            return Array.from(byRecord.entries()).map(([recordId, recordEntries]) => `
                <div class="toss-record-group" data-record-id="${recordId}">
                    <div class="toss-record-header" onclick="TossPileUI.toggleRecordExpand('${action.id}', '${recordId}')">
                        <span class="expand-icon">▸</span>
                        <span class="record-label">Record</span>
                        <span class="record-id">${recordId.substring(0, 12)}...</span>
                        <span class="field-count">${recordEntries.length} fields</span>
                        <button class="pick-up-btn small" onclick="event.stopPropagation(); TossPileUI.pickUpRecord('${action.id}', '${recordId}')" title="Pick up record">
                            ↩
                        </button>
                    </div>
                    <div class="toss-record-fields" id="fields-${action.id}-${recordId}">
                        ${recordEntries.map(entry => renderTossEntry(entry)).join('')}
                    </div>
                </div>
            `).join('');
        }

        // For column deletions, show by field value
        if (action.type === 'toss_column') {
            return `
                <div class="toss-column-entries">
                    ${entries.slice(0, 10).map(entry => renderTossEntry(entry)).join('')}
                    ${entries.length > 10 ? `
                        <div class="more-entries" onclick="TossPileUI.showAllEntries('${action.id}')">
                            +${entries.length - 10} more values...
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Default: show entries directly
        return entries.map(entry => renderTossEntry(entry)).join('');
    }

    /**
     * Render a single toss entry
     */
    function renderTossEntry(entry) {
        const displayValue = formatCellValue(entry.value, entry.fieldType);
        const truncatedValue = displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue;

        return `
            <div class="toss-entry" data-entry-id="${entry.id}">
                <span class="entry-field">${entry.fieldName}:</span>
                <span class="entry-value" title="${escapeHtml(displayValue)}">${escapeHtml(truncatedValue)}</span>
                <button class="pick-up-btn tiny" onclick="TossPileUI.pickUpEntry('${entry.id}')" title="Pick up">
                    ↩
                </button>
            </div>
        `;
    }

    // ============================================================================
    // GHOST CELLS
    // ============================================================================

    /**
     * Render ghost rows in the table
     */
    function renderGhostRows(state, tbody, tableSchema, view) {
        const pile = TossPile.init(state);
        if (!pile.settings.showGhosts) return;

        const ghostData = TossPile.getGhostData(state, state.currentSetId);
        const set = state.sets.get(state.currentSetId);
        if (!set) return;

        // Render ghost rows (full records that were tossed)
        ghostData.records.forEach((data, recordId) => {
            if (!data.isFullRecord) return; // Only show full ghost rows

            const tr = document.createElement('tr');
            tr.className = 'ghost-row';
            tr.dataset.ghostRecordId = recordId;
            tr.dataset.actionId = data.action?.id;

            // Checkbox cell
            const selectTd = document.createElement('td');
            selectTd.className = 'row-select-cell ghost-cell';
            selectTd.innerHTML = '<span class="ghost-indicator">◌</span>';
            tr.appendChild(selectTd);

            // Row number cell
            if (view.showRowNumbers) {
                const rowNumberTd = document.createElement('td');
                rowNumberTd.className = 'row-number-cell ghost-cell';
                rowNumberTd.innerHTML = '<span class="ghost-dash">-</span>';
                tr.appendChild(rowNumberTd);
            }

            // Field cells
            tableSchema.forEach(field => {
                const td = document.createElement('td');
                td.className = 'ghost-cell';
                td.dataset.fieldId = field.id;

                const ghostEntry = data.fields.get(field.id);
                if (ghostEntry) {
                    const displayValue = formatCellValue(ghostEntry.value, ghostEntry.fieldType);
                    td.innerHTML = `<span class="ghost-value">${escapeHtml(displayValue)}</span>`;
                    td.title = `Tossed: ${displayValue}\nClick to pick up`;
                    td.onclick = () => TossPileUI.showPickUpDialog(ghostEntry.id);
                } else {
                    td.innerHTML = '<span class="ghost-empty"></span>';
                }

                tr.appendChild(td);
            });

            // Add pick up action to row
            tr.ondblclick = () => {
                if (data.action) {
                    TossPileUI.pickUpRecord(data.action.id, recordId);
                }
            };

            tbody.appendChild(tr);
        });
    }

    /**
     * Add ghost indicators to existing cells
     */
    function addGhostIndicatorsToCell(state, td, recordId, fieldId) {
        const pile = TossPile.init(state);
        if (!pile.settings.showGhosts) return;

        const entries = TossPile.getTossedEntriesForSet(state, state.currentSetId);
        const cellEntry = entries.find(e =>
            e.recordId === recordId &&
            e.fieldId === fieldId &&
            e.status === 'tossed'
        );

        if (cellEntry) {
            td.classList.add('has-tossed-value');
            const indicator = document.createElement('span');
            indicator.className = 'tossed-value-indicator';
            indicator.title = `Previous value: ${formatCellValue(cellEntry.value, cellEntry.fieldType)}\nClick to restore`;
            indicator.innerHTML = '⟲';
            indicator.onclick = (e) => {
                e.stopPropagation();
                TossPileUI.showPickUpDialog(cellEntry.id);
            };
            td.appendChild(indicator);
        }
    }

    // ============================================================================
    // COLUMN BADGES
    // ============================================================================

    /**
     * Add toss badge to column header if values are tossed
     */
    function addColumnTossBadge(state, th, fieldId) {
        const entries = TossPile.getTossedEntriesForSet(state, state.currentSetId);
        const columnEntries = entries.filter(e => e.fieldId === fieldId && e.status === 'tossed');

        if (columnEntries.length > 0) {
            const badge = document.createElement('span');
            badge.className = 'column-toss-badge';
            badge.textContent = columnEntries.length;
            badge.title = `${columnEntries.length} tossed value${columnEntries.length === 1 ? '' : 's'} in this column`;
            badge.onclick = (e) => {
                e.stopPropagation();
                TossPileUI.showColumnTossedValues(fieldId, columnEntries);
            };
            th.appendChild(badge);
        }
    }

    /**
     * Render tossed columns indicator (columns that were deleted)
     */
    function renderTossedColumnsIndicator(state) {
        const ghostData = TossPile.getGhostData(state, state.currentSetId);

        if (ghostData.columns.size === 0) return '';

        const columns = Array.from(ghostData.columns.values());

        return `
            <div class="tossed-columns-banner">
                <span class="banner-icon">📋</span>
                <span class="banner-text">${columns.length} tossed column${columns.length === 1 ? '' : 's'}</span>
                <button class="banner-action" onclick="TossPileUI.showTossedColumns()">
                    View
                </button>
            </div>
        `;
    }

    // ============================================================================
    // SET BANNER
    // ============================================================================

    /**
     * Render the set-level toss pile banner
     */
    function renderSetTossBanner(state) {
        const stats = TossPile.getTossPileStats(state, state.currentSetId);

        if (stats.totalEntries === 0) return '';

        return `
            <div class="set-toss-banner" id="setTossBanner">
                <span class="banner-icon">🗑</span>
                <span class="banner-text">${stats.totalEntries} item${stats.totalEntries === 1 ? '' : 's'} in toss pile</span>
                <button class="banner-view-btn" onclick="TossPileUI.openPanel()">View</button>
                <button class="banner-dismiss-btn" onclick="TossPileUI.dismissBanner()">×</button>
            </div>
        `;
    }

    // ============================================================================
    // PICK UP DIALOGS
    // ============================================================================

    /**
     * Show pick up dialog for an entry
     */
    function showPickUpDialog(entryId) {
        const state = getState();
        const related = TossPile.getRelatedEntries(state, entryId);
        if (!related) return;

        const { entry, action, sameAction, sameRecord, recommended } = related;

        const dialogHtml = `
            <div class="modal-overlay" id="pickUpDialog" onclick="TossPileUI.closePickUpDialog(event)">
                <div class="modal pick-up-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Pick Up Item</h2>
                        <button class="modal-close" onclick="TossPileUI.closePickUpDialog()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="pick-up-preview">
                            <div class="preview-field">${entry.fieldName}</div>
                            <div class="preview-value">${escapeHtml(formatCellValue(entry.value, entry.fieldType))}</div>
                        </div>

                        <div class="pick-up-options">
                            <label class="pick-up-option selected" data-mode="single">
                                <input type="radio" name="pickUpMode" value="single" checked>
                                <span class="option-label">Just this field</span>
                            </label>

                            ${sameAction.length > 0 ? `
                                <label class="pick-up-option" data-mode="action">
                                    <input type="radio" name="pickUpMode" value="action">
                                    <span class="option-label">Entire ${action.type === 'toss_record' ? 'record' : 'action'} (${sameAction.length + 1} fields)</span>
                                    <span class="option-hint">${action.summary}</span>
                                </label>
                            ` : ''}

                            ${sameRecord.length > 0 ? `
                                <label class="pick-up-option" data-mode="record">
                                    <input type="radio" name="pickUpMode" value="record">
                                    <span class="option-label">All from this record (${sameRecord.length + 1} fields)</span>
                                    <span class="option-hint">From multiple toss actions</span>
                                </label>
                            ` : ''}
                        </div>

                        ${entry.fieldSnapshot && !state.sets.get(entry.setId)?.schema.find(f => f.id === entry.fieldId) ? `
                            <div class="pick-up-warning">
                                <span class="warning-icon">⚠️</span>
                                <span>Column "${entry.fieldName}" will be restored</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="TossPileUI.closePickUpDialog()">Cancel</button>
                        <button class="btn-primary" onclick="TossPileUI.executePickUp('${entryId}')">
                            Pick Up
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHtml);

        // Wire up radio button styling
        document.querySelectorAll('#pickUpDialog .pick-up-option').forEach(option => {
            option.querySelector('input').addEventListener('change', () => {
                document.querySelectorAll('#pickUpDialog .pick-up-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
    }

    /**
     * Execute the pick up based on dialog selection
     */
    function executePickUp(entryId) {
        const state = getState();
        const mode = document.querySelector('#pickUpDialog input[name="pickUpMode"]:checked')?.value || 'single';
        const related = TossPile.getRelatedEntries(state, entryId);
        if (!related) return;

        let result;
        switch (mode) {
            case 'single':
                result = TossPile.pickUpEntry(state, entryId);
                break;
            case 'action':
                result = TossPile.pickUpAction(state, related.action.id);
                break;
            case 'record':
                const allRecordEntries = [entryId, ...related.sameRecord.map(e => e.id)];
                result = TossPile.pickUpEntries(state, allRecordEntries);
                break;
        }

        closePickUpDialog();
        renderCurrentView();
        // Apply restoration highlights after DOM update
        requestAnimationFrame(() => {
            applyRestorationHighlights(state);
        });
        updateTossPilePanel();

        if (result) {
            const count = mode === 'single' ? 1 :
                         mode === 'action' ? related.sameAction.length + 1 :
                         related.sameRecord.length + 1;
            showToast(`✓ Picked up ${count} item${count === 1 ? '' : 's'}`);
        }
    }

    function closePickUpDialog(event) {
        if (event && event.target.id !== 'pickUpDialog') return;
        const dialog = document.getElementById('pickUpDialog');
        if (dialog) dialog.remove();
    }

    // ============================================================================
    // TOSSED COLUMNS DIALOG
    // ============================================================================

    function showTossedColumns() {
        const state = getState();
        const ghostData = TossPile.getGhostData(state, state.currentSetId);
        const columns = Array.from(ghostData.columns.values());

        if (columns.length === 0) return;

        const dialogHtml = `
            <div class="modal-overlay" id="tossedColumnsDialog" onclick="TossPileUI.closeTossedColumnsDialog(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Tossed Columns</h2>
                        <button class="modal-close" onclick="TossPileUI.closeTossedColumnsDialog()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="tossed-columns-list">
                            ${columns.map(col => `
                                <div class="tossed-column-item">
                                    <div class="column-info">
                                        <span class="column-name">${col.fieldName}</span>
                                        <span class="column-type">${col.fieldType}</span>
                                        <span class="column-count">${col.count} values</span>
                                    </div>
                                    <button class="btn-secondary" onclick="TossPileUI.pickUpColumn('${col.fieldId}')">
                                        Pick Up Column
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="TossPileUI.closeTossedColumnsDialog()">Close</button>
                        <button class="btn-primary" onclick="TossPileUI.pickUpAllColumns()">
                            Pick Up All Columns
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHtml);
    }

    function closeTossedColumnsDialog(event) {
        if (event && event.target.id !== 'tossedColumnsDialog') return;
        const dialog = document.getElementById('tossedColumnsDialog');
        if (dialog) dialog.remove();
    }

    function pickUpColumn(fieldId) {
        const state = getState();
        const pile = TossPile.init(state);
        const entries = Array.from(pile.entries.values())
            .filter(e => e.fieldId === fieldId && e.status === 'tossed');

        const result = TossPile.pickUpEntries(state, entries.map(e => e.id));

        closeTossedColumnsDialog();
        renderCurrentView();
        // Apply restoration highlights after DOM update
        requestAnimationFrame(() => {
            applyRestorationHighlights(state);
            if (result.restoredEntries.length > 2) {
                renderRestorationBanner(result.restoredEntries.length);
            }
        });
        updateTossPilePanel();

        if (result.restoredEntries.length > 0) {
            showToast(`✓ Restored column with ${result.restoredEntries.length} values`);
        }
    }

    // ============================================================================
    // COLUMN VALUES POPUP
    // ============================================================================

    function showColumnTossedValues(fieldId, entries) {
        const popupHtml = `
            <div class="column-toss-popup" id="columnTossPopup">
                <div class="popup-header">
                    <span>Tossed values in ${entries[0]?.fieldName || 'column'}</span>
                    <button onclick="document.getElementById('columnTossPopup').remove()">×</button>
                </div>
                <div class="popup-content">
                    ${entries.slice(0, 10).map(entry => `
                        <div class="popup-entry">
                            <span class="entry-value">${escapeHtml(formatCellValue(entry.value, entry.fieldType))}</span>
                            <button onclick="TossPileUI.pickUpEntry('${entry.id}'); document.getElementById('columnTossPopup').remove();">↩</button>
                        </div>
                    `).join('')}
                    ${entries.length > 10 ? `<div class="popup-more">+${entries.length - 10} more</div>` : ''}
                </div>
                <div class="popup-footer">
                    <button onclick="TossPileUI.pickUpColumnValues('${fieldId}'); document.getElementById('columnTossPopup').remove();">
                        Pick Up All (${entries.length})
                    </button>
                </div>
            </div>
        `;

        // Remove existing popup
        const existing = document.getElementById('columnTossPopup');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', popupHtml);

        // Position near cursor (simplified)
        const popup = document.getElementById('columnTossPopup');
        popup.style.position = 'fixed';
        popup.style.right = '20px';
        popup.style.top = '100px';
    }

    function pickUpColumnValues(fieldId) {
        const state = getState();
        const pile = TossPile.init(state);
        const entries = Array.from(pile.entries.values())
            .filter(e => e.fieldId === fieldId && e.status === 'tossed');

        const result = TossPile.pickUpEntries(state, entries.map(e => e.id));

        renderCurrentView();
        // Apply restoration highlights after DOM update
        requestAnimationFrame(() => {
            applyRestorationHighlights(state);
            if (result.restoredEntries.length > 2) {
                renderRestorationBanner(result.restoredEntries.length);
            }
        });
        updateTossPilePanel();

        if (result.restoredEntries.length > 0) {
            showToast(`✓ Restored ${result.restoredEntries.length} values`);
        }
    }

    // ============================================================================
    // PANEL CONTROLS
    // ============================================================================

    function openPanel() {
        const state = getState();
        TossPile.toggleTossPilePanel(state, true);
        updateTossPilePanel();
        const panel = document.getElementById('tossPilePanel');
        if (panel) panel.classList.add('open');
    }

    function closePanel() {
        const state = getState();
        TossPile.toggleTossPilePanel(state, false);
        const panel = document.getElementById('tossPilePanel');
        if (panel) panel.classList.remove('open');
    }

    function togglePanel() {
        const state = getState();
        const isOpen = TossPile.toggleTossPilePanel(state);
        updateTossPilePanel();
        const panel = document.getElementById('tossPilePanel');
        if (panel) panel.classList.toggle('open', isOpen);
    }

    function updateTossPilePanel() {
        const state = getState();
        const container = document.getElementById('tossPilePanelContainer');
        if (container) {
            container.innerHTML = renderTossPilePanel(state);
        }
    }

    function toggleGhosts(visible) {
        const state = getState();
        TossPile.setGhostVisibility(state, visible);
        renderCurrentView();
    }

    function dismissBanner() {
        const banner = document.getElementById('setTossBanner');
        if (banner) banner.remove();
    }

    // ============================================================================
    // ACTION EXPANSION
    // ============================================================================

    function toggleActionExpand(actionId) {
        const entries = document.getElementById(`entries-${actionId}`);
        const action = document.querySelector(`[data-action-id="${actionId}"]`);
        if (entries && action) {
            entries.classList.toggle('expanded');
            action.classList.toggle('expanded');
        }
    }

    function toggleRecordExpand(actionId, recordId) {
        const fields = document.getElementById(`fields-${actionId}-${recordId}`);
        const record = document.querySelector(`[data-record-id="${recordId}"]`);
        if (fields && record) {
            fields.classList.toggle('expanded');
            record.classList.toggle('expanded');
        }
    }

    // ============================================================================
    // REAPPEARANCE HIGHLIGHT SYSTEM
    // ============================================================================

    /**
     * Apply highlight classes to recently restored rows/cells in the DOM
     * Call this after renderCurrentView() to highlight restored data
     */
    function applyRestorationHighlights(state) {
        const restoredRecordIds = TossPile.getRecentlyRestoredRecords(state);

        if (restoredRecordIds.length === 0) return;

        // Apply highlights to each restored record's row
        restoredRecordIds.forEach(recordId => {
            // Find the table row for this record
            const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
            if (row) {
                // Add the restored-row class for full row animation
                row.classList.add('restored-row');

                // Also highlight specific restored cells
                const restoredCellFieldIds = TossPile.getRecentlyRestoredCells(state, recordId);
                restoredCellFieldIds.forEach(fieldId => {
                    const cell = row.querySelector(`td[data-field-id="${fieldId}"]`);
                    if (cell) {
                        cell.classList.add('restored-cell');
                    }
                });
            }
        });

        // Schedule cleanup of highlight classes after animation completes
        TossPile.scheduleHighlightClear(state, () => {
            removeRestorationHighlights();
        });
    }

    /**
     * Remove restoration highlight classes from all elements
     */
    function removeRestorationHighlights() {
        document.querySelectorAll('.restored-row').forEach(el => {
            el.classList.remove('restored-row');
        });
        document.querySelectorAll('.restored-cell').forEach(el => {
            el.classList.remove('restored-cell');
        });
    }

    /**
     * Render a restoration notification banner (optional, shown above the table)
     */
    function renderRestorationBanner(count) {
        // Remove any existing banner
        const existing = document.getElementById('restorationBanner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'restorationBanner';
        banner.className = 'restoration-banner';
        banner.innerHTML = `
            <span class="restore-indicator">
                <span class="icon">↩</span>
                <span>${count} item${count !== 1 ? 's' : ''} restored</span>
            </span>
        `;

        // Insert at the top of the main content area
        const tableContainer = document.querySelector('.table-container') ||
                              document.querySelector('.data-grid') ||
                              document.querySelector('main');
        if (tableContainer) {
            tableContainer.insertBefore(banner, tableContainer.firstChild);

            // Auto-remove after animation completes
            setTimeout(() => {
                banner.classList.add('fade-out');
                setTimeout(() => banner.remove(), 300);
            }, 3000);
        }
    }

    // ============================================================================
    // PICK UP ACTIONS
    // ============================================================================

    function pickUpEntry(entryId) {
        const state = getState();
        const result = TossPile.pickUpEntry(state, entryId);
        if (result) {
            renderCurrentView();
            // Apply restoration highlights after DOM update
            requestAnimationFrame(() => {
                applyRestorationHighlights(state);
            });
            updateTossPilePanel();
            showToast('✓ Item picked up');
        }
    }

    function pickUpAction(actionId) {
        const state = getState();
        const result = TossPile.pickUpAction(state, actionId);
        if (result) {
            renderCurrentView();
            // Apply restoration highlights after DOM update
            requestAnimationFrame(() => {
                applyRestorationHighlights(state);
                if (result.restoredEntries.length > 2) {
                    renderRestorationBanner(result.restoredEntries.length);
                }
            });
            updateTossPilePanel();
            showToast(`✓ Picked up ${result.restoredEntries.length} items`);
        }
    }

    function pickUpRecord(actionId, recordId) {
        const state = getState();
        const result = TossPile.pickUpRecord(state, actionId, recordId);
        if (result) {
            renderCurrentView();
            // Apply restoration highlights after DOM update
            requestAnimationFrame(() => {
                applyRestorationHighlights(state);
            });
            updateTossPilePanel();
            showToast(`✓ Record picked up (${result.restoredEntries.length} fields)`);
        }
    }

    function pickUpAll() {
        const state = getState();
        const actions = TossPile.getTossActionsForSet(state, state.currentSetId);
        let totalRestored = 0;

        actions.forEach(action => {
            const result = TossPile.pickUpAction(state, action.id);
            if (result) {
                totalRestored += result.restoredEntries.length;
            }
        });

        renderCurrentView();
        // Apply restoration highlights after DOM update
        requestAnimationFrame(() => {
            applyRestorationHighlights(state);
            if (totalRestored > 2) {
                renderRestorationBanner(totalRestored);
            }
        });
        updateTossPilePanel();

        if (totalRestored > 0) {
            showToast(`✓ Picked up ${totalRestored} items`);
        }
    }

    function pickUpAllColumns() {
        const state = getState();
        const ghostData = TossPile.getGhostData(state, state.currentSetId);
        const pile = TossPile.init(state);
        let totalRestored = 0;

        ghostData.columns.forEach((col, fieldId) => {
            const entries = Array.from(pile.entries.values())
                .filter(e => e.fieldId === fieldId && e.status === 'tossed');

            const result = TossPile.pickUpEntries(state, entries.map(e => e.id));
            totalRestored += result.restoredEntries.length;
        });

        closeTossedColumnsDialog();
        renderCurrentView();
        // Apply restoration highlights after DOM update
        requestAnimationFrame(() => {
            applyRestorationHighlights(state);
            if (totalRestored > 2) {
                renderRestorationBanner(totalRestored);
            }
        });
        updateTossPilePanel();

        if (totalRestored > 0) {
            showToast(`✓ Restored all columns (${totalRestored} values)`);
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
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    function getActionTypeIcon(type) {
        switch (type) {
            case 'toss_record': return '📄';
            case 'toss_records': return '📑';
            case 'toss_column': return '📊';
            case 'toss_cell': return '📝';
            case 'toss_set': return '📁';
            default: return '🗑';
        }
    }

    function formatCellValue(value, fieldType) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') return JSON.stringify(value);
        if (fieldType === 'CHECKBOX') return value ? '☑' : '☐';
        return String(value);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================================
    // EXPORT
    // ============================================================================

    const TossPileUI = {
        // Panel
        renderTossPilePanel,
        openPanel,
        closePanel,
        togglePanel,
        updateTossPilePanel,

        // Ghosts
        renderGhostRows,
        addGhostIndicatorsToCell,
        toggleGhosts,

        // Badges and banners
        addColumnTossBadge,
        renderTossedColumnsIndicator,
        renderSetTossBanner,
        dismissBanner,

        // Reappearance highlights
        applyRestorationHighlights,
        removeRestorationHighlights,
        renderRestorationBanner,

        // Dialogs
        showPickUpDialog,
        executePickUp,
        closePickUpDialog,
        showTossedColumns,
        closeTossedColumnsDialog,
        showColumnTossedValues,

        // Expansion
        toggleActionExpand,
        toggleRecordExpand,

        // Pick up
        pickUpEntry,
        pickUpAction,
        pickUpRecord,
        pickUpColumn,
        pickUpColumnValues,
        pickUpAll,
        pickUpAllColumns
    };

    global.TossPileUI = TossPileUI;

})(typeof window !== 'undefined' ? window : global);
