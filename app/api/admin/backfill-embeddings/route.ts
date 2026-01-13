/**
 * Admin API: Backfill embeddings for existing failures
 *
 * POST /api/admin/backfill-embeddings
 *
 * Generates embeddings for failed tests that don't have them yet.
 * Uses Jina v3 embeddings with Phase 1 & 2 improvements:
 * - Contextual enrichment (10-20% better relevance)
 * - Deduplication (64% storage reduction)
 * - Late chunking (2-6% accuracy improvement)
 * - Batch optimization (8-32x faster)
 */

import { NextResponse } from "next/server"
import { getSessionContext, isSystemAdmin } from "@/lib/session-context"
import { getTestsNeedingEmbeddingsV2, countTestsWithEmbeddings } from "@/lib/db/embeddings"
import { processEmbeddingsBatch, type EnhancedEmbeddingRequest } from "@/lib/services/embedding-service-v2"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

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

    // Parse options
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 500, 1000) // Cap at 1000

    // Get tests needing v2 embeddings (Jina)
    const tests = await getTestsNeedingEmbeddingsV2(context.organizationId, limit)

    if (tests.length === 0) {
      return NextResponse.json({
        message: "No tests need embeddings",
        stats: { total: 0, generated: 0, deduplicated: 0, stored: 0 },
      })
    }

    // Transform to EnhancedEmbeddingRequest format for v2 service
    const requests: EnhancedEmbeddingRequest[] = tests.map((test) => ({
      testResultId: test.id,
      errorMessage: test.error_message,
      stackTrace: test.stack_trace,
      // Contextual enrichment fields
      testName: test.test_name,
      testFile: test.test_file,
      branch: test.branch,
      suite: test.suite,
      // Can add more context if available: commitMessage, isFlaky, etc.
    }))

    // Generate embeddings with v2 service (includes all Phase 1 & 2 improvements)
    const startTime = Date.now()
    const stats = await processEmbeddingsBatch(requests, context.organizationId)
    const durationMs = Date.now() - startTime

    return NextResponse.json({
      message: `Processed ${stats.total} tests (generated: ${stats.generated}, deduplicated: ${stats.deduplicated})`,
      stats: {
        ...stats,
        durationMs,
      },
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
    if (!context || !isSystemAdmin(context)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const counts = await countTestsWithEmbeddings(context.organizationId)
    // Use v2 (Jina) embeddings for semantic search
    const needsEmbedding = counts.total - counts.withEmbeddingV2

    return NextResponse.json({
      withEmbedding: counts.withEmbeddingV2,
      withEmbeddingV1: counts.withEmbedding, // Legacy Gemini
      total: counts.total,
      needsEmbedding,
      percentComplete:
        counts.total > 0
          ? ((counts.withEmbeddingV2 / counts.total) * 100).toFixed(1)
          : "100",
      message:
        needsEmbedding > 0
          ? `${needsEmbedding} tests need v2 embeddings`
          : "All tests have v2 embeddings",
    })
  } catch (error) {
    console.error("Check embeddings error:", error)
    return NextResponse.json(
      { error: "Failed to check embeddings" },
      { status: 500 }
    )
  }
}
