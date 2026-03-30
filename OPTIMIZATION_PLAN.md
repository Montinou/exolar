# Exolar QA Dashboard - Optimization Plan

**Date:** 2026-03-29
**Scope:** Security hardening, database optimization, architecture improvements, TypeScript strictness, testing strategy, MCP server improvements.

---

## 1. Current State Analysis

### 1.1 Architecture Overview

- **Framework:** Next.js 16 monorepo with `packages/mcp-server` and `packages/playwright-reporter`
- **Database:** Neon Serverless Postgres via `@neondatabase/serverless` (stateless HTTP driver, no persistent connections)
- **Auth:** Neon Auth (`@neondatabase/auth`) with session middleware + org-scoped API keys (`exolar_` prefix, SHA-256 hashed)
- **Storage:** Cloudflare R2 via AWS SDK for test artifacts (screenshots, traces, videos)
- **MCP Server:** stdio-based proxy that authenticates via JWT and forwards JSON-RPC to `/api/mcp`
- **Validation:** Zod schemas for ingestion endpoint; most other endpoints have no input validation
- **Build:** `ignoreBuildErrors: true` in `next.config.mjs` -- the codebase has unresolved TypeScript errors

### 1.2 Database Layer

The `lib/db/` module contains 25 files with ~4,000 lines of query code. Every function calls `getSql()` which returns a new `neon()` HTTP connection per call -- no pooling, no connection reuse, no shared transaction context.

**Pattern used everywhere:** Build SQL condition strings via string concatenation, then inject them via `sql.unsafe()` or `sql.unsafe(query)`. User-controlled values (branch, suite, dates, search queries) are escaped with `.replace(/'/g, "''")` -- a fragile, insufficient defense against SQL injection.

**`SELECT *` usage:** `results.ts:getTestResultsByExecutionId`, `mocks.ts` (multiple functions), `suites.ts:getSuiteRegistry`, `suites.ts:getSuiteById`, `suites.ts:getSuitesWithStats`, `search.ts:getTestHistory`, `flakiness.ts:getTestFlakiness`, `executions.ts:getExecutions`, `executions.ts:getExecutionById`, `comparison.ts:getLatestExecutionByBranch`.

### 1.3 SQL Injection Inventory (`.unsafe()` Instances)

Every instance below passes user-controlled or partially-user-controlled strings into raw SQL:

| # | File | Line | Context | Risk |
|---|------|------|---------|------|
| 1 | `lib/db/metrics.ts` | 53 | `getLatestExecutionId` -- branch/suite via string concat | HIGH |
| 2 | `lib/db/metrics.ts` | 142 | `getDashboardMetrics` -- WHERE clause with branch/suite/dates | HIGH |
| 3 | `lib/db/metrics.ts` | 172 | `getDashboardMetrics` -- critical failures WHERE | HIGH |
| 4 | `lib/db/metrics.ts` | 193 | `getDashboardMetrics` -- latest exec WHERE | HIGH |
| 5 | `lib/db/metrics.ts` | 303 | `getTrendData` -- full query via `sql.unsafe(query)` | CRITICAL |
| 6 | `lib/db/metrics.ts` | 362 | `getFailureTrendData` -- WHERE with branch/suite/dates | HIGH |
| 7 | `lib/db/metrics.ts` | 544 | `getSlowestTests` -- WHERE with branch/suite/dates | HIGH |
| 8 | `lib/db/metrics.ts` | 603-604 | `getSuitePassRates` -- dateFilter + branchFilter | HIGH |
| 9 | `lib/db/metrics.ts` | 616-617 | `getSuitePassRates` -- teDateFilter + teBranchFilter | HIGH |
| 10 | `lib/db/metrics.ts` | 739-740 | `getReliabilityScore` -- dateFilter + extraFilters | HIGH |
| 11 | `lib/db/metrics.ts` | 752-753 | `getReliabilityScore` -- dateFilter + extraFilters (CTE 2) | HIGH |
| 12 | `lib/db/metrics.ts` | 767 | `getReliabilityScore` -- extraFilters (CTE 3) | HIGH |
| 13 | `lib/db/metrics.ts` | 780 | `getReliabilityScore` -- extraFilters (CTE 4) | HIGH |
| 14 | `lib/db/executions.ts` | 50 | `getExecutions` -- WHERE with status/branch/suite/dates | HIGH |
| 15 | `lib/db/executions.ts` | 110 | `searchExecutions` -- WHERE with search pattern | HIGH |
| 16 | `lib/db/executions.ts` | 157 | `getExecutionsGroupedByBranch` -- WHERE with dates | HIGH |
| 17 | `lib/db/flakiness.ts` | 141-142 | `getFlakiestTests` -- filtered query WHERE | HIGH |
| 18 | `lib/db/flakiness.ts` | 165 | `getFlakiestTests` -- unfiltered query WHERE | HIGH |
| 19 | `lib/db/flakiness.ts` | 218 | `getFlakinessSummary` -- WHERE with branch/suite | HIGH |
| 20 | `lib/db/results.ts` | 83 | `getFailedTestsByExecutionId` -- WHERE clause | MEDIUM |
| 21 | `lib/db/results.ts` | 96 | `getFailedTestsByExecutionId` -- WHERE clause (branch 2) | MEDIUM |
| 22 | `lib/db/search.ts` | 176 | `getFailuresWithAIContext` -- full query via `sql.unsafe()` | CRITICAL |
| 23 | `lib/db/search.ts` | 329 | `getErrorTypeDistribution` -- full query via `sql.unsafe()` | CRITICAL |
| 24 | `lib/db/classification.ts` | 312 | `getFailureClassification` -- full query via `sql.unsafe()` | CRITICAL |
| 25 | `lib/db/performance.ts` | 123 | `getPerformanceRegressions` -- hours interval | HIGH |
| 26 | `lib/db/performance.ts` | 125 | `getPerformanceRegressions` -- branch/suite filters | HIGH |
| 27 | `lib/db/performance.ts` | 157 | `getPerformanceRegressions` -- extraFilters in subquery | HIGH |
| 28 | `lib/db/performance.ts` | 179 | `getPerformanceRegressions` -- ORDER BY clause | MEDIUM |
| 29 | `lib/db/comparison.ts` | 31 | `getLatestExecutionByBranch` -- suite filter | HIGH |
| 30 | `lib/db/suites.ts` | 62 | `getSuiteRegistry` -- WHERE with techStack/isActive | HIGH |
| 31 | `lib/db/suites.ts` | 179 | `updateSuite` -- SET clause with description/url | CRITICAL |
| 32 | `lib/db/suites.ts` | 245 | `getSuiteTests` -- WHERE with suiteName/testFile | HIGH |
| 33 | `lib/db/suites.ts` | 434 | `getInactiveTests` -- WHERE clause | MEDIUM |
| 34 | `lib/db/mocks.ts` | 701 | `getMockRequestLogsFiltered` -- COUNT with WHERE | HIGH |
| 35 | `lib/db/mocks.ts` | 709 | `getMockRequestLogsFiltered` -- SELECT with WHERE | HIGH |
| 36 | `lib/db/semantic-search.ts` | 139-143 | `searchFailuresSemantic` -- vector + WHERE | HIGH |
| 37 | `lib/db/semantic-search.ts` | 231-235 | `searchAllTestsSemantic` -- vector + WHERE | HIGH |
| 38 | `lib/db/semantic-search.ts` | 325-334 | `searchTestsKeyword` -- ILIKE + WHERE | HIGH |
| 39 | `lib/mcp/handlers/action.ts` | 652 | MCP reembed action -- WHERE clause | HIGH |
| 40 | `lib/mcp/handlers/action.ts` | 738 | MCP action -- WHERE clause | HIGH |
| 41 | `lib/mcp/handlers/action.ts` | 836 | MCP action -- stats WHERE | HIGH |
| 42 | `lib/mcp/handlers/action.ts` | 897 | MCP action -- full WHERE + LIMIT | HIGH |

