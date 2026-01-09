/**
 * Email service types for Resend integration
 */

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  scheduledAt?: string // ISO 8601 format, e.g., "2026-01-09T14:00:00Z"
}

export interface InviteEmailData {
  email: string
  password: string
  role: "admin" | "viewer"
  name?: string
  dashboardUrl?: string
  template?: "attorneyshare" | "exolar" // Default: attorneyshare
}

export interface BulkEmailRequest {
  users: Array<{
    email: string
    password: string
    role: "admin" | "viewer"
    name?: string
  }>
  template?: "attorneyshare" | "exolar" // Default: attorneyshare
}

export interface BulkEmailResponse {
  sent: number
  failed: number
  errors: Array<{
    email: string
    error: string
  }>
  details: Array<{
    email: string
    status: "sent" | "failed"
    emailId?: string
  }>
}
