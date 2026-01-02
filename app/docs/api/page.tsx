"use client"

import { CodeBlock } from "@/components/docs/code-block"
import { TableOfContents, TOCItem } from "@/components/docs/table-of-contents"

const tocItems: TOCItem[] = [
  { id: "authentication", text: "Authentication" },
  { id: "base-url", text: "Base URL" },
  { id: "endpoints", text: "Endpoints" },
  { id: "examples", text: "Examples" },
  { id: "rate-limits", text: "Rate Limits" },
  { id: "error-handling", text: "Error Handling" },
]

const endpoints = [
  {
    method: "GET",
    path: "/api/executions",
    description: "List test executions with optional filters",
    params: [
      { name: "limit", type: "number", desc: "Max results (default: 50)" },
      { name: "status", type: "string", desc: "Filter by status: passed, failed, flaky" },
      { name: "branch", type: "string", desc: "Filter by git branch" },
      { name: "suite", type: "string", desc: "Filter by test suite" },
      { name: "from", type: "string", desc: "Start date (ISO 8601)" },
      { name: "to", type: "string", desc: "End date (ISO 8601)" },
    ],
  },
  {
    method: "GET",
    path: "/api/executions/:id",
    description: "Get detailed execution including test results",
    params: [],
  },
  {
    method: "GET",
    path: "/api/metrics",
    description: "Dashboard metrics: pass rate, failure counts, duration",
    params: [
      { name: "days", type: "number", desc: "Number of days to include (default: 7)" },
    ],
  },
  {
    method: "GET",
    path: "/api/trends",
    description: "Time-series pass/fail data for charts",
    params: [
      { name: "days", type: "number", desc: "Number of days (default: 14)" },
    ],
  },
  {
    method: "GET",
    path: "/api/flaky-tests",
    description: "List flaky tests sorted by flakiness rate",
    params: [
      { name: "limit", type: "number", desc: "Max results (default: 20)" },
      { name: "days", type: "number", desc: "Analysis window (default: 30)" },
    ],
  },
  {
    method: "POST",
    path: "/api/ingest",
    description: "Upload test results (used by GitHub Action)",
    params: [],
  },
]

function ParamsTable({ params }: { params: { name: string; type: string; desc: string }[] }) {
  if (params.length === 0) return null

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Parameters</h4>

      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-2">
        {params.map((param) => (
          <div key={param.name} className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-primary text-sm">{param.name}</code>
              <span className="text-xs text-muted-foreground">({param.type})</span>
            </div>
            <p className="text-sm text-muted-foreground">{param.desc}</p>
          </div>
        ))}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium">Name</th>
              <th className="text-left py-2 px-3 font-medium">Type</th>
              <th className="text-left py-2 px-3 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {params.map((param) => (
              <tr key={param.name}>
                <td className="py-2 px-3">
                  <code className="text-primary">{param.name}</code>
                </td>
                <td className="py-2 px-3 text-muted-foreground">{param.type}</td>
                <td className="py-2 px-3 text-muted-foreground">{param.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function APIDocsPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Mobile TOC */}
      <TableOfContents items={tocItems} />

      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">API Reference</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Direct REST API access for custom integrations. All endpoints require authentication
          via API key or session token.
        </p>
      </div>

      {/* Authentication */}
      <section id="authentication" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Authentication</h2>
        <p className="text-muted-foreground">
          Include your API key in the <code className="px-1 py-0.5 rounded bg-muted">Authorization</code> header:
        </p>
        <CodeBlock
          code={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://your-dashboard.com/api/executions`}
        />
        <p className="text-sm text-muted-foreground">
          Get your API key from <strong>Settings &rarr; API Keys</strong> in the dashboard.
        </p>
      </section>

      {/* Base URL */}
      <section id="base-url" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Base URL</h2>
        <CodeBlock code="https://your-dashboard.vercel.app/api" />
        <p className="text-sm text-muted-foreground">
          Replace with your actual dashboard URL.
        </p>
      </section>

      {/* Endpoints */}
      <section id="endpoints" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Endpoints</h2>

        <div className="space-y-6 sm:space-y-8">
          {endpoints.map((endpoint) => (
            <div key={endpoint.path} className="p-4 sm:p-6 rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-mono font-semibold ${
                    endpoint.method === "GET"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-blue-500/10 text-blue-500"
                  }`}
                >
                  {endpoint.method}
                </span>
                <code className="text-xs sm:text-sm font-mono break-all">{endpoint.path}</code>
              </div>

              <p className="text-muted-foreground mb-4 text-sm sm:text-base">{endpoint.description}</p>

              <ParamsTable params={endpoint.params} />
            </div>
          ))}
        </div>
      </section>

      {/* Examples */}
      <section id="examples" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Examples</h2>

        <div className="space-y-4 sm:space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Get recent executions</h3>
            <CodeBlock
              code={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-dashboard.com/api/executions?limit=10&status=failed"`}
            />
          </div>

          <div>
            <h3 className="font-semibold mb-3">Get dashboard metrics</h3>
            <CodeBlock
              code={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-dashboard.com/api/metrics?days=7"`}
            />
          </div>

          <div>
            <h3 className="font-semibold mb-3">Response format</h3>
            <CodeBlock
              code={`{
  "success": true,
  "data": {
    "totalExecutions": 150,
    "passRate": 0.92,
    "avgDuration": 45.3,
    "failedTests": 12,
    "flakyTests": 5
  }
}`}
            />
          </div>
        </div>
      </section>

      {/* Rate Limits */}
      <section id="rate-limits" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Rate Limits</h2>
        <p className="text-muted-foreground">
          API requests are rate limited to ensure fair usage:
        </p>
        <ul className="space-y-2 text-muted-foreground text-sm sm:text-base">
          <li>• <strong className="text-foreground">100 requests/minute</strong> for read endpoints</li>
          <li>• <strong className="text-foreground">10 requests/minute</strong> for write endpoints</li>
          <li>• Rate limit headers are included in responses</li>
        </ul>
      </section>

      {/* Errors */}
      <section id="error-handling" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Error Handling</h2>
        <p className="text-muted-foreground mb-4">
          Errors return appropriate HTTP status codes with JSON error details:
        </p>
        <CodeBlock
          code={`{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired API key"
  }
}`}
        />
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Common Status Codes</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><code className="text-foreground">200</code> - Success</li>
            <li><code className="text-foreground">400</code> - Bad request (invalid parameters)</li>
            <li><code className="text-foreground">401</code> - Unauthorized (invalid API key)</li>
            <li><code className="text-foreground">404</code> - Resource not found</li>
            <li><code className="text-foreground">429</code> - Rate limit exceeded</li>
            <li><code className="text-foreground">500</code> - Internal server error</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
