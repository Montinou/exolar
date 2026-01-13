/**
 * Jina Embeddings v3 Provider
 *
 * Advanced embedding model with:
 * - 512 dimensions (Matryoshka representation learning)
 * - Asymmetric embeddings (passage vs query task types)
 * - Late chunking support
 * - Free tier: 10M tokens
 *
 * @see https://jina.ai/embeddings/
 */

import type { EmbeddingTask } from "../types"

// ============================================
// Configuration
// ============================================

const JINA_API_URL = "https://api.jina.ai/v1/embeddings"
const JINA_MODEL = "jina-embeddings-v3"
const JINA_DIMENSIONS = 512 // Using Matryoshka for efficient storage

// ============================================
// Types
// ============================================

interface JinaEmbeddingRequest {
  model: string
  input: string | string[]
  task: "retrieval.passage" | "retrieval.query" | "text-matching"
  dimensions?: number
  late_chunking?: boolean
}

interface JinaEmbeddingResponse {
  model: string
  object: string
  data: Array<{
    object: string
    index: number
    embedding: number[]
  }>
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

interface JinaErrorResponse {
  detail: string
}

// ============================================
// API Client
// ============================================

function getApiKey(): string {
  const apiKey = process.env.JINA_API_KEY
  if (!apiKey) {
    throw new Error(
      "JINA_API_KEY environment variable is not set. " +
        "Get your free API key at https://jina.ai/"
    )
  }
  return apiKey
}

/**
 * Generate embedding using Jina v3
 *
 * @param text - Text to embed
 * @param task - Task type for asymmetric embeddings
 * @returns 512-dimension embedding vector
 *
 * @example
 * // For indexing documents/errors (passages)
 * const docEmbedding = await generateJinaEmbedding(errorMessage, "retrieval.passage")
 *
 * // For search queries
 * const queryEmbedding = await generateJinaEmbedding(userQuery, "retrieval.query")
 */
export async function generateJinaEmbedding(
  text: string,
  task: EmbeddingTask = "retrieval.passage"
): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text")
  }

  const apiKey = getApiKey()
  const truncatedText = truncateForJina(text)

  // Map our task type to Jina's expected values
  const jinaTask: JinaEmbeddingRequest["task"] =
    task === "retrieval.query" ? "retrieval.query" : "retrieval.passage"

  // Enable late chunking for long texts (>2000 chars) to improve accuracy
  // Source: docs/prompts/research/jina-v3-best-practices.md
  const body: JinaEmbeddingRequest = {
    model: JINA_MODEL,
    input: truncatedText,
    task: jinaTask,
    dimensions: JINA_DIMENSIONS,
    ...(text.length > 2000 && { late_chunking: true }),
  }

  try {
    const response = await fetch(JINA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = (await response.json()) as JinaErrorResponse
      throw new Error(`Jina API error: ${error.detail || response.statusText}`)
    }

    const data = (await response.json()) as JinaEmbeddingResponse
    return data.data[0].embedding
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to generate Jina embedding: ${message}`)
  }
}

/**
 * Generate embeddings for multiple texts in batch
 *
 * More efficient than individual calls.
 * All texts use the same task type.
 *
 * @param texts - Array of texts to embed
 * @param task - Task type for all texts
 * @returns Array of embedding vectors (same order as input)
 */
export async function generateJinaEmbeddingsBatch(
  texts: string[],
  task: EmbeddingTask = "retrieval.passage"
): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  // Filter out empty texts and track indices
  const validTexts: { index: number; text: string }[] = []
  texts.forEach((text, index) => {
    if (text && text.trim().length > 0) {
      validTexts.push({ index, text: truncateForJina(text) })
    }
  })

  if (validTexts.length === 0) {
    return texts.map(() => [])
  }

  const apiKey = getApiKey()

  // Jina supports batch embedding in single request
  // Research shows optimal batch size is 256 for 50% cost reduction
  // Source: docs/prompts/research/jina-v3-best-practices.md
  const BATCH_SIZE = 256
  const results: number[][] = new Array(texts.length).fill([])

  const jinaTask: JinaEmbeddingRequest["task"] =
    task === "retrieval.query" ? "retrieval.query" : "retrieval.passage"

  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE)

    // Enable late chunking if any text in batch is >2000 chars
    const hasLongText = batch.some((b) => b.text.length > 2000)

    const body: JinaEmbeddingRequest = {
      model: JINA_MODEL,
      input: batch.map((b) => b.text),
      task: jinaTask,
      dimensions: JINA_DIMENSIONS,
      ...(hasLongText && { late_chunking: true }),
    }

    try {
      const response = await fetch(JINA_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = (await response.json()) as JinaErrorResponse
        console.error(`Jina batch API error: ${error.detail || response.statusText}`)
        continue
      }

      const data = (await response.json()) as JinaEmbeddingResponse

      // Map results back to original indices
      data.data.forEach((item, batchIndex) => {
        const originalIndex = batch[batchIndex].index
        results[originalIndex] = item.embedding
      })
    } catch (error) {
      console.error(`Jina batch embedding failed:`, error)
      // Continue with next batch
    }
  }

  return results
}

/**
 * Truncate text to fit within Jina's limits
 *
 * Jina v3 supports up to 8192 tokens.
 * We truncate at ~6000 tokens to be safe.
 */
function truncateForJina(text: string): string {
  const MAX_CHARS = 24000 // ~6000 tokens at 4 chars/token

  if (text.length <= MAX_CHARS) {
    return text
  }

  return text.substring(0, MAX_CHARS - 20) + "\n... [truncated]"
}

/**
 * Get the embedding dimensions for Jina v3
 */
export function getJinaDimensions(): number {
  return JINA_DIMENSIONS
}
