"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Sparkles } from "lucide-react"

interface ClusterPreviewBadgeProps {
  executionId: number
  failedCount: number
}

interface ClusterInfo {
  clusterCount: number
  failureCount: number
}

/**
 * Shows a small badge indicating cluster reduction when clicked
 * Only shown for executions with 2+ failures (where clustering is meaningful)
 */
export function ClusterPreviewBadge({ executionId, failedCount }: ClusterPreviewBadgeProps) {
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  // Only show for executions with 2+ failures
  if (failedCount < 2) return null

  const fetchClusterInfo = async () => {
    if (fetched) return
    setLoading(true)
    try {
      const response = await fetch(`/api/executions/${executionId}/clusters?minSize=1&limit=100`)
      if (response.ok) {
        const data = await response.json()
        if (data.clusters) {
          setClusterInfo({
            clusterCount: data.clusters.length,
            failureCount: data.clusters.reduce((sum: number, c: { testCount: number }) => sum + c.testCount, 0)
          })
        }
      }
    } catch {
      // Silent fail - badge just won't show cluster info
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }

  // If we have cluster info and it shows meaningful reduction
  if (clusterInfo && clusterInfo.clusterCount < clusterInfo.failureCount) {
    const reduction = Math.round(((clusterInfo.failureCount - clusterInfo.clusterCount) / clusterInfo.failureCount) * 100)
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 cursor-help">
              <Sparkles className="h-2.5 w-2.5" />
              {clusterInfo.failureCount} → {clusterInfo.clusterCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>AI Clustering: {clusterInfo.failureCount} failures grouped into {clusterInfo.clusterCount} root causes ({reduction}% reduction)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Show a hint badge that fetches on hover
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="text-[10px] px-1.5 py-0 gap-0.5 cursor-help opacity-60 hover:opacity-100 transition-opacity"
            onMouseEnter={fetchClusterInfo}
          >
            <Sparkles className="h-2.5 w-2.5" />
            {loading ? "..." : "AI"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{loading ? "Loading clusters..." : fetched ? "No cluster reduction" : "Hover to load AI clustering"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
