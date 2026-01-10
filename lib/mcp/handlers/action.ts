/**
 * Handler: perform_exolar_action
 *
 * Acciones pesadas y mutaciones que no son queries simples.
 * Reemplaza: compare_executions, generate_failure_report, classify_failure
 */

import { z } from "zod"
import type { MCPAuthContext } from "../auth"
import * as db from "@/lib/db"

const ActionInputSchema = z.object({
  action: z.enum(["compare", "generate_report", "classify"]),
  params: z
    .object({
      // Para compare
      baseline_id: z.number().optional(),
      current_id: z.number().optional(),
      baseline_branch: z.string().optional(),
      current_branch: z.string().optional(),
      suite: z.string().optional(),
      filter: z
        .enum(["new_failure", "fixed", "new_test", "removed_test", "performance_regression", "all"])
        .optional(),
      performance_threshold: z.number().min(1).max(100).optional(),

      // Para generate_report
      execution_id: z.number().optional(),
      include_passed: z.boolean().optional(),
      include_recommendations: z.boolean().optional(),

      // Para classify
      test_id: z.number().optional(),
      test_name: z.string().optional(),
      test_file: z.string().optional(),
    })
    .optional()
    .default({}),
  format: z.enum(["json", "markdown"]).optional().default("markdown"),
})

export type ActionInput = z.infer<typeof ActionInputSchema>

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

