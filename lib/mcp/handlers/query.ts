/**
 * Handler: query_exolar_data
 *
 * Router Universal de Lectura - El corazón del patrón Router.
 * Reemplaza 15 tools de lectura con un único dispatcher por dataset.
 */

import { z } from "zod"
import type { MCPAuthContext } from "../auth"
import * as db from "@/lib/db"
import {
  formatExecutions,
  formatFlakyTests,
  formatMetricValue,
  formatTimeSeries,
  type OutputFormat,
} from "@/lib/mcp/formatters"

const QueryInputSchema = z.object({
  dataset: z.enum([
    "executions",
    "execution_details",
    "failures",
    "flaky_tests",
    "trends",
    "dashboard_stats",
    "error_analysis",
    "test_search",
    "test_history",
    "flakiness_summary",
    "reliability_score",
    "performance_regressions",
    "execution_summary",
    "execution_failures",
    "setup_guide", // NEW: Integration Engineer persona CI/CD setup guide
  ]),
  filters: z
    .object({
      branch: z.string().optional(),
      suite: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      date_range: z.enum(["last_24h", "last_7d", "last_30d", "last_90d"]).optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
      execution_id: z.number().optional(),
      test_signature: z.string().optional(),
      query: z.string().optional(),
      status: z.string().optional(),
      run_id: z.string().optional(),
      error_type: z.string().optional(),
      min_runs: z.number().optional(),
      include_resolved: z.boolean().optional(),
      group_by: z.string().optional(),
      period: z.enum(["hour", "day", "week", "month"]).optional(),
      count: z.number().optional(),
      threshold: z.number().optional(),
      hours: z.number().optional(),
      sort_by: z.string().optional(),
      include_artifacts: z.boolean().optional(),
      include_retries: z.boolean().optional(),
      include_stack_traces: z.boolean().optional(),
      lastRunOnly: z.boolean().optional(),
      // NEW: Setup guide filters
      ci_provider: z.enum(["github", "local"]).optional(), // Focus on GitHub Actions (v2.1)
      framework: z.enum(["playwright"]).optional().default("playwright"),
      monorepo: z.boolean().optional(),
      section: z.enum(["api_endpoint", "playwright_reporter", "github_actions", "env_variables", "all"]).optional(),
    })
    .optional()
    .default({}),
  view_mode: z.enum(["list", "summary", "detailed"]).optional().default("list"),
  format: z.enum(["json", "markdown"]).optional().default("markdown"),
})

export type QueryInput = z.infer<typeof QueryInputSchema>

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

