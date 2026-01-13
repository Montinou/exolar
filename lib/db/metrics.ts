import { getSql } from "./connection"
import type {
  DateRangeFilter,
  TrendOptions,
  TrendDataPoint,
  BranchStatistics,
  SuiteStatistics,
  SlowestTest,
  SuitePassRate,
  ReliabilityScoreOptions,
} from "./types"
import type {
  DashboardMetrics,
  FailureTrendData,
  ReliabilityScore,
} from "../types"

// ============================================
// Dashboard Metrics
// ============================================

/**
 * Options for getDashboardMetrics
 * Extends DateRangeFilter with lastRunOnly and branch/suite filters
 */
export interface DashboardMetricsOptions extends DateRangeFilter {
  lastRunOnly?: boolean
  branch?: string
  suite?: string
}

/**
 * Get the ID of the most recent completed execution matching filters.
 * Uses completed_at for ordering to handle parallel executions correctly (Issue 7 fix).
 */
export async function getLatestExecutionId(
  organizationId: number,
  branch?: string,
  suite?: string
): Promise<number | null> {
  const sql = getSql()

  const conditions = [`organization_id = ${organizationId}`, "completed_at IS NOT NULL"]
  if (branch) conditions.push(`branch = '${branch.replace(/'/g, "''")}'`)
  if (suite) conditions.push(`suite = '${suite.replace(/'/g, "''")}'`)

  const whereClause = conditions.join(" AND ")

  const result = await sql`
    SELECT id FROM test_executions
    WHERE ${sql.unsafe(whereClause)}
    ORDER BY completed_at DESC
    LIMIT 1
  `

  return result[0]?.id ?? null
}

