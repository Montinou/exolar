import { getSql } from "./connection"
import type { PerformanceRegressionsOptions } from "./types"
import type {
  PerformanceRegression,
  PerformanceRegressionSummary,
  DurationHistoryPoint,
} from "../types"

// ============================================
// Performance Regression Detection
// ============================================

/**
 * Update performance baselines for all tests in an organization
 * Calculates rolling 30-day average from test_results
 * Should be run as background job (daily recommended)
 */
export async function updatePerformanceBaselines(organizationId: number): Promise<number> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO test_performance_baselines (
      organization_id,
      test_signature,
      test_name,
      test_file,
      baseline_duration_ms,
      p50_duration_ms,
      p95_duration_ms,
      sample_count,
      last_updated_at
    )
    SELECT
      ${organizationId},
      COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
      tr.test_name,
      tr.test_file,
      ROUND(AVG(tr.duration_ms))::integer as baseline_duration_ms,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tr.duration_ms))::integer as p50,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY tr.duration_ms))::integer as p95,
      COUNT(*)::integer as sample_count,
      NOW()
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND te.started_at > NOW() - INTERVAL '30 days'
      AND tr.status IN ('passed', 'failed')
    GROUP BY tr.test_signature, tr.test_name, tr.test_file
    HAVING COUNT(*) >= 3
    ON CONFLICT (organization_id, test_signature)
    DO UPDATE SET
      baseline_duration_ms = EXCLUDED.baseline_duration_ms,
      p50_duration_ms = EXCLUDED.p50_duration_ms,
      p95_duration_ms = EXCLUDED.p95_duration_ms,
      sample_count = EXCLUDED.sample_count,
      last_updated_at = NOW()
    RETURNING id
  `

  return result.length
}

/**
 * Get performance regressions for an organization
 * Compares recent test performance against stored baselines
 *
 * @param options.threshold - Minimum regression to flag (default 0.20 = 20%)
 * @param options.hours - Look back window for recent performance (default 24)
 * @param options.branch - Filter by branch name
 * @param options.suite - Filter by test suite
 * @param options.limit - Max results (default 20)
 * @param options.sortBy - Sort by 'regression', 'duration', or 'name'
 */
export async function getPerformanceRegressions(
  organizationId: number,
  optionsOrThreshold?: PerformanceRegressionsOptions | number,
  hoursParam?: number
): Promise<PerformanceRegressionSummary> {
  const sql = getSql()

  // Support both old (threshold, hours) and new (options) signatures
  let options: PerformanceRegressionsOptions
  if (typeof optionsOrThreshold === "number") {
    options = { threshold: optionsOrThreshold, hours: hoursParam }
  } else {
    options = optionsOrThreshold || {}
  }

  const threshold = options.threshold ?? 0.20
  const hours = options.hours ?? 24
  const branch = options.branch
  const suite = options.suite
  const limit = options.limit ?? 20
  const sortBy = options.sortBy ?? "regression"

  // Build optional branch/suite filters
  const branchFilter = branch ? `AND te.branch = '${branch}'` : ""
  const suiteFilter = suite ? `AND te.suite = '${suite}'` : ""
  const extraFilters = branchFilter + suiteFilter

  // Build ORDER BY clause based on sortBy
  const orderByClause =
    sortBy === "duration"
      ? "current_avg_ms DESC"
      : sortBy === "name"
        ? "test_name ASC"
        : "regression_ratio DESC"

  // Build interval clause (can't use parameterized value inside INTERVAL)
  const hoursIntervalClause = `AND te.started_at > NOW() - INTERVAL '${hours} hours'`

  const regressions = await sql`
    WITH recent_performance AS (
      SELECT
        tr.test_name,
        tr.test_file,
        COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
        AVG(tr.duration_ms) as current_avg_ms,
        COUNT(*) as recent_runs
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        ${sql.unsafe(hoursIntervalClause)}
        AND tr.status IN ('passed', 'failed')
        ${sql.unsafe(extraFilters)}
      GROUP BY tr.test_name, tr.test_file, tr.test_signature
    ),
    trend_calc AS (
      SELECT
        rp.test_name,
        rp.test_file,
        rp.test_signature,
        rp.current_avg_ms,
        rp.recent_runs,
        tpb.baseline_duration_ms,
        CASE
          WHEN tpb.baseline_duration_ms > 0 THEN
            (rp.current_avg_ms - tpb.baseline_duration_ms)::float / tpb.baseline_duration_ms
          ELSE 0
        END as regression_ratio,
        -- Calculate trend from last 3 days
        (
          SELECT CASE
            WHEN AVG(CASE WHEN te2.started_at > NOW() - INTERVAL '1 day' THEN tr2.duration_ms END) >
                 AVG(CASE WHEN te2.started_at BETWEEN NOW() - INTERVAL '3 days' AND NOW() - INTERVAL '1 day' THEN tr2.duration_ms END) * 1.1
            THEN 'increasing'
            WHEN AVG(CASE WHEN te2.started_at > NOW() - INTERVAL '1 day' THEN tr2.duration_ms END) <
                 AVG(CASE WHEN te2.started_at BETWEEN NOW() - INTERVAL '3 days' AND NOW() - INTERVAL '1 day' THEN tr2.duration_ms END) * 0.9
            THEN 'decreasing'
            ELSE 'stable'
          END
          FROM test_results tr2
          JOIN test_executions te2 ON tr2.execution_id = te2.id
          WHERE te2.organization_id = ${organizationId}
            AND COALESCE(tr2.test_signature, MD5(tr2.test_file || '::' || tr2.test_name)) = rp.test_signature
            AND te2.started_at > NOW() - INTERVAL '3 days'
            ${sql.unsafe(extraFilters)}
        ) as trend
      FROM recent_performance rp
      JOIN test_performance_baselines tpb ON
        tpb.test_signature = rp.test_signature
        AND tpb.organization_id = ${organizationId}
    )
    SELECT
      test_name as "testName",
      test_file as "testFile",
      test_signature as "testSignature",
      ROUND(current_avg_ms)::integer as "currentAvgMs",
      baseline_duration_ms as "baselineDurationMs",
      ROUND(regression_ratio * 100)::integer as "regressionPercent",
      CASE
        WHEN regression_ratio > 0.5 THEN 'critical'
        ELSE 'warning'
      END as severity,
      recent_runs as "recentRuns",
      COALESCE(trend, 'stable') as trend
    FROM trend_calc
    WHERE regression_ratio > ${threshold}
    ORDER BY ${sql.unsafe(orderByClause)}
    LIMIT ${limit}
  `

  const regressionsArray = Array.isArray(regressions)
    ? (regressions as PerformanceRegression[])
    : (Array.from(regressions || []) as PerformanceRegression[])

  const criticalCount = regressionsArray.filter((r) => r.severity === "critical").length

  return {
    totalRegressions: regressionsArray.length,
    criticalCount,
    warningCount: regressionsArray.length - criticalCount,
    regressions: regressionsArray,
  }
}

/**
 * Get duration history for a specific test
 * Used for trend charts in performance analysis
 */
export async function getTestDurationHistory(
  organizationId: number,
  testSignature: string,
  days: number = 7
): Promise<DurationHistoryPoint[]> {
  const sql = getSql()

  const result = await sql`
    SELECT
      DATE(te.started_at) as date,
      ROUND(AVG(tr.duration_ms))::integer as "avgDuration",
      COUNT(*)::integer as "runCount"
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) = ${testSignature}
      AND te.started_at > NOW() - INTERVAL '${days} days'
      AND tr.status IN ('passed', 'failed')
    GROUP BY DATE(te.started_at)
    ORDER BY date ASC
  `

  return Array.isArray(result)
    ? (result as DurationHistoryPoint[])
    : (Array.from(result || []) as DurationHistoryPoint[])
}
