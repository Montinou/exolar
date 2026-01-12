/**
 * Cluster Cache Management
 *
 * Caches computed clusters in the database for instant dashboard loading.
 * Clusters are computed once and stored, then invalidated when:
 * - New failures are added to the execution
 * - Embeddings are regenerated
 */

import { getSql } from "./connection"
import { clusterFailures } from "./clustering"
import type { FailureCluster, ClusteringOptions } from "@/lib/ai/types"
import { toVectorString } from "@/lib/ai"

/**
 * Get cached clusters for an execution, computing if not cached
 */
export async function getCachedClusters(
  executionId: number,
  options: ClusteringOptions = {}
): Promise<FailureCluster[]> {
  const sql = getSql()

  // Check cache
  const cached = await sql`
    SELECT
      fc.id,
      fc.cluster_index,
      fc.representative_error,
      fc.test_count,
      fc.centroid_embedding::text as centroid,
      fc.created_at
    FROM failure_clusters fc
    WHERE fc.execution_id = ${executionId}
    ORDER BY fc.cluster_index ASC
  `

  if (cached.length > 0) {
    // Load cluster members
    const clusters: FailureCluster[] = []

    for (const row of cached) {
      const members = await sql`
        SELECT
          fcm.test_result_id,
          fcm.distance_to_centroid,
          fcm.is_representative,
          tr.test_name,
          tr.test_file,
          tr.error_message
        FROM failure_cluster_members fcm
        INNER JOIN test_results tr ON fcm.test_result_id = tr.id
        WHERE fcm.cluster_id = ${row.id}
        ORDER BY fcm.distance_to_centroid ASC
      `

      clusters.push({
        clusterId: row.cluster_index as number,
        representativeError: row.representative_error as string,
        testCount: row.test_count as number,
        centroidEmbedding: parseVectorFromDb(row.centroid as string),
        tests: members.map((m) => ({
          testResultId: m.test_result_id as number,
          testName: m.test_name as string,
          testFile: m.test_file as string,
          errorMessage: m.error_message as string | null,
          distanceToCentroid: m.distance_to_centroid as number,
          isRepresentative: m.is_representative as boolean,
        })),
      })
    }

    return clusters
  }

  // Not cached, compute and cache
  const clusters = await clusterFailures(executionId, options)

  if (clusters.length > 0) {
    await cacheClusterResults(executionId, clusters)
  }

  return clusters
}

/**
 * Store cluster results in cache
 */
async function cacheClusterResults(
  executionId: number,
  clusters: FailureCluster[]
): Promise<void> {
  const sql = getSql()

  // Clear existing cache for this execution
  await sql`
    DELETE FROM failure_clusters
    WHERE execution_id = ${executionId}
  `

  // Insert clusters
  for (const cluster of clusters) {
    const vectorStr = toVectorString(cluster.centroidEmbedding)

    const [inserted] = await sql`
      INSERT INTO failure_clusters (
        execution_id,
        cluster_index,
        representative_error,
        test_count,
        centroid_embedding
      ) VALUES (
        ${executionId},
        ${cluster.clusterId},
        ${cluster.representativeError},
        ${cluster.testCount},
        ${vectorStr}::vector
      )
      RETURNING id
    `

    // Insert members
    for (const test of cluster.tests) {
      await sql`
        INSERT INTO failure_cluster_members (
          cluster_id,
          test_result_id,
          distance_to_centroid,
          is_representative
        ) VALUES (
          ${inserted.id},
          ${test.testResultId},
          ${test.distanceToCentroid},
          ${test.isRepresentative}
        )
      `
    }
  }
}

/**
 * Invalidate cached clusters for an execution
 *
 * Call this when:
 * - New test results are added
 * - Embeddings are regenerated
 */
export async function invalidateClusterCache(
  executionId: number
): Promise<void> {
  const sql = getSql()

  await sql`
    DELETE FROM failure_clusters
    WHERE execution_id = ${executionId}
  `
}

/**
 * Check if clusters are cached for an execution
 */
export async function isClustered(executionId: number): Promise<boolean> {
  const sql = getSql()

  const [result] = await sql`
    SELECT EXISTS(
      SELECT 1 FROM failure_clusters
      WHERE execution_id = ${executionId}
    ) as is_cached
  `

  return result?.is_cached as boolean
}

/**
 * Get cache statistics
 */
export async function getClusterCacheStats(): Promise<{
  cachedExecutions: number
  totalClusters: number
  totalMembers: number
}> {
  const sql = getSql()

  const [stats] = await sql`
    SELECT
      COUNT(DISTINCT execution_id) as cached_executions,
      COUNT(*) as total_clusters,
      COALESCE(SUM(test_count), 0) as total_members
    FROM failure_clusters
  `

  return {
    cachedExecutions: Number(stats?.cached_executions || 0),
    totalClusters: Number(stats?.total_clusters || 0),
    totalMembers: Number(stats?.total_members || 0),
  }
}

/**
 * Parse vector string from database
 */
function parseVectorFromDb(vectorStr: string): number[] {
  if (!vectorStr) return []

  // Format: [0.1,0.2,0.3,...] or (0.1,0.2,0.3,...)
  const cleaned = vectorStr.replace(/[\[\]()]/g, "")
  return cleaned.split(",").map(Number)
}
