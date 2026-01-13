/**
 * Admin API: Backfill universal test & suite embeddings
 *
 * POST /api/admin/backfill-test-embeddings
 *
 * Generates embeddings for ALL tests (passed, failed, skipped) and suites.
 * Uses Jina v3 embeddings (512-dim) stored in test_embedding and suite_embedding columns.
 *
 * Body options:
 * - type: "tests" | "suites" | "all" (default: "all")
 * - limit: number (max tests/suites per batch, default: 500, max: 1000)
 * - status: string (optional, filter tests by status: "passed", "failed", "skipped")
 */

import { NextResponse } from "next/server"
import { getSessionContext, isSystemAdmin } from "@/lib/session-context"
import {
  getTestsNeedingTestEmbeddings,
  getExecutionsNeedingSuiteEmbeddings,
  countTestsWithTestEmbeddings,
  countExecutionsWithSuiteEmbeddings,
} from "@/lib/db/embeddings"
import { generateTestEmbeddingsWithProgress } from "@/lib/services/test-embedding-service"
import { generateSuiteEmbeddingsWithProgress } from "@/lib/services/suite-embedding-service"

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
    const type = body.type || "all" // "tests", "suites", or "all"
    const limit = Math.min(body.limit || 500, 1000)
    const status = body.status || null // Optional status filter

    const results: {
      tests?: {
        message: string
        stats: {
          total: number
          succeeded: number
          failed: number
          skipped: number
          durationMs: number
        }
      }
      suites?: {
        message: string
        stats: {
          total: number
          succeeded: number
          failed: number
          skipped: number
          durationMs: number
        }
      }
    } = {}

    // Process tests if requested
    if (type === "tests" || type === "all") {
      const tests = await getTestsNeedingTestEmbeddings(
        context.organizationId,
        limit,
        status
      )

      if (tests.length === 0) {
        results.tests = {
          message: "No tests need embeddings",
          stats: {
            total: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            durationMs: 0,
          },
        }
      } else {
        const stats = await generateTestEmbeddingsWithProgress(tests)
        results.tests = {
          message: `Processed ${stats.total} tests`,
          stats: {
            total: stats.total,
            succeeded: stats.succeeded,
            failed: stats.failed,
            skipped: stats.skipped,
            durationMs: stats.durationMs,
          },
        }
      }
    }

    // Process suites if requested
    if (type === "suites" || type === "all") {
      const executions = await getExecutionsNeedingSuiteEmbeddings(
        context.organizationId,
        limit
      )

      if (executions.length === 0) {
        results.suites = {
          message: "No suites need embeddings",
          stats: {
            total: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            durationMs: 0,
          },
        }
      } else {
        const stats = await generateSuiteEmbeddingsWithProgress(executions)
        results.suites = {
          message: `Processed ${stats.total} suites`,
          stats: {
            total: stats.total,
            succeeded: stats.succeeded,
            failed: stats.failed,
            skipped: stats.skipped,
            durationMs: stats.durationMs,
          },
        }
      }
    }

    return NextResponse.json({
      message: "Backfill complete",
      type,
      ...results,
    })
  } catch (error) {
    console.error("Backfill test embeddings error:", error)
    return NextResponse.json(
      { error: "Failed to backfill embeddings" },
      { status: 500 }
    )
  }
}

/**
 * GET: Check progress of test & suite embeddings
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

    const testCounts = await countTestsWithTestEmbeddings(context.organizationId)
    const suiteCounts = await countExecutionsWithSuiteEmbeddings(
      context.organizationId
    )

    const testsNeedEmbedding = testCounts.total - testCounts.withTestEmbedding
    const suitesNeedEmbedding =
      suiteCounts.total - suiteCounts.withSuiteEmbedding

    return NextResponse.json({
      tests: {
        withEmbedding: testCounts.withTestEmbedding,
        total: testCounts.total,
        needsEmbedding: testsNeedEmbedding,
        percentComplete:
          testCounts.total > 0
            ? ((testCounts.withTestEmbedding / testCounts.total) * 100).toFixed(
                1
              )
            : "100",
      },
      suites: {
        withEmbedding: suiteCounts.withSuiteEmbedding,
        total: suiteCounts.total,
        needsEmbedding: suitesNeedEmbedding,
        percentComplete:
          suiteCounts.total > 0
            ? (
                (suiteCounts.withSuiteEmbedding / suiteCounts.total) *
                100
              ).toFixed(1)
            : "100",
      },
      message:
        testsNeedEmbedding > 0 || suitesNeedEmbedding > 0
          ? `${testsNeedEmbedding} tests and ${suitesNeedEmbedding} suites need embeddings`
          : "All tests and suites have embeddings",
    })
  } catch (error) {
    console.error("Check embeddings error:", error)
    return NextResponse.json(
      { error: "Failed to check embeddings" },
      { status: 500 }
    )
  }
}
