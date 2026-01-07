import { NextResponse } from "next/server"
import { requireOrgAdmin } from "@/lib/session-context"
import {
  getOrganizationMembers,
  addOrganizationMember,
  createOrgInvite,
  getOrgInvites,
  getUserByEmail,
} from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/organizations/[id]/members - List organization members
 */
export async function GET(
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

    const [members, invites] = await Promise.all([
      getOrganizationMembers(orgId),
      getOrgInvites(orgId),
    ])

    return NextResponse.json({ members, invites })
  } catch (error) {
    if (error instanceof Error && error.message === "Organization admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error fetching members:", error)
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
  }
}

/**
 * POST /api/organizations/[id]/members - Add member or send invite
 */
export async function POST(
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

    const { email, role = "viewer" } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    // Validate role
    if (!["admin", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Check if user already exists in system
    const existingUser = await getUserByEmail(email)

    if (existingUser) {
      // Add existing user to org
      const member = await addOrganizationMember(orgId, existingUser.id, role)
      return NextResponse.json({ member, status: "added" }, { status: 201 })
    } else {
      // Create invite for new user
      const invite = await createOrgInvite(orgId, email, role, context.userId)
      return NextResponse.json({ invite, status: "invited" }, { status: 201 })
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Organization admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error adding member:", error)
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
  }
}