export async function getDashboardMetrics(
  organizationId: number,
  options?: DashboardMetricsOptions | DateRangeFilter
) {
  // Handle both old DateRangeFilter and new DashboardMetricsOptions
  const opts: DashboardMetricsOptions = options || {}
  const dateRange: DateRangeFilter | undefined = opts.from || opts.to ? { from: opts.from, to: opts.to } : undefined
  const lastRunOnly = "lastRunOnly" in opts ? opts.lastRunOnly : false
  const branch = "branch" in opts ? opts.branch : undefined
  const suite = "suite" in opts ? opts.suite : undefined
  const sql = getSql()

  // When lastRunOnly=true, filter to the latest execution matching branch/suite
  let latestExecutionId: number | null = null
  if (lastRunOnly && (branch || suite)) {
    latestExecutionId = await getLatestExecutionId(organizationId, branch, suite)
    if (!latestExecutionId) {
      // No execution found, return empty metrics
      return {
        total_executions: 0,
        pass_rate: 0,
        failure_rate: 0,
        avg_duration_ms: 0,
        critical_failures: 0,
        last_24h_executions: 0,
        failure_volume: 0,
        latestPassRate: null,
        flakyTests: 0,
      } as DashboardMetrics
    }
  }

  const conditions = ["completed_at IS NOT NULL", `organization_id = ${organizationId}`]

  // Add branch/suite filters
  if (branch) conditions.push(`branch = '${branch.replace(/'/g, "''")}'`)
  if (suite) conditions.push(`suite = '${suite.replace(/'/g, "''")}'`)

  // If lastRunOnly, filter to specific execution
  if (latestExecutionId) {
    conditions.push(`id = ${latestExecutionId}`)
  }

  if (dateRange?.from) {
    conditions.push(`started_at >= '${dateRange.from}'`)
  }

  if (dateRange?.to) {
    conditions.push(`started_at <= '${dateRange.to}'`)
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`

  const metrics = await sql`
    SELECT
      COUNT(*) as total_executions,
      ROUND(AVG(CASE WHEN status = 'success' THEN 100 ELSE 0 END), 2) as pass_rate,
      CASE
        WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status = 'failure')::decimal / COUNT(*) * 100, 1)
        ELSE 0
      END as failure_rate,
      ROUND(AVG(duration_ms)) as avg_duration_ms,
      COUNT(*) FILTER (WHERE status = 'failure' AND started_at > NOW() - INTERVAL '24 hours') as last_24h_failures,
      COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') as last_24h_executions,
      COUNT(*) FILTER (WHERE status = 'failure') as failure_volume
    FROM test_executions
    ${sql.unsafe(whereClause)}
  `

  const criticalConditions = [
    "tr.is_critical = true",
    "tr.status = 'failed'",
    `te.organization_id = ${organizationId}`,
  ]

  // Add branch/suite/executionId filters to critical query
  if (branch) criticalConditions.push(`te.branch = '${branch.replace(/'/g, "''")}'`)
  if (suite) criticalConditions.push(`te.suite = '${suite.replace(/'/g, "''")}'`)
  if (latestExecutionId) criticalConditions.push(`te.id = ${latestExecutionId}`)

  if (dateRange?.from) {
    criticalConditions.push(`te.started_at >= '${dateRange.from}'`)
  } else if (!latestExecutionId) {
    criticalConditions.push("te.started_at > NOW() - INTERVAL '7 days'")
  }

  if (dateRange?.to) {
    criticalConditions.push(`te.started_at <= '${dateRange.to}'`)
  }

  const criticalWhereClause = `WHERE ${criticalConditions.join(" AND ")}`

  const criticalFailures = await sql`
    SELECT COUNT(DISTINCT tr.id) as critical_failures
    FROM test_results tr
    JOIN test_executions te ON te.id = tr.execution_id
    ${sql.unsafe(criticalWhereClause)}
  `

  // Get latest execution test counts for donut chart
  // If lastRunOnly and we have an execution, use that specific one
  // Otherwise, get the most recent execution matching filters
  // Uses completed_at for ordering (Issue 7 fix)
  const latestExecConditions = [
    `organization_id = ${organizationId}`,
    "completed_at IS NOT NULL",
  ]
  if (latestExecutionId) {
    latestExecConditions.push(`id = ${latestExecutionId}`)
  } else {
    if (branch) latestExecConditions.push(`branch = '${branch.replace(/'/g, "''")}'`)
    if (suite) latestExecConditions.push(`suite = '${suite.replace(/'/g, "''")}'`)
  }

  const latestExecution = await sql`
    SELECT total_tests, passed, failed, skipped
    FROM test_executions
    WHERE ${sql.unsafe(latestExecConditions.join(" AND "))}
    ORDER BY completed_at DESC
    LIMIT 1
  `

  // Get count of flaky tests (tests that have had at least one flaky run)
  const flakyCount = await sql`
    SELECT COUNT(*) as flaky_count
    FROM test_flakiness_history
    WHERE organization_id = ${organizationId}
      AND flaky_runs > 0
  `

  return {
    total_executions: Number(metrics[0].total_executions),
    pass_rate: Number(metrics[0].pass_rate),
    failure_rate: Number(metrics[0].failure_rate),
    avg_duration_ms: Number(metrics[0].avg_duration_ms),
    critical_failures: Number(criticalFailures[0].critical_failures),
    last_24h_executions: Number(metrics[0].last_24h_executions),
    failure_volume: Number(metrics[0].failure_volume),
    latestPassRate: latestExecution[0] ? {
      total_tests: Number(latestExecution[0].total_tests),
      passed_tests: Number(latestExecution[0].passed),
      failed_tests: Number(latestExecution[0].failed),
      skipped_tests: Number(latestExecution[0].skipped),
    } : null,
    flakyTests: Number(flakyCount[0].flaky_count) || 0,
  } as DashboardMetrics
}

// ============================================
// Trend Data
// ============================================

/**
 * Get trend data with flexible time granularity.
 * Supports hourly, daily, weekly, and monthly aggregation.
 */
