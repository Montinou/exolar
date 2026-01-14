import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/mocks/[id]/logs - Get request logs for an interface
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const interfaceId = parseInt(id, 10)
    if (isNaN(interfaceId)) {
      return NextResponse.json({ error: "Invalid interface ID" }, { status: 400 })
    }

    // Parse limit from query string
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get("limit")
    const limit = limitParam ? parseInt(limitParam, 10) : 100

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: "limit must be between 1 and 1000" },
        { status: 400 }
      )
    }

    // Verify interface belongs to org
    const db = getQueriesForOrg(context.organizationId)
    const mockInterface = await db.getMockInterfaceById(interfaceId)
    if (!mockInterface) {
      return NextResponse.json({ error: "Mock interface not found" }, { status: 404 })
    }

    const logs = await db.getMockRequestLogs(interfaceId, limit)
    return NextResponse.json({ logs })
  } catch (error) {
    console.error("Error fetching logs:", error)
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
  }
}
