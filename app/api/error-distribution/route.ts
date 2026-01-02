import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    // Get error distribution for last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const since = sevenDaysAgo.toISOString()

    const distribution = await db.getErrorTypeDistribution(since)

    return NextResponse.json({ distribution })
  } catch (error) {
    console.error("Error fetching error distribution:", error)
    return NextResponse.json(
      { error: "Failed to fetch error distribution" },
      { status: 500 }
    )
  }
}
