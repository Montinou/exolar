/**
 * MCP Tools - Tool Definitions and Handlers
 *
 * All 20 MCP tools for the E2E Dashboard.
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
    description: `List test executions with optional filters. Returns workflow runs with pass/fail counts, duration, and metadata.

Fields returned per execution:
- id: number - Execution ID (use with get_execution_details)
- suite: string - Test suite name (e.g., "Negotiation")
- branch: string - Git branch name
- commit_sha: string - Git commit hash
- status: "success" | "failure" | "running"
- passed_count, failed_count, skipped_count: number
- duration_ms: number - Total execution time
- started_at, completed_at: ISO datetime`,
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results (1-100)", default: 20 },
        offset: { type: "number", description: "Skip N results for pagination. Default: 0", default: 0 },
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
    description: `Get detailed info about a specific test execution including all test results, artifacts, and failure details.

TIP: For large executions (40+ tests), use get_execution_summary or get_execution_failures instead to reduce response size.

Fields returned per test:
- test_name: string - Test title
- test_file: string - Spec file path (e.g., "negotiation/flow.spec.ts")
- status: "passed" | "failed" | "skipped"
- error_message: string | null - Error description for failures
- duration_ms: number - Test duration
- retry_count: number - Number of retries
- artifacts: array | null - Screenshots, traces, etc.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        execution_id: { type: "number", description: "Execution ID" },
        status: {
          type: "string",
          enum: ["passed", "failed", "skipped", "all"],
          description:
            "Filter by test status. Use 'failed' to reduce response size. Default: 'all'",
        },
        include_artifacts: {
          type: "boolean",
          description: "Include artifact links (screenshots, traces). Default: true",
        },
      },
      required: ["execution_id"],
    },
  },
  {
    name: "search_tests",
    description: `Search for tests by name or file path. Returns aggregated statistics including run count, pass rate, and last run.

Fields returned per test:
- test_signature: string - Unique test identifier (use with get_test_history)
- test_name: string - Test title
- test_file: string - Spec file path
- run_count: number - Total executions
- pass_rate: number - Success percentage (0-100)
- last_run: ISO datetime
- last_status: "passed" | "failed" | "skipped"`,
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term (min 2 chars)" },
        limit: { type: "number", description: "Max results", default: 20 },
        offset: { type: "number", description: "Skip N results for pagination. Default: 0", default: 0 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_test_history",
    description: `Get execution history for a specific test across all runs. Useful for tracking test stability over time.

Fields returned per run:
- execution_id: number - Parent execution ID
- status: "passed" | "failed" | "skipped"
- error_message: string | null
- duration_ms: number
- retry_count: number
- run_at: ISO datetime
- branch: string - Git branch for this run`,
    inputSchema: {
      type: "object" as const,
      properties: {
        test_signature: {
          type: "string",
          description: "Test signature (MD5 hash of file::name)",
        },
        limit: { type: "number", default: 20 },
        offset: { type: "number", description: "Skip N results for pagination. Default: 0", default: 0 },
      },
      required: ["test_signature"],
    },
  },

  // Analysis Tools
  {
    name: "get_failed_tests",
    description: `Get failed tests with optional AI-enriched context. Now works without AI context by default.

Returns per test:
- test_name, test_file: Test identification
- error_message, stack_trace: Error details
- duration_ms, retry_count: Execution info
- ai_context: AI analysis (if available)`,
    inputSchema: {
      type: "object" as const,
      properties: {
        execution_id: {
          type: "number",
          description: "Filter to a specific execution (recommended for targeted analysis)",
        },
        error_type: {
          type: "string",
          description: "Filter by AI error type (e.g., 'TimeoutError', 'AssertionError'). Requires AI context.",
        },
        test_file: {
          type: "string",
          description: "Filter by test file path (partial match)",
        },
        limit: { type: "number", default: 20 },
        offset: { type: "number", description: "Skip N results for pagination. Default: 0", default: 0 },
        since: { type: "string", description: "Only failures since this date (ISO 8601)" },
      },
    },
  },
  {
    name: "get_dashboard_metrics",
    description: `Get overall dashboard metrics: total executions, pass rate, failure rate, avg duration, and more.

Fields returned:
- total_executions: number
- total_tests: number
- pass_rate: number - Overall percentage (0-100)
- failure_rate: number
- avg_duration_ms: number - Average execution time
- executions_per_day: number
- most_common_failure: string | null`,
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
    description: `Get time-series trend data for pass/fail rates over a period. Useful for tracking test health over time.

Fields returned per day:
- date: ISO date (YYYY-MM-DD)
- executions: number - Runs on this day
- passed: number - Passed tests count
- failed: number - Failed tests count
- pass_rate: number - Daily percentage (0-100)`,
    inputSchema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days to look back", default: 7 },
      },
    },
  },
  {
    name: "get_error_distribution",
    description: `Get breakdown of error types from failed tests. Shows which error types are most common.

Supports filtering by branch, suite, and date range.

Fields returned per error type:
- error_type: string - Error category (e.g., "TimeoutError", "AssertionError") or file/branch when using group_by
- count: number - Number of occurrences
- percentage: number - Share of total failures (0-100)
- example_message: string | null - Sample error message from most recent occurrence`,
    inputSchema: {
      type: "object" as const,
      properties: {
        since: { 
          type: "string", 
          description: "Only count errors since this date (ISO 8601)" 
        },
        branch: { 
          type: "string", 
          description: "Filter by branch name" 
        },
        suite: { 
          type: "string", 
          description: "Filter by test suite" 
        },
        limit: { 
          type: "number", 
          description: "Max error types to return (default: 10, max: 100)" 
        },
        group_by: {
          type: "string",
          enum: ["error_type", "file", "branch"],
          description: "How to group errors. Default: error_type",
        },
      },
    },
  },

  // Flakiness Tools
  {
    name: "get_flaky_tests",
    description: `Get list of flaky tests sorted by flakiness rate. A test is flaky if it sometimes passes after retries.

Fields returned per test:
- test_signature: string - Unique test identifier
- test_name: string - Test title
- test_file: string - Spec file path
- flakiness_rate: number - Percentage of runs that required retries (0-100)
- total_runs: number - Total executions
- flaky_runs: number - Runs with retry
- last_flaky: ISO datetime`,
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
    description: `Get overall flakiness summary: total flaky tests, average flakiness rate, and total flaky runs.

Fields returned:
- total_flaky_tests: number - Tests with any flaky runs
- average_flakiness_rate: number - Average across all tests (0-100)
- total_flaky_runs: number - Total executions with retries
- worst_offenders: array - Top 5 flakiest tests`,
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // Metadata Tools
  {
    name: "list_branches",
    description: `Get list of branches with test run statistics.

Fields returned per branch:
- branch: string - Branch name
- last_run: ISO datetime - Most recent execution
- execution_count: number - Total runs in period
- pass_rate: number (0-100) - Average success rate
- last_status: "success" | "failure" | "running" - Most recent execution status`,
    inputSchema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Only include branches with runs in the last N days (default: 30, max: 365)",
          default: 30,
        },
      },
    },
  },
  {
    name: "list_suites",
    description: `Get list of test suites with run statistics.

Fields returned per suite:
- suite: string - Suite name (e.g., "Negotiation")
- last_run: ISO datetime - Most recent execution
- execution_count: number - Total runs in period
- pass_rate: number (0-100) - Average success rate
- last_status: "success" | "failure" | "running" - Most recent execution status`,
    inputSchema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Only include suites with runs in the last N days (default: 30, max: 365)",
          default: 30,
        },
      },
    },
  },

  // Aggregation Tools (lighter, faster alternatives to get_execution_details)
  {
    name: "get_execution_summary",
    description: `Get aggregated summary of an execution without the full test list. Use this first for quick analysis, then get_execution_failures if you need failure details.

Returns:
- execution: Metadata (branch, commit, status, duration)
- summary: Counts (total, passed, failed, skipped, pass_rate)
- error_distribution: Grouped error types with counts
- files_affected: Files with failure/pass counts`,
    inputSchema: {
      type: "object" as const,
      properties: {
        execution_id: { type: "number", description: "Execution ID" },
      },
      required: ["execution_id"],
    },
  },
  {
    name: "get_execution_failures",
    description: `Get only failed tests from a specific execution with error grouping. Much smaller response than get_execution_details (~5KB vs ~100KB).

Returns failures grouped by file with:
- test_name: Test title
- test_file: Spec file path
- error_message: Error description
- duration_ms: Test duration`,
    inputSchema: {
      type: "object" as const,
      properties: {
        execution_id: { type: "number", description: "Execution ID" },
        group_by: {
          type: "string",
          enum: ["file", "error_type", "none"],
          description: "Group failures by file path, error type, or return flat list",
        },
        include_retries: {
          type: "boolean",
          description: "Include retry attempts (default: false, only final failures)",
        },
        include_stack_traces: {
          type: "boolean",
          description: "Include full stack traces (increases response size)",
        },
      },
      required: ["execution_id"],
    },
  },
  {
    name: "generate_failure_report",
    description: `Generate a pre-formatted markdown report for an execution. Ready for documentation or sharing.

Returns a markdown string with:
- Execution metadata and summary
- Failures grouped by file
- Error distribution analysis
- Recommended actions`,
    inputSchema: {
      type: "object" as const,
      properties: {
        execution_id: { type: "number", description: "Execution ID" },
        include_passed: {
          type: "boolean",
          description: "Include passed tests in report (default: false)",
        },
        include_recommendations: {
          type: "boolean",
          description: "Include AI-suggested actions (default: true)",
        },
      },
      required: ["execution_id"],
    },
  },

  // Performance & Reliability Tools
  {
    name: "get_reliability_score",
    description: `Get overall test suite health score (0-100). Quick way to assess suite stability before deeper analysis.

Formula: (PassRate × 40%) + ((100 - FlakyRate) × 30%) + (DurationStability × 30%)

Returns:
- score: number (0-100) - Overall health score
- status: "healthy" (80+) | "warning" (60-79) | "critical" (<60)
- breakdown: Pass rate, flakiness, and stability contributions
- rawMetrics: Actual pass rate %, flaky rate %, duration CV
- trend: Change from previous period (-100 to +100)

Use this first to quickly assess suite health before calling get_flaky_tests or get_failed_tests.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "Start date (ISO 8601)" },
        to: { type: "string", description: "End date (ISO 8601)" },
        branch: { type: "string", description: "Filter by branch name" },
        suite: { type: "string", description: "Filter by test suite" },
      },
    },
  },
  {
    name: "get_performance_regressions",
    description: `Get tests running slower than their historical baseline. Detects performance regressions automatically.

Returns per regression:
- testName, testFile: Test identification
- testSignature: Unique identifier for get_test_history
- currentAvgMs: Current average duration in milliseconds
- baselineDurationMs: Historical baseline duration
- regressionPercent: How much slower (positive %)
- severity: "critical" (>50%) | "warning" (20-50%)
- trend: "increasing" | "stable" | "decreasing"

Summary includes: totalRegressions, criticalCount, warningCount.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        threshold: {
          type: "number",
          description: "Minimum regression % to flag (default: 0.20 = 20%)",
        },
        hours: {
          type: "number",
          description: "Look back period in hours (default: 24)",
        },
        branch: { type: "string", description: "Filter by branch name" },
        suite: { type: "string", description: "Filter by test suite" },
        limit: {
          type: "number",
          description: "Max results to return (default: 20)",
        },
        sort_by: {
          type: "string",
          enum: ["regression", "duration", "name"],
          description: "Sort order: by regression %, duration, or name (default: regression)",
        },
      },
    },
  },
  {
    name: "compare_executions",
    description: `Compare two test executions to identify regressions, improvements, and changes. Side-by-side analysis of test results.

Use baseline_id/current_id for specific executions, or baseline_branch/current_branch for branch comparison (uses latest execution from each).

Returns:
- baseline: Execution metadata (id, branch, commit, status, test counts)
- current: Execution metadata
- summary: Pass rate delta, duration delta, test count delta, status change counts
- tests: Array of test comparisons with diff categories

Diff Categories:
- new_failure: Was passing in baseline, now failing
- fixed: Was failing in baseline, now passing
- new_test: Only exists in current execution
- removed_test: Only exists in baseline execution
- unchanged: Same status in both

Use filter param to focus on specific categories (e.g., filter="new_failure" to see only regressions).`,
    inputSchema: {
      type: "object" as const,
      properties: {
        baseline_id: {
          type: "number",
          description: "Baseline execution ID (the 'before' run)",
        },
        current_id: {
          type: "number",
          description: "Current execution ID (the 'after' run)",
        },
        baseline_branch: {
          type: "string",
          description: "Use latest execution from this branch as baseline",
        },
        current_branch: {
          type: "string",
          description: "Use latest execution from this branch as current",
        },
        suite: {
          type: "string",
          description: "Filter to specific suite (applies to branch lookups)",
        },
        filter: {
          type: "string",
          enum: ["new_failure", "fixed", "new_test", "removed_test", "all"],
          description: "Filter results by diff category (default: all)",
        },
      },
    },
  },

  // Installation & Auto-Triage Tools
  {
    name: "get_installation_config",
    description: `Get installation configuration for connecting Claude Code or other IDEs to Exolar QA.

Returns ready-to-use configuration snippets for:
- Claude Desktop (config.json snippet)
- Cursor IDE (mcp.json snippet)
- Claude Code CLI (add command)

Also includes:
- setup_steps: Step-by-step instructions
- auth_command: CLI command to authenticate
- credentials_location: Where tokens are stored
- docs_url: Link to settings/documentation

Use this when a user asks to "install Exolar skills" or set up MCP integration.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        ide: {
          type: "string",
          enum: ["claude_desktop", "cursor", "claude_code_cli", "all"],
          description: "Target IDE to get config for. Default: 'all' returns all options.",
        },
      },
    },
  },
  {
    name: "classify_failure",
    description: `Get structured classification data for a test failure to determine if it's a FLAKE vs BUG.

Provides AI-friendly data including:
- current_failure: Error details, retry count, status
- historical_metrics: Total runs, flaky runs, flakiness rate, last flaky/passed/failed
- recent_runs: Last 10 test executions with status and branch
- classification_signals: Weighted indicators for FLAKE vs BUG
- suggested_classification: "FLAKE" | "BUG" | "UNKNOWN"
- confidence: 0.0-1.0 score
- reasoning: Explanation of the classification

FLAKE indicators: retry_succeeded, high_flakiness_rate, timing_error_type, mixed_recent_results
BUG indicators: no_retry_success, low_flakiness_rate, assertion_error_type, consistent_failure_pattern

Input: Either test_id (result ID) OR (execution_id + test_name)`,
    inputSchema: {
      type: "object" as const,
      properties: {
        test_id: {
          type: "number",
          description: "Test result ID (from test_results table)",
        },
        execution_id: {
          type: "number",
          description: "Execution ID (alternative to test_id)",
        },
        test_name: {
          type: "string",
          description: "Test name (required if using execution_id)",
        },
        test_file: {
          type: "string",
          description: "Test file path (optional, helps disambiguate)",
        },
      },
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
            offset: z.number().min(0).default(0),
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
          input.offset,
          input.status,
          input.branch,
          input.from && input.to ? { from: input.from, to: input.to } : undefined,
          input.suite
        )

        return jsonResponse({
          organization: authContext.organizationSlug,
          count: executions.length,
          pagination: {
            offset: input.offset,
            limit: input.limit,
            has_more: executions.length === input.limit,
          },
          executions,
        })
      }

      case "get_execution_details": {
        const input = z
          .object({
            execution_id: z.number(),
            status: z.enum(["passed", "failed", "skipped", "all"]).default("all"),
            include_artifacts: z.boolean().default(true),
          })
          .parse(args)

        const execution = await db.getExecutionById(orgId, input.execution_id)

        if (!execution) {
          return errorResponse("Execution not found or access denied")
        }

        // Single database call - store reference before any filtering
        const allResults = await db.getTestResultsByExecutionId(orgId, input.execution_id)

        // Filter by status if specified (in-memory filtering)
        const filteredResults = input.status === "all"
          ? allResults
          : allResults.filter((r) => r.status === input.status)

        // Optionally strip artifacts to reduce response size
        const outputResults = input.include_artifacts
          ? filteredResults
          : filteredResults.map((r) => ({ ...r, artifacts: null }))

        return jsonResponse({
          execution,
          filter: { status: input.status, include_artifacts: input.include_artifacts },
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

      case "search_tests": {
        const input = z
          .object({
            query: z.string().min(2),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
          })
          .parse(args)

        const tests = await db.searchTests(orgId, input.query, input.limit, input.offset)

        return jsonResponse({
          query: input.query,
          count: tests.length,
          pagination: {
            offset: input.offset,
            limit: input.limit,
            has_more: tests.length === input.limit,
          },
          tests,
        })
      }

      case "get_test_history": {
        const input = z
          .object({
            test_signature: z.string(),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
          })
          .parse(args)

        const history = await db.getTestHistory(orgId, input.test_signature, input.limit, input.offset)

        return jsonResponse({
          test_signature: input.test_signature,
          count: history.length,
          pagination: {
            offset: input.offset,
            limit: input.limit,
            has_more: history.length === input.limit,
          },
          history,
        })
      }

      case "get_failed_tests": {
        const input = z
          .object({
            execution_id: z.number().optional(),
            error_type: z.string().optional(),
            test_file: z.string().optional(),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
            since: z.string().optional(),
          })
          .parse(args)

        const failures = await db.getFailuresWithAIContext(orgId, {
          executionId: input.execution_id,
          errorType: input.error_type,
          testFile: input.test_file,
          limit: input.limit,
          offset: input.offset,
          since: input.since,
          // Only require AI context if filtering by error_type
          requireAIContext: !!input.error_type,
        })

        return jsonResponse({
          organization: authContext.organizationSlug,
          execution_id: input.execution_id,
          count: failures.length,
          pagination: {
            offset: input.offset,
            limit: input.limit,
            has_more: failures.length === input.limit,
          },
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
        const input = z
          .object({
            since: z.string().optional(),
            branch: z.string().optional(),
            suite: z.string().optional(),
            limit: z.number().min(1).max(100).default(10),
            group_by: z.enum(["error_type", "file", "branch"]).default("error_type"),
          })
          .parse(args)

        const distribution = await db.getErrorTypeDistribution(orgId, {
          since: input.since,
          branch: input.branch,
          suite: input.suite,
          limit: input.limit,
          groupBy: input.group_by,
        })

        return jsonResponse({
          organization: authContext.organizationSlug,
          filters: {
            since: input.since || "all time",
            branch: input.branch || "all",
            suite: input.suite || "all",
          },
          group_by: input.group_by,
          total_types: distribution.length,
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
        const input = z
          .object({
            days: z.number().min(1).max(365).default(30),
          })
          .parse(args)

        const branches = await db.getBranches(orgId, input.days)

        return jsonResponse({
          organization: authContext.organizationSlug,
          period_days: input.days,
          count: branches.length,
          branches,
        })
      }

      case "list_suites": {
        const input = z
          .object({
            days: z.number().min(1).max(365).default(30),
          })
          .parse(args)

        const suites = await db.getSuites(orgId, input.days)

        return jsonResponse({
          organization: authContext.organizationSlug,
          period_days: input.days,
          count: suites.length,
          suites,
        })
      }

      // Aggregation Tools
      case "get_execution_summary": {
        const input = z.object({ execution_id: z.number() }).parse(args)

        const summary = await db.getExecutionSummary(orgId, input.execution_id)

        if (!summary) {
          return errorResponse("Execution not found or access denied")
        }

        return jsonResponse({
          organization: authContext.organizationSlug,
          ...summary,
        })
      }

      case "get_execution_failures": {
        const input = z
          .object({
            execution_id: z.number(),
            group_by: z.enum(["file", "error_type", "none"]).default("file"),
            include_retries: z.boolean().default(false),
            include_stack_traces: z.boolean().default(false),
          })
          .parse(args)

        const failures = await db.getFailedTestsByExecutionId(orgId, input.execution_id, {
          includeRetries: input.include_retries,
          includeStackTraces: input.include_stack_traces,
        })

        // Group failures based on group_by parameter
        let grouped: Record<string, unknown[]> | unknown[] = failures

        if (input.group_by === "file") {
          const byFile: Record<string, unknown[]> = {}
          for (const f of failures) {
            if (!byFile[f.test_file]) byFile[f.test_file] = []
            byFile[f.test_file].push({
              test_name: f.test_name,
              error_message: f.error_message,
              duration_ms: f.duration_ms,
              retry_count: f.retry_count,
              ...(input.include_stack_traces && { stack_trace: f.stack_trace }),
            })
          }
          grouped = byFile
        } else if (input.group_by === "error_type") {
          const errorDist = await db.getErrorDistributionByExecution(orgId, input.execution_id)
          grouped = errorDist
        }

        return jsonResponse({
          organization: authContext.organizationSlug,
          execution_id: input.execution_id,
          total_failures: failures.length,
          group_by: input.group_by,
          failures: grouped,
        })
      }

      case "generate_failure_report": {
        const input = z
          .object({
            execution_id: z.number(),
            include_passed: z.boolean().default(false),
            include_recommendations: z.boolean().default(true),
          })
          .parse(args)

        const summary = await db.getExecutionSummary(orgId, input.execution_id)

        if (!summary) {
          return errorResponse("Execution not found or access denied")
        }

        const failures = await db.getFailedTestsByExecutionId(orgId, input.execution_id, {
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

        if (input.include_recommendations && stats.failed > 0) {
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

        return jsonResponse({
          organization: authContext.organizationSlug,
          execution_id: input.execution_id,
          format: "markdown",
          report,
        })
      }

      case "get_reliability_score": {
        const input = z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
            branch: z.string().optional(),
            suite: z.string().optional(),
          })
          .parse(args)

        const score = await db.getReliabilityScore(orgId, {
          from: input.from,
          to: input.to,
          branch: input.branch,
          suite: input.suite,
        })

        return jsonResponse({
          organization: authContext.organizationSlug,
          ...score,
        })
      }

      case "get_performance_regressions": {
        const input = z
          .object({
            threshold: z.number().optional(),
            hours: z.number().optional(),
            branch: z.string().optional(),
            suite: z.string().optional(),
            limit: z.number().optional(),
            sort_by: z.enum(["regression", "duration", "name"]).optional(),
          })
          .parse(args)

        const summary = await db.getPerformanceRegressions(orgId, {
          threshold: input.threshold,
          hours: input.hours,
          branch: input.branch,
          suite: input.suite,
          limit: input.limit,
          sortBy: input.sort_by,
        })

        return jsonResponse({
          organization: authContext.organizationSlug,
          ...summary,
        })
      }

      case "compare_executions": {
        const input = z
          .object({
            baseline_id: z.number().optional(),
            current_id: z.number().optional(),
            baseline_branch: z.string().optional(),
            current_branch: z.string().optional(),
            suite: z.string().optional(),
            filter: z.enum(["new_failure", "fixed", "new_test", "removed_test", "all"]).optional(),
          })
          .parse(args)

        // Resolve execution IDs
        let baselineId = input.baseline_id
        let currentId = input.current_id

        // Resolve branch to execution ID if branch specified
        if (input.baseline_branch && !baselineId) {
          const baselineExec = await db.getLatestExecutionByBranch(
            orgId,
            input.baseline_branch,
            input.suite
          )
          if (!baselineExec) {
            return errorResponse(
              `No execution found for branch "${input.baseline_branch}"${input.suite ? ` with suite "${input.suite}"` : ""}`
            )
          }
          baselineId = baselineExec.id
        }

        if (input.current_branch && !currentId) {
          const currentExec = await db.getLatestExecutionByBranch(
            orgId,
            input.current_branch,
            input.suite
          )
          if (!currentExec) {
            return errorResponse(
              `No execution found for branch "${input.current_branch}"${input.suite ? ` with suite "${input.suite}"` : ""}`
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

        // Get comparison
        const comparison = await db.compareExecutions(orgId, baselineId, currentId)

        if (!comparison) {
          return errorResponse("One or both executions not found or access denied")
        }

        // Apply filter if specified
        let filteredTests = comparison.tests
        if (input.filter && input.filter !== "all") {
          filteredTests = comparison.tests.filter((t) => t.diffCategory === input.filter)
        }

        return jsonResponse({
          organization: authContext.organizationSlug,
          baseline: comparison.baseline,
          current: comparison.current,
          summary: comparison.summary,
          filter: input.filter || "all",
          tests: filteredTests,
          test_count: filteredTests.length,
        })
      }

      case "get_installation_config": {
        const input = z
          .object({
            ide: z.enum(["claude_desktop", "cursor", "claude_code_cli", "all"]).default("all"),
          })
          .parse(args)

        // Infer dashboard URL from environment or use default
        const dashboardUrl =
          process.env.NEXT_PUBLIC_DASHBOARD_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://exolar-qa.vercel.app")

        const npmPackage = "@exolar-qa/mcp-server"

        const configs = {
          organization: authContext.organizationSlug,
          npm_package: npmPackage,

          claude_desktop: {
            config_path: "~/.config/claude/claude_desktop_config.json",
            config_path_windows: "%APPDATA%\\Claude\\claude_desktop_config.json",
            config_snippet: {
              mcpServers: {
                "exolar-qa": {
                  command: "npx",
                  args: ["-y", npmPackage],
                },
              },
            },
            note: "After adding, restart Claude Desktop",
          },

          cursor: {
            config_path: "~/.cursor/mcp.json",
            config_path_windows: "%USERPROFILE%\\.cursor\\mcp.json",
            config_snippet: {
              mcpServers: {
                "exolar-qa": {
                  command: "npx",
                  args: ["-y", npmPackage],
                },
              },
            },
            note: "After adding, restart Cursor",
          },

          claude_code_cli: {
            add_command: `claude mcp add --transport stdio exolar-qa -- npx -y ${npmPackage}`,
            auth_command: `npx ${npmPackage} --login`,
            status_command: `npx ${npmPackage} --status`,
            logout_command: `npx ${npmPackage} --logout`,
          },

          setup_steps: [
            `1. Authenticate: npx ${npmPackage} --login`,
            "2. Add to your IDE using the config above",
            "3. Restart your IDE",
            "4. Claude will now have access to your test data",
          ],

          credentials_location: "~/.e2e-dashboard-mcp/config.json",
          token_expiry: "30 days",
          dashboard_url: dashboardUrl,
          docs_url: `${dashboardUrl}/settings/mcp`,
        }

        // Filter by IDE if specified
        if (input.ide !== "all") {
          const filtered: Record<string, unknown> = {
            organization: configs.organization,
            npm_package: configs.npm_package,
            setup_steps: configs.setup_steps,
            credentials_location: configs.credentials_location,
            token_expiry: configs.token_expiry,
            docs_url: configs.docs_url,
          }
          if (input.ide === "claude_desktop") {
            filtered.claude_desktop = configs.claude_desktop
          } else if (input.ide === "cursor") {
            filtered.cursor = configs.cursor
          } else if (input.ide === "claude_code_cli") {
            filtered.claude_code_cli = configs.claude_code_cli
          }
          return jsonResponse(filtered)
        }

        return jsonResponse(configs)
      }

      case "classify_failure": {
        const input = z
          .object({
            test_id: z.number().optional(),
            execution_id: z.number().optional(),
            test_name: z.string().optional(),
            test_file: z.string().optional(),
          })
          .parse(args)

        // Must have either test_id OR (execution_id + test_name)
        if (!input.test_id && (!input.execution_id || !input.test_name)) {
          return errorResponse("Must provide either test_id OR (execution_id + test_name)")
        }

        const classification = await db.getFailureClassification(orgId, {
          testId: input.test_id,
          executionId: input.execution_id,
          testName: input.test_name,
          testFile: input.test_file,
        })

        if (!classification) {
          return errorResponse("Test not found or no failure data available")
        }

        return jsonResponse({
          organization: authContext.organizationSlug,
          ...classification,
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
