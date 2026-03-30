import { getSessionContext, isOrgAdmin } from "@/lib/session-context"
import { getSql } from "@/lib/db/connection"
import { redirect } from "next/navigation"
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
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <WebhookList initialWebhooks={webhooks as OrgWebhook[]} />
    </div>
  )
}
