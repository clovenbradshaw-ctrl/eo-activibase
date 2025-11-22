/**
 * EO Stability Classifier
 * Automatically classifies entities based on change patterns
 *
 * Classifications:
 * - Emerging: High change, < 7 days old, high variability
 * - Forming: Moderate changes, 7-30 days, stabilizing
 * - Stable: Low change rate, > 30 days, consistent
 *
 * Usage:
 *   const classifier = new EOStabilityClassifier();
 *   const stability = classifier.classify(record);
 */

class EOStabilityClassifier {
  constructor() {
    this.thresholds = {
      // Age thresholds (milliseconds)
      emergingAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      formingAge: 30 * 24 * 60 * 60 * 1000, // 30 days

      // Edit frequency thresholds (edits per day)
      highFrequency: 0.5, // More than 1 edit every 2 days
      lowFrequency: 0.1, // Less than 1 edit every 10 days

      // Variability thresholds (coefficient of variation)
      highVariability: 0.3, // 30% CV
      lowVariability: 0.1 // 10% CV
    };
  }

  /**
   * Classify a record's stability
   */
  classify(record) {
    const age = this.calculateAge(record);
    const editFrequency = this.calculateEditFrequency(record);
    const variability = this.calculateVariability(record);
    const hasSuperposition = this.checkSuperposition(record);
    const contextChurn = this.calculateContextChurn(record);

    // Calculate weighted score
    const score = this.calculateStabilityScore({
      age,
      editFrequency,
      variability,
      hasSuperposition,
      contextChurn
    });

    // Classify based on score
    let classification;
    let reason = [];

    if (score < 33) {
      classification = 'emerging';
      if (age < this.thresholds.emergingAge) {
        reason.push('Less than 7 days old');
      }
      if (editFrequency > this.thresholds.highFrequency) {
        reason.push('High edit frequency');
      }
      if (variability > this.thresholds.highVariability) {
        reason.push('High value variability');
      }
      if (hasSuperposition) {
        reason.push('Multiple value perspectives exist');
      }
    } else if (score < 66) {
      classification = 'forming';
      reason.push('Stabilizing patterns detected');
      if (age < this.thresholds.formingAge) {
        reason.push('7-30 days old');
      }
    } else {
      classification = 'stable';
      reason.push('Consistent patterns over time');
      if (age > this.thresholds.formingAge) {
        reason.push('More than 30 days old');
      }
      if (editFrequency < this.thresholds.lowFrequency) {
        reason.push('Low edit frequency');
      }
    }

    return {
      classification,
      score,
      reason: reason.join(', '),
      metrics: {
        age,
        editFrequency,
        variability,
        hasSuperposition,
        contextChurn
      },
      calculated_at: new Date().toISOString()
    };
  }

  /**
   * Calculate age of record in milliseconds
   */
  calculateAge(record) {
    const createdAt = record.created_at
      ? new Date(record.created_at).getTime()
      : Date.now();

    return Date.now() - createdAt;
  }

  /**
   * Calculate edit frequency (edits per day)
   */
  calculateEditFrequency(record) {
    const editHistory = record.edit_history || [];
    if (editHistory.length === 0) return 0;

    const age = this.calculateAge(record);
    const ageInDays = age / (1000 * 60 * 60 * 24);

    if (ageInDays === 0) return 0;

    return editHistory.length / ageInDays;
  }

  /**
   * Calculate value variability (coefficient of variation)
   */
  calculateVariability(record) {
    const valueHistory = record.value_history || [];
    if (valueHistory.length < 2) return 0;

    // Extract numeric values
    const numericValues = valueHistory
      .map(v => typeof v === 'number' ? v : parseFloat(v))
      .filter(v => !isNaN(v));

    if (numericValues.length < 2) return 0;

    // Calculate mean
    const mean = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
    if (mean === 0) return 0;

    // Calculate standard deviation
    const squaredDiffs = numericValues.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / numericValues.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of variation
    return stdDev / Math.abs(mean);
  }

  /**
   * Check if record has superposition in any cells
   */
  checkSuperposition(record) {
    if (!record.cells) return false;

    return record.cells.some(cell => {
      return cell.values && cell.values.length > 1;
    });
  }

  /**
   * Calculate context churn (how often context changes)
   */
  calculateContextChurn(record) {
    const editHistory = record.edit_history || [];
    if (editHistory.length === 0) return 0;

    // Count context-changing operations
    const contextOps = ['DES', 'SEG', 'REC', 'SUP'];
    const contextChanges = editHistory.filter(entry =>
      contextOps.includes(entry.operator)
    ).length;

    return contextChanges / editHistory.length;
  }

