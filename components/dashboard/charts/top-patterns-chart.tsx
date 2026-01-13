"use client"

import { useEffect, useState } from "react"
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
import { TrendingUp, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TopPattern {
  id: number
  canonicalError: string
  category: string
  totalOccurrences: number
  affectedExecutions: number
  affectedTests: number
  firstSeen: string
  lastSeen: string
}

type DateRange = "7" | "15" | "30" | "60"

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "15", label: "Last 15 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 2 months" },
]

const CATEGORY_COLORS: Record<string, string> = {
  timeout: "oklch(0.70 0.18 45)",      // Orange
  auth: "oklch(0.65 0.20 25)",         // Red
  network: "oklch(0.65 0.18 280)",     // Purple
  element: "oklch(0.70 0.15 200)",     // Cyan
  assertion: "oklch(0.65 0.15 140)",   // Green
  other: "oklch(0.60 0.10 260)",       // Gray
}

interface TopPatternsChartProps {
  days?: number
  onDaysChange?: (days: number) => void
  showFilter?: boolean
}

export function TopPatternsChart({
  days: externalDays,
  onDaysChange,
  showFilter = true,
}: TopPatternsChartProps) {
  const [internalDays, setInternalDays] = useState<DateRange>("30")
  const [data, setData] = useState<TopPattern[]>([])
  const [loading, setLoading] = useState(true)

  const activeDays = externalDays ?? parseInt(internalDays, 10)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await fetch(`/api/patterns/top?days=${activeDays}&limit=8`)
        const json = await response.json()
        setData(json.patterns || [])
      } catch (error) {
        console.error("Failed to fetch top patterns:", error)
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

  // Format for display - truncate error messages
  const formattedData = data.map((pattern, index) => ({
    ...pattern,
    displayError:
      pattern.canonicalError.length > 35
        ? pattern.canonicalError.slice(0, 35) + "..."
        : pattern.canonicalError,
    rank: index + 1,
  }))

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[var(--status-error)]" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Top Error Patterns
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
        <div className="h-[280px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (formattedData.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[var(--status-error)]" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Top Error Patterns
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
        <div className="h-[280px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No error patterns found</p>
            <p className="text-xs">Run pattern migration first</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Top Error Patterns
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
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="secondary" className="text-xs">
          {data.reduce((sum, p) => sum + p.totalOccurrences, 0)} total occurrences
        </Badge>
        <span className="text-muted-foreground">&rarr;</span>
        <Badge variant="outline" className="text-xs">
          {data.length} patterns
        </Badge>
      </div>
      <div className="h-[280px]">
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
              dataKey="displayError"
              type="category"
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const tooltipData = payload[0].payload as TopPattern & {
                    displayError: string
                    rank: number
                  }
                  return (
                    <div className="glass-card p-3 max-w-xs">
                      <p className="font-medium text-xs text-foreground mb-1 break-words">
                        {tooltipData.canonicalError.slice(0, 100)}
                        {tooltipData.canonicalError.length > 100 ? "..." : ""}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {tooltipData.category}
                        </Badge>
                      </div>
                      <p className="font-semibold stat-value-error">
                        {tooltipData.totalOccurrences} occurrences
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tooltipData.affectedTests} tests • {tooltipData.affectedExecutions} runs
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="totalOccurrences" radius={[0, 4, 4, 0]}>
              {formattedData.map((entry) => (
                <Cell
                  key={`cell-${entry.id}`}
                  fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
