"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts"

interface TrendDataPoint {
  date: string
  passRate: number
  label?: string
}

interface TrendAreaChartProps {
  data: TrendDataPoint[]
  title?: string
}

export function TrendAreaChart({
  data,
  title = "Weekly Pass Rate Trend",
}: TrendAreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground">No trend data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      <div className="h-[200px] sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0.4} />
                <stop offset="50%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="oklch(0.75 0.15 195)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(1 0 0 / 0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "oklch(1 0 0 / 0.1)" }}
            />
            <YAxis
              tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
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
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Pass Rate"]}
            />
            <Area
              type="monotone"
              dataKey="passRate"
              stroke="oklch(0.75 0.15 195)"
              strokeWidth={2}
              fill="url(#cyanGradient)"
              dot={{
                fill: "oklch(0.75 0.15 195)",
                strokeWidth: 0,
                r: 3,
              }}
              activeDot={{
                fill: "oklch(0.85 0.12 195)",
                strokeWidth: 0,
                r: 5,
                style: { filter: "drop-shadow(0 0 8px oklch(0.75 0.15 195))" },
              }}
              style={{
                filter: "drop-shadow(0 0 8px oklch(0.75 0.15 195 / 0.5))",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
