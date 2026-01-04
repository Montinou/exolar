# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Exolar QA** is a multi-tenant dashboard for monitoring Playwright test executions. It provides real-time test analytics, flakiness detection, failure analysis, and integrates with Claude Code via MCP (Model Context Protocol).

**Product Name:** Exolar QA (formerly E2E Test Dashboard)

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Start production server
```

Add new shadcn components via:
```bash
npx shadcn@latest add <component-name>
```

## Architecture

### Stack
- **Framework**: Next.js 16 with App Router and React Server Components
- **Database**: Neon PostgreSQL (serverless) via `@neondatabase/serverless`
- **Storage**: Cloudflare R2 for test artifacts (videos, traces, screenshots)
- **UI**: shadcn/ui (new-york style) with TailwindCSS v4
- **Charts**: Recharts
- **Auth**: Neon Auth (`@neondatabase/auth`)
- **MCP**: Built-in MCP server for Claude Code integration

### Key Directories
```
app/                         # Next.js App Router
├── api/                     # API endpoints
│   ├── executions/          # Execution CRUD
│   ├── metrics/             # Dashboard metrics
│   ├── trends/              # Time-series data
│   ├── flakiness/           # Flaky test detection
│   ├── artifacts/           # R2 signed URLs
│   ├── organizations/       # Org management
│   ├── admin/               # Admin endpoints
│   ├── mcp/                 # MCP server endpoint (SSE)
│   └── reliability-score/   # Test reliability calculations
├── admin/                   # Admin pages (users, invites, organizations)
├── dashboard/               # Dashboard pages (performance, reliability)
└── settings/                # Settings pages (MCP config)

components/
├── dashboard/               # Dashboard-specific components
│   ├── charts/              # Chart components (trends, heatmaps)
│   └── ...                  # Cards, tables, metrics
├── ui/                      # shadcn/ui components
└── shared/                  # Shared components

lib/                         # Core utilities
├── db.ts                    # Database queries with org filtering
├── db-orgs.ts               # Organization management
├── db-users.ts              # User management with org assignment
├── session-context.ts       # Session and auth context
├── api-keys.ts              # API key management
├── r2.ts                    # R2 integration for artifacts
├── types.ts                 # TypeScript types
├── colors.ts                # Theme color utilities
├── validation.ts            # Input validation
├── mcp/                     # MCP server implementation
│   ├── server.ts            # MCP server setup
│   ├── tools.ts             # MCP tool definitions
│   └── handlers.ts          # Tool handlers
└── auth/                    # Auth utilities

scripts/                     # SQL migration scripts for Neon
packages/                    # Monorepo packages
└── mcp-server/              # @exolar-qa/mcp-server package

docs/                        # Documentation
├── MULTITENANCY_COMPLETED.md
├── MCP_INTEGRATION.md
├── MODERN_DASHBOARD_FEATURES.md
└── dashboard-integration/   # Integration guides
```

### Database Schema

**Core Tables:**
- `test_executions` - Workflow runs (with `organization_id`)
- `test_results` - Individual tests (linked via `execution_id`)
- `test_artifacts` - R2 file references
- `test_flakiness_history` - Flaky test tracking (with `organization_id`)

**Multi-Tenancy Tables:**
- `organizations` - Org definitions (id, name, slug)
- `organization_members` - User-org membership (with role: owner/admin/viewer)
- `dashboard_users` - Users (with `default_org_id`)
- `invites` - Pending invites (with `org_id`)

See `scripts/009_add_organizations.sql` for full schema.

### Data Flow
1. GitHub Actions runs Playwright tests and inserts results into Neon
2. Dashboard fetches via Server Components calling `lib/db.ts` functions
3. Artifacts are accessed via signed R2 URLs generated in `lib/r2.ts`
4. Claude Code accesses data via MCP endpoint at `/api/mcp`

## Environment Variables

### Required
- `DATABASE_URL` - Neon PostgreSQL connection string
- `NEON_AUTH_JWKS_URL` - Neon Auth JWKS endpoint (for MCP auth)

### Optional (for artifact downloads)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

## Code Patterns

### Database Access
All queries use organization filtering via `getQueriesForOrg()`:

```typescript
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

// In API route or Server Component:
const context = await getSessionContext()
if (!context) return unauthorized()

const db = getQueriesForOrg(context.organizationId)
const executions = await db.getExecutions()  // Auto-filtered by org
```

For CI/CD ingestion (API key auth), use service account context:
```typescript
import { setServiceAccountContext, getQueriesForOrg } from "@/lib/db"

await setServiceAccountContext()  // Bypass RLS
const db = getQueriesForOrg(orgId)
await db.insertExecution(execution)
```

### API Routes
Use `export const dynamic = "force-dynamic"` in API routes to ensure fresh data on each request.

### Path Aliases
Use `@/` prefix for imports (configured in tsconfig.json).

### Server Components
The main page (`app/page.tsx`) uses React Server Components with `Suspense` for loading states. Data fetching happens server-side with `Promise.all` for parallel queries.

## Development Rules

### Code Quality
- ALWAYS prefer editing existing files over creating new ones
- Avoid over-engineering - only make changes directly requested or clearly necessary
- Don't add features, refactor code, or make "improvements" beyond what was asked
- Keep solutions simple and focused
- Don't add docstrings, comments, or type annotations to code you didn't change

### React Best Practices

**Avoid infinite loops with proper cleanup:**
```typescript
// ✅ GOOD - With cleanup
useEffect(() => {
  const subscription = someService.subscribe((event) => {
    // handle event
  });

  return () => subscription.unsubscribe(); // Cleanup crucial
}, []);

