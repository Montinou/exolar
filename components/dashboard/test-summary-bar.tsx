"use client"

import { useEffect, useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TestSummaryBarProps {
  total: number
  passed: number
  failed: number
  skipped: number
  flaky: number
}

// Animated progress segment
function AnimatedSegment({
  targetWidth,
  color,
  delay,
}: {
  targetWidth: number
  color: string
  delay: number
}) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setWidth(targetWidth)
    }, delay)
    return () => clearTimeout(timer)
  }, [targetWidth, delay])

  if (targetWidth === 0) return null

  return (
    <div
      className="progress-segment h-full"
      style={{
        width: `${width}%`,
        background: color,
        boxShadow: `0 0 8px ${color}60`,
        transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    />
  )
}

export function TestSummaryBar({ total, passed, failed, skipped, flaky }: TestSummaryBarProps) {
  // Prevent division by zero
  if (total === 0) {
    return (
      <div className="glass-card p-4 animate-fade-in-up delay-5">
        <p className="text-center text-muted-foreground">No test data available</p>
      </div>
    )
  }

  // Progress bar shows mutually exclusive categories only (adds to 100%)
  const passedPercent = (passed / total) * 100
  const failedPercent = (failed / total) * 100
  const skippedPercent = (skipped / total) * 100

  return (
    <TooltipProvider>
      <div className="glass-card p-4 space-y-3 animate-fade-in-up delay-5">
        {/* Header with counts */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
          <span className="font-medium">
            Total: <span className="text-foreground tabular-nums">{total.toLocaleString()}</span>
          </span>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <span className="flex items-center gap-1.5 group transition-all duration-200 hover:scale-105 cursor-default">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125"
                style={{
                  background: "var(--status-success)",
                  boxShadow: "0 0 6px var(--status-success)"
                }}
              />
              <span className="stat-value-success font-semibold tabular-nums">{passed.toLocaleString()}</span>
              <span className="text-muted-foreground hidden xs:inline group-hover:text-foreground transition-colors">
                Passed
              </span>
              <span className="text-muted-foreground tabular-nums">
                ({passedPercent.toFixed(0)}%)
              </span>
            </span>
            <span className="flex items-center gap-1.5 group transition-all duration-200 hover:scale-105 cursor-default">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125"
                style={{
                  background: "var(--status-error)",
                  boxShadow: "0 0 6px var(--status-error)"
                }}
              />
              <span className="stat-value-error font-semibold tabular-nums">{failed.toLocaleString()}</span>
              <span className="text-muted-foreground hidden xs:inline group-hover:text-foreground transition-colors">
                Failed
              </span>
              <span className="text-muted-foreground tabular-nums">
                ({failedPercent.toFixed(0)}%)
              </span>
            </span>
            {skipped > 0 && (
              <span className="flex items-center gap-1.5 group transition-all duration-200 hover:scale-105 cursor-default">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125"
                  style={{ background: "var(--status-muted)" }}
                />
                <span className="text-muted-foreground font-semibold tabular-nums">{skipped.toLocaleString()}</span>
                <span className="text-muted-foreground hidden xs:inline group-hover:text-foreground transition-colors">
                  Skipped
                </span>
                <span className="text-muted-foreground tabular-nums">
                  ({skippedPercent.toFixed(0)}%)
                </span>
              </span>
            )}
            {flaky > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 cursor-help group transition-all duration-200 hover:scale-105">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0 animate-subtle-pulse transition-transform duration-200 group-hover:scale-125"
                      style={{
                        background: "var(--status-warning)",
                        boxShadow: "0 0 6px var(--status-warning)"
                      }}
                    />
                    <span className="stat-value-warning font-semibold tabular-nums">{flaky.toLocaleString()}</span>
                    <span className="text-muted-foreground hidden xs:inline group-hover:text-foreground transition-colors">
                      Flaky
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Flaky tests may also be counted as passed</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Animated progress bar */}
        <div
          className="h-3 rounded-full overflow-hidden flex"
          style={{
            background: "oklch(0.15 0.02 260 / 0.5)",
            boxShadow: "inset 0 1px 2px oklch(0 0 0 / 0.2)"
          }}
        >
          <AnimatedSegment targetWidth={passedPercent} color="var(--status-success)" delay={300} />
          <AnimatedSegment targetWidth={failedPercent} color="var(--status-error)" delay={400} />
          <AnimatedSegment targetWidth={skippedPercent} color="var(--status-muted)" delay={500} />
        </div>
      </div>
    </TooltipProvider>
  )
}
