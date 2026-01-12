import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/suites/[id]/tests
 *
 * Get tests for a specific suite
 * Query params:
 *   - active: Filter by active status (true/false)
 *   - critical: Filter by critical flag (true/false)
 *   - limit: Number of results (default 100)
 *   - offset: Pagination offset (default 0)
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const suiteId = parseInt(id, 10)

    if (isNaN(suiteId)) {
      return NextResponse.json({ error: "Invalid suite ID" }, { status: 400 })
    }

    const db = getQueriesForOrg(context.organizationId)

    // Verify suite exists and belongs to org
    const suite = await db.getSuiteById(suiteId)
    if (!suite) {
      return NextResponse.json({ error: "Suite not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const activeParam = searchParams.get("active")
    const criticalParam = searchParams.get("critical")
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    const isActive =
      activeParam === "true" ? true : activeParam === "false" ? false : undefined
    const isCritical =
      criticalParam === "true" ? true : criticalParam === "false" ? false : undefined

    const tests = await db.getSuiteTests({
      suiteId,
      isActive,
      isCritical,
      limit,
      offset,
    })

    return NextResponse.json({
      suite,
      tests,
      pagination: {
        limit,
        offset,
        count: tests.length,
      },
    })
  } catch (error) {
    console.error("[GET /api/suites/[id]/tests] Error:", error)
    return NextResponse.json({ error: "Failed to fetch suite tests" }, { status: 500 })
  }
}
