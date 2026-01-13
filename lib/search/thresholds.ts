/**
 * Adaptive Similarity Thresholds for Vector Search
 *
 * Per-category thresholds based on error type characteristics.
 *
 * Source: docs/prompts/research/adaptive-thresholds-cost-optimization.md
 * Expected improvement: 5-10% accuracy gain
 *
 * **Research basis:**
 * - SemEval-2025: Per-category tuning improved F1 from 0.6491 → 0.6816 (5%)
 * - XSQ-Learning: Adaptive thresholds improved performance by 12-18%
 */

import { extractErrorType } from "@/lib/ai/sanitizer"

// ============================================
// Types
// ============================================

export interface CategoryThreshold {
  threshold: number
  minSamples: number
  description: string
}

export interface CategoryThresholds {
  [category: string]: CategoryThreshold
}

// ============================================
// Per-Category Thresholds
// ============================================

/**
 * Error category-specific similarity thresholds
 *
 * Different error types have different similarity patterns:
 * - Timeout errors: Similar stack traces, different durations → Lower threshold (0.55)
 * - Assertion failures: Exact text matters → Higher threshold (0.75)
 * - Network errors: Similar patterns, different endpoints → Balanced (0.65)
 * - DOM errors: Element selectors vary → Lower threshold (0.55)
 * - Permission errors: Usually identical → Very high threshold (0.85)
 */
export const ERROR_CATEGORY_THRESHOLDS: CategoryThresholds = {
  // Timing/Performance errors
  TimeoutError: {
    threshold: 0.55,
    minSamples: 3,
    description: "Timeout errors - focus on location, not duration",
  },

  // Assertion/Validation errors
  AssertionError: {
    threshold: 0.75,
    minSamples: 2,
    description: "Assertion failures - exact text matters",
  },

  // Network errors
  ConnectionError: {
    threshold: 0.65,
    minSamples: 3,
    description: "Network connection failures",
  },
  DNSError: {
    threshold: 0.65,
    minSamples: 3,
    description: "DNS resolution errors",
  },

  // DOM/UI errors
  ElementNotFoundError: {
    threshold: 0.55,
    minSamples: 3,
    description: "Element not found - selectors vary",
  },
  ElementNotVisibleError: {
    threshold: 0.60,
    minSamples: 3,
    description: "Element visibility issues",
  },

  // Code errors
  TypeError: {
    threshold: 0.70,
    minSamples: 2,
    description: "Type errors - similar patterns",
  },
  ReferenceError: {
    threshold: 0.70,
    minSamples: 2,
    description: "Reference errors - similar patterns",
  },
  SyntaxError: {
    threshold: 0.80,
    minSamples: 2,
    description: "Syntax errors - usually identical",
  },

  // Security/Permission errors
  AuthenticationError: {
    threshold: 0.85,
    minSamples: 2,
    description: "Auth errors - very strict matching",
  },
  DatabaseError: {
    threshold: 0.70,
    minSamples: 3,
    description: "Database errors - similar queries",
  },
  ValidationError: {
    threshold: 0.75,
    minSamples: 2,
    description: "Validation errors - exact requirements",
  },

  // Unknown/Default
  UnknownError: {
    threshold: 0.60,
    minSamples: 3,
    description: "Unknown errors - moderate threshold",
  },
}

/**
 * Default threshold for errors without category mapping
 */
export const DEFAULT_ERROR_THRESHOLD = 0.60

/**
 * Default threshold for test searches (non-error)
 */
export const DEFAULT_TEST_THRESHOLD = 0.30

// ============================================
// Threshold Selection
// ============================================

/**
 * Get threshold for a specific error type
 *
 * @param errorMessage - Error message to analyze
 * @returns Appropriate threshold based on error category
 */
export function getThresholdForError(errorMessage: string | null): number {
  if (!errorMessage) {
    return DEFAULT_ERROR_THRESHOLD
  }

  const errorType = extractErrorType(errorMessage)
  const categoryConfig = ERROR_CATEGORY_THRESHOLDS[errorType]

  if (categoryConfig) {
    return categoryConfig.threshold
  }

  return DEFAULT_ERROR_THRESHOLD
}

/**
 * Get threshold and minimum sample size for error clustering
 *
 * @param errorMessage - Error message to analyze
 * @returns Threshold config for the error category
 */
export function getClusteringConfig(errorMessage: string | null): {
  threshold: number
  minSamples: number
  category: string
} {
  if (!errorMessage) {
    return {
      threshold: DEFAULT_ERROR_THRESHOLD,
      minSamples: 3,
      category: "unknown",
    }
  }

  const errorType = extractErrorType(errorMessage)
  const categoryConfig = ERROR_CATEGORY_THRESHOLDS[errorType]

  if (categoryConfig) {
    return {
      threshold: categoryConfig.threshold,
      minSamples: categoryConfig.minSamples,
      category: errorType,
    }
  }

  return {
    threshold: DEFAULT_ERROR_THRESHOLD,
    minSamples: 3,
    category: "unknown",
  }
}

// ============================================
// Adaptive Threshold Adjustment
// ============================================

