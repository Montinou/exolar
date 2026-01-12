# Phase 3: Clustering Backend

> **Goal:** Implement failure clustering algorithm and API
> **Value Delivered:** API returns grouped failures by semantic similarity
> **Dependencies:** Phase 2 (embeddings in database)
> **Estimated Steps:** 5

---

## Overview

This phase implements the clustering logic:
1. Create clustering algorithm (distance-threshold based)
2. Add cluster caching for performance
3. Create API endpoint for clustered failures
4. Add cluster statistics

---

## Steps

### Step 3.1: Create Clustering Algorithm

**File:** `lib/db/clustering.ts`

```typescript
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
```

**Verification:**
- [ ] File created at `lib/db/clustering.ts`
- [ ] Greedy clustering algorithm implemented
- [ ] Distance threshold is configurable

---

### Step 3.2: Add Cluster Caching

**File:** `lib/db/cluster-cache.ts`

```typescript
/**
 * Cluster Cache Management
 *
 * Stores pre-computed clusters for faster dashboard loading.
 * Clusters are cached after first computation and invalidated
 * when new results are added.
 */

import { getSql } from "./connection"
import { toVectorString } from "@/lib/ai"
import type { FailureCluster } from "@/lib/ai/types"
import { clusterFailures } from "./clustering"

/**
 * Get cached clusters for an execution
 *
 * @returns Cached clusters or null if not cached
 */
export async function getCachedClusters(
  executionId: number
): Promise<FailureCluster[] | null> {
  const sql = getSql()

  const clusters = await sql`
    SELECT
      fc.id,
      fc.cluster_id,
      fc.representative_error,
      fc.test_count,
      fc.centroid_embedding::text as centroid
    FROM failure_clusters fc
    WHERE fc.execution_id = ${executionId}
    ORDER BY fc.test_count DESC
  `

  if (clusters.length === 0) {
    return null
  }

  // Get cluster members
  const clusterIds = clusters.map((c) => c.id)
  const members = await sql`
    SELECT
      fcm.cluster_id,
      fcm.test_result_id,
      fcm.distance_to_centroid,
      tr.test_name,
      tr.test_file,
      tr.error_message
    FROM failure_cluster_members fcm
    INNER JOIN test_results tr ON fcm.test_result_id = tr.id
    WHERE fcm.cluster_id = ANY(${clusterIds})
    ORDER BY fcm.distance_to_centroid ASC
  `

  // Group members by cluster
  const membersByCluster = new Map<number, typeof members>()
  for (const member of members) {
    const clusterId = member.cluster_id as number
    if (!membersByCluster.has(clusterId)) {
      membersByCluster.set(clusterId, [])
    }
    membersByCluster.get(clusterId)!.push(member)
  }

  // Build result
  return clusters.map((c) => {
    const clusterMembers = membersByCluster.get(c.id as number) || []
    return {
      clusterId: c.cluster_id as number,
      representativeError: c.representative_error as string,
      testCount: c.test_count as number,
      tests: clusterMembers.map((m, idx) => ({
        testResultId: m.test_result_id as number,
        testName: m.test_name as string,
        testFile: m.test_file as string,
        errorMessage: m.error_message as string | null,
        distanceToCentroid: m.distance_to_centroid as number,
        isRepresentative: idx === 0, // First member is closest to centroid
      })),
    }
  })
}

/**
 * Cache clusters for an execution
 */
export async function cacheClusters(
  executionId: number,
  clusters: FailureCluster[]
): Promise<void> {
  const sql = getSql()

  // Clear existing cache
  await sql`
    DELETE FROM failure_clusters
    WHERE execution_id = ${executionId}
  `

  if (clusters.length === 0) return

  // Insert clusters
  for (const cluster of clusters) {
    const centroidStr = cluster.centroidEmbedding
      ? toVectorString(cluster.centroidEmbedding)
      : null

    const [inserted] = await sql`
      INSERT INTO failure_clusters (
        execution_id,
        cluster_id,
        representative_error,
        test_count,
        centroid_embedding
      ) VALUES (
        ${executionId},
        ${cluster.clusterId},
        ${cluster.representativeError},
        ${cluster.testCount},
        ${centroidStr ? sql`${centroidStr}::vector` : sql`NULL`}
      )
      RETURNING id
    `

    // Insert members
    if (cluster.tests.length > 0) {
      const values = cluster.tests.map((t) => ({
        cluster_id: inserted.id,
        test_result_id: t.testResultId,
        distance_to_centroid: t.distanceToCentroid,
      }))

      for (const v of values) {
        await sql`
          INSERT INTO failure_cluster_members (
            cluster_id,
            test_result_id,
            distance_to_centroid
          ) VALUES (
            ${v.cluster_id},
            ${v.test_result_id},
            ${v.distance_to_centroid}
          )
          ON CONFLICT (test_result_id) DO UPDATE SET
            cluster_id = EXCLUDED.cluster_id,
            distance_to_centroid = EXCLUDED.distance_to_centroid
        `
      }
    }
  }
}

/**
 * Get or compute clusters (with caching)
 *
 * Checks cache first, computes and caches if not found.
 */
export async function getOrComputeClusters(
  executionId: number,
  options: { forceRefresh?: boolean } = {}
): Promise<FailureCluster[]> {
  const { forceRefresh = false } = options

  // Check cache first
  if (!forceRefresh) {
    const cached = await getCachedClusters(executionId)
    if (cached !== null) {
      return cached
    }
  }

  // Compute clusters
  const clusters = await clusterFailures(executionId)

  // Cache results (async, don't wait)
  cacheClusters(executionId, clusters).catch((err) => {
    console.error(`Failed to cache clusters for execution ${executionId}:`, err)
  })

  return clusters
}

/**
 * Invalidate cluster cache for an execution
 *
 * Call this when new test results are added.
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
```

