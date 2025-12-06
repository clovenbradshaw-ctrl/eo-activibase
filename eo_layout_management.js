/**
 * EO Layout Management
 *
 * This module implements flexible tab layouts with:
 * - Multiple panes (containers for tabs)
 * - Splits (horizontal/vertical divisions)
 * - Portals (pop-out windows)
 * - Full activity stream integration for persistence
 */

// ============================================================================
// LAYOUT DATA MODELS
// ============================================================================

/**
 * Create a new Pane - a container for tabs
 */
function createPane(config = {}) {
    return {
        type: 'pane',
        id: config.id || `pane_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tabs: config.tabs || [], // Array of {setId, viewId}
        activeTabIndex: config.activeTabIndex || 0
    };
}

/**
 * Create a new Split - divides space between two children
 */
function createSplit(config = {}) {
    return {
        type: 'split',
        id: config.id || `split_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        direction: config.direction || 'horizontal', // 'horizontal' (side-by-side) or 'vertical' (stacked)
        ratio: config.ratio !== undefined ? config.ratio : 0.5, // 0.0 to 1.0
        first: config.first || null,  // Pane or Split
        second: config.second || null // Pane or Split
    };
}

/**
 * Create a new Portal - a detached window
 */
function createPortal(config = {}) {
    return {
        id: config.id || `portal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        windowRef: config.windowRef || null,
        paneTree: config.paneTree || createPane(),
        bounds: config.bounds || { x: 100, y: 100, width: 800, height: 600 },
        isConnected: config.isConnected || false,
        title: config.title || 'EO View'
    };
}

/**
 * Create default layout state
 */
function createDefaultLayoutState() {
    return {
        root: createPane({ id: 'pane-main' }),
        portals: new Map(),
        activePaneId: 'pane-main',
        activePortalId: null,
        preferences: {
            syncSelection: true,
            showPaneBorders: true,
            minPaneWidth: 300,
            minPaneHeight: 200
        },
        presets: new Map(),
        // Shared selection state
        sharedSelection: {
            selectedRecordIds: new Set(),
            hoveredRecordId: null
        }
    };
}

// ============================================================================
// LAYOUT EVENT TYPES
// ============================================================================

const LAYOUT_EVENT_TYPES = {
    SPLIT_CREATED: 'LAYOUT_SPLIT_CREATED',
    SPLIT_RESIZED: 'LAYOUT_SPLIT_RESIZED',
    SPLIT_COLLAPSED: 'LAYOUT_SPLIT_COLLAPSED',
    TAB_MOVED: 'LAYOUT_TAB_MOVED',
    TAB_OPENED: 'LAYOUT_TAB_OPENED',
    TAB_CLOSED: 'LAYOUT_TAB_CLOSED',
    TAB_ACTIVATED: 'LAYOUT_TAB_ACTIVATED',
    PANE_FOCUSED: 'LAYOUT_PANE_FOCUSED',
    PORTAL_OPENED: 'LAYOUT_PORTAL_OPENED',
    PORTAL_CLOSED: 'LAYOUT_PORTAL_CLOSED',
    PORTAL_MOVED: 'LAYOUT_PORTAL_MOVED',
    PORTAL_RESIZED: 'LAYOUT_PORTAL_RESIZED',
    PRESET_SAVED: 'LAYOUT_PRESET_SAVED',
    PRESET_APPLIED: 'LAYOUT_PRESET_APPLIED',
    PRESET_DELETED: 'LAYOUT_PRESET_DELETED'
};

// ============================================================================
// LAYOUT OPERATIONS
// ============================================================================

/**
 * Initialize layout state on the global state object
 */
function initializeLayout(state) {
    if (!state.layout) {
        state.layout = createDefaultLayoutState();
    }
    // Migrate existing openTabs to layout if present
    if (state.openTabs && state.openTabs.length > 0 && state.layout.root.type === 'pane') {
        state.layout.root.tabs = [...state.openTabs];
        state.layout.root.activeTabIndex = 0;
    }
    return state.layout;
}

/**
 * Find a pane by ID in the layout tree
 */
function findPaneById(node, paneId) {
    if (!node) return null;
    if (node.type === 'pane') {
        return node.id === paneId ? node : null;
    }
    if (node.type === 'split') {
        return findPaneById(node.first, paneId) || findPaneById(node.second, paneId);
    }
    return null;
}

/**
 * Find a pane in the entire layout (including portals)
 */
function findPaneInLayout(layout, paneId) {
    // Check main window
    let pane = findPaneById(layout.root, paneId);
    if (pane) return { pane, portalId: null };

    // Check portals
    for (const [portalId, portal] of layout.portals) {
        pane = findPaneById(portal.paneTree, paneId);
        if (pane) return { pane, portalId };
    }
    return null;
}

/**
 * Find which pane contains a specific view
 */
function findPaneContainingView(layout, setId, viewId) {
    function searchNode(node) {
        if (!node) return null;
        if (node.type === 'pane') {
            const tabIndex = node.tabs.findIndex(t => t.setId === setId && t.viewId === viewId);
            if (tabIndex !== -1) return { pane: node, tabIndex };
            return null;
        }
        if (node.type === 'split') {
            return searchNode(node.first) || searchNode(node.second);
        }
        return null;
    }

    // Check main window
    let result = searchNode(layout.root);
    if (result) return { ...result, portalId: null };

    // Check portals
    for (const [portalId, portal] of layout.portals) {
        result = searchNode(portal.paneTree);
        if (result) return { ...result, portalId };
    }
    return null;
}

/**
 * Find the parent split of a node
 */
function findParentSplit(root, nodeId) {
    function search(node, parent) {
        if (!node) return null;
        if (node.id === nodeId) return parent;
        if (node.type === 'split') {
            return search(node.first, node) || search(node.second, node);
        }
        return null;
    }
    return search(root, null);
}

/**
 * Get all panes in the layout
 */
function getAllPanes(node, panes = []) {
    if (!node) return panes;
    if (node.type === 'pane') {
        panes.push(node);
    } else if (node.type === 'split') {
        getAllPanes(node.first, panes);
        getAllPanes(node.second, panes);
    }
    return panes;
}

/**
 * Get all panes including portals
 */
function getAllPanesInLayout(layout) {
    const panes = getAllPanes(layout.root);
    for (const portal of layout.portals.values()) {
        getAllPanes(portal.paneTree, panes);
    }
    return panes;
}

// ============================================================================
// TAB OPERATIONS
// ============================================================================

/**
 * Open a tab in a specific pane
 */
function openTabInPane(state, paneId, setId, viewId) {
    const layout = state.layout;
    const result = findPaneInLayout(layout, paneId);
    if (!result) return false;

    const { pane } = result;

    // Check if tab already exists in this pane
    const existingIndex = pane.tabs.findIndex(t => t.setId === setId && t.viewId === viewId);
    if (existingIndex !== -1) {
        pane.activeTabIndex = existingIndex;
        return true;
    }

    // Check if view is open in another pane
    const existingLocation = findPaneContainingView(layout, setId, viewId);
    if (existingLocation) {
        // Move from existing location to new pane
        return moveTabToPane(state, existingLocation.pane.id, setId, viewId, paneId, pane.tabs.length);
    }

    // Add new tab
    pane.tabs.push({ setId, viewId });
    pane.activeTabIndex = pane.tabs.length - 1;

    // Log event
    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.TAB_OPENED, {
        paneId,
        setId,
        viewId,
        tabIndex: pane.activeTabIndex
    });

    return true;
}

/**
 * Close a tab in a pane
 */
function closeTabInPane(state, paneId, setId, viewId) {
    const layout = state.layout;
    const result = findPaneInLayout(layout, paneId);
    if (!result) return false;

    const { pane, portalId } = result;
    const tabIndex = pane.tabs.findIndex(t => t.setId === setId && t.viewId === viewId);
    if (tabIndex === -1) return false;

    // Remove tab
    pane.tabs.splice(tabIndex, 1);

    // Adjust active index
    if (pane.activeTabIndex >= pane.tabs.length) {
        pane.activeTabIndex = Math.max(0, pane.tabs.length - 1);
    }

    // Log event
    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.TAB_CLOSED, {
        paneId,
        setId,
        viewId,
        tabIndex
    });

    // If pane is empty, consider collapsing
    if (pane.tabs.length === 0) {
        collapseEmptyPane(state, paneId, portalId);
    }

    return true;
}

/**
 * Move a tab from one pane to another
 */
function moveTabToPane(state, fromPaneId, setId, viewId, toPaneId, toIndex = -1) {
    const layout = state.layout;

    const fromResult = findPaneInLayout(layout, fromPaneId);
    const toResult = findPaneInLayout(layout, toPaneId);

    if (!fromResult || !toResult) return false;

    const { pane: fromPane, portalId: fromPortalId } = fromResult;
    const { pane: toPane } = toResult;

    // Find and remove from source
    const fromIndex = fromPane.tabs.findIndex(t => t.setId === setId && t.viewId === viewId);
    if (fromIndex === -1) return false;

    const [tab] = fromPane.tabs.splice(fromIndex, 1);

    // Insert at destination
    const insertIndex = toIndex === -1 ? toPane.tabs.length : Math.min(toIndex, toPane.tabs.length);
    toPane.tabs.splice(insertIndex, 0, tab);
    toPane.activeTabIndex = insertIndex;

    // Adjust source pane active index
    if (fromPane.activeTabIndex >= fromPane.tabs.length) {
        fromPane.activeTabIndex = Math.max(0, fromPane.tabs.length - 1);
    }

    // Log event
    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.TAB_MOVED, {
        fromPaneId,
        toPaneId,
        setId,
        viewId,
        fromIndex,
        toIndex: insertIndex
    });

    // If source pane is empty, collapse it
    if (fromPane.tabs.length === 0) {
        collapseEmptyPane(state, fromPaneId, fromPortalId);
    }

    return true;
}

/**
 * Activate a tab in a pane
 */
function activateTab(state, paneId, tabIndex) {
    const layout = state.layout;
    const result = findPaneInLayout(layout, paneId);
    if (!result) return false;

    const { pane, portalId } = result;
    if (tabIndex < 0 || tabIndex >= pane.tabs.length) return false;

    pane.activeTabIndex = tabIndex;
    layout.activePaneId = paneId;
    layout.activePortalId = portalId;

    // Update global state for current view
    const tab = pane.tabs[tabIndex];
    if (tab) {
        state.currentSetId = tab.setId;
        state.currentViewId = tab.viewId;
        state.currentSpecialView = null;
    }

    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.TAB_ACTIVATED, {
        paneId,
        tabIndex,
        setId: tab?.setId,
        viewId: tab?.viewId
    });

    return true;
}

// ============================================================================
// SPLIT OPERATIONS
// ============================================================================

/**
 * Split a pane in a given direction
 * @param {Object} state - Global state
 * @param {string} paneId - ID of the pane to split
 * @param {string} direction - 'horizontal' (side-by-side) or 'vertical' (stacked)
 * @param {Object} tabToMove - Optional {setId, viewId} to move to the new pane
 * @returns {Object|null} - The new pane, or null if failed
 */
function splitPane(state, paneId, direction, tabToMove = null) {
    const layout = state.layout;

    // Find the pane and its parent
    function findAndReplace(node, parent, key) {
        if (!node) return null;

        if (node.type === 'pane' && node.id === paneId) {
            // Create the new pane
            const newPane = createPane();

            // Create the split
            const split = createSplit({
                direction,
                first: node,
                second: newPane
            });

            // Replace in parent
            if (parent) {
                parent[key] = split;
            } else {
                layout.root = split;
            }

            return newPane;
        }

        if (node.type === 'split') {
            return findAndReplace(node.first, node, 'first') ||
                   findAndReplace(node.second, node, 'second');
        }

        return null;
    }

    // Also check portals
    let newPane = findAndReplace(layout.root, null, null);
    let portalId = null;

    if (!newPane) {
        for (const [pid, portal] of layout.portals) {
            newPane = findAndReplace(portal.paneTree, null, null);
            if (newPane) {
                portalId = pid;
                break;
            }
        }
    }

    if (!newPane) return null;

    // If a tab was specified to move, move it to the new pane
    if (tabToMove) {
        const fromResult = findPaneContainingView(layout, tabToMove.setId, tabToMove.viewId);
        if (fromResult) {
            moveTabToPane(state, fromResult.pane.id, tabToMove.setId, tabToMove.viewId, newPane.id, 0);
        }
    }

    // Log event
    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.SPLIT_CREATED, {
        sourcePaneId: paneId,
        newPaneId: newPane.id,
        direction,
        portalId
    });

    return newPane;
}

/**
 * Resize a split by changing its ratio
 */
function resizeSplit(state, splitId, newRatio, portalId = null) {
    const layout = state.layout;
    const root = portalId ? layout.portals.get(portalId)?.paneTree : layout.root;

    function findSplit(node) {
        if (!node) return null;
        if (node.type === 'split') {
            if (node.id === splitId) return node;
            return findSplit(node.first) || findSplit(node.second);
        }
        return null;
    }

    const split = findSplit(root);
    if (!split) return false;

    const oldRatio = split.ratio;
    split.ratio = Math.max(0.1, Math.min(0.9, newRatio));

    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.SPLIT_RESIZED, {
        splitId,
        oldRatio,
        newRatio: split.ratio,
        portalId
    });

    return true;
}

/**
 * Collapse an empty pane by removing its split
 */
function collapseEmptyPane(state, paneId, portalId = null) {
    const layout = state.layout;

    function collapseInTree(root) {
        function findAndCollapse(node, parent, key) {
            if (!node) return false;

            if (node.type === 'split') {
                // Check if first child is the empty pane
                if (node.first?.type === 'pane' && node.first.id === paneId && node.first.tabs.length === 0) {
                    // Replace split with second child
                    if (parent) {
                        parent[key] = node.second;
                    } else {
                        return node.second; // New root
                    }

                    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.SPLIT_COLLAPSED, {
                        splitId: node.id,
                        collapsedPaneId: paneId,
                        remainingNodeId: node.second?.id,
                        portalId
                    });

                    return true;
                }

                // Check if second child is the empty pane
                if (node.second?.type === 'pane' && node.second.id === paneId && node.second.tabs.length === 0) {
                    // Replace split with first child
                    if (parent) {
                        parent[key] = node.first;
                    } else {
                        return node.first; // New root
                    }

                    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.SPLIT_COLLAPSED, {
                        splitId: node.id,
                        collapsedPaneId: paneId,
                        remainingNodeId: node.first?.id,
                        portalId
                    });

                    return true;
                }

                // Recurse
                const result = findAndCollapse(node.first, node, 'first');
                if (result && typeof result === 'object') return result;
                if (result) return true;

                return findAndCollapse(node.second, node, 'second');
            }

            return false;
        }

        const result = findAndCollapse(root, null, null);
        if (typeof result === 'object') {
            return result; // New root
        }
        return null;
    }

    // Try main window
    if (!portalId) {
        const newRoot = collapseInTree(layout.root);
        if (newRoot) {
            layout.root = newRoot;
        }
    } else {
        // Try portal
        const portal = layout.portals.get(portalId);
        if (portal) {
            const newRoot = collapseInTree(portal.paneTree);
            if (newRoot) {
                portal.paneTree = newRoot;
            }
        }
    }

    // Update active pane if it was the collapsed one
    if (layout.activePaneId === paneId) {
        const allPanes = getAllPanesInLayout(layout);
        if (allPanes.length > 0) {
            layout.activePaneId = allPanes[0].id;
        }
    }
}

// ============================================================================
// PORTAL OPERATIONS
// ============================================================================

/**
 * Pop out a tab into a new window
 */
function popOutTab(state, paneId, setId, viewId) {
    const layout = state.layout;

    // Find the tab
    const result = findPaneContainingView(layout, setId, viewId);
    if (!result) return null;

    const { pane: fromPane, tabIndex, portalId: fromPortalId } = result;

    // Get view info for window title
    const set = state.sets?.get(setId);
    const view = set?.views?.get(viewId);
    const title = view ? `${view.name} - ${set.name}` : 'EO View';

    // Create portal
    const portal = createPortal({
        title,
        bounds: { x: 100, y: 100, width: 900, height: 700 }
    });

    // Move the tab to portal's pane
    const tab = fromPane.tabs[tabIndex];
    portal.paneTree.tabs = [{ ...tab }];
    portal.paneTree.activeTabIndex = 0;

    // Remove from source
    fromPane.tabs.splice(tabIndex, 1);
    if (fromPane.activeTabIndex >= fromPane.tabs.length) {
        fromPane.activeTabIndex = Math.max(0, fromPane.tabs.length - 1);
    }

    // Add to portals
    layout.portals.set(portal.id, portal);

    // Log event
    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.PORTAL_OPENED, {
        portalId: portal.id,
        setId,
        viewId,
        fromPaneId: paneId,
        bounds: portal.bounds
    });

    // If source pane is empty, collapse it
    if (fromPane.tabs.length === 0 && fromPane.id !== 'pane-main') {
        collapseEmptyPane(state, fromPane.id, fromPortalId);
    }

    // Open the actual window
    openPortalWindow(state, portal);

    return portal;
}

/**
 * Open the actual browser window for a portal
 */
function openPortalWindow(state, portal) {
    const { bounds } = portal;
    const features = `width=${bounds.width},height=${bounds.height},left=${bounds.x},top=${bounds.y},menubar=no,toolbar=no,location=no,status=no,resizable=yes`;

    // Create a minimal HTML for the portal
    const portalWindow = window.open('', `portal_${portal.id}`, features);

    if (!portalWindow) {
        console.warn('Popup blocked. Please allow popups for this site.');
        return null;
    }

    portal.windowRef = portalWindow;
    portal.isConnected = true;

    // Write the portal HTML
    writePortalDocument(state, portal);

    // Set up communication
    setupPortalCommunication(state, portal);

    return portalWindow;
}

/**
 * Write the HTML document for a portal window
 */
function writePortalDocument(state, portal) {
    const portalWindow = portal.windowRef;
    if (!portalWindow) return;

    const tab = portal.paneTree.tabs[0];
    const set = state.sets?.get(tab?.setId);
    const view = set?.views?.get(tab?.viewId);
    const title = view ? `${view.name} - ${set.name}` : 'EO View';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="icon" type="image/svg+xml" href="${window.location.origin}/assets/eo-icons/eo-bracket-light.svg">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    <style>
        :root {
            --primary: #111827;
            --surface: #ffffff;
            --muted-surface: #f4f5f7;
            --border: #e5e7eb;
            --text: #0b1324;
            --text-secondary: #4b5563;
        }
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            background: var(--muted-surface);
            color: var(--text);
        }
        .portal-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .portal-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 16px;
            background: var(--primary);
            color: white;
            border-bottom: 1px solid var(--border);
        }
        .portal-header-title {
            flex: 1;
            font-weight: 600;
            font-size: 14px;
        }
        .portal-header-actions {
            display: flex;
            gap: 8px;
        }
        .portal-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .portal-btn:hover {
            background: rgba(255,255,255,0.2);
        }
        .portal-content {
            flex: 1;
            overflow: auto;
            background: white;
        }
        .portal-tabs {
            display: flex;
            padding: 8px 16px;
            gap: 8px;
            background: var(--muted-surface);
            border-bottom: 1px solid var(--border);
        }
        .portal-tab {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: white;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
        }
        .portal-tab.active {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }
        .portal-view-container {
            padding: 16px;
        }
        .loading-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: var(--text-secondary);
        }
    </style>
</head>
<body>
    <div class="portal-container">
        <div class="portal-header">
            <div class="portal-header-title" id="portalTitle">${title}</div>
            <div class="portal-header-actions">
                <button class="portal-btn" onclick="window.portalBridge.dockBack()" title="Return to main window">
                    <i class="ph ph-arrow-square-in"></i>
                    Dock
                </button>
            </div>
        </div>
        <div class="portal-tabs" id="portalTabs"></div>
        <div class="portal-content">
            <div class="portal-view-container" id="portalViewContainer">
                <div class="loading-state">Loading view...</div>
            </div>
        </div>
    </div>
    <script>
        window.portalId = '${portal.id}';
        window.portalBridge = {
            ready: false,
            parentState: null,

            init() {
                // Notify parent we're ready
                window.opener?.postMessage({
                    type: 'PORTAL_READY',
                    portalId: window.portalId
                }, '*');
            },

            dockBack() {
                window.opener?.postMessage({
                    type: 'PORTAL_DOCK_BACK',
                    portalId: window.portalId
                }, '*');
            },

            handleStateUpdate(data) {
                this.parentState = data.state;
                this.ready = true;
                this.renderTabs();
                this.renderView();
            },

            renderTabs() {
                const container = document.getElementById('portalTabs');
                const pane = this.parentState?.pane;
                if (!container || !pane) return;

                container.innerHTML = pane.tabs.map((tab, i) => {
                    const isActive = i === pane.activeTabIndex;
                    const viewName = this.parentState.viewNames?.[tab.viewId] || 'View';
                    const setName = this.parentState.setNames?.[tab.setId] || 'Set';
                    return \`
                        <div class="portal-tab \${isActive ? 'active' : ''}" onclick="window.portalBridge.activateTab(\${i})">
                            <span>\${viewName}</span>
                            <span style="opacity: 0.6; font-size: 11px;">\${setName}</span>
                        </div>
                    \`;
                }).join('');
            },

            renderView() {
                const container = document.getElementById('portalViewContainer');
                if (!container) return;

                const html = this.parentState?.viewHtml || '<div class="loading-state">No view data</div>';
                container.innerHTML = html;
            },

            activateTab(index) {
                window.opener?.postMessage({
                    type: 'PORTAL_TAB_ACTIVATED',
                    portalId: window.portalId,
                    tabIndex: index
                }, '*');
            }
        };

        window.addEventListener('message', (event) => {
            if (event.source !== window.opener) return;

            switch (event.data.type) {
                case 'STATE_UPDATE':
                    window.portalBridge.handleStateUpdate(event.data);
                    break;
                case 'CLOSE_PORTAL':
                    window.close();
                    break;
            }
        });

        window.addEventListener('beforeunload', () => {
            window.opener?.postMessage({
                type: 'PORTAL_CLOSING',
                portalId: window.portalId
            }, '*');
        });

        // Initialize
        window.portalBridge.init();
    </script>
</body>
</html>
    `;

    portalWindow.document.open();
    portalWindow.document.write(html);
    portalWindow.document.close();
}

/**
 * Set up communication between main window and portal
 */
function setupPortalCommunication(state, portal) {
    const handler = (event) => {
        if (event.source !== portal.windowRef) return;

        switch (event.data.type) {
            case 'PORTAL_READY':
                sendStateToPortal(state, portal);
                break;

            case 'PORTAL_DOCK_BACK':
                dockPortalBack(state, portal.id);
                break;

            case 'PORTAL_TAB_ACTIVATED':
                activateTabInPortal(state, portal.id, event.data.tabIndex);
                break;

            case 'PORTAL_CLOSING':
                handlePortalClose(state, portal.id);
                break;
        }
    };

    window.addEventListener('message', handler);
    portal._messageHandler = handler;
}

/**
 * Send current state to a portal
 */
function sendStateToPortal(state, portal) {
    if (!portal.windowRef || portal.windowRef.closed) return;

    const pane = portal.paneTree;
    const viewNames = {};
    const setNames = {};

    pane.tabs.forEach(tab => {
        const set = state.sets?.get(tab.setId);
        const view = set?.views?.get(tab.viewId);
        viewNames[tab.viewId] = view?.name || 'View';
        setNames[tab.setId] = set?.name || 'Set';
    });

    // Get view HTML for active tab
    const activeTab = pane.tabs[pane.activeTabIndex];
    let viewHtml = '<div class="loading-state">Select a view</div>';

    if (activeTab) {
        // For now, send a placeholder. In full implementation,
        // this would render the actual view content.
        viewHtml = `
            <div style="padding: 20px;">
                <h3 style="margin: 0 0 8px 0;">${viewNames[activeTab.viewId]}</h3>
                <p style="color: #666; margin: 0;">From set: ${setNames[activeTab.setId]}</p>
                <p style="color: #999; margin-top: 16px; font-size: 13px;">
                    View content renders here. The portal receives real-time updates from the main window.
                </p>
            </div>
        `;
    }

    portal.windowRef.postMessage({
        type: 'STATE_UPDATE',
        state: {
            pane: {
                tabs: pane.tabs,
                activeTabIndex: pane.activeTabIndex
            },
            viewNames,
            setNames,
            viewHtml
        }
    }, '*');
}

/**
 * Dock a portal back to the main window
 */
function dockPortalBack(state, portalId) {
    const layout = state.layout;
    const portal = layout.portals.get(portalId);
    if (!portal) return;

    // Get tabs from portal
    const portalTabs = portal.paneTree.tabs;

    // Find active pane in main window
    const targetPane = findPaneById(layout.root, layout.activePaneId) ||
                       getAllPanes(layout.root)[0];

    if (targetPane && portalTabs.length > 0) {
        // Move tabs back to main window
        portalTabs.forEach(tab => {
            targetPane.tabs.push(tab);
        });
        targetPane.activeTabIndex = targetPane.tabs.length - 1;
    }

    // Clean up
    if (portal.windowRef && !portal.windowRef.closed) {
        portal.windowRef.close();
    }
    if (portal._messageHandler) {
        window.removeEventListener('message', portal._messageHandler);
    }

    layout.portals.delete(portalId);

    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.PORTAL_CLOSED, {
        portalId,
        dockedBack: true,
        tabCount: portalTabs.length
    });
}