### 1.4 Auth Flow

1. **Web UI:** Neon Auth middleware (`@neondatabase/auth/next`) handles sign-in. `getSessionContext()` reads session, joins `dashboard_users` + `organizations` + `organization_members` to get org scope.
2. **API ingestion:** `Bearer exolar_...` API keys validated via SHA-256 hash lookup in `org_api_keys` table. Legacy `DASHBOARD_API_KEY` env var also supported.
3. **MCP tokens:** JWT signed with `MCP_TOKEN_SECRET || DATABASE_URL || "mcp-token-secret-INSECURE-FALLBACK"`. The fallback is hardcoded and insecure.
4. **OAuth PKCE:** Implemented in `/api/mcp/oauth/authorize` and `/api/mcp/oauth/token`. Uses S256 challenge method. Redirect URI validation allows any HTTPS or localhost URL -- no allowlist.

### 1.5 MCP Server (`packages/mcp-server`)

- stdio proxy: receives MCP requests, forwards via HTTP to dashboard `/api/mcp`
- No request timeouts on HTTP calls
- No retry logic for transient failures
- No pagination support for large result sets
- Config stored in `~/.e2e-dashboard-mcp/config.json` with 0600 permissions (good)

---

## 2. Security Fixes Plan

### 2.1 Replace All `.unsafe()` with Parameterized Queries

**Strategy:** Introduce a query builder that uses Neon's tagged template parameters exclusively. The key insight: Neon's `sql` tagged template already parameterizes values. The problem is the codebase builds dynamic WHERE clauses as strings and injects them. The fix is to use conditional tagged templates.

**Pattern: Before (vulnerable)**
```typescript
// lib/db/executions.ts - getExecutions
const conditions = [`organization_id = ${organizationId}`]
if (status) conditions.push(`status = '${status}'`)
if (branch) conditions.push(`branch = '${branch}'`)
const whereClause = `WHERE ${conditions.join(" AND ")}`
const result = await sql`
  SELECT * FROM test_executions
  ${sql.unsafe(whereClause)}
  ORDER BY started_at DESC
  LIMIT ${limit} OFFSET ${offset}
`
```

**Pattern: After (safe)**
```typescript
// lib/db/executions.ts - getExecutions (parameterized)
const result = await sql`
  SELECT id, run_id, branch, commit_sha, commit_message, triggered_by,
         workflow_name, suite, suite_id, status, total_tests, passed,
         failed, skipped, duration_ms, started_at, completed_at
  FROM test_executions
  WHERE organization_id = ${organizationId}
    AND (${status}::text IS NULL OR status = ${status})
    AND (${branch}::text IS NULL OR branch = ${branch})
    AND (${suite}::text IS NULL OR suite = ${suite})
    AND (${runId}::text IS NULL OR run_id = ${runId})
    AND (${dateRange?.from ?? null}::timestamptz IS NULL OR started_at >= ${dateRange?.from ?? null}::timestamptz)
    AND (${dateRange?.to ?? null}::timestamptz IS NULL OR started_at <= ${dateRange?.to ?? null}::timestamptz)
  ORDER BY started_at DESC
  LIMIT ${limit} OFFSET ${offset}
`
```

This pattern uses `(${param}::type IS NULL OR column = ${param})` to make filters optional without string concatenation. Every value goes through parameterized binding.

**For ORDER BY and dynamic column references** (which cannot be parameterized), use a validated allowlist:

```typescript
// For ORDER BY - validate against allowlist
const ALLOWED_SORT_COLUMNS = {
  regression: "regression_ratio DESC",
  duration: "current_avg_ms DESC",
  name: "test_name ASC",
} as const

type SortKey = keyof typeof ALLOWED_SORT_COLUMNS
const orderBy = ALLOWED_SORT_COLUMNS[sortBy as SortKey] ?? ALLOWED_SORT_COLUMNS.regression

// Use sql.unsafe only for validated constant strings
const result = await sql`... ORDER BY ${sql.unsafe(orderBy)}`
```

**For vector operations** (embedding columns and vector literals), validate dimensions and column names against allowlists:

```typescript
// Validate embedding column name (hardcoded options only)
const embeddingColumn = isV2 ? "error_embedding_v2" : "error_embedding"
// This is safe because the value is derived from a boolean, not user input

// For vector literals, validate the array contains only numbers
function toSafeVectorLiteral(embedding: number[]): string {
  if (!embedding.every(v => typeof v === "number" && isFinite(v))) {
    throw new Error("Invalid embedding values")
  }
  return `'[${embedding.join(",")}]'::vector`
}
```

**For `getTrendData` (full raw query):** Refactor into tagged template:
```typescript
// Before: const result = await sql.unsafe(query)
// After:
const truncExprs = {
  hour: sql`DATE_TRUNC('hour', started_at)`,
  day: sql`DATE_TRUNC('day', started_at)`,
  week: sql`DATE_TRUNC('week', started_at)`,
  month: sql`DATE_TRUNC('month', started_at)`,
} as const
// Note: Neon serverless sql tagged templates don't support fragment composition
// like node-postgres does. Use conditional branching with 4 separate queries:

if (period === 'hour') {
  result = await sql`SELECT DATE_TRUNC('hour', started_at) as period, ... WHERE org = ${orgId} AND ...`
} else if (period === 'day') {
  result = await sql`SELECT DATE_TRUNC('day', started_at) as period, ... WHERE org = ${orgId} AND ...`
}
// etc.
```

**For `updateSuite` (dynamic SET clause):** Use COALESCE pattern:
```typescript
// Before: sql.unsafe(setClause) with string-concatenated values
// After:
await sql`
  UPDATE org_suites
  SET
    description = COALESCE(${updates.description ?? null}, description),
    repository_url = COALESCE(${updates.repository_url ?? null}, repository_url),
    tech_stack = COALESCE(${updates.tech_stack ?? null}, tech_stack),
    is_active = COALESCE(${updates.is_active ?? null}, is_active),
    updated_at = NOW()
  WHERE id = ${suiteId}
    AND organization_id = ${organizationId}
`
```

**For `getFailureClassification` (full raw query):** Convert to tagged template with conditional branches for testId vs executionId+testName lookup.

**For `getMockRequestLogsFiltered` (dynamic WHERE with pagination):** Use the `IS NULL OR` pattern:
```typescript
const result = await sql`
  SELECT * FROM mock_request_logs
  WHERE interface_id = ${interfaceId}
    AND (${path ?? null}::text IS NULL OR path ILIKE ${'%' + (path ?? '') + '%'})
    AND (${method ?? null}::text IS NULL OR method = ${method ?? null})
    AND (${statusMin ?? null}::int IS NULL OR response_status >= ${statusMin ?? null})
    AND (${statusMax ?? null}::int IS NULL OR response_status <= ${statusMax ?? null})
    AND (${matched ?? null}::boolean IS NULL OR matched = ${matched ?? null})
    AND (${from?.toISOString() ?? null}::timestamptz IS NULL OR request_at >= ${from?.toISOString() ?? null}::timestamptz)
    AND (${to?.toISOString() ?? null}::timestamptz IS NULL OR request_at <= ${to?.toISOString() ?? null}::timestamptz)
  ORDER BY request_at DESC
  LIMIT ${limit} OFFSET ${offset}
`
```

### 2.2 Fix MCP Token Secret

**Problem:** Three files use the same fallback chain:
```typescript
const MCP_TOKEN_SECRET = process.env.MCP_TOKEN_SECRET || process.env.DATABASE_URL
const EFFECTIVE_SECRET = MCP_TOKEN_SECRET || "mcp-token-secret-INSECURE-FALLBACK"
```

