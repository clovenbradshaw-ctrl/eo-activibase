/**
 * EO Chrome-Style Tab Bar System
 *
 * Features:
 * - Chrome-style horizontal tab bar with drag-to-reorder
 * - Middle-click to close tabs
 * - Context menu for tab actions
 * - Pop-out tabs into floating windows (drag outside tab bar)
 * - Omnibox search bar (Ctrl+K) for searching records, views, sets, fields
 * - Zero-input suggestions showing open tabs, sets, and quick actions
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Ctrl+T for new tab, Ctrl+Tab to cycle tabs
 * - Dark mode support
 * - Responsive design for mobile
 */

class EOChromeTabSystem {
    constructor() {
        this.floatingWindows = new Map();
        this.floatingWindowIdCounter = 0;
        this.omniboxOpen = false;
        this.omniboxSelectedIndex = 0;
        this.omniboxSuggestions = [];
        this.tabDragState = {
            isDragging: false,
            draggedTab: null,
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0,
            popoutPreview: null,
            isOutsideTabBar: false
        };

        this.init();
    }

    init() {
        this.setupKeyboardShortcuts();
        this.setupDarkModeToggle();
        this.createOmnibox();

        // Observe DOM for tab bar to enhance
        this.observeTabBar();
    }

    // =========================================
    // Dark Mode
    // =========================================

