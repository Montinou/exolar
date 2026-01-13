/**
 * Hybrid Search with Reciprocal Rank Fusion (RRF)
 *
 * Combines dense vector search (Jina v3) with sparse keyword search (PostgreSQL full-text)
 * for improved retrieval accuracy.
 *
 * Source: docs/prompts/research/advanced-accuracy-improvements.md
 * Expected improvement: 21% accuracy gain (BM25 nDCG@10: 43.4 → Hybrid: 52.6+)
 *
 * **Performance:**
 * - BM25 alone: 22.1% recall
 * - Dense alone: 48.7% recall
 * - Hybrid (RRF): 53.4% recall
 */

import { getSql } from "@/lib/db/connection"
import { toVectorString } from "@/lib/ai"

// ============================================
// Types
// ============================================

export interface SearchResult {
  id: number
  score: number
  test_name?: string
  test_file?: string
  error_message?: string | null
  execution_id?: number
}

export interface HybridSearchOptions {
  // Search parameters
  organizationId: number
  executionId?: number // Optional: limit to specific execution
  limit?: number
  threshold?: number // Cosine distance threshold for vector search

  // Fusion parameters
  denseWeight?: number // Weight for vector search (0-1, default 0.6)
  sparseWeight?: number // Weight for full-text search (0-1, default 0.4)
  rrfK?: number // RRF constant (default 60)
}

// ============================================
// Reciprocal Rank Fusion Algorithm
// ============================================

/**
 * Reciprocal Rank Fusion (RRF)
 *
 * Combines results from multiple ranking sources using reciprocal ranks.
 * Formula: score(d) = Σ(1 / (k + rank(d)))
 *
 * @param resultLists - Array of search result lists from different sources
 * @param k - RRF constant (default 60, from research)
 * @returns Fused results sorted by combined score
 */
export function reciprocalRankFusion<T extends { id: number; score?: number }>(
  resultLists: T[][],
  k: number = 60
): Array<T & { fusedScore: number }> {
  const scores = new Map<number, number>()
  const itemsById = new Map<number, T>()

  // Calculate RRF scores
  for (const results of resultLists) {
    for (let rank = 0; rank < results.length; rank++) {
      const item = results[rank]
      const currentScore = scores.get(item.id) || 0
      scores.set(item.id, currentScore + 1 / (k + rank + 1))

      // Store the item (from first occurrence)
      if (!itemsById.has(item.id)) {
        itemsById.set(item.id, item)
      }
    }
  }

  // Combine items with their fused scores
  const fused: Array<T & { fusedScore: number }> = []
  for (const [id, fusedScore] of scores.entries()) {
    const item = itemsById.get(id)
    if (item) {
      fused.push({ ...item, fusedScore })
    }
  }

  // Sort by fused score (highest first)
  return fused.sort((a, b) => b.fusedScore - a.fusedScore)
}

/**
 * Weighted Reciprocal Rank Fusion
 *
 * RRF with weights for each source (dense vs sparse search)
 *
 * @param resultLists - Array of result lists with associated weights
 * @param k - RRF constant
 * @returns Fused results sorted by combined score
 */
export function weightedRRF<T extends { id: number; score?: number }>(
  resultLists: Array<{ results: T[]; weight: number }>,
  k: number = 60
): Array<T & { fusedScore: number }> {
  const scores = new Map<number, number>()
  const itemsById = new Map<number, T>()

  // Calculate weighted RRF scores
  for (const { results, weight } of resultLists) {
    for (let rank = 0; rank < results.length; rank++) {
      const item = results[rank]
      const rrfScore = weight / (k + rank + 1)
      const currentScore = scores.get(item.id) || 0
      scores.set(item.id, currentScore + rrfScore)

      if (!itemsById.has(item.id)) {
        itemsById.set(item.id, item)
      }
    }
  }

  const fused: Array<T & { fusedScore: number }> = []
  for (const [id, fusedScore] of scores.entries()) {
    const item = itemsById.get(id)
    if (item) {
      fused.push({ ...item, fusedScore })
    }
  }

  return fused.sort((a, b) => b.fusedScore - a.fusedScore)
}

// ============================================
// Dense Vector Search
// ============================================

/**
 * Vector-based semantic search (dense retrieval)
 */
