import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, type TrendPeriod } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const { searchParams } = new URL(request.url)
    const days = Number(searchParams.get("days")) || 15  // Default to 15 days for consistency
    const fromDate = searchParams.get("from") || undefined
    const toDate = searchParams.get("to") || undefined
    const type = searchParams.get("type") || "tests"
    const period = (searchParams.get("period") as TrendPeriod) || "day"

    if (type === "failures") {
      const failureTrends = await db.getFailureTrendData(days, { from: fromDate, to: toDate })
      return NextResponse.json(failureTrends)
    }

    const trends = await db.getTrendData({
      period,
      days,
      from: fromDate,
      to: toDate,
    })
    return NextResponse.json(trends)
  } catch (error) {
    console.error("[v0] Error fetching trends:", error)
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 })
  }
}
