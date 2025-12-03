/**
 * EO Event Store Module
 *
 * Comprehensive event logging, filtering, and visualization for all changes
 * to data, schema, views, connections, definitions, and more.
 *
 * Event Categories:
 * - RECORD: Create, Update, Delete records
 * - SCHEMA: Add, Update, Delete fields
 * - SET: Create, Update, Delete sets
 * - VIEW: Create, Update, Delete views
 * - CONNECTION: Create, Update, Delete connections
 * - DEFINITION: Create, Update, Delete definitions
 * - WORLD: Create, Switch, Update worlds
 * - IMPORT: CSV/JSON imports
 * - EXPORT: JSON exports
 */

// ============================================================================
// EVENT STORE CONFIGURATION
// ============================================================================

const EVENT_CATEGORIES = {
    RECORD: { label: 'Records', icon: 'ph-rows', color: '#60a5fa' },
    SCHEMA: { label: 'Schema', icon: 'ph-columns', color: '#f59e0b' },
    SET: { label: 'Sets', icon: 'ph-squares-four', color: '#10b981' },
    VIEW: { label: 'Views', icon: 'ph-layout', color: '#8b5cf6' },
    CONNECTION: { label: 'Connections', icon: 'ph-git-branch', color: '#ec4899' },
    DEFINITION: { label: 'Definitions', icon: 'ph-book-open', color: '#06b6d4' },
    WORLD: { label: 'Worlds', icon: 'ph-globe', color: '#84cc16' },
    IMPORT: { label: 'Imports', icon: 'ph-download', color: '#f97316' },
    EXPORT: { label: 'Exports', icon: 'ph-upload', color: '#14b8a6' },
    SYSTEM: { label: 'System', icon: 'ph-gear', color: '#6b7280' }
};

const EVENT_OPERATIONS = {
    CREATE: { label: 'Created', icon: 'ph-plus-circle', color: '#10b981' },
    UPDATE: { label: 'Updated', icon: 'ph-pencil', color: '#f59e0b' },
    DELETE: { label: 'Deleted', icon: 'ph-trash', color: '#ef4444' },
    IMPORT: { label: 'Imported', icon: 'ph-download', color: '#3b82f6' },
    EXPORT: { label: 'Exported', icon: 'ph-upload', color: '#8b5cf6' }
};

// Map EO operators to categories
const OPERATOR_TO_CATEGORY = {
    'INS': 'CREATE',
    'SEG': 'UPDATE',
    'NUL': 'DELETE',
    'CON': 'UPDATE',
    'DES': 'CREATE',
    'ALT': 'UPDATE',
    'SYN': 'CREATE',
    'SUP': 'UPDATE',
    'REC': 'UPDATE',
    'ADD': 'CREATE'
};

// ============================================================================
// EVENT STORE MANAGER
// ============================================================================

class EventStoreManager {
    constructor(state) {
        this.state = state;
        this.filters = {
            categories: new Set(Object.keys(EVENT_CATEGORIES)),
            operations: new Set(Object.keys(EVENT_OPERATIONS)),
            dateFrom: null,
            dateTo: null,
            searchQuery: '',
            entityTypes: new Set(),
            entityId: null
        };
        this.pagination = {
            page: 1,
            pageSize: 50
        };
    }

    /**
     * Get all events with current filters applied
     */
    getFilteredEvents() {
        if (!this.state.eventStream) return [];

        return this.state.eventStream.filter(event => {
            // Category filter
            const category = this.getEventCategory(event);
            if (!this.filters.categories.has(category)) return false;

            // Operation filter
            const operation = OPERATOR_TO_CATEGORY[event.op] || 'UPDATE';
            if (!this.filters.operations.has(operation)) return false;

            // Date range filter
            const eventDate = new Date(event.published || event.t);
            if (this.filters.dateFrom && eventDate < this.filters.dateFrom) return false;
            if (this.filters.dateTo && eventDate > this.filters.dateTo) return false;

            // Entity type filter
            if (this.filters.entityTypes.size > 0) {
                const entityType = event.object?.type;
                if (!this.filters.entityTypes.has(entityType)) return false;
            }

            // Entity ID filter
            if (this.filters.entityId) {
                if (event.object?.id !== this.filters.entityId) return false;
            }

            // Search query filter
            if (this.filters.searchQuery) {
                const query = this.filters.searchQuery.toLowerCase();
                const searchableText = this.getSearchableText(event).toLowerCase();
                if (!searchableText.includes(query)) return false;
            }

            return true;
        });
    }

