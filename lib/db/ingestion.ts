import { getSql } from "./connection"
import { generateTestSignature, isTestFlaky } from "./utils"
import { updateFlakinessHistory } from "./flakiness"
import { detectTechStack, upsertSuite, upsertSuiteTest, updateSuiteTestCounts } from "./suites"
import type { ExecutionRequest, TestResultRequest, ArtifactRequest } from "../types"

// ============================================
// Insert Functions for Data Ingestion
// ============================================

/**
 * Insert execution and auto-register suite
 * @returns Object with execution_id and suite_id
 */
export async function insertExecution(
  organizationId: number,
  data: ExecutionRequest
): Promise<{ executionId: number; suiteId: number | null }> {
  const sql = getSql()

  // Auto-register suite if provided
  let suiteId: number | null = null
  if (data.suite) {
    const techStack = detectTechStack(data.reporter)
    suiteId = await upsertSuite(organizationId, data.suite, techStack)
  }

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
      suite_id,
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
      ${suiteId},
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

  const executionId = result[0].id as number

  // Update suite's last_execution_id
  if (suiteId) {
    await sql`
      UPDATE org_suites
      SET last_execution_id = ${executionId}, last_execution_at = NOW()
      WHERE id = ${suiteId}
    `
  }

  return { executionId, suiteId }
}

export async function insertTestResults(
  organizationId: number,
  executionId: number,
  results: TestResultRequest[],
  suiteId?: number | null
): Promise<Map<string, number>> {
  const sql = getSql()
  const signatureToIdMap = new Map<string, number>()

  // Insert each result individually to get the ID back
  // Note: For very large result sets, consider batch insert with UNNEST
  for (const result of results) {
    const signature = generateTestSignature(result.test_file, result.test_name)
    const retryCount = result.retry_count ?? 0
    const flaky = isTestFlaky(retryCount, result.status)
    const isCritical = result.is_critical ?? false

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
        ${isCritical},
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

    // Auto-register test in suite_tests table
    await upsertSuiteTest(
      organizationId,
      signature,
      result.test_name,
      result.test_file,
      result.status,
      result.duration_ms,
      isCritical,
      suiteId ?? null
    )
  }

  // Update suite test count if suiteId is provided
  if (suiteId) {
    await updateSuiteTestCounts(organizationId)
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
