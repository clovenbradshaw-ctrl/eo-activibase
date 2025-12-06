/**
 * EO SUP (Superposition) Detector
 *
 * DEPRECATED: This module has been merged into eo_context_engine.js
 *
 * EO Operator: SYN (Synthesize)
 * - SUP detection is fundamentally a context operation
 * - Merged into EOContextEngine for cohesion
 *
 * This file is kept for backward compatibility.
 * All functionality now delegates to EOContextEngine.
 *
 * Migration:
 *   // Old usage:
 *   const detector = new EOSUPDetector();
 *   detector.detectSuperposition(cell);
 *
 *   // New usage:
 *   const engine = new EOContextEngine();
 *   engine.detectSuperposition(cell);
 */

// Log deprecation warning once
if (typeof console !== 'undefined' && !window._eoSupDetectorWarned) {
  console.warn(
    '[EO] eo_sup_detector.js is deprecated. ' +
    'SUP detection has been merged into eo_context_engine.js. ' +
    'Use EOContextEngine directly for new code.'
  );
  window._eoSupDetectorWarned = true;
}

// EOSUPDetector is now exported from eo_context_engine.js
// This file exists only to maintain the original script path
