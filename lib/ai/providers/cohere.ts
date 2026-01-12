/**
 * Cohere Rerank v3 Provider
 *
 * Two-stage retrieval: Vector search (high recall) → Rerank (high precision)
 *
 * Benefits:
 * - Improves precision over pure vector search
 * - Better semantic understanding of query-document relevance
 * - Free tier: 1,000 requests/month
 *
 * @see https://docs.cohere.com/reference/rerank
 */

// ============================================
// Configuration
// ============================================

const COHERE_API_URL = "https://api.cohere.com/v1/rerank"
const COHERE_MODEL = "rerank-english-v3.0"

// ============================================
// Types
// ============================================

export interface RerankDocument {
  /** Unique identifier for tracking */
  id: string | number
  /** Text content to rank against the query */
  text: string
  /** Original data to preserve (pass through) */
  metadata?: Record<string, unknown>
}

export interface RerankResult {
  /** Original document with metadata */
  document: RerankDocument
  /** Relevance score (0-1, higher = more relevant) */
  relevanceScore: number
  /** Original index in input array */
  originalIndex: number
}

interface CohereRerankRequest {
  model: string
  query: string
  documents: string[]
  top_n?: number
  return_documents?: boolean
}

interface CohereRerankResponse {
  id: string
  results: Array<{
    index: number
    relevance_score: number
  }>
  meta: {
    api_version: {
      version: string
    }
    billed_units: {
      search_units: number
    }
  }
}

interface CohereErrorResponse {
  message: string
}

// ============================================
// API Client
// ============================================

function getApiKey(): string {
  const apiKey = process.env.COHERE_API_KEY
  if (!apiKey) {
    throw new Error(
      "COHERE_API_KEY environment variable is not set. " +
        "Get your free API key at https://dashboard.cohere.com/api-keys"
    )
  }
  return apiKey
}

/**
 * Rerank documents using Cohere's rerank-english-v3.0 model
 *
 * @param query - The search query to rank against
 * @param documents - Array of documents to rerank
 * @param options - Reranking options
 * @returns Sorted array of results (highest relevance first)
 *
 * @example
 * const results = await cohereRerank(
 *   "login timeout error",
 *   [
 *     { id: 1, text: "TimeoutError: Login button not found after 30s" },
 *     { id: 2, text: "Network error during checkout" },
 *     { id: 3, text: "Login form submission timed out" }
 *   ],
 *   { topN: 2 }
 * )
 * // Returns top 2 most relevant results sorted by relevance
 */
export async function cohereRerank(
  query: string,
  documents: RerankDocument[],
  options: {
    /** Number of top results to return (default: all) */
    topN?: number
    /** Minimum relevance score to include (default: 0) */
    minScore?: number
  } = {}
): Promise<RerankResult[]> {
  if (!query || query.trim().length === 0) {
    throw new Error("Query cannot be empty")
  }

  if (documents.length === 0) {
    return []
  }

  const { topN = documents.length, minScore = 0 } = options
  const apiKey = getApiKey()

  // Extract text for Cohere API
  const documentTexts = documents.map((d) => d.text)

  const body: CohereRerankRequest = {
    model: COHERE_MODEL,
    query,
    documents: documentTexts,
    top_n: Math.min(topN, documents.length),
    return_documents: false, // We track by index
  }

  try {
    const response = await fetch(COHERE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = (await response.json()) as CohereErrorResponse
      throw new Error(`Cohere API error: ${error.message || response.statusText}`)
    }

    const data = (await response.json()) as CohereRerankResponse

    // Map results back to original documents
    const results: RerankResult[] = data.results
      .filter((r) => r.relevance_score >= minScore)
      .map((r) => ({
        document: documents[r.index],
        relevanceScore: r.relevance_score,
        originalIndex: r.index,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)

    return results
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to rerank documents: ${message}`)
  }
}

/**
 * Check if Cohere API is available
 */
export function isCohereAvailable(): boolean {
  return !!process.env.COHERE_API_KEY
}

/**
 * Get Cohere model info
 */
export function getCohereModelInfo(): {
  model: string
  available: boolean
} {
  return {
    model: COHERE_MODEL,
    available: isCohereAvailable(),
  }
}
