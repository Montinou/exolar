import { NextResponse } from "next/server"
import { getExecutions, getBranches, getSuites, type DateRangeFilter } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined
    const limit = Number(searchParams.get("limit")) || 50
    const fromDate = searchParams.get("from") || undefined
    const toDate = searchParams.get("to") || undefined

    const dateRange: DateRangeFilter | undefined =
      fromDate || toDate ? { from: fromDate, to: toDate } : undefined

    const [executions, branches, suites] = await Promise.all([
      getExecutions(limit, status, branch, dateRange, suite),
      getBranches(),
      getSuites(),
    ])

    return NextResponse.json({ executions, branches, suites })
  } catch (error) {
    console.error("[v0] Error fetching executions:", error)
    return NextResponse.json({ error: "Failed to fetch executions" }, { status: 500 })
  }
}
