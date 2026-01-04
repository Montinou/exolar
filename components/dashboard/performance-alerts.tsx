"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { PerformanceRegressionSummary, PerformanceRegression } from "@/lib/types"

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function TrendIndicator({ trend }: { trend: string }) {
  switch (trend) {
    case "increasing":
      return <TrendingUp className="w-3 h-3 text-red-500" />
    case "decreasing":
      return <TrendingDown className="w-3 h-3 text-green-500" />
    default:
      return <Minus className="w-3 h-3 text-muted-foreground" />
  }
}

function RegressionRow({ regression }: { regression: PerformanceRegression }) {
  const isCritical = regression.severity === "critical"

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isCritical ? "bg-red-500" : "bg-yellow-500"
            }`}
          />
          <p className="text-sm font-medium truncate" title={regression.testName}>
            {regression.testName}
          </p>
        </div>
        <p
          className="text-xs text-muted-foreground truncate ml-4"
          title={regression.testFile}
        >
          {regression.testFile}
        </p>
      </div>

      <div className="flex items-center gap-4 ml-4 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-mono">
            {formatDuration(regression.currentAvgMs)}
          </p>
          <p className="text-xs text-muted-foreground">
            vs {formatDuration(regression.baselineDurationMs)}
          </p>
        </div>

        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            isCritical
              ? "bg-red-500/20 text-red-400"
              : "bg-yellow-500/20 text-yellow-400"
          }`}
        >
          +{regression.regressionPercent}%
          <TrendIndicator trend={regression.trend} />
        </div>
      </div>
    </div>
  )
}

export function PerformanceAlertsCard() {
  const [data, setData] = useState<PerformanceRegressionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/performance-regressions")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold">Performance Alerts</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/30 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold">Performance Alerts</h3>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!data || data.totalRegressions === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold">Performance Alerts</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
            <Clock className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-sm font-medium">No Performance Regressions</p>
          <p className="text-xs text-muted-foreground mt-1">
            All tests running within normal parameters
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold">Performance Alerts</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {data.criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">
              {data.criticalCount} critical
            </span>
          )}
          {data.warningCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
              {data.warningCount} warning
            </span>
          )}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {data.regressions.map((regression) => (
          <RegressionRow key={regression.testSignature} regression={regression} />
        ))}
      </div>
    </div>
  )
}
