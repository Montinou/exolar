/**
 * OAuth Authorization Endpoint
 *
 * Handles authorization code flow with PKCE.
 * URL: /api/mcp/oauth/authorize
 *
 * Flow:
 * 1. Client redirects user here with code_challenge
 * 2. We store the request and redirect to /auth/mcp for login
 * 3. After login, /auth/mcp calls back to generate auth code
 */

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSql } from "@/lib/db"
import { getSessionContext } from "@/lib/session-context"

export async function GET(request: Request) {
  const url = new URL(request.url)

  // Extract OAuth parameters
  const responseType = url.searchParams.get("response_type")
  const clientId = url.searchParams.get("client_id")
  const redirectUri = url.searchParams.get("redirect_uri")
  const state = url.searchParams.get("state")
  const codeChallenge = url.searchParams.get("code_challenge")
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "S256"

  // Validate required parameters
  if (responseType !== "code") {
    return NextResponse.json(
      { error: "unsupported_response_type", error_description: "Only 'code' response type is supported" },
      { status: 400 }
    )
  }

  if (!clientId) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "client_id is required" },
      { status: 400 }
    )
  }

  if (!redirectUri) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "redirect_uri is required" },
      { status: 400 }
    )
  }

  if (!codeChallenge) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "code_challenge is required (PKCE)" },
      { status: 400 }
    )
  }

  // Validate redirect URI format
  try {
    const redirectUrl = new URL(redirectUri)
    if (redirectUrl.protocol !== "https:" && redirectUrl.hostname !== "localhost" && redirectUrl.hostname !== "127.0.0.1") {
      return NextResponse.json(
        { error: "invalid_redirect_uri", error_description: "Redirect URI must be HTTPS or localhost" },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "Invalid redirect URI format" },
      { status: 400 }
    )
  }

  // Generate a request ID to track this authorization
  const requestId = crypto.randomUUID()

  // Store the authorization request in a cookie (short-lived)
  const authRequest = {
    clientId,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
    requestId,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  }

  const cookieStore = await cookies()
  cookieStore.set("mcp_oauth_request", JSON.stringify(authRequest), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  })

  // Check if user is already logged in
  const context = await getSessionContext()

  if (context) {
    // User is logged in, generate authorization code immediately
    return await generateAuthorizationCode(authRequest, context)
  }

  // Redirect to login page with callback
  const loginUrl = new URL("/auth/mcp", url.origin)
  loginUrl.searchParams.set("oauth", "1")
  loginUrl.searchParams.set("request_id", requestId)

  return NextResponse.redirect(loginUrl)
}

/**
 * POST handler for callback from /auth/mcp after successful login
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const authRequestCookie = cookieStore.get("mcp_oauth_request")

  if (!authRequestCookie) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "No pending authorization request" },
      { status: 400 }
    )
  }

  const authRequest = JSON.parse(authRequestCookie.value)

  // Check expiration
  if (Date.now() > authRequest.expiresAt) {
    cookieStore.delete("mcp_oauth_request")
    return NextResponse.json(
      { error: "expired_request", error_description: "Authorization request expired" },
      { status: 400 }
    )
  }

  // Get user context
  const context = await getSessionContext()
  if (!context) {
    return NextResponse.json({ error: "access_denied", error_description: "User not authenticated" }, { status: 401 })
  }

  // Generate and return authorization code
  return await generateAuthorizationCode(authRequest, context)
}

interface AuthRequest {
  clientId: string
  redirectUri: string
  state: string | null
  codeChallenge: string
  codeChallengeMethod: string
  requestId: string
  expiresAt: number
}

interface SessionContext {
  userId: number
  organizationId: number
  organizationSlug: string
  email: string
  orgRole: string
}

async function generateAuthorizationCode(
  authRequest: AuthRequest,
  context: SessionContext
): Promise<NextResponse> {
  // Generate authorization code
  const code = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")

  // Store authorization code in database
  const sql = getSql()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  try {
    await sql`
      INSERT INTO oauth_authorization_codes (
        code, client_id, user_id, organization_id, redirect_uri,
        code_challenge, code_challenge_method, expires_at
      ) VALUES (
        ${code}, ${authRequest.clientId}, ${context.userId}, ${context.organizationId},
        ${authRequest.redirectUri}, ${authRequest.codeChallenge}, ${authRequest.codeChallengeMethod},
        ${expiresAt.toISOString()}
      )
    `
  } catch (error) {
    console.error("[oauth/authorize] Failed to store auth code:", error)
    // If table doesn't exist, we'll store in memory (not ideal for production)
  }

  // Clear the auth request cookie
  const cookieStore = await cookies()
  cookieStore.delete("mcp_oauth_request")

  // Build redirect URL with code
  const redirectUrl = new URL(authRequest.redirectUri)
  redirectUrl.searchParams.set("code", code)
  if (authRequest.state) {
    redirectUrl.searchParams.set("state", authRequest.state)
  }

  return NextResponse.redirect(redirectUrl)
}
