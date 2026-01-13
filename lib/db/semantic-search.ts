/**
 * Semantic Search Functions
 *
 * Provides vector-based semantic search for test failures and tests.
 * Uses asymmetric embeddings (query vs passage) for better search quality.
 *
 * Features:
 * - Semantic search with Jina v3 query embeddings
 * - Two-stage retrieval with Cohere reranking
 * - Hybrid mode combining semantic + keyword search
 */

import { getSql } from "./connection"
import { toVectorString } from "@/lib/ai"
import type { EmbeddingVersion } from "@/lib/ai/types"

// ============================================
// Types
// ============================================

export interface SemanticSearchOptions {
  /** Organization ID for filtering */
  organizationId: number
  /** Maximum number of results (before reranking) */
  limit?: number
  /** Cosine distance threshold (lower = more similar) */
  threshold?: number
  /** Filter by branch */
  branch?: string
  /** Filter by suite */
  suite?: string
  /** Filter by date range (ISO string) */
  since?: string
  /** Search mode */
  mode?: "semantic" | "keyword" | "hybrid"
  /** Include only failed tests (legacy, use statusFilter instead) */
  failedOnly?: boolean
  /** Filter by test status */
  statusFilter?: "all" | "passed" | "failed" | "skipped"
}

export interface SemanticSearchResult {
  testResultId: number
  executionId: number
  testName: string
  testFile: string
  testSignature: string | null
  status: string
  errorMessage: string | null
  similarity: number
  branch: string
  suite: string | null
  createdAt: string
}

export interface TestSemanticSearchResult {
  testSignature: string
  testName: string
  testFile: string
  runCount: number
  lastRun: string
  lastStatus: string
  passRate: number
  similarity: number
}

// ============================================
// Semantic Search for Failures
// ============================================

/**
 * Search failures using vector similarity
 *
 * Uses v2 embeddings (512-dim Jina) when available, falls back to v1.
 * Embedding should be generated with task="retrieval.query" for best results.
 *
 * @param queryEmbedding - Query embedding (512 or 768 dimensions)
 * @param options - Search options
 */
export async function searchFailuresSemantic(
  queryEmbedding: number[],
  options: SemanticSearchOptions
): Promise<SemanticSearchResult[]> {
  const sql = getSql()
  const {
    organizationId,
    limit = 50,
    branch,
    suite,
    since,
  } = options

  const vectorStr = toVectorString(queryEmbedding)

  // Auto-detect version based on dimensions
  const isV2 = queryEmbedding.length === 512

  // Build dynamic conditions
  const conditions: string[] = [
    `te.organization_id = ${organizationId}`,
    "tr.status IN ('failed', 'timedout')",
  ]

  if (branch) {
    conditions.push(`te.branch = '${branch.replace(/'/g, "''")}'`)
  }

  if (suite) {
    conditions.push(`te.suite = '${suite.replace(/'/g, "''")}'`)
  }

  if (since) {
    conditions.push(`tr.created_at >= '${since}'`)
  }

  // Use appropriate embedding column - no hard threshold, let reranking handle relevance
  if (isV2) {
    conditions.push("tr.error_embedding_v2 IS NOT NULL")
  } else {
    conditions.push("tr.error_embedding IS NOT NULL")
  }

  const whereClause = conditions.join(" AND ")
  const embeddingColumn = isV2 ? "error_embedding_v2" : "error_embedding"

  // Use tagged template with sql.unsafe for dynamic parts (vector strings must be raw)
  const results = await sql`
    SELECT
      tr.id as test_result_id,
      tr.execution_id,
      tr.test_name,
      tr.test_file,
      tr.test_signature,
      tr.status,
      tr.error_message,
      te.branch,
      te.suite,
      tr.created_at,
      1 - (${sql.unsafe(`tr.${embeddingColumn}`)} <=> ${sql.unsafe(`'${vectorStr}'::vector`)}) as similarity
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE ${sql.unsafe(whereClause)}
    ORDER BY ${sql.unsafe(`tr.${embeddingColumn}`)} <=> ${sql.unsafe(`'${vectorStr}'::vector`)}
    LIMIT ${limit}
  `

  return results.map((r: Record<string, unknown>) => ({
    testResultId: r.test_result_id as number,
    executionId: r.execution_id as number,
    testName: r.test_name as string,
    testFile: r.test_file as string,
    testSignature: r.test_signature as string | null,
    status: r.status as string,
    errorMessage: r.error_message as string | null,
    similarity: r.similarity as number,
    branch: r.branch as string,
    suite: r.suite as string | null,
    createdAt: (r.created_at as Date).toISOString(),
  }))
}

/**
 * Search ALL tests using vector similarity (test_embedding)
 *
 * Uses test_embedding column which includes all tests (passed, failed, skipped).
 * Embedding should be generated with task="retrieval.query" for best results.
 *
 * @param queryEmbedding - Query embedding (512 dimensions)
 * @param options - Search options
 */
