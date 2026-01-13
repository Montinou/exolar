"use client"

import { useEffect, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { PieChartIcon, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CategoryData {
  category: string
  count: number
  percentage: number
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

const CATEGORY_LABELS: Record<string, string> = {
  timeout: "Timeout",
  auth: "Auth",
  network: "Network",
  element: "Element",
  assertion: "Assertion",
  other: "Other",
}

interface CategoryDistributionChartProps {
  days?: number
  onDaysChange?: (days: number) => void
  showFilter?: boolean
}

export function CategoryDistributionChart({
  days: externalDays,
  onDaysChange,
  showFilter = true,
}: CategoryDistributionChartProps) {
  const [internalDays, setInternalDays] = useState<DateRange>("30")
  const [data, setData] = useState<CategoryData[]>([])
  const [totalFailures, setTotalFailures] = useState(0)
  const [loading, setLoading] = useState(true)

  const activeDays = externalDays ?? parseInt(internalDays, 10)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await fetch(`/api/patterns/distribution?days=${activeDays}`)
        const json = await response.json()
        setData(json.categories || [])
        setTotalFailures(json.totalFailures || 0)
      } catch (error) {
        console.error("Failed to fetch category distribution:", error)
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

  // Filter out zero-count categories for cleaner display
  const chartData = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      ...d,
      name: CATEGORY_LABELS[d.category] || d.category,
      fill: CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other,
    }))

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-[var(--status-warning)]" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Failure Categories
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

  if (chartData.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-[var(--status-warning)]" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Failure Categories
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
            <PieChartIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No categorized failures</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-[var(--status-warning)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Failure Categories
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
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="count"
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const tooltipData = payload[0].payload as CategoryData & {
                    name: string
                    fill: string
                  }
                  return (
                    <div className="glass-card p-3">
                      <p className="font-medium text-sm text-foreground">
                        {tooltipData.name}
                      </p>
                      <p className="font-semibold" style={{ color: tooltipData.fill }}>
                        {tooltipData.count} failures ({tooltipData.percentage}%)
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center text-xs text-muted-foreground mt-2">
        {totalFailures} total failures
      </div>
    </div>
  )
}
