// lib/db/suites.ts
// Suite and test tracking queries (Phase 14)

import { getSql } from "./connection"
import type {
  OrgSuite,
  SuiteTest,
  SuiteWithStats,
  SuiteTestWithSuite,
  TechStack,
  GetSuitesOptions,
  GetSuiteTestsOptions,
  UpdateSuiteRequest,
} from "../types"

// ============================================
// Tech Stack Detection
// ============================================

/**
 * Auto-detect tech stack from reporter name
 * @param reporter Reporter name from CI/CD request (e.g., "@playwright/test", "cypress-io")
 */
export function detectTechStack(reporter?: string): TechStack {
  if (!reporter) return "playwright"

  const r = reporter.toLowerCase()

  if (r.includes("cypress")) return "cypress"
  if (r.includes("vitest")) return "vitest"
  if (r.includes("jest")) return "jest"
  if (r.includes("mocha")) return "mocha"
  if (r.includes("pytest")) return "pytest"

  return "playwright"
}

// ============================================
// Suite CRUD Operations
// ============================================

/**
 * Get all suites for an organization
 */
export async function getSuiteRegistry(
  organizationId: number,
  options: GetSuitesOptions = {}
): Promise<OrgSuite[]> {
  const sql = getSql()
  const { techStack, isActive, limit = 50, offset = 0 } = options

  // Build conditions dynamically
  const conditions: string[] = [`organization_id = ${organizationId}`]
  if (techStack) conditions.push(`tech_stack = '${techStack}'`)
  if (isActive !== undefined) conditions.push(`is_active = ${isActive}`)

  const whereClause = conditions.join(" AND ")

  const result = await sql`
    SELECT *
    FROM org_suites
    WHERE ${sql.unsafe(whereClause)}
    ORDER BY last_execution_at DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `

  return result as unknown as OrgSuite[]
}

/**
 * Get suite by name (for auto-registration lookup)
 */
export async function getSuiteByName(
  organizationId: number,
  name: string
): Promise<OrgSuite | null> {
  const sql = getSql()

  const result = await sql`
    SELECT * FROM org_suites
    WHERE organization_id = ${organizationId}
      AND name = ${name}
    LIMIT 1
  `

  return result.length > 0 ? (result[0] as unknown as OrgSuite) : null
}

/**
 * Get suite by ID
 */
export async function getSuiteById(
  organizationId: number,
  suiteId: number
): Promise<OrgSuite | null> {
  const sql = getSql()

  const result = await sql`
    SELECT * FROM org_suites
    WHERE id = ${suiteId}
      AND organization_id = ${organizationId}
    LIMIT 1
  `

  return result.length > 0 ? (result[0] as unknown as OrgSuite) : null
}

/**
 * Create or update a suite (auto-registration during ingestion)
 * @returns Suite ID
 */
