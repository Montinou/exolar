import { NextResponse } from "next/server"
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
      const parsed = new URL(url)
      if (!["https:", "http:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "url must use https:// or http://" }, { status: 400 })
      }
      const hostname = parsed.hostname
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" ||
          hostname.startsWith("10.") || hostname.startsWith("192.168.") ||
          hostname.startsWith("169.254.") || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
        return NextResponse.json({ error: "url must not point to a private or loopback address" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 })
    }
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "at least one event is required" }, { status: 400 })
    }

    const validEvents = ["failure", "flake", "healed"]
    const invalidEvent = events.find((e: unknown) => typeof e !== "string" || !validEvents.includes(e))
    if (invalidEvent) {
      return NextResponse.json({ error: `invalid event: ${invalidEvent}` }, { status: 400 })
    }

    // Store raw secret for HMAC signing (Neon provides encryption at rest)
    const secretValue = secret && typeof secret === "string" && secret.length > 0
      ? secret
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
        ${secretValue}
      )
      RETURNING id, name, url, events, filters, is_active, created_at, updated_at
    `

    return NextResponse.json({ webhook: rows[0] }, { status: 201 })
  } catch (error) {
    console.error("[webhooks] POST error:", error)
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 })
  }
}
