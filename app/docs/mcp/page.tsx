"use client"

import { Check } from "lucide-react"
import { CodeBlock } from "@/components/docs/code-block"
import { ToolCard } from "@/components/docs/tool-card"

// New Consolidated Tools (Router Pattern)
const consolidatedTools = [
  {
    name: "explore_exolar_index",
    description: "Discovery tool - call FIRST to learn what data exists. Lists datasets, branches, suites, or metrics with optional search filtering.",
    category: "discovery" as const,
    parameters: [
      {
        name: "category",
        type: "string",
        required: true,
        description: "What to explore: datasets | branches | suites | metrics"
      },
      { name: "query", type: "string", description: "Optional search filter" },
      { name: "format", type: "string", default: "markdown", description: "Output format: json | markdown" },
    ],
    responseFields: [
      "For datasets: List of 14 queryable datasets with descriptions",
      "For branches: Branch names with stats (last_run, execution_count, pass_rate)",
      "For suites: Suite names with stats",
      "For metrics: Metric definitions with formulas and thresholds",
    ],
    example: `"Show me what datasets are available"`,
    replaces: ["list_available_metrics", "list_branches", "list_suites"],
  },
  {
    name: "query_exolar_data",
    description: "Universal data retrieval router. Retrieves data from any of the 16 available datasets using a unified filter interface.",
    category: "query" as const,
    parameters: [
      {
        name: "dataset",
        type: "string",
        required: true,
        description: "Dataset to query: executions | execution_details | failures | flaky_tests | trends | dashboard_stats | error_analysis | test_search | test_history | flakiness_summary | reliability_score | performance_regressions | execution_summary | execution_failures | clustered_failures | semantic_search"
      },
      {
        name: "filters",
        type: "object",
        description: "Filter object with common fields: branch, suite, limit, offset, execution_id, from/to dates, query, status, min_runs, etc."
      },
      { name: "view_mode", type: "string", default: "list", description: "Output detail level: list | summary | detailed" },
      { name: "format", type: "string", default: "markdown", description: "Output format: json | markdown (~70% token savings)" },
    ],
    responseFields: [
      "Dataset-specific results with unified structure",
      "Pagination metadata (limit, offset, has_more)",
      "Markdown tables for CLI-friendly viewing",
    ],
    example: `"Get flaky tests with at least 5 runs on main branch"`,
    replaces: [
      "get_executions",
      "get_execution_details",
      "get_failed_tests",
      "get_flaky_tests",
      "get_trends",
      "get_dashboard_metrics",
      "get_error_distribution",
      "search_tests",
      "get_test_history",
      "get_flakiness_summary",
      "get_reliability_score",
      "get_performance_regressions",
      "get_execution_summary",
      "get_execution_failures",
      "generate_failure_report"
    ],
  },
  {
    name: "perform_exolar_action",
    description: "Execute heavy operations: compare executions, generate reports, classify failures, or find similar failures using AI.",
    category: "action" as const,
    parameters: [
      {
        name: "action",
        type: "string",
        required: true,
        description: "Action to perform: compare | generate_report | classify | find_similar"
      },
      {
        name: "params",
        type: "object",
        required: true,
        description: "Action-specific parameters (e.g., baseline_id, current_id, execution_id, test_name, test_result_id, scope)"
      },
    ],
    responseFields: [
      "compare: Side-by-side execution comparison with diff categories and performance deltas",
      "generate_report: Markdown report with failures, error distribution, and recommendations",
      "classify: FLAKE vs BUG classification with confidence score and reasoning",
      "find_similar: Similar failures from current execution or historical runs with similarity scores",
    ],
    example: `"Compare main vs feature-auth branch and show regressions"`,
    replaces: ["compare_executions", "generate_failure_report", "classify_failure", "(NEW: find_similar)"],
  },
  {
    name: "get_semantic_definition",
    description: "Get metric definitions to prevent AI hallucinations. Returns formula, thresholds, unit, and related tools for any metric.",
    category: "metadata" as const,
    parameters: [
      {
        name: "metric_id",
        type: "string",
        required: true,
        description: "Metric identifier (e.g., pass_rate, flaky_rate, reliability_score)"
      },
    ],
    responseFields: [
      "formula: Exact calculation formula",
      "thresholds: healthy/warning/critical values",
      "unit: %, count, duration, score, rate",
      "description: What the metric measures",
      "relatedTools: Which tools provide this metric",
    ],
    example: `"How is pass rate calculated?"`,
    replaces: ["(New tool - prevents metric hallucinations)"],
  },
  {
    name: "get_installation_config",
    description: "Get CI/CD integration code snippets and setup instructions. Returns ready-to-use config for Playwright reporter, GitHub Actions, and environment variables.",
    category: "metadata" as const,
    parameters: [
      {
        name: "section",
        type: "string",
        description: "Section: api_endpoint | playwright_reporter | github_actions | env_variables | all"
      },
    ],
    responseFields: [
      "api_endpoint: Dashboard API URL and authentication",
      "playwright_reporter: Reporter configuration code",
      "github_actions: Workflow YAML snippet",
      "env_variables: Required environment variables",
    ],
    example: `"How do I set up CI integration?"`,
    replaces: ["(Unchanged from previous version)"],
  },
]

