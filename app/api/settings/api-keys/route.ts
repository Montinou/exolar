import { NextResponse } from "next/server"
import { getSessionContext, isOrgAdmin } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import { generateApiKey } from "@/lib/api-keys"

export const dynamic = "force-dynamic"

/**
 * GET /api/settings/api-keys
 * List all API keys for the user's organization (excludes key hashes)
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only org admins can view API keys
    if (!isOrgAdmin(context)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const db = getQueriesForOrg(context.organizationId)
    const apiKeys = await db.getApiKeys()

    return NextResponse.json({ apiKeys })
  } catch (error) {
    console.error("[api-keys] Error fetching API keys:", error)
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 })
  }
}

/**
 * POST /api/settings/api-keys
 * Create a new API key for the organization
 * Returns the full key ONCE - it cannot be retrieved again
 */
export async function POST(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only org admins can create API keys
    if (!isOrgAdmin(context)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    if (name.length > 100) {
      return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 })
    }

    // Generate the API key
    const { key, hash, prefix } = generateApiKey()

    // Store in database
    const db = getQueriesForOrg(context.organizationId)
    const apiKey = await db.createApiKey(name.trim(), hash, prefix, context.userId)

    // Return the full key ONCE
    return NextResponse.json({
      apiKey: {
        ...apiKey,
        key, // Full key - shown only once
      },
    })
  } catch (error) {
    console.error("[api-keys] Error creating API key:", error)
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/api-keys
 * Revoke an API key (soft delete)
 */
export async function DELETE(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only org admins can revoke API keys
    if (!isOrgAdmin(context)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get("id")

    if (!keyId || isNaN(Number(keyId))) {
      return NextResponse.json({ error: "Invalid key ID" }, { status: 400 })
    }

    const db = getQueriesForOrg(context.organizationId)
    const revoked = await db.revokeApiKey(Number(keyId))

    if (!revoked) {
      return NextResponse.json({ error: "API key not found or already revoked" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api-keys] Error revoking API key:", error)
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 })
  }
}
