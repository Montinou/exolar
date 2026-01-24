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

// PERFORMANCE OPTIMIZATION: Extract style objects to module-level constants
// Prevents re-renders caused by new object references on each render
const TOOLTIP_CONTENT_STYLE = {
  background: "oklch(0.12 0.02 260 / 0.9)",
  border: "1px solid oklch(1 0 0 / 0.1)",
  borderRadius: "8px",
  backdropFilter: "blur(8px)",
} as const

const TOOLTIP_ITEM_STYLE = { color: "oklch(0.985 0 0)" } as const
const TOOLTIP_LABEL_STYLE = { color: "oklch(0.708 0 0)" } as const

const XAXIS_TICK_STYLE = { fill: "oklch(0.708 0 0)", fontSize: 11 } as const
const XAXIS_LINE_STYLE = { stroke: "oklch(1 0 0 / 0.1)" } as const

const YAXIS_TICK_STYLE = { fill: "oklch(0.708 0 0)", fontSize: 11 } as const

const DOT_STYLE = {
  fill: "oklch(0.75 0.15 195)",
  strokeWidth: 0,
  r: 3,
} as const

const ACTIVE_DOT_STYLE = {
  fill: "oklch(0.85 0.12 195)",
  strokeWidth: 0,
  r: 5,
  style: { filter: "drop-shadow(0 0 8px oklch(0.75 0.15 195))" },
} as const

const AREA_STYLE = {
  filter: "drop-shadow(0 0 8px oklch(0.75 0.15 195 / 0.5))",
} as const

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
              tick={XAXIS_TICK_STYLE}
              tickLine={false}
              axisLine={XAXIS_LINE_STYLE}
            />
            <YAxis
              tick={YAXIS_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Pass Rate"]}
            />
            <Area
              type="monotone"
              dataKey="passRate"
              stroke="oklch(0.75 0.15 195)"
              strokeWidth={2}
              fill="url(#cyanGradient)"
              dot={DOT_STYLE}
              activeDot={ACTIVE_DOT_STYLE}
              style={AREA_STYLE}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
