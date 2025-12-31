# E2E Test Dashboard

A comprehensive multi-tenant dashboard for monitoring Playwright test executions from GitHub Actions with NeonDB, Row-Level Security, and Cloudflare R2 integration.

## Features

- **Multi-Tenancy**: Organization-level data isolation with RLS
- **Real-time Metrics**: Pass rates, average duration, critical failures, and execution counts
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

## Development

The dashboard automatically refreshes data on page load. For real-time updates, the system polls the API every 30 seconds when viewing execution details.

## Production Deployment

1. Run database migrations in your Neon production database
2. Add R2 credentials to Vercel environment variables
3. Deploy to Vercel with the "Publish" button
4. Configure your GitHub Actions to send data to the production database
