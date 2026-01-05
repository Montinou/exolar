import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, type DateRangeFilter } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined
    const limit = Number(searchParams.get("limit")) || 50
    const fromDate = searchParams.get("from") || undefined
    const toDate = searchParams.get("to") || undefined

    const dateRange: DateRangeFilter | undefined =
      fromDate || toDate ? { from: fromDate, to: toDate } : undefined

    const [executions, branchStats, suiteStats] = await Promise.all([
      db.getExecutions(limit, 0, status, branch, dateRange, suite),
      db.getBranches(),
      db.getSuites(),
    ])

    // Extract names for dropdown filters (backwards compatible)
    const branches = branchStats.map((b) => b.branch)
    const suites = suiteStats.map((s) => s.suite)

    return NextResponse.json({ executions, branches, suites })
  } catch (error) {
    console.error("[v0] Error fetching executions:", error)
    return NextResponse.json({ error: "Failed to fetch executions" }, { status: 500 })
  }
}
