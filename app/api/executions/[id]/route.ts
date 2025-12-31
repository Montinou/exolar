import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const { id } = await params
    const executionId = Number(id)

    if (isNaN(executionId)) {
      return NextResponse.json({ error: "Invalid execution ID" }, { status: 400 })
    }

    const [execution, testResults] = await Promise.all([
      db.getExecutionById(executionId),
      db.getTestResultsByExecutionId(executionId),
    ])

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 })
    }

    return NextResponse.json({ execution, testResults })
  } catch (error) {
    console.error("[v0] Error fetching execution details:", error)
    return NextResponse.json({ error: "Failed to fetch execution details" }, { status: 500 })
  }
}
