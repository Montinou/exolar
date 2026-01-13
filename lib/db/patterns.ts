/**
 * Pattern Query Functions
 *
 * Query functions for retrieving global error pattern data.
 * Used by API endpoints for pattern analytics and visualization.
 */

import { getSql } from "./connection"
import type { ErrorCategory } from "./pattern-matching"

/** Top pattern result */
export interface TopPattern {
  id: number
  canonicalError: string
  category: ErrorCategory
  totalOccurrences: number
  affectedExecutions: number
  affectedTests: number
  firstSeen: Date
  lastSeen: Date
}

/** Category distribution result */
export interface CategoryDistribution {
  category: ErrorCategory
  count: number
  percentage: number
}

/** Trend data point */
export interface TrendDataPoint {
  date: string
  timeout: number
  auth: number
  network: number
  element: number
  assertion: number
  other: number
  total: number
}

/** Failing test result */
export interface FailingTest {
  testSignature: string
  testFile: string
  testTitle: string
  totalFailures: number
  totalRuns: number
  failureRate: number
  firstFailure: Date | null
  lastFailure: Date | null
}

/**
 * Get top recurring error patterns
 * Filters by occurrences within the date range to match CategoryDistribution
 */
export async function getTopPatterns(
  organizationId: number,
  days: number = 30,
  limit: number = 10
): Promise<TopPattern[]> {
  const sql = getSql()
  const dateThreshold = new Date()
  dateThreshold.setDate(dateThreshold.getDate() - days)

  // Count occurrences within the date range, not all-time totals
  const results = await sql`
    SELECT
      ep.id,
      ep.canonical_error,
      ep.category,
      COUNT(epo.id) as occurrences_in_range,
      COUNT(DISTINCT epo.execution_id) as executions_in_range,
      COUNT(DISTINCT tr.test_file || ':' || tr.test_name) as tests_in_range,
      MIN(epo.created_at) as first_seen_in_range,
      MAX(epo.created_at) as last_seen_in_range
    FROM error_patterns ep
    JOIN error_pattern_occurrences epo ON ep.id = epo.pattern_id
    JOIN test_results tr ON epo.test_result_id = tr.id
    WHERE ep.organization_id = ${organizationId}
      AND epo.created_at >= ${dateThreshold.toISOString()}
    GROUP BY ep.id, ep.canonical_error, ep.category
    ORDER BY occurrences_in_range DESC
    LIMIT ${limit}
  `

  return results.map((row) => ({
    id: row.id as number,
    canonicalError: row.canonical_error as string,
    category: row.category as ErrorCategory,
    totalOccurrences: Number(row.occurrences_in_range),
    affectedExecutions: Number(row.executions_in_range),
    affectedTests: Number(row.tests_in_range),
    firstSeen: new Date(row.first_seen_in_range as string),
    lastSeen: new Date(row.last_seen_in_range as string),
  }))
}

/**
 * Get category distribution
 */
export async function getCategoryDistribution(
  organizationId: number,
  days: number = 30
): Promise<{
  totalFailures: number
  categories: CategoryDistribution[]
}> {
  const sql = getSql()
  const dateThreshold = new Date()
  dateThreshold.setDate(dateThreshold.getDate() - days)

  // Get category counts based on occurrence counts within time range
  const results = await sql`
    SELECT
      ep.category,
      COUNT(epo.id) as failure_count
    FROM error_patterns ep
    JOIN error_pattern_occurrences epo ON ep.id = epo.pattern_id
    WHERE ep.organization_id = ${organizationId}
      AND epo.created_at >= ${dateThreshold.toISOString()}
    GROUP BY ep.category
    ORDER BY failure_count DESC
  `

  const totalFailures = results.reduce((sum, row) => sum + Number(row.failure_count), 0)

  const categories: CategoryDistribution[] = results.map((row) => ({
    category: row.category as ErrorCategory,
    count: Number(row.failure_count),
    percentage:
      totalFailures > 0
        ? Math.round((Number(row.failure_count) / totalFailures) * 100)
        : 0,
  }))

  // Ensure all categories are represented
  const allCategories: ErrorCategory[] = [
    "timeout",
    "auth",
    "network",
    "element",
    "assertion",
    "other",
  ]

  for (const cat of allCategories) {
    if (!categories.find((c) => c.category === cat)) {
      categories.push({ category: cat, count: 0, percentage: 0 })
    }
  }

  return { totalFailures, categories }
}

/**
 * Get pattern trends over time (grouped by day)
 */
