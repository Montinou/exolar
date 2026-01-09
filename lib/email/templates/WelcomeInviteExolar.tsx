/**
 * Welcome Invite Email Template - Exolar Product
 * For inviting external customers to the Exolar Testing Dashboard
 * Uses design inspired by the AnimatedBanner component
 */

import * as React from "react"

interface WelcomeInviteExolarProps {
  name: string
  email: string
  password: string
  role: "admin" | "viewer"
  dashboardUrl: string
}

/**
 * Email Banner Component - Animated GIF version of the banner
 */
function EmailBanner({ dashboardUrl }: { dashboardUrl: string }) {
  // Use the animated GIF banner
  const bannerUrl = `${dashboardUrl}/assets/banner-header.gif`

  return (
    <table
      width="100%"
      cellPadding="0"
      cellSpacing="0"
      style={{
        backgroundColor: "#000000",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        overflow: "hidden",
      }}
    >
      <tbody>
        <tr>
          <td style={{ textAlign: "center" as const }}>
            <img
              src={bannerUrl}
              alt="Exolar Testing Dashboard"
              width="700"
              style={{
                display: "block",
                width: "100%",
                maxWidth: "700px",
                height: "auto",
                borderRadius: "12px 12px 0 0",
              }}
            />
          </td>
        </tr>
        {/* Bottom accent line */}
        <tr>
          <td
            style={{
              height: "2px",
              background: "linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.5) 30%, rgba(34, 211, 238, 0.5) 70%, transparent)",
            }}
          />
        </tr>
      </tbody>
    </table>
  )
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
                {/* Animated Banner */}
                <div style={{ padding: "16px 16px 0" }}>
                  <EmailBanner dashboardUrl={dashboardUrl} />
                </div>

                {/* Subtitle */}
                <div style={styles.subtitleSection}>
                  <p style={styles.subtitle}>E2E Test Monitoring Platform</p>
                </div>

                {/* Greeting */}
                <p style={styles.text}>Hi {name},</p>

                <p style={styles.text}>
                  Welcome to <strong>Exolar Testing Dashboard</strong>! Your team has invited you to join as a{" "}
                  <strong>{roleDisplay}</strong>.
                </p>

                <p style={styles.text}>
                  Exolar provides comprehensive monitoring, analytics, and insights for your end-to-end test automation.
                  Track test health, identify flaky tests, and catch performance regressions before they reach production.
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
                    <li style={styles.featuresItem}>
                      📊 <strong>Real-Time Monitoring</strong> - Track test executions as they happen
                    </li>
                    <li style={styles.featuresItem}>
                      📈 <strong>Trends & Analytics</strong> - Visualize pass rates and identify patterns
                    </li>
                    <li style={styles.featuresItem}>
                      🐛 <strong>Flaky Test Detection</strong> - Automatically identify unreliable tests
                    </li>
                    <li style={styles.featuresItem}>
                      ⚡ <strong>Performance Insights</strong> - Catch regressions before deployment
                    </li>
                    <li style={styles.featuresItem}>
                      🎯 <strong>Smart Filtering</strong> - Drill down by branch, suite, or timeframe
                    </li>
                    <li style={styles.featuresItem}>
                      📄 <strong>Test Artifacts</strong> - Access screenshots, traces, and logs
                    </li>
                    <li style={styles.featuresItem}>
                      🤖 <strong>Claude Code Integration</strong> - Query your tests with AI via MCP
                    </li>
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

// Inline styles for email client compatibility
const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#080a14",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    margin: 0,
    padding: "48px 20px",
  },
  container: {
    backgroundColor: "#0f1219",
    margin: "0 auto",
    maxWidth: "700px",
    width: "100%",
    borderRadius: "18px",
    border: "1px solid rgba(139, 92, 246, 0.25)",
    boxShadow: "0 4px 60px rgba(77, 208, 225, 0.12), 0 0 80px rgba(139, 92, 246, 0.15)",
    overflow: "hidden",
  },
  content: {
    padding: 0,
  },
  subtitleSection: {
    textAlign: "center" as const,
    padding: "20px 40px 24px",
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    color: "rgba(77, 208, 225, 0.9)",
    textTransform: "uppercase" as const,
    letterSpacing: "2px",
  },
  text: {
    color: "#b8bcc8",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 16px 0",
    padding: "0 40px",
  },
  credentialsBox: {
    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(245, 166, 35, 0.04), rgba(15, 18, 25, 0.95))",
    border: "1px solid rgba(139, 92, 246, 0.35)",
    borderRadius: "16px",
    padding: "28px",
    margin: "24px 40px",
    boxShadow: "0 8px 32px rgba(139, 92, 246, 0.12)",
  },
  credentialsTitle: {
    color: "#4dd0e1",
    fontSize: "16px",
    fontWeight: 600,
    margin: "0 0 20px 0",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },
  credentialsTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  credentialLabel: {
    color: "#7a7f8c",
    fontSize: "13px",
    padding: "10px 0",
    width: "28%",
    verticalAlign: "top" as const,
  },
  credentialValue: {
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 500,
    padding: "10px 0",
    wordBreak: "break-all" as const,
  },
  code: {
    display: "inline-block",
    backgroundColor: "rgba(77, 208, 225, 0.1)",
    color: "#4dd0e1",
    padding: "8px 14px",
    borderRadius: "8px",
    fontFamily: '"SF Mono", Consolas, Monaco, monospace',
    fontSize: "14px",
    fontWeight: 600,
    border: "1px solid rgba(77, 208, 225, 0.2)",
  },
  link: {
    color: "#4dd0e1",
    textDecoration: "none",
    borderBottom: "1px solid rgba(77, 208, 225, 0.3)",
  },
  warningBox: {
    backgroundColor: "rgba(245, 166, 35, 0.06)",
    border: "1px solid rgba(245, 166, 35, 0.2)",
    borderRadius: "10px",
    padding: "14px 18px",
    margin: "24px 40px",
  },
  warningText: {
    color: "#f5a623",
    fontSize: "13px",
    margin: 0,
  },
  buttonContainer: {
    textAlign: "center" as const,
    margin: "36px 0",
  },
  button: {
    display: "inline-block",
    background: "linear-gradient(135deg, #4dd0e1 0%, #22d3ee 50%, #06b6d4 100%)",
    color: "#080a14",
    padding: "16px 40px",
    borderRadius: "10px",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "15px",
    boxShadow: "0 4px 24px rgba(77, 208, 225, 0.4), 0 0 40px rgba(77, 208, 225, 0.15)",
    letterSpacing: "0.5px",
  },
  featuresSection: {
    margin: "32px 40px",
  },
  featuresTitle: {
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    margin: "0 0 20px 0",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },
  featuresList: {
    color: "#b8bcc8",
    fontSize: "15px",
    lineHeight: "28px",
    margin: 0,
    paddingLeft: "20px",
    listStyle: "none",
  },
  featuresItem: {
    margin: "8px 0",
  },
  gettingStartedSection: {
    backgroundColor: "rgba(139, 92, 246, 0.06)",
    borderRadius: "8px",
    padding: "20px 24px",
    margin: "32px 40px",
    border: "1px solid rgba(139, 92, 246, 0.15)",
  },
  gettingStartedTitle: {
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    margin: "0 0 12px 0",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },
  gettingStartedList: {
    color: "#b8bcc8",
    fontSize: "15px",
    lineHeight: "26px",
    margin: 0,
    paddingLeft: "20px",
  },
  gettingStartedItem: {
    margin: "12px 0",
  },
  footer: {
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
    marginTop: "32px",
    paddingTop: "24px",
    padding: "24px 40px 32px",
  },
  footerText: {
    color: "#7a7f8c",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0 0 8px 0",
    textAlign: "center" as const,
  },
  small: {
    fontSize: "11px",
    color: "#4a4f5c",
  },
}
