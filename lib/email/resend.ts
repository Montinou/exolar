/**
 * Resend email service
 * Handles all email sending functionality for the dashboard
 */

import { Resend } from "resend"
import type { EmailOptions, InviteEmailData } from "./types"
import { renderAttorneyShareEmail } from "./templates/simple-templates"
import { WelcomeInviteExolarEmail } from "./templates/WelcomeInviteExolar"
import * as React from "react"

// Lazy initialization of Resend client
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured - email sending disabled")
    return null
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

// Default sender email - using Resend's default testing email
// Update to your verified domain when ready for production
const DEFAULT_FROM_EMAIL = "Exolar Testing Dashboard <noreply@ai-innovation.site>"

/**
 * Send a generic email
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    const resend = getResendClient()
    if (!resend) {
      return { success: false, error: "Email service not configured (RESEND_API_KEY missing)" }
    }

    const { to, subject, html, from = DEFAULT_FROM_EMAIL, replyTo, scheduledAt } = options

    if (scheduledAt) {
      console.log("[Email] Scheduling email to:", to, "at:", scheduledAt)
    } else {
      console.log("[Email] Sending email to:", to)
    }

    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo && { reply_to: replyTo }),
      ...(scheduledAt && { scheduledAt }),
    })

    if (error) {
      console.error("[Email] Failed to send:", error)
      return { success: false, error: error.message || "Failed to send email" }
    }

    console.log("[Email] Successfully sent:", data?.id)
    return { success: true, emailId: data?.id }
  } catch (error) {
    console.error("[Email] Unexpected error:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Send invite email with credentials
 */
export async function sendInviteEmail(data: InviteEmailData): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    const resend = getResendClient()
    if (!resend) {
      return { success: false, error: "Email service not configured (RESEND_API_KEY missing)" }
    }

    const { email, password, role, name, dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "https://exolar.ai-innovation.site", template = "attorneyshare" } = data

    // Extract name from email if not provided
    const recipientName = name || email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

    // Subject line varies by template
    const subject =
      template === "exolar"
        ? "Welcome to Exolar Testing Dashboard - Your Login Credentials"
        : "AttorneyShare E2E Test Dashboard - Your Access Credentials"

    console.log("[Email] Sending invite email to:", email, "template:", template)

    // Use React component for Exolar, HTML string for AttorneyShare
    if (template === "exolar") {
      const { data: responseData, error } = await resend.emails.send({
        from: DEFAULT_FROM_EMAIL,
        to: [email],
        subject,
        react: React.createElement(WelcomeInviteExolarEmail, {
          name: recipientName,
          email,
          password,
          role,
          dashboardUrl,
        }),
      })

      if (error) {
        console.error("[Email] Failed to send:", error)
        return { success: false, error: error.message || "Failed to send email" }
      }

      console.log("[Email] Successfully sent:", responseData?.id)
      return { success: true, emailId: responseData?.id }
    } else {
      // Use HTML string for AttorneyShare
      const html = renderAttorneyShareEmail({
        name: recipientName,
        email,
        password,
        role,
        dashboardUrl,
      })

      return await sendEmail({
        to: email,
        subject,
        html,
      })
    }
  } catch (error) {
    console.error("[Email] Failed to send invite email:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Send bulk invite emails
 */
export async function sendBulkInviteEmails(
  users: Array<{ email: string; password: string; role: "admin" | "viewer"; name?: string; template?: "attorneyshare" | "exolar" }>
): Promise<{
  sent: number
  failed: number
  errors: Array<{ email: string; error: string }>
  details: Array<{ email: string; status: "sent" | "failed"; emailId?: string }>
}> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as Array<{ email: string; error: string }>,
    details: [] as Array<{ email: string; status: "sent" | "failed"; emailId?: string }>,
  }

  for (const user of users) {
    try {
      const result = await sendInviteEmail(user)

      if (result.success) {
        results.sent++
        results.details.push({
          email: user.email,
          status: "sent",
          emailId: result.emailId,
        })
      } else {
        results.failed++
        results.errors.push({
          email: user.email,
          error: result.error || "Unknown error",
        })
        results.details.push({
          email: user.email,
          status: "failed",
        })
      }
    } catch (error) {
      results.failed++
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      results.errors.push({
        email: user.email,
        error: errorMessage,
      })
      results.details.push({
        email: user.email,
        status: "failed",
      })
    }

    // Add small delay between emails to avoid rate limiting
    if (users.indexOf(user) < users.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return results
}
