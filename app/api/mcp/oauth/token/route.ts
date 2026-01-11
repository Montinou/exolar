/**
 * OAuth Token Endpoint
 *
 * Exchanges authorization codes for access tokens.
 * Validates PKCE code_verifier.
 *
 * URL: /api/mcp/oauth/token
 *
 * The authorization code is a self-contained signed JWT,
 * so no database lookup is required.
 */

import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import * as jose from "jose"

// Secret for signing/verifying tokens
const MCP_TOKEN_SECRET = process.env.MCP_TOKEN_SECRET || process.env.DATABASE_URL || "mcp-token-secret"

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

  // Verify the authorization code (it's a signed JWT)
  const secret = new TextEncoder().encode(MCP_TOKEN_SECRET)
  let authCodePayload: jose.JWTPayload

  try {
    const { payload } = await jose.jwtVerify(code, secret, {
      issuer: "exolar-qa",
      audience: "mcp-oauth",
    })
    authCodePayload = payload
  } catch (error) {
    console.error("[oauth/token] Invalid auth code:", error)
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Authorization code is invalid or expired" },
      { status: 400 }
    )
  }

  // Verify it's an auth code (not an access token)
  if (authCodePayload.type !== "auth_code") {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Invalid authorization code" },
      { status: 400 }
    )
  }

  // Validate client_id
  if (authCodePayload.client_id !== clientId) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Client ID mismatch" },
      { status: 400 }
    )
  }

  // Validate redirect_uri
  if (authCodePayload.redirect_uri !== redirectUri) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Redirect URI mismatch" },
      { status: 400 }
    )
  }

  // Validate PKCE code_verifier
  const codeChallenge = authCodePayload.code_challenge as string
  const codeChallengeMethod = authCodePayload.code_challenge_method as string

  const validPkce = await validatePkce(codeVerifier, codeChallenge, codeChallengeMethod)
  if (!validPkce) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Invalid code_verifier" },
      { status: 400 }
    )
  }

  // Extract user info from auth code
  const userId = parseInt(authCodePayload.sub as string, 10)
  const organizationId = authCodePayload.org_id as number
  const orgSlug = authCodePayload.org_slug as string
  const email = authCodePayload.email as string
  const orgRole = authCodePayload.org_role as string

  // Get user's role from database
  let userRole = "viewer"
  try {
    const sql = getSql()
    const result = await sql`
      SELECT role as user_role FROM dashboard_users WHERE id = ${userId}
    `
    if (result.length > 0) {
      userRole = result[0].user_role as string
    }
  } catch (error) {
    console.log("[oauth/token] Could not fetch user role:", error)
  }

  // Generate access token (JWT)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const accessToken = await new jose.SignJWT({
    sub: userId.toString(),
    email,
    org_id: organizationId,
    org_slug: orgSlug,
    org_role: orgRole,
    user_role: userRole,
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
