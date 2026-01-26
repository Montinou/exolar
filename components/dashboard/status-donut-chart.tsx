"use client"

import { useEffect, useState } from "react"
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

// PERFORMANCE OPTIMIZATION: Extract style objects to module-level constants
// Prevents re-renders caused by new object references on each render
const TOOLTIP_CONTENT_STYLE = {
  background: "oklch(0.12 0.02 260 / 0.95)",
  border: "1px solid oklch(0.75 0.15 195 / 0.3)",
  borderRadius: "12px",
  backdropFilter: "blur(12px)",
  boxShadow: "0 4px 20px oklch(0 0 0 / 0.3)",
  padding: "12px 16px",
} as const

const TOOLTIP_ITEM_STYLE = { color: "oklch(0.985 0 0)" } as const

const TOOLTIP_CURSOR_STYLE = { fill: "oklch(1 0 0 / 0.05)" } as const

const CELL_STYLE = {
  filter: "drop-shadow(0 0 8px currentColor)",
  cursor: "pointer",
} as const

// Animated percentage display
function AnimatedPercentage({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const duration = 1000
    const steps = 40
    const stepDuration = duration / steps
    const increment = value / steps

    let currentStep = 0
    const timer = setInterval(() => {
      currentStep++
      if (currentStep >= steps) {
        setDisplayValue(value)
        clearInterval(timer)
      } else {
        setDisplayValue(increment * currentStep)
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [value])

  return <>{displayValue.toFixed(0)}%</>
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
    <div className="glass-card glass-card-glow p-6 animate-fade-in-up delay-2">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      <div className="relative h-[200px] sm:h-[220px]">
        <div className="animate-donut w-full h-full">
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
                animationBegin={200}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-all duration-300 hover:opacity-80"
                    style={CELL_STYLE}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                cursor={TOOLTIP_CURSOR_STYLE}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Center label with animated percentage */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <span className="text-3xl sm:text-4xl font-bold stat-value-success tabular-nums">
              <AnimatedPercentage value={passRate} />
            </span>
            <p className="text-xs text-muted-foreground mt-1">Pass Rate</p>
          </div>
        </div>
      </div>

      {/* Legend with hover effects */}
      <div className="flex justify-center gap-4 mt-4 flex-wrap">
        {data.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center gap-1.5 text-xs group cursor-default transition-all duration-200 hover:scale-105"
          >
            <span
              className="h-2.5 w-2.5 rounded-full transition-transform duration-200 group-hover:scale-125"
              style={{
                background: entry.color,
                boxShadow: `0 0 6px ${entry.color}40`
              }}
            />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              {entry.name}: {entry.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Flaky badge with glow effect */}
      {flakyCount !== undefined && flakyCount > 0 && (
        <div className="flex justify-center mt-3">
          <span className="text-xs px-3 py-1.5 rounded-full bg-warning/20 text-warning flex items-center gap-1.5 badge-warning transition-all duration-300 hover:bg-warning/30">
            <span
              className="h-2 w-2 rounded-full animate-subtle-pulse"
              style={{ background: "var(--status-warning)" }}
            />
            {flakyCount} Flaky Test{flakyCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  )
}
