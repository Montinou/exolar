/**
 * MCP Tools - Tool Definitions and Handlers
 *
 * All 12 MCP tools for the E2E Dashboard.
 * Uses existing lib/db.ts functions directly.
 */

import { z } from "zod"
import type { MCPAuthContext } from "./auth"
import * as db from "@/lib/db"
import { getSignedR2Url, isR2Configured } from "@/lib/r2"

// ============================================
// Tool Definitions
// ============================================

export const allTools = [
  // Core Tools
  {
    name: "get_executions",
    description:
      "List test executions with optional filters. Returns workflow runs with pass/fail counts, duration, and metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results (1-100)", default: 20 },
        status: {
          type: "string",
          enum: ["success", "failure", "running"],
          description: "Filter by execution status",
        },
        branch: { type: "string", description: "Filter by branch name" },
        suite: { type: "string", description: "Filter by test suite" },
        from: { type: "string", description: "Start date (ISO 8601)" },
        to: { type: "string", description: "End date (ISO 8601)" },
      },
    },
  },
  {
    name: "get_execution_details",
    description:
      "Get detailed info about a specific test execution including all test results, artifacts, and failure details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        execution_id: { type: "number", description: "Execution ID" },
      },
      required: ["execution_id"],
    },
  },
  {
    name: "search_tests",
    description:
      "Search for tests by name or file path. Returns aggregated statistics including run count, pass rate, and last run.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term (min 2 chars)" },
        limit: { type: "number", description: "Max results", default: 20 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_test_history",
    description:
      "Get execution history for a specific test across all runs. Useful for tracking test stability over time.",
    inputSchema: {
      type: "object" as const,
      properties: {
        test_signature: {
          type: "string",
          description: "Test signature (MD5 hash of file::name)",
        },
        limit: { type: "number", default: 20 },
      },
      required: ["test_signature"],
    },
  },

  // Analysis Tools
  {
    name: "get_failed_tests",
    description:
      "Get failed tests with AI-enriched context including error type, suggested fixes, and related code areas.",
    inputSchema: {
      type: "object" as const,
      properties: {
        error_type: {
          type: "string",
          description: "Filter by error type (e.g., 'TimeoutError', 'AssertionError')",
        },
        limit: { type: "number", default: 20 },
        since: { type: "string", description: "Only failures since this date (ISO 8601)" },
      },
    },
  },
  {
    name: "get_dashboard_metrics",
    description:
      "Get overall dashboard metrics: total executions, pass rate, failure rate, avg duration, and more.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "Start date (ISO 8601)" },
        to: { type: "string", description: "End date (ISO 8601)" },
      },
    },
  },
  {
    name: "get_trends",
    description:
      "Get time-series trend data for pass/fail rates over a period. Useful for tracking test health over time.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days to look back", default: 7 },
      },
    },
  },
  {
    name: "get_error_distribution",
    description:
      "Get breakdown of error types from failed tests. Shows which error types are most common.",
    inputSchema: {
      type: "object" as const,
      properties: {
        since: { type: "string", description: "Only count errors since this date (ISO 8601)" },
      },
    },
  },

  // Flakiness Tools
  {
    name: "get_flaky_tests",
    description:
      "Get list of flaky tests sorted by flakiness rate. A test is flaky if it sometimes passes after retries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results", default: 10 },
        min_runs: { type: "number", description: "Minimum runs to be considered", default: 5 },
      },
    },
  },
  {
    name: "get_flakiness_summary",
    description:
      "Get overall flakiness summary: total flaky tests, average flakiness rate, and total flaky runs.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // Artifact Tools
  {
    name: "list_branches",
    description: "Get list of branches with test runs in the last 30 days.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_suites",
    description: "Get list of test suites with runs in the last 30 days.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
]

// ============================================
// Tool Response Type
// ============================================

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

// ============================================
// Tool Handler
// ============================================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  authContext: MCPAuthContext
): Promise<ToolResponse> {
  const orgId = authContext.organizationId

  try {
    switch (name) {
      case "get_executions": {
        const input = z
          .object({
            limit: z.number().min(1).max(100).default(20),
            status: z.enum(["success", "failure", "running"]).optional(),
            branch: z.string().optional(),
            suite: z.string().optional(),
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .parse(args)

        const executions = await db.getExecutions(
          orgId,
          input.limit,
          input.status,
          input.branch,
          input.from && input.to ? { from: input.from, to: input.to } : undefined,
          input.suite
        )

        return jsonResponse({
          organization: authContext.organizationSlug,
          count: executions.length,
          executions,
        })
      }

      case "get_execution_details": {
        const input = z.object({ execution_id: z.number() }).parse(args)

        const execution = await db.getExecutionById(orgId, input.execution_id)

        if (!execution) {
          return errorResponse("Execution not found or access denied")
        }

        const results = await db.getTestResultsByExecutionId(orgId, input.execution_id)

        return jsonResponse({
          execution,
          test_results: results,
          summary: {
            total: results.length,
            passed: results.filter((r) => r.status === "passed").length,
            failed: results.filter((r) => r.status === "failed").length,
            skipped: results.filter((r) => r.status === "skipped").length,
          },
        })
      }

      case "search_tests": {
        const input = z
          .object({
            query: z.string().min(2),
            limit: z.number().min(1).max(100).default(20),
          })
          .parse(args)

        const tests = await db.searchTests(orgId, input.query, input.limit)

        return jsonResponse({
          query: input.query,
          count: tests.length,
          tests,
        })
      }

      case "get_test_history": {
        const input = z
          .object({
            test_signature: z.string(),
            limit: z.number().min(1).max(100).default(20),
          })
          .parse(args)

        const history = await db.getTestHistory(orgId, input.test_signature, input.limit)

        return jsonResponse({
          test_signature: input.test_signature,
          count: history.length,
          history,
        })
      }

      case "get_failed_tests": {
        const input = z
          .object({
            error_type: z.string().optional(),
            limit: z.number().min(1).max(100).default(20),
            since: z.string().optional(),
          })
          .parse(args)

        const failures = await db.getFailuresWithAIContext(orgId, {
          errorType: input.error_type,
          limit: input.limit,
          since: input.since,
        })

        return jsonResponse({
          organization: authContext.organizationSlug,
          count: failures.length,
          failures,
        })
      }

      case "get_dashboard_metrics": {
        const input = z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .parse(args)

        const metrics = await db.getDashboardMetrics(
          orgId,
          input.from && input.to ? { from: input.from, to: input.to } : undefined
        )

        return jsonResponse({
          organization: authContext.organizationSlug,
          period: { from: input.from || "all time", to: input.to || "now" },
          metrics,
        })
      }

      case "get_trends": {
        const input = z.object({ days: z.number().min(1).max(90).default(7) }).parse(args)

        const trends = await db.getTrendData(orgId, input.days)

        return jsonResponse({
          organization: authContext.organizationSlug,
          days: input.days,
          trends,
        })
      }

      case "get_error_distribution": {
        const input = z.object({ since: z.string().optional() }).parse(args)

        const distribution = await db.getErrorTypeDistribution(orgId, input.since)

        return jsonResponse({
          organization: authContext.organizationSlug,
          since: input.since || "all time",
          distribution,
        })
      }

      case "get_flaky_tests": {
        const input = z
          .object({
            limit: z.number().min(1).max(100).default(10),
            min_runs: z.number().min(1).default(5),
          })
          .parse(args)

        const flakyTests = await db.getFlakiestTests(orgId, input.limit, input.min_runs)

        return jsonResponse({
          organization: authContext.organizationSlug,
          count: flakyTests.length,
          flaky_tests: flakyTests,
        })
      }

      case "get_flakiness_summary": {
        const summary = await db.getFlakinessSummary(orgId)

        return jsonResponse({
          organization: authContext.organizationSlug,
          summary,
        })
      }

      case "list_branches": {
        const branches = await db.getBranches(orgId)

        return jsonResponse({
          organization: authContext.organizationSlug,
          branches,
        })
      }

      case "list_suites": {
        const suites = await db.getSuites(orgId)

        return jsonResponse({
          organization: authContext.organizationSlug,
          suites,
        })
      }

      default:
        return errorResponse(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Tool execution failed")
  }
}

function jsonResponse(data: unknown): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  }
}

function errorResponse(message: string): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}
