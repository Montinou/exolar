/**
 * lib/services/notification-service.ts
 * Notification Service for Critical Failures and Digests
 *
 * Supports:
 * - Email notifications via Resend
 * - Slack notifications via webhooks
 * - Daily/weekly digests
 * - Quiet hours
 */

import { getSql } from "@/lib/db/connection"

// ============================================
// Types
// ============================================

export type NotificationChannel = "email" | "slack"

export type NotificationTrigger =
  | "critical_failure"
  | "execution_complete"
  | "daily_digest"
  | "weekly_digest"

export type NotificationStatus = "pending" | "sent" | "failed" | "suppressed"

export type DigestSchedule = "daily" | "weekly" | "none"

export type SlackMention = "@here" | "@channel" | "none"

export interface NotificationConfig {
  id: number
  organizationId: number
  // Email
  emailEnabled: boolean
  emailRecipients: string[]
  emailOnCriticalFailure: boolean
  emailDigestSchedule: DigestSchedule | null
  emailDigestHour: number
  // Slack
  slackEnabled: boolean
  slackWebhookUrl: string | null
  slackOnCriticalFailure: boolean
  slackOnExecutionComplete: boolean
  slackMentionOnCritical: SlackMention | null
  // Thresholds
  relevanceThreshold: number
  failureCountThreshold: number
  // Quiet hours
  quietHoursEnabled: boolean
  quietHoursStart: number | null
  quietHoursEnd: number | null
}

export interface NotificationHistoryEntry {
  id: number
  organizationId: number
  channel: NotificationChannel
  triggerType: NotificationTrigger
  executionId: number | null
  testResultId: number | null
  subject: string | null
  preview: string | null
  recipientCount: number
  status: NotificationStatus
  errorMessage: string | null
  createdAt: string
  sentAt: string | null
}

export interface CriticalFailure {
  testResultId: number
  testName: string
  testFile: string
  errorMessage: string | null
  relevanceScore: number
  executionId: number
  branch: string
  suite: string | null
}

// ============================================
// Database Operations
// ============================================

/**
 * Get notification config for an organization
 */
export async function getNotificationConfig(
  organizationId: number
): Promise<NotificationConfig | null> {
  const sql = getSql()

  const results = await sql`
    SELECT
      id,
      organization_id,
      email_enabled,
      email_recipients,
      email_on_critical_failure,
      email_digest_schedule,
      email_digest_hour,
      slack_enabled,
      slack_webhook_url,
      slack_on_critical_failure,
      slack_on_execution_complete,
      slack_mention_on_critical,
      relevance_threshold,
      failure_count_threshold,
      quiet_hours_enabled,
      quiet_hours_start,
      quiet_hours_end
    FROM notification_configs
    WHERE organization_id = ${organizationId}
  `

  if (results.length === 0) return null

  const r = results[0]
  return {
    id: r.id as number,
    organizationId: r.organization_id as number,
    emailEnabled: r.email_enabled as boolean,
    emailRecipients: (r.email_recipients as string[]) || [],
    emailOnCriticalFailure: r.email_on_critical_failure as boolean,
    emailDigestSchedule: r.email_digest_schedule as DigestSchedule | null,
    emailDigestHour: r.email_digest_hour as number,
    slackEnabled: r.slack_enabled as boolean,
    slackWebhookUrl: r.slack_webhook_url as string | null,
    slackOnCriticalFailure: r.slack_on_critical_failure as boolean,
    slackOnExecutionComplete: r.slack_on_execution_complete as boolean,
    slackMentionOnCritical: r.slack_mention_on_critical as SlackMention | null,
    relevanceThreshold: r.relevance_threshold as number,
    failureCountThreshold: r.failure_count_threshold as number,
    quietHoursEnabled: r.quiet_hours_enabled as boolean,
    quietHoursStart: r.quiet_hours_start as number | null,
    quietHoursEnd: r.quiet_hours_end as number | null,
  }
}

/**
 * Create or update notification config
 */
