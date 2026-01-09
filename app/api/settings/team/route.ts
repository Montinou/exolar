import { NextResponse } from "next/server"
import { requireOrgAdmin } from "@/lib/session-context"
import {
  getOrganizationMembers,
  getOrgInvites,
  addOrganizationMember,
  createOrgInvite,
  updateMemberRole,
  removeMember,
  getOrganizationById,
  getUserByEmail,
} from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/settings/team - Get current org members and invites
 * Uses session context to determine organization (no org ID needed in URL)
 */
export async function GET() {
  try {
    const context = await requireOrgAdmin()

    const [organization, members, invites] = await Promise.all([
      getOrganizationById(context.organizationId),
      getOrganizationMembers(context.organizationId),
      getOrgInvites(context.organizationId),
    ])

    return NextResponse.json({
      organization,
      members,
      invites,
      currentUserId: context.userId,
      currentUserRole: context.orgRole,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Organization admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error fetching team data:", error)
    return NextResponse.json({ error: "Failed to fetch team data" }, { status: 500 })
  }
}

/**
 * POST /api/settings/team - Add member or send invite
 */
export async function POST(request: Request) {
  try {
    const context = await requireOrgAdmin()
    const { email, role = "viewer" } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    if (!["admin", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be 'admin' or 'viewer'" }, { status: 400 })
    }

    const existingUser = await getUserByEmail(email)

    if (existingUser) {
      const member = await addOrganizationMember(context.organizationId, existingUser.id, role)
      return NextResponse.json({ member, status: "added" }, { status: 201 })
    } else {
      const invite = await createOrgInvite(context.organizationId, email, role, context.userId)
      return NextResponse.json({ invite, status: "invited" }, { status: 201 })
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Organization admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error adding team member:", error)
    return NextResponse.json({ error: "Failed to add team member" }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/team - Update member role
 */
export async function PATCH(request: Request) {
  try {
    const context = await requireOrgAdmin()
    const { userId, role } = await request.json()

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role required" }, { status: 400 })
    }

    if (!["admin", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be 'admin' or 'viewer'" }, { status: 400 })
    }

    // Prevent changing own role
    if (userId === context.userId) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 })
    }

    // Get current member to check if they're owner
    const members = await getOrganizationMembers(context.organizationId)
    const targetMember = members.find(m => m.user_id === userId)

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 })
    }

    const updated = await updateMemberRole(context.organizationId, userId, role)
    return NextResponse.json({ member: updated })
  } catch (error) {
    if (error instanceof Error && error.message === "Organization admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error updating member role:", error)
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/team - Remove member from organization
 */
export async function DELETE(request: Request) {
  try {
    const context = await requireOrgAdmin()
    const { searchParams } = new URL(request.url)
    const userId = parseInt(searchParams.get("userId") || "")

    if (isNaN(userId)) {
      return NextResponse.json({ error: "Valid userId required" }, { status: 400 })
    }

    // Prevent self-removal
    if (userId === context.userId) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 })
    }

    // Get current member to check if they're owner
    const members = await getOrganizationMembers(context.organizationId)
    const targetMember = members.find(m => m.user_id === userId)

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot remove organization owner" }, { status: 400 })
    }

    await removeMember(context.organizationId, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Organization admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}
