import { getSql } from "./connection"
import { getExecutionById } from "./executions"
import type { FailedTestResult, ExecutionSummary } from "./types"
import type { TestResult } from "../types"

// ============================================
// Test Results Query Functions
// ============================================

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
