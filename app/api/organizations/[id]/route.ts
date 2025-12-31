import { NextResponse } from "next/server"
import { getSessionContext, requireOrgAdmin, requireSystemAdmin } from "@/lib/session-context"
import { getOrganizationById, updateOrganization, deleteOrganization } from "@/lib/db-orgs"

export const dynamic = "force-dynamic"

/**
 * GET /api/organizations/[id] - Get single organization
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const orgId = parseInt(id)

    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
    }

    // Verify user belongs to this org
    if (context.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const org = await getOrganizationById(orgId)
    if (!org) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ organization: org })
  } catch (error) {
    console.error("Error fetching organization:", error)
    return NextResponse.json({ error: "Failed to fetch organization" }, { status: 500 })
  }
}

/**
 * PATCH /api/organizations/[id] - Update organization (org admin only)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireOrgAdmin()

    const { id } = await params
    const orgId = parseInt(id)

    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
    }

    if (context.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updates = await request.json()
    const org = await updateOrganization(orgId, updates)

    if (!org) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ organization: org })
  } catch (error) {
    if (error instanceof Error && error.message === "Organization admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error updating organization:", error)
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }
}

/**
 * DELETE /api/organizations/[id] - Delete organization (system admin only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSystemAdmin()

    const { id } = await params
    const orgId = parseInt(id)

    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
    }

    const deleted = await deleteOrganization(orgId)
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "System admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error deleting organization:", error)
    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 })
  }
}
