#!/usr/bin/env node

/**
 * Sync Handbook Linter
 * Static analysis to detect potential sync rule violations
 *
 * Usage:
 *   node scripts/sync-lint.js [files...]
 *   node scripts/sync-lint.js --all
 *   node scripts/sync-lint.js --staged
 *
 * Exit codes:
 *   0 - No violations
 *   1 - Violations found
 *   2 - Error running linter
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Files to always skip
    skipFiles: [
        'node_modules',
        '.git',
        'dist',
        'build',
        'coverage',
        'sync-lint.js'  // Don't lint self
    ],

    // File extensions to check
    extensions: ['.js', '.ts', '.jsx', '.tsx'],

    // Output format
    format: 'pretty',  // 'pretty' | 'json' | 'github'
};

// ============================================================================
// VIOLATION PATTERNS
// ============================================================================

const PATTERNS = [
    // ========================================================================
    // AXIOM 0: Log Primacy
    // ========================================================================
    {
        id: 'AXIOM_0_DIRECT_MUTATION',
        rule: 'Axiom 0',
        pattern: /\.(set|delete|clear)\s*\(/g,
        context: /(?:state|records|views|sets)\./,
        message: 'Direct mutation of state detected. Use eventLog.append() instead.',
        severity: 'error',
        suggestion: 'eventLog.append({ payload: { action: "...", ... } })'
    },
    {
        id: 'AXIOM_0_SPLICE',
        rule: 'Axiom 0',
        pattern: /\.splice\s*\([^)]*,\s*[1-9]/g,
        message: 'Array.splice() removing elements. Use tombstone pattern.',
        severity: 'error'
    },
    {
        id: 'AXIOM_0_DELETE_OPERATOR',
        rule: 'Axiom 0',
        pattern: /delete\s+\w+\[/g,
        message: 'Delete operator used. Use tombstone events instead.',
        severity: 'error'
    },

    // ========================================================================
    // RULE 1: Origin
    // ========================================================================
    {
        id: 'RULE_1_MISSING_ACTOR',
        rule: 'Rule 1',
        pattern: /append\s*\(\s*\{[^}]*\}/g,
        antiPattern: /actor\s*:/,
        message: 'Event append without actor field.',
        severity: 'error'
    },
    {
        id: 'RULE_1_SYSTEM_ACTOR',
        rule: 'Rule 1',
        pattern: /actor\s*:\s*['"]system['"]/g,
        context: /action\s*:\s*['"](cell|record|user|edit|create|update)/,
        message: 'User action has actor: "system". Use actual user ID.',
        severity: 'warning'
    },

    // ========================================================================
    // RULE 2: Identity
    // ========================================================================
    {
        id: 'RULE_2_ACTOR_OVERWRITE',
        rule: 'Rule 2',
        pattern: /\.actor\s*=\s*['"][^'"]+['"]/g,
        message: 'Actor being overwritten. This may launder identity.',
        severity: 'error'
    },
    {
        id: 'RULE_2_SPREAD_WITHOUT_ACTOR',
        rule: 'Rule 2',
        pattern: /\{\s*\.\.\.event[^}]*actor\s*:/g,
        message: 'Spreading event and overwriting actor. Preserve original.',
        severity: 'warning'
    },

    // ========================================================================
    // RULE 3: Offline
    // ========================================================================
    {
        id: 'RULE_3_BLOCKING_FETCH',
        rule: 'Rule 3',
        pattern: /await\s+fetch\s*\([^)]*\/(save|sync|update|create)/g,
        message: 'Sync operation blocks on network. Use local-first pattern.',
        severity: 'warning',
        suggestion: 'Save to local event log first, sync asynchronously'
    },
    {
        id: 'RULE_3_SYNC_REQUIRED',
        rule: 'Rule 3',
        pattern: /if\s*\(\s*!navigator\.onLine\s*\)\s*(return|throw)/g,
        message: 'Operation fails when offline. Should work offline first.',
        severity: 'warning'
    },

    // ========================================================================
    // RULE 4: Concurrency
    // ========================================================================
    {
        id: 'RULE_4_SILENT_LWW',
        rule: 'Rule 4',
        pattern: /timestamp\s*>\s*.*\?\s*\w+\s*:\s*\w+/g,
        message: 'Last-write-wins without conflict detection. Record conflicts.',
        severity: 'warning'
    },
    {
        id: 'RULE_4_MEANT_NO_PROVENANCE',
        rule: 'Rule 4',
        pattern: /type\s*:\s*['"]meant['"]/g,
        antiPattern: /provenance\s*:/,
        message: 'Meant event without provenance. Add source event IDs.',
        severity: 'error'
    },

    // ========================================================================
    // RULE 5: Derived State
    // ========================================================================
    {
        id: 'RULE_5_AUTHORITATIVE_STATE',
        rule: 'Rule 5',
        pattern: /_authoritative\s*[:=]\s*true/g,
        message: 'State marked as authoritative. State should be derived.',
        severity: 'warning'
    },

    // ========================================================================
    // RULE 6: Operations
    // ========================================================================
    {
        id: 'RULE_6_STATE_SYNC',
        rule: 'Rule 6',
        pattern: /sync.*state|state.*sync/gi,
        context: /send|transmit|upload/i,
        message: 'State-based sync detected. Sync events, not state.',
        severity: 'warning'
    },
    {
        id: 'RULE_6_SNAPSHOT_SYNC',
        rule: 'Rule 6',
        pattern: /snapshot|fullState|currentState/g,
        context: /sync|send|upload/i,
        message: 'Snapshot sync detected. Transmit events instead.',
        severity: 'warning'
    },

    // ========================================================================
    // RULE 7: Failure
    // ========================================================================
    {
        id: 'RULE_7_CATCH_NO_RECORD',
        rule: 'Rule 7',
        pattern: /catch\s*\([^)]*\)\s*\{[^}]*console\.(error|warn)/g,
        antiPattern: /eventLog|append|record.*fail/,
        message: 'Catching error without recording. Record failures as events.',
        severity: 'warning'
    },

    // ========================================================================
    // RULE 9: Deletion
    // ========================================================================
    {
        id: 'RULE_9_TRUE_DELETE',
        rule: 'Rule 9',
        pattern: /\.filter\s*\([^)]*!==|\.filter\s*\([^)]*\.id\s*!==/g,
        message: 'Filtering out items (deletion). Use tombstone pattern.',
        severity: 'warning'
    },
    {
        id: 'RULE_9_REMOVE_FROM_MAP',
        rule: 'Rule 9',
        pattern: /\.delete\s*\(\s*['"]?[\w]+['"]?\s*\)/g,
        context: /events|records|log/i,
        message: 'Removing from collection. Use tombstone instead.',
        severity: 'error'
    }
];

// ============================================================================
// LINTER IMPLEMENTATION
// ============================================================================

class SyncLinter {
    constructor() {
        this.violations = [];
        this.filesChecked = 0;
    }

    /**
     * Lint a single file
     */
    lintFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            this.filesChecked++;

            for (const pattern of PATTERNS) {
                this.checkPattern(filePath, content, lines, pattern);
            }
        } catch (err) {
            console.error(`Error reading ${filePath}: ${err.message}`);
        }
    }

    /**
     * Check a single pattern against file content
     */
    checkPattern(filePath, content, lines, pattern) {
        const matches = content.matchAll(pattern.pattern);

        for (const match of matches) {
            const position = match.index;
            const lineNumber = content.substring(0, position).split('\n').length;
            const lineContent = lines[lineNumber - 1];

            // Check context if specified
            if (pattern.context && !pattern.context.test(lineContent)) {
                continue;
            }

            // Check anti-pattern (should NOT match)
            if (pattern.antiPattern) {
                // Look at surrounding context (100 chars before and after)
                const start = Math.max(0, position - 100);
                const end = Math.min(content.length, position + 100);
                const context = content.substring(start, end);

                if (pattern.antiPattern.test(context)) {
                    continue;  // Anti-pattern found, skip this violation
                }
            }

            this.violations.push({
                file: filePath,
                line: lineNumber,
                column: position - content.lastIndexOf('\n', position),
                rule: pattern.rule,
                id: pattern.id,
                message: pattern.message,
                severity: pattern.severity,
                suggestion: pattern.suggestion,
                code: lineContent.trim()
            });
        }
    }

    /**
     * Get all JS files in directory
     */
    getFiles(dir, files = []) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (CONFIG.skipFiles.some(skip => fullPath.includes(skip))) {
                continue;
            }

            if (entry.isDirectory()) {
                this.getFiles(fullPath, files);
            } else if (CONFIG.extensions.some(ext => entry.name.endsWith(ext))) {
                files.push(fullPath);
            }
        }

        return files;
    }

    /**
     * Get staged files from git
     */
    getStagedFiles() {
        try {
            const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
                encoding: 'utf8'
            });
            return output.split('\n')
                .filter(f => f.trim())
                .filter(f => CONFIG.extensions.some(ext => f.endsWith(ext)));
        } catch (err) {
            console.error('Error getting staged files:', err.message);
            return [];
        }
    }

    /**
     * Format output
     */
    formatOutput() {
        if (this.violations.length === 0) {
            return {
                text: `\n✓ No sync violations found (${this.filesChecked} files checked)\n`,
                exitCode: 0
            };
        }

        let output = '';
        const grouped = {};

        // Group by file
        for (const v of this.violations) {
            if (!grouped[v.file]) grouped[v.file] = [];
            grouped[v.file].push(v);
        }

        switch (CONFIG.format) {
            case 'json':
                output = JSON.stringify({ violations: this.violations }, null, 2);
                break;

            case 'github':
                // GitHub Actions annotation format
                for (const v of this.violations) {
                    const level = v.severity === 'error' ? 'error' : 'warning';
                    output += `::${level} file=${v.file},line=${v.line}::${v.rule}: ${v.message}\n`;
                }
                break;

            case 'pretty':
            default:
                output = '\n══════════════════════════════════════════════════════════════\n';
                output += '                    SYNC HANDBOOK LINT RESULTS\n';
                output += '══════════════════════════════════════════════════════════════\n\n';

                for (const [file, violations] of Object.entries(grouped)) {
                    output += `📁 ${file}\n`;
                    for (const v of violations) {
                        const icon = v.severity === 'error' ? '❌' : '⚠️';
                        output += `   ${icon} Line ${v.line}: [${v.rule}] ${v.message}\n`;
                        output += `      ${v.code}\n`;
                        if (v.suggestion) {
                            output += `      💡 ${v.suggestion}\n`;
                        }
                        output += '\n';
                    }
                }

                const errors = this.violations.filter(v => v.severity === 'error').length;
                const warnings = this.violations.filter(v => v.severity === 'warning').length;

                output += '──────────────────────────────────────────────────────────────\n';
                output += `Summary: ${errors} errors, ${warnings} warnings in ${this.filesChecked} files\n`;
                output += '══════════════════════════════════════════════════════════════\n';
                break;
        }

        const hasErrors = this.violations.some(v => v.severity === 'error');
        return {
            text: output,
            exitCode: hasErrors ? 1 : 0
        };
    }
}

// ============================================================================
// CLI
// ============================================================================

function main() {
    const args = process.argv.slice(2);
    const linter = new SyncLinter();

    // Parse arguments
    if (args.includes('--json')) {
        CONFIG.format = 'json';
    }
    if (args.includes('--github')) {
        CONFIG.format = 'github';
    }

    let files = [];

    if (args.includes('--all')) {
        files = linter.getFiles(process.cwd());
    } else if (args.includes('--staged')) {
        files = linter.getStagedFiles();
    } else if (args.length > 0) {
        files = args.filter(a => !a.startsWith('--'));
    } else {
        // Default: lint all JS files
        files = linter.getFiles(process.cwd());
    }

    if (files.length === 0) {
        console.log('No files to check');
        process.exit(0);
    }

    // Run linter
    for (const file of files) {
        if (fs.existsSync(file)) {
            linter.lintFile(file);
        }
    }

    // Output results
    const result = linter.formatOutput();
    console.log(result.text);
    process.exit(result.exitCode);
}

// Export for testing
module.exports = { SyncLinter, PATTERNS };

// Run if called directly
if (require.main === module) {
    main();
}
