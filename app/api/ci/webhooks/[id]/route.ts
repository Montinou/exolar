import { NextResponse } from "next/server"
import { getSessionContext, isOrgAdmin } from "@/lib/session-context"
import { getSql } from "@/lib/db/connection"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/ci/webhooks/[id]
 * Update webhook fields (name, url, events, filters, is_active).
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isOrgAdmin(context)) {
      return NextResponse.json({ error: "Forbidden: org admin required" }, { status: 403 })
    }

    const { id } = await params
    const webhookId = Number(id)
    if (isNaN(webhookId)) {
      return NextResponse.json({ error: "Invalid webhook ID" }, { status: 400 })
    }

    const sql = getSql()

    // Verify ownership
    const existing = await sql`
      SELECT id FROM org_webhooks
      WHERE id = ${webhookId} AND organization_id = ${context.organizationId}
    `
    if (existing.length === 0) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    const body = await request.json()
    const { name, url, events, filters, is_active } = body

    if (url !== undefined) {
      try {
        new URL(url)
      } catch {
        return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 })
      }
    }

    if (events !== undefined) {
      const validEvents = ["failure", "flake", "healed"]
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json({ error: "events must be a non-empty array" }, { status: 400 })
      }
      const invalid = events.find((e: unknown) => !validEvents.includes(e as string))
      if (invalid) {
        return NextResponse.json({ error: `invalid event: ${invalid}` }, { status: 400 })
      }
    }

    const rows = await sql`
      UPDATE org_webhooks
      SET
        name       = COALESCE(${name ?? null}, name),
        url        = COALESCE(${url ?? null}, url),
        events     = COALESCE(${events ?? null}, events),
        filters    = COALESCE(${filters != null ? JSON.stringify(filters) : null}::jsonb, filters),
        is_active  = COALESCE(${is_active ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${webhookId} AND organization_id = ${context.organizationId}
      RETURNING id, name, url, events, filters, is_active, created_at, updated_at
    `

    return NextResponse.json({ webhook: rows[0] })
  } catch (error) {
    console.error("[webhooks] PATCH error:", error)
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 })
  }
}

/**
 * DELETE /api/ci/webhooks/[id]
 * Delete a webhook permanently.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isOrgAdmin(context)) {
      return NextResponse.json({ error: "Forbidden: org admin required" }, { status: 403 })
    }

    const { id } = await params
    const webhookId = Number(id)
    if (isNaN(webhookId)) {
      return NextResponse.json({ error: "Invalid webhook ID" }, { status: 400 })
    }

    const sql = getSql()
    const result = await sql`
      DELETE FROM org_webhooks
      WHERE id = ${webhookId} AND organization_id = ${context.organizationId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[webhooks] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 })
  }
}
