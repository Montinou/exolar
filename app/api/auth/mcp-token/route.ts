import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import * as jose from "jose"
import { getSql } from "@/lib/db"

export const dynamic = "force-dynamic"

// Secret for signing MCP tokens - should be set in environment
const MCP_TOKEN_SECRET = process.env.MCP_TOKEN_SECRET || process.env.DATABASE_URL || "mcp-token-secret"

// Token validity: 30 days
const TOKEN_VALIDITY_DAYS = 30

export async function POST() {
  try {
    const context = await getSessionContext()

    if (!context) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Generate a secure JWT for MCP
    const secret = new TextEncoder().encode(MCP_TOKEN_SECRET)
    const expiresAt = new Date(Date.now() + TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000)

    const token = await new jose.SignJWT({
      sub: context.userId.toString(),
      email: context.email,
      org_id: context.organizationId,
      org_slug: context.organizationSlug,
      org_role: context.orgRole,
      type: "mcp",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .setIssuer("exolar-qa")
      .setAudience("mcp-client")
      .sign(secret)

    // Optionally store the token in database for revocation tracking
    const sql = getSql()
    await sql`
      INSERT INTO mcp_tokens (user_id, organization_id, token_hash, expires_at)
      VALUES (
        ${context.userId},
        ${context.organizationId},
        ${await hashToken(token)},
        ${expiresAt.toISOString()}
      )
      ON CONFLICT (user_id, organization_id) DO UPDATE SET
        token_hash = ${await hashToken(token)},
        expires_at = ${expiresAt.toISOString()},
        updated_at = NOW()
    `.catch(() => {
      // Table might not exist yet, that's okay
      console.warn("[mcp-token] Could not store token in database (table may not exist)")
    })

    return NextResponse.json({
      token,
      organizationId: context.organizationId,
      organizationSlug: context.organizationSlug,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error("[auth/mcp-token] Error:", error)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}
