/**
 * API: Find similar failures
 *
 * GET /api/failures/[id]/similar
 *
 * Given a test result ID (failure), finds semantically similar failures
 * across the organization's history.
 *
 * Supports dual embedding versions:
 * - Uses best available embedding (prefers v2 Jina 512-dim)
 * - Falls back to v1 Gemini 768-dim if v2 not available
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getBestEmbedding, findSimilarFailures, findSimilarFailuresV2 } from "@/lib/db/embeddings"
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

    // Get best available embedding for this failure (prefers v2)
    const embeddingResult = await getBestEmbedding(testResultId)
    if (!embeddingResult) {
      return NextResponse.json(
        { error: "No embedding found for this failure. Ensure embeddings have been generated." },
        { status: 404 }
      )
    }

    const { embedding, version: embeddingVersion } = embeddingResult

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

      // Use appropriate search function based on embedding version
      const searchFn = embeddingVersion === "v2" ? findSimilarFailuresV2 : findSimilarFailures
      const similar = await searchFn(embedding, {
        organizationId: context.organizationId,
        executionId,
        threshold,
        limit,
      })

      // Filter out the source failure
      const filtered = similar.filter((s) => s.id !== testResultId)

      return NextResponse.json({
        sourceTestResultId: testResultId,
        mode: "current",
        executionId,
        embeddingVersion,
        similarCount: filtered.length,
        similar: filtered.map((s) => ({
          testResultId: s.id,
          testName: s.test_name,
          testFile: s.test_file,
          errorMessage: s.error_message,
          similarity: s.similarity,
          executionId: s.execution_id,
        })),
      })
    }

    // Historical mode: Find across all executions
    // findHistoricalClusters auto-detects version based on embedding dimensions
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
      embeddingVersion,
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
