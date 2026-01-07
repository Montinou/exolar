import { getSql } from "./connection"
import { isTestFlaky } from "./utils"
import type { GetFlakiestTestsOptions, GetFlakinessSummaryOptions } from "./types"
import type { TestFlakinessHistory, FlakinessSummary } from "../types"

// ============================================
// Flakiness Detection Functions (Phase 06)
// ============================================

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

  // When branch or suite filter is active, calculate filtered stats
  // Otherwise return overall stats from test_flakiness_history
  const hasFilters = branch || suite

  let results
  if (hasFilters) {
    // Build filter conditions for the join
    const filterConditions = []
    if (branch) filterConditions.push(`te_filtered.branch = '${branch.replace(/'/g, "''")}'`)
    if (suite) filterConditions.push(`te_filtered.suite = '${suite.replace(/'/g, "''")}'`)
    if (since) filterConditions.push(`tr_filtered.started_at >= '${since}'`)
    const filterWhere = filterConditions.join(" AND ")

    // Build WHERE clause for filtered query (without the subquery filters)
    const filteredConditions = [`tfh.organization_id = ${organizationId}`]
    if (!includeResolved) {
      filteredConditions.push("tfh.flaky_runs > 0")
    }

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
        AND ${sql.unsafe(filterWhere)}
      WHERE ${sql.unsafe(filteredConditions.join(" AND "))}
      GROUP BY tfh.test_signature, tfh.test_name, tfh.test_file
      HAVING COUNT(*) FILTER (WHERE tr_filtered.is_flaky = true) > 0
      ORDER BY flakiness_rate DESC, flaky_runs DESC
      LIMIT ${limit}
    `
  } else {
    // Build WHERE clause for unfiltered query (with subquery filters)
    const whereClause = `WHERE ${conditions.join(" AND ")} ${branchFilter} ${suiteFilter}`
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
