/**
 * EO Data Maturity System
 *
 * Calculates the "maturity" of data as it moves through its lifecycle.
 * This is an internal framework - users never see these terms, only the visual manifestation.
 *
 * The journey:
 * - Emanon (raw): Just imported, possibly test data, formatting errors, standalone
 * - Protogon (forming): Cleaned, types resolved, linked, part of a workspace
 * - Holon (whole): Trusted, complete, ready for export, imbued with meaning
 *
 * The UX shows this through visual treatment, not labels.
 */

class EODataMaturity {

  /**
   * Maturity stages (internal only, never shown to users)
   */
  static STAGES = {
    EMANON: 'emanon',     // Raw, uncertain, unverified
    PROTOGON: 'protogon', // Forming, connected, organized
    HOLON: 'holon'        // Whole, trusted, ready
  };

  /**
   * Readiness aspects that contribute to maturity
   * Each aspect can be: pending, partial, complete
   */
  static ASPECTS = {
    USED: 'used',           // Is it used in a workspace?
    TYPED: 'typed',         // Are types confirmed/resolved?
    DEDUPED: 'deduped',     // Has deduplication been handled?
    LINKED: 'linked',       // Are relationships established?
    QUALITY: 'quality',     // Does it meet quality thresholds?
    VALIDATED: 'validated'  // Has user explicitly validated/reviewed?
  };

  /**
   * Calculate maturity for an import
   * Returns a maturity object with stage, aspects, score, and hints
   */
  static calculateImportMaturity(imp, context = {}) {
    const aspects = {};
    const hints = [];

    // USED: Is the import used in any workspace?
    const usageCount = imp.usedIn ? imp.usedIn.length : 0;
    if (usageCount === 0) {
      aspects.used = 'pending';
      hints.push({
        type: 'action',
        text: 'Drag to a workspace to start using this data',
        priority: 1
      });
    } else {
      aspects.used = 'complete';
    }

    // TYPED: Are types resolved without conflicts?
    const typeAssessment = imp.schema?.typeAssessment;
    if (typeAssessment) {
      const uncertainFields = typeAssessment.fieldsNeedingReview?.length || 0;
      const lowConfidenceTypes = Object.values(typeAssessment.assessments || {})
        .filter(a => a.confidence === 'low' || a.confidence === 'uncertain').length;

      if (uncertainFields > 0 || lowConfidenceTypes > 2) {
        aspects.typed = 'partial';
        hints.push({
          type: 'review',
          text: `${uncertainFields || lowConfidenceTypes} field types need review`,
          priority: 2
        });
      } else if (lowConfidenceTypes > 0) {
        aspects.typed = 'partial';
      } else {
        aspects.typed = 'complete';
      }
    } else {
      aspects.typed = 'pending';
    }

    // DEDUPED: Has deduplication been handled?
    const backgroundProcessing = imp.backgroundProcessing;
    if (backgroundProcessing?.dedupStatus === 'completed') {
      const duplicateCount = imp.duplicateGroups?.length || 0;
      if (duplicateCount > 0 && !imp.deduplicationHandled) {
        aspects.deduped = 'partial';
        hints.push({
          type: 'attention',
          text: `${duplicateCount} duplicate groups found`,
          priority: 2
        });
      } else {
        aspects.deduped = 'complete';
      }
    } else if (backgroundProcessing?.dedupStatus === 'running') {
      aspects.deduped = 'pending';
    } else {
      // No dedup needed or not started
      aspects.deduped = imp.rowCount > 10 ? 'pending' : 'complete';
    }

    // LINKED: Are there relationships to other data?
    const foreignKeyHints = imp.schema?.foreignKeyHints || [];
    const establishedLinks = context.establishedLinks || [];

    if (foreignKeyHints.length > 0) {
      const linksEstablished = establishedLinks.filter(l =>
        l.fromImportId === imp.id || l.toImportId === imp.id
      ).length;

      if (linksEstablished >= foreignKeyHints.length) {
        aspects.linked = 'complete';
      } else if (linksEstablished > 0) {
        aspects.linked = 'partial';
        hints.push({
          type: 'opportunity',
          text: `${foreignKeyHints.length - linksEstablished} potential relationships detected`,
          priority: 3
        });
      } else {
        aspects.linked = 'pending';
        hints.push({
          type: 'opportunity',
          text: `${foreignKeyHints.length} potential relationship${foreignKeyHints.length > 1 ? 's' : ''} detected`,
          priority: 3
        });
      }
    } else {
      // No foreign keys detected - standalone data is fine
      aspects.linked = 'complete';
    }

    // QUALITY: Does it meet quality thresholds?
    const qualityScore = imp.quality?.score || 0;
    if (qualityScore >= 85) {
      aspects.quality = 'complete';
    } else if (qualityScore >= 60) {
      aspects.quality = 'partial';
      if (qualityScore < 75) {
        hints.push({
          type: 'info',
          text: `Quality score: ${qualityScore}%`,
          priority: 4
        });
      }
    } else {
      aspects.quality = 'pending';
      hints.push({
        type: 'warning',
        text: `Low data quality (${qualityScore}%) - review for issues`,
        priority: 1
      });
    }

    // VALIDATED: Has user explicitly reviewed this data?
    // This is set when user views details/preview and makes choices
    if (imp.userValidated || imp.reviewedAt) {
      aspects.validated = 'complete';
    } else if (usageCount > 0) {
      aspects.validated = 'partial'; // Implicit validation through use
    } else {
      aspects.validated = 'pending';
    }

    // Calculate overall stage based on aspects
    const stage = this.determineStage(aspects);

    // Calculate readiness score (0-100)
    const score = this.calculateScore(aspects);

    // Sort hints by priority
    hints.sort((a, b) => a.priority - b.priority);

    return {
      stage,
      aspects,
      score,
      hints: hints.slice(0, 3), // Top 3 hints only
      summary: this.getStageSummary(stage, aspects)
    };
  }

