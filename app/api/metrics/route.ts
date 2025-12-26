import { NextResponse } from "next/server"
import { getDashboardMetrics, type DateRangeFilter } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("from") || undefined
    const toDate = searchParams.get("to") || undefined

    const dateRange: DateRangeFilter | undefined =
      fromDate || toDate ? { from: fromDate, to: toDate } : undefined

    const metrics = await getDashboardMetrics(dateRange)
    return NextResponse.json(metrics)
  } catch (error) {
    console.error("[v0] Error fetching metrics:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
