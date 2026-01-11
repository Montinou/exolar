/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 *
 * Required by MCP spec for client discovery.
 * URL: /.well-known/oauth-authorization-server
 */

import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // Get origin from request
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  const metadata = {
    // Required fields
    issuer: origin,
    authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,

    // Optional but recommended
    registration_endpoint: `${origin}/api/mcp/oauth/register`,

    // OAuth 2.1 / PKCE support
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"], // Public clients only

    // Scopes
    scopes_supported: ["read:tests", "read:metrics"],

    // Service documentation
    service_documentation: `${origin}/docs/mcp`,
  }

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  })
}
