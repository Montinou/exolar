"use client"

interface TestSummaryBarProps {
  total: number
  passed: number
  failed: number
  flaky: number
}

export function TestSummaryBar({ total, passed, failed, flaky }: TestSummaryBarProps) {
  // Prevent division by zero
  if (total === 0) {
    return (
      <div className="glass-card p-4">
        <p className="text-center text-muted-foreground">No test data available</p>
      </div>
    )
  }

  const passedPercent = (passed / total) * 100
  const failedPercent = (failed / total) * 100
  const flakyPercent = (flaky / total) * 100

  return (
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
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: "var(--status-warning)" }}
            />
            <span className="stat-value-warning font-semibold">{flaky}</span>
            <span className="text-muted-foreground hidden xs:inline">
              Flaky
            </span>
            <span className="text-muted-foreground">
              ({flakyPercent.toFixed(0)}%)
            </span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
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
        {flakyPercent > 0 && (
          <div
            className="progress-segment h-full transition-all duration-500"
            style={{
              width: `${flakyPercent}%`,
              background: "var(--status-warning)",
            }}
          />
        )}
      </div>
    </div>
  )
}
