import { NextResponse } from "next/server"
import { getTrendData, getFailureTrendData, type DateRangeFilter } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Number(searchParams.get("days")) || 7
    const fromDate = searchParams.get("from") || undefined
    const toDate = searchParams.get("to") || undefined
    const type = searchParams.get("type") || "tests"

    const dateRange: DateRangeFilter | undefined =
      fromDate || toDate ? { from: fromDate, to: toDate } : undefined

    if (type === "failures") {
      const failureTrends = await getFailureTrendData(days, dateRange)
      return NextResponse.json(failureTrends)
    }

    const trends = await getTrendData(days, dateRange)
    return NextResponse.json(trends)
  } catch (error) {
    console.error("[v0] Error fetching trends:", error)
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 })
  }
}
