import { getSql } from "./connection"
import type {
  FailureClassification,
  ClassificationSignal,
  ClassificationHistoricalMetrics,
  RecentRun,
  ClassificationOptions,
} from "../types"

// ============================================
// Failure Classification (Auto-Triage)
// ============================================

/**
 * Extract error type from AI context or raw error message
 */
function extractErrorType(
  aiContext: Record<string, unknown> | null,
  errorMessage: string | null
): string | null {
  // Try AI context first
  if (aiContext?.error && typeof aiContext.error === "object") {
    const error = aiContext.error as Record<string, unknown>
    if (error.type) return error.type as string
  }

  // Fall back to pattern matching on error message
  if (!errorMessage) return null

  if (errorMessage.includes("TimeoutError")) return "TimeoutError"
  if (errorMessage.includes("locator.click")) return "LocatorError"
  if (errorMessage.includes("locator.fill")) return "LocatorError"
  if (errorMessage.includes("expect(")) {
    if (errorMessage.includes("toBeTruthy")) return "AssertionError: toBeTruthy"
    if (errorMessage.includes("toBeVisible")) return "AssertionError: toBeVisible"
    if (errorMessage.includes("toHaveText")) return "AssertionError: toHaveText"
    if (errorMessage.includes("toEqual")) return "AssertionError: toEqual"
    return "AssertionError"
  }
  if (errorMessage.includes("NetworkError") || errorMessage.includes("net::")) return "NetworkError"
  if (errorMessage.includes("API Error") || errorMessage.includes("status: 5")) return "APIError"

  return "UnknownError"
}

/**
 * Calculate classification signals and determine FLAKE vs BUG
 */
