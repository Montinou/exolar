/**
 * Bulk Email API - Send credentials to multiple users
 * POST /api/admin/send-credentials
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { sendBulkInviteEmails } from "@/lib/email/resend"
import type { BulkEmailRequest, BulkEmailResponse } from "@/lib/email/types"

/**
 * POST /api/admin/send-credentials - Send bulk invite emails
 * Requires admin role
 * Body: { users: Array<{ email, password, role, name? }>, template?: "attorneyshare" | "exolar" }
 */
export async function POST(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (context.userRole !== "admin" && !context.isSuperadmin) {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const body: BulkEmailRequest = await request.json()
    const { users, template = "attorneyshare" } = body

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: "Users array is required and cannot be empty" }, { status: 400 })
    }

    for (const user of users) {
      if (!user.email || !user.password || !user.role) {
        return NextResponse.json({ error: "Each user must have email, password, and role" }, { status: 400 })
      }
      if (user.role !== "admin" && user.role !== "viewer") {
        return NextResponse.json({ error: "Role must be 'admin' or 'viewer'" }, { status: 400 })
      }
    }

    if (users.length > 50) {
      return NextResponse.json({ error: "Maximum 50 users per request" }, { status: 400 })
    }

    console.log(`[Bulk Email] Sending credentials to ${users.length} users (template: ${template})`)

    const usersWithTemplate = users.map((user) => ({ ...user, template }))
    const result: BulkEmailResponse = await sendBulkInviteEmails(usersWithTemplate)

    console.log(`[Bulk Email] Complete - Sent: ${result.sent}, Failed: ${result.failed}, Errors: ${result.errors.length}`)

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("[Bulk Email] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
