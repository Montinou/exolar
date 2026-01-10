/**
 * Analytics Layer - Headless Pattern
 *
 * Shared business logic for metrics that can be used by:
 * - MCP server tools
 * - API routes
 * - Server components
 *
 * This is the single source of truth for metric calculations.
 */

import * as db from "@/lib/db"
import {
  METRIC_DEFINITIONS,
  getMetricsByCategory,
  getMetricDefinition as getDefinition,
  formatMetricDefinitionText,
  type MetricCategory,
  type MetricDefinition,
} from "@/lib/mcp/definitions"

// Re-export definitions for convenience
export { METRIC_DEFINITIONS, type MetricDefinition, type MetricCategory }

export type DateRangePreset = "last_24h" | "last_7d" | "last_30d" | "last_90d" | "ytd" | "custom"
export type Granularity = "hour" | "day" | "week" | "month" | "total"
export type GroupBy = "branch" | "suite" | "none"

export interface QueryMetricOptions {
  dateRange?: DateRangePreset
  from?: string
  to?: string
  granularity?: Granularity
  groupBy?: GroupBy
  branch?: string
  suite?: string
  lastRunOnly?: boolean
}

export interface MetricDataPoint {
  period: string
  value: number
  delta?: number
  group?: string
}

export interface MetricResult {
  metricId: string
  metricName: string
  category: MetricCategory
  type: string
  data: MetricDataPoint[]
  summary: {
    current: number
    previous?: number
    change?: number
    changePercent?: number
    trend?: "improving" | "declining" | "stable"
  }
  filters: {
    dateRange: string
    granularity: string
    branch?: string
    suite?: string
  }
}

export interface ComparisonResult {
  metricId: string
  metricName: string
  primary: {
    range: string
    value: number
  }
  secondary: {
    range: string
    value: number
  }
  change: number
  changePercent: number
  trend: "improving" | "declining" | "stable"
  insight: string
}

/**
 * Convert date range preset to actual dates
 */
function resolveDateRange(preset: DateRangePreset, from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date()
  const toDate = to ? new Date(to) : now

  if (preset === "custom" && from) {
    return { from: new Date(from), to: toDate }
  }

  let fromDate: Date
  switch (preset) {
    case "last_24h":
      fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case "last_7d":
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "last_30d":
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "last_90d":
      fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case "ytd":
      fromDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }

  return { from: fromDate, to: toDate }
}

/**
 * Get previous period for comparison
 */
function getPreviousPeriod(preset: DateRangePreset): DateRangePreset {
  switch (preset) {
    case "last_24h":
      return "last_24h" // Previous 24h
    case "last_7d":
      return "last_7d" // Previous 7d
    case "last_30d":
      return "last_30d" // Previous 30d
    case "last_90d":
      return "last_90d" // Previous 90d
    default:
      return "last_7d"
  }
}

/**
 * List available metrics with optional category filter
 */
export function listAvailableMetrics(category?: MetricCategory | "all"): MetricDefinition[] {
  return getMetricsByCategory(category === "all" ? undefined : category)
}

/**
 * Get definition for a specific metric
 */
export function getMetricDefinitionText(metricId: string): string | null {
  const definition = getDefinition(metricId)
  if (!definition) {
    return null
  }
  return formatMetricDefinitionText(definition)
}

/**
 * Query a specific metric with flexible options
 */