export async function getPatternTrends(
  organizationId: number,
  days: number = 30
): Promise<TrendDataPoint[]> {
  const sql = getSql()
  const dateThreshold = new Date()
  dateThreshold.setDate(dateThreshold.getDate() - days)

  const results = await sql`
    SELECT
      DATE(epo.created_at) as date,
      ep.category,
      COUNT(*) as count
    FROM error_pattern_occurrences epo
    JOIN error_patterns ep ON epo.pattern_id = ep.id
    WHERE ep.organization_id = ${organizationId}
      AND epo.created_at >= ${dateThreshold.toISOString()}
    GROUP BY DATE(epo.created_at), ep.category
    ORDER BY date ASC
  `

  // Group by date and pivot categories
  const dateMap = new Map<
    string,
    {
      timeout: number
      auth: number
      network: number
      element: number
      assertion: number
      other: number
      total: number
    }
  >()

  for (const row of results) {
    const date = row.date as string
    const category = row.category as ErrorCategory
    const count = Number(row.count)

    if (!dateMap.has(date)) {
      dateMap.set(date, {
        timeout: 0,
        auth: 0,
        network: 0,
        element: 0,
        assertion: 0,
        other: 0,
        total: 0,
      })
    }

    const entry = dateMap.get(date)!
    if (category in entry) {
      entry[category as keyof typeof entry] += count
    }
    entry.total += count
  }

  // Fill in missing dates with zeros
  const trends: TrendDataPoint[] = []
  const current = new Date(dateThreshold)
  const today = new Date()

  while (current <= today) {
    const dateStr = current.toISOString().split("T")[0]
    const entry = dateMap.get(dateStr) || {
      timeout: 0,
      auth: 0,
      network: 0,
      element: 0,
      assertion: 0,
      other: 0,
      total: 0,
    }

    trends.push({
      date: dateStr,
      ...entry,
    })

    current.setDate(current.getDate() + 1)
  }

  return trends
}

/**
 * Get most failing tests
 */
export async function getFailingTests(
  organizationId: number,
  days: number = 30,
  limit: number = 10
): Promise<FailingTest[]> {
  const sql = getSql()
  const dateThreshold = new Date()
  dateThreshold.setDate(dateThreshold.getDate() - days)

  const results = await sql`
    SELECT
      test_signature,
      test_file,
      test_title,
      total_failures,
      total_runs,
      failure_rate,
      first_failure,
      last_failure
    FROM test_failure_stats
    WHERE organization_id = ${organizationId}
      AND (last_failure >= ${dateThreshold.toISOString()} OR last_failure IS NULL)
      AND total_failures > 0
    ORDER BY total_failures DESC, failure_rate DESC
    LIMIT ${limit}
  `

  return results.map((row) => ({
    testSignature: row.test_signature as string,
    testFile: row.test_file as string,
    testTitle: row.test_title as string,
    totalFailures: Number(row.total_failures),
    totalRuns: Number(row.total_runs),
    failureRate: Number(row.failure_rate),
    firstFailure: row.first_failure ? new Date(row.first_failure as string) : null,
    lastFailure: row.last_failure ? new Date(row.last_failure as string) : null,
  }))
}

/**
 * Get pattern details by ID
 */
export async function getPatternById(
  patternId: number,
  organizationId: number
): Promise<TopPattern | null> {
  const sql = getSql()

  const [result] = await sql`
    SELECT
      id,
      canonical_error,
      category,
      total_occurrences,
      affected_executions,
      affected_tests,
      first_seen,
      last_seen
    FROM error_patterns
    WHERE id = ${patternId}
      AND organization_id = ${organizationId}
  `

  if (!result) return null

  return {
    id: result.id as number,
    canonicalError: result.canonical_error as string,
    category: result.category as ErrorCategory,
    totalOccurrences: Number(result.total_occurrences),
    affectedExecutions: Number(result.affected_executions),
    affectedTests: Number(result.affected_tests),
    firstSeen: new Date(result.first_seen as string),
    lastSeen: new Date(result.last_seen as string),
  }
}

/**
 * Get failures belonging to a pattern
 */
export async function getPatternOccurrences(
  patternId: number,
  organizationId: number,
  limit: number = 50
): Promise<
  Array<{
    testResultId: number
    testName: string
    testFile: string
    errorMessage: string | null
    executionId: number
    branch: string
    distance: number
    createdAt: Date
  }>
> {
  const sql = getSql()

  const results = await sql`
    SELECT
      tr.id as test_result_id,
      tr.test_name,
      tr.test_file,
      tr.error_message,
      tr.execution_id,
      te.branch,
      epo.distance_to_centroid,
      epo.created_at
    FROM error_pattern_occurrences epo
    JOIN test_results tr ON epo.test_result_id = tr.id
    JOIN test_executions te ON tr.execution_id = te.id
    JOIN error_patterns ep ON epo.pattern_id = ep.id
    WHERE epo.pattern_id = ${patternId}
      AND ep.organization_id = ${organizationId}
    ORDER BY epo.created_at DESC
    LIMIT ${limit}
  `

  return results.map((row) => ({
    testResultId: row.test_result_id as number,
    testName: row.test_name as string,
    testFile: row.test_file as string,
    errorMessage: row.error_message as string | null,
    executionId: row.execution_id as number,
    branch: row.branch as string,
    distance: Number(row.distance_to_centroid),
    createdAt: new Date(row.created_at as string),
  }))
}
