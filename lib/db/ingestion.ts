import { getSql } from "./connection"
import { generateTestSignature, isTestFlaky } from "./utils"
import { updateFlakinessHistory } from "./flakiness"
import type { ExecutionRequest, TestResultRequest, ArtifactRequest } from "../types"

// ============================================
// Insert Functions for Data Ingestion
// ============================================

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
