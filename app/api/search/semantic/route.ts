/**
 * API: Semantic Search
 *
 * POST /api/search/semantic
 *
 * Performs semantic search using vector embeddings with optional reranking.
 * Supports three modes:
 * - semantic: Vector similarity search only
 * - keyword: Traditional text matching only
 * - hybrid: Combines both for best results (default)
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { semanticSearch, getSearchStats } from "@/lib/services/search-service"

export const dynamic = "force-dynamic"

interface SearchRequestBody {
  query: string
  mode?: "semantic" | "keyword" | "hybrid"
  limit?: number
  branch?: string
  suite?: string
  since?: string
  rerank?: boolean
}

/**
 * POST: Perform semantic search
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as SearchRequestBody
    const { query, mode = "hybrid", limit = 20, branch, suite, since, rerank = true } = body

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      )
    }

    const response = await semanticSearch({
      query: query.trim(),
      organizationId: context.organizationId,
      mode,
      limit: Math.min(limit, 100),
      branch,
      suite,
      since,
      rerank,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error("Semantic search error:", error)
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    )
  }
}

/**
 * GET: Get search stats/capabilities
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check for quick search via query param
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    if (query) {
      // Quick search via GET
      const mode = (searchParams.get("mode") as "semantic" | "keyword" | "hybrid") || "hybrid"
      const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)

      const response = await semanticSearch({
        query: query.trim(),
        organizationId: context.organizationId,
        mode,
        limit,
        rerank: searchParams.get("rerank") !== "false",
      })

      return NextResponse.json(response)
    }

    // Return search stats/capabilities
    const stats = await getSearchStats(context.organizationId)

    return NextResponse.json({
      capabilities: {
        semanticSearch: stats.semanticSearchAvailable,
        reranking: stats.rerankingAvailable,
        provider: stats.provider,
      },
      coverage: stats.embeddingCoverage,
    })
  } catch (error) {
    console.error("Search stats error:", error)
    return NextResponse.json(
      { error: "Failed to get search stats" },
      { status: 500 }
    )
  }
}
