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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown, Loader2 } from "lucide-react"
import type { FailureTrendData } from "@/lib/types"

interface FailureRateChartProps {
  dateFrom?: string
  dateTo?: string
}

export function FailureRateChart({ dateFrom, dateTo }: FailureRateChartProps) {
  const [data, setData] = useState<FailureTrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ type: "failures" })
        if (dateFrom) params.set("from", dateFrom)
        if (dateTo) params.set("to", dateTo)

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
  }, [dateFrom, dateTo])

  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }))

  const avgFailureRate =
    data.length > 0
      ? data.reduce((sum, d) => sum + Number(d.failure_rate), 0) / data.length
      : 0

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Failure Rate Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[150px] sm:h-[200px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Failure Rate Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[150px] sm:h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No data available for selected period
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Failure Rate Trend
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Avg: {avgFailureRate.toFixed(1)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[150px] sm:h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
              className="text-muted-foreground"
              domain={[0, "auto"]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const tooltipData = payload[0].payload
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-medium">{tooltipData.date}</p>
                      <p className="text-red-500 font-semibold">
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
              stroke="#888"
              strokeDasharray="3 3"
              label={{
                value: "Avg",
                position: "right",
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="failure_rate"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
