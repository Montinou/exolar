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
    const threshold = searchParams.get("threshold") ? Number(searchParams.get("threshold")) : undefined
    const hours = searchParams.get("hours") ? Number(searchParams.get("hours")) : undefined
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined
    const sortBy = (searchParams.get("sort_by") as "regression" | "duration" | "name") || undefined

    const db = getQueriesForOrg(context.organizationId)
    const summary = await db.getPerformanceRegressions({
      threshold,
      hours,
      branch,
      suite,
      limit,
      sortBy,
    })

    return NextResponse.json(summary)
  } catch (error) {
    console.error("[API] Error fetching performance regressions:", error)
    return NextResponse.json(
      { error: "Failed to fetch performance regressions" },
      { status: 500 }
    )
  }
}
