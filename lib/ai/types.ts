/**
 * TypeScript types for AI/Vector features
 */

/**
 * A vector embedding (768 dimensions for Gemini text-embedding-004)
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
  error_embedding: string | null // PostgreSQL vector stored as string
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
