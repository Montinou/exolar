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
import { Layers, Loader2 } from "lucide-react"

interface SuitePassRate {
  suite: string
  total_runs: number
  pass_rate: number
  failed_tests: string[]
  failed_count: number
}

interface SuitePassRatesCardProps {
  dateFrom?: string
  dateTo?: string
  branch?: string
}

function getBarColor(passRate: number): string {
  if (passRate >= 90) return "var(--status-success)"
  if (passRate >= 75) return "var(--status-warning)"
  return "var(--status-error)"
}

function getValueClass(passRate: number): string {
  if (passRate >= 90) return "stat-value-success"
  if (passRate >= 75) return "stat-value-warning"
  return "stat-value-error"
}

function getFilterLabel(dateFrom?: string, dateTo?: string): string {
  if (dateFrom || dateTo) {
    return "Filtered"
  }
  return "Last 15 days"
}

export function SuitePassRatesCard({
  dateFrom,
  dateTo,
  branch,
}: SuitePassRatesCardProps) {
  const [suites, setSuites] = useState<SuitePassRate[]>([])
  const [loading, setLoading] = useState(true)

  // Build stable API URL
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    if (branch) params.set("branch", branch)
    const queryString = params.toString()
    return queryString ? `/api/suite-pass-rates?${queryString}` : "/api/suite-pass-rates"
  }, [dateFrom, dateTo, branch])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await fetch(apiUrl)
        const json = await response.json()
        setSuites(json.suites || [])
      } catch (error) {
        console.error("Failed to fetch suite pass rates:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [apiUrl])

  // Format suite names for display
  const formattedData = Array.isArray(suites)
    ? suites.map((item) => ({
        ...item,
        displayName:
          item.suite.length > 25 ? item.suite.slice(0, 25) + "..." : item.suite,
      }))
    : []

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-5 w-5 text-[var(--exolar-cyan)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Suite Pass Rates</h3>
        </div>
        <div className="h-[180px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (formattedData.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-5 w-5 text-[var(--exolar-cyan)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Suite Pass Rates</h3>
        </div>
        <div className="h-[180px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No test suites found</p>
            <p className="text-xs">Suite data not available</p>
          </div>
        </div>
      </div>
    )
  }

  // Calculate chart height based on number of suites
  const chartHeight = Math.max(180, formattedData.length * 40)
  const filterLabel = getFilterLabel(dateFrom, dateTo)

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[var(--exolar-cyan)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Suite Pass Rates</h3>
        </div>
        <span className="text-xs text-muted-foreground">{filterLabel}</span>
      </div>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(1 0 0 / 0.05)"
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "oklch(1 0 0 / 0.1)" }}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              dataKey="displayName"
              type="category"
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={120}
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
                    <div className="glass-card p-3 max-w-[280px]">
                      <p className="font-medium text-sm text-foreground">{tooltipData.suite}</p>
                      <p className={`font-semibold ${getValueClass(tooltipData.pass_rate)}`}>
                        {Number(tooltipData.pass_rate).toFixed(1)}% pass rate
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tooltipData.total_runs} total runs
                      </p>
                      {tooltipData.failed_tests?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-xs text-muted-foreground mb-1">Failing tests:</p>
                          <ul className="text-xs text-[var(--status-error)] space-y-0.5">
                            {tooltipData.failed_tests.map((test: string, i: number) => (
                              <li key={i} className="truncate" title={test}>• {test}</li>
                            ))}
                          </ul>
                          {tooltipData.failed_count > 5 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              +{tooltipData.failed_count - 5} more
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="pass_rate" radius={[0, 4, 4, 0]}>
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.pass_rate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
