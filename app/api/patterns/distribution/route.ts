import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getCategoryDistribution } from "@/lib/db/patterns"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from") || undefined
    const to = searchParams.get("to") || undefined
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined
    const daysParam = searchParams.get("days")

    // If no explicit date range is provided but a legacy `days` param is, use it as a lookback
    const options =
      !from && !to && daysParam
        ? parseInt(daysParam, 10)
        : { from, to, branch, suite }

    const { totalFailures, categories } = await getCategoryDistribution(
      context.organizationId,
      options
    )

    return NextResponse.json({
      totalFailures,
      categories,
    })
  } catch (error) {
    console.error("Failed to fetch category distribution:", error)
    return NextResponse.json(
      { error: "Failed to fetch category distribution" },
      { status: 500 }
    )
  }
}
