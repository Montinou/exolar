// lib/db/connection.ts
import { neon } from "@neondatabase/serverless"

export function getSql() {
  return neon(process.env.DATABASE_URL!)
}

/**
 * Set service account context for RLS bypass.
 * Call this at the start of API routes that use API key auth (not user sessions).
 * This allows CI/CD to write data without triggering RLS policies.
 *
 * Note: This sets a session variable that the is_service_account()
 * PostgreSQL function checks in RLS policies.
 */
export async function setServiceAccountContext() {
  const sql = getSql()
  await sql`SET LOCAL app.is_service_account = 'true'`
}
