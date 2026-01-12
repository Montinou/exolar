"use client"

import { useEffect, useState } from "react"
import { Brain, Sparkles, Target, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AiInsightsData {
  embeddingCoverage: number
  totalFailures: number
  withEmbeddings: number
  lastClusterReduction?: number
  recentClusters?: number
  recentFailures?: number
}

export function AiInsightsCard() {
  const [data, setData] = useState<AiInsightsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/ai-insights")
        if (!response.ok) throw new Error("Failed to fetch AI insights")
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="glass-card glass-card-glow p-6 animate-pulse">
        <div className="h-[180px] bg-muted/30 rounded" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Brain className="h-5 w-5" />
          <span className="text-sm">AI Insights unavailable</span>
        </div>
      </div>
    )
  }

  const coverageColor =
    data.embeddingCoverage >= 80
      ? "text-green-500"
      : data.embeddingCoverage >= 50
        ? "text-yellow-500"
        : "text-orange-500"

  return (
    <TooltipProvider>
      <div className="glass-card glass-card-glow p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold">AI Insights</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Vector Search
          </Badge>
        </div>

        {/* Embedding Coverage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Embedding Coverage</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`font-semibold ${coverageColor}`}>
                  {data.embeddingCoverage.toFixed(0)}%
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{data.withEmbeddings} of {data.totalFailures} failures indexed</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Progress value={data.embeddingCoverage} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="h-3 w-3" />
              Indexed Failures
            </div>
            <p className="text-lg font-semibold">{data.withEmbeddings.toLocaleString()}</p>
          </div>

          {data.lastClusterReduction !== undefined && data.lastClusterReduction > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Cluster Reduction
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-lg font-semibold text-cyan-400">
                    {data.lastClusterReduction.toFixed(0)}%
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{data.recentFailures} failures → {data.recentClusters} clusters</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Semantic Search Hint */}
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            Use the search bar with{" "}
            <Badge variant="outline" className="text-[10px] px-1 py-0 mx-0.5">AI</Badge>
            mode for semantic search
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}
