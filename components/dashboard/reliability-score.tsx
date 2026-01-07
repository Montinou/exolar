"use client"

import { useState, useEffect } from "react"
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts"
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { ReliabilityScore } from "@/lib/types"

interface ReliabilityScoreCardProps {
  branch?: string
  suite?: string
  from?: string
  to?: string
}

export function ReliabilityScoreCard({ branch, suite, from, to }: ReliabilityScoreCardProps) {
  const [score, setScore] = useState<ReliabilityScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchScore() {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (branch) params.set("branch", branch)
        if (suite) params.set("suite", suite)
        if (from) params.set("from", from)
        if (to) params.set("to", to)

        const url = `/api/reliability-score${params.toString() ? `?${params}` : ""}`
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error("Failed to fetch reliability score")
        }
        const data = await response.json()
        if (data.error) throw new Error(data.error)
        setScore(data)
      } catch (err) {
        console.error("Failed to fetch reliability score:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchScore()
  }, [branch, suite, from, to])

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-[var(--exolar-cyan)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Reliability Score
          </h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse bg-muted/30 w-32 h-32 rounded-full" />
        </div>
      </div>
    )
  }

  if (error || !score) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Reliability Score
          </h3>
        </div>
        <div className="text-center py-6 text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{error || "No data available"}</p>
        </div>
      </div>
    )
  }

  const getScoreColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "oklch(0.75 0.18 145)" // green
      case "warning":
        return "oklch(0.75 0.15 85)" // yellow
      case "critical":
        return "oklch(0.65 0.2 25)" // red
      default:
        return "oklch(0.75 0.15 195)" // cyan
    }
  }

  const TrendIcon =
    score.trend > 0 ? TrendingUp : score.trend < 0 ? TrendingDown : Minus
  const trendColor =
    score.trend > 0
      ? "text-[var(--status-success)]"
      : score.trend < 0
        ? "text-[var(--status-error)]"
        : "text-muted-foreground"

  const chartData = [{ value: score.score, fill: getScoreColor(score.status) }]

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[var(--exolar-cyan)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Reliability Score
          </h3>
        </div>
        <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span>
            {score.trend > 0 ? "+" : ""}
            {score.trend}
          </span>
        </div>
      </div>

      <div className="h-48 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            startAngle={180}
            endAngle={0}
            data={chartData}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: "oklch(1 0 0 / 0.05)" }}
              dataKey="value"
              cornerRadius={10}
              angleAxisId={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-4xl font-bold"
            style={{ color: getScoreColor(score.status) }}
          >
            {score.score}
          </span>
          <span className="text-sm text-muted-foreground capitalize">
            {score.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Pass Rate</p>
          <p className="text-sm font-medium">{score.rawMetrics.passRate}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Flaky Rate</p>
          <p className="text-sm font-medium">{score.rawMetrics.flakyRate}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Stability</p>
          <p className="text-sm font-medium">
            {Math.round((1 - Math.min(score.rawMetrics.durationCV, 1)) * 100)}%
          </p>
        </div>
      </div>
    </div>
  )
}
