import { NextResponse } from "next/server"
import { getSessionContext, isOrgAdmin } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import { generateApiKey } from "@/lib/api-keys"

export const dynamic = "force-dynamic"

/**
 * GET /api/settings/api-keys
 * List API keys based on user role:
 * - Admins: See all organization API keys
 * - Viewers: See only their own keys
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)
    const isAdmin = isOrgAdmin(context)

    // Role-based filtering
    const apiKeys = isAdmin
      ? await db.getApiKeys() // Admins see all org keys
      : await db.getApiKeysByUser(context.userId) // Viewers see only their own

    return NextResponse.json({ apiKeys, isAdmin })
  } catch (error) {
    console.error("[api-keys] Error fetching API keys:", error)
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 })
  }
}

/**
 * POST /api/settings/api-keys
 * Create a new API key
 * All authenticated users can create their own keys
 * Returns the full key ONCE - it cannot be retrieved again
 */
export async function POST(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    // Store in database (createdBy tracks ownership)
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
 * - Admins: Can revoke any org key
 * - Viewers: Can only revoke keys they created
 */
export async function DELETE(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get("id")

    if (!keyId || isNaN(Number(keyId))) {
      return NextResponse.json({ error: "Invalid key ID" }, { status: 400 })
    }

    const db = getQueriesForOrg(context.organizationId)
    const isAdmin = isOrgAdmin(context)

    // For non-admins, verify they own the key
    if (!isAdmin) {
      const userKeys = await db.getApiKeysByUser(context.userId)
      const ownsKey = userKeys.some(k => k.id === Number(keyId))
      if (!ownsKey) {
        return NextResponse.json({ error: "Forbidden: You can only revoke your own keys" }, { status: 403 })
      }
    }

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
