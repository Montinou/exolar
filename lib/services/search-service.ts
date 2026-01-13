/**
 * Semantic Search Service
 *
 * Orchestrates semantic search with:
 * - Query embedding generation (asymmetric, using retrieval.query task)
 * - Vector search in database
 * - Optional Cohere reranking for precision
 */

import {
  generateEmbeddingWithProvider,
  getDefaultProvider,
  prepareErrorForEmbedding,
  rerankItems,
  isRerankingAvailable,
} from "@/lib/ai"
import {
  searchFailuresSemantic,
  searchHybrid,
  getEmbeddingCoverage,
  type SemanticSearchOptions,
  type SemanticSearchResult,
} from "@/lib/db/semantic-search"

// ============================================
// Types
// ============================================

export interface SearchRequest {
  /** Natural language query */
  query: string
  /** Organization ID */
  organizationId: number
  /** Search mode */
  mode?: "semantic" | "keyword" | "hybrid"
  /** Maximum results to return */
  limit?: number
  /** Filter by branch */
  branch?: string
  /** Filter by suite */
  suite?: string
  /** Filter by date (ISO string) */
  since?: string
  /** Enable Cohere reranking */
  rerank?: boolean
  /** Number of candidates for reranking (fetch more, rerank to limit) */
  rerankCandidates?: number
  /** Filter by test status (all, passed, failed, skipped) */
  statusFilter?: "all" | "passed" | "failed" | "skipped"
}

export interface SearchResponse {
  results: SemanticSearchResult[]
  query: string
  mode: "semantic" | "keyword" | "hybrid"
  totalResults: number
  embeddingVersion?: "v1" | "v2"
  reranked: boolean
  searchTimeMs: number
}

// ============================================
// Main Search Function
// ============================================

/**
 * Perform semantic search with optional reranking
 *
 * @param request - Search request parameters
 * @returns Search results with metadata
 */
export async function semanticSearch(request: SearchRequest): Promise<SearchResponse> {
  const startTime = Date.now()
  const {
    query,
    organizationId,
    mode = "hybrid",
    limit = 20,
    branch,
    suite,
    since,
    rerank = true,
    rerankCandidates = 50,
    statusFilter = "all",
  } = request

  // Validate query
  if (!query || query.trim().length < 2) {
    return {
      results: [],
      query,
      mode,
      totalResults: 0,
      reranked: false,
      searchTimeMs: Date.now() - startTime,
    }
  }

  // Prepare search options
  const searchOptions: SemanticSearchOptions = {
    organizationId,
    limit: rerank ? rerankCandidates : limit, // Get more candidates for reranking
    branch,
    suite,
    since,
    mode,
    statusFilter,
  }

  let queryEmbedding: number[] | null = null
  let embeddingVersion: "v1" | "v2" | undefined

  // Generate query embedding for semantic/hybrid modes
  if (mode !== "keyword") {
    try {
      const provider = getDefaultProvider()

      // Use asymmetric embedding with query task type
      queryEmbedding = await generateEmbeddingWithProvider(query, {
        provider,
        task: "retrieval.query", // Important: use query task for search
      })

      embeddingVersion = provider === "jina" ? "v2" : "v1"
    } catch (error) {
      console.error("Failed to generate query embedding:", error)
      // Fall back to keyword search if embedding fails
      if (mode === "semantic") {
        return {
          results: [],
          query,
          mode: "keyword",
          totalResults: 0,
          reranked: false,
          searchTimeMs: Date.now() - startTime,
        }
      }
    }
  }

  // Perform search
  let results = await searchHybrid(queryEmbedding, query, searchOptions)

  // Apply reranking if enabled and available
  let reranked = false
  if (rerank && results.length > 0 && isRerankingAvailable()) {
    try {
      const rerankedResults = await rerankItems(
        query,
        results,
        (r) => `${r.testName}\n${r.testFile}\n${r.errorMessage || ""}`,
        {
          topN: limit,
          minScore: 0.1,
        }
      )

      if (rerankedResults.length > 0) {
        results = rerankedResults
        reranked = true
      }
    } catch (error) {
      console.error("Reranking failed, using vector results:", error)
      // Fall back to vector results
      results = results.slice(0, limit)
    }
  } else {
    // No reranking, just limit results
    results = results.slice(0, limit)
  }

  return {
    results,
    query,
    mode,
    totalResults: results.length,
    embeddingVersion,
    reranked,
    searchTimeMs: Date.now() - startTime,
  }
}

// ============================================
// Search Suggestions
// ============================================

/**
 * Get search suggestions based on recent failures
 *
 * Returns common error patterns that could be searched for.
 */
export async function getSearchSuggestions(
  organizationId: number,
  limit: number = 5
): Promise<string[]> {
  // This could be enhanced to analyze error patterns
  // For now, return some generic suggestions
  const suggestions = [
    "timeout errors",
    "network failures",
    "authentication errors",
    "element not found",
    "assertion failed",
  ]

  return suggestions.slice(0, limit)
}

// ============================================
// Search Stats
// ============================================

/**
 * Get search capability stats for the organization
 */
export async function getSearchStats(organizationId: number): Promise<{
  semanticSearchAvailable: boolean
  rerankingAvailable: boolean
  embeddingCoverage: {
    totalFailures: number
    withV1Embedding: number
    withV2Embedding: number
    coverageV1: number
    coverageV2: number
  }
  provider: string
}> {
  const coverage = await getEmbeddingCoverage(organizationId)
  const provider = getDefaultProvider()

  return {
    semanticSearchAvailable: coverage.withV2Embedding > 0 || coverage.withV1Embedding > 0,
    rerankingAvailable: isRerankingAvailable(),
    embeddingCoverage: coverage,
    provider,
  }
}
