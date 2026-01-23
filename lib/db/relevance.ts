/**
 * lib/db/relevance.ts
 * Database operations for test relevance scoring system
 */

import { getSql } from "./connection"

// ============================================
// Types
// ============================================

export interface TestRelevanceScore {
  id: number
  organization_id: number
  test_signature: string
  test_name: string
  test_file: string
  failure_frequency_score: number
  failure_recency_score: number
  path_criticality_score: number
  deployment_blocking_score: number
  auto_relevance_score: number
  manual_relevance_label: RelevanceLabel | null
  manual_override_score: number | null
  override_reason: string | null
  overridden_by: number | null
  overridden_at: string | null
  relevance_score: number
  created_at: string
  updated_at: string
  last_calculated_at: string
}

export type RelevanceLabel = "critical" | "high" | "medium" | "low" | "ignore"

export interface PathCriticalityPattern {
  id: number
  organization_id: number | null
  pattern: string
  score: number
  description: string | null
  is_default: boolean
}

export interface RelevanceScoreFactors {
  failureFrequencyScore: number
  failureRecencyScore: number
  pathCriticalityScore: number
  deploymentBlockingScore: number
}

export interface SetRelevanceOverrideParams {
  testSignature: string
  score: number
  label: RelevanceLabel
  reason?: string
  userId: number
}

// ============================================
// Label to Score Mapping
// ============================================

export function labelToScore(label: RelevanceLabel): number {
  switch (label) {
    case "critical":
      return 95
    case "high":
      return 80
    case "medium":
      return 50
    case "low":
      return 25
    case "ignore":
      return 0
    default:
      return 50
  }
}

export function scoreToLabel(score: number): RelevanceLabel {
  if (score >= 90) return "critical"
  if (score >= 70) return "high"
  if (score >= 40) return "medium"
  if (score >= 10) return "low"
  return "ignore"
}

// ============================================
// Query Functions
// ============================================

/**
 * Get relevance score for a specific test
 */
export async function getRelevanceScore(
  organizationId: number,
  testSignature: string
): Promise<TestRelevanceScore | null> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM test_relevance_scores
    WHERE organization_id = ${organizationId}
      AND test_signature = ${testSignature}
  `

  return result[0] as TestRelevanceScore | undefined ?? null
}

/**
 * Get relevance scores for multiple tests
 */
export async function getRelevanceScores(
  organizationId: number,
  testSignatures: string[]
): Promise<TestRelevanceScore[]> {
  if (testSignatures.length === 0) return []

  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM test_relevance_scores
    WHERE organization_id = ${organizationId}
      AND test_signature = ANY(${testSignatures})
    ORDER BY relevance_score DESC
  `

  return result as TestRelevanceScore[]
}

/**
 * Get all relevance scores for an organization
 */
export async function getAllRelevanceScores(
  organizationId: number,
  options?: {
    limit?: number
    offset?: number
    minScore?: number
    label?: RelevanceLabel
    sortBy?: "score" | "name" | "updated"
    sortOrder?: "asc" | "desc"
  }
): Promise<TestRelevanceScore[]> {
  const sql = getSql()
  const limit = options?.limit ?? 100
  const offset = options?.offset ?? 0
  const minScore = options?.minScore ?? 0
  const sortOrder = options?.sortOrder ?? "desc"

  let orderBy = "relevance_score DESC"
  if (options?.sortBy === "name") {
    orderBy = sortOrder === "asc" ? "test_name ASC" : "test_name DESC"
  } else if (options?.sortBy === "updated") {
    orderBy = sortOrder === "asc" ? "updated_at ASC" : "updated_at DESC"
  } else {
    orderBy = sortOrder === "asc" ? "relevance_score ASC" : "relevance_score DESC"
  }

  // Build query based on filters
  if (options?.label) {
    const result = await sql`
      SELECT *
      FROM test_relevance_scores
      WHERE organization_id = ${organizationId}
        AND relevance_score >= ${minScore}
        AND manual_relevance_label = ${options.label}
      ORDER BY ${sql.unsafe(orderBy)}
      LIMIT ${limit}
      OFFSET ${offset}
    `
    return result as TestRelevanceScore[]
  }

  const result = await sql`
    SELECT *
    FROM test_relevance_scores
    WHERE organization_id = ${organizationId}
      AND relevance_score >= ${minScore}
    ORDER BY ${sql.unsafe(orderBy)}
    LIMIT ${limit}
    OFFSET ${offset}
  `

  return result as TestRelevanceScore[]
}

