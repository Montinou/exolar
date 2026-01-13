/**
 * Enhanced Embedding Service (V2)
 *
 * Integrates all Phase 1 & 2 improvements:
 * - Contextual enrichment
 * - Query caching
 * - Deduplication
 * - Batch operations
 *
 * Use this service for all embedding operations going forward.
 */

import { generateJinaEmbedding, generateJinaEmbeddingsBatch } from "@/lib/ai/providers/jina"
import {
  prepareErrorForEmbedding,
  type ErrorEmbeddingContext,
} from "@/lib/ai/sanitizer"
import { storeEmbeddingsBatchV2 } from "@/lib/db/embeddings"
import { getCachedEmbedding, cacheQueryEmbedding } from "@/lib/cache/query-cache"
import {
  applyDeduplication,
  generateContentHash,
  checkForDuplicate,
} from "@/lib/services/deduplication"

// ============================================
// Types
// ============================================

export interface EnhancedEmbeddingRequest {
  testResultId: number
  errorMessage: string | null
  stackTrace: string | null

  // Contextual enrichment
  testName?: string
  testFile?: string
  branch?: string | null
  suite?: string | null
  commitMessage?: string | null

  // Historical context (optional - query from DB if needed)
  isFlaky?: boolean
  failureCount?: number
  timeSinceLastFailure?: number | null
  relatedFailures?: string[]
}

export interface EmbeddingResult {
  testResultId: number
  embedding: number[]
  fromCache?: boolean
  fromDedup?: boolean
}

// ============================================
// Enhanced Embedding Generation
// ============================================

/**
 * Generate embedding with contextual enrichment
 *
 * Includes all Phase 2 improvements:
 * - Contextual enrichment (execution, historical, temporal context)
 * - Deduplication check
 * - Content hash generation
 *
 * @param request - Enhanced request with full context
 * @returns Embedding result
 */
export async function generateEnrichedEmbedding(
  request: EnhancedEmbeddingRequest,
  organizationId: number
): Promise<EmbeddingResult> {
  const {
    testResultId,
    errorMessage,
    stackTrace,
    testName,
    testFile,
    branch,
    suite,
    commitMessage,
    isFlaky,
    failureCount,
    timeSinceLastFailure,
    relatedFailures,
  } = request

  // 1. Check for duplicate content (deduplication)
  const contentHash = generateContentHash(errorMessage, stackTrace)
  const duplicate = await checkForDuplicate(contentHash, organizationId)

  if (duplicate.isDuplicate && duplicate.embedding) {
    // Reuse existing embedding
    return {
      testResultId,
      embedding: duplicate.embedding,
      fromDedup: true,
    }
  }

  // 2. Prepare enriched text for embedding
  const context: ErrorEmbeddingContext = {
    testName,
    testFile,
    branch,
    suite,
    commitMessage,
    isFlaky,
    failureCount,
    timeSinceLastFailure,
    relatedFailures,
  }

  const enrichedText = prepareErrorForEmbedding(errorMessage, stackTrace, context)

  // 3. Generate embedding (uses Jina v3 with improved batch size and late chunking)
  const embedding = await generateJinaEmbedding(enrichedText, "retrieval.passage")

  return {
    testResultId,
    embedding,
  }
}

/**
 * Generate embeddings for multiple tests with deduplication
 *
 * Applies deduplication to avoid generating embeddings for duplicate content
 *
 * @param requests - Array of embedding requests
 * @param organizationId - Organization ID
 * @returns Array of embedding results
 */
