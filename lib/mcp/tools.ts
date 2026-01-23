/**
 * MCP Tools - Consolidated Router Pattern
 *
 * 5 tools total (reduced from 24):
 * 1. explore_exolar_index - Discovery (datasets, branches, suites, metrics)
 * 2. query_exolar_data - Universal data retrieval router
 * 3. perform_exolar_action - Heavy actions (compare, report, classify)
 * 4. get_semantic_definition - Metric definitions to prevent hallucinations
 * 5. get_installation_config - CI/CD setup guide
 *
 * Token savings: ~83% reduction in tool definitions.
 */

import { z } from "zod"
import type { MCPAuthContext } from "./auth"
import { handleExplore } from "./handlers/explore"
import { handleQuery } from "./handlers/query"
import { handleAction } from "./handlers/action"
import { handleDefinition } from "./handlers/definition"

// ============================================
// Tool Definitions (5 tools)
// ============================================

export const allTools = [
  // ============================================
  // 1. Discovery Tool
  // ============================================
  {
    name: "explore_exolar_index",
    description: `Discover available data. ALWAYS call this FIRST before using query_exolar_data - it shows what datasets exist and their required filters.

Categories:
- datasets: See all 24 queryable datasets with descriptions
- branches: List branches with execution counts
- suites: List test suites with pass rates
- metrics: See metric definitions (use with get_semantic_definition)

Examples:
- explore_exolar_index({ category: "datasets" }) → See all queryable datasets
- explore_exolar_index({ category: "branches" }) → List branches with stats
- explore_exolar_index({ category: "metrics", query: "rate" }) → Find metrics containing "rate"`,
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["datasets", "branches", "suites", "metrics"],
          description: "What to explore",
        },
        query: {
          type: "string",
          description: "Optional search filter",
        },
        format: {
          type: "string",
          enum: ["json", "markdown"],
          description: "Output format (default: markdown)",
        },
      },
      required: ["category"],
    },
  },

  // ============================================
  // 2. Universal Query Tool (Router)
  // ============================================
  {
    name: "query_exolar_data",
    description: `Retrieve data from any dataset. Call explore_exolar_index(category="datasets") FIRST to see descriptions.

Dataset Patterns:
- List data: executions, flaky_tests, org_suites (no required filters)
- Single execution: execution_details, execution_failures (require: execution_id)
- Search: test_search, semantic_search (require: query)
- Time-series: trends, dashboard_stats (optional: branch, period)
- Mock API: mock_interfaces, mock_routes, mock_rules, mock_logs

Use view_mode: "summary" for metrics, "detailed" for analysis, "list" for tables.

Examples:
- query_exolar_data({ dataset: "executions", filters: { branch: "main", limit: 10 } })
- query_exolar_data({ dataset: "flaky_tests", filters: { min_runs: 5 } })
- query_exolar_data({ dataset: "execution_summary", filters: { execution_id: 123 } })`,
    inputSchema: {
      type: "object" as const,
      properties: {
        dataset: {
          type: "string",
          enum: [
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
            "setup_guide",
            "org_suites",
            "suite_tests",
            "inactive_tests",
            "clustered_failures",
            "semantic_search",
            "mock_interfaces",
            "mock_routes",
            "mock_rules",
            "mock_logs",
            // Relevance scoring
            "tests_with_relevance",
            "critical_tests",
            "tests_needing_labels",
            "relevance_stats",
            // Root cause clustering
            "root_causes",
            "execution_root_causes",
          ],
          description: "Dataset to query",
        },
        filters: {
          type: "object",
          description:
            "Filter object. Common: branch, suite, limit, offset, execution_id, from/to dates, query (for search)",
          properties: {
            branch: { type: "string", description: "Git branch name (exact match)" },
            suite: { type: "string", description: "Test suite name" },
            from: { type: "string", description: "Start date (ISO format)" },
            to: { type: "string", description: "End date (ISO format)" },
            date_range: { type: "string", enum: ["last_24h", "last_7d", "last_30d", "last_90d"], description: "Preset date range" },
            limit: { type: "number", description: "Max results (default: 20)" },
            offset: { type: "number", description: "Skip N results for pagination" },
            execution_id: { type: "number", description: "Specific execution ID (required for execution_details, execution_failures)" },
            test_signature: { type: "string", description: "Test identifier for history lookup" },
            query: { type: "string", description: "Search query (required for test_search, semantic_search)" },
            status: { type: "string", description: "Filter by status: passed, failed, skipped" },
            min_runs: { type: "number", description: "Minimum runs to include (flaky_tests)" },
            include_resolved: { type: "boolean", description: "Include resolved flaky tests" },
            group_by: { type: "string", description: "Group results by field" },
            period: { type: "string", enum: ["hour", "day", "week", "month"], description: "Aggregation period (trends)" },
            count: { type: "number", description: "Number of data points (trends/stats)" },
            threshold: { type: "number", description: "Similarity threshold 0-1 (clustered_failures)" },
            hours: { type: "number", description: "Time window in hours" },
            sort_by: { type: "string", description: "Sort field: duration, name, status" },
            include_artifacts: { type: "boolean", description: "Include video/trace/screenshot URLs" },
            include_retries: { type: "boolean", description: "Include retry attempts" },
            include_stack_traces: { type: "boolean", description: "Include full stack traces" },
            lastRunOnly: { type: "boolean", description: "Only most recent run per test" },
            // Semantic search filters
            status_filter: { type: "string", enum: ["all", "passed", "failed", "skipped"], description: "Filter by test status (semantic_search)" },
            search_mode: { type: "string", enum: ["semantic", "keyword", "hybrid"], description: "Search mode (semantic_search)" },
            rerank: { type: "boolean", description: "Enable Cohere reranking (semantic_search)" },
            // Mock API filters
            interface_id: { type: "number", description: "Mock interface ID (mock_routes, mock_rules, mock_logs)" },
            route_id: { type: "number", description: "Mock route ID (mock_rules)" },
            // Root cause filters
            root_cause_status: { type: "string", enum: ["open", "investigating", "fixed", "wont_fix", "flaky"], description: "Filter root causes by status" },
            error_category: { type: "string", enum: ["timeout", "assertion", "network", "element", "api", "other"], description: "Filter root causes by error category" },
          },
        },
        view_mode: {
          type: "string",
          enum: ["list", "summary", "detailed"],
          description: "Output detail level (default: list)",
        },
        format: {
          type: "string",
          enum: ["json", "markdown"],
          description: "Output format (default: markdown)",
        },
      },
      required: ["dataset"],
    },
  },

  // ============================================
  // 3. Action Tool
  // ============================================
  {
    name: "perform_exolar_action",
    description: `Execute heavy operations: compare executions, generate reports, classify failures, reembed tests, manage mock APIs, update test relevance.

Actions:
- compare: Side-by-side execution comparison (by ID or branch)
- generate_report: Markdown failure report for an execution
- classify: Determine if failure is FLAKE vs BUG
- reembed: Generate embeddings for tests (type: error|test|suite)
- create_mock_interface: Create a new mock API interface
- create_mock_route: Add a route to a mock interface
- create_mock_rule: Add a response rule to a route
- delete_mock_interface: Remove a mock interface
- update_test_relevance: Assign relevance label to a test (requires write scope)
- batch_update_relevance: Bulk update relevance labels (requires write scope)
- update_root_cause_status: Update root cause status (open, investigating, fixed, wont_fix, flaky)

Mock API Workflow:
1. create_mock_interface → Returns interface_id
2. create_mock_route (requires interface_id) → Returns route_id
3. create_mock_rule (requires route_id) → Mock ready!
4. Test at: /api/mock/{org-slug}/{interface-slug}/{path}

Matching (in create_mock_rule):
- match_headers: { "Authorization": "Bearer *" } (wildcard)
- match_query: { "status": "active" }
- match_body: { "user.email": "*@test.com" }

Templating:
- {{request.params.id}} - Path params
- {{request.body.field}} - JSON body
- {{uuid}}, {{timestamp}} - Dynamic values

Examples:
- perform_exolar_action({ action: "compare", params: { baseline_branch: "main", current_branch: "feature" } })
- perform_exolar_action({ action: "generate_report", params: { execution_id: 123 } })
- perform_exolar_action({ action: "classify", params: { execution_id: 123, test_name: "login test" } })
- perform_exolar_action({ action: "reembed", params: { type: "test", limit: 500 } })
- perform_exolar_action({ action: "reembed", params: { type: "suite" } })
- perform_exolar_action({ action: "reembed", params: { type: "error", force: true } })
- perform_exolar_action({ action: "create_mock_interface", params: { name: "User API", slug: "user-api" } })
- perform_exolar_action({ action: "create_mock_route", params: { interface_id: 1, path_pattern: "/users/:id", method: "GET" } })
- perform_exolar_action({ action: "create_mock_rule", params: { route_id: 1, name: "Success", response_status: 200, response_body: '{"id": "{{request.params.id}}"}' } })
- perform_exolar_action({ action: "update_test_relevance", params: { test_signature: "checkout.spec.ts::should complete purchase", label: "critical", reason: "Core checkout flow" } })
- perform_exolar_action({ action: "batch_update_relevance", params: { updates: [{ test_signature: "...", label: "high" }] } })
- perform_exolar_action({ action: "update_root_cause_status", params: { root_cause_id: 1, status: "fixed", note: "Fixed in PR #123" } })`,
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["compare", "generate_report", "classify", "reembed", "create_mock_interface", "create_mock_route", "create_mock_rule", "delete_mock_interface", "update_test_relevance", "batch_update_relevance", "update_root_cause_status"],
          description: "Action to perform",
        },
        params: {
          type: "object",
          description: "Action-specific parameters",
          properties: {
            // compare
            baseline_id: { type: "number" },
            current_id: { type: "number" },
            baseline_branch: { type: "string" },
            current_branch: { type: "string" },
            suite: { type: "string" },
            filter: {
              type: "string",
              enum: ["new_failure", "fixed", "new_test", "removed_test", "performance_regression", "all"],
            },
            performance_threshold: { type: "number" },
            // generate_report
            execution_id: { type: "number" },
            include_passed: { type: "boolean" },
            include_recommendations: { type: "boolean" },
            // classify
            test_id: { type: "number" },
            test_name: { type: "string" },
            test_file: { type: "string" },
            // reembed
            type: { type: "string", enum: ["error", "test", "suite"], description: "error=failures, test=all tests, suite=executions" },
            version: { type: "string", enum: ["v1", "v2", "both"] },
            force: { type: "boolean" },
            limit: { type: "number" },
            dry_run: { type: "boolean" },
            // mock_interface
            name: { type: "string", description: "Mock interface name" },
            slug: { type: "string", description: "URL-safe slug" },
            description: { type: "string", description: "Optional description" },
            rate_limit_rpm: { type: "number", description: "Rate limit (requests per minute)" },
            interface_id: { type: "number", description: "Mock interface ID" },
            // mock_route
            path_pattern: { type: "string", description: "Route path pattern (e.g., /users/:id)" },
            method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "*"], description: "HTTP method" },
            route_id: { type: "number", description: "Mock route ID" },
            priority: { type: "number", description: "Matching priority (higher = first)" },
            // mock_rule
            match_headers: { type: "object", description: "Headers to match" },
            match_query: { type: "object", description: "Query params to match" },
            match_body: { type: "object", description: "Body JSON paths to match" },
            match_body_contains: { type: "string", description: "Body substring to match" },
            response_status: { type: "number", description: "HTTP status code" },
            response_headers: { type: "object", description: "Response headers" },
            response_body: { type: "string", description: "Response body (supports templating)" },
            response_delay_ms: { type: "number", description: "Response delay in milliseconds" },
            // root cause
            root_cause_id: { type: "number", description: "Root cause ID (update_root_cause_status)" },
            status_note: { type: "string", description: "Note explaining the status change" },
          },
        },
        format: {
          type: "string",
          enum: ["json", "markdown"],
          description: "Output format (default: markdown)",
        },
      },
      required: ["action"],
    },
  },

  // ============================================
  // 4. Semantic Definition Tool
  // ============================================
  {
    name: "get_semantic_definition",
    description: `Get how a metric is calculated. ALWAYS call before interpreting unfamiliar metrics - prevents hallucinations.

Returns: formula, thresholds (healthy/warning/critical), unit, related tools.

Example: get_semantic_definition({ metric_id: "reliability_score" })`,
    inputSchema: {
      type: "object" as const,
      properties: {
        metric_id: {
          type: "string",
          description: "Metric ID (e.g., 'pass_rate', 'flaky_rate', 'reliability_score')",
        },
      },
      required: ["metric_id"],
    },
  },

  // ============================================
  // 5. Installation Config Tool (Integration Engineer Persona)
  // ============================================
  {
    name: "get_installation_config",
    description: `Get setup instructions for integrating Exolar QA with your Playwright tests and Claude Code.

**Start here** to configure Exolar - returns ready-to-use commands and code snippets.

Sections:
- mcp_setup: Connect Claude Code to Exolar (one command!)
- quick_start: Step-by-step for new or existing projects
- playwright_reporter: Reporter code for playwright.config.ts
- github_actions: GitHub Actions workflow YAML
- env_variables: Required environment variables
- api_endpoint: API URL and authentication details
- all: Complete setup guide (default)

Examples:
- get_installation_config({ section: "mcp_setup" }) → One-liner to connect Claude Code
- get_installation_config({ section: "quick_start" }) → Guide for new/existing projects
- get_installation_config({ section: "all" }) → Everything you need`,
    inputSchema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: ["mcp_setup", "quick_start", "api_endpoint", "playwright_reporter", "github_actions", "env_variables", "all"],
          description: "Section to return (default: all)",
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
// Tool Handler (Router)
// ============================================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  authContext: MCPAuthContext
): Promise<ToolResponse> {
  try {
    switch (name) {
      case "explore_exolar_index":
        return await handleExplore(args, authContext)

      case "query_exolar_data":
        return await handleQuery(args, authContext)

      case "perform_exolar_action":
        return await handleAction(args, authContext)

      case "get_semantic_definition":
        return await handleDefinition(args, authContext)

      case "get_installation_config":
        return await handleInstallationConfig(args, authContext)

      default:
        return errorResponse(`Unknown tool: ${name}. Available: explore_exolar_index, query_exolar_data, perform_exolar_action, get_semantic_definition, get_installation_config`)
    }
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Tool execution failed")
  }
}

