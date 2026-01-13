/**
 * Database functions for vector embeddings
 *
 * Supports dual storage:
 * - v1: 768-dim Gemini embeddings (error_embedding)
 * - v2: 512-dim Jina embeddings (error_embedding_v2)
 */

import { getSql } from "./connection"
import { toVectorString, EMBEDDING_DIMENSIONS } from "@/lib/ai"
import type { EmbeddingProvider } from "@/lib/ai/types"
import { createHash } from "crypto"

// ============================================
// V1 Storage (768-dim, Gemini) - Legacy
// ============================================

/**
 * Store a v1 embedding for a test result (768-dim Gemini)
 *
 * @param testResultId - ID of the test result
 * @param embedding - 768-dimensional embedding vector
 */
export async function storeEmbedding(
  testResultId: number,
  embedding: number[]
): Promise<void> {
  const sql = getSql()

  if (embedding.length !== 768) {
    throw new Error(
      `Invalid embedding dimensions: expected 768, got ${embedding.length}`
    )
  }

  await sql`
    UPDATE test_results
    SET error_embedding = ${toVectorString(embedding)}::vector
    WHERE id = ${testResultId}
  `
}

// ============================================
// V2 Storage (512-dim, Jina) - Primary
// ============================================

/**
 * Store a v2 embedding for a test result (512-dim Jina)
 *
 * @param testResultId - ID of the test result
 * @param embedding - 512-dimensional embedding vector
 * @param chunkHash - Hash of the source text (for incremental updates)
 */
export async function storeEmbeddingV2(
  testResultId: number,
  embedding: number[],
  chunkHash?: string
): Promise<void> {
  const sql = getSql()

  if (embedding.length !== 512) {
    throw new Error(
      `Invalid v2 embedding dimensions: expected 512, got ${embedding.length}`
    )
  }

  await sql`
    UPDATE test_results
    SET error_embedding_v2 = ${toVectorString(embedding)}::vector,
        embedding_chunk_hash = ${chunkHash ?? null}
    WHERE id = ${testResultId}
  `
}

/**
 * Store embeddings based on provider (auto-detect dimensions)
 *
 * @param testResultId - ID of the test result
 * @param embedding - Embedding vector (512 or 768 dimensions)
 * @param provider - Provider that generated the embedding
 * @param chunkHash - Optional hash for v2 embeddings
 */
export async function storeEmbeddingAuto(
  testResultId: number,
  embedding: number[],
  provider: EmbeddingProvider,
  chunkHash?: string
): Promise<void> {
  const expectedDim = EMBEDDING_DIMENSIONS[provider]

  if (embedding.length !== expectedDim) {
    throw new Error(
      `Invalid ${provider} embedding dimensions: expected ${expectedDim}, got ${embedding.length}`
    )
  }

  if (provider === "jina") {
    await storeEmbeddingV2(testResultId, embedding, chunkHash)
  } else {
    await storeEmbedding(testResultId, embedding)
  }
}

/**
 * Store v1 embeddings for multiple test results (768-dim)
 *
 * @param embeddings - Array of {testResultId, embedding} pairs
 */
export async function storeEmbeddingsBatch(
  embeddings: Array<{ testResultId: number; embedding: number[] }>
): Promise<void> {
  const sql = getSql()

  if (embeddings.length === 0) return

  // Filter valid embeddings
  const valid = embeddings.filter((e) => e.embedding.length === 768)

  if (valid.length === 0) return

  // Update each one individually (Neon doesn't support batch CASE updates well)
  for (const { testResultId, embedding } of valid) {
    await sql`
      UPDATE test_results
      SET error_embedding = ${toVectorString(embedding)}::vector
      WHERE id = ${testResultId}
    `
  }
}

/**
 * Store v2 embeddings for multiple test results (512-dim)
 *
 * @param embeddings - Array of {testResultId, embedding, chunkHash?} entries
 */
