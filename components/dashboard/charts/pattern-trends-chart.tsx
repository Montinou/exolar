"use client"

import { useEffect, useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { TrendingDown, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TrendDataPoint {
  date: string
  timeout: number
  auth: number
  network: number
  element: number
  assertion: number
  other: number
  total: number
}

type DateRange = "7" | "15" | "30" | "60"

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "15", label: "Last 15 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 2 months" },
]

const CATEGORY_COLORS: Record<string, string> = {
  timeout: "#f59e0b",     // Amber
  auth: "#ef4444",        // Red
  network: "#8b5cf6",     // Purple
  element: "#06b6d4",     // Cyan
  assertion: "#22c55e",   // Green
  other: "#6b7280",       // Gray
}

interface PatternTrendsChartProps {
  days?: number
  onDaysChange?: (days: number) => void
  showFilter?: boolean
}

export function PatternTrendsChart({
  days: externalDays,
  onDaysChange,
  showFilter = true,
}: PatternTrendsChartProps) {
  const [internalDays, setInternalDays] = useState<DateRange>("30")
  const [data, setData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  const activeDays = externalDays ?? parseInt(internalDays, 10)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await fetch(`/api/patterns/trends?days=${activeDays}`)
        const json = await response.json()
        setData(json.trends || [])
      } catch (error) {
        console.error("Failed to fetch pattern trends:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activeDays])

  const handleDaysChange = (value: DateRange) => {
    setInternalDays(value)
    onDaysChange?.(parseInt(value, 10))
  }

  // Format dates for display
  const formattedData = data.map((d) => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }))

  // Check if there's any data with values
  const hasData = data.some((d) => d.total > 0)

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-[var(--status-info)]" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Failure Trends
            </h3>
          </div>
          {showFilter && (
            <Select value={internalDays} onValueChange={handleDaysChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="h-[220px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-[var(--status-info)]" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Failure Trends
            </h3>
          </div>
          {showFilter && (
            <Select value={internalDays} onValueChange={handleDaysChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="h-[220px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No trend data available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-[var(--status-info)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Failure Trends
          </h3>
        </div>
        {showFilter && (
          <Select value={internalDays} onValueChange={handleDaysChange}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={formattedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
                <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" />
            <XAxis
              dataKey="displayDate"
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "oklch(1 0 0 / 0.1)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="glass-card p-3">
                      <p className="font-medium text-sm text-foreground mb-2">
                        {label}
                      </p>
                      {payload
                        .filter((p) => p.value && Number(p.value) > 0)
                        .map((p) => (
                          <p
                            key={p.dataKey}
                            className="text-xs"
                            style={{ color: p.color }}
                          >
                            {String(p.dataKey).charAt(0).toUpperCase() +
                              String(p.dataKey).slice(1)}
                            : {p.value}
                          </p>
                        ))}
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="timeout"
              stackId="1"
              stroke={CATEGORY_COLORS.timeout}
              fill={`url(#gradient-timeout)`}
            />
            <Area
              type="monotone"
              dataKey="assertion"
              stackId="1"
              stroke={CATEGORY_COLORS.assertion}
              fill={`url(#gradient-assertion)`}
            />
            <Area
              type="monotone"
              dataKey="element"
              stackId="1"
              stroke={CATEGORY_COLORS.element}
              fill={`url(#gradient-element)`}
            />
            <Area
              type="monotone"
              dataKey="network"
              stackId="1"
              stroke={CATEGORY_COLORS.network}
              fill={`url(#gradient-network)`}
            />
            <Area
              type="monotone"
              dataKey="auth"
              stackId="1"
              stroke={CATEGORY_COLORS.auth}
              fill={`url(#gradient-auth)`}
            />
            <Area
              type="monotone"
              dataKey="other"
              stackId="1"
              stroke={CATEGORY_COLORS.other}
              fill={`url(#gradient-other)`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
