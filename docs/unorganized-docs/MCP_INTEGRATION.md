# MCP Integration Guide

This document explains how to set up and use the MCP (Model Context Protocol) integration with Claude Code.

## Overview

Exolar QA includes a built-in MCP server that allows Claude Code to access your test data directly through a streamlined interface. The server uses **HTTP Streamable transport** via Vercel's `mcp-handler` package.

**Key Features:**
- **5 consolidated tools** (reduced from 24) - 83% token savings
- **Router pattern** for flexible data access
- **14 queryable datasets** covering all test analytics
- **Semantic definitions** to prevent AI hallucinations
- **HTTP Streamable transport** - more reliable than legacy SSE

## Quick Start (OAuth - Recommended)

Run this command in your terminal — no token copying needed:

```bash
claude mcp add --transport http exolar-qa https://exolar.ai-innovation.site/api/mcp/mcp
```

When prompted, select **"Authenticate"** → browser opens → log in → done!

## Alternative: Manual Token Setup

If OAuth doesn't work, get a token from `/settings/mcp` and use:

```bash
claude mcp add --transport http exolar-qa https://exolar.ai-innovation.site/api/mcp/mcp \
  --header "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Configuration (Manual JSON)

If you prefer manual configuration, add this to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "exolar-qa": {
      "url": "https://exolar.ai-innovation.site/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

> **Note**: Get your token from `/settings/mcp` in the dashboard. Tokens are valid for 30 days.

## Architecture

### Transport Options

#### HTTP Streamable (Recommended)

The MCP server uses Vercel's official `mcp-handler` package with **HTTP Streamable transport**:

- **Standard compliant**: Follows the MCP specification
- **Reliable**: Automatic retry logic built-in
- **Efficient**: Better payload chunking for large responses
- **Streaming**: JSON-RPC 2.0 over HTTP with streaming support

**Endpoint**: `/api/mcp/mcp`

#### SSE (Legacy)

For backward compatibility with older MCP clients:

- **Simple auth**: Use query param `?token=your_token`
- **No headers needed**: Works with clients that don't support custom headers
- **Two endpoints**: 
  - GET `/api/mcp/sse?token=xxx` — Opens SSE stream
  - POST `/api/mcp/sse/message?token=xxx` — Sends messages

**Configuration (SSE)**:
```json
{
  "mcpServers": {
    "exolar-qa": {
      "url": "https://your-dashboard.vercel.app/api/mcp/sse?token=<your-token>"
    }
  }
}
```

### Router Pattern

Instead of 24 individual tools, the server uses a **two-level router pattern**:

1. **Tool Level**: Which category? (explore, query, action, definition, config)
2. **Dataset Level**: Which data? (executions, flaky_tests, trends, etc.)

**Benefits:**
- 83% reduction in tool definition overhead (~3,000 → ~500 tokens)
- Unified filter interface across all queries
- Better discoverability via `explore_exolar_index`
- Flexible dataset selection

### Handler Organization

```
lib/mcp/
├── auth.ts              # JWT validation (Neon Auth + MCP tokens)
├── tools.ts             # 5 consolidated tool definitions
├── definitions.ts       # Metric semantic layer
├── formatters.ts        # Output formatters (JSON/Markdown/CSV)
├── analytics.ts         # Shared business logic
└── handlers/
    ├── explore.ts       # Discovery (datasets, branches, suites, metrics)
    ├── query.ts         # Universal data router (14 datasets)
    ├── action.ts        # Heavy operations (compare, report, classify)
    └── definition.ts    # Metric definition lookup
```

## Available Tools (5 Total)

### 1. explore_exolar_index

**Purpose**: Discovery tool - call FIRST to learn what data exists in your dashboard.

**Parameters**:
```typescript
{
  category: "datasets" | "branches" | "suites" | "metrics",
  query?: string,      // Optional search filter
  format?: "json" | "markdown"
}
```

**Returns**: List of available items in the requested category.

**Examples**:
```javascript
// See all queryable datasets
explore_exolar_index({ category: "datasets" })

// List branches with execution stats
explore_exolar_index({ category: "branches" })

