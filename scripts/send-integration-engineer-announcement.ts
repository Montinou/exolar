/**
 * Send Integration Engineer Persona Announcement Emails
 * Notifies users about the new conversational CI/CD setup experience
 *
 * Usage: npx tsx scripts/send-integration-engineer-announcement.ts
 */

import { config } from "dotenv"
import { getAllUsers } from "../lib/db/users"
import { sendEmail } from "../lib/email/resend"
import { renderFeatureUpdateEmail } from "../lib/email/templates/simple-templates"

// Load environment variables
config()

// Check if API key is set
if (!process.env.RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY environment variable is not set")
  console.error("   Make sure it's in your .env file")
  process.exit(1)
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL environment variable is not set")
  console.error("   Make sure it's in your .env file")
  process.exit(1)
}

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site"
const DRY_RUN = process.env.DRY_RUN === "true"

async function sendIntegrationEngineerAnnouncement() {
  console.log("🤖 Integration Engineer Persona Announcement Emailer")
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

  // Integration Engineer-specific features to highlight
  const integrationEngineerFeatures = [
    {
      icon: "🤖",
      title: "Conversational Setup Experience",
      description: "Claude asks about your CI provider and project structure first, then provides tailored instructions",
      color: "cyan" as const,
    },
    {
      icon: "🎯",
      title: "GitHub Actions-Specific Instructions",
      description: "Get exact secrets management steps (Settings > Secrets > Actions) for GitHub Actions workflows",
      color: "purple" as const,
    },
    {
      icon: "📦",
      title: "Monorepo-Aware Guidance",
      description: "Automatic detection and configuration guidance for monorepo projects",
      color: "amber" as const,
    },
    {
      icon: "✅",
      title: "Built-in Validation",
      description: "Dry run commands to verify integration locally before pushing to CI",
      color: "cyan" as const,
    },
  ]

  for (const user of users) {
    console.log(`\n📧 Sending email to ${user.email}...`)

    // Extract name from email if needed
    const name = user.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

    // Render the email template
    const html = renderFeatureUpdateEmail({
      name,
      features: integrationEngineerFeatures,
      ctaUrl: `${DASHBOARD_URL}/docs/mcp#conversational-setup`,
      ctaText: "Learn More",
      dashboardUrl: DASHBOARD_URL,
      updateTitle: "🤖 AI-Guided CI/CD Setup Now Available",
      updateDescription:
        "Say goodbye to confusing config dumps. Claude Code now guides you through CI/CD setup with an Integration Engineer persona that asks about your environment first, then provides tailored instructions for your specific setup.",
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
      subject: "🤖 Exolar QA Update: AI-Guided CI/CD Setup Now Available",
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

  console.log("\n💡 Tip: Users can learn more at /docs/mcp#conversational-setup")

  return results
}

sendIntegrationEngineerAnnouncement()
  .then((results) => {
    console.log("\n✅ Script complete!")
    process.exit(results.failed > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error)
    process.exit(1)
  })
