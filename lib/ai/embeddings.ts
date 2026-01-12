/**
 * Embedding generation using Google Gemini text-embedding-004
 *
 * This module provides utilities for generating vector embeddings from text,
 * used for semantic similarity search and failure clustering.
 */

import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Gemini client lazily (only when needed)
let genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINIAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "GEMINIAI_API_KEY environment variable is not set. " +
          "Please add it to your .env file."
      )
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

/**
 * Generate a vector embedding for the given text
 *
 * @param text - The text to embed (error message, stack trace, etc.)
 * @returns Array of 768 floats representing the embedding vector
 * @throws Error if API call fails or text is empty
 *
 * @example
 * const embedding = await generateEmbedding("TimeoutError: Navigation timeout of 30000ms exceeded")
 * // Returns: [0.012, -0.93, 0.45, ...]
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text")
  }

  const client = getGenAI()
  const model = client.getGenerativeModel({ model: "text-embedding-004" })

  try {
    // Truncate if too long (Gemini has context limits)
    const truncatedText = truncateForEmbedding(text)

    const result = await model.embedContent(truncatedText)
    return result.embedding.values
  } catch (error) {
    // Wrap error with context
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to generate embedding: ${message}`)
  }
}

/**
 * Generate embeddings for multiple texts in batch
 *
 * More efficient than calling generateEmbedding() in a loop
 * as it batches API calls.
 *
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors (same order as input)
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  // Filter out empty texts and track indices
  const validTexts: { index: number; text: string }[] = []
  texts.forEach((text, index) => {
    if (text && text.trim().length > 0) {
      validTexts.push({ index, text: truncateForEmbedding(text) })
    }
  })

  if (validTexts.length === 0) {
    return texts.map(() => [])
  }

  const client = getGenAI()
  const model = client.getGenerativeModel({ model: "text-embedding-004" })

  // Batch size limit (Gemini may have rate limits)
  const BATCH_SIZE = 100
  const results: number[][] = new Array(texts.length).fill([])

  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE)

    // Process batch in parallel
    const embeddings = await Promise.all(
      batch.map(async ({ index, text }) => {
        try {
          const result = await model.embedContent(text)
          return { index, embedding: result.embedding.values }
        } catch (error) {
          console.error(`Failed to embed text at index ${index}:`, error)
          return { index, embedding: [] }
        }
      })
    )

    // Assign results to correct positions
    for (const { index, embedding } of embeddings) {
      results[index] = embedding
    }
  }

  return results
}

/**
 * Truncate text to fit within embedding model limits
 *
 * Gemini text-embedding-004 has a context window of ~8192 tokens.
 * We truncate at ~6000 tokens (roughly 24000 chars) to be safe.
 */
function truncateForEmbedding(text: string): string {
  const MAX_CHARS = 24000 // ~6000 tokens at 4 chars/token

  if (text.length <= MAX_CHARS) {
    return text
  }

  // Truncate and add indicator
  return text.substring(0, MAX_CHARS - 20) + "\n... [truncated]"
}

/**
 * Calculate cosine similarity between two embeddings
 *
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Embedding dimensions don't match: ${a.length} vs ${b.length}`
    )
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Convert embedding array to PostgreSQL vector format
 *
 * @example
 * toVectorString([0.1, 0.2, 0.3]) // "[0.1,0.2,0.3]"
 */
export function toVectorString(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

/**
 * Parse PostgreSQL vector string to number array
 *
 * @example
 * parseVectorString("[0.1,0.2,0.3]") // [0.1, 0.2, 0.3]
 */
export function parseVectorString(vectorStr: string): number[] {
  // Remove brackets and split by comma
  const cleaned = vectorStr.replace(/^\[|\]$/g, "")
  return cleaned.split(",").map(Number)
}