// Find metrics containing "rate"
explore_exolar_index({ category: "metrics", query: "rate" })
```

**Replaces**: `list_available_metrics`, `list_branches`, `list_suites`

---

### 2. query_exolar_data

**Purpose**: Universal data retrieval router. Retrieves data from any of the 14 available datasets.

**Parameters**:
```typescript
{
  dataset: "executions" | "execution_details" | "failures" | ...,
  filters?: {
    branch?: string,
    suite?: string,
    limit?: number,
    offset?: number,
    // ... (see Filter Reference below)
  },
  view_mode?: "list" | "summary" | "detailed",
  format?: "json" | "markdown"
}
```

**Available Datasets** (14):

| Dataset | Description | Key Filters |
|---------|-------------|-------------|
| `executions` | List test executions | branch, suite, status, from/to, limit |
| `execution_details` | Full execution + test results | execution_id (required) |
| `failures` | Failed tests with AI context | execution_id, error_type, limit |
| `flaky_tests` | Tests with flakiness history | min_runs, include_resolved, branch |
| `trends` | Time-series metrics | period, count, branch, suite |
| `dashboard_stats` | Overall metrics summary | from/to, branch, suite, lastRunOnly |
| `error_analysis` | Error type distribution | since, branch, suite |
| `test_search` | Search tests by name/file | query (required), limit |
| `test_history` | Test run history | test_signature (required), limit |
| `flakiness_summary` | Overall flakiness metrics | branch, suite |
| `reliability_score` | Suite health (0-100) | from/to, branch, suite, lastRunOnly |
| `performance_regressions` | Tests slower than baseline | threshold, hours, sort_by, branch, suite |
| `execution_summary` | Execution overview | execution_id (required) |
| `execution_failures` | Failures for execution | execution_id (required), limit |

**Examples**:
```javascript
// Get recent executions on main branch
query_exolar_data({
  dataset: "executions",
  filters: { branch: "main", limit: 10 }
})

// Get flaky tests with at least 5 runs
query_exolar_data({
  dataset: "flaky_tests",
  filters: { min_runs: 5, include_resolved: false }
})

// Get full execution details
query_exolar_data({
  dataset: "execution_details",
  filters: { execution_id: 123 }
})

// Search for login tests
query_exolar_data({
  dataset: "test_search",
  filters: { query: "login" }
})
```

**Replaces**: 15 individual `get_*` tools (get_executions, get_failed_tests, get_flaky_tests, get_trends, get_dashboard_metrics, get_error_distribution, search_tests, get_test_history, get_flakiness_summary, get_reliability_score, get_performance_regressions, and more)

---

### 3. perform_exolar_action

**Purpose**: Execute heavy operations like comparing executions, generating reports, or classifying failures.

**Actions**:

#### compare
Compare two test executions side-by-side.

**Parameters**:
```typescript
{
  action: "compare",
  params: {
    // Option A: Compare by execution IDs
    baseline_id?: number,
    current_id?: number,

    // Option B: Compare by branches (uses latest executions)
    baseline_branch?: string,
    current_branch?: string,

    suite?: string,
    filter?: "new_failure" | "fixed" | "new_test" | "removed_test"
  }
}
```

**Example**:
```javascript
// Compare main vs feature branch
perform_exolar_action({
  action: "compare",
  params: {
    baseline_branch: "main",
    current_branch: "feature-auth"
  }
})
```

#### generate_report
Generate a markdown failure report for an execution.

**Parameters**:
```typescript
{
  action: "generate_report",
  params: {
    execution_id: number
  }
}
```

#### classify
Classify a test failure as FLAKE or BUG using historical data.

**Parameters**:
```typescript
{
  action: "classify",
  params: {
    // Option A: By test_id
    test_id?: number,

    // Option B: By execution + test name
    execution_id?: number,
    test_name?: string,
    test_file?: string
  }
}
```

**Returns**:
- `suggested_classification`: "FLAKE" | "BUG" | "UNKNOWN"
- `confidence`: 0.0-1.0 score
- `classification_signals`: Weighted indicators
- `historical_metrics`: Flakiness rate, total runs
- `recent_runs`: Last 10 executions

**Example**:
```javascript
// Classify a failure
perform_exolar_action({
  action: "classify",
  params: {
    execution_id: 123,
    test_name: "should login successfully"
  }
})
```

**Replaces**: `compare_executions`, `generate_failure_report`, `classify_failure`

---

### 4. get_semantic_definition

**Purpose**: Get metric definitions to prevent AI hallucinations about how metrics are calculated.

**Parameters**:
```typescript
{
  metric_id: string  // e.g., "pass_rate", "flaky_rate", "reliability_score"
}
```

**Returns**:
```typescript
{
  id: string,
  name: string,
  category: "execution" | "flakiness" | "performance" | "reliability",
  type: "percentage" | "count" | "duration" | "score" | "rate",
  formula: string,        // Exact calculation formula
  description: string,
  unit?: string,
  thresholds?: {
    healthy?: number,
    warning?: number,
    critical?: number
  },
  relatedTools?: string[]
}
```

**Example**:
```javascript
// Understand pass_rate calculation
get_semantic_definition({ metric_id: "pass_rate" })
→ {
  formula: "(passed_tests / total_tests) × 100",
  thresholds: { healthy: 95, warning: 80, critical: 0 },
  description: "Percentage of tests that passed. Does not include skipped tests in numerator."
}
```

**This is a new tool**: Prevents misunderstanding of metric calculations by providing explicit formulas.

---

### 5. get_installation_config

**Purpose**: Get CI/CD integration code snippets and setup instructions.

**Parameters**:
```typescript
{
  section?: "api_endpoint" | "playwright_reporter" | "github_actions" | "env_variables" | "all"
}
```

**Returns**: Code snippets and step-by-step setup instructions for integrating Exolar QA with your CI/CD pipeline.

**Example**:
```javascript
// Get all setup instructions
get_installation_config({ section: "all" })

