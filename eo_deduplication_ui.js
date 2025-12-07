/**
 * EO Deduplication UI Component
 *
 * Provides UI rendering for deduplication statistics in:
 * - Import preview modal
 * - View drill-down panels
 * - Global storage overview
 */

const EODeduplicationUI = (function() {
    'use strict';

    /**
     * Render deduplication stats panel for an import
     * @param {string} importId - Import identifier
     * @returns {string} HTML string for the panel
     */
    function renderImportStorageTab(importId) {
        if (typeof EOContentStore === 'undefined') {
            return renderNoContentStoreMessage();
        }

        const stats = EOContentStore.getImportStats(importId);
        if (!stats) {
            return renderNoStatsMessage();
        }

        const summary = EOContentStore.getImportSummary(importId);

        return `
            <div style="padding: 20px;">
                <!-- Storage Efficiency Overview -->
                <div style="display: flex; align-items: center; gap: 40px; padding: 20px; background: var(--muted-surface); border-radius: 8px; margin-bottom: 20px;">
                    ${renderCompressionGauge(stats.compressionRatio)}
                    <div style="display: flex; gap: 32px;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${summary.storageUsed}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">Actual Storage</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 700; color: #6366f1;">${summary.storageSaved}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">Space Saved</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 700;">${summary.compressionRatio}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">Compression</div>
                        </div>
                    </div>
                </div>

                <!-- Record Breakdown -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    ${renderStatCard('Total Records', stats.totalRecords, 'ph-rows', '#64748b')}
                    ${renderStatCard('Unique Content', stats.uniqueContents, 'ph-fingerprint', '#22c55e')}
                    ${renderStatCard('Exact Duplicates', stats.duplicateRecords, 'ph-copy', '#f59e0b')}
                    ${renderStatCard('Delta Encoded', stats.deltaRecords, 'ph-git-diff', '#6366f1')}
                </div>

                <!-- Detailed Breakdown -->
                <div style="background: var(--muted-surface); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                        <i class="ph ph-chart-pie" style="color: #6366f1;"></i>
                        Storage Breakdown
                    </h4>
                    ${renderStorageBreakdown(stats)}
                </div>

                <!-- Field-Level Deduplication -->
                ${stats.fieldDedup && Object.keys(stats.fieldDedup).length > 0 ? `
                    <div style="background: var(--muted-surface); border-radius: 8px; padding: 16px;">
                        <h4 style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                            <i class="ph ph-columns" style="color: #22c55e;"></i>
                            Field-Level Analysis
                        </h4>
                        ${renderFieldDeduplicationTable(stats.fieldDedup)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render compression gauge visualization
     */
    function renderCompressionGauge(ratio) {
        const numRatio = parseFloat(ratio) || 0;
        const color = numRatio > 30 ? '#22c55e' : numRatio > 10 ? '#f59e0b' : '#64748b';

        return `
            <div style="text-align: center;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: conic-gradient(${color} ${numRatio * 3.6}deg, var(--border) ${numRatio * 3.6}deg); display: flex; align-items: center; justify-content: center; position: relative;">
                    <div style="width: 60px; height: 60px; background: var(--surface); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: ${color};">${numRatio}%</div>
                </div>
                <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">Space Saved</div>
            </div>
        `;
    }

    /**
     * Render a stat card
     */
    function renderStatCard(label, value, icon, color) {
        return `
            <div style="padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; text-align: center;">
                <i class="ph ${icon}" style="font-size: 24px; color: ${color}; margin-bottom: 8px; display: block;"></i>
                <div style="font-size: 28px; font-weight: 700; color: ${color};">${value}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${label}</div>
            </div>
        `;
    }

    /**
     * Render storage breakdown visualization
     */
    function renderStorageBreakdown(stats) {
        const total = stats.totalRecords;
        if (total === 0) return '<div style="color: var(--text-secondary); font-size: 12px;">No records to analyze</div>';

        const uniquePct = ((stats.totalRecords - stats.duplicateRecords - stats.deltaRecords) / total * 100).toFixed(1);
        const dupPct = (stats.duplicateRecords / total * 100).toFixed(1);
        const deltaPct = (stats.deltaRecords / total * 100).toFixed(1);

        return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; height: 24px; border-radius: 6px; overflow: hidden;">
                    <div style="width: ${uniquePct}%; background: #22c55e;" title="Unique: ${uniquePct}%"></div>
                    <div style="width: ${dupPct}%; background: #f59e0b;" title="Duplicates: ${dupPct}%"></div>
                    <div style="width: ${deltaPct}%; background: #6366f1;" title="Delta: ${deltaPct}%"></div>
                </div>
            </div>
            <div style="display: flex; gap: 20px; font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; background: #22c55e; border-radius: 2px;"></span>
                    <span>Unique (${uniquePct}%)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; background: #f59e0b; border-radius: 2px;"></span>
                    <span>Duplicates (${dupPct}%)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; background: #6366f1; border-radius: 2px;"></span>
                    <span>Delta Encoded (${deltaPct}%)</span>
                </div>
            </div>
            <div style="margin-top: 16px; padding: 12px; background: var(--surface); border-radius: 6px; font-size: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div><span style="color: var(--text-secondary);">Raw Size:</span> <strong>${EOContentStore.formatBytes(stats.rawBytes)}</strong></div>
                    <div><span style="color: var(--text-secondary);">Actual Size:</span> <strong>${EOContentStore.formatBytes(stats.actualBytes)}</strong></div>
                    <div><span style="color: var(--text-secondary);">Saved:</span> <strong style="color: #22c55e;">${EOContentStore.formatBytes(stats.savedBytes)}</strong></div>
                    <div><span style="color: var(--text-secondary);">Efficiency:</span> <strong>${stats.compressionRatio}%</strong></div>
                </div>
            </div>
        `;
    }

    /**
     * Render field-level deduplication table
     */
    function renderFieldDeduplicationTable(fieldDedup) {
        const fields = Object.entries(fieldDedup)
            .sort((a, b) => parseFloat(b[1].deduplicationRatio) - parseFloat(a[1].deduplicationRatio));

        return `
            <div style="overflow: auto; max-height: 300px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: var(--surface); position: sticky; top: 0;">
                            <th style="padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 1px solid var(--border);">Field</th>
                            <th style="padding: 10px 12px; text-align: right; font-weight: 600; border-bottom: 1px solid var(--border);">Total</th>
                            <th style="padding: 10px 12px; text-align: right; font-weight: 600; border-bottom: 1px solid var(--border);">Unique</th>
                            <th style="padding: 10px 12px; text-align: right; font-weight: 600; border-bottom: 1px solid var(--border);">Dupes</th>
                            <th style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 1px solid var(--border);">Dedup %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fields.map(([fieldName, data]) => {
                            const dedupRatio = parseFloat(data.deduplicationRatio) || 0;
                            const barColor = dedupRatio > 50 ? '#22c55e' : dedupRatio > 20 ? '#f59e0b' : '#64748b';
                            return `
                                <tr>
                                    <td style="padding: 8px 12px; border-bottom: 1px solid var(--border);">
                                        <code style="padding: 2px 6px; font-size: 11px; background: var(--surface); border-radius: 4px;">${fieldName}</code>
                                    </td>
                                    <td style="padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: right;">${data.totalValues}</td>
                                    <td style="padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: right;">${data.uniqueValues}</td>
                                    <td style="padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: right;">${data.duplicateValues}</td>
                                    <td style="padding: 8px 12px; border-bottom: 1px solid var(--border);">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                                                <div style="height: 100%; width: ${dedupRatio}%; background: ${barColor}; border-radius: 3px;"></div>
                                            </div>
                                            <span style="width: 40px; text-align: right; font-weight: 500;">${dedupRatio}%</span>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Render compact storage badge for import cards
     */
    function renderStorageBadge(importId) {
        if (typeof EOContentStore === 'undefined') return '';

        const stats = EOContentStore.getImportStats(importId);
        if (!stats) return '';

        const ratio = parseFloat(stats.compressionRatio) || 0;
        if (ratio < 5) return ''; // Don't show badge if minimal savings

        const color = ratio > 30 ? '#22c55e' : ratio > 10 ? '#f59e0b' : '#64748b';

        return `
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: 10px; font-weight: 600; background: ${color}15; color: ${color}; border-radius: 10px;" title="Storage optimized: ${ratio}% space saved">
                <i class="ph ph-hard-drives" style="font-size: 12px;"></i>
                -${ratio}%
            </span>
        `;
    }

    /**
     * Render global storage overview panel
     */
    function renderGlobalStoragePanel() {
        if (typeof EOContentStore === 'undefined') {
            return renderNoContentStoreMessage();
        }

        const globalStats = EOContentStore.getGlobalStats();
        const crossDupes = EOContentStore.findCrossImportDuplicates();

        return `
            <div style="padding: 20px;">
                <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    <i class="ph ph-hard-drives" style="color: #6366f1;"></i>
                    Global Storage Statistics
                </h3>

                <!-- Overview Stats -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px;">
                    ${renderStatCard('Total Records', globalStats.totalRecords, 'ph-rows', '#64748b')}
                    ${renderStatCard('Unique Content', globalStats.uniqueContents, 'ph-fingerprint', '#22c55e')}
                    ${renderStatCard('Duplicates', globalStats.totalDuplicates, 'ph-copy', '#f59e0b')}
                    ${renderStatCard('Delta Encoded', globalStats.totalDeltas, 'ph-git-diff', '#6366f1')}
                </div>

                <!-- Storage Metrics -->
                <div style="background: var(--muted-surface); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600;">Storage Efficiency</h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
                        <div>
                            <div style="font-size: 24px; font-weight: 700;">${EOContentStore.formatBytes(globalStats.totalRawBytes)}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">Raw Size</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${EOContentStore.formatBytes(globalStats.totalActualBytes)}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">Actual Size</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: 700; color: #6366f1;">${globalStats.overallCompressionRatio}%</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">Space Saved</div>
                        </div>
                    </div>
                </div>

                ${crossDupes.length > 0 ? `
                    <!-- Cross-Import Duplicates -->
                    <div style="background: var(--muted-surface); border-radius: 8px; padding: 16px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                            <i class="ph ph-intersect" style="color: #f59e0b;"></i>
                            Cross-Import Duplicates (${crossDupes.length})
                        </h4>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
                            Records that appear in multiple imports (data stored only once)
                        </div>
                        <div style="max-height: 200px; overflow: auto;">
                            ${crossDupes.slice(0, 10).map(d => `
                                <div style="padding: 8px 12px; background: var(--surface); border-radius: 6px; margin-bottom: 6px; font-size: 12px;">
                                    <span style="font-weight: 500;">${d.count} records</span>
                                    <span style="color: var(--text-secondary);"> across ${d.importIds.length} imports</span>
                                </div>
                            `).join('')}
                            ${crossDupes.length > 10 ? `<div style="text-align: center; font-size: 11px; color: var(--text-secondary); padding: 8px;">...and ${crossDupes.length - 10} more</div>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render compact view storage info
     */
    function renderViewStorageInfo(viewId, importIntegration) {
        if (!importIntegration) return '';

        const stats = importIntegration.getViewDeduplicationStats(viewId);
        if (!stats) return '';

        const ratio = parseFloat(stats.compressionRatio) || 0;
        if (ratio < 1) return '';

        return `
            <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--muted-surface); border-radius: 6px; font-size: 11px;">
                <i class="ph ph-hard-drives" style="color: #6366f1;"></i>
                <span><strong>${ratio}%</strong> storage optimized</span>
                <span style="color: var(--text-secondary);">|</span>
                <span>${stats.duplicateRecords} duplicates</span>
                <span style="color: var(--text-secondary);">|</span>
                <span>${stats.deltaRecords} deltas</span>
            </div>
        `;
    }

    /**
     * Render no content store message
     */
    function renderNoContentStoreMessage() {
        return `
            <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
                <i class="ph ph-hard-drives" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px; display: block;"></i>
                <div style="font-size: 14px; margin-bottom: 8px;">Content Store Not Available</div>
                <div style="font-size: 12px;">Deduplication features require the EOContentStore module.</div>
            </div>
        `;
    }

    /**
     * Render no stats message
     */
    function renderNoStatsMessage() {
        return `
            <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
                <i class="ph ph-chart-bar" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px; display: block;"></i>
                <div style="font-size: 14px; margin-bottom: 8px;">No Storage Statistics</div>
                <div style="font-size: 12px;">This import hasn't been processed yet. Add it to a set to see storage optimization.</div>
            </div>
        `;
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    return {
        renderImportStorageTab,
        renderStorageBadge,
        renderGlobalStoragePanel,
        renderViewStorageInfo,
        renderCompressionGauge,
        renderStatCard,
        renderStorageBreakdown,
        renderFieldDeduplicationTable
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EODeduplicationUI;
}
