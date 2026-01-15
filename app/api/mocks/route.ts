import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, getMockInterfaceBySlug, checkMockTablesExist } from "@/lib/db"
import { isValidSlug, generateSlug } from "@/lib/mock-utils"

export const dynamic = "force-dynamic"

/**
 * GET /api/mocks - List all mock interfaces for the organization
 */
export async function GET() {
  try {
    // Check if mock tables exist first
    const tablesExist = await checkMockTablesExist()
    if (!tablesExist) {
      console.error("[/api/mocks] Mock tables do not exist. Run migration 020_add_mock_endpoints.sql")
      return NextResponse.json({
        error: "Mock API tables not initialized",
        code: "TABLES_NOT_INITIALIZED",
        message: "Please run migration scripts/020_add_mock_endpoints.sql",
      }, { status: 503 })
    }

    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)
    const interfaces = await db.getMockInterfaces()

    // Add public URL to each interface
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site"
    const interfacesWithUrls = interfaces.map((iface) => ({
      ...iface,
      public_url: `${baseUrl}/api/mock/${context.organizationSlug}/${iface.slug}/`,
    }))

    return NextResponse.json({ interfaces: interfacesWithUrls })
  } catch (error) {
    console.error("[/api/mocks GET] Error:", error instanceof Error ? error.message : error)
    return NextResponse.json({
      error: "Failed to fetch mock interfaces",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined,
    }, { status: 500 })
  }
}

/**
 * POST /api/mocks - Create a new mock interface
 */
export async function POST(request: Request) {
  try {
    // Check if mock tables exist first
    const tablesExist = await checkMockTablesExist()
    if (!tablesExist) {
      return NextResponse.json({
        error: "Mock API tables not initialized",
        code: "TABLES_NOT_INITIALIZED",
        message: "Please run migration scripts/020_add_mock_endpoints.sql",
      }, { status: 503 })
    }

    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug: providedSlug, description, rate_limit_rpm } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Generate or validate slug
    const slug = providedSlug || generateSlug(name)
    if (!isValidSlug(slug)) {
      return NextResponse.json(
        { error: "Slug must be lowercase alphanumeric with hyphens only (max 50 chars)" },
        { status: 400 }
      )
    }

    // Check if slug is already taken in this org
    const existing = await getMockInterfaceBySlug(context.organizationSlug, slug)
    if (existing) {
      return NextResponse.json(
        { error: "A mock interface with this slug already exists" },
        { status: 409 }
      )
    }

    const db = getQueriesForOrg(context.organizationId)
    const mockInterface = await db.createMockInterface(
      {
        name,
        slug,
        description,
        rate_limit_rpm: rate_limit_rpm || 100,
      },
      context.userId
    )

    // Add public URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site"
    const interfaceWithUrl = {
      ...mockInterface,
      public_url: `${baseUrl}/api/mock/${context.organizationSlug}/${mockInterface.slug}/`,
    }

    return NextResponse.json({ interface: interfaceWithUrl }, { status: 201 })
  } catch (error) {
    console.error("[/api/mocks POST] Error:", error instanceof Error ? error.message : error)
    return NextResponse.json({
      error: "Failed to create mock interface",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined,
    }, { status: 500 })
  }
}
