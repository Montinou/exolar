import { NextResponse } from "next/server"
import { getSessionContext, requireSystemAdmin } from "@/lib/session-context"
import { getUserOrganizations, createOrganization, getOrganizationBySlug } from "@/lib/db-orgs"

export const dynamic = "force-dynamic"

/**
 * GET /api/organizations - List user's organizations
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizations = await getUserOrganizations(context.userId)
    return NextResponse.json({ organizations })
  } catch (error) {
    console.error("Error fetching organizations:", error)
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 })
  }
}

/**
 * POST /api/organizations - Create new organization (system admin only)
 */
export async function POST(request: Request) {
  try {
    const context = await requireSystemAdmin()

    const { name, slug } = await request.json()

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      )
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must be lowercase alphanumeric with hyphens only" },
        { status: 400 }
      )
    }

    // Check if slug is already taken
    const existing = await getOrganizationBySlug(slug)
    if (existing) {
      return NextResponse.json(
        { error: "An organization with this slug already exists" },
        { status: 409 }
      )
    }

    const org = await createOrganization(name, slug, context.userId)
    return NextResponse.json({ organization: org }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "System admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error creating organization:", error)
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
  }
}
