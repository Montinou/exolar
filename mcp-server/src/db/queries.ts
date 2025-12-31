/**
 * Org-Scoped Database Queries for MCP Server
 *
 * All query functions take organizationId as first parameter
 * to ensure data isolation at the query level.
 */

import { getSql } from "./connection.js"

// ============================================
// Execution Queries
// ============================================

export async function getExecutions(
  organizationId: number,
  limit = 50,
  status?: string,
  branch?: string,
  suite?: string,
  from?: string,
  to?: string
) {
  const sql = getSql()

  // Build dynamic WHERE with org filter ALWAYS present
  const conditions = [`organization_id = ${organizationId}`]

  if (status) conditions.push(`status = '${status}'`)
  if (branch) conditions.push(`branch = '${branch}'`)
  if (suite) conditions.push(`suite = '${suite}'`)
  if (from) conditions.push(`started_at >= '${from}'`)
  if (to) conditions.push(`started_at <= '${to}'`)

  return sql.unsafe(`
    SELECT
      id, run_id, branch, commit_sha, commit_message,
      workflow_name, suite, status,
      total_tests, passed, failed, skipped,
      duration_ms, started_at, completed_at
    FROM test_executions
    WHERE ${conditions.join(" AND ")}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `)
}

export async function getExecutionById(organizationId: number, executionId: number) {
  const sql = getSql()

  const result = await sql`
    SELECT * FROM test_executions
    WHERE id = ${executionId}
      AND organization_id = ${organizationId}
  `

  return result[0] || null
}

export async function getTestResultsByExecutionId(organizationId: number, executionId: number) {
  const sql = getSql()

  return sql`
    SELECT
      tr.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ta.id,
            'type', ta.type,
            'r2_key', ta.r2_key,
            'file_size_bytes', ta.file_size_bytes
          )
        ) FILTER (WHERE ta.id IS NOT NULL),
        '[]'
      ) as artifacts
    FROM test_results tr
    JOIN test_executions te ON te.id = tr.execution_id
    LEFT JOIN test_artifacts ta ON ta.test_result_id = tr.id
    WHERE tr.execution_id = ${executionId}
      AND te.organization_id = ${organizationId}
    GROUP BY tr.id
    ORDER BY tr.started_at
  `
}

// ============================================
// Search Queries
// ============================================

export async function searchTests(organizationId: number, query: string, limit = 20) {
  const sql = getSql()
  const pattern = `%${query}%`

  return sql`
    SELECT
      tr.test_signature,
      tr.test_name,
      tr.test_file,
      COUNT(*) as run_count,
      MAX(tr.started_at) as last_run,
      ROUND(100.0 * COUNT(*) FILTER (WHERE tr.status = 'passed') / COUNT(*), 1) as pass_rate
    FROM test_results tr
    JOIN test_executions te ON te.id = tr.execution_id
    WHERE te.organization_id = ${organizationId}
      AND (tr.test_name ILIKE ${pattern} OR tr.test_file ILIKE ${pattern})
    GROUP BY tr.test_signature, tr.test_name, tr.test_file
    ORDER BY run_count DESC
    LIMIT ${limit}
  `
}

export async function getTestHistory(
  organizationId: number,
  testSignature?: string,
  testName?: string,
  limit = 20
) {
  const sql = getSql()

  if (testSignature) {
    return sql`
      SELECT tr.*, te.branch, te.commit_sha
      FROM test_results tr
      JOIN test_executions te ON te.id = tr.execution_id
      WHERE te.organization_id = ${organizationId}
        AND tr.test_signature = ${testSignature}
      ORDER BY tr.started_at DESC
      LIMIT ${limit}
    `
  }

  if (testName) {
    const pattern = `%${testName}%`
    return sql`
      SELECT tr.*, te.branch, te.commit_sha
      FROM test_results tr
      JOIN test_executions te ON te.id = tr.execution_id
      WHERE te.organization_id = ${organizationId}
        AND tr.test_name ILIKE ${pattern}
      ORDER BY tr.started_at DESC
      LIMIT ${limit}
    `
  }

  return []
}

// ============================================
// Failure Analysis Queries
// ============================================

export async function getFailedTests(
  organizationId: number,
  executionId?: number,
  errorType?: string,
  limit = 20
) {
  const sql = getSql()

  const conditions = [`te.organization_id = ${organizationId}`, `tr.status = 'failed'`]

  if (executionId) {
    conditions.push(`tr.execution_id = ${executionId}`)
  }

  if (errorType) {
    conditions.push(`tr.ai_context->'error'->>'type' ILIKE '%${errorType}%'`)
  }

  return sql.unsafe(`
    SELECT
      tr.id,
      tr.test_name,
      tr.test_file,
      tr.error_message,
      tr.stack_trace,
      tr.is_critical,
      tr.ai_context,
      te.branch,
      te.commit_sha,
      te.run_id
    FROM test_results tr
    JOIN test_executions te ON te.id = tr.execution_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY tr.started_at DESC
    LIMIT ${limit}
  `)
}