export async function storeEmbeddingsBatchV2(
  embeddings: Array<{ testResultId: number; embedding: number[]; chunkHash?: string }>
): Promise<void> {
  const sql = getSql()

  if (embeddings.length === 0) return

  // Filter valid embeddings
  const valid = embeddings.filter((e) => e.embedding.length === 512)

  if (valid.length === 0) return

  // Update each one individually
  for (const { testResultId, embedding, chunkHash } of valid) {
    await sql`
      UPDATE test_results
      SET error_embedding_v2 = ${toVectorString(embedding)}::vector,
          embedding_chunk_hash = ${chunkHash ?? null}
      WHERE id = ${testResultId}
    `
  }
}

/**
 * Get test results that need v1 embeddings (legacy Gemini)
 *
 * Returns failed tests without v1 embeddings, ordered by most recent first.
 *
 * @param organizationId - Filter by organization
 * @param limit - Max results to return
 */
export async function getTestsNeedingEmbeddings(
  organizationId: number,
  limit: number = 100
): Promise<
  Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
  }>
> {
  const sql = getSql()

  const results = await sql`
    SELECT tr.id, tr.error_message, tr.stack_trace
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.status IN ('failed', 'timedout')
      AND tr.error_embedding IS NULL
      AND (tr.error_message IS NOT NULL OR tr.stack_trace IS NOT NULL)
    ORDER BY tr.created_at DESC
    LIMIT ${limit}
  `

  return results as Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
  }>
}

/**
 * Get test results that need v2 embeddings (Jina)
 *
 * Returns failed tests without v2 embeddings, ordered by most recent first.
 * Optionally filter by changed content (using chunk hash).
 *
 * @param organizationId - Filter by organization
 * @param limit - Max results to return
 * @param includeWithStaleHash - Include tests where hash doesn't match current content
 */
export async function getTestsNeedingEmbeddingsV2(
  organizationId: number,
  limit: number = 100
): Promise<
  Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
    current_hash: string | null
  }>
> {
  const sql = getSql()

  const results = await sql`
    SELECT tr.id, tr.error_message, tr.stack_trace, tr.embedding_chunk_hash as current_hash
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.status IN ('failed', 'timedout')
      AND tr.error_embedding_v2 IS NULL
      AND (tr.error_message IS NOT NULL OR tr.stack_trace IS NOT NULL)
    ORDER BY tr.created_at DESC
    LIMIT ${limit}
  `

  return results as Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
    current_hash: string | null
  }>
}

/**
 * Generate a hash for embedding source text
 * Used to detect changes for incremental re-indexing
 */
export function generateChunkHash(errorMessage: string | null, stackTrace: string | null): string {
  const content = [errorMessage ?? "", stackTrace ?? ""].join("\n")
  return createHash("md5").update(content).digest("hex")
}

/**
 * Get v1 embedding for a specific test result (768-dim)
 *
 * @param testResultId - ID of the test result
 * @returns Embedding as number array, or null if not found
 */
export async function getEmbedding(
  testResultId: number
): Promise<number[] | null> {
  const sql = getSql()

  const result = await sql`
    SELECT error_embedding::text as embedding
    FROM test_results
    WHERE id = ${testResultId}
      AND error_embedding IS NOT NULL
  `

  if (result.length === 0 || !result[0].embedding) {
    return null
  }

  // Parse PostgreSQL vector format "[0.1,0.2,0.3]"
  const vectorStr = result[0].embedding as string
  return vectorStr
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map(Number)
}

/**
 * Get v2 embedding for a specific test result (512-dim)
 *
 * @param testResultId - ID of the test result
 * @returns Embedding as number array, or null if not found
 */
export async function getEmbeddingV2(
  testResultId: number
): Promise<number[] | null> {
  const sql = getSql()

  const result = await sql`
    SELECT error_embedding_v2::text as embedding
    FROM test_results
    WHERE id = ${testResultId}
      AND error_embedding_v2 IS NOT NULL
  `

  if (result.length === 0 || !result[0].embedding) {
    return null
  }

  const vectorStr = result[0].embedding as string
  return vectorStr
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map(Number)
}

