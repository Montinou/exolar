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

// Batch size for concurrent flakiness/suite upserts
const BATCH_SIZE = 50

/**
 * Run an array of async tasks in batches of batchSize with Promise.all
 */
async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number
): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map((fn) => fn()))
    results.push(...batchResults)
  }
  return results
}

export async function insertTestResults(
  organizationId: number,
  executionId: number,
  results: TestResultRequest[],
  suiteId?: number | null
): Promise<Map<string, number>> {
  const sql = getSql()
  const signatureToIdMap = new Map<string, number>()

  if (results.length === 0) {
    return signatureToIdMap
  }

  // Pre-compute derived fields for every result
  type PreparedRow = {
    signature: string
    retryCount: number
    flaky: boolean
    isCritical: boolean
    result: TestResultRequest
  }

  const prepared: PreparedRow[] = results.map((result) => {
    const signature = generateTestSignature(result.test_file, result.test_name)
    const retryCount = result.retry_count ?? 0
    return {
      signature,
      retryCount,
      flaky: isTestFlaky(retryCount, result.status),
      isCritical: result.is_critical ?? false,
      result,
    }
  })

  // -------------------------------------------------------
  // 1. Batch INSERT test_results via UNNEST — single query
  // -------------------------------------------------------
  const executionIds = prepared.map(() => executionId)
  const testNames = prepared.map((r) => r.result.test_name)
  const testFiles = prepared.map((r) => r.result.test_file)
  const signatures = prepared.map((r) => r.signature)
  const statuses = prepared.map((r) => r.result.status)
  const durations = prepared.map((r) => r.result.duration_ms)
  const criticals = prepared.map((r) => r.isCritical)
  const flakies = prepared.map((r) => r.flaky)
  const errors = prepared.map((r) => r.result.error_message ?? null)
  const stacks = prepared.map((r) => r.result.stack_trace ?? null)
  const browsers = prepared.map((r) => r.result.browser ?? "chromium")
  const retryCounts = prepared.map((r) => r.retryCount)
  const logs = prepared.map((r) =>
    r.result.logs ? JSON.stringify(r.result.logs) : null
  )
  const aiContexts = prepared.map((r) =>
    r.result.ai_context ? JSON.stringify(r.result.ai_context) : null
  )
  const startedAts = prepared.map(
    (r) => r.result.started_at || new Date().toISOString()
  )
  const completedAts = prepared.map((r) => r.result.completed_at || null)

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
    )
    SELECT * FROM UNNEST(
      ${executionIds}::int[],
      ${testNames}::text[],
      ${testFiles}::text[],
      ${signatures}::text[],
      ${statuses}::text[],
      ${durations}::int[],
      ${criticals}::boolean[],
      ${flakies}::boolean[],
      ${errors}::text[],
      ${stacks}::text[],
      ${browsers}::text[],
      ${retryCounts}::int[],
      ${logs}::jsonb[],
      ${aiContexts}::jsonb[],
      ${startedAts}::timestamptz[],
      ${completedAts}::timestamptz[]
    ) AS t(
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
    )
    RETURNING id, test_signature
  `

  for (const row of inserted) {
    signatureToIdMap.set(row.test_signature as string, row.id as number)
  }

  // -------------------------------------------------------
  // 2. Batch updateFlakinessHistory — groups of BATCH_SIZE
  //    Use unique signatures to avoid duplicate work within
  //    the same ingestion call.
  // -------------------------------------------------------
  const seenSignatures = new Set<string>()
  const flakinessTasks = prepared
    .filter((r) => {
      if (seenSignatures.has(r.signature)) return false
      seenSignatures.add(r.signature)
      return true
    })
    .map(
      (r) => () =>
        updateFlakinessHistory(
          organizationId,
          r.signature,
          r.result.test_name,
          r.result.test_file,
          r.result.status,
          r.retryCount,
          r.result.duration_ms
        )
    )

  await runInBatches(flakinessTasks, BATCH_SIZE)

  // -------------------------------------------------------
  // 3. Batch upsertSuiteTest — groups of BATCH_SIZE
  // -------------------------------------------------------
  const suiteTasks = prepared.map(
    (r) => () =>
      upsertSuiteTest(
        organizationId,
        r.signature,
        r.result.test_name,
        r.result.test_file,
        r.result.status,
        r.result.duration_ms,
        r.isCritical,
        suiteId ?? null
      )
  )

  await runInBatches(suiteTasks, BATCH_SIZE)

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
        ${`r2://${artifact.r2_key}`},
        ${artifact.size_bytes ?? null},
        ${artifact.mime_type ?? null}
      )
    `

    insertedCount++
  }

  return insertedCount
}