/**
 * Get tests that need manual labeling (no manual label, sorted by failure rate)
 */
export async function getTestsNeedingLabels(
  organizationId: number,
  limit: number = 20
): Promise<TestRelevanceScore[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM test_relevance_scores
    WHERE organization_id = ${organizationId}
      AND manual_relevance_label IS NULL
    ORDER BY failure_frequency_score DESC, auto_relevance_score DESC
    LIMIT ${limit}
  `

  return result as TestRelevanceScore[]
}

/**
 * Get critical tests (relevance >= 80)
 */
export async function getCriticalTests(
  organizationId: number,
  limit: number = 50
): Promise<TestRelevanceScore[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM test_relevance_scores
    WHERE organization_id = ${organizationId}
      AND relevance_score >= 80
    ORDER BY relevance_score DESC
    LIMIT ${limit}
  `

  return result as TestRelevanceScore[]
}

// ============================================
// Mutation Functions
// ============================================

/**
 * Upsert relevance score for a test (auto-calculated factors)
 */
export async function upsertRelevanceScore(
  organizationId: number,
  testSignature: string,
  testName: string,
  testFile: string,
  factors: RelevanceScoreFactors
): Promise<TestRelevanceScore> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO test_relevance_scores (
      organization_id,
      test_signature,
      test_name,
      test_file,
      failure_frequency_score,
      failure_recency_score,
      path_criticality_score,
      deployment_blocking_score,
      last_calculated_at
    ) VALUES (
      ${organizationId},
      ${testSignature},
      ${testName},
      ${testFile},
      ${factors.failureFrequencyScore},
      ${factors.failureRecencyScore},
      ${factors.pathCriticalityScore},
      ${factors.deploymentBlockingScore},
      NOW()
    )
    ON CONFLICT (organization_id, test_signature) DO UPDATE SET
      test_name = EXCLUDED.test_name,
      test_file = EXCLUDED.test_file,
      failure_frequency_score = EXCLUDED.failure_frequency_score,
      failure_recency_score = EXCLUDED.failure_recency_score,
      path_criticality_score = EXCLUDED.path_criticality_score,
      deployment_blocking_score = EXCLUDED.deployment_blocking_score,
      last_calculated_at = NOW()
    RETURNING *
  `

  return result[0] as TestRelevanceScore
}

/**
 * Set manual relevance override for a test
 */
export async function setRelevanceOverride(
  organizationId: number,
  testSignature: string,
  score: number,
  label: RelevanceLabel,
  reason: string | null,
  userId: number
): Promise<TestRelevanceScore | null> {
  const sql = getSql()

  const result = await sql`
    UPDATE test_relevance_scores
    SET
      manual_relevance_label = ${label},
      manual_override_score = ${score},
      override_reason = ${reason},
      overridden_by = ${userId},
      overridden_at = NOW()
    WHERE organization_id = ${organizationId}
      AND test_signature = ${testSignature}
    RETURNING *
  `

  // If test doesn't exist in relevance table, create it first
  if (result.length === 0) {
    // Check if test exists in suite_tests or test_results
    const testInfo = await sql`
      SELECT DISTINCT test_name, test_file
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.test_signature = ${testSignature}
      LIMIT 1
    `

    if (testInfo.length === 0) {
      return null
    }

    // Create relevance score with manual override
    const insertResult = await sql`
      INSERT INTO test_relevance_scores (
        organization_id,
        test_signature,
        test_name,
        test_file,
        manual_relevance_label,
        manual_override_score,
        override_reason,
        overridden_by,
        overridden_at
      ) VALUES (
        ${organizationId},
        ${testSignature},
        ${testInfo[0].test_name},
        ${testInfo[0].test_file},
        ${label},
        ${score},
        ${reason},
        ${userId},
        NOW()
      )
      RETURNING *
    `

    return insertResult[0] as TestRelevanceScore
  }

  return result[0] as TestRelevanceScore
}

/**
 * Batch update relevance scores
 */
export async function batchSetRelevanceOverride(
  organizationId: number,
  updates: Array<{
    testSignature: string
    label: RelevanceLabel
    reason?: string
  }>,
  userId: number
): Promise<{ updated: number; failed: string[] }> {
  const failed: string[] = []
  let updated = 0

  for (const update of updates) {
    const score = labelToScore(update.label)
    const result = await setRelevanceOverride(
      organizationId,
      update.testSignature,
      score,
      update.label,
      update.reason ?? null,
      userId
    )

    if (result) {
      updated++
    } else {
      failed.push(update.testSignature)
    }
  }

  return { updated, failed }
}

/**
 * Remove manual override (revert to auto-calculated score)
 */
export async function removeRelevanceOverride(
  organizationId: number,
  testSignature: string
): Promise<boolean> {
  const sql = getSql()

  const result = await sql`
    UPDATE test_relevance_scores
    SET
      manual_relevance_label = NULL,
      manual_override_score = NULL,
      override_reason = NULL,
      overridden_by = NULL,
      overridden_at = NULL
    WHERE organization_id = ${organizationId}
      AND test_signature = ${testSignature}
    RETURNING id
  `

  return result.length > 0
}

// ============================================
// Path Criticality Patterns
// ============================================

/**
 * Get path criticality patterns (org-specific + defaults)
 */
export async function getPathCriticalityPatterns(
  organizationId: number
): Promise<PathCriticalityPattern[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM path_criticality_patterns
    WHERE organization_id = ${organizationId} OR organization_id IS NULL
    ORDER BY score DESC
  `

  return result as PathCriticalityPattern[]
}

