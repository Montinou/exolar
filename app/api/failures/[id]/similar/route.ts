/**
 * API: Find similar failures
 *
 * GET /api/failures/[id]/similar
 *
 * Given a test result ID (failure), finds semantically similar failures
 * across the organization's history.
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getEmbedding, findSimilarFailures } from "@/lib/db/embeddings"
import { findHistoricalClusters } from "@/lib/db/clustering"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { id } = await params
    const testResultId = parseInt(id, 10)

    if (isNaN(testResultId)) {
      return NextResponse.json(
        { error: "Invalid test result ID" },
        { status: 400 }
      )
    }

    // Get embedding for this failure
    const embedding = await getEmbedding(testResultId)
    if (!embedding) {
      return NextResponse.json(
        { error: "No embedding found for this failure. Ensure embeddings have been generated." },
        { status: 404 }
      )
    }

    // Parse query params
    const url = new URL(request.url)
    const threshold = parseFloat(url.searchParams.get("threshold") || "0.15")
    const limit = parseInt(url.searchParams.get("limit") || "10", 10)
    const daysBack = parseInt(url.searchParams.get("days") || "30", 10)
    const mode = url.searchParams.get("mode") || "historical" // "historical" or "current"

    if (mode === "current") {
      // Find similar failures within current execution only
      const executionId = parseInt(url.searchParams.get("executionId") || "0", 10)
      if (!executionId) {
        return NextResponse.json(
          { error: "executionId required for current mode" },
          { status: 400 }
        )
      }

      const similar = await findSimilarFailures(embedding, {
        organizationId: context.organizationId,
        executionId,
        threshold,
        limit,
      })

      // Filter out the source failure
      const filtered = similar.filter((s) => s.testResultId !== testResultId)

      return NextResponse.json({
        sourceTestResultId: testResultId,
        mode: "current",
        executionId,
        similarCount: filtered.length,
        similar: filtered,
      })
    }

    // Historical mode: Find across all executions
    const similar = await findHistoricalClusters(
      embedding,
      context.organizationId,
      {
        threshold,
        limit: limit + 1, // Get extra to filter out self
        daysBack,
      }
    )

    // Filter out the source failure
    const filtered = similar.filter((s) => s.testResultId !== testResultId)
    const trimmed = filtered.slice(0, limit)

    return NextResponse.json({
      sourceTestResultId: testResultId,
      mode: "historical",
      daysBack,
      similarCount: trimmed.length,
      similar: trimmed.map((s) => ({
        testResultId: s.testResultId,
        executionId: s.executionId,
        testName: s.testName,
        errorMessage: s.errorMessage,
        similarity: s.similarity,
        branch: s.branch,
        createdAt: s.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("Find similar failures error:", error)
    return NextResponse.json(
      { error: "Failed to find similar failures" },
      { status: 500 }
    )
  }
}
