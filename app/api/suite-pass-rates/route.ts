import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const suites = await db.getSuitePassRates()

    return NextResponse.json({ suites })
  } catch (error) {
    console.error("Error fetching suite pass rates:", error)
    return NextResponse.json(
      { error: "Failed to fetch suite pass rates" },
      { status: 500 }
    )
  }
}
