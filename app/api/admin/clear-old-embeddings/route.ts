/**
 * Admin API: Clear old test embeddings
 *
 * POST /api/admin/clear-old-embeddings
 *
 * Clears test_embedding for all tests EXCEPT the most recent N tests.
 * Used to test semantic search quality with a smaller, freshly embedded dataset.
 *
 * Body:
 * - keepRecent: number (how many recent tests to keep, default: 100)
 */

import { NextResponse } from "next/server"
import { getSessionContext, isSystemAdmin } from "@/lib/session-context"
import { getSql } from "@/lib/db/connection"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    // Require system admin
    const context = await getSessionContext()
    if (!context || !isSystemAdmin(context)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const keepRecent = body.keepRecent || 100

    const sql = getSql()

    // Count how many will be cleared
    const countResult = await sql`
      WITH recent_tests AS (
        SELECT tr.id
        FROM test_results tr
        INNER JOIN test_executions te ON tr.execution_id = te.id
        WHERE te.organization_id = ${context.organizationId}
        ORDER BY tr.created_at DESC
        LIMIT ${keepRecent}
      )
      SELECT COUNT(*) as to_clear
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${context.organizationId}
        AND tr.test_embedding IS NOT NULL
        AND tr.id NOT IN (SELECT id FROM recent_tests)
    `

    const toClear = Number(countResult[0].to_clear)

    // Clear old embeddings
    await sql`
      WITH recent_tests AS (
        SELECT tr.id
        FROM test_results tr
        INNER JOIN test_executions te ON tr.execution_id = te.id
        WHERE te.organization_id = ${context.organizationId}
        ORDER BY tr.created_at DESC
        LIMIT ${keepRecent}
      )
      UPDATE test_results
      SET test_embedding = NULL,
          test_embedding_hash = NULL
      WHERE id NOT IN (SELECT id FROM recent_tests)
        AND test_embedding IS NOT NULL
        AND id IN (
          SELECT tr.id FROM test_results tr
          INNER JOIN test_executions te ON tr.execution_id = te.id
          WHERE te.organization_id = ${context.organizationId}
        )
    `

    return NextResponse.json({
      message: "Old embeddings cleared",
      cleared: toClear,
      kept: keepRecent,
    })
  } catch (error) {
    console.error("Clear old embeddings error:", error)
    return NextResponse.json(
      { error: "Failed to clear embeddings" },
      { status: 500 }
    )
  }
}

/**
 * GET: Check current embedding status
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context || !isSystemAdmin(context)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const sql = getSql()

    const result = await sql`
      SELECT
        COUNT(*) as total_tests,
        COUNT(test_embedding) as with_embedding
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${context.organizationId}
    `

    return NextResponse.json({
      totalTests: Number(result[0].total_tests),
      withEmbedding: Number(result[0].with_embedding),
      withoutEmbedding: Number(result[0].total_tests) - Number(result[0].with_embedding),
    })
  } catch (error) {
    console.error("Check embeddings error:", error)
    return NextResponse.json(
      { error: "Failed to check embeddings" },
      { status: 500 }
    )
  }
}