  /**
   * Calculate maturity for a workspace/set
   */
  static calculateSetMaturity(set, imports = [], context = {}) {
    const aspects = {};
    const hints = [];

    // Find all source imports for this set
    const sourceImports = imports.filter(imp =>
      imp.usedIn?.some(u => u.type === 'set' && u.id === set.id)
    );

    const recordCount = set.records ? set.records.size : 0;
    const viewCount = set.views ? set.views.length : 0;

    // Has data?
    if (sourceImports.length === 0) {
      aspects.populated = 'pending';
      hints.push({
        type: 'action',
        text: 'Add data files to this workspace',
        priority: 1
      });
    } else {
      aspects.populated = 'complete';
    }

    // Are source imports healthy?
    const importMaturities = sourceImports.map(imp =>
      this.calculateImportMaturity(imp, context)
    );

    const avgImportScore = importMaturities.length > 0
      ? importMaturities.reduce((sum, m) => sum + m.score, 0) / importMaturities.length
      : 0;

    if (avgImportScore >= 80) {
      aspects.sourcesHealthy = 'complete';
    } else if (avgImportScore >= 50) {
      aspects.sourcesHealthy = 'partial';
      const weakSources = importMaturities.filter(m => m.score < 60).length;
      if (weakSources > 0) {
        hints.push({
          type: 'review',
          text: `${weakSources} data source${weakSources > 1 ? 's need' : ' needs'} attention`,
          priority: 2
        });
      }
    } else {
      aspects.sourcesHealthy = 'pending';
    }

    // Deduplication handled?
    const dedupMode = set.deduplicationMode || 'hide';
    const hasDuplicates = set.duplicateGroups?.length > 0;

    if (!hasDuplicates) {
      aspects.deduped = 'complete';
    } else if (dedupMode !== 'show') {
      aspects.deduped = 'complete'; // Handled by hiding or merging
    } else {
      aspects.deduped = 'partial';
      hints.push({
        type: 'attention',
        text: 'Duplicate records are visible',
        priority: 3
      });
    }

    // Has views? (indication of active use)
    if (viewCount > 0) {
      aspects.hasViews = 'complete';
    } else if (recordCount > 0) {
      aspects.hasViews = 'partial';
      hints.push({
        type: 'opportunity',
        text: 'Create views to organize your data',
        priority: 4
      });
    } else {
      aspects.hasViews = 'pending';
    }

    // Relationships established?
    const relationships = context.setRelationships?.[set.id] || [];
    if (relationships.length > 0) {
      aspects.linked = 'complete';
    } else if (sourceImports.some(imp => imp.schema?.foreignKeyHints?.length > 0)) {
      aspects.linked = 'partial';
      hints.push({
        type: 'opportunity',
        text: 'Connect to related workspaces',
        priority: 3
      });
    } else {
      aspects.linked = 'complete'; // No linkable data
    }

    // Calculate stage
    const stage = this.determineSetStage(aspects, recordCount);
    const score = this.calculateSetScore(aspects, avgImportScore);

    hints.sort((a, b) => a.priority - b.priority);

    return {
      stage,
      aspects,
      score,
      sourceCount: sourceImports.length,
      avgImportScore,
      hints: hints.slice(0, 3),
      summary: this.getSetStageSummary(stage, aspects)
    };
  }

