/**
 * Universal Test Embedding Service
 *
 * Generates and stores embeddings for ALL test results (passed, failed, skipped).
 * Uses Jina v3 (512-dim) stored in test_embedding column.
 */

import {
  generateEmbeddingWithProvider,
  generateEmbeddingsBatchWithProvider,
  getDefaultProvider,
  getDimensionsForProvider,
} from "@/lib/ai"
import {
  prepareTestForEmbedding,
  generateEmbeddingHash,
  type TestResultForEmbedding,
} from "@/lib/ai/sanitizer"
import {
  storeTestEmbedding,
  storeTestEmbeddingsBatch,
} from "@/lib/db/embeddings"
import type { EmbeddingProvider } from "@/lib/ai/types"

// ============================================
// Types
// ============================================

export interface TestEmbeddingResult {
  testResultId: number
  success: boolean
  embedding?: number[]
  error?: string
}

export interface TestEmbeddingStats {
  total: number
  succeeded: number
  failed: number
  skipped: number
  durationMs: number
  provider: EmbeddingProvider
  dimensions: number
}

// ============================================
// Single Test Embedding Generation
// ============================================

/**
 * Generate and store embedding for a single test result
 *
 * @param testResultId - ID of the test result
 * @param test - Test data for embedding
 * @returns Success status and any error
 */
export async function generateTestEmbedding(
  testResultId: number,
  test: TestResultForEmbedding
): Promise<TestEmbeddingResult> {
  try {
    // Prepare text for embedding
    const text = prepareTestForEmbedding(test)
    const hash = generateEmbeddingHash(text)

    // Get provider info
    const provider = getDefaultProvider()

    // Generate embedding using provider
    const embedding = await generateEmbeddingWithProvider(text, {
      provider,
      task: "retrieval.passage",
    })

    // Store in database
    await storeTestEmbedding(testResultId, embedding, hash)

    return {
      testResultId,
      success: true,
      embedding,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `Failed to generate test embedding for test ${testResultId}:`,
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
// Batch Test Embedding Generation
// ============================================

/**
 * Generate embeddings for multiple test results (any status)
 *
 * @param testResults - Array of test results needing embeddings
 * @returns Array of results (success/failure per test)
 */
export async function generateTestEmbeddingsBatch(
  testResults: Array<{
    id: number
    test_name: string
    test_file: string | null
    status: string
    duration_ms: number | null
    browser: string | null
    retry_count: number | null
    error_message: string | null
  }>
): Promise<TestEmbeddingResult[]> {
  if (testResults.length === 0) {
    return []
  }

  const provider = getDefaultProvider()
  const expectedDimensions = getDimensionsForProvider(provider)

  // Prepare all texts
  const textsWithIds = testResults.map((tr) => {
    const testData: TestResultForEmbedding = {
      test_name: tr.test_name,
      test_file: tr.test_file,
      status: tr.status,
      duration_ms: tr.duration_ms,
      browser: tr.browser,
      retry_count: tr.retry_count,
      error_message: tr.error_message,
    }
    const text = prepareTestForEmbedding(testData)
    return {
      id: tr.id,
      text,
      hash: generateEmbeddingHash(text),
    }
  })

  // Generate embeddings in batch
  const texts = textsWithIds.map((t) => t.text)
  const embeddings = await generateEmbeddingsBatchWithProvider(texts, {
    provider,
    task: "retrieval.passage",
  })

  // Prepare results and store valid embeddings
  const results: TestEmbeddingResult[] = []
  const validEmbeddings: Array<{
    testResultId: number
    embedding: number[]
    hash: string
  }> = []

  for (let i = 0; i < textsWithIds.length; i++) {
    const { id, hash } = textsWithIds[i]
    const embedding = embeddings[i]

    if (embedding && embedding.length === expectedDimensions) {
      results.push({ testResultId: id, success: true, embedding })
      validEmbeddings.push({ testResultId: id, embedding, hash })
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
      await storeTestEmbeddingsBatch(validEmbeddings)
    } catch (error) {
      console.error("Failed to store test embeddings batch:", error)
      // Mark all as failed
      for (const result of results) {
        if (result.success) {
          result.success = false
          result.error = "Database storage failed"
        }
      }
    }
  }

  return results
}

// ============================================
// Progress Tracking
// ============================================

/**
 * Generate test embeddings with progress tracking
 *
 * @param testResults - Tests to process
 * @param onProgress - Optional callback for progress updates
 */
export async function generateTestEmbeddingsWithProgress(
  testResults: Array<{
    id: number
    test_name: string
    test_file: string | null
    status: string
    duration_ms: number | null
    browser: string | null
    retry_count: number | null
    error_message: string | null
  }>,
  onProgress?: (processed: number, total: number) => void
): Promise<TestEmbeddingStats> {
  const startTime = Date.now()
  const provider = getDefaultProvider()

  const stats: TestEmbeddingStats = {
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
    const results = await generateTestEmbeddingsBatch(batch)

    for (const result of results) {
      if (result.success) {
        stats.succeeded++
      } else {
        stats.failed++
      }
    }

    onProgress?.(i + batch.length, testResults.length)
  }

  stats.durationMs = Date.now() - startTime
  return stats
}

/**
 * Get current test embedding configuration
 */
export function getTestEmbeddingConfig(): {
  provider: EmbeddingProvider
  dimensions: number
  storageColumn: string
} {
  const provider = getDefaultProvider()
  return {
    provider,
    dimensions: getDimensionsForProvider(provider),
    storageColumn: "test_embedding",
  }
}
