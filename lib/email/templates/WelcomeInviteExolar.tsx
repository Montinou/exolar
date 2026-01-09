/**
 * Welcome Invite Email Template - Exolar Product
 * For inviting external customers to the Exolar Testing Dashboard
 */

import * as React from "react"
import { render } from "@react-email/render"

interface WelcomeInviteExolarProps {
  name: string
  email: string
  password: string
  role: "admin" | "viewer"
  dashboardUrl: string
}

/**
 * Welcome Invite Email Component - Exolar Product
 */
export function WelcomeInviteExolarEmail({ name, email, password, role, dashboardUrl }: WelcomeInviteExolarProps) {
  const roleDisplay = role === "admin" ? "Administrator" : "Team Member"

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
                  <h1 style={styles.title}>Welcome to Exolar Testing Dashboard</h1>
                  <p style={styles.subtitle}>Enterprise E2E Test Monitoring & Analytics</p>
                </div>

                {/* Greeting */}
                <p style={styles.text}>Hi {name},</p>

                <p style={styles.text}>
                  Welcome to <strong>Exolar Testing Dashboard</strong>! Your team has invited you to join as a <strong>{roleDisplay}</strong>.
                </p>

                <p style={styles.text}>
                  Exolar provides comprehensive monitoring, analytics, and insights for your end-to-end test automation. Track test health, identify flaky tests, and catch performance regressions before they reach production.
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
                  <p style={styles.warningText}>🔒 For security, please change your password after your first login.</p>
                </div>

                {/* CTA Button */}
                <div style={styles.buttonContainer}>
                  <a href={`${dashboardUrl}/auth/sign-in`} style={styles.button}>
                    Get Started
                  </a>
                </div>

                {/* What You Can Do */}
                <div style={styles.featuresSection}>
                  <h3 style={styles.featuresTitle}>Platform Features:</h3>
                  <ul style={styles.featuresList}>
                    <li style={styles.featuresItem}>📊 <strong>Real-Time Monitoring</strong> - Track test executions as they happen</li>
                    <li style={styles.featuresItem}>📈 <strong>Trends & Analytics</strong> - Visualize pass rates and identify patterns</li>
                    <li style={styles.featuresItem}>🐛 <strong>Flaky Test Detection</strong> - Automatically identify unreliable tests</li>
                    <li style={styles.featuresItem}>⚡ <strong>Performance Insights</strong> - Catch regressions before deployment</li>
                    <li style={styles.featuresItem}>🎯 <strong>Smart Filtering</strong> - Drill down by branch, suite, or timeframe</li>
                    <li style={styles.featuresItem}>📄 <strong>Test Artifacts</strong> - Access screenshots, traces, and logs</li>
                    <li style={styles.featuresItem}>🤖 <strong>Claude Code Integration</strong> - Query your tests with AI via MCP</li>
                  </ul>
                </div>

                {/* Getting Started */}
                <div style={styles.gettingStartedSection}>
                  <h3 style={styles.gettingStartedTitle}>Getting Started:</h3>
                  <ol style={styles.gettingStartedList}>
                    <li style={styles.gettingStartedItem}>
                      <strong>Login</strong> - Use the credentials above to access your dashboard
                    </li>
                    <li style={styles.gettingStartedItem}>
                      <strong>Integrate Your CI/CD</strong> - Connect Playwright tests to Exolar using our reporter
                    </li>
                    <li style={styles.gettingStartedItem}>
                      <strong>Explore Your Data</strong> - View test results, trends, and failure analysis
                    </li>
                    <li style={styles.gettingStartedItem}>
                      <strong>Configure Alerts</strong> - Get notified when tests fail or become flaky
                    </li>
                  </ol>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                  <p style={styles.footerText}>
                    Need help getting started? Check out our{" "}
                    <a href={`${dashboardUrl}/docs`} style={styles.link}>
                      documentation
                    </a>{" "}
                    or contact our support team.
                  </p>
                  <p style={styles.footerText}>
                    <small style={styles.small}>
                      © 2026 Exolar Testing Dashboard. All rights reserved.
                      <br />
                      This is an automated email. Please do not reply.
                    </small>
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
export function renderWelcomeInviteExolar(props: WelcomeInviteExolarProps): string {
  return render(<WelcomeInviteExolarEmail {...props} />, { pretty: false })
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
    borderBottom: "2px solid #8b5cf6",
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
    backgroundColor: "#faf5ff",
    border: "2px solid #e9d5ff",
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
    backgroundColor: "#e9d5ff",
    color: "#6b21a8",
    padding: "4px 8px",
    borderRadius: "4px",
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: "14px",
  },
  link: {
    color: "#7c3aed",
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
    backgroundColor: "#7c3aed",
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
    listStyle: "none",
  },
  featuresItem: {
    margin: "8px 0",
  },
  gettingStartedSection: {
    backgroundColor: "#f1f5f9",
    borderRadius: "8px",
    padding: "20px 24px",
    margin: "32px 0",
  },
  gettingStartedTitle: {
    color: "#1e293b",
    fontSize: "18px",
    fontWeight: "600",
    margin: "0 0 12px 0",
  },
  gettingStartedList: {
    color: "#334155",
    fontSize: "15px",
    lineHeight: "26px",
    margin: "0",
    paddingLeft: "20px",
  },
  gettingStartedItem: {
    margin: "12px 0",
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
