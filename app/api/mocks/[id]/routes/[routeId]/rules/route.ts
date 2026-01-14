import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, getMockRouteById } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string; routeId: string }>
}

/**
 * GET /api/mocks/[id]/routes/[routeId]/rules - List all rules for a route
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, routeId } = await params
    const interfaceId = parseInt(id, 10)
    const routeIdNum = parseInt(routeId, 10)

    if (isNaN(interfaceId) || isNaN(routeIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    // Verify interface belongs to org
    const db = getQueriesForOrg(context.organizationId)
    const mockInterface = await db.getMockInterfaceById(interfaceId)
    if (!mockInterface) {
      return NextResponse.json({ error: "Mock interface not found" }, { status: 404 })
    }

    // Verify route belongs to interface
    const route = await getMockRouteById(routeIdNum)
    if (!route || route.interface_id !== interfaceId) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 })
    }

    const rules = await db.getMockResponseRules(routeIdNum)
    return NextResponse.json({ rules })
  } catch (error) {
    console.error("Error fetching rules:", error)
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 })
  }
}

/**
 * POST /api/mocks/[id]/routes/[routeId]/rules - Create a new response rule
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, routeId } = await params
    const interfaceId = parseInt(id, 10)
    const routeIdNum = parseInt(routeId, 10)

    if (isNaN(interfaceId) || isNaN(routeIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    // Verify interface belongs to org
    const db = getQueriesForOrg(context.organizationId)
    const mockInterface = await db.getMockInterfaceById(interfaceId)
    if (!mockInterface) {
      return NextResponse.json({ error: "Mock interface not found" }, { status: 404 })
    }

    // Verify route belongs to interface
    const route = await getMockRouteById(routeIdNum)
    if (!route || route.interface_id !== interfaceId) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      match_headers,
      match_query,
      match_body,
      match_body_contains,
      response_status,
      response_headers,
      response_body,
      response_delay_ms,
      priority,
    } = body

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    if (response_status === undefined) {
      return NextResponse.json({ error: "response_status is required" }, { status: 400 })
    }

    if (response_status < 100 || response_status > 599) {
      return NextResponse.json(
        { error: "response_status must be between 100 and 599" },
        { status: 400 }
      )
    }

    if (response_delay_ms !== undefined && (response_delay_ms < 0 || response_delay_ms > 30000)) {
      return NextResponse.json(
        { error: "response_delay_ms must be between 0 and 30000" },
        { status: 400 }
      )
    }

    // Validate response body size (100KB limit)
    if (response_body && response_body.length > 100000) {
      return NextResponse.json(
        { error: "response_body must be less than 100KB" },
        { status: 400 }
      )
    }

    const rule = await db.createMockResponseRule(routeIdNum, {
      name,
      match_headers,
      match_query,
      match_body,
      match_body_contains,
      response_status,
      response_headers,
      response_body,
      response_delay_ms,
      priority,
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error("Error creating rule:", error)
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 })
  }
}