// 16 Available Datasets via query_exolar_data
const datasets = [
  { name: "executions", description: "List test executions with optional filters (branch, suite, status, dates)" },
  { name: "execution_details", description: "Full execution data with all test results and artifacts (requires execution_id)" },
  { name: "failures", description: "Failed tests with AI-enriched context and error details" },
  { name: "flaky_tests", description: "Tests with flakiness history (min_runs, include_resolved filters)" },
  { name: "trends", description: "Time-series metrics with flexible granularity (hour, day, week, month)" },
  { name: "dashboard_stats", description: "Overall metrics summary (total executions, pass rate, avg duration)" },
  { name: "error_analysis", description: "Error type distribution breakdown" },
  { name: "test_search", description: "Search tests by name or file path (requires query param)" },
  { name: "test_history", description: "Execution history for a specific test (requires test_signature)" },
  { name: "flakiness_summary", description: "Overall flakiness metrics and worst offenders" },
  { name: "reliability_score", description: "Suite health score (0-100) with breakdown and trend" },
  { name: "performance_regressions", description: "Tests slower than historical baseline" },
  { name: "execution_summary", description: "Aggregated execution overview without full test list" },
  { name: "execution_failures", description: "Only failed tests from an execution with error grouping" },
  { name: "clustered_failures", description: "AI-grouped failures by similarity (requires execution_id, reduces 50+ failures to root causes)" },
  { name: "semantic_search", description: "Natural language search for failures using vector embeddings (requires query)" },
]

const usageExamples = [
  // Discovery
  "Show me what datasets are available",
  "List all branches with their stats",
  "What metrics can I query?",

  // Querying Data
  "Get recent test failures on main branch",
  "Show me the flakiest tests with at least 5 runs",
  "What were the test results from the last CI run?",
  "Search for tests related to login",
  "Get metrics for the past week",

  // Analysis
  "What's the health score for my test suite?",
  "Are there any performance regressions on the main branch?",
  "Show me tests that got slower in the last 24 hours",
  "What's the error distribution for failed tests?",

  // AI Vector Search (NEW)
  "Cluster the failures from the last run by root cause",
  "Find tests with timeout errors using semantic search",
  "Show me similar failures to this test",
  "Group 50+ failures into meaningful clusters",

  // Comparison
  "Compare the last two runs on main branch",
  "What tests broke in the feature branch compared to main?",
  "Show me new failures between main and feature-auth",

  // Classification
  "Is this test failure a flake or a real bug?",
  "Classify the failure in test 'should login successfully'",

  // Setup
  "Help me set up MCP integration",
  "How do I configure GitHub Actions?",

  // Definitions
  "What's the formula for pass rate?",
  "How is reliability score calculated?",
]

