import { NextRequest, NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, getLatestExecutionId } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "10")
    const minRuns = parseInt(searchParams.get("minRuns") || "5")
    const since = searchParams.get("since") || undefined
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined
    const includeResolved = searchParams.get("include_resolved") === "true"
    const lastRunOnly = searchParams.get("lastRunOnly") === "true"

    // When lastRunOnly is true with branch/suite filter, get the execution ID first
    let executionId: number | undefined
    if (lastRunOnly && (branch || suite)) {
      const latestId = await getLatestExecutionId(context.organizationId, branch, suite)
      executionId = latestId ?? undefined
      // If no execution found, return empty results
      if (!latestId) {
        return NextResponse.json({
          summary: {
            total_flaky_tests: 0,
            avg_flakiness_rate: 0,
            most_flaky_tests: [],
          },
          tests: [],
        })
      }
    }

    const [summary, flakiestTests] = await Promise.all([
      db.getFlakinessSummary({ branch, suite, since, lastRunOnly }),
      db.getFlakiestTests({
        limit,
        minRuns,
        since,
        branch,
        suite,
        includeResolved,
        executionId, // Pass executionId when in lastRunOnly mode
      }),
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
