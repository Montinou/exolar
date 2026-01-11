/**
 * OAuth Authorization Endpoint
 *
 * Handles authorization code flow with PKCE.
 * URL: /api/mcp/oauth/authorize
 *
 * The authorization code is a signed JWT containing all necessary data,
 * so no database storage is required (serverless-compatible).
 */

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSessionContext } from "@/lib/session-context"
import * as jose from "jose"

// Secret for signing authorization codes
const MCP_TOKEN_SECRET = process.env.MCP_TOKEN_SECRET || process.env.DATABASE_URL || "mcp-token-secret"

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

  // Store the authorization request in a cookie for the login flow
  const authRequest = {
    clientId,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
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
}

interface SessionContext {
  userId: number
  organizationId: number
  organizationSlug: string
  email: string
  orgRole: string
}

/**
 * Generate a self-contained authorization code (signed JWT)
 * This allows the token endpoint to verify it without database lookup
 */
async function generateAuthorizationCode(
  authRequest: AuthRequest,
  context: SessionContext
): Promise<NextResponse> {
  const secret = new TextEncoder().encode(MCP_TOKEN_SECRET)

  // Create a signed JWT containing all the authorization data
  // This is the authorization code - it's self-contained and verifiable
  const code = await new jose.SignJWT({
    // User info
    sub: context.userId.toString(),
    org_id: context.organizationId,
    org_slug: context.organizationSlug,
    email: context.email,
    org_role: context.orgRole,
    // OAuth params for validation
    client_id: authRequest.clientId,
    redirect_uri: authRequest.redirectUri,
    code_challenge: authRequest.codeChallenge,
    code_challenge_method: authRequest.codeChallengeMethod,
    // Type marker
    type: "auth_code",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m") // 5 minute expiry
    .setIssuer("exolar-qa")
    .setAudience("mcp-oauth")
    .sign(secret)

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
