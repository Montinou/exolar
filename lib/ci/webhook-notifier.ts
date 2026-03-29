// Webhook notifier — fires after test results ingestion when failures detected
// Called from the ingestion pipeline after insertExecution/insertTestResults

import { getSql } from "@/lib/db/connection"
import { createHmac } from "crypto"

export interface WebhookPayload {
  event: "ci.failure"
  execution_id: number
  organization_id: number
  run_id: string
  branch: string
  repo?: string
  failure_count: number
  total_tests: number
  timestamp: string
}

interface WebhookConfig {
  id: number
  url: string
  events: string[]
  filters: {
    min_failures?: number
    only_critical?: boolean
    branches?: string[]
  }
  secret_hash: string | null
}

/**
 * Fetch active webhooks for an org that match the given event.
 */
async function getActiveWebhooks(orgId: number, event: string): Promise<WebhookConfig[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, url, events, filters, secret_hash
    FROM org_webhooks
    WHERE organization_id = ${orgId}
      AND is_active = true
      AND ${event} = ANY(events)
  `
  return rows as WebhookConfig[]
}

/**
 * Check if a webhook's filters match the payload.
 */
function matchesFilters(webhook: WebhookConfig, payload: WebhookPayload): boolean {
  const filters = webhook.filters || {}
  if (filters.min_failures && payload.failure_count < filters.min_failures) return false
  if (filters.branches && filters.branches.length > 0 && !filters.branches.includes(payload.branch)) return false
  return true
}

/**
 * Sign payload with HMAC-SHA256 if webhook has a secret.
 */
function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

/**
 * Send webhook notification to all matching endpoints for an org.
 * Fire-and-forget — errors are logged but don't throw.
 */
export async function notifyWebhooks(payload: WebhookPayload): Promise<void> {
  const webhooks = await getActiveWebhooks(payload.organization_id, payload.event)
  if (webhooks.length === 0) return

  const body = JSON.stringify(payload)

  const results = await Promise.allSettled(
    webhooks
      .filter(wh => matchesFilters(wh, payload))
      .map(async (wh) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Exolar-Event": payload.event,
          "X-Exolar-Delivery": `${payload.execution_id}-${Date.now()}`,
        }
        if (wh.secret_hash) {
          headers["X-Exolar-Signature"] = `sha256=${signPayload(body, wh.secret_hash)}`
        }

        const response = await fetch(wh.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(10_000), // 10s timeout
        })

        if (!response.ok) {
          console.error(`[Webhook] Failed to deliver to ${wh.url}: ${response.status}`)
        }
      })
  )

  const failed = results.filter(r => r.status === "rejected")
  if (failed.length > 0) {
    console.error(`[Webhook] ${failed.length}/${results.length} deliveries failed`)
  }
}