/**
 * Adjust threshold based on result count and query characteristics
 *
 * Dynamic adjustment to handle edge cases:
 * - Too few results → Lower threshold (improve recall)
 * - Too many results → Raise threshold (improve precision)
 * - Rare queries → Lower threshold (be more permissive)
 *
 * @param baseThreshold - Starting threshold from category
 * @param resultCount - Number of results found
 * @param isRareQuery - Whether query is rare/infrequent
 * @returns Adjusted threshold
 */
export function adjustThresholdDynamically(
  baseThreshold: number,
  resultCount: number,
  isRareQuery: boolean = false
): number {
  // Lower threshold if too few results (improve recall)
  if (resultCount < 3) {
    return Math.max(0.25, baseThreshold - 0.2)
  }

  // Lower threshold for rare queries (be more permissive)
  if (isRareQuery && resultCount < 10) {
    return Math.max(0.30, baseThreshold - 0.15)
  }

  // Raise threshold if too many results (improve precision)
  if (resultCount > 50) {
    return Math.min(0.95, baseThreshold + 0.10)
  }

  // Keep base threshold if result count is reasonable
  return baseThreshold
}

// ============================================
// Threshold Statistics Tracker
// ============================================

/**
 * Track similarity scores over time for adaptive threshold calculation
 *
 * Uses rolling window to calculate percentile-based thresholds
 */
export class AdaptiveThresholdTracker {
  private scores: number[] = []
  private windowSize: number

  constructor(windowSize: number = 1000) {
    this.windowSize = windowSize
  }

  /**
   * Add a new similarity score to the tracker
   */
  addScore(score: number): void {
    this.scores.push(score)
    if (this.scores.length > this.windowSize) {
      this.scores.shift() // Remove oldest
    }
  }

  /**
   * Get threshold based on percentile of score distribution
   *
   * @param percentile - Percentile to use (0-1), default 0.90
   * @returns Threshold value at the specified percentile
   */
  getThreshold(percentile: number = 0.90): number {
    if (this.scores.length < 10) {
      return DEFAULT_ERROR_THRESHOLD // Fallback to default
    }

    return calculatePercentile(this.scores, percentile)
  }

  /**
   * Get distribution statistics for monitoring
   */
  getStatistics() {
    if (this.scores.length === 0) {
      return null
    }

    const sorted = [...this.scores].sort((a, b) => a - b)
    return {
      count: sorted.length,
      mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p90: sorted[Math.floor(sorted.length * 0.90)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    }
  }

  /**
   * Reset the tracker
   */
  clear(): void {
    this.scores = []
  }
}

/**
 * Calculate percentile from an array of scores
 */
function calculatePercentile(scores: number[], percentile: number): number {
  const sorted = [...scores].sort((a, b) => a - b)
  const index = Math.floor(sorted.length * percentile)
  return sorted[index]
}

// ============================================
// Threshold Validation
// ============================================

/**
 * Find optimal threshold using F1 score on validation data
 *
 * @param validationData - Array of {score, isRelevant} pairs
 * @returns Optimal threshold that maximizes F1 score
 */
export function findOptimalThreshold(
  validationData: Array<{ score: number; isRelevant: boolean }>
): number {
  if (validationData.length === 0) {
    return DEFAULT_ERROR_THRESHOLD
  }

  const thresholds = Array.from({ length: 100 }, (_, i) => i / 100)
  let bestThreshold = 0.5
  let bestF1 = 0

  for (const threshold of thresholds) {
    let tp = 0,
      fp = 0,
      fn = 0

    for (const { score, isRelevant } of validationData) {
      const predicted = score >= threshold
      if (predicted && isRelevant) tp++
      else if (predicted && !isRelevant) fp++
      else if (!predicted && isRelevant) fn++
    }

    const precision = tp / (tp + fp) || 0
    const recall = tp / (tp + fn) || 0
    const f1 = (2 * (precision * recall)) / (precision + recall) || 0

    if (f1 > bestF1) {
      bestF1 = f1
      bestThreshold = threshold
    }
  }

  return bestThreshold
}

/**
 * Generate precision-recall curve data for threshold analysis
 */
export function generatePRCurve(
  validationData: Array<{ score: number; isRelevant: boolean }>
): Array<{
  threshold: number
  precision: number
  recall: number
  f1: number
}> {
  const thresholds = Array.from({ length: 100 }, (_, i) => i / 100)
  const curve: Array<{
    threshold: number
    precision: number
    recall: number
    f1: number
  }> = []

  for (const threshold of thresholds) {
    let tp = 0,
      fp = 0,
      fn = 0

    for (const { score, isRelevant } of validationData) {
      const predicted = score >= threshold
      if (predicted && isRelevant) tp++
      else if (predicted && !isRelevant) fp++
      else if (!predicted && isRelevant) fn++
    }

    const precision = tp / (tp + fp) || 0
    const recall = tp / (tp + fn) || 0
    const f1 = (2 * (precision * recall)) / (precision + recall) || 0

    curve.push({ threshold, precision, recall, f1 })
  }

  return curve
}
