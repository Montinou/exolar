/**
 * Notification Cron Job
 *
 * Runs hourly to send daily and weekly digest emails
 * Called by Vercel Cron: vercel.json
 *
 * Schedule:
 * - Daily digests: Sent at the org's configured hour (default 9 AM UTC)
 * - Weekly digests: Sent on Monday at the org's configured hour
 */

import { NextResponse } from "next/server"
import {
  getOrgsNeedingDigest,
  sendDigestNotification,
} from "@/lib/services/notification-service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Vercel Cron security - verify request comes from Vercel
function verifyVercelCron(request: Request): boolean {
  const authHeader = request.headers.get("authorization")

  // In development, allow without auth
  if (process.env.NODE_ENV === "development") return true

  // Verify Vercel Cron secret
  if (process.env.CRON_SECRET) {
    return authHeader === `Bearer ${process.env.CRON_SECRET}`
  }

  // Check for Vercel internal header
  const vercelCron = request.headers.get("x-vercel-cron")
  return vercelCron === "1"
}

export async function GET(request: Request) {
  // Verify this is a legitimate cron request
  if (!verifyVercelCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const currentHour = now.getUTCHours()
  const currentDay = now.getUTCDay() // 0 = Sunday, 1 = Monday

  const results = {
    hour: currentHour,
    day: currentDay,
    dailyDigests: { sent: 0, failed: 0, orgs: [] as number[] },
    weeklyDigests: { sent: 0, failed: 0, orgs: [] as number[] },
  }

  try {
    // Get organizations needing daily digests at this hour
    const dailyOrgs = await getOrgsNeedingDigest("daily", currentHour)

    for (const orgId of dailyOrgs) {
      const success = await sendDigestNotification(orgId, "daily")
      results.dailyDigests.orgs.push(orgId)
      if (success) {
        results.dailyDigests.sent++
      } else {
        results.dailyDigests.failed++
      }
    }

    // Weekly digests only on Monday
    if (currentDay === 1) {
      const weeklyOrgs = await getOrgsNeedingDigest("weekly", currentHour)

      for (const orgId of weeklyOrgs) {
        const success = await sendDigestNotification(orgId, "weekly")
        results.weeklyDigests.orgs.push(orgId)
        if (success) {
          results.weeklyDigests.sent++
        } else {
          results.weeklyDigests.failed++
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    })
  } catch (error) {
    console.error("[Cron] Notification cron failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: now.toISOString(),
        ...results,
      },
      { status: 500 }
    )
  }
}