export async function getTrendData(
  organizationId: number,
  options: TrendOptions | number = {}
): Promise<TrendDataPoint[]> {
  const sql = getSql()

  // Handle backwards compatibility: if number passed, treat as days
  const opts: TrendOptions = typeof options === 'number'
    ? { days: options, period: 'day' }
    : options

  const { period = 'day', count, days, from, to } = opts

  const conditions = [
    "completed_at IS NOT NULL",
    `organization_id = ${organizationId}`
  ]

  // Determine time filtering
  if (from) {
    conditions.push(`started_at >= '${from}'`)
  } else if (count || days) {
    const lookback = count || days || 7
    const interval = period === 'hour' ? 'hours' :
                     period === 'day' ? 'days' :
                     period === 'week' ? 'weeks' : 'months'
    conditions.push(`started_at > NOW() - INTERVAL '${lookback} ${interval}'`)
  } else {
    // Default: last 7 of the period type
    const interval = period === 'hour' ? 'hours' :
                     period === 'day' ? 'days' :
                     period === 'week' ? 'weeks' : 'months'
    conditions.push(`started_at > NOW() - INTERVAL '7 ${interval}'`)
  }

  if (to) {
    conditions.push(`started_at <= '${to}'`)
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`

  // DATE_TRUNC works for all granularities
  const truncExpr = period === 'hour' ? "DATE_TRUNC('hour', started_at)" :
                    period === 'day' ? "DATE_TRUNC('day', started_at)" :
                    period === 'week' ? "DATE_TRUNC('week', started_at)" :
                    "DATE_TRUNC('month', started_at)"

  const query = `
    SELECT
      ${truncExpr} as period,
      COUNT(*) as executions,
      COUNT(*) FILTER (WHERE status = 'success') as passed,
      COUNT(*) FILTER (WHERE status = 'failure') as failed,
      COUNT(*) FILTER (WHERE status NOT IN ('success', 'failure')) as skipped,
      CASE
        WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status = 'success')::decimal / COUNT(*) * 100, 1)
        ELSE 0
      END as pass_rate
    FROM test_executions
    ${whereClause}
    GROUP BY ${truncExpr}
    ORDER BY period ASC
  `

  const result = await sql.unsafe(query) as unknown as Record<string, unknown>[]

  return result.map((r) => ({
    period: r.period instanceof Date ? r.period.toISOString() : String(r.period),
    executions: Number(r.executions),
    passed: Number(r.passed),
    failed: Number(r.failed),
    skipped: Number(r.skipped),
    pass_rate: Number(r.pass_rate) || 0,
  }))
}

export async function getFailureTrendData(
  organizationId: number,
  days = 7,
  dateRange?: DateRangeFilter
): Promise<FailureTrendData[]> {
  const sql = getSql()
  const conditions = ["status != 'running'", `organization_id = ${organizationId}`]

  if (dateRange?.from) {
    conditions.push(`started_at >= '${dateRange.from}'`)
  } else {
    conditions.push(`started_at > NOW() - INTERVAL '${days} days'`)
  }

  if (dateRange?.to) {
    conditions.push(`started_at <= '${dateRange.to}'`)
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`

  const result = await sql`
    SELECT
      DATE(started_at) as date,
      COUNT(*) as total_tests,
      COUNT(*) FILTER (WHERE status = 'failure') as failed_tests,
      CASE
        WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status = 'failure')::decimal / COUNT(*) * 100, 2)
        ELSE 0
      END as failure_rate
    FROM test_executions
    ${sql.unsafe(whereClause)}
    GROUP BY DATE(started_at)
    ORDER BY date ASC
  `

  return result as FailureTrendData[]
}

// ============================================
// Branch/Suite Statistics
// ============================================

/**
 * Get branches with full statistics.
 * Includes pass_rate, last_status, execution_count, and last_run.
 */
export async function getBranches(
  organizationId: number,
  days: number = 30
): Promise<BranchStatistics[]> {
  const sql = getSql()

  const result = await sql`
    WITH branch_stats AS (
      SELECT
        branch,
        MAX(started_at) as last_run,
        COUNT(*) as execution_count,
        ROUND(
          AVG(CASE WHEN status = 'success' THEN 100 ELSE 0 END)::numeric,
          1
        ) as pass_rate
      FROM test_executions
      WHERE organization_id = ${organizationId}
        AND started_at > NOW() - MAKE_INTERVAL(days => ${days})
      GROUP BY branch
    ),
    branch_last_status AS (
      SELECT DISTINCT ON (branch)
        branch,
        status as last_status
      FROM test_executions
      WHERE organization_id = ${organizationId}
        AND started_at > NOW() - MAKE_INTERVAL(days => ${days})
      ORDER BY branch, started_at DESC
    )
    SELECT
      bs.branch,
      bs.last_run,
      bs.execution_count,
      bs.pass_rate,
      bls.last_status
    FROM branch_stats bs
    LEFT JOIN branch_last_status bls ON bs.branch = bls.branch
    ORDER BY bs.last_run DESC NULLS LAST
  `

  return result.map((r) => ({
    branch: r.branch as string,
    last_run: r.last_run ? (r.last_run as Date).toISOString() : null,
    execution_count: Number(r.execution_count),
    pass_rate: Number(r.pass_rate) || 0,
    last_status: r.last_status as BranchStatistics["last_status"],
  }))
}

