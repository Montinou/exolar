/**
 * Test MCP Announcement Email
 * Sends a single test email to review the MCP announcement
 *
 * Usage: RESEND_API_KEY=your_key npx tsx scripts/test-mcp-email.ts
 */

import { sendEmail } from "../lib/email/resend"
import { renderFeatureUpdateEmail } from "../lib/email/templates/simple-templates"

// Check if API key is set
if (!process.env.RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY environment variable is not set")
  console.error("   Run: RESEND_API_KEY=your_key npx tsx scripts/test-mcp-email.ts")
  process.exit(1)
}

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site"
const TEST_EMAIL = "agusmontoya@gmail.com"

async function testMCPEmail() {
  console.log("📧 Testing MCP Announcement Email")
  console.log("=" .repeat(60))
  console.log(`   Sending test email to: ${TEST_EMAIL}`)
  console.log("=" .repeat(60))

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

  // Render the email template
  const html = renderFeatureUpdateEmail({
    name: "Agustin",
    features: mcpFeatures,
    ctaUrl: `${DASHBOARD_URL}/docs/mcp`,
    ctaText: "View Documentation",
    dashboardUrl: DASHBOARD_URL,
    updateTitle: "MCP Integration Now Available",
    updateDescription:
      "We're excited to announce a major update to our MCP (Model Context Protocol) integration. Query your test data directly from Claude Code with 83% fewer tokens, AI-powered insights, and enterprise-grade security.",
  })

  console.log("\n📤 Sending email...")

  // Send the email
  const result = await sendEmail({
    to: TEST_EMAIL,
    subject: "🚀 Exolar QA Update: MCP Integration Now Available",
    html,
  })

  if (result.success) {
    console.log(`\n✅ Email sent successfully!`)
    console.log(`   Email ID: ${result.emailId}`)
    console.log(`\n📬 Check your inbox at ${TEST_EMAIL}`)
    console.log("   (Check spam folder if you don't see it)")
  } else {
    console.log(`\n❌ Failed to send email`)
    console.log(`   Error: ${result.error}`)
  }

  console.log("\n" + "=".repeat(60))
}

testMCPEmail()
  .then(() => {
    console.log("\n✅ Test complete!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error)
    process.exit(1)
  })
