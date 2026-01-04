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
    const from = searchParams.get("from") || undefined
    const to = searchParams.get("to") || undefined
    const branch = searchParams.get("branch") || undefined
    const suite = searchParams.get("suite") || undefined

    const db = getQueriesForOrg(context.organizationId)
    const score = await db.getReliabilityScore({ from, to, branch, suite })

    return NextResponse.json(score)
  } catch (error) {
    console.error("[v0] Error fetching reliability score:", error)
    return NextResponse.json(
      { error: "Failed to fetch reliability score" },
      { status: 500 }
    )
  }
}