export async function upsertNotificationConfig(
  organizationId: number,
  config: Partial<Omit<NotificationConfig, "id" | "organizationId">>
): Promise<NotificationConfig> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO notification_configs (
      organization_id,
      email_enabled,
      email_recipients,
      email_on_critical_failure,
      email_digest_schedule,
      email_digest_hour,
      slack_enabled,
      slack_webhook_url,
      slack_on_critical_failure,
      slack_on_execution_complete,
      slack_mention_on_critical,
      relevance_threshold,
      failure_count_threshold,
      quiet_hours_enabled,
      quiet_hours_start,
      quiet_hours_end
    ) VALUES (
      ${organizationId},
      ${config.emailEnabled ?? false},
      ${config.emailRecipients || []},
      ${config.emailOnCriticalFailure ?? true},
      ${config.emailDigestSchedule ?? null},
      ${config.emailDigestHour ?? 9},
      ${config.slackEnabled ?? false},
      ${config.slackWebhookUrl ?? null},
      ${config.slackOnCriticalFailure ?? true},
      ${config.slackOnExecutionComplete ?? false},
      ${config.slackMentionOnCritical ?? "none"},
      ${config.relevanceThreshold ?? 80},
      ${config.failureCountThreshold ?? 1},
      ${config.quietHoursEnabled ?? false},
      ${config.quietHoursStart ?? null},
      ${config.quietHoursEnd ?? null}
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      email_enabled = EXCLUDED.email_enabled,
      email_recipients = EXCLUDED.email_recipients,
      email_on_critical_failure = EXCLUDED.email_on_critical_failure,
      email_digest_schedule = EXCLUDED.email_digest_schedule,
      email_digest_hour = EXCLUDED.email_digest_hour,
      slack_enabled = EXCLUDED.slack_enabled,
      slack_webhook_url = EXCLUDED.slack_webhook_url,
      slack_on_critical_failure = EXCLUDED.slack_on_critical_failure,
      slack_on_execution_complete = EXCLUDED.slack_on_execution_complete,
      slack_mention_on_critical = EXCLUDED.slack_mention_on_critical,
      relevance_threshold = EXCLUDED.relevance_threshold,
      failure_count_threshold = EXCLUDED.failure_count_threshold,
      quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
      quiet_hours_start = EXCLUDED.quiet_hours_start,
      quiet_hours_end = EXCLUDED.quiet_hours_end
    RETURNING *
  `

  const r = result[0]
  return {
    id: r.id as number,
    organizationId: r.organization_id as number,
    emailEnabled: r.email_enabled as boolean,
    emailRecipients: (r.email_recipients as string[]) || [],
    emailOnCriticalFailure: r.email_on_critical_failure as boolean,
    emailDigestSchedule: r.email_digest_schedule as DigestSchedule | null,
    emailDigestHour: r.email_digest_hour as number,
    slackEnabled: r.slack_enabled as boolean,
    slackWebhookUrl: r.slack_webhook_url as string | null,
    slackOnCriticalFailure: r.slack_on_critical_failure as boolean,
    slackOnExecutionComplete: r.slack_on_execution_complete as boolean,
    slackMentionOnCritical: r.slack_mention_on_critical as SlackMention | null,
    relevanceThreshold: r.relevance_threshold as number,
    failureCountThreshold: r.failure_count_threshold as number,
    quietHoursEnabled: r.quiet_hours_enabled as boolean,
    quietHoursStart: r.quiet_hours_start as number | null,
    quietHoursEnd: r.quiet_hours_end as number | null,
  }
}

/**
 * Log a notification attempt
 */
export async function logNotification(
  organizationId: number,
  channel: NotificationChannel,
  triggerType: NotificationTrigger,
  options: {
    executionId?: number
    testResultId?: number
    subject?: string
    preview?: string
    recipientCount?: number
    status: NotificationStatus
    errorMessage?: string
  }
): Promise<number> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO notification_history (
      organization_id,
      channel,
      trigger_type,
      execution_id,
      test_result_id,
      subject,
      preview,
      recipient_count,
      status,
      error_message,
      sent_at
    ) VALUES (
      ${organizationId},
      ${channel},
      ${triggerType},
      ${options.executionId ?? null},
      ${options.testResultId ?? null},
      ${options.subject ?? null},
      ${options.preview ?? null},
      ${options.recipientCount ?? 1},
      ${options.status},
      ${options.errorMessage ?? null},
      ${options.status === "sent" ? sql`NOW()` : null}
    )
    RETURNING id
  `

  return result[0].id as number
}

