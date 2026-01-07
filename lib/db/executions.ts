import { getSql } from "./connection"
import type { DateRangeFilter } from "./types"
import type { TestExecution, BranchGroup, SuiteResult } from "../types"

// ============================================
// Execution Query Functions
// ============================================

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