// Get only GitHub Actions config
get_installation_config({ section: "github_actions" })
```

**Unchanged**: Same functionality as before consolidation.

### 5.1 Using the Integration Engineer Persona (NEW in v2.1)

When using `get_installation_config`, Claude Code automatically adopts the **Integration Engineer** persona to guide you through setup.

**Conversational Flow:**
1. **Discovery**: Claude will ask about your CI provider (GitHub Actions recommended) and project structure (monorepo?)
2. **Adaptation**: You'll receive configuration specific to your environment with highlighted critical steps
3. **Validation**: Claude will suggest dry run commands to verify the integration before pushing to CI

**Example Conversation:**
```
You: "Help me integrate Exolar with my Playwright tests"

Claude (Integration Engineer): "I'll help you set up Exolar! First, which CI provider
are you using? (GitHub Actions recommended, or running locally?)"

You: "GitHub Actions"

Claude: "Perfect! Here are your GitHub Actions setup instructions:

1. Add EXOLAR_API_KEY secret in Settings > Secrets > Actions
2. Install the package: npm install @exolar/reporter
3. MERGE (don't replace!) the reporter into your playwright.config.ts reporters array
4. Update your .github/workflows/playwright.yml with...

Would you like me to explain how to merge the reporter config?"
```

**Alternative: Router Pattern with Filters**

You can also use the router pattern to get pre-filtered configuration:

```typescript
query_exolar_data({
  dataset: "setup_guide",
  filters: {
    ci_provider: "github",    // or "local" (v2.1 focus)
    framework: "playwright",
    monorepo: false,          // or true
    section: "all"            // or specific section
  }
})
```

This returns the same configuration but wrapped with metadata about the filters used.

**Benefits:**
- No guessing about where to put the EXOLAR_TOKEN
- Clear instructions: MERGE vs REPLACE config files
- CI-specific secrets management steps (GitHub Actions path: Settings > Secrets > Actions)
- Monorepo-aware guidance (where to place reporters, per-package config)
- Built-in validation commands (dry run locally before CI push)

**Future Enhancements (post-v2.1):**
- GitLab CI specific instructions
- Azure DevOps pipeline configuration
- CircleCI orb integration

---

## Filter Reference

### Common Filters (used across multiple datasets)

| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| `branch` | string | Filter by branch name | `"main"` |
| `suite` | string | Filter by test suite | `"e2e"` |
| `from` | string | Start date (ISO 8601) | `"2025-01-01T00:00:00Z"` |
| `to` | string | End date (ISO 8601) | `"2025-01-10T23:59:59Z"` |
| `date_range` | enum | Predefined date ranges | `"last_24h"`, `"last_7d"`, `"last_30d"`, `"last_90d"` |
| `limit` | number | Max results to return | `20` (default) |
| `offset` | number | Skip N results (pagination) | `0` (default) |
| `execution_id` | number | Specific execution ID | `123` |
| `query` | string | Search text | `"login"` |
| `status` | string | Filter by status | `"passed"`, `"failed"`, `"flaky"` |

### Dataset-Specific Filters

**flaky_tests**:
- `min_runs`: Minimum number of runs (default: 5)
- `include_resolved`: Include tests that are no longer flaky (default: false)

**performance_regressions**:
- `threshold`: Minimum slowdown percentage (default: 20)
- `hours`: Time window in hours (default: 24)
- `sort_by`: "regression" | "duration" | "name" (default: "regression")

**reliability_score**:
- `lastRunOnly`: Show only last run metrics (default: false)

**trends**:
- `period`: "hour" | "day" | "week" | "month" (default: "day")
- `count`: Number of periods (default: 7)

**test_search**:
- `query`: Search text (required)

**test_history**:
- `test_signature`: Test identifier (required)

## Usage Patterns

### Pattern 1: Discovery First

Start by exploring what data is available:

```javascript
// 1. See all datasets
explore_exolar_index({ category: "datasets" })

// 2. Check available branches
explore_exolar_index({ category: "branches" })

// 3. Query specific dataset
query_exolar_data({
  dataset: "executions",
  filters: { branch: "main", limit: 10 }
})
```

### Pattern 2: Filtered Queries

Use filters to narrow down results:

```javascript
query_exolar_data({
  dataset: "executions",
  filters: {
    branch: "main",
    suite: "e2e",
    date_range: "last_7d",
    status: "failed",
    limit: 10
  }
})
```

### Pattern 3: Metric Definitions

When you see an unfamiliar metric:

```javascript
// 1. See a metric like "stability_index"
// 2. Get its definition
get_semantic_definition({ metric_id: "stability_index" })
// 3. Understand formula and thresholds
```

### Pattern 4: Execution Comparison

Compare test runs:

```javascript
// Compare by branches
perform_exolar_action({
  action: "compare",
  params: {
    baseline_branch: "main",
    current_branch: "feature-auth",
    filter: "new_failure"  // Show only regressions
  }
})
```

### Pattern 5: Failure Classification

Determine if a failure is a flake or real bug:

```javascript
perform_exolar_action({
  action: "classify",
  params: {
    execution_id: 123,
    test_name: "should handle timeouts"
  }
})
```

## Example Prompts

Once configured, you can ask Claude things like:

**Discovery**:
- "Show me what datasets are available"
- "List all branches with their stats"
- "What metrics can I query?"

**Querying Data**:
- "Get recent test failures on main branch"
- "Show me the flakiest tests with at least 5 runs"
- "What were the test results from the last CI run?"
- "Search for tests related to login"
- "Get metrics for the past week"

**Analysis**:
- "What's the health score for my test suite?"
- "Are there any performance regressions on the main branch?"
- "Show me tests that got slower in the last 24 hours"
- "What's the error distribution for failed tests?"

**Comparison**:
- "Compare the last two runs on main branch"
- "What tests broke in the feature branch compared to main?"
- "Show me new failures between execution 123 and 456"

**Classification**:
- "Is this test failure a flake or a real bug?"
- "Classify the failure in test 'should login successfully'"

**Setup**:
- "Help me set up MCP integration"
- "How do I configure GitHub Actions?"

**Definitions**:
- "What's the formula for pass rate?"
- "How is reliability score calculated?"

## Output Formats

### Markdown (Default)

- CLI-friendly tables
- Human-readable format
- **~70% fewer tokens than JSON**
- Easier to scan in Claude Code

**Example**:
```markdown
| Test Name | Status | Duration |
|-----------|--------|----------|
| login.test | passed | 1.2s     |
| auth.test  | failed | 2.5s     |
```

### JSON

- Structured data for programmatic use
- Full details included
- Better for parsing

**Example**:
```json
{
  "tests": [
    {
      "name": "login.test",
      "status": "passed",
      "duration": 1200
    }
  ]
}
```

Specify format in tool parameters: `format: "json"` or `format: "markdown"`

## Environment Variables

### Required for MCP

| Variable | Description | Example |
|----------|-------------|---------|
| `NEON_AUTH_JWKS_URL` | Neon Auth JWKS endpoint | `https://auth.neon.tech/.well-known/jwks.json` |
| `DATABASE_URL` | PostgreSQL connection | Already set from Neon |

### Setting in Vercel

1. Go to Project Settings → Environment Variables
2. Add `NEON_AUTH_JWKS_URL` = `https://auth.neon.tech/.well-known/jwks.json`
3. Redeploy the application

## Authentication

The MCP server validates JWT tokens from Neon Auth:

1. **Token Verification**: Uses JWKS (JSON Web Key Set) to verify token signatures
2. **User Context**: Extracts user ID, email, and organization membership
3. **Organization Scoping**: All queries are automatically filtered by organization
4. **RLS Protection**: Database-level Row Level Security provides additional isolation

**Token Expiration**: Tokens expire after a period of time. When you see authentication errors, get a new token from the browser developer tools.

## Troubleshooting

### "Invalid or expired token"

**Solution**: Get a new token from browser dev tools:
1. Log into dashboard
2. F12 → Network tab
3. Reload page
4. Copy Authorization header value

### "User not found"

**Causes**:
- Not logged into dashboard
- No organization assigned
- Token from different session

**Solution**:
1. Log into dashboard
2. Ensure you have an organization assigned
3. Get new token from same session

### Connection fails

**Check**:
1. Dashboard is deployed and accessible
2. `NEON_AUTH_JWKS_URL` is set in Vercel environment variables
3. Your network can reach the dashboard URL
4. URL in config is correct: `/api/mcp/mcp` (not `/api/mcp`)

### Tool not found

**Cause**: Using old tool names from the 24-tool version

**Solution**: Use the 5 consolidated tools:
- Old: `get_executions` → New: `query_exolar_data({ dataset: "executions" })`
- Old: `list_branches` → New: `explore_exolar_index({ category: "branches" })`
- Old: `compare_executions` → New: `perform_exolar_action({ action: "compare" })`

### Empty results

**Check**:
1. You have test data in your organization
2. Filters are not too restrictive
3. Branch/suite names are correct
4. Date ranges include recent data

## Security

### Data Isolation

- **Organization-scoped queries**: All data automatically filtered by organization
- **User verification**: JWT tokens verified using Neon Auth JWKS
- **Database RLS**: Row Level Security policies provide additional protection
- **No cross-tenant access**: Users can only access their organization's data

### Token Security

- **HTTPS only**: All communication encrypted in transit
- **No token storage**: Tokens not stored server-side
- **Expiration**: Tokens expire after period of inactivity
- **Header-based auth**: Tokens passed via Authorization header

### Best Practices

1. **Never commit tokens**: Keep `.claude.json` out of version control
2. **Rotate regularly**: Get new tokens periodically
3. **Limit scope**: Tokens are org-scoped automatically
4. **Secure storage**: Store tokens in secure credential managers

## Migration from Old Tool Set

If you were using the previous 24-tool version:

### Tool Mapping

| Old Tool | New Tool | Parameters |
|----------|----------|------------|
| `list_available_metrics` | `explore_exolar_index` | `{ category: "metrics" }` |
| `list_branches` | `explore_exolar_index` | `{ category: "branches" }` |
| `list_suites` | `explore_exolar_index` | `{ category: "suites" }` |
| `get_executions` | `query_exolar_data` | `{ dataset: "executions" }` |
| `get_execution_details` | `query_exolar_data` | `{ dataset: "execution_details" }` |
| `get_failed_tests` | `query_exolar_data` | `{ dataset: "failures" }` |
| `get_flaky_tests` | `query_exolar_data` | `{ dataset: "flaky_tests" }` |
| `get_trends` | `query_exolar_data` | `{ dataset: "trends" }` |
| `get_dashboard_metrics` | `query_exolar_data` | `{ dataset: "dashboard_stats" }` |
| `get_error_distribution` | `query_exolar_data` | `{ dataset: "error_analysis" }` |
| `search_tests` | `query_exolar_data` | `{ dataset: "test_search" }` |
| `get_test_history` | `query_exolar_data` | `{ dataset: "test_history" }` |
| `get_flakiness_summary` | `query_exolar_data` | `{ dataset: "flakiness_summary" }` |
| `get_reliability_score` | `query_exolar_data` | `{ dataset: "reliability_score" }` |
| `get_performance_regressions` | `query_exolar_data` | `{ dataset: "performance_regressions" }` |
| `compare_executions` | `perform_exolar_action` | `{ action: "compare" }` |
| `generate_failure_report` | `perform_exolar_action` | `{ action: "generate_report" }` |
| `classify_failure` | `perform_exolar_action` | `{ action: "classify" }` |
| `get_installation_config` | `get_installation_config` | (unchanged) |

### Benefits of Migration

- **83% fewer tokens**: Tool definitions reduced from ~3,000 to ~500 tokens
- **Simpler interface**: One tool (`query_exolar_data`) replaces 15 tools
- **Better discovery**: `explore_exolar_index` shows what's available
- **Unified filters**: Consistent filter interface across all datasets
- **Semantic layer**: Metric definitions prevent hallucinations

## Additional Resources

- **Settings Page**: `/settings/mcp` - Get your configuration
- **Project Documentation**: `CLAUDE.md` - Development guidelines
- **Source Code**: `lib/mcp/` - Implementation details
- **Handler Code**: `lib/mcp/handlers/` - Dataset routing logic

## Support

For issues or questions:
1. Check this documentation first
2. Review troubleshooting section
3. Inspect browser console for errors
4. Verify environment variables in Vercel
5. Check Vercel deployment logs

---

**Last Updated**: 2026-01-10
**MCP Version**: 2.0 (Router Pattern)
**Transport**: HTTP Streamable via `mcp-handler` v1.0.7
