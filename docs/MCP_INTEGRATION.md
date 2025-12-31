# MCP Integration Guide

This document explains how to set up and use the MCP (Model Context Protocol) integration with Claude Code.

## Overview

The E2E Test Dashboard includes a built-in MCP server at `/api/mcp` that allows Claude Code to access your test data directly. This enables Claude to:

- Query test executions and results
- Search for specific tests
- Analyze failures and flakiness
- Access metrics and trends

## Quick Start

1. **Get Your Configuration**
   - Log into the dashboard
   - Go to `/settings/mcp`
   - Copy the configuration JSON

2. **Add to Claude Code**
   - Open or create `~/.claude.json`
   - Paste the configuration
   - Replace `<your-token>` with your actual token

3. **Use Claude Code**
   - Restart Claude Code
   - Ask Claude to access your test data

## Configuration

The MCP configuration looks like this:

```json
{
  "mcpServers": {
    "e2e-dashboard": {
      "url": "https://your-dashboard.vercel.app/api/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer <your-neon-auth-token>"
      }
    }
  }
}
```

## Getting Your Token

Your Neon Auth token can be obtained from the browser developer tools:

1. Log into the dashboard
2. Open Developer Tools (F12)
3. Go to Network tab
4. Make any request (reload the page)
5. Look for the `Authorization` header in the request headers
6. Copy the token after `Bearer `

> **Note**: Tokens expire after a period of time. You may need to get a new token periodically.

## Environment Variables

### Required for MCP

| Variable | Description | Example |
|----------|-------------|---------|
| `NEON_AUTH_JWKS_URL` | Neon Auth JWKS endpoint | `https://auth.neon.tech/.well-known/jwks.json` |
| `DATABASE_URL` | PostgreSQL connection | Already set from Neon |

### In Vercel

Set `NEON_AUTH_JWKS_URL` in your Vercel project:
1. Go to Project Settings → Environment Variables
2. Add: `NEON_AUTH_JWKS_URL` = `https://auth.neon.tech/.well-known/jwks.json`

## Available Tools

### Core Query Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_executions` | List test executions | `limit`, `status`, `branch`, `suite`, `from`, `to` |
| `get_execution_details` | Get execution + results | `execution_id` (required) |
| `search_tests` | Search by name/file | `query` (required), `limit` |
| `get_test_history` | Test run history | `test_signature` (required), `limit` |

### Analysis Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_failed_tests` | Failed tests with AI context | `error_type`, `limit`, `since` |
| `get_dashboard_metrics` | Overall metrics | `from`, `to` |
| `get_trends` | Time-series data | `days` |
| `get_error_distribution` | Error type breakdown | `since` |

### Flakiness Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_flaky_tests` | Flaky tests list | `limit`, `min_runs` |
| `get_flakiness_summary` | Overall flakiness | (none) |

### Resource Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_branches` | Available branches | (none) |
| `list_suites` | Available test suites | (none) |

## Example Prompts

Once configured, you can ask Claude things like:

- "Get my recent test failures"
- "Search for tests related to login"
- "Show me the flakiest tests"
- "What were the test results from the last CI run?"
- "Get metrics for the past week"
- "Show error distribution for failed tests"

## Troubleshooting

### "Invalid or expired token"

Your token may have expired. Get a new token from the browser developer tools.

### "User not found"

Ensure you:
1. Are logged into the dashboard
2. Have an organization assigned
3. Used the token from the same session

### Connection fails

Check:
1. Dashboard is deployed and accessible
2. `NEON_AUTH_JWKS_URL` is set in Vercel
3. Your network can reach the dashboard URL

## Security

- All data is organization-scoped
- Users can only access their organization's data
- JWT tokens are verified using Neon Auth's JWKS
- RLS policies provide additional database-level security
