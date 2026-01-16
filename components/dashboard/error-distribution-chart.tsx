"use client"

import { useEffect, useState, useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts"
import { AlertCircle, Loader2 } from "lucide-react"

interface ErrorDistribution {
  error_type: string
  count: number
  percentage: number
  example_message: string | null
}

interface ErrorDistributionChartProps {
  dateFrom?: string
  dateTo?: string
  branch?: string
  suite?: string
}

function getFilterLabel(dateFrom?: string, dateTo?: string): string {
  if (dateFrom || dateTo) {
    return "Filtered"
  }
  return "Last 15 days"
}

export function ErrorDistributionChart({
  dateFrom,
  dateTo,
  branch,
  suite,
}: ErrorDistributionChartProps) {
  const [data, setData] = useState<ErrorDistribution[]>([])
  const [loading, setLoading] = useState(true)

  // Build stable API URL - convert from/to to since for the API
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams()
    // The API uses 'since' parameter, so we use dateFrom as since
    if (dateFrom) params.set("since", dateFrom)
    if (branch) params.set("branch", branch)
    if (suite) params.set("suite", suite)
    const queryString = params.toString()
    return queryString ? `/api/error-distribution?${queryString}` : "/api/error-distribution"
  }, [dateFrom, branch, suite])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await fetch(apiUrl)
        const json = await response.json()
        setData(json.distribution || [])
      } catch (error) {
        console.error("Failed to fetch error distribution:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [apiUrl])

  // Format error type for display
  const formattedData = Array.isArray(data)
    ? data
        .filter((item) => item.error_type)
        .slice(0, 6)
        .map((item) => ({
          ...item,
          // Truncate long error types
          displayType:
            item.error_type.length > 20
              ? item.error_type.slice(0, 20) + "..."
              : item.error_type,
        }))
    : []

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Error Distribution</h3>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (formattedData.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Error Distribution</h3>
        </div>
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No categorized errors</p>
            <p className="text-xs">AI context data not available</p>
          </div>
        </div>
      </div>
    )
  }

  const filterLabel = getFilterLabel(dateFrom, dateTo)

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Error Distribution</h3>
        </div>
        <span className="text-xs text-muted-foreground">{filterLabel}</span>
      </div>
      <div className="h-[200px] sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(1 0 0 / 0.05)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "oklch(1 0 0 / 0.1)" }}
            />
            <YAxis
              dataKey="displayType"
              type="category"
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.12 0.02 260 / 0.9)",
                border: "1px solid oklch(1 0 0 / 0.1)",
                borderRadius: "8px",
                backdropFilter: "blur(8px)",
              }}
              itemStyle={{ color: "oklch(0.985 0 0)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const tooltipData = payload[0].payload
                  return (
                    <div className="glass-card p-3">
                      <p className="font-medium text-sm text-foreground">
                        {tooltipData.error_type}
                      </p>
                      <p className="font-semibold stat-value-error">
                        {tooltipData.count} failures
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {formattedData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === 0 ? "var(--status-error)" : "oklch(0.65 0.22 25 / 0.6)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
