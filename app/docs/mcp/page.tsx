"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      {title && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border rounded-t-lg text-xs text-muted-foreground font-mono">
          {title}
        </div>
      )}
      <pre className={`p-4 bg-muted text-sm overflow-x-auto ${title ? "rounded-b-lg" : "rounded-lg"}`}>
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}

export default function MCPDocsPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">MCP Integration</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Connect Claude Code to your E2E test data using the Model Context Protocol (MCP).
          Give your AI coding assistant direct access to test results, failures, and trends.
        </p>
      </div>

      {/* Installation */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Installation</h2>

        <div className="space-y-4">
          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
              Authenticate
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Run this command to open your browser and log in to the dashboard:
            </p>
            <CodeBlock code="npx e2e-test-dashboard-mcp --login" />
            <p className="text-xs text-muted-foreground mt-3">
              This will store your credentials securely in <code className="px-1 py-0.5 rounded bg-muted">~/.e2e-dashboard-mcp/config.json</code>
            </p>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
              Add to Claude Code
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Register the MCP server with Claude Code:
            </p>
            <CodeBlock code="claude mcp add --transport stdio e2e-dashboard -- npx -y e2e-test-dashboard-mcp" />
          </div>
        </div>
      </section>

      {/* Available Commands */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">CLI Commands</h2>
        <div className="space-y-3">
          <CodeBlock
            code={`# Authenticate with the dashboard (opens browser)
npx e2e-test-dashboard-mcp --login

# Check authentication status
npx e2e-test-dashboard-mcp --status

# Clear stored credentials
npx e2e-test-dashboard-mcp --logout

# Show help
npx e2e-test-dashboard-mcp --help

# Use a custom dashboard URL
npx e2e-test-dashboard-mcp --login --url https://your-dashboard.com`}
          />
        </div>
      </section>

      {/* Available Tools */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Available Tools</h2>
        <p className="text-muted-foreground">
          Once connected, Claude Code can use these tools to query your test data:
        </p>

        <div className="space-y-8">
          <div>
            <h3 className="font-semibold mb-4 text-lg">Core Data Retrieval</h3>
            <div className="grid gap-3">
              {[
                { name: "get_executions", desc: "List test executions with filters (status, branch, suite, date range)" },
                { name: "get_execution_details", desc: "Get execution details including all test results and artifacts" },
                { name: "search_tests", desc: "Search tests by name/file with aggregated statistics" },
                { name: "get_test_history", desc: "Get execution history for a specific test over time" },
              ].map((tool) => (
                <div key={tool.name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded shrink-0 text-primary">
                    {tool.name}
                  </code>
                  <span className="text-sm text-muted-foreground">{tool.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-lg">Analysis Tools</h3>
            <div className="grid gap-3">
              {[
                { name: "get_failed_tests", desc: "Get failed tests with AI-enriched context and error types" },
                { name: "get_dashboard_metrics", desc: "Overall metrics: pass rate, failure counts, avg duration" },
                { name: "get_trends", desc: "Time-series pass/fail data over configurable days" },
                { name: "get_error_distribution", desc: "Breakdown of error types from failures" },
              ].map((tool) => (
                <div key={tool.name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded shrink-0 text-primary">
                    {tool.name}
                  </code>
                  <span className="text-sm text-muted-foreground">{tool.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-lg">Flakiness Tools</h3>
            <div className="grid gap-3">
              {[
                { name: "get_flaky_tests", desc: "Flaky tests sorted by flakiness rate" },
                { name: "get_flakiness_summary", desc: "Overall flakiness metrics" },
              ].map((tool) => (
                <div key={tool.name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded shrink-0 text-primary">
                    {tool.name}
                  </code>
                  <span className="text-sm text-muted-foreground">{tool.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-lg">Metadata Tools</h3>
            <div className="grid gap-3">
              {[
                { name: "list_branches", desc: "Branches with test runs in last 30 days" },
                { name: "list_suites", desc: "Test suites with recent runs" },
              ].map((tool) => (
                <div key={tool.name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded shrink-0 text-primary">
                    {tool.name}
                  </code>
                  <span className="text-sm text-muted-foreground">{tool.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Usage Examples */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Usage Examples</h2>
        <p className="text-muted-foreground">
          After connecting, you can ask Claude things like:
        </p>
        <div className="grid gap-2">
          {[
            "Show me recent test failures",
            "What are our flakiest tests?",
            "Search for tests related to login",
            "Get the dashboard metrics for the last 7 days",
            "Show me the error distribution from this week",
            "What's the test history for the checkout test?",
          ].map((example) => (
            <div key={example} className="p-3 rounded-lg bg-muted/50 text-sm">
              &ldquo;{example}&rdquo;
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Security</h2>
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
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Troubleshooting</h2>
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold mb-2">&ldquo;Not authenticated&rdquo; error</h3>
            <p className="text-sm text-muted-foreground">
              Run <code className="px-1 py-0.5 rounded bg-muted">npx e2e-test-dashboard-mcp --login</code> to authenticate.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold mb-2">&ldquo;Token expired&rdquo; error</h3>
            <p className="text-sm text-muted-foreground">
              Your token has expired. Run <code className="px-1 py-0.5 rounded bg-muted">--login</code> again to get a new one.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold mb-2">&ldquo;Connection failed&rdquo; error</h3>
            <p className="text-sm text-muted-foreground">
              Check your internet connection and that the dashboard is accessible.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border">
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
