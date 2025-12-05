/**
 * EO Browser Tabs - Chrome-style Tab System
 *
 * Features:
 * - Browser-style horizontal tabs with drag-to-reorder
 * - Pop-out/detach tabs into floating windows
 * - Omnibox-style search bar for data search
 * - Side-by-side tab layout
 */

class EOBrowserTabs {
    constructor(options = {}) {
        this.state = options.state;
        this.setId = options.setId;
        this.onTabChange = options.onTabChange || (() => {});
        this.onTabReorder = options.onTabReorder || (() => {});
        this.onSearch = options.onSearch || (() => {});

        this.draggedTab = null;
        this.dragPlaceholder = null;
        this.floatingWindows = new Map();
        this.searchDebounceTimer = null;
        this.searchResults = [];

        // Tab width constraints (Chrome-like behavior)
        this.minTabWidth = 50;
        this.maxTabWidth = 240;
        this.tabHeight = 36;
    }

    /**
     * Render the complete browser-style header
     */
    render(state, setId) {
        this.state = state;
        this.setId = setId;

        const set = state.sets.get(setId);
        if (!set) return '';

        const views = this.getSetViews(state, setId);
        const currentViewId = state.currentViewId;

        return `
            <div class="browser-header">
                <div class="browser-tab-bar" id="browserTabBar">
                    <div class="browser-tabs-container" id="browserTabsContainer">
                        ${views.map(view => this.renderTab(view, view.id === currentViewId)).join('')}
                        <button class="browser-new-tab-btn" id="browserNewTabBtn" title="New tab (Ctrl+T)">
                            <i class="ph ph-plus"></i>
                        </button>
                    </div>
                    <div class="browser-tab-actions">
                        <button class="browser-window-btn" title="Window controls">
                            <i class="ph ph-dots-three"></i>
                        </button>
                    </div>
                </div>
                <div class="browser-omnibox-bar">
                    <div class="browser-nav-buttons">
                        <button class="browser-nav-btn" id="navBack" title="Go back" disabled>
                            <i class="ph ph-arrow-left"></i>
                        </button>
                        <button class="browser-nav-btn" id="navForward" title="Go forward" disabled>
                            <i class="ph ph-arrow-right"></i>
                        </button>
                        <button class="browser-nav-btn" id="navRefresh" title="Refresh">
                            <i class="ph ph-arrow-clockwise"></i>
                        </button>
                    </div>
                    <div class="browser-omnibox" id="browserOmnibox">
                        <div class="omnibox-icon">
                            <i class="ph ph-magnifying-glass"></i>
                        </div>
                        <input
                            type="text"
                            class="omnibox-input"
                            id="omniboxInput"
                            placeholder="Search records, fields, views, or type a command..."
                            autocomplete="off"
                            spellcheck="false"
                        >
                        <div class="omnibox-actions">
                            <span class="omnibox-shortcut">Ctrl+K</span>
                        </div>
                        <div class="omnibox-dropdown" id="omniboxDropdown"></div>
                    </div>
                    <div class="browser-toolbar-actions">
                        <button class="browser-toolbar-btn" id="btnBookmark" title="Bookmark this view">
                            <i class="ph ph-star"></i>
                        </button>
                        <button class="browser-toolbar-btn" id="btnShare" title="Share">
                            <i class="ph ph-share-network"></i>
                        </button>
                        <button class="browser-toolbar-btn" id="btnMenu" title="More options">
                            <i class="ph ph-dots-three-vertical"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render a single tab
     */
    renderTab(view, isActive) {
        const isDirty = view.isDirty ? ' dirty' : '';
        const icon = view.icon || this.getViewTypeIcon(view.type);

        return `
            <div class="browser-tab ${isActive ? 'active' : ''}${isDirty}"
                 data-view-id="${view.id}"
                 draggable="true">
                <div class="browser-tab-favicon">${icon}</div>
                <span class="browser-tab-title">${this.escapeHtml(view.name)}${view.isDirty ? ' *' : ''}</span>
                <button class="browser-tab-close" data-view-id="${view.id}" title="Close tab">
                    <i class="ph ph-x"></i>
                </button>
                <div class="browser-tab-drag-handle"></div>
            </div>
        `;
    }

    /**
     * Get icon based on view type
     */
    getViewTypeIcon(type) {
        const icons = {
            grid: '<i class="ph ph-table"></i>',
            gallery: '<i class="ph ph-squares-four"></i>',
            kanban: '<i class="ph ph-kanban"></i>',
            calendar: '<i class="ph ph-calendar"></i>',
            chart: '<i class="ph ph-chart-bar"></i>',
            default: '<i class="ph ph-browser"></i>'
        };
        return icons[type] || icons.default;
    }

    /**
     * Attach event listeners
     */
    attachListeners() {
        this.attachTabListeners();
        this.attachDragListeners();
        this.attachOmniboxListeners();
        this.attachKeyboardShortcuts();
    }

    /**
     * Tab click and close listeners
     */
    attachTabListeners() {
        const container = document.getElementById('browserTabsContainer');
        if (!container) return;

        // Tab click to switch
        container.addEventListener('click', (e) => {
            const tab = e.target.closest('.browser-tab');
            const closeBtn = e.target.closest('.browser-tab-close');

            if (closeBtn) {
                e.stopPropagation();
                const viewId = closeBtn.dataset.viewId;
                this.closeTab(viewId);
                return;
            }

            if (tab && !e.target.closest('.browser-tab-close')) {
                const viewId = tab.dataset.viewId;
                this.switchToTab(viewId);
            }
        });

        // Double-click to rename
        container.addEventListener('dblclick', (e) => {
            const tab = e.target.closest('.browser-tab');
            if (tab) {
                this.startRenameTab(tab);
            }
        });

        // Middle-click to close
        container.addEventListener('auxclick', (e) => {
            if (e.button === 1) {
                const tab = e.target.closest('.browser-tab');
                if (tab) {
                    e.preventDefault();
                    this.closeTab(tab.dataset.viewId);
                }
            }
        });

        // Context menu
        container.addEventListener('contextmenu', (e) => {
            const tab = e.target.closest('.browser-tab');
            if (tab) {
                e.preventDefault();
                this.showTabContextMenu(e, tab);
            }
        });

        // New tab button
        const newTabBtn = document.getElementById('browserNewTabBtn');
        if (newTabBtn) {
            newTabBtn.addEventListener('click', () => this.createNewTab());
        }

        // Refresh button
        const refreshBtn = document.getElementById('navRefresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshCurrentView());
        }
    }

    /**
     * Drag and drop for tab reordering
     */
    attachDragListeners() {
        const container = document.getElementById('browserTabsContainer');
        if (!container) return;

        container.addEventListener('dragstart', (e) => {
            const tab = e.target.closest('.browser-tab');
            if (!tab) return;

            this.draggedTab = tab;
            tab.classList.add('dragging');

            // Set drag image
            const rect = tab.getBoundingClientRect();
            e.dataTransfer.setDragImage(tab, rect.width / 2, rect.height / 2);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', tab.dataset.viewId);

            // Create placeholder
            this.dragPlaceholder = document.createElement('div');
            this.dragPlaceholder.className = 'browser-tab-placeholder';
            this.dragPlaceholder.style.width = `${rect.width}px`;
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const tab = e.target.closest('.browser-tab');
            if (tab && tab !== this.draggedTab) {
                const rect = tab.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;

                if (e.clientX < midpoint) {
                    tab.parentNode.insertBefore(this.dragPlaceholder, tab);
                } else {
                    tab.parentNode.insertBefore(this.dragPlaceholder, tab.nextSibling);
                }
            }
        });

        container.addEventListener('dragend', (e) => {
            if (this.draggedTab) {
                this.draggedTab.classList.remove('dragging');

                // Check if dropped outside - create floating window
                const container = document.getElementById('browserTabsContainer');
                const rect = container.getBoundingClientRect();

                if (e.clientY > rect.bottom + 50 || e.clientY < rect.top - 50 ||
                    e.clientX < rect.left - 50 || e.clientX > rect.right + 50) {
                    this.popOutTab(this.draggedTab.dataset.viewId, e.clientX, e.clientY);
                } else if (this.dragPlaceholder && this.dragPlaceholder.parentNode) {
                    // Reorder tabs
                    this.dragPlaceholder.parentNode.insertBefore(this.draggedTab, this.dragPlaceholder);
                    this.saveTabOrder();
                }

                if (this.dragPlaceholder) {
                    this.dragPlaceholder.remove();
                }
                this.draggedTab = null;
                this.dragPlaceholder = null;
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
        });
    }

    /**
     * Omnibox search functionality
     */
    attachOmniboxListeners() {
        const input = document.getElementById('omniboxInput');
        const dropdown = document.getElementById('omniboxDropdown');
        const omnibox = document.getElementById('browserOmnibox');

        if (!input || !dropdown) return;

        // Focus state
        input.addEventListener('focus', () => {
            omnibox.classList.add('focused');
            this.showSearchDropdown('');
        });

        input.addEventListener('blur', (e) => {
            // Delay to allow click on dropdown items
            setTimeout(() => {
                omnibox.classList.remove('focused');
                dropdown.classList.remove('visible');
            }, 200);
        });

        // Input handling with debounce
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = setTimeout(() => {
                this.showSearchDropdown(query);
            }, 150);
        });

        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.omnibox-result-item');
            const activeItem = dropdown.querySelector('.omnibox-result-item.active');
            let activeIndex = Array.from(items).indexOf(activeItem);

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    activeIndex = Math.min(activeIndex + 1, items.length - 1);
                    this.setActiveSearchItem(items, activeIndex);
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    activeIndex = Math.max(activeIndex - 1, 0);
                    this.setActiveSearchItem(items, activeIndex);
                    break;

                case 'Enter':
                    e.preventDefault();
                    if (activeItem) {
                        this.handleSearchResultClick(activeItem);
                    } else if (items.length > 0) {
                        this.handleSearchResultClick(items[0]);
                    }
                    break;

                case 'Escape':
                    input.blur();
                    dropdown.classList.remove('visible');
                    break;
            }
        });
    }

    /**
     * Global keyboard shortcuts
     */
    attachKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K - Focus omnibox
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const input = document.getElementById('omniboxInput');
                if (input) {
                    input.focus();
                    input.select();
                }
            }

            // Ctrl+T - New tab
            if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                this.createNewTab();
            }

            // Ctrl+W - Close current tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
                e.preventDefault();
                if (this.state.currentViewId) {
                    this.closeTab(this.state.currentViewId);
                }
            }

            // Ctrl+Tab - Next tab
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                this.cycleTab(e.shiftKey ? -1 : 1);
            }

            // Ctrl+1-9 - Switch to tab by number
            if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                this.switchToTabByIndex(index);
            }
        });
    }

    /**
     * Show search dropdown with results
     */
    showSearchDropdown(query) {
        const dropdown = document.getElementById('omniboxDropdown');
        if (!dropdown || !this.state) return;

        let html = '';

        if (!query) {
            // Zero-input state - show suggestions
            html = this.renderZeroInputSuggestions();
        } else {
            // Search results
            html = this.renderSearchResults(query);
        }

        dropdown.innerHTML = html;
        dropdown.classList.add('visible');

        // Attach click handlers to results
        dropdown.querySelectorAll('.omnibox-result-item').forEach(item => {
            item.addEventListener('click', () => this.handleSearchResultClick(item));
        });
    }

    /**
     * Render zero-input suggestions
     */
    renderZeroInputSuggestions() {
        const recentViews = this.getRecentViews();
        const set = this.state.sets.get(this.setId);

        let html = '<div class="omnibox-results">';

        // Quick actions
        html += `
            <div class="omnibox-section">
                <div class="omnibox-section-title">Quick Actions</div>
                <div class="omnibox-result-item action" data-action="new-view">
                    <div class="omnibox-result-icon"><i class="ph ph-plus-circle"></i></div>
                    <div class="omnibox-result-content">
                        <div class="omnibox-result-title">Create new view</div>
                        <div class="omnibox-result-subtitle">Add a new tab for this set</div>
                    </div>
                    <div class="omnibox-result-shortcut">Ctrl+T</div>
                </div>
                <div class="omnibox-result-item action" data-action="search-records">
                    <div class="omnibox-result-icon"><i class="ph ph-rows"></i></div>
                    <div class="omnibox-result-content">
                        <div class="omnibox-result-title">Search records</div>
                        <div class="omnibox-result-subtitle">${set?.records?.size || 0} records in this set</div>
                    </div>
                </div>
                <div class="omnibox-result-item action" data-action="search-fields">
                    <div class="omnibox-result-icon"><i class="ph ph-columns"></i></div>
                    <div class="omnibox-result-content">
                        <div class="omnibox-result-title">Browse fields</div>
                        <div class="omnibox-result-subtitle">${set?.schema?.length || 0} fields available</div>
                    </div>
                </div>
            </div>
        `;

        // Recent views
        if (recentViews.length > 0) {
            html += `
                <div class="omnibox-section">
                    <div class="omnibox-section-title">Recent Views</div>
                    ${recentViews.map(view => `
                        <div class="omnibox-result-item view" data-type="view" data-id="${view.id}">
                            <div class="omnibox-result-icon">${this.getViewTypeIcon(view.type)}</div>
                            <div class="omnibox-result-content">
                                <div class="omnibox-result-title">${this.escapeHtml(view.name)}</div>
                                <div class="omnibox-result-subtitle">${view.type} view</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // All sets (like browsing history)
        const allSets = Array.from(this.state.sets.values()).slice(0, 5);
        if (allSets.length > 0) {
            html += `
                <div class="omnibox-section">
                    <div class="omnibox-section-title">All Sets</div>
                    ${allSets.map(set => `
                        <div class="omnibox-result-item set" data-type="set" data-id="${set.id}">
                            <div class="omnibox-result-icon"><i class="ph ph-folder"></i></div>
                            <div class="omnibox-result-content">
                                <div class="omnibox-result-title">${this.escapeHtml(set.name)}</div>
                                <div class="omnibox-result-subtitle">${set.records?.size || 0} records</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    /**
     * Render search results
     */
    renderSearchResults(query) {
        const results = this.searchData(query);
        let html = '<div class="omnibox-results">';

        if (results.records.length === 0 && results.fields.length === 0 &&
            results.views.length === 0 && results.sets.length === 0) {
            html += `
                <div class="omnibox-no-results">
                    <i class="ph ph-magnifying-glass"></i>
                    <p>No results found for "${this.escapeHtml(query)}"</p>
                </div>
            `;
        } else {
            // Records
            if (results.records.length > 0) {
                html += `
                    <div class="omnibox-section">
                        <div class="omnibox-section-title">Records (${results.records.length})</div>
                        ${results.records.slice(0, 5).map(rec => `
                            <div class="omnibox-result-item record" data-type="record" data-id="${rec.id}" data-set-id="${rec.setId}">
                                <div class="omnibox-result-icon"><i class="ph ph-file-text"></i></div>
                                <div class="omnibox-result-content">
                                    <div class="omnibox-result-title">${this.escapeHtml(rec.displayValue)}</div>
                                    <div class="omnibox-result-subtitle">${this.escapeHtml(rec.matchField)}: ${this.escapeHtml(rec.matchValue)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // Fields
            if (results.fields.length > 0) {
                html += `
                    <div class="omnibox-section">
                        <div class="omnibox-section-title">Fields (${results.fields.length})</div>
                        ${results.fields.slice(0, 5).map(field => `
                            <div class="omnibox-result-item field" data-type="field" data-id="${field.id}" data-set-id="${field.setId}">
                                <div class="omnibox-result-icon"><i class="ph ph-text-columns"></i></div>
                                <div class="omnibox-result-content">
                                    <div class="omnibox-result-title">${this.escapeHtml(field.name)}</div>
                                    <div class="omnibox-result-subtitle">Field in ${this.escapeHtml(field.setName)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // Views
            if (results.views.length > 0) {
                html += `
                    <div class="omnibox-section">
                        <div class="omnibox-section-title">Views (${results.views.length})</div>
                        ${results.views.slice(0, 5).map(view => `
                            <div class="omnibox-result-item view" data-type="view" data-id="${view.id}">
                                <div class="omnibox-result-icon">${this.getViewTypeIcon(view.type)}</div>
                                <div class="omnibox-result-content">
                                    <div class="omnibox-result-title">${this.escapeHtml(view.name)}</div>
                                    <div class="omnibox-result-subtitle">${view.type} view</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // Sets
            if (results.sets.length > 0) {
                html += `
                    <div class="omnibox-section">
                        <div class="omnibox-section-title">Sets (${results.sets.length})</div>
                        ${results.sets.slice(0, 5).map(set => `
                            <div class="omnibox-result-item set" data-type="set" data-id="${set.id}">
                                <div class="omnibox-result-icon"><i class="ph ph-folder"></i></div>
                                <div class="omnibox-result-content">
                                    <div class="omnibox-result-title">${this.escapeHtml(set.name)}</div>
                                    <div class="omnibox-result-subtitle">${set.recordCount} records</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }

        html += '</div>';
        return html;
    }

    /**
     * Search across all data
     */
    searchData(query) {
        const lowerQuery = query.toLowerCase();
        const results = {
            records: [],
            fields: [],
            views: [],
            sets: []
        };

        // Search sets
        this.state.sets.forEach(set => {
            if (set.name.toLowerCase().includes(lowerQuery)) {
                results.sets.push({
                    id: set.id,
                    name: set.name,
                    recordCount: set.records?.size || 0
                });
            }

            // Search fields in this set
            (set.schema || []).forEach(field => {
                if (field.name?.toLowerCase().includes(lowerQuery) ||
                    field.id.toLowerCase().includes(lowerQuery)) {
                    results.fields.push({
                        id: field.id,
                        name: field.name || field.id,
                        setId: set.id,
                        setName: set.name
                    });
                }
            });

            // Search records in this set
            set.records?.forEach(record => {
                const schema = set.schema || [];
                for (const field of schema) {
                    const value = record[field.id];
                    if (value && String(value).toLowerCase().includes(lowerQuery)) {
                        // Get a display value (first non-empty field)
                        let displayValue = record.id;
                        for (const f of schema) {
                            if (record[f.id]) {
                                displayValue = String(record[f.id]).slice(0, 50);
                                break;
                            }
                        }

                        results.records.push({
                            id: record.id || record._id,
                            setId: set.id,
                            displayValue,
                            matchField: field.name || field.id,
                            matchValue: String(value).slice(0, 50)
                        });
                        break; // Only add once per record
                    }
                }
            });
        });

        // Search views
        if (this.state.views) {
            this.state.views.forEach(view => {
                if (view.name.toLowerCase().includes(lowerQuery)) {
                    results.views.push({
                        id: view.id,
                        name: view.name,
                        type: view.type,
                        setId: view.setId
                    });
                }
            });
        }

        return results;
    }

    /**
     * Handle clicking on a search result
     */
    handleSearchResultClick(item) {
        const type = item.dataset.type;
        const id = item.dataset.id;
        const action = item.dataset.action;
        const setId = item.dataset.setId;

        // Clear input and close dropdown
        const input = document.getElementById('omniboxInput');
        const dropdown = document.getElementById('omniboxDropdown');
        if (input) input.value = '';
        if (dropdown) dropdown.classList.remove('visible');

        if (action) {
            switch (action) {
                case 'new-view':
                    this.createNewTab();
                    break;
                case 'search-records':
                    // Focus on record search
                    if (input) input.placeholder = 'Search records...';
                    break;
                case 'search-fields':
                    // Show fields explorer
                    if (window.showAvailableFieldsExplorer) {
                        window.showAvailableFieldsExplorer(this.state, this.setId);
                    }
                    break;
            }
            return;
        }

        switch (type) {
            case 'view':
                this.switchToTab(id);
                break;
            case 'set':
                if (window.switchSet) {
                    window.switchSet(id);
                }
                break;
            case 'record':
                // Navigate to record (could open in a detail view)
                this.navigateToRecord(setId, id);
                break;
            case 'field':
                // Show field details or add to view
                this.showFieldDetails(setId, id);
                break;
        }
    }

    /**
     * Set active search result item
     */
    setActiveSearchItem(items, index) {
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });

        if (items[index]) {
            items[index].scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Switch to a tab by view ID
     */
    switchToTab(viewId) {
        if (window.switchSet) {
            window.switchSet(this.setId, viewId);
        }
        this.onTabChange(viewId);
    }

    /**
     * Switch to tab by index (1-9)
     */
    switchToTabByIndex(index) {
        const views = this.getSetViews(this.state, this.setId);
        if (index < views.length) {
            this.switchToTab(views[index].id);
        }
    }

    /**
     * Cycle through tabs
     */
    cycleTab(direction) {
        const views = this.getSetViews(this.state, this.setId);
        const currentIndex = views.findIndex(v => v.id === this.state.currentViewId);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = views.length - 1;
        if (newIndex >= views.length) newIndex = 0;

        this.switchToTab(views[newIndex].id);
    }

    /**
     * Close a tab
     */
    closeTab(viewId) {
        const views = this.getSetViews(this.state, this.setId);

        // Don't close if it's the last tab
        if (views.length <= 1) {
            this.showToast('Cannot close the last tab');
            return;
        }

        // If closing current tab, switch to another first
        if (this.state.currentViewId === viewId) {
            const currentIndex = views.findIndex(v => v.id === viewId);
            const newIndex = currentIndex > 0 ? currentIndex - 1 : 1;
            this.switchToTab(views[newIndex].id);
        }

        // Delete the view
        if (typeof deleteView === 'function') {
            deleteView(this.state, viewId);
        }

        // Re-render
        if (window.renderCurrentView) {
            window.renderCurrentView();
        }
    }

    /**
     * Create a new tab
     */
    createNewTab() {
        if (typeof showCreateViewDialog === 'function') {
            showCreateViewDialog(this.state, this.setId);
        }
    }

    /**
     * Pop out a tab into a floating window
     */
    popOutTab(viewId, x, y) {
        const view = this.state.views?.get(viewId);
        if (!view) return;

        // Create floating window
        const floatingWindow = document.createElement('div');
        floatingWindow.className = 'browser-floating-window';
        floatingWindow.id = `floating-${viewId}`;
        floatingWindow.style.left = `${x - 200}px`;
        floatingWindow.style.top = `${y - 20}px`;

        floatingWindow.innerHTML = `
            <div class="floating-window-header" data-view-id="${viewId}">
                <div class="floating-window-title">
                    <span class="floating-icon">${this.getViewTypeIcon(view.type)}</span>
                    <span class="floating-name">${this.escapeHtml(view.name)}</span>
                </div>
                <div class="floating-window-controls">
                    <button class="floating-btn dock-btn" title="Dock back to tab bar">
                        <i class="ph ph-arrow-line-down"></i>
                    </button>
                    <button class="floating-btn minimize-btn" title="Minimize">
                        <i class="ph ph-minus"></i>
                    </button>
                    <button class="floating-btn close-btn" title="Close">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
            </div>
            <div class="floating-window-content">
                <div class="floating-placeholder">
                    <i class="ph ph-browser"></i>
                    <p>View: ${this.escapeHtml(view.name)}</p>
                    <p class="meta">${view.type} view</p>
                </div>
            </div>
            <div class="floating-window-resize"></div>
        `;

        document.body.appendChild(floatingWindow);
        this.floatingWindows.set(viewId, floatingWindow);

        // Make it draggable
        this.makeFloatingDraggable(floatingWindow);
        this.makeFloatingResizable(floatingWindow);

        // Attach controls
        floatingWindow.querySelector('.dock-btn').addEventListener('click', () => {
            this.dockFloatingWindow(viewId);
        });

        floatingWindow.querySelector('.close-btn').addEventListener('click', () => {
            floatingWindow.remove();
            this.floatingWindows.delete(viewId);
        });

        floatingWindow.querySelector('.minimize-btn').addEventListener('click', () => {
            floatingWindow.classList.toggle('minimized');
        });

        // Remove from tab bar
        const tab = document.querySelector(`.browser-tab[data-view-id="${viewId}"]`);
        if (tab) tab.remove();

        this.showToast(`Popped out: ${view.name}`);
    }

    /**
     * Dock a floating window back to the tab bar
     */
    dockFloatingWindow(viewId) {
        const floatingWindow = this.floatingWindows.get(viewId);
        if (!floatingWindow) return;

        floatingWindow.remove();
        this.floatingWindows.delete(viewId);

        // Re-render tabs
        if (window.renderCurrentView) {
            window.renderCurrentView();
        }

        this.showToast('Tab docked');
    }

    /**
     * Make floating window draggable
     */
    makeFloatingDraggable(floatingWindow) {
        const header = floatingWindow.querySelector('.floating-window-header');
        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.floating-window-controls')) return;

            isDragging = true;
            offsetX = e.clientX - floatingWindow.offsetLeft;
            offsetY = e.clientY - floatingWindow.offsetTop;
            floatingWindow.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            floatingWindow.style.left = `${e.clientX - offsetX}px`;
            floatingWindow.style.top = `${e.clientY - offsetY}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            floatingWindow.classList.remove('dragging');
        });
    }

    /**
     * Make floating window resizable
     */
    makeFloatingResizable(floatingWindow) {
        const resizeHandle = floatingWindow.querySelector('.floating-window-resize');
        let isResizing = false;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const width = e.clientX - floatingWindow.offsetLeft;
            const height = e.clientY - floatingWindow.offsetTop;

            floatingWindow.style.width = `${Math.max(300, width)}px`;
            floatingWindow.style.height = `${Math.max(200, height)}px`;
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    /**
     * Show tab context menu
     */
    showTabContextMenu(e, tab) {
        const viewId = tab.dataset.viewId;
        const existingMenu = document.querySelector('.browser-tab-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'browser-tab-context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="reload">
                <i class="ph ph-arrow-clockwise"></i> Reload
            </div>
            <div class="context-menu-item" data-action="duplicate">
                <i class="ph ph-copy"></i> Duplicate
            </div>
            <div class="context-menu-item" data-action="popout">
                <i class="ph ph-arrow-square-out"></i> Pop out
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="pin">
                <i class="ph ph-push-pin"></i> Pin tab
            </div>
            <div class="context-menu-item" data-action="rename">
                <i class="ph ph-pencil"></i> Rename
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="close-others">
                <i class="ph ph-x-circle"></i> Close other tabs
            </div>
            <div class="context-menu-item" data-action="close-right">
                <i class="ph ph-arrow-right"></i> Close tabs to the right
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item danger" data-action="close">
                <i class="ph ph-x"></i> Close
            </div>
        `;

        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        document.body.appendChild(menu);

        menu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            if (!action) return;

            switch (action) {
                case 'close':
                    this.closeTab(viewId);
                    break;
                case 'duplicate':
                    this.duplicateTab(viewId);
                    break;
                case 'popout':
                    this.popOutTab(viewId, e.clientX, e.clientY);
                    break;
                case 'rename':
                    this.startRenameTab(tab);
                    break;
                case 'close-others':
                    this.closeOtherTabs(viewId);
                    break;
                case 'close-right':
                    this.closeTabsToRight(viewId);
                    break;
            }

            menu.remove();
        });

        // Close menu on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 0);
    }

    /**
     * Start inline tab rename
     */
    startRenameTab(tab) {
        const titleEl = tab.querySelector('.browser-tab-title');
        const viewId = tab.dataset.viewId;
        const view = this.state.views?.get(viewId);
        if (!view || !titleEl) return;

        const currentName = view.name;
        titleEl.contentEditable = 'true';
        titleEl.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(titleEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const finishRename = () => {
            titleEl.contentEditable = 'false';
            const newName = titleEl.textContent.trim() || currentName;

            if (newName !== currentName && typeof updateView === 'function') {
                updateView(this.state, viewId, { name: newName });
            } else {
                titleEl.textContent = currentName;
            }
        };

        titleEl.addEventListener('blur', finishRename, { once: true });
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleEl.blur();
            }
            if (e.key === 'Escape') {
                titleEl.textContent = currentName;
                titleEl.blur();
            }
        });
    }

    /**
     * Duplicate a tab
     */
    duplicateTab(viewId) {
        if (typeof cloneView === 'function') {
            const view = this.state.views?.get(viewId);
            if (view) {
                const newView = cloneView(this.state, viewId, `${view.name} (copy)`);
                if (newView) {
                    this.switchToTab(newView.id);
                }
            }
        }
    }

    /**
     * Close all tabs except the specified one
     */
    closeOtherTabs(viewId) {
        const views = this.getSetViews(this.state, this.setId);
        views.forEach(view => {
            if (view.id !== viewId) {
                if (typeof deleteView === 'function') {
                    deleteView(this.state, view.id);
                }
            }
        });
        this.switchToTab(viewId);
        if (window.renderCurrentView) window.renderCurrentView();
    }

    /**
     * Close tabs to the right
     */
    closeTabsToRight(viewId) {
        const views = this.getSetViews(this.state, this.setId);
        const index = views.findIndex(v => v.id === viewId);

        for (let i = index + 1; i < views.length; i++) {
            if (typeof deleteView === 'function') {
                deleteView(this.state, views[i].id);
            }
        }
        if (window.renderCurrentView) window.renderCurrentView();
    }

    /**
     * Save tab order after reordering
     */
    saveTabOrder() {
        const container = document.getElementById('browserTabsContainer');
        if (!container) return;

        const newOrder = Array.from(container.querySelectorAll('.browser-tab'))
            .map(tab => tab.dataset.viewId);

        this.onTabReorder(newOrder);
    }

    /**
     * Refresh current view
     */
    refreshCurrentView() {
        if (window.renderCurrentView) {
            window.renderCurrentView();
            this.showToast('View refreshed');
        }
    }

    /**
     * Navigate to a specific record
     */
    navigateToRecord(setId, recordId) {
        // This could open a record detail view or highlight the record in the grid
        if (window.switchSet) {
            window.switchSet(setId);
        }
        // TODO: Implement record focus/highlight
        this.showToast(`Navigating to record: ${recordId}`);
    }

    /**
     * Show field details
     */
    showFieldDetails(setId, fieldId) {
        if (window.showAvailableFieldsExplorer) {
            window.showAvailableFieldsExplorer(this.state, setId);
        }
    }

    /**
     * Get views for a set
     */
    getSetViews(state, setId) {
        if (!state.views) return [];
        return Array.from(state.views.values()).filter(v => v.setId === setId);
    }

    /**
     * Get recently accessed views
     */
    getRecentViews() {
        if (!this.state.views) return [];
        return Array.from(this.state.views.values())
            .filter(v => v.setId === this.setId)
            .slice(0, 5);
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        if (typeof showToast === 'function') {
            showToast(message);
        } else {
            console.log(message);
        }
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.EOBrowserTabs = EOBrowserTabs;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EOBrowserTabs;
}
