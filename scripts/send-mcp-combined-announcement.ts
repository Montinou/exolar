/**
 * Send Combined MCP v2.0 + v2.1 Announcement Email
 * Announces both the Router Pattern (v2.0) and Integration Engineer Persona (v2.1)
 *
 * Usage:
 *   Test: npx tsx scripts/send-mcp-combined-announcement.ts --test agusmontoya@gmail.com
 *   Test with name: npx tsx scripts/send-mcp-combined-announcement.ts --test agusmontoya@gmail.com --name "Agustin Montoya"
 *   Schedule test (10 min): npx tsx scripts/send-mcp-combined-announcement.ts --test agusmontoya@gmail.com --schedule 10
 *   All users: npx tsx scripts/send-mcp-combined-announcement.ts
 *   Schedule all (30 min): npx tsx scripts/send-mcp-combined-announcement.ts --schedule 30
 *   Dry run: DRY_RUN=true npx tsx scripts/send-mcp-combined-announcement.ts
 *
 * Note: For bulk sends, user.name from DB is used. For test mode, use --name or email is parsed.
 */

import { config } from "dotenv"
import { getAllUsers } from "../lib/db/users"
import { sendEmail } from "../lib/email/resend"

// Load environment variables
config()

// Check if API key is set
if (!process.env.RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY environment variable is not set")
  console.error("   Make sure it's in your .env file")
  process.exit(1)
}

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site"
const DRY_RUN = process.env.DRY_RUN === "true"

// Check for test mode and scheduling
const args = process.argv.slice(2)
const testIndex = args.indexOf("--test")
const TEST_EMAIL = testIndex !== -1 ? args[testIndex + 1] : null

// Check for --schedule flag (value in minutes)
const scheduleIndex = args.indexOf("--schedule")
const SCHEDULE_MINUTES = scheduleIndex !== -1 ? parseInt(args[scheduleIndex + 1], 10) : null
const SCHEDULED_AT = SCHEDULE_MINUTES
  ? new Date(Date.now() + SCHEDULE_MINUTES * 60 * 1000).toISOString()
  : null

