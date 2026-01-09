/**
 * Schedule Team Credential Emails
 * Sends AttorneyShare template emails to all team members from USER_CREDENTIALS.md
 *
 * Usage: RESEND_API_KEY=your_key npx tsx scripts/schedule-team-emails.ts
 */

import { sendEmail } from "../lib/email/resend"
import { renderAttorneyShareEmail } from "../lib/email/templates/simple-templates"

// Check if API key is set
if (!process.env.RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY environment variable is not set")
  console.error("   Run: RESEND_API_KEY=your_key npx tsx scripts/schedule-team-emails.ts")
  process.exit(1)
}

// Team members from USER_CREDENTIALS.md + test recipient
const teamMembers = [
  { name: "Agustin Montoya", email: "agustin.montoya@distillery.com", password: "btcStn60" },
  { name: "George Durzi", email: "george@attorneyshare.com", password: "EaofVmUcF8UwzaS5" },
  { name: "Kathy Shulman", email: "kathy@attorneyshare.com", password: "8ktstzNiQcHPA$#t" },
  { name: "Brandon Almeda", email: "brandon@attorneyshare.com", password: "xbE%nZLg#$9BMcnJ" },
  { name: "Jorge Cazares", email: "jorge.cazares@distillery.com", password: "FneR$r6EDQ$X2Qez" },
  { name: "Robert Perez", email: "robertp@attorneyshare.com", password: "zGu@w8a8EJ@YkTFz" },
  { name: "Jenni Labao", email: "jenni@attorneyshare.com", password: "iC%qTbPswLc4MoHo" },
  { name: "Renzo Servera", email: "renzo.servera@distillery.com", password: "W8HFghSgQSm6Tg#X" },
  { name: "Ivan Grosse", email: "ivan.grosse@distillery.com", password: "PVV83!oyQUpWQiLn" },
]

// Schedule time: January 9, 2026 at 9:00 AM Argentina time (UTC-3) = 12:00 UTC
const SCHEDULED_AT = "2026-01-09T12:00:00Z"

async function scheduleTeamEmails() {
  console.log("📅 Scheduling team credential emails...")
  console.log(`   Scheduled for: ${SCHEDULED_AT} (9:00 AM Argentina time)`)
  console.log(`   Template: AttorneyShare`)
  console.log(`   Recipients: ${teamMembers.length} team members`)
  console.log("=" .repeat(60))

  const results = {
    scheduled: 0,
    failed: 0,
    details: [] as Array<{ email: string; status: string; emailId?: string; error?: string }>
  }

  for (const member of teamMembers) {
    console.log(`\n📧 Scheduling email for ${member.name} (${member.email})...`)

    // Render the email template
    const html = renderAttorneyShareEmail({
      name: member.name,
      email: member.email,
      password: member.password,
      role: "viewer",
      dashboardUrl: "https://e2e-test-dashboard.vercel.app",
    })

    // Schedule the email
    const result = await sendEmail({
      to: member.email,
      subject: "AttorneyShare E2E Test Dashboard - Your Access Credentials",
      html,
      scheduledAt: SCHEDULED_AT,
    })

    if (result.success) {
      results.scheduled++
      results.details.push({ email: member.email, status: "scheduled", emailId: result.emailId })
      console.log(`   ✅ Scheduled! Email ID: ${result.emailId}`)
    } else {
      results.failed++
      results.details.push({ email: member.email, status: "failed", error: result.error })
      console.log(`   ❌ Failed: ${result.error}`)
    }

    // Small delay between API calls
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  console.log("\n" + "=".repeat(60))
  console.log("📊 Summary:")
  console.log(`   ✅ Scheduled: ${results.scheduled}`)
  console.log(`   ❌ Failed: ${results.failed}`)
  console.log(`\n📬 Emails will be delivered at: 9:00 AM (Argentina time)`)

  if (results.failed > 0) {
    console.log("\n⚠️ Failed emails:")
    results.details
      .filter(d => d.status === "failed")
      .forEach(d => console.log(`   - ${d.email}: ${d.error}`))
  }

  return results
}

scheduleTeamEmails()
  .then((results) => {
    console.log("\n✅ Script complete!")
    process.exit(results.failed > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error)
    process.exit(1)
  })
