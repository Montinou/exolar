/**
 * Database functions for vector embeddings
 */

import { getSql } from "./connection"
import { toVectorString } from "@/lib/ai"

/**
 * Store an embedding for a test result
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

/**
 * Store embeddings for multiple test results
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
 * Get test results that need embeddings
 *
 * Returns failed tests without embeddings, ordered by most recent first.
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
 * Get embedding for a specific test result
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
): Promise<{ withEmbedding: number; total: number }> {
  const sql = getSql()

  const [result] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE tr.error_embedding IS NOT NULL) as with_embedding,
      COUNT(*) as total
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.status IN ('failed', 'timedout')
  `

  return {
    withEmbedding: Number(result.with_embedding),
    total: Number(result.total),
  }
}