/**
 * Activate a tab within a portal
 */
function activateTabInPortal(state, portalId, tabIndex) {
    const portal = state.layout.portals.get(portalId);
    if (!portal) return;

    portal.paneTree.activeTabIndex = tabIndex;
    sendStateToPortal(state, portal);
}

/**
 * Handle portal window closing
 */
function handlePortalClose(state, portalId) {
    const layout = state.layout;
    const portal = layout.portals.get(portalId);
    if (!portal) return;

    // Tabs are lost when portal closes without docking
    // Could optionally return them to main window here

    if (portal._messageHandler) {
        window.removeEventListener('message', portal._messageHandler);
    }

    layout.portals.delete(portalId);
    portal.isConnected = false;

    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.PORTAL_CLOSED, {
        portalId,
        dockedBack: false
    });
}

// ============================================================================
// PRESET OPERATIONS
// ============================================================================

/**
 * Save current layout as a preset
 */
function saveLayoutPreset(state, name) {
    const layout = state.layout;
    const preset = {
        id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        createdAt: Date.now(),
        layout: serializeLayout(layout.root)
    };

    layout.presets.set(preset.id, preset);

    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.PRESET_SAVED, {
        presetId: preset.id,
        name
    });

    return preset;
}

/**
 * Apply a layout preset
 */
