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
  status?: string,
  branch?: string,
  dateRange?: DateRangeFilter,
  suite?: string
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

export async function getTrendData(organizationId: number, days = 7, dateRange?: DateRangeFilter) {
  const sql = getSql()
  const conditions = ["completed_at IS NOT NULL", `organization_id = ${organizationId}`]

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

export async function getBranches(organizationId: number) {
  const sql = getSql()
  const result = await sql`
    SELECT DISTINCT branch
    FROM test_executions
    WHERE organization_id = ${organizationId}
    ORDER BY branch ASC
  `
  return result.map((r) => r.branch) as string[]
}

export async function getSuites(organizationId: number) {
  const sql = getSql()
  const result = await sql`
    SELECT DISTINCT suite
    FROM test_executions
    WHERE suite IS NOT NULL
      AND organization_id = ${organizationId}
    ORDER BY suite ASC
  `
  return result.map((r) => r.suite) as string[]
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

export async function searchTests(organizationId: number, query: string, limit = 50): Promise<TestSearchResult[]> {
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
  `

  return results as TestSearchResult[]
}

export async function getTestHistory(organizationId: number, signature: string, limit = 20): Promise<TestHistoryItem[]> {
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
    since?: string
  } = {}
): Promise<TestResult[]> {
  const sql = getSql()
  const { errorType, testFile, limit = 50, since } = options

  const conditions = [
    "tr.ai_context IS NOT NULL",
    "tr.status IN ('failed', 'timedout')",
    `te.organization_id = ${organizationId}`,
  ]

  if (errorType) {
    conditions.push(`tr.ai_context->'error'->>'type' = '${errorType.replace(/'/g, "''")}'`)
  }

  if (testFile) {
    conditions.push(`tr.test_file ILIKE '%${testFile.replace(/'/g, "''")}%'`)
  }

  if (since) {
    conditions.push(`tr.created_at >= '${since}'`)
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
  `

  const result = await sql.unsafe(query)
  return result as unknown as TestResult[]
}

export async function getErrorTypeDistribution(
  organizationId: number,
  since?: string
): Promise<Array<{ error_type: string; count: number }>> {
  const sql = getSql()

  const conditions = [
    "tr.ai_context IS NOT NULL",
    "tr.status IN ('failed', 'timedout')",
    `te.organization_id = ${organizationId}`,
  ]

  if (since) {
    conditions.push(`tr.created_at >= '${since}'`)
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`

  const query = `
    SELECT
      tr.ai_context->'error'->>'type' as error_type,
      COUNT(*) as count
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    ${whereClause}
    GROUP BY tr.ai_context->'error'->>'type'
    ORDER BY count DESC
  `

  const result = await sql.unsafe(query)
  return result as unknown as Array<{ error_type: string; count: number }>
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

export async function getFlakiestTests(
  organizationId: number,
  limit: number = 10,
  minRuns: number = 5
): Promise<TestFlakinessHistory[]> {
  const sql = getSql()

  const results = await sql`
    SELECT *
    FROM test_flakiness_history
    WHERE total_runs >= ${minRuns}
      AND flaky_runs > 0
      AND organization_id = ${organizationId}
    ORDER BY flakiness_rate DESC, flaky_runs DESC
    LIMIT ${limit}
  `

  return results as TestFlakinessHistory[]
}

export async function getFlakinessSummary(organizationId: number): Promise<FlakinessSummary> {
  const sql = getSql()

  const summaryResult = await sql`
    SELECT
      COUNT(*) FILTER (WHERE flaky_runs > 0) as total_flaky_tests,
      COALESCE(AVG(flakiness_rate) FILTER (WHERE flaky_runs > 0), 0) as avg_flakiness_rate
    FROM test_flakiness_history
    WHERE total_runs >= 5
      AND organization_id = ${organizationId}
  `

  const topFlaky = await getFlakiestTests(organizationId, 5)

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
    getExecutions: (limit?: number, status?: string, branch?: string, dateRange?: DateRangeFilter, suite?: string) =>
      getExecutions(organizationId, limit, status, branch, dateRange, suite),
    getExecutionById: (id: number) =>
      getExecutionById(organizationId, id),
    getTestResultsByExecutionId: (executionId: number) =>
      getTestResultsByExecutionId(organizationId, executionId),
    getExecutionsGroupedByBranch: (dateRange?: DateRangeFilter, maxRunsPerSuite?: number) =>
      getExecutionsGroupedByBranch(organizationId, dateRange, maxRunsPerSuite),

    // Metrics queries
    getDashboardMetrics: (dateRange?: DateRangeFilter) =>
      getDashboardMetrics(organizationId, dateRange),
    getTrendData: (days?: number, dateRange?: DateRangeFilter) =>
      getTrendData(organizationId, days, dateRange),
    getFailureTrendData: (days?: number, dateRange?: DateRangeFilter) =>
      getFailureTrendData(organizationId, days, dateRange),

    // Helper queries
    getBranches: () =>
      getBranches(organizationId),
    getSuites: () =>
      getSuites(organizationId),

    // Search and history queries
    searchTests: (query: string, limit?: number) =>
      searchTests(organizationId, query, limit),
    getTestHistory: (signature: string, limit?: number) =>
      getTestHistory(organizationId, signature, limit),
    getTestStatistics: (signature: string) =>
      getTestStatistics(organizationId, signature),

    // AI context queries
    getFailuresWithAIContext: (options?: { errorType?: string; testFile?: string; limit?: number; since?: string }) =>
      getFailuresWithAIContext(organizationId, options),
    getErrorTypeDistribution: (since?: string) =>
      getErrorTypeDistribution(organizationId, since),

    // Flakiness queries
    getFlakiestTests: (limit?: number, minRuns?: number) =>
      getFlakiestTests(organizationId, limit, minRuns),
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
  }
}
