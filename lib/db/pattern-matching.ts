/**
 * Global Error Pattern Matching
 *
 * Matches new failures to existing global error patterns using vector similarity.
 * Creates new patterns when no match is found above the similarity threshold.
 *
 * Patterns persist across executions, providing cross-run error tracking.
 */

import { getSql } from "./connection"
import { toVectorString, parseVectorString, cosineSimilarity } from "@/lib/ai"

/** Result of matching a failure to a pattern */
export interface PatternMatchResult {
  patternId: number
  isNew: boolean
  distance: number
  category: string
}

/** Error categories for classification */
export type ErrorCategory =
  | "timeout"
  | "auth"
  | "network"
  | "element"
  | "assertion"
  | "other"

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  timeout: "Timeout",
  auth: "Authentication",
  network: "Network",
  element: "Element Not Found",
  assertion: "Assertion",
  other: "Other",
}

/**
 * Infer error category from error message text
 */
export function inferCategory(errorMessage: string): ErrorCategory {
  const msg = errorMessage.toLowerCase()

  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("waiting for") ||
    msg.includes("exceeded") ||
    msg.includes("deadline")
  ) {
    return "timeout"
  }

  if (
    msg.includes("auth") ||
    msg.includes("login") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("permission")
  ) {
    return "auth"
  }

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("connection") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("socket") ||
    msg.includes("dns")
  ) {
    return "network"
  }

  if (
    msg.includes("not found") ||
    msg.includes("no element") ||
    msg.includes("selector") ||
    msg.includes("locator") ||
    msg.includes("could not find") ||
    msg.includes("does not exist")
  ) {
    return "element"
  }

  if (
    msg.includes("expect") ||
    msg.includes("assert") ||
    msg.includes("tobe") ||
    msg.includes("toequal") ||
    msg.includes("tohave") ||
    msg.includes("tomatch") ||
    msg.includes("tocontain")
  ) {
    return "assertion"
  }

  return "other"
}

/**
 * Get human-readable label for a category
 */
export function getCategoryLabel(category: ErrorCategory): string {
  return CATEGORY_LABELS[category] || "Other"
}

/**
 * Match a failure to an existing pattern or create a new one
 *
 * @param organizationId - The organization context
 * @param errorMessage - The error message to match
 * @param embedding - The 512-dim Jina v2 embedding
 * @param executionId - The execution this failure belongs to
 * @param testResultId - The test result ID
 * @returns Pattern match result
 */
export async function matchOrCreatePattern(
  organizationId: number,
  errorMessage: string,
  embedding: number[],
  executionId: number,
  testResultId: number
): Promise<PatternMatchResult> {
  const SIMILARITY_THRESHOLD = 0.25 // ~75% similarity required

  const sql = getSql()
  const vectorStr = toVectorString(embedding)

  // 1. Find closest existing pattern using vector similarity
  const closestResult = await sql`
    SELECT
      id,
      canonical_error,
      category,
      centroid_embedding <=> ${vectorStr}::vector AS distance
    FROM error_patterns
    WHERE organization_id = ${organizationId}
      AND centroid_embedding IS NOT NULL
    ORDER BY centroid_embedding <=> ${vectorStr}::vector
    LIMIT 1
  `

  const closest = closestResult[0]

  // 2. Match or create
  if (closest && Number(closest.distance) < SIMILARITY_THRESHOLD) {
    // Link to existing pattern
    await sql`
      INSERT INTO error_pattern_occurrences (pattern_id, test_result_id, execution_id, distance_to_centroid)
      VALUES (${closest.id}, ${testResultId}, ${executionId}, ${closest.distance})
      ON CONFLICT (test_result_id) DO NOTHING
    `

    // Update pattern stats (use subqueries to avoid locking issues)
    await sql`
      UPDATE error_patterns SET
        total_occurrences = total_occurrences + 1,
        last_seen = NOW(),
        affected_executions = (
          SELECT COUNT(DISTINCT execution_id)
          FROM error_pattern_occurrences
          WHERE pattern_id = ${closest.id}
        ),
        affected_tests = (
          SELECT COUNT(DISTINCT tr.test_file || ':' || tr.test_name)
          FROM error_pattern_occurrences epo
          JOIN test_results tr ON tr.id = epo.test_result_id
          WHERE epo.pattern_id = ${closest.id}
        )
      WHERE id = ${closest.id}
    `

    return {
      patternId: Number(closest.id),
      isNew: false,
      distance: Number(closest.distance),
      category: closest.category as string,
    }
  } else {
    // Create new pattern
    const category = inferCategory(errorMessage)

    const newPatternResult = await sql`
      INSERT INTO error_patterns (
        organization_id, canonical_error, centroid_embedding, category
      ) VALUES (
        ${organizationId}, ${errorMessage}, ${vectorStr}::vector, ${category}
      )
      RETURNING id
    `

    const newPattern = newPatternResult[0]

    await sql`
      INSERT INTO error_pattern_occurrences (pattern_id, test_result_id, execution_id, distance_to_centroid)
      VALUES (${newPattern.id}, ${testResultId}, ${executionId}, 0)
    `

    return {
      patternId: Number(newPattern.id),
      isNew: true,
      distance: 0,
      category,
    }
  }
}

