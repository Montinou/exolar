import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { countTestsWithEmbeddings, getClusterCacheStats } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get embedding coverage stats
    const stats = await countTestsWithEmbeddings(context.organizationId)
    const embeddingCoverage = stats.total > 0 
      ? (stats.withEmbeddingV2 / stats.total) * 100 
      : 0

    // Get cluster cache stats filtered by org (RLS safety)
    let clusterStats = { cachedExecutions: 0, totalClusters: 0, totalMembers: 0 }
    try {
      clusterStats = await getClusterCacheStats(context.organizationId)
    } catch {
      // Cluster stats are optional
    }

    // Calculate cluster reduction if we have data
    const lastClusterReduction = clusterStats.totalMembers > 0 && clusterStats.totalClusters > 0
      ? ((clusterStats.totalMembers - clusterStats.totalClusters) / clusterStats.totalMembers) * 100
      : 0

    return NextResponse.json({
      embeddingCoverage,
      totalFailures: stats.total,
      withEmbeddings: stats.withEmbeddingV2 || stats.withEmbedding,
      lastClusterReduction,
      recentClusters: clusterStats.totalClusters,
      recentFailures: clusterStats.totalMembers,
      cachedExecutions: clusterStats.cachedExecutions,
    })
  } catch (error) {
    console.error("AI insights error:", error)
    return NextResponse.json(
      { error: "Failed to fetch AI insights" },
      { status: 500 }
    )
  }
}

