# E2E Test Dashboard

A comprehensive dashboard for monitoring Playwright test executions from GitHub Actions with NeonDB and Cloudflare R2 integration.

## Features

- **Real-time Metrics**: Pass rates, average duration, critical failures, and execution counts
- **Trend Visualization**: 7-day trend charts showing test stability over time
- **Detailed Test Results**: View individual test failures with error messages and stack traces
- **Artifact Management**: Access test videos, traces, and screenshots stored in Cloudflare R2
- **Smart Filtering**: Filter by status, branch, and date range
- **Responsive Design**: Mobile-friendly interface with dark mode

## Getting Started

### 1. Database Setup

Run the SQL scripts to create the necessary tables:

```bash
# Execute these scripts in your Neon database console or use the v0 script runner
scripts/001_create_test_tables.sql
scripts/002_seed_sample_data.sql (optional - for testing)
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

- `GET /api/executions` - List test executions with filtering
- `GET /api/executions/[id]` - Get detailed execution results
- `GET /api/metrics` - Dashboard metrics and statistics
- `GET /api/trends` - Trend data for charts
- `GET /api/artifacts/[id]/signed-url` - Generate R2 signed URLs

## Development

The dashboard automatically refreshes data on page load. For real-time updates, the system polls the API every 30 seconds when viewing execution details.

## Production Deployment

1. Run database migrations in your Neon production database
2. Add R2 credentials to Vercel environment variables
3. Deploy to Vercel with the "Publish" button
4. Configure your GitHub Actions to send data to the production database
