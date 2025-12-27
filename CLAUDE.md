# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

E2E Test Dashboard for monitoring Playwright test executions from GitHub Actions. Displays real-time metrics, trend charts, and detailed test results with artifact management via Cloudflare R2.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Start production server
```

## Architecture

### Stack
- **Framework**: Next.js 16 with App Router and React Server Components
- **Database**: Neon PostgreSQL (serverless) via `@neondatabase/serverless`
- **Storage**: Cloudflare R2 for test artifacts (videos, traces, screenshots)
- **UI**: shadcn/ui (new-york style) with TailwindCSS v4
- **Charts**: Recharts
- **Auth**: Stack Auth (`@stackframe/stack`)

### Key Directories
- `app/` - Next.js App Router pages and API routes
- `app/api/` - API endpoints (executions, metrics, trends, artifacts)
- `components/dashboard/` - Dashboard-specific components
- `components/ui/` - shadcn/ui components
- `lib/` - Core utilities: `db.ts` (database queries), `r2.ts` (R2 integration), `types.ts`
- `scripts/` - SQL migration scripts for Neon

### Database Schema
Three tables: `test_executions` (workflow runs), `test_results` (individual tests), `test_artifacts` (R2 file references). See `scripts/001_create_test_tables.sql`.

### Data Flow
1. GitHub Actions runs Playwright tests and inserts results into Neon
2. Dashboard fetches via Server Components calling `lib/db.ts` functions
3. Artifacts are accessed via signed R2 URLs generated in `lib/r2.ts`

## Environment Variables

Required:
- `DATABASE_URL` - Neon PostgreSQL connection string

Optional (for artifact downloads):
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

## Code Patterns

### Database Access
Use the factory function pattern in `lib/db.ts` - call `getSql()` inside each function to avoid module-level instantiation issues in serverless environments:
```typescript
// Correct - factory pattern
function getSql() {
  return neon(process.env.DATABASE_URL!)
}

export async function getExecutions() {
  const sql = getSql()  // Create instance inside function
  return sql`SELECT * FROM test_executions`
}
```

### API Routes
Use `export const dynamic = "force-dynamic"` in API routes to ensure fresh data on each request.

### UI Components
Add new shadcn components via CLI: `npx shadcn@latest add <component-name>`

Follow the shadcn design system - manage colors via CSS variables for theming consistency.

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

### React Best Practices
Avoid infinite loops with proper cleanup:
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

Stabilize object references to prevent re-renders:
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

### Path Standards
- Use relative paths in documentation (`lib/db.ts` not absolute paths)
- Never include usernames or local directory structures in committed files

### DateTime Handling
When timestamps are needed, always get real system time:
```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```
Never use placeholder values.

## Testing

This project monitors Playwright test results but doesn't have its own test suite yet. When adding tests:
- Use Vitest for unit/integration tests
- Follow the test-runner agent pattern for execution
- Capture verbose output for debugging

## Security Considerations
- Never commit secrets or credentials
- Use environment variables for all sensitive configuration
- Validate external input at API boundaries
- Generate signed URLs for R2 artifact access (short expiration times)