function applyLayoutPreset(state, presetId) {
    const layout = state.layout;
    const preset = layout.presets.get(presetId);
    if (!preset) return false;

    // Close all portals first
    for (const [portalId, portal] of layout.portals) {
        if (portal.windowRef && !portal.windowRef.closed) {
            portal.windowRef.close();
        }
    }
    layout.portals.clear();

    // Deserialize and apply layout
    layout.root = deserializeLayout(preset.layout);

    // Find first pane to set as active
    const firstPane = getAllPanes(layout.root)[0];
    if (firstPane) {
        layout.activePaneId = firstPane.id;
    }

    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.PRESET_APPLIED, {
        presetId,
        name: preset.name
    });

    return true;
}

/**
 * Delete a layout preset
 */
function deleteLayoutPreset(state, presetId) {
    const layout = state.layout;
    const preset = layout.presets.get(presetId);
    if (!preset) return false;

    layout.presets.delete(presetId);

    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.PRESET_DELETED, {
        presetId,
        name: preset.name
    });

    return true;
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize layout tree for storage
 */
function serializeLayout(node) {
    if (!node) return null;

    if (node.type === 'pane') {
        return {
            type: 'pane',
            id: node.id,
            tabs: [...node.tabs],
            activeTabIndex: node.activeTabIndex
        };
    }

    if (node.type === 'split') {
        return {
            type: 'split',
            id: node.id,
            direction: node.direction,
            ratio: node.ratio,
            first: serializeLayout(node.first),
            second: serializeLayout(node.second)
        };
    }

    return null;
}