    setupDarkModeToggle() {
        // Check for saved preference
        const savedTheme = localStorage.getItem('eo-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        // Create toggle button
        const toggle = document.createElement('button');
        toggle.className = 'dark-mode-toggle';
        toggle.title = 'Toggle dark mode';
        toggle.innerHTML = this.isDarkMode() ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon"></i>';
        toggle.onclick = () => this.toggleDarkMode();
        document.body.appendChild(toggle);
        this.darkModeToggle = toggle;

        // Listen for system preference changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('eo-theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                this.updateDarkModeToggle();
            }
        });
    }

    isDarkMode() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    toggleDarkMode() {
        const newTheme = this.isDarkMode() ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('eo-theme', newTheme);
        this.updateDarkModeToggle();
    }

    updateDarkModeToggle() {
        if (this.darkModeToggle) {
            this.darkModeToggle.innerHTML = this.isDarkMode()
                ? '<i class="ph ph-sun"></i>'
                : '<i class="ph ph-moon"></i>';
        }
    }

    // =========================================
    // Keyboard Shortcuts
    // =========================================

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K - Open omnibox
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.openOmnibox();
                return;
            }

            // Ctrl+T or Cmd+T - New tab (show new view dialog)
            if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                this.openNewTab();
                return;
            }

            // Ctrl+1 through Ctrl+9 - Switch to specific tab
            if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const tabIndex = parseInt(e.key) - 1;
                this.switchToTabByIndex(tabIndex);
                return;
            }

            // Ctrl+Tab - Cycle to next tab
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.cycleTab(-1);
                } else {
                    this.cycleTab(1);
                }
                return;
            }

            // Ctrl+W - Close current tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
                // Only handle if not in an input
                if (!this.isInInput(e.target) && typeof state !== 'undefined' && state.currentSetId && state.currentViewId) {
                    e.preventDefault();
                    if (typeof closeViewTab === 'function') {
                        closeViewTab(state.currentSetId, state.currentViewId);
                    }
                }
                return;
            }

            // Ctrl+Shift+T - Reopen last closed tab (if we track it)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.reopenLastClosedTab();
                return;
            }

            // Handle omnibox navigation
            if (this.omniboxOpen) {
                this.handleOmniboxKeydown(e);
            }
        });
    }

    isInInput(target) {
        return target.tagName === 'INPUT' ||
               target.tagName === 'TEXTAREA' ||
               target.contentEditable === 'true';
    }

    openNewTab() {
        // If we have a current set, try to create a new view
        if (typeof state !== 'undefined' && state.currentSetId && typeof showCreateViewDialog === 'function') {
            showCreateViewDialog(state.currentSetId);
        } else {
            // Open omnibox for quick navigation
            this.openOmnibox();
        }
    }

    cycleTab(direction) {
        if (typeof state === 'undefined' || !state.openTabs || state.openTabs.length === 0) return;

        const currentKey = `${state.currentSetId}::${state.currentViewId}`;
        let currentIndex = state.openTabs.findIndex(tab =>
            `${tab.setId}::${tab.viewId}` === currentKey
        );

        if (currentIndex === -1) currentIndex = 0;

        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = state.openTabs.length - 1;
        if (newIndex >= state.openTabs.length) newIndex = 0;

        const newTab = state.openTabs[newIndex];
        if (newTab && typeof switchSet === 'function') {
            switchSet(newTab.setId, newTab.viewId);
        }
    }

    switchToTabByIndex(index) {
        if (typeof state === 'undefined' || !state.openTabs || state.openTabs.length === 0) return;

        // Ctrl+9 always goes to last tab (like Chrome)
        if (index === 8) {
            index = state.openTabs.length - 1;
        }

        if (index >= 0 && index < state.openTabs.length) {
            const tab = state.openTabs[index];
            if (tab && typeof switchSet === 'function') {
                switchSet(tab.setId, tab.viewId);
            }
        }
    }

    // Track closed tabs for reopen
    closedTabsHistory = [];

    trackClosedTab(setId, viewId) {
        this.closedTabsHistory.push({ setId, viewId, closedAt: Date.now() });
        // Keep only last 10
        if (this.closedTabsHistory.length > 10) {
            this.closedTabsHistory.shift();
        }
    }

    reopenLastClosedTab() {
        if (this.closedTabsHistory.length === 0) {
            if (typeof showToast === 'function') {
                showToast('No recently closed tabs');
            }
            return;
        }

        const lastClosed = this.closedTabsHistory.pop();
        if (lastClosed && typeof state !== 'undefined') {
            const set = state.sets?.get(lastClosed.setId);
            const view = set?.views?.get(lastClosed.viewId);

            if (set && view && typeof switchSet === 'function') {
                switchSet(lastClosed.setId, lastClosed.viewId);
            } else if (typeof showToast === 'function') {
                showToast('Tab no longer exists');
            }
        }
    }

    // =========================================
    // Omnibox Search
    // =========================================

    createOmnibox() {
        const overlay = document.createElement('div');
        overlay.className = 'omnibox-overlay';
        overlay.id = 'omniboxOverlay';
        overlay.innerHTML = `
            <div class="omnibox-container">
                <div class="omnibox-input-wrapper">
                    <span class="omnibox-icon"><i class="ph ph-magnifying-glass"></i></span>
                    <input type="text" class="omnibox-input" id="omniboxInput"
                           placeholder="Search tabs, sets, views, records..."
                           autocomplete="off">
                    <span class="omnibox-kbd">esc</span>
                </div>
                <div class="omnibox-suggestions" id="omniboxSuggestions"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.omniboxOverlay = overlay;
        this.omniboxInput = document.getElementById('omniboxInput');
        this.omniboxSuggestionsEl = document.getElementById('omniboxSuggestions');

        // Event listeners
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeOmnibox();
            }
        });

        this.omniboxInput.addEventListener('input', () => {
            this.updateOmniboxSuggestions();
        });
    }

    openOmnibox() {
        this.omniboxOpen = true;
        this.omniboxSelectedIndex = 0;
        this.omniboxOverlay.classList.add('active');
        this.omniboxInput.value = '';
        this.omniboxInput.focus();
        this.updateOmniboxSuggestions();
    }

    closeOmnibox() {
        this.omniboxOpen = false;
        this.omniboxOverlay.classList.remove('active');
        this.omniboxInput.blur();
    }

    handleOmniboxKeydown(e) {
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this.closeOmnibox();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.omniboxSelectedIndex = Math.min(
                    this.omniboxSelectedIndex + 1,
                    this.omniboxSuggestions.length - 1
                );
                this.highlightOmniboxItem();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.omniboxSelectedIndex = Math.max(this.omniboxSelectedIndex - 1, 0);
                this.highlightOmniboxItem();
                break;
            case 'Enter':
                e.preventDefault();
                this.selectOmniboxItem(this.omniboxSelectedIndex);
                break;
            case 'Tab':
                e.preventDefault();
                if (e.shiftKey) {
                    this.omniboxSelectedIndex = Math.max(this.omniboxSelectedIndex - 1, 0);
                } else {
                    this.omniboxSelectedIndex = Math.min(
                        this.omniboxSelectedIndex + 1,
                        this.omniboxSuggestions.length - 1
                    );
                }
                this.highlightOmniboxItem();
                break;
        }
    }

    updateOmniboxSuggestions() {
        const query = this.omniboxInput.value.toLowerCase().trim();
        this.omniboxSuggestions = [];

        if (!query) {
            // Zero-input suggestions
            this.omniboxSuggestions = this.getZeroInputSuggestions();
        } else {
            // Search suggestions
            this.omniboxSuggestions = this.searchSuggestions(query);
        }

        this.omniboxSelectedIndex = 0;
        this.renderOmniboxSuggestions();
    }

    getZeroInputSuggestions() {
        const suggestions = [];

        // Quick actions
        suggestions.push({
            type: 'action',
            icon: '<i class="ph ph-plus"></i>',
            title: 'New Tab',
            subtitle: 'Create a new view',
            shortcut: 'Ctrl+T',
            action: () => this.openNewTab()
        });

        suggestions.push({
            type: 'action',
            icon: '<i class="ph ph-moon"></i>',
            title: this.isDarkMode() ? 'Light Mode' : 'Dark Mode',
            subtitle: 'Toggle theme',
            action: () => this.toggleDarkMode()
        });

        // Open tabs
        if (typeof state !== 'undefined' && state.openTabs) {
            state.openTabs.forEach((tab, index) => {
                const set = state.sets?.get(tab.setId);
                const view = set?.views?.get(tab.viewId);
                if (set && view) {
                    suggestions.push({
                        type: 'tab',
                        icon: view.icon || '<i class="ph ph-table"></i>',
                        title: view.name,
                        subtitle: `Tab - ${set.name}`,
                        shortcut: index < 9 ? `Ctrl+${index + 1}` : '',
                        action: () => {
                            if (typeof switchSet === 'function') {
                                switchSet(tab.setId, tab.viewId);
                            }
                        }
                    });
                }
            });
        }

        // Recent sets
        if (typeof state !== 'undefined' && state.sets) {
            const sets = Array.from(state.sets.values()).slice(0, 5);
            sets.forEach(set => {
                suggestions.push({
                    type: 'set',
                    icon: set.icon || '<i class="ph ph-database"></i>',
                    title: set.name,
                    subtitle: `${set.records?.length || 0} records`,
                    action: () => {
                        const firstViewId = Array.from(set.views?.keys() || [])[0];
                        if (firstViewId && typeof switchSet === 'function') {
                            switchSet(set.id, firstViewId);
                        }
                    }
                });
            });
        }

        return suggestions;
    }

    searchSuggestions(query) {
        const suggestions = [];

        if (typeof state === 'undefined') return suggestions;

        // Search open tabs
        if (state.openTabs) {
            state.openTabs.forEach(tab => {
                const set = state.sets?.get(tab.setId);
                const view = set?.views?.get(tab.viewId);
                if (set && view) {
                    const viewName = view.name.toLowerCase();
                    const setName = set.name.toLowerCase();
                    if (viewName.includes(query) || setName.includes(query)) {
                        suggestions.push({
                            type: 'tab',
                            icon: view.icon || '<i class="ph ph-table"></i>',
                            title: view.name,
                            subtitle: `Tab - ${set.name}`,
                            action: () => {
                                if (typeof switchSet === 'function') {
                                    switchSet(tab.setId, tab.viewId);
                                }
                            }
                        });
                    }
                }
            });
        }

        // Search sets
        if (state.sets) {
            for (const set of state.sets.values()) {
                if (set.name.toLowerCase().includes(query)) {
                    suggestions.push({
                        type: 'set',
                        icon: set.icon || '<i class="ph ph-database"></i>',
                        title: set.name,
                        subtitle: `${set.records?.length || 0} records`,
                        action: () => {
                            const firstViewId = Array.from(set.views?.keys() || [])[0];
                            if (firstViewId && typeof switchSet === 'function') {
                                switchSet(set.id, firstViewId);
                            }
                        }
                    });
                }

                // Search views within set
                if (set.views) {
                    for (const view of set.views.values()) {
                        if (view.name.toLowerCase().includes(query)) {
                            suggestions.push({
                                type: 'view',
                                icon: view.icon || '<i class="ph ph-layout"></i>',
                                title: view.name,
                                subtitle: `View in ${set.name}`,
                                action: () => {
                                    if (typeof switchSet === 'function') {
                                        switchSet(set.id, view.id);
                                    }
                                }
                            });
                        }
                    }
                }

                // Search fields
                if (set.schema) {
                    set.schema.forEach(field => {
                        if (field.name.toLowerCase().includes(query)) {
                            suggestions.push({
                                type: 'field',
                                icon: '<i class="ph ph-columns"></i>',
                                title: field.name,
                                subtitle: `Field in ${set.name} (${field.type})`,
                                action: () => {
                                    // Navigate to set and highlight field
                                    const firstViewId = Array.from(set.views?.keys() || [])[0];
                                    if (firstViewId && typeof switchSet === 'function') {
                                        switchSet(set.id, firstViewId);
                                    }
                                }
                            });
                        }
                    });
                }

                // Search records (limited)
                if (set.records && suggestions.length < 20) {
                    const matchingRecords = set.records.filter(record => {
                        return Object.values(record).some(val =>
                            String(val).toLowerCase().includes(query)
                        );
                    }).slice(0, 5);

                    matchingRecords.forEach(record => {
                        const primaryField = set.schema?.find(f => f.isPrimary);
                        const displayValue = primaryField
                            ? record[primaryField.id]
                            : record.id;

                        suggestions.push({
                            type: 'record',
                            icon: '<i class="ph ph-file-text"></i>',
                            title: String(displayValue || record.id).substring(0, 50),
                            subtitle: `Record in ${set.name}`,
                            action: () => {
                                const firstViewId = Array.from(set.views?.keys() || [])[0];
                                if (firstViewId && typeof switchSet === 'function') {
                                    switchSet(set.id, firstViewId);
                                    // Try to open record popup
                                    if (typeof openRecordPopup === 'function') {
                                        setTimeout(() => openRecordPopup(record.id, set.id), 100);
                                    }
                                }
                            }
                        });
                    });
                }
            }
        }

        // Add actions that match query
        const actions = [
            { keywords: ['new', 'create', 'add', 'tab'], title: 'New Tab', action: () => this.openNewTab() },
            { keywords: ['dark', 'light', 'theme', 'mode'], title: this.isDarkMode() ? 'Switch to Light Mode' : 'Switch to Dark Mode', action: () => this.toggleDarkMode() },
            { keywords: ['dashboard', 'home'], title: 'Go to Dashboard', action: () => { if (typeof navigateTo === 'function') navigateTo('dashboard'); } },
            { keywords: ['import', 'file', 'upload'], title: 'Import Data', action: () => { if (typeof triggerFileImport === 'function') triggerFileImport(); } },
        ];

        actions.forEach(action => {
            if (action.keywords.some(kw => kw.includes(query) || query.includes(kw))) {
                suggestions.push({
                    type: 'action',
                    icon: '<i class="ph ph-lightning"></i>',
                    title: action.title,
                    subtitle: 'Quick action',
                    action: action.action
                });
            }
        });

        return suggestions.slice(0, 15);
    }

    renderOmniboxSuggestions() {
        if (this.omniboxSuggestions.length === 0) {
            this.omniboxSuggestionsEl.innerHTML = `
                <div class="omnibox-empty">
                    <div class="omnibox-empty-icon"><i class="ph ph-magnifying-glass"></i></div>
                    <div>No results found</div>
                </div>
            `;
            return;
        }

        // Group by type
        const grouped = {};
        this.omniboxSuggestions.forEach((item, index) => {
            const type = item.type;
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push({ ...item, index });
        });

        const typeLabels = {
            action: 'Quick Actions',
            tab: 'Open Tabs',
            set: 'Sets',
            view: 'Views',
            field: 'Fields',
            record: 'Records'
        };

        let html = '';
        const typeOrder = ['action', 'tab', 'set', 'view', 'field', 'record'];

        typeOrder.forEach(type => {
            if (grouped[type]) {
                html += `
                    <div class="omnibox-section">
                        <div class="omnibox-section-title">${typeLabels[type] || type}</div>
                    </div>
                `;
                grouped[type].forEach(item => {
                    const isSelected = item.index === this.omniboxSelectedIndex;
                    html += `
                        <div class="omnibox-item ${isSelected ? 'selected' : ''}"
                             data-index="${item.index}">
                            <div class="omnibox-item-icon ${item.type}">${item.icon}</div>
                            <div class="omnibox-item-content">
                                <div class="omnibox-item-title">${this.escapeHtml(item.title)}</div>
                                <div class="omnibox-item-subtitle">${this.escapeHtml(item.subtitle || '')}</div>
                            </div>
                            ${item.shortcut ? `<span class="omnibox-item-shortcut">${item.shortcut}</span>` : ''}
                        </div>
                    `;
                });
            }
        });

        this.omniboxSuggestionsEl.innerHTML = html;

        // Add click listeners
        this.omniboxSuggestionsEl.querySelectorAll('.omnibox-item').forEach(el => {
            el.addEventListener('click', () => {
                this.selectOmniboxItem(parseInt(el.dataset.index));
            });
            el.addEventListener('mouseenter', () => {
                this.omniboxSelectedIndex = parseInt(el.dataset.index);
                this.highlightOmniboxItem();
            });
        });
    }

    highlightOmniboxItem() {
        this.omniboxSuggestionsEl.querySelectorAll('.omnibox-item').forEach((el, i) => {
            const index = parseInt(el.dataset.index);
            el.classList.toggle('selected', index === this.omniboxSelectedIndex);

            // Scroll into view
            if (index === this.omniboxSelectedIndex) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }

    selectOmniboxItem(index) {
        const item = this.omniboxSuggestions[index];
        if (item && item.action) {
            this.closeOmnibox();
            item.action();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =========================================
    // Tab Bar Enhancement
    // =========================================

    observeTabBar() {
        // Wait for DOM and enhance tab bar
        const enhanceTabBar = () => {
            const viewTabs = document.getElementById('viewTabs');
            if (viewTabs) {
                this.enhanceExistingTabs(viewTabs);
            }
        };

        // Initial enhancement
        if (document.readyState === 'complete') {
            enhanceTabBar();
        } else {
            window.addEventListener('load', enhanceTabBar);
        }

        // Watch for changes
        const observer = new MutationObserver(() => {
            enhanceTabBar();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    enhanceExistingTabs(container) {
        // Add middle-click to close
        container.querySelectorAll('.view-tab').forEach(tab => {
            if (!tab.dataset.chromeEnhanced) {
                tab.dataset.chromeEnhanced = 'true';

                // Middle-click to close
                tab.addEventListener('auxclick', (e) => {
                    if (e.button === 1) { // Middle click
                        e.preventDefault();
                        const key = tab.dataset.tabKey;
                        if (key) {
                            const [setId, viewId] = key.split('::');
                            if (typeof closeViewTab === 'function') {
                                this.trackClosedTab(setId, viewId);
                                closeViewTab(setId, viewId);
                            }
                        }
                    }
                });

                // Enhanced drag for pop-out
                tab.addEventListener('dragstart', (e) => this.handleTabDragStart(e, tab));
                document.addEventListener('dragover', (e) => this.handleTabDragMove(e));
                document.addEventListener('dragend', (e) => this.handleTabDragEnd(e));
            }
        });

        // Check overflow for mobile scroll indicator
        this.checkTabOverflow(container);
    }

    checkTabOverflow(container) {
        if (container.scrollWidth > container.clientWidth) {
            container.classList.add('has-overflow');
        } else {
            container.classList.remove('has-overflow');
        }
    }

    // =========================================
    // Tab Drag & Pop-out
    // =========================================

    handleTabDragStart(e, tab) {
        const key = tab.dataset.tabKey;
        if (!key) return;

        const [setId, viewId] = key.split('::');
        const set = typeof state !== 'undefined' ? state.sets?.get(setId) : null;
        const view = set?.views?.get(viewId);

        this.tabDragState = {
            isDragging: true,
            draggedTab: { setId, viewId, setName: set?.name, viewName: view?.name, icon: view?.icon },
            startX: e.clientX,
            startY: e.clientY,
            popoutPreview: null,
            isOutsideTabBar: false
        };

        // Store original data for standard tab reorder
        e.dataTransfer.setData('text/plain', key);
        e.dataTransfer.effectAllowed = 'move';
    }

    handleTabDragMove(e) {
        if (!this.tabDragState.isDragging) return;

        const viewTabs = document.getElementById('viewTabs');
        if (!viewTabs) return;

        const tabBarRect = viewTabs.getBoundingClientRect();
        const isOutside = e.clientY < tabBarRect.top - 50 ||
                          e.clientY > tabBarRect.bottom + 50 ||
                          e.clientX < tabBarRect.left - 50 ||
                          e.clientX > tabBarRect.right + 50;

        if (isOutside && !this.tabDragState.isOutsideTabBar) {
            // Entered pop-out zone
            this.tabDragState.isOutsideTabBar = true;
            this.showPopoutPreview(e.clientX, e.clientY);
        } else if (!isOutside && this.tabDragState.isOutsideTabBar) {
            // Returned to tab bar
            this.tabDragState.isOutsideTabBar = false;
            this.hidePopoutPreview();
        } else if (isOutside && this.tabDragState.popoutPreview) {
            // Update preview position
            this.tabDragState.popoutPreview.style.left = `${e.clientX - 140}px`;
            this.tabDragState.popoutPreview.style.top = `${e.clientY - 100}px`;
        }
    }

    handleTabDragEnd(e) {
        if (!this.tabDragState.isDragging) return;

        if (this.tabDragState.isOutsideTabBar && this.tabDragState.draggedTab) {
            // Pop out the tab
            this.popoutTab(
                this.tabDragState.draggedTab,
                e.clientX - 200,
                e.clientY - 50
            );
        }

        this.hidePopoutPreview();
        this.tabDragState = {
            isDragging: false,
            draggedTab: null,
            startX: 0,
            startY: 0,
            popoutPreview: null,
            isOutsideTabBar: false
        };
    }

    showPopoutPreview(x, y) {
        if (this.tabDragState.popoutPreview) return;

        const preview = document.createElement('div');
        preview.className = 'tab-popout-preview';
        preview.innerHTML = `
            <i class="ph ph-arrows-out"></i>
            <span style="margin-left: 8px;">Drop to pop out</span>
        `;
        preview.style.left = `${x - 140}px`;
        preview.style.top = `${y - 100}px`;
        document.body.appendChild(preview);

        this.tabDragState.popoutPreview = preview;
    }

    hidePopoutPreview() {
        if (this.tabDragState.popoutPreview) {
            this.tabDragState.popoutPreview.remove();
            this.tabDragState.popoutPreview = null;
        }
    }

    // =========================================
    // Floating Windows (Pop-out Tabs)
    // =========================================

    popoutTab(tabInfo, x, y) {
        const windowId = `floating-${++this.floatingWindowIdCounter}`;

        const win = document.createElement('div');
        win.className = 'floating-window';
        win.id = windowId;
        win.style.left = `${Math.max(50, x)}px`;
        win.style.top = `${Math.max(50, y)}px`;
        win.style.width = '600px';
        win.style.height = '400px';

        win.innerHTML = `
            <div class="floating-window-header" data-window-id="${windowId}">
                <span class="floating-window-icon">${tabInfo.icon || '<i class="ph ph-table"></i>'}</span>
                <span class="floating-window-title">${this.escapeHtml(tabInfo.viewName || 'View')} - ${this.escapeHtml(tabInfo.setName || 'Set')}</span>
                <div class="floating-window-actions">
                    <button class="floating-window-btn dock" title="Dock back to tab bar">
                        <i class="ph ph-arrows-in"></i>
                    </button>
                    <button class="floating-window-btn close" title="Close">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
            </div>
            <div class="floating-window-content" id="${windowId}-content">
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--tab-text);">
                    <div style="text-align: center;">
                        <i class="ph ph-browser" style="font-size: 48px; opacity: 0.5; margin-bottom: 16px;"></i>
                        <div style="font-size: 14px;">Floating view: <strong>${this.escapeHtml(tabInfo.viewName)}</strong></div>
                        <div style="font-size: 12px; opacity: 0.7; margin-top: 8px;">${this.escapeHtml(tabInfo.setName)}</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(win);

        // Store window data
        this.floatingWindows.set(windowId, {
            element: win,
            tabInfo
        });

        // Setup dragging
        this.setupWindowDrag(win);

        // Button handlers
        win.querySelector('.floating-window-btn.close').onclick = () => {
            this.closeFloatingWindow(windowId);
        };

        win.querySelector('.floating-window-btn.dock').onclick = () => {
            this.dockFloatingWindow(windowId);
        };

        // Close the original tab
        if (typeof closeViewTab === 'function') {
            closeViewTab(tabInfo.setId, tabInfo.viewId);
        }

        if (typeof showToast === 'function') {
            showToast(`Popped out "${tabInfo.viewName}" to floating window`);
        }
    }

    setupWindowDrag(win) {
        const header = win.querySelector('.floating-window-header');
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.floating-window-btn')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = win.offsetLeft;
            startTop = win.offsetTop;

            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            win.style.left = `${startLeft + dx}px`;
            win.style.top = `${startTop + dy}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });
    }

    closeFloatingWindow(windowId) {
        const win = this.floatingWindows.get(windowId);
        if (win) {
            win.element.remove();
            this.floatingWindows.delete(windowId);
        }
    }

    dockFloatingWindow(windowId) {
        const win = this.floatingWindows.get(windowId);
        if (!win) return;

        const { tabInfo } = win;

        // Re-open the tab
        if (typeof switchSet === 'function') {
            switchSet(tabInfo.setId, tabInfo.viewId);
        }

        // Close the window
        this.closeFloatingWindow(windowId);

        if (typeof showToast === 'function') {
            showToast(`Docked "${tabInfo.viewName}" back to tab bar`);
        }
    }

    // =========================================
    // Enhanced Context Menu
    // =========================================

    showTabContextMenu(event, setId, viewId) {
        // Remove existing menus
        document.querySelectorAll('.tab-context-menu').forEach(m => m.remove());

        const set = typeof state !== 'undefined' ? state.sets?.get(setId) : null;
        const view = set?.views?.get(viewId);
        if (!set || !view) return;

        const menu = document.createElement('div');
        menu.className = 'tab-context-menu';
        menu.innerHTML = `
            <div class="tab-context-menu-item" data-action="reload">
                <span class="tab-context-menu-icon"><i class="ph ph-arrow-clockwise"></i></span>
                Reload
            </div>
            <div class="tab-context-menu-item" data-action="duplicate">
                <span class="tab-context-menu-icon"><i class="ph ph-copy"></i></span>
                Duplicate Tab
            </div>
            <div class="tab-context-menu-item" data-action="popout">
                <span class="tab-context-menu-icon"><i class="ph ph-arrows-out"></i></span>
                Pop Out
            </div>
            <div class="tab-context-menu-separator"></div>
            <div class="tab-context-menu-item" data-action="edit">
                <span class="tab-context-menu-icon"><i class="ph ph-pencil"></i></span>
                Edit View
            </div>
            <div class="tab-context-menu-separator"></div>
            <div class="tab-context-menu-item" data-action="close-others">
                <span class="tab-context-menu-icon"><i class="ph ph-x-circle"></i></span>
                Close Other Tabs
            </div>
            <div class="tab-context-menu-item" data-action="close-right">
                <span class="tab-context-menu-icon"><i class="ph ph-caret-right"></i></span>
                Close Tabs to Right
            </div>
            <div class="tab-context-menu-separator"></div>
            <div class="tab-context-menu-item" data-action="close">
                <span class="tab-context-menu-icon"><i class="ph ph-x"></i></span>
                Close
                <span class="tab-context-menu-shortcut">Ctrl+W</span>
            </div>
            <div class="tab-context-menu-item danger" data-action="delete">
                <span class="tab-context-menu-icon"><i class="ph ph-trash"></i></span>
                Delete View
            </div>
        `;

        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        document.body.appendChild(menu);

        // Handle actions
        menu.querySelectorAll('.tab-context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                menu.remove();
                this.handleTabContextAction(action, setId, viewId, view, set);
            });
        });

        // Close on click outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    }

    handleTabContextAction(action, setId, viewId, view, set) {
        switch (action) {
            case 'reload':
                if (typeof renderCurrentView === 'function') {
                    renderCurrentView();
                }
                break;

            case 'duplicate':
                if (typeof cloneView === 'function') {
                    const newName = `${view.name} (copy)`;
                    cloneView(state, viewId, newName);
                    if (typeof renderSidebar === 'function') renderSidebar();
                    if (typeof renderViewTabs === 'function') renderViewTabs();
                }
                break;

            case 'popout':
                this.popoutTab(
                    { setId, viewId, setName: set.name, viewName: view.name, icon: view.icon },
                    window.innerWidth / 2 - 300,
                    window.innerHeight / 2 - 200
                );
                break;

            case 'edit':
                if (typeof showEditViewDialog === 'function') {
                    showEditViewDialog(setId, viewId);
                }
                break;

            case 'close-others':
                this.closeOtherTabs(setId, viewId);
                break;

            case 'close-right':
                this.closeTabsToRight(setId, viewId);
                break;

            case 'close':
                this.trackClosedTab(setId, viewId);
                if (typeof closeViewTab === 'function') {
                    closeViewTab(setId, viewId);
                }
                break;

            case 'delete':
                if (confirm(`Delete view "${view.name}"? This cannot be undone.`)) {
                    if (typeof deleteView === 'function') {
                        deleteView(state, viewId);
                    }
                    if (typeof closeViewTab === 'function') {
                        closeViewTab(setId, viewId);
                    }
                    if (typeof renderSidebar === 'function') {
                        renderSidebar();
                    }
                }
                break;
        }
    }

    closeOtherTabs(keepSetId, keepViewId) {
        if (typeof state === 'undefined' || !state.openTabs) return;

        const keepKey = `${keepSetId}::${keepViewId}`;
        const tabsToClose = state.openTabs.filter(tab =>
            `${tab.setId}::${tab.viewId}` !== keepKey
        );

        tabsToClose.forEach(tab => {
            this.trackClosedTab(tab.setId, tab.viewId);
            if (typeof closeViewTab === 'function') {
                closeViewTab(tab.setId, tab.viewId);
            }
        });
    }

    closeTabsToRight(setId, viewId) {
        if (typeof state === 'undefined' || !state.openTabs) return;

        const key = `${setId}::${viewId}`;
        const index = state.openTabs.findIndex(tab =>
            `${tab.setId}::${tab.viewId}` === key
        );

        if (index === -1) return;

        const tabsToClose = state.openTabs.slice(index + 1);
        tabsToClose.reverse().forEach(tab => {
            this.trackClosedTab(tab.setId, tab.viewId);
            if (typeof closeViewTab === 'function') {
                closeViewTab(tab.setId, tab.viewId);
            }
        });
    }
}

// Initialize on DOM ready
let eoChromeTabSystem;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        eoChromeTabSystem = new EOChromeTabSystem();
    });
} else {
    eoChromeTabSystem = new EOChromeTabSystem();
}

// Export for external use
window.EOChromeTabSystem = EOChromeTabSystem;
window.eoChromeTabSystem = null;
document.addEventListener('DOMContentLoaded', () => {
    window.eoChromeTabSystem = eoChromeTabSystem;
});
