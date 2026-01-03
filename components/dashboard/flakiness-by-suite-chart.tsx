"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts"

interface SuiteData {
  suite: string
  stable: number
  flaky: number
  failed: number
}

interface FlakinessBySuiteChartProps {
  data: SuiteData[]
  title?: string
}

const COLORS = {
  stable: "var(--status-success)",
  flaky: "var(--status-warning)",
  failed: "var(--status-error)",
}

export function FlakinessBySuiteChart({
  data,
  title = "Flakiness by Suite (Last 24h)",
}: FlakinessBySuiteChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground">No suite data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      <div className="h-[200px] sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
            />
            <YAxis
              type="category"
              dataKey="suite"
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.12 0.02 260 / 0.9)",
                border: "1px solid oklch(1 0 0 / 0.1)",
                borderRadius: "8px",
                backdropFilter: "blur(8px)",
              }}
              itemStyle={{ color: "oklch(0.985 0 0)" }}
              labelStyle={{ color: "oklch(0.708 0 0)" }}
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}%`,
                name.charAt(0).toUpperCase() + name.slice(1),
              ]}
            />
            <Legend
              wrapperStyle={{ paddingTop: "10px" }}
              formatter={(value) => (
                <span style={{ color: "oklch(0.708 0 0)", fontSize: "11px" }}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </span>
              )}
            />
            <Bar
              dataKey="stable"
              stackId="a"
              fill={COLORS.stable}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="flaky"
              stackId="a"
              fill={COLORS.flaky}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="failed"
              stackId="a"
              fill={COLORS.failed}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