/**
 * Get the best available embedding (prefers v2)
 *
 * @param testResultId - ID of the test result
 * @returns {embedding, version} or null
 */
export async function getBestEmbedding(
  testResultId: number
): Promise<{ embedding: number[]; version: "v1" | "v2" } | null> {
  // Try v2 first (Jina, 512-dim)
  const v2 = await getEmbeddingV2(testResultId)
  if (v2) {
    return { embedding: v2, version: "v2" }
  }

  // Fall back to v1 (Gemini, 768-dim)
  const v1 = await getEmbedding(testResultId)
  if (v1) {
    return { embedding: v1, version: "v1" }
  }

  return null
}

/**
 * Find similar failures using vector similarity
 *
 * @param embedding - Query embedding
 * @param executionId - Limit to specific execution (optional)
 * @param organizationId - Organization for cross-execution search
 * @param threshold - Max cosine distance (lower = more similar)
 * @param limit - Max results
 */
export async function findSimilarFailures(
  embedding: number[],
  options: {
    executionId?: number
    organizationId?: number
    threshold?: number
    limit?: number
  } = {}
): Promise<
  Array<{
    id: number
    test_name: string
    test_file: string
    error_message: string | null
    similarity: number
    execution_id: number
  }>
> {
  const sql = getSql()
  const { executionId, organizationId, threshold = 0.15, limit = 20 } = options

  const vectorStr = toVectorString(embedding)

  if (executionId) {
    // Search within single execution
    return (await sql`
      SELECT
        id,
        test_name,
        test_file,
        error_message,
        execution_id,
        1 - (error_embedding <=> ${vectorStr}::vector) as similarity
      FROM test_results
      WHERE execution_id = ${executionId}
        AND error_embedding IS NOT NULL
        AND error_embedding <=> ${vectorStr}::vector < ${threshold}
      ORDER BY error_embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `) as Array<{
      id: number
      test_name: string
      test_file: string
      error_message: string | null
      similarity: number
      execution_id: number
    }>
  } else if (organizationId) {
    // Search across organization
    return (await sql`
      SELECT
        tr.id,
        tr.test_name,
        tr.test_file,
        tr.error_message,
        tr.execution_id,
        1 - (tr.error_embedding <=> ${vectorStr}::vector) as similarity
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.error_embedding IS NOT NULL
        AND tr.error_embedding <=> ${vectorStr}::vector < ${threshold}
      ORDER BY tr.error_embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `) as Array<{
      id: number
      test_name: string
      test_file: string
      error_message: string | null
      similarity: number
      execution_id: number
    }>
  }

  throw new Error("Either executionId or organizationId must be provided")
}

/**
 * Count tests with embeddings for an organization
 */