If `MCP_TOKEN_SECRET` is unset and `DATABASE_URL` is unset (shouldn't happen in production, but can in dev), the fallback is a hardcoded string anyone can use to forge tokens.

**Fix:**
```typescript
// lib/mcp/auth-config.ts (new shared module)
function getMcpSecret(): Uint8Array {
  const secret = process.env.MCP_TOKEN_SECRET
  if (!secret) {
    throw new Error(
      "MCP_TOKEN_SECRET environment variable is required. " +
      "Generate one with: openssl rand -base64 32"
    )
  }
  if (secret.length < 32) {
    throw new Error("MCP_TOKEN_SECRET must be at least 32 characters")
  }
  return new TextEncoder().encode(secret)
}

export const MCP_JWT_SECRET = getMcpSecret()
```

Files to update:
- `app/api/mcp/oauth/token/route.ts`
- `app/api/mcp/oauth/authorize/route.ts`
- `app/api/auth/mcp-token/route.ts`

### 2.3 OAuth PKCE & Redirect URI Validation

**Current state:** The authorize endpoint validates redirect URI format (HTTPS or localhost) but has no allowlist. Any HTTPS URL is accepted.

**Fix:** Add a registered client model:

```typescript
// lib/mcp/oauth-clients.ts
const REGISTERED_CLIENTS: Record<string, { redirectUris: string[] }> = {
  // Dynamic registration creates entries here (stored in DB)
}

// For the /api/mcp/oauth/register endpoint, store client registrations in DB:
// CREATE TABLE mcp_oauth_clients (
//   id SERIAL PRIMARY KEY,
//   client_id TEXT UNIQUE NOT NULL,
//   client_name TEXT,
//   redirect_uris TEXT[] NOT NULL,
//   organization_id INTEGER REFERENCES organizations(id),
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );

async function validateRedirectUri(clientId: string, redirectUri: string): Promise<boolean> {
  const sql = getSql()
  const result = await sql`
    SELECT redirect_uris FROM mcp_oauth_clients
    WHERE client_id = ${clientId}
  `
  if (result.length === 0) return false
  const allowedUris = result[0].redirect_uris as string[]
  return allowedUris.includes(redirectUri)
}
```

**PKCE enforcement:** Already implemented with S256. Verify `code_challenge_method` is always `S256` (already done) and that `plain` is explicitly rejected (already done).

### 2.4 R2 Path Traversal Fix

**Current state:** `generateArtifactKey` in `lib/r2.ts` sanitizes `testSignature` but the `filename` parameter is passed directly:
```typescript
return `artifacts/${executionId}/${sanitizedSignature}/${type}/${filename}`
```

An attacker could submit `filename: "../../etc/sensitive"` to escape the intended path.

**Fix:**
```typescript
export function generateArtifactKey(
  executionId: number,
  testSignature: string,
  type: string,
  filename: string
): string {
  const sanitizedSignature = testSignature
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .substring(0, 100)

  // Sanitize filename: strip path separators, dots that could traverse, and non-alphanumeric
  const sanitizedFilename = filename
    .replace(/[/\\]/g, "") // Remove path separators
    .replace(/\.{2,}/g, ".") // Collapse consecutive dots
    .replace(/^\.+/, "") // Remove leading dots
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Only allow safe chars
    .substring(0, 200)

  if (!sanitizedFilename) {
    throw new Error("Invalid filename after sanitization")
  }

  // Validate type is from allowed set
  const allowedTypes = ["screenshot", "trace", "video"]
  if (!allowedTypes.includes(type)) {
    throw new Error(`Invalid artifact type: ${type}`)
  }

  return `artifacts/${executionId}/${sanitizedSignature}/${type}/${sanitizedFilename}`
}
```

---

## 3. Database Optimization

### 3.1 Connection Pooling

**Problem:** `getSql()` creates a new `neon()` instance per call. With Neon's HTTP driver (`@neondatabase/serverless`), each call is a separate HTTP request with a new TCP+TLS handshake. This adds ~50-100ms latency per query.

**Fix:** Use Neon's built-in connection caching and the `Pool` class:

```typescript
// lib/db/connection.ts
import { Pool, neon, neonConfig } from "@neondatabase/serverless"

// For simple queries (current pattern, but cached):
neonConfig.fetchConnectionCache = true

let sqlInstance: ReturnType<typeof neon> | null = null

export function getSql() {
  if (!sqlInstance) {
    sqlInstance = neon(process.env.DATABASE_URL!)
  }
  return sqlInstance
}

// For transactional operations (ingestion, multi-step writes):
let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      max: 10, // max connections in pool
      idleTimeoutMillis: 30000,
    })
  }
  return pool
}
```

**Update ingestion to use transactions:**
```typescript
// lib/db/ingestion.ts
import { getPool } from "./connection"

export async function insertTestResults(
  organizationId: number,
  executionId: number,
  results: TestResultRequest[],
  suiteId?: number | null
): Promise<Map<string, number>> {
  const pool = getPool()
  const client = await pool.connect()
  const signatureToIdMap = new Map<string, number>()

  try {
    await client.query("BEGIN")

    // Batch insert using UNNEST for performance
    // Instead of N individual INSERTs, do 1 batch INSERT
    const values = results.map(r => {
      const signature = generateTestSignature(r.test_file, r.test_name)
      return [executionId, r.test_name, r.test_file, signature, r.status, r.duration_ms, ...]
    })

    // ... batch insert logic ...

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  return signatureToIdMap
}
```

### 3.2 Replace `SELECT *` with Specific Columns

Every `SELECT *` is a problem:
1. Fetches unnecessary data (embedding vectors are 512-768 floats = 2-6 KB per row)
2. Breaks when schema changes
3. Prevents covering index optimization

**Priority replacements:**

| Function | Current | Replace With |
|----------|---------|-------------|
| `getExecutions` | `SELECT *` | `SELECT id, run_id, branch, commit_sha, commit_message, suite, status, total_tests, passed, failed, skipped, duration_ms, started_at, completed_at` |
| `getExecutionById` | `SELECT *` | Same as above |
| `getTestHistory` | `SELECT tr.*` | `SELECT tr.id, tr.test_name, tr.test_file, tr.test_signature, tr.status, tr.duration_ms, tr.error_message, tr.retry_count, tr.started_at` |
| `getTestFlakiness` | `SELECT *` | `SELECT test_signature, test_name, test_file, total_runs, flaky_runs, passed_runs, failed_runs, flakiness_rate, avg_duration_ms, last_flaky_at, updated_at` |
| `getMockInterfaces` | `SELECT mi.*` | Explicit columns |
| `getMockRoutes` | `SELECT mr.*` | Explicit columns |
| `getActiveRoutesForInterface` | `SELECT *` | `SELECT id, path_pattern, method, priority` (only what's needed for matching) |
| `getMockRequestLogs` | `SELECT *` | Explicit columns (exclude large `body` and `response_body` unless needed) |

### 3.3 Missing Composite Indexes

Based on query patterns, add these indexes:

```sql
-- Execution queries always filter by org + started_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_executions_org_started
  ON test_executions (organization_id, started_at DESC)
  WHERE completed_at IS NOT NULL;

-- Test results join pattern: execution_id + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_results_exec_status
  ON test_results (execution_id, status)
  WHERE retry_count = 0;

-- Flakiness queries: org + flaky_runs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flakiness_org_flaky
  ON test_flakiness_history (organization_id, flakiness_rate DESC)
  WHERE flaky_runs > 0;

-- Performance baselines lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_baselines_org_sig
  ON test_performance_baselines (organization_id, test_signature);

-- Mock request logs: interface + request_at for pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mock_logs_interface_at
  ON mock_request_logs (interface_id, request_at DESC);

-- Suite tests: org + suite_id + active status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suite_tests_org_suite
  ON suite_tests (organization_id, suite_id)
  WHERE is_active = true;

-- Test results signature lookup (used in history, stats, flakiness)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_results_signature
  ON test_results (test_signature, started_at DESC);
```

### 3.4 Upsert Patterns for Idempotent Ingestion

**Problem:** `insertExecution` does a plain INSERT. If the same `run_id` is sent twice (retry, webhook duplicate), it creates duplicate rows.

**Fix:**
```sql
-- Add unique constraint
ALTER TABLE test_executions
  ADD CONSTRAINT uq_test_executions_org_run_id
  UNIQUE (organization_id, run_id);
```

```typescript
export async function insertExecution(
  organizationId: number,
  data: ExecutionRequest
): Promise<{ executionId: number; suiteId: number | null; isNew: boolean }> {
  const sql = getSql()

  // ... suite upsert ...

  const result = await sql`
    INSERT INTO test_executions (
      organization_id, run_id, branch, commit_sha, ...
    ) VALUES (
      ${organizationId}, ${data.run_id}, ${data.branch}, ...
    )
    ON CONFLICT (organization_id, run_id) DO UPDATE SET
      status = EXCLUDED.status,
      total_tests = EXCLUDED.total_tests,
      passed = EXCLUDED.passed,
      failed = EXCLUDED.failed,
      skipped = EXCLUDED.skipped,
      duration_ms = EXCLUDED.duration_ms,
      completed_at = EXCLUDED.completed_at
    RETURNING id, (xmax = 0) as is_new
  `

  return {
    executionId: result[0].id,
    suiteId,
    isNew: result[0].is_new,
  }
}
```

### 3.5 Query Builder Abstraction

Create a lightweight query builder to eliminate the repeated `conditions.push()` + `sql.unsafe()` pattern:

```typescript
// lib/db/query-builder.ts
import type { NeonQueryFunction } from "@neondatabase/serverless"

/**
 * Build a WHERE clause using only parameterized values.
 * Returns a function that, when called with sql, produces a safe query.
 */
export interface QueryFilter {
  column: string
  value: unknown
  op?: "=" | "!=" | ">=" | "<=" | ">" | "<" | "ILIKE" | "IN"
  table?: string // e.g., "te" for aliased tables
}

/**
 * Given an org-scoped set of optional filters, produce the parameterized
 * tagged template for the Neon driver.
 *
 * Usage:
 *   const result = await sql`
 *     SELECT ... FROM test_executions
 *     WHERE organization_id = ${orgId}
 *       AND (${status}::text IS NULL OR status = ${status})
 *       AND (${branch}::text IS NULL OR branch = ${branch})
 *     ...
 *   `
 *
 * This is the recommended pattern. The query builder below helps
 * for more complex dynamic queries where many optional filters exist.
 */
export function optionalEq(value: unknown): string {
  // Helper for documentation - actual implementation uses tagged templates
  return value === undefined || value === null
    ? "TRUE"
    : "column = $N"
}
```

The primary pattern is the `IS NULL OR` technique shown in section 2.1. For queries with 10+ optional filters, consider a helper that generates the parameterized template at build time (not at runtime with string concat).

---

## 4. Architecture Improvements

### 4.1 Service Layer Design

**Current:** API routes call `getQueriesForOrg(orgId).someQuery()` directly. Business logic (validation, authorization checks, response formatting) is mixed into route handlers.

**Proposed structure:**
```
lib/
  services/
    execution-service.ts   # Business logic for executions
    metrics-service.ts     # Business logic for dashboard metrics
    ingestion-service.ts   # Business logic for data ingestion
    search-service.ts      # Business logic for search
    mock-service.ts        # Business logic for mock API
  db/
    executions.ts          # Pure data access (queries only)
    metrics.ts             # Pure data access
    ...
```

```typescript
// lib/services/execution-service.ts
import { getQueriesForOrg } from "@/lib/db"
import type { SessionContext } from "@/lib/session-context"

export class ExecutionService {
  private db: ReturnType<typeof getQueriesForOrg>

  constructor(private context: SessionContext) {
    this.db = getQueriesForOrg(context.organizationId)
  }

  async list(params: {
    limit?: number
    offset?: number
    status?: string
    branch?: string
    suite?: string
    dateRange?: { from?: string; to?: string }
  }) {
    // Validate params
    const limit = Math.min(Math.max(1, params.limit ?? 50), 100)
    const offset = Math.max(0, params.offset ?? 0)

    return this.db.getExecutions(limit, offset, params.status, params.branch, params.dateRange, params.suite)
  }

  async getById(id: number) {
    const execution = await this.db.getExecutionById(id)
    if (!execution) {
      throw new NotFoundError(`Execution ${id} not found`)
    }
    return execution
  }
}
```

### 4.2 Middleware Stack

**Current:** No middleware pipeline. Each route manually calls `getSessionContext()` and handles auth/errors independently.

**Proposed:** A composable middleware chain:

```typescript
// lib/middleware/chain.ts
import { NextResponse, type NextRequest } from "next/server"
import { getSessionContext, type SessionContext } from "@/lib/session-context"
import { validateOrgApiKey } from "@/lib/api-keys"

type HandlerContext = {
  session?: SessionContext
  organizationId: number
  params: Record<string, string>
}

type RouteHandler = (request: NextRequest, context: HandlerContext) => Promise<NextResponse>

export function withAuth(handler: RouteHandler): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const session = await getSessionContext()
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    return handler(request, {
      session,
      organizationId: session.organizationId,
      params: {},
    })
  }
}

export function withApiKey(handler: RouteHandler): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const authHeader = request.headers.get("authorization")
    const apiKey = await validateOrgApiKey(authHeader)
    if (!apiKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }
    return handler(request, {
      organizationId: apiKey.organizationId,
      params: {},
    })
  }
}

export function withRateLimit(rpm: number) {
  return (handler: RouteHandler): RouteHandler => {
    return async (request, context) => {
      // Check rate limit using Upstash (already in dependencies)
      // ...
      return handler(request, context)
    }
  }
}

// Usage in a route:
// export const GET = withAuth(async (request, { organizationId }) => {
//   const db = getQueriesForOrg(organizationId)
//   const data = await db.getExecutions()
//   return NextResponse.json(data)
// })
```

### 4.3 Error Handling Standardization

**Current:** Inconsistent error handling. Some routes return `{ error: "..." }`, others return `{ success: false, error: "..." }`, some throw and let Next.js handle it.

**Proposed:**
```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND")
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(message, 400, "VALIDATION_ERROR")
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED")
  }
}

// Standard error response format:
// { error: { code: "NOT_FOUND", message: "Execution 123 not found" } }
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    )
  }
  console.error("[API Error]", error)
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    { status: 500 }
  )
}
```

### 4.4 Structured Logging

**Current:** `console.log` and `console.error` scattered throughout, no structured format, no request correlation.

**Proposed:** Lightweight structured logger:

```typescript
// lib/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  timestamp: string
  requestId?: string
}

export function createLogger(module: string) {
  return {
    info: (message: string, context?: Record<string, unknown>) =>
      log("info", module, message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      log("warn", module, message, context),
    error: (message: string, context?: Record<string, unknown>) =>
      log("error", module, message, context),
    debug: (message: string, context?: Record<string, unknown>) =>
      log("debug", module, message, context),
  }
}

function log(level: LogLevel, module: string, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message: `[${module}] ${message}`,
    context,
    timestamp: new Date().toISOString(),
  }

  if (level === "error") {
    console.error(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}
```

---

## 5. TypeScript & Build

### 5.1 Remove `ignoreBuildErrors`

**Current:** `next.config.mjs` has `typescript: { ignoreBuildErrors: true }`. This hides all TS errors at build time.

**Strategy:**
1. Run `npx tsc --noEmit` to get full error list
2. Fix errors in priority order:
   - Type assertion errors (most common: `as unknown as SomeType` casts)
   - Missing null checks
   - Incorrect function signatures
3. Once clean, remove `ignoreBuildErrors: true`

**Expected error categories:**
- Neon query results typed as `any[]` -- add proper return type annotations
- `as unknown as Type` casts throughout `lib/db/` -- replace with proper type narrowing
- Missing optional chaining in result access
- MCP handler type mismatches

### 5.2 Add Strict Null Checks

Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

This will surface ~100+ issues where `result[0]` is accessed without checking for undefined. Fix pattern:
```typescript
// Before:
return result[0] as SomeType

// After:
const row = result[0]
if (!row) return null
return {
  id: row.id as number,
  name: row.name as string,
  // ...
}
```

### 5.3 Remove Unused Dependencies

Review `package.json` for potentially unused packages:
- `@xenova/transformers` -- check if still used or replaced by Jina API
- `@google/generative-ai` -- check if still used or replaced
- `ws` -- check if WebSocket is still used
- `embla-carousel-react` -- check if carousel is used in UI
- `input-otp` -- check if OTP input is used

Run `npx depcheck` to get definitive list.

---

## 6. Testing Strategy

### 6.1 What to Test First (Critical Paths)

**Priority 1 -- Security:**
- `lib/api-keys.ts` -- API key generation, hashing, validation
- `lib/validation.ts` -- Zod schema validation (ingestion payload)
- `lib/session-context.ts` -- Session context resolution, role checks
- `lib/r2.ts:generateArtifactKey` -- Path traversal prevention

**Priority 2 -- Data Integrity:**
- `lib/db/ingestion.ts` -- `insertExecution`, `insertTestResults` (most critical write path)
- `lib/db/utils.ts` -- `generateTestSignature`, `isTestFlaky` (used everywhere)
- `lib/db/flakiness.ts:updateFlakinessHistory` -- upsert logic
- `lib/db/suites.ts:upsertSuite`, `upsertSuiteTest` -- auto-registration

**Priority 3 -- Business Logic:**
- `lib/db/classification.ts` -- FLAKE vs BUG classification signals
- `lib/db/metrics.ts:getReliabilityScore` -- score calculation formula
- `lib/db/comparison.ts:compareExecutions` -- diff calculation
- `lib/db/performance.ts:getPerformanceRegressions` -- regression detection

**Priority 4 -- API Routes:**
- `app/api/test-results/route.ts` -- main ingestion endpoint
- `app/api/mcp/oauth/token/route.ts` -- OAuth token exchange
- `app/api/mcp/oauth/authorize/route.ts` -- OAuth authorization

### 6.2 Test Infrastructure Setup

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "packages/*/dist"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["lib/db/types.ts", "**/*.d.ts"],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
      },
    },
    alias: {
      "@": path.resolve(__dirname),
    },
  },
})
```

**Database mocking strategy:**
```typescript
// tests/helpers/db-mock.ts
import { vi } from "vitest"

