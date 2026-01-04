"use client"

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Hash,
  XCircle,
  CheckCircle2,
} from "lucide-react"
import type { ComparisonSummary } from "@/lib/types"

interface DeltaDisplayProps {
  value: number
  suffix?: string
  invertColors?: boolean
}

function DeltaDisplay({ value, suffix = "", invertColors = false }: DeltaDisplayProps) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-4 w-4" />
        <span>0{suffix}</span>
      </span>
    )
  }

  const isPositive = value > 0
  // For duration, positive is bad (slower). For pass rate, positive is good.
  const isGood = invertColors ? !isPositive : isPositive
  const Icon = isPositive ? TrendingUp : TrendingDown
  const colorClass = isGood ? "text-green-400" : "text-red-400"

  return (
    <span className={`flex items-center gap-1 ${colorClass}`}>
      <Icon className="h-4 w-4" />
      <span>
        {isPositive ? "+" : ""}
        {value}
        {suffix}
      </span>
    </span>
  )
}

interface ComparisonSummaryCardsProps {
  summary: ComparisonSummary
}

export function ComparisonSummaryCards({ summary }: ComparisonSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Pass Rate Delta */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Pass Rate</span>
        </div>
        <div className="text-2xl font-bold">
          <DeltaDisplay value={summary.passRateDelta} suffix="%" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {summary.baselinePassRate}% → {summary.currentPassRate}%
        </p>
      </div>

      {/* Duration Delta */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Clock className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Duration</span>
        </div>
        <div className="text-2xl font-bold">
          <DeltaDisplay value={summary.durationDeltaPercent} suffix="%" invertColors />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDuration(summary.baselineAvgDurationMs)} → {formatDuration(summary.currentAvgDurationMs)}
        </p>
      </div>

      {/* Test Count Delta */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Hash className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Test Count</span>
        </div>
        <div className="text-2xl font-bold">
          <DeltaDisplay value={summary.testCountDelta} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {summary.newTests > 0 && <span className="text-blue-400">+{summary.newTests} new</span>}
          {summary.newTests > 0 && summary.removedTests > 0 && ", "}
          {summary.removedTests > 0 && <span className="text-gray-400">-{summary.removedTests} removed</span>}
          {summary.newTests === 0 && summary.removedTests === 0 && "No changes"}
        </p>
      </div>

      {/* Status Changes */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Status Changes</span>
        </div>
        <div className="flex items-center gap-3">
          {summary.fixed > 0 && (
            <div className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-xl font-bold">{summary.fixed}</span>
            </div>
          )}
          {summary.newFailures > 0 && (
            <div className="flex items-center gap-1 text-red-400">
              <XCircle className="h-5 w-5" />
              <span className="text-xl font-bold">{summary.newFailures}</span>
            </div>
          )}
          {summary.fixed === 0 && summary.newFailures === 0 && (
            <span className="text-xl font-bold text-muted-foreground">—</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {summary.fixed > 0 && <span className="text-green-400">{summary.fixed} fixed</span>}
          {summary.fixed > 0 && summary.newFailures > 0 && ", "}
          {summary.newFailures > 0 && <span className="text-red-400">{summary.newFailures} new failures</span>}
          {summary.fixed === 0 && summary.newFailures === 0 && "No status changes"}
        </p>
      </div>
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}