// ============================================
// Installation Config Handler (Integration Engineer Persona)
// ============================================

async function handleInstallationConfig(
  args: Record<string, unknown>,
  authContext: MCPAuthContext
): Promise<ToolResponse> {
  const input = z
    .object({
      section: z
        .enum(["api_endpoint", "playwright_reporter", "github_actions", "env_variables", "mcp_setup", "quick_start", "all"])
        .default("all"),
    })
    .parse(args)

  // Use the correct environment variable
  const dashboardUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://exolar.ai-innovation.site"

  const guide = {
    organization: authContext.organizationSlug,
    dashboard_url: dashboardUrl,

    api_endpoint: {
      url: `${dashboardUrl}/api/test-results`,
      method: "POST",
      authentication: "Bearer token in Authorization header",
      content_type: "application/json",
      request_schema: {
        execution: {
          run_id: "string (required) - Unique CI run identifier",
          branch: "string (required) - Git branch name",
          commit_sha: "string (required) - Git commit hash",
          commit_message: "string (optional) - Commit message",
          triggered_by: "string (optional) - Who triggered the run",
          workflow_name: "string (optional) - CI workflow name",
          suite: "string (optional) - Test suite name",
          status: "'success' | 'failure' | 'running' (required)",
          total_tests: "number (required)",
          passed: "number (required)",
          failed: "number (required)",
          skipped: "number (required)",
          duration_ms: "number (optional)",
          started_at: "ISO datetime (required)",
          completed_at: "ISO datetime (optional)",
        },
        results: {
          _description: "Array of test results",
          test_name: "string (required) - Test title",
          test_file: "string (required) - Spec file path",
          status: "'passed' | 'failed' | 'skipped' | 'timedout' (required)",
          duration_ms: "number (required)",
          error_message: "string (optional) - Error for failures",
          stack_trace: "string (optional) - Full stack trace",
          retry_count: "number (optional) - Number of retries",
          browser: "string (optional) - Browser name",
        },
        artifacts: {
          _description: "Array of artifacts (optional)",
          test_name: "string (required)",
          test_file: "string (required)",
          type: "'screenshot' | 'trace' | 'video' (required)",
          filename: "string (required)",
          data: "string (required) - Base64 encoded file data",
        },
      },
      response_schema: {
        success: "boolean",
        execution_id: "number - Use this ID to query results",
        results_count: "number",
        artifacts_count: "number",
        error: "string (only on failure)",
      },
      example_curl: `curl -X POST ${dashboardUrl}/api/test-results \\
  -H "Authorization: Bearer exolar_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"execution": {...}, "results": [...]}'`,
    },

    playwright_reporter: {
      description: "Custom Playwright reporter that sends results to Exolar QA",
      file_path: "reporters/exolar-reporter.ts",
      code: `import type { Reporter, TestCase, TestResult, FullConfig, Suite, FullResult } from '@playwright/test/reporter';

interface ExolarConfig {
  apiUrl: string;
  apiKey: string;
  suite?: string;
}

class ExolarReporter implements Reporter {
  private config: ExolarConfig;
  private results: Array<{
    test_name: string;
    test_file: string;
    status: 'passed' | 'failed' | 'skipped' | 'timedout';
    duration_ms: number;
    error_message?: string;
    stack_trace?: string;
    retry_count: number;
  }> = [];
  private startTime: Date = new Date();

  constructor(options: ExolarConfig) {
    this.config = {
      apiUrl: options.apiUrl || process.env.EXOLAR_API_URL || '${dashboardUrl}/api/test-results',
      apiKey: options.apiKey || process.env.EXOLAR_API_KEY || '',
      suite: options.suite || process.env.EXOLAR_SUITE,
    };
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.results.push({
      test_name: test.title,
      test_file: test.location.file.replace(process.cwd() + '/', ''),
      status: result.status as 'passed' | 'failed' | 'skipped' | 'timedout',
      duration_ms: result.duration,
      error_message: result.error?.message,
      stack_trace: result.error?.stack,
      retry_count: result.retry,
    });
  }

  async onEnd(result: FullResult) {
    if (!this.config.apiKey) {
      console.warn('[Exolar] No API key configured, skipping report');
      return;
    }

    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;

    const payload = {
      execution: {
        run_id: process.env.GITHUB_RUN_ID || \`local-\${Date.now()}\`,
        branch: process.env.GITHUB_REF_NAME || 'local',
        commit_sha: process.env.GITHUB_SHA || 'local',
        commit_message: process.env.GITHUB_COMMIT_MESSAGE,
        triggered_by: process.env.GITHUB_ACTOR,
        workflow_name: process.env.GITHUB_WORKFLOW,
        suite: this.config.suite,
        status: failed > 0 ? 'failure' : 'success',
        total_tests: this.results.length,
        passed,
        failed,
        skipped,
        duration_ms: Date.now() - this.startTime.getTime(),
        started_at: this.startTime.toISOString(),
        completed_at: new Date().toISOString(),
      },
      results: this.results,
    };

    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${this.config.apiKey}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[Exolar] Failed to send results:', error);
      } else {
        const data = await response.json();
        console.log(\`[Exolar] Results sent successfully. Execution ID: \${data.execution_id}\`);
      }
    } catch (error) {
      console.error('[Exolar] Error sending results:', error);
    }
  }
}

export default ExolarReporter;`,
      playwright_config_snippet: `// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['./reporters/exolar-reporter.ts', {
      apiUrl: '${dashboardUrl}/api/test-results',
      apiKey: process.env.EXOLAR_API_KEY,
      suite: 'my-test-suite',
    }],
  ],
});`,
    },

    github_actions: {
      description: "GitHub Actions workflow for running tests with Exolar reporting",
      file_path: ".github/workflows/e2e-tests.yml",
      code: `name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run Playwright tests
        run: npx playwright test
        env:
          EXOLAR_API_KEY: \${{ secrets.EXOLAR_API_KEY }}
          EXOLAR_SUITE: my-app-e2e

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30`,
    },

    env_variables: {
      required: {
        EXOLAR_API_KEY: "Your organization API key (get from dashboard settings)",
      },
      optional: {
        EXOLAR_API_URL: `API endpoint URL (default: ${dashboardUrl}/api/test-results)`,
        EXOLAR_SUITE: "Test suite name for grouping results",
      },
      github_secrets_setup: [
        "1. Go to your GitHub repository → Settings → Secrets and variables → Actions",
        "2. Click 'New repository secret'",
        "3. Name: EXOLAR_API_KEY",
        "4. Value: Your API key from Exolar dashboard",
      ],
    },

    api_key_setup: {
      steps: [
        `1. Go to ${dashboardUrl}/settings/api-keys`,
        "2. Click 'Create API Key'",
        "3. Give it a descriptive name (e.g., 'GitHub Actions - MyRepo')",
        "4. Copy the generated key (starts with 'exolar_')",
        "5. Store it securely - it won't be shown again",
      ],
      key_format: "exolar_xxxxxxxxxxxxxxxxxxxx",
      note: "API keys are scoped to your organization and never expire (but can be revoked)",
    },

    // ============================================
    // MCP Setup (Claude Code Integration)
    // ============================================
    mcp_setup: {
      description: "Connect Claude Code to Exolar QA for AI-powered test analysis",

      // One-liner for quick setup (user level)
      quick_command: `claude mcp add exolar-qa --transport http ${dashboardUrl}/api/mcp/mcp -s user`,

      // Step-by-step for both methods
      methods: {
        oauth_recommended: {
          name: "OAuth (Recommended - No token needed)",
          command: `claude mcp add exolar-qa --transport http ${dashboardUrl}/api/mcp/mcp -s user`,
          steps: [
            "1. Run the command above in your terminal",
            "2. When prompted, select 'Authenticate'",
            "3. Your browser opens → Log in → Done!",
            "4. Verify: Run 'claude mcp list' to see exolar-qa",
          ],
        },
        manual_token: {
          name: "Manual Token (If OAuth fails)",
          steps: [
            `1. Visit ${dashboardUrl}/settings/mcp`,
            "2. Copy your authentication token",
            "3. Run the command below:",
          ],
          command: `claude mcp add exolar-qa --transport http ${dashboardUrl}/api/mcp/mcp -s user --header "Authorization: Bearer YOUR_TOKEN"`,
        },
      },

      // Verification
      verify: {
        command: "claude mcp list",
        expected: "Should show 'exolar-qa' with status 'connected'",
      },

      // What you can do after connecting
      capabilities: [
        "🔍 'Show recent test failures' → Get failures with AI context",
        "📊 'What's the health score?' → Reliability metrics",
        "🔄 'Compare main vs feature branch' → Diff analysis",
        "🧠 'Cluster failures by root cause' → AI-powered grouping",
        "🔎 'Find tests with timeout errors' → Semantic search",
      ],
    },

    // ============================================
    // Quick Start Guides (New vs Existing Projects)
    // ============================================
    quick_start: {
      summary: "Two integration points: (1) MCP for Claude Code, (2) Reporter for CI/CD",

      // For existing Playwright projects
      existing_project: {
        title: "🔧 Existing Playwright Project",
        estimated_time: "~5 minutes",
        steps: [
          {
            step: 1,
            action: "Connect Claude Code to Exolar (optional but recommended)",
            command: `claude mcp add exolar-qa --transport http ${dashboardUrl}/api/mcp/mcp -s user`,
            note: "Enables AI-powered test analysis in your terminal",
          },
          {
            step: 2,
            action: "Create the reporter file",
            command: "mkdir -p reporters && touch reporters/exolar-reporter.ts",
            note: "Copy the reporter code from playwright_reporter.code section",
          },
          {
            step: 3,
            action: "Add reporter to playwright.config.ts",
            code: `// Add to your existing reporters array:
reporter: [
  ['list'],  // Keep your existing reporters
  ['./reporters/exolar-reporter.ts', {
    apiKey: process.env.EXOLAR_API_KEY,
    suite: 'your-suite-name',  // e.g., 'e2e', 'smoke', 'regression'
  }],
],`,
            note: "MERGE into existing config - don't replace!",
          },
          {
            step: 4,
            action: "Add API key to environment",
            local: "export EXOLAR_API_KEY=exolar_your_key_here",
            github_secrets: "Settings → Secrets → Actions → New: EXOLAR_API_KEY",
            get_key: `${dashboardUrl}/settings/api-keys`,
          },
          {
            step: 5,
            action: "Run tests and verify",
            command: "npx playwright test",
            verify: `Check results at ${dashboardUrl}/dashboard`,
          },
        ],
      },

      // For new projects
      new_project: {
        title: "🆕 New Playwright Project",
        estimated_time: "~10 minutes",
        steps: [
          {
            step: 1,
            action: "Initialize Playwright",
            command: "npm init playwright@latest",
            note: "Follow the prompts to set up Playwright",
          },
          {
            step: 2,
            action: "Connect Claude Code to Exolar",
            command: `claude mcp add exolar-qa --transport http ${dashboardUrl}/api/mcp/mcp -s user`,
            note: "Now you can ask Claude for help with your tests!",
          },
          {
            step: 3,
            action: "Create reporter and configure",
            commands: [
              "mkdir -p reporters",
              "# Copy exolar-reporter.ts from playwright_reporter.code",
              "# Update playwright.config.ts with reporter (see existing_project step 3)",
            ],
          },
          {
            step: 4,
            action: "Set up GitHub Actions",
            file: ".github/workflows/e2e-tests.yml",
            note: "Copy from github_actions.code section",
          },
          {
            step: 5,
            action: "Add secrets and run",
            commands: [
              "# Add EXOLAR_API_KEY to GitHub Secrets",
              "git add . && git commit -m 'Add Exolar integration'",
              "git push  # Triggers CI and sends results to dashboard",
            ],
          },
        ],
      },
    },
  }

  // Filter by section if specified
  if (input.section !== "all") {
    const filtered: Record<string, unknown> = {
      organization: guide.organization,
      dashboard_url: guide.dashboard_url,
    }
    if (input.section === "api_endpoint") {
      filtered.api_endpoint = guide.api_endpoint
    } else if (input.section === "playwright_reporter") {
      filtered.playwright_reporter = guide.playwright_reporter
    } else if (input.section === "github_actions") {
      filtered.github_actions = guide.github_actions
    } else if (input.section === "env_variables") {
      filtered.env_variables = guide.env_variables
      filtered.api_key_setup = guide.api_key_setup
    } else if (input.section === "mcp_setup") {
      filtered.mcp_setup = guide.mcp_setup
    } else if (input.section === "quick_start") {
      filtered.quick_start = guide.quick_start
      filtered.mcp_setup = guide.mcp_setup  // Include MCP setup since it's step 1
    }
    return jsonResponse(filtered)
  }

  return jsonResponse(guide)
}

// ============================================
// Response Helpers
// ============================================

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