  /**
   * Determine import stage from aspects
   */
  static determineStage(aspects) {
    const values = Object.values(aspects);
    const completeCount = values.filter(v => v === 'complete').length;
    const pendingCount = values.filter(v => v === 'pending').length;

    // Holon: Most aspects complete, especially the critical ones
    if (completeCount >= 5 && aspects.used === 'complete' && aspects.quality !== 'pending') {
      return this.STAGES.HOLON;
    }

    // Emanon: Not used OR multiple critical aspects pending
    if (aspects.used === 'pending' || pendingCount >= 3) {
      return this.STAGES.EMANON;
    }

    // Protogon: In between
    return this.STAGES.PROTOGON;
  }

  /**
   * Determine set stage from aspects
   */
  static determineSetStage(aspects, recordCount) {
    if (!aspects.populated || aspects.populated === 'pending' || recordCount === 0) {
      return this.STAGES.EMANON;
    }

    const values = Object.values(aspects);
    const completeCount = values.filter(v => v === 'complete').length;

    if (completeCount >= 4 && aspects.sourcesHealthy !== 'pending') {
      return this.STAGES.HOLON;
    }

    if (completeCount >= 2) {
      return this.STAGES.PROTOGON;
    }

    return this.STAGES.EMANON;
  }

  /**
   * Calculate readiness score (0-100)
   */
  static calculateScore(aspects) {
    const weights = {
      used: 25,
      typed: 15,
      deduped: 15,
      linked: 15,
      quality: 20,
      validated: 10
    };

    const valueScores = {
      complete: 1.0,
      partial: 0.5,
      pending: 0.0
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [aspect, weight] of Object.entries(weights)) {
      if (aspects[aspect] !== undefined) {
        totalWeight += weight;
        weightedSum += weight * (valueScores[aspects[aspect]] || 0);
      }
    }

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
  }

  /**
   * Calculate set readiness score
   */
  static calculateSetScore(aspects, avgImportScore) {
    const weights = {
      populated: 25,
      sourcesHealthy: 30,
      deduped: 15,
      hasViews: 15,
      linked: 15
    };

    const valueScores = {
      complete: 1.0,
      partial: 0.5,
      pending: 0.0
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [aspect, weight] of Object.entries(weights)) {
      if (aspects[aspect] !== undefined) {
        totalWeight += weight;
        weightedSum += weight * (valueScores[aspects[aspect]] || 0);
      }
    }

    const baseScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

    // Blend with average import score
    return Math.round(baseScore * 0.7 + avgImportScore * 0.3);
  }

  /**
   * Get a human-readable summary for the stage (for tooltips, not display)
   */
  static getStageSummary(stage, aspects) {
    switch (stage) {
      case this.STAGES.EMANON:
        if (aspects.used === 'pending') {
          return 'Ready to use';
        }
        return 'Needs attention';
      case this.STAGES.PROTOGON:
        return 'In progress';
      case this.STAGES.HOLON:
        return 'Ready';
      default:
        return '';
    }
  }