// ============================================
// Metrics and Trends Queries
// ============================================

export async function getDashboardMetrics(organizationId: number, from?: string, to?: string) {
  const sql = getSql()

  const conditions = [`organization_id = ${organizationId}`]
  if (from) conditions.push(`started_at >= '${from}'`)
  if (to) conditions.push(`started_at <= '${to}'`)

  const result = (await sql.unsafe(`
    SELECT
      COUNT(*) as total_executions,
      COUNT(*) FILTER (WHERE status = 'success') as successful_runs,
      COUNT(*) FILTER (WHERE status = 'failure') as failed_runs,
      SUM(total_tests) as total_tests_run,
      SUM(passed) as total_passed,
      SUM(failed) as total_failed,
      ROUND(AVG(duration_ms)) as avg_duration_ms
    FROM test_executions
    WHERE ${conditions.join(" AND ")}
  `)) as unknown as Record<string, unknown>[]

  return result[0]
}

export async function getTrends(organizationId: number, days = 7) {
  const sql = getSql()

  return sql`
    SELECT
      DATE(started_at) as date,
      COUNT(*) as total_runs,
      COUNT(*) FILTER (WHERE status = 'success') as passed,
      COUNT(*) FILTER (WHERE status = 'failure') as failed,
      ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / NULLIF(COUNT(*), 0), 1) as pass_rate
    FROM test_executions
    WHERE organization_id = ${organizationId}
      AND started_at >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE(started_at)
    ORDER BY date ASC
  `
}

export async function getErrorDistribution(organizationId: number, since?: string) {
  const sql = getSql()

  const conditions = [
    `te.organization_id = ${organizationId}`,
    `tr.status = 'failed'`,
    `tr.ai_context IS NOT NULL`,
  ]

  if (since) {
    conditions.push(`tr.started_at >= '${since}'`)
  }

  return sql.unsafe(`
    SELECT
      tr.ai_context->'error'->>'type' as error_type,
      COUNT(*) as count
    FROM test_results tr
    JOIN test_executions te ON te.id = tr.execution_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY tr.ai_context->'error'->>'type'
    ORDER BY count DESC
    LIMIT 10
  `)
}

// ============================================
// Flakiness Queries
// ============================================

export async function getFlakiestTests(organizationId: number, limit = 10, minRuns = 5) {
  const sql = getSql()

  return sql`
    SELECT *
    FROM test_flakiness_history
    WHERE organization_id = ${organizationId}
      AND total_runs >= ${minRuns}
      AND flaky_runs > 0
    ORDER BY flakiness_rate DESC
    LIMIT ${limit}
  `
}

export async function getFlakinessSummary(organizationId: number) {
  const sql = getSql()

  const result = await sql`
    SELECT
      COUNT(*) FILTER (WHERE flaky_runs > 0) as total_flaky_tests,
      ROUND(AVG(flakiness_rate) FILTER (WHERE flaky_runs > 0), 1) as avg_flakiness_rate,
      SUM(flaky_runs) as total_flaky_runs
    FROM test_flakiness_history
    WHERE organization_id = ${organizationId}
      AND total_runs >= 5
  `

  return {
    totalFlakyTests: Number(result[0]?.total_flaky_tests) || 0,
    avgFlakinessRate: Number(result[0]?.avg_flakiness_rate) || 0,
    totalFlakyRuns: Number(result[0]?.total_flaky_runs) || 0,
  }
}

// ============================================
// Resource Queries
// ============================================

export async function getBranches(organizationId: number) {
  const sql = getSql()

  return sql`
    SELECT DISTINCT branch
    FROM test_executions
    WHERE organization_id = ${organizationId}
      AND started_at > NOW() - INTERVAL '30 days'
    ORDER BY branch ASC
  `
}

export async function getSuites(organizationId: number) {
  const sql = getSql()

  return sql`
    SELECT DISTINCT suite
    FROM test_executions
    WHERE organization_id = ${organizationId}
      AND suite IS NOT NULL
      AND started_at > NOW() - INTERVAL '30 days'
    ORDER BY suite ASC
  `
}

// ============================================
// Artifact Queries
// ============================================

export async function getArtifactById(organizationId: number, artifactId: number) {
  const sql = getSql()

  const result = await sql`
    SELECT ta.*
    FROM test_artifacts ta
    JOIN test_results tr ON tr.id = ta.test_result_id
    JOIN test_executions te ON te.id = tr.execution_id
    WHERE ta.id = ${artifactId}
      AND te.organization_id = ${organizationId}
  `

  return result[0] || null
}

export async function getArtifactsForTestResult(organizationId: number, testResultId: number) {
  const sql = getSql()

  return sql`
    SELECT ta.*
    FROM test_artifacts ta
    JOIN test_results tr ON tr.id = ta.test_result_id
    JOIN test_executions te ON te.id = tr.execution_id
    WHERE ta.test_result_id = ${testResultId}
      AND te.organization_id = ${organizationId}
  `
}
