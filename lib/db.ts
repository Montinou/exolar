import { neon } from "@neondatabase/serverless"
import { createHash } from "crypto"
import type {
  TestExecution,
  TestResult,
  DashboardMetrics,
  TrendData,
  FailureTrendData,
  ExecutionRequest,
  TestResultRequest,
  ArtifactRequest,
  TestSearchResult,
  TestHistoryItem,
  TestStatistics,
  TestFlakinessHistory,
  FlakinessSummary,
  BranchGroup,
  SuiteResult,
  ReliabilityScore,
  PerformanceRegression,
  PerformanceRegressionSummary,
  DurationHistoryPoint,
  ComparisonResult,
  TestComparisonItem,
  ComparisonExecutionInfo,
  TestDiffCategory,
  FailureClassification,
  ClassificationSignal,
  ClassificationHistoricalMetrics,
  RecentRun,
  ClassificationOptions,
} from "./types"

export function getSql() {
  return neon(process.env.DATABASE_URL!)
}

/**
 * Set service account context for RLS bypass.
 * Call this at the start of API routes that use API key auth (not user sessions).
 * This allows CI/CD to write data without triggering RLS policies.
 * 
 * Note: This sets a session variable that the is_service_account() 
 * PostgreSQL function checks in RLS policies.
 */
export async function setServiceAccountContext() {
  const sql = getSql()
  await sql`SET LOCAL app.is_service_account = 'true'`
}

export interface DateRangeFilter {
  from?: string // ISO date string
  to?: string // ISO date string
}

