import { neon } from "@neondatabase/serverless"
import { createHash } from "crypto"
import type {
  TestExecution,
  TestResult,
  DashboardMetrics,
  TrendData,
  ExecutionRequest,
  TestResultRequest,
  ArtifactRequest,
  TestSearchResult,
  TestHistoryItem,
  TestStatistics,
} from "./types"

function getSql() {
  return neon(process.env.DATABASE_URL!)
}

export interface DateRangeFilter {
  from?: string // ISO date string
  to?: string // ISO date string
}

export async function getExecutions(
  limit = 50,
  status?: string,
  branch?: string,
  dateRange?: DateRangeFilter
) {
  const sql = getSql()
  const conditions = []

  if (status) {
    conditions.push(`status = '${status}'`)
  }

  if (branch) {
    conditions.push(`branch = '${branch}'`)
  }

  if (dateRange?.from) {
    conditions.push(`started_at >= '${dateRange.from}'`)
  }

  if (dateRange?.to) {
    conditions.push(`started_at <= '${dateRange.to}'`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await sql`
    SELECT * FROM test_executions
    ${sql.unsafe(whereClause)}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `

  return result as TestExecution[]
}

export async function getExecutionById(id: number) {
  const sql = getSql()
  const result = await sql`SELECT * FROM test_executions WHERE id = ${id}`
  return result[0] as TestExecution | undefined
}

export async function getTestResultsByExecutionId(executionId: number) {
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
    LEFT JOIN test_artifacts ta ON ta.test_result_id = tr.id
    WHERE tr.execution_id = ${executionId}
    GROUP BY tr.id
    ORDER BY tr.started_at ASC
  `

  return results as TestResult[]
}

export async function getDashboardMetrics(dateRange?: DateRangeFilter) {
  const sql = getSql()
  const conditions = ["completed_at IS NOT NULL"]

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
      ROUND(AVG(duration_ms)) as avg_duration_ms,
      COUNT(*) FILTER (WHERE status = 'failure' AND started_at > NOW() - INTERVAL '24 hours') as last_24h_failures,
      COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') as last_24h_executions
    FROM test_executions
    ${sql.unsafe(whereClause)}
  `

  const criticalConditions = [
    "tr.is_critical = true",
    "tr.status = 'failed'",
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

  return {
    total_executions: Number(metrics[0].total_executions),
    pass_rate: Number(metrics[0].pass_rate),
    avg_duration_ms: Number(metrics[0].avg_duration_ms),
    critical_failures: Number(criticalFailures[0].critical_failures),
    last_24h_executions: Number(metrics[0].last_24h_executions),
  } as DashboardMetrics
}

export async function getTrendData(days = 7, dateRange?: DateRangeFilter) {
  const sql = getSql()
  const conditions = ["completed_at IS NOT NULL"]

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
      COUNT(*) FILTER (WHERE status = 'success') as passed,
      COUNT(*) FILTER (WHERE status = 'failure') as failed,
      COUNT(*) as total
    FROM test_executions
    ${sql.unsafe(whereClause)}
    GROUP BY DATE(started_at)
    ORDER BY date ASC
  `

  return result as TrendData[]
}

export async function getBranches() {
  const sql = getSql()
  const result = await sql`
    SELECT DISTINCT branch
    FROM test_executions
    ORDER BY branch ASC
  `
  return result.map((r) => r.branch) as string[]
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

/**
 * Insert a new test execution record
 * @returns The ID of the newly created execution
 */
export async function insertExecution(data: ExecutionRequest): Promise<number> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO test_executions (
      run_id,
      branch,
      commit_sha,
      commit_message,
      triggered_by,
      workflow_name,
      status,
      total_tests,
      passed,
      failed,
      skipped,
      duration_ms,
      started_at,
      completed_at
    ) VALUES (
      ${data.run_id},
      ${data.branch},
      ${data.commit_sha},
      ${data.commit_message ?? null},
      ${data.triggered_by ?? "unknown"},
      ${data.workflow_name ?? "E2E Tests"},
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

/**
 * Insert test results for an execution
 * @returns Map of test_signature -> result_id for artifact matching
 */
export async function insertTestResults(
  executionId: number,
  results: TestResultRequest[]
): Promise<Map<string, number>> {
  const sql = getSql()
  const signatureToIdMap = new Map<string, number>()

  // Insert each result individually to get the ID back
  // Note: For very large result sets, consider batch insert with UNNEST
  for (const result of results) {
    const signature = generateTestSignature(result.test_file, result.test_name)

    const inserted = await sql`
      INSERT INTO test_results (
        execution_id,
        test_name,
        test_file,
        test_signature,
        status,
        duration_ms,
        is_critical,
        error_message,
        stack_trace,
        browser,
        retry_count,
        logs,
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
        ${result.error_message ?? null},
        ${result.stack_trace ?? null},
        ${result.browser ?? "chromium"},
        ${result.retry_count ?? 0},
        ${result.logs ? JSON.stringify(result.logs) : null},
        ${result.started_at ?? null},
        ${result.completed_at ?? null}
      )
      RETURNING id
    `

    signatureToIdMap.set(signature, inserted[0].id as number)
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

/**
 * Search tests by name or file path
 * Uses ILIKE for case-insensitive partial matching
 */
export async function searchTests(query: string, limit = 50): Promise<TestSearchResult[]> {
  const sql = getSql()

  if (!query || query.length < 2) {
    return []
  }

  const searchPattern = `%${query}%`

  const results = await sql`
    SELECT
      COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
      test_name,
      test_file,
      COUNT(*) as run_count,
      MAX(started_at) as last_run,
      (
        SELECT status FROM test_results tr2
        WHERE tr2.test_name = test_results.test_name
          AND tr2.test_file = test_results.test_file
        ORDER BY started_at DESC LIMIT 1
      ) as last_status,
      ROUND(
        COUNT(*) FILTER (WHERE status = 'passed')::decimal
        / NULLIF(COUNT(*), 0) * 100, 1
      ) as pass_rate
    FROM test_results
    WHERE test_name ILIKE ${searchPattern}
       OR test_file ILIKE ${searchPattern}
    GROUP BY test_name, test_file, test_signature
    ORDER BY run_count DESC
    LIMIT ${limit}
  `

  return results as TestSearchResult[]
}

/**
 * Get test history by signature
 * Returns recent runs for a specific test across all executions
 */
export async function getTestHistory(signature: string, limit = 20): Promise<TestHistoryItem[]> {
  const sql = getSql()

  const results = await sql`
    SELECT
      tr.*,
      te.branch,
      te.commit_sha,
      te.status as execution_status
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.test_signature = ${signature}
       OR MD5(tr.test_file || '::' || tr.test_name) = ${signature}
    ORDER BY tr.started_at DESC
    LIMIT ${limit}
  `

  return results as TestHistoryItem[]
}

/**
 * Get aggregated statistics for a specific test by signature
 */
export async function getTestStatistics(signature: string): Promise<TestStatistics> {
  const sql = getSql()

  const result = await sql`
    SELECT
      COUNT(*) as total_runs,
      ROUND(
        COUNT(*) FILTER (WHERE status = 'passed')::decimal
        / NULLIF(COUNT(*), 0) * 100, 1
      ) as pass_rate,
      ROUND(AVG(duration_ms)) as avg_duration_ms,
      ROUND(
        COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed')::decimal
        / NULLIF(COUNT(*) FILTER (WHERE status = 'passed'), 0) * 100, 1
      ) as flaky_rate,
      MAX(started_at) FILTER (WHERE status = 'failed') as last_failure
    FROM test_results
    WHERE test_signature = ${signature}
       OR MD5(test_file || '::' || test_name) = ${signature}
  `

  return {
    total_runs: Number(result[0].total_runs),
    pass_rate: Number(result[0].pass_rate) || 0,
    avg_duration_ms: Number(result[0].avg_duration_ms) || 0,
    flaky_rate: Number(result[0].flaky_rate) || 0,
    last_failure: result[0].last_failure,
  }
}
