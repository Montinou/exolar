"use client"

import { Check } from "lucide-react"
import { CodeBlock } from "@/components/docs/code-block"
import { TableOfContents, TOCItem } from "@/components/docs/table-of-contents"

const tocItems: TOCItem[] = [
  { id: "installation", text: "Installation" },
  { id: "cli-commands", text: "CLI Commands" },
  { id: "available-tools", text: "Available Tools" },
  { id: "usage-examples", text: "Usage Examples" },
  { id: "security", text: "Security" },
  { id: "troubleshooting", text: "Troubleshooting" },
]

const coreTools = [
  { name: "get_executions", desc: "List test executions with filters (status, branch, suite, date range)" },
  { name: "get_execution_details", desc: "Get execution details including all test results and artifacts" },
  { name: "search_tests", desc: "Search tests by name/file with aggregated statistics" },
  { name: "get_test_history", desc: "Get execution history for a specific test over time" },
]

const analysisTools = [
  { name: "get_failed_tests", desc: "Get failed tests with AI-enriched context and error types" },
  { name: "get_dashboard_metrics", desc: "Overall metrics: pass rate, failure counts, avg duration" },
  { name: "get_trends", desc: "Time-series pass/fail data over configurable days" },
  { name: "get_error_distribution", desc: "Breakdown of error types from failures" },
]

const flakinessTools = [
  { name: "get_flaky_tests", desc: "Flaky tests sorted by flakiness rate" },
  { name: "get_flakiness_summary", desc: "Overall flakiness metrics" },
]

const metadataTools = [
  { name: "list_branches", desc: "Branches with test runs in last 30 days" },
  { name: "list_suites", desc: "Test suites with recent runs" },
]

const usageExamples = [
  "Show me recent test failures",
  "What are our flakiest tests?",
  "Search for tests related to login",
  "Get the dashboard metrics for the last 7 days",
  "Show me the error distribution from this week",
  "What's the test history for the checkout test?",
]

function ToolList({ tools }: { tools: { name: string; desc: string }[] }) {
  return (
    <div className="grid gap-2 sm:gap-3">
      {tools.map((tool) => (
        <div
          key={tool.name}
          className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 p-3 rounded-lg glass-panel"
        >
          <code className="text-sm font-mono bg-muted/50 px-2 py-0.5 rounded text-primary w-fit">
            {tool.name}
          </code>
          <span className="text-sm text-muted-foreground">{tool.desc}</span>
        </div>
      ))}
    </div>
  )
}

export default function MCPDocsPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Mobile TOC */}
      <TableOfContents items={tocItems} />

      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">MCP Integration</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Connect Claude Code to your E2E test data using the Model Context Protocol (MCP).
          Give your AI coding assistant direct access to test results, failures, and trends.
        </p>
      </div>

      {/* Installation */}
      <section id="installation" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Installation</h2>

        <div className="space-y-4">
          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm">1</span>
              Authenticate
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Run this command to open your browser and log in to the dashboard:
            </p>
            <CodeBlock code="npx @exolar-qa/mcp-server --login" />
            <p className="text-xs text-muted-foreground mt-3">
              This will store your credentials securely in <code className="px-1 py-0.5 rounded glass-panel">~/.e2e-dashboard-mcp/config.json</code>
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm">2</span>
              Add to Claude Code
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Register the MCP server with Claude Code:
            </p>
            <CodeBlock code="claude mcp add --transport stdio exolar -- npx -y @exolar-qa/mcp-server" />
          </div>
        </div>
      </section>

      {/* Available Commands */}
      <section id="cli-commands" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">CLI Commands</h2>
        <CodeBlock
          code={`# Authenticate with the dashboard (opens browser)
npx @exolar-qa/mcp-server --login

# Check authentication status
npx @exolar-qa/mcp-server --status

# Clear stored credentials
npx @exolar-qa/mcp-server --logout

# Show help
npx @exolar-qa/mcp-server --help

# Use a custom dashboard URL
npx @exolar-qa/mcp-server --login --url https://your-dashboard.com`}
        />
      </section>

      {/* Available Tools */}
      <section id="available-tools" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Available Tools</h2>
        <p className="text-muted-foreground">
          Once connected, Claude Code can use these tools to query your test data:
        </p>

        <div className="space-y-6 sm:space-y-8">
          <div>
            <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">Core Data Retrieval</h3>
            <ToolList tools={coreTools} />
          </div>

          <div>
            <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">Analysis Tools</h3>
            <ToolList tools={analysisTools} />
          </div>

          <div>
            <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">Flakiness Tools</h3>
            <ToolList tools={flakinessTools} />
          </div>

          <div>
            <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">Metadata Tools</h3>
            <ToolList tools={metadataTools} />
          </div>
        </div>
      </section>

      {/* Usage Examples */}
      <section id="usage-examples" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Usage Examples</h2>
        <p className="text-muted-foreground">
          After connecting, you can ask Claude things like:
        </p>
        <div className="grid gap-2">
          {usageExamples.map((example) => (
            <div key={example} className="p-3 rounded-lg glass-panel text-sm">
              &ldquo;{example}&rdquo;
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section id="security" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Security</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>Tokens are stored with <code className="px-1 py-0.5 rounded bg-muted">0600</code> permissions (owner read/write only)</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>Tokens are JWT-signed and validated server-side</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>All data is scoped to your organization</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>Tokens expire after 30 days - run <code className="px-1 py-0.5 rounded bg-muted">--login</code> again to refresh</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <span>Revoke access anytime with <code className="px-1 py-0.5 rounded bg-muted">--logout</code></span>
          </li>
        </ul>
      </section>

      {/* Troubleshooting */}
      <section id="troubleshooting" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Troubleshooting</h2>
        <div className="space-y-3 sm:space-y-4">
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2">&ldquo;Not authenticated&rdquo; error</h3>
            <p className="text-sm text-muted-foreground">
              Run <code className="px-1 py-0.5 rounded glass-panel">npx @exolar-qa/mcp-server --login</code> to authenticate.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2">&ldquo;Token expired&rdquo; error</h3>
            <p className="text-sm text-muted-foreground">
              Your token has expired. Run <code className="px-1 py-0.5 rounded glass-panel">--login</code> again to get a new one.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2">&ldquo;Connection failed&rdquo; error</h3>
            <p className="text-sm text-muted-foreground">
              Check your internet connection and that the dashboard is accessible.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2">Browser doesn&apos;t open</h3>
            <p className="text-sm text-muted-foreground">
              If the browser doesn&apos;t open automatically, copy the URL shown in the terminal and paste it in your browser.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
