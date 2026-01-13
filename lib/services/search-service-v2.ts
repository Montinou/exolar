/**
 * Enhanced Search Service (V2)
 *
 * Integrates all Phase 2 search improvements:
 * - Hybrid search (Dense + Sparse with RRF)
 * - Per-category adaptive thresholds
 * - Query embedding caching
 *
 * Use this service for all search operations going forward.
 */

import { hybridSearch, adaptiveHybridSearch, type HybridSearchOptions } from "@/lib/search/hybrid"
import {
  getThresholdForError,
  adjustThresholdDynamically,
  type CategoryThreshold,
} from "@/lib/search/thresholds"
import { getQueryEmbedding } from "@/lib/services/embedding-service-v2"

// ============================================
// Types
// ============================================

export interface SearchRequest {
  query: string
  organizationId: number
  executionId?: number
  limit?: number

  // Search mode
  useAdaptiveWeights?: boolean // Use query-type detection for weight optimization
  usePerCategoryThresholds?: boolean // Use category-specific thresholds

  // Manual overrides (optional)
  threshold?: number
  denseWeight?: number
  sparseWeight?: number
}

export interface SearchResult {
  id: number
  score: number
  test_name?: string
  test_file?: string
  error_message?: string | null
  execution_id?: number
}

// ============================================
// Enhanced Search Operations
// ============================================

/**
 * Search with all improvements enabled
 *
 * Uses:
 * - Query embedding caching
 * - Hybrid search (Dense + Sparse with RRF)
 * - Adaptive weights based on query type
 * - Per-category thresholds
 *
 * @param request - Search request
 * @returns Search results
 */
export async function searchEnhanced(
  request: SearchRequest
): Promise<SearchResult[]> {
  const {
    query,
    organizationId,
    executionId,
    limit = 10,
    useAdaptiveWeights = true,
    usePerCategoryThresholds = true,
    threshold: manualThreshold,
    denseWeight,
    sparseWeight,
  } = request

  // 1. Get query embedding (with caching)
  const embedding = await getQueryEmbedding(query, organizationId)

  // 2. Determine threshold
  let threshold = manualThreshold
  if (!threshold && usePerCategoryThresholds) {
    // Use per-category threshold if query looks like an error
    threshold = getThresholdForError(query)
  } else if (!threshold) {
    // Default threshold
    threshold = 0.30
  }

  // 3. Build search options
  const searchOptions: HybridSearchOptions = {
    organizationId,
    executionId,
    limit,
    threshold,
    denseWeight,
    sparseWeight,
  }

  // 4. Execute hybrid search
  let results: SearchResult[]

  if (useAdaptiveWeights) {
    // Use adaptive weights based on query characteristics
    results = await adaptiveHybridSearch(embedding, query, searchOptions)
  } else {
    // Use standard weighted RRF
    results = await hybridSearch(embedding, query, searchOptions)
  }

  // 5. Apply dynamic threshold adjustment if needed
  if (usePerCategoryThresholds && results.length > 0) {
    const adjustedThreshold = adjustThresholdDynamically(
      threshold,
      results.length,
      false // isRareQuery - could be enhanced with query frequency tracking
    )

    // If threshold changed significantly, re-run search
    if (Math.abs(adjustedThreshold - threshold) > 0.1) {
      searchOptions.threshold = adjustedThreshold

      if (useAdaptiveWeights) {
        results = await adaptiveHybridSearch(embedding, query, searchOptions)
      } else {
        results = await hybridSearch(embedding, query, searchOptions)
      }
    }
  }

  return results
}

/**
 * Search for similar errors (error-specific search)
 *
 * Optimized for finding similar test failures:
 * - Uses per-category thresholds
 * - Favors dense search for semantic similarity
 * - Lower threshold for better recall
 *
 * @param errorMessage - Error message to search for
 * @param organizationId - Organization ID
 * @param options - Search options
 */
export async function searchSimilarErrors(
  errorMessage: string,
  organizationId: number,
  options: {
    executionId?: number
    limit?: number
  } = {}
): Promise<SearchResult[]> {
  const { executionId, limit = 20 } = options

  // Use error-specific threshold
  const threshold = getThresholdForError(errorMessage)

  return searchEnhanced({
    query: errorMessage,
    organizationId,
    executionId,
    limit,
    useAdaptiveWeights: true,
    usePerCategoryThresholds: true,
    threshold,
    // Favor dense search for error similarity
    denseWeight: 0.7,
    sparseWeight: 0.3,
  })
}

/**
 * Search for tests by name or description
 *
 * Optimized for finding tests by description:
 * - Balanced dense/sparse weights
 * - Higher threshold for precision
 * - Good for "find all login tests" queries
 *
 * @param query - Search query
 * @param organizationId - Organization ID
 * @param options - Search options
 */
export async function searchTests(
  query: string,
  organizationId: number,
  options: {
    executionId?: number
    limit?: number
  } = {}
): Promise<SearchResult[]> {
  const { executionId, limit = 10 } = options

  return searchEnhanced({
    query,
    organizationId,
    executionId,
    limit,
    useAdaptiveWeights: true,
    usePerCategoryThresholds: false, // Not error-specific
    threshold: 0.30,
    // Balanced weights for test search
    denseWeight: 0.5,
    sparseWeight: 0.5,
  })
}

/**
 * Search for code patterns (technical search)
 *
 * Optimized for technical/code searches:
 * - Favors sparse search (keyword matching)
 * - Good for "ECONNREFUSED port 3000" type queries
 *
 * @param query - Technical query (error codes, stack traces, etc.)
 * @param organizationId - Organization ID
 * @param options - Search options
 */
export async function searchCodePatterns(
  query: string,
  organizationId: number,
  options: {
    executionId?: number
    limit?: number
  } = {}
): Promise<SearchResult[]> {
  const { executionId, limit = 10 } = options

  return searchEnhanced({
    query,
    organizationId,
    executionId,
    limit,
    useAdaptiveWeights: false, // Manual weights
    usePerCategoryThresholds: false,
    threshold: 0.25, // Lower threshold for technical matches
    // Favor sparse search for exact technical terms
    denseWeight: 0.3,
    sparseWeight: 0.7,
  })
}