export async function upsertSuite(
  organizationId: number,
  name: string,
  techStack: TechStack = "playwright",
  executionId?: number
): Promise<number> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO org_suites (
      organization_id,
      name,
      tech_stack,
      last_execution_id,
      last_execution_at,
      first_seen_at,
      updated_at
    ) VALUES (
      ${organizationId},
      ${name},
      ${techStack},
      ${executionId ?? null},
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (organization_id, name) DO UPDATE SET
      last_execution_id = COALESCE(${executionId ?? null}, org_suites.last_execution_id),
      last_execution_at = NOW(),
      is_active = true,
      updated_at = NOW()
    RETURNING id
  `

  return result[0].id as number
}

/**
 * Update suite metadata (description, repo URL, tech stack)
 */
export async function updateSuite(
  organizationId: number,
  suiteId: number,
  updates: UpdateSuiteRequest
): Promise<void> {
  const sql = getSql()

  // Build SET clause dynamically
  const setClauses: string[] = ["updated_at = NOW()"]

  if (updates.description !== undefined) {
    setClauses.push(`description = ${updates.description === null ? "NULL" : `'${updates.description.replace(/'/g, "''")}'`}`)
  }
  if (updates.repository_url !== undefined) {
    setClauses.push(`repository_url = ${updates.repository_url === null ? "NULL" : `'${updates.repository_url.replace(/'/g, "''")}'`}`)
  }
  if (updates.tech_stack !== undefined) {
    setClauses.push(`tech_stack = '${updates.tech_stack}'`)
  }
  if (updates.is_active !== undefined) {
    setClauses.push(`is_active = ${updates.is_active}`)
  }

  const setClause = setClauses.join(", ")

  await sql`
    UPDATE org_suites
    SET ${sql.unsafe(setClause)}
    WHERE id = ${suiteId}
      AND organization_id = ${organizationId}
  `
}

/**
 * Get suites with aggregated statistics
 */
export async function getSuitesWithStats(organizationId: number): Promise<SuiteWithStats[]> {
  const sql = getSql()

  const result = await sql`
    SELECT
      os.*,
      COALESCE(COUNT(st.id) FILTER (WHERE st.is_active = true), 0)::int as active_test_count,
      COALESCE(COUNT(st.id) FILTER (WHERE st.is_active = false), 0)::int as inactive_test_count,
      COALESCE(
        ROUND(
          COUNT(st.id) FILTER (WHERE st.last_status = 'passed')::numeric /
          NULLIF(COUNT(st.id) FILTER (WHERE st.last_status IS NOT NULL), 0) * 100,
          1
        ),
        0
      )::float as pass_rate,
      COALESCE(ROUND(AVG(st.avg_duration_ms)), 0)::int as avg_test_duration_ms
    FROM org_suites os
    LEFT JOIN suite_tests st ON st.suite_id = os.id
    WHERE os.organization_id = ${organizationId}
    GROUP BY os.id
    ORDER BY os.last_execution_at DESC NULLS LAST
  `

  return result as unknown as SuiteWithStats[]
}

// ============================================
// Suite Test Operations
// ============================================

/**
 * Get tests with optional filters
 */
export async function getSuiteTests(
  organizationId: number,
  options: GetSuiteTestsOptions = {}
): Promise<SuiteTest[]> {
  const sql = getSql()
  const { suiteId, suiteName, isActive, isCritical, testFile, limit = 100, offset = 0 } = options

  const conditions: string[] = [`st.organization_id = ${organizationId}`]

  if (suiteId !== undefined) conditions.push(`st.suite_id = ${suiteId}`)
  if (suiteName !== undefined) {
    conditions.push(`os.name = '${suiteName.replace(/'/g, "''")}'`)
  }
  if (isActive !== undefined) conditions.push(`st.is_active = ${isActive}`)
  if (isCritical !== undefined) conditions.push(`st.is_critical = ${isCritical}`)
  if (testFile) conditions.push(`st.test_file ILIKE '%${testFile.replace(/'/g, "''")}%'`)

  const whereClause = conditions.join(" AND ")

  const result = await sql`
    SELECT st.*
    FROM suite_tests st
    LEFT JOIN org_suites os ON st.suite_id = os.id
    WHERE ${sql.unsafe(whereClause)}
    ORDER BY st.last_seen_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return result as unknown as SuiteTest[]
}

/**
 * Upsert a test during ingestion (auto-discovery)
 */
export async function upsertSuiteTest(
  organizationId: number,
  testSignature: string,
  testName: string,
  testFile: string,
  status: string,
  durationMs: number,
  isCritical: boolean,
  suiteId: number | null
): Promise<void> {
  const sql = getSql()

  const isPassed = status === "passed" ? 1 : 0
  const isFailed = status === "failed" ? 1 : 0
  const isSkipped = status === "skipped" || status === "timedout" ? 1 : 0

  await sql`
    INSERT INTO suite_tests (
      organization_id,
      suite_id,
      test_signature,
      test_name,
      test_file,
      is_critical,
      run_count,
      pass_count,
      fail_count,
      skip_count,
      last_status,
      last_duration_ms,
      avg_duration_ms,
      first_seen_at,
      last_seen_at,
      updated_at
    ) VALUES (
      ${organizationId},
      ${suiteId},
      ${testSignature},
      ${testName},
      ${testFile},
      ${isCritical},
      1,
      ${isPassed},
      ${isFailed},
      ${isSkipped},
      ${status},
      ${durationMs},
      ${durationMs},
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (organization_id, test_signature) DO UPDATE SET
      suite_id = COALESCE(${suiteId}, suite_tests.suite_id),
      is_critical = ${isCritical} OR suite_tests.is_critical,
      run_count = suite_tests.run_count + 1,
      pass_count = suite_tests.pass_count + ${isPassed},
      fail_count = suite_tests.fail_count + ${isFailed},
      skip_count = suite_tests.skip_count + ${isSkipped},
      last_status = ${status},
      last_duration_ms = ${durationMs},
      avg_duration_ms = ROUND(
        (suite_tests.avg_duration_ms * suite_tests.run_count + ${durationMs})::numeric /
        (suite_tests.run_count + 1)
      ),
      last_seen_at = NOW(),
      is_active = true,
      updated_at = NOW()
  `
}

/**
 * Mark tests as inactive if not seen in X days
 * @returns Number of tests marked as inactive
 */
export async function markInactiveTests(
  organizationId: number,
  inactiveDays: number = 30
): Promise<number> {
  const sql = getSql()

  const result = await sql`
    UPDATE suite_tests
    SET is_active = false, updated_at = NOW()
    WHERE organization_id = ${organizationId}
      AND is_active = true
      AND last_seen_at < NOW() - MAKE_INTERVAL(days => ${inactiveDays})
    RETURNING id
  `

  return result.length
}

/**
 * Update suite test counts (cached field)
 */
export async function updateSuiteTestCounts(organizationId: number): Promise<void> {
  const sql = getSql()

  await sql`
    UPDATE org_suites os
    SET
      test_count = (
        SELECT COUNT(*) FROM suite_tests st
        WHERE st.suite_id = os.id AND st.is_active = true
      ),
      updated_at = NOW()
    WHERE os.organization_id = ${organizationId}
  `
}

/**
 * Get inactive tests (for UI display)
 */
export async function getInactiveTests(
  organizationId: number,
  limit: number = 50
): Promise<SuiteTestWithSuite[]> {
  const sql = getSql()

  const result = await sql`
    SELECT st.*, os.name as suite_name
    FROM suite_tests st
    LEFT JOIN org_suites os ON st.suite_id = os.id
    WHERE st.organization_id = ${organizationId}
      AND st.is_active = false
    ORDER BY st.last_seen_at DESC
    LIMIT ${limit}
  `

  return result as unknown as SuiteTestWithSuite[]
}

/**
 * Get test by signature
 */
export async function getSuiteTestBySignature(
  organizationId: number,
  testSignature: string
): Promise<SuiteTest | null> {
  const sql = getSql()

  const result = await sql`
    SELECT * FROM suite_tests
    WHERE organization_id = ${organizationId}
      AND test_signature = ${testSignature}
    LIMIT 1
  `

  return result.length > 0 ? (result[0] as unknown as SuiteTest) : null
}

/**
 * Get tests for a specific suite with suite name included
 */
export async function getSuiteTestsWithSuiteName(
  organizationId: number,
  suiteId: number,
  options: { isActive?: boolean; limit?: number; offset?: number } = {}
): Promise<SuiteTestWithSuite[]> {
  const sql = getSql()
  const { isActive, limit = 100, offset = 0 } = options

  const conditions: string[] = [
    `st.organization_id = ${organizationId}`,
    `st.suite_id = ${suiteId}`,
  ]

  if (isActive !== undefined) {
    conditions.push(`st.is_active = ${isActive}`)
  }

  const whereClause = conditions.join(" AND ")

  const result = await sql`
    SELECT st.*, os.name as suite_name
    FROM suite_tests st
    LEFT JOIN org_suites os ON st.suite_id = os.id
    WHERE ${sql.unsafe(whereClause)}
    ORDER BY st.test_name ASC
    LIMIT ${limit} OFFSET ${offset}
  `

  return result as unknown as SuiteTestWithSuite[]
}

/**
 * Get suite counts summary (for dashboard)
 */
export async function getSuiteCountsSummary(organizationId: number): Promise<{
  total_suites: number
  active_suites: number
  total_tests: number
  active_tests: number
  inactive_tests: number
}> {
  const sql = getSql()

  const result = await sql`
    SELECT
      (SELECT COUNT(*) FROM org_suites WHERE organization_id = ${organizationId})::int as total_suites,
      (SELECT COUNT(*) FROM org_suites WHERE organization_id = ${organizationId} AND is_active = true)::int as active_suites,
      (SELECT COUNT(*) FROM suite_tests WHERE organization_id = ${organizationId})::int as total_tests,
      (SELECT COUNT(*) FROM suite_tests WHERE organization_id = ${organizationId} AND is_active = true)::int as active_tests,
      (SELECT COUNT(*) FROM suite_tests WHERE organization_id = ${organizationId} AND is_active = false)::int as inactive_tests
  `

  return result[0] as {
    total_suites: number
    active_suites: number
    total_tests: number
    active_tests: number
    inactive_tests: number
  }
}
