/**
 * MCP Metric Definitions - Semantic Layer
 *
 * Provides metric definitions that help AI understand:
 * 1. What metrics are available
 * 2. How each metric is calculated (prevents hallucinations)
 * 3. What thresholds indicate healthy/warning/critical states
 */

export type MetricCategory = "execution" | "flakiness" | "performance" | "reliability"
export type MetricType = "percentage" | "count" | "duration" | "score" | "rate"

export interface MetricDefinition {
  id: string
  name: string
  category: MetricCategory
  type: MetricType
  formula: string
  description: string
  unit?: string
  thresholds?: {
    healthy?: number
    warning?: number
    critical?: number
  }
  relatedTools?: string[]
}

/**
 * All metric definitions for the Exolar QA dashboard.
 *
 * These definitions serve as the "semantic layer" that prevents AI hallucinations
 * by explicitly documenting how each metric is calculated.
 */
export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // Execution Metrics
  pass_rate: {
    id: "pass_rate",
    name: "Pass Rate",
    category: "execution",
    type: "percentage",
    formula: "(passed_tests / total_tests) × 100",
    description: "Percentage of tests that passed. Does not include skipped tests in numerator.",
    unit: "%",
    thresholds: {
      healthy: 95,
      warning: 80,
      critical: 0,
    },
    relatedTools: ["get_dashboard_metrics", "get_trends"],
  },
  failure_rate: {
    id: "failure_rate",
    name: "Failure Rate",
    category: "execution",
    type: "percentage",
    formula: "(failed_tests / total_tests) × 100",
    description: "Percentage of tests that failed. Lower is better.",
    unit: "%",
    thresholds: {
      healthy: 0,
      warning: 10,
      critical: 20,
    },
    relatedTools: ["get_dashboard_metrics", "get_failed_tests"],
  },
  total_executions: {
    id: "total_executions",
    name: "Total Executions",
    category: "execution",
    type: "count",
    formula: "COUNT(test_executions) in period",
    description: "Total number of test suite runs in the selected period.",
    relatedTools: ["get_executions", "get_dashboard_metrics"],
  },
  executions_per_day: {
    id: "executions_per_day",
    name: "Executions Per Day",
    category: "execution",
    type: "rate",
    formula: "total_executions / days_in_period",
    description: "Average number of test runs per day.",
    relatedTools: ["get_dashboard_metrics"],
  },

  // Flakiness Metrics
  flaky_rate: {
    id: "flaky_rate",
    name: "Flakiness Rate",
    category: "flakiness",
    type: "percentage",
    formula: "(tests_with_retries / total_tests) × 100",
    description: "Percentage of tests that required retries to pass. Indicates test instability.",
    unit: "%",
    thresholds: {
      healthy: 0,
      warning: 5,
      critical: 15,
    },
    relatedTools: ["get_flaky_tests", "get_flakiness_summary"],
  },
  total_flaky_tests: {
    id: "total_flaky_tests",
    name: "Total Flaky Tests",
    category: "flakiness",
    type: "count",
    formula: "COUNT(tests WHERE flaky_runs > 0)",
    description: "Number of unique tests that have shown flaky behavior.",
    relatedTools: ["get_flaky_tests", "get_flakiness_summary"],
  },
  avg_flakiness_rate: {
    id: "avg_flakiness_rate",
    name: "Average Flakiness Rate",
    category: "flakiness",
    type: "percentage",
    formula: "AVG(flakiness_rate) across all tests with min_runs",
    description: "Average flakiness rate across all tests. Only includes tests with minimum run count.",
    unit: "%",
    relatedTools: ["get_flakiness_summary"],
  },

  // Performance Metrics
  avg_duration: {
    id: "avg_duration",
    name: "Average Duration",
    category: "performance",
    type: "duration",
    formula: "SUM(duration_ms) / COUNT(tests)",
    description: "Average test execution time in milliseconds.",
    unit: "ms",
    relatedTools: ["get_dashboard_metrics", "get_performance_regressions"],
  },
  p95_duration: {
    id: "p95_duration",
    name: "P95 Duration",
    category: "performance",
    type: "duration",
    formula: "PERCENTILE_CONT(0.95) of duration_ms",
    description: "95th percentile of test duration. 95% of tests complete faster than this.",
    unit: "ms",
    relatedTools: ["get_performance_regressions"],
  },
  duration_regression: {
    id: "duration_regression",
    name: "Duration Regression",
    category: "performance",
    type: "percentage",
    formula: "((current_avg - baseline_avg) / baseline_avg) × 100",
    description: "How much slower a test is running compared to its baseline. Positive = slower.",
    unit: "%",
    thresholds: {
      healthy: 0,
      warning: 20,
      critical: 50,
    },
    relatedTools: ["get_performance_regressions", "compare_executions"],
  },

  // Reliability Metrics
  reliability_score: {
    id: "reliability_score",
    name: "Reliability Score",
    category: "reliability",
    type: "score",
    formula: "(PassRate × 40%) + ((100 - FlakyRate) × 30%) + (DurationStability × 30%)",
    description: "Overall test suite health score from 0-100. Combines pass rate, flakiness, and duration stability.",
    unit: "points",
    thresholds: {
      healthy: 80,
      warning: 60,
      critical: 0,
    },
    relatedTools: ["get_reliability_score"],
  },
  duration_stability: {
    id: "duration_stability",
    name: "Duration Stability",
    category: "reliability",
    type: "percentage",
    formula: "100 - (coefficient_of_variation × 100), capped at 0-100",
    description: "How consistent test durations are. Higher = more stable. Based on coefficient of variation.",
    unit: "%",
    relatedTools: ["get_reliability_score"],
  },
}