export async function queryMetric(
  orgId: number,
  metricId: string,
  options: QueryMetricOptions = {}
): Promise<MetricResult | null> {
  const definition = METRIC_DEFINITIONS[metricId]
  if (!definition) {
    return null
  }

  const dateRange = options.dateRange || "last_7d"
  const { from, to } = resolveDateRange(dateRange, options.from, options.to)
  const granularity = options.granularity || "total"

  // Build result based on metric type
  let data: MetricDataPoint[] = []
  let currentValue: number = 0

  switch (metricId) {
    case "pass_rate":
    case "failure_rate": {
      if (granularity === "total") {
        const metrics = await db.getDashboardMetrics(orgId, {
          from: from.toISOString(),
          to: to.toISOString(),
          branch: options.branch,
          suite: options.suite,
          lastRunOnly: options.lastRunOnly,
        })
        currentValue = metricId === "pass_rate" ? metrics.pass_rate : metrics.failure_rate
        data = [{ period: "total", value: currentValue }]
      } else {
        const trends = await db.getTrendData(orgId, {
          period: granularity,
          from: from.toISOString(),
          to: to.toISOString(),
        })
        data = trends.map((t, i) => ({
          period: t.period,
          value: t.pass_rate,
          delta: i < trends.length - 1 ? t.pass_rate - trends[i + 1].pass_rate : undefined,
        }))
        currentValue = data[0]?.value ?? 0
      }
      break
    }

    case "total_executions":
    case "executions_per_day": {
      const metrics = await db.getDashboardMetrics(orgId, {
        from: from.toISOString(),
        to: to.toISOString(),
        branch: options.branch,
        suite: options.suite,
      })
      currentValue =
        metricId === "total_executions" ? metrics.total_executions : metrics.executions_per_day
      data = [{ period: "total", value: currentValue }]
      break
    }

    case "flaky_rate":
    case "total_flaky_tests":
    case "avg_flakiness_rate": {
      const summary = await db.getFlakinessSummary(orgId)
      if (metricId === "flaky_rate" || metricId === "avg_flakiness_rate") {
        currentValue = summary.average_flakiness_rate
      } else {
        currentValue = summary.total_flaky_tests
      }
      data = [{ period: "total", value: currentValue }]
      break
    }

    case "avg_duration": {
      const metrics = await db.getDashboardMetrics(orgId, {
        from: from.toISOString(),
        to: to.toISOString(),
        branch: options.branch,
        suite: options.suite,
      })
      currentValue = metrics.avg_duration_ms
      data = [{ period: "total", value: currentValue }]
      break
    }

    case "reliability_score": {
      const score = await db.getReliabilityScore(orgId, {
        from: from.toISOString(),
        to: to.toISOString(),
        branch: options.branch,
        suite: options.suite,
        lastRunOnly: options.lastRunOnly,
      })
      currentValue = score.score
      data = [{ period: "total", value: currentValue }]
      break
    }

    default:
      return null
  }

  // Calculate comparison with previous period
  let previousValue: number | undefined
  let change: number | undefined
  let changePercent: number | undefined
  let trend: "improving" | "declining" | "stable" | undefined

  if (granularity === "total" && data.length > 0) {
    // Get previous period data for comparison
    const prevPreset = getPreviousPeriod(dateRange)
    const { from: prevFrom, to: prevTo } = resolveDateRange(prevPreset)
    // Shift to previous period
    const periodMs = to.getTime() - from.getTime()
    const shiftedFrom = new Date(from.getTime() - periodMs)
    const shiftedTo = new Date(from.getTime())

    try {
      const prevMetrics = await db.getDashboardMetrics(orgId, {
        from: shiftedFrom.toISOString(),
        to: shiftedTo.toISOString(),
        branch: options.branch,
        suite: options.suite,
      })

      if (metricId === "pass_rate") {
        previousValue = prevMetrics.pass_rate
      } else if (metricId === "failure_rate") {
        previousValue = prevMetrics.failure_rate
      } else if (metricId === "avg_duration") {
        previousValue = prevMetrics.avg_duration_ms
      } else if (metricId === "total_executions") {
        previousValue = prevMetrics.total_executions
      }

      if (previousValue !== undefined) {
        change = currentValue - previousValue
        changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0

        // Determine trend based on metric type
        const isHigherBetter = ["pass_rate", "reliability_score"].includes(metricId)
        const isLowerBetter = ["failure_rate", "flaky_rate", "avg_duration"].includes(metricId)

        if (Math.abs(change) < 0.1) {
          trend = "stable"
        } else if (isHigherBetter) {
          trend = change > 0 ? "improving" : "declining"
        } else if (isLowerBetter) {
          trend = change < 0 ? "improving" : "declining"
        } else {
          trend = "stable"
        }
      }
    } catch {
      // Ignore errors getting previous period
    }
  }

  return {
    metricId,
    metricName: definition.name,
    category: definition.category,
    type: definition.type,
    data,
    summary: {
      current: currentValue,
      previous: previousValue,
      change,
      changePercent,
      trend,
    },
    filters: {
      dateRange,
      granularity,
      branch: options.branch,
      suite: options.suite,
    },
  }
}

/**
 * Compare a metric between two time periods
 */
export async function comparePeriods(
  orgId: number,
  metricId: string,
  primaryRange: DateRangePreset,
  secondaryRange: DateRangePreset,
  options: { branch?: string; suite?: string } = {}
): Promise<ComparisonResult | null> {
  const definition = METRIC_DEFINITIONS[metricId]
  if (!definition) {
    return null
  }

  // Get primary period value
  const primaryResult = await queryMetric(orgId, metricId, {
    dateRange: primaryRange,
    branch: options.branch,
    suite: options.suite,
  })

  if (!primaryResult) {
    return null
  }

  // Calculate secondary period dates (shift back by primary period length)
  const primaryDates = resolveDateRange(primaryRange)
  const periodMs = primaryDates.to.getTime() - primaryDates.from.getTime()
  const secondaryFrom = new Date(primaryDates.from.getTime() - periodMs)
  const secondaryTo = new Date(primaryDates.from.getTime())

  // Get secondary period value
  const secondaryResult = await queryMetric(orgId, metricId, {
    dateRange: "custom",
    from: secondaryFrom.toISOString(),
    to: secondaryTo.toISOString(),
    branch: options.branch,
    suite: options.suite,
  })

  if (!secondaryResult) {
    return null
  }

  const primaryValue = primaryResult.summary.current
  const secondaryValue = secondaryResult.summary.current
  const change = primaryValue - secondaryValue
  const changePercent = secondaryValue !== 0 ? (change / secondaryValue) * 100 : 0

  // Determine trend
  const isHigherBetter = ["pass_rate", "reliability_score"].includes(metricId)
  const isLowerBetter = ["failure_rate", "flaky_rate", "avg_duration"].includes(metricId)

  let trend: "improving" | "declining" | "stable"
  if (Math.abs(change) < 0.1) {
    trend = "stable"
  } else if (isHigherBetter) {
    trend = change > 0 ? "improving" : "declining"
  } else if (isLowerBetter) {
    trend = change < 0 ? "improving" : "declining"
  } else {
    trend = "stable"
  }

  // Generate insight
  let insight: string
  const metricName = definition.name.toLowerCase()
  const changeStr = `${change >= 0 ? "+" : ""}${change.toFixed(1)}${definition.type === "percentage" ? " percentage points" : ""}`

  if (trend === "stable") {
    insight = `${definition.name} remained stable at ${primaryValue.toFixed(1)}${definition.unit || ""}.`
  } else if (trend === "improving") {
    insight = `${definition.name} improved by ${Math.abs(changePercent).toFixed(1)}% (${changeStr}).`
  } else {
    insight = `${definition.name} declined by ${Math.abs(changePercent).toFixed(1)}% (${changeStr}). Consider investigating.`
  }

  return {
    metricId,
    metricName: definition.name,
    primary: {
      range: primaryRange,
      value: primaryValue,
    },
    secondary: {
      range: secondaryRange.replace("last_", "previous_"),
      value: secondaryValue,
    },
    change,
    changePercent,
    trend,
    insight,
  }
}
