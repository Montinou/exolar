/**
 * TypeScript types for AI/Vector features
 */

// ============================================
// Provider Types
// ============================================

/**
 * Available embedding providers
 */
export type EmbeddingProvider = "gemini" | "jina"

/**
 * Embedding storage versions
 * - v1: 768-dim Gemini embeddings (error_embedding column)
 * - v2: 512-dim Jina embeddings (error_embedding_v2 column)
 */
export type EmbeddingVersion = "v1" | "v2"

/**
 * Task type for asymmetric embeddings (Jina v3)
 *
 * - retrieval.passage: Use when indexing documents/errors (stored in DB)
 * - retrieval.query: Use when searching (user's search query)
 */
export type EmbeddingTask = "retrieval.passage" | "retrieval.query"

/**
 * Configuration for embedding generation
 */
export interface EmbeddingConfig {
  /** Which provider to use */
  provider: EmbeddingProvider
  /** Task type for asymmetric embeddings (only used by Jina) */
  task?: EmbeddingTask
}

/**
 * Embedding dimensions by provider
 */
export const EMBEDDING_DIMENSIONS: Record<EmbeddingProvider, number> = {
  gemini: 768,
  jina: 512,
}

// ============================================
// Embedding Types
// ============================================

/**
 * A vector embedding
 * - 768 dimensions for Gemini text-embedding-004
 * - 512 dimensions for Jina v3 (Matryoshka)
 */
export type Embedding = number[]

/**
 * Result from a similarity search
 */
export interface SimilarityResult {
  id: number
  testName: string
  errorMessage: string | null
  similarity: number // 0-1 where 1 is identical
}

/**
 * A cluster of semantically similar failures
 */
export interface FailureCluster {
  clusterId: number
  representativeError: string
  testCount: number
  tests: ClusterMember[]
  centroidEmbedding?: Embedding
}

/**
 * A test result that belongs to a cluster
 */
export interface ClusterMember {
  testResultId: number
  testName: string
  testFile: string
  errorMessage: string | null
  distanceToCentroid: number // Lower = closer to cluster center
  isRepresentative: boolean // Is this the "most typical" failure?
}

/**
 * Options for clustering failures
 */
export interface ClusteringOptions {
  /**
   * Maximum cosine distance to be considered part of same cluster
   * Lower = stricter clustering (fewer, tighter clusters)
   * Higher = looser clustering (more tests per cluster)
   * @default 0.15
   */
  distanceThreshold?: number

  /**
   * Minimum number of tests to form a cluster
   * Prevents single-test clusters
   * @default 2
   */
  minClusterSize?: number

  /**
   * Maximum number of clusters to return
   * @default 20
   */
  maxClusters?: number
}

/**
 * Result of embedding generation for a test result
 */
export interface EmbeddingResult {
  testResultId: number
  success: boolean
  embedding?: Embedding
  error?: string
}

/**
 * Database row type for test_results with embedding
 */
export interface TestResultWithEmbedding {
  id: number
  execution_id: number
  test_name: string
  test_file: string
  status: string
  error_message: string | null
  stack_trace: string | null
  error_embedding: string | null // PostgreSQL vector stored as string (768-dim, Gemini)
  error_embedding_v2: string | null // PostgreSQL vector stored as string (512-dim, Jina)
  embedding_chunk_hash: string | null // Hash for incremental indexing
  ai_context: unknown | null
}

/**
 * Semantic search result for tests
 */
export interface SemanticSearchResult {
  testSignature: string
  testName: string
  testFile: string
  similarity: number
  lastStatus: string
  runCount: number
  passRate?: number
}