/**
 * Update test failure statistics
 *
 * Called when processing test results to track which tests fail most often.
 */
export async function updateTestFailureStats(
  organizationId: number,
  testFile: string,
  testTitle: string,
  isFailed: boolean,
  timestamp: Date = new Date()
): Promise<void> {
  const sql = getSql()
  const testSignature = `${testFile}:${testTitle}`

  if (isFailed) {
    // Insert or update failure stats
    await sql`
      INSERT INTO test_failure_stats (
        organization_id, test_signature, test_file, test_title,
        total_failures, total_runs, first_failure, last_failure
      ) VALUES (
        ${organizationId}, ${testSignature}, ${testFile}, ${testTitle},
        1, 1, ${timestamp.toISOString()}, ${timestamp.toISOString()}
      )
      ON CONFLICT (organization_id, test_signature) DO UPDATE SET
        total_failures = test_failure_stats.total_failures + 1,
        total_runs = test_failure_stats.total_runs + 1,
        last_failure = ${timestamp.toISOString()}
    `
  } else {
    // Just increment run count for passes
    await sql`
      INSERT INTO test_failure_stats (
        organization_id, test_signature, test_file, test_title,
        total_failures, total_runs, first_failure, last_failure
      ) VALUES (
        ${organizationId}, ${testSignature}, ${testFile}, ${testTitle},
        0, 1, NULL, NULL
      )
      ON CONFLICT (organization_id, test_signature) DO UPDATE SET
        total_runs = test_failure_stats.total_runs + 1
    `
  }
}

/**
 * Batch process failures for an execution
 *
 * Matches all failures in an execution to global patterns.
 */
export async function processExecutionFailures(
  executionId: number,
  organizationId: number
): Promise<{
  processed: number
  newPatterns: number
  matchedPatterns: number
}> {
  const sql = getSql()

  // Get all failures with v2 embeddings
  const failures = await sql`
    SELECT
      id,
      test_name,
      test_file,
      error_message,
      error_embedding_v2::text as embedding
    FROM test_results
    WHERE execution_id = ${executionId}
      AND status IN ('failed', 'timedout')
      AND error_embedding_v2 IS NOT NULL
      AND error_message IS NOT NULL
  `

  let newPatterns = 0
  let matchedPatterns = 0

  for (const failure of failures) {
    const embedding = parseVectorString(failure.embedding as string)

    const result = await matchOrCreatePattern(
      organizationId,
      failure.error_message as string,
      embedding,
      executionId,
      failure.id as number
    )

    if (result.isNew) {
      newPatterns++
    } else {
      matchedPatterns++
    }
  }

  return {
    processed: failures.length,
    newPatterns,
    matchedPatterns,
  }
}

/**
 * Get pattern statistics for an organization
 */
export async function getPatternStats(
  organizationId: number
): Promise<{
  totalPatterns: number
  totalOccurrences: number
  categoryBreakdown: Record<ErrorCategory, number>
}> {
  const sql = getSql()

  const [stats] = await sql`
    SELECT
      COUNT(*) as total_patterns,
      COALESCE(SUM(total_occurrences), 0) as total_occurrences
    FROM error_patterns
    WHERE organization_id = ${organizationId}
  `

  const categories = await sql`
    SELECT category, COUNT(*) as count
    FROM error_patterns
    WHERE organization_id = ${organizationId}
    GROUP BY category
  `

  const categoryBreakdown: Record<ErrorCategory, number> = {
    timeout: 0,
    auth: 0,
    network: 0,
    element: 0,
    assertion: 0,
    other: 0,
  }

  for (const row of categories) {
    const cat = row.category as ErrorCategory
    if (cat in categoryBreakdown) {
      categoryBreakdown[cat] = Number(row.count)
    }
  }

  return {
    totalPatterns: Number(stats?.total_patterns || 0),
    totalOccurrences: Number(stats?.total_occurrences || 0),
    categoryBreakdown,
  }
}