  /**
   * Get set stage summary
   */
  static getSetStageSummary(stage, aspects) {
    switch (stage) {
      case this.STAGES.EMANON:
        if (aspects.populated === 'pending') {
          return 'Empty workspace';
        }
        return 'Getting started';
      case this.STAGES.PROTOGON:
        return 'Building up';
      case this.STAGES.HOLON:
        return 'Well organized';
      default:
        return '';
    }
  }

  /**
   * Get CSS class for maturity stage
   * These classes control the visual treatment
   */
  static getStageClass(stage) {
    const classes = {
      [this.STAGES.EMANON]: 'eo-maturity-raw',
      [this.STAGES.PROTOGON]: 'eo-maturity-forming',
      [this.STAGES.HOLON]: 'eo-maturity-ready'
    };
    return classes[stage] || '';
  }

  /**
   * Get icon for hint type
   */
  static getHintIcon(type) {
    const icons = {
      action: 'ph-arrow-right',
      review: 'ph-eye',
      attention: 'ph-warning',
      opportunity: 'ph-lightbulb',
      info: 'ph-info',
      warning: 'ph-warning-circle'
    };
    return icons[type] || 'ph-info';
  }

  /**
   * Render a compact readiness indicator
   * Returns HTML for a visual indicator showing the data's maturity
   */
  static renderReadinessIndicator(maturity, options = {}) {
    const { showHint = true, compact = false } = options;
    const stage = maturity.stage;
    const stageClass = this.getStageClass(stage);

    // Determine how many "segments" are filled
    const segments = this.getReadinessSegments(maturity.aspects);

    const segmentHTML = segments.map((seg, i) =>
      `<span class="eo-readiness-segment eo-segment-${seg.status}" title="${seg.label}"></span>`
    ).join('');

    const hintHTML = showHint && maturity.hints.length > 0 && !compact
      ? `<span class="eo-readiness-hint" title="${maturity.hints[0].text}">
           <i class="ph ${this.getHintIcon(maturity.hints[0].type)}"></i>
         </span>`
      : '';

    return `
      <div class="eo-readiness-indicator ${stageClass} ${compact ? 'eo-compact' : ''}">
        <div class="eo-readiness-segments">
          ${segmentHTML}
        </div>
        ${hintHTML}
      </div>
    `;
  }

  /**
   * Get readiness segments for visual display
   */
  static getReadinessSegments(aspects) {
    // We show 4 key segments for a clean visual
    return [
      {
        key: 'used',
        status: aspects.used || 'pending',
        label: aspects.used === 'complete' ? 'In use' : 'Not used yet'
      },
      {
        key: 'typed',
        status: aspects.typed || 'pending',
        label: aspects.typed === 'complete' ? 'Types verified' : 'Types need review'
      },
      {
        key: 'deduped',
        status: aspects.deduped || 'pending',
        label: aspects.deduped === 'complete' ? 'Deduplicated' : 'Duplicates present'
      },
      {
        key: 'quality',
        status: aspects.quality || 'pending',
        label: aspects.quality === 'complete' ? 'Good quality' : 'Quality issues'
      }
    ];
  }

  /**
   * Render a compact set readiness indicator
   */
  static renderSetReadinessIndicator(maturity, options = {}) {
    const { showScore = true, compact = false } = options;
    const stage = maturity.stage;
    const stageClass = this.getStageClass(stage);

    const scoreHTML = showScore && !compact
      ? `<span class="eo-set-score" title="Data readiness">${maturity.score}%</span>`
      : '';

    const sourceCountHTML = maturity.sourceCount > 0
      ? `<span class="eo-source-count">${maturity.sourceCount}</span>`
      : '';

    return `
      <div class="eo-set-readiness ${stageClass} ${compact ? 'eo-compact' : ''}">
        ${sourceCountHTML}
        ${scoreHTML}
      </div>
    `;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EODataMaturity;
}

if (typeof window !== 'undefined') {
  window.EODataMaturity = EODataMaturity;
}
