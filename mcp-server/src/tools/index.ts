/**
 * MCP Tool Definitions and Handlers
 *
 * All tools for the E2E Dashboard MCP server.
 * Tools are org-scoped - each call uses authContext.organizationId.
 */

import { z } from "zod"
import type { AuthContext } from "../auth/neon-auth.js"
import * as queries from "../db/queries.js"

// ============================================
// Tool Response Type
// ============================================

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

// ============================================
// Tool Definitions (Batch 4: Core Tools)
// ============================================

export const allTools = [
  // --- Batch 4: Core Tools ---
  {
    name: "get_executions",
    description:
      "List test executions with optional filters. Returns workflow runs with pass/fail counts, duration, and metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max results (1-100)",
          default: 20,
        },
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
        test_name: {
          type: "string",
          description: "Alternative: search by test name pattern",
        },
        limit: { type: "number", default: 20 },
      },
    },
  },

  // --- Batch 5: Analysis and Metrics Tools ---
  {
    name: "get_failed_tests",
    description:
      "Get failed tests with AI-enriched context including error type, suggested fixes, and related code areas.",
    inputSchema: {
      type: "object" as const,
      properties: {
        execution_id: {
          type: "number",
          description: "Filter by specific execution",
        },
        error_type: {
          type: "string",
          description: "Filter by error type (e.g., 'TimeoutError', 'AssertionError')",
        },
        limit: { type: "number", default: 20 },
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
        days: {
          type: "number",
          description: "Number of days to look back",
          default: 7,
        },
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
        since: {
          type: "string",
          description: "Only count errors since this date (ISO 8601)",
        },
      },
    },
  },

  // --- Batch 6: Flakiness and Artifacts Tools ---
  {
    name: "get_flaky_tests",
    description:
      "Get list of flaky tests sorted by flakiness rate. A test is flaky if it sometimes passes after retries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results", default: 10 },
        min_runs: {
          type: "number",
          description: "Minimum runs to be considered (default 5)",
          default: 5,
        },
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
  {
    name: "list_artifacts",
    description:
      "List artifacts (screenshots, videos, traces) for a specific test result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        test_result_id: {
          type: "number",
          description: "Test result ID to get artifacts for",
        },
      },
      required: ["test_result_id"],
    },
  },
  {
    name: "get_artifact_url",
    description:
      "Generate a signed URL to download an artifact (screenshot, video, trace). URL expires in 1 hour.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artifact_id: {
          type: "number",
          description: "Artifact ID to get URL for",
        },
      },
      required: ["artifact_id"],
    },
  },
]

// ============================================
// Tool Handler
// ============================================

