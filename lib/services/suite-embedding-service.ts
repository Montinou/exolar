/**
 * Suite Embedding Service
 *
 * Generates and stores embeddings for test executions (suite-level).
 * Uses Jina v3 (512-dim) stored in suite_embedding column.
 */

import {
  generateEmbeddingWithProvider,
  generateEmbeddingsBatchWithProvider,
  getDefaultProvider,
  getDimensionsForProvider,
} from "@/lib/ai"
import {
  prepareSuiteForEmbedding,
  generateEmbeddingHash,
  type ExecutionForEmbedding,
} from "@/lib/ai/sanitizer"
import {
  storeSuiteEmbedding,
  storeSuiteEmbeddingsBatch,
} from "@/lib/db/embeddings"
import type { EmbeddingProvider } from "@/lib/ai/types"

// ============================================
// Types
// ============================================

export interface SuiteEmbeddingResult {
  executionId: number
  success: boolean
  embedding?: number[]
  error?: string
}

export interface SuiteEmbeddingStats {
  total: number
  succeeded: number
  failed: number
  skipped: number
  durationMs: number
  provider: EmbeddingProvider
  dimensions: number
}

// ============================================
// Single Suite Embedding Generation
// ============================================

/**
 * Generate and store embedding for a single test execution (suite)
 *
 * @param executionId - ID of the test execution
 * @param execution - Execution data for embedding
 * @returns Success status and any error
 */
export async function generateSuiteEmbedding(
  executionId: number,
  execution: ExecutionForEmbedding
): Promise<SuiteEmbeddingResult> {
  try {
    // Prepare text for embedding
    const text = prepareSuiteForEmbedding(execution)
    const hash = generateEmbeddingHash(text)

    // Get provider info
    const provider = getDefaultProvider()

    // Generate embedding using provider
    const embedding = await generateEmbeddingWithProvider(text, {
      provider,
      task: "retrieval.passage",
    })

    // Store in database
    await storeSuiteEmbedding(executionId, embedding, hash)

    return {
      executionId,
      success: true,
      embedding,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `Failed to generate suite embedding for execution ${executionId}:`,
      message
    )

    return {
      executionId,
      success: false,
      error: message,
    }
  }
}

// ============================================
// Batch Suite Embedding Generation
// ============================================

/**
 * Generate embeddings for multiple test executions
 *
 * @param executions - Array of executions needing embeddings
 * @returns Array of results (success/failure per execution)
 */
export async function generateSuiteEmbeddingsBatch(
  executions: Array<{
    id: number
    branch: string | null
    suite: string | null
    commit_message: string | null
    total_tests: number | null
    passed: number | null
    failed: number | null
    skipped: number | null
    duration_ms: number | null
    status: string | null
  }>
): Promise<SuiteEmbeddingResult[]> {
  if (executions.length === 0) {
    return []
  }

  const provider = getDefaultProvider()
  const expectedDimensions = getDimensionsForProvider(provider)

  // Prepare all texts
  const textsWithIds = executions.map((exec) => {
    const execData: ExecutionForEmbedding = {
      branch: exec.branch,
      suite: exec.suite,
      commit_message: exec.commit_message,
      total_tests: exec.total_tests,
      passed_count: exec.passed,
      failed_count: exec.failed,
      skipped_count: exec.skipped,
      duration_ms: exec.duration_ms,
      status: exec.status,
    }
    const text = prepareSuiteForEmbedding(execData)
    return {
      id: exec.id,
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
  const results: SuiteEmbeddingResult[] = []
  const validEmbeddings: Array<{
    executionId: number
    embedding: number[]
    hash: string
  }> = []

  for (let i = 0; i < textsWithIds.length; i++) {
    const { id, hash } = textsWithIds[i]
    const embedding = embeddings[i]

    if (embedding && embedding.length === expectedDimensions) {
      results.push({ executionId: id, success: true, embedding })
      validEmbeddings.push({ executionId: id, embedding, hash })
    } else {
      results.push({
        executionId: id,
        success: false,
        error: `Embedding generation failed or returned invalid dimensions (expected ${expectedDimensions})`,
      })
    }
  }

  // Batch store valid embeddings
  if (validEmbeddings.length > 0) {
    try {
      await storeSuiteEmbeddingsBatch(validEmbeddings)
    } catch (error) {
      console.error("Failed to store suite embeddings batch:", error)
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
 * Generate suite embeddings with progress tracking
 *
 * @param executions - Executions to process
 * @param onProgress - Optional callback for progress updates
 */
export async function generateSuiteEmbeddingsWithProgress(
  executions: Array<{
    id: number
    branch: string | null
    suite: string | null
    commit_message: string | null
    total_tests: number | null
    passed: number | null
    failed: number | null
    skipped: number | null
    duration_ms: number | null
    status: string | null
  }>,
  onProgress?: (processed: number, total: number) => void
): Promise<SuiteEmbeddingStats> {
  const startTime = Date.now()
  const provider = getDefaultProvider()

  const stats: SuiteEmbeddingStats = {
    total: executions.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    provider,
    dimensions: getDimensionsForProvider(provider),
  }

  if (executions.length === 0) {
    return stats
  }

  // Process in batches of 10 to avoid overwhelming the API
  const BATCH_SIZE = 10

  for (let i = 0; i < executions.length; i += BATCH_SIZE) {
    const batch = executions.slice(i, i + BATCH_SIZE)
    const results = await generateSuiteEmbeddingsBatch(batch)

    for (const result of results) {
      if (result.success) {
        stats.succeeded++
      } else {
        stats.failed++
      }
    }

    onProgress?.(i + batch.length, executions.length)
  }

  stats.durationMs = Date.now() - startTime
  return stats
}

/**
 * Get current suite embedding configuration
 */
export function getSuiteEmbeddingConfig(): {
  provider: EmbeddingProvider
  dimensions: number
  storageColumn: string
} {
  const provider = getDefaultProvider()
  return {
    provider,
    dimensions: getDimensionsForProvider(provider),
    storageColumn: "suite_embedding",
  }
}
