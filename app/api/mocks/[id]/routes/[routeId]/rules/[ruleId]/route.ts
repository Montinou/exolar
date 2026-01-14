import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, getMockRouteById, getMockResponseRuleById } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string; routeId: string; ruleId: string }>
}

/**
 * GET /api/mocks/[id]/routes/[routeId]/rules/[ruleId] - Get a specific rule
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, routeId, ruleId } = await params
    const interfaceId = parseInt(id, 10)
    const routeIdNum = parseInt(routeId, 10)
    const ruleIdNum = parseInt(ruleId, 10)

    if (isNaN(interfaceId) || isNaN(routeIdNum) || isNaN(ruleIdNum)) {
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

    // Get rule
    const rule = await getMockResponseRuleById(ruleIdNum)
    if (!rule || rule.route_id !== routeIdNum) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error("Error fetching rule:", error)
    return NextResponse.json({ error: "Failed to fetch rule" }, { status: 500 })
  }
}

/**
 * PUT /api/mocks/[id]/routes/[routeId]/rules/[ruleId] - Update a rule
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, routeId, ruleId } = await params
    const interfaceId = parseInt(id, 10)
    const routeIdNum = parseInt(routeId, 10)
    const ruleIdNum = parseInt(ruleId, 10)

    if (isNaN(interfaceId) || isNaN(routeIdNum) || isNaN(ruleIdNum)) {
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

    // Verify rule belongs to route
    const existingRule = await getMockResponseRuleById(ruleIdNum)
    if (!existingRule || existingRule.route_id !== routeIdNum) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
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
      is_active,
      priority,
    } = body

    // Validate response status if provided
    if (response_status !== undefined && (response_status < 100 || response_status > 599)) {
      return NextResponse.json(
        { error: "response_status must be between 100 and 599" },
        { status: 400 }
      )
    }

    // Validate delay if provided
    if (response_delay_ms !== undefined && (response_delay_ms < 0 || response_delay_ms > 30000)) {
      return NextResponse.json(
        { error: "response_delay_ms must be between 0 and 30000" },
        { status: 400 }
      )
    }

    // Validate response body size
    if (response_body !== undefined && response_body !== null && response_body.length > 100000) {
      return NextResponse.json(
        { error: "response_body must be less than 100KB" },
        { status: 400 }
      )
    }

    const updated = await db.updateMockResponseRule(ruleIdNum, {
      name,
      match_headers,
      match_query,
      match_body,
      match_body_contains,
      response_status,
      response_headers,
      response_body,
      response_delay_ms,
      is_active,
      priority,
    })

    if (!updated) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    return NextResponse.json({ rule: updated })
  } catch (error) {
    console.error("Error updating rule:", error)
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 })
  }
}

/**
 * DELETE /api/mocks/[id]/routes/[routeId]/rules/[ruleId] - Delete a rule
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, routeId, ruleId } = await params
    const interfaceId = parseInt(id, 10)
    const routeIdNum = parseInt(routeId, 10)
    const ruleIdNum = parseInt(ruleId, 10)

    if (isNaN(interfaceId) || isNaN(routeIdNum) || isNaN(ruleIdNum)) {
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

    // Verify rule belongs to route
    const existingRule = await getMockResponseRuleById(ruleIdNum)
    if (!existingRule || existingRule.route_id !== routeIdNum) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    const deleted = await db.deleteMockResponseRule(ruleIdNum)
    if (!deleted) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting rule:", error)
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 })
  }
}
