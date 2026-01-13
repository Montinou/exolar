import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getSql } from "@/lib/db/connection"

export const dynamic = "force-dynamic"

interface ClusterDistribution {
  label: string
  count: number
  order: number
}

interface TopCluster {
  representativeError: string
  testCount: number
  executionCount: number
}

interface DistributionResponse {
  totalClusters: number
  totalFailures: number
  totalExecutions: number
  distribution: ClusterDistribution[]
  topClusters: TopCluster[]
}

export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30", 10)

    const sql = getSql()
    const { organizationId } = context

    // Calculate date threshold
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)

    // Get cluster size distribution
    const distributionResult = await sql`
      SELECT
        CASE
          WHEN fc.test_count = 1 THEN '1 failure'
          WHEN fc.test_count BETWEEN 2 AND 5 THEN '2-5 failures'
          WHEN fc.test_count BETWEEN 6 AND 10 THEN '6-10 failures'
          WHEN fc.test_count BETWEEN 11 AND 20 THEN '11-20 failures'
          ELSE '20+ failures'
        END as label,
        COUNT(*) as count,
        CASE
          WHEN fc.test_count = 1 THEN 1
          WHEN fc.test_count BETWEEN 2 AND 5 THEN 2
          WHEN fc.test_count BETWEEN 6 AND 10 THEN 3
          WHEN fc.test_count BETWEEN 11 AND 20 THEN 4
          ELSE 5
        END as bucket_order
      FROM failure_clusters fc
      INNER JOIN test_executions te ON fc.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND te.created_at >= ${dateThreshold.toISOString()}
      GROUP BY label, bucket_order
      ORDER BY bucket_order ASC
    `

    // Get totals
    const [totals] = await sql`
      SELECT
        COUNT(DISTINCT fc.id) as total_clusters,
        COALESCE(SUM(fc.test_count), 0) as total_failures,
        COUNT(DISTINCT fc.execution_id) as total_executions
      FROM failure_clusters fc
      INNER JOIN test_executions te ON fc.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND te.created_at >= ${dateThreshold.toISOString()}
    `

    // Get top recurring error patterns (by total test count across executions)
    const topClustersResult = await sql`
      SELECT
        fc.representative_error,
        SUM(fc.test_count) as total_test_count,
        COUNT(DISTINCT fc.execution_id) as execution_count
      FROM failure_clusters fc
      INNER JOIN test_executions te ON fc.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND te.created_at >= ${dateThreshold.toISOString()}
        AND fc.representative_error IS NOT NULL
      GROUP BY fc.representative_error
      ORDER BY total_test_count DESC
      LIMIT 10
    `

    const distribution: ClusterDistribution[] = distributionResult.map((row) => ({
      label: row.label as string,
      count: Number(row.count),
      order: Number(row.bucket_order),
    }))

    const topClusters: TopCluster[] = topClustersResult.map((row) => ({
      representativeError: row.representative_error as string,
      testCount: Number(row.total_test_count),
      executionCount: Number(row.execution_count),
    }))

    const response: DistributionResponse = {
      totalClusters: Number(totals?.total_clusters || 0),
      totalFailures: Number(totals?.total_failures || 0),
      totalExecutions: Number(totals?.total_executions || 0),
      distribution,
      topClusters,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to fetch cluster distribution:", error)
    return NextResponse.json(
      { error: "Failed to fetch cluster distribution" },
      { status: 500 }
    )
  }
}
