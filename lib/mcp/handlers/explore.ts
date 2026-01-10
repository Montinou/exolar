/**
 * Handler: explore_exolar_index
 *
 * Descubrimiento de datasets, branches, suites y metrics disponibles.
 * Reemplaza: list_available_metrics, list_branches, list_suites
 */

import { z } from "zod"
import type { MCPAuthContext } from "../auth"
import * as db from "@/lib/db"
import { listAvailableMetrics } from "@/lib/analytics"
import { getCategories } from "@/lib/mcp/definitions"
import { formatBranches, type OutputFormat } from "@/lib/mcp/formatters"

const ExploreInputSchema = z.object({
  category: z.enum(["datasets", "branches", "suites", "metrics"]),
  query: z.string().optional(),
  format: z.enum(["json", "markdown"]).default("markdown"),
})

export type ExploreInput = z.infer<typeof ExploreInputSchema>

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

/**
 * Available datasets that can be queried via query_exolar_data
 */
const AVAILABLE_DATASETS = [
  { id: "executions", description: "Test execution runs with pass/fail counts", filters: "branch, suite, status, date range" },
  { id: "execution_details", description: "Full test list for a single execution", filters: "execution_id, status filter" },
  { id: "failures", description: "Failed tests with AI-classified error context", filters: "execution_id, error_type, date range" },
  { id: "flaky_tests", description: "Tests with retry behavior indicating instability", filters: "branch, min_runs, include_resolved" },
  { id: "trends", description: "Time-series pass/fail data by period", filters: "period (hour/day/week/month), count" },
  { id: "dashboard_stats", description: "Aggregated metrics: pass rate, failure rate, duration", filters: "branch, suite, date range" },
  { id: "error_analysis", description: "Error type distribution and patterns", filters: "branch, suite, group_by" },
  { id: "test_search", description: "Search tests by name or file path", filters: "query (required)" },
  { id: "test_history", description: "Execution history for a specific test", filters: "test_signature (required)" },
  { id: "flakiness_summary", description: "Overall flakiness statistics", filters: "none" },
  { id: "reliability_score", description: "Suite health score (0-100)", filters: "branch, suite, date range" },
  { id: "performance_regressions", description: "Tests running slower than baseline", filters: "threshold, branch, suite" },
  { id: "execution_summary", description: "Lightweight execution overview (~5KB)", filters: "execution_id (required)" },
  { id: "execution_failures", description: "Failed tests grouped by file/error type", filters: "execution_id (required)" },
]

export async function handleExplore(
  args: Record<string, unknown>,
  authContext: MCPAuthContext
): Promise<ToolResponse> {
  const input = ExploreInputSchema.parse(args)
  const orgId = authContext.organizationId
  const format: OutputFormat = input.format

  switch (input.category) {
    case "datasets": {
      // Filter datasets by query if provided
      let datasets = AVAILABLE_DATASETS
      if (input.query) {
        const q = input.query.toLowerCase()
        datasets = datasets.filter(
          (d) => d.id.includes(q) || d.description.toLowerCase().includes(q)
        )
      }

      if (format === "json") {
        return jsonResponse({
          organization: authContext.organizationSlug,
          count: datasets.length,
          datasets,
          usage: "Use query_exolar_data({ dataset: '<id>', filters: {...} }) to retrieve data",
        })
      }

      // Markdown format
      let output = "## Available Datasets\n\n"
      output += "| Dataset ID | Description | Filters |\n"
      output += "|------------|-------------|----------|\n"
      for (const d of datasets) {
        output += `| \`${d.id}\` | ${d.description} | ${d.filters} |\n`
      }
      output += "\n**Usage:** `query_exolar_data({ dataset: '<id>', filters: {...} })`"

      return textResponse(output)
    }

    case "branches": {
      const branches = await db.getBranches(orgId, 30)

      // Filter by query if provided
      let filtered = branches
      if (input.query) {
        const q = input.query.toLowerCase()
        filtered = branches.filter((b) => b.branch.toLowerCase().includes(q))
      }

      if (format === "json") {
        return jsonResponse({
          organization: authContext.organizationSlug,
          count: filtered.length,
          period_days: 30,
          branches: filtered,
        })
      }

      // Markdown format
      const output = formatBranches(
        filtered as Array<{
          branch: string
          execution_count: number
          pass_rate: number
          last_status: string
        }>,
        "markdown"
      )

      return textResponse(`## Branches (last 30 days)\n\n${output}`)
    }

    case "suites": {
      const suites = await db.getSuites(orgId, 30)

      // Filter by query if provided
      let filtered = suites
      if (input.query) {
        const q = input.query.toLowerCase()
        filtered = suites.filter((s) => s.suite.toLowerCase().includes(q))
      }

      if (format === "json") {
        return jsonResponse({
          organization: authContext.organizationSlug,
          count: filtered.length,
          period_days: 30,
          suites: filtered,
        })
      }

      // Markdown format
      let output = "| Suite | Runs | Pass Rate | Last |\n"
      output += "|-------|------|-----------|------|\n"
      for (const s of filtered as Array<{
        suite: string
        execution_count: number
        pass_rate: number
        last_status: string
      }>) {
        output += `| ${s.suite} | ${s.execution_count} | ${s.pass_rate.toFixed(1)}% | ${s.last_status} |\n`
      }

      return textResponse(`## Suites (last 30 days)\n\n${output}`)
    }

    case "metrics": {
      const metrics = listAvailableMetrics("all")
      const categories = getCategories()

      // Filter by query if provided
      let filtered = metrics
      if (input.query) {
        const q = input.query.toLowerCase()
        filtered = metrics.filter(
          (m) =>
            m.id.includes(q) ||
            m.name.toLowerCase().includes(q) ||
            m.category.includes(q)
        )
      }

      if (format === "json") {
        return jsonResponse({
          organization: authContext.organizationSlug,
          categories,
          count: filtered.length,
          metrics: filtered.map((m) => ({
            id: m.id,
            name: m.name,
            category: m.category,
            type: m.type,
          })),
        })
      }

      // Markdown format - compact table
      let output = "## Available Metrics\n\n"
      output += "| ID | Name | Category | Type |\n"
      output += "|----|------|----------|------|\n"
      for (const m of filtered) {
        output += `| ${m.id} | ${m.name} | ${m.category} | ${m.type} |\n`
      }
      output +=
        "\n**Tip:** Use `get_semantic_definition(metric_id)` to see how each metric is calculated."

      return textResponse(output)
    }

    default:
      return errorResponse(`Unknown category: ${input.category}`)
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
