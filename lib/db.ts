import { neon } from "@neondatabase/serverless"
import type { TestExecution, TestResult, DashboardMetrics, TrendData } from "./types"

const sql = neon(process.env.DATABASE_URL!)

export async function getExecutions(limit = 50, status?: string, branch?: string) {
  let query = "SELECT * FROM test_executions WHERE 1=1"
  const params: any[] = []
  let paramCount = 1

  if (status) {
    query += ` AND status = $${paramCount++}`
    params.push(status)
  }

  if (branch) {
    query += ` AND branch = $${paramCount++}`
    params.push(branch)
  }

  query += ` ORDER BY started_at DESC LIMIT $${paramCount}`
  params.push(limit)

  const result = await sql(query, params)
  return result as TestExecution[]
}

export async function getExecutionById(id: number) {
  const result = await sql("SELECT * FROM test_executions WHERE id = $1", [id])
  return result[0] as TestExecution | undefined
}

export async function getTestResultsByExecutionId(executionId: number) {
  const results = await sql(
    `
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
    WHERE tr.execution_id = $1
    GROUP BY tr.id
    ORDER BY tr.started_at ASC
  `,
    [executionId],
  )

  return results as TestResult[]
}

export async function getDashboardMetrics() {
  const metrics = await sql(`
    SELECT 
      COUNT(*) as total_executions,
      ROUND(AVG(CASE WHEN status = 'success' THEN 100 ELSE 0 END), 2) as pass_rate,
      ROUND(AVG(duration_ms)) as avg_duration_ms,
      COUNT(*) FILTER (WHERE status = 'failure' AND started_at > NOW() - INTERVAL '24 hours') as last_24h_failures,
      COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') as last_24h_executions
    FROM test_executions
    WHERE completed_at IS NOT NULL
  `)

  const criticalFailures = await sql(`
    SELECT COUNT(DISTINCT tr.id) as critical_failures
    FROM test_results tr
    JOIN test_executions te ON te.id = tr.execution_id
    WHERE tr.is_critical = true 
      AND tr.status = 'failed'
      AND te.started_at > NOW() - INTERVAL '7 days'
  `)

  return {
    total_executions: Number(metrics[0].total_executions),
    pass_rate: Number(metrics[0].pass_rate),
    avg_duration_ms: Number(metrics[0].avg_duration_ms),
    critical_failures: Number(criticalFailures[0].critical_failures),
    last_24h_executions: Number(metrics[0].last_24h_executions),
  } as DashboardMetrics
}

export async function getTrendData(days = 7) {
  const result = await sql(`
    SELECT 
      DATE(started_at) as date,
      COUNT(*) FILTER (WHERE status = 'success') as passed,
      COUNT(*) FILTER (WHERE status = 'failure') as failed,
      COUNT(*) as total
    FROM test_executions
    WHERE started_at > NOW() - INTERVAL '${days} days'
      AND completed_at IS NOT NULL
    GROUP BY DATE(started_at)
    ORDER BY date ASC
  `)

  return result as TrendData[]
}

export async function getBranches() {
  const result = await sql(`
    SELECT DISTINCT branch 
    FROM test_executions 
    ORDER BY branch ASC
  `)
  return result.map((r) => r.branch) as string[]
}
