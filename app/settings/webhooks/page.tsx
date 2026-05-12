import { redirect } from "next/navigation"
import { getSessionContext, isOrgAdmin } from "@/lib/session-context"
import { getSql } from "@/lib/db/connection"
import { PageContainer, PageHeader } from "@/components/shell"
import { WebhookList, type OrgWebhook } from "@/components/settings/webhook-list"

export default async function WebhooksSettingsPage() {
  const context = await getSessionContext()
  if (!context) {
    redirect("/auth/sign-in")
  }

  if (!isOrgAdmin(context)) {
    redirect("/settings")
  }

  const sql = getSql()
  const webhooks = await sql`
    SELECT id, name, url, events, filters, is_active, created_at, updated_at
    FROM org_webhooks
    WHERE organization_id = ${context.organizationId}
    ORDER BY created_at DESC
  `

  return (
    <PageContainer width="narrow">
      <PageHeader
        eyebrow="Settings · Webhooks"
        title="Outgoing webhooks"
        lede="Push test executions and failures to your own services. Filter by suite, branch, or outcome."
      />
      <WebhookList initialWebhooks={webhooks as OrgWebhook[]} />
    </PageContainer>
  )
}
