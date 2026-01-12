/**
 * Embedding Generation Service
 *
 * Handles generating and storing embeddings for test results.
 * Designed to be called during ingestion or as a background job.
 *
 * Primary: Jina v3 (512-dim, stored in error_embedding_v2)
 * Fallback: Gemini (768-dim, stored in error_embedding)
 */

import {
  generateEmbeddingWithProvider,
  generateEmbeddingsBatchWithProvider,
  prepareErrorForEmbedding,
  getDefaultProvider,
  getDimensionsForProvider,
} from "@/lib/ai"
import {
  storeEmbeddingV2,
  storeEmbeddingsBatchV2,
  storeEmbedding,
  storeEmbeddingsBatch,
  generateChunkHash,
} from "@/lib/db/embeddings"
import type { EmbeddingResult, EmbeddingProvider } from "@/lib/ai/types"

// ============================================
// Single Embedding Generation
// ============================================

/**
 * Generate and store embedding for a single test result
 *
 * Uses the configured provider (Jina by default).
 *
 * @param testResultId - ID of the test result
 * @param errorMessage - Error message from the test
 * @param stackTrace - Stack trace (optional)
 * @returns Success status and any error
 */
export async function generateAndStoreEmbedding(
  testResultId: number,
  errorMessage: string | null,
  stackTrace: string | null
): Promise<EmbeddingResult> {
  try {
    // Skip if no error content
    if (!errorMessage && !stackTrace) {
      return {
        testResultId,
        success: false,
        error: "No error content to embed",
      }
    }

    // Prepare error text for embedding
    const text = prepareErrorForEmbedding(errorMessage, stackTrace)
    const chunkHash = generateChunkHash(errorMessage, stackTrace)

    // Get provider info
    const provider = getDefaultProvider()
    const dimensions = getDimensionsForProvider(provider)

    // Generate embedding using provider
    const embedding = await generateEmbeddingWithProvider(text, {
      provider,
      task: "retrieval.passage", // Documents are indexed as passages
    })

    // Store based on provider
    if (provider === "jina") {
      await storeEmbeddingV2(testResultId, embedding, chunkHash)
    } else {
      await storeEmbedding(testResultId, embedding)
    }

    return {
      testResultId,
      success: true,
      embedding,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `Failed to generate embedding for test ${testResultId}:`,
      message
    )

    return {
      testResultId,
      success: false,
      error: message,
    }
  }
}

// ============================================
// Batch Embedding Generation
// ============================================

/**
 * Generate embeddings for multiple test results
 *
 * Optimized for batch processing with parallel API calls.
 * Uses the configured provider (Jina by default).
 *
 * @param testResults - Array of test results needing embeddings
 * @returns Array of results (success/failure per test)
 */
export async function generateAndStoreEmbeddingsBatch(
  testResults: Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
  }>
): Promise<EmbeddingResult[]> {
  if (testResults.length === 0) {
    return []
  }

  const provider = getDefaultProvider()
  const expectedDimensions = getDimensionsForProvider(provider)

  // Prepare all texts
  const textsWithIds = testResults
    .filter((tr) => tr.error_message || tr.stack_trace)
    .map((tr) => ({
      id: tr.id,
      text: prepareErrorForEmbedding(tr.error_message, tr.stack_trace),
      chunkHash: generateChunkHash(tr.error_message, tr.stack_trace),
    }))

  if (textsWithIds.length === 0) {
    return testResults.map((tr) => ({
      testResultId: tr.id,
      success: false,
      error: "No error content to embed",
    }))
  }

  // Generate embeddings in batch
  const texts = textsWithIds.map((t) => t.text)
  const embeddings = await generateEmbeddingsBatchWithProvider(texts, {
    provider,
    task: "retrieval.passage",
  })

  // Prepare results and store valid embeddings
  const results: EmbeddingResult[] = []
  const validEmbeddings: Array<{ testResultId: number; embedding: number[]; chunkHash: string }> = []

  for (let i = 0; i < textsWithIds.length; i++) {
    const { id, chunkHash } = textsWithIds[i]
    const embedding = embeddings[i]

    if (embedding && embedding.length === expectedDimensions) {
      results.push({ testResultId: id, success: true, embedding })
      validEmbeddings.push({ testResultId: id, embedding, chunkHash })
    } else {
      results.push({
        testResultId: id,
        success: false,
        error: `Embedding generation failed or returned invalid dimensions (expected ${expectedDimensions})`,
      })
    }
  }

  // Batch store valid embeddings
  if (validEmbeddings.length > 0) {
    try {
      if (provider === "jina") {
        await storeEmbeddingsBatchV2(validEmbeddings)
      } else {
        await storeEmbeddingsBatch(
          validEmbeddings.map(({ testResultId, embedding }) => ({ testResultId, embedding }))
        )
      }
    } catch (error) {
      console.error("Failed to store embeddings batch:", error)
      // Mark all as failed
      for (const result of results) {
        if (result.success) {
          result.success = false
          result.error = "Database storage failed"
        }
      }
    }
  }

  // Add results for tests that had no error content
  const processedIds = new Set(textsWithIds.map((t) => t.id))
  for (const tr of testResults) {
    if (!processedIds.has(tr.id)) {
      results.push({
        testResultId: tr.id,
        success: false,
        error: "No error content to embed",
      })
    }
  }

  return results
}

// ============================================
// Progress Tracking
// ============================================

/**
 * Stats from embedding generation
 */
export interface EmbeddingStats {
  total: number
  succeeded: number
  failed: number
  skipped: number
  durationMs: number
  provider: EmbeddingProvider
  dimensions: number
}

/**
 * Generate embeddings for failed tests with progress tracking
 *
 * @param testResults - Tests to process
 * @param onProgress - Optional callback for progress updates
 */
export async function generateEmbeddingsWithProgress(
  testResults: Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
  }>,
  onProgress?: (processed: number, total: number) => void
): Promise<EmbeddingStats> {
  const startTime = Date.now()
  const provider = getDefaultProvider()

  const stats: EmbeddingStats = {
    total: testResults.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    provider,
    dimensions: getDimensionsForProvider(provider),
  }

  if (testResults.length === 0) {
    return stats
  }

  // Process in batches of 10 to avoid overwhelming the API
  const BATCH_SIZE = 10

  for (let i = 0; i < testResults.length; i += BATCH_SIZE) {
    const batch = testResults.slice(i, i + BATCH_SIZE)
    const results = await generateAndStoreEmbeddingsBatch(batch)

    for (const result of results) {
      if (result.success) {
        stats.succeeded++
      } else if (result.error === "No error content to embed") {
        stats.skipped++
      } else {
        stats.failed++
      }
    }

    onProgress?.(i + batch.length, testResults.length)
  }

  stats.durationMs = Date.now() - startTime
  return stats
}

// ============================================
// Provider Info
// ============================================

/**
 * Get current embedding configuration
 */
export function getEmbeddingConfig(): {
  provider: EmbeddingProvider
  dimensions: number
  storageColumn: string
} {
  const provider = getDefaultProvider()
  return {
    provider,
    dimensions: getDimensionsForProvider(provider),
    storageColumn: provider === "jina" ? "error_embedding_v2" : "error_embedding",
  }
}