/**
 * Handle tool calls with automatic org scoping.
 * All queries use authContext.organizationId for data isolation.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  authContext: AuthContext
): Promise<ToolResponse> {
  const orgId = authContext.organizationId

  try {
    switch (name) {
      // --- Batch 4: Core Tools ---

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

        const executionsArray = (await queries.getExecutions(
          orgId,
          input.limit,
          input.status,
          input.branch,
          input.suite,
          input.from,
          input.to
        )) as unknown as Record<string, unknown>[]

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  organization: authContext.organizationSlug,
                  count: executionsArray.length,
                  executions: executionsArray,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "get_execution_details": {
        const input = z
          .object({
            execution_id: z.number(),
          })
          .parse(args)

        const execution = await queries.getExecutionById(orgId, input.execution_id)

        if (!execution) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Execution not found or access denied" }),
              },
            ],
            isError: true,
          }
        }

        const results = await queries.getTestResultsByExecutionId(orgId, input.execution_id)

        // Calculate summary stats
        const resultArray = results as Array<{ status: string }>
        const passed = resultArray.filter((r) => r.status === "passed").length
        const failed = resultArray.filter((r) => r.status === "failed").length
        const skipped = resultArray.filter((r) => r.status === "skipped").length

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  execution,
                  test_results: results,
                  summary: {
                    total: resultArray.length,
                    passed,
                    failed,
                    skipped,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "search_tests": {
        const input = z
          .object({
            query: z.string().min(2),
            limit: z.number().min(1).max(100).default(20),
          })
          .parse(args)

        const tests = await queries.searchTests(orgId, input.query, input.limit)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: input.query,
                  count: (tests as unknown[]).length,
                  tests,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "get_test_history": {
        const input = z
          .object({
            test_signature: z.string().optional(),
            test_name: z.string().optional(),
            limit: z.number().min(1).max(100).default(20),
          })
          .parse(args)

        if (!input.test_signature && !input.test_name) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Either test_signature or test_name is required",
                }),
              },
            ],
            isError: true,
          }
        }

        const history = await queries.getTestHistory(
          orgId,
          input.test_signature,
          input.test_name,
          input.limit
        )

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  test_signature: input.test_signature,
                  test_name: input.test_name,
                  count: (history as unknown[]).length,
                  history,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      // --- Batch 5: Analysis and Metrics Tools ---

      case "get_failed_tests": {
        const input = z
          .object({
            execution_id: z.number().optional(),
            error_type: z.string().optional(),
            limit: z.number().min(1).max(100).default(20),
          })
          .parse(args)

        const failuresArray = (await queries.getFailedTests(
          orgId,
          input.execution_id,
          input.error_type,
          input.limit
        )) as unknown as Record<string, unknown>[]

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  organization: authContext.organizationSlug,
                  filters: {
                    execution_id: input.execution_id,
                    error_type: input.error_type,
                  },
                  count: failuresArray.length,
                  failures: failuresArray,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "get_dashboard_metrics": {
        const input = z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .parse(args)

        const metrics = await queries.getDashboardMetrics(orgId, input.from, input.to)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  organization: authContext.organizationSlug,
                  period: {
                    from: input.from || "all time",
                    to: input.to || "now",
                  },
                  metrics,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "get_trends": {
        const input = z
          .object({
            days: z.number().min(1).max(90).default(7),
          })
          .parse(args)

        const trends = await queries.getTrends(orgId, input.days)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  organization: authContext.organizationSlug,
                  days: input.days,
                  trends,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "get_error_distribution": {
        const input = z
          .object({
            since: z.string().optional(),
          })
          .parse(args)

        const distribution = await queries.getErrorDistribution(orgId, input.since)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  organization: authContext.organizationSlug,
                  since: input.since || "all time",
                  distribution,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      // --- Batch 6: Flakiness and Artifacts Tools ---

      case "get_flaky_tests": {
        const input = z
          .object({
            limit: z.number().min(1).max(100).default(10),
            min_runs: z.number().min(1).default(5),
          })
          .parse(args)

        const flakyTests = await queries.getFlakiestTests(orgId, input.limit, input.min_runs)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  organization: authContext.organizationSlug,
                  count: (flakyTests as unknown[]).length,
                  flaky_tests: flakyTests,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "get_flakiness_summary": {
        const summary = await queries.getFlakinessSummary(orgId)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  organization: authContext.organizationSlug,
                  summary,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "list_artifacts": {
        const input = z
          .object({
            test_result_id: z.number(),
          })
          .parse(args)

        const artifacts = await queries.getArtifactsForTestResult(orgId, input.test_result_id)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  organization: authContext.organizationSlug,
                  test_result_id: input.test_result_id,
                  count: (artifacts as unknown[]).length,
                  artifacts,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "get_artifact_url": {
        const input = z
          .object({
            artifact_id: z.number(),
          })
          .parse(args)

        // First verify the artifact belongs to the user's org
        const artifact = await queries.getArtifactById(orgId, input.artifact_id)

        if (!artifact) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Artifact not found or access denied" }),
              },
            ],
            isError: true,
          }
        }

        // Check if R2 is configured
        const r2Configured = !!(
          process.env.R2_ACCOUNT_ID &&
          process.env.R2_ACCESS_KEY_ID &&
          process.env.R2_SECRET_ACCESS_KEY &&
          process.env.R2_BUCKET_NAME
        )

        if (!r2Configured) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "R2 storage not configured",
                  artifact_info: artifact,
                }),
              },
            ],
            isError: true,
          }
        }

        // Generate signed URL (import dynamically to avoid errors when R2 not configured)
        const { getSignedR2Url } = await import("./r2.js")
        const r2Key = (artifact as { r2_key?: string }).r2_key

        if (!r2Key) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Artifact has no R2 key" }),
              },
            ],
            isError: true,
          }
        }

        const signedUrl = await getSignedR2Url(r2Key, 3600) // 1 hour expiry

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  organization: authContext.organizationSlug,
                  artifact_id: input.artifact_id,
                  type: (artifact as { type?: string }).type,
                  signed_url: signedUrl,
                  expires_in_seconds: 3600,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        }
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Tool execution failed",
            message: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    }
  }
}
