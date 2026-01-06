import { NextRequest, NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * Search test executions by branch, commit SHA, or suite name.
 * 
 * Query params:
 * - q: Search query (required, minimum 2 characters)
 * - limit: Maximum results (default 20, max 50)
 * - branch: Optional filter to scope search within a branch
 * - suite: Optional filter to scope search within a suite
 * 
 * @example
 * GET /api/executions/search?q=main&limit=10
 * GET /api/executions/search?q=c60e951
 * GET /api/executions/search?q=feature&suite=My%20Referral
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""
    const limitParam = searchParams.get("limit")
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 20), 50) : 20
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined

    // Validate query length
    if (query.length < 2) {
      return NextResponse.json({
        executions: [],
        query,
        total: 0,
        message: "Query must be at least 2 characters",
      })
    }

    const executions = await db.searchExecutions(query, limit, branch, suite)

    return NextResponse.json({ 
      executions,
      query,
      total: executions.length,
    })
  } catch (error) {
    console.error("[API] Execution search error:", error)
    return NextResponse.json(
      { error: "Failed to search executions" },
      { status: 500 }
    )
  }
}