// Mock the connection module
vi.mock("@/lib/db/connection", () => ({
  getSql: vi.fn(() => {
    // Return a mock tagged template function
    const sql = Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        // Record the query for assertions
        sql._lastQuery = { strings, values }
        return sql._nextResult ?? []
      },
      {
        _lastQuery: null as { strings: TemplateStringsArray; values: unknown[] } | null,
        _nextResult: undefined as unknown[] | undefined,
        unsafe: (str: string) => str,
        mockResult: (result: unknown[]) => {
          sql._nextResult = result
        },
      }
    )
    return sql
  }),
}))
```

### 6.3 Example Tests

```typescript
// lib/__tests__/api-keys.test.ts
import { describe, it, expect } from "vitest"
import { generateApiKey, hashApiKey, isExolarApiKey } from "@/lib/api-keys"

describe("API Key Generation", () => {
  it("generates keys with exolar_ prefix", () => {
    const { key, hash, prefix } = generateApiKey()
    expect(key).toMatch(/^exolar_[A-Za-z0-9_-]+$/)
    expect(prefix).toBe(key.slice(0, 16))
    expect(hash).toHaveLength(64) // SHA-256 hex
  })

  it("produces deterministic hashes", () => {
    const key = "exolar_testkey123456789012345678"
    expect(hashApiKey(key)).toBe(hashApiKey(key))
  })

  it("detects exolar API key format", () => {
    expect(isExolarApiKey("Bearer exolar_abc123")).toBe(true)
    expect(isExolarApiKey("Bearer sk-abc123")).toBe(false)
    expect(isExolarApiKey(null)).toBe(false)
  })
})
```

```typescript
// lib/__tests__/r2.test.ts
import { describe, it, expect } from "vitest"
import { generateArtifactKey } from "@/lib/r2"

