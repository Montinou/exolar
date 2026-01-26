/**
 * Notification History API
 *
 * GET - Get notification history for current org
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getNotificationHistory } from "@/lib/services/notification-service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const context = await getSessionContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50))
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0)
  const channel = searchParams.get("channel") as "email" | "slack" | null
  const triggerType = searchParams.get("trigger") as "critical_failure" | "execution_complete" | "daily_digest" | "weekly_digest" | null

  const history = await getNotificationHistory(context.organizationId, {
    limit,
    offset,
    ...(channel && { channel }),
    ...(triggerType && { triggerType }),
  })

  return NextResponse.json({
    data: history,
    pagination: {
      limit,
      offset,
      hasMore: history.length === limit,
    },
  })
}