export async function searchAllTestsSemantic(
  queryEmbedding: number[],
  options: SemanticSearchOptions
): Promise<SemanticSearchResult[]> {
  const sql = getSql()
  const {
    organizationId,
    limit = 50,
    threshold = 0.85, // Higher threshold = more permissive (cosine distance)
    branch,
    suite,
    since,
    statusFilter = "all",
  } = options

  const vectorStr = toVectorString(queryEmbedding)

  // Build dynamic conditions - no hard threshold, let reranking handle relevance
  const conditions: string[] = [
    `te.organization_id = ${organizationId}`,
    "tr.test_embedding IS NOT NULL",
  ]

  // Status filter
  if (statusFilter === "failed") {
    conditions.push("tr.status IN ('failed', 'timedout')")
  } else if (statusFilter === "passed") {
    conditions.push("tr.status = 'passed'")
  } else if (statusFilter === "skipped") {
    conditions.push("tr.status = 'skipped'")
  }
  // "all" means no status filter

  if (branch) {
    conditions.push(`te.branch = '${branch.replace(/'/g, "''")}'`)
  }

  if (suite) {
    conditions.push(`te.suite = '${suite.replace(/'/g, "''")}'`)
  }

  if (since) {
    conditions.push(`tr.created_at >= '${since}'`)
  }

  const whereClause = conditions.join(" AND ")

  // Use tagged template with sql.unsafe for dynamic parts (vector strings must be raw)
  const results = await sql`
    SELECT
      tr.id as test_result_id,
      tr.execution_id,
      tr.test_name,
      tr.test_file,
      tr.test_signature,
      tr.status,
      tr.error_message,
      te.branch,
      te.suite,
      tr.created_at,
      1 - (tr.test_embedding <=> ${sql.unsafe(`'${vectorStr}'::vector`)}) as similarity
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE ${sql.unsafe(whereClause)}
    ORDER BY tr.test_embedding <=> ${sql.unsafe(`'${vectorStr}'::vector`)}
    LIMIT ${limit}
  `

  return results.map((r: Record<string, unknown>) => ({
    testResultId: r.test_result_id as number,
    executionId: r.execution_id as number,
    testName: r.test_name as string,
    testFile: r.test_file as string,
    testSignature: r.test_signature as string | null,
    status: r.status as string,
    errorMessage: r.error_message as string | null,
    similarity: r.similarity as number,
    branch: r.branch as string,
    suite: r.suite as string | null,
    createdAt: (r.created_at as Date).toISOString(),
  }))
}

/**
 * Search tests by name/file using keyword matching
 *
 * @param query - Search query string
 * @param options - Search options
 */
export async function searchTestsKeyword(
  query: string,
  options: SemanticSearchOptions
): Promise<TestSemanticSearchResult[]> {
  const sql = getSql()
  const {
    organizationId,
    limit = 50,
    branch,
    suite,
    since,
    failedOnly = false,
  } = options

  if (!query || query.length < 2) {
    return []
  }

  const searchPattern = `%${query}%`

  // Build dynamic conditions
  const conditions: string[] = [
    `te.organization_id = ${organizationId}`,
  ]

  if (branch) {
    conditions.push(`te.branch = '${branch.replace(/'/g, "''")}'`)
  }

  if (suite) {
    conditions.push(`te.suite = '${suite.replace(/'/g, "''")}'`)
  }

  if (since) {
    conditions.push(`tr.created_at >= '${since}'`)
  }

  if (failedOnly) {
    conditions.push("tr.status IN ('failed', 'timedout')")
  }

  const whereClause = conditions.join(" AND ")

  const sqlQuery = `
    SELECT
      COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
      tr.test_name,
      tr.test_file,
      COUNT(*) as run_count,
      MAX(tr.started_at) as last_run,
      (
        SELECT status FROM test_results tr2
        JOIN test_executions te2 ON tr2.execution_id = te2.id
        WHERE tr2.test_name = tr.test_name
          AND tr2.test_file = tr.test_file
          AND te2.organization_id = ${organizationId}
        ORDER BY tr2.started_at DESC LIMIT 1
      ) as last_status,
      ROUND(
        COUNT(*) FILTER (WHERE tr.status = 'passed')::decimal
        / NULLIF(COUNT(*), 0) * 100, 1
      ) as pass_rate,
      -- Simple relevance score based on match position
      CASE
        WHEN tr.test_name ILIKE '${query}%' THEN 1.0
        WHEN tr.test_name ILIKE '%${query}%' THEN 0.8
        WHEN tr.test_file ILIKE '${query}%' THEN 0.7
        ELSE 0.5
      END as similarity
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE (tr.test_name ILIKE '${searchPattern.replace(/'/g, "''")}'
       OR tr.test_file ILIKE '${searchPattern.replace(/'/g, "''")}')
      AND ${whereClause}
    GROUP BY tr.test_name, tr.test_file, tr.test_signature
    ORDER BY similarity DESC, run_count DESC
    LIMIT ${limit}
  `

  const results = await sql.unsafe(sqlQuery)

  return results.map((r: Record<string, unknown>) => ({
    testSignature: r.test_signature as string,
    testName: r.test_name as string,
    testFile: r.test_file as string,
    runCount: Number(r.run_count),
    lastRun: (r.last_run as Date)?.toISOString() || "",
    lastStatus: r.last_status as string,
    passRate: Number(r.pass_rate) || 0,
    similarity: Number(r.similarity),
  }))
}