export async function generateEnrichedEmbeddingsBatch(
  requests: EnhancedEmbeddingRequest[],
  organizationId: number
): Promise<EmbeddingResult[]> {
  if (requests.length === 0) {
    return []
  }

  // 1. Apply deduplication
  const { toGenerate, toReuse } = await applyDeduplication(
    requests.map((r) => ({
      testResultId: r.testResultId,
      errorMessage: r.errorMessage,
      stackTrace: r.stackTrace,
    })),
    organizationId
  )

  const results: EmbeddingResult[] = []

  // 2. Add deduplicated embeddings
  for (const item of toReuse) {
    results.push({
      testResultId: item.testResultId,
      embedding: item.embedding,
      fromDedup: true,
    })
  }

  // 3. Generate embeddings for remaining items
  if (toGenerate.length > 0) {
    // Find corresponding requests
    const requestsToGenerate = toGenerate.map((item) => {
      const original = requests.find((r) => r.testResultId === item.testResultId)
      return original!
    })

    // Prepare enriched texts
    const enrichedTexts = requestsToGenerate.map((req) => {
      const context: ErrorEmbeddingContext = {
        testName: req.testName,
        testFile: req.testFile,
        branch: req.branch,
        suite: req.suite,
        commitMessage: req.commitMessage,
        isFlaky: req.isFlaky,
        failureCount: req.failureCount,
        timeSinceLastFailure: req.timeSinceLastFailure,
        relatedFailures: req.relatedFailures,
      }

      return prepareErrorForEmbedding(req.errorMessage, req.stackTrace, context)
    })

    // Generate embeddings in batch (uses improved batch size of 256)
    const embeddings = await generateJinaEmbeddingsBatch(
      enrichedTexts,
      "retrieval.passage"
    )

    // Add generated embeddings to results
    for (let i = 0; i < requestsToGenerate.length; i++) {
      results.push({
        testResultId: requestsToGenerate[i].testResultId,
        embedding: embeddings[i],
      })
    }
  }

  return results
}

/**
 * Store enriched embeddings with content hash
 *
 * Stores embeddings with content hash for deduplication
 *
 * @param results - Embedding results to store
 */
export async function storeEnrichedEmbeddings(
  results: EmbeddingResult[],
  requests: EnhancedEmbeddingRequest[]
): Promise<void> {
  if (results.length === 0) {
    return
  }

  // Build map of testResultId → contentHash
  const hashMap = new Map<number, string>()
  for (const req of requests) {
    const hash = generateContentHash(req.errorMessage, req.stackTrace)
    hashMap.set(req.testResultId, hash)
  }

  // Prepare batch with content hashes
  const batch = results.map((result) => ({
    testResultId: result.testResultId,
    embedding: result.embedding,
    chunkHash: hashMap.get(result.testResultId),
  }))

  // Store using optimized batch UPDATE (8-32x faster)
  await storeEmbeddingsBatchV2(batch)
}

// ============================================
// Query Embedding with Caching
// ============================================

/**
 * Generate embedding for a search query with caching
 *
 * Checks cache first, generates and caches if not found
 *
 * @param query - Search query text
 * @param organizationId - Organization ID
 * @returns Query embedding
 */
export async function getQueryEmbedding(
  query: string,
  organizationId: number
): Promise<number[]> {
  // 1. Check cache
  const cached = await getCachedEmbedding(query, organizationId)

  if (cached) {
    return cached
  }

  // 2. Generate embedding
  const embedding = await generateJinaEmbedding(query, "retrieval.query")

  // 3. Cache for future use
  await cacheQueryEmbedding(query, embedding, organizationId)

  return embedding
}

// ============================================
// Complete Workflow
// ============================================

/**
 * Complete workflow: Generate and store enriched embeddings
 *
 * This is the main entry point for embedding generation.
 * Handles everything: deduplication, enrichment, generation, and storage.
 *
 * @param requests - Array of embedding requests
 * @param organizationId - Organization ID
 * @returns Statistics about the operation
 */
export async function processEmbeddingsBatch(
  requests: EnhancedEmbeddingRequest[],
  organizationId: number
): Promise<{
  total: number
  generated: number
  deduplicated: number
  stored: number
}> {
  if (requests.length === 0) {
    return { total: 0, generated: 0, deduplicated: 0, stored: 0 }
  }

  // Generate embeddings (with deduplication)
  const results = await generateEnrichedEmbeddingsBatch(requests, organizationId)

  // Count stats
  const deduplicated = results.filter((r) => r.fromDedup).length
  const generated = results.length - deduplicated

  // Store embeddings (uses optimized batch UPDATE)
  await storeEnrichedEmbeddings(results, requests)

  return {
    total: requests.length,
    generated,
    deduplicated,
    stored: results.length,
  }
}