export async function handleAction(
  args: Record<string, unknown>,
  authContext: MCPAuthContext
): Promise<ToolResponse> {
  const input = ActionInputSchema.parse(args)
  const orgId = authContext.organizationId
  const p = input.params

  try {
    switch (input.action) {
      // ============================================
      // Compare Executions
      // ============================================
      case "compare": {
        // Resolve execution IDs
        let baselineId = p.baseline_id
        let currentId = p.current_id

        // Resolve branch to execution ID if branch specified
        if (p.baseline_branch && !baselineId) {
          const baselineExec = await db.getLatestExecutionByBranch(orgId, p.baseline_branch, p.suite)
          if (!baselineExec) {
            return errorResponse(
              `No execution found for branch "${p.baseline_branch}"${p.suite ? ` with suite "${p.suite}"` : ""}`
            )
          }
          baselineId = baselineExec.id
        }

        if (p.current_branch && !currentId) {
          const currentExec = await db.getLatestExecutionByBranch(orgId, p.current_branch, p.suite)
          if (!currentExec) {
            return errorResponse(
              `No execution found for branch "${p.current_branch}"${p.suite ? ` with suite "${p.suite}"` : ""}`
            )
          }
          currentId = currentExec.id
        }

        // Validate we have both IDs
        if (!baselineId || !currentId) {
          return errorResponse(
            "Must provide either baseline_id/current_id or baseline_branch/current_branch"
          )
        }

        // Get comparison with performance threshold
        const comparison = await db.compareExecutions(orgId, baselineId, currentId, {
          performanceThreshold: p.performance_threshold ?? 20,
        })

        if (!comparison) {
          return errorResponse("One or both executions not found or access denied")
        }

        // Calculate performance summary
        const performanceSummary = {
          regressions: comparison.tests.filter((t) => t.durationCategory === "regression").length,
          improvements: comparison.tests.filter((t) => t.durationCategory === "improvement").length,
          stable: comparison.tests.filter((t) => t.durationCategory === "stable").length,
          threshold_pct: p.performance_threshold ?? 20,
        }

        // Apply filter if specified
        let filteredTests = comparison.tests
        if (p.filter === "performance_regression") {
          filteredTests = comparison.tests.filter((t) => t.durationCategory === "regression")
        } else if (p.filter && p.filter !== "all") {
          filteredTests = comparison.tests.filter((t) => t.diffCategory === p.filter)
        }

        if (input.format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "compare",
            baseline: comparison.baseline,
            current: comparison.current,
            summary: comparison.summary,
            performanceSummary,
            filter: p.filter || "all",
            tests: filteredTests,
            test_count: filteredTests.length,
          })
        }

        // Markdown format
        let output = `## Execution Comparison\n\n`
        output += `| | Baseline | Current |\n`
        output += `|---|----------|----------|\n`
        output += `| ID | ${comparison.baseline.id} | ${comparison.current.id} |\n`
        output += `| Branch | ${comparison.baseline.branch} | ${comparison.current.branch} |\n`
        output += `| Passed | ${comparison.baseline.passed} | ${comparison.current.passed} |\n`
        output += `| Failed | ${comparison.baseline.failed} | ${comparison.current.failed} |\n\n`

        output += `### Summary\n`
        output += `- New Failures: ${comparison.summary.newFailures}\n`
        output += `- Fixed: ${comparison.summary.fixed}\n`
        output += `- New Tests: ${comparison.summary.newTests}\n`
        output += `- Removed Tests: ${comparison.summary.removedTests}\n`
        output += `- Performance Regressions: ${performanceSummary.regressions}\n`
        output += `- Performance Improvements: ${performanceSummary.improvements}\n`

        if (filteredTests.length > 0 && p.filter && p.filter !== "all") {
          output += `\n### ${p.filter.replace(/_/g, " ").toUpperCase()} (${filteredTests.length})\n\n`
          for (const t of filteredTests.slice(0, 10)) {
            output += `- ${t.testName}: ${t.diffCategory}\n`
          }
          if (filteredTests.length > 10) {
            output += `\n_...and ${filteredTests.length - 10} more_\n`
          }
        }

        return textResponse(output)
      }

      // ============================================
      // Generate Failure Report
      // ============================================
      case "generate_report": {
        if (!p.execution_id) {
          return errorResponse("generate_report requires params.execution_id")
        }

        const summary = await db.getExecutionSummary(orgId, p.execution_id)

        if (!summary) {
          return errorResponse("Execution not found or access denied")
        }

        const failures = await db.getFailedTestsByExecutionId(orgId, p.execution_id, {
          includeRetries: false,
          includeStackTraces: false,
        })

        // Group failures by file
        const failuresByFile: Record<string, typeof failures> = {}
        for (const f of failures) {
          if (!failuresByFile[f.test_file]) failuresByFile[f.test_file] = []
          failuresByFile[f.test_file].push(f)
        }

        // Generate markdown report
        const { execution, summary: stats, error_distribution } = summary
        let report = `# Test Execution Report

**Execution ID:** ${execution.id}
**Branch:** \`${execution.branch}\`
**Commit:** \`${execution.commit_sha?.substring(0, 8) || "N/A"}\`
**Date:** ${execution.started_at}
**Duration:** ${Math.round((stats.duration_ms || 0) / 1000)}s

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tests** | ${stats.total} |
| **Passed** | ${stats.passed} |
| **Failed** | ${stats.failed} |
| **Skipped** | ${stats.skipped} |
| **Pass Rate** | ${stats.pass_rate}% |

---

## Error Distribution

| Error Type | Count |
|------------|-------|
${error_distribution.map((e) => `| ${e.error_pattern} | ${e.count} |`).join("\n")}

---

## Failed Tests by File

`
        for (const [file, tests] of Object.entries(failuresByFile)) {
          report += `### ${file}\n\n`
          report += `| Test Name | Error | Duration |\n`
          report += `|-----------|-------|----------|\n`
          for (const t of tests) {
            const errorShort = (t.error_message || "Unknown").substring(0, 60).replace(/\|/g, "\\|")
            report += `| ${t.test_name} | ${errorShort}... | ${t.duration_ms}ms |\n`
          }
          report += `\n`
        }

        if ((p.include_recommendations ?? true) && stats.failed > 0) {
          report += `---

## Recommendations

`
          // Analyze errors and generate recommendations
          const hasApiErrors = error_distribution.some((e) => e.error_pattern.includes("API Error"))
          const hasTimeouts = error_distribution.some((e) => e.error_pattern.includes("Timeout"))

          if (hasApiErrors) {
            report += `1. **Investigate Backend API Issues**
   - Check API logs for 500 errors
   - Verify database connectivity
   - Check environment variables on preview deployment

`
          }

          if (hasTimeouts) {
            report += `2. **Fix Timeout Issues**
   - Review modal close handlers
   - Check for race conditions in async operations
   - Consider increasing timeouts or adding explicit waits

`
          }

          if (!hasApiErrors && !hasTimeouts) {
            report += `1. **Review Test Assertions**
   - Check if selectors are up to date
   - Verify test data setup

`
          }
        }

        if (input.format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "generate_report",
            execution_id: p.execution_id,
            format: "markdown",
            report,
          })
        }

        return textResponse(report)
      }

      // ============================================
      // Classify Failure
      // ============================================
      case "classify": {
        // Must have either test_id OR (execution_id + test_name)
        if (!p.test_id && (!p.execution_id || !p.test_name)) {
          return errorResponse("classify requires either test_id OR (execution_id + test_name)")
        }

        const classification = await db.getFailureClassification(orgId, {
          testId: p.test_id,
          executionId: p.execution_id,
          testName: p.test_name,
          testFile: p.test_file,
        })

        if (!classification) {
          return errorResponse("Test not found or no failure data available")
        }

        if (input.format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "classify",
            ...classification,
          })
        }

        // Markdown format
        let output = `## Failure Classification\n\n`
        output += `**Test:** ${classification.testName}\n`
        output += `**Classification:** ${classification.suggestedClassification}\n`
        output += `**Confidence:** ${(classification.confidence * 100).toFixed(0)}%\n\n`

        output += `### Reasoning\n`
        output += `${classification.reasoning}\n\n`

        if (classification.historicalMetrics) {
          output += `### Historical Metrics\n`
          output += `- Total Runs: ${classification.historicalMetrics.totalRuns}\n`
          output += `- Pass Rate: ${classification.historicalMetrics.passRate?.toFixed(1) || 0}%\n`
          output += `- Flaky Rate: ${classification.historicalMetrics.flakyRate?.toFixed(1) || 0}%\n`
        }

        return textResponse(output)
      }

      default:
        return errorResponse(`Unknown action: ${input.action}`)
    }
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Action execution failed")
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
