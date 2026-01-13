/**
 * Embedding Deduplication Service
 *
 * Reduces storage by detecting identical content and reusing embeddings.
 *
 * Source: docs/prompts/research/adaptive-thresholds-cost-optimization.md
 * Expected impact: 64% storage reduction
 *
 * **Strategy:**
 * - Hash content before embedding
 * - Check if hash already exists
 * - Reuse existing embedding instead of generating new one
 * - Reference existing embedding ID
 *
 * **Benefits:**
 * - 64% reduction in storage
 * - Faster embedding generation (skip duplicates)
 * - Reduced API costs
 * - Faster searches (smaller index)
 */

import { getSql } from "@/lib/db/connection"
import { createHash } from "crypto"
import { toVectorString } from "@/lib/ai"

// ============================================
// Types
// ============================================

export interface DeduplicationResult {
  isDuplicate: boolean
  embedding?: number[]
  sourceTestId?: number
  contentHash: string
}

export interface DeduplicationStats {
  totalTests: number
  uniqueEmbeddings: number
  duplicates: number
  deduplicationRate: number
  storageSavings: number
}

// ============================================
// Content Hashing
// ============================================

/**
 * Generate content hash for deduplication
 *
 * Uses MD5 for speed (collision resistance less critical for deduplication)
 *
 * @param content - Content to hash (error message + stack trace)
 * @returns Content hash (hex string)
 */
export function generateContentHash(
  errorMessage: string | null,
  stackTrace: string | null
): string {
  const content = [errorMessage ?? "", stackTrace ?? ""].join("\n").trim()

  if (!content) {
    return ""
  }

  return createHash("md5").update(content).digest("hex")
}

// ============================================
// Deduplication Check
// ============================================

/**
 * Check if content already has an embedding
 *
 * Looks up by content hash to find existing embedding
 *
 * @param contentHash - Hash of the content
 * @param organizationId - Organization ID for isolation
 * @returns Deduplication result with existing embedding if found
 */
export async function checkForDuplicate(
  contentHash: string,
  organizationId: number
): Promise<DeduplicationResult> {
  if (!contentHash) {
    return {
      isDuplicate: false,
      contentHash: "",
    }
  }

  const sql = getSql()

  try {
    // Find existing test with same content hash that has an embedding
    const existing = await sql`
      SELECT tr.id, tr.error_embedding_v2::text as embedding
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.embedding_chunk_hash = ${contentHash}
        AND tr.error_embedding_v2 IS NOT NULL
      LIMIT 1
    `

    if (existing.length === 0) {
      return {
        isDuplicate: false,
        contentHash,
      }
    }

    // Parse existing embedding
    const vectorStr = existing[0].embedding as string
    const embedding = vectorStr
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number)

    return {
      isDuplicate: true,
      embedding,
      sourceTestId: existing[0].id,
      contentHash,
    }
  } catch (error) {
    console.error("Deduplication check error:", error)
    return {
      isDuplicate: false,
      contentHash,
    }
  }
}

/**
 * Batch deduplication check for multiple tests
 *
 * More efficient than individual checks
 *
 * @param tests - Array of tests with content hashes
 * @param organizationId - Organization ID
 * @returns Map of contentHash → existing embedding
 */
export async function batchCheckForDuplicates(
  tests: Array<{
    testResultId: number
    contentHash: string
  }>,
  organizationId: number
): Promise<Map<string, { embedding: number[]; sourceTestId: number }>> {
  const sql = getSql()
  const results = new Map<
    string,
    { embedding: number[]; sourceTestId: number }
  >()

  if (tests.length === 0) {
    return results
  }

  // Get unique hashes
  const uniqueHashes = [...new Set(tests.map((t) => t.contentHash))]

  if (uniqueHashes.length === 0) {
    return results
  }

  try {
    // Find existing embeddings for all hashes in single query
    const existing = await sql`
      SELECT DISTINCT ON (tr.embedding_chunk_hash)
        tr.embedding_chunk_hash,
        tr.id,
        tr.error_embedding_v2::text as embedding
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.embedding_chunk_hash = ANY(${uniqueHashes})
        AND tr.error_embedding_v2 IS NOT NULL
      ORDER BY tr.embedding_chunk_hash, tr.created_at DESC
    `

    // Build map of hash → embedding
    for (const row of existing) {
      const vectorStr = row.embedding as string
      const embedding = vectorStr
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map(Number)

      results.set(row.embedding_chunk_hash, {
        embedding,
        sourceTestId: row.id,
      })
    }
  } catch (error) {
    console.error("Batch deduplication check error:", error)
  }

  return results
}

// ============================================
// Deduplication Application
// ============================================

