/**
 * Welcome Invite Email Template - AttorneyShare Internal Team
 * For inviting AttorneyShare team members to the E2E Test Dashboard
 */

import * as React from "react"
import { render } from "@react-email/render"

interface WelcomeInviteAttorneyShareProps {
  name: string
  email: string
  password: string
  role: "admin" | "viewer"
  dashboardUrl: string
}

/**
 * Welcome Invite Email Component - AttorneyShare Internal
 */
export function WelcomeInviteAttorneyShareEmail({ name, email, password, role, dashboardUrl }: WelcomeInviteAttorneyShareProps) {
  const roleDisplay = role === "admin" ? "Administrator" : "Viewer"

  return (
    <html>
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      </head>
      <body style={styles.body}>
        <table style={styles.container}>
          <tbody>
            <tr>
              <td style={styles.content}>
                {/* Header */}
                <div style={styles.header}>
                  <h1 style={styles.title}>AttorneyShare E2E Test Dashboard</h1>
                  <p style={styles.subtitle}>Internal Team Access</p>
                </div>

                {/* Greeting */}
                <p style={styles.text}>Hi {name},</p>

                <p style={styles.text}>
                  You've been granted access to the <strong>AttorneyShare E2E Test Dashboard</strong> as a <strong>{roleDisplay}</strong>.
                </p>

                <p style={styles.text}>
                  This internal tool provides real-time monitoring and analytics for all AttorneyShare Playwright test executions, including negotiation flows, referral networks, and marketplace features.
                </p>

                {/* Credentials Box */}
                <div style={styles.credentialsBox}>
                  <h2 style={styles.credentialsTitle}>Your Login Credentials</h2>
                  <table style={styles.credentialsTable}>
                    <tbody>
                      <tr>
                        <td style={styles.credentialLabel}>Email:</td>
                        <td style={styles.credentialValue}>{email}</td>
                      </tr>
                      <tr>
                        <td style={styles.credentialLabel}>Password:</td>
                        <td style={styles.credentialValue}>
                          <code style={styles.code}>{password}</code>
                        </td>
                      </tr>
                      <tr>
                        <td style={styles.credentialLabel}>Role:</td>
                        <td style={styles.credentialValue}>{roleDisplay}</td>
                      </tr>
                      <tr>
                        <td style={styles.credentialLabel}>Dashboard:</td>
                        <td style={styles.credentialValue}>
                          <a href={dashboardUrl} style={styles.link}>
                            {dashboardUrl}
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Security Notice */}
                <div style={styles.warningBox}>
                  <p style={styles.warningText}>🔒 Please change your password after your first login for security.</p>
                </div>

                {/* CTA Button */}
                <div style={styles.buttonContainer}>
                  <a href={`${dashboardUrl}/auth/sign-in`} style={styles.button}>
                    Access Dashboard
                  </a>
                </div>

                {/* What You Can Do */}
                <div style={styles.featuresSection}>
                  <h3 style={styles.featuresTitle}>What You Can Monitor:</h3>
                  <ul style={styles.featuresList}>
                    <li style={styles.featuresItem}>📊 Negotiation test suite executions (invite-to-case, proposals, acceptance)</li>
                    <li style={styles.featuresItem}>📈 Pass rates and trends for referral network features</li>
                    <li style={styles.featuresItem}>🐛 Flaky test tracking across all test suites</li>
                    <li style={styles.featuresItem}>⚡ Performance regressions in critical user flows</li>
                    <li style={styles.featuresItem}>🎯 Filter by branch (QA, staging, production)</li>
                    <li style={styles.featuresItem}>📄 Test artifacts (screenshots, traces, videos)</li>
                  </ul>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                  <p style={styles.footerText}>
                    Questions? Contact the QA team or check out the{" "}
                    <a href={`${dashboardUrl}/docs`} style={styles.link}>
                      internal documentation
                    </a>
                    .
                  </p>
                  <p style={styles.footerText}>
                    <small style={styles.small}>This is an automated email from AttorneyShare QA Infrastructure. Internal use only.</small>
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}

/**
 * Render the email template to HTML string
 */
export function renderWelcomeInviteAttorneyShare(props: WelcomeInviteAttorneyShareProps): string {
  return render(<WelcomeInviteAttorneyShareEmail {...props} />, { pretty: false })
}

// Inline styles for email client compatibility
const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    margin: "0",
    padding: "0",
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "40px 20px",
    maxWidth: "600px",
    width: "100%",
  },
  content: {
    padding: "0",
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "32px",
    paddingBottom: "24px",
    borderBottom: "2px solid #3b82f6",
  },
  title: {
    color: "#1e293b",
    fontSize: "28px",
    fontWeight: "700",
    margin: "0 0 8px 0",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "16px",
    margin: "0",
  },
  text: {
    color: "#334155",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0 0 16px 0",
  },
  credentialsBox: {
    backgroundColor: "#f8fafc",
    border: "2px solid #dbeafe",
    borderRadius: "8px",
    padding: "24px",
    margin: "24px 0",
  },
  credentialsTitle: {
    color: "#1e293b",
    fontSize: "18px",
    fontWeight: "600",
    margin: "0 0 16px 0",
  },
  credentialsTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  credentialLabel: {
    color: "#64748b",
    fontSize: "14px",
    padding: "8px 0",
    width: "30%",
    verticalAlign: "top" as const,
  },
  credentialValue: {
    color: "#1e293b",
    fontSize: "14px",
    fontWeight: "500",
    padding: "8px 0",
    wordBreak: "break-all" as const,
  },
  code: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
    padding: "4px 8px",
    borderRadius: "4px",
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: "14px",
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
  },
  warningBox: {
    backgroundColor: "#fef3c7",
    border: "1px solid #fbbf24",
    borderRadius: "6px",
    padding: "12px 16px",
    margin: "24px 0",
  },
  warningText: {
    color: "#92400e",
    fontSize: "14px",
    margin: "0",
  },
  buttonContainer: {
    textAlign: "center" as const,
    margin: "32px 0",
  },
  button: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "14px 32px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "600",
    fontSize: "16px",
    display: "inline-block",
  },
  featuresSection: {
    margin: "32px 0",
  },
  featuresTitle: {
    color: "#1e293b",
    fontSize: "18px",
    fontWeight: "600",
    margin: "0 0 12px 0",
  },
  featuresList: {
    color: "#334155",
    fontSize: "15px",
    lineHeight: "28px",
    margin: "0",
    paddingLeft: "20px",
  },
  featuresItem: {
    margin: "8px 0",
  },
  footer: {
    borderTop: "1px solid #e2e8f0",
    marginTop: "32px",
    paddingTop: "24px",
  },
  footerText: {
    color: "#64748b",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 8px 0",
    textAlign: "center" as const,
  },
  small: {
    fontSize: "12px",
    color: "#94a3b8",
  },
}