/**
 * Get suites with full statistics.
 * Includes pass_rate, last_status, execution_count, and last_run.
 */
export async function getSuites(
  organizationId: number,
  days: number = 30
): Promise<SuiteStatistics[]> {
  const sql = getSql()

  const result = await sql`
    WITH suite_stats AS (
      SELECT
        suite,
        MAX(started_at) as last_run,
        COUNT(*) as execution_count,
        ROUND(
          AVG(CASE WHEN status = 'success' THEN 100 ELSE 0 END)::numeric,
          1
        ) as pass_rate
      FROM test_executions
      WHERE suite IS NOT NULL
        AND organization_id = ${organizationId}
        AND started_at > NOW() - MAKE_INTERVAL(days => ${days})
      GROUP BY suite
    ),
    suite_last_status AS (
      SELECT DISTINCT ON (suite)
        suite,
        status as last_status
      FROM test_executions
      WHERE suite IS NOT NULL
        AND organization_id = ${organizationId}
        AND started_at > NOW() - MAKE_INTERVAL(days => ${days})
      ORDER BY suite, started_at DESC
    )
    SELECT
      ss.suite,
      ss.last_run,
      ss.execution_count,
      ss.pass_rate,
      sls.last_status
    FROM suite_stats ss
    LEFT JOIN suite_last_status sls ON ss.suite = sls.suite
    ORDER BY ss.last_run DESC NULLS LAST
  `

  return result.map((r) => ({
    suite: r.suite as string,
    last_run: r.last_run ? (r.last_run as Date).toISOString() : null,
    execution_count: Number(r.execution_count),
    pass_rate: Number(r.pass_rate) || 0,
    last_status: r.last_status as SuiteStatistics["last_status"],
  }))
}

// ============================================
// Dashboard Analytics
// ============================================

export async function getSlowestTests(
  organizationId: number,
  limit: number = 5,
  minRuns: number = 3
): Promise<SlowestTest[]> {
  const sql = getSql()

  const result = await sql`
    SELECT
      COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
      tr.test_name,
      tr.test_file,
      ROUND(AVG(tr.duration_ms)) as avg_duration_ms,
      COUNT(*) as run_count
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND te.started_at > NOW() - INTERVAL '7 days'
    GROUP BY tr.test_signature, tr.test_name, tr.test_file
    HAVING COUNT(*) >= ${minRuns}
    ORDER BY avg_duration_ms DESC
    LIMIT ${limit}
  `

  return result as SlowestTest[]
}

