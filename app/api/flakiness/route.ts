import { getFlakinessSummary, getFlakiestTests } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "10")
    const minRuns = parseInt(searchParams.get("minRuns") || "5")

    const [summary, flakiestTests] = await Promise.all([
      getFlakinessSummary(),
      getFlakiestTests(limit, minRuns),
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
