import { NextResponse } from "next/server"
import { requireOrgAdmin } from "@/lib/session-context"
import { updateMemberRole, removeMember } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/organizations/[id]/members/[userId] - Update member role
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const context = await requireOrgAdmin()

    const { id, userId } = await params
    const orgId = parseInt(id)
    const memberUserId = parseInt(userId)

    if (isNaN(orgId) || isNaN(memberUserId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    if (context.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Prevent changing own role
    if (context.userId === memberUserId) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 })
    }

    const { role } = await request.json()

    if (!["owner", "admin", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const member = await updateMemberRole(orgId, memberUserId, role)
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    return NextResponse.json({ member })
  } catch (error) {
    if (error instanceof Error && error.message === "Organization admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }
}

/**
 * DELETE /api/organizations/[id]/members/[userId] - Remove member
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const context = await requireOrgAdmin()

    const { id, userId } = await params
    const orgId = parseInt(id)
    const memberUserId = parseInt(userId)

    if (isNaN(orgId) || isNaN(memberUserId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    if (context.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Prevent removing self
    if (context.userId === memberUserId) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 })
    }

    const removed = await removeMember(orgId, memberUserId)
    if (!removed) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Organization admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}
