import { getSql } from "./connection"
import type { ErrorDistributionOptions, ErrorDistributionItem } from "./types"
import type {
  TestSearchResult,
  TestHistoryItem,
  TestStatistics,
  TestResult,
} from "../types"

// ============================================
// Search and History Functions
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
        SELECT tr2.status FROM test_results tr2
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

  // Defensive check: ensure result is an array before returning
  if (!Array.isArray(result)) {
    console.error("[getFailuresWithAIContext] Unexpected result type:", typeof result, result)
    return []
  }

  return result as unknown as TestResult[]
}

// ============================================
// Error Distribution
// ============================================

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

  // For error_type grouping, require either ai_context OR error_message to have categorizable data
  if (groupBy === 'error_type') {
    conditions.push("(tr.ai_context IS NOT NULL OR tr.error_message IS NOT NULL)")
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

  // CASE expression to extract error type with fallback to error_message parsing
  // Uses same logic as packages/playwright-reporter/src/utils.ts parseErrorType()
  const errorTypeCaseExpression = `
    CASE
      WHEN tr.ai_context->'error'->>'type' IS NOT NULL
        THEN tr.ai_context->'error'->>'type'
      WHEN tr.error_message ILIKE '%timeout%' OR tr.error_message ILIKE '%exceeded%'
        THEN 'TimeoutError'
      WHEN tr.error_message ILIKE '%strict mode violation%'
        THEN 'StrictModeError'
      WHEN tr.error_message ILIKE '%expect(%' OR tr.stack_trace ILIKE '%AssertionError%'
        THEN 'AssertionError'
      WHEN tr.error_message ILIKE '%navigation%'
        THEN 'NavigationError'
      WHEN tr.error_message ILIKE '%net::%'
        THEN 'NetworkError'
      ELSE 'Error'
    END`

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
      groupColumn = errorTypeCaseExpression
      selectColumn = `${errorTypeCaseExpression} as error_type`
  }

  // Ensure limit is within bounds (1-100)
  const safeLimit = Math.min(Math.max(1, limit), 100)

  // CASE expression for tr2 (used in subquery for example_message)
  const errorTypeCaseExpressionTr2 = `
    CASE
      WHEN tr2.ai_context->'error'->>'type' IS NOT NULL
        THEN tr2.ai_context->'error'->>'type'
      WHEN tr2.error_message ILIKE '%timeout%' OR tr2.error_message ILIKE '%exceeded%'
        THEN 'TimeoutError'
      WHEN tr2.error_message ILIKE '%strict mode violation%'
        THEN 'StrictModeError'
      WHEN tr2.error_message ILIKE '%expect(%' OR tr2.stack_trace ILIKE '%AssertionError%'
        THEN 'AssertionError'
      WHEN tr2.error_message ILIKE '%navigation%'
        THEN 'NavigationError'
      WHEN tr2.error_message ILIKE '%net::%'
        THEN 'NetworkError'
      ELSE 'Error'
    END`

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
          ? `(${errorTypeCaseExpressionTr2}) = g.error_type`
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

  // Defensive check: ensure result is an array before returning
  if (!Array.isArray(result)) {
    console.error("[getErrorTypeDistribution] Unexpected result type:", typeof result, result)
    return []
  }

  return result as unknown as ErrorDistributionItem[]
}
