"use client"

import { useState, useMemo } from "react"
import {
  Zap,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import type { TestComparisonItem } from "@/lib/types"

interface PerformanceSummary {
  regressions: number
  improvements: number
  stable: number
  threshold_pct: number
}

interface PerformanceInsightsCardProps {
  /** Array of test comparison results */
  tests: TestComparisonItem[]
  /** Performance summary from API */
  performanceSummary: PerformanceSummary
  /** Callback to filter test diff table to show only regressions */
  onFilterRegressions?: () => void
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

/**
 * Format percentage delta with sign
 */
function formatDelta(percent: number | null): string {
  if (percent === null || percent === undefined) return "—"
  const sign = percent > 0 ? "+" : ""
  return `${sign}${Math.round(percent)}%`
}

export function PerformanceInsightsCard({
  tests,
  performanceSummary,
  onFilterRegressions,
}: PerformanceInsightsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Get tests with performance changes (memoized and sorted)
  const regressions = useMemo(() => 
    tests
      .filter((t) => t.durationCategory === "regression")
      .sort((a, b) => (b.durationDeltaPercent || 0) - (a.durationDeltaPercent || 0)),
    [tests]
  )
  
  const improvements = useMemo(() =>
    tests
      .filter((t) => t.durationCategory === "improvement")
      .sort((a, b) => (a.durationDeltaPercent || 0) - (b.durationDeltaPercent || 0)),
    [tests]
  )

  const hasChanges = regressions.length > 0 || improvements.length > 0

  // Auto-expand if there are regressions (important to surface)
  const shouldAutoExpand = regressions.length > 0

  // Use auto-expand state for initial render, but allow manual toggle
  const effectiveExpanded = isExpanded || (shouldAutoExpand && !isExpanded)

  // Don't render if no significant changes
  if (!hasChanges) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Zap className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm">No significant performance changes detected</span>
          <span className="text-xs">
            (threshold: ±{performanceSummary.threshold_pct}%)
          </span>
        </div>
      </div>
    )
  }

  const panelId = "performance-insights-panel"
  const headingId = "performance-insights-heading"

  return (
    <div className="glass-card overflow-hidden">
      {/* Header - clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!effectiveExpanded || !isExpanded ? !isExpanded : false)}
        aria-expanded={effectiveExpanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-[oklch(0.75_0.15_195)]" aria-hidden="true" />
          <div>
            <h3 id={headingId} className="font-medium">Performance Impact</h3>
            <p className="text-sm text-muted-foreground">
              {regressions.length > 0 && (
                <span className="text-red-400">
                  {regressions.length} regression{regressions.length !== 1 ? "s" : ""}
                </span>
              )}
              {regressions.length > 0 && improvements.length > 0 && " • "}
              {improvements.length > 0 && (
                <span className="text-green-400">
                  {improvements.length} improvement{improvements.length !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick stats badges */}
          <div className="flex items-center gap-2">
            {regressions.length > 0 && (
              <div 
                className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1"
                aria-label={`${regressions.length} performance regressions`}
              >
                <TrendingUp className="h-3 w-3 text-red-400" aria-hidden="true" />
                <span className="text-sm font-medium text-red-400">
                  {regressions.length}
                </span>
              </div>
            )}
            {improvements.length > 0 && (
              <div 
                className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1"
                aria-label={`${improvements.length} performance improvements`}
              >
                <TrendingDown className="h-3 w-3 text-green-400" aria-hidden="true" />
                <span className="text-sm font-medium text-green-400">
                  {improvements.length}
                </span>
              </div>
            )}
          </div>
          {effectiveExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {effectiveExpanded && (
        <div 
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="border-t border-border/50"
        >
          {/* Regressions Section */}
          {regressions.length > 0 && (
            <div className="p-4 border-b border-border/30">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />
                <h4 className="font-medium text-red-400">
                  Slowest Tests ({regressions.length} tests slower by ≥{performanceSummary.threshold_pct}%)
                </h4>
              </div>
              <div className="space-y-2" role="list">
                {regressions.slice(0, 5).map((test) => (
                  <div
                    key={test.testSignature}
                    role="listitem"
                    className="flex items-center justify-between rounded-md bg-red-500/5 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{test.testName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {test.testFile}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(test.baselineDurationMs)} → {formatDuration(test.currentDurationMs)}
                        </p>
                      </div>
                      <span 
                        className="rounded bg-red-500/20 px-2 py-0.5 text-sm font-medium text-red-400"
                        aria-label={`${formatDelta(test.durationDeltaPercent)} slower`}
                      >
                        {formatDelta(test.durationDeltaPercent)}
                      </span>
                    </div>
                  </div>
                ))}
                {regressions.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground pt-2">
                    +{regressions.length - 5} more regressions
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Improvements Section */}
          {improvements.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-400" aria-hidden="true" />
                <h4 className="font-medium text-green-400">
                  Fastest Improvements ({improvements.length} tests faster by ≥{performanceSummary.threshold_pct}%)
                </h4>
              </div>
              <div className="space-y-2" role="list">
                {improvements.slice(0, 5).map((test) => (
                  <div
                    key={test.testSignature}
                    role="listitem"
                    className="flex items-center justify-between rounded-md bg-green-500/5 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{test.testName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {test.testFile}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(test.baselineDurationMs)} → {formatDuration(test.currentDurationMs)}
                        </p>
                      </div>
                      <span 
                        className="rounded bg-green-500/20 px-2 py-0.5 text-sm font-medium text-green-400"
                        aria-label={`${formatDelta(test.durationDeltaPercent)} faster`}
                      >
                        {formatDelta(test.durationDeltaPercent)}
                      </span>
                    </div>
                  </div>
                ))}
                {improvements.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground pt-2">
                    +{improvements.length - 5} more improvements
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Filter button */}
          {regressions.length > 0 && onFilterRegressions && (
            <div className="border-t border-border/50 p-3">
              <button
                onClick={onFilterRegressions}
                className="w-full rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Show only performance regressions in diff table
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
