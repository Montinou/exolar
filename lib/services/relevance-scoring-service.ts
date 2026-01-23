/**
 * lib/services/relevance-scoring-service.ts
 * Test Relevance Scoring Service
 *
 * Calculates relevance scores for tests based on:
 * - Failure frequency (30% weight) - Percentile rank of failure rate
 * - Failure recency (25% weight) - Exponential decay: 100 × e^(-days/30)
 * - Path criticality (30% weight) - Pattern matching (payment/auth/checkout = 90)
 * - Deployment blocking (15% weight) - Historical CI blocking rate
 */

import { getSql } from "@/lib/db/connection"
import {
  getPathCriticalityPatterns,
  upsertRelevanceScore,
  type RelevanceScoreFactors,
  type PathCriticalityPattern,
} from "@/lib/db/relevance"

// ============================================
// Types
// ============================================

export interface TestFailureStats {
  testSignature: string
  testName: string
  testFile: string
  totalRuns: number
  failedRuns: number
  failureRate: number
  lastFailureAt: Date | null
  ciBlockingCount: number
}

export interface ScoringResult {
  testSignature: string
  testName: string
  testFile: string
  factors: RelevanceScoreFactors
  finalScore: number
}

// ============================================
// Scoring Constants
// ============================================

const WEIGHTS = {
  FAILURE_FREQUENCY: 0.30,
  FAILURE_RECENCY: 0.25,
  PATH_CRITICALITY: 0.30,
  DEPLOYMENT_BLOCKING: 0.15,
}

// Days for recency decay calculation
const RECENCY_DECAY_CONSTANT = 30

// Minimum runs required for reliable failure frequency scoring
const MIN_RUNS_FOR_FREQUENCY_SCORE = 3

// ============================================
// Score Calculation Functions
// ============================================

/**
 * Calculate failure frequency score (0-100)
 * Based on percentile rank of failure rate among all tests
 */
export function calculateFailureFrequencyScore(
  failureRate: number,
  percentileRank: number
): number {
  // If no failures, base score is 50 (neutral)
  if (failureRate === 0) return 50

  // Convert percentile (0-1) to score (50-100)
  // Higher failure rate = higher score = more important
  return Math.round(50 + (percentileRank * 50))
}

/**
 * Calculate failure recency score (0-100)
 * Exponential decay: 100 × e^(-days/30)
 */
export function calculateFailureRecencyScore(lastFailureAt: Date | null): number {
  if (!lastFailureAt) return 50 // No failures = neutral score

  const now = new Date()
  const daysSinceFailure = (now.getTime() - lastFailureAt.getTime()) / (1000 * 60 * 60 * 24)

  // Exponential decay: recent failures get higher scores
  const decayScore = 100 * Math.exp(-daysSinceFailure / RECENCY_DECAY_CONSTANT)

  // Minimum score of 10 for tests that have failed
  return Math.max(10, Math.round(decayScore))
}

/**
 * Calculate path criticality score (0-100)
 * Based on pattern matching against critical paths
 */
export function calculatePathCriticalityScore(
  testFile: string,
  testName: string,
  patterns: PathCriticalityPattern[]
): number {
  const combinedPath = `${testFile.toLowerCase()} ${testName.toLowerCase()}`

  let maxScore = 50 // Default score for unmatched tests

  for (const pattern of patterns) {
    if (combinedPath.includes(pattern.pattern.toLowerCase())) {
      maxScore = Math.max(maxScore, pattern.score)
    }
  }

  return maxScore
}

/**
 * Calculate deployment blocking score (0-100)
 * Based on historical CI blocking rate
 */
export function calculateDeploymentBlockingScore(
  ciBlockingCount: number,
  totalRuns: number
): number {
  if (totalRuns === 0) return 50 // Neutral for new tests

  const blockingRate = ciBlockingCount / totalRuns

  // Convert to score: 50 (no blocking) to 100 (always blocks)
  return Math.round(50 + (blockingRate * 50))
}

// ============================================
// Main Scoring Service
// ============================================

/**
 * Calculate relevance scores for all tests in an organization
 * This should be run periodically (e.g., after each test execution)
 */
