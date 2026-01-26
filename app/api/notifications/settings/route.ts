/**
 * Notification Settings API
 *
 * GET - Get notification settings for current org
 * PUT - Update notification settings
 * POST - Test notification (Slack webhook test)
 */

import { NextResponse } from "next/server"
import { getSessionContext, requireOrgAdmin } from "@/lib/session-context"
import {
  getNotificationConfig,
  upsertNotificationConfig,
} from "@/lib/services/notification-service"
import { testSlackWebhook } from "@/lib/services/slack-notification-service"

export const dynamic = "force-dynamic"

export async function GET() {
  const context = await getSessionContext()
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin permission
  const adminCheck = await requireOrgAdmin(context)
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const config = await getNotificationConfig(context.organizationId)

  // Return default config if none exists
  if (!config) {
    return NextResponse.json({
      emailEnabled: false,
      emailRecipients: [],
      emailOnCriticalFailure: true,
      emailDigestSchedule: null,
      emailDigestHour: 9,
      slackEnabled: false,
      slackWebhookUrl: null,
      slackOnCriticalFailure: true,
      slackOnExecutionComplete: false,
      slackMentionOnCritical: "none",
      relevanceThreshold: 80,
      failureCountThreshold: 1,
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
    })
  }

  // Mask the webhook URL for security
  const maskedConfig = {
    ...config,
    slackWebhookUrl: config.slackWebhookUrl
      ? "https://hooks.slack.com/***"
      : null,
  }

  return NextResponse.json(maskedConfig)
}

export async function PUT(request: Request) {
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

    // Validate email recipients
    if (body.emailRecipients && Array.isArray(body.emailRecipients)) {
      const validEmails = body.emailRecipients.filter((email: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
      body.emailRecipients = validEmails
    }

    // Validate Slack webhook URL
    if (body.slackWebhookUrl && !body.slackWebhookUrl.startsWith("https://hooks.slack.com/")) {
      return NextResponse.json(
        { error: "Invalid Slack webhook URL" },
        { status: 400 }
      )
    }

    // If webhook URL is masked, keep the existing one
    if (body.slackWebhookUrl === "https://hooks.slack.com/***") {
      const existingConfig = await getNotificationConfig(context.organizationId)
      body.slackWebhookUrl = existingConfig?.slackWebhookUrl || null
    }

    // Validate thresholds
    if (body.relevanceThreshold !== undefined) {
      body.relevanceThreshold = Math.max(0, Math.min(100, Number(body.relevanceThreshold) || 80))
    }
    if (body.failureCountThreshold !== undefined) {
      body.failureCountThreshold = Math.max(1, Number(body.failureCountThreshold) || 1)
    }

    // Validate digest hour
    if (body.emailDigestHour !== undefined) {
      body.emailDigestHour = Math.max(0, Math.min(23, Number(body.emailDigestHour) || 9))
    }

    // Validate quiet hours
    if (body.quietHoursStart !== undefined) {
      body.quietHoursStart = body.quietHoursStart === null
        ? null
        : Math.max(0, Math.min(23, Number(body.quietHoursStart)))
    }
    if (body.quietHoursEnd !== undefined) {
      body.quietHoursEnd = body.quietHoursEnd === null
        ? null
        : Math.max(0, Math.min(23, Number(body.quietHoursEnd)))
    }

    const config = await upsertNotificationConfig(context.organizationId, {
      emailEnabled: body.emailEnabled,
      emailRecipients: body.emailRecipients,
      emailOnCriticalFailure: body.emailOnCriticalFailure,
      emailDigestSchedule: body.emailDigestSchedule,
      emailDigestHour: body.emailDigestHour,
      slackEnabled: body.slackEnabled,
      slackWebhookUrl: body.slackWebhookUrl,
      slackOnCriticalFailure: body.slackOnCriticalFailure,
      slackOnExecutionComplete: body.slackOnExecutionComplete,
      slackMentionOnCritical: body.slackMentionOnCritical,
      relevanceThreshold: body.relevanceThreshold,
      failureCountThreshold: body.failureCountThreshold,
      quietHoursEnabled: body.quietHoursEnabled,
      quietHoursStart: body.quietHoursStart,
      quietHoursEnd: body.quietHoursEnd,
    })

    // Mask the webhook URL in response
    const maskedConfig = {
      ...config,
      slackWebhookUrl: config.slackWebhookUrl
        ? "https://hooks.slack.com/***"
        : null,
    }

    return NextResponse.json(maskedConfig)
  } catch (error) {
    console.error("[Notifications] Failed to update settings:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    )
  }
}

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
    const { action, webhookUrl } = body

    if (action === "test_slack") {
      if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
        return NextResponse.json(
          { error: "Invalid Slack webhook URL" },
          { status: 400 }
        )
      }

      const success = await testSlackWebhook(webhookUrl)

      if (success) {
        return NextResponse.json({ success: true, message: "Test message sent successfully" })
      } else {
        return NextResponse.json(
          { success: false, error: "Failed to send test message" },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("[Notifications] Test failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    )
  }
}