function calculateClassificationSignals(
  failure: Record<string, unknown>,
  historical: { flakiness_rate: number; total_runs: number; passed_runs: number; failed_runs: number },
  recentRuns: Array<{ status: string; retry_count: number }>,
  errorType: string | null
): {
  flakeIndicators: ClassificationSignal[]
  bugIndicators: ClassificationSignal[]
  classification: "FLAKE" | "BUG" | "UNKNOWN"
  confidence: number
  reasoning: string
} {
  const flakeIndicators: ClassificationSignal[] = []
  const bugIndicators: ClassificationSignal[] = []

  const retryCount = Number(failure.retry_count)
  const status = failure.status as string

  // === FLAKE Indicators ===

  // 1. Retry succeeded (strongest flake signal)
  if (retryCount > 0 && status === "passed") {
    flakeIndicators.push({
      signal: "retry_succeeded",
      value: retryCount,
      weight: 0.4,
      category: "flake",
    })
  }

  // 2. High historical flakiness rate (>20%)
  if (historical.flakiness_rate > 20) {
    flakeIndicators.push({
      signal: "high_flakiness_rate",
      value: historical.flakiness_rate,
      weight: 0.3,
      category: "flake",
    })
  } else if (historical.flakiness_rate > 10) {
    flakeIndicators.push({
      signal: "moderate_flakiness_rate",
      value: historical.flakiness_rate,
      weight: 0.15,
      category: "flake",
    })
  }

  // 3. Error type suggests timing/environment
  const flakyErrorTypes = ["TimeoutError", "LocatorError", "NetworkError"]
  if (errorType && flakyErrorTypes.includes(errorType)) {
    flakeIndicators.push({
      signal: "timing_error_type",
      value: errorType,
      weight: 0.2,
      category: "flake",
    })
  }

  // 4. Recent runs show mixed results
  const recentPassed = recentRuns.filter((r) => r.status === "passed").length
  const recentFailed = recentRuns.filter((r) => r.status === "failed").length
  if (recentRuns.length >= 3 && recentPassed > 0 && recentFailed > 0) {
    flakeIndicators.push({
      signal: "mixed_recent_results",
      value: `${recentPassed}P/${recentFailed}F in last ${recentRuns.length}`,
      weight: 0.2,
      category: "flake",
    })
  }

  // 5. Recent flaky runs (retries > 0)
  const recentFlakyRuns = recentRuns.filter((r) => r.retry_count > 0).length
  if (recentFlakyRuns >= 2) {
    flakeIndicators.push({
      signal: "recent_flaky_runs",
      value: recentFlakyRuns,
      weight: 0.15,
      category: "flake",
    })
  }

  // === BUG Indicators ===

  // 1. No retry success (failed without passing on retry)
  if (retryCount === 0 && status === "failed") {
    bugIndicators.push({
      signal: "no_retry_success",
      value: true,
      weight: 0.35,
      category: "bug",
    })
  } else if (retryCount > 0 && status === "failed") {
    bugIndicators.push({
      signal: "failed_after_retries",
      value: retryCount,
      weight: 0.4,
      category: "bug",
    })
  }

  // 2. Low historical flakiness (<5%)
  if (historical.total_runs >= 5 && historical.flakiness_rate < 5) {
    bugIndicators.push({
      signal: "low_flakiness_rate",
      value: historical.flakiness_rate,
      weight: 0.25,
      category: "bug",
    })
  }

  // 3. Assertion error (logic issue)
  if (errorType && errorType.startsWith("AssertionError")) {
    bugIndicators.push({
      signal: "assertion_error_type",
      value: errorType,
      weight: 0.2,
      category: "bug",
    })
  }

  // 4. API error (backend issue)
  if (errorType === "APIError") {
    bugIndicators.push({
      signal: "api_error_type",
      value: true,
      weight: 0.25,
      category: "bug",
    })
  }

  // 5. Consistent failure pattern (all recent failures)
  if (recentRuns.length >= 3 && recentFailed >= recentRuns.length - 1) {
    bugIndicators.push({
      signal: "consistent_failure_pattern",
      value: `${recentFailed}/${recentRuns.length} failed`,
      weight: 0.3,
      category: "bug",
    })
  }

  // 6. New test with failure (insufficient history)
  if (historical.total_runs < 5) {
    bugIndicators.push({
      signal: "insufficient_history",
      value: historical.total_runs,
      weight: 0.1,
      category: "bug",
    })
  }

  // === Calculate Classification ===
  const flakeScore = flakeIndicators.reduce((sum, i) => sum + i.weight, 0)
  const bugScore = bugIndicators.reduce((sum, i) => sum + i.weight, 0)
  const totalScore = flakeScore + bugScore

  let classification: "FLAKE" | "BUG" | "UNKNOWN"
  let confidence: number
  let reasoning: string

  if (totalScore === 0) {
    classification = "UNKNOWN"
    confidence = 0
    reasoning = "Insufficient data to classify. Need more test history."
  } else if (flakeScore > bugScore * 1.3) {
    classification = "FLAKE"
    confidence = Math.min(0.95, flakeScore / (flakeScore + bugScore))
    const topSignals = flakeIndicators
      .slice(0, 2)
      .map((i) => i.signal)
      .join(", ")
    reasoning = `Likely flaky based on: ${topSignals}. Historical flakiness: ${historical.flakiness_rate}%.`
  } else if (bugScore > flakeScore * 1.3) {
    classification = "BUG"
    confidence = Math.min(0.95, bugScore / (flakeScore + bugScore))
    const topSignals = bugIndicators
      .slice(0, 2)
      .map((i) => i.signal)
      .join(", ")
    reasoning = `Likely a real bug based on: ${topSignals}. Failure rate: ${Math.round((historical.failed_runs / historical.total_runs) * 100)}%.`
  } else {
    classification = "UNKNOWN"
    confidence = 0.5
    reasoning = `Mixed signals - both flake and bug indicators present. Manual review recommended.`
  }

  return {
    flakeIndicators: flakeIndicators.sort((a, b) => b.weight - a.weight),
    bugIndicators: bugIndicators.sort((a, b) => b.weight - a.weight),
    classification,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
  }
}

/**
 * Get comprehensive failure classification data for a test
 * Combines current failure info, historical flakiness, and classification signals
 */
