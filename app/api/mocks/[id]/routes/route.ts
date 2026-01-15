import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import { isValidJsonSchema } from "@/lib/mock-schema-validator"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/mocks/[id]/routes - List all routes for an interface
 */
export async function GET(_request: Request, { params }: RouteParams) {
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

    const routes = await db.getMockRoutes(interfaceId)
    return NextResponse.json({ routes })
  } catch (error) {
    console.error("Error fetching routes:", error)
    return NextResponse.json({ error: "Failed to fetch routes" }, { status: 500 })
  }
}

/**
 * POST /api/mocks/[id]/routes - Create a new route
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

    const body = await request.json()
    const { path_pattern, method, description, priority, request_schema, response_schema, validate_request } = body

    if (!path_pattern) {
      return NextResponse.json({ error: "path_pattern is required" }, { status: 400 })
    }

    if (!path_pattern.startsWith("/")) {
      return NextResponse.json({ error: "path_pattern must start with /" }, { status: 400 })
    }

    const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "*"]
    if (method && !validMethods.includes(method)) {
      return NextResponse.json(
        { error: `method must be one of: ${validMethods.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate JSON schemas if provided
    if (request_schema && !isValidJsonSchema(request_schema)) {
      return NextResponse.json({ error: "Invalid request_schema: not a valid JSON Schema" }, { status: 400 })
    }
    if (response_schema && !isValidJsonSchema(response_schema)) {
      return NextResponse.json({ error: "Invalid response_schema: not a valid JSON Schema" }, { status: 400 })
    }

    const route = await db.createMockRoute(interfaceId, {
      path_pattern,
      method: method || "GET",
      description,
      priority,
      request_schema,
      response_schema,
      validate_request,
    })

    return NextResponse.json({ route }, { status: 201 })
  } catch (error) {
    console.error("Error creating route:", error)
    return NextResponse.json({ error: "Failed to create route" }, { status: 500 })
  }
}