// ❌ BAD - No cleanup, can cause infinite re-renders
useEffect(() => {
  someService.subscribe((event) => {
    // handle event
  });
}, []);
```

**Stabilize object references to prevent re-renders:**
```typescript
// ❌ BAD - Objects as dependencies
const config = { limit: 10 }; // Recreated every render
useEffect(() => {
  fetchData(config);
}, [config]); // Loop!

// ✅ GOOD - useMemo for stable references
const config = useMemo(() => ({ limit: 10 }), []);
useEffect(() => {
  fetchData(config);
}, [config]);

// ✅ BETTER - Primitive values as dependencies
const limit = 10;
useEffect(() => {
  fetchData({ limit });
}, [limit]);
```

**Never use patterns like:**
```typescript
// ❌ BAD - Never do this
if (true === true) { ... }
```

### UI Components
- Follow the shadcn design system
- Manage colors via CSS variables for theming consistency
- Use `npx shadcn@latest add <component-name>` to add components
- Prefer existing components over creating new ones

### Git Workflow
- Only commit when explicitly requested
- Use conventional commit format: `<type>(<scope>): <description>`
- Never use `--force` flags or destructive commands without explicit request
- Include co-authorship in commits:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  ```

### Error Handling
- Keep error messages short and actionable: `❌ {What failed}: {Exact solution}`
- Fail fast - check critical prerequisites, then proceed
- Don't over-validate things that rarely fail
- Trust the system - don't try to prevent every possible edge case

### Path Standards
- Use relative paths in documentation (`lib/db.ts` not absolute paths)
- Never include usernames or local directory structures in committed files
- Use `@/` prefix for imports in code

### DateTime Handling
When timestamps are needed, always get real system time:
```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```
Never use placeholder values.

### Do Not
- Add hardcoded timeouts
- Run `yarn check:types` unless explicitly asked
- Run format commands unless explicitly asked
- Assume things without verifying - confirm instead

## Testing

This project monitors Playwright test results but doesn't have its own test suite yet. When adding tests:
- Use Vitest for unit/integration tests (NOT Jest)
- Use `vi.fn()`, `vi.mock()`, `vi.clearAllMocks()`
- Follow the test-runner agent pattern for execution
- Capture verbose output for debugging

## Security Considerations

- Never commit secrets or credentials
- Use environment variables for all sensitive configuration
- Validate external input at API boundaries
- Generate signed URLs for R2 artifact access (short expiration times)
- All data queries are org-filtered via `getQueriesForOrg()`
- RLS policies provide database-level protection
- Use `requireOrgAdmin()` or `requireSystemAdmin()` for admin operations
- JWT tokens are verified using Neon Auth's JWKS

## Multi-Tenancy

The dashboard supports multi-tenant data isolation:

- **Organization-based filtering**: All queries filter by `organization_id`
- **Session context**: `getSessionContext()` provides user + org info
- **RLS protection**: Database-level policies prevent cross-org access
- **Admin management**: `/admin/organizations` for org CRUD
- **First-login assignment**: New users are assigned to default org

**Security Layers:**
1. **Application Level**: `getQueriesForOrg(orgId)` adds WHERE clauses
2. **Database Level**: RLS policies verify organization membership

See `docs/MULTITENANCY_COMPLETED.md` for full implementation details.

## MCP Integration

The dashboard exposes a MCP server for Claude Code integration at `/api/mcp`.

### Available Tools
| Tool | Description |
|------|-------------|
| `get_executions` | List test executions with filters |
| `get_execution_details` | Get execution + results |
| `search_tests` | Search by name/file |
| `get_test_history` | Test run history |
| `get_failed_tests` | Failed tests with AI context |
| `get_dashboard_metrics` | Overall metrics |
| `get_trends` | Time-series data |
| `get_flaky_tests` | Flaky tests list |
| `list_branches` | Available branches |
| `list_suites` | Available test suites |

See `docs/MCP_INTEGRATION.md` for configuration and usage.

## Key Features

### Implemented
- **Reliability Score** (`/dashboard/reliability`) - Single 0-100 gauge showing test suite health
- **Performance Regression Detection** (`/dashboard/performance`) - Automatic alerts when tests slow down
- Pass/Fail/Flaky rate metrics with trends
- Stats cards (pass rate, failure rate, avg duration, critical failures)
- Status donut chart, trend area chart, failure rate chart
- Error distribution bar chart
- Flakiest tests card (top 5)
- Slowest tests card
- Suite pass rates
- Branch accordion view
- Test search with history modal
- Test result cards with artifacts (video, trace, screenshots)
- AI context for failures
- Multi-tenancy with organization filtering
- API key management

### Roadmap
See `docs/MODERN_DASHBOARD_FEATURES.md` for planned features including:
- AI Root Cause Analysis
- Intelligent Failure Clustering
- Slack/Teams Notifications
- Comparative Run Analysis
- Auto-Quarantine Flaky Tests