export async function calculateRelevanceScores(
  organizationId: number,
  options?: {
    testSignatures?: string[]  // Limit to specific tests
    forceRecalculate?: boolean // Recalculate even if recently calculated
  }
): Promise<ScoringResult[]> {
  const sql = getSql()

  // Get path criticality patterns
  const patterns = await getPathCriticalityPatterns(organizationId)

  // Get test failure statistics
  const statsQuery = options?.testSignatures?.length
    ? sql`
        WITH test_stats AS (
          SELECT
            tr.test_signature,
            tr.test_name,
            tr.test_file,
            COUNT(*) as total_runs,
            COUNT(*) FILTER (WHERE tr.status IN ('failed', 'timedout')) as failed_runs,
            MAX(CASE WHEN tr.status IN ('failed', 'timedout') THEN tr.created_at END) as last_failure_at,
            COUNT(*) FILTER (
              WHERE tr.status IN ('failed', 'timedout')
              AND te.status = 'failure'
            ) as ci_blocking_count
          FROM test_results tr
          JOIN test_executions te ON tr.execution_id = te.id
          WHERE te.organization_id = ${organizationId}
            AND tr.test_signature = ANY(${options.testSignatures})
          GROUP BY tr.test_signature, tr.test_name, tr.test_file
        ),
        percentiles AS (
          SELECT
            test_signature,
            test_name,
            test_file,
            total_runs,
            failed_runs,
            CASE
              WHEN total_runs > 0 THEN (failed_runs::float / total_runs)
              ELSE 0
            END as failure_rate,
            last_failure_at,
            ci_blocking_count,
            PERCENT_RANK() OVER (
              ORDER BY CASE
                WHEN total_runs > 0 THEN (failed_runs::float / total_runs)
                ELSE 0
              END
            ) as percentile_rank
          FROM test_stats
          WHERE total_runs >= ${MIN_RUNS_FOR_FREQUENCY_SCORE}
        )
        SELECT * FROM percentiles
        ORDER BY failure_rate DESC
      `
    : sql`
        WITH test_stats AS (
          SELECT
            tr.test_signature,
            tr.test_name,
            tr.test_file,
            COUNT(*) as total_runs,
            COUNT(*) FILTER (WHERE tr.status IN ('failed', 'timedout')) as failed_runs,
            MAX(CASE WHEN tr.status IN ('failed', 'timedout') THEN tr.created_at END) as last_failure_at,
            COUNT(*) FILTER (
              WHERE tr.status IN ('failed', 'timedout')
              AND te.status = 'failure'
            ) as ci_blocking_count
          FROM test_results tr
          JOIN test_executions te ON tr.execution_id = te.id
          WHERE te.organization_id = ${organizationId}
          GROUP BY tr.test_signature, tr.test_name, tr.test_file
        ),
        percentiles AS (
          SELECT
            test_signature,
            test_name,
            test_file,
            total_runs,
            failed_runs,
            CASE
              WHEN total_runs > 0 THEN (failed_runs::float / total_runs)
              ELSE 0
            END as failure_rate,
            last_failure_at,
            ci_blocking_count,
            PERCENT_RANK() OVER (
              ORDER BY CASE
                WHEN total_runs > 0 THEN (failed_runs::float / total_runs)
                ELSE 0
              END
            ) as percentile_rank
          FROM test_stats
          WHERE total_runs >= ${MIN_RUNS_FOR_FREQUENCY_SCORE}
        )
        SELECT * FROM percentiles
        ORDER BY failure_rate DESC
      `

  const testStats = await statsQuery as Array<{
    test_signature: string
    test_name: string
    test_file: string
    total_runs: number
    failed_runs: number
    failure_rate: number
    last_failure_at: string | null
    ci_blocking_count: number
    percentile_rank: number
  }>

  const results: ScoringResult[] = []

  // Calculate scores for each test
  for (const stats of testStats) {
    const factors: RelevanceScoreFactors = {
      failureFrequencyScore: calculateFailureFrequencyScore(
        stats.failure_rate,
        stats.percentile_rank
      ),
      failureRecencyScore: calculateFailureRecencyScore(
        stats.last_failure_at ? new Date(stats.last_failure_at) : null
      ),
      pathCriticalityScore: calculatePathCriticalityScore(
        stats.test_file,
        stats.test_name,
        patterns
      ),
      deploymentBlockingScore: calculateDeploymentBlockingScore(
        stats.ci_blocking_count,
        stats.total_runs
      ),
    }

    // Calculate weighted final score
    const finalScore = Math.round(
      factors.failureFrequencyScore * WEIGHTS.FAILURE_FREQUENCY +
      factors.failureRecencyScore * WEIGHTS.FAILURE_RECENCY +
      factors.pathCriticalityScore * WEIGHTS.PATH_CRITICALITY +
      factors.deploymentBlockingScore * WEIGHTS.DEPLOYMENT_BLOCKING
    )

    // Upsert to database
    await upsertRelevanceScore(
      organizationId,
      stats.test_signature,
      stats.test_name,
      stats.test_file,
      factors
    )

    results.push({
      testSignature: stats.test_signature,
      testName: stats.test_name,
      testFile: stats.test_file,
      factors,
      finalScore,
    })
  }

  return results
}

/**
 * Calculate relevance scores for tests in a specific execution
 * Called after test ingestion to update scores incrementally
 */
export async function calculateRelevanceScoresForExecution(
  organizationId: number,
  executionId: number
): Promise<number> {
  const sql = getSql()

  // Get test signatures from this execution
  const testsInExecution = await sql`
    SELECT DISTINCT test_signature
    FROM test_results
    WHERE execution_id = ${executionId}
  `

  const signatures = testsInExecution.map(t => t.test_signature as string)

  if (signatures.length === 0) return 0

  // Calculate scores for these tests
  const results = await calculateRelevanceScores(organizationId, {
    testSignatures: signatures,
  })

  return results.length
}

/**
 * Get high relevance failures from an execution
 * Used for notifications - only alert on high-relevance test failures
 */
export async function getHighRelevanceFailures(
  organizationId: number,
  executionId: number,
  minScore: number = 80
): Promise<Array<{
  testSignature: string
  testName: string
  testFile: string
  relevanceScore: number
  relevanceLabel: string | null
  errorMessage: string | null
}>> {
  const sql = getSql()

  const result = await sql`
    SELECT
      tr.test_signature,
      tr.test_name,
      tr.test_file,
      COALESCE(trs.relevance_score, 50) as relevance_score,
      trs.manual_relevance_label as relevance_label,
      tr.error_message
    FROM test_results tr
    LEFT JOIN test_relevance_scores trs
      ON trs.organization_id = ${organizationId}
      AND trs.test_signature = tr.test_signature
    WHERE tr.execution_id = ${executionId}
      AND tr.status IN ('failed', 'timedout')
      AND COALESCE(trs.relevance_score, 50) >= ${minScore}
    ORDER BY COALESCE(trs.relevance_score, 50) DESC
  `

  return result as Array<{
    testSignature: string
    testName: string
    testFile: string
    relevanceScore: number
    relevanceLabel: string | null
    errorMessage: string | null
  }>
}

// ============================================
// Exports
// ============================================

export {
  WEIGHTS,
  RECENCY_DECAY_CONSTANT,
  MIN_RUNS_FOR_FREQUENCY_SCORE,
}
