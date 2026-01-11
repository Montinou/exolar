/**
 * OAuth Token Endpoint
 *
 * Exchanges authorization codes for access tokens.
 * Validates PKCE code_verifier.
 *
 * URL: /api/mcp/oauth/token
 */

import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import * as jose from "jose"

// Secret for signing tokens
const MCP_TOKEN_SECRET = process.env.MCP_TOKEN_SECRET || process.env.DATABASE_URL || "mcp-token-secret"

// In-memory fallback for auth codes (when DB table doesn't exist)
const inMemoryAuthCodes = new Map<string, {
  clientId: string
  userId: number
  organizationId: number
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  expiresAt: Date
}>()

export async function POST(request: Request) {
  // Parse form data or JSON
  let body: Record<string, string>
  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData()
    body = Object.fromEntries(formData.entries()) as Record<string, string>
  } else {
    body = await request.json()
  }

  const grantType = body.grant_type
  const code = body.code
  const redirectUri = body.redirect_uri
  const clientId = body.client_id
  const codeVerifier = body.code_verifier

  // Validate grant type
  if (grantType !== "authorization_code") {
    return NextResponse.json(
      { error: "unsupported_grant_type", error_description: "Only authorization_code grant is supported" },
      { status: 400 }
    )
  }

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing required parameters" },
      { status: 400 }
    )
  }

  // Retrieve authorization code from database
  const sql = getSql()
  let authCode: {
    client_id: string
    user_id: number
    organization_id: number
    redirect_uri: string
    code_challenge: string
    code_challenge_method: string
    expires_at: Date
  } | null = null

  try {
    const result = await sql`
      SELECT client_id, user_id, organization_id, redirect_uri, 
             code_challenge, code_challenge_method, expires_at
      FROM oauth_authorization_codes
      WHERE code = ${code}
    `
    if (result.length > 0) {
      authCode = result[0] as typeof authCode
    }
  } catch {
    // Table might not exist, check in-memory
    const memCode = inMemoryAuthCodes.get(code)
    if (memCode) {
      authCode = {
        client_id: memCode.clientId,
        user_id: memCode.userId,
        organization_id: memCode.organizationId,
        redirect_uri: memCode.redirectUri,
        code_challenge: memCode.codeChallenge,
        code_challenge_method: memCode.codeChallengeMethod,
        expires_at: memCode.expiresAt,
      }
    }
  }

  if (!authCode) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Authorization code not found or expired" },
      { status: 400 }
    )
  }

  // Validate code hasn't expired
  if (new Date(authCode.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Authorization code expired" },
      { status: 400 }
    )
  }

  // Validate client_id
  if (authCode.client_id !== clientId) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Client ID mismatch" },
      { status: 400 }
    )
  }

  // Validate redirect_uri
  if (authCode.redirect_uri !== redirectUri) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Redirect URI mismatch" },
      { status: 400 }
    )
  }

  // Validate PKCE code_verifier
  const validPkce = await validatePkce(codeVerifier, authCode.code_challenge, authCode.code_challenge_method)
  if (!validPkce) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Invalid code_verifier" },
      { status: 400 }
    )
  }

  // Delete the authorization code (one-time use)
  try {
    await sql`DELETE FROM oauth_authorization_codes WHERE code = ${code}`
  } catch {
    inMemoryAuthCodes.delete(code)
  }

  // Get user info for token
  let userEmail = ""
  let orgSlug = ""
  let orgRole = "viewer"

  try {
    const userResult = await sql`
      SELECT u.email, o.slug as org_slug, om.role as org_role
      FROM dashboard_users u
      LEFT JOIN organizations o ON o.id = ${authCode.organization_id}
      LEFT JOIN organization_members om ON om.user_id = u.id AND om.organization_id = o.id
      WHERE u.id = ${authCode.user_id}
    `
    if (userResult.length > 0) {
      userEmail = userResult[0].email as string
      orgSlug = userResult[0].org_slug as string
      orgRole = (userResult[0].org_role as string) || "viewer"
    }
  } catch (error) {
    console.error("[oauth/token] Failed to get user info:", error)
  }

  // Generate access token (JWT)
  const secret = new TextEncoder().encode(MCP_TOKEN_SECRET)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const accessToken = await new jose.SignJWT({
    sub: authCode.user_id.toString(),
    email: userEmail,
    org_id: authCode.organization_id,
    org_slug: orgSlug,
    org_role: orgRole,
    type: "mcp",
    client_id: clientId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setIssuer("exolar-qa")
    .setAudience("mcp-client")
    .sign(secret)

  // Return token response
  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 30 * 24 * 60 * 60, // 30 days in seconds
    scope: "read:tests read:metrics",
  })
}

/**
 * Validate PKCE code_verifier against code_challenge
 */
async function validatePkce(
  codeVerifier: string,
  codeChallenge: string,
  codeChallengeMethod: string
): Promise<boolean> {
  if (codeChallengeMethod !== "S256") {
    // Only S256 is supported per OAuth 2.1
    return false
  }

  // Compute S256: BASE64URL(SHA256(code_verifier))
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = new Uint8Array(hashBuffer)

  // Base64URL encode
  const base64 = btoa(String.fromCharCode(...hashArray))
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

  return base64url === codeChallenge
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  })
}

// Export for use by authorize endpoint
export { inMemoryAuthCodes }
