/**
 * lib/services/root-cause-clustering-service.ts
 * Hierarchical Root Cause Clustering Service
 *
 * Replaces greedy similarity-only clustering with a structured approach:
 * Level 1: Error Category (timeout, assertion, network, element, api)
 * Level 2: Error Subcategory (assertion type, HTTP status, locator pattern)
 * Level 3: Semantic Similarity (fine-grained grouping within subcategory)
 */

import { getSql } from "@/lib/db/connection"
import crypto from "crypto"

// ============================================
// Types
// ============================================

export type ErrorCategory = "timeout" | "assertion" | "network" | "element" | "api" | "other"

export type RootCauseStatus = "open" | "investigating" | "fixed" | "wont_fix" | "flaky"

export interface FailureForClustering {
  id: number
  testName: string
  testFile: string
  testSignature: string
  errorMessage: string | null
  stackTrace: string | null
  executionId: number
}

export interface RootCause {
  id: number
  organizationId: number
  canonicalSignature: string
  errorCategory: ErrorCategory
  errorSubcategory: string | null
  patternSignature: string | null
  representativeError: string
  representativeStackTrace: string | null
  totalOccurrences: number
  affectedTests: number
  firstSeen: string
  lastSeen: string
  aiRootCause: string | null
  aiFixSuggestion: string | null
  aiAnalyzedAt: string | null
  status: RootCauseStatus
  statusNote: string | null
}

export interface ClusteringResult {
  rootCauseId: number
  canonicalSignature: string
  errorCategory: ErrorCategory
  errorSubcategory: string | null
  representativeError: string
  failureCount: number
  testResultIds: number[]
  isNew: boolean
}

// ============================================
// Error Pattern Extraction
// ============================================

/**
 * Patterns for categorizing errors by type
 */
