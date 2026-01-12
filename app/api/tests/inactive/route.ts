import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/tests/inactive
 *
 * Get tests that haven't run in 30+ days
 * Query params:
 *   - limit: Number of results (default 50)
 */
export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50", 10)

    const tests = await db.getInactiveTests(limit)
    const summary = await db.getSuiteCountsSummary()

    return NextResponse.json({
      tests,
      count: tests.length,
      total_inactive: summary.inactive_tests,
    })
  } catch (error) {
    console.error("[GET /api/tests/inactive] Error:", error)
    return NextResponse.json({ error: "Failed to fetch inactive tests" }, { status: 500 })
  }
}
