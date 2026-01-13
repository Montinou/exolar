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
import { Layers, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ClusterDistribution {
  label: string
  count: number
  order: number
}

interface DistributionData {
  totalClusters: number
  totalFailures: number
  totalExecutions: number
  distribution: ClusterDistribution[]
}

type DateRange = "7" | "15" | "30" | "60"

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "15", label: "Last 15 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 2 months" },
]

// Color gradient from light to dark based on cluster size
const COLORS = [
  "oklch(0.75 0.15 25 / 0.5)", // 1 failure - lightest
  "oklch(0.65 0.18 25 / 0.6)", // 2-5 failures
  "oklch(0.55 0.20 25 / 0.7)", // 6-10 failures
  "oklch(0.50 0.22 25 / 0.8)", // 11-20 failures
  "var(--status-error)", // 20+ failures - darkest
]

interface ClusterDistributionChartProps {
  days?: number
  onDaysChange?: (days: number) => void
  showFilter?: boolean
}

export function ClusterDistributionChart({
  days: externalDays,
  onDaysChange,
  showFilter = true,
}: ClusterDistributionChartProps) {
  const [internalDays, setInternalDays] = useState<DateRange>("30")
  const [data, setData] = useState<DistributionData | null>(null)
  const [loading, setLoading] = useState(true)

  // Use external days if provided, otherwise use internal state
  const activeDays = externalDays ?? parseInt(internalDays, 10)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await fetch(`/api/clusters/distribution?days=${activeDays}`)
        const json = await response.json()
        setData(json)
      } catch (error) {
        console.error("Failed to fetch cluster distribution:", error)
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

  const currentLabel = DATE_RANGE_OPTIONS.find((o) => o.value === internalDays)?.label || "Last 30 days"

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--status-error)]" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Cluster Distribution
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
        <div className="h-[200px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!data || data.distribution.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--status-error)]" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Cluster Distribution
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
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No clusters available</p>
            <p className="text-xs">No data for {currentLabel.toLowerCase()}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Cluster Distribution
          </h3>
        </div>
        <div className="flex items-center gap-2">
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
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="secondary" className="text-xs">
          {data.totalFailures} failures
        </Badge>
        <span className="text-muted-foreground">&rarr;</span>
        <Badge variant="outline" className="text-xs">
          {data.totalClusters} clusters
        </Badge>
      </div>
      <div className="h-[200px] sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.distribution}
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
              allowDecimals={false}
            />
            <YAxis
              dataKey="label"
              type="category"
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const tooltipData = payload[0].payload as ClusterDistribution
                  return (
                    <div className="glass-card p-3">
                      <p className="font-medium text-sm text-foreground">
                        {tooltipData.label}
                      </p>
                      <p className="font-semibold stat-value-error">
                        {tooltipData.count} cluster{tooltipData.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.distribution.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[Math.min(entry.order - 1, COLORS.length - 1)]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 text-xs text-muted-foreground text-center">
        Across {data.totalExecutions} execution{data.totalExecutions !== 1 ? "s" : ""}
      </div>
    </div>
  )
}
