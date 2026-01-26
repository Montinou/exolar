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
    "setup_guide", // Integration Engineer persona CI/CD setup guide
    // Suite and test tracking (Phase 14)
    "org_suites", // List suites with stats
    "suite_tests", // Tests for a suite
    "inactive_tests", // Tests that haven't run in 30 days
    // AI Vector Search (Phase 8)
    "clustered_failures", // AI-grouped failures by similarity
    "semantic_search", // Natural language search for tests
    // Mock API endpoints
    "mock_interfaces", // List mock interfaces
    "mock_routes", // List routes for an interface
    "mock_rules", // List rules for a route
    "mock_logs", // Request logs for an interface
    // Relevance scoring datasets
    "tests_with_relevance", // All tests with relevance scores
    "critical_tests", // Tests with score >= 80
    "tests_needing_labels", // Tests without manual labels
    "relevance_stats", // Relevance statistics summary
    // Root cause clustering
    "root_causes", // Hierarchical root causes for failures
    "execution_root_causes", // Root causes for a specific execution
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
      // Setup guide filters
      ci_provider: z.enum(["github", "local"]).optional(), // Focus on GitHub Actions
      framework: z.enum(["playwright"]).optional().default("playwright"),
      monorepo: z.boolean().optional(),
      section: z.enum(["api_endpoint", "playwright_reporter", "github_actions", "env_variables", "all"]).optional(),
      // Suite and test tracking filters (Phase 14)
      suite_id: z.number().optional(),
      tech_stack: z.enum(["playwright", "cypress", "vitest", "jest", "mocha", "pytest", "other"]).optional(),
      is_active: z.boolean().optional(),
      is_critical: z.boolean().optional(),
      test_file: z.string().optional(),
      // AI Vector Search filters (Phase 8)
      distance_threshold: z.number().min(0).max(1).optional(), // Cosine distance threshold
      min_cluster_size: z.number().min(1).optional(), // Minimum failures per cluster
      max_clusters: z.number().optional(), // Maximum number of clusters
      search_mode: z.enum(["semantic", "keyword", "hybrid"]).optional(), // Search mode
      rerank: z.boolean().optional(), // Enable Cohere reranking
      status_filter: z.enum(["all", "passed", "failed", "skipped"]).optional(), // Filter by test status
      // Mock API filters
      interface_id: z.number().optional(), // Mock interface ID
      route_id: z.number().optional(), // Mock route ID
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
          includeEnhancedContext: true, // Always include relevance/root cause context
        })

        // Defensive check: ensure failures is an array
        if (!Array.isArray(failures)) {
          return errorResponse("Unexpected response from failures query - expected array")
        }

        // Cast to enhanced type for proper typing
        const enhancedFailures = failures as Array<{
          id: number
          test_name: string
          test_file: string
          test_signature: string
          error_message: string | null
          duration_ms: number
          status: string
          is_critical: boolean
          ai_context?: unknown
          relevance_score?: number | null
          relevance_label?: string | null
          root_cause_id?: number | null
          root_cause_category?: string | null
          root_cause_subcategory?: string | null
          similar_failures_count?: number | null
        }>

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "failures",
            execution_id: f.execution_id,
            count: enhancedFailures.length,
            pagination: { offset: f.offset ?? 0, limit: f.limit ?? 20, has_more: enhancedFailures.length === (f.limit ?? 20) },
            data: enhancedFailures.map(fail => ({
              id: fail.id,
              test_name: fail.test_name,
              test_file: fail.test_file,
              test_signature: fail.test_signature,
              status: fail.status,
              is_critical: fail.is_critical,
              error_message: fail.error_message,
              duration_ms: fail.duration_ms,
              ai_context: fail.ai_context,
              // Enhanced context fields
              relevance: fail.relevance_score != null ? {
                score: fail.relevance_score,
                label: fail.relevance_label,
              } : null,
              root_cause: fail.root_cause_id != null ? {
                id: fail.root_cause_id,
                category: fail.root_cause_category,
                subcategory: fail.root_cause_subcategory,
                similar_failures_count: fail.similar_failures_count,
              } : null,
            })),
          })
        }

        // Markdown format with enhanced context
        let output = `## Failed Tests (${enhancedFailures.length} results)\n\n`
        output += "| Test | File | Error | Duration | Relevance | Root Cause |\n"
        output += "|------|------|-------|----------|-----------|------------|\n"
        for (const fail of enhancedFailures.slice(0, 20)) {
          const name = (fail.test_name || "").slice(0, 25)
          const file = (fail.test_file || "").split("/").pop()?.slice(0, 15) || ""
          const error = (fail.error_message || "").slice(0, 30).replace(/\|/g, "\\|")
          const relevance = fail.relevance_label ? `${fail.relevance_label} (${fail.relevance_score})` : "-"
          const rootCause = fail.root_cause_category ? `${fail.root_cause_category}${fail.similar_failures_count ? ` (${fail.similar_failures_count} similar)` : ""}` : "-"
          output += `| ${name} | ${file} | ${error}... | ${fail.duration_ms}ms | ${relevance} | ${rootCause} |\n`
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

        // Defensive check: ensure distribution is an array
        if (!Array.isArray(distribution)) {
          return errorResponse("Unexpected response from error analysis query - expected array")
        }

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

        // Defensive check: ensure trends is an array
        if (!Array.isArray(trends)) {
          return errorResponse("Unexpected response from trends query - expected array")
        }

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
        output += `| Total Executions | ${metrics.total_executions} |\n`
        output += `| Pass Rate | ${metrics.pass_rate?.toFixed(1) || 0}% |\n`
        output += `| Failure Rate | ${metrics.failure_rate?.toFixed(1) || 0}% |\n`
        output += `| Avg Duration | ${formatMetricValue(metrics.avg_duration_ms, "duration", "markdown")} |\n`

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
          output += `| ${name} | ${file} | ${t.run_count} | ${Number(t.pass_rate || 0).toFixed(1)}% |\n`
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

      // ============================================
      // Suite and Test Tracking (Phase 14)
      // ============================================
      case "org_suites": {
        const suites = await db.getSuitesWithStats(orgId)
        const summary = await db.getSuiteCountsSummary(orgId)

        // Filter by tech_stack if provided
        const filteredSuites = f.tech_stack
          ? suites.filter((s) => s.tech_stack === f.tech_stack)
          : suites

        // Filter by is_active if provided
        const activeFilteredSuites = f.is_active !== undefined
          ? filteredSuites.filter((s) => s.is_active === f.is_active)
          : filteredSuites

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "org_suites",
            filters: { tech_stack: f.tech_stack, is_active: f.is_active },
            count: activeFilteredSuites.length,
            summary,
            data: activeFilteredSuites,
          })
        }

        let output = `## Registered Suites (${activeFilteredSuites.length})\n\n`
        output += `**Summary:** ${summary.total_suites} suites, ${summary.active_tests} active tests, ${summary.inactive_tests} inactive tests\n\n`
        output += "| Suite | Tech Stack | Tests | Pass Rate | Last Run |\n"
        output += "|-------|------------|-------|-----------|----------|\n"
        for (const suite of activeFilteredSuites) {
          const lastRun = suite.last_execution_at
            ? new Date(suite.last_execution_at).toLocaleDateString()
            : "Never"
          output += `| ${suite.name} | ${suite.tech_stack} | ${suite.active_test_count} | ${Number(suite.pass_rate || 0).toFixed(1)}% | ${lastRun} |\n`
        }

        return textResponse(output)
      }

      case "suite_tests": {
        const suiteId = f.suite_id
        const suiteName = f.suite

        if (!suiteId && !suiteName) {
          return errorResponse("suite_tests requires filters.suite_id or filters.suite")
        }

        const tests = await db.getSuiteTests(orgId, {
          suiteId,
          suiteName,
          isActive: f.is_active,
          isCritical: f.is_critical,
          testFile: f.test_file,
          limit: f.limit ?? 50,
          offset: f.offset ?? 0,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "suite_tests",
            filters: { suite_id: suiteId, suite: suiteName, is_active: f.is_active, is_critical: f.is_critical },
            count: tests.length,
            pagination: { offset: f.offset ?? 0, limit: f.limit ?? 50, has_more: tests.length === (f.limit ?? 50) },
            data: tests,
          })
        }

        let output = `## Suite Tests (${tests.length} results)\n\n`
        output += "| Test | File | Status | Runs | Pass Rate | Last Seen |\n"
        output += "|------|------|--------|------|-----------|----------|\n"
        for (const t of tests) {
          const passRate = t.run_count > 0 ? ((t.pass_count / t.run_count) * 100).toFixed(1) : "0"
          const lastSeen = new Date(t.last_seen_at).toLocaleDateString()
          const status = t.is_active ? (t.last_status || "?") : "inactive"
          output += `| ${t.test_name.slice(0, 30)} | ${t.test_file.split("/").pop()?.slice(0, 20) || ""} | ${status} | ${t.run_count} | ${passRate}% | ${lastSeen} |\n`
        }

        return textResponse(output)
      }

      case "inactive_tests": {
        const tests = await db.getInactiveTests(orgId, f.limit ?? 50)
        const summary = await db.getSuiteCountsSummary(orgId)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "inactive_tests",
            count: tests.length,
            total_inactive: summary.inactive_tests,
            note: "Tests that haven't run in 30+ days",
            data: tests,
          })
        }

        let output = `## Inactive Tests (${tests.length} of ${summary.inactive_tests} total)\n\n`
        output += "_Tests that haven't run in 30+ days_\n\n"
        output += "| Test | File | Suite | Last Seen | Runs |\n"
        output += "|------|------|-------|-----------|------|\n"
        for (const t of tests) {
          const lastSeen = new Date(t.last_seen_at).toLocaleDateString()
          const suite = t.suite_name || "—"
          output += `| ${t.test_name.slice(0, 30)} | ${t.test_file.split("/").pop()?.slice(0, 20) || ""} | ${suite} | ${lastSeen} | ${t.run_count} |\n`
        }

        return textResponse(output)
      }

      // ============================================
      // AI Vector Search (Phase 8)
      // ============================================
      case "clustered_failures": {
        if (!f.execution_id) {
          return errorResponse("clustered_failures requires filters.execution_id")
        }

        // First verify execution exists
        const execution = await db.getExecutionById(orgId, f.execution_id)
        if (!execution) {
          return errorResponse(`Execution ${f.execution_id} not found`)
        }

        // Get clustered failures (from cache if available)
        const clusterArray = await db.getCachedClusters(f.execution_id, {
          distanceThreshold: f.distance_threshold ?? 0.15,
          minClusterSize: f.min_cluster_size ?? 2,
          maxClusters: f.max_clusters,
        })

        if (!clusterArray || clusterArray.length === 0) {
          return errorResponse(`No failures to cluster in execution ${f.execution_id} (${execution.failed || 0} failed tests)`)
        }

        // Calculate total failures across all clusters
        const totalFailures = clusterArray.reduce((sum, c) => sum + c.testCount, 0)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "clustered_failures",
            execution_id: f.execution_id,
            total_failures: totalFailures,
            total_clusters: clusterArray.length,
            reduction_percentage: totalFailures > 0
              ? ((1 - clusterArray.length / totalFailures) * 100).toFixed(1)
              : "0",
            data: clusterArray,
          })
        }

        // Markdown format
        let output = `## AI-Grouped Failures (Execution #${f.execution_id})\n\n`
        output += `**Total Failures:** ${totalFailures}\n`
        output += `**Grouped into:** ${clusterArray.length} clusters\n`
        output += `**Reduction:** ${((1 - clusterArray.length / totalFailures) * 100).toFixed(1)}%\n\n`

        for (const cluster of clusterArray) {
          // Skip clusters with no tests (shouldn't happen, but safety check)
          if (!cluster.tests || cluster.tests.length === 0) {
            continue
          }

          const representative = cluster.tests.find(t => t.isRepresentative) || cluster.tests[0]
          output += `### Cluster #${cluster.clusterId} (${cluster.tests.length} failures)\n`
          output += `**Representative:** ${representative.testName}\n`
          output += `**Error:** ${(representative.errorMessage || "").slice(0, 80)}...\n\n`

          if (cluster.tests.length > 1) {
            output += `**Similar failures:**\n`
            for (const test of cluster.tests.slice(0, 5)) {
              output += `- ${test.testName} (${test.distanceToCentroid?.toFixed(2) || "N/A"} distance)\n`
            }
            if (cluster.tests.length > 5) {
              output += `- ...and ${cluster.tests.length - 5} more\n`
            }
          }
          output += "\n"
        }

        return textResponse(output)
      }

      case "semantic_search": {
        if (!f.query) {
          return errorResponse("semantic_search requires filters.query (natural language search)")
        }

        // Import semantic search service
        const { semanticSearch } = await import("@/lib/services/search-service")

        const searchMode = f.search_mode || "hybrid"
        const statusFilter = f.status_filter || "all"
        const results = await semanticSearch({
          query: f.query,
          organizationId: orgId,
          mode: searchMode,
          limit: f.limit ?? 20,
          branch: f.branch,
          suite: f.suite,
          since: f.from,
          rerank: f.rerank ?? true,
          statusFilter,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "semantic_search",
            query: f.query,
            mode: searchMode,
            status_filter: statusFilter,
            total_results: results.totalResults,
            embedding_version: results.embeddingVersion,
            reranked: results.reranked,
            search_time_ms: results.searchTimeMs,
            data: results.results,
          })
        }

        // Markdown format
        let output = `## Semantic Search: "${f.query}"\n\n`
        output += `**Mode:** ${searchMode} | **Status:** ${statusFilter} | **Results:** ${results.totalResults} | **Time:** ${results.searchTimeMs}ms\n`
        if (results.reranked) {
          output += `**Reranked:** Yes (Cohere)\n`
        }
        output += "\n"

        output += "| Test | File | Status | Similarity | Branch |\n"
        output += "|------|------|--------|------------|--------|\n"
        for (const r of results.results.slice(0, 20)) {
          const similarity = r.similarity ? `${(r.similarity * 100).toFixed(0)}%` : "N/A"
          output += `| ${r.testName.slice(0, 30)} | ${r.testFile.split("/").pop()?.slice(0, 20) || ""} | ${r.status} | ${similarity} | ${r.branch} |\n`
        }

        if (results.results.length > 20) {
          output += `\n_...and ${results.results.length - 20} more results_\n`
        }

        return textResponse(output)
      }

      // ============================================
      // Mock API Endpoints
      // ============================================
      case "mock_interfaces": {
        const interfaces = await db.getMockInterfaces(orgId)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "mock_interfaces",
            count: interfaces.length,
            data: interfaces,
          })
        }

        let output = `## Mock Interfaces (${interfaces.length})\n\n`
        output += "| ID | Name | Slug | Routes | Requests (24h) | Active |\n"
        output += "|----|------|------|--------|----------------|--------|\n"
        for (const iface of interfaces) {
          output += `| ${iface.id} | ${iface.name} | ${iface.slug} | ${iface.total_routes} | ${iface.requests_last_24h} | ${iface.is_active ? "Yes" : "No"} |\n`
        }

        return textResponse(output)
      }

      case "mock_routes": {
        if (!f.interface_id) {
          return errorResponse("mock_routes requires filters.interface_id")
        }

        const routes = await db.getMockRoutes(f.interface_id)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "mock_routes",
            interface_id: f.interface_id,
            count: routes.length,
            data: routes,
          })
        }

        let output = `## Mock Routes (${routes.length})\n\n`
        output += "| ID | Method | Path | Rules | Priority | Active |\n"
        output += "|----|--------|------|-------|----------|--------|\n"
        for (const route of routes) {
          output += `| ${route.id} | ${route.method} | ${route.path_pattern} | ${route.rule_count} | ${route.priority} | ${route.is_active ? "Yes" : "No"} |\n`
        }

        return textResponse(output)
      }

      case "mock_rules": {
        if (!f.route_id) {
          return errorResponse("mock_rules requires filters.route_id")
        }

        const rules = await db.getMockResponseRules(f.route_id)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "mock_rules",
            route_id: f.route_id,
            count: rules.length,
            data: rules,
          })
        }

        let output = `## Mock Rules (${rules.length})\n\n`
        output += "| ID | Name | Status | Delay | Hits | Priority | Active |\n"
        output += "|----|------|--------|-------|------|----------|--------|\n"
        for (const rule of rules) {
          output += `| ${rule.id} | ${rule.name} | ${rule.response_status} | ${rule.response_delay_ms}ms | ${rule.hit_count} | ${rule.priority} | ${rule.is_active ? "Yes" : "No"} |\n`
        }

        return textResponse(output)
      }

      case "mock_logs": {
        if (!f.interface_id) {
          return errorResponse("mock_logs requires filters.interface_id")
        }

        const logs = await db.getMockRequestLogs(f.interface_id, f.limit ?? 50)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "mock_logs",
            interface_id: f.interface_id,
            count: logs.length,
            data: logs,
          })
        }

        let output = `## Mock Request Logs (${logs.length})\n\n`
        output += "| Time | Method | Path | Status | Matched | Response Time |\n"
        output += "|------|--------|------|--------|---------|---------------|\n"
        for (const log of logs) {
          const time = new Date(log.request_at).toLocaleString()
          output += `| ${time} | ${log.method} | ${log.path.slice(0, 30)} | ${log.response_status} | ${log.matched ? "Yes" : "No"} | ${log.response_time_ms}ms |\n`
        }

        return textResponse(output)
      }

      // ============================================
      // Relevance Scoring Datasets
      // ============================================
      case "tests_with_relevance": {
        const scores = await db.getAllRelevanceScores(orgId, {
          limit: f.limit ?? 50,
          offset: f.offset ?? 0,
          minScore: f.threshold ? Math.floor(f.threshold * 100) : undefined,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "tests_with_relevance",
            count: scores.length,
            pagination: { offset: f.offset ?? 0, limit: f.limit ?? 50, has_more: scores.length === (f.limit ?? 50) },
            data: scores.map(s => ({
              test_signature: s.test_signature,
              test_name: s.test_name,
              test_file: s.test_file,
              relevance_score: s.relevance_score,
              auto_score: s.auto_relevance_score,
              manual_label: s.manual_relevance_label,
              factors: {
                failure_frequency: s.failure_frequency_score,
                failure_recency: s.failure_recency_score,
                path_criticality: s.path_criticality_score,
                deployment_blocking: s.deployment_blocking_score,
              },
              override_reason: s.override_reason,
              updated_at: s.updated_at,
            })),
          })
        }

        let output = `## Tests with Relevance Scores (${scores.length})\n\n`
        output += "| Test | File | Score | Label | Auto Score |\n"
        output += "|------|------|-------|-------|------------|\n"
        for (const s of scores) {
          const label = s.manual_relevance_label || db.scoreToLabel(s.relevance_score)
          output += `| ${s.test_name.slice(0, 35)} | ${s.test_file.split("/").pop()?.slice(0, 20) || ""} | ${s.relevance_score} | ${label} | ${s.auto_relevance_score} |\n`
        }

        return textResponse(output)
      }

      case "critical_tests": {
        const critical = await db.getCriticalTests(orgId, f.limit ?? 50)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "critical_tests",
            description: "Tests with relevance score >= 80",
            count: critical.length,
            data: critical.map(s => ({
              test_signature: s.test_signature,
              test_name: s.test_name,
              test_file: s.test_file,
              relevance_score: s.relevance_score,
              manual_label: s.manual_relevance_label,
              is_manually_set: !!s.manual_relevance_label,
            })),
          })
        }

        let output = `## Critical Tests (${critical.length})\n\n`
        output += "_Tests with relevance score >= 80_\n\n"
        output += "| Test | Score | Label | Manual |\n"
        output += "|------|-------|-------|--------|\n"
        for (const s of critical) {
          const label = s.manual_relevance_label || "auto"
          output += `| ${s.test_name.slice(0, 45)} | ${s.relevance_score} | ${label} | ${s.manual_relevance_label ? "Yes" : "No"} |\n`
        }

        return textResponse(output)
      }

      case "tests_needing_labels": {
        const needingLabels = await db.getTestsNeedingLabels(orgId, f.limit ?? 20)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "tests_needing_labels",
            description: "Tests without manual labels, sorted by failure frequency (review and assign labels)",
            count: needingLabels.length,
            data: needingLabels.map(s => ({
              test_signature: s.test_signature,
              test_name: s.test_name,
              test_file: s.test_file,
              auto_relevance_score: s.auto_relevance_score,
              suggested_label: db.scoreToLabel(s.auto_relevance_score),
              factors: {
                failure_frequency: s.failure_frequency_score,
                failure_recency: s.failure_recency_score,
                path_criticality: s.path_criticality_score,
                deployment_blocking: s.deployment_blocking_score,
              },
            })),
            next_step: "Use perform_exolar_action with action='update_test_relevance' to assign labels",
          })
        }

        let output = `## Tests Needing Labels (${needingLabels.length})\n\n`
        output += "_Review these tests and assign relevance labels_\n\n"
        output += "| Test | Auto Score | Suggested | Failure Freq |\n"
        output += "|------|------------|-----------|-------------|\n"
        for (const s of needingLabels) {
          const suggested = db.scoreToLabel(s.auto_relevance_score)
          output += `| ${s.test_name.slice(0, 40)} | ${s.auto_relevance_score} | ${suggested} | ${s.failure_frequency_score} |\n`
        }
        output += "\n**Next step:** Use `perform_exolar_action({ action: 'update_test_relevance', params: { test_signature: '...', label: '...' } })`"

        return textResponse(output)
      }

      case "relevance_stats": {
        const stats = await db.getRelevanceStats(orgId)

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "relevance_stats",
            data: stats,
          })
        }

        let output = `## Relevance Statistics\n\n`
        output += `**Total Tests:** ${stats.totalTests}\n`
        output += `**With Manual Labels:** ${stats.withManualLabels}\n`
        output += `**Average Score:** ${stats.averageScore}\n\n`
        output += `### By Label\n`
        output += `- Critical: ${stats.byLabel.critical}\n`
        output += `- High: ${stats.byLabel.high}\n`
        output += `- Medium: ${stats.byLabel.medium}\n`
        output += `- Low: ${stats.byLabel.low}\n`
        output += `- Ignore: ${stats.byLabel.ignore}\n\n`
        output += `### By Score\n`
        output += `- Critical (>=80): ${stats.criticalCount}\n`
        output += `- High (70-79): ${stats.highCount}\n`

        return textResponse(output)
      }

      // ============================================
      // Root Cause Clustering Datasets
      // ============================================
      case "root_causes": {
        const rootCauses = await db.getRootCauses(orgId, {
          status: f.status as db.RootCauseStatus | undefined,
          limit: f.limit ?? 50,
          offset: f.offset ?? 0,
        })

        if (format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            dataset: "root_causes",
            description: "Hierarchical root causes for test failures",
            count: rootCauses.length,
            pagination: { offset: f.offset ?? 0, limit: f.limit ?? 50, has_more: rootCauses.length === (f.limit ?? 50) },
            data: rootCauses.map(rc => ({
              id: rc.id,
              error_category: rc.errorCategory,
              error_subcategory: rc.errorSubcategory,
              representative_error: rc.representativeError.slice(0, 100) + (rc.representativeError.length > 100 ? "..." : ""),
              total_occurrences: rc.totalOccurrences,
              affected_tests: rc.affectedTests,
              status: rc.status,
              first_seen: rc.firstSeen,
              last_seen: rc.lastSeen,
              ai_root_cause: rc.aiRootCause,
            })),
          })
        }

        let output = `## Root Causes (${rootCauses.length})\n\n`
        output += "| Category | Subcategory | Occurrences | Tests | Status | Last Seen |\n"
        output += "|----------|-------------|-------------|-------|--------|----------|\n"
        for (const rc of rootCauses) {
          const lastSeen = new Date(rc.lastSeen).toLocaleDateString()
          output += `| ${rc.errorCategory} | ${rc.errorSubcategory || "-"} | ${rc.totalOccurrences} | ${rc.affectedTests} | ${rc.status} | ${lastSeen} |\n`
        }

        return textResponse(output)
      }

      case "execution_root_causes": {
        if (!f.execution_id) {
          return errorResponse("execution_root_causes requires filters.execution_id")
        }

        const clustered = await db.getClusteredFailuresForExecution(orgId, f.execution_id)

        if (clustered.length === 0) {
          // Try to cluster the failures first
          const clusterResults = await db.clusterFailuresHierarchical(orgId, f.execution_id)
          if (clusterResults.length === 0) {
            return errorResponse(`No failures to cluster in execution ${f.execution_id}`)
          }
          // Re-fetch
          const newClustered = await db.getClusteredFailuresForExecution(orgId, f.execution_id)
          return formatExecutionRootCauses(authContext.organizationSlug, f.execution_id, newClustered, format)
        }

        return formatExecutionRootCauses(authContext.organizationSlug, f.execution_id, clustered, format)
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

function formatExecutionRootCauses(
  orgSlug: string,
  executionId: number,
  clustered: Awaited<ReturnType<typeof db.getClusteredFailuresForExecution>>,
  format: OutputFormat
): ToolResponse {
  const totalFailures = clustered.reduce((sum, c) => sum + c.failures.length, 0)
  const reduction = totalFailures > 0
    ? ((1 - clustered.length / totalFailures) * 100).toFixed(1)
    : "0"

  if (format === "json") {
    return jsonResponse({
      organization: orgSlug,
      dataset: "execution_root_causes",
      execution_id: executionId,
      total_failures: totalFailures,
      total_root_causes: clustered.length,
      reduction_percentage: reduction,
      data: clustered.map(c => ({
        root_cause_id: c.rootCause.id,
        error_category: c.rootCause.errorCategory,
        error_subcategory: c.rootCause.errorSubcategory,
        representative_error: c.rootCause.representativeError.slice(0, 100),
        status: c.rootCause.status,
        failure_count: c.failures.length,
        failures: c.failures.map(f => ({
          test_name: f.testName,
          test_file: f.testFile,
        })),
      })),
    })
  }

  let output = `## Root Cause Analysis (Execution #${executionId})\n\n`
  output += `**Total Failures:** ${totalFailures}\n`
  output += `**Root Causes:** ${clustered.length}\n`
  output += `**Reduction:** ${reduction}%\n\n`

  for (const cluster of clustered) {
    output += `### ${cluster.rootCause.errorCategory.toUpperCase()}`
    if (cluster.rootCause.errorSubcategory) {
      output += ` / ${cluster.rootCause.errorSubcategory}`
    }
    output += ` (${cluster.failures.length} failures)\n`
    output += `**Error:** ${cluster.rootCause.representativeError.slice(0, 80)}...\n`
    output += `**Status:** ${cluster.rootCause.status}\n\n`

    output += `| Test | File |\n`
    output += `|------|------|\n`
    for (const f of cluster.failures.slice(0, 5)) {
      output += `| ${f.testName.slice(0, 40)} | ${f.testFile.split("/").pop()?.slice(0, 25) || ""} |\n`
    }
    if (cluster.failures.length > 5) {
      output += `| ... | +${cluster.failures.length - 5} more |\n`
    }
    output += "\n"
  }

  return textResponse(output)
}
