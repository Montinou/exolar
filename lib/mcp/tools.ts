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
    description: `Discover available datasets, branches, suites, or metrics. Call FIRST to learn what data exists.

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
    description: `Retrieve data from any dataset. Use explore_exolar_index(category="datasets") to see available datasets.

Available datasets: executions, execution_details, failures, flaky_tests, trends, dashboard_stats, error_analysis, test_search, test_history, flakiness_summary, reliability_score, performance_regressions, execution_summary, execution_failures, setup_guide, org_suites, suite_tests, inactive_tests, clustered_failures, semantic_search

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
          ],
          description: "Dataset to query",
        },
        filters: {
          type: "object",
          description:
            "Filter object. Common: branch, suite, limit, offset, execution_id, from/to dates, query (for search)",
          properties: {
            branch: { type: "string" },
            suite: { type: "string" },
            from: { type: "string", description: "ISO date" },
            to: { type: "string", description: "ISO date" },
            date_range: { type: "string", enum: ["last_24h", "last_7d", "last_30d", "last_90d"] },
            limit: { type: "number" },
            offset: { type: "number" },
            execution_id: { type: "number" },
            test_signature: { type: "string" },
            query: { type: "string" },
            status: { type: "string" },
            min_runs: { type: "number" },
            include_resolved: { type: "boolean" },
            group_by: { type: "string" },
            period: { type: "string", enum: ["hour", "day", "week", "month"] },
            count: { type: "number" },
            threshold: { type: "number" },
            hours: { type: "number" },
            sort_by: { type: "string" },
            include_artifacts: { type: "boolean" },
            include_retries: { type: "boolean" },
            include_stack_traces: { type: "boolean" },
            lastRunOnly: { type: "boolean" },
            // Semantic search filters
            status_filter: { type: "string", enum: ["all", "passed", "failed", "skipped"], description: "Filter by test status (semantic_search)" },
            search_mode: { type: "string", enum: ["semantic", "keyword", "hybrid"], description: "Search mode (semantic_search)" },
            rerank: { type: "boolean", description: "Enable Cohere reranking (semantic_search)" },
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
    description: `Execute heavy operations: compare executions, generate reports, classify failures, reembed tests.

Actions:
- compare: Side-by-side execution comparison (by ID or branch)
- generate_report: Markdown failure report for an execution
- classify: Determine if failure is FLAKE vs BUG
- reembed: Generate embeddings for tests (type: error|test|suite)

Examples:
- perform_exolar_action({ action: "compare", params: { baseline_branch: "main", current_branch: "feature" } })
- perform_exolar_action({ action: "generate_report", params: { execution_id: 123 } })
- perform_exolar_action({ action: "classify", params: { execution_id: 123, test_name: "login test" } })
- perform_exolar_action({ action: "reembed", params: { type: "test", limit: 500 } })
- perform_exolar_action({ action: "reembed", params: { type: "suite" } })
- perform_exolar_action({ action: "reembed", params: { type: "error", force: true } })`,
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["compare", "generate_report", "classify", "reembed"],
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
    description: `You are the Exolar Integration Engineer. Your purpose is to guide users through CI/CD integration.

<role>
  Ensure successful connection of Playwright test suites to the Exolar QA Dashboard.
</role>

<interaction_protocol>
  <phase name="1. Discovery">
    ALWAYS ask before providing configuration:
    - "Which CI provider are you using? (GitHub Actions recommended, or running locally?)"
    - "Are you using a monorepo structure?"
    - "Do you have existing Playwright tests?"
  </phase>

  <phase name="2. Adaptation">
    When you receive configuration data from this tool:
    - Filter instructions based on their CI provider (focus on GitHub Actions)
    - Highlight CRITICAL steps:
      * Token setup in GitHub Secrets (Settings > Secrets > Actions)
      * MERGE the reporter into playwright.config.ts (do NOT replace the entire file)
      * Install the npm package first
    - Explain HOW to do it in their specific environment
    - For monorepo: Explain where to place reporters and how to configure per-package
  </phase>

  <phase name="3. Validation">
    After providing config, suggest a dry run:
    - "Try running: npx playwright test --reporter=@exolar/reporter locally first"
    - "Check the console logs for 200 OK response from the Exolar API"
    - "Verify test data appears at your dashboard URL"
  </phase>
</interaction_protocol>

<troubleshooting_guide>
  IF "401 Unauthorized": Check token expiration at /settings/mcp, regenerate if needed
  IF "No data in dashboard": Verify reporter is added to playwright.config.ts reporters array
  IF "Module not found": Run 'npm install @exolar/reporter' (package name may vary)
  IF "Connection refused": Verify API URL is correct and dashboard is accessible
</troubleshooting_guide>

Returns: Configuration sections (api_endpoint, playwright_reporter, github_actions, env_variables)`,
    inputSchema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: ["api_endpoint", "playwright_reporter", "github_actions", "env_variables", "all"],
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
// Installation Config Handler (kept inline)
// ============================================

async function handleInstallationConfig(
  args: Record<string, unknown>,
  authContext: MCPAuthContext
): Promise<ToolResponse> {
  const input = z
    .object({
      section: z
        .enum(["api_endpoint", "playwright_reporter", "github_actions", "env_variables", "all"])
        .default("all"),
    })
    .parse(args)

  // Infer dashboard URL from environment or use default
  const dashboardUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://exolar.vercel.app")

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

    quick_start: [
      "1. Create an API key in the dashboard settings",
      "2. Add EXOLAR_API_KEY to your CI secrets",
      "3. Create the reporter file (reporters/exolar-reporter.ts)",
      "4. Update playwright.config.ts to use the reporter",
      "5. Run your tests - results appear in dashboard automatically",
    ],
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
