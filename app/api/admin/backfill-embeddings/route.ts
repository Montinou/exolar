/**
 * Admin API: Backfill embeddings for existing failures
 *
 * POST /api/admin/backfill-embeddings
 *
 * Generates embeddings for failed tests that don't have them yet.
 * Should be run once after initial deployment.
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getTestsNeedingEmbeddings, countTestsWithEmbeddings } from "@/lib/db/embeddings"
import { generateEmbeddingsWithProgress } from "@/lib/services/embedding-service"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

export async function POST(request: Request) {
  try {
    // Require admin
    const context = await getSessionContext()
    if (!context?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    // Parse options
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 500, 1000) // Cap at 1000

    // Get tests needing embeddings
    const tests = await getTestsNeedingEmbeddings(context.organizationId, limit)

    if (tests.length === 0) {
      return NextResponse.json({
        message: "No tests need embeddings",
        stats: { total: 0, succeeded: 0, failed: 0, skipped: 0, durationMs: 0 },
      })
    }

    // Generate embeddings
    const stats = await generateEmbeddingsWithProgress(tests)

    return NextResponse.json({
      message: `Processed ${stats.total} tests`,
      stats,
    })
  } catch (error) {
    console.error("Backfill embeddings error:", error)
    return NextResponse.json(
      { error: "Failed to backfill embeddings" },
      { status: 500 }
    )
  }
}

/**
 * GET: Check how many tests need embeddings
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const counts = await countTestsWithEmbeddings(context.organizationId)
    const needsEmbedding = counts.total - counts.withEmbedding

    return NextResponse.json({
      withEmbedding: counts.withEmbedding,
      total: counts.total,
      needsEmbedding,
      percentComplete:
        counts.total > 0
          ? ((counts.withEmbedding / counts.total) * 100).toFixed(1)
          : "100",
      message:
        needsEmbedding > 0
          ? `${needsEmbedding} tests need embeddings`
          : "All tests have embeddings",
    })
  } catch (error) {
    console.error("Check embeddings error:", error)
    return NextResponse.json(
      { error: "Failed to check embeddings" },
      { status: 500 }
    )
  }
}