export async function countTestsWithEmbeddings(
  organizationId: number
): Promise<{ withEmbedding: number; withEmbeddingV2: number; total: number }> {
  const sql = getSql()

  const [result] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE tr.error_embedding IS NOT NULL) as with_embedding,
      COUNT(*) FILTER (WHERE tr.error_embedding_v2 IS NOT NULL) as with_embedding_v2,
      COUNT(*) as total
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.status IN ('failed', 'timedout')
  `

  return {
    withEmbedding: Number(result.with_embedding),
    withEmbeddingV2: Number(result.with_embedding_v2),
    total: Number(result.total),
  }
}

/**
 * Find similar failures using v2 embeddings (512-dim Jina)
 *
 * @param embedding - Query embedding (512-dim)
 * @param options - Search options
 */
export async function findSimilarFailuresV2(
  embedding: number[],
  options: {
    executionId?: number
    organizationId?: number
    threshold?: number
    limit?: number
  } = {}
): Promise<
  Array<{
    id: number
    test_name: string
    test_file: string
    error_message: string | null
    similarity: number
    execution_id: number
  }>
> {
  const sql = getSql()
  const { executionId, organizationId, threshold = 0.15, limit = 20 } = options

  if (embedding.length !== 512) {
    throw new Error(`Expected 512-dim embedding, got ${embedding.length}`)
  }

  const vectorStr = toVectorString(embedding)

  if (executionId) {
    // Search within single execution
    return (await sql`
      SELECT
        id,
        test_name,
        test_file,
        error_message,
        execution_id,
        1 - (error_embedding_v2 <=> ${vectorStr}::vector) as similarity
      FROM test_results
      WHERE execution_id = ${executionId}
        AND error_embedding_v2 IS NOT NULL
        AND error_embedding_v2 <=> ${vectorStr}::vector < ${threshold}
      ORDER BY error_embedding_v2 <=> ${vectorStr}::vector
      LIMIT ${limit}
    `) as Array<{
      id: number
      test_name: string
      test_file: string
      error_message: string | null
      similarity: number
      execution_id: number
    }>
  } else if (organizationId) {
    // Search across organization
    return (await sql`
      SELECT
        tr.id,
        tr.test_name,
        tr.test_file,
        tr.error_message,
        tr.execution_id,
        1 - (tr.error_embedding_v2 <=> ${vectorStr}::vector) as similarity
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.error_embedding_v2 IS NOT NULL
        AND tr.error_embedding_v2 <=> ${vectorStr}::vector < ${threshold}
      ORDER BY tr.error_embedding_v2 <=> ${vectorStr}::vector
      LIMIT ${limit}
    `) as Array<{
      id: number
      test_name: string
      test_file: string
      error_message: string | null
      similarity: number
      execution_id: number
    }>
  }

  throw new Error("Either executionId or organizationId must be provided")
}

// ============================================
// Universal Test Embeddings (ALL tests)
// ============================================

/**
 * Store a test embedding for any test result (passed, failed, skipped)
 *
 * @param testResultId - ID of the test result
 * @param embedding - 512-dimensional embedding vector
 * @param hash - Hash of the source text for incremental updates
 */
export async function storeTestEmbedding(
  testResultId: number,
  embedding: number[],
  hash: string
): Promise<void> {
  const sql = getSql()

  if (embedding.length !== 512) {
    throw new Error(
      `Invalid test embedding dimensions: expected 512, got ${embedding.length}`
    )
  }

  await sql`
    UPDATE test_results
    SET test_embedding = ${toVectorString(embedding)}::vector,
        test_embedding_hash = ${hash}
    WHERE id = ${testResultId}
  `
}

/**
 * Store test embeddings for multiple test results (batch)
 *
 * @param embeddings - Array of {testResultId, embedding, hash} entries
 */
export async function storeTestEmbeddingsBatch(
  embeddings: Array<{ testResultId: number; embedding: number[]; hash: string }>
): Promise<void> {
  const sql = getSql()

  if (embeddings.length === 0) return

  // Filter valid embeddings
  const valid = embeddings.filter((e) => e.embedding.length === 512)

  if (valid.length === 0) return

  // Update each one individually
  for (const { testResultId, embedding, hash } of valid) {
    await sql`
      UPDATE test_results
      SET test_embedding = ${toVectorString(embedding)}::vector,
          test_embedding_hash = ${hash}
      WHERE id = ${testResultId}
    `
  }
}

/**
 * Get test results that need test embeddings (all statuses)
 *
 * Returns tests without test_embedding, ordered by most recent first.
 *
 * @param organizationId - Filter by organization
 * @param limit - Max results to return
 * @param status - Optional status filter ('passed', 'failed', 'skipped', or null for all)
 */
export async function getTestsNeedingTestEmbeddings(
  organizationId: number,
  limit: number = 100,
  status?: string | null
): Promise<
  Array<{
    id: number
    test_name: string
    test_file: string | null
    status: string
    duration_ms: number | null
    browser: string | null
    retry_count: number | null
    error_message: string | null
    current_hash: string | null
  }>
> {
  const sql = getSql()

  if (status) {
    const results = await sql`
      SELECT
        tr.id, tr.test_name, tr.test_file, tr.status,
        tr.duration_ms, tr.browser, tr.retry_count,
        tr.error_message, tr.test_embedding_hash as current_hash
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.test_embedding IS NULL
        AND tr.status = ${status}
      ORDER BY tr.created_at DESC
      LIMIT ${limit}
    `
    return results as Array<{
      id: number
      test_name: string
      test_file: string | null
      status: string
      duration_ms: number | null
      browser: string | null
      retry_count: number | null
      error_message: string | null
      current_hash: string | null
    }>
  }

  const results = await sql`
    SELECT
      tr.id, tr.test_name, tr.test_file, tr.status,
      tr.duration_ms, tr.browser, tr.retry_count,
      tr.error_message, tr.test_embedding_hash as current_hash
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.test_embedding IS NULL
    ORDER BY tr.created_at DESC
    LIMIT ${limit}
  `

  return results as Array<{
    id: number
    test_name: string
    test_file: string | null
    status: string
    duration_ms: number | null
    browser: string | null
    retry_count: number | null
    error_message: string | null
    current_hash: string | null
  }>
}

/**
 * Count tests with test embeddings for an organization
 */
export async function countTestsWithTestEmbeddings(
  organizationId: number
): Promise<{ withTestEmbedding: number; total: number }> {
  const sql = getSql()

  const [result] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE tr.test_embedding IS NOT NULL) as with_test_embedding,
      COUNT(*) as total
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
  `

  return {
    withTestEmbedding: Number(result.with_test_embedding),
    total: Number(result.total),
  }
}

