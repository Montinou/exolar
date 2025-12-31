# E2E Dashboard MCP Server

Hosted MCP (Model Context Protocol) server with Neon Auth authentication for the E2E Test Dashboard.

## Features

- **Per-organization data isolation** - All queries automatically filter by user's organization
- **Neon Auth token validation** - JWT verification using JWKS
- **12 tools** for accessing test data
- **R2 artifact URL signing** - Generate signed URLs for screenshots/videos

## Setup for Users

1. Log into the E2E Dashboard at https://your-dashboard.vercel.app
2. Go to **Settings > MCP Integration** (`/settings/mcp`)
3. Copy your configuration
4. Add to `~/.claude.json` or project `.claude.json`
5. Restart Claude Code

## Available Tools

### Core Query Tools
| Tool | Description |
|------|-------------|
| `get_executions` | List test executions with filters (status, branch, suite, date range) |
| `get_execution_details` | Get execution + all test results and artifacts |
| `search_tests` | Search tests by name/file, returns aggregated stats |
| `get_test_history` | Get history for a specific test signature |

### Analysis & Metrics Tools
| Tool | Description |
|------|-------------|
| `get_failed_tests` | Failed tests with AI context, error type filtering |
| `get_dashboard_metrics` | Overall metrics: pass rate, failure rate, avg duration |
| `get_trends` | Time-series pass/fail data over N days |
| `get_error_distribution` | Breakdown of error types |

### Flakiness Tools
| Tool | Description |
|------|-------------|
| `get_flaky_tests` | List flaky tests sorted by flakiness rate |
| `get_flakiness_summary` | Overall flakiness metrics |

### Artifact Tools
| Tool | Description |
|------|-------------|
| `list_artifacts` | List artifacts for a test result |
| `get_artifact_url` | Generate signed URL for downloading artifacts |

## Configuration Example

```json
{
  "mcpServers": {
    "e2e-dashboard": {
      "url": "https://e2e-dashboard-mcp.vercel.app/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer <your-neon-auth-token>"
      }
    }
  }
}
```

## Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEON_AUTH_JWKS_URL` | Neon Auth JWKS endpoint for token verification |

### Optional (for artifacts)
| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |

## Local Development

```bash
cd mcp-server
npm install
npm run dev
```

Server runs on http://localhost:3001

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth required) |
| POST | `/mcp` | MCP JSON-RPC requests |
| GET | `/mcp/sse` | SSE streaming endpoint |

## Deployment

Deploy to Vercel:

```bash
cd mcp-server
vercel
```

Then update `NEXT_PUBLIC_MCP_SERVER_URL` in the dashboard's environment variables.