export async function getExecutions(
  organizationId: number,
  limit = 50,
  offset = 0,
  status?: string,
  branch?: string,
  dateRange?: DateRangeFilter,
  suite?: string,
  runId?: string
) {
  const sql = getSql()
  const conditions = [`organization_id = ${organizationId}`]

  if (status) {
    conditions.push(`status = '${status}'`)
  }

  if (branch) {
    conditions.push(`branch = '${branch}'`)
  }

  if (suite) {
    conditions.push(`suite = '${suite}'`)
  }

  if (runId) {
    conditions.push(`run_id = '${runId}'`)
  }

  if (dateRange?.from) {
    conditions.push(`started_at >= '${dateRange.from}'`)
  }

  if (dateRange?.to) {
    conditions.push(`started_at <= '${dateRange.to}'`)
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`

  const result = await sql`
    SELECT * FROM test_executions
    ${sql.unsafe(whereClause)}
    ORDER BY started_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  return result as TestExecution[]
}

/**
 * Search executions by branch, commit SHA, or suite name.
 * Uses ILIKE for case-insensitive partial matching.
 * 
 * @param organizationId - Organization to search within (multi-tenant isolation)
 * @param query - Search term (minimum 2 characters)
 * @param limit - Maximum results to return (default 20, max 50)
 * @param branch - Optional: scope search to specific branch
 * @param suite - Optional: scope search to specific suite
 * @returns Array of matching executions, sorted by most recent first
 */
export async function searchExecutions(
  organizationId: number,
  query: string,
  limit = 20,
  branch?: string,
  suite?: string
): Promise<TestExecution[]> {
  const sql = getSql()

  // Validate minimum query length
  if (!query || query.length < 2) {
    return []
  }

  // Sanitize user input by escaping single quotes (prevent SQL injection)
  const sanitizedQuery = query.replace(/'/g, "''")
  const searchPattern = `%${sanitizedQuery}%`

  // Build conditions array following existing pattern
  const conditions = [`organization_id = ${organizationId}`]

  // Add search condition: match branch, commit_sha, or suite
  // Using ILIKE for case-insensitive search (PostgreSQL)
  conditions.push(`(
    branch ILIKE '${searchPattern}'
    OR commit_sha ILIKE '${searchPattern}'
    OR COALESCE(suite, '') ILIKE '${searchPattern}'
  )`)

  // Optional filters to scope the search
  if (branch) {
    const sanitizedBranch = branch.replace(/'/g, "''")
    conditions.push(`branch = '${sanitizedBranch}'`)
  }

  if (suite) {
    const sanitizedSuite = suite.replace(/'/g, "''")
    conditions.push(`suite = '${sanitizedSuite}'`)
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`

  // Ensure limit is within bounds (1-50)
  const safeLimit = Math.min(Math.max(1, limit), 50)

  const result = await sql`
    SELECT * FROM test_executions
    ${sql.unsafe(whereClause)}
    ORDER BY started_at DESC
    LIMIT ${safeLimit}
  `

  return result as TestExecution[]
}

export async function getExecutionById(organizationId: number, id: number) {
  const sql = getSql()
  const result = await sql`SELECT * FROM test_executions WHERE id = ${id} AND organization_id = ${organizationId}`
  return result[0] as TestExecution | undefined
}

export async function getTestResultsByExecutionId(organizationId: number, executionId: number) {
  const sql = getSql()
  const results = await sql`
    SELECT tr.*, 
           json_agg(
             json_build_object(
               'id', ta.id,
               'test_result_id', ta.test_result_id,
               'type', ta.type,
               'r2_key', ta.r2_key,
               'r2_url', ta.r2_url,
               'file_size_bytes', ta.file_size_bytes,
               'mime_type', ta.mime_type,
               'created_at', ta.created_at
             )
           ) FILTER (WHERE ta.id IS NOT NULL) as artifacts
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    LEFT JOIN test_artifacts ta ON ta.test_result_id = tr.id
    WHERE tr.execution_id = ${executionId}
      AND te.organization_id = ${organizationId}
    GROUP BY tr.id
    ORDER BY tr.started_at ASC
  `

  return results as TestResult[]
}

// ============================================
// Execution Analysis Functions (MCP Aggregation)
// ============================================

export interface FailedTestResult {
  test_name: string
  test_file: string
  error_message: string | null
  duration_ms: number
  retry_count: number
  stack_trace?: string | null
}

export interface ExecutionSummary {
  execution: TestExecution
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    pass_rate: number
    duration_ms: number
  }
  error_distribution: Array<{ error_pattern: string; count: number }>
  files_affected: Array<{ file: string; failed: number; passed: number }>
}

/**
 * Get only failed tests from an execution (much smaller than full results)
 * Optionally includes retries for debugging flaky tests
 */
export async function getFailedTestsByExecutionId(
  organizationId: number,
  executionId: number,
  options: {
    includeRetries?: boolean
    includeStackTraces?: boolean
  } = {}
): Promise<FailedTestResult[]> {
  const sql = getSql()
  const { includeRetries = false, includeStackTraces = false } = options

  // Build query conditions using sql.unsafe for dynamic parts
  const conditions = [
    `tr.execution_id = ${executionId}`,
    `te.organization_id = ${organizationId}`,
    "tr.status = 'failed'",
  ]

  if (!includeRetries) {
    conditions.push("tr.retry_count = 0")
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`

  // Use different queries based on options to avoid sql.unsafe edge cases
  let results
  if (includeStackTraces) {
    results = await sql`
      SELECT
        tr.test_name,
        tr.test_file,
        tr.error_message,
        tr.duration_ms,
        tr.retry_count,
        tr.stack_trace
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      ${sql.unsafe(whereClause)}
      ORDER BY tr.test_file ASC, tr.test_name ASC
    `
  } else {
    results = await sql`
      SELECT
        tr.test_name,
        tr.test_file,
        tr.error_message,
        tr.duration_ms,
        tr.retry_count
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      ${sql.unsafe(whereClause)}
      ORDER BY tr.test_file ASC, tr.test_name ASC
    `
  }

  // Ensure we always return a proper array
  return Array.isArray(results) ? results as FailedTestResult[] : Array.from(results || []) as FailedTestResult[]
}

/**
 * Get aggregated summary of an execution without the full test list
 * Much lighter than getTestResultsByExecutionId for quick analysis
 */
export async function getExecutionSummary(
  organizationId: number,
  executionId: number
): Promise<ExecutionSummary | null> {
  const sql = getSql()

  // Get execution metadata
  const execution = await getExecutionById(organizationId, executionId)
  if (!execution) return null

  // Get test counts by status
  const statusCounts = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE tr.status = 'passed') as passed,
      COUNT(*) FILTER (WHERE tr.status = 'failed') as failed,
      COUNT(*) FILTER (WHERE tr.status = 'skipped') as skipped
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.execution_id = ${executionId}
      AND te.organization_id = ${organizationId}
      AND tr.retry_count = 0
  `

  // Get error distribution (group similar errors)
  const errorDistribution = await sql`
    SELECT
      CASE
        WHEN tr.error_message LIKE '%Proposal failed with status%' THEN 'API Error: Proposal failed'
        WHEN tr.error_message LIKE '%TimeoutError%' THEN 'TimeoutError'
        WHEN tr.error_message LIKE '%expect%toBeTruthy%' THEN 'AssertionError: toBeTruthy'
        WHEN tr.error_message LIKE '%expect%toBeVisible%' THEN 'AssertionError: toBeVisible'
        WHEN tr.error_message LIKE '%locator.click%' THEN 'LocatorError: click failed'
        WHEN tr.error_message IS NULL THEN 'Unknown Error'
        ELSE SUBSTRING(tr.error_message, 1, 50)
      END as error_pattern,
      COUNT(*) as count
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.execution_id = ${executionId}
      AND te.organization_id = ${organizationId}
      AND tr.status = 'failed'
      AND tr.retry_count = 0
    GROUP BY error_pattern
    ORDER BY count DESC
  `

  // Get files affected
  const filesAffected = await sql`
    SELECT
      tr.test_file as file,
      COUNT(*) FILTER (WHERE tr.status = 'failed') as failed,
      COUNT(*) FILTER (WHERE tr.status = 'passed') as passed
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.execution_id = ${executionId}
      AND te.organization_id = ${organizationId}
      AND tr.retry_count = 0
    GROUP BY tr.test_file
    ORDER BY failed DESC, tr.test_file ASC
  `

  const total = Number(statusCounts[0].total)
  const passed = Number(statusCounts[0].passed)

  return {
    execution,
    summary: {
      total,
      passed,
      failed: Number(statusCounts[0].failed),
      skipped: Number(statusCounts[0].skipped),
      pass_rate: total > 0 ? Math.round((passed / total) * 1000) / 10 : 0,
      duration_ms: execution.duration_ms || 0,
    },
    // Ensure we return proper arrays (Neon returns array-like objects)
    error_distribution: Array.isArray(errorDistribution)
      ? errorDistribution as Array<{ error_pattern: string; count: number }>
      : Array.from(errorDistribution || []) as Array<{ error_pattern: string; count: number }>,
    files_affected: Array.isArray(filesAffected)
      ? filesAffected as Array<{ file: string; failed: number; passed: number }>
      : Array.from(filesAffected || []) as Array<{ file: string; failed: number; passed: number }>,
  }
}

/**
 * Get error type distribution for a specific execution
 */
export async function getErrorDistributionByExecution(
  organizationId: number,
  executionId: number
): Promise<Array<{ error_pattern: string; count: number; test_files: string[] }>> {
  const sql = getSql()

  const results = await sql`
    SELECT
      CASE
        WHEN tr.error_message LIKE '%Proposal failed with status%' THEN 'API Error: Proposal failed'
        WHEN tr.error_message LIKE '%TimeoutError%' THEN 'TimeoutError'
        WHEN tr.error_message LIKE '%expect%toBeTruthy%' THEN 'AssertionError: toBeTruthy'
        WHEN tr.error_message LIKE '%expect%toBeVisible%' THEN 'AssertionError: toBeVisible'
        WHEN tr.error_message LIKE '%locator.click%' THEN 'LocatorError: click failed'
        WHEN tr.error_message IS NULL THEN 'Unknown Error'
        ELSE SUBSTRING(tr.error_message, 1, 50)
      END as error_pattern,
      COUNT(*) as count,
      array_agg(DISTINCT tr.test_file) as test_files
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.execution_id = ${executionId}
      AND te.organization_id = ${organizationId}
      AND tr.status = 'failed'
      AND tr.retry_count = 0
    GROUP BY error_pattern
    ORDER BY count DESC
  `

  // Ensure we return a proper array (Neon returns array-like objects)
  return Array.isArray(results)
    ? results as Array<{ error_pattern: string; count: number; test_files: string[] }>
    : Array.from(results || []) as Array<{ error_pattern: string; count: number; test_files: string[] }>
}

export async function getDashboardMetrics(organizationId: number, dateRange?: DateRangeFilter) {
  const sql = getSql()
  const conditions = ["completed_at IS NOT NULL", `organization_id = ${organizationId}`]

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

  if (dateRange?.from) {
    criticalConditions.push(`te.started_at >= '${dateRange.from}'`)
  } else {
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
  const latestExecution = await sql`
    SELECT total_tests, passed, failed, skipped
    FROM test_executions
    WHERE organization_id = ${organizationId}
      AND completed_at IS NOT NULL
    ORDER BY started_at DESC
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

export type TrendPeriod = 'hour' | 'day' | 'week' | 'month'

export interface TrendOptions {
  period?: TrendPeriod
  count?: number          // Number of periods to look back
  days?: number           // Deprecated: use count + period instead
  from?: string           // Explicit start date (ISO 8601)
  to?: string             // Explicit end date (ISO 8601)
}

export interface TrendDataPoint {
  period: string          // ISO date or datetime depending on granularity
  executions: number      // Total runs in this period
  passed: number
  failed: number
  skipped: number
  pass_rate: number       // 0-100
}

/**
 * Get trend data with flexible time granularity.
 * Supports hourly, daily, weekly, and monthly aggregation.
 * 
 * @param organizationId - Organization ID
 * @param options - Trend options including period, count, and date range
 * @returns Array of trend data points
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
// Branch/Suite Statistics Functions
// ============================================

export interface BranchStatistics {
  branch: string
  last_run: string | null
  execution_count: number
  pass_rate: number
  last_status: "success" | "failure" | "running" | null
}

export interface SuiteStatistics {
  suite: string
  last_run: string | null
  execution_count: number
  pass_rate: number
  last_status: "success" | "failure" | "running" | null
}

/**
 * Get branches with full statistics.
 * Includes pass_rate, last_status, execution_count, and last_run.
 * Sorted by most recent activity.
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
 * Sorted by most recent activity.
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
// Branch Accordion View Functions
// ============================================

/**
 * Group executions by branch for the accordion view
 * Returns branches sorted by most recent activity
 * Each branch includes unique commit messages (max 3) and suite results (last 3 runs per suite)
 */
export async function getExecutionsGroupedByBranch(
  organizationId: number,
  dateRange?: DateRangeFilter,
  maxRunsPerSuite: number = 3
): Promise<BranchGroup[]> {
  const sql = getSql()
  const conditions = [`organization_id = ${organizationId}`]

  if (dateRange?.from) {
    conditions.push(`started_at >= '${dateRange.from}'`)
  } else {
    conditions.push(`started_at > NOW() - INTERVAL '7 days'`)
  }

  if (dateRange?.to) {
    conditions.push(`started_at <= '${dateRange.to}'`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  // Get all executions within the date range
  const executions = await sql`
    SELECT id, branch, suite, status, commit_message, started_at
    FROM test_executions
    ${sql.unsafe(whereClause)}
    ORDER BY started_at DESC
  `

  // Group by branch
  const branchMap = new Map<string, {
    commitMessages: Set<string>
    lastActivity: string
    suiteMap: Map<string, Array<{ executionId: number; status: string; startedAt: string }>>
  }>()

  for (const exec of executions) {
    const branch = exec.branch as string
    const suite = (exec.suite as string) || "default"
    const commitMessage = exec.commit_message as string | null
    const status = exec.status as string
    const startedAt = exec.started_at as string
    const executionId = exec.id as number

    if (!branchMap.has(branch)) {
      branchMap.set(branch, {
        commitMessages: new Set(),
        lastActivity: startedAt,
        suiteMap: new Map(),
      })
    }

    const branchData = branchMap.get(branch)!

    // Add commit message (filter out merge commits, max 3 unique)
    if (commitMessage && !commitMessage.startsWith("Merge") && branchData.commitMessages.size < 3) {
      branchData.commitMessages.add(commitMessage)
    }

    // Add suite result
    if (!branchData.suiteMap.has(suite)) {
      branchData.suiteMap.set(suite, [])
    }

    const suiteResults = branchData.suiteMap.get(suite)!
    if (suiteResults.length < maxRunsPerSuite) {
      suiteResults.push({
        executionId,
        status,
        startedAt,
      })
    }
  }

  // Convert to BranchGroup array
  const result: BranchGroup[] = []

  for (const [branch, data] of branchMap) {
    const suiteResults: SuiteResult[] = []

    for (const [suite, results] of data.suiteMap) {
      suiteResults.push({
        suite,
        results: results.map((r) => ({
          executionId: r.executionId,
          status: r.status as "success" | "failure" | "running",
          startedAt: r.startedAt,
        })),
      })
    }

    // Sort suites alphabetically
    suiteResults.sort((a, b) => a.suite.localeCompare(b.suite))

    result.push({
      branch,
      commitMessages: Array.from(data.commitMessages),
      lastActivity: data.lastActivity,
      suiteResults,
    })
  }

  // Sort by last activity (most recent first)
  result.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())

  return result
}

// ============================================
// Insert Functions for Data Ingestion
// ============================================

/**
 * Generate MD5 hash signature for test identification
 * Format: MD5(test_file::test_name)
 */
export function generateTestSignature(testFile: string, testName: string): string {
  return createHash("md5").update(`${testFile}::${testName}`).digest("hex")
}

export async function insertExecution(organizationId: number, data: ExecutionRequest): Promise<number> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO test_executions (
      organization_id,
      run_id,
      branch,
      commit_sha,
      commit_message,
      triggered_by,
      workflow_name,
      suite,
      status,
      total_tests,
      passed,
      failed,
      skipped,
      duration_ms,
      started_at,
      completed_at
    ) VALUES (
      ${organizationId},
      ${data.run_id},
      ${data.branch},
      ${data.commit_sha},
      ${data.commit_message ?? null},
      ${data.triggered_by ?? "unknown"},
      ${data.workflow_name ?? "E2E Tests"},
      ${data.suite ?? null},
      ${data.status},
      ${data.total_tests},
      ${data.passed},
      ${data.failed},
      ${data.skipped},
      ${data.duration_ms ?? null},
      ${data.started_at},
      ${data.completed_at ?? null}
    )
    RETURNING id
  `

  return result[0].id as number
}

export async function insertTestResults(
  organizationId: number,
  executionId: number,
  results: TestResultRequest[]
): Promise<Map<string, number>> {
  const sql = getSql()
  const signatureToIdMap = new Map<string, number>()

  // Insert each result individually to get the ID back
  // Note: For very large result sets, consider batch insert with UNNEST
  for (const result of results) {
    const signature = generateTestSignature(result.test_file, result.test_name)
    const retryCount = result.retry_count ?? 0
    const flaky = isTestFlaky(retryCount, result.status)

    const inserted = await sql`
      INSERT INTO test_results (
        execution_id,
        test_name,
        test_file,
        test_signature,
        status,
        duration_ms,
        is_critical,
        is_flaky,
        error_message,
        stack_trace,
        browser,
        retry_count,
        logs,
        ai_context,
        started_at,
        completed_at
      ) VALUES (
        ${executionId},
        ${result.test_name},
        ${result.test_file},
        ${signature},
        ${result.status},
        ${result.duration_ms},
        ${result.is_critical ?? false},
        ${flaky},
        ${result.error_message ?? null},
        ${result.stack_trace ?? null},
        ${result.browser ?? "chromium"},
        ${retryCount},
        ${result.logs ? JSON.stringify(result.logs) : null},
        ${result.ai_context ? JSON.stringify(result.ai_context) : null},
        ${result.started_at || new Date().toISOString()},
        ${result.completed_at || null}
      )
      RETURNING id
    `

    signatureToIdMap.set(signature, inserted[0].id as number)

    // Update flakiness history for this test
    await updateFlakinessHistory(
      organizationId,
      signature,
      result.test_name,
      result.test_file,
      result.status,
      retryCount,
      result.duration_ms
    )
  }

  return signatureToIdMap
}

/**
 * Insert artifact records linked to test results
 * @param signatureToIdMap Map from generateTestSignature -> test_result_id
 * @param artifacts Array of artifact requests
 * @returns Number of artifacts inserted
 */
export async function insertArtifacts(
  signatureToIdMap: Map<string, number>,
  artifacts: ArtifactRequest[]
): Promise<number> {
  const sql = getSql()
  let insertedCount = 0

  for (const artifact of artifacts) {
    const signature = generateTestSignature(artifact.test_file, artifact.test_name)
    const resultId = signatureToIdMap.get(signature)

    if (!resultId) {
      console.warn(
        `[insertArtifacts] No matching test result for artifact: ${artifact.test_file}::${artifact.test_name}`
      )
      continue
    }

    await sql`
      INSERT INTO test_artifacts (
        test_result_id,
        type,
        r2_key,
        r2_url,
        file_size_bytes,
        mime_type
      ) VALUES (
        ${resultId},
        ${artifact.type},
        ${artifact.r2_key},
        ${artifact.r2_key},
        ${artifact.size_bytes ?? null},
        ${artifact.mime_type ?? null}
      )
    `

    insertedCount++
  }

  return insertedCount
}

// ============================================
// Search and History Functions (Phase 04)
// ============================================

export async function searchTests(organizationId: number, query: string, limit = 50, offset = 0): Promise<TestSearchResult[]> {
  const sql = getSql()

  if (!query || query.length < 2) {
    return []
  }

  const searchPattern = `%${query}%`

  const results = await sql`
    SELECT
      COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
      tr.test_name,
      tr.test_file,
      COUNT(*) as run_count,
      MAX(tr.started_at) as last_run,
      (
        SELECT status FROM test_results tr2
        JOIN test_executions te2 ON tr2.execution_id = te2.id
        WHERE tr2.test_name = tr.test_name
          AND tr2.test_file = tr.test_file
          AND te2.organization_id = ${organizationId}
        ORDER BY tr2.started_at DESC LIMIT 1
      ) as last_status,
      ROUND(
        COUNT(*) FILTER (WHERE tr.status = 'passed')::decimal
        / NULLIF(COUNT(*), 0) * 100, 1
      ) as pass_rate
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE (tr.test_name ILIKE ${searchPattern}
       OR tr.test_file ILIKE ${searchPattern})
      AND te.organization_id = ${organizationId}
    GROUP BY tr.test_name, tr.test_file, tr.test_signature
    ORDER BY run_count DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  return results as TestSearchResult[]
}

export async function getTestHistory(organizationId: number, signature: string, limit = 20, offset = 0): Promise<TestHistoryItem[]> {
  const sql = getSql()

  const results = await sql`
    SELECT
      tr.*,
      te.branch,
      te.commit_sha,
      te.status as execution_status
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE (tr.test_signature = ${signature}
       OR MD5(tr.test_file || '::' || tr.test_name) = ${signature})
      AND te.organization_id = ${organizationId}
    ORDER BY tr.started_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  return results as TestHistoryItem[]
}

export async function getTestStatistics(organizationId: number, signature: string): Promise<TestStatistics> {
  const sql = getSql()

  const result = await sql`
    SELECT
      COUNT(*) as total_runs,
      ROUND(
        COUNT(*) FILTER (WHERE tr.status = 'passed')::decimal
        / NULLIF(COUNT(*), 0) * 100, 1
      ) as pass_rate,
      ROUND(AVG(tr.duration_ms)) as avg_duration_ms,
      ROUND(
        COUNT(*) FILTER (WHERE tr.retry_count > 0 AND tr.status = 'passed')::decimal
        / NULLIF(COUNT(*) FILTER (WHERE tr.status = 'passed'), 0) * 100, 1
      ) as flaky_rate,
      MAX(tr.started_at) FILTER (WHERE tr.status = 'failed') as last_failure
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE (tr.test_signature = ${signature}
       OR MD5(tr.test_file || '::' || tr.test_name) = ${signature})
      AND te.organization_id = ${organizationId}
  `

  return {
    total_runs: Number(result[0].total_runs),
    pass_rate: Number(result[0].pass_rate) || 0,
    avg_duration_ms: Number(result[0].avg_duration_ms) || 0,
    flaky_rate: Number(result[0].flaky_rate) || 0,
    last_failure: result[0].last_failure,
  }
}

// ============================================
// AI Context Analysis Functions
// ============================================

export async function getFailuresWithAIContext(
  organizationId: number,
  options: {
    errorType?: string
    testFile?: string
    limit?: number
    offset?: number
    since?: string
    executionId?: number
    requireAIContext?: boolean
    runId?: string
  } = {}
): Promise<TestResult[]> {
  const sql = getSql()
  const { errorType, testFile, limit = 50, offset = 0, since, executionId, requireAIContext = false, runId } = options

  const conditions = [
    "tr.status IN ('failed', 'timedout')",
    `te.organization_id = ${organizationId}`,
  ]

  // Only require ai_context when filtering by AI error type or explicitly requested
  if (requireAIContext || errorType) {
    conditions.push("tr.ai_context IS NOT NULL")
  }

  if (errorType) {
    conditions.push(`tr.ai_context->'error'->>'type' = '${errorType.replace(/'/g, "''")}'`)
  }

  if (testFile) {
    conditions.push(`tr.test_file ILIKE '%${testFile.replace(/'/g, "''")}%'`)
  }

  if (since) {
    conditions.push(`tr.created_at >= '${since}'`)
  }

  if (executionId) {
    conditions.push(`tr.execution_id = ${executionId}`)
  }

  if (runId) {
    conditions.push(`te.run_id = '${runId}'`)
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`

  // Build query with dynamic conditions
  const query = `
    SELECT
      tr.id, tr.execution_id, tr.test_name, tr.test_file, tr.test_signature,
      tr.status, tr.duration_ms, tr.is_critical, tr.error_message, tr.stack_trace,
      tr.browser, tr.retry_count, tr.ai_context, tr.created_at
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    ${whereClause}
    ORDER BY tr.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const result = await sql.unsafe(query)
  return result as unknown as TestResult[]
}

// ============================================
// Error Distribution Types and Options
// ============================================

export interface ErrorDistributionOptions {
  since?: string
  branch?: string
  suite?: string
  limit?: number
  groupBy?: 'error_type' | 'file' | 'branch'
}

export interface ErrorDistributionItem {
  error_type: string
  count: number
  percentage: number
  example_message: string | null
}

export async function getErrorTypeDistribution(
  organizationId: number,
  options: ErrorDistributionOptions | string = {}
): Promise<ErrorDistributionItem[]> {
  const sql = getSql()
  
  // Handle backwards compatibility - if a string is passed, treat it as 'since'
  const opts: ErrorDistributionOptions = typeof options === 'string' 
    ? { since: options } 
    : options
  
  const { since, branch, suite, limit = 10, groupBy = 'error_type' } = opts

  const conditions = [
    "tr.status IN ('failed', 'timedout')",
    `te.organization_id = ${organizationId}`,
  ]

  // AI context is only required when grouping by error_type
  if (groupBy === 'error_type') {
    conditions.push("tr.ai_context IS NOT NULL")
  }

  if (since) {
    conditions.push(`tr.created_at >= '${since}'`)
  }

  if (branch) {
    conditions.push(`te.branch = '${branch.replace(/'/g, "''")}'`)
  }

  if (suite) {
    conditions.push(`te.suite = '${suite.replace(/'/g, "''")}'`)
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`

  // Determine grouping column based on groupBy option
  let groupColumn: string
  let selectColumn: string
  
  switch (groupBy) {
    case 'file':
      groupColumn = 'tr.test_file'
      selectColumn = 'tr.test_file as error_type'  // Reuse field name for consistent response shape
      break
    case 'branch':
      groupColumn = 'te.branch'
      selectColumn = 'te.branch as error_type'
      break
    case 'error_type':
    default:
      groupColumn = "tr.ai_context->'error'->>'type'"
      selectColumn = "tr.ai_context->'error'->>'type' as error_type"
  }

  // Ensure limit is within bounds (1-100)
  const safeLimit = Math.min(Math.max(1, limit), 100)

  // Query with percentage calculation using CTE and example_message from most recent occurrence
  const query = `
    WITH total_count AS (
      SELECT COUNT(*) as total
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      ${whereClause}
    ),
    grouped AS (
      SELECT
        ${selectColumn},
        COUNT(*) as count,
        MAX(tr.created_at) as latest_at
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      ${whereClause}
      GROUP BY ${groupColumn}
      ORDER BY count DESC
      LIMIT ${safeLimit}
    )
    SELECT 
      g.error_type,
      g.count::integer as count,
      ROUND((g.count::decimal / NULLIF(tc.total, 0)) * 100, 1)::float as percentage,
      (
        SELECT tr2.error_message 
        FROM test_results tr2
        JOIN test_executions te2 ON tr2.execution_id = te2.id
        WHERE ${groupBy === 'error_type' 
          ? "tr2.ai_context->'error'->>'type' = g.error_type" 
          : groupBy === 'file' 
            ? "tr2.test_file = g.error_type"
            : "te2.branch = g.error_type"}
          AND te2.organization_id = ${organizationId}
          AND tr2.status IN ('failed', 'timedout')
        ORDER BY tr2.created_at DESC 
        LIMIT 1
      ) as example_message
    FROM grouped g, total_count tc
    ORDER BY g.count DESC
  `

  const result = await sql.unsafe(query)
  return result as unknown as ErrorDistributionItem[]
}

// ============================================
// Flakiness Detection Functions (Phase 06)
// ============================================

/**
 * Check if a test result is flaky based on retry count and status
 * A test is flaky if it passed after at least one retry
 */
export function isTestFlaky(retryCount: number, status: string): boolean {
  return retryCount > 0 && status === "passed"
}

export interface GetFlakiestTestsOptions {
  limit?: number
  minRuns?: number
  since?: string
  branch?: string
  suite?: string
  includeResolved?: boolean
}

export async function getFlakiestTests(
  organizationId: number,
  options: GetFlakiestTestsOptions | number = {} // Support legacy signature (limit as number) for backward compatibility during transistion
): Promise<TestFlakinessHistory[]> {
  const sql = getSql()
  
  // Handle legacy signature (limit as first arg, minRuns as second - though minRuns isn't passed here)
  let limit = 10
  let minRuns = 5
  let since: string | undefined
  let branch: string | undefined
  let suite: string | undefined
  let includeResolved = false

  if (typeof options === 'number') {
    limit = options
    // minRuns would be the next argument but we can't easily access it without changing signature entirely
    // so we'll treat it as default or handle if the caller passes a second arg (which we can't see here easily without ...args)
    // To be safe and cleaner, let's just support the new object signature primarily,
    // but if we want to be strict about "update instead of create", we should fully replace the signature.
    // However, to avoid breaking other calls immediately, I'll check if the second arg is present in the "arguments" object if I could...
    // Actually, let's just simplify and say we are changing the signature. I will update all callers.
  } else {
    limit = options.limit ?? 10
    minRuns = options.minRuns ?? 5
    since = options.since
    branch = options.branch
    suite = options.suite
    includeResolved = options.includeResolved ?? false
  }

  // NOTE: If the function is called with (orgId, limit, minRuns), 'options' will be 'limit'.
  // We need to handle the 3rd argument 'minRuns' if we want full backward compat without changing call sites immediately.
  // But the plan is to update call sites involved. Providing a clean migration path:
  // I will assume for this step I am refactoring the function signature to take an object.
  // I will check for callers in the next steps to ensure I don't break them.
  
  const conditions = [
    `organization_id = ${organizationId}`,
    `total_runs >= ${minRuns}`,
  ]

  if (!includeResolved) {
    conditions.push("flaky_runs > 0")
  }

  if (since) {
    conditions.push(`last_flaky_at >= '${since}'`)
  }

  let branchFilter = ""
  if (branch) {
    // We need to join via test_results and test_executions to filter by branch
    // Since test_flakiness_history is an aggregate, we check if the test was flaky on this specific branch
    // We use a subquery to find test_signatures that have flaky results on the given branch
    branchFilter = `
      AND test_signature IN (
        SELECT DISTINCT tr.test_signature
        FROM test_results tr
        JOIN test_executions te ON tr.execution_id = te.id
        WHERE te.branch = '${branch.replace(/'/g, "''")}'
          AND te.organization_id = ${organizationId}
          AND tr.is_flaky = true
      )
    `
  }

  let suiteFilter = ""
  if (suite) {
    // Filter by suite - similar pattern to branch filter
    suiteFilter = `
      AND test_signature IN (
        SELECT DISTINCT tr.test_signature
        FROM test_results tr
        JOIN test_executions te ON tr.execution_id = te.id
        WHERE te.suite = '${suite.replace(/'/g, "''")}'
          AND te.organization_id = ${organizationId}
          AND tr.is_flaky = true
      )
    `
  }

  const whereClause = `WHERE ${conditions.join(" AND ")} ${branchFilter} ${suiteFilter}`

  // When branch or suite filter is active, calculate filtered stats
  // Otherwise return overall stats from test_flakiness_history
  const hasFilters = branch || suite

  let results
  if (hasFilters) {
    // Build filter conditions for the join
    const filterConditions = []
    if (branch) filterConditions.push(`te_filtered.branch = '${branch.replace(/'/g, "''")}'`)
    if (suite) filterConditions.push(`te_filtered.suite = '${suite.replace(/'/g, "''")}'`)
    const filterWhere = filterConditions.length > 0 ? `AND ${filterConditions.join(" AND ")}` : ""

    results = await sql`
      SELECT
        tfh.test_signature,
        tfh.test_name,
        tfh.test_file,
        COUNT(*) FILTER (WHERE tr_filtered.is_flaky = true) as flaky_runs,
        COUNT(*) as total_runs,
        ROUND(
          COUNT(*) FILTER (WHERE tr_filtered.is_flaky = true)::numeric /
          NULLIF(COUNT(*), 0) * 100, 2
        ) as flakiness_rate,
        MAX(CASE WHEN tr_filtered.is_flaky = true THEN tr_filtered.started_at END) as last_flaky_at,
        (
          SELECT te.branch
          FROM test_results tr
          JOIN test_executions te ON tr.execution_id = te.id
          WHERE tr.test_signature = tfh.test_signature
            AND tr.is_flaky = true
            AND te.organization_id = ${organizationId}
          ORDER BY tr.started_at DESC
          LIMIT 1
        ) as last_flaky_branch
      FROM test_flakiness_history tfh
      JOIN test_results tr_filtered ON tfh.test_signature = tr_filtered.test_signature
      JOIN test_executions te_filtered ON tr_filtered.execution_id = te_filtered.id
        AND te_filtered.organization_id = ${organizationId}
        ${sql.unsafe(filterWhere)}
      ${sql.unsafe(whereClause)}
      GROUP BY tfh.test_signature, tfh.test_name, tfh.test_file
      HAVING COUNT(*) FILTER (WHERE tr_filtered.is_flaky = true) > 0
      ORDER BY flakiness_rate DESC, flaky_runs DESC
      LIMIT ${limit}
    `
  } else {
    results = await sql`
      SELECT
        tfh.*,
        (
          SELECT te.branch
          FROM test_results tr
          JOIN test_executions te ON tr.execution_id = te.id
          WHERE tr.test_signature = tfh.test_signature
            AND tr.is_flaky = true
            AND te.organization_id = ${organizationId}
          ORDER BY tr.started_at DESC
          LIMIT 1
        ) as last_flaky_branch
      FROM test_flakiness_history tfh
      ${sql.unsafe(whereClause)}
      ORDER BY flakiness_rate DESC, flaky_runs DESC
      LIMIT ${limit}
    `
  }

  return results as unknown as TestFlakinessHistory[]
}