export async function getFailureClassification(
  organizationId: number,
  options: ClassificationOptions
): Promise<FailureClassification | null> {
  const sql = getSql()

  // Must have either testId OR (executionId + testName)
  if (!options.testId && (!options.executionId || !options.testName)) {
    return null
  }

  // Step 1: Get the current failure record
  let failureQuery: string
  if (options.testId) {
    failureQuery = `
      SELECT
        tr.id as result_id,
        tr.execution_id,
        tr.test_name,
        tr.test_file,
        COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
        tr.status,
        tr.retry_count,
        tr.error_message,
        tr.stack_trace,
        tr.duration_ms,
        tr.browser,
        tr.ai_context,
        tr.started_at
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE tr.id = ${options.testId}
        AND te.organization_id = ${organizationId}
      LIMIT 1
    `
  } else {
    const fileCondition = options.testFile
      ? `AND tr.test_file = '${options.testFile.replace(/'/g, "''")}'`
      : ""
    failureQuery = `
      SELECT
        tr.id as result_id,
        tr.execution_id,
        tr.test_name,
        tr.test_file,
        COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
        tr.status,
        tr.retry_count,
        tr.error_message,
        tr.stack_trace,
        tr.duration_ms,
        tr.browser,
        tr.ai_context,
        tr.started_at
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE tr.execution_id = ${options.executionId}
        AND tr.test_name = '${options.testName!.replace(/'/g, "''")}'
        ${fileCondition}
        AND te.organization_id = ${organizationId}
      ORDER BY tr.retry_count DESC
      LIMIT 1
    `
  }

  const failureResult = (await sql.unsafe(failureQuery)) as unknown as Record<string, unknown>[]
  if (!failureResult || failureResult.length === 0) {
    return null
  }

  const failure = failureResult[0] as Record<string, unknown>
  const testSignature = failure.test_signature as string

  // Step 2: Get historical metrics from test_flakiness_history
  const historyResult = await sql`
    SELECT
      total_runs,
      flaky_runs,
      failed_runs,
      passed_runs,
      flakiness_rate,
      CASE
        WHEN total_runs > 0 THEN ROUND(failed_runs::decimal / total_runs * 100, 2)
        ELSE 0
      END as failure_rate,
      avg_duration_ms,
      last_flaky_at,
      last_passed_at,
      last_failed_at,
      first_seen_at
    FROM test_flakiness_history
    WHERE test_signature = ${testSignature}
      AND organization_id = ${organizationId}
    LIMIT 1
  `

  // Default historical metrics if no history exists
  const historicalMetrics: ClassificationHistoricalMetrics =
    historyResult.length > 0
      ? {
          total_runs: Number(historyResult[0].total_runs),
          flaky_runs: Number(historyResult[0].flaky_runs),
          failed_runs: Number(historyResult[0].failed_runs),
          passed_runs: Number(historyResult[0].passed_runs),
          flakiness_rate: Number(historyResult[0].flakiness_rate),
          failure_rate: Number(historyResult[0].failure_rate),
          avg_duration_ms: Number(historyResult[0].avg_duration_ms),
          last_flaky_at: historyResult[0].last_flaky_at as string | null,
          last_passed_at: historyResult[0].last_passed_at as string | null,
          last_failed_at: historyResult[0].last_failed_at as string | null,
          first_seen_at: historyResult[0].first_seen_at as string,
        }
      : {
          total_runs: 1,
          flaky_runs: 0,
          failed_runs: 1,
          passed_runs: 0,
          flakiness_rate: 0,
          failure_rate: 100,
          avg_duration_ms: Number(failure.duration_ms),
          last_flaky_at: null,
          last_passed_at: null,
          last_failed_at: failure.started_at as string,
          first_seen_at: failure.started_at as string,
        }

  // Step 3: Get recent runs (last 10)
  const recentRunsResult = await sql`
    SELECT
      tr.execution_id,
      tr.status,
      tr.retry_count,
      tr.duration_ms,
      te.branch,
      tr.started_at as occurred_at
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) = ${testSignature}
      AND te.organization_id = ${organizationId}
      AND tr.retry_count = 0
    ORDER BY tr.started_at DESC
    LIMIT 10
  `

  const recentRuns: RecentRun[] = (recentRunsResult as Record<string, unknown>[]).map((r) => ({
    execution_id: Number(r.execution_id),
    status: r.status as string,
    retry_count: Number(r.retry_count),
    duration_ms: Number(r.duration_ms),
    branch: r.branch as string,
    occurred_at: r.occurred_at as string,
  }))

  // Step 4: Extract error type from AI context or error message
  const aiContext = failure.ai_context as Record<string, unknown> | null
  const errorMessage = failure.error_message as string | null
  const errorType = extractErrorType(aiContext, errorMessage)
  const failedStep = (aiContext?.last_step as string) || null

  // Step 5: Calculate classification signals
  const { flakeIndicators, bugIndicators, classification, confidence, reasoning } =
    calculateClassificationSignals(failure, historicalMetrics, recentRuns, errorType)

  return {
    test_id: `${failure.test_file}::${failure.test_name}`,
    test_signature: testSignature,
    current_failure: {
      execution_id: Number(failure.execution_id),
      result_id: Number(failure.result_id),
      status: failure.status as string,
      retry_count: Number(failure.retry_count),
      error_type: errorType,
      error_message: errorMessage,
      failed_step: failedStep,
      duration_ms: Number(failure.duration_ms),
      browser: failure.browser as string,
      occurred_at: failure.started_at as string,
    },
    historical_metrics: historicalMetrics,
    recent_runs: recentRuns,
    classification_signals: {
      flake_indicators: flakeIndicators,
      bug_indicators: bugIndicators,
    },
    suggested_classification: classification,
    confidence,
    reasoning,
  }
}