export async function handleQuery(
  args: Record<string, unknown>,
  authContext: MCPAuthContext
): Promise<ToolResponse> {
  const input = QueryInputSchema.parse(args)
  const orgId = authContext.organizationId
  const f = input.filters
  const format: OutputFormat = input.format

  try {
    switch (input.dataset) {
      // ============================================
      // Executions
      // ============================================
      case "executions": {
        const executions = await db.getExecutions(
          orgId,
          f.limit ?? 20,
          f.offset ?? 0,
          f.status as "success" | "failure" | "running" | undefined,
          f.branch,
          f.from && f.to ? { from: f.from, to: f.to } : undefined,
          f.suite,
          f.run_id
        )

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "executions",
            count: executions.length,
            pagination: { offset: f.offset ?? 0, limit: f.limit ?? 20, has_more: executions.length === (f.limit ?? 20) },
            data: executions,
          })
        }

        const output = formatExecutions(
          executions as Array<{
            id: number
            branch: string
            status: string
            passed_count?: number
            failed_count?: number
            duration_ms?: number
            started_at: string
          }>,
          "markdown"
        )

        return textResponse(
          `## Test Executions (${executions.length} results)\n\n${output}${executions.length === (f.limit ?? 20) ? "\n\n_More results available, use offset filter_" : ""}`
        )
      }

      case "execution_details": {
        if (!f.execution_id) {
          return errorResponse("execution_details requires filters.execution_id")
        }

        const execution = await db.getExecutionById(orgId, f.execution_id)
        if (!execution) {
          return errorResponse("Execution not found or access denied")
        }

        const allResults = await db.getTestResultsByExecutionId(orgId, f.execution_id)
        const statusFilter = f.status as "passed" | "failed" | "skipped" | undefined
        const filteredResults = statusFilter
          ? allResults.filter((r) => r.status === statusFilter)
          : allResults

        const outputResults =
          f.include_artifacts !== false
            ? filteredResults
            : filteredResults.map((r) => ({ ...r, artifacts: null }))

        return jsonResponse({
          organization: authContext.organizationSlug,
          dataset: "execution_details",
          execution,
          filter: { status: f.status || "all", include_artifacts: f.include_artifacts !== false },
          test_results: outputResults,
          summary: {
            total: allResults.length,
            passed: allResults.filter((r) => r.status === "passed").length,
            failed: allResults.filter((r) => r.status === "failed").length,
            skipped: allResults.filter((r) => r.status === "skipped").length,
            filtered_count: outputResults.length,
          },
        })
      }

      // ============================================
      // Failures & Errors
      // ============================================
      case "failures": {
        const failures = await db.getFailuresWithAIContext(orgId, {
          executionId: f.execution_id,
          errorType: f.error_type,
          testFile: f.query, // Reuse query as file filter
          limit: f.limit ?? 20,
          offset: f.offset ?? 0,
          since: f.from,
          runId: f.run_id,
          requireAIContext: !!f.error_type,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "failures",
            execution_id: f.execution_id,
            count: failures.length,
            pagination: { offset: f.offset ?? 0, limit: f.limit ?? 20, has_more: failures.length === (f.limit ?? 20) },
            data: failures,
          })
        }

        // Markdown format
        let output = `## Failed Tests (${failures.length} results)\n\n`
        output += "| Test | File | Error | Duration |\n"
        output += "|------|------|-------|----------|\n"
        for (const fail of failures.slice(0, 20)) {
          const name = (fail.test_name || "").slice(0, 30)
          const file = (fail.test_file || "").split("/").pop()?.slice(0, 20) || ""
          const error = (fail.error_message || "").slice(0, 40).replace(/\|/g, "\\|")
          output += `| ${name} | ${file} | ${error}... | ${fail.duration_ms}ms |\n`
        }

        return textResponse(output)
      }

      case "error_analysis": {
        const distribution = await db.getErrorTypeDistribution(orgId, {
          since: f.from,
          branch: f.branch,
          suite: f.suite,
          limit: f.limit ?? 10,
          groupBy: (f.group_by as "error_type" | "file" | "branch") || "error_type",
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "error_analysis",
            group_by: f.group_by || "error_type",
            count: distribution.length,
            data: distribution,
          })
        }

        let output = `## Error Distribution (by ${f.group_by || "error_type"})\n\n`
        output += "| Error Pattern | Count | % |\n"
        output += "|---------------|-------|---|\n"
        const total = distribution.reduce((s, e) => s + e.count, 0)
        for (const e of distribution) {
          const pct = total > 0 ? ((e.count / total) * 100).toFixed(1) : "0"
          output += `| ${e.error_pattern.slice(0, 50)} | ${e.count} | ${pct}% |\n`
        }

        return textResponse(output)
      }

      // ============================================
      // Flakiness
      // ============================================
      case "flaky_tests": {
        const flakyTests = await db.getFlakiestTests(orgId, {
          limit: f.limit ?? 10,
          minRuns: f.min_runs ?? 5,
          since: f.from,
          branch: f.branch,
          includeResolved: f.include_resolved ?? false,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "flaky_tests",
            count: flakyTests.length,
            filters: { branch: f.branch || "all", include_resolved: f.include_resolved ?? false },
            data: flakyTests,
          })
        }

        const output = formatFlakyTests(
          flakyTests as Array<{
            test_name: string
            test_file: string
            flakiness_rate: number
            total_runs: number
            flaky_runs: number
          }>,
          "markdown"
        )

        return textResponse(`## Flaky Tests (${flakyTests.length} results)\n\n${output}`)
      }

      case "flakiness_summary": {
        const summary = await db.getFlakinessSummary(orgId)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "flakiness_summary",
            ...summary,
          })
        }

        let output = "## Flakiness Summary\n\n"
        output += `- **Total Flaky Tests:** ${summary.totalFlakyTests}\n`
        output += `- **Average Flakiness Rate:** ${summary.averageFlakinessRate?.toFixed(1) || 0}%\n`
        output += `- **Tests Analyzed:** ${summary.testsAnalyzed}\n`

        if (summary.worstOffenders && summary.worstOffenders.length > 0) {
          output += "\n### Worst Offenders\n\n"
          output += "| Test | Flaky % |\n"
          output += "|------|--------|\n"
          for (const t of summary.worstOffenders.slice(0, 5)) {
            output += `| ${t.test_name.slice(0, 40)} | ${t.flakiness_rate.toFixed(1)}% |\n`
          }
        }

        return textResponse(output)
      }

      // ============================================
      // Trends & Metrics
      // ============================================
      case "trends": {
        const period = f.period || "day"
        const count = f.count ?? 7

        const maxCounts: Record<string, number> = { hour: 168, day: 90, week: 52, month: 24 }
        if (count > maxCounts[period]) {
          return errorResponse(`count exceeds maximum for ${period} period (max: ${maxCounts[period]})`)
        }

        const trends = await db.getTrendData(orgId, {
          period,
          count,
          from: f.from,
          to: f.to,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "trends",
            period,
            count: trends.length,
            data: trends,
          })
        }

        const output = formatTimeSeries(
          trends.map((t) => ({
            period: t.period,
            value: t.pass_rate || 0,
            delta: undefined,
          })),
          "Pass Rate Trend",
          "percentage",
          "markdown"
        )

        return textResponse(output)
      }

      case "dashboard_stats": {
        const metrics = await db.getDashboardMetrics(orgId, {
          from: f.from,
          to: f.to,
          branch: f.branch,
          suite: f.suite,
          lastRunOnly: f.lastRunOnly,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "dashboard_stats",
            filters: { branch: f.branch, suite: f.suite, lastRunOnly: f.lastRunOnly },
            data: metrics,
          })
        }

        let output = "## Dashboard Metrics\n\n"
        output += `| Metric | Value |\n`
        output += `|--------|-------|\n`
        output += `| Total Executions | ${metrics.totalExecutions} |\n`
        output += `| Pass Rate | ${metrics.passRate?.toFixed(1) || 0}% |\n`
        output += `| Failure Rate | ${metrics.failureRate?.toFixed(1) || 0}% |\n`
        output += `| Avg Duration | ${formatMetricValue(metrics.avgDuration, "duration", "markdown")} |\n`

        return textResponse(output)
      }

      // ============================================
      // Search & History
      // ============================================
      case "test_search": {
        if (!f.query) {
          return errorResponse("test_search requires filters.query (min 2 chars)")
        }

        const tests = await db.searchTests(orgId, f.query, f.limit ?? 20, f.offset ?? 0)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "test_search",
            query: f.query,
            count: tests.length,
            pagination: { offset: f.offset ?? 0, limit: f.limit ?? 20, has_more: tests.length === (f.limit ?? 20) },
            data: tests,
          })
        }

        let output = `## Test Search: "${f.query}" (${tests.length} results)\n\n`
        output += "| Test | File | Runs | Pass Rate |\n"
        output += "|------|------|------|----------|\n"
        for (const t of tests) {
          const name = (t.test_name || "").slice(0, 35)
          const file = (t.test_file || "").split("/").pop()?.slice(0, 20) || ""
          output += `| ${name} | ${file} | ${t.run_count} | ${t.pass_rate?.toFixed(1) || 0}% |\n`
        }

        return textResponse(output)
      }

      case "test_history": {
        if (!f.test_signature) {
          return errorResponse("test_history requires filters.test_signature")
        }

        const history = await db.getTestHistory(orgId, f.test_signature, f.limit ?? 20, f.offset ?? 0)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "test_history",
            test_signature: f.test_signature,
            count: history.length,
            pagination: { offset: f.offset ?? 0, limit: f.limit ?? 20, has_more: history.length === (f.limit ?? 20) },
            data: history,
          })
        }

        let output = `## Test History (${history.length} runs)\n\n`
        output += "| Execution | Status | Duration | Branch |\n"
        output += "|-----------|--------|----------|--------|\n"
        for (const h of history) {
          output += `| ${h.execution_id} | ${h.status} | ${h.duration_ms}ms | ${h.branch || "?"} |\n`
        }

        return textResponse(output)
      }

      // ============================================
      // Reliability & Performance
      // ============================================
      case "reliability_score": {
        const score = await db.getReliabilityScore(orgId, {
          from: f.from,
          to: f.to,
          branch: f.branch,
          suite: f.suite,
          lastRunOnly: f.lastRunOnly,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "reliability_score",
            filters: { branch: f.branch, suite: f.suite, lastRunOnly: f.lastRunOnly },
            data: score,
          })
        }

        let output = `## Reliability Score\n\n`
        output += `**Score:** ${score.score}/100 (${score.status})\n\n`
        output += `### Breakdown\n`
        output += `- Pass Rate: ${score.breakdown?.passRate?.toFixed(1) || 0}%\n`
        output += `- Flaky Rate: ${score.breakdown?.flakyRate?.toFixed(1) || 0}%\n`
        output += `- Duration Stability: ${score.breakdown?.durationStability?.toFixed(1) || 0}%\n`

        return textResponse(output)
      }

      case "performance_regressions": {
        const summary = await db.getPerformanceRegressions(orgId, {
          threshold: f.threshold,
          hours: f.hours,
          branch: f.branch,
          suite: f.suite,
          limit: f.limit,
          sortBy: f.sort_by as "regression" | "duration" | "name" | undefined,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "performance_regressions",
            ...summary,
          })
        }

        let output = `## Performance Regressions\n\n`
        output += `**Found:** ${summary.totalRegressions} tests with performance issues\n\n`

        if (summary.regressions && summary.regressions.length > 0) {
          output += "| Test | Current | Baseline | Regression |\n"
          output += "|------|---------|----------|------------|\n"
          for (const r of summary.regressions.slice(0, 15)) {
            output += `| ${r.testName.slice(0, 30)} | ${r.currentAvgMs}ms | ${r.baselineDurationMs}ms | +${(r.regressionPercent * 100).toFixed(0)}% |\n`
          }
        }

        return textResponse(output)
      }

      // ============================================
      // Execution Summary/Failures (lightweight)
      // ============================================
      case "execution_summary": {
        if (!f.execution_id) {
          return errorResponse("execution_summary requires filters.execution_id")
        }

        const summary = await db.getExecutionSummary(orgId, f.execution_id)

        if (!summary) {
          return errorResponse("Execution not found or access denied")
        }

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "execution_summary",
            ...summary,
          })
        }

        const { execution, summary: stats, error_distribution } = summary
        let output = `## Execution Summary #${execution.id}\n\n`
        output += `- **Branch:** ${execution.branch}\n`
        output += `- **Status:** ${execution.status}\n`
        output += `- **Started:** ${execution.started_at}\n\n`
        output += `### Results\n`
        output += `| Passed | Failed | Skipped | Total | Pass Rate |\n`
        output += `|--------|--------|---------|-------|----------|\n`
        output += `| ${stats.passed} | ${stats.failed} | ${stats.skipped} | ${stats.total} | ${stats.pass_rate}% |\n`

        if (error_distribution && error_distribution.length > 0) {
          output += `\n### Top Errors\n`
          for (const e of error_distribution.slice(0, 3)) {
            output += `- ${e.error_pattern}: ${e.count} occurrences\n`
          }
        }

        return textResponse(output)
      }

      case "execution_failures": {
        if (!f.execution_id) {
          return errorResponse("execution_failures requires filters.execution_id")
        }

        const failures = await db.getFailedTestsByExecutionId(orgId, f.execution_id, {
          includeRetries: f.include_retries ?? false,
          includeStackTraces: f.include_stack_traces ?? false,
        })

        // Group by file if requested
        const groupBy = f.group_by || "file"
        let grouped: Record<string, unknown[]> | unknown[] = failures

        if (groupBy === "file") {
          const byFile: Record<string, unknown[]> = {}
          for (const fail of failures) {
            if (!byFile[fail.test_file]) byFile[fail.test_file] = []
            byFile[fail.test_file].push({
              test_name: fail.test_name,
              error_message: fail.error_message,
              duration_ms: fail.duration_ms,
              retry_count: fail.retry_count,
            })
          }
          grouped = byFile
        } else if (groupBy === "error_type") {
          const errorDist = await db.getErrorDistributionByExecution(orgId, f.execution_id)
          grouped = errorDist
        }

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "execution_failures",
            execution_id: f.execution_id,
            total_failures: failures.length,
            group_by: groupBy,
            data: grouped,
          })
        }

        // Markdown format
        let output = `## Execution #${f.execution_id} Failures (${failures.length})\n\n`

        if (groupBy === "file" && typeof grouped === "object" && !Array.isArray(grouped)) {
          for (const [file, tests] of Object.entries(grouped)) {
            output += `### ${file}\n`
            for (const t of tests as Array<{ test_name: string; error_message?: string; duration_ms: number }>) {
              output += `- ${t.test_name}: ${(t.error_message || "").slice(0, 50)}...\n`
            }
            output += "\n"
          }
        } else {
          for (const fail of failures.slice(0, 20)) {
            output += `- ${fail.test_name}: ${(fail.error_message || "").slice(0, 50)}...\n`
          }
        }

        return textResponse(output)
      }

      // ============================================
      // Setup Guide (v2.1: Integration Engineer Persona)
      // ============================================
      case "setup_guide": {
        // For v2.1, we delegate to the standard installation config handler
        // Future enhancement: Add CI-specific filtering for GitLab, Azure, CircleCI
        const { handleInstallationConfig } = await import("@/lib/mcp/tools")

        const configResult = await handleInstallationConfig(
          { section: f.section || "all" },
          authContext
        )

        // Wrap the result with metadata about the filters used
        const configData = JSON.parse(configResult.content[0].text)

        return jsonResponse({
          organization: authContext.organizationSlug,
          dataset: "setup_guide",
          filters: {
            ci_provider: f.ci_provider || "github", // v2.1 defaults to GitHub Actions
            framework: f.framework || "playwright",
            monorepo: f.monorepo || false,
            section: f.section || "all"
          },
          note: "v2.1: Focus on GitHub Actions. Use get_installation_config tool with Integration Engineer persona for conversational setup.",
          data: configData
        })
      }

      default:
        return errorResponse(`Unknown dataset: ${input.dataset}. Use explore_exolar_index(category="datasets") to see available datasets.`)
    }
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Query execution failed")
  }
}

function jsonResponse(data: unknown): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  }
}

function textResponse(text: string): ToolResponse {
  return {
    content: [{ type: "text", text }],
  }
}

function errorResponse(message: string): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}