    /**
     * Get paginated events
     */
    getPaginatedEvents() {
        const filtered = this.getFilteredEvents();
        const start = (this.pagination.page - 1) * this.pagination.pageSize;
        const end = start + this.pagination.pageSize;

        return {
            events: filtered.slice(start, end),
            total: filtered.length,
            page: this.pagination.page,
            pageSize: this.pagination.pageSize,
            totalPages: Math.ceil(filtered.length / this.pagination.pageSize)
        };
    }

    /**
     * Determine event category based on object type and verb
     */
    getEventCategory(event) {
        const objectType = event.object?.type?.toUpperCase();
        const verb = (event.verb || '').toLowerCase();

        if (objectType === 'RECORD') return 'RECORD';
        if (objectType === 'FIELD' || verb.includes('field')) return 'SCHEMA';
        if (objectType === 'SET') return 'SET';
        if (objectType === 'VIEW') return 'VIEW';
        if (objectType === 'CONNECTION') return 'CONNECTION';
        if (objectType === 'DEFINITION') return 'DEFINITION';
        if (objectType === 'WORLD') return 'WORLD';
        if (verb.includes('import')) return 'IMPORT';
        if (verb.includes('export')) return 'EXPORT';

        return 'SYSTEM';
    }

    /**
     * Get searchable text from event
     */
    getSearchableText(event) {
        const parts = [
            event.verb,
            event.data?.summary,
            event.object?.type,
            event.object?.id,
            event.data?.fieldName,
            event.data?.name,
            event.data?.oldValue,
            event.data?.newValue,
            JSON.stringify(event.data)
        ].filter(Boolean);

        return parts.join(' ');
    }

    /**
     * Format event for human-readable display
     */
    formatEventForDisplay(event) {
        const category = this.getEventCategory(event);
        const operation = OPERATOR_TO_CATEGORY[event.op] || 'UPDATE';
        const timestamp = new Date(event.published || event.t);

        return {
            id: event.id,
            timestamp: timestamp,
            timeAgo: this.getTimeAgo(timestamp),
            formattedTime: timestamp.toLocaleString(),
            category: category,
            categoryMeta: EVENT_CATEGORIES[category],
            operation: operation,
            operationMeta: EVENT_OPERATIONS[operation],
            verb: event.verb,
            summary: event.data?.summary || this.generateSummary(event),
            entityType: event.object?.type,
            entityId: event.object?.id,
            actor: event.actor?.id || 'system',
            frame: event.frame,
            scale: event.scale,
            rawData: event.data,
            rawEvent: event
        };
    }

    /**
     * Generate a human-readable summary for events without one
     */
    generateSummary(event) {
        const verb = event.verb || 'Changed';
        const entityType = event.object?.type || 'entity';
        const entityId = event.object?.id || '';

        // Try to get a meaningful name from the data
        const name = event.data?.name || event.data?.fieldName || event.data?.term || '';

        if (name) {
            return `${verb}: ${name}`;
        }

        return `${verb} ${entityType.toLowerCase()} ${entityId.slice(0, 8)}...`;
    }

