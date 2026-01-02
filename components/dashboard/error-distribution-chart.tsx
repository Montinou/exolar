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
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2 } from "lucide-react"

interface ErrorDistribution {
  error_type: string
  count: number
}

export function ErrorDistributionChart() {
  const [data, setData] = useState<ErrorDistribution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/error-distribution")
        const json = await response.json()
        setData(json.distribution || [])
      } catch (error) {
        console.error("Failed to fetch error distribution:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Format error type for display
  const formattedData = data
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (formattedData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No categorized errors</p>
              <p className="text-xs">AI context data not available</p>
            </div>
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
            <AlertCircle className="h-5 w-5" />
            Error Distribution
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Last 7 days
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={formattedData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              dataKey="displayType"
              type="category"
              tick={{ fontSize: 11 }}
              width={100}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const tooltipData = payload[0].payload
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-sm">
                        {tooltipData.error_type}
                      </p>
                      <p className="text-red-500 font-semibold">
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
                  fill={index === 0 ? "#ef4444" : "#f87171"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
