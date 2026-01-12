/**
 * Failure Clustering Algorithm
 *
 * Groups semantically similar failures using vector embeddings.
 * Uses a greedy algorithm with distance thresholding:
 *
 * 1. Start with first failure as centroid of cluster 1
 * 2. For each subsequent failure:
 *    - If similar to existing cluster (distance < threshold), add to it
 *    - Otherwise, create new cluster with this failure as centroid
 * 3. Return clusters sorted by size (largest first)
 */

import { getSql } from "./connection"
import { toVectorString, parseVectorString, cosineSimilarity } from "@/lib/ai"
import type { FailureCluster, ClusterMember, ClusteringOptions } from "@/lib/ai/types"

/**
 * Cluster failures within a single execution
 *
 * @param executionId - The execution to cluster
 * @param options - Clustering configuration
 * @returns Array of failure clusters
 */
export async function clusterFailures(
  executionId: number,
  options: ClusteringOptions = {}
): Promise<FailureCluster[]> {
  const {
    distanceThreshold = 0.15,
    minClusterSize = 1,
    maxClusters = 20,
  } = options

  const sql = getSql()

  // Get all failures with embeddings for this execution
  const failures = await sql`
    SELECT
      id,
      test_name,
      test_file,
      error_message,
      error_embedding::text as embedding
    FROM test_results
    WHERE execution_id = ${executionId}
      AND status IN ('failed', 'timedout')
      AND error_embedding IS NOT NULL
    ORDER BY created_at ASC
  `

  if (failures.length === 0) {
    return []
  }

  // Parse embeddings
  const failuresWithVectors = failures.map((f) => ({
    id: f.id as number,
    testName: f.test_name as string,
    testFile: f.test_file as string,
    errorMessage: f.error_message as string | null,
    embedding: parseVectorString(f.embedding as string),
  }))

  // Greedy clustering
  const clusters: Array<{
    centroid: number[]
    members: typeof failuresWithVectors
  }> = []

  for (const failure of failuresWithVectors) {
    let assigned = false

    // Try to assign to existing cluster
    for (const cluster of clusters) {
      const similarity = cosineSimilarity(failure.embedding, cluster.centroid)
      const distance = 1 - similarity

      if (distance < distanceThreshold) {
        cluster.members.push(failure)
        // Update centroid (average of all members)
        cluster.centroid = averageVectors(
          cluster.members.map((m) => m.embedding)
        )
        assigned = true
        break
      }
    }

    // Create new cluster if not assigned
    if (!assigned) {
      clusters.push({
        centroid: failure.embedding,
        members: [failure],
      })
    }
  }

  // Convert to output format
  const result: FailureCluster[] = clusters
    .filter((c) => c.members.length >= minClusterSize)
    .sort((a, b) => b.members.length - a.members.length) // Largest first
    .slice(0, maxClusters)
    .map((cluster, index) => {
      // Find the member closest to centroid (most representative)
      let closestMember = cluster.members[0]
      let minDistance = Infinity

      for (const member of cluster.members) {
        const distance = 1 - cosineSimilarity(member.embedding, cluster.centroid)
        if (distance < minDistance) {
          minDistance = distance
          closestMember = member
        }
      }

      return {
        clusterId: index + 1,
        representativeError: closestMember.errorMessage || closestMember.testName,
        testCount: cluster.members.length,
        centroidEmbedding: cluster.centroid,
        tests: cluster.members.map((m) => ({
          testResultId: m.id,
          testName: m.testName,
          testFile: m.testFile,
          errorMessage: m.errorMessage,
          distanceToCentroid: 1 - cosineSimilarity(m.embedding, cluster.centroid),
          isRepresentative: m.id === closestMember.id,
        })),
      }
    })

  return result
}

/**
 * Calculate average of multiple vectors
 */
function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return []

  const dims = vectors[0].length
  const result = new Array(dims).fill(0)

  for (const vec of vectors) {
    for (let i = 0; i < dims; i++) {
      result[i] += vec[i]
    }
  }

  for (let i = 0; i < dims; i++) {
    result[i] /= vectors.length
  }

  return result
}

/**
 * Get cluster summary statistics
 */
export async function getClusterStats(
  executionId: number
): Promise<{
  totalFailures: number
  totalClusters: number
  largestCluster: number
  clusterSizeDistribution: Record<string, number>
}> {
  const clusters = await clusterFailures(executionId)

  const sizes = clusters.map((c) => c.testCount)
  const distribution: Record<string, number> = {
    "1": 0,
    "2-5": 0,
    "6-10": 0,
    "11-20": 0,
    "20+": 0,
  }

  for (const size of sizes) {
    if (size === 1) distribution["1"]++
    else if (size <= 5) distribution["2-5"]++
    else if (size <= 10) distribution["6-10"]++
    else if (size <= 20) distribution["11-20"]++
    else distribution["20+"]++
  }

  return {
    totalFailures: sizes.reduce((a, b) => a + b, 0),
    totalClusters: clusters.length,
    largestCluster: Math.max(...sizes, 0),
    clusterSizeDistribution: distribution,
  }
}

/**
 * Find historical clusters similar to a given error
 *
 * Searches across all executions in an organization to find
 * similar failures from the past.
 */
export async function findHistoricalClusters(
  embedding: number[],
  organizationId: number,
  options: {
    threshold?: number
    limit?: number
    daysBack?: number
  } = {}
): Promise<
  Array<{
    executionId: number
    testResultId: number
    testName: string
    errorMessage: string | null
    similarity: number
    createdAt: Date
    branch: string
  }>
> {
  const { threshold = 0.15, limit = 10, daysBack = 30 } = options

  const sql = getSql()
  const vectorStr = toVectorString(embedding)
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  const results = await sql`
    SELECT
      tr.id as test_result_id,
      tr.execution_id,
      tr.test_name,
      tr.error_message,
      tr.created_at,
      te.branch,
      1 - (tr.error_embedding <=> ${vectorStr}::vector) as similarity
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.status IN ('failed', 'timedout')
      AND tr.error_embedding IS NOT NULL
      AND tr.created_at >= ${since.toISOString()}
      AND tr.error_embedding <=> ${vectorStr}::vector < ${threshold}
    ORDER BY tr.error_embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `

  return results.map((r) => ({
    executionId: r.execution_id as number,
    testResultId: r.test_result_id as number,
    testName: r.test_name as string,
    errorMessage: r.error_message as string | null,
    similarity: r.similarity as number,
    createdAt: new Date(r.created_at as string),
    branch: r.branch as string,
  }))
}