/**
 * Apply deduplication to a batch of embeddings
 *
 * Filters out items that already have embeddings and returns:
 * - Items that need new embeddings
 * - Items that can reuse existing embeddings
 *
 * @param items - Items to process
 * @param organizationId - Organization ID
 * @returns Separated items (toGenerate, toReuse)
 */
export async function applyDeduplication(
  items: Array<{
    testResultId: number
    errorMessage: string | null
    stackTrace: string | null
  }>,
  organizationId: number
): Promise<{
  toGenerate: Array<{
    testResultId: number
    errorMessage: string | null
    stackTrace: string | null
    contentHash: string
  }>
  toReuse: Array<{
    testResultId: number
    embedding: number[]
    sourceTestId: number
    contentHash: string
  }>
}> {
  // Generate hashes for all items
  const itemsWithHashes = items.map((item) => ({
    ...item,
    contentHash: generateContentHash(item.errorMessage, item.stackTrace),
  }))

  // Check for duplicates
  const duplicateMap = await batchCheckForDuplicates(
    itemsWithHashes.map((item) => ({
      testResultId: item.testResultId,
      contentHash: item.contentHash,
    })),
    organizationId
  )

  // Separate items to generate vs reuse
  const toGenerate: Array<{
    testResultId: number
    errorMessage: string | null
    stackTrace: string | null
    contentHash: string
  }> = []

  const toReuse: Array<{
    testResultId: number
    embedding: number[]
    sourceTestId: number
    contentHash: string
  }> = []

  for (const item of itemsWithHashes) {
    const duplicate = duplicateMap.get(item.contentHash)

    if (duplicate) {
      // Reuse existing embedding
      toReuse.push({
        testResultId: item.testResultId,
        embedding: duplicate.embedding,
        sourceTestId: duplicate.sourceTestId,
        contentHash: item.contentHash,
      })
    } else {
      // Need to generate new embedding
      toGenerate.push(item)
    }
  }

  return { toGenerate, toReuse }
}

// ============================================
// Deduplication Statistics
// ============================================

/**
 * Calculate deduplication statistics for an organization
 *
 * @param organizationId - Organization ID
 * @returns Deduplication stats
 */
export async function getDeduplicationStats(
  organizationId: number
): Promise<DeduplicationStats> {
  const sql = getSql()

  try {
    const [stats] = await sql`
      SELECT
        COUNT(*) as total_tests,
        COUNT(DISTINCT tr.embedding_chunk_hash) FILTER (
          WHERE tr.embedding_chunk_hash IS NOT NULL
        ) as unique_embeddings,
        COUNT(*) FILTER (
          WHERE tr.embedding_chunk_hash IS NOT NULL
        ) as tests_with_hash
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.status IN ('failed', 'timedout')
    `

    const totalTests = Number(stats.total_tests)
    const uniqueEmbeddings = Number(stats.unique_embeddings)
    const testsWithHash = Number(stats.tests_with_hash)

    const duplicates = testsWithHash - uniqueEmbeddings
    const deduplicationRate =
      testsWithHash > 0 ? duplicates / testsWithHash : 0
    const storageSavings = deduplicationRate * 100

    return {
      totalTests,
      uniqueEmbeddings,
      duplicates,
      deduplicationRate,
      storageSavings,
    }
  } catch (error) {
    console.error("Error calculating deduplication stats:", error)
    return {
      totalTests: 0,
      uniqueEmbeddings: 0,
      duplicates: 0,
      deduplicationRate: 0,
      storageSavings: 0,
    }
  }
}

/**
 * Find most common duplicate error patterns
 *
 * Useful for identifying recurring issues
 *
 * @param organizationId - Organization ID
 * @param limit - Max results to return
 * @returns Common error patterns with occurrence counts
 */
export async function getMostCommonDuplicates(
  organizationId: number,
  limit: number = 10
): Promise<
  Array<{
    contentHash: string
    errorMessage: string | null
    occurrences: number
  }>
> {
  const sql = getSql()

  try {
    const results = await sql`
      SELECT
        tr.embedding_chunk_hash as content_hash,
        MAX(tr.error_message) as error_message,
        COUNT(*) as occurrences
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.embedding_chunk_hash IS NOT NULL
        AND tr.status IN ('failed', 'timedout')
      GROUP BY tr.embedding_chunk_hash
      HAVING COUNT(*) > 1
      ORDER BY occurrences DESC
      LIMIT ${limit}
    `

    return results.map((row) => ({
      contentHash: row.content_hash,
      errorMessage: row.error_message,
      occurrences: Number(row.occurrences),
    }))
  } catch (error) {
    console.error("Error finding common duplicates:", error)
    return []
  }
}
