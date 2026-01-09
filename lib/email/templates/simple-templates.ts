/**
 * Simple HTML Email Templates (Non-React)
 * Direct HTML strings for email sending
 *
 * Design System: Exolar Dark Theme
 * - Deep Void background: #0d0f1a
 * - Glass cards: #141729 with accent border glow
 * - AttorneyShare: Cyan accent (#4dd0e1)
 * - Exolar: Amber accent (#f5a623)
 */

export interface EmailTemplateProps {
  name: string
  email: string
  password: string
  role: "admin" | "viewer"
  dashboardUrl: string
}

export function renderAttorneyShareEmail(props: EmailTemplateProps): string {
  const { name, email, password, role, dashboardUrl } = props
  const roleDisplay = role === "admin" ? "Administrator" : "Viewer"

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080a14;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #080a14; padding: 48px 20px;">
    <tr>
      <td align="center">
        <!-- Outer glow container -->
        <table width="620" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(77, 208, 225, 0.15), rgba(77, 208, 225, 0.05)); border-radius: 20px; padding: 2px;">
          <tr>
            <td>
              <!-- Main card with glass effect -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #12152a 0%, #0d1020 100%); border-radius: 18px; border: 1px solid rgba(77, 208, 225, 0.25); box-shadow: 0 4px 60px rgba(77, 208, 225, 0.2), 0 0 120px rgba(77, 208, 225, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05);">
                <!-- Header with gradient accent -->
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="height: 4px; background: linear-gradient(90deg, #4dd0e1, #00acc1, #4dd0e1); border-radius: 18px 18px 0 0;"></td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 40px 24px;">
                      <tr>
                        <td align="center">
                          <h1 style="margin: 0 0 8px; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">AttorneyShare E2E Test Dashboard</h1>
                          <p style="margin: 0; font-size: 14px; color: rgba(77, 208, 225, 0.9); text-transform: uppercase; letter-spacing: 2px;">Internal Team Access</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 24px 40px 32px;">
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 26px; color: #b8bcc8;">Hi <strong style="color: #ffffff;">${name}</strong>,</p>

                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 26px; color: #b8bcc8;">
                      You've been granted access to the <strong style="color: #4dd0e1;">AttorneyShare E2E Test Dashboard</strong> as a <strong style="color: #ffffff;">${roleDisplay}</strong>.
                    </p>

                    <p style="margin: 0 0 28px; font-size: 15px; line-height: 24px; color: #7a7f8c;">
                      This internal tool provides real-time monitoring and analytics for all AttorneyShare Playwright test executions.
                    </p>

                    <!-- Credentials Box with enhanced glass effect -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(77, 208, 225, 0.08), rgba(20, 25, 45, 0.9)); border: 1px solid rgba(77, 208, 225, 0.35); border-radius: 16px; margin: 24px 0; box-shadow: 0 8px 32px rgba(77, 208, 225, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.03);">
                      <tr>
                        <td style="padding: 28px;">
                          <h2 style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #4dd0e1; text-transform: uppercase; letter-spacing: 1px;">🔐 Your Login Credentials</h2>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 10px 0; color: #7a7f8c; font-size: 13px; width: 28%; vertical-align: top;">Email</td>
                              <td style="padding: 10px 0; color: #ffffff; font-size: 14px; font-weight: 500;">${email}</td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; color: #7a7f8c; font-size: 13px; vertical-align: top;">Password</td>
                              <td style="padding: 10px 0;">
                                <span style="display: inline-block; color: #4dd0e1; font-size: 14px; font-weight: 600; font-family: 'SF Mono', 'Consolas', 'Monaco', monospace; background: rgba(77, 208, 225, 0.12); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(77, 208, 225, 0.2);">${password}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; color: #7a7f8c; font-size: 13px; vertical-align: top;">Role</td>
                              <td style="padding: 10px 0; color: #ffffff; font-size: 14px; font-weight: 500;">${roleDisplay}</td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; color: #7a7f8c; font-size: 13px; vertical-align: top;">Dashboard</td>
                              <td style="padding: 10px 0; font-size: 14px;"><a href="${dashboardUrl}" style="color: #4dd0e1; text-decoration: none; border-bottom: 1px solid rgba(77, 208, 225, 0.3);">${dashboardUrl}</a></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Security Warning -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(245, 166, 35, 0.08); border: 1px solid rgba(245, 166, 35, 0.25); border-radius: 10px; margin: 24px 0;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <p style="margin: 0; font-size: 13px; color: #f5a623;">⚠️ Please change your password after your first login for security.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button with enhanced glow -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 36px 0;">
                      <tr>
                        <td align="center">
                          <a href="${dashboardUrl}/auth/sign-in" style="display: inline-block; background: linear-gradient(135deg, #4dd0e1 0%, #00acc1 50%, #0097a7 100%); color: #080a14; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 24px rgba(77, 208, 225, 0.4), 0 0 40px rgba(77, 208, 225, 0.2); letter-spacing: 0.5px;">Access Dashboard →</a>
                        </td>
                      </tr>
                    </table>

                    <!-- Features with glass cards -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                      <tr>
                        <td>
                          <h3 style="margin: 0 0 20px; font-size: 15px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">What You Can Monitor</h3>
                          <table width="100%" cellpadding="0" cellspacing="8">
                            <tr>
                              <td style="padding: 12px 16px; background: rgba(77, 208, 225, 0.05); border-radius: 8px; border: 1px solid rgba(77, 208, 225, 0.1);">
                                <span style="color: #4dd0e1; font-size: 14px;">📊</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Test suite executions</span>
                              </td>
                              <td style="padding: 12px 16px; background: rgba(77, 208, 225, 0.05); border-radius: 8px; border: 1px solid rgba(77, 208, 225, 0.1);">
                                <span style="color: #4dd0e1; font-size: 14px;">📈</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Pass rates & trends</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 16px; background: rgba(245, 166, 35, 0.05); border-radius: 8px; border: 1px solid rgba(245, 166, 35, 0.1);">
                                <span style="color: #f5a623; font-size: 14px;">🐛</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Flaky test tracking</span>
                              </td>
                              <td style="padding: 12px 16px; background: rgba(77, 208, 225, 0.05); border-radius: 8px; border: 1px solid rgba(77, 208, 225, 0.1);">
                                <span style="color: #4dd0e1; font-size: 14px;">⚡</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Performance insights</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 16px; background: rgba(77, 208, 225, 0.05); border-radius: 8px; border: 1px solid rgba(77, 208, 225, 0.1);">
                                <span style="color: #4dd0e1; font-size: 14px;">🎯</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Branch filtering</span>
                              </td>
                              <td style="padding: 12px 16px; background: rgba(77, 208, 225, 0.05); border-radius: 8px; border: 1px solid rgba(77, 208, 225, 0.1);">
                                <span style="color: #4dd0e1; font-size: 14px;">📄</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Test artifacts</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 40px 32px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
                    <p style="margin: 0 0 8px; font-size: 13px; line-height: 20px; color: #7a7f8c; text-align: center;">
                      Questions? Contact the QA team or check the <a href="${dashboardUrl}/docs" style="color: #4dd0e1; text-decoration: none;">documentation</a>.
                    </p>
                    <p style="margin: 0; font-size: 11px; line-height: 18px; color: #4a4f5c; text-align: center;">
                      This is an automated email from AttorneyShare QA Infrastructure. Internal use only.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function renderExolarEmail(props: EmailTemplateProps): string {
  const { name, email, password, role, dashboardUrl } = props
  const roleDisplay = role === "admin" ? "Administrator" : "Team Member"

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080a14;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #080a14; padding: 48px 20px;">
    <tr>
      <td align="center">
        <!-- Outer glow container -->
        <table width="620" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(245, 166, 35, 0.15), rgba(139, 92, 246, 0.12), rgba(77, 208, 225, 0.08)); border-radius: 20px; padding: 2px;">
          <tr>
            <td>
              <!-- Main card with glass effect -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #0f1219 0%, #0a0d14 100%); border-radius: 18px; border: 1px solid rgba(139, 92, 246, 0.25); box-shadow: 0 4px 60px rgba(245, 166, 35, 0.12), 0 0 80px rgba(139, 92, 246, 0.15), 0 0 120px rgba(77, 208, 225, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05);">
                <!-- Header with gradient accent -->
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="height: 4px; background: linear-gradient(90deg, #f5a623, #8b5cf6, #4dd0e1); border-radius: 18px 18px 0 0;"></td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 24px 10px 0;">
                      <tr>
                        <td align="center">
                          <img src="${dashboardUrl}/assets/exolar-email-banner.png" alt="Exolar" width="600" height="200" style="display: block; border-radius: 12px; max-width: 100%;" />
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 24px 40px 24px;">
                      <tr>
                        <td align="center">
                          <p style="margin: 0; font-size: 14px; color: rgba(245, 166, 35, 0.9); text-transform: uppercase; letter-spacing: 2px;">E2E Test Monitoring Platform</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 24px 40px 32px;">
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 26px; color: #b8bcc8;">Hi <strong style="color: #ffffff;">${name}</strong>,</p>

                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 26px; color: #b8bcc8;">
                      Welcome to <strong style="color: #f5a623;">Exolar Testing Dashboard</strong>! Your team has invited you to join as a <strong style="color: #ffffff;">${roleDisplay}</strong>.
                    </p>

                    <p style="margin: 0 0 28px; font-size: 15px; line-height: 24px; color: #7a7f8c;">
                      Exolar provides comprehensive monitoring, analytics, and insights for your end-to-end test automation.
                    </p>

                    <!-- Credentials Box with enhanced glass effect -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(245, 166, 35, 0.04), rgba(15, 18, 25, 0.95)); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 16px; margin: 24px 0; box-shadow: 0 8px 32px rgba(139, 92, 246, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.03);">
                      <tr>
                        <td style="padding: 28px;">
                          <h2 style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #f5a623; text-transform: uppercase; letter-spacing: 1px;">🔐 Your Login Credentials</h2>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 10px 0; color: #7a7f8c; font-size: 13px; width: 28%; vertical-align: top;">Email</td>
                              <td style="padding: 10px 0; color: #ffffff; font-size: 14px; font-weight: 500;">${email}</td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; color: #7a7f8c; font-size: 13px; vertical-align: top;">Password</td>
                              <td style="padding: 10px 0;">
                                <span style="display: inline-block; color: #f5a623; font-size: 14px; font-weight: 600; font-family: 'SF Mono', 'Consolas', 'Monaco', monospace; background: rgba(245, 166, 35, 0.1); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(245, 166, 35, 0.2);">${password}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; color: #7a7f8c; font-size: 13px; vertical-align: top;">Role</td>
                              <td style="padding: 10px 0; color: #ffffff; font-size: 14px; font-weight: 500;">${roleDisplay}</td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; color: #7a7f8c; font-size: 13px; vertical-align: top;">Dashboard</td>
                              <td style="padding: 10px 0; font-size: 14px;"><a href="${dashboardUrl}" style="color: #f5a623; text-decoration: none; border-bottom: 1px solid rgba(245, 166, 35, 0.3);">${dashboardUrl}</a></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Security Warning -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(77, 208, 225, 0.06); border: 1px solid rgba(77, 208, 225, 0.2); border-radius: 10px; margin: 24px 0;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <p style="margin: 0; font-size: 13px; color: #4dd0e1;">🔒 For security, please change your password after your first login.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button with enhanced glow -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 36px 0;">
                      <tr>
                        <td align="center">
                          <a href="${dashboardUrl}/auth/sign-in" style="display: inline-block; background: linear-gradient(135deg, #f5a623 0%, #ff8f00 50%, #e68900 100%); color: #080a14; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 24px rgba(245, 166, 35, 0.4), 0 0 40px rgba(245, 166, 35, 0.15); letter-spacing: 0.5px;">Get Started →</a>
                        </td>
                      </tr>
                    </table>

                    <!-- Features with glass cards -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                      <tr>
                        <td>
                          <h3 style="margin: 0 0 20px; font-size: 15px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">Platform Features</h3>
                          <table width="100%" cellpadding="0" cellspacing="8">
                            <tr>
                              <td style="padding: 12px 16px; background: rgba(139, 92, 246, 0.06); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.15);">
                                <span style="color: #a78bfa; font-size: 14px;">📊</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Real-time monitoring</span>
                              </td>
                              <td style="padding: 12px 16px; background: rgba(77, 208, 225, 0.05); border-radius: 8px; border: 1px solid rgba(77, 208, 225, 0.1);">
                                <span style="color: #4dd0e1; font-size: 14px;">📈</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Trends & analytics</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 16px; background: rgba(245, 166, 35, 0.05); border-radius: 8px; border: 1px solid rgba(245, 166, 35, 0.1);">
                                <span style="color: #f5a623; font-size: 14px;">🐛</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Flaky test detection</span>
                              </td>
                              <td style="padding: 12px 16px; background: rgba(139, 92, 246, 0.06); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.15);">
                                <span style="color: #a78bfa; font-size: 14px;">⚡</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Performance insights</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 16px; background: rgba(77, 208, 225, 0.05); border-radius: 8px; border: 1px solid rgba(77, 208, 225, 0.1);">
                                <span style="color: #4dd0e1; font-size: 14px;">📄</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">Test artifacts</span>
                              </td>
                              <td style="padding: 12px 16px; background: rgba(245, 166, 35, 0.05); border-radius: 8px; border: 1px solid rgba(245, 166, 35, 0.1);">
                                <span style="color: #f5a623; font-size: 14px;">🤖</span>
                                <span style="color: #b8bcc8; font-size: 14px; margin-left: 10px;">AI via MCP</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 40px 32px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
                    <p style="margin: 0 0 8px; font-size: 13px; line-height: 20px; color: #7a7f8c; text-align: center;">
                      Need help? Check our <a href="${dashboardUrl}/docs" style="color: #f5a623; text-decoration: none;">documentation</a> or contact support.
                    </p>
                    <p style="margin: 0; font-size: 11px; line-height: 18px; color: #4a4f5c; text-align: center;">
                      © 2026 Exolar Testing Dashboard. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