const ERROR_PATTERNS = {
  timeout: [
    /TimeoutError/i,
    /Timeout .* exceeded/i,
    /waiting for.*timed out/i,
    /Navigation timeout/i,
    /locator\..*\(.*timeout/i,
    /Waiting for selector.*timed out/i,
  ],
  assertion: [
    /expect\(.*\)\.(toBe|toEqual|toHaveText|toContain|toMatch)/i,
    /AssertionError/i,
    /Expected.*to (be|equal|have|contain|match)/i,
    /Received.*Expected/i,
  ],
  network: [
    /net::/i,
    /NetworkError/i,
    /fetch failed/i,
    /ERR_CONNECTION/i,
    /ERR_NETWORK/i,
    /ECONNREFUSED/i,
    /status:\s*(4|5)\d{2}/i,
    /HTTP\s*(4|5)\d{2}/i,
    /Request failed with status/i,
  ],
  element: [
    /locator.*not found/i,
    /element not visible/i,
    /No element matches locator/i,
    /waiting for locator/i,
    /locator resolved to .* elements/i,
    /Error: page\..*locator/i,
    /Strict mode violation/i,
  ],
  api: [
    /API (Error|error)/i,
    /GraphQL error/i,
    /Response error/i,
    /Invalid response/i,
    /Unauthorized|Forbidden/i,
  ],
}

/**
 * Subcategory extraction patterns
 */
const SUBCATEGORY_PATTERNS = {
  assertion: [
    { pattern: /\.toBe\(/i, subcategory: "toBe" },
    { pattern: /\.toEqual\(/i, subcategory: "toEqual" },
    { pattern: /\.toHaveText\(/i, subcategory: "toHaveText" },
    { pattern: /\.toContain\(/i, subcategory: "toContain" },
    { pattern: /\.toBeVisible\(/i, subcategory: "toBeVisible" },
    { pattern: /\.toBeHidden\(/i, subcategory: "toBeHidden" },
    { pattern: /\.toBeTruthy\(/i, subcategory: "toBeTruthy" },
    { pattern: /\.toBeFalsy\(/i, subcategory: "toBeFalsy" },
  ],
  network: [
    { pattern: /status:\s*401/i, subcategory: "401_unauthorized" },
    { pattern: /status:\s*403/i, subcategory: "403_forbidden" },
    { pattern: /status:\s*404/i, subcategory: "404_not_found" },
    { pattern: /status:\s*500/i, subcategory: "500_server_error" },
    { pattern: /ECONNREFUSED/i, subcategory: "connection_refused" },
  ],
  element: [
    { pattern: /locator\.click/i, subcategory: "click" },
    { pattern: /locator\.fill/i, subcategory: "fill" },
    { pattern: /locator\.type/i, subcategory: "type" },
    { pattern: /locator\.waitFor/i, subcategory: "waitFor" },
    { pattern: /Strict mode/i, subcategory: "strict_mode" },
  ],
  timeout: [
    { pattern: /Navigation timeout/i, subcategory: "navigation" },
    { pattern: /locator.*timeout/i, subcategory: "locator_timeout" },
    { pattern: /waitForSelector.*timeout/i, subcategory: "selector_timeout" },
  ],
}

/**
 * Extract error category from error message
 */
export function extractErrorCategory(errorMessage: string | null): ErrorCategory {
  if (!errorMessage) return "other"

  for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(errorMessage)) {
        return category as ErrorCategory
      }
    }
  }

  return "other"
}

/**
 * Extract error subcategory from error message
 */
export function extractErrorSubcategory(
  errorMessage: string | null,
  category: ErrorCategory
): string | null {
  if (!errorMessage || category === "other") return null

  const patterns = SUBCATEGORY_PATTERNS[category as keyof typeof SUBCATEGORY_PATTERNS]
  if (!patterns) return null

  for (const { pattern, subcategory } of patterns) {
    if (pattern.test(errorMessage)) {
      return subcategory
    }
  }

  return null
}

/**
 * Create anonymized pattern signature
 * Replaces variable parts (IDs, timestamps, etc.) with placeholders
 */
export function createPatternSignature(errorMessage: string | null): string | null {
  if (!errorMessage) return null

  let pattern = errorMessage
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<UUID>")
    // Replace numeric IDs
    .replace(/\b\d{4,}\b/g, "<ID>")
    // Replace URLs with paths preserved
    .replace(/(https?:\/\/)[^\/\s]+/gi, "$1<HOST>")
    // Replace timestamps
    .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/g, "<TIMESTAMP>")
    // Replace file line numbers
    .replace(/:\d+:\d+/g, ":<LINE>")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim()

  // Truncate to reasonable length
  if (pattern.length > 200) {
    pattern = pattern.slice(0, 200) + "..."
  }

  return pattern
}

/**
 * Generate canonical signature for root cause deduplication
 */
export function generateCanonicalSignature(
  category: ErrorCategory,
  subcategory: string | null,
  pattern: string | null
): string {
  const parts = [category, subcategory || "none", pattern || "none"]
  return crypto.createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 32)
}

// ============================================
// Database Operations
// ============================================

/**
 * Get failures for an execution that need clustering
 */
export async function getFailuresForClustering(
  organizationId: number,
  executionId: number
): Promise<FailureForClustering[]> {
  const sql = getSql()

  const results = await sql`
    SELECT
      tr.id,
      tr.test_name,
      tr.test_file,
      tr.test_signature,
      tr.error_message,
      tr.stack_trace,
      tr.execution_id
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.execution_id = ${executionId}
      AND tr.status IN ('failed', 'timedout')
  `

  return results.map(r => ({
    id: r.id as number,
    testName: r.test_name as string,
    testFile: r.test_file as string,
    testSignature: r.test_signature as string,
    errorMessage: r.error_message as string | null,
    stackTrace: r.stack_trace as string | null,
    executionId: r.execution_id as number,
  }))
}

/**
 * Get or create a root cause entry
 */
export async function upsertRootCause(
  organizationId: number,
  canonicalSignature: string,
  category: ErrorCategory,
  subcategory: string | null,
  patternSignature: string | null,
  representativeError: string,
  stackTrace: string | null
): Promise<{ id: number; isNew: boolean }> {
  const sql = getSql()

  // Try to find existing
  const existing = await sql`
    SELECT id
    FROM failure_root_causes
    WHERE organization_id = ${organizationId}
      AND canonical_signature = ${canonicalSignature}
  `

  if (existing.length > 0) {
    // Update statistics
    await sql`
      UPDATE failure_root_causes
      SET
        total_occurrences = total_occurrences + 1,
        last_seen = NOW()
      WHERE id = ${existing[0].id}
    `
    return { id: existing[0].id as number, isNew: false }
  }

  // Create new root cause
  const result = await sql`
    INSERT INTO failure_root_causes (
      organization_id,
      canonical_signature,
      error_category,
      error_subcategory,
      pattern_signature,
      representative_error,
      representative_stack_trace
    ) VALUES (
      ${organizationId},
      ${canonicalSignature},
      ${category},
      ${subcategory},
      ${patternSignature},
      ${representativeError.slice(0, 2000)},
      ${stackTrace?.slice(0, 5000) || null}
    )
    RETURNING id
  `

  return { id: result[0].id as number, isNew: true }
}

/**
 * Link a test result to a root cause
 */
export async function linkFailureToRootCause(
  rootCauseId: number,
  testResultId: number,
  similarityScore?: number
): Promise<void> {
  const sql = getSql()

  await sql`
    INSERT INTO failure_root_cause_links (
      root_cause_id,
      test_result_id,
      similarity_score
    ) VALUES (
      ${rootCauseId},
      ${testResultId},
      ${similarityScore ?? null}
    )
    ON CONFLICT (test_result_id) DO UPDATE SET
      root_cause_id = EXCLUDED.root_cause_id,
      similarity_score = EXCLUDED.similarity_score
  `
}

/**
 * Update affected tests count for a root cause
 */
export async function updateRootCauseTestCount(rootCauseId: number): Promise<void> {
  const sql = getSql()

  await sql`
    UPDATE failure_root_causes
    SET affected_tests = (
      SELECT COUNT(DISTINCT tr.test_signature)
      FROM failure_root_cause_links frcl
      JOIN test_results tr ON frcl.test_result_id = tr.id
      WHERE frcl.root_cause_id = ${rootCauseId}
    )
    WHERE id = ${rootCauseId}
  `
}

// ============================================
// Main Clustering Function
// ============================================

/**
 * Cluster failures for an execution using hierarchical approach
 */
export async function clusterFailuresHierarchical(
  organizationId: number,
  executionId: number
): Promise<ClusteringResult[]> {
  // Get all failures
  const failures = await getFailuresForClustering(organizationId, executionId)

  if (failures.length === 0) {
    return []
  }

  // Group by canonical signature
  const groups = new Map<string, {
    category: ErrorCategory
    subcategory: string | null
    pattern: string | null
    representative: FailureForClustering
    failures: FailureForClustering[]
  }>()

  for (const failure of failures) {
    const category = extractErrorCategory(failure.errorMessage)
    const subcategory = extractErrorSubcategory(failure.errorMessage, category)
    const pattern = createPatternSignature(failure.errorMessage)
    const signature = generateCanonicalSignature(category, subcategory, pattern)

    if (!groups.has(signature)) {
      groups.set(signature, {
        category,
        subcategory,
        pattern,
        representative: failure,
        failures: [],
      })
    }

    groups.get(signature)!.failures.push(failure)
  }

  // Create/update root causes and link failures
  const results: ClusteringResult[] = []

  for (const [signature, group] of groups) {
    const { id: rootCauseId, isNew } = await upsertRootCause(
      organizationId,
      signature,
      group.category,
      group.subcategory,
      group.pattern,
      group.representative.errorMessage || "Unknown error",
      group.representative.stackTrace
    )

    // Link all failures to this root cause
    for (const failure of group.failures) {
      await linkFailureToRootCause(rootCauseId, failure.id)
    }

    // Update affected tests count
    await updateRootCauseTestCount(rootCauseId)

    results.push({
      rootCauseId,
      canonicalSignature: signature,
      errorCategory: group.category,
      errorSubcategory: group.subcategory,
      representativeError: group.representative.errorMessage || "Unknown error",
      failureCount: group.failures.length,
      testResultIds: group.failures.map(f => f.id),
      isNew,
    })
  }

  return results
}

// ============================================
// Query Functions
// ============================================

/**
 * Get root causes for an organization
 */
export async function getRootCauses(
  organizationId: number,
  options?: {
    status?: RootCauseStatus
    category?: ErrorCategory
    limit?: number
    offset?: number
    since?: string
  }
): Promise<RootCause[]> {
  const sql = getSql()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let query = sql`
    SELECT
      id,
      organization_id,
      canonical_signature,
      error_category,
      error_subcategory,
      pattern_signature,
      representative_error,
      representative_stack_trace,
      total_occurrences,
      affected_tests,
      first_seen,
      last_seen,
      ai_root_cause,
      ai_fix_suggestion,
      ai_analyzed_at,
      status,
      status_note
    FROM failure_root_causes
    WHERE organization_id = ${organizationId}
  `

  if (options?.status) {
    query = sql`${query} AND status = ${options.status}`
  }
  if (options?.category) {
    query = sql`${query} AND error_category = ${options.category}`
  }
  if (options?.since) {
    query = sql`${query} AND last_seen >= ${options.since}`
  }

  query = sql`${query} ORDER BY last_seen DESC LIMIT ${limit} OFFSET ${offset}`

  const results = await query

  return results.map(r => ({
    id: r.id as number,
    organizationId: r.organization_id as number,
    canonicalSignature: r.canonical_signature as string,
    errorCategory: r.error_category as ErrorCategory,
    errorSubcategory: r.error_subcategory as string | null,
    patternSignature: r.pattern_signature as string | null,
    representativeError: r.representative_error as string,
    representativeStackTrace: r.representative_stack_trace as string | null,
    totalOccurrences: r.total_occurrences as number,
    affectedTests: r.affected_tests as number,
    firstSeen: r.first_seen as string,
    lastSeen: r.last_seen as string,
    aiRootCause: r.ai_root_cause as string | null,
    aiFixSuggestion: r.ai_fix_suggestion as string | null,
    aiAnalyzedAt: r.ai_analyzed_at as string | null,
    status: r.status as RootCauseStatus,
    statusNote: r.status_note as string | null,
  }))
}

/**
 * Get clustered failures for an execution
 */
export async function getClusteredFailuresForExecution(
  organizationId: number,
  executionId: number
): Promise<Array<{
  rootCause: RootCause
  failures: Array<{
    id: number
    testName: string
    testFile: string
    errorMessage: string | null
    similarityScore: number | null
  }>
}>> {
  const sql = getSql()

  const results = await sql`
    SELECT
      frc.id as root_cause_id,
      frc.canonical_signature,
      frc.error_category,
      frc.error_subcategory,
      frc.pattern_signature,
      frc.representative_error,
      frc.total_occurrences,
      frc.affected_tests,
      frc.first_seen,
      frc.last_seen,
      frc.status,
      frc.ai_root_cause,
      tr.id as test_result_id,
      tr.test_name,
      tr.test_file,
      tr.error_message,
      frcl.similarity_score
    FROM failure_root_cause_links frcl
    JOIN failure_root_causes frc ON frcl.root_cause_id = frc.id
    JOIN test_results tr ON frcl.test_result_id = tr.id
    WHERE frc.organization_id = ${organizationId}
      AND tr.execution_id = ${executionId}
    ORDER BY frc.total_occurrences DESC, frc.id, tr.test_name
  `

  // Group by root cause
  const grouped = new Map<number, {
    rootCause: RootCause
    failures: Array<{
      id: number
      testName: string
      testFile: string
      errorMessage: string | null
      similarityScore: number | null
    }>
  }>()

  for (const row of results) {
    const rcId = row.root_cause_id as number

    if (!grouped.has(rcId)) {
      grouped.set(rcId, {
        rootCause: {
          id: rcId,
          organizationId,
          canonicalSignature: row.canonical_signature as string,
          errorCategory: row.error_category as ErrorCategory,
          errorSubcategory: row.error_subcategory as string | null,
          patternSignature: row.pattern_signature as string | null,
          representativeError: row.representative_error as string,
          representativeStackTrace: null,
          totalOccurrences: row.total_occurrences as number,
          affectedTests: row.affected_tests as number,
          firstSeen: row.first_seen as string,
          lastSeen: row.last_seen as string,
          aiRootCause: row.ai_root_cause as string | null,
          aiFixSuggestion: null,
          aiAnalyzedAt: null,
          status: row.status as RootCauseStatus,
          statusNote: null,
        },
        failures: [],
      })
    }

    grouped.get(rcId)!.failures.push({
      id: row.test_result_id as number,
      testName: row.test_name as string,
      testFile: row.test_file as string,
      errorMessage: row.error_message as string | null,
      similarityScore: row.similarity_score as number | null,
    })
  }

  return Array.from(grouped.values())
}

/**
 * Update root cause status
 */
export async function updateRootCauseStatus(
  organizationId: number,
  rootCauseId: number,
  status: RootCauseStatus,
  note: string | null,
  userId: number | null
): Promise<{ previous_status: RootCauseStatus; affected_tests: number } | null> {
  const sql = getSql()

  // Get current status and affected tests
  const current = await sql`
    SELECT status, affected_tests
    FROM failure_root_causes
    WHERE id = ${rootCauseId}
      AND organization_id = ${organizationId}
  `

  if (current.length === 0) {
    return null
  }

  const previousStatus = current[0].status as RootCauseStatus
  const affectedTests = current[0].affected_tests as number

  // Update the status
  await sql`
    UPDATE failure_root_causes
    SET
      status = ${status},
      status_changed_by = ${userId},
      status_changed_at = NOW(),
      status_note = ${note}
    WHERE id = ${rootCauseId}
      AND organization_id = ${organizationId}
  `

  return {
    previous_status: previousStatus,
    affected_tests: affectedTests,
  }
}

// ============================================
// Exports
// ============================================

export {
  ERROR_PATTERNS,
  SUBCATEGORY_PATTERNS,
}