export default function MCPDocsPage() {
  return (
    <div className="space-y-8 sm:space-y-12">

      {/* Hero */}
      <div className="space-y-4">
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-xs sm:text-sm font-medium mb-2">
          New: 🧠 AI Vector Search • Semantic Clustering • 16 Datasets
        </div>
        <h1
          className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >MCP Integration</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Connect Claude Code to your test data using the Model Context Protocol (MCP).
          Now with <strong>5 consolidated tools</strong> (down from 24) using an efficient router pattern.
        </p>
      </div>

      {/* What's New */}
      <section className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow space-y-3">
        <h2 className="text-lg sm:text-xl font-semibold">What&apos;s New in v2.1</h2>
        <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
            <span><strong>🧠 AI Vector Search</strong> - Semantic search & failure clustering using Jina v3 embeddings + Cohere reranking</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
            <span><strong>16 queryable datasets</strong> - Added clustered_failures and semantic_search</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
            <span><strong>find_similar action</strong> - Find similar failures across current or historical runs</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span><strong>5 tools instead of 24</strong> - Router pattern with ~83% token reduction</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span><strong>HTTP Streamable transport</strong> - More reliable than legacy SSE</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span><strong>Semantic definitions</strong> - Metric formulas prevent AI hallucinations</span>
          </li>
        </ul>
      </section>

      {/* Installation */}
      <section id="installation" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Installation</h2>

        <div className="space-y-4">
          {/* OAuth Method - Primary */}
          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow border-2 border-primary/30">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm">1</span>
              Quick Start (OAuth - Recommended)
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Run this command and authenticate via browser — no token copying needed:
            </p>
            <CodeBlock code={`claude mcp add --transport http exolar-qa https://exolar.ai-innovation.site/api/mcp/mcp`} />
            <p className="text-xs text-muted-foreground mt-3">
              When prompted, select <strong>&quot;Authenticate&quot;</strong> → browser opens → log in → done!
            </p>
          </div>

          {/* Alternative: Manual Token */}
          <div className="p-4 sm:p-6 rounded-xl glass-card">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs sm:text-sm">2</span>
              Alternative: Manual Token
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              If OAuth doesn&apos;t work, get a token from <a href="/settings/mcp" className="text-primary hover:underline">/settings/mcp</a>:
            </p>
            <CodeBlock code={`claude mcp add --transport http exolar-qa https://exolar.ai-innovation.site/api/mcp/mcp \\
  --header "Authorization: Bearer YOUR_TOKEN_HERE"`} />
          </div>

          {/* AI-Guided Setup */}
          <div className="p-4 sm:p-6 rounded-xl glass-card bg-cyan-500/5 border border-cyan-500/30">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              AI-Guided CI/CD Setup
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              After connecting, ask Claude Code:
            </p>
            <CodeBlock code={`"Help me integrate Exolar with my Playwright tests"`} />
            <p className="text-xs text-muted-foreground mt-3">
              Claude uses an Integration Engineer persona to guide you through GitHub Actions setup with step-by-step instructions.
            </p>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Architecture: Router Pattern</h2>
        <p className="text-muted-foreground">
          Instead of 24 individual tools, the MCP server uses a <strong>two-level router pattern</strong>:
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl glass-card">
            <div className="text-sm font-medium mb-2">Level 1: Tool</div>
            <div className="text-xs text-muted-foreground">Which category?</div>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• explore (discovery)</li>
              <li>• query (data retrieval)</li>
              <li>• action (heavy ops)</li>
              <li>• definition (semantics)</li>
              <li>• config (setup)</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <div className="text-sm font-medium mb-2">Level 2: Dataset/Action</div>
            <div className="text-xs text-muted-foreground">Which specific data?</div>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• executions, failures</li>
              <li>• flaky_tests, trends</li>
              <li>• compare, classify</li>
              <li>• metric formulas</li>
              <li>• CI/CD snippets</li>
            </ul>
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
          <h3 className="font-semibold mb-3">Benefits</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span><strong>83% fewer tokens</strong> - Tool definitions reduced from ~3,000 to ~500 tokens</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span><strong>Unified filters</strong> - Consistent interface across all datasets</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span><strong>Better discovery</strong> - explore_exolar_index shows what's available</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span><strong>Flexible routing</strong> - Easy to add new datasets</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Available Tools */}
      <section id="tools" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Available Tools (5 Total + AI Features)</h2>
        <p className="text-muted-foreground">
          All tools support organization-scoped access with automatic filtering.
        </p>
        <div className="grid gap-4">
          {consolidatedTools.map((tool) => (
            <ToolCard key={tool.name} {...tool} />
          ))}
        </div>
      </section>

      {/* Available Datasets */}
      <section id="datasets" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Available Datasets</h2>
        <p className="text-muted-foreground">
          Use <code className="px-1 py-0.5 rounded glass-panel">query_exolar_data</code> with these datasets:
        </p>
        <div className="grid gap-3">
          {datasets.map((dataset, idx) => (
            <div key={dataset.name} className="p-3 sm:p-4 rounded-lg glass-card">
              <div className="flex items-start gap-3">
                <span className="text-xs text-muted-foreground shrink-0 mt-1">{(idx + 1).toString().padStart(2, '0')}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium mb-1 break-all">{dataset.name}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{dataset.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Migration Guide */}
      <section id="migration" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Migration from v1.0</h2>
        <p className="text-muted-foreground">
          If you were using the previous 24-tool version, here's how to migrate:
        </p>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left p-3 font-medium">Old Tool</th>
                <th className="text-left p-3 font-medium">New Tool</th>
                <th className="text-left p-3 font-medium">Parameters</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/20">
                <td className="p-3"><code className="text-xs">list_branches</code></td>
                <td className="p-3"><code className="text-xs">explore_exolar_index</code></td>
                <td className="p-3"><code className="text-xs">{`{ category: "branches" }`}</code></td>
              </tr>
              <tr className="border-b border-border/20">
                <td className="p-3"><code className="text-xs">get_executions</code></td>
                <td className="p-3"><code className="text-xs">query_exolar_data</code></td>
                <td className="p-3"><code className="text-xs">{`{ dataset: "executions" }`}</code></td>
              </tr>
              <tr className="border-b border-border/20">
                <td className="p-3"><code className="text-xs">get_flaky_tests</code></td>
                <td className="p-3"><code className="text-xs">query_exolar_data</code></td>
                <td className="p-3"><code className="text-xs">{`{ dataset: "flaky_tests" }`}</code></td>
              </tr>
              <tr className="border-b border-border/20">
                <td className="p-3"><code className="text-xs">compare_executions</code></td>
                <td className="p-3"><code className="text-xs">perform_exolar_action</code></td>
                <td className="p-3"><code className="text-xs">{`{ action: "compare" }`}</code></td>
              </tr>
              <tr>
                <td className="p-3 text-xs" colSpan={3}>
                  See full mapping in <a href="/docs/mcp" className="text-primary hover:underline">documentation</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Usage Examples */}
      <section id="examples" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Usage Examples</h2>
        <p className="text-muted-foreground">
          After connecting, you can ask Claude things like:
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {usageExamples.map((example) => (
            <div key={example} className="p-3 rounded-lg glass-panel text-xs sm:text-sm">
              &ldquo;{example}&rdquo;
            </div>
          ))}
        </div>
      </section>

      {/* Conversational CI/CD Setup (NEW in v2.1) */}
      <section id="conversational-setup" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Conversational CI/CD Setup</h2>
        <p className="text-muted-foreground">
          The <code className="px-1 py-0.5 rounded glass-panel">get_installation_config</code> tool
          uses an <strong>Integration Engineer persona</strong> that guides you through setup step-by-step.
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl glass-card">
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-semibold mb-2 text-sm">Discovery</h3>
            <p className="text-xs text-muted-foreground">
              Claude asks about your CI provider (GitHub Actions recommended), monorepo structure, and existing tests
            </p>
          </div>

          <div className="p-4 rounded-xl glass-card">
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-semibold mb-2 text-sm">Adaptation</h3>
            <p className="text-xs text-muted-foreground">
              Receives CI-specific instructions with exact secrets management steps for GitHub Actions
            </p>
          </div>

          <div className="p-4 rounded-xl glass-card">
            <div className="text-2xl mb-2">✅</div>
            <h3 className="font-semibold mb-2 text-sm">Validation</h3>
            <p className="text-xs text-muted-foreground">
              Gets dry run commands to verify integration before pushing to CI
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
          <h3 className="font-semibold mb-3">Example Conversation</h3>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded glass-panel">
              <strong>You:</strong> &ldquo;Help me integrate Exolar with my Playwright tests&rdquo;
            </div>
            <div className="p-3 rounded glass-panel bg-primary/5">
              <strong>Claude (Integration Engineer):</strong> &ldquo;I&apos;ll help you set up Exolar! First,
              which CI provider are you using? (GitHub Actions recommended, or running locally?)&rdquo;
            </div>
            <div className="p-3 rounded glass-panel">
              <strong>You:</strong> &ldquo;GitHub Actions&rdquo;
            </div>
            <div className="p-3 rounded glass-panel bg-primary/5">
              <strong>Claude:</strong> &ldquo;Perfect! Here are your GitHub Actions setup instructions:

              1. Add this secret in Settings &gt; Secrets &gt; Actions:
                 Name: EXOLAR_API_KEY
                 Value: [from /settings/mcp]

              2. Install the package: npm install @exolar/reporter

              3. MERGE (don&apos;t replace!) the reporter into your playwright.config.ts reporters array

              4. Update your .github/workflows/playwright.yml with...

              Would you like me to explain how to merge the reporter config?&rdquo;
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-xl glass-card">
          <h3 className="font-semibold mb-3 text-sm">Key Benefits</h3>
          <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
            <li>• No guessing where to put the EXOLAR_API_KEY</li>
            <li>• Clear instructions: MERGE vs REPLACE config files</li>
            <li>• GitHub Actions-specific secrets management path</li>
            <li>• Monorepo-aware guidance (where to place reporters, per-package config)</li>
            <li>• Built-in validation commands (dry run locally before CI push)</li>
          </ul>
        </div>

        <div className="p-4 sm:p-6 rounded-xl glass-card bg-amber-500/5 border border-amber-500/30">
          <h3 className="font-semibold mb-2 text-sm text-amber-500">Router Pattern Alternative</h3>
          <p className="text-xs text-muted-foreground mb-3">
            You can also use the router pattern to get pre-filtered configuration programmatically:
          </p>
          <CodeBlock code={`query_exolar_data({
  dataset: "setup_guide",
  filters: {
    ci_provider: "github",  // or "local" (v2.1)
    framework: "playwright",
    monorepo: false,        // or true
    section: "all"          // or specific section
  }
})`} />
        </div>
      </section>

      {/* Output Formats */}
      <section id="output-formats" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Output Formats</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2">Markdown (Default)</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• CLI-friendly tables</li>
              <li>• ~70% fewer tokens than JSON</li>
              <li>• Human-readable</li>
              <li>• Easier to scan</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2">JSON</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Structured data</li>
              <li>• Programmatic parsing</li>
              <li>• Full details</li>
              <li>• API integration</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Security</h2>
        <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>JWT tokens verified using Neon Auth JWKS</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>All data automatically scoped to your organization</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>Database-level RLS policies for additional protection</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>HTTPS-only communication (encrypted in transit)</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>No cross-tenant access - users only see their org's data</span>
          </li>
        </ul>
      </section>

      {/* Troubleshooting */}
      <section id="troubleshooting" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Troubleshooting</h2>
        <div className="space-y-3 sm:space-y-4">
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">&ldquo;Invalid or expired token&rdquo;</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Visit <a href="/settings/mcp" className="text-primary hover:underline">/settings/mcp</a> to generate a new token. Tokens expire after 30 days.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">&ldquo;User not found&rdquo;</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Ensure you're logged into the dashboard and have an organization assigned. Generate a new token from <a href="/settings/mcp" className="text-primary hover:underline">/settings/mcp</a> after logging in.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">&ldquo;Tool not found&rdquo;</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              You may be using old tool names. Use the 5 consolidated tools: explore_exolar_index, query_exolar_data, perform_exolar_action, get_semantic_definition, get_installation_config.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Connection fails</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Check: (1) Dashboard is accessible, (2) NEON_AUTH_JWKS_URL is set in Vercel, (3) URL is correct (/api/mcp/mcp not /api/mcp).
            </p>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Additional Resources</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <a href="/settings/mcp" className="text-primary hover:underline">Settings Page</a> - Get your configuration</li>
          <li>• <a href="https://github.com/anthropics/claude-code" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Claude Code Docs</a> - Official Claude Code documentation</li>
          <li>• <a href="https://spec.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MCP Specification</a> - Model Context Protocol spec</li>
        </ul>
      </section>
    </div>
  )
}
