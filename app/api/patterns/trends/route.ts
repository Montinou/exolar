import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getPatternTrends } from "@/lib/db/patterns"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30", 10)

    const trends = await getPatternTrends(context.organizationId, days)

    return NextResponse.json({ trends })
  } catch (error) {
    console.error("Failed to fetch pattern trends:", error)
    return NextResponse.json(
      { error: "Failed to fetch pattern trends" },
      { status: 500 }
    )
  }
}