export interface GetFlakinessSummaryOptions {
  branch?: string
  suite?: string
  since?: string
}

export async function getFlakinessSummary(
  organizationId: number,
  options: GetFlakinessSummaryOptions = {}
): Promise<FlakinessSummary> {
  const { branch, suite, since } = options
  const sql = getSql()

  const hasFilters = branch || suite || since

  let summaryResult
  if (hasFilters) {
    // Build filter conditions
    const filterConditions = [`te.organization_id = ${organizationId}`]
    if (branch) filterConditions.push(`te.branch = '${branch.replace(/'/g, "''")}'`)
    if (suite) filterConditions.push(`te.suite = '${suite.replace(/'/g, "''")}'`)
    if (since) filterConditions.push(`tr.started_at >= '${since}'`)
    const filterWhere = filterConditions.join(" AND ")

    // Calculate filtered summary from test_results directly
    summaryResult = await sql`
      SELECT
        COUNT(DISTINCT CASE WHEN tr.is_flaky = true THEN tr.test_signature END) as total_flaky_tests,
        COALESCE(
          COUNT(*) FILTER (WHERE tr.is_flaky = true)::numeric /
          NULLIF(COUNT(*), 0) * 100,
          0
        ) as avg_flakiness_rate
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE ${sql.unsafe(filterWhere)}
    `
  } else {
    // Use aggregate table for unfiltered summary (faster)
    summaryResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE flaky_runs > 0) as total_flaky_tests,
        COALESCE(AVG(flakiness_rate) FILTER (WHERE flaky_runs > 0), 0) as avg_flakiness_rate
      FROM test_flakiness_history
      WHERE total_runs >= 5
        AND organization_id = ${organizationId}
    `
  }

  const topFlaky = await getFlakiestTests(organizationId, {
    limit: 5,
    branch,
    suite,
    since
  })

  return {
    total_flaky_tests: Number(summaryResult[0].total_flaky_tests),
    avg_flakiness_rate: Number(summaryResult[0].avg_flakiness_rate),
    most_flaky_tests: topFlaky,
  }
}

export async function updateFlakinessHistory(
  organizationId: number,
  testSignature: string,
  testName: string,
  testFile: string,
  status: string,
  retryCount: number,
  durationMs: number
): Promise<void> {
  const sql = getSql()
  const isFlaky = isTestFlaky(retryCount, status)

  await sql`
    INSERT INTO test_flakiness_history (
      organization_id,
      test_signature,
      test_name,
      test_file,
      total_runs,
      flaky_runs,
      passed_runs,
      failed_runs,
      flakiness_rate,
      avg_duration_ms,
      last_flaky_at,
      last_passed_at,
      last_failed_at,
      first_seen_at,
      updated_at
    ) VALUES (
      ${organizationId},
      ${testSignature},
      ${testName},
      ${testFile},
      1,
      ${isFlaky ? 1 : 0},
      ${status === "passed" ? 1 : 0},
      ${status === "failed" ? 1 : 0},
      ${isFlaky ? 100 : 0},
      ${durationMs},
      ${isFlaky ? sql`NOW()` : null},
      ${status === "passed" ? sql`NOW()` : null},
      ${status === "failed" ? sql`NOW()` : null},
      NOW(),
      NOW()
    )
    ON CONFLICT (test_signature) DO UPDATE SET
      total_runs = test_flakiness_history.total_runs + 1,
      flaky_runs = test_flakiness_history.flaky_runs + ${isFlaky ? 1 : 0},
      passed_runs = test_flakiness_history.passed_runs + ${status === "passed" ? 1 : 0},
      failed_runs = test_flakiness_history.failed_runs + ${status === "failed" ? 1 : 0},
      flakiness_rate = CASE
        WHEN test_flakiness_history.passed_runs + ${status === "passed" ? 1 : 0} > 0
        THEN ROUND(
          (test_flakiness_history.flaky_runs + ${isFlaky ? 1 : 0})::decimal
          / (test_flakiness_history.passed_runs + ${status === "passed" ? 1 : 0}) * 100, 2
        )
        ELSE 0
      END,
      avg_duration_ms = ROUND(
        (test_flakiness_history.avg_duration_ms * test_flakiness_history.total_runs + ${durationMs})
        / (test_flakiness_history.total_runs + 1)
      ),
      last_flaky_at = CASE WHEN ${isFlaky} THEN NOW() ELSE test_flakiness_history.last_flaky_at END,
      last_passed_at = CASE WHEN ${status} = 'passed' THEN NOW() ELSE test_flakiness_history.last_passed_at END,
      last_failed_at = CASE WHEN ${status} = 'failed' THEN NOW() ELSE test_flakiness_history.last_failed_at END,
      updated_at = NOW()
  `
}

export async function getTestFlakiness(
  organizationId: number,
  signature: string
): Promise<TestFlakinessHistory | null> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM test_flakiness_history
    WHERE test_signature = ${signature}
      AND organization_id = ${organizationId}
    LIMIT 1
  `

  return result.length > 0 ? (result[0] as TestFlakinessHistory) : null
}