// ============================================
// Hybrid Search
// ============================================

/**
 * Hybrid search combining semantic and keyword results
 *
 * @param queryEmbedding - Query embedding for semantic search
 * @param queryText - Query text for keyword search
 * @param options - Search options
 */
export async function searchHybrid(
  queryEmbedding: number[] | null,
  queryText: string,
  options: SemanticSearchOptions
): Promise<SemanticSearchResult[]> {
  const { mode = "hybrid", statusFilter = "all" } = options

  // Keyword-only mode
  if (mode === "keyword" || !queryEmbedding) {
    const keywordResults = await searchTestsKeyword(queryText, options)
    // Convert to SemanticSearchResult format (limited info)
    return keywordResults.map((r) => ({
      testResultId: 0, // Not available from keyword search
      executionId: 0,
      testName: r.testName,
      testFile: r.testFile,
      testSignature: r.testSignature,
      status: r.lastStatus,
      errorMessage: null,
      similarity: r.similarity,
      branch: "",
      suite: null,
      createdAt: r.lastRun,
    }))
  }

  // Determine which semantic search function to use:
  // - For "failed" status filter: use searchFailuresSemantic (error_embedding_v2) which has actual error messages
  // - For other statuses: use searchAllTestsSemantic (test_embedding) which has test metadata
  const useErrorEmbeddings = statusFilter === "failed"
  const semanticSearchFn = useErrorEmbeddings ? searchFailuresSemantic : searchAllTestsSemantic

  // Semantic-only mode
  if (mode === "semantic") {
    return semanticSearchFn(queryEmbedding, options)
  }

  // Hybrid mode: combine both
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearchFn(queryEmbedding, {
      ...options,
      limit: Math.ceil((options.limit || 50) * 0.7), // 70% semantic
    }),
    searchTestsKeyword(queryText, {
      ...options,
      limit: Math.ceil((options.limit || 50) * 0.3), // 30% keyword
      failedOnly: statusFilter === "failed",
    }),
  ])

  // Merge results, removing duplicates (prefer semantic)
  const seen = new Set<string>()
  const combined: SemanticSearchResult[] = []

  // Add semantic results first (higher priority)
  for (const result of semanticResults) {
    const key = `${result.testName}:${result.testFile}`
    if (!seen.has(key)) {
      seen.add(key)
      combined.push(result)
    }
  }

  // Add keyword results that aren't duplicates
  for (const result of keywordResults) {
    const key = `${result.testName}:${result.testFile}`
    if (!seen.has(key)) {
      seen.add(key)
      combined.push({
        testResultId: 0,
        executionId: 0,
        testName: result.testName,
        testFile: result.testFile,
        testSignature: result.testSignature,
        status: result.lastStatus,
        errorMessage: null,
        similarity: result.similarity * 0.8, // Discount keyword results slightly
        branch: "",
        suite: null,
        createdAt: result.lastRun,
      })
    }
  }

  // Sort by similarity
  combined.sort((a, b) => b.similarity - a.similarity)

  return combined.slice(0, options.limit || 50)
}

// ============================================
// Embedding Stats
// ============================================

/**
 * Get embedding coverage stats for an organization
 */
export async function getEmbeddingCoverage(
  organizationId: number
): Promise<{
  totalFailures: number
  withV1Embedding: number
  withV2Embedding: number
  coverageV1: number
  coverageV2: number
}> {
  const sql = getSql()

  const [result] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE tr.status IN ('failed', 'timedout')) as total_failures,
      COUNT(*) FILTER (WHERE tr.error_embedding IS NOT NULL) as with_v1,
      COUNT(*) FILTER (WHERE tr.error_embedding_v2 IS NOT NULL) as with_v2
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
  `

  const totalFailures = Number(result.total_failures) || 0
  const withV1 = Number(result.with_v1) || 0
  const withV2 = Number(result.with_v2) || 0

  return {
    totalFailures,
    withV1Embedding: withV1,
    withV2Embedding: withV2,
    coverageV1: totalFailures > 0 ? Math.round((withV1 / totalFailures) * 100) : 0,
    coverageV2: totalFailures > 0 ? Math.round((withV2 / totalFailures) * 100) : 0,
  }
}