**Verification:**
- [ ] File created at `lib/db/cluster-cache.ts`
- [ ] Cache get/set/invalidate functions
- [ ] Uses database tables from Phase 0

---

### Step 3.3: Create API Endpoint

**File:** `app/api/executions/[id]/clusters/route.ts`

```typescript
/**
 * API: Get clustered failures for an execution
 *
 * GET /api/executions/{id}/clusters
 *
 * Returns failures grouped by semantic similarity.
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getOrComputeClusters, getClusterStats } from "@/lib/db/clustering"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const executionId = parseInt(id, 10)

    if (isNaN(executionId)) {
      return NextResponse.json(
        { error: "Invalid execution ID" },
        { status: 400 }
      )
    }

    // Verify execution belongs to user's organization
    const db = getQueriesForOrg(context.organizationId)
    const execution = await db.getExecutionById(executionId)

    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      )
    }

    // Parse query params
    const url = new URL(request.url)
    const refresh = url.searchParams.get("refresh") === "true"
    const includeStats = url.searchParams.get("stats") === "true"

    // Get clusters
    const clusters = await getOrComputeClusters(executionId, {
      forceRefresh: refresh,
    })

    // Optionally include stats
    let stats = null
    if (includeStats) {
      stats = await getClusterStats(executionId)
    }

    return NextResponse.json({
      executionId,
      clusters,
      stats,
      metadata: {
        totalClusters: clusters.length,
        totalFailures: clusters.reduce((sum, c) => sum + c.testCount, 0),
        generated: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Clusters API error:", error)
    return NextResponse.json(
      { error: "Failed to get clusters" },
      { status: 500 }
    )
  }
}
```

**Verification:**
- [ ] File created at `app/api/executions/[id]/clusters/route.ts`
- [ ] Returns clustered failures
- [ ] Respects organization access

---

### Step 3.4: Add Historical Similar Failures Endpoint

**File:** `app/api/failures/[id]/similar/route.ts`

