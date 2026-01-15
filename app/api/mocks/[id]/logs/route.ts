import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import type { MockRequestLogFilters } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/mocks/[id]/logs - Get request logs for an interface with optional filters
 *
 * Query params:
 * - path: Filter by path (partial match)
 * - method: Filter by HTTP method
 * - status: Status filter (2xx, 3xx, 4xx, 5xx, or specific code)
 * - matched: Filter by matched status (true/false)
 * - from: Start date (ISO string)
 * - to: End date (ISO string)
 * - limit: Number of results (default 100, max 1000)
 * - offset: Pagination offset
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    // Build filters
    const filters: MockRequestLogFilters = {}

    const path = searchParams.get("path")
    if (path) filters.path = path

    const method = searchParams.get("method")
    if (method) filters.method = method

    const status = searchParams.get("status")
    if (status) {
      // Support status groups (2xx, 3xx, 4xx, 5xx) or specific codes
      if (status === "2xx") {
        filters.statusMin = 200
        filters.statusMax = 299
      } else if (status === "3xx") {
        filters.statusMin = 300
        filters.statusMax = 399
      } else if (status === "4xx") {
        filters.statusMin = 400
        filters.statusMax = 499
      } else if (status === "5xx") {
        filters.statusMin = 500
        filters.statusMax = 599
      } else {
        const statusCode = parseInt(status, 10)
        if (!isNaN(statusCode)) {
          filters.statusMin = statusCode
          filters.statusMax = statusCode
        }
      }
    }

    const matched = searchParams.get("matched")
    if (matched !== null) {
      filters.matched = matched === "true"
    }

    const from = searchParams.get("from")
    if (from) {
      const fromDate = new Date(from)
      if (!isNaN(fromDate.getTime())) {
        filters.from = fromDate
      }
    }

    const to = searchParams.get("to")
    if (to) {
      const toDate = new Date(to)
      if (!isNaN(toDate.getTime())) {
        filters.to = toDate
      }
    }

    const limitParam = searchParams.get("limit")
    const limit = limitParam ? parseInt(limitParam, 10) : 100
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: "limit must be between 1 and 1000" },
        { status: 400 }
      )
    }
    filters.limit = limit

    const offsetParam = searchParams.get("offset")
    if (offsetParam) {
      const offset = parseInt(offsetParam, 10)
      if (!isNaN(offset) && offset >= 0) {
        filters.offset = offset
      }
    }

    // Verify interface belongs to org
    const db = getQueriesForOrg(context.organizationId)
    const mockInterface = await db.getMockInterfaceById(interfaceId)
    if (!mockInterface) {
      return NextResponse.json({ error: "Mock interface not found" }, { status: 404 })
    }

    // Get filtered logs with total count
    const { logs, total } = await db.getMockRequestLogsFiltered(interfaceId, filters)

    return NextResponse.json({
      logs,
      total,
      limit: filters.limit,
      offset: filters.offset || 0,
    })
  } catch (error) {
    console.error("Error fetching logs:", error)
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
  }
}

/**
 * GET /api/mocks/[id]/logs/stats - Get log statistics
 */
export async function POST(request: Request, { params }: RouteParams) {
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

    // Verify interface belongs to org
    const db = getQueriesForOrg(context.organizationId)
    const mockInterface = await db.getMockInterfaceById(interfaceId)
    if (!mockInterface) {
      return NextResponse.json({ error: "Mock interface not found" }, { status: 404 })
    }

    // Get stats
    const stats = await db.getMockLogStats(interfaceId)

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error fetching log stats:", error)
    return NextResponse.json({ error: "Failed to fetch log stats" }, { status: 500 })
  }
}