// ============================================
// Dashboard Analytics Queries
// ============================================

export interface SlowestTest {
  test_signature: string
  test_name: string
  test_file: string
  avg_duration_ms: number
  run_count: number
}

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

export interface SuitePassRate {
  suite: string
  total_runs: number
  pass_rate: number
}

export async function getSuitePassRates(organizationId: number): Promise<SuitePassRate[]> {
  const sql = getSql()

  const result = await sql`
    SELECT
      suite,
      COUNT(*) as total_runs,
      ROUND(COUNT(*) FILTER (WHERE status = 'success')::decimal / COUNT(*) * 100, 1) as pass_rate
    FROM test_executions
    WHERE organization_id = ${organizationId}
      AND suite IS NOT NULL
      AND started_at > NOW() - INTERVAL '7 days'
    GROUP BY suite
    ORDER BY pass_rate ASC
  `

  return result as SuitePassRate[]
}

// ============================================
// Organization API Key Functions
// ============================================

export interface OrgApiKey {
  id: number
  organization_id: number
  name: string
  key_prefix: string
  created_by: number | null
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

export interface OrgApiKeyWithHash extends OrgApiKey {
  key_hash: string
}

/**
 * Create a new API key for an organization
 */
export async function createApiKey(
  organizationId: number,
  name: string,
  keyHash: string,
  keyPrefix: string,
  createdBy: number | null
): Promise<OrgApiKey> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO organization_api_keys (
      organization_id,
      name,
      key_hash,
      key_prefix,
      created_by
    ) VALUES (
      ${organizationId},
      ${name},
      ${keyHash},
      ${keyPrefix},
      ${createdBy}
    )
    RETURNING id, organization_id, name, key_prefix, created_by, created_at, last_used_at, expires_at, revoked_at
  `

  return result[0] as OrgApiKey
}

/**
 * Get all API keys for an organization (excludes key_hash for security)
 */
export async function getApiKeysByOrg(organizationId: number): Promise<OrgApiKey[]> {
  const sql = getSql()

  const result = await sql`
    SELECT
      id,
      organization_id,
      name,
      key_prefix,
      created_by,
      created_at,
      last_used_at,
      expires_at,
      revoked_at
    FROM organization_api_keys
    WHERE organization_id = ${organizationId}
    ORDER BY created_at DESC
  `

  return result as OrgApiKey[]
}

/**
 * Get an API key by its hash (for validation)
 */
export async function getApiKeyByHash(keyHash: string): Promise<OrgApiKeyWithHash | null> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM organization_api_keys
    WHERE key_hash = ${keyHash}
  `

