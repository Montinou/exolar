"use client"

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

export function TestSummaryBar({ total, passed, failed, skipped, flaky }: TestSummaryBarProps) {
  // Prevent division by zero
  if (total === 0) {
    return (
      <div className="glass-card p-4">
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
      <div className="glass-card p-4 space-y-3">
        {/* Header with counts */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
          <span className="font-medium">
            Total: <span className="text-foreground">{total}</span>
          </span>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: "var(--status-success)" }}
              />
              <span className="stat-value-success font-semibold">{passed}</span>
              <span className="text-muted-foreground hidden xs:inline">
                Passed
              </span>
              <span className="text-muted-foreground">
                ({passedPercent.toFixed(0)}%)
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: "var(--status-error)" }}
              />
              <span className="stat-value-error font-semibold">{failed}</span>
              <span className="text-muted-foreground hidden xs:inline">
                Failed
              </span>
              <span className="text-muted-foreground">
                ({failedPercent.toFixed(0)}%)
              </span>
            </span>
            {skipped > 0 && (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: "var(--status-muted)" }}
                />
                <span className="text-muted-foreground font-semibold">{skipped}</span>
                <span className="text-muted-foreground hidden xs:inline">
                  Skipped
                </span>
                <span className="text-muted-foreground">
                  ({skippedPercent.toFixed(0)}%)
                </span>
              </span>
            )}
            {flaky > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: "var(--status-warning)" }}
                    />
                    <span className="stat-value-warning font-semibold">{flaky}</span>
                    <span className="text-muted-foreground hidden xs:inline">
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

        {/* Progress bar - shows only mutually exclusive categories (Passed/Failed/Skipped) */}
        <div className="h-3 rounded-full overflow-hidden flex bg-muted/30">
          {passedPercent > 0 && (
            <div
              className="progress-segment h-full transition-all duration-500"
              style={{
                width: `${passedPercent}%`,
                background: "var(--status-success)",
              }}
            />
          )}
          {failedPercent > 0 && (
            <div
              className="progress-segment h-full transition-all duration-500"
              style={{
                width: `${failedPercent}%`,
                background: "var(--status-error)",
              }}
            />
          )}
          {skippedPercent > 0 && (
            <div
              className="progress-segment h-full transition-all duration-500"
              style={{
                width: `${skippedPercent}%`,
                background: "var(--status-muted)",
              }}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
