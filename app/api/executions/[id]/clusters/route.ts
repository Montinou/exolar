/**
 * API: Get clustered failures for an execution
 *
 * GET /api/executions/[id]/clusters
 *
 * Returns failures grouped by semantic similarity.
 * Uses cached results when available.
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getExecutionById } from "@/lib/db"
import { getCachedClusters, getClusterCacheStats, isClustered } from "@/lib/db/cluster-cache"
import { getClusterStats } from "@/lib/db/clustering"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json(
        { error: "Authentication required" },
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

    // Verify execution exists and belongs to user's org
    const execution = await getExecutionById(context.organizationId, executionId)
    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      )
    }

    // Parse query params
    const url = new URL(request.url)
    const statsOnly = url.searchParams.get("stats") === "true"
    const threshold = parseFloat(url.searchParams.get("threshold") || "0.15")
    const minClusterSize = parseInt(url.searchParams.get("minSize") || "1", 10)

    // Stats-only mode
    if (statsOnly) {
      const stats = await getClusterStats(executionId)
      const cached = await isClustered(executionId)

      return NextResponse.json({
        executionId,
        isCached: cached,
        ...stats,
      })
    }

    // Get clusters (from cache or compute)
    const clusters = await getCachedClusters(executionId, {
      distanceThreshold: threshold,
      minClusterSize,
    })

    return NextResponse.json({
      executionId,
      totalClusters: clusters.length,
      totalFailures: clusters.reduce((sum, c) => sum + c.testCount, 0),
      clusters: clusters.map((c) => ({
        clusterId: c.clusterId,
        representativeError: c.representativeError,
        testCount: c.testCount,
        tests: c.tests.map((t) => ({
          testResultId: t.testResultId,
          testName: t.testName,
          testFile: t.testFile,
          errorMessage: t.errorMessage,
          distanceToCentroid: t.distanceToCentroid,
          isRepresentative: t.isRepresentative,
        })),
      })),
    })
  } catch (error) {
    console.error("Get clusters error:", error)
    return NextResponse.json(
      { error: "Failed to get clusters" },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Invalidate cluster cache for re-computation
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json(
        { error: "Authentication required" },
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

    // Verify execution exists and belongs to user's org
    const execution = await getExecutionById(context.organizationId, executionId)
    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      )
    }

    // Invalidate cache
    const { invalidateClusterCache } = await import("@/lib/db/cluster-cache")
    await invalidateClusterCache(executionId)

    return NextResponse.json({
      message: "Cluster cache invalidated",
      executionId,
    })
  } catch (error) {
    console.error("Invalidate clusters error:", error)
    return NextResponse.json(
      { error: "Failed to invalidate clusters" },
      { status: 500 }
    )
  }
}
