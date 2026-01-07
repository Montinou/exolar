import { NextResponse } from "next/server"
import { authServer } from "@/lib/auth/server"
import { isAdmin, getAllUsers, updateUserRole, deleteUser, getUserByEmail } from "@/lib/db"

/**
 * GET /api/admin/users - List all users
 * Requires admin role
 */
export async function GET() {
  try {
    const { data } = await authServer.getSession()
    if (!data?.session || !data?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminCheck = await isAdmin(data.user.email)
    if (!adminCheck) {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const users = await getAllUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error("[admin/users] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/users - Update user role
 * Requires admin role
 * Body: { userId: number, role: "admin" | "viewer" }
 */
export async function PATCH(request: Request) {
  try {
    const { data } = await authServer.getSession()
    if (!data?.session || !data?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await getUserByEmail(data.user.email)
    if (!adminUser || adminUser.role !== "admin") {
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
    if (userId === adminUser.id) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 })
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
 * Requires admin role
 * Body: { userId: number }
 */
export async function DELETE(request: Request) {
  try {
    const { data } = await authServer.getSession()
    if (!data?.session || !data?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await getUserByEmail(data.user.email)
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Prevent admin from deleting themselves
    if (userId === adminUser.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
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