export async function denseSearch(
  embedding: number[],
  options: HybridSearchOptions
): Promise<SearchResult[]> {
  const sql = getSql()
  const { organizationId, executionId, limit = 50, threshold = 0.3 } = options

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
        1 - (error_embedding_v2 <=> ${vectorStr}::vector) as score
      FROM test_results
      WHERE execution_id = ${executionId}
        AND error_embedding_v2 IS NOT NULL
        AND error_embedding_v2 <=> ${vectorStr}::vector < ${threshold}
      ORDER BY error_embedding_v2 <=> ${vectorStr}::vector
      LIMIT ${limit}
    `) as SearchResult[]
  }

  // Search across organization
  return (await sql`
    SELECT
      tr.id,
      tr.test_name,
      tr.test_file,
      tr.error_message,
      tr.execution_id,
      1 - (tr.error_embedding_v2 <=> ${vectorStr}::vector) as score
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.error_embedding_v2 IS NOT NULL
      AND tr.error_embedding_v2 <=> ${vectorStr}::vector < ${threshold}
    ORDER BY tr.error_embedding_v2 <=> ${vectorStr}::vector
    LIMIT ${limit}
  `) as SearchResult[]
}

// ============================================
// Sparse Keyword Search (BM25)
// ============================================

/**
 * Full-text keyword search (sparse retrieval using PostgreSQL tsvector)
 *
 * Note: Requires search_vector column with GIN index.
 * See migration: scripts/add_fulltext_search.sql
 */
export async function sparseSearch(
  query: string,
  options: HybridSearchOptions
): Promise<SearchResult[]> {
  const sql = getSql()
  const { organizationId, executionId, limit = 50 } = options

  if (executionId) {
    // Search within single execution
    return (await sql`
      SELECT
        id,
        test_name,
        test_file,
        error_message,
        execution_id,
        ts_rank(search_vector, plainto_tsquery('english', ${query})) as score
      FROM test_results
      WHERE execution_id = ${executionId}
        AND search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY score DESC
      LIMIT ${limit}
    `) as SearchResult[]
  }

  // Search across organization
  return (await sql`
    SELECT
      tr.id,
      tr.test_name,
      tr.test_file,
      tr.error_message,
      tr.execution_id,
      ts_rank(tr.search_vector, plainto_tsquery('english', ${query})) as score
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.search_vector @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${limit}
  `) as SearchResult[]
}

// ============================================
// Hybrid Search (Dense + Sparse with RRF)
// ============================================

/**
 * Hybrid search combining vector similarity and keyword matching
 *
 * Uses Reciprocal Rank Fusion (RRF) to combine results from:
 * 1. Dense search (Jina v3 embeddings) - semantic similarity
 * 2. Sparse search (PostgreSQL full-text) - keyword matching
 *
 * @param embedding - Query embedding (512-dim for Jina v3)
 * @param query - Original query text (for keyword search)
 * @param options - Search options
 * @returns Combined results with fused scores
 */
export async function hybridSearch(
  embedding: number[],
  query: string,
  options: HybridSearchOptions
): Promise<SearchResult[]> {
  const {
    limit = 10,
    denseWeight = 0.6,
    sparseWeight = 0.4,
    rrfK = 60,
  } = options

  // Execute both searches in parallel
  const [denseResults, sparseResults] = await Promise.all([
    denseSearch(embedding, { ...options, limit: 50 }),
    sparseSearch(query, { ...options, limit: 50 }),
  ])

  // Combine using weighted RRF
  const fused = weightedRRF(
    [
      { results: denseResults, weight: denseWeight },
      { results: sparseResults, weight: sparseWeight },
    ],
    rrfK
  )

  // Return top N results
  return fused.slice(0, limit).map((item) => ({
    id: item.id,
    score: item.fusedScore,
    test_name: item.test_name,
    test_file: item.test_file,
    error_message: item.error_message,
    execution_id: item.execution_id,
  }))
}

/**
 * Adaptive hybrid search with query-type optimization
 *
 * Adjusts dense/sparse weights based on query characteristics:
 * - Code-heavy queries (ECONNREFUSED, port numbers) → favor sparse
 * - Semantic queries (timeout issues, login problems) → favor dense
 *
 * @param embedding - Query embedding
 * @param query - Original query text
 * @param options - Search options
 * @returns Optimally weighted hybrid results
 */
export async function adaptiveHybridSearch(
  embedding: number[],
  query: string,
  options: HybridSearchOptions
): Promise<SearchResult[]> {
  // Detect query type based on content
  const queryType = detectQueryType(query)

  // Adjust weights based on query type
  let denseWeight = 0.6
  let sparseWeight = 0.4

  if (queryType === "code") {
    // Code/technical queries benefit from exact keyword matching
    denseWeight = 0.3
    sparseWeight = 0.7
  } else if (queryType === "semantic") {
    // Semantic queries benefit from embedding similarity
    denseWeight = 0.7
    sparseWeight = 0.3
  }
  // Mixed queries use default 60/40 split

  return hybridSearch(embedding, query, {
    ...options,
    denseWeight,
    sparseWeight,
  })
}

/**
 * Detect query type for adaptive weighting
 */
function detectQueryType(query: string): "code" | "semantic" | "mixed" {
  const lowerQuery = query.toLowerCase()

  // Code-like patterns
  const codePatterns = [
    /\b[A-Z_]{3,}\b/, // CONSTANTS, ERROR_CODES
    /\bport\s+\d+/, // port numbers
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
    /\.[a-z]{2,4}\(/, // function calls
    /[:/\\]/, // paths or namespaces
    /0x[0-9a-f]+/i, // hex codes
  ]

  const hasCodePattern = codePatterns.some((pattern) => pattern.test(query))

  // Semantic patterns
  const semanticWords = [
    "issue",
    "problem",
    "error",
    "failure",
    "timeout",
    "slow",
    "broken",
    "not working",
    "fails",
    "crashes",
  ]

  const hasSemanticWords = semanticWords.some((word) =>
    lowerQuery.includes(word)
  )

  if (hasCodePattern && !hasSemanticWords) {
    return "code"
  } else if (hasSemanticWords && !hasCodePattern) {
    return "semantic"
  }
  return "mixed"
}