/**
 * Deserialize layout tree from storage
 */
function deserializeLayout(data) {
    if (!data) return createPane();

    if (data.type === 'pane') {
        return createPane({
            id: data.id,
            tabs: data.tabs || [],
            activeTabIndex: data.activeTabIndex || 0
        });
    }

    if (data.type === 'split') {
        return createSplit({
            id: data.id,
            direction: data.direction,
            ratio: data.ratio,
            first: deserializeLayout(data.first),
            second: deserializeLayout(data.second)
        });
    }

    return createPane();
}

/**
 * Serialize full layout state for persistence
 */
function serializeLayoutState(layout) {
    return {
        root: serializeLayout(layout.root),
        activePaneId: layout.activePaneId,
        preferences: { ...layout.preferences },
        presets: Array.from(layout.presets.entries()).map(([id, preset]) => ({
            id,
            name: preset.name,
            createdAt: preset.createdAt,
            layout: preset.layout
        }))
    };
}

/**
 * Deserialize full layout state from persistence
 */
function deserializeLayoutState(data) {
    const layout = createDefaultLayoutState();

    if (data.root) {
        layout.root = deserializeLayout(data.root);
    }

    if (data.activePaneId) {
        layout.activePaneId = data.activePaneId;
    }

    if (data.preferences) {
        layout.preferences = { ...layout.preferences, ...data.preferences };
    }

    if (data.presets) {
        data.presets.forEach(preset => {
            layout.presets.set(preset.id, preset);
        });
    }

    return layout;
}

