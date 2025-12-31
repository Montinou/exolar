import { NextRequest, NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ signature: string }> }
) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const { signature } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)

    const [history, statistics] = await Promise.all([
      db.getTestHistory(signature, limit),
      db.getTestStatistics(signature),
    ])

    if (history.length === 0) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 })
    }

    return NextResponse.json({
      test_signature: signature,
      test_name: history[0].test_name,
      test_file: history[0].test_file,
      statistics,
      history,
    })
  } catch (error) {
    console.error("Test history error:", error)
    return NextResponse.json({ error: "Failed to fetch test history" }, { status: 500 })
  }
}
