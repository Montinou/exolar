import { NextResponse } from "next/server"
import { authServer } from "@/lib/auth/server"
import {
  isAdmin,
  getAllInvites,
  createInvite,
  deleteInvite,
  getUserByEmail,
  createUser,
  addOrganizationMember,
} from "@/lib/db"
import { sendInviteEmail } from "@/lib/email/resend"
import { generateSecurePassword } from "@/lib/utils"

/**
 * GET /api/admin/invites - List all invites
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

    const invites = await getAllInvites()
    return NextResponse.json({ invites })
  } catch (error) {
    console.error("[admin/invites] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/invites - Create a new invite
 * Requires admin role
 * Body: { email: string, role: "admin" | "viewer" }
 */
export async function POST(request: Request) {
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
    const { email, role, organizationId, password: providedPassword, template = "attorneyshare" } = body

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 })
    }

    if (role !== "admin" && role !== "viewer") {
      return NextResponse.json({ error: "Role must be 'admin' or 'viewer'" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 })
    }

    // Generate password if not provided
    const password = providedPassword || generateSecurePassword(16)

    try {
      // Create user in Auth provider
      const name = email.split("@")[0]
      await authServer.api.signUpEmail({
        body: {
          email,
          password,
          name,
        },
      })

      // Create user in Dashboard DB
      // Use organizationId if provided, otherwise default (null or 1 handled by createUser logic if we pass it)
      // createUser signature: (email, role, invitedBy, defaultOrgId)
      const user = await createUser(email, role, adminUser.id, organizationId)

      // Add to Organization if provided
      if (organizationId) {
        await addOrganizationMember(organizationId, user.id, role)
      }

      // Send invite email with credentials (non-blocking - don't fail if email fails)
      try {
        const emailResult = await sendInviteEmail({
          email,
          password,
          role,
          name,
          template: template as "attorneyshare" | "exolar",
        })

        if (emailResult.success) {
          console.log(`[Invites] Email sent successfully to ${email}:`, emailResult.emailId)
        } else {
          console.warn(`[Invites] Failed to send email to ${email}:`, emailResult.error)
        }
      } catch (emailError) {
        console.error("[Invites] Email sending error (non-blocking):", emailError)
      }

      return NextResponse.json({
        user,
        passwordGenerated: !providedPassword,
        emailSent: true,
      }, { status: 201 })
    } catch (err) {
       console.error("Failed to create user with password:", err)
       return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }
  } catch (error) {
    console.error("[admin/invites] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/invites - Delete an invite
 * Requires admin role
 * Body: { inviteId: number }
 */
export async function DELETE(request: Request) {
  try {
    const { data } = await authServer.getSession()
    if (!data?.session || !data?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminCheck = await isAdmin(data.user.email)
    if (!adminCheck) {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const body = await request.json()
    const { inviteId } = body

    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID is required" }, { status: 400 })
    }

    const deleted = await deleteInvite(inviteId)
    if (!deleted) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/invites] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