// ============================================================================
// EVENT STREAM INTEGRATION
// ============================================================================

/**
 * Emit a layout event to the activity stream
 */
function emitLayoutEvent(state, eventType, payload) {
    if (!state.eventStream) {
        state.eventStream = [];
    }

    const event = {
        id: state.eventIdCounter || 1,
        timestamp: Date.now(),
        user: state.currentUser || 'system',
        type: eventType,
        entityType: 'Layout',
        data: payload
    };

    state.eventStream.push(event);
    state.eventIdCounter = (state.eventIdCounter || 1) + 1;

    return event;
}

/**
 * Reconstruct layout from event stream for a specific user
 */
function reconstructLayoutFromEvents(eventStream, userId) {
    let layout = createDefaultLayoutState();

    for (const event of eventStream) {
        if (event.user !== userId) continue;
        if (!event.type?.startsWith('LAYOUT_')) continue;

        layout = applyLayoutEvent(layout, event);
    }

    return layout;
}

/**
 * Apply a single layout event to reconstruct state
 */
function applyLayoutEvent(layout, event) {
    const { type, data } = event;

    switch (type) {
        case LAYOUT_EVENT_TYPES.SPLIT_CREATED:
            // Would need full state to properly replay
            break;

        case LAYOUT_EVENT_TYPES.SPLIT_RESIZED:
            // Find split and update ratio
            break;

        case LAYOUT_EVENT_TYPES.PRESET_SAVED:
            if (data.presetId && data.serializedLayout) {
                layout.presets.set(data.presetId, {
                    id: data.presetId,
                    name: data.name,
                    layout: data.serializedLayout
                });
            }
            break;

        case LAYOUT_EVENT_TYPES.PRESET_DELETED:
            layout.presets.delete(data.presetId);
            break;
    }

    return layout;
}