/**
 * Get all metrics by category
 */
export function getMetricsByCategory(category?: MetricCategory): MetricDefinition[] {
  const metrics = Object.values(METRIC_DEFINITIONS)
  if (!category || category === ("all" as MetricCategory)) {
    return metrics
  }
  return metrics.filter((m) => m.category === category)
}

/**
 * Get a single metric definition by ID
 */
export function getMetricDefinition(metricId: string): MetricDefinition | undefined {
  return METRIC_DEFINITIONS[metricId]
}

/**
 * Format metric definition as human-readable text
 */
export function formatMetricDefinitionText(metric: MetricDefinition): string {
  let text = `**${metric.name}** (${metric.id})\n\n`
  text += `${metric.description}\n\n`
  text += `**Formula:** ${metric.formula}\n`

  if (metric.unit) {
    text += `**Unit:** ${metric.unit}\n`
  }

  if (metric.thresholds) {
    text += `\n**Thresholds:**\n`
    if (metric.thresholds.healthy !== undefined) {
      text += `- Healthy: ${metric.type === "percentage" || metric.id === "reliability_score" ? "≥" : "≤"} ${metric.thresholds.healthy}${metric.unit || ""}\n`
    }
    if (metric.thresholds.warning !== undefined) {
      text += `- Warning: ${metric.thresholds.warning}${metric.unit || ""}\n`
    }
    if (metric.thresholds.critical !== undefined) {
      text += `- Critical: ${metric.type === "percentage" || metric.id === "reliability_score" ? "<" : ">"} ${metric.thresholds.critical}${metric.unit || ""}\n`
    }
  }

  if (metric.relatedTools && metric.relatedTools.length > 0) {
    text += `\n**Related Tools:** ${metric.relatedTools.join(", ")}\n`
  }

  return text
}

/**
 * Get available categories
 */
export function getCategories(): { id: MetricCategory; name: string; description: string }[] {
  return [
    { id: "execution", name: "Execution Metrics", description: "Pass/fail rates and execution counts" },
    { id: "flakiness", name: "Flakiness Metrics", description: "Test stability and retry patterns" },
    { id: "performance", name: "Performance Metrics", description: "Duration and speed analysis" },
    { id: "reliability", name: "Reliability Metrics", description: "Overall suite health scores" },
  ]
}
