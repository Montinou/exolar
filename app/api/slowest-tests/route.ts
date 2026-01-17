import { NextRequest, NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "5")
    const minRuns = parseInt(searchParams.get("minRuns") || "3")

    // Date range filters (default: 15 days handled in db function)
    const from = searchParams.get("from") || undefined
    const to = searchParams.get("to") || undefined

    // Optional branch/suite filters
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined

    const tests = await db.getSlowestTests({
      limit,
      minRuns,
      from,
      to,
      branch,
      suite,
    })

    return NextResponse.json({
      tests,
      filters: {
        from: from || "default (15 days)",
        to: to || "now",
        branch: branch || "all",
        suite: suite || "all",
      },
    })
  } catch (error) {
    console.error("Error fetching slowest tests:", error)
    return NextResponse.json(
      { error: "Failed to fetch slowest tests" },
      { status: 500 }
    )
  }
}
