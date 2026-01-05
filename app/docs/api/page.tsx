"use client"

import { CodeBlock } from "@/components/docs/code-block"
import { APIEndpoint } from "@/components/docs/api-endpoint"

const endpoints = [
  {
    method: "GET" as const,
    path: "/api/executions",
    description: "List test executions with optional filters",
    parameters: [
      { name: "limit", type: "number", default: "50", description: "Max results to return" },
      { name: "status", type: "string", description: "Filter by status: passed, failed, flaky" },
      { name: "branch", type: "string", description: "Filter by git branch" },
      { name: "suite", type: "string", description: "Filter by test suite" },
      { name: "from", type: "string", description: "Start date (ISO 8601)" },
      { name: "to", type: "string", description: "End date (ISO 8601)" },
    ],
    curlExample: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-dashboard.com/api/executions?limit=10&status=failed"`,
    responseExample: `{
  "success": true,
  "data": [
    {
      "id": 123,
      "suite": "e2e-tests",
      "branch": "main",
      "status": "failed",
      "passed_count": 45,
      "failed_count": 3,
      "duration_ms": 120000
    }
  ]
}`,
  },
  {
    method: "GET" as const,
    path: "/api/executions/:id",
    description: "Get detailed execution including all test results and artifacts",
    parameters: [
      { name: "id", type: "number", required: true, description: "Execution ID" },
    ],
    curlExample: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-dashboard.com/api/executions/123"`,
  },
  {
    method: "GET" as const,
    path: "/api/metrics",
    description: "Dashboard metrics: pass rate, failure counts, duration averages",
    parameters: [
      { name: "days", type: "number", default: "7", description: "Number of days to include" },
    ],
    curlExample: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-dashboard.com/api/metrics?days=7"`,
    responseExample: `{
  "success": true,
  "data": {
    "totalExecutions": 150,
    "passRate": 0.92,
    "avgDuration": 45.3,
    "failedTests": 12,
    "flakyTests": 5
  }
}`,
  },
  {
    method: "GET" as const,
    path: "/api/trends",
    description: "Time-series pass/fail data with flexible granularity (hourly, daily, weekly, monthly)",
    parameters: [
      { name: "days", type: "number", default: "14", description: "Number of days to include" },
      { name: "period", type: "string", default: "day", description: "Granularity: hour | day | week | month" },
      { name: "from", type: "string", description: "Start date (ISO 8601)" },
      { name: "to", type: "string", description: "End date (ISO 8601)" },
    ],
    curlExample: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-dashboard.com/api/trends?period=week&days=28"`,
  },
  {
    method: "GET" as const,
    path: "/api/flaky-tests",
    description: "List flaky tests sorted by flakiness rate",
    parameters: [
      { name: "limit", type: "number", default: "20", description: "Max results to return" },
      { name: "days", type: "number", default: "30", description: "Analysis window in days" },
    ],
    curlExample: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-dashboard.com/api/flaky-tests?limit=10"`,
  },
  {
    method: "GET" as const,
    path: "/api/compare",
    description: "Compare two executions to identify regressions, improvements, and performance changes",
    parameters: [
      { name: "baseline", type: "number", description: "Baseline execution ID" },
      { name: "current", type: "number", description: "Current execution ID" },
      { name: "baseline_branch", type: "string", description: "Use latest from this branch as baseline" },
      { name: "current_branch", type: "string", description: "Use latest from this branch as current" },
      { name: "suite", type: "string", description: "Filter to specific suite (for branch lookups)" },
      { name: "filter", type: "string", description: "Filter: new_failure | fixed | new_test | removed_test | performance_regression | all" },
      { name: "performance_threshold", type: "number", default: "20", description: "% change threshold for regression/improvement" },
    ],
    curlExample: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-dashboard.com/api/compare?baseline_branch=main&current_branch=feature-x"`,
    responseExample: `{
  "baseline": { "id": 123, "branch": "main", ... },
  "current": { "id": 456, "branch": "feature-x", ... },
  "summary": {
    "passRateDelta": -5.2,
    "newFailures": 3,
    "fixed": 1
  },
  "performanceSummary": {
    "regressions": 2,
    "improvements": 5,
    "stable": 42,
    "threshold_pct": 20
  },
  "tests": [
    { "testName": "Login test", "diffCategory": "new_failure", "durationCategory": "stable", ... }
  ]
}`,
  },
  {
    method: "POST" as const,
    path: "/api/ingest",
    description: "Upload test results (used by Playwright Reporter and GitHub Action)",
    parameters: [],
    requestBody: `{
  "suite": "e2e-tests",
  "branch": "main",
  "commit_sha": "abc123",
  "tests": [
    {
      "name": "Login test",
      "status": "passed",
      "duration_ms": 1500
    }
  ]
}`,
    curlExample: `curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"suite":"e2e-tests",...}' \\
  "https://your-dashboard.com/api/ingest"`,
  },
]

export default function APIDocsPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
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

        <div className="grid gap-4">
          {endpoints.map((endpoint) => (
            <APIEndpoint key={endpoint.path} {...endpoint} />
          ))}
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