export async function getSuitePassRates(organizationId: number): Promise<SuitePassRate[]> {
  const sql = getSql()

  const result = await sql`
    WITH suite_stats AS (
      SELECT
        suite,
        COUNT(*) as total_runs,
        ROUND(COUNT(*) FILTER (WHERE status = 'success')::decimal / COUNT(*) * 100, 1) as pass_rate
      FROM test_executions
      WHERE organization_id = ${organizationId}
        AND suite IS NOT NULL
        AND started_at > NOW() - INTERVAL '7 days'
      GROUP BY suite
    ),
    failed_tests AS (
      SELECT
        te.suite,
        tr.test_name,
        COUNT(*) as failure_count
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND te.suite IS NOT NULL
        AND te.started_at > NOW() - INTERVAL '7 days'
        AND tr.status = 'failed'
      GROUP BY te.suite, tr.test_name
    ),
    ranked_failures AS (
      SELECT
        suite,
        test_name,
        ROW_NUMBER() OVER (PARTITION BY suite ORDER BY failure_count DESC) as rn
      FROM failed_tests
    ),
    aggregated_failures AS (
      SELECT
        suite,
        array_agg(test_name ORDER BY rn) FILTER (WHERE rn <= 5) as failed_tests,
        COUNT(*) as failed_count
      FROM ranked_failures
      GROUP BY suite
    )
    SELECT
      ss.suite,
      ss.total_runs,
      ss.pass_rate,
      COALESCE(af.failed_tests, '{}') as failed_tests,
      COALESCE(af.failed_count, 0) as failed_count
    FROM suite_stats ss
    LEFT JOIN aggregated_failures af ON ss.suite = af.suite
    ORDER BY ss.pass_rate ASC
  `

  return result.map((r) => ({
    suite: r.suite as string,
    total_runs: Number(r.total_runs),
    pass_rate: Number(r.pass_rate),
    failed_tests: (r.failed_tests as string[]) || [],
    failed_count: Number(r.failed_count) || 0,
  }))
}

// ============================================
// Reliability Score
// ============================================

/**
 * Calculate overall test suite reliability score (0-100)
 * Formula: (PassRate * 0.4) + ((1 - FlakyRate) * 0.3) + (DurationStability * 0.3)
 */
