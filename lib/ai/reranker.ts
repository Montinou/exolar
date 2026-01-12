/**
 * Reranking Service
 *
 * Provides two-stage retrieval for improved search precision:
 * 1. Vector search (high recall) - Get ~50 candidates
 * 2. Reranking (high precision) - Return top ~10 most relevant
 *
 * This approach combines the speed of vector search with the
 * semantic understanding of cross-encoder models like Cohere Rerank.
 */

import { cohereRerank, isCohereAvailable, type RerankDocument, type RerankResult } from "./providers/cohere"

// ============================================
// Types
// ============================================

export interface SimilarFailureCandidate {
  id: number
  testName: string
  errorMessage: string | null
  similarity: number // From vector search (0-1)
  executionId?: number
  branch?: string
  createdAt?: string
}

export interface RankedFailure extends SimilarFailureCandidate {
  /** Reranking score (0-1, higher = more relevant) */
  rerankScore: number
  /** Final combined score */
  finalScore: number
}

export interface RerankOptions {
  /** Number of candidates to return after reranking (default: 10) */
  topN?: number
  /** Minimum relevance score (default: 0.3) */
  minScore?: number
  /** Weight for vector similarity in final score (default: 0.3) */
  vectorWeight?: number
  /** Skip reranking and return vector results only */
  skipRerank?: boolean
}

// ============================================
// Reranking Functions
// ============================================

/**
 * Rerank similar failures using Cohere
 *
 * Takes candidates from vector search and reranks them for better relevance.
 *
 * @param query - The original error message/search query
 * @param candidates - Candidates from vector search (high recall)
 * @param options - Reranking options
 * @returns Reranked and sorted results (high precision)
 *
 * @example
 * // Get 50 candidates from vector search
 * const candidates = await findSimilarFailures(executionId, embedding, { limit: 50 })
 *
 * // Rerank to get top 10 most relevant
 * const results = await rerankSimilarFailures(
 *   "TimeoutError: Login button not found",
 *   candidates,
 *   { topN: 10 }
 * )
 */
export async function rerankSimilarFailures(
  query: string,
  candidates: SimilarFailureCandidate[],
  options: RerankOptions = {}
): Promise<RankedFailure[]> {
  const {
    topN = 10,
    minScore = 0.3,
    vectorWeight = 0.3,
    skipRerank = false,
  } = options

  // If no candidates or reranking disabled, return as-is
  if (candidates.length === 0) {
    return []
  }

  // If Cohere not available or skip requested, return vector results only
  if (skipRerank || !isCohereAvailable()) {
    return candidates
      .slice(0, topN)
      .map((c) => ({
        ...c,
        rerankScore: c.similarity, // Use vector similarity as fallback
        finalScore: c.similarity,
      }))
  }

  // Convert to Cohere document format
  const documents: RerankDocument[] = candidates.map((c) => ({
    id: c.id,
    text: buildRerankText(c),
    metadata: { original: c },
  }))

  try {
    // Rerank using Cohere
    const reranked = await cohereRerank(query, documents, {
      topN,
      minScore,
    })

    // Combine vector and rerank scores
    return reranked.map((r) => {
      const original = r.document.metadata?.original as SimilarFailureCandidate
      const vectorScore = original.similarity
      const rerankScore = r.relevanceScore

      // Weighted combination: rerank score is primary, vector is secondary
      const finalScore = (1 - vectorWeight) * rerankScore + vectorWeight * vectorScore

      return {
        ...original,
        rerankScore,
        finalScore,
      }
    }).sort((a, b) => b.finalScore - a.finalScore)
  } catch (error) {
    // If reranking fails, fall back to vector results
    console.error("Reranking failed, falling back to vector results:", error)
    return candidates
      .slice(0, topN)
      .map((c) => ({
        ...c,
        rerankScore: c.similarity,
        finalScore: c.similarity,
      }))
  }
}

/**
 * Rerank generic search results
 *
 * @param query - Search query
 * @param items - Items to rerank
 * @param getTextFn - Function to extract text from each item
 * @param options - Reranking options
 */
export async function rerankItems<T extends { id: string | number }>(
  query: string,
  items: T[],
  getTextFn: (item: T) => string,
  options: RerankOptions = {}
): Promise<Array<T & { rerankScore: number }>> {
  const { topN = 10, minScore = 0, skipRerank = false } = options

  if (items.length === 0) {
    return []
  }

  if (skipRerank || !isCohereAvailable()) {
    return items.slice(0, topN).map((item) => ({
      ...item,
      rerankScore: 1, // Default score when not reranking
    }))
  }

  const documents: RerankDocument[] = items.map((item) => ({
    id: item.id,
    text: getTextFn(item),
    metadata: { original: item },
  }))

  try {
    const reranked = await cohereRerank(query, documents, { topN, minScore })

    return reranked.map((r) => ({
      ...(r.document.metadata?.original as T),
      rerankScore: r.relevanceScore,
    }))
  } catch (error) {
    console.error("Reranking failed:", error)
    return items.slice(0, topN).map((item) => ({
      ...item,
      rerankScore: 1,
    }))
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build text for reranking from failure candidate
 *
 * Includes test name and error message for better semantic matching.
 */
function buildRerankText(candidate: SimilarFailureCandidate): string {
  const parts: string[] = []

  if (candidate.testName) {
    parts.push(`Test: ${candidate.testName}`)
  }

  if (candidate.errorMessage) {
    parts.push(`Error: ${candidate.errorMessage}`)
  }

  return parts.join("\n") || "(no error information)"
}

/**
 * Check if reranking is available
 */
export function isRerankingAvailable(): boolean {
  return isCohereAvailable()
}

// Re-export types
export type { RerankDocument, RerankResult } from "./providers/cohere"
