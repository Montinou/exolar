/**
 * Digest Notification API
 *
 * POST - Manually trigger a digest notification for an organization
 * GET - Check digest status
 *
 * Digests are NOT sent via cron - they must be triggered manually or via external scheduler.
 * Immediate failure notifications are sent automatically during test ingestion.
 */

import { NextResponse } from "next/server"
import { getSessionContext, requireOrgAdmin } from "@/lib/session-context"
import { sendDigestNotification } from "@/lib/services/notification-service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const context = await getSessionContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin permission
  const adminCheck = await requireOrgAdmin(context)
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const digestType = body.type as "daily" | "weekly"

    if (!digestType || !["daily", "weekly"].includes(digestType)) {
      return NextResponse.json(
        { error: "Invalid digest type. Must be 'daily' or 'weekly'" },
        { status: 400 }
      )
    }

    const success = await sendDigestNotification(context.organizationId, digestType)

    if (success) {
      return NextResponse.json({
        success: true,
        message: `${digestType} digest sent successfully`,
        organizationId: context.organizationId,
        timestamp: new Date().toISOString(),
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send digest - check notification settings",
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("[Notifications] Digest trigger failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send digest" },
      { status: 500 }
    )
  }
}
