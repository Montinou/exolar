import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { getSessionContext, isOrgAdmin } from "@/lib/session-context"
import { getSql } from "@/lib/db/connection"

export const dynamic = "force-dynamic"

/**
 * GET /api/ci/webhooks
 * List all webhooks for the authenticated user's organization.
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isOrgAdmin(context)) {
      return NextResponse.json({ error: "Forbidden: org admin required" }, { status: 403 })
    }

    const sql = getSql()
    const webhooks = await sql`
      SELECT id, name, url, events, filters, is_active, created_at, updated_at
      FROM org_webhooks
      WHERE organization_id = ${context.organizationId}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ webhooks })
  } catch (error) {
    console.error("[webhooks] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 })
  }
}

/**
 * POST /api/ci/webhooks
 * Create a new webhook. Secret is hashed with SHA-256 before storing.
 */
export async function POST(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isOrgAdmin(context)) {
      return NextResponse.json({ error: "Forbidden: org admin required" }, { status: 403 })
    }

    const body = await request.json()
    const { name, url, events, filters, secret } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 })
    }
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 })
    }
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "at least one event is required" }, { status: 400 })
    }

    const validEvents = ["failure", "flake", "healed"]
    const invalidEvent = events.find((e: unknown) => !validEvents.includes(e as string))
    if (invalidEvent) {
      return NextResponse.json({ error: `invalid event: ${invalidEvent}` }, { status: 400 })
    }

    const secretHash = secret
      ? createHash("sha256").update(secret as string).digest("hex")
      : null

    const filtersJson = filters && typeof filters === "object" ? filters : {}

    const sql = getSql()
    const rows = await sql`
      INSERT INTO org_webhooks (organization_id, name, url, events, filters, secret_hash)
      VALUES (
        ${context.organizationId},
        ${name.trim()},
        ${url.trim()},
        ${events},
        ${JSON.stringify(filtersJson)},
        ${secretHash}
      )
      RETURNING id, name, url, events, filters, is_active, created_at, updated_at
    `

    return NextResponse.json({ webhook: rows[0] }, { status: 201 })
  } catch (error) {
    console.error("[webhooks] POST error:", error)
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 })
  }
}