/**
 * Get notification history for an organization
 */
export async function getNotificationHistory(
  organizationId: number,
  options?: {
    limit?: number
    offset?: number
    channel?: NotificationChannel
    triggerType?: NotificationTrigger
  }
): Promise<NotificationHistoryEntry[]> {
  const sql = getSql()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let query = sql`
    SELECT
      id,
      organization_id,
      channel,
      trigger_type,
      execution_id,
      test_result_id,
      subject,
      preview,
      recipient_count,
      status,
      error_message,
      created_at,
      sent_at
    FROM notification_history
    WHERE organization_id = ${organizationId}
  `

  if (options?.channel) {
    query = sql`${query} AND channel = ${options.channel}`
  }
  if (options?.triggerType) {
    query = sql`${query} AND trigger_type = ${options.triggerType}`
  }

  query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`

  const results = await query

  return results.map((r) => ({
    id: r.id as number,
    organizationId: r.organization_id as number,
    channel: r.channel as NotificationChannel,
    triggerType: r.trigger_type as NotificationTrigger,
    executionId: r.execution_id as number | null,
    testResultId: r.test_result_id as number | null,
    subject: r.subject as string | null,
    preview: r.preview as string | null,
    recipientCount: r.recipient_count as number,
    status: r.status as NotificationStatus,
    errorMessage: r.error_message as string | null,
    createdAt: r.created_at as string,
    sentAt: r.sent_at as string | null,
  }))
}

/**
 * Get organizations that need daily digests at a specific hour
 */
export async function getOrgsNeedingDigest(
  schedule: "daily" | "weekly",
  hour: number
): Promise<number[]> {
  const sql = getSql()

  const results = await sql`
    SELECT organization_id
    FROM notification_configs
    WHERE email_enabled = true
      AND email_digest_schedule = ${schedule}
      AND email_digest_hour = ${hour}
  `

  return results.map((r) => r.organization_id as number)
}

// ============================================
// Notification Logic
// ============================================

/**
 * Check if we're in quiet hours
 */
export function isInQuietHours(config: NotificationConfig): boolean {
  if (!config.quietHoursEnabled || config.quietHoursStart === null || config.quietHoursEnd === null) {
    return false
  }

  const now = new Date()
  const currentHour = now.getUTCHours()

  // Handle overnight quiet hours (e.g., 22:00 - 06:00)
  if (config.quietHoursStart > config.quietHoursEnd) {
    return currentHour >= config.quietHoursStart || currentHour < config.quietHoursEnd
  }

  // Normal range (e.g., 00:00 - 08:00)
  return currentHour >= config.quietHoursStart && currentHour < config.quietHoursEnd
}

/**
 * Get high-relevance failures from an execution
 */
export async function getCriticalFailuresForExecution(
  organizationId: number,
  executionId: number,
  relevanceThreshold: number
): Promise<CriticalFailure[]> {
  const sql = getSql()

  const results = await sql`
    SELECT
      tr.id as test_result_id,
      tr.test_name,
      tr.test_file,
      tr.error_message,
      COALESCE(trs.relevance_score, trs.auto_relevance_score, 50) as relevance_score,
      te.id as execution_id,
      te.branch,
      te.suite
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    LEFT JOIN test_relevance_scores trs ON trs.test_signature = tr.test_signature
      AND trs.organization_id = te.organization_id
    WHERE te.organization_id = ${organizationId}
      AND tr.execution_id = ${executionId}
      AND tr.status IN ('failed', 'timedout')
      AND COALESCE(trs.relevance_score, trs.auto_relevance_score, 50) >= ${relevanceThreshold}
    ORDER BY COALESCE(trs.relevance_score, trs.auto_relevance_score, 50) DESC
  `

  return results.map((r) => ({
    testResultId: r.test_result_id as number,
    testName: r.test_name as string,
    testFile: r.test_file as string,
    errorMessage: r.error_message as string | null,
    relevanceScore: r.relevance_score as number,
    executionId: r.execution_id as number,
    branch: r.branch as string,
    suite: r.suite as string | null,
  }))
}

/**
 * Get digest data for an organization
 */
export async function getDigestData(
  organizationId: number,
  period: "daily" | "weekly"
): Promise<{
  totalExecutions: number
  totalTests: number
  passRate: number
  failedTests: number
  criticalFailures: number
  topFailures: Array<{ testName: string; failureCount: number }>
}> {
  const sql = getSql()
  const hoursBack = period === "daily" ? 24 : 168

  const stats = await sql`
    SELECT
      COUNT(DISTINCT te.id) as total_executions,
      COUNT(tr.id) as total_tests,
      COUNT(*) FILTER (WHERE tr.status = 'passed') as passed,
      COUNT(*) FILTER (WHERE tr.status IN ('failed', 'timedout')) as failed
    FROM test_executions te
    JOIN test_results tr ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND te.started_at >= NOW() - INTERVAL '${hoursBack} hours'
  ` as Array<{
    total_executions: string
    total_tests: string
    passed: string
    failed: string
  }>

  const s = stats[0]
  const totalTests = Number(s.total_tests)
  const passRate = totalTests > 0 ? (Number(s.passed) / totalTests) * 100 : 0

  // Get critical failures count
  const criticalCount = await sql`
    SELECT COUNT(*) as count
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    LEFT JOIN test_relevance_scores trs ON trs.test_signature = tr.test_signature
      AND trs.organization_id = te.organization_id
    WHERE te.organization_id = ${organizationId}
      AND te.started_at >= NOW() - INTERVAL '${hoursBack} hours'
      AND tr.status IN ('failed', 'timedout')
      AND COALESCE(trs.relevance_score, 50) >= 80
  ` as Array<{ count: string }>

  // Get top failures
  const topFailures = await sql`
    SELECT
      tr.test_name,
      COUNT(*) as failure_count
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND te.started_at >= NOW() - INTERVAL '${hoursBack} hours'
      AND tr.status IN ('failed', 'timedout')
    GROUP BY tr.test_name
    ORDER BY failure_count DESC
    LIMIT 5
  ` as Array<{ test_name: string; failure_count: string }>

  return {
    totalExecutions: Number(s.total_executions),
    totalTests,
    passRate: Math.round(passRate * 10) / 10,
    failedTests: Number(s.failed),
    criticalFailures: Number(criticalCount[0].count),
    topFailures: topFailures.map((f) => ({
      testName: f.test_name,
      failureCount: Number(f.failure_count),
    })),
  }
}

/**
 * Send critical failure notification
 */
export async function sendCriticalFailureNotification(
  organizationId: number,
  executionId: number
): Promise<{ emailSent: boolean; slackSent: boolean }> {
  const config = await getNotificationConfig(organizationId)

  if (!config) {
    return { emailSent: false, slackSent: false }
  }

  // Check quiet hours
  if (isInQuietHours(config)) {
    await logNotification(organizationId, "email", "critical_failure", {
      executionId,
      status: "suppressed",
      errorMessage: "Suppressed due to quiet hours",
    })
    return { emailSent: false, slackSent: false }
  }

  // Get critical failures
  const failures = await getCriticalFailuresForExecution(
    organizationId,
    executionId,
    config.relevanceThreshold
  )

  if (failures.length < config.failureCountThreshold) {
    return { emailSent: false, slackSent: false }
  }

  let emailSent = false
  let slackSent = false

  // Send email notification
  if (config.emailEnabled && config.emailOnCriticalFailure && config.emailRecipients.length > 0) {
    try {
      const { sendCriticalFailureEmail } = await import("./email-notification-service")
      await sendCriticalFailureEmail(organizationId, failures, config.emailRecipients)

      await logNotification(organizationId, "email", "critical_failure", {
        executionId,
        subject: `Critical Test Failures (${failures.length})`,
        preview: failures[0].testName,
        recipientCount: config.emailRecipients.length,
        status: "sent",
      })
      emailSent = true
    } catch (error) {
      await logNotification(organizationId, "email", "critical_failure", {
        executionId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Send Slack notification
  if (config.slackEnabled && config.slackOnCriticalFailure && config.slackWebhookUrl) {
    try {
      const { sendSlackCriticalFailure } = await import("./slack-notification-service")
      await sendSlackCriticalFailure(
        config.slackWebhookUrl,
        failures,
        config.slackMentionOnCritical
      )

      await logNotification(organizationId, "slack", "critical_failure", {
        executionId,
        subject: `Critical Test Failures (${failures.length})`,
        preview: failures[0].testName,
        status: "sent",
      })
      slackSent = true
    } catch (error) {
      await logNotification(organizationId, "slack", "critical_failure", {
        executionId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return { emailSent, slackSent }
}

/**
 * Send execution complete notification (Slack only)
 */
export async function sendExecutionCompleteNotification(
  organizationId: number,
  executionId: number,
  stats: { passed: number; failed: number; skipped: number; duration: number }
): Promise<boolean> {
  const config = await getNotificationConfig(organizationId)

  if (
    !config ||
    !config.slackEnabled ||
    !config.slackOnExecutionComplete ||
    !config.slackWebhookUrl
  ) {
    return false
  }

  if (isInQuietHours(config)) {
    return false
  }

  try {
    const { sendSlackExecutionComplete } = await import("./slack-notification-service")

    // Get execution details
    const sql = getSql()
    const exec = await sql`
      SELECT branch, suite, commit_sha
      FROM test_executions
      WHERE id = ${executionId}
        AND organization_id = ${organizationId}
    `

    if (exec.length === 0) return false

    await sendSlackExecutionComplete(config.slackWebhookUrl, {
      executionId,
      branch: exec[0].branch as string,
      suite: exec[0].suite as string | null,
      commitSha: exec[0].commit_sha as string | null,
      ...stats,
    })

    await logNotification(organizationId, "slack", "execution_complete", {
      executionId,
      subject: `Execution Complete: ${exec[0].branch}`,
      preview: `${stats.passed} passed, ${stats.failed} failed`,
      status: "sent",
    })

    return true
  } catch (error) {
    await logNotification(organizationId, "slack", "execution_complete", {
      executionId,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    })
    return false
  }
}

/**
 * Send digest notification
 */
export async function sendDigestNotification(
  organizationId: number,
  period: "daily" | "weekly"
): Promise<boolean> {
  const config = await getNotificationConfig(organizationId)

  if (!config || !config.emailEnabled || config.emailRecipients.length === 0) {
    return false
  }

  try {
    const digestData = await getDigestData(organizationId, period)
    const { sendDigestEmail } = await import("./email-notification-service")

    await sendDigestEmail(organizationId, period, digestData, config.emailRecipients)

    await logNotification(organizationId, "email", period === "daily" ? "daily_digest" : "weekly_digest", {
      subject: `${period === "daily" ? "Daily" : "Weekly"} Test Summary`,
      preview: `${digestData.passRate}% pass rate, ${digestData.failedTests} failures`,
      recipientCount: config.emailRecipients.length,
      status: "sent",
    })

    return true
  } catch (error) {
    await logNotification(organizationId, "email", period === "daily" ? "daily_digest" : "weekly_digest", {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    })
    return false
  }
}
