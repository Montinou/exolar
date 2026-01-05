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

    // Parse optional query parameters
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 10
    const groupBy = searchParams.get("group_by") as "error_type" | "file" | "branch" | undefined

    // Default to last 7 days if no 'since' provided
    const sinceParam = searchParams.get("since")
    const since = sinceParam || (() => {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return sevenDaysAgo.toISOString()
    })()

    const distribution = await db.getErrorTypeDistribution({
      since,
      branch,
      suite,
      limit,
      groupBy: groupBy || "error_type",
    })

    return NextResponse.json({ 
      distribution,
      filters: {
        since,
        branch: branch || "all",
        suite: suite || "all",
        limit,
        groupBy: groupBy || "error_type",
      }
    })
  } catch (error) {
    console.error("Error fetching error distribution:", error)
    return NextResponse.json(
      { error: "Failed to fetch error distribution" },
      { status: 500 }
    )
  }
}
