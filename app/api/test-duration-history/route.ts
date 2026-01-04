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
    const signature = searchParams.get("signature")
    const days = Number(searchParams.get("days")) || 7

    if (!signature) {
      return NextResponse.json(
        { error: "Missing required parameter: signature" },
        { status: 400 }
      )
    }

    const db = getQueriesForOrg(context.organizationId)
    const history = await db.getTestDurationHistory(signature, days)

    return NextResponse.json({ history })
  } catch (error) {
    console.error("[API] Error fetching duration history:", error)
    return NextResponse.json(
      { error: "Failed to fetch duration history" },
      { status: 500 }
    )
  }
}