function renderCombinedEmail(name: string): string {
  // Unique ID to prevent Gmail from grouping/clipping repeated test emails
  const uniqueId = Date.now().toString(36)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exolar QA - Major MCP Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0f; color: #e5e5e5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header GIF -->
    <div style="text-align: center; margin-bottom: 40px;">
      <img src="${DASHBOARD_URL}/assets/banner-header.gif" alt="Exolar QA" style="max-width: 100%; height: auto; border-radius: 12px;" />
      <p style="color: #a1a1aa; margin-top: 12px; font-size: 14px;">Major MCP Integration Update</p>
    </div>

    <!-- Main Card -->
    <div style="background: linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%); border: 1px solid rgba(34, 211, 238, 0.2); border-radius: 16px; padding: 32px;">

      <p style="color: #e5e5e5; font-size: 16px; margin: 0 0 16px 0;">
        Hi ${name},
      </p>

      <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        We're excited to announce <strong style="color: #22d3ee;">two major updates</strong> to our MCP (Model Context Protocol) integration that will transform how you interact with your test data through Claude Code.
      </p>

      <!-- Version 2.0 Section -->
      <div style="background: rgba(0, 0, 0, 0.3); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #22d3ee; font-size: 18px; margin: 0 0 8px 0;">🚀 v2.0 - Router Pattern & Semantic Layer</h2>
        <p style="color: #71717a; font-size: 12px; margin: 0 0 16px 0;">Released January 10, 2026</p>
        <ul style="color: #a1a1aa; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong style="color: #f97316;">5-Tool Router Pattern</strong> - 83% token reduction (~3,000 → ~500)</li>
          <li><strong style="color: #f97316;">14 Queryable Datasets</strong> - executions, failures, trends, and more</li>
          <li><strong style="color: #f97316;">Semantic Definitions</strong> - prevents AI hallucinations</li>
          <li><strong style="color: #f97316;">HTTP Streamable Transport</strong> - new MCP standard</li>
          <li><strong style="color: #f97316;">Multi-Tenant Security</strong> - org-scoped with RLS protection</li>
        </ul>
      </div>

      <!-- Version 2.1 Section -->
      <div style="background: rgba(0, 0, 0, 0.3); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #22d3ee; font-size: 18px; margin: 0 0 8px 0;">🤖 v2.1 - AI-Guided CI/CD Setup</h2>
        <p style="color: #71717a; font-size: 12px; margin: 0 0 16px 0;">Released January 11, 2026</p>
        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
          Claude Code now adopts an <strong style="color: #22d3ee;">Integration Engineer persona</strong> that guides you conversationally:
        </p>
        <ul style="color: #a1a1aa; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong style="color: #a855f7;">Discovery</strong> - asks about your CI provider & monorepo structure</li>
          <li><strong style="color: #a855f7;">Adaptation</strong> - GitHub Actions instructions with exact secrets steps</li>
          <li><strong style="color: #a855f7;">Validation</strong> - dry run commands before pushing to CI</li>
          <li><strong style="color: #a855f7;">Troubleshooting</strong> - instant help for common errors</li>
        </ul>
      </div>

      <!-- How to Use -->
      <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #a855f7; font-size: 14px; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">How to Get Started</h3>
        <ol style="color: #a1a1aa; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Visit <a href="${DASHBOARD_URL}/settings/mcp" style="color: #22d3ee;">Settings → MCP</a> to get your configuration</li>
          <li>Add the MCP server to Claude Code</li>
          <li>Ask: <em style="color: #22d3ee;">"Help me integrate Exolar with my Playwright tests"</em></li>
        </ol>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 16px;">
        <a href="${DASHBOARD_URL}/docs/mcp" style="display: inline-block; background: linear-gradient(90deg, #22d3ee, #06b6d4); color: #0a0a0f; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px;">
          View Documentation
        </a>
      </div>

      <!-- Secondary Links -->
      <p style="text-align: center; color: #71717a; font-size: 12px; margin: 0;">
        <a href="${DASHBOARD_URL}/docs/whats-new" style="color: #22d3ee; text-decoration: none;">What's New</a> ·
        <a href="${DASHBOARD_URL}/settings/mcp" style="color: #22d3ee; text-decoration: none;">MCP Settings</a> ·
        <a href="${DASHBOARD_URL}" style="color: #52525b; text-decoration: none;">exolar.ai-innovation.site</a>
        <!-- ${uniqueId} -->
      </p>
    </div>
  </div>
</body>
</html>
`
}

async function sendCombinedAnnouncement() {
  console.log("📧 MCP v2.0 + v2.1 Combined Announcement Emailer")
  console.log("=".repeat(60))

  if (SCHEDULED_AT) {
    console.log(`⏰ SCHEDULED - Email will be sent at: ${new Date(SCHEDULED_AT).toLocaleString()}`)
    console.log("=".repeat(60))
  }

  if (TEST_EMAIL) {
    console.log(`🧪 TEST MODE - Sending only to: ${TEST_EMAIL}`)
    console.log("=".repeat(60))

    // For test mode, try to get user name from DB, fallback to parsing email
    const testName = args[args.indexOf("--name") + 1] || TEST_EMAIL.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    const html = renderCombinedEmail(testName)

    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: "🚀 Exolar QA: Major MCP Update (v2.0 + v2.1)",
      html,
      ...(SCHEDULED_AT && { scheduledAt: SCHEDULED_AT }),
    })

    if (result.success) {
      console.log(`✅ Test email ${SCHEDULED_AT ? "scheduled" : "sent"} successfully!`)
      console.log(`   Email ID: ${result.emailId}`)
      console.log(`   Recipient: ${TEST_EMAIL}`)
      if (SCHEDULED_AT) {
        console.log(`   Scheduled for: ${new Date(SCHEDULED_AT).toLocaleString()}`)
      }
    } else {
      console.log(`❌ Failed to send: ${result.error}`)
    }

    return { sent: result.success ? 1 : 0, failed: result.success ? 0 : 1, skipped: 0 }
  }

  if (DRY_RUN) {
    console.log("⚠️  DRY RUN MODE - No emails will be sent")
    console.log("=" .repeat(60))
  }

  // Check if DATABASE_URL is set for fetching users
  if (!process.env.DATABASE_URL) {
    console.error("❌ Error: DATABASE_URL environment variable is not set")
    console.error("   Make sure it's in your .env file")
    process.exit(1)
  }

  // Fetch all users
  console.log("📋 Fetching users from database...")
  const users = await getAllUsers()
  console.log(`   Found ${users.length} users`)

  if (users.length === 0) {
    console.log("⚠️  No users found in database")
    return { sent: 0, failed: 0, skipped: 0 }
  }

  console.log("=" .repeat(60))

  const results = {
    sent: 0,
    failed: 0,
    skipped: 0,
    details: [] as Array<{ email: string; status: string; emailId?: string; error?: string }>
  }

  for (const user of users) {
    // Use user.name from DB, fallback to parsing email if null
    const name = user.name || user.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    console.log(`\n📧 Sending email to ${user.email} (${name})...`)

    const html = renderCombinedEmail(name)

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would send email to: ${user.email}`)
      results.skipped++
      results.details.push({ email: user.email, status: "skipped (dry run)" })
      continue
    }

    const result = await sendEmail({
      to: user.email,
      subject: "🚀 Exolar QA: Major MCP Update (v2.0 + v2.1)",
      html,
      ...(SCHEDULED_AT && { scheduledAt: SCHEDULED_AT }),
    })

    if (result.success) {
      results.sent++
      results.details.push({ email: user.email, status: "sent", emailId: result.emailId })
      console.log(`   ✅ Sent! Email ID: ${result.emailId}`)
    } else {
      results.failed++
      results.details.push({ email: user.email, status: "failed", error: result.error })
      console.log(`   ❌ Failed: ${result.error}`)
    }

    // 3 second delay between API calls to avoid Resend rate limiting
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  console.log("\n" + "=".repeat(60))
  console.log("📊 Summary:")
  if (DRY_RUN) {
    console.log(`   ⚠️  Skipped (dry run): ${results.skipped}`)
  } else {
    console.log(`   ✅ Sent: ${results.sent}`)
    console.log(`   ❌ Failed: ${results.failed}`)
  }

  if (results.failed > 0) {
    console.log("\n⚠️ Failed emails:")
    results.details
      .filter(d => d.status === "failed")
      .forEach(d => console.log(`   - ${d.email}: ${d.error}`))
  }

  return results
}

sendCombinedAnnouncement()
  .then((results) => {
    console.log("\n✅ Script complete!")
    process.exit(results.failed > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error)
    process.exit(1)
  })