  /**
   * Calculate overall stability score (0-100)
   * Higher = more stable
   */
  calculateStabilityScore({
    age,
    editFrequency,
    variability,
    hasSuperposition,
    contextChurn
  }) {
    let score = 50; // Start at neutral

    // Age contribution (max ±20 points)
    if (age > this.thresholds.formingAge) {
      score += 20;
    } else if (age > this.thresholds.emergingAge) {
      score += 10;
    } else {
      score -= 20;
    }

    // Edit frequency contribution (max ±20 points)
    if (editFrequency < this.thresholds.lowFrequency) {
      score += 20;
    } else if (editFrequency < this.thresholds.highFrequency) {
      score += 0;
    } else {
      score -= 20;
    }

    // Variability contribution (max ±20 points)
    if (variability < this.thresholds.lowVariability) {
      score += 20;
    } else if (variability < this.thresholds.highVariability) {
      score += 0;
    } else {
      score -= 20;
    }

    // Superposition penalty (-10 points)
    if (hasSuperposition) {
      score -= 10;
    }

    // Context churn penalty (max -10 points)
    score -= contextChurn * 10;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get display information for stability tag
   */
  getDisplayInfo(stability) {
    const displays = {
      emerging: {
        icon: '🔴',
        color: '#ef4444',
        bgColor: '#fee2e2',
        label: 'Emerging',
        description: 'High change in recent period'
      },
      forming: {
        icon: '🟡',
        color: '#f59e0b',
        bgColor: '#fef3c7',
        label: 'Forming',
        description: 'Patterns stabilizing'
      },
      stable: {
        icon: '🟢',
        color: '#10b981',
        bgColor: '#d1fae5',
        label: 'Stable',
        description: 'Consistent patterns'
      }
    };

    return displays[stability.classification] || displays.emerging;
  }

  /**
   * Get detailed analysis text
   */
  getAnalysisText(stability) {
    const parts = [];

    parts.push(`Status: ${stability.classification.toUpperCase()}`);
    parts.push(`Stability Score: ${stability.score}/100`);
    parts.push('');
    parts.push('Factors:');
    parts.push(`• ${stability.reason}`);
    parts.push('');
    parts.push('Metrics:');
    parts.push(`• Age: ${this.formatAge(stability.metrics.age)}`);
    parts.push(`• Edit frequency: ${stability.metrics.editFrequency.toFixed(3)} edits/day`);
    parts.push(`• Value variability: ${(stability.metrics.variability * 100).toFixed(1)}%`);
    parts.push(`• Superposition: ${stability.metrics.hasSuperposition ? 'Yes' : 'No'}`);
    parts.push(`• Context churn: ${(stability.metrics.contextChurn * 100).toFixed(1)}%`);

    return parts.join('\n');
  }

  /**
   * Format age in human-readable form
   */
  formatAge(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Batch classify multiple records
   */
  batchClassify(records) {
    return records.map(record => ({
      record_id: record.record_id,
      stability: this.classify(record)
    }));
  }

  /**
   * Get statistics for a set of records
   */
  getStatistics(records) {
    const classifications = records.map(r => this.classify(r));

    const counts = {
      emerging: 0,
      forming: 0,
      stable: 0
    };

    classifications.forEach(c => {
      counts[c.classification]++;
    });

    const total = classifications.length;

    return {
      total,
      counts,
      percentages: {
        emerging: (counts.emerging / total * 100).toFixed(1),
        forming: (counts.forming / total * 100).toFixed(1),
        stable: (counts.stable / total * 100).toFixed(1)
      },
      averageScore: classifications.reduce((sum, c) => sum + c.score, 0) / total
    };
  }

  /**
   * Update record with stability classification
   */
  updateRecord(record) {
    const stability = this.classify(record);
    record.stability = stability;
    record.updated_at = new Date().toISOString();
    return record;
  }

  /**
   * Check if stability should be recalculated
   * (e.g., after certain time or number of edits)
   */
  shouldRecalculate(record, options = {}) {
    const {
      maxAge = 24 * 60 * 60 * 1000, // 24 hours
      editThreshold = 5 // Recalculate after 5 new edits
    } = options;

    if (!record.stability) return true;

    const lastCalculated = new Date(record.stability.calculated_at).getTime();
    const age = Date.now() - lastCalculated;

    if (age > maxAge) return true;

    // Count edits since last calculation
    const editsSince = (record.edit_history || []).filter(entry =>
      new Date(entry.timestamp) > lastCalculated
    ).length;

    if (editsSince >= editThreshold) return true;

    return false;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EOStabilityClassifier;
}

if (typeof window !== 'undefined') {
  window.EOStabilityClassifier = EOStabilityClassifier;
}
