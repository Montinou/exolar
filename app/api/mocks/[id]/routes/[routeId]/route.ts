import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, getMockRouteById } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string; routeId: string }>
}

/**
 * GET /api/mocks/[id]/routes/[routeId] - Get a specific route with rules
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

    // Get route
    const route = await getMockRouteById(routeIdNum)
    if (!route || route.interface_id !== interfaceId) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 })
    }

    // Get rules
    const rules = await db.getMockResponseRules(routeIdNum)

    return NextResponse.json({ route: { ...route, rules } })
  } catch (error) {
    console.error("Error fetching route:", error)
    return NextResponse.json({ error: "Failed to fetch route" }, { status: 500 })
  }
}

/**
 * PUT /api/mocks/[id]/routes/[routeId] - Update a route
 */
export async function PUT(request: Request, { params }: RouteParams) {
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
    const existingRoute = await getMockRouteById(routeIdNum)
    if (!existingRoute || existingRoute.interface_id !== interfaceId) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 })
    }

    const body = await request.json()
    const { path_pattern, method, description, is_active, priority } = body

    if (path_pattern !== undefined && !path_pattern.startsWith("/")) {
      return NextResponse.json({ error: "path_pattern must start with /" }, { status: 400 })
    }

    const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "*"]
    if (method !== undefined && !validMethods.includes(method)) {
      return NextResponse.json(
        { error: `method must be one of: ${validMethods.join(", ")}` },
        { status: 400 }
      )
    }

    const updated = await db.updateMockRoute(routeIdNum, {
      path_pattern,
      method,
      description,
      is_active,
      priority,
    })

    if (!updated) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 })
    }

    return NextResponse.json({ route: updated })
  } catch (error) {
    console.error("Error updating route:", error)
    return NextResponse.json({ error: "Failed to update route" }, { status: 500 })
  }
}

/**
 * DELETE /api/mocks/[id]/routes/[routeId] - Delete a route
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
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
    const existingRoute = await getMockRouteById(routeIdNum)
    if (!existingRoute || existingRoute.interface_id !== interfaceId) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 })
    }

    const deleted = await db.deleteMockRoute(routeIdNum)
    if (!deleted) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting route:", error)
    return NextResponse.json({ error: "Failed to delete route" }, { status: 500 })
  }
}
