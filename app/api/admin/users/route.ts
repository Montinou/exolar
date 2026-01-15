import { NextResponse } from "next/server"
import { getSessionContext, isSuperadmin } from "@/lib/session-context"
import {
  getAllUsers,
  getUsersForOrg,
  updateUserRole,
  deleteUser,
  getUserByEmail,
} from "@/lib/db"

/**
 * GET /api/admin/users - List users
 * - Superadmin: sees all users across all organizations
 * - Regular admin: sees only users in their organization
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can list users
    if (context.userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    let users
    if (isSuperadmin(context)) {
      // Superadmin sees all users
      users = await getAllUsers()
    } else {
      // Regular admin sees only their org's users
      users = await getUsersForOrg(context.organizationId)
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error("[admin/users] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/users - Update user role
 * - Superadmin: can update any user's role
 * - Regular admin: can only update users in their organization
 * Body: { userId: number, role: "admin" | "viewer" }
 */
export async function PATCH(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (context.userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json({ error: "User ID and role are required" }, { status: 400 })
    }

    if (role !== "admin" && role !== "viewer") {
      return NextResponse.json({ error: "Role must be 'admin' or 'viewer'" }, { status: 400 })
    }

    // Prevent admin from changing their own role
    if (userId === context.userId) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 })
    }

    // If not superadmin, verify user belongs to admin's organization
    if (!isSuperadmin(context)) {
      const orgUsers = await getUsersForOrg(context.organizationId)
      const userInOrg = orgUsers.some((u) => u.id === userId)
      if (!userInOrg) {
        return NextResponse.json(
          { error: "Cannot modify users outside your organization" },
          { status: 403 }
        )
      }
    }

    const updatedUser = await updateUserRole(userId, role)
    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error("[admin/users] PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users - Delete a user
 * - Superadmin: can delete any user
 * - Regular admin: can only delete users in their organization
 * Body: { userId: number }
 */
export async function DELETE(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (context.userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Prevent admin from deleting themselves
    if (userId === context.userId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    // If not superadmin, verify user belongs to admin's organization
    if (!isSuperadmin(context)) {
      const orgUsers = await getUsersForOrg(context.organizationId)
      const userInOrg = orgUsers.some((u) => u.id === userId)
      if (!userInOrg) {
        return NextResponse.json(
          { error: "Cannot delete users outside your organization" },
          { status: 403 }
        )
      }
    }

    const deleted = await deleteUser(userId)
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/users] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