export async function getReliabilityScore(
  organizationId: number,
  options?: ReliabilityScoreOptions | DateRangeFilter
): Promise<ReliabilityScore> {
  const sql = getSql()

  // Handle both old DateRangeFilter and new ReliabilityScoreOptions
  const opts: ReliabilityScoreOptions = options || {}
  const from = opts.from
  const to = opts.to
  const branch = "branch" in opts ? opts.branch : undefined
  const suite = "suite" in opts ? opts.suite : undefined
  const lastRunOnly = "lastRunOnly" in opts ? opts.lastRunOnly : false

  // When lastRunOnly=true, filter to the latest execution matching branch/suite
  let latestExecutionId: number | null = null
  if (lastRunOnly && (branch || suite)) {
    latestExecutionId = await getLatestExecutionId(organizationId, branch, suite)
    if (!latestExecutionId) {
      // No execution found, return default score
      return {
        score: 0,
        breakdown: {
          passRateContribution: 0,
          flakinessContribution: 0,
          stabilityContribution: 0,
        },
        rawMetrics: {
          passRate: 0,
          flakyRate: 0,
          durationCV: 0,
        },
        trend: 0,
        status: "critical",
      }
    }
  }

  // Build date filter for current period
  // If lastRunOnly and we have an execution, skip date filter (we filter by execution)
  const dateFilter = latestExecutionId
    ? ""
    : from && to
      ? `AND te.started_at BETWEEN '${from}'::timestamptz AND '${to}'::timestamptz`
      : `AND te.started_at > NOW() - INTERVAL '7 days'`

  // Build optional branch/suite filters
  const branchFilter = branch ? `AND te.branch = '${branch}'` : ""
  const suiteFilter = suite ? `AND te.suite = '${suite}'` : ""
  const executionFilter = latestExecutionId ? `AND te.id = ${latestExecutionId}` : ""
  const extraFilters = branchFilter + suiteFilter + executionFilter

  // Calculate per-test CV (coefficient of variation) for duration stability
  // This measures how stable each test's duration is across multiple runs,
  // rather than measuring variance between different tests (which was incorrect).
  //
  // For example:
  // - Test A runs: [2s, 2.1s, 1.9s] → CV ≈ 0.05 (very stable)
  // - Test B runs: [60s, 61s, 59s] → CV ≈ 0.017 (very stable)
  // - Average CV = ~0.034 → 97% stability
  //
  // The old approach calculated STDDEV([2, 60, ...]) / AVG([2, 60, ...])
  // which measured uniformity of test durations, not stability over time.
  const result = await sql`
    WITH current_per_test_cv AS (
      SELECT
        CASE
          WHEN AVG(tr.duration_ms) > 0
          THEN COALESCE(STDDEV(tr.duration_ms) / AVG(tr.duration_ms), 0)
          ELSE 0
        END as cv
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.status = 'passed'
        ${sql.unsafe(dateFilter)}
        ${sql.unsafe(extraFilters)}
      GROUP BY tr.test_name, tr.test_file
      HAVING COUNT(*) > 1
    ),
    current_metrics AS (
      SELECT
        COALESCE(COUNT(*) FILTER (WHERE tr.status = 'passed')::float / NULLIF(COUNT(*), 0) * 100, 0) as pass_rate,
        COALESCE(COUNT(*) FILTER (WHERE tr.is_flaky = true)::float / NULLIF(COUNT(*), 0) * 100, 0) as flaky_rate,
        COALESCE((SELECT AVG(cv) FROM current_per_test_cv), 0) as duration_cv
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        ${sql.unsafe(dateFilter)}
        ${sql.unsafe(extraFilters)}
    ),
    previous_per_test_cv AS (
      SELECT
        CASE
          WHEN AVG(tr.duration_ms) > 0
          THEN COALESCE(STDDEV(tr.duration_ms) / AVG(tr.duration_ms), 0)
          ELSE 0
        END as cv
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.status = 'passed'
        AND te.started_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
        ${sql.unsafe(extraFilters)}
      GROUP BY tr.test_name, tr.test_file
      HAVING COUNT(*) > 1
    ),
    previous_metrics AS (
      SELECT
        COALESCE(COUNT(*) FILTER (WHERE tr.status = 'passed')::float / NULLIF(COUNT(*), 0) * 100, 0) as pass_rate,
        COALESCE(COUNT(*) FILTER (WHERE tr.is_flaky = true)::float / NULLIF(COUNT(*), 0) * 100, 0) as flaky_rate,
        COALESCE((SELECT AVG(cv) FROM previous_per_test_cv), 0) as duration_cv
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND te.started_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
        ${sql.unsafe(extraFilters)}
    )
    SELECT
      cm.pass_rate,
      cm.flaky_rate,
      cm.duration_cv,
      pm.pass_rate as prev_pass_rate,
      pm.flaky_rate as prev_flaky_rate,
      pm.duration_cv as prev_duration_cv
    FROM current_metrics cm
    CROSS JOIN previous_metrics pm
  `

  const row = result[0] || {
    pass_rate: 0,
    flaky_rate: 0,
    duration_cv: 0,
    prev_pass_rate: null,
    prev_flaky_rate: null,
    prev_duration_cv: null,
  }

  // For single-run analysis (lastRunOnly=true), we can't measure duration stability
  // because there's nothing to compare against. Set CV to 0 = 100% stable.
  const effectiveDurationCV = lastRunOnly
    ? 0
    : Number(row.duration_cv) || 0

  // Calculate contributions using formula weights
  const passRateContribution = (Number(row.pass_rate) || 0) * 0.4
  const flakinessContribution = (100 - (Number(row.flaky_rate) || 0)) * 0.3
  const stabilityContribution =
    (1 - Math.min(effectiveDurationCV, 1)) * 100 * 0.3

  const score = Math.round(
    passRateContribution + flakinessContribution + stabilityContribution
  )

  // Calculate previous score for trend
  const prevScore = row.prev_pass_rate !== null
    ? Math.round(
        Number(row.prev_pass_rate) * 0.4 +
          (100 - Number(row.prev_flaky_rate)) * 0.3 +
          (1 - Math.min(Number(row.prev_duration_cv), 1)) * 100 * 0.3
      )
    : score

  return {
    score,
    breakdown: {
      passRateContribution: Math.round(passRateContribution),
      flakinessContribution: Math.round(flakinessContribution),
      stabilityContribution: Math.round(stabilityContribution),
    },
    rawMetrics: {
      passRate: Math.round(Number(row.pass_rate) || 0),
      flakyRate: Math.round(Number(row.flaky_rate) || 0),
      durationCV: Math.round(effectiveDurationCV * 100) / 100,
    },
    trend: score - prevScore,
    status: score >= 80 ? "healthy" : score >= 60 ? "warning" : "critical",
  }
}