    /**
     * Get time ago string
     */
    getTimeAgo(timestamp) {
        const seconds = Math.floor((new Date() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return timestamp.toLocaleDateString();
    }

    /**
     * Export events as JSON
     */
    exportEventsAsJson(filtered = true) {
        const events = filtered ? this.getFilteredEvents() : this.state.eventStream;
        return JSON.stringify(events, null, 2);
    }

    /**
     * Get event statistics
     */
    getEventStats() {
        const events = this.state.eventStream || [];
        const stats = {
            total: events.length,
            byCategory: {},
            byOperation: {},
            byEntityType: {},
            byHour: {},
            byDay: {}
        };

        events.forEach(event => {
            const category = this.getEventCategory(event);
            const operation = OPERATOR_TO_CATEGORY[event.op] || 'UPDATE';
            const entityType = event.object?.type || 'Unknown';
            const timestamp = new Date(event.published || event.t);
            const hour = timestamp.getHours();
            const day = timestamp.toDateString();

            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
            stats.byOperation[operation] = (stats.byOperation[operation] || 0) + 1;
            stats.byEntityType[entityType] = (stats.byEntityType[entityType] || 0) + 1;
            stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
            stats.byDay[day] = (stats.byDay[day] || 0) + 1;
        });

        return stats;
    }

    /**
     * Get entity history - all events for a specific entity
     */
    getEntityHistory(entityType, entityId) {
        return (this.state.eventStream || []).filter(event =>
            event.object?.type === entityType && event.object?.id === entityId
        ).map(event => this.formatEventForDisplay(event));
    }

    /**
     * Reset all filters
     */
    resetFilters() {
        this.filters = {
            categories: new Set(Object.keys(EVENT_CATEGORIES)),
            operations: new Set(Object.keys(EVENT_OPERATIONS)),
            dateFrom: null,
            dateTo: null,
            searchQuery: '',
            entityTypes: new Set(),
            entityId: null
        };
        this.pagination.page = 1;
    }
}

// ============================================================================
// EVENT STORE UI RENDERING
// ============================================================================

/**
 * Render the Event Store view
 */
function renderEventStoreView(state, container) {
    if (!state.eventStoreManager) {
        state.eventStoreManager = new EventStoreManager(state);
    }

    const manager = state.eventStoreManager;
    const { events, total, page, pageSize, totalPages } = manager.getPaginatedEvents();
    const stats = manager.getEventStats();

    container.innerHTML = `
        <div class="event-store-container" style="padding: 1.5rem; height: 100%; overflow: auto; background: #0f172a;">
            <!-- Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 600; color: white; margin: 0;">Event Store</h2>
                    <p style="color: #94a3b8; margin: 0.25rem 0 0 0; font-size: 0.875rem;">
                        ${total.toLocaleString()} events ${total !== stats.total ? `of ${stats.total.toLocaleString()} total` : ''}
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="toggleEventStoreJsonView()" class="btn-secondary" style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="ph ph-code"></i>
                        View JSON
                    </button>
                    <button onclick="exportEventStoreJson()" class="btn-secondary" style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="ph ph-download"></i>
                        Export
                    </button>
                </div>
            </div>

            <!-- Stats Summary -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                ${Object.entries(EVENT_CATEGORIES).map(([key, meta]) => `
                    <div style="background: #1e293b; border-radius: 8px; padding: 1rem; border: 1px solid #334155;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <i class="ph ${meta.icon}" style="color: ${meta.color};"></i>
                            <span style="color: #94a3b8; font-size: 0.75rem;">${meta.label}</span>
                        </div>
                        <div style="font-size: 1.5rem; font-weight: 600; color: white;">${(stats.byCategory[key] || 0).toLocaleString()}</div>
                    </div>
                `).join('')}
            </div>

            <!-- Filters -->
            <div style="background: #1e293b; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border: 1px solid #334155;">
                <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
                    <!-- Search -->
                    <div style="flex: 1; min-width: 200px;">
                        <div style="position: relative;">
                            <input type="text"
                                id="eventStoreSearch"
                                placeholder="Search events..."
                                value="${manager.filters.searchQuery}"
                                oninput="filterEventStore('search', this.value)"
                                style="width: 100%; padding: 0.5rem 0.75rem 0.5rem 2rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; font-size: 0.875rem;">
                            <i class="ph ph-magnifying-glass" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #64748b;"></i>
                        </div>
                    </div>

                    <!-- Category Filter -->
                    <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                        ${Object.entries(EVENT_CATEGORIES).map(([key, meta]) => {
                            const isActive = manager.filters.categories.has(key);
                            return `
                                <button
                                    onclick="filterEventStore('category', '${key}')"
                                    style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid ${isActive ? meta.color : '#334155'};
                                           background: ${isActive ? meta.color + '20' : 'transparent'}; color: ${isActive ? meta.color : '#64748b'};
                                           font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
                                    <i class="ph ${meta.icon}"></i>
                                    ${meta.label}
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- Date Range -->
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <input type="date"
                            id="eventDateFrom"
                            onchange="filterEventStore('dateFrom', this.value)"
                            style="padding: 0.25rem 0.5rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: white; font-size: 0.75rem;">
                        <span style="color: #64748b;">to</span>
                        <input type="date"
                            id="eventDateTo"
                            onchange="filterEventStore('dateTo', this.value)"
                            style="padding: 0.25rem 0.5rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: white; font-size: 0.75rem;">
                    </div>

                    <!-- Reset -->
                    <button onclick="resetEventStoreFilters()" style="padding: 0.25rem 0.5rem; background: transparent; border: 1px solid #334155; border-radius: 4px; color: #94a3b8; font-size: 0.75rem; cursor: pointer;">
                        Reset Filters
                    </button>
                </div>
            </div>

            <!-- Events Table -->
            <div style="background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #0f172a;">
                            <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 500; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid #334155;">Time</th>
                            <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 500; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid #334155;">Category</th>
                            <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 500; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid #334155;">Action</th>
                            <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 500; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid #334155;">Summary</th>
                            <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 500; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid #334155;">Entity</th>
                            <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 500; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid #334155;">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${events.length === 0 ? `
                            <tr>
                                <td colspan="6" style="padding: 3rem; text-align: center; color: #64748b;">
                                    <i class="ph ph-empty" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                                    No events found matching your filters
                                </td>
                            </tr>
                        ` : events.map(event => {
                            const formatted = manager.formatEventForDisplay(event);
                            return `
                                <tr style="border-bottom: 1px solid #1e293b;"
                                    class="event-row"
                                    onclick="showEventDetail('${event.id}')"
                                    onmouseover="this.style.background='#0f172a'"
                                    onmouseout="this.style.background='transparent'">
                                    <td style="padding: 0.75rem 1rem; color: #94a3b8; font-size: 0.875rem; white-space: nowrap;">
                                        <div style="display: flex; flex-direction: column;">
                                            <span style="color: white;">${formatted.timeAgo}</span>
                                            <span style="font-size: 0.75rem; color: #64748b;">${formatted.formattedTime}</span>
                                        </div>
                                    </td>
                                    <td style="padding: 0.75rem 1rem;">
                                        <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem;
                                                     background: ${formatted.categoryMeta.color}15; color: ${formatted.categoryMeta.color};
                                                     border-radius: 4px; font-size: 0.75rem;">
                                            <i class="ph ${formatted.categoryMeta.icon}"></i>
                                            ${formatted.categoryMeta.label}
                                        </span>
                                    </td>
                                    <td style="padding: 0.75rem 1rem;">
                                        <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem;
                                                     background: ${formatted.operationMeta.color}15; color: ${formatted.operationMeta.color};
                                                     border-radius: 4px; font-size: 0.75rem;">
                                            <i class="ph ${formatted.operationMeta.icon}"></i>
                                            ${formatted.operationMeta.label}
                                        </span>
                                    </td>
                                    <td style="padding: 0.75rem 1rem; color: white; font-size: 0.875rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${escapeHtml(formatted.summary)}
                                    </td>
                                    <td style="padding: 0.75rem 1rem; color: #94a3b8; font-size: 0.75rem;">
                                        <code style="background: #0f172a; padding: 0.125rem 0.375rem; border-radius: 3px; font-family: monospace;">
                                            ${formatted.entityType}:${(formatted.entityId || '').slice(0, 12)}...
                                        </code>
                                    </td>
                                    <td style="padding: 0.75rem 1rem;">
                                        <button onclick="event.stopPropagation(); showEventDetail('${event.id}')"
                                                style="padding: 0.25rem 0.5rem; background: #334155; border: none; border-radius: 4px; color: white; font-size: 0.75rem; cursor: pointer;">
                                            <i class="ph ph-eye"></i>
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            ${totalPages > 1 ? `
                <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 1rem;">
                    <button
                        onclick="paginateEventStore(${page - 1})"
                        ${page === 1 ? 'disabled' : ''}
                        style="padding: 0.5rem 0.75rem; background: #1e293b; border: 1px solid #334155; border-radius: 4px; color: ${page === 1 ? '#64748b' : 'white'}; cursor: ${page === 1 ? 'not-allowed' : 'pointer'};">
                        <i class="ph ph-caret-left"></i>
                    </button>
                    <span style="color: #94a3b8; font-size: 0.875rem;">
                        Page ${page} of ${totalPages}
                    </span>
                    <button
                        onclick="paginateEventStore(${page + 1})"
                        ${page === totalPages ? 'disabled' : ''}
                        style="padding: 0.5rem 0.75rem; background: #1e293b; border: 1px solid #334155; border-radius: 4px; color: ${page === totalPages ? '#64748b' : 'white'}; cursor: ${page === totalPages ? 'not-allowed' : 'pointer'};">
                        <i class="ph ph-caret-right"></i>
                    </button>
                </div>
            ` : ''}
        </div>

        <!-- JSON Modal (hidden by default) -->
        <div id="eventStoreJsonModal" class="hidden" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; display: flex; align-items: center; justify-content: center;">
            <div style="background: #1e293b; border-radius: 12px; width: 90%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; border: 1px solid #334155;">
                <div style="padding: 1rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: white; font-size: 1.125rem;">Event Store JSON</h3>
                    <button onclick="toggleEventStoreJsonView()" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 0.5rem;">
                        <i class="ph ph-x" style="font-size: 1.25rem;"></i>
                    </button>
                </div>
                <div style="flex: 1; overflow: auto; padding: 1rem;">
                    <pre id="eventStoreJsonContent" style="margin: 0; color: #e2e8f0; font-size: 0.75rem; font-family: 'Monaco', 'Menlo', monospace; white-space: pre-wrap; word-break: break-all;"></pre>
                </div>
                <div style="padding: 1rem; border-top: 1px solid #334155; display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button onclick="copyEventStoreJson()" class="btn-secondary">
                        <i class="ph ph-copy"></i> Copy
                    </button>
                    <button onclick="exportEventStoreJson()" class="btn-primary">
                        <i class="ph ph-download"></i> Download
                    </button>
                </div>
            </div>
        </div>

        <!-- Event Detail Modal (hidden by default) -->
        <div id="eventDetailModal" class="hidden" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; display: flex; align-items: center; justify-content: center;">
            <div style="background: #1e293b; border-radius: 12px; width: 90%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; border: 1px solid #334155;">
                <div style="padding: 1rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: white; font-size: 1.125rem;">Event Details</h3>
                    <button onclick="closeEventDetailModal()" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 0.5rem;">
                        <i class="ph ph-x" style="font-size: 1.25rem;"></i>
                    </button>
                </div>
                <div id="eventDetailContent" style="flex: 1; overflow: auto; padding: 1rem;"></div>
            </div>
        </div>
    `;
}

/**
 * Render entity history timeline
 */
function renderEntityHistoryTimeline(state, entityType, entityId, container) {
    if (!state.eventStoreManager) {
        state.eventStoreManager = new EventStoreManager(state);
    }

    const history = state.eventStoreManager.getEntityHistory(entityType, entityId);

    if (history.length === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #64748b;">
                <i class="ph ph-clock-counter-clockwise" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                No history found for this entity
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="padding: 1rem;">
            <h4 style="margin: 0 0 1rem 0; color: white; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="ph ph-clock-counter-clockwise"></i>
                History (${history.length} events)
            </h4>
            <div style="border-left: 2px solid #334155; padding-left: 1rem; margin-left: 0.5rem;">
                ${history.map((event, index) => `
                    <div style="position: relative; padding-bottom: 1rem; ${index === history.length - 1 ? '' : 'margin-bottom: 0.5rem;'}">
                        <div style="position: absolute; left: -1.375rem; top: 0; width: 10px; height: 10px; background: ${event.operationMeta.color}; border-radius: 50%; border: 2px solid #1e293b;"></div>
                        <div style="background: #0f172a; border-radius: 6px; padding: 0.75rem; border: 1px solid #334155;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                <span style="color: white; font-weight: 500; font-size: 0.875rem;">${escapeHtml(event.summary)}</span>
                                <span style="color: #64748b; font-size: 0.75rem;">${event.timeAgo}</span>
                            </div>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.375rem;
                                             background: ${event.operationMeta.color}15; color: ${event.operationMeta.color};
                                             border-radius: 3px; font-size: 0.7rem;">
                                    <i class="ph ${event.operationMeta.icon}"></i>
                                    ${event.operationMeta.label}
                                </span>
                                <span style="color: #64748b; font-size: 0.7rem;">by ${event.actor}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ============================================================================
// EVENT STORE UI HELPERS
// ============================================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function filterEventStore(filterType, value) {
    if (!window.state?.eventStoreManager) return;

    const manager = window.state.eventStoreManager;

    switch (filterType) {
        case 'search':
            manager.filters.searchQuery = value;
            break;
        case 'category':
            if (manager.filters.categories.has(value)) {
                manager.filters.categories.delete(value);
            } else {
                manager.filters.categories.add(value);
            }
            break;
        case 'dateFrom':
            manager.filters.dateFrom = value ? new Date(value) : null;
            break;
        case 'dateTo':
            manager.filters.dateTo = value ? new Date(value + 'T23:59:59') : null;
            break;
    }

    manager.pagination.page = 1;
    renderEventStoreViewInPlace();
}

function resetEventStoreFilters() {
    if (!window.state?.eventStoreManager) return;
    window.state.eventStoreManager.resetFilters();
    renderEventStoreViewInPlace();
}

function paginateEventStore(page) {
    if (!window.state?.eventStoreManager) return;
    const manager = window.state.eventStoreManager;
    const { totalPages } = manager.getPaginatedEvents();

    if (page < 1 || page > totalPages) return;

    manager.pagination.page = page;
    renderEventStoreViewInPlace();
}

function renderEventStoreViewInPlace() {
    const container = document.getElementById('mainContent');
    if (container && window.state?.currentSpecialView === 'eventStore') {
        renderEventStoreView(window.state, container);
    }
}

function toggleEventStoreJsonView() {
    const modal = document.getElementById('eventStoreJsonModal');
    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        const content = document.getElementById('eventStoreJsonContent');
        if (content && window.state?.eventStoreManager) {
            const json = window.state.eventStoreManager.exportEventsAsJson(true);
            content.textContent = json;
        }
    } else {
        modal.classList.add('hidden');
    }
}

function copyEventStoreJson() {
    if (!window.state?.eventStoreManager) return;
    const json = window.state.eventStoreManager.exportEventsAsJson(true);
    navigator.clipboard.writeText(json).then(() => {
        showToast && showToast('Copied to clipboard');
    });
}

function exportEventStoreJson() {
    if (!window.state?.eventStoreManager) return;
    const json = window.state.eventStoreManager.exportEventsAsJson(false);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-store-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast && showToast('Event store exported');
}

function showEventDetail(eventId) {
    if (!window.state?.eventStream) return;

    const event = window.state.eventStream.find(e => e.id === eventId);
    if (!event) return;

    const modal = document.getElementById('eventDetailModal');
    const content = document.getElementById('eventDetailContent');
    if (!modal || !content) return;

    const manager = window.state.eventStoreManager || new EventStoreManager(window.state);
    const formatted = manager.formatEventForDisplay(event);

    content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <!-- Header -->
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem;
                             background: ${formatted.categoryMeta.color}15; color: ${formatted.categoryMeta.color};
                             border-radius: 4px; font-size: 0.875rem;">
                    <i class="ph ${formatted.categoryMeta.icon}"></i>
                    ${formatted.categoryMeta.label}
                </span>
                <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem;
                             background: ${formatted.operationMeta.color}15; color: ${formatted.operationMeta.color};
                             border-radius: 4px; font-size: 0.875rem;">
                    <i class="ph ${formatted.operationMeta.icon}"></i>
                    ${formatted.operationMeta.label}
                </span>
            </div>

            <!-- Summary -->
            <div>
                <label style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.25rem;">Summary</label>
                <div style="color: white; font-size: 1rem;">${escapeHtml(formatted.summary)}</div>
            </div>

            <!-- Metadata Grid -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                <div>
                    <label style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.25rem;">Timestamp</label>
                    <div style="color: white; font-size: 0.875rem;">${formatted.formattedTime}</div>
                </div>
                <div>
                    <label style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.25rem;">Actor</label>
                    <div style="color: white; font-size: 0.875rem;">${formatted.actor}</div>
                </div>
                <div>
                    <label style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.25rem;">Entity Type</label>
                    <div style="color: white; font-size: 0.875rem;">${formatted.entityType || 'N/A'}</div>
                </div>
                <div>
                    <label style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.25rem;">Entity ID</label>
                    <code style="color: #60a5fa; font-size: 0.75rem; background: #0f172a; padding: 0.25rem 0.5rem; border-radius: 4px; display: inline-block;">${formatted.entityId || 'N/A'}</code>
                </div>
                <div>
                    <label style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.25rem;">Frame</label>
                    <div style="color: white; font-size: 0.875rem;">${formatted.frame || 'N/A'}</div>
                </div>
                <div>
                    <label style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.25rem;">Scale</label>
                    <div style="color: white; font-size: 0.875rem;">${formatted.scale || 'N/A'}</div>
                </div>
            </div>

            <!-- Raw Data -->
            <div>
                <label style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Event Data</label>
                <pre style="background: #0f172a; padding: 1rem; border-radius: 6px; border: 1px solid #334155; overflow: auto; max-height: 300px; margin: 0; color: #e2e8f0; font-size: 0.75rem; font-family: 'Monaco', 'Menlo', monospace;">${JSON.stringify(formatted.rawData, null, 2)}</pre>
            </div>

            <!-- Full Event JSON -->
            <details style="margin-top: 0.5rem;">
                <summary style="color: #64748b; font-size: 0.75rem; cursor: pointer; padding: 0.5rem 0;">View Full Event JSON</summary>
                <pre style="background: #0f172a; padding: 1rem; border-radius: 6px; border: 1px solid #334155; overflow: auto; max-height: 200px; margin: 0.5rem 0 0 0; color: #e2e8f0; font-size: 0.7rem; font-family: 'Monaco', 'Menlo', monospace;">${JSON.stringify(formatted.rawEvent, null, 2)}</pre>
            </details>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeEventDetailModal() {
    const modal = document.getElementById('eventDetailModal');
    if (modal) modal.classList.add('hidden');
}

// ============================================================================
// ENHANCED EVENT CREATION HELPERS
// ============================================================================

/**
 * Create event with enhanced metadata for comprehensive logging
 */
function createEnhancedEvent(state, verb, op, object, data = {}, options = {}) {
    // Determine category automatically
    const category = options.category || inferEventCategory(object, verb);

    // Enrich data with additional context
    const enrichedData = {
        ...data,
        _category: category,
        _timestamp: Date.now(),
        _userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    };

    // Call the original createEvent if available
    if (typeof createEvent === 'function') {
        return createEvent(verb, op, object, enrichedData, options);
    }

    // Fallback event creation
    const event = {
        id: `event-${state.eventIdCounter++}`,
        verb,
        op,
        frame: options.frame || 'ui',
        scale: options.scale || 'object',
        published: new Date().toISOString(),
        actor: { type: state.currentUser?.type || 'user', id: state.currentUser?.id || 'anonymous' },
        object,
        data: enrichedData
    };

    if (!state.eventStream) state.eventStream = [];
    state.eventStream.unshift(event);

    return event;
}

function inferEventCategory(object, verb) {
    const type = object?.type?.toUpperCase();
    const verbLower = (verb || '').toLowerCase();

    if (type === 'RECORD') return 'RECORD';
    if (type === 'FIELD' || verbLower.includes('field')) return 'SCHEMA';
    if (type === 'SET') return 'SET';
    if (type === 'VIEW') return 'VIEW';
    if (type === 'CONNECTION') return 'CONNECTION';
    if (type === 'DEFINITION') return 'DEFINITION';
    if (type === 'WORLD') return 'WORLD';
    if (verbLower.includes('import')) return 'IMPORT';
    if (verbLower.includes('export')) return 'EXPORT';

    return 'SYSTEM';
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EventStoreManager,
        EVENT_CATEGORIES,
        EVENT_OPERATIONS,
        OPERATOR_TO_CATEGORY,
        renderEventStoreView,
        renderEntityHistoryTimeline,
        createEnhancedEvent,
        filterEventStore,
        resetEventStoreFilters,
        paginateEventStore,
        toggleEventStoreJsonView,
        copyEventStoreJson,
        exportEventStoreJson,
        showEventDetail,
        closeEventDetailModal
    };
}
