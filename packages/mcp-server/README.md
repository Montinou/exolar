# E2E Test Dashboard MCP Server

An MCP (Model Context Protocol) server that provides Claude Code with direct access to your E2E test execution data from the E2E Test Dashboard.

## Quick Start

### Step 1: Authenticate

Run this command to open your browser and log in to the dashboard:

```bash
npx e2e-test-dashboard-mcp --login
```

This will:
1. Open your browser to the dashboard login page
2. After you log in, redirect back to complete authentication
3. Store your credentials securely in `~/.e2e-dashboard-mcp/config.json`

### Step 2: Add to Claude Code

```bash
claude mcp add --transport stdio e2e-dashboard -- npx -y e2e-test-dashboard-mcp
```

That's it! Claude Code now has access to your test data.

## Available Commands

```bash
# Authenticate with the dashboard (opens browser)
npx e2e-test-dashboard-mcp --login

# Check authentication status
npx e2e-test-dashboard-mcp --status

# Clear stored credentials
npx e2e-test-dashboard-mcp --logout

# Show help
npx e2e-test-dashboard-mcp --help

# Use a custom dashboard URL
npx e2e-test-dashboard-mcp --login --url https://your-dashboard.com
```

## Available Tools

Once connected, Claude Code can use these tools:

### Core Data Retrieval
- **`get_executions`** - List test executions with filters (status, branch, suite, date range)
- **`get_execution_details`** - Get execution details including all test results and artifacts
- **`search_tests`** - Search tests by name/file with aggregated statistics
- **`get_test_history`** - Get execution history for a specific test over time

### Analysis Tools
- **`get_failed_tests`** - Get failed tests with AI-enriched context and error types
- **`get_dashboard_metrics`** - Overall metrics: pass rate, failure counts, avg duration
- **`get_trends`** - Time-series pass/fail data over configurable days
- **`get_error_distribution`** - Breakdown of error types from failures

### Flakiness Tools
- **`get_flaky_tests`** - Flaky tests sorted by flakiness rate
- **`get_flakiness_summary`** - Overall flakiness metrics

### Metadata Tools
- **`list_branches`** - Branches with test runs in last 30 days
- **`list_suites`** - Test suites with recent runs

## Usage Examples

After connecting, ask Claude things like:

- "Show me recent test failures"
- "What are our flakiest tests?"
- "Search for tests related to login"
- "Get the dashboard metrics for the last 7 days"
- "Show me the error distribution from this week"
- "What's the test history for the checkout test?"

## How It Works

1. **Authentication**: The `--login` command opens your browser to authenticate with the dashboard. After successful login, you're redirected back and a secure token is stored locally.

2. **Token Storage**: Credentials are stored in `~/.e2e-dashboard-mcp/config.json` with restricted permissions (readable only by you).

3. **API Requests**: When Claude Code uses the MCP server, it proxies requests to your dashboard's API using the stored token.

4. **Token Expiry**: Tokens expire after 30 days. Run `--login` again to refresh.

## Security

- Tokens are stored with `0600` permissions (owner read/write only)
- Tokens are JWT-signed and validated server-side
- All data is scoped to your organization
- You can revoke access anytime with `--logout`

## Troubleshooting

### "Not authenticated" error
Run `npx e2e-test-dashboard-mcp --login` to authenticate.

### "Token expired" error
Your token has expired. Run `--login` again to get a new one.

### "Connection failed" error
Check your internet connection and that the dashboard is accessible.

### Browser doesn't open
If the browser doesn't open automatically, copy the URL shown in the terminal and paste it in your browser.

## License

MIT