// ============================================================================
// FOCUS MANAGEMENT
// ============================================================================

/**
 * Focus a specific pane
 */
function focusPane(state, paneId) {
    const layout = state.layout;
    const result = findPaneInLayout(layout, paneId);
    if (!result) return false;

    layout.activePaneId = paneId;
    layout.activePortalId = result.portalId;

    emitLayoutEvent(state, LAYOUT_EVENT_TYPES.PANE_FOCUSED, {
        paneId,
        portalId: result.portalId
    });

    return true;
}

/**
 * Get the currently active pane
 */
function getActivePane(layout) {
    const result = findPaneInLayout(layout, layout.activePaneId);
    return result?.pane || null;
}

/**
 * Get the currently active tab
 */
function getActiveTab(layout) {
    const pane = getActivePane(layout);
    if (!pane || pane.tabs.length === 0) return null;
    return pane.tabs[pane.activeTabIndex] || null;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.EOLayout = {
        // Models
        createPane,
        createSplit,
        createPortal,
        createDefaultLayoutState,

        // Event types
        LAYOUT_EVENT_TYPES,

        // Initialization
        initializeLayout,

        // Pane operations
        findPaneById,
        findPaneInLayout,
        findPaneContainingView,
        getAllPanes,
        getAllPanesInLayout,
        focusPane,
        getActivePane,
        getActiveTab,

        // Tab operations
        openTabInPane,
        closeTabInPane,
        moveTabToPane,
        activateTab,

        // Split operations
        splitPane,
        resizeSplit,
        collapseEmptyPane,

        // Portal operations
        popOutTab,
        openPortalWindow,
        dockPortalBack,
        sendStateToPortal,

        // Preset operations
        saveLayoutPreset,
        applyLayoutPreset,
        deleteLayoutPreset,

        // Serialization
        serializeLayout,
        deserializeLayout,
        serializeLayoutState,
        deserializeLayoutState,

        // Event stream
        emitLayoutEvent,
        reconstructLayoutFromEvents
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createPane,
        createSplit,
        createPortal,
        createDefaultLayoutState,
        LAYOUT_EVENT_TYPES,
        initializeLayout,
        findPaneById,
        findPaneInLayout,
        findPaneContainingView,
        getAllPanes,
        getAllPanesInLayout,
        focusPane,
        getActivePane,
        getActiveTab,
        openTabInPane,
        closeTabInPane,
        moveTabToPane,
        activateTab,
        splitPane,
        resizeSplit,
        collapseEmptyPane,
        popOutTab,
        openPortalWindow,
        dockPortalBack,
        sendStateToPortal,
        saveLayoutPreset,
        applyLayoutPreset,
        deleteLayoutPreset,
        serializeLayout,
        deserializeLayout,
        serializeLayoutState,
        deserializeLayoutState,
        emitLayoutEvent,
        reconstructLayoutFromEvents
    };
}
