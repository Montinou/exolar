"use client"

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from "recharts"
import { TrendingDown, Loader2 } from "lucide-react"
import type { FailureTrendData } from "@/lib/types"

interface FailureRateChartProps {
  dateFrom?: string
  dateTo?: string
  branch?: string
  suite?: string
  failureRate?: number // Passed from getDashboardMetrics for consistent display
}

function getFilterLabel(dateFrom?: string, dateTo?: string): string {
  if (dateFrom || dateTo) {
    return "Filtered"
  }
  return "Last 15 days"
}

export function FailureRateChart({ dateFrom, dateTo, branch, suite, failureRate }: FailureRateChartProps) {
  const [data, setData] = useState<FailureTrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ type: "failures" })
        if (dateFrom) params.set("from", dateFrom)
        if (dateTo) params.set("to", dateTo)
        if (branch) params.set("branch", branch)
        if (suite) params.set("suite", suite)

        const response = await fetch(`/api/trends?${params.toString()}`)
        const json = await response.json()
        setData(Array.isArray(json) ? json : [])
      } catch (error) {
        console.error("Failed to fetch failure trends:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dateFrom, dateTo, branch, suite])

  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }))

  // Use passed failureRate from getDashboardMetrics for consistency with Stats Card
  // Fall back to weighted average calculation if not provided
  const avgFailureRate =
    failureRate !== undefined
      ? failureRate
      : data.length > 0
        ? (() => {
            const totalTests = data.reduce((sum, d) => sum + Number(d.total_tests), 0)
            const totalFailed = data.reduce((sum, d) => sum + Number(d.failed_tests), 0)
            return totalTests > 0 ? (totalFailed / totalTests) * 100 : 0
          })()
        : 0

  const filterLabel = getFilterLabel(dateFrom, dateTo)

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Failure Rate Trend</h3>
          <span className="text-xs text-muted-foreground">({filterLabel})</span>
        </div>
        <div className="h-[200px] sm:h-[220px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Failure Rate Trend</h3>
          <span className="text-xs text-muted-foreground">({filterLabel})</span>
        </div>
        <div className="h-[200px] sm:h-[220px] flex items-center justify-center text-muted-foreground text-sm">
          No data available for selected period
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Failure Rate Trend</h3>
          <span className="text-xs text-muted-foreground">({filterLabel})</span>
        </div>
        <span className="text-xs stat-value-error">
          Avg: {avgFailureRate.toFixed(1)}%
        </span>
      </div>
      <div className="h-[200px] sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(1 0 0 / 0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "oklch(1 0 0 / 0.1)" }}
            />
            <YAxis
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.12 0.02 260 / 0.9)",
                border: "1px solid oklch(1 0 0 / 0.1)",
                borderRadius: "8px",
                backdropFilter: "blur(8px)",
              }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const tooltipData = payload[0].payload
                  return (
                    <div className="glass-card p-3">
                      <p className="font-medium text-foreground">{tooltipData.date}</p>
                      <p className="font-semibold stat-value-error">
                        Failure Rate: {Number(tooltipData.failure_rate).toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tooltipData.failed_tests} failed / {tooltipData.total_tests} total
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <ReferenceLine
              y={avgFailureRate}
              stroke="oklch(0.5 0 0)"
              strokeDasharray="3 3"
              label={{
                value: "Avg",
                position: "right",
                fontSize: 10,
                fill: "oklch(0.708 0 0)",
              }}
            />
            <Line
              type="monotone"
              dataKey="failure_rate"
              stroke="var(--status-error)"
              strokeWidth={2}
              dot={{
                fill: "var(--status-error)",
                strokeWidth: 0,
                r: 3,
              }}
              activeDot={{
                r: 5,
                fill: "var(--status-error)",
                style: { filter: "drop-shadow(0 0 8px var(--status-error))" },
              }}
              style={{
                filter: "drop-shadow(0 0 6px oklch(0.65 0.22 25 / 0.5))",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
