/**
 * Embedding Provider Factory
 *
 * Provides a unified interface for embedding generation across providers.
 * Primary: Jina v3 (512-dim, asymmetric)
 * Fallback: Gemini text-embedding-004 (768-dim)
 */

import type { EmbeddingProvider, EmbeddingTask, EmbeddingConfig } from "../types"
import { EMBEDDING_DIMENSIONS } from "../types"
import { generateEmbedding as generateGeminiEmbedding, generateEmbeddingsBatch as generateGeminiBatch } from "../embeddings"
import { generateJinaEmbedding, generateJinaEmbeddingsBatch, getJinaDimensions } from "./jina"

// ============================================
// Configuration
// ============================================

/**
 * Default provider configuration
 * Set to 'jina' for primary, falls back to 'gemini' if Jina fails
 */
const DEFAULT_PROVIDER: EmbeddingProvider = "jina"

/**
 * Get the current default provider based on environment
 */
export function getDefaultProvider(): EmbeddingProvider {
  // Allow override via environment variable
  const envProvider = process.env.EMBEDDING_PROVIDER as EmbeddingProvider | undefined
  if (envProvider && (envProvider === "jina" || envProvider === "gemini")) {
    return envProvider
  }

  // Check if Jina is available
  if (process.env.JINA_API_KEY) {
    return "jina"
  }

  // Fall back to Gemini
  if (process.env.GEMINIAI_API_KEY) {
    return "gemini"
  }

  throw new Error(
    "No embedding provider configured. " +
      "Set JINA_API_KEY (recommended) or GEMINIAI_API_KEY environment variable."
  )
}

// ============================================
// Unified Embedding Functions
// ============================================

/**
 * Generate embedding using configured provider
 *
 * @param text - Text to embed
 * @param config - Optional provider configuration
 * @returns Embedding vector (dimensions depend on provider)
 *
 * @example
 * // Use default provider (Jina)
 * const embedding = await generateEmbeddingWithProvider("error message")
 *
 * // Use specific provider with task
 * const embedding = await generateEmbeddingWithProvider("search query", {
 *   provider: "jina",
 *   task: "retrieval.query"
 * })
 */
export async function generateEmbeddingWithProvider(
  text: string,
  config?: Partial<EmbeddingConfig>
): Promise<number[]> {
  const provider = config?.provider ?? getDefaultProvider()
  const task = config?.task ?? "retrieval.passage"

  try {
    if (provider === "jina") {
      return await generateJinaEmbedding(text, task)
    } else {
      return await generateGeminiEmbedding(text)
    }
  } catch (error) {
    // If Jina fails, try Gemini as fallback (if different)
    if (provider === "jina" && process.env.GEMINIAI_API_KEY) {
      console.warn(`Jina embedding failed, falling back to Gemini:`, error)
      return await generateGeminiEmbedding(text)
    }
    throw error
  }
}

/**
 * Generate embeddings for multiple texts
 *
 * @param texts - Array of texts to embed
 * @param config - Optional provider configuration
 * @returns Array of embedding vectors (same order as input)
 */
export async function generateEmbeddingsBatchWithProvider(
  texts: string[],
  config?: Partial<EmbeddingConfig>
): Promise<number[][]> {
  const provider = config?.provider ?? getDefaultProvider()
  const task = config?.task ?? "retrieval.passage"

  try {
    if (provider === "jina") {
      return await generateJinaEmbeddingsBatch(texts, task)
    } else {
      return await generateGeminiBatch(texts)
    }
  } catch (error) {
    // If Jina fails, try Gemini as fallback (if different)
    if (provider === "jina" && process.env.GEMINIAI_API_KEY) {
      console.warn(`Jina batch embedding failed, falling back to Gemini:`, error)
      return await generateGeminiBatch(texts)
    }
    throw error
  }
}

/**
 * Get the dimensions for a provider
 */
export function getDimensionsForProvider(provider?: EmbeddingProvider): number {
  const p = provider ?? getDefaultProvider()
  return EMBEDDING_DIMENSIONS[p]
}

/**
 * Get provider info for logging/debugging
 */
export function getProviderInfo(): {
  provider: EmbeddingProvider
  dimensions: number
  supportsAsymmetric: boolean
} {
  const provider = getDefaultProvider()
  return {
    provider,
    dimensions: EMBEDDING_DIMENSIONS[provider],
    supportsAsymmetric: provider === "jina",
  }
}

// ============================================
// Re-exports
// ============================================

export { generateJinaEmbedding, generateJinaEmbeddingsBatch, getJinaDimensions } from "./jina"
export { generateGeminiEmbedding, generateGeminiBatch }
export { cohereRerank, isCohereAvailable, getCohereModelInfo } from "./cohere"
export type { RerankDocument, RerankResult } from "./cohere"
