"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts"
import type { TrendData } from "@/lib/types"

interface TrendChartProps {
  data: TrendData[]
}

export function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    Passed: item.passed,
    Failed: item.failed,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Execution Trends</CardTitle>
        <CardDescription>Pass/Fail rate over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            Passed: {
              label: "Passed",
              color: "hsl(var(--chart-1))",
            },
            Failed: {
              label: "Failed",
              color: "hsl(var(--chart-2))",
            },
          }}
          className="h-[200px] sm:h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="Passed" stroke="var(--color-Passed)" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Failed" stroke="var(--color-Failed)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
