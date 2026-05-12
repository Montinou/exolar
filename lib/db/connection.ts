// lib/db/connection.ts
import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

export function getSql() {
  return neon(process.env.DATABASE_URL!)
}

/**
 * Set service account context for RLS bypass.
 * Call this at the start of API routes that use API key auth (not user sessions).
 * This allows CI/CD to write data without triggering RLS policies.
 *
 * Note: This is effectively a no-op as a standalone call (Neon serverless
 * returns a fresh pooled connection on every top-level sql call, so
 * `SET LOCAL` doesn't persist). It only works when paired with a query in
 * the same `sql.transaction([...])` call. Existing call sites should
 * migrate to `withServiceAccount(queries)` below.
 */
export async function setServiceAccountContext() {
  const sql = getSql()
  await sql`SET LOCAL app.is_service_account = 'true'`
}

/**
 * Run a set of queries inside a single transaction with the
 * `app.is_service_account = 'true'` session variable set. Use this in
 * CI/CD ingestion routes where RLS bypass is required.
 *
 *   const [, inserted] = await withServiceAccount((sql) => [
 *     sql`INSERT INTO test_executions ... RETURNING id`,
 *   ])
 */
export async function withServiceAccount<T>(
  build: (sql: NeonQueryFunction<false, false>) => Array<Promise<unknown>>,
): Promise<T> {
  const sql = getSql()
  const results = await sql.transaction([
    sql`SET LOCAL app.is_service_account = 'true'`,
    ...build(sql),
  ])
  // The first result corresponds to SET LOCAL; callers care about the rest.
  return results.slice(1) as T
}

/**
 * Run a set of queries inside a single transaction with the
 * `app.clerk_user_id` session variable set. Use this on any read/write
 * path that must be RLS-evaluated against the authenticated user.
 *
 * RLS helper functions (`safe_clerk_user_id`, `is_org_member`,
 * `is_system_admin`) read this setting via `current_setting('app.clerk_user_id', true)`.
 *
 * Why a transaction is required:
 *   The Neon serverless driver opens a fresh HTTP connection per top-level
 *   `sql` call. A bare `SET LOCAL` would never reach the same connection
 *   as the subsequent query. `sql.transaction([...])` guarantees both
 *   statements land on the same connection in one HTTP round-trip.
 *
 *   const [, rows] = await withSessionContext(clerkUserId, (sql) => [
 *     sql`SELECT * FROM test_executions WHERE organization_id = ${orgId}`,
 *   ])
 *
 * If `clerkUserId` is empty / missing, the SET LOCAL is still emitted but
 * RLS helpers see NULL and deny — the safer default than skipping the SET.
 */
export async function withSessionContext<T>(
  clerkUserId: string,
  build: (sql: NeonQueryFunction<false, false>) => Array<Promise<unknown>>,
): Promise<T> {
  const sql = getSql()
  const results = await sql.transaction([
    sql`SET LOCAL app.clerk_user_id = ${clerkUserId}`,
    ...build(sql),
  ])
  return results.slice(1) as T
}
