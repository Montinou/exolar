# GitHub Actions Secrets Configuration

## Required Secrets for E2E Test Dashboard Integration

Configure the following secrets in your GitHub repository settings to enable the Playwright reporter to send test results to the dashboard.

### Repository Settings > Secrets and variables > Actions

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DASHBOARD_URL` | Base URL of the E2E Test Dashboard | `https://e2e-dashboard.vercel.app` |
| `DASHBOARD_API_KEY` | API authentication key for data ingestion | `your-secret-api-key-here` |

## Usage in GitHub Actions Workflow

Add these environment variables to your Playwright test job:

```yaml
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    env:
      CI: true
      DASHBOARD_URL: ${{ secrets.DASHBOARD_URL }}
      DASHBOARD_API_KEY: ${{ secrets.DASHBOARD_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run Playwright tests
        run: npx playwright test
```

## Verifying Configuration

1. The Dashboard Reporter only activates when:
   - `CI=true` or `GITHUB_ACTIONS=true`
   - `DASHBOARD_URL` is set

2. In local development, the reporter is silently disabled.

3. Check the test output for:
   ```
   [DashboardReporter] Initialized - will send results to dashboard
   [DashboardReporter] Sending X results to dashboard...
   [DashboardReporter] Results sent successfully - execution_id: Y
   ```

## Environment Variables Used

The reporter automatically reads these GitHub Actions variables:

| Variable | Usage |
|----------|-------|
| `GITHUB_RUN_ID` | Unique identifier for the test run |
| `GITHUB_REF_NAME` | Branch name |
| `GITHUB_SHA` | Commit SHA |
| `GITHUB_ACTOR` | User who triggered the workflow |
| `GITHUB_WORKFLOW` | Workflow name |
| `GITHUB_EVENT_NAME` | Event that triggered the workflow |
