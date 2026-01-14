import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import { isValidSlug } from "@/lib/mock-utils"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/mocks/[id] - Get a specific mock interface with routes
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

    const db = getQueriesForOrg(context.organizationId)
    const mockInterface = await db.getMockInterfaceById(interfaceId)

    if (!mockInterface) {
      return NextResponse.json({ error: "Mock interface not found" }, { status: 404 })
    }

    // Get routes with rule counts
    const routes = await db.getMockRoutes(interfaceId)

    // Add public URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site"
    const interfaceWithUrl = {
      ...mockInterface,
      public_url: `${baseUrl}/api/mock/${context.organizationSlug}/${mockInterface.slug}/`,
      routes,
    }

    return NextResponse.json({ interface: interfaceWithUrl })
  } catch (error) {
    console.error("Error fetching mock interface:", error)
    return NextResponse.json({ error: "Failed to fetch mock interface" }, { status: 500 })
  }
}

/**
 * PUT /api/mocks/[id] - Update a mock interface
 */
export async function PUT(request: Request, { params }: RouteParams) {
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

    const body = await request.json()
    const { name, slug, description, is_active, rate_limit_rpm } = body

    // Validate slug if provided
    if (slug !== undefined && !isValidSlug(slug)) {
      return NextResponse.json(
        { error: "Slug must be lowercase alphanumeric with hyphens only (max 50 chars)" },
        { status: 400 }
      )
    }

    const db = getQueriesForOrg(context.organizationId)
    const updated = await db.updateMockInterface(interfaceId, {
      name,
      slug,
      description,
      is_active,
      rate_limit_rpm,
    })

    if (!updated) {
      return NextResponse.json({ error: "Mock interface not found" }, { status: 404 })
    }

    // Add public URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site"
    const interfaceWithUrl = {
      ...updated,
      public_url: `${baseUrl}/api/mock/${context.organizationSlug}/${updated.slug}/`,
    }

    return NextResponse.json({ interface: interfaceWithUrl })
  } catch (error) {
    console.error("Error updating mock interface:", error)
    return NextResponse.json({ error: "Failed to update mock interface" }, { status: 500 })
  }
}

/**
 * DELETE /api/mocks/[id] - Delete a mock interface
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
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

    const db = getQueriesForOrg(context.organizationId)
    const deleted = await db.deleteMockInterface(interfaceId)

    if (!deleted) {
      return NextResponse.json({ error: "Mock interface not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting mock interface:", error)
    return NextResponse.json({ error: "Failed to delete mock interface" }, { status: 500 })
  }
}