// ============================================
// Suite Embeddings
// ============================================

/**
 * Store a suite embedding for a test execution
 *
 * @param executionId - ID of the test execution
 * @param embedding - 512-dimensional embedding vector
 * @param hash - Hash of the source text for incremental updates
 */
export async function storeSuiteEmbedding(
  executionId: number,
  embedding: number[],
  hash: string
): Promise<void> {
  const sql = getSql()

  if (embedding.length !== 512) {
    throw new Error(
      `Invalid suite embedding dimensions: expected 512, got ${embedding.length}`
    )
  }

  await sql`
    UPDATE test_executions
    SET suite_embedding = ${toVectorString(embedding)}::vector,
        suite_embedding_hash = ${hash}
    WHERE id = ${executionId}
  `
}

/**
 * Store suite embeddings for multiple executions (batch)
 *
 * @param embeddings - Array of {executionId, embedding, hash} entries
 */
export async function storeSuiteEmbeddingsBatch(
  embeddings: Array<{ executionId: number; embedding: number[]; hash: string }>
): Promise<void> {
  const sql = getSql()

  if (embeddings.length === 0) return

  const valid = embeddings.filter((e) => e.embedding.length === 512)

  if (valid.length === 0) return

  for (const { executionId, embedding, hash } of valid) {
    await sql`
      UPDATE test_executions
      SET suite_embedding = ${toVectorString(embedding)}::vector,
          suite_embedding_hash = ${hash}
      WHERE id = ${executionId}
    `
  }
}

/**
 * Get executions that need suite embeddings
 *
 * @param organizationId - Filter by organization
 * @param limit - Max results to return
 */
export async function getExecutionsNeedingSuiteEmbeddings(
  organizationId: number,
  limit: number = 100
): Promise<
  Array<{
    id: number
    branch: string | null
    suite: string | null
    commit_message: string | null
    total_tests: number | null
    passed_count: number | null
    failed_count: number | null
    skipped_count: number | null
    duration_ms: number | null
    status: string | null
    current_hash: string | null
  }>
> {
  const sql = getSql()

  const results = await sql`
    SELECT
      id, branch, suite, commit_message,
      total_tests, passed_count, failed_count, skipped_count,
      duration_ms, status, suite_embedding_hash as current_hash
    FROM test_executions
    WHERE organization_id = ${organizationId}
      AND suite_embedding IS NULL
    ORDER BY started_at DESC
    LIMIT ${limit}
  `

  return results as Array<{
    id: number
    branch: string | null
    suite: string | null
    commit_message: string | null
    total_tests: number | null
    passed_count: number | null
    failed_count: number | null
    skipped_count: number | null
    duration_ms: number | null
    status: string | null
    current_hash: string | null
  }>
}