```typescript
/**
 * API: Find similar failures to a specific test result
 *
 * GET /api/failures/{id}/similar
 *
 * Returns historical failures with similar error patterns.
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getEmbedding } from "@/lib/db/embeddings"
import { findHistoricalClusters } from "@/lib/db/clustering"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const testResultId = parseInt(id, 10)

    if (isNaN(testResultId)) {
      return NextResponse.json(
        { error: "Invalid test result ID" },
        { status: 400 }
      )
    }

    // Get the embedding for this failure
    const embedding = await getEmbedding(testResultId)

    if (!embedding) {
      return NextResponse.json(
        { error: "No embedding found for this failure. It may not have been processed yet." },
        { status: 404 }
      )
    }

    // Parse query params
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50)
    const daysBack = Math.min(parseInt(url.searchParams.get("days") || "30"), 90)

    // Find similar failures
    const similar = await findHistoricalClusters(
      embedding,
      context.organizationId,
      { limit, daysBack }
    )

    // Filter out the source failure
    const filtered = similar.filter((s) => s.testResultId !== testResultId)

    return NextResponse.json({
      sourceId: testResultId,
      similar: filtered,
      metadata: {
        count: filtered.length,
        daysSearched: daysBack,
      },
    })
  } catch (error) {
    console.error("Similar failures API error:", error)
    return NextResponse.json(
      { error: "Failed to find similar failures" },
      { status: 500 }
    )
  }
}
```

**Verification:**
- [ ] File created at `app/api/failures/[id]/similar/route.ts`
- [ ] Finds historical similar failures
- [ ] Configurable time range and limit

---

### Step 3.5: Update Database Exports

**Modify:** `lib/db/index.ts`

```typescript
// Add clustering exports
export * from "./clustering"
export * from "./cluster-cache"

// Update getQueriesForOrg
import { clusterFailures, getClusterStats, findHistoricalClusters } from "./clustering"
import { getOrComputeClusters, invalidateClusterCache } from "./cluster-cache"

export function getQueriesForOrg(organizationId: number) {
  return {
    // ... existing functions ...

    // Clustering functions
    clusterFailures: (executionId: number, options?: ClusteringOptions) =>
      clusterFailures(executionId, options),
    getClusterStats: (executionId: number) =>
      getClusterStats(executionId),
    getOrComputeClusters: (executionId: number, options?: { forceRefresh?: boolean }) =>
      getOrComputeClusters(executionId, options),
    invalidateClusterCache: (executionId: number) =>
      invalidateClusterCache(executionId),
    findHistoricalClusters: (embedding: number[], options?: { threshold?: number; limit?: number; daysBack?: number }) =>
      findHistoricalClusters(embedding, organizationId, options),
  }
}
```

**Verification:**
- [ ] Clustering exports added to `lib/db/index.ts`
- [ ] Functions available via `getQueriesForOrg()`

---

## Deliverables

| Item | Location | Status |
|------|----------|--------|
| Clustering algorithm | `lib/db/clustering.ts` | ⬜ |
| Cluster caching | `lib/db/cluster-cache.ts` | ⬜ |
| Clusters API | `app/api/executions/[id]/clusters/route.ts` | ⬜ |
| Similar failures API | `app/api/failures/[id]/similar/route.ts` | ⬜ |
| DB index updates | `lib/db/index.ts` | ⬜ |

---

## Testing

**1. Test Clustering API:**

```bash
# Get clusters for an execution
curl http://localhost:3000/api/executions/123/clusters

# With stats
curl "http://localhost:3000/api/executions/123/clusters?stats=true"

# Force refresh cache
curl "http://localhost:3000/api/executions/123/clusters?refresh=true"
```

**Expected Response:**
```json
{
  "executionId": 123,
  "clusters": [
    {
      "clusterId": 1,
      "representativeError": "TimeoutError: Navigation timeout exceeded",
      "testCount": 15,
      "tests": [
        {
          "testResultId": 456,
          "testName": "Login test",
          "testFile": "auth.spec.ts",
          "errorMessage": "TimeoutError: Navigation timeout exceeded",
          "distanceToCentroid": 0.02,
          "isRepresentative": true
        }
      ]
    }
  ],
  "metadata": {
    "totalClusters": 5,
    "totalFailures": 45,
    "generated": "2026-01-12T10:30:00Z"
  }
}
```

**2. Test Similar Failures:**

```bash
# Find failures similar to a specific test result
curl http://localhost:3000/api/failures/456/similar

# With options
curl "http://localhost:3000/api/failures/456/similar?limit=5&days=7"
```

---

## Next Phase

After completing Phase 3, proceed to [Phase 4: Clustering UI](./phase-4-clustering-ui.md) to add the smart grouping toggle and cluster visualization.