describe("generateArtifactKey", () => {
  it("generates valid path", () => {
    const key = generateArtifactKey(1, "test::sig", "screenshot", "image.png")
    expect(key).toBe("artifacts/1/test__sig/screenshot/image.png")
  })

  it("prevents path traversal in filename", () => {
    const key = generateArtifactKey(1, "sig", "screenshot", "../../etc/passwd")
    expect(key).not.toContain("..")
    expect(key).not.toContain("/etc")
  })

  it("prevents path traversal in test signature", () => {
    const key = generateArtifactKey(1, "../../../etc/passwd", "screenshot", "img.png")
    expect(key).not.toContain("../")
  })
})
```

### 6.4 Target Coverage

| Module | Current | Target (3 months) |
|--------|---------|-------------------|
| `lib/api-keys.ts` | 0% | 90% |
| `lib/validation.ts` | 0% | 90% |
| `lib/session-context.ts` | 0% | 80% |
| `lib/r2.ts` | 0% | 80% |
| `lib/db/utils.ts` | 0% | 90% |
| `lib/db/ingestion.ts` | 0% | 80% |
| `lib/db/classification.ts` | 0% | 70% |
| `lib/db/metrics.ts` | 0% | 60% |
| **Overall** | **0%** | **60%** |

---

## 7. MCP Server Improvements

### 7.1 Request Timeouts

**Problem:** `MCPClient.makeRequest` uses `fetch()` with no timeout. If the dashboard is slow or unresponsive, the MCP server hangs indefinitely.

**Fix:**
```typescript
// packages/mcp-server/src/client.ts
private async makeRequest(request: MCPRequest): Promise<MCPResponse> {
  const url = `${this.config.dashboardUrl}/api/mcp`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000) // 30s timeout

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.token}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication expired. Run: npx @exolar/mcp-server --login")
      }
      if (response.status === 429) {
        throw new Error("Rate limited. Please wait and try again.")
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json() as MCPResponse
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after 30s connecting to ${url}`)
    }
    if (error instanceof Error && error.message.includes("fetch")) {
      throw new Error(`Failed to connect to ${url}. Check your internet connection.`)
    }
    throw error
  }
}
```

### 7.2 Retry Logic

```typescript
// packages/mcp-server/src/client.ts
private async makeRequestWithRetry(
  request: MCPRequest,
  maxRetries = 2
): Promise<MCPResponse> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this.makeRequest(request)
    } catch (error) {
      lastError = error as Error

      // Don't retry auth errors or client errors
      if (lastError.message.includes("Authentication") ||
          lastError.message.includes("400")) {
        throw lastError
      }

      // Exponential backoff: 1s, 2s
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000
        console.error(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError!
}
```

### 7.3 Connection Pooling (HTTP Keep-Alive)

The MCP server makes sequential HTTP requests. Enable keep-alive to reuse TCP connections:

```typescript
// packages/mcp-server/src/client.ts
import { Agent } from "http"
import { Agent as HttpsAgent } from "https"

export class MCPClient {
  private config: MCPConfig
  private requestId = 0
  private agent: HttpsAgent

  constructor(config: MCPConfig) {
    this.config = config
    this.agent = new HttpsAgent({
      keepAlive: true,
      maxSockets: 5,
      timeout: 30_000,
    })
  }
  // ... use this.agent in fetch options (Node.js 18+ supports it via undici)
}
```

### 7.4 Pagination Support

**Problem:** Tools that return large result sets (e.g., test results, executions) return everything at once. For organizations with thousands of tests, this can exceed context limits.

**Fix:** Add `cursor` and `limit` parameters to list tools:

```typescript
// On the dashboard side, update MCP tool definitions:
{
  name: "list_executions",
  description: "List test executions with pagination",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", default: 20, maximum: 100 },
      cursor: { type: "string", description: "Pagination cursor from previous response" },
      status: { type: "string", enum: ["success", "failure", "running"] },
      branch: { type: "string" },
    }
  }
}

// Response format:
{
  data: [...],
  pagination: {
    cursor: "eyJpZCI6MTIzfQ==", // base64 encoded {id: 123}
    hasMore: true,
    total: 1500,
  }
}
```

---

## 8. CI Auto-Analysis & Auto-Heal Pipeline

### 8.1 Overview

Exolar is part of a three-project ecosystem alongside **Triqual** (autonomous test automation plugin) and **Quoth** (AI memory + A2A bus). The CI pipeline closes the loop:

```
CI Run fails → Reporter → Exolar (analyze) → Triqual (heal) + Quoth (patterns)
                                            → GitHub Issue (real bugs)
```

This is inspired by Kubiks.ai's approach to production observability (AI agent that detects issues and generates PRs), applied to the Playwright test domain.

### 8.2 New Components in Exolar

#### 8.2.1 Analysis Engine (`lib/ci/analysis-engine.ts`)

Core decision-making module. Called post-ingestion when a CI run has failures.

```typescript
// lib/ci/analysis-engine.ts
import { getQueriesForOrg } from "@/lib/db"
import { getFailureClassification } from "@/lib/db/classification"
import { getClusteredFailures } from "@/lib/db/clustering"

export interface AnalysisResult {
  execution_id: number
  total_failures: number
  action_plan: {
    healable: HealableFailure[]   // → dispatch to Triqual test-healer
    bugs: DetectedBug[]           // → create GitHub Issue
    known_flakes: KnownFlake[]    // → skip, annotate in dashboard
    infra_issues: InfraIssue[]    // → alert, don't auto-fix
    manual_review: ManualReview[] // → confidence too low to act
  }
  confidence: number // overall confidence 0-100
}

interface HealableFailure {
  test_signature: string
  test_file: string
  test_name: string
  error_type: string
  fix_strategy: "selector_update" | "wait_adjustment" | "race_condition" | "retry_logic" | "api_timing"
  confidence: number
  ai_context: AIFailureContext
  similar_past_fixes: PastFix[] // from Exolar history
  quoth_patterns: string[]      // matching patterns from Quoth
}

interface DetectedBug {
  summary: string
  test_signatures: string[]     // all tests hitting this bug
  root_cause_cluster: string    // from semantic clustering
  confidence: number
  issue_body: string            // pre-formatted GitHub issue markdown
  evidence: {
    error_message: string
    stack_trace: string
    first_seen_commit: string
    affected_tests_count: number
    regression_in_commit: boolean
  }
}
```

**Decision Matrix:**

| Signal | HEALABLE | REAL_BUG | KNOWN_FLAKE | INFRA |
|--------|----------|----------|-------------|-------|
| Classification = FLAKE | ✓ | | ✓ (if recurring) | |
| Classification = BUG | | ✓ | | |
| Flakiness rate > 10% | ✓ | | ✓ | |
| Passes on retry | ✓ | | | |
| Error: TimeoutError | ✓ | | | |
| Error: LocatorError | ✓ | | | |
| Error: AssertionError (unexpected value) | | ✓ | | |
| New failure in this commit | | ✓ | | |
| Same error in >3 tests (cluster) | | ✓ | | |
| Error: NetworkError / 5xx | | | | ✓ |
| Error: ECONNREFUSED / DNS | | | | ✓ |
| Confidence < 70% | → manual_review | → manual_review | | |

**Fix Strategy Selection for HEALABLE:**

| Error Pattern | Fix Strategy | What Triqual Does |
|--------------|-------------|-------------------|
| `locator.click` / `locator.fill` timeout | `selector_update` | Find more robust selector via Playwright MCP |
| `waitForSelector` timeout | `wait_adjustment` | Add `waitForLoadState` or increase timeout |
| Passes on 2nd retry, fails on 1st | `race_condition` | Add `expect().toBeVisible()` guard before action |
| API 5xx intermittent | `api_timing` | Add `page.waitForResponse()` or mock API |
| Stale element reference | `retry_logic` | Re-query locator before action |

#### 8.2.2 CI Analyze Endpoint (`app/api/ci/analyze/route.ts`)

```typescript
// app/api/ci/analyze/route.ts
// POST /api/ci/analyze
// Body: { execution_id?: number, run_id?: string, auto_actions?: boolean }
// Auth: Bearer API key (org-scoped)
//
// Response: AnalysisResult
//
// If auto_actions is true AND org has webhooks configured:
//   - Sends webhook to configured URL with action plan
//   - For HEALABLE: includes Triqual-compatible payload
//   - For BUGS: includes pre-formatted GitHub issue body
```

#### 8.2.3 Webhook Notifier (`lib/ci/webhook-notifier.ts`)

Post-ingestion hook that fires when an execution is ingested with failures.

```typescript
// lib/ci/webhook-notifier.ts
// Called from app/api/test-results/route.ts after successful ingestion

export interface WebhookConfig {
  url: string                    // target URL (OpenClaw, GitHub, custom)
  events: ("failure" | "all")[]  // when to fire
  filters: {
    min_failures?: number        // don't fire for < N failures
    only_critical?: boolean      // only @critical tagged tests
    branches?: string[]          // only these branches (e.g., ["main"])
  }
  secret?: string                // HMAC-SHA256 signature for verification
}

// Stored per-org in DB:
// CREATE TABLE org_webhooks (
//   id SERIAL PRIMARY KEY,
//   organization_id INTEGER REFERENCES organizations(id),
//   name TEXT NOT NULL,
//   url TEXT NOT NULL,
//   events TEXT[] NOT NULL DEFAULT '{failure}',
//   filters JSONB DEFAULT '{}',
//   secret_hash TEXT,
//   is_active BOOLEAN DEFAULT true,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
```

#### 8.2.4 Reporter Enhancements (`packages/playwright-reporter`)

Extend `AIFailureContext` with richer data for better auto-heal decisions:

```typescript
// Additional fields in AIFailureContext
export interface AIFailureContextV2 extends AIFailureContext {
  dom_snapshot?: string          // Accessibility tree at failure point
  network_log?: NetworkEntry[]   // Last N requests before failure
  retry_history?: RetryEntry[]   // All retry attempt results
  git_diff_summary?: string      // Changed files in this commit
  selector_candidates?: string[] // Alternative selectors found by Playwright
}

interface NetworkEntry {
  url: string
  method: string
  status: number
  timing_ms: number
  is_api_call: boolean
}

interface RetryEntry {
  attempt: number
  status: "passed" | "failed"
  error_message?: string
  duration_ms: number
}
```

### 8.3 Execution Paths

Two complementary paths — Claude Code for interactive use, OpenClaw for CI automation:

```
┌─────────────────────────────────┐  ┌──────────────────────────────────┐
│  CLAUDE CODE + TRIQUAL PLUGIN   │  │  OPENCLAW AGENT (exolar-sentinel)│
│  (Interactive / Development)    │  │  (CI / Automated)                │
├─────────────────────────────────┤  ├──────────────────────────────────┤
│                                 │  │                                  │
│  Developer runs:                │  │  CI webhook triggers:            │
│  /test login                    │  │  POST /exolar/ci-failure         │
│  /test --ticket ENG-123         │  │                                  │
│  /test --explore checkout       │  │  Agent receives execution data,  │
│  /check                         │  │  calls Exolar /api/ci/analyze,   │
│                                 │  │  dispatches auto-heal or         │
│  Uses: Playwright MCP (local)   │  │  creates GitHub issues           │
│        Quoth MCP (patterns)     │  │                                  │
│        Exolar MCP (analytics)   │  │  Uses: Exolar MCP (analytics)    │
│        Linear MCP (tickets)     │  │        Quoth MCP (patterns)      │
│                                 │  │        Linear MCP (tickets)      │
│  Output: tests in .draft/       │  │        GitHub API (PRs/issues)   │
│          → promoted to tests/   │  │        git (clone, branch, push) │
│                                 │  │                                  │
│  Guardrails: Triqual hooks      │  │  Output: auto-heal PRs           │
│              Quoth enforcement   │  │          GitHub issues           │
│              Gate-based blocking │  │          Quoth pattern updates   │
└─────────────────────────────────┘  └──────────────────────────────────┘
```

#### Path A: Claude Code + Triqual Plugin (Interactive)

This is the current Triqual workflow — developers use it locally via Claude Code with the Triqual plugin installed. No changes needed to this path; it already works with Exolar MCP and Quoth MCP.

The improvement is that Exolar now provides **richer analysis data** via the CI analyze endpoint, which Triqual's test-planner can consume for better context when a developer investigates a CI failure interactively:

```bash
# Developer sees CI failure, opens Claude Code with Triqual plugin
/test --ticket ENG-123   # Triqual's planner fetches Exolar analysis + Linear context
```

#### Path B: OpenClaw Agent (CI Automation)

The primary CI path. A dedicated OpenClaw agent (`exolar-sentinel`) with persistent memory, Tailscale-accessible webhook, and full MCP stack:

```nix
# In ~/.openclaw-nix/hosts/montino.nix
# Add to the agent fleet:
exolar-sentinel = {
  model = "sonnet-4.6";  # Cost-effective for analysis; escalates to Opus for complex fixes
  systemPrompt = builtins.readFile ./agents/exolar-sentinel/IDENTITY.md;
  tools = {
    mcp = [
      { name = "exolar-qa"; url = "https://exolar.triqual.dev/api/mcp/mcp"; }
      { name = "quoth"; url = "https://quoth.triqual.dev/api/mcp"; }
      { name = "linear"; url = "https://mcp.linear.app/sse"; }
    ];
    builtin = [ "git" "github" "web" ];
  };
  # Webhook trigger: Exolar calls this after ingesting failed runs
  triggers = [{
    type = "webhook";
    path = "/exolar/ci-failure";
    handler = "analyze-and-act";
    # Agent receives: { execution_id, org_id, run_id, failure_count, branch, repo }
  }];
  memory = {
    backend = "lancedb";
    namespace = "exolar-sentinel";
    # Remembers past fixes, recurring patterns, false positives
  };
};
```

**Agent workflow on webhook trigger:**

```
1. RECEIVE webhook payload { execution_id, org_id, run_id, repo, branch }
2. QUERY Exolar: POST /api/ci/analyze { execution_id }
   → Gets: action_plan with healable[], bugs[], known_flakes[], infra[]
3. FOR EACH healable failure:
   a. Clone repo (or pull latest in cached workspace)
   b. Checkout the failing branch
   c. Search Quoth for proven fix patterns matching error_type
   d. Read the failing test file + AIFailureContext
   e. If test has linked Linear ticket: fetch AC for context
   f. Apply fix_strategy (selector_update, wait_adjustment, etc.)
   g. Run `npx playwright test <file> --reporter=list` (max 3 attempts)
   h. If test passes: commit + push to branch `exolar/auto-heal-{run_id}`
   i. Create PR targeting the original branch
   j. Feed successful pattern back to Quoth via quoth_propose_update
   k. Update ci_auto_heal_attempts table in Exolar
4. FOR EACH detected bug:
   a. Check for existing open issue with same root_cause_cluster
   b. If new: create GitHub issue with pre-formatted body
   c. If Linear ticket linked: add comment on Linear ticket too
   d. Update ci_auto_bugs table in Exolar
5. FOR EACH known_flake:
   a. Annotate in Exolar dashboard (no action needed)
   b. If flake count exceeds threshold: escalate to healable
6. STORE learnings in agent memory for next run
```

**Why OpenClaw over GitHub Actions for CI:**

| Aspect | GitHub Actions | OpenClaw Agent |
|--------|---------------|----------------|
| Memory | Stateless per run | Persistent LanceDB memory |
| Cross-repo | Per-repo only | Correlates across all projects in Exolar org |
| A2A | None | Quoth bus + inter-agent communication |
| Cost | GH Actions minutes + Anthropic API | Local Montino node + Anthropic API |
| Latency | ~2min cold start | Webhook → instant response |
| Learning | No | Remembers past fixes, avoids repeating failures |
| Coordination | Independent | Can consult Morfeo/Prometeo for infra issues |

**GitHub Actions still useful as the trigger:**

Even with OpenClaw as the executor, the CI pipeline (GitHub Actions) is where tests run. The integration point is Exolar's webhook notifier, which fires after the reporter ingests results:

```yaml
# In the project's CI workflow, the reporter sends results to Exolar.
# Exolar's post-ingestion webhook notifies exolar-sentinel on Montino.
# No extra GitHub Actions workflow needed — the agent handles everything.
```

The only GitHub Actions addition needed is a simple step that verifies the webhook was received (optional, for audit):

```yaml
# Optional: add to existing test workflow
- name: Notify Exolar
  if: failure()
  run: |
    echo "Exolar reporter already sent results during test run."
    echo "Auto-analysis webhook will fire automatically."
```

### 8.4 Integration with Triqual

Triqual already has the 5 agents needed. The CI pipeline invokes them differently:

| Triqual Agent | Interactive Use (current) | CI Auto-Heal (new) |
|--------------|--------------------------|---------------------|
| test-planner | `/test login` → plans from scratch | Receives pre-built plan from Exolar analysis |
| test-generator | Generates new tests | Skipped (test already exists) |
| test-healer | Fixes draft tests up to 25x | Fixes existing tests, max 3 attempts (CI budget) |
| failure-classifier | Classifies during healing | Exolar's analysis-engine does this pre-dispatch |
| pattern-learner | Extracts patterns post-success | Same — feeds back to Quoth after successful fix |

**Key change**: In CI mode, Triqual's healer operates on *existing* tests (not drafts) with a tighter attempt budget. The analysis-engine pre-classifies, so the classifier is only used as a second opinion during healing.

### 8.5 Integration with Linear MCP

Linear provides the **requirements context** that transforms analysis from "what failed" to "why it matters":

**How it connects:**
- Triqual already supports `/test --ticket ENG-123` — linking tests to Linear issues
- The reporter can tag test results with the Linear issue/project they verify
- Exolar's analysis engine uses Linear MCP to:
  1. Fetch the ticket description and acceptance criteria for the failing test
  2. Determine if the failure is "test doesn't match spec" (TEST_ISSUE) vs "feature doesn't match spec" (REAL_BUG)
  3. Enrich auto-generated GitHub issues with the Linear ticket context
  4. Check if the Linear ticket is still in progress (don't report bugs on WIP features)

**MCP integration in Exolar:**
```json
// Add to Exolar's .mcp.json or Triqual's .mcp.json
{
  "linear": {
    "type": "http",
    "url": "https://mcp.linear.app/sse",
    "headers": {
      "Authorization": "Bearer ${LINEAR_API_KEY}"
    }
  }
}
```

**Analysis engine enrichment flow:**
```
1. Test fails → Exolar classifies
2. If test has linked Linear ticket:
   a. Fetch ticket via Linear MCP (description, acceptance criteria, status)
   b. Compare failure against acceptance criteria
   c. If AC says "user sees success message" but test asserts wrong text → REAL_BUG
   d. If AC says "user can login" but test has fragile selector → TEST_ISSUE (HEALABLE)
   e. If ticket status is "In Progress" → suppress auto-bug-report (WIP)
3. Include Linear context in auto-generated GitHub issues:
   - Link to Linear ticket
   - Which acceptance criterion is violated
   - Priority from Linear ticket
```

**Reporter enhancement — ticket linking:**
```typescript
// In playwright.config.ts
reporter: [
  [exolar, {
    apiKey: process.env.EXOLAR_API_KEY,
    // Map test files/tags to Linear tickets
    ticketMapping: {
      "tests/auth/login.spec.ts": "ENG-123",
      "@checkout": "ENG-456",  // tag-based mapping
    },
    // Or auto-detect from branch name (e.g., feature/ENG-123-login)
    autoDetectTicket: true,
  }]
]
```

### 8.6 Integration with Quoth (A2A Bus)

Quoth participates in three ways:

1. **Pre-fix pattern lookup**: Before Triqual's healer modifies a test, it searches Quoth for proven fix patterns for that error type. This reduces fix iterations.

2. **Post-fix pattern promotion**: After a successful auto-heal, the pattern-learner proposes the fix pattern to Quoth (`quoth_propose_update`). Over time, Quoth accumulates a library of "TimeoutError on waitFor → add waitForLoadState" patterns.

3. **A2A bus for cross-project coordination**: If the same flakiness pattern appears across multiple projects using Exolar, Quoth can propagate the fix pattern to all of them through its multi-project knowledge base.

### 8.7 Database Additions

```sql
-- Migration: 016_ci_analysis.sql

-- Webhook configuration per org
CREATE TABLE org_webhooks (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{failure}',
  filters JSONB DEFAULT '{}',
  secret_hash TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_org_active
  ON org_webhooks (organization_id) WHERE is_active = true;

-- Analysis results (one per execution that has failures)
CREATE TABLE ci_analysis_results (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  execution_id INTEGER NOT NULL REFERENCES test_executions(id),
  action_plan JSONB NOT NULL,
  total_failures INTEGER NOT NULL,
  healable_count INTEGER DEFAULT 0,
  bug_count INTEGER DEFAULT 0,
  known_flake_count INTEGER DEFAULT 0,
  infra_count INTEGER DEFAULT 0,
  manual_review_count INTEGER DEFAULT 0,
  overall_confidence REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (execution_id)
);

CREATE INDEX idx_analysis_org_created
  ON ci_analysis_results (organization_id, created_at DESC);

-- Auto-heal attempts tracking
CREATE TABLE ci_auto_heal_attempts (
  id SERIAL PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES ci_analysis_results(id),
  test_signature TEXT NOT NULL,
  fix_strategy TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, success, failed, skipped
  pr_url TEXT,
  pr_number INTEGER,
  error_log TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (analysis_id, test_signature, attempt_number)
);

-- Auto-reported bugs tracking
CREATE TABLE ci_auto_bugs (
  id SERIAL PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES ci_analysis_results(id),
  issue_url TEXT,
  issue_number INTEGER,
  summary TEXT NOT NULL,
  root_cause_cluster TEXT,
  affected_signatures TEXT[],
  status TEXT NOT NULL DEFAULT 'reported', -- reported, confirmed, fixed, false_positive
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.8 Guardrails & Safety

| Guardrail | Implementation | Why |
|-----------|---------------|-----|
| **Test-only scope** | Claude Code Action prompt restricts to `*.spec.ts`/`*.test.ts` | Prevent app code changes |
| **Confidence threshold** | Analysis engine requires ≥70% to act | Avoid false positive fixes |
| **Attempt budget** | Max 3 fix attempts per test in CI (vs 25 in interactive) | Control CI costs |
| **PR review required** | Auto-heal PRs need human approval before merge | Safety net |
| **Duplicate detection** | Check existing open issues before creating new ones | Prevent issue spam |
| **Rate limiting** | Max 5 auto-heal runs per org per day | Cost control |
| **Branch protection** | Auto-heal creates branches, never pushes to main | Protect main branch |
| **Rollback** | If auto-healed test fails in next CI run, auto-close PR | Self-correcting |
| **Quoth enforcement** | Triqual hooks block test writes without pattern search | Anti-hallucination |
| **Audit trail** | All analysis results + heal attempts stored in DB | Traceability |

---

## 9. Implementation Priority & Timeline

### Phase 1: Critical Security (Week 1-2)
1. Fix MCP token secret (hardcoded fallback removal)
2. Fix R2 path traversal in `generateArtifactKey`
3. Add redirect URI allowlist to OAuth
4. Start replacing `.unsafe()` calls in highest-risk files:
   - `classification.ts` (full raw queries)
   - `search.ts` (full raw queries)
   - `metrics.ts:getTrendData` (full raw query)

### Phase 2: SQL Injection Elimination (Week 2-4)
5. Convert all remaining `.unsafe()` calls to parameterized queries
6. Add query builder helpers
7. Replace `SELECT *` with specific columns
8. Add missing composite indexes

### Phase 3: Infrastructure (Week 4-6)
9. Set up Vitest + write tests for Priority 1 modules
10. Fix TypeScript errors, remove `ignoreBuildErrors`
11. Add connection pooling
12. Add service layer for top 3 most complex routes

### Phase 4: MCP & Polish (Week 6-8)
13. Add request timeouts + retry logic to MCP client
14. Add pagination support to MCP tools
15. Implement middleware chain (auth + rate limiting + error handling)
16. Add structured logging
17. Make ingestion idempotent with upsert patterns
18. Reach 60% test coverage target

### Phase 5: CI Auto-Analysis Pipeline (Week 8-12)

**Exolar (dashboard side):**
19. Create DB migration `016_ci_analysis.sql` (webhooks, analysis results, heal attempts, auto bugs tables)
20. Build Analysis Engine (`lib/ci/analysis-engine.ts`) — core decision logic
21. Build CI Analyze endpoint (`app/api/ci/analyze/route.ts`)
22. Build Webhook Notifier (`lib/ci/webhook-notifier.ts`) — post-ingestion dispatch to OpenClaw
23. Enhance reporter with `AIFailureContextV2` (DOM snapshot, network log, retry history, ticket linking)
24. Build webhook management UI (dashboard settings page)
25. Add Linear MCP integration to analysis engine (ticket context, AC comparison)

**OpenClaw (CI automation side):**
26. Design `exolar-sentinel` agent spec (IDENTITY.md, TOOLS.md, SOUL.md)
27. Configure in `~/.openclaw-nix/hosts/montino.nix` with MCP stack (Exolar + Quoth + Linear)
28. Implement webhook handler: receive → analyze → dispatch heal/bug-report
29. Implement auto-heal flow: clone → fix → test → PR (using Triqual methodology)
30. Implement auto-bug-report flow: classify → deduplicate → GitHub issue + Linear comment

**Integration & learning:**
31. End-to-end testing: CI failure → Exolar webhook → OpenClaw heal → PR created
32. Cross-project pattern propagation via Quoth A2A bus
33. Claude Code + Triqual: ensure interactive path benefits from new Exolar analysis data