/**
 * Count executions with suite embeddings for an organization
 */
export async function countExecutionsWithSuiteEmbeddings(
  organizationId: number
): Promise<{ withSuiteEmbedding: number; total: number }> {
  const sql = getSql()

  const [result] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE suite_embedding IS NOT NULL) as with_suite_embedding,
      COUNT(*) as total
    FROM test_executions
    WHERE organization_id = ${organizationId}
  `

  return {
    withSuiteEmbedding: Number(result.with_suite_embedding),
    total: Number(result.total),
  }
}

/**
 * Search all tests by semantic similarity (any status)
 *
 * @param embedding - Query embedding (512-dim)
 * @param organizationId - Organization for filtering
 * @param options - Search options
 */
export async function searchTestsSemantic(
  embedding: number[],
  organizationId: number,
  options: {
    threshold?: number
    limit?: number
    status?: string | null
  } = {}
): Promise<
  Array<{
    id: number
    test_name: string
    test_file: string | null
    status: string
    similarity: number
    execution_id: number
  }>
> {
  const sql = getSql()
  const { threshold = 0.3, limit = 20, status } = options

  if (embedding.length !== 512) {
    throw new Error(`Expected 512-dim embedding, got ${embedding.length}`)
  }

  const vectorStr = toVectorString(embedding)

  if (status) {
    return (await sql`
      SELECT
        tr.id,
        tr.test_name,
        tr.test_file,
        tr.status,
        tr.execution_id,
        1 - (tr.test_embedding <=> ${vectorStr}::vector) as similarity
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.test_embedding IS NOT NULL
        AND tr.status = ${status}
        AND tr.test_embedding <=> ${vectorStr}::vector < ${threshold}
      ORDER BY tr.test_embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `) as Array<{
      id: number
      test_name: string
      test_file: string | null
      status: string
      similarity: number
      execution_id: number
    }>
  }

  return (await sql`
    SELECT
      tr.id,
      tr.test_name,
      tr.test_file,
      tr.status,
      tr.execution_id,
      1 - (tr.test_embedding <=> ${vectorStr}::vector) as similarity
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.test_embedding IS NOT NULL
      AND tr.test_embedding <=> ${vectorStr}::vector < ${threshold}
    ORDER BY tr.test_embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `) as Array<{
    id: number
    test_name: string
    test_file: string | null
    status: string
    similarity: number
    execution_id: number
  }>
}

/**
 * Search suites by semantic similarity
 *
 * @param embedding - Query embedding (512-dim)
 * @param organizationId - Organization for filtering
 * @param options - Search options
 */
export async function searchSuitesSemantic(
  embedding: number[],
  organizationId: number,
  options: {
    threshold?: number
    limit?: number
  } = {}
): Promise<
  Array<{
    id: number
    branch: string | null
    suite: string | null
    commit_message: string | null
    similarity: number
    started_at: Date | null
  }>
> {
  const sql = getSql()
  const { threshold = 0.3, limit = 10 } = options

  if (embedding.length !== 512) {
    throw new Error(`Expected 512-dim embedding, got ${embedding.length}`)
  }

  const vectorStr = toVectorString(embedding)

  return (await sql`
    SELECT
      id,
      branch,
      suite,
      commit_message,
      started_at,
      1 - (suite_embedding <=> ${vectorStr}::vector) as similarity
    FROM test_executions
    WHERE organization_id = ${organizationId}
      AND suite_embedding IS NOT NULL
      AND suite_embedding <=> ${vectorStr}::vector < ${threshold}
    ORDER BY suite_embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `) as Array<{
    id: number
    branch: string | null
    suite: string | null
    commit_message: string | null
    similarity: number
    started_at: Date | null
  }>
}
