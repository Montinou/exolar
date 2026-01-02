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
import { Layers, Loader2 } from "lucide-react"

interface SuitePassRate {
  suite: string
  total_runs: number
  pass_rate: number
}

function getBarColor(passRate: number): string {
  if (passRate >= 90) return "var(--status-success)"
  if (passRate >= 75) return "var(--status-warning)"
  return "var(--status-error)"
}

export function SuitePassRatesCard() {
  const [suites, setSuites] = useState<SuitePassRate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/suite-pass-rates")
        const json = await response.json()
        setSuites(json.suites || [])
      } catch (error) {
        console.error("Failed to fetch suite pass rates:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Suite Pass Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] flex items-center justify-center">
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
            <Layers className="h-5 w-5" />
            Suite Pass Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No test suites found</p>
              <p className="text-xs">Suite data not available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate chart height based on number of suites
  const chartHeight = Math.max(180, formattedData.length * 40)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Suite Pass Rates
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Last 7 days
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={formattedData}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              dataKey="displayName"
              type="category"
              tick={{ fontSize: 11 }}
              width={120}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const tooltipData = payload[0].payload
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-sm">{tooltipData.suite}</p>
                      <p
                        className="font-semibold"
                        style={{ color: getBarColor(tooltipData.pass_rate) }}
                      >
                        {Number(tooltipData.pass_rate).toFixed(1)}% pass rate
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tooltipData.total_runs} total runs
                      </p>
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
      </CardContent>
    </Card>
  )
}
