import { getSql } from "./connection"
import { getExecutionById } from "./executions"
import type {
  TestExecution,
  ComparisonResult,
  TestComparisonItem,
} from "../types"

// ============================================
// Comparative Run Analysis Functions
// ============================================

/**
 * Get the latest execution for a branch, optionally filtered by suite
 * Used for branch-to-branch comparison
 */
export async function getLatestExecutionByBranch(
  organizationId: number,
  branch: string,
  suite?: string
): Promise<TestExecution | null> {
  const sql = getSql()

  const suiteFilter = suite ? `AND suite = '${suite}'` : ""

  const result = await sql`
    SELECT *
    FROM test_executions
    WHERE organization_id = ${organizationId}
      AND branch = ${branch}
      ${sql.unsafe(suiteFilter)}
    ORDER BY started_at DESC
    LIMIT 1
  `

  return result.length > 0 ? (result[0] as TestExecution) : null
}

/**
 * Compare two test executions and return detailed diff
 * Uses FULL OUTER JOIN to detect new, removed, and changed tests
 */
export async function compareExecutions(
  organizationId: number,
  baselineExecutionId: number,
  currentExecutionId: number,
  options?: { performanceThreshold?: number }
): Promise<ComparisonResult> {
  const sql = getSql()
  const threshold = options?.performanceThreshold ?? 20

  // Get execution metadata for both executions
  const [baseline, current] = await Promise.all([
    getExecutionById(organizationId, baselineExecutionId),
    getExecutionById(organizationId, currentExecutionId),
  ])

  if (!baseline) {
    throw new Error(`Baseline execution ${baselineExecutionId} not found`)
  }
  if (!current) {
    throw new Error(`Current execution ${currentExecutionId} not found`)
  }

  // Get test-level comparison using FULL OUTER JOIN
  const testDiffs = await sql`
    WITH baseline_tests AS (
      SELECT
        COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
        tr.test_name,
        tr.test_file,
        tr.status,
        tr.duration_ms
      FROM test_results tr
      WHERE tr.execution_id = ${baselineExecutionId}
        AND tr.retry_count = 0
    ),
    current_tests AS (
      SELECT
        COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
        tr.test_name,
        tr.test_file,
        tr.status,
        tr.duration_ms
      FROM test_results tr
      WHERE tr.execution_id = ${currentExecutionId}
        AND tr.retry_count = 0
    )
    SELECT
      COALESCE(b.test_signature, c.test_signature) as "testSignature",
      COALESCE(b.test_name, c.test_name) as "testName",
      COALESCE(b.test_file, c.test_file) as "testFile",
      b.status as "baselineStatus",
      c.status as "currentStatus",
      b.duration_ms as "baselineDurationMs",
      c.duration_ms as "currentDurationMs",
      CASE
        WHEN b.duration_ms IS NOT NULL AND c.duration_ms IS NOT NULL THEN
          (c.duration_ms::bigint - b.duration_ms::bigint)
        ELSE NULL
      END as "durationDeltaMs",
      CASE
        WHEN b.duration_ms IS NOT NULL AND b.duration_ms > 0 AND c.duration_ms IS NOT NULL THEN
          ROUND(((c.duration_ms::float - b.duration_ms::float) / b.duration_ms::float * 100))::integer
        ELSE NULL
      END as "durationDeltaPercent",
      CASE
        WHEN b.test_signature IS NULL THEN 'new_test'
        WHEN c.test_signature IS NULL THEN 'removed_test'
        WHEN b.status = 'passed' AND c.status = 'failed' THEN 'new_failure'
        WHEN b.status = 'failed' AND c.status = 'passed' THEN 'fixed'
        ELSE 'unchanged'
      END as "diffCategory",
      CASE
        WHEN b.test_signature IS NULL THEN NULL
        WHEN c.test_signature IS NULL THEN NULL
        WHEN b.duration_ms IS NULL OR b.duration_ms = 0 OR c.duration_ms IS NULL THEN NULL
        WHEN ((c.duration_ms::float - b.duration_ms::float) / b.duration_ms::float * 100) > ${threshold}::float THEN 'regression'
        WHEN ((c.duration_ms::float - b.duration_ms::float) / b.duration_ms::float * 100) < (0::float - ${threshold}::float) THEN 'improvement'
        ELSE 'stable'
      END as "durationCategory"
    FROM baseline_tests b
    FULL OUTER JOIN current_tests c ON b.test_signature = c.test_signature
    ORDER BY
      CASE
        WHEN b.test_signature IS NULL THEN 1
        WHEN c.test_signature IS NULL THEN 2
        WHEN b.status = 'passed' AND c.status = 'failed' THEN 0
        WHEN b.status = 'failed' AND c.status = 'passed' THEN 3
        ELSE 4
      END,
      "testName" ASC
  `

  const tests = Array.isArray(testDiffs)
    ? (testDiffs as TestComparisonItem[])
    : (Array.from(testDiffs || []) as TestComparisonItem[])

  // Calculate summary statistics
  const newFailures = tests.filter((t) => t.diffCategory === "new_failure").length
  const fixed = tests.filter((t) => t.diffCategory === "fixed").length
  const newTests = tests.filter((t) => t.diffCategory === "new_test").length
  const removedTests = tests.filter((t) => t.diffCategory === "removed_test").length
  const unchanged = tests.filter((t) => t.diffCategory === "unchanged").length

  const baselinePassRate =
    baseline.total_tests > 0 ? Math.round((baseline.passed / baseline.total_tests) * 100) : 0
  const currentPassRate =
    current.total_tests > 0 ? Math.round((current.passed / current.total_tests) * 100) : 0

  const baselineAvgDurationMs =
    baseline.total_tests > 0 && baseline.duration_ms
      ? Math.round(baseline.duration_ms / baseline.total_tests)
      : 0
  const currentAvgDurationMs =
    current.total_tests > 0 && current.duration_ms
      ? Math.round(current.duration_ms / current.total_tests)
      : 0

  const durationDeltaMs = currentAvgDurationMs - baselineAvgDurationMs
  const durationDeltaPercent =
    baselineAvgDurationMs > 0 ? Math.round((durationDeltaMs / baselineAvgDurationMs) * 100) : 0

  return {
    baseline: {
      id: baseline.id,
      branch: baseline.branch,
      commitSha: baseline.commit_sha,
      suite: baseline.suite,
      status: baseline.status,
      startedAt: baseline.started_at,
      totalTests: baseline.total_tests,
      passed: baseline.passed,
      failed: baseline.failed,
    },
    current: {
      id: current.id,
      branch: current.branch,
      commitSha: current.commit_sha,
      suite: current.suite,
      status: current.status,
      startedAt: current.started_at,
      totalTests: current.total_tests,
      passed: current.passed,
      failed: current.failed,
    },
    summary: {
      baselinePassRate,
      currentPassRate,
      passRateDelta: currentPassRate - baselinePassRate,
      baselineTotalTests: baseline.total_tests,
      currentTotalTests: current.total_tests,
      testCountDelta: current.total_tests - baseline.total_tests,
      baselineAvgDurationMs,
      currentAvgDurationMs,
      durationDeltaMs,
      durationDeltaPercent,
      newFailures,
      fixed,
      newTests,
      removedTests,
      unchanged,
    },
    tests,
  }
}
