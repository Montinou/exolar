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

    // Date range filters (default: 15 days handled in db function)
    const from = searchParams.get("from") || undefined
    const to = searchParams.get("to") || undefined

    // Optional branch filter
    const branch = searchParams.get("branch") || undefined

    const suites = await db.getSuitePassRates({ from, to, branch })

    return NextResponse.json({
      suites,
      filters: {
        from: from || "default (15 days)",
        to: to || "now",
        branch: branch || "all",
      },
    })
  } catch (error) {
    console.error("Error fetching suite pass rates:", error)
    return NextResponse.json(
      { error: "Failed to fetch suite pass rates" },
      { status: 500 }
    )
  }
}
