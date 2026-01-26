/**
 * lib/services/email-notification-service.ts
 * Email Notification Service for Test Alerts and Digests
 *
 * Uses Resend for email delivery with HTML templates
 */

import { sendEmail } from "@/lib/email/resend"
import type { CriticalFailure } from "./notification-service"
import { getOrganizationById } from "@/lib/db/orgs"

// ============================================
// Helpers
// ============================================

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://exolar.ai-innovation.site")
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}

// ============================================
// Email Templates
// ============================================

function criticalFailureEmailTemplate(
  failures: CriticalFailure[],
  orgName: string
): string {
  const appUrl = getAppUrl()
  const executionUrl = `${appUrl}/execution/${failures[0]?.executionId}`

  const failureRows = failures
    .slice(0, 10)
    .map(
      (f) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 500; color: #111827; margin-bottom: 4px;">
          ${escapeHtml(truncate(f.testName, 60))}
        </div>
        <div style="font-size: 12px; color: #6b7280;">
          ${escapeHtml(f.testFile)}
        </div>
        ${
          f.errorMessage
            ? `<div style="font-size: 12px; color: #dc2626; margin-top: 4px; font-family: monospace; background: #fef2f2; padding: 8px; border-radius: 4px;">
                ${escapeHtml(truncate(f.errorMessage, 150))}
              </div>`
            : ""
        }
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">
        <span style="display: inline-block; background: ${f.relevanceScore >= 90 ? "#dc2626" : "#f59e0b"}; color: white; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px;">
          ${f.relevanceScore}
        </span>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">
        <a href="${appUrl}/execution/${f.executionId}?test=${f.testResultId}" style="color: #2563eb; text-decoration: none; font-size: 14px;">
          View &rarr;
        </a>
      </td>
    </tr>
  `
    )
    .join("")

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Critical Test Failures</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">
        Critical Test Failures Detected
      </h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">
        ${failures.length} high-priority test${failures.length > 1 ? "s" : ""} failed in ${orgName}
      </p>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Context -->
      <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; padding: 8px;">
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Branch</div>
              <div style="font-weight: 500; color: #111827;">${escapeHtml(failures[0].branch)}</div>
            </td>
            <td style="width: 50%; padding: 8px;">
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Suite</div>
              <div style="font-weight: 500; color: #111827;">${failures[0].suite || "Default"}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Failures Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">
              Test
            </th>
            <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">
              Score
            </th>
            <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          ${failureRows}
        </tbody>
      </table>

      ${
        failures.length > 10
          ? `<p style="text-align: center; color: #6b7280; font-size: 14px; margin-bottom: 24px;">
              ...and ${failures.length - 10} more failure${failures.length - 10 > 1 ? "s" : ""}
            </p>`
          : ""
      }

      <!-- CTA -->
      <div style="text-align: center;">
        <a href="${executionUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
          View Full Execution
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #6b7280; font-size: 12px;">
      <p style="margin: 0;">
        Sent by <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">Exolar QA</a>
      </p>
      <p style="margin: 8px 0 0 0;">
        <a href="${appUrl}/settings/notifications" style="color: #6b7280; text-decoration: none;">
          Manage notification settings
        </a>
      </p>
    </div>
  </div>
</body>
</html>
`
}

function digestEmailTemplate(
  period: "daily" | "weekly",
  data: {
    totalExecutions: number
    totalTests: number
    passRate: number
    failedTests: number
    criticalFailures: number
    topFailures: Array<{ testName: string; failureCount: number }>
  },
  orgName: string
): string {
  const appUrl = getAppUrl()
  const periodText = period === "daily" ? "Daily" : "Weekly"

  const topFailuresHtml = data.topFailures.length > 0
    ? data.topFailures
        .map(
          (f, i) => `
        <tr>
          <td style="padding: 8px 16px; border-bottom: 1px solid #e5e7eb;">
            <span style="color: #6b7280; font-size: 14px;">${i + 1}.</span>
            <span style="color: #111827; font-size: 14px; margin-left: 8px;">
              ${escapeHtml(truncate(f.testName, 50))}
            </span>
          </td>
          <td style="padding: 8px 16px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <span style="color: #dc2626; font-weight: 500;">${f.failureCount}x</span>
          </td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="2" style="padding: 16px; text-align: center; color: #6b7280;">No failures</td></tr>`

  const passRateColor = data.passRate >= 95 ? "#059669" : data.passRate >= 80 ? "#f59e0b" : "#dc2626"

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${periodText} Test Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">
        ${periodText} Test Summary
      </h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">
        ${orgName} - ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Stats Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: ${passRateColor};">
                ${data.passRate}%
              </div>
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-top: 4px;">
                Pass Rate
              </div>
            </td>
            <td style="width: 50%; padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #111827;">
                ${data.totalExecutions}
              </div>
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-top: 4px;">
                Executions
              </div>
            </td>
          </tr>
          <tr>
            <td style="width: 50%; padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #dc2626;">
                ${data.failedTests}
              </div>
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-top: 4px;">
                Failed Tests
              </div>
            </td>
            <td style="width: 50%; padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #f59e0b;">
                ${data.criticalFailures}
              </div>
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-top: 4px;">
                Critical
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Top Failures -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">
          Top Failing Tests
        </h2>
        <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
          ${topFailuresHtml}
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align: center;">
        <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
          Open Dashboard
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #6b7280; font-size: 12px;">
      <p style="margin: 0;">
        Sent by <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">Exolar QA</a>
      </p>
      <p style="margin: 8px 0 0 0;">
        <a href="${appUrl}/settings/notifications" style="color: #6b7280; text-decoration: none;">
          Manage notification settings
        </a>
      </p>
    </div>
  </div>
</body>
</html>
`
}

// ============================================
// Email Sending Functions
// ============================================

/**
 * Send critical failure alert email
 */
export async function sendCriticalFailureEmail(
  organizationId: number,
  failures: CriticalFailure[],
  recipients: string[]
): Promise<void> {
  if (recipients.length === 0 || failures.length === 0) return

  // Get org name
  const org = await getOrganizationById(organizationId)
  const orgName = org?.name || "Your Organization"

  const html = criticalFailureEmailTemplate(failures, orgName)
  const subject = `[Exolar] ${failures.length} Critical Test Failure${failures.length > 1 ? "s" : ""} - ${failures[0].branch}`

  await sendEmail({
    to: recipients,
    subject,
    html,
  })
}

/**
 * Send digest email (daily or weekly)
 */
export async function sendDigestEmail(
  organizationId: number,
  period: "daily" | "weekly",
  data: {
    totalExecutions: number
    totalTests: number
    passRate: number
    failedTests: number
    criticalFailures: number
    topFailures: Array<{ testName: string; failureCount: number }>
  },
  recipients: string[]
): Promise<void> {
  if (recipients.length === 0) return

  // Get org name
  const org = await getOrganizationById(organizationId)
  const orgName = org?.name || "Your Organization"

  const periodText = period === "daily" ? "Daily" : "Weekly"
  const html = digestEmailTemplate(period, data, orgName)
  const subject = `[Exolar] ${periodText} Test Summary - ${data.passRate}% Pass Rate`

  await sendEmail({
    to: recipients,
    subject,
    html,
  })
}
