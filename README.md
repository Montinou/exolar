# Exolar QA (formerly E2E Test Dashboard)

A comprehensive multi-tenant dashboard for monitoring Playwright test executions from GitHub Actions with NeonDB, Row-Level Security, and Cloudflare R2 integration.

## Features

- **🧠 AI Vector Search** (NEW): Semantic failure clustering & natural language test search using Jina v3 embeddings
- **Smart Failure Clustering**: Automatically group 50+ failures into root cause clusters ("50 failures → 3 issues")
- **Semantic Test Search**: Find tests by intent ("timeout errors") not just file names
- **Reliability Score**: Single 0-100 gauge showing overall test suite health at a glance
- **Performance Regression Detection**: Automatic alerts when tests become slower than baseline
- **Multi-Tenancy**: Organization-level data isolation with RLS
- **Real-time Metrics**: Pass rates, average duration, critical failures, and execution counts
- **Flaky Test Detection**: Automatically identify and track flaky tests with statistical analysis
- **Trend Visualization**: 7-day trend charts showing test stability over time
- **Detailed Test Results**: View individual test failures with error messages and stack traces
- **Artifact Management**: Access test videos, traces, and screenshots stored in Cloudflare R2
- **Smart Filtering**: Filter by status, branch, and date range
- **Admin Panel**: Manage users, invites, and organizations
- **Responsive Design**: Mobile-friendly interface with dark mode

## Getting Started

### 1. Database Setup

Run the SQL scripts in order:

```bash
# Core tables
psql $DATABASE_URL -f scripts/001_create_test_tables.sql
psql $DATABASE_URL -f scripts/003_add_logs_and_signature.sql
psql $DATABASE_URL -f scripts/005_flaky_test_detection.sql
psql $DATABASE_URL -f scripts/007_create_user_tables.sql
psql $DATABASE_URL -f scripts/008_add_ai_context.sql

# Multi-tenancy (required)
psql $DATABASE_URL -f scripts/009_add_organizations.sql
psql $DATABASE_URL -f scripts/010_add_rls_policies.sql
```

### 2. Environment Variables

The following variables are already configured from your Neon integration:
- `DATABASE_URL` - PostgreSQL connection string

#### Optional: Cloudflare R2 (for test artifacts)

Add these variables to enable artifact downloads:
- `R2_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 access key ID
- `R2_SECRET_ACCESS_KEY` - R2 secret access key
- `R2_BUCKET_NAME` - R2 bucket name

**Note**: The dashboard works without R2 - artifact links will be disabled if R2 is not configured.

### 3. GitHub Actions Integration

To populate the dashboard with real data, modify your GitHub Actions workflow to insert test results:

```yaml
- name: Run Playwright Tests
  run: npx playwright test
  
- name: Upload Results to Dashboard
  if: always()
  run: |
    # Insert execution record
    psql $DATABASE_URL -c "INSERT INTO test_executions (...) VALUES (...);"
    
    # Insert test results
    # Parse your test results and insert into test_results table
```

See the database schema in `scripts/001_create_test_tables.sql` for field definitions.

## Architecture

- **Database**: PostgreSQL (Neon) with optimized indexes for query performance
- **Storage**: Cloudflare R2 for test artifacts (videos, traces, screenshots)
- **API**: Next.js App Router with Server Components and Route Handlers
- **UI**: React 19 with shadcn/ui components and Recharts for visualization
- **Styling**: TailwindCSS v4 with dark mode theme

## API Endpoints

### Test Data (org-filtered)
- `GET /api/executions` - List test executions
- `GET /api/executions/[id]` - Get detailed execution results
- `GET /api/metrics` - Dashboard metrics
- `GET /api/trends` - Trend data for charts
- `GET /api/search` - Search tests
- `GET /api/flakiness` - Flaky test data
- `GET /api/tests/[signature]` - Test history
- `GET /api/artifacts/[id]/signed-url` - Generate R2 signed URLs
- `POST /api/test-results` - Ingest test results (API key auth)

### Organization Management
- `GET/POST /api/organizations` - List/create organizations
- `GET/PATCH/DELETE /api/organizations/[id]` - Single org operations
- `GET/POST /api/organizations/[id]/members` - Manage members
- `PATCH/DELETE /api/organizations/[id]/members/[userId]` - Update/remove member

### Admin
- `GET /api/admin/organizations` - List all orgs (admin only)
- `GET/POST/DELETE /api/admin/users` - User management
- `GET/POST/DELETE /api/admin/invites` - Invite management

### MCP (Model Context Protocol)
- `GET /api/mcp` - Health check
- `POST /api/mcp` - MCP JSON-RPC endpoint for Claude Code

## MCP Integration (Claude Code)

The dashboard includes a built-in MCP server that allows Claude Code to access your test data directly.

### Setup for Users

1. Log into the dashboard and go to **Settings > MCP Integration** (`/settings/mcp`)
2. Copy the configuration shown on the page
3. Add it to `~/.claude.json` or your project's `.claude.json`
4. Replace `<your-token>` with your Neon Auth token
5. Restart Claude Code

### Available MCP Tools (5 Consolidated + 16 Datasets)

The MCP server uses a **router pattern** with 5 consolidated tools:

| Tool | Description |
|------|-------------|
| `explore_exolar_index` | Discovery tool - lists datasets, branches, suites, or metrics |
| `query_exolar_data` | Universal data retrieval with 16 datasets |
| `perform_exolar_action` | Heavy operations: compare, report, classify, find_similar |
| `get_semantic_definition` | Metric formulas to prevent AI hallucinations |
| `get_installation_config` | CI/CD setup guide for Playwright/GitHub Actions |

#### 16 Available Datasets (via query_exolar_data)

| Dataset | Description |
|---------|-------------|
| `executions` | List test executions with filters |
| `execution_details` | Full execution data with test results |
| `failures` | Failed tests with AI context |
| `flaky_tests` | Tests with flakiness history |
| `trends` | Time-series metrics |
| `dashboard_stats` | Overall metrics summary |
| `error_analysis` | Error type distribution |
| `test_search` | Search by name/file |
| `test_history` | History for a specific test |
| `flakiness_summary` | Overall flakiness metrics |
| `reliability_score` | Suite health (0-100) |
| `performance_regressions` | Tests slower than baseline |
| `execution_summary` | Lightweight execution overview |
| `execution_failures` | Failures with error grouping |
| `clustered_failures` | 🧠 AI-grouped failures by similarity |
| `semantic_search` | 🧠 Natural language failure search |

### MCP Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEON_AUTH_JWKS_URL` | Yes | Neon Auth JWKS endpoint for JWT validation |
| `DATABASE_URL` | Yes | Already set from Neon integration |

> **Note**: The MCP endpoint uses the same domain as the dashboard (`/api/mcp`), so no separate MCP server URL is needed.

## Development

The dashboard automatically refreshes data on page load. For real-time updates, the system polls the API every 30 seconds when viewing execution details.

## Production Deployment

1. Run database migrations in your Neon production database
2. Add R2 credentials to Vercel environment variables
3. Set `NEON_AUTH_JWKS_URL` for MCP authentication
4. Deploy to Vercel with the "Publish" button
5. Configure your GitHub Actions to send data to the production database
