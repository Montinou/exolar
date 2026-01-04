import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const threshold = Number(searchParams.get("threshold")) || 0.2
    const hours = Number(searchParams.get("hours")) || 24

    const db = getQueriesForOrg(context.organizationId)
    const summary = await db.getPerformanceRegressions(threshold, hours)

    return NextResponse.json(summary)
  } catch (error) {
    console.error("[API] Error fetching performance regressions:", error)
    return NextResponse.json(
      { error: "Failed to fetch performance regressions" },
      { status: 500 }
    )
  }
}
