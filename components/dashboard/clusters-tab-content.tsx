"use client"

import { useEffect, useState, useCallback } from "react"
import { ClusterDistributionChart } from "./charts/cluster-distribution-chart"
import { AlertTriangle, Loader2, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface TopCluster {
  representativeError: string
  testCount: number
  executionCount: number
}

interface DistributionData {
  totalClusters: number
  totalFailures: number
  totalExecutions: number
  topClusters: TopCluster[]
}

export function ClustersTabContent() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<DistributionData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/clusters/distribution?days=${days}`)
      const json = await response.json()
      setData(json)
    } catch (error) {
      console.error("Failed to fetch cluster data:", error)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDaysChange = (newDays: number) => {
    setDays(newDays)
  }

  // Truncate error message for display
  function truncateError(error: string, maxLength: number = 100): string {
    if (error.length <= maxLength) return error
    return error.slice(0, maxLength) + "..."
  }

  return (
    <div className="space-y-6">
      {/* Distribution Chart - shares days filter */}
      <ClusterDistributionChart
        days={days}
        onDaysChange={handleDaysChange}
        showFilter={true}
      />

      {/* Top Recurring Error Patterns */}
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-[var(--status-warning)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Top Recurring Error Patterns
          </h3>
        </div>

        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.topClusters.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recurring patterns found</p>
              <p className="text-xs">No data for selected time range</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {data.topClusters.map((cluster, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-background/50 border border-border/50 hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-foreground/90 break-words">
                      {truncateError(cluster.representativeError)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="destructive" className="text-xs">
                      {cluster.testCount} failures
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      in {cluster.executionCount} run{cluster.executionCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