  return result.length > 0 ? (result[0] as OrgApiKeyWithHash) : null
}

/**
 * Revoke an API key (soft delete)
 */
export async function revokeApiKey(keyId: number, organizationId: number): Promise<boolean> {
  const sql = getSql()

  const result = await sql`
    UPDATE organization_api_keys
    SET revoked_at = NOW()
    WHERE id = ${keyId}
      AND organization_id = ${organizationId}
      AND revoked_at IS NULL
    RETURNING id
  `

  return result.length > 0
}

/**
 * Update last_used_at timestamp for an API key
 */
export async function updateApiKeyLastUsed(keyId: number): Promise<void> {
  const sql = getSql()

  await sql`
    UPDATE organization_api_keys
    SET last_used_at = NOW()
    WHERE id = ${keyId}
  `
}

// ============================================
// Reliability Score
// ============================================

export interface ReliabilityScoreOptions {
  from?: string
  to?: string
  branch?: string
  suite?: string
}

/**
 * Calculate overall test suite reliability score (0-100)
 * Formula: (PassRate × 0.4) + ((1 - FlakyRate) × 0.3) + (DurationStability × 0.3)
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

  // Build date filter for current period
  const dateFilter =
    from && to
      ? `AND te.started_at BETWEEN '${from}'::timestamptz AND '${to}'::timestamptz`
      : `AND te.started_at > NOW() - INTERVAL '7 days'`

  // Build optional branch/suite filters
  const branchFilter = branch ? `AND te.branch = '${branch}'` : ""
  const suiteFilter = suite ? `AND te.suite = '${suite}'` : ""
  const extraFilters = branchFilter + suiteFilter

  const result = await sql`
    WITH current_metrics AS (
      SELECT
        COALESCE(COUNT(*) FILTER (WHERE tr.status = 'passed')::float / NULLIF(COUNT(*), 0) * 100, 0) as pass_rate,
        COALESCE(COUNT(*) FILTER (WHERE tr.is_flaky = true)::float / NULLIF(COUNT(*), 0) * 100, 0) as flaky_rate,
        COALESCE(STDDEV(tr.duration_ms) FILTER (WHERE tr.status = 'passed') / NULLIF(AVG(tr.duration_ms) FILTER (WHERE tr.status = 'passed'), 0), 0) as duration_cv
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        ${sql.unsafe(dateFilter)}
        ${sql.unsafe(extraFilters)}
    ),
    previous_metrics AS (
      SELECT
        COALESCE(COUNT(*) FILTER (WHERE tr.status = 'passed')::float / NULLIF(COUNT(*), 0) * 100, 0) as pass_rate,
        COALESCE(COUNT(*) FILTER (WHERE tr.is_flaky = true)::float / NULLIF(COUNT(*), 0) * 100, 0) as flaky_rate,
        COALESCE(STDDEV(tr.duration_ms) FILTER (WHERE tr.status = 'passed') / NULLIF(AVG(tr.duration_ms) FILTER (WHERE tr.status = 'passed'), 0), 0) as duration_cv
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

  // Calculate contributions using formula weights
  const passRateContribution = (Number(row.pass_rate) || 0) * 0.4
  const flakinessContribution = (100 - (Number(row.flaky_rate) || 0)) * 0.3
  const stabilityContribution =
    (1 - Math.min(Number(row.duration_cv) || 0, 1)) * 100 * 0.3

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
      durationCV: Math.round((Number(row.duration_cv) || 0) * 100) / 100,
    },
    trend: score - prevScore,
    status: score >= 80 ? "healthy" : score >= 60 ? "warning" : "critical",
  }
}

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

export interface PerformanceRegressionsOptions {
  threshold?: number // Default 0.20 (20%)
  hours?: number // Default 24
  branch?: string
  suite?: string
  limit?: number // Default 20
  sortBy?: "regression" | "duration" | "name" // Default 'regression'
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

// ============================================
// Org-Bound Query Helper
// ============================================

/**
 * Create org-bound query functions.
 * Use this to avoid passing organizationId to every function.
 *
 * Usage in API routes:
 *   const context = await getSessionContext()
 *   const db = getQueriesForOrg(context.organizationId)
 *   const executions = await db.getExecutions(50, "failed")
 */
