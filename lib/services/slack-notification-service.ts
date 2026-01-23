/**
 * lib/services/slack-notification-service.ts
 * Slack Webhook Notification Service
 *
 * Uses Slack Block Kit for rich message formatting
 */

import type { CriticalFailure, SlackMention } from "./notification-service"

// ============================================
// Types
// ============================================

interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
    emoji?: boolean
  }
  fields?: Array<{
    type: string
    text: string
  }>
  elements?: Array<{
    type: string
    text?: {
      type: string
      text: string
      emoji?: boolean
    }
    url?: string
    action_id?: string
  }>
  accessory?: {
    type: string
    text: {
      type: string
      text: string
      emoji?: boolean
    }
    url?: string
  }
}

interface SlackMessage {
  text: string
  blocks: SlackBlock[]
}

// ============================================
// Helpers
// ============================================

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://exolar.ai-innovation.site"
  )
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}

// ============================================
// Critical Failure Notification
// ============================================

export async function sendSlackCriticalFailure(
  webhookUrl: string,
  failures: CriticalFailure[],
  mention: SlackMention | null
): Promise<void> {
  const appUrl = getAppUrl()
  const executionId = failures[0]?.executionId

  // Build mention text
  const mentionText =
    mention === "@here"
      ? "<!here> "
      : mention === "@channel"
        ? "<!channel> "
        : ""

  // Build failure blocks
  const failureBlocks: SlackBlock[] = failures.slice(0, 5).map((f) => ({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${truncate(f.testName, 50)}*\n\`${f.testFile}\`\n${f.errorMessage ? truncate(f.errorMessage, 100) : "_No error message_"}`,
    },
    accessory: {
      type: "button",
      text: {
        type: "plain_text",
        text: "View",
        emoji: true,
      },
      url: `${appUrl}/execution/${f.executionId}?test=${f.testResultId}`,
    },
  }))

  const message: SlackMessage = {
    text: `${mentionText}${failures.length} critical test failure${failures.length > 1 ? "s" : ""} detected`,
    blocks: [
      // Header
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${failures.length} Critical Test Failure${failures.length > 1 ? "s" : ""}`,
          emoji: true,
        },
      },
      // Context
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Branch:*\n\`${failures[0].branch}\``,
          },
          {
            type: "mrkdwn",
            text: `*Suite:*\n${failures[0].suite || "_default_"}`,
          },
        ],
      },
      // Divider
      { type: "divider" },
      // Failures
      ...failureBlocks,
      // More indicator
      ...(failures.length > 5
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `_...and ${failures.length - 5} more failure${failures.length - 5 > 1 ? "s" : ""}_`,
              },
            },
          ]
        : []),
      // Divider
      { type: "divider" },
      // Actions
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Execution",
              emoji: true,
            },
            url: `${appUrl}/execution/${executionId}`,
            action_id: "view_execution",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open Dashboard",
              emoji: true,
            },
            url: appUrl,
            action_id: "open_dashboard",
          },
        ],
      },
    ],
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  })
}

// ============================================
// Execution Complete Notification
// ============================================

export async function sendSlackExecutionComplete(
  webhookUrl: string,
  execution: {
    executionId: number
    branch: string
    suite: string | null
    commitSha: string | null
    passed: number
    failed: number
    skipped: number
    duration: number
  }
): Promise<void> {
  const appUrl = getAppUrl()
  const total = execution.passed + execution.failed + execution.skipped
  const passRate = total > 0 ? Math.round((execution.passed / total) * 100) : 0

  // Status emoji based on failures
  const statusEmoji = execution.failed === 0 ? ":white_check_mark:" : ":x:"
  const statusText = execution.failed === 0 ? "All tests passed!" : `${execution.failed} test${execution.failed > 1 ? "s" : ""} failed`

  const message: SlackMessage = {
    text: `Test execution complete: ${statusText}`,
    blocks: [
      // Header
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${statusEmoji} *Test Execution Complete*`,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Results",
            emoji: true,
          },
          url: `${appUrl}/execution/${execution.executionId}`,
        },
      },
      // Stats
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Branch:*\n\`${execution.branch}\``,
          },
          {
            type: "mrkdwn",
            text: `*Suite:*\n${execution.suite || "_default_"}`,
          },
          {
            type: "mrkdwn",
            text: `*Pass Rate:*\n${passRate}%`,
          },
          {
            type: "mrkdwn",
            text: `*Duration:*\n${Math.round(execution.duration / 1000)}s`,
          },
        ],
      },
      // Results bar
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: ${execution.passed} passed  :x: ${execution.failed} failed  :fast_forward: ${execution.skipped} skipped`,
        },
      },
      // Commit info
      ...(execution.commitSha
        ? [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Commit: \`${execution.commitSha.slice(0, 8)}\``,
                },
              ],
            } as SlackBlock,
          ]
        : []),
    ],
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  })
}

// ============================================
// Digest Notification (Slack version)
// ============================================

export async function sendSlackDigest(
  webhookUrl: string,
  period: "daily" | "weekly",
  data: {
    totalExecutions: number
    totalTests: number
    passRate: number
    failedTests: number
    criticalFailures: number
    topFailures: Array<{ testName: string; failureCount: number }>
  }
): Promise<void> {
  const appUrl = getAppUrl()
  const periodText = period === "daily" ? "Daily" : "Weekly"

  // Top failures list
  const topFailuresText = data.topFailures.length > 0
    ? data.topFailures
        .map((f, i) => `${i + 1}. \`${truncate(f.testName, 40)}\` (${f.failureCount}x)`)
        .join("\n")
    : "_No failures_"

  const message: SlackMessage = {
    text: `${periodText} Test Summary: ${data.passRate}% pass rate`,
    blocks: [
      // Header
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${periodText} Test Summary`,
          emoji: true,
        },
      },
      // Stats
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Executions:*\n${data.totalExecutions}`,
          },
          {
            type: "mrkdwn",
            text: `*Total Tests:*\n${data.totalTests}`,
          },
          {
            type: "mrkdwn",
            text: `*Pass Rate:*\n${data.passRate}%`,
          },
          {
            type: "mrkdwn",
            text: `*Critical Failures:*\n${data.criticalFailures}`,
          },
        ],
      },
      // Divider
      { type: "divider" },
      // Top failures
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Top Failing Tests:*\n${topFailuresText}`,
        },
      },
      // Actions
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Dashboard",
              emoji: true,
            },
            url: appUrl,
            action_id: "view_dashboard",
          },
        ],
      },
    ],
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  })
}

// ============================================
// Test Webhook
// ============================================

export async function testSlackWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const message: SlackMessage = {
      text: "Test notification from Exolar QA",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: ":white_check_mark: *Slack integration test successful!*\n\nYour webhook is configured correctly. You will receive notifications for critical test failures.",
          },
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    })

    return response.ok
  } catch {
    return false
  }
}
