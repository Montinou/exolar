/**
 * Cluster Cache Management
 *
 * Caches computed clusters in the database for instant dashboard loading.
 * Clusters are computed once and stored, then invalidated when:
 * - New failures are added to the execution
 * - Embeddings are regenerated
 *
 * Supports dual embedding versions:
 * - v2: Jina 512-dim centroids (centroid_embedding_v2)
 * - v1: Gemini 768-dim centroids (centroid_embedding)
 */

import { getSql } from "./connection"
import { clusterFailures, type ClusteringOptionsV2 } from "./clustering"
import type { FailureCluster, ClusteringOptions, EmbeddingVersion } from "@/lib/ai/types"
import { toVectorString } from "@/lib/ai"

/**
 * Get cached clusters for an execution, computing if not cached
 *
 * Returns clusters with the best available centroid (prefers v2)
 */
export async function getCachedClusters(
  executionId: number,
  options: ClusteringOptionsV2 = {}
): Promise<FailureCluster[]> {
  const sql = getSql()

  // Check cache - load both v1 and v2 centroids, prefer v2
  const cached = await sql`
    SELECT
      fc.id,
      fc.cluster_index,
      fc.representative_error,
      fc.test_count,
      fc.centroid_embedding::text as centroid_v1,
      fc.centroid_embedding_v2::text as centroid_v2,
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

      // Prefer v2 centroid if available, fall back to v1
      const centroidStr = (row.centroid_v2 || row.centroid_v1) as string | null

      clusters.push({
        clusterId: row.cluster_index as number,
        representativeError: row.representative_error as string,
        testCount: row.test_count as number,
        centroidEmbedding: centroidStr ? parseVectorFromDb(centroidStr) : undefined,
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
  const embeddingVersion = (clusters as { embeddingVersion?: EmbeddingVersion }).embeddingVersion

  if (clusters.length > 0) {
    await cacheClusterResults(executionId, clusters, embeddingVersion)
  }

  return clusters
}

/**
 * Store cluster results in cache
 *
 * Stores centroid in the appropriate column based on embedding version:
 * - v2: centroid_embedding_v2 (512-dim Jina)
 * - v1: centroid_embedding (768-dim Gemini)
 */
async function cacheClusterResults(
  executionId: number,
  clusters: FailureCluster[],
  embeddingVersion?: EmbeddingVersion
): Promise<void> {
  const sql = getSql()

  // Clear existing cache for this execution
  await sql`
    DELETE FROM failure_clusters
    WHERE execution_id = ${executionId}
  `

  // Insert clusters with appropriate centroid column
  for (const cluster of clusters) {
    const vectorStr = cluster.centroidEmbedding
      ? toVectorString(cluster.centroidEmbedding)
      : null

    // Store in appropriate column based on version
    const isV2 = embeddingVersion === "v2" ||
      (cluster.centroidEmbedding && cluster.centroidEmbedding.length === 512)

    const [inserted] = isV2
      ? await sql`
          INSERT INTO failure_clusters (
            execution_id,
            cluster_index,
            representative_error,
            test_count,
            centroid_embedding_v2
          ) VALUES (
            ${executionId},
            ${cluster.clusterId},
            ${cluster.representativeError},
            ${cluster.testCount},
            ${vectorStr}::vector
          )
          RETURNING id
        `
      : await sql`
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
