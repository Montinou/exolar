import { NextResponse } from "next/server"
import { getSessionContext, isSuperadmin } from "@/lib/session-context"
import {
  getAllInvites,
  getInvitesForOrg,
  createInvite,
  deleteInvite,
  getUserByEmail,
  createUser,
  addOrganizationMember,
} from "@/lib/db"
import { authServer } from "@/lib/auth/server"
import { sendInviteEmail } from "@/lib/email/resend"
import { generateSecurePassword } from "@/lib/utils"

/**
 * GET /api/admin/invites - List invites
 * - Superadmin: sees all invites across all organizations
 * - Regular admin: sees only invites for their organization
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (context.userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    let invites
    if (isSuperadmin(context)) {
      // Superadmin sees all invites
      invites = await getAllInvites()
    } else {
      // Regular admin sees only their org's invites
      invites = await getInvitesForOrg(context.organizationId)
    }

    return NextResponse.json({ invites })
  } catch (error) {
    console.error("[admin/invites] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/invites - Create a new invite and user
 * - Superadmin: can invite to any organization
 * - Regular admin: can only invite to their own organization
 * Body: { email: string, role: "admin" | "viewer", organizationId?: number }
 */
export async function POST(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (context.userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const body = await request.json()
    const {
      email,
      role,
      organizationId,
      password: providedPassword,
      template = "exolar",
      name: providedName,
    } = body

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 })
    }

    if (role !== "admin" && role !== "viewer") {
      return NextResponse.json({ error: "Role must be 'admin' or 'viewer'" }, { status: 400 })
    }

    // If not superadmin, force organizationId to be their own org
    const targetOrgId = isSuperadmin(context)
      ? organizationId || context.organizationId
      : context.organizationId

    // Check if user already exists
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 })
    }

    // Generate password if not provided
    const password = providedPassword || generateSecurePassword(16)

    try {
      // Create user in Auth provider
      const name = providedName || email.split("@")[0]
      const { data, error: createUserError } = await authServer.admin.createUser({
        email,
        password,
        name,
      })

      const authUser = data?.user

      if (createUserError) {
        console.error("Auth provider create user failed:", createUserError)
        return NextResponse.json({ error: "Failed to create user identity" }, { status: 500 })
      }

      // Determine roles
      // If an organization is selected, the Platform Role should be "viewer" (not System Admin)
      // The Org Role will be whatever was selected (Admin or Viewer)
      const platformRole = targetOrgId ? "viewer" : role
      const orgRole = role

      // Create user in Dashboard DB
      const user = await createUser(email, platformRole, context.userId, targetOrgId)

      // Add to Organization if provided
      if (targetOrgId) {
        await addOrganizationMember(targetOrgId, user.id, orgRole)
      }

      // Send invite email with credentials (non-blocking)
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

      return NextResponse.json(
        {
          user,
          passwordGenerated: !providedPassword,
          emailSent: true,
        },
        { status: 201 }
      )
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
 * - Superadmin: can delete any invite
 * - Regular admin: can only delete invites for their organization
 * Body: { inviteId: number }
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
    const { inviteId } = body

    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID is required" }, { status: 400 })
    }

    // If not superadmin, verify invite belongs to admin's organization
    if (!isSuperadmin(context)) {
      const orgInvites = await getInvitesForOrg(context.organizationId)
      const inviteInOrg = orgInvites.some((inv) => inv.id === inviteId)
      if (!inviteInOrg) {
        return NextResponse.json(
          { error: "Cannot delete invites outside your organization" },
          { status: 403 }
        )
      }
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
