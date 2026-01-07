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
    const limit = parseInt(searchParams.get("limit") || "10")
    const minRuns = parseInt(searchParams.get("minRuns") || "5")
    const since = searchParams.get("since") || undefined
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined
    const includeResolved = searchParams.get("include_resolved") === "true"

    const [summary, flakiestTests] = await Promise.all([
      db.getFlakinessSummary({ branch, suite, since }),
      db.getFlakiestTests({
        limit,
        minRuns,
        since,
        branch,
        suite,
        includeResolved
      }),
    ])

    return NextResponse.json({
      summary,
      tests: flakiestTests,
    })
  } catch (error) {
    console.error("Error fetching flakiness data:", error)
    return NextResponse.json(
      { error: "Failed to fetch flakiness data" },
      { status: 500 }
    )
  }
}