export function getQueriesForOrg(organizationId: number) {
  return {
    // Execution queries
    getExecutions: (limit?: number, offset?: number, status?: string, branch?: string, dateRange?: DateRangeFilter, suite?: string) =>
      getExecutions(organizationId, limit, offset, status, branch, dateRange, suite),
    getExecutionById: (id: number) =>
      getExecutionById(organizationId, id),
    getTestResultsByExecutionId: (executionId: number) =>
      getTestResultsByExecutionId(organizationId, executionId),
    getExecutionsGroupedByBranch: (dateRange?: DateRangeFilter, maxRunsPerSuite?: number) =>
      getExecutionsGroupedByBranch(organizationId, dateRange, maxRunsPerSuite),

    // Metrics queries
    getDashboardMetrics: (dateRange?: DateRangeFilter) =>
      getDashboardMetrics(organizationId, dateRange),
    getTrendData: (options?: TrendOptions) =>
      getTrendData(organizationId, options || {}),
    getFailureTrendData: (days?: number, dateRange?: DateRangeFilter) =>
      getFailureTrendData(organizationId, days, dateRange),
    getReliabilityScore: (options?: ReliabilityScoreOptions | DateRangeFilter) =>
      getReliabilityScore(organizationId, options),

    // Helper queries
    getBranches: () =>
      getBranches(organizationId),
    getSuites: () =>
      getSuites(organizationId),

    // Search and history queries
    searchTests: (query: string, limit?: number, offset?: number) =>
      searchTests(organizationId, query, limit, offset),
    searchExecutions: (query: string, limit?: number, branch?: string, suite?: string) =>
      searchExecutions(organizationId, query, limit, branch, suite),
    getTestHistory: (signature: string, limit?: number, offset?: number) =>
      getTestHistory(organizationId, signature, limit, offset),
    getTestStatistics: (signature: string) =>
      getTestStatistics(organizationId, signature),

    // AI context queries
    getFailuresWithAIContext: (options?: { errorType?: string; testFile?: string; limit?: number; offset?: number; since?: string }) =>
      getFailuresWithAIContext(organizationId, options),
    getErrorTypeDistribution: (options?: ErrorDistributionOptions | string) =>
      getErrorTypeDistribution(organizationId, options),

    // Flakiness queries
    getFlakiestTests: (options?: GetFlakiestTestsOptions | number) =>
      getFlakiestTests(organizationId, options),
    getFlakinessSummary: () =>
      getFlakinessSummary(organizationId),
    getTestFlakiness: (signature: string) =>
      getTestFlakiness(organizationId, signature),

    // Dashboard analytics queries
    getSlowestTests: (limit?: number, minRuns?: number) =>
      getSlowestTests(organizationId, limit, minRuns),
    getSuitePassRates: () =>
      getSuitePassRates(organizationId),

    // Insert functions
    insertExecution: (data: ExecutionRequest) =>
      insertExecution(organizationId, data),
    insertTestResults: (executionId: number, results: TestResultRequest[]) =>
      insertTestResults(organizationId, executionId, results),

    // API key functions
    createApiKey: (name: string, keyHash: string, keyPrefix: string, createdBy: number | null) =>
      createApiKey(organizationId, name, keyHash, keyPrefix, createdBy),
    getApiKeys: () =>
      getApiKeysByOrg(organizationId),
    revokeApiKey: (keyId: number) =>
      revokeApiKey(keyId, organizationId),

    // Performance regression functions
    updatePerformanceBaselines: () =>
      updatePerformanceBaselines(organizationId),
    getPerformanceRegressions: (options?: PerformanceRegressionsOptions | number, hours?: number) =>
      getPerformanceRegressions(organizationId, options, hours),
    getTestDurationHistory: (testSignature: string, days?: number) =>
      getTestDurationHistory(organizationId, testSignature, days),

    // Comparison functions
    compareExecutions: (baselineExecutionId: number, currentExecutionId: number, options?: { performanceThreshold?: number }) =>
      compareExecutions(organizationId, baselineExecutionId, currentExecutionId, options),
    getLatestExecutionByBranch: (branch: string, suite?: string) =>
      getLatestExecutionByBranch(organizationId, branch, suite),

    // Failure classification (auto-triage)
    getFailureClassification: (options: ClassificationOptions) =>
      getFailureClassification(organizationId, options),
  }
}
