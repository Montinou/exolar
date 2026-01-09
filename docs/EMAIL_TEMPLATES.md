# Email Templates - Copy-Paste Guide

This document provides ready-to-use email templates for manually sending credentials to team members.

## Quick Send via Admin UI

**Recommended**: Use the web interface at `/admin/send-credentials` to automatically send emails with one click!

## Manual Copy-Paste Templates

If you need to send emails manually via Gmail, Outlook, or another email client, use these templates:

---

## Template 1: AttorneyShare Internal Team

### Subject Line
```
AttorneyShare E2E Test Dashboard - Your Access Credentials
```

### Email Body
```
Hi [NAME],

You've been granted access to the AttorneyShare E2E Test Dashboard as a [ROLE].

This internal tool provides real-time monitoring and analytics for all AttorneyShare Playwright test executions, including negotiation flows, referral networks, and marketplace features.

YOUR LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: [EMAIL]
Password: [PASSWORD]
Role: [ROLE]
Dashboard: https://e2e-test-dashboard.vercel.app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 IMPORTANT: Please change your password after your first login for security.

👉 Access Dashboard: https://e2e-test-dashboard.vercel.app/auth/sign-in

WHAT YOU CAN MONITOR:
• Negotiation test suite executions (invite-to-case, proposals, acceptance)
• Pass rates and trends for referral network features
• Flaky test tracking across all test suites
• Performance regressions in critical user flows
• Filter by branch (QA, staging, production)
• Test artifacts (screenshots, traces, videos)

Questions? Contact the QA team or check the internal documentation at:
https://e2e-test-dashboard.vercel.app/docs

---
This is an automated email from AttorneyShare QA Infrastructure. Internal use only.
```

---

## Template 2: Exolar Product Users

### Subject Line
```
Welcome to Exolar Testing Dashboard - Your Login Credentials
```

### Email Body
```
Hi [NAME],

Welcome to Exolar Testing Dashboard! Your team has invited you to join as a [ROLE].

Exolar provides comprehensive monitoring, analytics, and insights for your end-to-end test automation. Track test health, identify flaky tests, and catch performance regressions before they reach production.

YOUR LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: [EMAIL]
Password: [PASSWORD]
Role: [ROLE]
Dashboard: https://e2e-test-dashboard.vercel.app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 For security, please change your password after your first login.

👉 Get Started: https://e2e-test-dashboard.vercel.app/auth/sign-in

PLATFORM FEATURES:
📊 Real-Time Monitoring - Track test executions as they happen
📈 Trends & Analytics - Visualize pass rates and identify patterns
🐛 Flaky Test Detection - Automatically identify unreliable tests
⚡ Performance Insights - Catch regressions before deployment
🎯 Smart Filtering - Drill down by branch, suite, or timeframe
📄 Test Artifacts - Access screenshots, traces, and logs
🤖 Claude Code Integration - Query your tests with AI via MCP

GETTING STARTED:
1. Login with the credentials above
2. Integrate your CI/CD by connecting Playwright tests
3. Explore your data with the dashboard
4. Configure alerts for test failures

Need help? Check our documentation or contact support:
https://e2e-test-dashboard.vercel.app/docs

---
© 2026 Exolar Testing Dashboard. All rights reserved.
```

---

## Personalization Guide

Replace the following placeholders in each template:

- **[NAME]** - Recipient's full name (e.g., "George Durzi")
- **[EMAIL]** - Recipient's email address
- **[PASSWORD]** - Generated password from USER_CREDENTIALS.md
- **[ROLE]** - "Administrator" or "Viewer"

## Example: Personalized Email

For user: **George Durzi** (george@attorneyshare.com, admin, password: `EaofVmUcF8UwzaS5`)

### Subject
```
AttorneyShare E2E Test Dashboard - Your Access Credentials
```

### Body
```
Hi George Durzi,

You've been granted access to the AttorneyShare E2E Test Dashboard as an Administrator.

...

YOUR LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: george@attorneyshare.com
Password: EaofVmUcF8UwzaS5
Role: Administrator
Dashboard: https://e2e-test-dashboard.vercel.app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

...
```

---

## Team Members Reference

From [USER_CREDENTIALS.md](../USER_CREDENTIALS.md):

| Name | Email | Password | Role |
|------|-------|----------|------|
| George Durzi | george@attorneyshare.com | `EaofVmUcF8UwzaS5` | Administrator |
| Kathy Shulman | kathy@attorneyshare.com | `8ktstzNiQcHPA$#t` | Viewer |
| Brandon Almeda | brandon@attorneyshare.com | `xbE%nZLg#$9BMcnJ` | Viewer |
| Jorge Cazares | jorge.cazares@distillery.com | `FneR$r6EDQ$X2Qez` | Viewer |
| Robert Perez | robertp@attorneyshare.com | `zGu@w8a8EJ@YkTFz` | Viewer |
| Jenni Labao | jenni@attorneyshare.com | `iC%qTbPswLc4MoHo` | Viewer |
| Renzo Servera | renzo.servera@distillery.com | `W8HFghSgQSm6Tg#X` | Viewer |
| Ivan Grosse | ivan.grosse@distillery.com | `PVV83!oyQUpWQiLn` | Viewer |

---

## Best Practices

1. **Use the Admin UI** - Automated sending is faster and tracks delivery status
2. **BCC for bulk** - When sending manually to multiple people, use BCC to protect privacy
3. **Check spam** - Ask recipients to check spam folders if they don't see the email
4. **Password security** - Remind users to change passwords on first login
5. **Follow up** - Confirm receipt within 24 hours

---

**Last Updated**: 2026-01-09
**Automated Alternative**: `/admin/send-credentials`
