/**
 * Test Email Sending Script
 * Usage: RESEND_API_KEY=your_key npx tsx scripts/test-email.ts
 */

import { sendInviteEmail } from "../lib/email/resend"

// Check if API key is set
if (!process.env.RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY environment variable is not set")
  console.error("   Run: RESEND_API_KEY=your_key npx tsx scripts/test-email.ts")
  process.exit(1)
}

async function testEmailSending() {
  console.log("🧪 Testing email sending functionality...")
  console.log("=" .repeat(60))

  // Test AttorneyShare template
  console.log("\n📧 Sending AttorneyShare template to agusmontoya@gmail.com...")
  const attorneyShareResult = await sendInviteEmail({
    email: "agusmontoya@gmail.com",
    password: "TestPassword123!",
    role: "admin",
    name: "Agustin Montoya",
    template: "attorneyshare",
  })

  if (attorneyShareResult.success) {
    console.log("✅ AttorneyShare email sent successfully!")
    console.log(`   Email ID: ${attorneyShareResult.emailId}`)
  } else {
    console.log("❌ AttorneyShare email failed:")
    console.log(`   Error: ${attorneyShareResult.error}`)
  }

  // Wait 2 seconds before sending the next email
  console.log("\n⏳ Waiting 2 seconds...")
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Test Exolar template
  console.log("\n📧 Sending Exolar template to agusmontoya@gmail.com...")
  const exolarResult = await sendInviteEmail({
    email: "agusmontoya@gmail.com",
    password: "TestPassword123!",
    role: "admin",
    name: "Agustin Montoya",
    template: "exolar",
  })

  if (exolarResult.success) {
    console.log("✅ Exolar email sent successfully!")
    console.log(`   Email ID: ${exolarResult.emailId}`)
  } else {
    console.log("❌ Exolar email failed:")
    console.log(`   Error: ${exolarResult.error}`)
  }

  console.log("\n" + "=".repeat(60))
  console.log("📊 Test Summary:")
  console.log(`   AttorneyShare: ${attorneyShareResult.success ? "✅ Success" : "❌ Failed"}`)
  console.log(`   Exolar: ${exolarResult.success ? "✅ Success" : "❌ Failed"}`)
  console.log("\n📬 Check your inbox at agusmontoya@gmail.com")
  console.log("   (Check spam folder if you don't see the emails)")
}

testEmailSending()
  .then(() => {
    console.log("\n✅ Test complete!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error)
    process.exit(1)
  })
