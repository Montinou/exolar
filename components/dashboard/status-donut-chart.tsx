"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

interface StatusDonutChartProps {
  passRate: number
  failRate: number
  skippedRate?: number
  flakyCount?: number
  title?: string
}

const COLORS = {
  passed: "var(--status-success)",
  failed: "var(--status-error)",
  skipped: "var(--status-muted)",
}

export function StatusDonutChart({
  passRate,
  failRate,
  skippedRate = 0,
  flakyCount,
  title = "Test Status Distribution",
}: StatusDonutChartProps) {
  // Data shows only mutually exclusive categories: Passed/Failed/Skipped
  // Flaky is shown as a separate badge (a test can be both passed AND flaky)
  const data = [
    { name: "Passed", value: passRate, color: COLORS.passed },
    { name: "Failed", value: failRate, color: COLORS.failed },
    { name: "Skipped", value: skippedRate, color: COLORS.skipped },
  ].filter((item) => item.value > 0)

  // If no data, show empty state
  if (data.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      <div className="relative h-[200px] sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{
                    filter: "drop-shadow(0 0 6px currentColor)",
                  }}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "oklch(0.12 0.02 260 / 0.9)",
                border: "1px solid oklch(1 0 0 / 0.1)",
                borderRadius: "8px",
                backdropFilter: "blur(8px)",
              }}
              itemStyle={{ color: "oklch(0.985 0 0)" }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <span className="text-3xl sm:text-4xl font-bold stat-value-success">
              {passRate.toFixed(0)}%
            </span>
            <p className="text-xs text-muted-foreground mt-1">Pass Rate</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4 flex-wrap">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-muted-foreground">
              {entry.name}: {entry.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Flaky badge - shown separately as flaky is orthogonal to pass/fail status */}
      {flakyCount !== undefined && flakyCount > 0 && (
        <div className="flex justify-center mt-3">
          <span className="text-xs px-2.5 py-1 rounded-full bg-warning/20 text-warning flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--status-warning)" }}
            />
            {flakyCount} Flaky Test{flakyCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  )
}
