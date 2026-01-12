/**
 * AI utilities for Exolar QA
 *
 * Provides embedding generation and error sanitization for:
 * - Smart failure clustering
 * - Semantic test search
 *
 * Providers:
 * - Primary: Jina v3 (512-dim, asymmetric embeddings)
 * - Fallback: Gemini text-embedding-004 (768-dim)
 */

// Re-export everything
export * from "./embeddings"
export * from "./sanitizer"
export * from "./types"

// Provider exports (unified interface)
export {
  generateEmbeddingWithProvider,
  generateEmbeddingsBatchWithProvider,
  getDefaultProvider,
  getDimensionsForProvider,
  getProviderInfo,
} from "./providers"
