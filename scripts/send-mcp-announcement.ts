/**
 * Send MCP Integration Announcement Emails
 * Sends feature update emails to all dashboard users
 *
 * Usage: RESEND_API_KEY=your_key npx tsx scripts/send-mcp-announcement.ts
 */

import { getAllUsers } from "../lib/db/users"
import { sendEmail } from "../lib/email/resend"
import { renderFeatureUpdateEmail } from "../lib/email/templates/simple-templates"

// Check if API key is set
if (!process.env.RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY environment variable is not set")
  console.error("   Run: RESEND_API_KEY=your_key npx tsx scripts/send-mcp-announcement.ts")
  process.exit(1)
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL environment variable is not set")
  console.error("   Set DATABASE_URL to connect to the database")
  process.exit(1)
}

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site"
const DRY_RUN = process.env.DRY_RUN === "true"

async function sendMCPAnnouncement() {
  console.log("🚀 MCP Integration Announcement Emailer")
  console.log("=" .repeat(60))

  if (DRY_RUN) {
    console.log("⚠️  DRY RUN MODE - No emails will be sent")
    console.log("=" .repeat(60))
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

  // MCP-specific features to highlight
  const mcpFeatures = [
    {
      icon: "🎯",
      title: "5-Tool Router Pattern",
      description: "Consolidated from 24 tools to 5 for 83% token savings (~3,000 → ~500 tokens)",
      color: "cyan" as const,
    },
    {
      icon: "📊",
      title: "14 Queryable Datasets",
      description: "Universal data access: executions, failures, flaky tests, trends, and more",
      color: "purple" as const,
    },
    {
      icon: "🧠",
      title: "Semantic Definitions",
      description: "Metric definitions with formulas and thresholds prevent AI hallucinations",
      color: "amber" as const,
    },
    {
      icon: "⚡",
      title: "HTTP Streamable Transport",
      description: "New MCP standard with automatic retry logic and better reliability",
      color: "cyan" as const,
    },
    {
      icon: "🔒",
      title: "Secure Multi-Tenancy",
      description: "Organization-scoped queries with RLS protection at database level",
      color: "purple" as const,
    },
  ]

  for (const user of users) {
    console.log(`\n📧 Sending email to ${user.email}...`)

    // Extract name from email if needed
    const name = user.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

    // Render the email template
    const html = renderFeatureUpdateEmail({
      name,
      features: mcpFeatures,
      ctaUrl: `${DASHBOARD_URL}/settings/mcp`,
      ctaText: "Get Started",
      dashboardUrl: DASHBOARD_URL,
      updateTitle: "MCP Integration Now Available",
      updateDescription:
        "We're excited to announce a major update to our MCP (Model Context Protocol) integration. Query your test data directly from Claude Code with 83% fewer tokens, AI-powered insights, and enterprise-grade security.",
    })

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would send email to: ${user.email}`)
      results.skipped++
      results.details.push({ email: user.email, status: "skipped (dry run)" })
      continue
    }

    // Send the email
    const result = await sendEmail({
      to: user.email,
      subject: "🚀 Exolar QA Update: MCP Integration Now Available",
      html,
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

    // Small delay between API calls to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200))
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

  console.log("\n💡 Tip: Users can configure MCP at /settings/mcp")

  return results
}

sendMCPAnnouncement()
  .then((results) => {
    console.log("\n✅ Script complete!")
    process.exit(results.failed > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error)
    process.exit(1)
  })
