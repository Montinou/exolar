# Exolar QA MCP Server

An MCP (Model Context Protocol) server that provides Claude Code with direct access to your E2E test execution data from the Exolar QA Dashboard.

## Quick Start

### Step 1: Authenticate

Run this command to open your browser and log in to the dashboard:

```bash
npx @exolar-qa/mcp-server --login
```

This will:
1. Open your browser to the dashboard login page
2. After you log in, redirect back to complete authentication
3. Store your credentials securely in `~/.e2e-dashboard-mcp/config.json`

### Step 2: Add to Claude Code

```bash
claude mcp add --transport stdio exolar -- npx -y @exolar-qa/mcp-server
```

That's it! Claude Code now has access to your test data.

## Available Commands

```bash
# Authenticate with the dashboard (opens browser)
npx @exolar-qa/mcp-server --login

# Check authentication status
npx @exolar-qa/mcp-server --status

# Clear stored credentials
npx @exolar-qa/mcp-server --logout

# Show help
npx @exolar-qa/mcp-server --help

# Use a custom dashboard URL
npx @exolar-qa/mcp-server --login --url https://your-dashboard.com
```

## Available Tools (15)

Once connected, Claude Code can use these tools:

### Core Data Retrieval
- **`get_executions`** - List test executions with filters (status, branch, suite, date range)
- **`get_execution_details`** - Get execution details including all test results and artifacts
  - New: `status` filter (passed/failed/skipped/all)
  - New: `include_artifacts` option (default: false to reduce response size)
- **`search_tests`** - Search tests by name/file with aggregated statistics
- **`get_test_history`** - Get execution history for a specific test over time

### Aggregation Tools (New)
- **`get_execution_summary`** - Lightweight summary without full test list (~1KB vs 110KB)
  - Returns: pass/fail counts, error distribution, files affected
  - Use this first before get_execution_details for large executions
- **`get_execution_failures`** - Get only failed tests with smart grouping
  - `group_by`: file, error_type, or none
  - `include_stack_traces`: optional (increases response size)
- **`generate_failure_report`** - Pre-formatted markdown report for an execution
  - Ready for documentation or issue creation
  - Includes error analysis and recommendations

### Analysis Tools
- **`get_failed_tests`** - Get failed tests across executions
  - New: `execution_id` filter for specific execution
  - New: `test_file` filter for specific file
  - No longer requires AI context to return results
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

### Quick Analysis (Recommended)
- "Get a summary of the latest execution" → uses `get_execution_summary`
- "Show me the failures from execution #115" → uses `get_execution_failures`
- "Generate a failure report for the last CI run" → uses `generate_failure_report`

### General Queries
- "Show me recent test failures"
- "What are our flakiest tests?"
- "Search for tests related to login"
- "Get the dashboard metrics for the last 7 days"
- "Show me the error distribution from this week"
- "What's the test history for the checkout test?"

### Efficient Workflows
1. **Analyze failures**: Start with `get_execution_summary` for overview, then `get_execution_failures` for details
2. **Create reports**: Use `generate_failure_report` to get pre-formatted markdown
3. **Filter large results**: Use `status=failed` with `get_execution_details` instead of getting all tests

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
Run `npx @exolar-qa/mcp-server --login` to authenticate.

### "Token expired" error
Your token has expired. Run `--login` again to get a new one.

### "Connection failed" error
Check your internet connection and that the dashboard is accessible.

### Browser doesn't open
If the browser doesn't open automatically, copy the URL shown in the terminal and paste it in your browser.

## License

MIT
