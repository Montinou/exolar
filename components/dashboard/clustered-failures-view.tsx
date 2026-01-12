"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Layers,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Settings2
} from "lucide-react"
import { FailureClusterCard, type FailureCluster } from "./failure-cluster-card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

// ============================================
// Types
// ============================================

interface ClusteredFailuresViewProps {
  executionId: number
  onTestClick?: (testResultId: number) => void
  onFindSimilar?: (testResultId: number) => void
}

interface ClusteringStats {
  totalFailures: number
  totalClusters: number
}

interface ClusteringOptions {
  threshold: number
  minSize: number
}

// ============================================
// Clustered Failures View Component
// ============================================

export function ClusteredFailuresView({
  executionId,
  onTestClick,
  onFindSimilar
}: ClusteredFailuresViewProps) {
  const [clusters, setClusters] = useState<FailureCluster[]>([])
  const [stats, setStats] = useState<ClusteringStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [options, setOptions] = useState<ClusteringOptions>({
    threshold: 0.15,
    minSize: 1
  })

  async function loadClusters(refresh = false) {
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      // Invalidate cache if refreshing
      if (refresh) {
        await fetch(`/api/executions/${executionId}/clusters`, {
          method: "DELETE"
        })
      }

      const params = new URLSearchParams({
        threshold: options.threshold.toString(),
        minSize: options.minSize.toString()
      })

      const response = await fetch(`/api/executions/${executionId}/clusters?${params}`)
      if (!response.ok) {
        throw new Error("Failed to load clusters")
      }

      const data = await response.json()
      setClusters(data.clusters || [])
      setStats({
        totalFailures: data.totalFailures,
        totalClusters: data.totalClusters
      })
    } catch (err) {
      console.error("Failed to load clusters:", err)
      setError("Failed to load failure clusters. Make sure embeddings have been generated.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadClusters()
  }, [executionId])

  function handleRefresh() {
    loadClusters(true)
  }

  function handleOptionsChange() {
    loadClusters(true)
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Analyzing failures with AI...</span>
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <p className="text-lg font-medium">Unable to cluster failures</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => loadClusters()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  // No clusters state
  if (clusters.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Layers className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-medium">No failure clusters</p>
        <p className="text-sm">No failures with embeddings found in this execution.</p>
        <p className="text-xs mt-2">
          Run the embedding backfill to enable clustering.
        </p>
      </div>
    )
  }

  // Clusters view
  return (
    <div className="space-y-4">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">AI Clustering</span>
          </div>
          {stats && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {stats.totalFailures} failure{stats.totalFailures !== 1 ? "s" : ""}
              </Badge>
              <span className="text-muted-foreground">&rarr;</span>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                {stats.totalClusters} cluster{stats.totalClusters !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                <Settings2 className="h-4 w-4 mr-1" />
                Options
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="threshold" className="text-xs">
                    Distance Threshold
                  </Label>
                  <Input
                    id="threshold"
                    type="number"
                    step="0.05"
                    min="0.05"
                    max="0.5"
                    value={options.threshold}
                    onChange={(e) => setOptions(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
                    className="h-8"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower = stricter grouping (0.05-0.5)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minSize" className="text-xs">
                    Min Cluster Size
                  </Label>
                  <Input
                    id="minSize"
                    type="number"
                    min="1"
                    max="10"
                    value={options.minSize}
                    onChange={(e) => setOptions(prev => ({ ...prev, minSize: parseInt(e.target.value) }))}
                    className="h-8"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hide clusters smaller than this
                  </p>
                </div>
                <Button size="sm" className="w-full" onClick={handleOptionsChange}>
                  Apply Changes
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Reduction summary */}
      {stats && stats.totalClusters < stats.totalFailures && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
          <p className="text-sm text-purple-500">
            <Sparkles className="h-4 w-4 inline mr-1" />
            AI reduced {stats.totalFailures} failures into {stats.totalClusters} root cause group{stats.totalClusters !== 1 ? "s" : ""}.
            {stats.totalClusters === 1 && " All failures appear to have the same underlying cause."}
          </p>
        </div>
      )}

      {/* Cluster cards */}
      <div className="space-y-4">
        {clusters.map((cluster) => (
          <FailureClusterCard
            key={cluster.clusterId}
            cluster={cluster}
            onTestClick={onTestClick}
            onFindSimilar={onFindSimilar}
          />
        ))}
      </div>
    </div>
  )
}
