/**
 * Database Connection for MCP Server
 *
 * Uses Neon Serverless driver for database access.
 */

import { neon, NeonQueryFunction } from "@neondatabase/serverless"

let sql: NeonQueryFunction<false, false> | null = null

/**
 * Get the database connection singleton.
 * Throws if DATABASE_URL is not set.
 */
export function getSql(): NeonQueryFunction<false, false> {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required")
    }
    sql = neon(connectionString)
  }
  return sql
}