/**
 * Add custom path criticality pattern for organization
 */
export async function addPathCriticalityPattern(
  organizationId: number,
  pattern: string,
  score: number,
  description?: string
): Promise<PathCriticalityPattern> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO path_criticality_patterns (
      organization_id,
      pattern,
      score,
      description,
      is_default
    ) VALUES (
      ${organizationId},
      ${pattern.toLowerCase()},
      ${score},
      ${description ?? null},
      false
    )
    ON CONFLICT (organization_id, pattern) DO UPDATE SET
      score = EXCLUDED.score,
      description = EXCLUDED.description
    RETURNING *
  `

  return result[0] as PathCriticalityPattern
}

/**
 * Delete custom path criticality pattern
 */
export async function deletePathCriticalityPattern(
  organizationId: number,
  patternId: number
): Promise<boolean> {
  const sql = getSql()

  const result = await sql`
    DELETE FROM path_criticality_patterns
    WHERE id = ${patternId}
      AND organization_id = ${organizationId}
      AND is_default = false
    RETURNING id
  `

  return result.length > 0
}

// ============================================
// Statistics
// ============================================

/**
 * Get relevance score statistics for an organization
 */
export async function getRelevanceStats(organizationId: number): Promise<{
  totalTests: number
  withManualLabels: number
  byLabel: Record<RelevanceLabel, number>
  averageScore: number
  criticalCount: number
  highCount: number
}> {
  const sql = getSql()

  const result = await sql`
    SELECT
      COUNT(*) as total_tests,
      COUNT(manual_relevance_label) as with_manual_labels,
      COUNT(*) FILTER (WHERE manual_relevance_label = 'critical') as critical_count,
      COUNT(*) FILTER (WHERE manual_relevance_label = 'high') as high_count,
      COUNT(*) FILTER (WHERE manual_relevance_label = 'medium') as medium_count,
      COUNT(*) FILTER (WHERE manual_relevance_label = 'low') as low_count,
      COUNT(*) FILTER (WHERE manual_relevance_label = 'ignore') as ignore_count,
      COUNT(*) FILTER (WHERE relevance_score >= 80) as score_critical_count,
      COUNT(*) FILTER (WHERE relevance_score >= 70 AND relevance_score < 80) as score_high_count,
      ROUND(AVG(relevance_score)::numeric, 1) as average_score
    FROM test_relevance_scores
    WHERE organization_id = ${organizationId}
  `

  const stats = result[0]

  return {
    totalTests: Number(stats.total_tests),
    withManualLabels: Number(stats.with_manual_labels),
    byLabel: {
      critical: Number(stats.critical_count),
      high: Number(stats.high_count),
      medium: Number(stats.medium_count),
      low: Number(stats.low_count),
      ignore: Number(stats.ignore_count),
    },
    averageScore: Number(stats.average_score) || 0,
    criticalCount: Number(stats.score_critical_count),
    highCount: Number(stats.score_high_count),
  }
}
